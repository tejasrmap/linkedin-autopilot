import { getAuthContext } from '@/lib/auth';
import { aiService } from '@/lib/ai/gemini';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const RewriteSchema = z.object({
  content: z.string().min(5),
  targetTone: z.enum(['professional', 'conversational', 'technical', 'educational', 'persuasive', 'storytelling']),
  improveHook: z.boolean().default(true),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = RewriteSchema.parse(body);

    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rewrittenContent = await aiService.rewritePost({
      content: validated.content,
      targetTone: validated.targetTone,
      improveHook: validated.improveHook,
    });

    const admin = createAdminClient();
    await admin.from('ai_generations').insert({
      workspace_id: auth.workspaceId,
      user_id: auth.user.id,
      prompt: `Rewrite to ${validated.targetTone}: ${validated.content.slice(0, 50)}...`,
      generated_content: rewrittenContent,
      generation_type: 'rewrite',
    });

    return NextResponse.json({ content: rewrittenContent });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

