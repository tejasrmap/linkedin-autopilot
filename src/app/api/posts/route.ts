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
  const workspaceId = searchParams.get('workspaceId');

  const auth = await getAuthContext(workspaceId);
  if (!auth) {
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

    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['owner', 'admin', 'editor', 'approver'].includes(auth.role)) {
      return NextResponse.json({ error: 'Permission denied: cannot create posts' }, { status: 403 });
    }

    const admin = createAdminClient();

    // Check if scheduledAt is provided
    let scheduledDate: Date | null = null;
    let initialStatus = validated.status;

    if (validated.publishNow) {
      initialStatus = 'processing';
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
      return NextResponse.json({
        post,
        scheduled: initialStatus === 'scheduled',
        published: validated.publishNow,
        result: scheduleResult,
      });
    }

    return NextResponse.json({ post }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

