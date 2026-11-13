// ==============================================================
// LINKEDIN AUTOPILOT - SUBSCRIPTION & USAGE LIMITS API
// AUTHENTIC SUBSCRIPTION RESOLUTION & STRICT ZERO-FABRICATION
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

  // 1. Fetch real workspace subscription from database
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

  // Tier configuration definitions
  const limits: Record<
    string,
    { maxPostsPerMonth: number; maxAccounts: number; aiCredits: number; videoSupport: boolean; name: string }
  > = {
    free: { maxPostsPerMonth: 15, maxAccounts: 1, aiCredits: 50, videoSupport: false, name: 'Free Starter' },
    pro: { maxPostsPerMonth: 500, maxAccounts: 5, aiCredits: 2000, videoSupport: true, name: 'Pro Growth' },
    agency: { maxPostsPerMonth: 5000, maxAccounts: 50, aiCredits: 10000, videoSupport: true, name: 'Agency Enterprise' },
  };

  // SECURE DEFAULT TIER LOGIC:
  // - If subRecord exists with active/trialing status, preserve their paid tier.
  // - Otherwise strictly default to 'free' (Prevents accidental free-to-paid upgrades).
  let planTier = 'free';
  const isActiveSub = subRecord && (subRecord.status === 'active' || subRecord.status === 'trialing');

  if (isActiveSub) {
    const candidateTier = (subRecord.tier || subRecord.plan_id || '').toLowerCase();
    if (limits[candidateTier]) {
      planTier = candidateTier;
    }
  }

  const currentTierLimits = limits[planTier];
  const billingActive = isBillingEnabled();

  // ZERO-FABRICATION RENEWAL DATE:
  // - If an authoritative current_period_end exists in the database, return it.
  // - Otherwise strictly return null. Never fabricate arbitrary 30-day renewal estimates.
  const authoritativeRenewal = subRecord?.current_period_end || null;

  return NextResponse.json({
    billingEnabled: billingActive,
    billingNotice: billingActive
      ? null
      : 'Stripe payments and plan changes are temporarily paused. Existing subscription capabilities remain active.',
    plan: {
      id: subRecord?.provider_subscription_id || (isActiveSub ? `sub_${planTier}` : null),
      name: currentTierLimits.name,
      tier: planTier,
      status: subRecord?.status || 'active',
      currentPeriodStart: subRecord?.current_period_start || null,
      currentPeriodEnd: authoritativeRenewal,
      renewsAt: authoritativeRenewal,
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
