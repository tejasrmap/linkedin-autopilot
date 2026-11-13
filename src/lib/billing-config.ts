// ==============================================================
// LINKEDIN AUTOPILOT - REVERSIBLE BILLING FEATURE FLAG
// FAIL-SAFE STRIPE SUSPENSION & CONTROLLED REACTIVATION
// BY GT INNOX LLP
// ==============================================================

/**
 * Returns whether Stripe billing, checkout, and portal features are enabled.
 * FAIL-SAFE ARCHITECTURE:
 * - Defaults to `false` when BILLING_ENABLED is unset, empty, or undefined.
 * - Only an explicit 'true' value enables billing.
 * - Authoritative server-side evaluation: Never relies on NEXT_PUBLIC_ flags
 *   for server-side security decisions.
 */
export function isBillingEnabled(): boolean {
  const envVal = process.env.BILLING_ENABLED;
  if (!envVal) {
    return false; // Fail-safe default
  }
  return envVal.trim().toLowerCase() === 'true';
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
