import { getAuthContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();

    // 1. Post counts by status (strictly scoped to caller's workspace)
    const { data: posts, error: postsErr } = await admin
      .from('posts')
      .select('id, status, post_type, created_at, published_at')
      .eq('workspace_id', auth.workspaceId);

    if (postsErr) {
      console.error('[Analytics] Database error querying posts:', postsErr);
      return NextResponse.json(
        { error: `Database error querying posts: ${postsErr.message}` },
        { status: 500 }
      );
    }

    const allPosts = posts || [];
    const publishedCount = allPosts.filter((p) => p.status === 'published').length;
    const scheduledCount = allPosts.filter((p) => p.status === 'scheduled').length;
    const draftCount = allPosts.filter((p) => p.status === 'draft').length;
    const failedCount = allPosts.filter((p) => p.status === 'failed').length;

    // 2. Active accounts count (strictly scoped to caller's workspace)
    const { count: accountsCount, error: accErr } = await admin
      .from('social_accounts')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', auth.workspaceId)
      .eq('connection_status', 'active');

    if (accErr) {
      console.error('[Analytics] Database error querying accounts:', accErr);
      return NextResponse.json(
        { error: `Database error querying accounts: ${accErr.message}` },
        { status: 500 }
      );
    }

    // 3. Post analytics records (STRICT MULTI-TENANT ISOLATION)
    // Only query metrics for posts that belong to the caller's workspace.
    // If workspace has no posts, skip query and return zero metrics.
    const postIds = allPosts.map((p) => p.id);
    let analyticsRows: Array<{ metric_name: string; metric_value: number | string }> = [];

    if (postIds.length > 0) {
      const { data: rows, error: analyticsErr } = await admin
        .from('post_analytics')
        .select('metric_name, metric_value')
        .in('post_id', postIds);

      if (analyticsErr) {
        console.error('[Analytics] Database error querying post_analytics:', analyticsErr);
        return NextResponse.json(
          { error: `Database error querying analytics: ${analyticsErr.message}` },
          { status: 500 }
        );
      }

      analyticsRows = rows || [];
    }

    let totalImpressions: number | null = null;
    let totalReactions: number | null = null;
    let totalComments: number | null = null;
    let totalReposts: number | null = null;

    if (analyticsRows && analyticsRows.length > 0) {
      totalImpressions = 0;
      totalReactions = 0;
      totalComments = 0;
      totalReposts = 0;

      for (const row of analyticsRows) {
        const val = Number(row.metric_value) || 0;
        if (row.metric_name === 'impressions') totalImpressions += val;
        if (row.metric_name === 'reactions') totalReactions += val;
        if (row.metric_name === 'comments') totalComments += val;
        if (row.metric_name === 'reposts') totalReposts += val;
      }
    }

    return NextResponse.json({
      metrics: {
        totalPosts: allPosts.length,
        publishedCount,
        scheduledCount,
        draftCount,
        failedCount,
        accountsConnected: accountsCount || 0,
        engagement: {
          impressions: totalImpressions,
          reactions: totalReactions,
          comments: totalComments,
          reposts: totalReposts,
          notice: totalImpressions === null
            ? 'Detailed engagement metrics require LinkedIn Community Management API or Organization Administrator permissions.'
            : null,
        },
      },
    });
  } catch (err: any) {
    console.error('[Analytics] Unexpected exception in analytics overview:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error resolving analytics overview' },
      { status: 500 }
    );
  }
}

