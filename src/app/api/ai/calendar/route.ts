import { getAuthContext } from '@/lib/auth';
import { aiService } from '@/lib/ai/gemini';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const CalendarPlanSchema = z.object({
  industry: z.string().min(2),
  tone: z.string().default('Professional and visionary'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { industry, tone } = CalendarPlanSchema.parse(body);

    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting per workspace (20 AI generations per minute sliding window)
    const rateCheck = checkRateLimit(`ai:${auth.workspaceId}`, { limit: 20, windowMs: 60000 });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `AI Studio rate limit exceeded. Please wait ${Math.ceil(
            rateCheck.resetMs / 1000
          )}s before requesting new calendar generations.`,
        },
        { status: 429 }
      );
    }

    const customKey = request.headers.get('x-gemini-key') || undefined;
    const plan = await aiService.generateContentCalendar(industry, tone, customKey);

    // Track usage in ai_generations table
    const admin = createAdminClient();
    await admin.from('ai_generations').insert({
      workspace_id: auth.workspaceId,
      user_id: auth.user.id,
      prompt: `${industry} (${tone})`,
      generated_content: JSON.stringify(plan),
      generation_type: 'calendar_7day',
    });

    return NextResponse.json({ plan });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
