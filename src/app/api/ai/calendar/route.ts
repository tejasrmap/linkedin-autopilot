// ==============================================================
// LINKEDIN AUTOPILOT — AI CONTENT CALENDAR ENDPOINT
// 7-DAY STRATEGIC CALENDAR GENERATION & TENANT ISOLATION
// BY GT INNOX LLP
// ==============================================================

import { getAuthContext } from '@/lib/auth';
import { aiService } from '@/lib/ai/gemini';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const CalendarPlanSchema = z.object({
  industry: z.string().min(2, 'Industry must be at least 2 characters'),
  tone: z.string().default('Professional and visionary'),
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
    const { industry, tone } = CalendarPlanSchema.parse(body);

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
    try {
      const admin = createAdminClient();
      await admin.from('ai_generations').insert({
        workspace_id: auth.workspaceId,
        user_id: auth.user.id,
        prompt: `${industry} (${tone})`,
        generated_content: JSON.stringify(plan),
        generation_type: 'calendar_7day',
      });
    } catch (insertErr) {
      console.warn('[AI Calendar] Could not persist generation to ledger:', insertErr);
    }

    return NextResponse.json({ plan });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request payload', details: err.errors }, { status: 400 });
    }
    console.error('[AI Calendar Route Error]:', err);
    return NextResponse.json({ error: 'Internal AI calendar generation error' }, { status: 500 });
  }
}
