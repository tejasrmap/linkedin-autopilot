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
  expectedUpdatedAt: z.string().datetime().optional(),
});

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const requestWorkspaceId = request.headers.get('x-workspace-id') || null;
  const auth = await getAuthContext(requestWorkspaceId);
  if (!auth) {
    if (requestWorkspaceId) {
      return NextResponse.json({ error: 'Forbidden: Access denied to requested workspace' }, { status: 403 });
    }
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

    const requestWorkspaceId = request.headers.get('x-workspace-id') || null;
    const auth = await getAuthContext(requestWorkspaceId);
    if (!auth) {
      if (requestWorkspaceId) {
        return NextResponse.json({ error: 'Forbidden: Access denied to requested workspace' }, { status: 403 });
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['owner', 'admin', 'editor', 'approver'].includes(auth.role)) {
      return NextResponse.json({ error: 'Permission denied: cannot update posts' }, { status: 403 });
    }

    const admin = createAdminClient();

    // Verify existing post exists and belongs strictly to this workspace
    const { data: existingPost, error: fetchErr } = await admin
      .from('posts')
      .select('*')
      .eq('id', params.id)
      .eq('workspace_id', auth.workspaceId)
      .maybeSingle();

    if (fetchErr || !existingPost) {
      return NextResponse.json({ error: 'Post not found or inaccessible.' }, { status: 404 });
    }

    // Optimistic concurrency protection: reject overwriting newer edits
    if (validated.expectedUpdatedAt && existingPost.updated_at) {
      const serverTime = new Date(existingPost.updated_at).getTime();
      const clientTime = new Date(validated.expectedUpdatedAt).getTime();
      if (serverTime > clientTime + 1000) {
        return NextResponse.json(
          {
            error: 'Conflict: Draft has been modified concurrently in another session.',
            code: 'CONCURRENT_MODIFICATION',
            serverUpdatedAt: existingPost.updated_at,
            serverPost: existingPost,
          },
          { status: 409 }
        );
      }
    }

    // Protect published posts from being reverted to draft
    if (existingPost.status === 'published' && validated.status === 'draft') {
      return NextResponse.json(
        { error: 'Cannot revert a published post back to draft status.' },
        { status: 400 }
      );
    }

    // Verify that the updated social account belongs strictly to this workspace
    if (validated.socialAccountId) {
      const { data: validAccount } = await admin
        .from('social_accounts')
        .select('id')
        .eq('id', validated.socialAccountId)
        .eq('workspace_id', auth.workspaceId)
        .maybeSingle();

      if (!validAccount) {
        return NextResponse.json(
          { error: 'Invalid social account: Account does not belong to this workspace.' },
          { status: 403 }
        );
      }
    }

    const { expectedUpdatedAt, ...updateData } = validated;
    const updatePayload: any = {
      ...updateData,
      updated_at: new Date().toISOString(),
    };

    if (validated.scheduledAt !== undefined) {
      updatePayload.scheduled_at = validated.scheduledAt;
      delete updatePayload.scheduledAt;
    }
    if (validated.mediaAssets !== undefined) {
      updatePayload.media_assets = validated.mediaAssets;
      delete updatePayload.mediaAssets;
    }
    if (validated.socialAccountId !== undefined) {
      updatePayload.social_account_id = validated.socialAccountId;
      delete updatePayload.socialAccountId;
    }
    if (validated.postType !== undefined) {
      updatePayload.post_type = validated.postType;
      delete updatePayload.postType;
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
  const requestWorkspaceId = request.headers.get('x-workspace-id') || null;
  const auth = await getAuthContext(requestWorkspaceId);
  if (!auth) {
    if (requestWorkspaceId) {
      return NextResponse.json({ error: 'Forbidden: Access denied to requested workspace' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!['owner', 'admin', 'editor', 'approver'].includes(auth.role)) {
    return NextResponse.json({ error: 'Permission denied: cannot delete posts' }, { status: 403 });
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

  await cancelScheduledJob(params.id, auth.workspaceId);

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

