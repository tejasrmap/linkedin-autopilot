import { getAuthContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { schedulePostPublishJob } from '@/lib/queue/publisher';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const ScheduleSchema = z.object({
  scheduledAt: z.string().datetime(),
  timezone: z.string().default('UTC'),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const { scheduledAt } = ScheduleSchema.parse(body);

    const requestWorkspaceId = request.headers.get('x-workspace-id') || null;
    const auth = await getAuthContext(requestWorkspaceId);
    if (!auth) {
      if (requestWorkspaceId) {
        return NextResponse.json({ error: 'Forbidden: Access denied to requested workspace' }, { status: 403 });
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['owner', 'admin', 'editor', 'approver'].includes(auth.role)) {
      return NextResponse.json({ error: 'Permission denied: cannot schedule posts' }, { status: 403 });
    }

    const scheduledDate = new Date(scheduledAt);
    if (scheduledDate.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'Scheduled time must be in the future.' }, { status: 400 });
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

    const result = await schedulePostPublishJob(params.id, auth.workspaceId, scheduledDate);

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to schedule post' }, { status: 500 });
    }

    return NextResponse.json({ success: true, queueJobId: result.queueJobId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

