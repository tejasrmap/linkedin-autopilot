import { getAuthContext } from '@/lib/auth';
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

    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const scheduledDate = new Date(scheduledAt);
    if (scheduledDate.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'Scheduled time must be in the future.' }, { status: 400 });
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

