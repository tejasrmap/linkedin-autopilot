// ==============================================================
// LINKEDIN AUTOPILOT - STRIPE CUSTOMER BILLING PORTAL API
// BY GT INNOX LLP
// ==============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const auth = await getAuthContext();
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecret) {
      return NextResponse.json(
        {
          configured: false,
          error: 'Stripe Secret Key not configured in environment.',
          message: 'Customer portal requires STRIPE_SECRET_KEY to be configured in Vercel.',
        },
        { status: 503 }
      );
    }

    const stripe = new Stripe(stripeSecret, {
      apiVersion: '2025-01-27.acacia' as any,
    });

    const admin = createAdminClient();
    const { data: subRow } = await admin
      .from('subscriptions')
      .select('stripe_customer_id, provider_subscription_id')
      .eq('workspace_id', auth.workspaceId)
      .maybeSingle();

    let customerId = subRow?.stripe_customer_id;

    // If stripe_customer_id is not saved, search by user email
    if (!customerId && auth.user.email) {
      const existingCustomers = await stripe.customers.list({
        email: auth.user.email,
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        customerId = existingCustomers.data[0].id;

        // Cache customer ID in subscriptions table
        await admin
          .from('subscriptions')
          .update({ stripe_customer_id: customerId })
          .eq('workspace_id', auth.workspaceId);
      }
    }

    if (!customerId) {
      return NextResponse.json(
        {
          error: 'No active Stripe customer found for this workspace. Subscribe to a plan first.',
        },
        { status: 404 }
      );
    }

    const origin =
      req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://autopilot.gtinnox.in';

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/billing`,
    });

    return NextResponse.json({
      configured: true,
      url: portalSession.url,
    });
  } catch (err: any) {
    console.error('[Stripe-Portal] Error creating portal session:', err.message);
    return NextResponse.json(
      { error: err.message || 'Failed to create billing portal session' },
      { status: 500 }
    );
  }
}
