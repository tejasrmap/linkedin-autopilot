// ==============================================================
// LINKEDIN AUTOPILOT - RAZORPAY INR PAYMENT VERIFICATION API
// VALIDATES HMAC SIGNATURE & ACTIVATES SUBSCRIPTIONS IN DATABASE
// BY GT INNOX LLP
// ==============================================================

import { getAuthContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { isRazorpayConfigured, verifyPaymentSignature, RAZORPAY_PLANS } from '@/lib/razorpay/client';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planId = 'pro',
    } = body;

    if (!razorpay_order_id || !razorpay_payment_id) {
      return NextResponse.json(
        { error: 'Missing required Razorpay payment identifiers.' },
        { status: 400 }
      );
    }

    const plan = RAZORPAY_PLANS[planId as 'pro' | 'agency'];
    if (!plan) {
      return NextResponse.json(
        { error: 'Invalid plan identifier.' },
        { status: 400 }
      );
    }

    // 1. Signature Verification
    if (isRazorpayConfigured()) {
      if (!razorpay_signature) {
        return NextResponse.json(
          { error: 'Missing Razorpay cryptographic signature.' },
          { status: 400 }
        );
      }

      const isValid = verifyPaymentSignature({
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
      });

      if (!isValid) {
        console.error('[Razorpay Verify] Invalid signature attempt for order:', razorpay_order_id);
        return NextResponse.json(
          { error: 'Cryptographic signature verification failed. Untrusted payment.' },
          { status: 400 }
        );
      }
    }

    // 2. Database Update: Activate Subscription for 30 days
    const admin = createAdminClient();
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const { error: subErr } = await admin
      .from('subscriptions')
      .upsert(
        {
          workspace_id: auth.workspaceId,
          plan_id: plan.id,
          provider_subscription_id: razorpay_payment_id,
          status: 'active',
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          last_event_created: Math.floor(now.getTime() / 1000),
        },
        {
          onConflict: 'workspace_id',
        }
      );

    if (subErr) {
      console.error('[Razorpay Verify] Database error updating subscription:', subErr);
      return NextResponse.json(
        { error: 'Failed to record subscription activation in database.' },
        { status: 500 }
      );
    }

    // 3. Idempotently log payment event in event audit ledger
    try {
      await admin.from('stripe_events').insert({
        event_id: `rzp_${razorpay_payment_id}`,
        event_type: 'razorpay.payment.verified',
        workspace_id: auth.workspaceId,
        customer_id: auth.user.email,
        status: 'processed',
        payload: {
          order_id: razorpay_order_id,
          payment_id: razorpay_payment_id,
          plan_id: plan.id,
          plan_name: plan.name,
          amount_inr_paise: plan.amount,
          amount_inr_display: plan.displayPrice,
          currency: 'INR',
          verified_at: now.toISOString(),
          user_id: auth.user.id,
        },
      });
    } catch (auditErr) {
      console.warn('[Razorpay Verify] Audit logging skipped:', auditErr);
    }

    return NextResponse.json({
      success: true,
      plan: plan.id,
      planName: plan.name,
      amount: plan.displayPrice,
      currency: 'INR',
      periodEnd: periodEnd.toISOString(),
      message: `Payment of ${plan.displayPrice} verified successfully! Your workspace is upgraded to ${plan.name}.`,
    });
  } catch (err: any) {
    console.error('[Razorpay Verify] Unexpected error during verification:', err);
    return NextResponse.json(
      { error: err.message || 'Payment verification failed.' },
      { status: 500 }
    );
  }
}
