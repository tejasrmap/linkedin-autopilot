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
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = GenerateSchema.parse(body);

    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
      topicAnalysis: {
        category: result.analysis.category,
        secondaryCategories: result.analysis.secondaryCategories,
        isHybrid: result.analysis.isHybrid,
        complexity: result.analysis.technicalComplexity,
        domainTerms: result.analysis.domainTerms,
        mode: validated.generationMode || result.analysis.recommendedMode,
        narrativeArc: validated.narrativeArc || result.analysis.recommendedNarrative,
      },
      retriesUsed: result.retriesUsed,
    });
  } catch (err: any) {
    console.error('[AI Generate Route Error]:', err);
    return NextResponse.json({ error: err.message || 'Internal AI generation error' }, { status: 500 });
  }
}
