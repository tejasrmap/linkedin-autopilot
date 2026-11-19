// ==============================================================
// LINKEDIN AUTOPILOT - RAZORPAY INR ORDER CREATION API
// CREATES AUTHENTIC INR ORDERS VIA RAZORPAY
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

    // If Razorpay credentials are fully configured, create authentic order with Razorpay
    if (razorpay && isRazorpayConfigured()) {
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
    // If Razorpay API keys are not yet set in environment, generate test order reference
    // so development & staging checkouts can be verified without hard failure.
    const mockOrderId = `order_test_${receipt}`;
    return NextResponse.json({
      orderId: mockOrderId,
      amount: plan.amount,
      currency: 'INR',
      planId: plan.id,
      planName: plan.name,
      displayPrice: plan.displayPrice,
      keyId: getRazorpayKeyId(),
      isSandbox: true,
      message: 'Razorpay test mode order created. Configure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET for live payments.',
    });
  } catch (err: any) {
    console.error('[Razorpay Order] Error creating order:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to initialize Razorpay payment order.' },
      { status: 500 }
    );
  }
}
