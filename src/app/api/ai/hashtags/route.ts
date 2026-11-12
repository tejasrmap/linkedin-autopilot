import { getAuthContext } from '@/lib/auth';
import { aiService } from '@/lib/ai/gemini';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const HashtagsSchema = z.object({
  topic: z.string().min(2),
  count: z.number().int().min(1).max(15).default(6),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { topic, count } = HashtagsSchema.parse(body);

    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const hashtags = await aiService.generateHashtags(topic, count);
    return NextResponse.json({ hashtags });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

