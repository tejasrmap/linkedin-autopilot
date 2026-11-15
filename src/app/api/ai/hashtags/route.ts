// ==============================================================
// LINKEDIN AUTOPILOT — AI HASHTAGS ENDPOINT
// TOPIC EXTRACTION, HASHTAG DISCOVERY & TENANT ISOLATION
// BY GT INNOX LLP
// ==============================================================

import { getAuthContext } from '@/lib/auth';
import { aiService } from '@/lib/ai/gemini';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const HashtagsSchema = z.object({
  topic: z.string().min(2, 'Topic must be at least 2 characters'),
  count: z.number().int().min(1).max(15).default(6),
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
    const { topic, count } = HashtagsSchema.parse(body);

    const rateCheck = checkRateLimit(`ai:${auth.workspaceId}`, { limit: 30, windowMs: 60000 });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `AI Studio rate limit exceeded. Please wait ${Math.ceil(
            rateCheck.resetMs / 1000
          )}s before requesting new hashtags.`,
        },
        { status: 429 }
      );
    }

    const customKey = request.headers.get('x-gemini-key') || undefined;
    const hashtags = await aiService.generateHashtags(topic, count, customKey);

    try {
      const admin = createAdminClient();
      await admin.from('ai_generations').insert({
        workspace_id: auth.workspaceId,
        user_id: auth.user.id,
        prompt: `Hashtags: ${topic}`,
        generated_content: JSON.stringify(hashtags),
        generation_type: 'hashtags',
      });
    } catch (insertErr) {
      console.warn('[AI Hashtags] Could not persist generation to ledger:', insertErr);
    }

    return NextResponse.json({ hashtags });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request payload', details: err.errors }, { status: 400 });
    }
    console.error('[AI Hashtags Route Error]:', err);
    return NextResponse.json({ error: 'Internal AI hashtags generation error' }, { status: 500 });
  }
}
