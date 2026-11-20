// ==============================================================
// LINKEDIN AUTOPILOT - RAZORPAY INR PAYMENT GATEWAY CLIENT
// AUTHENTIC INR PAYMENTS, AUTOPAY E-MANDATES & WEBHOOK SIGNATURES
// BY GT INNOX LLP
// ==============================================================

import Razorpay from 'razorpay';
import crypto from 'crypto';

export interface RazorpayPlan {
  id: 'pro' | 'agency';
  name: string;
  amount: number; // in paise (e.g. 10000 = ₹100 INR)
  currency: 'INR';
  interval: 'monthly' | 'yearly';
  displayPrice: string;
  razorpayPlanId?: string;
  badge?: string;
  features: string[];
}

export const RAZORPAY_PLANS: Record<'pro' | 'agency', RazorpayPlan> = {
  pro: {
    id: 'pro',
    name: 'Pro Growth',
    amount: 10000, // ₹100 INR
    currency: 'INR',
    interval: 'monthly',
    displayPrice: '₹100',
    razorpayPlanId: 'plan_U27PobHzu6ZDVf',
    badge: 'Most Popular',
    features: [
      '500 scheduled posts / month',
      '5 LinkedIn accounts (personal profile & company pages)',
      '2,000 AI writing & ideation credits',
      'PDF carousel & document publishing support',
      'Priority scheduling queue with automated retry',
      'Advanced audience engagement analytics',
      'UPI Autopay & Card recurring debit support',
    ],
  },
  agency: {
    id: 'agency',
    name: 'Agency Enterprise',
    amount: 50000, // ₹500 INR
    currency: 'INR',
    interval: 'monthly',
    displayPrice: '₹500',
    razorpayPlanId: 'plan_U27Q0W7xtnZ73l',
    badge: 'Scale',
    features: [
      '5,000 scheduled posts / month',
      '50 LinkedIn accounts connected simultaneously',
      '10,000 AI writing & strategy credits',
      'Multi-user team workspace with approval roles',
      'Dedicated daemon worker bandwidth & SLAs',
      'Priority 24/7 dedicated engineering support',
      'UPI Autopay & Card recurring debit support',
    ],
  },
};

/**
 * Returns whether Razorpay keys are configured.
 */
export function isRazorpayConfigured(): boolean {
  const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  return Boolean(
    keyId &&
    keySecret &&
    !keyId.includes('placeholder') &&
    !keySecret.includes('placeholder')
  );
}

/**
 * Returns public Razorpay key ID for client-side checkout popup.
 */
export function getRazorpayKeyId(): string {
  return (
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
    process.env.RAZORPAY_KEY_ID ||
    'rzp_test_placeholder'
  );
}

/**
 * Returns whether Razorpay webhook signing secret is configured.
 */
export function isRazorpayWebhookConfigured(): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  return Boolean(secret && !secret.includes('placeholder'));
}

/**
 * Returns whether Razorpay keys belong to the test/sandbox environment.
 */
export function isTestModeRazorpay(): boolean {
  const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '';
  return keyId.startsWith('rzp_test_');
}

/**
 * Initializes and returns the official Razorpay SDK instance.
 */
export function getRazorpayClient(): Razorpay | null {
  const keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return null;
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
}

/**
 * Verifies Razorpay HMAC SHA256 payment signature for standard one-time orders.
 * Formula: HMAC_SHA256(order_id + "|" + payment_id, secret) == signature
 */
export function verifyPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret || !params.orderId || !params.paymentId || !params.signature) {
    return false;
  }

  try {
    const text = `${params.orderId}|${params.paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(text)
      .digest('hex');

    const expBuf = Buffer.from(expectedSignature, 'utf-8');
    const sigBuf = Buffer.from(params.signature, 'utf-8');

    if (expBuf.length !== sigBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(expBuf, sigBuf);
  } catch (err) {
    console.error('[Razorpay] Order signature verification failed:', err);
    return false;
  }
}

/**
 * Verifies Razorpay HMAC SHA256 signature for Subscriptions (Autopay / e-mandate).
 * Formula: HMAC_SHA256(payment_id + "|" + subscription_id, secret) == signature
 */
export function verifySubscriptionSignature(params: {
  paymentId: string;
  subscriptionId: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret || !params.paymentId || !params.subscriptionId || !params.signature) {
    return false;
  }

  try {
    const text = `${params.paymentId}|${params.subscriptionId}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(text)
      .digest('hex');

    const expBuf = Buffer.from(expectedSignature, 'utf-8');
    const sigBuf = Buffer.from(params.signature, 'utf-8');

    if (expBuf.length !== sigBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(expBuf, sigBuf);
  } catch (err) {
    console.error('[Razorpay] Subscription Autopay signature verification failed:', err);
    return false;
  }
}

/**
 * Verifies Razorpay Webhook HMAC SHA256 signature from X-Razorpay-Signature header.
 * REQUIREMENT: Strictly requires RAZORPAY_WEBHOOK_SECRET and never falls back to API key secret.
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !rawBody || !signature) {
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const expBuf = Buffer.from(expectedSignature, 'utf-8');
    const sigBuf = Buffer.from(signature, 'utf-8');

    if (expBuf.length !== sigBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(expBuf, sigBuf);
  } catch (err) {
    console.error('[Razorpay] Webhook signature verification failed:', err);
    return false;
  }
}
