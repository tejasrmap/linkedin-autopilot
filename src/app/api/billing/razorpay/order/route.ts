// ==============================================================
// LINKEDIN AUTOPILOT - RAZORPAY INR ORDER & AUTOPAY API
// CREATES AUTHENTIC INR SUBSCRIPTIONS (AUTOPAY) & ORDERS VIA RAZORPAY
// BY GT INNOX LLP
// ==============================================================

import { getAuthContext } from '@/lib/auth';
import { getRazorpayClient, getRazorpayKeyId, isRazorpayConfigured, RAZORPAY_PLANS } from '@/lib/razorpay/client';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Ensures a Customer entity exists in Razorpay with full name, email, phone, and metadata.
 * If customer already exists by email, updates missing name or contact details.
 */
async function getOrCreateRazorpayCustomer(
  razorpay: any,
  customerData: {
    name: string;
    email: string;
    contact?: string;
    notes?: Record<string, string>;
  }
) {
  const { name, email, contact, notes } = customerData;
  if (!email) return null;

  try {
    const customer = await razorpay.customers.create({
      name: name || undefined,
      email,
      contact: contact || undefined,
      notes: notes || undefined,
    });
    return customer;
  } catch (err: any) {
    // If customer already exists with this email in Razorpay merchant account
    if (err.statusCode === 400 && err.error?.description?.includes('already exists')) {
      try {
        const list = await razorpay.customers.all({ count: 100 });
        const existing = (list.items || []).find(
          (c: any) => c.email?.toLowerCase() === email.toLowerCase()
        );
        if (existing) {
          // If existing customer has missing name or contact, update it immediately
          if ((!existing.name && name) || (!existing.contact && contact)) {
            try {
              const updated = await razorpay.customers.edit(existing.id, {
                name: name || existing.name || undefined,
                contact: contact || existing.contact || undefined,
                notes: { ...(existing.notes || {}), ...(notes || {}) },
              });
              return updated;
            } catch {
              return existing;
            }
          }
          return existing;
        }
      } catch {
        // Fallback gracefully
      }
    }
    console.warn('[Razorpay Customer] Note creating customer:', err?.message || err);
    return null;
  }
}

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

    const admin = createAdminClient();

    // 1. Resolve authoritative customer details from request, profile, and workspace
    let customerName = (body.customerName || '').trim();
    const customerEmail = (body.customerEmail || auth.user.email || '').trim();
    let customerPhone = (body.customerPhone || body.phone || body.contact || '').trim();

    const { data: profile } = await admin
      .from('profiles')
      .select('full_name')
      .eq('id', auth.user.id)
      .maybeSingle();

    const { data: ws } = await admin
      .from('workspaces')
      .select('name')
      .eq('id', auth.workspaceId)
      .maybeSingle();

    if (!customerName) {
      customerName =
        profile?.full_name ||
        auth.user.full_name ||
        ws?.name ||
        customerEmail.split('@')[0];
    }

    const workspaceName = ws?.name || 'Workspace';

    const razorpay = getRazorpayClient();
    const receipt = `rcpt_${auth.workspaceId.slice(0, 8)}_${Date.now().toString().slice(-6)}`;

    // If Razorpay credentials are fully configured
    if (razorpay && isRazorpayConfigured()) {
      // 2. Ensure customer entity exists with full name and contact on Razorpay
      let customerId: string | undefined;
      try {
        const customer = await getOrCreateRazorpayCustomer(razorpay, {
          name: customerName,
          email: customerEmail,
          contact: customerPhone || undefined,
          notes: {
            workspaceId: auth.workspaceId,
            workspaceName,
            userId: auth.user.id,
            plan: plan.name,
          },
        });
        if (customer) {
          customerId = customer.id;
          if (!customerPhone && customer.contact) {
            customerPhone = customer.contact;
          }
        }
      } catch (custErr) {
        console.warn('[Razorpay Order] Customer resolution warning:', custErr);
      }

      const orderNotes = {
        workspaceId: auth.workspaceId,
        workspaceName,
        userId: auth.user.id,
        customerName,
        userEmail: customerEmail,
        customerPhone: customerPhone || '',
        planId: plan.id,
        planName: plan.name,
      };

      // 3. Try creating an Autopay Recurring Subscription linked to the customer
      if (plan.razorpayPlanId) {
        try {
          const subscription: any = await (razorpay.subscriptions.create as any)({
            plan_id: plan.razorpayPlanId,
            customer_id: customerId || undefined,
            total_count: 60, // 5 years monthly recurring
            customer_notify: 1,
            notes: orderNotes,
          });

          // Persist authoritative server-side checkout association in database
          await admin.from('razorpay_payments').insert({
            workspace_id: auth.workspaceId,
            user_id: auth.user.id,
            order_id: subscription.id,
            amount: plan.amount,
            currency: 'INR',
            plan_id: plan.id,
            status: 'created',
            method: 'autopay',
            notes: {
              ...orderNotes,
              checkout_type: 'subscription',
              subscription_id: subscription.id,
              expected_amount: plan.amount,
              currency: 'INR',
              created_at: new Date().toISOString(),
            },
          });

          return NextResponse.json({
            subscriptionId: subscription.id,
            customerId,
            customerName,
            customerEmail,
            customerPhone,
            workspaceName,
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

      // 4. Fallback to standard one-time order linked to the customer
      const order: any = await (razorpay.orders.create as any)({
        amount: plan.amount,
        currency: 'INR',
        receipt,
        customer_id: customerId || undefined,
        notes: orderNotes,
      });

      // Persist authoritative server-side checkout association in database
      await admin.from('razorpay_payments').insert({
        workspace_id: auth.workspaceId,
        user_id: auth.user.id,
        order_id: order.id,
        amount: plan.amount,
        currency: 'INR',
        plan_id: plan.id,
        status: 'created',
        method: 'standard',
        notes: {
          ...orderNotes,
          checkout_type: 'order',
          order_id: order.id,
          expected_amount: plan.amount,
          currency: 'INR',
          created_at: new Date().toISOString(),
        },
      });

      return NextResponse.json({
        orderId: order.id,
        customerId,
        customerName,
        customerEmail,
        customerPhone,
        workspaceName,
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

    // 5. Fail closed if Razorpay credentials are missing
    if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DEV_MOCK_GATEWAY !== 'true') {
      return NextResponse.json(
        {
          error: 'Razorpay payment gateway credentials are not configured on this server.',
          code: 'GATEWAY_UNCONFIGURED',
        },
        { status: 503 }
      );
    }

    // Explicit dev-only mock fallback (strictly when ALLOW_DEV_MOCK_GATEWAY === 'true')
    const mockSubId = `sub_test_${receipt}`;
    return NextResponse.json({
      subscriptionId: mockSubId,
      customerId: 'cust_mock_test_123',
      customerName,
      customerEmail,
      customerPhone,
      workspaceName,
      isSubscription: true,
      isAutopay: true,
      amount: plan.amount,
      currency: 'INR',
      planId: plan.id,
      planName: plan.name,
      displayPrice: plan.displayPrice,
      keyId: getRazorpayKeyId(),
      isSandbox: true,
      message: 'Razorpay dev test mode mock order created. Set ALLOW_DEV_MOCK_GATEWAY=false for strict mode.',
    });
  } catch (err: any) {
    console.error('[Razorpay Order] Error creating order/subscription:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to initialize Razorpay payment order.' },
      { status: 500 }
    );
  }
}
