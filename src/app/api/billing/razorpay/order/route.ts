// ==============================================================
// LINKEDIN AUTOPILOT - RAZORPAY INR ORDER & AUTOPAY API
// CREATES AUTHENTIC INR SUBSCRIPTIONS (AUTOPAY) & ORDERS VIA RAZORPAY
// BY GT INNOX LLP
// ==============================================================

import { getAuthContext } from '@/lib/auth';
import { getRazorpayClient, getRazorpayKeyId, isRazorpayConfigured, RAZORPAY_PLANS } from '@/lib/razorpay/client';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const planId = (body.planId || 'pro') as 'pro' | 'agency';

    const plan = RAZORPAY_PLANS[planId];
    if (!plan) {
      return NextResponse.json(
        { error: 'Invalid plan selected. Choose "pro" or "agency".' },
        { status: 400 }
      );
    }

    const razorpay = getRazorpayClient();
    const receipt = `rcpt_${auth.workspaceId.slice(0, 8)}_${Date.now().toString().slice(-6)}`;

    // If Razorpay credentials are fully configured
    if (razorpay && isRazorpayConfigured()) {
      // 1. Try creating an Autopay Recurring Subscription
      if (plan.razorpayPlanId) {
        try {
          const subscription = await razorpay.subscriptions.create({
            plan_id: plan.razorpayPlanId,
            total_count: 60, // 5 years monthly recurring
            customer_notify: 1,
            notes: {
              workspaceId: auth.workspaceId,
              userId: auth.user.id,
              planId: plan.id,
              userEmail: auth.user.email,
            },
          });

          return NextResponse.json({
            subscriptionId: subscription.id,
            isSubscription: true,
            isAutopay: true,
            amount: plan.amount,
            currency: 'INR',
            planId: plan.id,
            planName: plan.name,
            displayPrice: plan.displayPrice,
            keyId: getRazorpayKeyId(),
            isSandbox: false,
          });
        } catch (subErr: any) {
          console.warn('[Razorpay Autopay] Subscriptions creation note, falling back to order:', subErr?.message || subErr);
        }
      }

      // 2. Fallback to standard one-time order
      const order = await razorpay.orders.create({
        amount: plan.amount,
        currency: 'INR',
        receipt,
        notes: {
          workspaceId: auth.workspaceId,
          userId: auth.user.id,
          planId: plan.id,
          userEmail: auth.user.email,
        },
      });

      return NextResponse.json({
        orderId: order.id,
        isSubscription: false,
        isAutopay: false,
        amount: order.amount,
        currency: order.currency,
        planId: plan.id,
        planName: plan.name,
        displayPrice: plan.displayPrice,
        keyId: getRazorpayKeyId(),
        isSandbox: false,
      });
    }

    // Safe Test / Sandbox Mode Fallback:
    const mockSubId = `sub_test_${receipt}`;
    return NextResponse.json({
      subscriptionId: mockSubId,
      isSubscription: true,
      isAutopay: true,
      amount: plan.amount,
      currency: 'INR',
      planId: plan.id,
      planName: plan.name,
      displayPrice: plan.displayPrice,
      keyId: getRazorpayKeyId(),
      isSandbox: true,
      message: 'Razorpay test mode subscription created. Configure live keys for production payments.',
    });
  } catch (err: any) {
    console.error('[Razorpay Order] Error creating order/subscription:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to initialize Razorpay payment order.' },
      { status: 500 }
    );
  }
}
