// ==============================================================
// LINKEDIN AUTOPILOT - BULK POST SCHEDULING API
// BY GT INNOX LLP
// ==============================================================

import { getAuthContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { schedulePostPublishJob } from '@/lib/queue/publisher';
import { NextResponse } from 'next/server';

interface BulkPostItem {
  content: string;
  postType?: 'text' | 'image' | 'video' | 'document';
  scheduledAt?: string;
  socialAccountId?: string;
}

export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!['owner', 'admin', 'editor'].includes(auth.role)) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const items: BulkPostItem[] = body.posts || [];

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No posts provided for bulk scheduling' }, { status: 400 });
    }

    if (items.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 posts can be bulk-scheduled at once' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Verify social account
    const defaultAccountId = body.socialAccountId;
    const results: Array<{ id?: string; content: string; status: string; error?: string }> = [];

    for (const item of items) {
      if (!item.content || item.content.trim().length === 0) {
        results.push({ content: '', status: 'skipped', error: 'Content is empty' });
        continue;
      }

      const accountId = item.socialAccountId || defaultAccountId;
      const scheduledTime = item.scheduledAt ? new Date(item.scheduledAt) : null;
      const initialStatus = scheduledTime && scheduledTime.getTime() > Date.now() ? 'scheduled' : 'draft';

      const { data: post, error: insertErr } = await admin
        .from('posts')
        .insert({
          workspace_id: auth.workspaceId,
          created_by: auth.user.id,
          social_account_id: accountId || null,
          content: item.content.trim(),
          post_type: item.postType || 'text',
          status: initialStatus,
          scheduled_at: scheduledTime ? scheduledTime.toISOString() : null,
        })
        .select()
        .single();

      if (insertErr || !post) {
        results.push({ content: item.content, status: 'failed', error: insertErr?.message });
        continue;
      }

      // If scheduled, register job
      if (initialStatus === 'scheduled') {
        await schedulePostPublishJob(post.id, auth.workspaceId, scheduledTime);
      }

      results.push({ id: post.id, content: item.content.slice(0, 40) + '...', status: initialStatus });
    }

    return NextResponse.json({
      success: true,
      totalReceived: items.length,
      processed: results.length,
      results,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

