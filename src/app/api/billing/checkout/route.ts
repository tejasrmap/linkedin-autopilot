// ==============================================================
// LINKEDIN AUTOPILOT - STRIPE COMMERCIAL CHECKOUT API
// BY GT INNOX LLP
// ==============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

const PLAN_PRICES: Record<string, { amount: number; name: string }> = {
  pro: { amount: 2900, name: 'LinkedIn Autopilot Pro Growth' }, // $29.00 USD
  agency: { amount: 19900, name: 'LinkedIn Autopilot Agency Enterprise' }, // $199.00 USD
};

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { tier = 'pro' } = body;

    const plan = PLAN_PRICES[tier];
    if (!plan) {
      return NextResponse.json({ error: 'Invalid subscription tier selected.' }, { status: 400 });
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return NextResponse.json(
        {
          configured: false,
          error: 'Stripe Secret Key not configured in environment.',
          message:
            'Commercial payment gateway integration requires STRIPE_SECRET_KEY in production environment.',
          plan,
        },
        { status: 503 }
      );
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: '2025-01-27.acacia' as any,
    });

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://autopilot.gtinnox.in';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: plan.name,
              description: `Automated multi-destination LinkedIn publishing & AI studio for workspace ${auth.workspaceId}`,
            },
            unit_amount: plan.amount,
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        workspace_id: auth.workspaceId,
        user_id: auth.user.id,
        tier,
      },
      client_reference_id: auth.workspaceId,
      customer_email: auth.user.email,
      success_url: `${origin}/billing?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${origin}/billing?canceled=true`,
    });

    return NextResponse.json({
      configured: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (err: any) {
    console.error('Stripe checkout creation error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
