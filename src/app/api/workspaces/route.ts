// ==============================================================
// LINKEDIN AUTOPILOT - WORKSPACE MANAGEMENT API
// BY GT INNOX LLP
// ==============================================================

import { getAuthContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET() {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: memberships, error } = await admin
    .from('workspace_members')
    .select('role, workspaces(id, name, slug, created_at)')
    .eq('user_id', auth.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const workspaces = (memberships || [])
    .filter((m: any) => m.workspaces)
    .map((m: any) => ({
      id: m.workspaces.id,
      name: m.workspaces.name,
      slug: m.workspaces.slug,
      role: m.role,
      isCurrent: m.workspaces.id === auth.workspaceId,
      createdAt: m.workspaces.created_at,
    }));

  return NextResponse.json({ workspaces });
}

export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name } = await request.json();
    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Workspace name is required' }, { status: 400 });
    }

    const admin = createAdminClient();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30) + '-' + Date.now().toString(36);

    const { data: newWs, error: createErr } = await admin
      .from('workspaces')
      .insert({
        name: name.trim(),
        slug,
        owner_id: auth.user.id,
      })
      .select()
      .single();

    if (createErr || !newWs) {
      return NextResponse.json({ error: createErr?.message || 'Failed to create workspace' }, { status: 500 });
    }

    // Add creator as owner
    await admin.from('workspace_members').insert({
      workspace_id: newWs.id,
      user_id: auth.user.id,
      role: 'owner',
    });

    return NextResponse.json({ success: true, workspace: newWs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (auth.role !== 'owner' && auth.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden: Only workspace Owners and Admins can update settings.' },
      { status: 403 }
    );
  }

  try {
    const { name } = await request.json();
    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: 'Workspace name is required' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: updated, error } = await admin
      .from('workspaces')
      .update({
        name: name.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', auth.workspaceId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, workspace: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

