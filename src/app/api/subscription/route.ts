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
  const { data: subRecord, error: subError } = await admin
    .from('subscriptions')
    .select('*')
    .eq('workspace_id', auth.workspaceId)
    .maybeSingle();

  if (subError) {
    console.error('[Subscription] Database query error fetching subscription:', subError);
    return NextResponse.json(
      { error: 'Database error retrieving subscription details', code: 'SUBSCRIPTION_QUERY_FAILED' },
      { status: 500 }
    );
  }

  // Count posts created this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count: monthlyPostsCount, error: postsError } = await admin
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', auth.workspaceId)
    .gte('created_at', startOfMonth.toISOString());

  if (postsError) {
    console.error('[Subscription] Database query error fetching posts count:', postsError);
    return NextResponse.json(
      { error: 'Failed to retrieve post usage metrics from database', code: 'POSTS_QUERY_FAILED' },
      { status: 500 }
    );
  }

  // Count connected accounts
  const { count: accountsCount, error: accountsError } = await admin
    .from('social_accounts')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', auth.workspaceId)
    .eq('connection_status', 'active');

  if (accountsError) {
    console.error('[Subscription] Database query error fetching accounts count:', accountsError);
    return NextResponse.json(
      { error: 'Failed to retrieve connected accounts count from database', code: 'ACCOUNTS_QUERY_FAILED' },
      { status: 500 }
    );
  }

  // Count AI generations created this month from actual ledger
  const { count: monthlyAiCount, error: aiError } = await admin
    .from('ai_generations')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', auth.workspaceId)
    .gte('created_at', startOfMonth.toISOString());

  if (aiError) {
    console.error('[Subscription] Database query error fetching AI generations count:', aiError);
    return NextResponse.json(
      { error: 'Failed to retrieve AI usage metrics from database', code: 'USAGE_QUERY_FAILED' },
      { status: 500 }
    );
  }

  // Tier configuration definitions
  const limits: Record<
    string,
    { maxPostsPerMonth: number; maxAccounts: number; aiCredits: number; videoSupport: boolean; name: string }
  > = {
    free: { maxPostsPerMonth: 15, maxAccounts: 1, aiCredits: 50, videoSupport: false, name: 'Free Starter' },
    pro: { maxPostsPerMonth: 500, maxAccounts: 5, aiCredits: 2000, videoSupport: true, name: 'Pro Growth' },
    agency: { maxPostsPerMonth: 5000, maxAccounts: 50, aiCredits: 10000, videoSupport: true, name: 'Agency Enterprise' },
  };

  const VALID_TIERS = ['free', 'pro', 'agency'] as const;
  type ValidTier = (typeof VALID_TIERS)[number];

  // STRICT TIER VALIDATION & IS_PAID DISCRIMINATION:
  // - Validates candidate tier against explicit allow-list ('free', 'pro', 'agency').
  // - Rejects corrupted, unknown, or fabricated tiers (falls back strictly to 'free').
  // - isPaid is strictly true ONLY if subRecord is active/trialing AND the tier is 'pro' | 'agency'.
  const candidateTier = (subRecord?.tier || subRecord?.plan_id || '').toLowerCase();
  const isCandidateTierValid = (VALID_TIERS as readonly string[]).includes(candidateTier);
  const isActiveStatus = subRecord && (subRecord.status === 'active' || subRecord.status === 'trialing');

  const isPaid = Boolean(isActiveStatus && isCandidateTierValid && candidateTier !== 'free');
  const planTier: ValidTier = isPaid ? (candidateTier as ValidTier) : 'free';

  const currentTierLimits = limits[planTier];
  const billingActive = isBillingEnabled();

  // ZERO-FABRICATION RENEWAL DATE:
  // - If an authoritative current_period_end exists for an active paid subscription, return it.
  // - Otherwise strictly return null. Never fabricate arbitrary renewal estimates.
  const authoritativeRenewal = isPaid ? (subRecord?.current_period_end || null) : null;

  // SUBSCRIPTION STATUS DISCRIMINATION:
  // - Accurately distinguishes active paid subscription ('active' | 'trialing') from free tier ('free') or past paid ('canceled').
  let resolvedStatus = 'free';
  if (isPaid) {
    resolvedStatus = subRecord!.status;
  } else if (subRecord?.status && subRecord.status !== 'active') {
    resolvedStatus = subRecord.status;
  } else {
    resolvedStatus = 'free';
  }

  // ZERO-FABRICATION SUBSCRIPTION ID:
  // - Never fabricate synthetic subscription IDs like 'sub_free' or 'sub_pro'.
  // - Returns genuine provider/stripe subscription ID from database, or null.
  const authoritativeSubId = isPaid
    ? (subRecord?.provider_subscription_id || subRecord?.stripe_subscription_id || null)
    : null;

  return NextResponse.json({
    billingEnabled: billingActive,
    billingNotice: billingActive
      ? null
      : 'Stripe payments and plan changes are temporarily paused. Existing subscription capabilities remain active.',
    plan: {
      id: authoritativeSubId,
      name: currentTierLimits.name,
      tier: planTier,
      status: resolvedStatus,
      isPaid,
      currentPeriodStart: isPaid ? (subRecord?.current_period_start || null) : null,
      currentPeriodEnd: authoritativeRenewal,
      renewsAt: authoritativeRenewal,
    },
    usage: {
      postsThisMonth: monthlyPostsCount || 0,
      postsLimit: currentTierLimits.maxPostsPerMonth,
      postsRemaining: Math.max(0, currentTierLimits.maxPostsPerMonth - (monthlyPostsCount || 0)),
      connectedAccounts: accountsCount || 0,
      accountsLimit: currentTierLimits.maxAccounts,
      aiCreditsUsed: monthlyAiCount || 0,
      aiCreditsLimit: currentTierLimits.aiCredits,
      videoPublishingEnabled: currentTierLimits.videoSupport,
    },
  });
}
