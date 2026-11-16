import { getAuthContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { schedulePostPublishJob } from '@/lib/queue/publisher';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const CreatePostSchema = z.object({
  content: z.string().min(1, 'Post content cannot be empty'),
  socialAccountId: z.string().uuid().optional().nullable(),
  postType: z.enum(['text', 'image', 'video', 'document', 'article']).default('text'),
  mediaAssets: z.array(z.any()).default([]),
  status: z.enum(['draft', 'pending_approval', 'scheduled', 'processing', 'published']).default('draft'),
  scheduledAt: z.string().datetime().optional().nullable(),
  timezone: z.string().default('UTC'),
  publishNow: z.boolean().default(false),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const requestWorkspaceId = request.headers.get('x-workspace-id') || searchParams.get('workspaceId') || null;

  const auth = await getAuthContext(requestWorkspaceId);
  if (!auth) {
    if (requestWorkspaceId) {
      return NextResponse.json({ error: 'Forbidden: Access denied to requested workspace' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  let query = admin
    .from('posts')
    .select(`
      *,
      social_account:social_accounts(id, account_name, account_type, profile_image_url),
      author_profile:profiles(id, full_name, avatar_url)
    `)
    .eq('workspace_id', auth.workspaceId)
    .order('created_at', { ascending: false });

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data: posts, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ posts: posts || [] });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = CreatePostSchema.parse(body);

    const requestWorkspaceId = request.headers.get('x-workspace-id') || null;
    const auth = await getAuthContext(requestWorkspaceId);
    if (!auth) {
      if (requestWorkspaceId) {
        return NextResponse.json({ error: 'Forbidden: Access denied to requested workspace' }, { status: 403 });
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['owner', 'admin', 'editor', 'approver'].includes(auth.role)) {
      return NextResponse.json({ error: 'Permission denied: cannot create posts' }, { status: 403 });
    }

    const admin = createAdminClient();

    // Verify that the assigned social account belongs strictly to this workspace
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

    // Check if scheduledAt is provided
    let scheduledDate: Date | null = null;
    let initialStatus = validated.status;

    if (validated.publishNow) {
      // Immediate publishing: Post is created as 'draft' so the atomic claim RPC
      // (claim_post_for_publishing) solely owns the transition into 'processing'.
      initialStatus = 'draft';
    } else if (validated.scheduledAt) {
      scheduledDate = new Date(validated.scheduledAt);
      if (scheduledDate.getTime() <= Date.now()) {
        return NextResponse.json({ error: 'Scheduled time must be in the future.' }, { status: 400 });
      }
      initialStatus = 'scheduled';
    }

    const { data: post, error } = await admin
      .from('posts')
      .insert({
        workspace_id: auth.workspaceId,
        created_by: auth.user.id,
        social_account_id: validated.socialAccountId,
        content: validated.content,
        media_assets: validated.mediaAssets,
        post_type: validated.postType,
        status: initialStatus,
        scheduled_at: scheduledDate ? scheduledDate.toISOString() : null,
        timezone: validated.timezone,
      })
      .select()
      .single();

    if (error || !post) {
      return NextResponse.json({ error: error?.message || 'Failed to save post' }, { status: 500 });
    }

    // If publishing now or scheduled, dispatch to scheduler / queue
    if (validated.publishNow || initialStatus === 'scheduled') {
      const scheduleResult = await schedulePostPublishJob(post.id, auth.workspaceId, scheduledDate);

      // Handle immediate publishing outcome honestly: never return HTTP 200 published:true on failure
      if (validated.publishNow) {
        if (!scheduleResult.success) {
          return NextResponse.json(
            {
              post,
              published: false,
              scheduled: false,
              error: scheduleResult.error || 'Failed to publish post to LinkedIn',
            },
            { status: 400 }
          );
        }

        return NextResponse.json(
          {
            post,
            published: true,
            scheduled: false,
            result: scheduleResult,
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        {
          post,
          scheduled: true,
          published: false,
          result: scheduleResult,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ post }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

