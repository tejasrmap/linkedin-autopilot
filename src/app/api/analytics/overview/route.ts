import { getAuthContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function GET() {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  // 1. Post counts by status
  const { data: posts } = await admin
    .from('posts')
    .select('id, status, post_type, created_at, published_at')
    .eq('workspace_id', auth.workspaceId);

  const allPosts = posts || [];
  const publishedCount = allPosts.filter((p) => p.status === 'published').length;
  const scheduledCount = allPosts.filter((p) => p.status === 'scheduled').length;
  const draftCount = allPosts.filter((p) => p.status === 'draft').length;
  const failedCount = allPosts.filter((p) => p.status === 'failed').length;

  // 2. Active accounts count
  const { count: accountsCount } = await admin
    .from('social_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', auth.workspaceId)
    .eq('connection_status', 'active');

  // 3. Post analytics records
  const { data: analyticsRows } = await admin
    .from('post_analytics')
    .select('metric_name, metric_value');

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
      if (row.metric_name === 'impressions') totalImpressions += Number(row.metric_value);
      if (row.metric_name === 'reactions') totalReactions += Number(row.metric_value);
      if (row.metric_name === 'comments') totalComments += Number(row.metric_value);
      if (row.metric_name === 'reposts') totalReposts += Number(row.metric_value);
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
}

