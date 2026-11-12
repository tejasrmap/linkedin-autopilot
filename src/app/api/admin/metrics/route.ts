// ==============================================================
// LINKEDIN AUTOPILOT - ADMIN SAAS METRICS API
// BY GT INNOX LLP
// ==============================================================

import { getAuthContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only owners or superadmins can view admin metrics
  if (auth.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();

  try {
    const [
      { count: totalWorkspaces },
      { count: totalAccounts },
      { count: totalPublishedPosts },
      { count: totalScheduledPosts },
      { count: totalFailedPosts },
      { data: recentAttempts },
    ] = await Promise.all([
      admin.from('workspaces').select('*', { count: 'exact', head: true }),
      admin.from('social_accounts').select('*', { count: 'exact', head: true }).eq('connection_status', 'active'),
      admin.from('posts').select('*', { count: 'exact', head: true }).eq('status', 'published'),
      admin.from('posts').select('*', { count: 'exact', head: true }).eq('status', 'scheduled'),
      admin.from('posts').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
      admin.from('post_publish_attempts').select('status, created_at').order('created_at', { ascending: false }).limit(20),
    ]);

    const totalPubAttempts = (totalPublishedPosts || 0) + (totalFailedPosts || 0);
    const successRatePercent = totalPubAttempts > 0
      ? Math.round(((totalPublishedPosts || 0) / totalPubAttempts) * 100)
      : 100;

    return NextResponse.json({
      metrics: {
        activeWorkspaces: totalWorkspaces || 1,
        activeLinkedInAccounts: totalAccounts || 1,
        publishedPosts: totalPublishedPosts || 0,
        scheduledPosts: totalScheduledPosts || 0,
        failedPosts: totalFailedPosts || 0,
        successRatePercent,
      },
      recentPublishActivity: recentAttempts || [],
      systemHealth: 'operational',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

