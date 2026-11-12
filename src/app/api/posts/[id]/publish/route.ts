import { getAuthContext } from '@/lib/auth';
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

  const result = await executePublishPipeline(params.id);

  if (!result.success) {
    return NextResponse.json({ error: result.error || 'Failed to publish post' }, { status: 400 });
  }

  return NextResponse.json({ success: true, message: 'Post published successfully to LinkedIn!' });
}

