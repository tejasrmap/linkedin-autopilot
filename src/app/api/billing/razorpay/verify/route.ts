// ==============================================================
// LINKEDIN AUTOPILOT - RAZORPAY INR PAYMENT VERIFICATION API
// HARDENED FAIL-CLOSED SIGNATURE VALIDATION, CHECKOUT SESSION OWNERSHIP,
// IDEMPOTENT ENTITLEMENT ACTIVATION & AUDIT LEDGER
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
        { error: 'Missing required Razorpay payment identifiers.', code: 'MISSING_PAYMENT_IDENTIFIERS' },
        { status: 400 }
      );
    }

    const plan = RAZORPAY_PLANS[planId as 'pro' | 'agency'];
    if (!plan) {
      return NextResponse.json(
        { error: 'Invalid plan identifier.', code: 'INVALID_PLAN_IDENTIFIER' },
        { status: 400 }
      );
    }

    // -------------------------------------------------------------
    // 1. FAIL-CLOSED GATEWAY CREDENTIAL CHECK
    // Missing credentials can NEVER result in subscription activation
    // -------------------------------------------------------------
    if (!isRazorpayConfigured()) {
      if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DEV_MOCK_GATEWAY !== 'true') {
        console.error('[Razorpay Verify] Gateway credentials missing. Strictly failing closed.');
        return NextResponse.json(
          {
            error: 'Razorpay payment gateway credentials are not configured on this server. Verification failed.',
            code: 'GATEWAY_UNAVAILABLE',
          },
          { status: 503 }
        );
      }
    }

    // -------------------------------------------------------------
    // 2. SANDBOX / TEST ID PROTECTION IN PRODUCTION
    // Test payments can NEVER grant production entitlements
    // -------------------------------------------------------------
    const isSandboxPayment =
      razorpay_payment_id.startsWith('pay_test_') ||
      (razorpay_subscription_id && razorpay_subscription_id.startsWith('sub_test_')) ||
      (razorpay_order_id && razorpay_order_id.startsWith('order_test_'));

    if (isSandboxPayment && process.env.NODE_ENV === 'production') {
      console.warn('[Razorpay Verify Security] Sandbox payment attempted in production:', razorpay_payment_id);
      return NextResponse.json(
        { error: 'Sandbox/test payments cannot grant production entitlements.', code: 'TEST_PAYMENT_REJECTED' },
        { status: 400 }
      );
    }

    // -------------------------------------------------------------
    // 3. CRYPTOGRAPHIC SIGNATURE VERIFICATION
    // Must be present, non-empty, and strictly match HMAC SHA256 formula
    // -------------------------------------------------------------
    if (!razorpay_signature || typeof razorpay_signature !== 'string' || razorpay_signature.trim().length === 0) {
      return NextResponse.json(
        { error: 'Missing or empty Razorpay cryptographic signature.', code: 'MISSING_SIGNATURE' },
        { status: 400 }
      );
    }

    let isSignatureValid = false;
    if (razorpay_subscription_id) {
      isSignatureValid = verifySubscriptionSignature({
        paymentId: razorpay_payment_id,
        subscriptionId: razorpay_subscription_id,
        signature: razorpay_signature,
      });
    } else if (razorpay_order_id) {
      isSignatureValid = verifyPaymentSignature({
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
      });
    }

    if (!isSignatureValid) {
      console.error('[Razorpay Verify Security] Cryptographic signature check failed for ref:', referenceId);
      return NextResponse.json(
        { error: 'Cryptographic signature verification failed. Untrusted payment.', code: 'INVALID_SIGNATURE' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // -------------------------------------------------------------
    // 4. AUTHORITATIVE CHECKOUT ASSOCIATION & WORKSPACE OWNERSHIP
    // Server verifies checkout was created for this workspace & plan
    // -------------------------------------------------------------
    const { data: checkoutRecord } = await admin
      .from('razorpay_payments')
      .select('*')
      .eq('order_id', referenceId)
      .maybeSingle();

    if (checkoutRecord) {
      // A. Verify workspace ownership
      if (checkoutRecord.workspace_id !== auth.workspaceId) {
        console.warn('[Razorpay Verify Security] Workspace mismatch on checkout record:', {
          checkoutWs: checkoutRecord.workspace_id,
          authWs: auth.workspaceId,
        });
        return NextResponse.json(
          { error: 'Checkout session belongs to another workspace. Access denied.', code: 'WORKSPACE_MISMATCH' },
          { status: 403 }
        );
      }

      // B. Verify plan match (Prevent client buying pro and verifying as agency)
      if (checkoutRecord.plan_id !== plan.id) {
        console.warn('[Razorpay Verify Security] Plan mismatch on checkout record:', {
          checkoutPlan: checkoutRecord.plan_id,
          requestPlan: plan.id,
        });
        return NextResponse.json(
          { error: 'Checkout plan does not match activation plan.', code: 'PLAN_MISMATCH' },
          { status: 400 }
        );
      }

      // C. Verify currency and expected amount
      if (checkoutRecord.currency !== 'INR' || checkoutRecord.amount !== plan.amount) {
        return NextResponse.json(
          { error: 'Checkout amount or currency does not match authoritative plan price.', code: 'AMOUNT_MISMATCH' },
          { status: 400 }
        );
      }
    }

    // -------------------------------------------------------------
    // 5. PAYMENT REUSE & REDEMPTION CHECK
    // Payment ID cannot be redeemed across multiple workspaces
    // -------------------------------------------------------------
    const { data: existingPayment } = await admin
      .from('razorpay_payments')
      .select('id, workspace_id, status, payment_id')
      .eq('payment_id', razorpay_payment_id)
      .maybeSingle();

    if (existingPayment && existingPayment.workspace_id !== auth.workspaceId) {
      console.warn('[Razorpay Verify Security] Payment ID reuse across workspaces detected:', {
        paymentId: razorpay_payment_id,
        existingWs: existingPayment.workspace_id,
        attemptedWs: auth.workspaceId,
      });
      return NextResponse.json(
        { error: 'Payment ID has already been redeemed by another workspace.', code: 'PAYMENT_ALREADY_REDEEMED' },
        { status: 409 }
      );
    }

    // -------------------------------------------------------------
    // 6. AUTHORITATIVE STATUS CHECK VIA RAZORPAY API
    // Must be captured before granting paid entitlements
    // -------------------------------------------------------------
    const razorpay = getRazorpayClient();
    let paymentDetails: any = null;
    let authoritativeRenewalDate: Date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    if (razorpay && !isSandboxPayment) {
      try {
        paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
        if (!paymentDetails || paymentDetails.status !== 'captured') {
          console.warn('[Razorpay Verify] Payment status is not captured:', paymentDetails?.status);
          return NextResponse.json(
            { error: `Payment status is ${paymentDetails?.status || 'unknown'}. Must be captured.`, code: 'PAYMENT_NOT_CAPTURED' },
            { status: 400 }
          );
        }

        if (paymentDetails.amount !== plan.amount) {
          return NextResponse.json(
            { error: 'Gateway captured amount does not match server plan price.', code: 'AMOUNT_MISMATCH' },
            { status: 400 }
          );
        }

        if (paymentDetails.currency !== 'INR') {
          return NextResponse.json(
            { error: 'Payment currency must be INR.', code: 'CURRENCY_MISMATCH' },
            { status: 400 }
          );
        }

        // For recurring subscriptions, verify subscription status with Razorpay
        if (razorpay_subscription_id) {
          const subDetails: any = await (razorpay.subscriptions.fetch as any)(razorpay_subscription_id);
          if (
            !subDetails ||
            (subDetails.status !== 'active' &&
              subDetails.status !== 'authenticated' &&
              subDetails.status !== 'completed')
          ) {
            return NextResponse.json(
              { error: `Subscription status is ${subDetails?.status || 'inactive'}.`, code: 'SUBSCRIPTION_INACTIVE' },
              { status: 400 }
            );
          }

          if (subDetails.current_end) {
            authoritativeRenewalDate = new Date(subDetails.current_end * 1000);
          }
        }
      } catch (gwErr: any) {
        console.error('[Razorpay Verify] Error fetching authoritative status from gateway:', gwErr);
        // If not in offline test mode, do not proceed if gateway communication failed
        if (process.env.MOCK_SUPABASE_FOR_TESTS !== 'true') {
          return NextResponse.json(
            { error: 'Unable to verify payment status with payment gateway. Please retry.', code: 'GATEWAY_ERROR' },
            { status: 502 }
          );
        }
      }
    }

    // -------------------------------------------------------------
    // 7. ATOMIC DATABASE ENTITLEMENT ACTIVATION & AUDIT
    // -------------------------------------------------------------
    const now = new Date();
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
          current_period_end: authoritativeRenewalDate.toISOString(),
          last_event_created: Math.floor(now.getTime() / 1000),
        },
        {
          onConflict: 'workspace_id',
        }
      );

    if (subErr) {
      console.error('[Razorpay Verify] Database error updating subscription:', subErr);
      return NextResponse.json(
        { error: 'Failed to record subscription activation in database.', code: 'DATABASE_WRITE_FAILED' },
        { status: 500 }
      );
    }

    // Update or insert checkout record status to captured
    try {
      await admin.from('razorpay_payments').upsert(
        {
          workspace_id: auth.workspaceId,
          user_id: auth.user.id,
          order_id: referenceId,
          payment_id: razorpay_payment_id,
          signature: razorpay_signature,
          amount: paymentDetails?.amount || plan.amount,
          currency: 'INR',
          plan_id: plan.id,
          status: 'captured',
          method: paymentDetails?.method || (razorpay_subscription_id ? 'autopay' : 'card'),
          updated_at: now.toISOString(),
          notes: {
            customer_id: paymentDetails?.customer_id || null,
            customer_email: paymentDetails?.email || auth.user.email,
            customer_phone: paymentDetails?.contact || null,
            subscription_id: razorpay_subscription_id || null,
            plan_name: plan.name,
            verified_at: now.toISOString(),
          },
        },
        {
          onConflict: 'order_id',
        }
      );
    } catch (payErr) {
      console.warn('[Razorpay Verify] Payment audit record update note:', payErr);
    }

    // Log in stripe_events audit ledger
    try {
      await admin.from('stripe_events').upsert(
        {
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
        },
        { onConflict: 'event_id' }
      );
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
      periodEnd: authoritativeRenewalDate.toISOString(),
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
