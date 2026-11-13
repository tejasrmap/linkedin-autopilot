// ==============================================================
// LINKEDIN AUTOPILOT - STRIPE SUBSCRIPTION RECONCILIATION
// AUTHORITATIVE STATE SYNCHRONIZATION (ZERO BLIND REPLAYS)
// BY GT INNOX LLP
// ==============================================================

import { createAdminClient } from '@/lib/supabase/admin';
import Stripe from 'stripe';

export interface ReconciliationResult {
  workspaceId: string;
  reconciled: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  tier?: string;
  status?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  error?: string;
}

/**
 * Reconciles a workspace subscription by directly fetching authoritative state from Stripe API.
 * Never replays stale or unapplied webhook events.
 */
export async function reconcileWorkspaceSubscription(
  workspaceId: string,
  stripeApiKey?: string
): Promise<ReconciliationResult> {
  const stripeKey = stripeApiKey || process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return {
      workspaceId,
      reconciled: false,
      error: 'STRIPE_SECRET_KEY not configured for reconciliation.',
    };
  }

  const stripe = new Stripe(stripeKey, {
    apiVersion: '2025-01-27.acacia' as any,
  });

  const admin = createAdminClient();

  // 1. Fetch current workspace subscription record
  const { data: subRecord, error: subErr } = await admin
    .from('subscriptions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (subErr) {
    return { workspaceId, reconciled: false, error: subErr.message };
  }

  let customerId = subRecord?.stripe_customer_id;

  // If no customer ID in subscription record, check workspace owner email
  if (!customerId) {
    const { data: ws } = await admin
      .from('workspaces')
      .select('owner_id')
      .eq('id', workspaceId)
      .maybeSingle();

    if (ws?.owner_id) {
      const { data: profile } = await admin
        .from('profiles')
        .select('email')
        .eq('id', ws.owner_id)
        .maybeSingle();

      if (profile?.email) {
        try {
          const customers = await stripe.customers.list({ email: profile.email, limit: 1 });
          if (customers.data.length > 0) {
            customerId = customers.data[0].id;
          }
        } catch (e: any) {
          // Stripe customer lookup note
        }
      }
    }
  }

  if (!customerId) {
    return {
      workspaceId,
      reconciled: true,
      tier: subRecord?.tier || 'free',
      status: subRecord?.status || 'active',
      error: 'No Stripe customer associated. Retained local plan without mutation.',
    };
  }

  // 2. Fetch authoritative subscriptions directly from Stripe
  const stripeSubs = await stripe.subscriptions.list({
    customer: customerId,
    status: 'all',
    limit: 5,
  });

  const activeSub =
    stripeSubs.data.find((s) => s.status === 'active' || s.status === 'trialing') ||
    stripeSubs.data[0];

  if (!activeSub) {
    // No subscription found on Stripe
    await admin
      .from('subscriptions')
      .update({
        status: 'canceled',
        last_event_created: Math.floor(Date.now() / 1000),
        updated_at: new Date().toISOString(),
      })
      .eq('workspace_id', workspaceId);

    return {
      workspaceId,
      reconciled: true,
      stripeCustomerId: customerId,
      tier: subRecord?.tier || 'free',
      status: 'canceled',
    };
  }

  // 3. Extract authoritative period timestamps
  const periodStart = (activeSub as any).current_period_start
    ? new Date((activeSub as any).current_period_start * 1000).toISOString()
    : null;
  const periodEnd = (activeSub as any).current_period_end
    ? new Date((activeSub as any).current_period_end * 1000).toISOString()
    : null;

  const priceAmount = activeSub.items?.data?.[0]?.price?.unit_amount || 0;
  const tier = priceAmount >= 19900 ? 'agency' : priceAmount >= 2900 ? 'pro' : 'free';

  // 4. Update local record authoritatively
  await admin
    .from('subscriptions')
    .update({
      stripe_customer_id: customerId,
      provider_subscription_id: activeSub.id,
      tier,
      status: activeSub.status,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      last_event_created: Math.floor(Date.now() / 1000),
      updated_at: new Date().toISOString(),
    })
    .eq('workspace_id', workspaceId);

  return {
    workspaceId,
    reconciled: true,
    stripeCustomerId: customerId,
    stripeSubscriptionId: activeSub.id,
    tier,
    status: activeSub.status,
    currentPeriodStart: periodStart || undefined,
    currentPeriodEnd: periodEnd || undefined,
  };
}

