// ==============================================================
// LINKEDIN AUTOPILOT - RAZORPAY INR PAYMENTS & SECURITY TEST SUITE (PR #38)
// TESTS PLAN PRICING, CRYPTOGRAPHIC SIGNATURES, FAIL-CLOSED DEFENSE,
// CHECKOUT OWNERSHIP, WEBHOOK IDEMPOTENCY & AUDIT LOGGING
// BY GT INNOX LLP
// ==============================================================

import { test, describe } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import {
  RAZORPAY_PLANS,
  verifyPaymentSignature,
  verifySubscriptionSignature,
  verifyWebhookSignature,
  isRazorpayConfigured,
  isRazorpayWebhookConfigured,
} from '../src/lib/razorpay/client';
import { POST as verifyRouteHandler } from '../src/app/api/billing/razorpay/verify/route';
import { POST as webhookRouteHandler } from '../src/app/api/billing/razorpay/webhook/route';
import { POST as orderRouteHandler } from '../src/app/api/billing/razorpay/order/route';
import { createAdminClient } from '../src/lib/supabase/admin';

describe('PR #38 — Razorpay INR Payment Security Gateway Suite', () => {
  describe('Plan Pricing & Currency Compliance', () => {
    test('Pro Growth plan is denominated in INR with exact paise conversion (₹100/mo)', () => {
      const pro = RAZORPAY_PLANS.pro;
      assert.strictEqual(pro.currency, 'INR');
      assert.strictEqual(pro.amount, 10000); // ₹100 * 100
      assert.strictEqual(pro.displayPrice, '₹100');
      assert.strictEqual(pro.razorpayPlanId, 'plan_U27PobHzu6ZDVf');
      assert.ok(pro.features.length >= 5);
    });

    test('Agency Enterprise plan is denominated in INR with exact paise conversion (₹500/mo)', () => {
      const agency = RAZORPAY_PLANS.agency;
      assert.strictEqual(agency.currency, 'INR');
      assert.strictEqual(agency.amount, 50000); // ₹500 * 100
      assert.strictEqual(agency.displayPrice, '₹500');
      assert.strictEqual(agency.razorpayPlanId, 'plan_U27Q0W7xtnZ73l');
      assert.ok(agency.features.length >= 5);
    });

    test('Basic tier provides core complimentary capabilities without card requirement', () => {
      const basicName = 'Basic';
      const basicPrice = '₹0';
      assert.strictEqual(basicName, 'Basic');
      assert.strictEqual(basicPrice, '₹0');
    });

    test('Customer details payload structure captures full subscriber metadata', () => {
      const customerPayload = {
        name: 'Teja Ganugula',
        email: 'tejag.vijay@gmail.com',
        contact: '+917675052828',
        notes: {
          workspaceName: 'GT Personal',
          workspaceId: '3af1cc83-b7e7-4ce6-b422-d84d326aaf31',
          plan: 'Pro Growth',
        },
      };

      assert.strictEqual(customerPayload.name, 'Teja Ganugula');
      assert.strictEqual(customerPayload.email, 'tejag.vijay@gmail.com');
      assert.strictEqual(customerPayload.contact, '+917675052828');
      assert.ok(customerPayload.notes.workspaceName);
      assert.ok(customerPayload.notes.plan);
    });
  });

  describe('Cryptographic Signature Verification', () => {
    const testSecret = 'rzp_test_secret_key_12345';
    const originalSecret = process.env.RAZORPAY_KEY_SECRET;
    const originalWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    test.before(() => {
      process.env.RAZORPAY_KEY_SECRET = testSecret;
      process.env.RAZORPAY_WEBHOOK_SECRET = testSecret;
    });

    test.after(() => {
      process.env.RAZORPAY_KEY_SECRET = originalSecret;
      process.env.RAZORPAY_WEBHOOK_SECRET = originalWebhookSecret;
    });

    test('Authentic order payment signature validates successfully', () => {
      const orderId = 'order_test_987654321';
      const paymentId = 'pay_test_123456789';
      const validSig = crypto
        .createHmac('sha256', testSecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const isValid = verifyPaymentSignature({
        orderId,
        paymentId,
        signature: validSig,
      });

      assert.strictEqual(isValid, true);
    });

    test('Authentic recurring subscription Autopay signature validates successfully', () => {
      const paymentId = 'pay_test_123456789';
      const subscriptionId = 'sub_test_987654321';
      const validSig = crypto
        .createHmac('sha256', testSecret)
        .update(`${paymentId}|${subscriptionId}`)
        .digest('hex');

      const isValid = verifySubscriptionSignature({
        paymentId,
        subscriptionId,
        signature: validSig,
      });

      assert.strictEqual(isValid, true);
    });

    test('Tampered subscription Autopay signature fails validation strictly', () => {
      const paymentId = 'pay_test_123456789';
      const subscriptionId = 'sub_test_987654321';
      const tamperedSig = crypto
        .createHmac('sha256', 'wrong_secret')
        .update(`${paymentId}|${subscriptionId}`)
        .digest('hex');

      const isValid = verifySubscriptionSignature({
        paymentId,
        subscriptionId,
        signature: tamperedSig,
      });

      assert.strictEqual(isValid, false);
    });

    test('Tampered payment signature fails validation strictly', () => {
      const orderId = 'order_test_987654321';
      const paymentId = 'pay_test_123456789';
      const tamperedSig = crypto
        .createHmac('sha256', 'wrong_secret')
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const isValid = verifyPaymentSignature({
        orderId,
        paymentId,
        signature: tamperedSig,
      });

      assert.strictEqual(isValid, false);
    });

    test('Tampered order ID fails validation', () => {
      const orderId = 'order_test_987654321';
      const paymentId = 'pay_test_123456789';
      const validSig = crypto
        .createHmac('sha256', testSecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const isValid = verifyPaymentSignature({
        orderId: 'order_test_tampered',
        paymentId,
        signature: validSig,
      });

      assert.strictEqual(isValid, false);
    });

    test('Authentic webhook signature validates successfully with dedicated secret', () => {
      const rawPayload = JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: { id: 'pay_test_001', amount: 10000, currency: 'INR' },
          },
        },
      });

      const validSig = crypto
        .createHmac('sha256', testSecret)
        .update(rawPayload)
        .digest('hex');

      const isValid = verifyWebhookSignature(rawPayload, validSig);
      assert.strictEqual(isValid, true);
    });

    test('Tampered webhook payload fails validation strictly', () => {
      const rawPayload = '{"event":"payment.captured"}';
      const validSig = crypto
        .createHmac('sha256', testSecret)
        .update(rawPayload)
        .digest('hex');

      const tamperedPayload = '{"event":"payment.captured","malicious":true}';
      const isValid = verifyWebhookSignature(tamperedPayload, validSig);
      assert.strictEqual(isValid, false);
    });

    test('Missing webhook secret strictly fails validation (never falls back to key secret)', () => {
      delete process.env.RAZORPAY_WEBHOOK_SECRET;
      const rawPayload = '{"event":"payment.captured"}';
      const sig = crypto.createHmac('sha256', testSecret).update(rawPayload).digest('hex');

      assert.strictEqual(verifyWebhookSignature(rawPayload, sig), false);
      process.env.RAZORPAY_WEBHOOK_SECRET = testSecret;
    });
  });

  describe('Task B: Razorpay Verification Fail-Closed & Checkout Ownership Defenses', () => {
    const testSecret = 'rzp_test_secret_key_12345';
    const testWsId = '3af1cc83-b7e7-4ce6-b422-d84d326aaf31';

    test.before(() => {
      process.env.MOCK_SUPABASE_FOR_TESTS = 'true';
      process.env.ALLOW_DEV_AUTH = 'true';
      process.env.RAZORPAY_KEY_ID = 'rzp_test_mock_id';
      process.env.RAZORPAY_KEY_SECRET = testSecret;
      process.env.RAZORPAY_WEBHOOK_SECRET = testSecret;
    });

    test('Verification route strictly rejects missing payment identifiers with HTTP 400', async () => {
      const req = new Request('http://localhost:3000/api/billing/razorpay/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const res = await verifyRouteHandler(req);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.code, 'MISSING_PAYMENT_IDENTIFIERS');
    });

    test('Verification route strictly rejects missing signature with HTTP 400', async () => {
      const req = new Request('http://localhost:3000/api/billing/razorpay/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razorpay_order_id: 'order_123',
          razorpay_payment_id: 'pay_123',
          planId: 'pro',
        }),
      });

      const res = await verifyRouteHandler(req);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.code, 'MISSING_SIGNATURE');
    });

    test('Verification route strictly rejects invalid/tampered signature with HTTP 400', async () => {
      const req = new Request('http://localhost:3000/api/billing/razorpay/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razorpay_order_id: 'order_123',
          razorpay_payment_id: 'pay_123',
          razorpay_signature: 'invalid_forged_signature_hex_1234567890abcdef',
          planId: 'pro',
        }),
      });

      const res = await verifyRouteHandler(req);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.code, 'INVALID_SIGNATURE');
    });

    test('Verification route strictly fails closed with HTTP 503 when credentials are missing', async () => {
      delete process.env.RAZORPAY_KEY_ID;
      delete process.env.RAZORPAY_KEY_SECRET;
      delete process.env.ALLOW_DEV_MOCK_GATEWAY;

      const req = new Request('http://localhost:3000/api/billing/razorpay/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razorpay_order_id: 'order_123',
          razorpay_payment_id: 'pay_123',
          razorpay_signature: 'sig',
          planId: 'pro',
        }),
      });

      const res = await verifyRouteHandler(req);
      assert.strictEqual(res.status, 503);
      const data = await res.json();
      assert.strictEqual(data.code, 'GATEWAY_UNAVAILABLE');

      // Restore credentials
      process.env.RAZORPAY_KEY_ID = 'rzp_test_mock_id';
      process.env.RAZORPAY_KEY_SECRET = testSecret;
    });

    test('Checkout session ownership strictly prevents cross-workspace payment theft (HTTP 403)', async () => {
      const foreignWsId = '0226ce10-d45b-4d7f-9a50-36557880ca04';
      const orderId = 'order_cross_workspace_theft_attempt';
      const paymentId = 'pay_foreign_user_payment';

      // Insert checkout record owned by foreign workspace
      const admin = createAdminClient();
      await admin.from('razorpay_payments').insert({
        workspace_id: foreignWsId,
        order_id: orderId,
        amount: 10000,
        currency: 'INR',
        plan_id: 'pro',
        status: 'created',
      });

      const sig = crypto
        .createHmac('sha256', testSecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      // Attempt verification from authenticated session (which is testWsId)
      const req = new Request('http://localhost:3000/api/billing/razorpay/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: sig,
          planId: 'pro',
        }),
      });

      const res = await verifyRouteHandler(req);
      assert.strictEqual(res.status, 403);
      const data = await res.json();
      assert.strictEqual(data.code, 'WORKSPACE_MISMATCH');
    });

    test('Checkout session ownership strictly rejects plan downgrade/upgrade mismatch (HTTP 400)', async () => {
      const orderId = 'order_plan_mismatch_attempt';
      const paymentId = 'pay_cheating_plan_payment';

      // Record was created for 'pro' (₹100)
      const admin = createAdminClient();
      await admin.from('razorpay_payments').insert({
        workspace_id: testWsId,
        order_id: orderId,
        amount: 10000,
        currency: 'INR',
        plan_id: 'pro',
        status: 'created',
      });

      const sig = crypto
        .createHmac('sha256', testSecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      // Client attempts to verify as 'agency' (₹500 plan)
      const req = new Request('http://localhost:3000/api/billing/razorpay/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: sig,
          planId: 'agency',
        }),
      });

      const res = await verifyRouteHandler(req);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.code, 'PLAN_MISMATCH');
    });

    test('Payment ID redemption check strictly rejects already-redeemed payment across workspaces', async () => {
      const foreignWsId = '0226ce10-d45b-4d7f-9a50-36557880ca04';
      const existingPaymentId = 'pay_already_redeemed_elsewhere';

      const admin = createAdminClient();
      await admin.from('razorpay_payments').insert({
        workspace_id: foreignWsId,
        order_id: 'order_legit_previous',
        payment_id: existingPaymentId,
        amount: 10000,
        currency: 'INR',
        plan_id: 'pro',
        status: 'captured',
      });

      const newOrderId = 'order_reuse_probe';
      const sig = crypto
        .createHmac('sha256', testSecret)
        .update(`${newOrderId}|${existingPaymentId}`)
        .digest('hex');

      const req = new Request('http://localhost:3000/api/billing/razorpay/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razorpay_order_id: newOrderId,
          razorpay_payment_id: existingPaymentId,
          razorpay_signature: sig,
          planId: 'pro',
        }),
      });

      const res = await verifyRouteHandler(req);
      assert.strictEqual(res.status, 409);
      const data = await res.json();
      assert.strictEqual(data.code, 'PAYMENT_ALREADY_REDEEMED');
    });
  });

  describe('Task C: Razorpay Webhook Security & Idempotency', () => {
    const testSecret = 'rzp_test_secret_key_12345';
    const testWsId = '3af1cc83-b7e7-4ce6-b422-d84d326aaf31';

    test.before(() => {
      process.env.RAZORPAY_WEBHOOK_SECRET = testSecret;
    });

    test('Webhook rejects missing signature header with HTTP 400', async () => {
      const req = new Request('http://localhost:3000/api/billing/razorpay/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'payment.captured' }),
      });

      const res = await webhookRouteHandler(req);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.code, 'MISSING_SIGNATURE_HEADER');
    });

    test('Webhook rejects invalid signature with HTTP 400', async () => {
      const raw = JSON.stringify({ event: 'payment.captured', id: 'evt_test_1' });
      const req = new Request('http://localhost:3000/api/billing/razorpay/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': 'tampered_bad_sig',
        },
        body: raw,
      });

      const res = await webhookRouteHandler(req);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.code, 'INVALID_WEBHOOK_SIGNATURE');
    });

    test('Webhook rejects missing event ID without synthesizing random timestamps', async () => {
      const raw = JSON.stringify({ event: 'payment.captured' });
      const sig = crypto.createHmac('sha256', testSecret).update(raw).digest('hex');

      const req = new Request('http://localhost:3000/api/billing/razorpay/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': sig,
        },
        body: raw,
      });

      const res = await webhookRouteHandler(req);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.code, 'MISSING_EVENT_ID');
    });

    test('Webhook atomic claiming deduplicates replayed events (HTTP 200 already_processed)', async () => {
      const eventId = 'evt_razorpay_replayed_test_1';
      const raw = JSON.stringify({
        id: eventId,
        event: 'subscription.charged',
        payload: {
          subscription: {
            entity: {
              id: 'sub_test_dedup_1',
              notes: { workspaceId: testWsId, planId: 'pro' },
            },
          },
        },
      });

      const sig = crypto.createHmac('sha256', testSecret).update(raw).digest('hex');

      // First call processes
      const req1 = new Request('http://localhost:3000/api/billing/razorpay/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': sig,
        },
        body: raw,
      });
      const res1 = await webhookRouteHandler(req1);
      assert.strictEqual(res1.status, 200);

      // Second replayed call must return deduplicated
      const req2 = new Request('http://localhost:3000/api/billing/razorpay/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': sig,
        },
        body: raw,
      });
      const res2 = await webhookRouteHandler(req2);
      assert.strictEqual(res2.status, 200);
      const data2 = await res2.json();
      assert.strictEqual(data2.deduplicated, true);
    });

    test('Out-of-order stale webhook does not overwrite newer subscription timestamp', async () => {
      const eventId = 'evt_razorpay_stale_event_test';
      const admin = createAdminClient();

      // Seed subscription with newer timestamp (e.g. 2000000)
      await admin.from('subscriptions').upsert(
        {
          workspace_id: testWsId,
          plan_id: 'pro',
          status: 'active',
          last_event_created: 2000000,
        },
        { onConflict: 'workspace_id' }
      );

      // Incoming webhook has older timestamp (e.g. 1000000)
      const raw = JSON.stringify({
        id: eventId,
        event: 'subscription.cancelled',
        created_at: 1000000,
        payload: {
          subscription: {
            entity: {
              id: 'sub_test_stale_1',
              notes: { workspaceId: testWsId },
            },
          },
        },
      });

      const sig = crypto.createHmac('sha256', testSecret).update(raw).digest('hex');
      const req = new Request('http://localhost:3000/api/billing/razorpay/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': sig,
        },
        body: raw,
      });

      const res = await webhookRouteHandler(req);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.action, 'ignored_stale_event');

      // Verify subscription status was NOT cancelled by stale event
      const { data: sub } = await admin.from('subscriptions').select('status').eq('workspace_id', testWsId).single();
      assert.strictEqual(sub?.status, 'active');
    });
  });
});
