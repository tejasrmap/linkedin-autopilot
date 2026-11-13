// ==============================================================
// LINKEDIN AUTOPILOT - REVERSIBLE BILLING FEATURE FLAG
// CONTROLLED STRIPE SUSPENSION & REACTIVATION
// BY GT INNOX LLP
// ==============================================================

/**
 * Returns whether Stripe billing, checkout, and portal features are enabled.
 * Controlled via the server-side environment flag: BILLING_ENABLED
 *
 * - When BILLING_ENABLED === 'false' -> returns false (Temporarily Disabled)
 * - When BILLING_ENABLED === 'true' (or unset) -> returns true (Enabled)
 *
 * Reversible at any time by updating BILLING_ENABLED in environment.
 */
export function isBillingEnabled(): boolean {
  if (process.env.BILLING_ENABLED === 'false') {
    return false;
  }
  if (process.env.NEXT_PUBLIC_BILLING_ENABLED === 'false') {
    return false;
  }
  return true;
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
