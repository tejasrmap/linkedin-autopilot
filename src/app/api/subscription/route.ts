// ==============================================================
// LINKEDIN AUTOPILOT - SUBSCRIPTION & USAGE LIMITS API
// BY GT INNOX LLP
// ==============================================================

import { getAuthContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { isBillingEnabled } from '@/lib/billing-config';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await getAuthContext();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  // 1. Fetch real workspace subscription from database if present
  const { data: subRecord } = await admin
    .from('subscriptions')
    .select('*')
    .eq('workspace_id', auth.workspaceId)
    .maybeSingle();

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
  const limits: Record<string, { maxPostsPerMonth: number; maxAccounts: number; aiCredits: number; videoSupport: boolean; name: string }> = {
    free: { maxPostsPerMonth: 15, maxAccounts: 1, aiCredits: 50, videoSupport: false, name: 'Free Starter' },
    pro: { maxPostsPerMonth: 500, maxAccounts: 5, aiCredits: 2000, videoSupport: true, name: 'Pro Growth' },
    agency: { maxPostsPerMonth: 5000, maxAccounts: 50, aiCredits: 10000, videoSupport: true, name: 'Agency Enterprise' },
  };

  // Determine tier: prioritize existing DB record, fallback to 'pro' for enterprise beta workspaces
  const rawTier = (subRecord?.plan_id || subRecord?.tier || 'pro').toLowerCase();
  const planTier = limits[rawTier] ? rawTier : 'pro';
  const currentTierLimits = limits[planTier];

  const billingActive = isBillingEnabled();

  return NextResponse.json({
    billingEnabled: billingActive,
    billingNotice: billingActive
      ? null
      : 'Stripe payments and plan changes are temporarily paused. Existing subscription capabilities remain active.',
    plan: {
      id: subRecord?.provider_subscription_id || `plan_${planTier}_active`,
      name: currentTierLimits.name,
      tier: planTier,
      status: subRecord?.status || 'active',
      currentPeriodEnd: subRecord?.current_period_end || null,
      renewsAt: subRecord?.current_period_end || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
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
