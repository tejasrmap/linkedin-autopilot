// ==============================================================
// LINKEDIN AUTOPILOT - STRIPE WEBHOOK LISTENER
// BY GT INNOX LLP
// ==============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
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
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: `Webhook signature error: ${err.message}` }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const workspaceId = session.metadata?.workspace_id || session.client_reference_id;
        const tier = session.metadata?.tier || 'pro';
        const subscriptionId = session.subscription as string;

        if (workspaceId) {
          await admin.from('subscriptions').upsert(
            {
              workspace_id: workspaceId,
              plan_id: tier,
              provider_subscription_id: subscriptionId,
              status: 'active',
              current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            },
            { onConflict: 'workspace_id' }
          );
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const statusMap: Record<string, string> = {
          active: 'active',
          past_due: 'past_due',
          canceled: 'canceled',
          trialing: 'trialing',
          unpaid: 'past_due',
        };

        const dbStatus = statusMap[subscription.status] || 'active';
        const periodEnd = (subscription as any).current_period_end
          ? new Date((subscription as any).current_period_end * 1000).toISOString()
          : null;

        await admin
          .from('subscriptions')
          .update({
            status: dbStatus,
            current_period_end: periodEnd,
          })
          .eq('provider_subscription_id', subscription.id);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await admin
          .from('subscriptions')
          .update({
            status: 'canceled',
            plan_id: 'free',
          })
          .eq('provider_subscription_id', subscription.id);
        break;
      }

      default:
        // Ignore unhandled event types cleanly
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('Error handling webhook event:', err);
    return NextResponse.json({ error: 'Internal handler failure' }, { status: 500 });
  }
}
