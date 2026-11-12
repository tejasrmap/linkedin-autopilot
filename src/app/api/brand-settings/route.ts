import { getAuthContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const BrandSettingsSchema = z.object({
  brandName: z.string().min(2),
  industry: z.string().optional().nullable(),
  targetAudience: z.string().optional().nullable(),
  brandVoice: z.string().optional().nullable(),
  preferredHashtags: z.array(z.string()).default([]),
});

export async function GET() {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: settings } = await admin
    .from('brand_settings')
    .select('*')
    .eq('workspace_id', auth.workspaceId)
    .single();

  return NextResponse.json({ settings: settings || null });
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const validated = BrandSettingsSchema.parse(body);

    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: updated, error } = await admin
      .from('brand_settings')
      .upsert(
        {
          workspace_id: auth.workspaceId,
          brand_name: validated.brandName,
          industry: validated.industry,
          target_audience: validated.targetAudience,
          brand_voice: validated.brandVoice,
          preferred_hashtags: validated.preferredHashtags,
        },
        { onConflict: 'workspace_id' }
      )
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ settings: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

