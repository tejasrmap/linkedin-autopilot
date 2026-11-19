// ==============================================================
// LINKEDIN AUTOPILOT - RAZORPAY INR PAYMENTS TEST SUITE
// TESTS PLAN PRICING IN INR, CRYPTOGRAPHIC SIGNATURES & VERIFICATION
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
} from '../src/lib/razorpay/client';

describe('Razorpay INR Payment Gateway Suite', () => {
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
  });

  describe('Cryptographic Signature Verification', () => {
    const testSecret = 'rzp_test_secret_key_12345';
    const originalSecret = process.env.RAZORPAY_KEY_SECRET;

    test.before(() => {
      process.env.RAZORPAY_KEY_SECRET = testSecret;
    });

    test.after(() => {
      process.env.RAZORPAY_KEY_SECRET = originalSecret;
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
      // Razorpay subscription signature standard: payment_id + '|' + subscription_id
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

    test('Authentic webhook signature validates successfully', () => {
      const rawPayload = JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: { id: 'pay_test_001', amount: 199900, currency: 'INR' },
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
  });
});
