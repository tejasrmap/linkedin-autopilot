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
    user: auth.user,
    currentWorkspaceId: auth.workspaceId,
    role: auth.role,
    workspaces: formattedWorkspaces,
  });
}

