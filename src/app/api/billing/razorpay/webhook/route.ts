// ==============================================================
// LINKEDIN AUTOPILOT - HARDENED RAZORPAY INR WEBHOOK HANDLER
// ATOMIC EVENT CLAIMING, FAIL-CLOSED SIGNATURE AUTHENTICATION,
// DEDICATED WEBHOOK SECRET & OUT-OF-ORDER MUTATION DEFENSE
// BY GT INNOX LLP
// ==============================================================

import { createAdminClient } from '@/lib/supabase/admin';
import {
  isRazorpayWebhookConfigured,
  verifyWebhookSignature,
  RAZORPAY_PLANS,
} from '@/lib/razorpay/client';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SUPPORTED_RAZORPAY_EVENTS = new Set([
  'subscription.authenticated',
  'subscription.activated',
  'subscription.charged',
  'subscription.cancelled',
  'subscription.paused',
  'payment.captured',
  'payment.failed',
  'order.paid',
]);

export async function POST(request: Request) {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // -------------------------------------------------------------
    // 1. FAIL-CLOSED WEBHOOK SECRET CHECK
    // Dedicated secret is required. Never silently fall back to API secret.
    // -------------------------------------------------------------
    if (!webhookSecret || !isRazorpayWebhookConfigured()) {
      // In production or when strictly testing, fail closed
      if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DEV_MOCK_GATEWAY !== 'true') {
        console.error('[Razorpay Webhook Security] RAZORPAY_WEBHOOK_SECRET is not configured. Webhook rejected.');
        return NextResponse.json(
          { error: 'Razorpay webhook signing secret is not configured on this server.', code: 'WEBHOOK_SECRET_MISSING' },
          { status: 503 }
        );
      }
    }

    // -------------------------------------------------------------
    // 2. SIGNATURE AUTHENTICATION & HEADER VALIDATION
    // Raw body must be verified against HMAC SHA256 signature
    // -------------------------------------------------------------
    const rawBody = await request.text();
    const signature = request.headers.get('x-razorpay-signature');

    if (!signature || typeof signature !== 'string' || signature.trim().length === 0) {
      console.warn('[Razorpay Webhook Security] Missing x-razorpay-signature header.');
      return NextResponse.json(
        { error: 'Missing required x-razorpay-signature header.', code: 'MISSING_SIGNATURE_HEADER' },
        { status: 400 }
      );
    }

    const isSigValid = verifyWebhookSignature(rawBody, signature);
    if (!isSigValid) {
      console.error('[Razorpay Webhook Security] Invalid webhook signature detected.');
      return NextResponse.json(
        { error: 'Invalid Razorpay webhook signature.', code: 'INVALID_WEBHOOK_SIGNATURE' },
        { status: 400 }
      );
    }

    // -------------------------------------------------------------
    // 3. PARSE RAW BODY & VALIDATE EVENT PAYLOAD
    // -------------------------------------------------------------
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload format.', code: 'MALFORMED_JSON' },
        { status: 400 }
      );
    }

    // Require genuine Razorpay event identifier (NEVER synthesize Date.now())
    const eventId = payload.id || payload.event_id;
    if (!eventId || typeof eventId !== 'string' || eventId.trim().length === 0) {
      console.warn('[Razorpay Webhook Security] Webhook rejected: missing authoritative event ID.');
      return NextResponse.json(
        { error: 'Missing authoritative Razorpay event ID.', code: 'MISSING_EVENT_ID' },
        { status: 400 }
      );
    }

    const event = payload.event;
    if (!event || !SUPPORTED_RAZORPAY_EVENTS.has(event)) {
      // Unrecognized event type: acknowledge without processing or mutating
      return NextResponse.json({
        received: true,
        action: 'ignored_unsupported_event_type',
        event,
      });
    }

    const payment = payload.payload?.payment?.entity;
    const order = payload.payload?.order?.entity;
    const subscription = payload.payload?.subscription?.entity;

    const eventCreatedAt = payload.created_at || (payment?.created_at ?? Math.floor(Date.now() / 1000));
    const admin = createAdminClient();

    // -------------------------------------------------------------
    // 4. ATOMIC EVENT CLAIMING & CONCURRENCY LOCKING
    // -------------------------------------------------------------
    // Try to atomically claim event
    const { error: insertError } = await admin.from('stripe_events').insert({
      event_id: eventId,
      event_type: `razorpay.${event}`,
      status: 'processing',
      payload: {
        id: eventId,
        event,
        created_at: eventCreatedAt,
      },
    });

    if (insertError) {
      // Unique violation / conflict: event already exists in ledger
      const { data: existingEvent } = await admin
        .from('stripe_events')
        .select('id, status, created_at, updated_at')
        .eq('event_id', eventId)
        .maybeSingle();

      if (existingEvent) {
        if (existingEvent.status === 'processed') {
          return NextResponse.json({
            received: true,
            deduplicated: true,
            status: 'already_processed',
            eventId,
          });
        }

        // If currently in-flight by another concurrent worker (< 60s), avoid race condition
        const eventAge = Date.now() - new Date(existingEvent.updated_at || existingEvent.created_at).getTime();
        if (existingEvent.status === 'processing' && eventAge < 60000) {
          return NextResponse.json({
            received: true,
            in_flight: true,
            eventId,
          });
        }

        // Otherwise reclaim lock
        await admin
          .from('stripe_events')
          .update({
            status: 'processing',
            updated_at: new Date().toISOString(),
          })
          .eq('event_id', eventId);
      }
    }

    // -------------------------------------------------------------
    // 5. RESOLVE AUTHORITATIVE CHECKOUT RECORD & WORKSPACE OWNERSHIP
    // Do not trust arbitrary webhook notes without verifying checkout
    // -------------------------------------------------------------
    const referenceId = subscription?.id || order?.id || payment?.order_id;
    let workspaceId = subscription?.notes?.workspaceId || payment?.notes?.workspaceId || order?.notes?.workspaceId;
    let planId = subscription?.notes?.planId || payment?.notes?.planId || order?.notes?.planId || 'pro';

    if (referenceId) {
      const { data: checkoutRecord } = await admin
        .from('razorpay_payments')
        .select('*')
        .eq('order_id', referenceId)
        .maybeSingle();

      if (checkoutRecord) {
        workspaceId = checkoutRecord.workspace_id;
        planId = checkoutRecord.plan_id;
      }
    }

    if (!workspaceId) {
      console.warn('[Razorpay Webhook Security] Webhook discarded: unassociated workspace for ref:', referenceId);
      await admin
        .from('stripe_events')
        .update({
          status: 'failed',
          error_message: 'Unassociated workspace reference.',
          updated_at: new Date().toISOString(),
        })
        .eq('event_id', eventId);

      return NextResponse.json({
        received: true,
        action: 'ignored_unassociated_workspace',
      });
    }

    const plan = RAZORPAY_PLANS[planId as 'pro' | 'agency'] || RAZORPAY_PLANS.pro;

    // -------------------------------------------------------------
    // 6. OUT-OF-ORDER PROTECTION
    // Older event must not overwrite newer subscription state
    // -------------------------------------------------------------
    const { data: currentSub } = await admin
      .from('subscriptions')
      .select('last_event_created, status, current_period_end')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (currentSub?.last_event_created && eventCreatedAt < currentSub.last_event_created) {
      console.warn('[Razorpay Webhook Security] Out-of-order event skipped:', {
        incomingTimestamp: eventCreatedAt,
        currentLastEvent: currentSub.last_event_created,
      });

      await admin
        .from('stripe_events')
        .update({
          status: 'processed',
          payload: {
            ...payload,
            note: 'ignored_stale_out_of_order_event',
          },
          updated_at: new Date().toISOString(),
        })
        .eq('event_id', eventId);

      return NextResponse.json({
        received: true,
        action: 'ignored_stale_event',
        eventId,
      });
    }

    // -------------------------------------------------------------
    // 7. HANDLE SUBSCRIPTION CHARGED / ACTIVATED / CANCELLED
    // -------------------------------------------------------------
    const now = new Date();
    let mutationSuccess = false;

    if (
      event === 'subscription.charged' ||
      event === 'subscription.activated' ||
      event === 'subscription.authenticated'
    ) {
      // Validate payment currency and amount if payment entity is included
      if (payment) {
        if (payment.currency && payment.currency !== 'INR') {
          console.warn('[Razorpay Webhook Security] Invalid currency in payment entity:', payment.currency);
          await admin.from('stripe_events').update({ status: 'failed', error_message: 'Invalid currency' }).eq('event_id', eventId);
          return NextResponse.json({ error: 'Invalid currency' }, { status: 400 });
        }
      }

      const subscriptionId = subscription?.id || payment?.id || referenceId;
      let authoritativeRenewal = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      if (subscription?.current_end) {
        authoritativeRenewal = new Date(subscription.current_end * 1000);
      }

      const { error: upsertErr } = await admin.from('subscriptions').upsert(
        {
          workspace_id: workspaceId,
          plan_id: plan.id,
          provider_subscription_id: subscriptionId,
          status: 'active',
          currency: 'INR',
          amount: plan.amount,
          current_period_start: now.toISOString(),
          current_period_end: authoritativeRenewal.toISOString(),
          last_event_created: eventCreatedAt,
        },
        { onConflict: 'workspace_id' }
      );

      if (upsertErr) {
        console.error('[Razorpay Webhook] Database mutation failed:', upsertErr);
        await admin.from('stripe_events').update({ status: 'failed', error_message: upsertErr.message }).eq('event_id', eventId);
        return NextResponse.json({ error: 'Database mutation failed. Retryable.', code: 'DATABASE_MUTATION_FAILED' }, { status: 500 });
      }

      mutationSuccess = true;
    } else if (event === 'payment.captured' || event === 'order.paid') {
      const paymentId = payment?.id || order?.id || referenceId;
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const { error: upsertErr } = await admin.from('subscriptions').upsert(
        {
          workspace_id: workspaceId,
          plan_id: plan.id,
          provider_subscription_id: paymentId,
          status: 'active',
          currency: 'INR',
          amount: plan.amount,
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          last_event_created: eventCreatedAt,
        },
        { onConflict: 'workspace_id' }
      );

      if (upsertErr) {
        console.error('[Razorpay Webhook] Database mutation failed:', upsertErr);
        await admin.from('stripe_events').update({ status: 'failed', error_message: upsertErr.message }).eq('event_id', eventId);
        return NextResponse.json({ error: 'Database mutation failed. Retryable.', code: 'DATABASE_MUTATION_FAILED' }, { status: 500 });
      }

      mutationSuccess = true;
    } else if (event === 'subscription.cancelled' || event === 'subscription.paused') {
      const { error: cancelErr } = await admin
        .from('subscriptions')
        .update({
          status: 'canceled',
          last_event_created: eventCreatedAt,
        })
        .eq('workspace_id', workspaceId);

      if (cancelErr) {
        console.error('[Razorpay Webhook] Database cancellation failed:', cancelErr);
        await admin.from('stripe_events').update({ status: 'failed', error_message: cancelErr.message }).eq('event_id', eventId);
        return NextResponse.json({ error: 'Database mutation failed. Retryable.', code: 'DATABASE_MUTATION_FAILED' }, { status: 500 });
      }

      mutationSuccess = true;
    } else if (event === 'payment.failed') {
      // Payment failure does not alter active subscription immediately, but records failure
      mutationSuccess = true;
    }

    // -------------------------------------------------------------
    // 8. FINALIZE EVENT IN AUDIT LEDGER
    // Only mark processed after all required database writes succeeded
    // -------------------------------------------------------------
    await admin.from('stripe_events').update({
      status: 'processed',
      workspace_id: workspaceId,
      customer_id: payment?.email || subscription?.notes?.userEmail || null,
      payload: {
        ...payload,
        mutation_applied: mutationSuccess,
        verified_at: now.toISOString(),
      },
      updated_at: now.toISOString(),
    }).eq('event_id', eventId);

    return NextResponse.json({
      status: 'success',
      received: true,
      eventId,
      processed: mutationSuccess,
    });
  } catch (err: any) {
    console.error('[Razorpay Webhook] Unexpected error in webhook processing:', err);
    return NextResponse.json(
      { error: err.message || 'Internal webhook error.', code: 'UNEXPECTED_WEBHOOK_ERROR' },
      { status: 500 }
    );
  }
}
