// ==============================================================
// LINKEDIN AUTOPILOT - RAZORPAY INR PAYMENT GATEWAY CLIENT
// AUTHENTIC INR PAYMENTS, SECURE WEBHOOK & SIGNATURE VERIFICATION
// BY GT INNOX LLP
// ==============================================================

import Razorpay from 'razorpay';
import crypto from 'crypto';

export interface RazorpayPlan {
  id: 'pro' | 'agency';
  name: string;
  amount: number; // in paise (e.g. 199900 = ₹1,999 INR)
  currency: 'INR';
  interval: 'monthly' | 'yearly';
  displayPrice: string;
  badge?: string;
  features: string[];
}

export const RAZORPAY_PLANS: Record<'pro' | 'agency', RazorpayPlan> = {
  pro: {
    id: 'pro',
    name: 'Pro Growth',
    amount: 199900, // ₹1,999 INR
    currency: 'INR',
    interval: 'monthly',
    displayPrice: '₹1,999',
    badge: 'Most Popular',
    features: [
      '500 scheduled posts / month',
      '5 LinkedIn accounts (personal profile & company pages)',
      '2,000 AI writing & ideation credits',
      'PDF carousel & document publishing support',
      'Priority scheduling queue with automated retry',
      'Advanced audience engagement analytics',
    ],
  },
  agency: {
    id: 'agency',
    name: 'Agency Enterprise',
    amount: 799900, // ₹7,999 INR
    currency: 'INR',
    interval: 'monthly',
    displayPrice: '₹7,999',
    badge: 'Scale',
    features: [
      '5,000 scheduled posts / month',
      '50 LinkedIn accounts connected simultaneously',
      '10,000 AI writing & strategy credits',
      'Multi-user team workspace with approval roles',
      'Dedicated daemon worker bandwidth & SLAs',
      'Priority 24/7 dedicated engineering support',
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
 * Verifies Razorpay HMAC SHA256 payment signature.
 * Formula: HMAC_SHA256(order_id + "|" + payment_id, secret) == signature
 */
export function verifyPaymentSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;

  try {
    const text = `${params.orderId}|${params.paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(text)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'utf-8'),
      Buffer.from(params.signature, 'utf-8')
    );
  } catch (err) {
    console.error('[Razorpay] Signature verification failed with error:', err);
    return false;
  }
}

/**
 * Verifies Razorpay Webhook HMAC SHA256 signature from X-Razorpay-Signature header.
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'utf-8'),
      Buffer.from(signature, 'utf-8')
    );
  } catch (err) {
    console.error('[Razorpay] Webhook signature verification failed:', err);
    return false;
  }
}
