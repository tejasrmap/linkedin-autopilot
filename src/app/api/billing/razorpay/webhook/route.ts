// ==============================================================
// LINKEDIN AUTOPILOT - RAZORPAY INR WEBHOOK HANDLER
// SECURE IDEMPOTENT WEBHOOK INGESTION & AUTOMATED RECONCILIATION
// BY GT INNOX LLP
// ==============================================================

import { createAdminClient } from '@/lib/supabase/admin';
import { isRazorpayConfigured, verifyWebhookSignature, RAZORPAY_PLANS } from '@/lib/razorpay/client';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-razorpay-signature');

    // 1. Signature Verification
    if (isRazorpayConfigured()) {
      if (!signature || !verifyWebhookSignature(rawBody, signature)) {
        console.error('[Razorpay Webhook] Invalid webhook signature detected.');
        return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 400 });
      }
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event;
    const payment = payload.payload?.payment?.entity;
    const order = payload.payload?.order?.entity;

    const eventId = payload.id || `evt_${Date.now()}`;
    const admin = createAdminClient();

    // 2. Check for duplicate event processing (idempotency)
    const { data: existingEvent } = await admin
      .from('stripe_events')
      .select('id, status')
      .eq('event_id', eventId)
      .maybeSingle();

    if (existingEvent && existingEvent.status === 'processed') {
      return NextResponse.json({ status: 'already_processed', eventId });
    }

    // 3. Handle Payment Captured / Order Paid
    if (event === 'payment.captured' || event === 'order.paid') {
      const notes = payment?.notes || order?.notes || {};
      const workspaceId = notes.workspaceId;
      const planId = notes.planId || 'pro';
      const paymentId = payment?.id || order?.id;

      if (workspaceId && paymentId) {
        const now = new Date();
        const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        await admin.from('subscriptions').upsert(
          {
            workspace_id: workspaceId,
            plan_id: planId,
            provider_subscription_id: paymentId,
            status: 'active',
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
            last_event_created: Math.floor(now.getTime() / 1000),
          },
          { onConflict: 'workspace_id' }
        );
      }
    }

    // 4. Record event in audit ledger
    await admin.from('stripe_events').upsert(
      {
        event_id: eventId,
        event_type: `razorpay.${event}`,
        workspace_id: payment?.notes?.workspaceId || order?.notes?.workspaceId || null,
        status: 'processed',
        payload,
      },
      { onConflict: 'event_id' }
    );

    return NextResponse.json({ status: 'success', received: true });
  } catch (err: any) {
    console.error('[Razorpay Webhook] Handler error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
