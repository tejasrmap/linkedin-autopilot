import { getAuthContext } from '@/lib/auth';
import { aiService } from '@/lib/ai/gemini';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const IdeasSchema = z.object({
  industry: z.string().min(2),
  count: z.number().int().min(1).max(10).default(5),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { industry, count } = IdeasSchema.parse(body);

    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    const admin = createAdminClient();
    await admin.from('ai_generations').insert({
      workspace_id: auth.workspaceId,
      user_id: auth.user.id,
      prompt: `Ideas: ${industry}`,
      generated_content: JSON.stringify(ideas),
      generation_type: 'ideas',
    });

    return NextResponse.json({ ideas });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
