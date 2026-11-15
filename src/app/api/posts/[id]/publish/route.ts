import { getAuthContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { executePublishPipeline } from '@/lib/queue/publisher';
import { NextResponse } from 'next/server';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!['owner', 'admin', 'editor', 'approver'].includes(auth.role)) {
    return NextResponse.json({ error: 'Permission denied: cannot publish posts' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: post, error: postErr } = await admin
    .from('posts')
    .select('id, workspace_id')
    .eq('id', params.id)
    .eq('workspace_id', auth.workspaceId)
    .maybeSingle();

  if (postErr || !post) {
    return NextResponse.json({ error: 'Post not found or inaccessible.' }, { status: 404 });
  }

  const result = await executePublishPipeline(params.id);

  if (!result.success) {
    return NextResponse.json({ error: result.error || 'Failed to publish post' }, { status: 400 });
  }

  return NextResponse.json({ success: true, message: 'Post published successfully to LinkedIn!' });
}

