// ==============================================================
// LINKEDIN AUTOPILOT — AI IDEAS ENDPOINT
// VIRAL HOOKS, CONCEPT GENERATION & TENANT ISOLATION
// BY GT INNOX LLP
// ==============================================================

import { getAuthContext } from '@/lib/auth';
import { aiService } from '@/lib/ai/gemini';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const IdeasSchema = z.object({
  industry: z.string().min(2, 'Industry must be at least 2 characters'),
  count: z.number().int().min(1).max(10).default(5),
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
    const { industry, count } = IdeasSchema.parse(body);

    const rateCheck = checkRateLimit(`ai:${auth.workspaceId}`, { limit: 30, windowMs: 60000 });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `AI Studio rate limit exceeded. Please wait ${Math.ceil(
            rateCheck.resetMs / 1000
          )}s before requesting new ideas.`,
        },
        { status: 429 }
      );
    }

    const customKey = request.headers.get('x-gemini-key') || undefined;
    const ideas = await aiService.generateIdeas(industry, count, customKey);

    try {
      const admin = createAdminClient();
      await admin.from('ai_generations').insert({
        workspace_id: auth.workspaceId,
        user_id: auth.user.id,
        prompt: `Ideas: ${industry}`,
        generated_content: JSON.stringify(ideas),
        generation_type: 'ideas',
      });
    } catch (insertErr) {
      console.warn('[AI Ideas] Could not persist generation to ledger:', insertErr);
    }

    return NextResponse.json({ ideas });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request payload', details: err.errors }, { status: 400 });
    }
    console.error('[AI Ideas Route Error]:', err);
    return NextResponse.json({ error: 'Internal AI ideas generation error' }, { status: 500 });
  }
}
