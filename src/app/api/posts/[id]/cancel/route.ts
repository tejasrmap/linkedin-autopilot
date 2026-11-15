import { getAuthContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { cancelScheduledJob } from '@/lib/queue/publisher';
import { NextResponse } from 'next/server';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!['owner', 'admin', 'editor', 'approver'].includes(auth.role)) {
    return NextResponse.json({ error: 'Permission denied: cannot cancel posts' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: post, error: postErr } = await admin
    .from('posts')
    .select('id, workspace_id, status')
    .eq('id', params.id)
    .eq('workspace_id', auth.workspaceId)
    .maybeSingle();

  if (postErr || !post) {
    return NextResponse.json({ error: 'Post not found or inaccessible.' }, { status: 404 });
  }

  if (!['scheduled', 'pending_approval'].includes(post.status)) {
    return NextResponse.json(
      { error: `Cannot cancel post in "${post.status}" status. Only scheduled posts can be cancelled.` },
      { status: 400 }
    );
  }

  const success = await cancelScheduledJob(params.id, auth.workspaceId);

  if (!success) {
    return NextResponse.json({ error: 'Failed to cancel scheduled post.' }, { status: 400 });
  }

  return NextResponse.json({ success: true, message: 'Scheduled post cancelled and moved back to drafts.' });
}

