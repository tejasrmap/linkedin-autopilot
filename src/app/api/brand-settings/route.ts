// ==============================================================
// LINKEDIN AUTOPILOT — BRAND SETTINGS ENDPOINT
// WORKSPACE ISOLATION & ROLE-BASED ACCESS CONTROL (RBAC)
// BY GT INNOX LLP
// ==============================================================

import { getAuthContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const BrandSettingsSchema = z.object({
  brandName: z.string().min(2, 'Brand name must be at least 2 characters'),
  industry: z.string().optional().nullable(),
  targetAudience: z.string().optional().nullable(),
  brandVoice: z.string().optional().nullable(),
  preferredHashtags: z.array(z.string()).default([]),
});

export async function GET(request: Request) {
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

    const admin = createAdminClient();
    const { data: settings } = await admin
      .from('brand_settings')
      .select('*')
      .eq('workspace_id', auth.workspaceId)
      .single();

    return NextResponse.json({ settings: settings || null });
  } catch (err: any) {
    console.error('[Brand Settings GET Error]:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
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

    // Phase 2 RBAC: Only workspace owners and admins can update brand settings
    const ALLOWED_ROLES = ['owner', 'admin'];
    if (!ALLOWED_ROLES.includes(auth.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only workspace owners and admins can update brand settings' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validated = BrandSettingsSchema.parse(body);

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
      console.error('[Brand Settings DB Upsert Error]:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ settings: updated });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request payload', details: err.errors }, { status: 400 });
    }
    console.error('[Brand Settings PUT Error]:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
