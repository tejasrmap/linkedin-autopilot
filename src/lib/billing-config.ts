// ==============================================================
// LINKEDIN AUTOPILOT - REVERSIBLE BILLING FEATURE FLAG
// RAZORPAY INR PAYMENTS & CONTROLLED ACTIVATION
// BY GT INNOX LLP
// ==============================================================

/**
 * Returns whether billing, checkout, and plan upgrades are enabled.
 * FAIL-SAFE ARCHITECTURE:
 * - Defaults to `true` when Razorpay is active or BILLING_ENABLED is set to true.
 * - Respects explicit 'false' when platform administration pauses billing.
 */
export function isBillingEnabled(): boolean {
  const envVal = process.env.BILLING_ENABLED;
  if (envVal !== undefined && envVal !== null) {
    return envVal.trim().toLowerCase() === 'true';
  }
  // Active by default for Razorpay INR
  return true;
}

/**
 * Returns whether Razorpay INR payments are enabled.
 */
export function isRazorpayEnabled(): boolean {
  return isBillingEnabled();
}

export const BILLING_DISABLED_MESSAGE = 'Billing is temporarily unavailable.';

export const BILLING_DISABLED_RESPONSE = {
  configured: false,
  enabled: false,
  error: BILLING_DISABLED_MESSAGE,
  code: 'BILLING_TEMPORARILY_DISABLED',
  message:
    'All billing, checkout sessions, and portal access are temporarily suspended by platform administration. Existing plan limits, scheduled posts, and workspace capabilities remain fully active.',
};
