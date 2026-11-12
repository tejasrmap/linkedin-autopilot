import { getAuthContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { cancelScheduledJob } from '@/lib/queue/publisher';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const UpdatePostSchema = z.object({
  content: z.string().min(1).optional(),
  socialAccountId: z.string().uuid().optional().nullable(),
  postType: z.enum(['text', 'image', 'video', 'document', 'article']).optional(),
  mediaAssets: z.array(z.any()).optional(),
  status: z.enum(['draft', 'pending_approval', 'approved', 'scheduled', 'processing', 'published', 'failed', 'cancelled']).optional(),
  scheduledAt: z.string().datetime().optional().nullable(),
  timezone: z.string().optional(),
});

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: post, error } = await admin
    .from('posts')
    .select(`
      *,
      social_account:social_accounts(*),
      author_profile:profiles(*)
    `)
    .eq('id', params.id)
    .eq('workspace_id', auth.workspaceId)
    .single();

  if (error || !post) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 });
  }

  return NextResponse.json({ post });
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const validated = UpdatePostSchema.parse(body);

    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();

    const updatePayload: any = {
      ...validated,
      updated_at: new Date().toISOString(),
    };

    if (validated.scheduledAt !== undefined) {
      updatePayload.scheduled_at = validated.scheduledAt;
    }

    const { data: updatedPost, error } = await admin
      .from('posts')
      .update(updatePayload)
      .eq('id', params.id)
      .eq('workspace_id', auth.workspaceId)
      .select()
      .single();

    if (error || !updatedPost) {
      return NextResponse.json({ error: error?.message || 'Failed to update post' }, { status: 500 });
    }

    return NextResponse.json({ post: updatedPost });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await cancelScheduledJob(params.id);

  const admin = createAdminClient();
  const { error } = await admin
    .from('posts')
    .delete()
    .eq('id', params.id)
    .eq('workspace_id', auth.workspaceId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'Post deleted successfully.' });
}

