import { getAuthContext } from '@/lib/auth';
import { aiService } from '@/lib/ai/gemini';
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

    const customKey = request.headers.get('x-gemini-key') || undefined;
    const ideas = await aiService.generateIdeas(industry, count, customKey);
    return NextResponse.json({ ideas });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

