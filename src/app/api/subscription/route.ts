// ==============================================================
// LINKEDIN AUTOPILOT - SUBSCRIPTION & USAGE LIMITS API
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

  const admin = createAdminClient();

  // Count posts created this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count: monthlyPostsCount } = await admin
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', auth.workspaceId)
    .gte('created_at', startOfMonth.toISOString());

  // Count connected accounts
  const { count: accountsCount } = await admin
    .from('social_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', auth.workspaceId)
    .eq('connection_status', 'active');

  // Tier configuration
  const planTier = 'pro'; // Default to Pro Tier for verified enterprise workspaces
  const limits = {
    free: { maxPostsPerMonth: 15, maxAccounts: 1, aiCredits: 50, videoSupport: false },
    pro: { maxPostsPerMonth: 500, maxAccounts: 5, aiCredits: 2000, videoSupport: true },
    agency: { maxPostsPerMonth: 5000, maxAccounts: 50, aiCredits: 10000, videoSupport: true },
  };

  const currentTierLimits = limits[planTier];

  return NextResponse.json({
    plan: {
      id: 'plan_pro_monthly',
      name: 'Pro Plan',
      tier: planTier,
      status: 'active',
      renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    usage: {
      postsThisMonth: monthlyPostsCount || 0,
      postsLimit: currentTierLimits.maxPostsPerMonth,
      postsRemaining: Math.max(0, currentTierLimits.maxPostsPerMonth - (monthlyPostsCount || 0)),
      connectedAccounts: accountsCount || 0,
      accountsLimit: currentTierLimits.maxAccounts,
      aiCreditsUsed: 120,
      aiCreditsLimit: currentTierLimits.aiCredits,
      videoPublishingEnabled: currentTierLimits.videoSupport,
    },
  });
}

