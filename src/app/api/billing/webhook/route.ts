// ==============================================================
// LINKEDIN AUTOPILOT - DURABLE STRIPE WEBHOOK LISTENER
// BY GT INNOX LLP
// ==============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecret || !webhookSecret) {
    return NextResponse.json(
      { error: 'Stripe webhook secrets are not configured in environment.' },
      { status: 503 }
    );
  }

  const stripe = new Stripe(stripeSecret, {
    apiVersion: '2025-01-27.acacia' as any,
  });

  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error('[Stripe-Webhook] Signature verification failed:', err.message);
    return NextResponse.json({ error: `Webhook signature error: ${err.message}` }, { status: 400 });
  }

  const admin = createAdminClient();

  // 1. Idempotency Check: Verify if event has already been recorded
  const { data: existingEvent } = await admin
    .from('stripe_events')
    .select('id, status, created_at')
    .eq('event_id', event.id)
    .maybeSingle();

  if (existingEvent && existingEvent.status === 'processed') {
    // Idempotent success response
    return NextResponse.json({ received: true, deduplicated: true });
  }

  // 2. Register event in ledger with status 'processing'
  if (!existingEvent) {
    await admin.from('stripe_events').insert({
      event_id: event.id,
      event_type: event.type,
      status: 'processing',
      payload: {
        id: event.id,
        type: event.type,
        created: event.created,
      },
    });
  }

  let associatedWorkspaceId: string | null = null;
  let customerId: string | null = null;

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        associatedWorkspaceId = session.metadata?.workspace_id || session.client_reference_id || null;
        const tier = session.metadata?.tier || 'pro';
        const subscriptionId = session.subscription as string;
        customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id || null;

        if (associatedWorkspaceId) {
          let periodStart: string | null = null;
          let periodEnd: string | null = null;

          // Retrieve actual subscription from Stripe to derive real billing periods
          if (subscriptionId) {
            try {
              const subObj = (await stripe.subscriptions.retrieve(subscriptionId)) as any;
              if (subObj?.current_period_start) {
                periodStart = new Date(subObj.current_period_start * 1000).toISOString();
              }
              if (subObj?.current_period_end) {
                periodEnd = new Date(subObj.current_period_end * 1000).toISOString();
              }
            } catch (retrieveErr: any) {
              console.warn('[Stripe-Webhook] Could not retrieve subscription details:', retrieveErr.message);
            }
          }

          // Fallback to exact 30 days only if Stripe API was unreachable
          if (!periodEnd) {
            periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
          }

          await admin.from('subscriptions').upsert(
            {
              workspace_id: associatedWorkspaceId,
              plan_id: tier,
              provider_subscription_id: subscriptionId,
              stripe_customer_id: customerId,
              status: 'active',
              current_period_start: periodStart,
              current_period_end: periodEnd,
            },
            { onConflict: 'workspace_id' }
          );

          // Add notification for workspace members
          await admin.from('notifications').insert({
            workspace_id: associatedWorkspaceId,
            title: 'Subscription Activated 🎉',
            message: `Your workspace subscription has been upgraded to ${tier.toUpperCase()}.`,
            type: 'success',
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id || null;
        const statusMap: Record<string, string> = {
          active: 'active',
          past_due: 'past_due',
          canceled: 'canceled',
          trialing: 'trialing',
          unpaid: 'past_due',
        };

        const dbStatus = statusMap[subscription.status] || 'active';
        const subAny = subscription as any;
        const periodStart = subAny?.current_period_start
          ? new Date(subAny.current_period_start * 1000).toISOString()
          : null;
        const periodEnd = subAny?.current_period_end
          ? new Date(subAny.current_period_end * 1000).toISOString()
          : null;

        // Look up workspace by provider_subscription_id
        const { data: subRow } = await admin
          .from('subscriptions')
          .select('workspace_id, current_period_end')
          .eq('provider_subscription_id', subscription.id)
          .maybeSingle();

        if (subRow) {
          associatedWorkspaceId = subRow.workspace_id;

          // Out-of-order check: do not overwrite newer subscription data with an older event
          const existingEnd = subRow.current_period_end ? new Date(subRow.current_period_end).getTime() : 0;
          const newEnd = periodEnd ? new Date(periodEnd).getTime() : 0;

          if (newEnd >= existingEnd || dbStatus === 'canceled' || dbStatus === 'past_due') {
            await admin
              .from('subscriptions')
              .update({
                status: dbStatus,
                stripe_customer_id: customerId,
                current_period_start: periodStart,
                current_period_end: periodEnd,
              })
              .eq('provider_subscription_id', subscription.id);
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const { data: subRow } = await admin
          .from('subscriptions')
          .select('workspace_id')
          .eq('provider_subscription_id', subscription.id)
          .maybeSingle();

        if (subRow) {
          associatedWorkspaceId = subRow.workspace_id;
          await admin
            .from('subscriptions')
            .update({
              status: 'canceled',
              plan_id: 'free',
            })
            .eq('provider_subscription_id', subscription.id);

          await admin.from('notifications').insert({
            workspace_id: associatedWorkspaceId,
            title: 'Subscription Cancelled',
            message: 'Your subscription has ended and your workspace has reverted to the Free plan.',
            type: 'warning',
          });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice as any).subscription as string;
        if (subscriptionId) {
          const { data: subRow } = await admin
            .from('subscriptions')
            .select('workspace_id')
            .eq('provider_subscription_id', subscriptionId)
            .maybeSingle();

          if (subRow) {
            associatedWorkspaceId = subRow.workspace_id;
            await admin
              .from('subscriptions')
              .update({ status: 'past_due' })
              .eq('provider_subscription_id', subscriptionId);

            await admin.from('notifications').insert({
              workspace_id: associatedWorkspaceId,
              title: 'Payment Failed ⚠️',
              message: 'Your recurring payment attempt failed. Please update your payment method to maintain access.',
              type: 'error',
            });
          }
        }
        break;
      }

      default:
        // Ignore unhandled event types cleanly
        break;
    }

    // 3. Mark event as successfully processed in ledger
    await admin
      .from('stripe_events')
      .update({
        status: 'processed',
        workspace_id: associatedWorkspaceId,
        customer_id: customerId,
      })
      .eq('event_id', event.id);

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('[Stripe-Webhook] Error processing event:', err.message);

    // Record error in ledger for auditability
    await admin
      .from('stripe_events')
      .update({
        status: 'failed',
        error_message: err.message,
      })
      .eq('event_id', event.id);

    return NextResponse.json({ error: 'Internal handler failure' }, { status: 500 });
  }
}
