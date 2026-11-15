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

    // Atomic Compare-And-Swap (CAS) update:
    // Execute a single atomic database statement with predicate filters for workspace_id,
    // published-status protection, and (if provided) expectedUpdatedAt.
    // In PostgreSQL, this statement acquires a row-level write lock and evaluates predicates
    // in one atomic step. If another transaction updated the row concurrently, 0 rows match.
    let updateQuery = admin
      .from('posts')
      .update(updatePayload)
      .eq('id', params.id)
      .eq('workspace_id', auth.workspaceId);

    // Atomic protection: prevent published posts from being reverted to draft
    if (validated.status === 'draft') {
      updateQuery = updateQuery.neq('status', 'published');
    }

    // Atomic optimistic concurrency predicate
    if (expectedUpdatedAt) {
      updateQuery = updateQuery.eq('updated_at', expectedUpdatedAt);
    }

    const { data: updatedPost, error: updateErr } = await updateQuery.select().maybeSingle();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message || 'Failed to update post' }, { status: 500 });
    }

    // Atomic CAS succeeded
    if (updatedPost) {
      return NextResponse.json({ post: updatedPost });
    }

    // If 0 rows were updated, diagnose the cause without leaking foreign workspace data:
    const { data: currentPost, error: fetchErr } = await admin
      .from('posts')
      .select('*')
      .eq('id', params.id)
      .eq('workspace_id', auth.workspaceId)
      .maybeSingle();

    if (fetchErr || !currentPost) {
      // Row does not exist or belongs to another tenant workspace -> fail closed
      return NextResponse.json({ error: 'Post not found or inaccessible.' }, { status: 404 });
    }

    if (currentPost.status === 'published' && validated.status === 'draft') {
      return NextResponse.json(
        { error: 'Cannot revert a published post back to draft status.' },
        { status: 400 }
      );
    }

    if (expectedUpdatedAt && currentPost.updated_at !== expectedUpdatedAt) {
      return NextResponse.json(
        {
          error: 'Conflict: Draft has been modified concurrently in another session.',
          code: 'CONCURRENT_MODIFICATION',
          serverUpdatedAt: currentPost.updated_at,
          serverPost: currentPost,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 });
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

