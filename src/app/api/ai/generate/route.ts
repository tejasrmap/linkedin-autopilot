// ==============================================================
// LINKEDIN AUTOPILOT — AI GENERATION ENDPOINT
// CONTENT INTELLIGENCE, UNIQUENESS EVALUATION & TENANT ISOLATION
// BY GT INNOX LLP
// ==============================================================

import { getAuthContext } from '@/lib/auth';
import { aiService } from '@/lib/ai/gemini';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { GenerationMode, NarrativeArc } from '@/lib/ai/content-intelligence';

const GenerateSchema = z.object({
  topic: z.string().min(2, 'Topic must be at least 2 characters'),
  targetAudience: z.string().optional(),
  tone: z.string().optional(),
  length: z.enum(['short', 'medium', 'long']).default('medium'),
  contentType: z.string().optional(),
  useBrandVoice: z.boolean().default(false),
  generationMode: z
    .enum([
      'informative',
      'technical',
      'analytical',
      'opinion',
      'storytelling',
      'educational',
      'announcement',
      'reflective',
      'promotional',
    ])
    .optional(),
  narrativeArc: z.string().optional(),
  historyScope: z.enum(['user_personal', 'workspace_brand', 'unpersonalized']).optional(),
});

export async function POST(request: Request) {
  try {
    const requestWorkspaceId = request.headers.get('x-workspace-id') || null;
    const auth = await getAuthContext(requestWorkspaceId);
    if (!auth) {
      if (requestWorkspaceId) {
        return NextResponse.json({ error: 'Forbidden: Access denied to requested workspace' }, { status: 403 });
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (requestWorkspaceId && auth.workspaceId !== requestWorkspaceId) {
      return NextResponse.json({ error: 'Forbidden: Access denied to requested workspace' }, { status: 403 });
    }

    const body = await request.json();
    const validated = GenerateSchema.parse(body);

    // Rate limiting per workspace (30 generations per minute)
    const rateCheck = checkRateLimit(`ai:${auth.workspaceId}`, { limit: 30, windowMs: 60000 });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `AI Studio rate limit exceeded. Please wait ${Math.ceil(
            rateCheck.resetMs / 1000
          )}s before requesting new post generations.`,
        },
        { status: 429 }
      );
    }

    const admin = createAdminClient();
    let brandVoiceOptions: any = undefined;

    if (validated.useBrandVoice) {
      const { data: brandSettings } = await admin
        .from('brand_settings')
        .select('*')
        .eq('workspace_id', auth.workspaceId)
        .single();

      if (brandSettings) {
        brandVoiceOptions = {
          brandName: brandSettings.brand_name,
          industry: brandSettings.industry,
          targetAudience: brandSettings.target_audience,
          brandVoice: brandSettings.brand_voice,
          preferredHashtags: brandSettings.preferred_hashtags,
        };
      }
    }

    const customKey = request.headers.get('x-gemini-key') || undefined;

    // WORKSPACE AUTHORIZATION & SERVER-DERIVED HISTORY SCOPE:
    // 1. Role Verification: Validates that the server-authenticated session has a legitimate workspace role.
    const VALID_WORKSPACE_ROLES = ['owner', 'admin', 'editor', 'approver', 'viewer'] as const;
    if (!VALID_WORKSPACE_ROLES.includes(auth.role as any)) {
      return NextResponse.json({ error: 'Forbidden: Invalid workspace membership' }, { status: 403 });
    }

    // 2. Scope Derivation Policy:
    // - Unpersonalized: Permitted for any authenticated caller opting out of historical style context.
    // - Workspace Brand Voice: Activated when client requests useBrandVoice === true.
    //   Policy: Brand Voice is an organizational asset configured in brand_settings and approved posts,
    //   intentionally accessible to all authenticated workspace members (owner, admin, editor, approver, viewer)
    //   within their own auth.workspaceId.
    //   Anti-Bypass Guard: A client-supplied historyScope: 'workspace_brand' parameter without useBrandVoice === true
    //   is untrusted and ignored.
    // - User Personal (Default): Strictly isolates history to auth.workspaceId AND auth.user.id.
    let serverDerivedScope: 'user_personal' | 'workspace_brand' | 'unpersonalized';

    if (validated.historyScope === 'unpersonalized') {
      serverDerivedScope = 'unpersonalized';
    } else if (validated.useBrandVoice === true) {
      serverDerivedScope = 'workspace_brand';
    } else {
      serverDerivedScope = 'user_personal';
    }

    // Execute generation through Content Intelligence Engine
    const result = await aiService.generatePostWithReport({
      topic: validated.topic,
      targetAudience: validated.targetAudience,
      tone: validated.tone,
      length: validated.length,
      contentType: validated.contentType,
      generationMode: validated.generationMode as GenerationMode | undefined,
      narrativeArc: validated.narrativeArc as NarrativeArc | undefined,
      brandVoice: brandVoiceOptions,
      workspaceId: auth.workspaceId,
      userId: auth.user.id,
      historyScope: serverDerivedScope,
      supabaseClient: admin,
      apiKey: customKey,
    });

    // Record generation for historical corpus (safe against unapplied migration columns)
    try {
      await admin.from('ai_generations').insert({
        workspace_id: auth.workspaceId,
        user_id: auth.user.id,
        prompt: validated.topic,
        generated_content: result.content,
        generation_type: 'post',
      });
    } catch (insertErr) {
      console.warn('[AI Generate] Could not persist generation to history ledger:', insertErr);
    }

    return NextResponse.json({
      content: result.content,
      uniquenessScore: result.uniquenessScore,
      passed: result.passed,
      qualityStatus: result.qualityStatus,
      qualityWarnings: result.qualityWarnings,
      topicAnalysis: {
        category: result.analysis?.category || 'general',
        secondaryCategories: result.analysis?.secondaryCategories || [],
        isHybrid: result.analysis?.isHybrid || false,
        complexity: result.analysis?.technicalComplexity || 'practitioner',
        domainTerms: result.analysis?.domainTerms || [],
        mode: validated.generationMode || result.analysis?.recommendedMode || 'informative',
        narrativeArc: validated.narrativeArc || result.analysis?.recommendedNarrative || 'problem_investigation_solution',
      },
      retriesUsed: result.retriesUsed,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request payload', details: err.errors }, { status: 400 });
    }
    console.error('[AI Generate Route Error]:', err);
    return NextResponse.json({ error: err.message || 'Internal AI generation error' }, { status: 500 });
  }
}
