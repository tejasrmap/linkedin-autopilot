import { getAuthContext } from '@/lib/auth';
import { cancelScheduledJob } from '@/lib/queue/publisher';
import { NextResponse } from 'next/server';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const success = await cancelScheduledJob(params.id);

  return NextResponse.json({ success, message: 'Scheduled post cancelled and moved back to drafts.' });
}

