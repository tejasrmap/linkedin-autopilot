// ==============================================================
// LINKEDIN AUTOPILOT — AI REWRITE ENDPOINT
// CONTENT INTELLIGENCE & ACCURATE TONE REWRITING
// BY GT INNOX LLP
// ==============================================================

import { getAuthContext } from '@/lib/auth';
import { aiService } from '@/lib/ai/gemini';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const RewriteSchema = z.object({
  content: z.string().min(5, 'Content must be at least 5 characters'),
  targetTone: z.enum(['professional', 'conversational', 'technical', 'educational', 'persuasive', 'storytelling']),
  improveHook: z.boolean().default(true),
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
    const validated = RewriteSchema.parse(body);

    const rateCheck = checkRateLimit(`ai:${auth.workspaceId}`, { limit: 30, windowMs: 60000 });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `AI Studio rate limit exceeded. Please wait ${Math.ceil(
            rateCheck.resetMs / 1000
          )}s before requesting new post rewrites.`,
        },
        { status: 429 }
      );
    }

    const admin = createAdminClient();
    const customKey = request.headers.get('x-gemini-key') || undefined;

    const rewrittenContent = await aiService.rewritePost({
      content: validated.content,
      targetTone: validated.targetTone,
      improveHook: validated.improveHook,
      workspaceId: auth.workspaceId,
      userId: auth.user.id,
      supabaseClient: admin,
      apiKey: customKey,
    });

    try {
      await admin.from('ai_generations').insert({
        workspace_id: auth.workspaceId,
        user_id: auth.user.id,
        prompt: `Rewrite (${validated.targetTone}): ${validated.content.slice(0, 60)}...`,
        generated_content: rewrittenContent,
        generation_type: 'rewrite',
      });
    } catch (insertErr) {
      console.warn('[AI Rewrite] Could not persist rewrite to history ledger:', insertErr);
    }

    return NextResponse.json({ content: rewrittenContent });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request payload', details: err.errors }, { status: 400 });
    }
    console.error('[AI Rewrite Route Error]:', err);
    return NextResponse.json({ error: 'Internal AI rewrite error' }, { status: 500 });
  }
}
