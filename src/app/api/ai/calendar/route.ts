import { getAuthContext } from '@/lib/auth';
import { aiService } from '@/lib/ai/gemini';
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

    const plan = await aiService.generateContentCalendar(industry, tone);
    return NextResponse.json({ plan });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

