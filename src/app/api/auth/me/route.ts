import { getAuthContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedWs = searchParams.get('workspaceId');

  const auth = await getAuthContext(requestedWs);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  // Fetch user profile with avatar
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, email, avatar_url')
    .eq('id', auth.user.id)
    .single();

  let avatarUrl = profile?.avatar_url || null;

  // If profile avatar_url is missing, check connected LinkedIn social account
  if (!avatarUrl && auth.workspaceId) {
    const { data: socialAcc } = await admin
      .from('social_accounts')
      .select('profile_image_url')
      .eq('workspace_id', auth.workspaceId)
      .not('profile_image_url', 'is', null)
      .limit(1)
      .single();

    if (socialAcc?.profile_image_url) {
      avatarUrl = socialAcc.profile_image_url;
      // Auto-backfill profile
      await admin.from('profiles').update({ avatar_url: avatarUrl }).eq('id', auth.user.id);
    }
  }

  const { data: workspaces } = await admin
    .from('workspace_members')
    .select('role, workspaces(id, name, slug)')
    .eq('user_id', auth.user.id);

  let formattedWorkspaces = (workspaces || [])
    .filter((w: any) => w.workspaces)
    .map((w: any) => ({
      id: w.workspaces.id,
      name: w.workspaces.name,
      slug: w.workspaces.slug,
      role: w.role,
    }));

  if (formattedWorkspaces.length === 0 && auth.workspaceId) {
    const { data: ws } = await admin.from('workspaces').select('id, name, slug').eq('id', auth.workspaceId).single();
    if (ws) {
      formattedWorkspaces = [{ id: ws.id, name: ws.name, slug: ws.slug, role: auth.role }];
    }
  }

  return NextResponse.json({
    user: {
      ...auth.user,
      full_name: profile?.full_name || auth.user.full_name,
      avatar_url: avatarUrl,
    },
    currentWorkspaceId: auth.workspaceId,
    role: auth.role,
    workspaces: formattedWorkspaces,
  });
}

