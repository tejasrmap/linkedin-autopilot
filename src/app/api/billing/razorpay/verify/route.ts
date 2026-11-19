// ==============================================================
// LINKEDIN AUTOPILOT - RAZORPAY INR PAYMENT VERIFICATION API
// VALIDATES HMAC SIGNATURE & ACTIVATES SUBSCRIPTIONS IN DATABASE
// BY GT INNOX LLP
// ==============================================================

import { getAuthContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getRazorpayClient,
  isRazorpayConfigured,
  verifyPaymentSignature,
  verifySubscriptionSignature,
  RAZORPAY_PLANS,
} from '@/lib/razorpay/client';
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
      razorpay_subscription_id,
      razorpay_payment_id,
      razorpay_signature,
      planId = 'pro',
    } = body;

    const referenceId = razorpay_subscription_id || razorpay_order_id;
    if (!referenceId || !razorpay_payment_id) {
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

    // 1. Cryptographic Signature Verification
    if (isRazorpayConfigured()) {
      if (!razorpay_signature) {
        return NextResponse.json(
          { error: 'Missing Razorpay cryptographic signature.' },
          { status: 400 }
        );
      }

      let isValid = false;

      // Check if it's an Autopay subscription or standard order
      if (razorpay_subscription_id) {
        isValid = verifySubscriptionSignature({
          paymentId: razorpay_payment_id,
          subscriptionId: razorpay_subscription_id,
          signature: razorpay_signature,
        });
      } else if (razorpay_order_id) {
        isValid = verifyPaymentSignature({
          orderId: razorpay_order_id,
          paymentId: razorpay_payment_id,
          signature: razorpay_signature,
        });
      }

      if (!isValid) {
        console.error('[Razorpay Verify] Invalid signature attempt for reference:', referenceId);
        return NextResponse.json(
          { error: 'Cryptographic signature verification failed. Untrusted payment.' },
          { status: 400 }
        );
      }
    }

    // 2. Fetch authentic payment details from Razorpay if available
    const razorpay = getRazorpayClient();
    let paymentDetails: any = null;
    if (razorpay) {
      try {
        paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
        // If customer in Razorpay is missing name, update it now
        if (paymentDetails?.customer_id) {
          try {
            const customer = await razorpay.customers.fetch(paymentDetails.customer_id);
            if (!customer.name) {
              const customerName =
                auth.user.full_name ||
                auth.user.email?.split('@')[0];
              if (customerName) {
                await (razorpay.customers.edit as any)(paymentDetails.customer_id, {
                  name: customerName,
                });
              }
            }
          } catch {
            // Non-critical customer update
          }
        }
      } catch (pErr) {
        console.warn('[Razorpay Verify] Note fetching payment details:', pErr);
      }
    }

    // 3. Database Update: Activate Subscription in database
    const admin = createAdminClient();
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const subscriptionProviderId = razorpay_subscription_id || razorpay_payment_id;

    const { error: subErr } = await admin
      .from('subscriptions')
      .upsert(
        {
          workspace_id: auth.workspaceId,
          plan_id: plan.id,
          provider_subscription_id: subscriptionProviderId,
          razorpay_payment_id,
          currency: 'INR',
          amount: plan.amount,
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

    // 4. Record transaction in razorpay_payments table
    try {
      await admin.from('razorpay_payments').insert({
        workspace_id: auth.workspaceId,
        user_id: auth.user.id,
        order_id: razorpay_order_id || subscriptionProviderId,
        payment_id: razorpay_payment_id,
        signature: razorpay_signature || null,
        amount: paymentDetails?.amount || plan.amount,
        currency: 'INR',
        plan_id: plan.id,
        status: 'captured',
        method: paymentDetails?.method || (razorpay_subscription_id ? 'upi' : 'card'),
        notes: {
          customer_id: paymentDetails?.customer_id || null,
          customer_email: paymentDetails?.email || auth.user.email,
          customer_phone: paymentDetails?.contact || null,
          subscription_id: razorpay_subscription_id || null,
          plan_name: plan.name,
        },
      });
    } catch (payErr) {
      console.warn('[Razorpay Verify] Payment audit record note:', payErr);
    }

    // 5. Idempotently log payment event in event audit ledger
    try {
      await admin.from('stripe_events').insert({
        event_id: `rzp_${razorpay_payment_id}`,
        event_type: razorpay_subscription_id ? 'razorpay.subscription.authenticated' : 'razorpay.payment.verified',
        workspace_id: auth.workspaceId,
        customer_id: auth.user.email,
        status: 'processed',
        payload: {
          order_id: razorpay_order_id || null,
          subscription_id: razorpay_subscription_id || null,
          payment_id: razorpay_payment_id,
          is_autopay: Boolean(razorpay_subscription_id),
          customer_id: paymentDetails?.customer_id || null,
          customer_phone: paymentDetails?.contact || null,
          method: paymentDetails?.method || null,
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
      isAutopay: Boolean(razorpay_subscription_id),
      periodEnd: periodEnd.toISOString(),
      message: `Payment of ${plan.displayPrice} verified successfully! ${Boolean(razorpay_subscription_id) ? 'Autopay subscription activated.' : ''} Your workspace is upgraded to ${plan.name}.`,
    });
  } catch (err: any) {
    console.error('[Razorpay Verify] Unexpected error during verification:', err);
    return NextResponse.json(
      { error: err.message || 'Payment verification failed.' },
      { status: 500 }
    );
  }
}
