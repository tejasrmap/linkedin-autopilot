// ==============================================================
// LINKEDIN AUTOPILOT - DURABLE STRIPE WEBHOOK LISTENER
// ATOMIC EVENT CLAIMING, CONCURRENCY LOCKS & IDEMPOTENCY
// BY GT INNOX LLP
// ==============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isBillingEnabled } from '@/lib/billing-config';
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

  // -------------------------------------------------------------
  // 0. REVERSIBLE BILLING SUSPENSION CHECK
  // Webhooks are verified & recorded without mutating subscriptions
  // -------------------------------------------------------------
  if (!isBillingEnabled()) {
    // 1. Idempotency Check: Has this event already been registered?
    const { data: existingEvent } = await admin
      .from('stripe_events')
      .select('id, status, created_at')
      .eq('event_id', event.id)
      .maybeSingle();

    if (existingEvent) {
      return NextResponse.json({
        received: true,
        deduplicated: true,
        billing_enabled: false,
        status: existingEvent.status,
      });
    }

    // 2. Insert event with distinct 'ignored_billing_disabled' status (Never 'processed')
    const { error: insertErr } = await admin.from('stripe_events').insert({
      event_id: event.id,
      event_type: event.type,
      status: 'ignored_billing_disabled',
      payload: {
        id: event.id,
        type: event.type,
        created: event.created,
        billing_disabled: true,
        action: 'ignored_unapplied',
        note: 'Acknowledged without subscription mutation because BILLING_ENABLED=false',
      },
    });

    if (insertErr) {
      console.warn('[Stripe-Webhook] Database insert note:', insertErr.message);
      // Fallback for legacy DB schema constraint: mark as failed, NEVER processed
      if (insertErr.message?.includes('check') || (insertErr as any).code === '23514') {
        const { error: fallbackErr } = await admin.from('stripe_events').insert({
          event_id: event.id,
          event_type: event.type,
          status: 'failed',
          error_message: 'ignored_billing_disabled: unapplied event while BILLING_ENABLED=false',
          payload: {
            id: event.id,
            type: event.type,
            created: event.created,
            billing_disabled: true,
            action: 'ignored_unapplied',
          },
        });
        if (fallbackErr) {
          // Both primary and fallback writes failed -> Return retryable 500
          return NextResponse.json(
            { error: 'Durable event recording failed. Retryable server error.', code: 'LEDGER_INSERT_FAILED' },
            { status: 500 }
          );
        }
      } else {
        // A webhook must never be acknowledged as successfully recorded if its database ledger insertion failed.
        // Return a retryable server error when durable event recording fails.
        return NextResponse.json(
          { error: 'Durable event recording failed. Retryable server error.', code: 'LEDGER_INSERT_FAILED' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      received: true,
      billing_enabled: false,
      status: 'ignored_billing_disabled',
      message: 'Verified event recorded as ignored_billing_disabled. No subscription mutations applied.',
    });
  }

  // -------------------------------------------------------------
  // 1. ATOMIC EVENT CLAIMING & CONCURRENCY RESOLUTION
  // -------------------------------------------------------------
  let shouldProcess = false;

  // Try atomic insert into ledger
  const { error: insertError } = await admin.from('stripe_events').insert({
    event_id: event.id,
    event_type: event.type,
    status: 'processing',
    payload: {
      id: event.id,
      type: event.type,
      created: event.created,
    },
  });

  if (!insertError) {
    // Successfully claimed new event lock
    shouldProcess = true;
  } else {
    // Event already registered. Inspect status and handle retries/concurrency
    const { data: existingEvent } = await admin
      .from('stripe_events')
      .select('id, status, created_at, updated_at')
      .eq('event_id', event.id)
      .maybeSingle();

    if (existingEvent) {
      if (existingEvent.status === 'processed') {
        // Fast-path: Event already fully processed (Idempotent success)
        return NextResponse.json({ received: true, deduplicated: true });
      }

      if (existingEvent.status === 'processing') {
        const lastActivity = new Date(existingEvent.updated_at || existingEvent.created_at).getTime();
        const staleThresholdMs = 60000; // 60 seconds

        if (Date.now() - lastActivity < staleThresholdMs) {
          // Concurrent delivery actively running in another thread
          return NextResponse.json(
            { received: true, in_flight: true },
            { status: 200 }
          );
        }

        // Stale lock recovery: Reclaim crashed or timed-out processing event
        const { data: reclaimed } = await admin
          .from('stripe_events')
          .update({
            status: 'processing',
            updated_at: new Date().toISOString(),
          })
          .eq('event_id', event.id)
          .eq('status', 'processing')
          .select()
          .maybeSingle();

        if (reclaimed) {
          shouldProcess = true;
        } else {
          return NextResponse.json({ received: true, deduplicated: true });
        }
      } else if (existingEvent.status === 'failed') {
        // Retry handling: Reclaim previously failed event for re-execution
        const { data: reclaimed } = await admin
          .from('stripe_events')
          .update({
            status: 'processing',
            updated_at: new Date().toISOString(),
            error_message: null,
          })
          .eq('event_id', event.id)
          .select()
          .maybeSingle();

        if (reclaimed) {
          shouldProcess = true;
        }
      }
    } else if (insertError) {
      // Database ledger failure: insert failed and existing record could not be read
      return NextResponse.json(
        { error: 'Durable event recording failed. Retryable server error.', code: 'LEDGER_INSERT_FAILED' },
        { status: 500 }
      );
    }
  }

  if (!shouldProcess) {
    return NextResponse.json({ received: true, deduplicated: true });
  }

  // -------------------------------------------------------------
  // 2. SUBSCRIPTION STATE MACHINE & AUTHORITATIVE TIMESTAMPS
  // -------------------------------------------------------------
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
          if (!subscriptionId) {
            throw new Error(`Checkout session ${session.id} completed without a valid subscription ID.`);
          }

          // Authoritative retrieval: Derive real billing periods strictly from Stripe
          const subObj = (await stripe.subscriptions.retrieve(subscriptionId)) as any;
          if (!subObj || !subObj.current_period_end) {
            throw new Error(`Stripe subscription ${subscriptionId} did not provide authoritative period end.`);
          }

          const periodStart = subObj.current_period_start
            ? new Date(subObj.current_period_start * 1000).toISOString()
            : new Date().toISOString();
          const periodEnd = new Date(subObj.current_period_end * 1000).toISOString();

          // Out-of-order check
          const { data: existingSub } = await admin
            .from('subscriptions')
            .select('last_event_created')
            .eq('workspace_id', associatedWorkspaceId)
            .maybeSingle();

          if (existingSub?.last_event_created && event.created < existingSub.last_event_created) {
            console.warn(`[Stripe-Webhook] Out-of-order checkout session: event created ${event.created} < ${existingSub.last_event_created}`);
            break;
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
              last_event_created: event.created,
            },
            { onConflict: 'workspace_id' }
          );

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
        const subAny = subscription as any;
        customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id || null;

        const statusMap: Record<string, string> = {
          active: 'active',
          past_due: 'past_due',
          canceled: 'canceled',
          trialing: 'trialing',
          unpaid: 'past_due',
        };

        const dbStatus = statusMap[subscription.status] || 'active';
        const periodStart = subAny?.current_period_start
          ? new Date(subAny.current_period_start * 1000).toISOString()
          : null;
        const periodEnd = subAny?.current_period_end
          ? new Date(subAny.current_period_end * 1000).toISOString()
          : null;

        const { data: subRow } = await admin
          .from('subscriptions')
          .select('workspace_id, last_event_created')
          .eq('provider_subscription_id', subscription.id)
          .maybeSingle();

        if (subRow) {
          associatedWorkspaceId = subRow.workspace_id;

          // Out-of-order rejection
          if (subRow.last_event_created && event.created < subRow.last_event_created) {
            console.warn(`[Stripe-Webhook] Out-of-order subscription update ignored: event ${event.created} < ${subRow.last_event_created}`);
            break;
          }

          await admin
            .from('subscriptions')
            .update({
              status: dbStatus,
              stripe_customer_id: customerId,
              current_period_start: periodStart,
              current_period_end: periodEnd,
              last_event_created: event.created,
            })
            .eq('provider_subscription_id', subscription.id);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const { data: subRow } = await admin
          .from('subscriptions')
          .select('workspace_id, last_event_created')
          .eq('provider_subscription_id', subscription.id)
          .maybeSingle();

        if (subRow) {
          associatedWorkspaceId = subRow.workspace_id;

          if (subRow.last_event_created && event.created < subRow.last_event_created) {
            console.warn(`[Stripe-Webhook] Out-of-order subscription cancellation ignored.`);
            break;
          }

          await admin
            .from('subscriptions')
            .update({
              status: 'canceled',
              plan_id: 'free',
              last_event_created: event.created,
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
            .select('workspace_id, last_event_created')
            .eq('provider_subscription_id', subscriptionId)
            .maybeSingle();

          if (subRow) {
            associatedWorkspaceId = subRow.workspace_id;
            await admin
              .from('subscriptions')
              .update({
                status: 'past_due',
                last_event_created: event.created,
              })
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

    // Mark event as successfully processed
    await admin
      .from('stripe_events')
      .update({
        status: 'processed',
        workspace_id: associatedWorkspaceId,
        customer_id: customerId,
        updated_at: new Date().toISOString(),
      })
      .eq('event_id', event.id);

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('[Stripe-Webhook] Processing error:', err.message);

    // Record error in ledger
    await admin
      .from('stripe_events')
      .update({
        status: 'failed',
        error_message: err.message,
        updated_at: new Date().toISOString(),
      })
      .eq('event_id', event.id);

    // Return 500 so Stripe knows to retry
    return NextResponse.json({ error: err.message || 'Internal handler failure' }, { status: 500 });
  }
}
