import { getAuthContext } from '@/lib/auth';
import { aiService } from '@/lib/ai/gemini';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const GenerateSchema = z.object({
  topic: z.string().min(2, 'Topic must be at least 2 characters'),
  targetAudience: z.string().optional(),
  tone: z.string().optional(),
  length: z.enum(['short', 'medium', 'long']).default('medium'),
  contentType: z.string().optional(),
  useBrandVoice: z.boolean().default(false),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = GenerateSchema.parse(body);

    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limiting per workspace (30 generations per minute)
    const rateCheck = checkRateLimit(`ai:${auth.workspaceId}`, { limit: 30, windowMs: 60000 });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `AI Studio rate limit exceeded. Please wait ${Math.ceil(
            rateCheck.resetMs / 1000
          )}s before requesting new post generations.`,
        },
        { status: 429 }
      );
    }

    const admin = createAdminClient();
    let brandVoiceOptions: any = undefined;

    if (validated.useBrandVoice) {
      const { data: brandSettings } = await admin
        .from('brand_settings')
        .select('*')
        .eq('workspace_id', auth.workspaceId)
        .single();

      if (brandSettings) {
        brandVoiceOptions = {
          brandName: brandSettings.brand_name,
          industry: brandSettings.industry,
          targetAudience: brandSettings.target_audience,
          brandVoice: brandSettings.brand_voice,
          preferredHashtags: brandSettings.preferred_hashtags,
        };
      }
    }

    const customKey = request.headers.get('x-gemini-key') || undefined;
    const generatedContent = await aiService.generatePost({
      topic: validated.topic,
      targetAudience: validated.targetAudience,
      tone: validated.tone,
      length: validated.length,
      contentType: validated.contentType,
      brandVoice: brandVoiceOptions,
      apiKey: customKey,
    });

    // Record generation for history
    await admin.from('ai_generations').insert({
      workspace_id: auth.workspaceId,
      user_id: auth.user.id,
      prompt: validated.topic,
      generated_content: generatedContent,
      generation_type: 'post',
    });

    return NextResponse.json({ content: generatedContent });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

