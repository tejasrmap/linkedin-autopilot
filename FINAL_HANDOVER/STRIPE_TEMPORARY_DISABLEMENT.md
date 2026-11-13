# TEMPORARY STRIPE BILLING DISABLEMENT — LINKEDIN AUTOPILOT
## GT InnoX LLP | Reversible Application-Wide Billing Suspension

**Target Branch:** `feature/harden-stripe-disablement`  
**Classification:** REVERSIBLE SUSPENSION & FAIL-SAFE HARDENED  
**Status:** FULLY IMPLEMENTED & VERIFIED (112 Passing Tests)  
**Date:** November 13, 2026  

---

## 1. OBJECTIVE & FAIL-SAFE ARCHITECTURE

All Stripe payment, checkout session creation, customer portal generation, and automatic subscription state mutations are temporarily suspended across the LinkedIn Autopilot application.

### Key Guarantees
* **Fail-Safe Default:** `BILLING_ENABLED` strictly defaults to `false` when unset, empty, or undefined. Only an explicit `'true'` string enables billing.
* **Server-Side Authority:** Server security decisions strictly evaluate `process.env.BILLING_ENABLED` and never rely on client-side `NEXT_PUBLIC_` flags.
* **Distinct Unapplied Status:** Verified events arriving while billing is disabled are recorded as `ignored_billing_disabled` in `public.stripe_events`. They are **never** labeled `processed`.
* **Zero Blind Replays:** When reactivating, a dedicated reconciliation workflow queries Stripe's live API directly to synchronize current state rather than blindly replaying stale ledger events.
* **Zero Data Loss:** All existing Stripe integrations, database schemas (`public.subscriptions`, `public.stripe_events`), customer IDs, and audit records remain 100% intact.
* **Customer Preservation:** Existing paid subscribers retain their full entitlements, posting quotas, and workspace capabilities. No customer is locked out.
* **Cryptographic Signature Enforcement:** Webhook signatures continue to be strictly verified using HMAC-SHA256 before any disablement checks. Invalid or missing signatures return HTTP 400.

---

## 2. SUBSYSTEM ARCHITECTURE FLOW

```mermaid
flowchart TD
    subgraph Client UI (/billing)
        User[User Visits /billing] --> CheckFlag{billingEnabled == false?}
        CheckFlag -->|Yes| ShowBanner[Show Amber Suspension Banner]
        ShowBanner --> DisableButtons[Disable Upgrade & Portal Buttons]
        DisableButtons --> SetLabel[Label: 'Billing temporarily unavailable']
    end

    subgraph API Routes (Fast-Path Rejection)
        CheckoutReq[POST /api/billing/checkout] --> ChkBlock[Reject with HTTP 503: 'Billing is temporarily unavailable.']
        PortalReq[POST /api/billing/portal] --> PortBlock[Reject with HTTP 503: 'Billing portal is temporarily unavailable.']
    end

    subgraph Webhook Flow (Real Handler Protection)
        StripeWebhook[Incoming Stripe Webhook] --> VerifySig{Verify Stripe Signature}
        VerifySig -->|Invalid Signature| HTTP400[400 Bad Signature - NEVER Acknowledged]
        VerifySig -->|Valid Signature| CheckDisabled{BILLING_ENABLED == true?}
        CheckDisabled -->|No / Default| CheckDuplicate{Event ID in stripe_events?}
        CheckDuplicate -->|Yes| Deduplicated[Return 200: deduplicated=true]
        CheckDuplicate -->|No| RecordIgnored[Insert status='ignored_billing_disabled']
        RecordIgnored --> SkipMutation[Bypass Subscription Table Mutations]
        SkipMutation --> HTTP200[Return 200 OK: Event Acknowledged Without Mutation]
    end

    subgraph Pre-Reactivation Reconciliation
        AdminTrigger[Admin Calls POST /api/billing/reconcile] --> FetchStripe[Fetch Authoritative Subscription from Stripe API]
        FetchStripe --> UpdateSub[Update subscriptions table with live timestamps]
        UpdateSub --> ReadyReactivate[Safe to set BILLING_ENABLED=true]
    end
```

---

## 3. IMPLEMENTATION DETAILS BY MODULE

### 3.1 Centralized Flag Helper (`src/lib/billing-config.ts`)
* `isBillingEnabled()` strictly evaluates `process.env.BILLING_ENABLED?.trim().toLowerCase() === 'true'`.
* Defaults to `false` when unset, null, empty, or any other value.
* Server-side routes are completely insulated from client-side spoofing.

### 3.2 Real Checkout Endpoint (`src/app/api/billing/checkout/route.ts`)
* Immediately checks `!isBillingEnabled()` at the start of the handler.
* Returns **HTTP 503** with payload:
  ```json
  {
    "configured": false,
    "enabled": false,
    "error": "Billing is temporarily unavailable.",
    "message": "Billing is temporarily unavailable."
  }
  ```
* Stripe checkout session creation is completely bypassed.

### 3.3 Customer Billing Portal (`src/app/api/billing/portal/route.ts`)
* Immediately checks `!isBillingEnabled()`.
* Returns **HTTP 503** with payload:
  ```json
  {
    "configured": false,
    "enabled": false,
    "error": "Billing is temporarily unavailable.",
    "message": "Billing portal is temporarily unavailable."
  }
  ```
* Portal session generation is completely bypassed.

### 3.4 Webhook Listener (`src/app/api/billing/webhook/route.ts`)
* **Signature Verification First:** Webhooks are verified against `STRIPE_WEBHOOK_SECRET` before any disablement checks. Tampered or unsigned requests are rejected with **HTTP 400**.
* **Audit Trail Logging:** Legitimate verified events are saved to `public.stripe_events` with status `'ignored_billing_disabled'` (never `'processed'`) and payload metadata `{ billing_disabled: true, action: 'ignored_unapplied' }`.
* **Idempotent Deduplication:** If duplicate deliveries of an ignored event arrive, the route detects the existing record and returns `{ received: true, deduplicated: true }`.
* **Zero Subscription Mutations:** The `switch(event.type)` state machine is bypassed, preventing unintended activation, cancellation, or downgrade of existing customer records.

### 3.5 Authoritative Pre-Reactivation Reconciliation (`src/lib/billing-reconcile.ts` & `src/app/api/billing/reconcile/route.ts`)
* Provides `reconcileWorkspaceSubscription(workspaceId)`.
* Directly queries `stripe.subscriptions.list({ customer: customerId })`.
* Synchronizes authoritative `current_period_start`, `current_period_end`, `status`, and `tier` to the database.
* Zero blind event replays.

---

## 4. TEST VERIFICATION MATRIX

Dedicated automated suite: `tests/stripe-disablement.test.ts` (`npm run test:disablement`):

| Test Case | Method | Expected Output | Status |
| :--- | :--- | :--- | :--- |
| **Fail-Safe Default** | `delete process.env.BILLING_ENABLED` | `isBillingEnabled() === false` | **PASS** |
| **Client Spoof Immunity** | `BILLING_ENABLED=false` + `NEXT_PUBLIC_BILLING_ENABLED=true` | Server evaluates `false` | **PASS** |
| **Real Checkout Route** | `checkoutRouteHandler(new NextRequest(...))` | HTTP 503 `"Billing is temporarily unavailable."` | **PASS** |
| **Real Portal Route** | `portalRouteHandler(new NextRequest(...))` | HTTP 503 `"Billing is temporarily unavailable."` | **PASS** |
| **Missing Signature** | `webhookRouteHandler(reqWithoutSig)` | HTTP 400 `"Missing stripe-signature header"` | **PASS** |
| **Tampered Signature** | `webhookRouteHandler(reqWithBadSig)` | HTTP 400 signature error | **PASS** |
| **Authentic Webhook** | `webhookRouteHandler(reqWithHmacSha256)` | HTTP 200, status `'ignored_billing_disabled'` | **PASS** |
| **Duplicate Delivery** | Send identical webhook twice | HTTP 200, `deduplicated: true` | **PASS** |
| **Ledger Error Resilience** | Simulated DB lock/failure | Handled gracefully, never marked `processed` | **PASS** |
| **Reconciliation Sync** | Direct Stripe query test | Authoritative period extracted, 0 events replayed | **PASS** |
| **Customer Retention** | Pro/Agency tenant verification | Quotas (500 / 5,000) active without lockout | **PASS** |
| **Reactivation** | Set `BILLING_ENABLED=true` | Immediately restores billing flag | **PASS** |

### Complete Regression Suite Results
* `npm run test` (Core Crypto): 15 Passed
* `npm run test:dual` (Personal Profile Publishing): 21 Passed
* `npm run test:phase6` (Rate Limiting & RBAC): 15 Passed
* `npm run test:phase10` (Gap Closure): 25 Passed
* `npm run test:hardening` (Admin Security & CAS): 13 Passed
* `npm run test:disablement` (Real Route Integration): 23 Passed
* **Grand Total:** **112 Passed, 0 Failed, 0 Blocked.**

---

## 5. REACTIVATION PROCEDURE

When GT InnoX LLP is ready to resume commercial transactions:

1. **Perform Authoritative Pre-Reactivation Reconciliation:**
   * Run the reconciliation workflow to pull current live subscription states from Stripe:
     ```bash
     curl -X POST https://autopilot.gtinnox.in/api/billing/reconcile \
       -H "Content-Type: application/json" \
       -H "Cookie: <platform-admin-session-cookie>" \
       -d '{"reconcileAll": true}'
     ```
   * This ensures all customer tiers and renewal dates are 100% synchronized with Stripe before any new events are received.

2. **Update Vercel Environment Variables:**
   * Set `BILLING_ENABLED=true`
   * Set `NEXT_PUBLIC_BILLING_ENABLED=true`
   * Ensure `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` are configured with your live keys.

3. **Deploy / Promote Branch:**
   * Merge `feature/harden-stripe-disablement` into `main`.
   * Vercel will immediately re-enable live Stripe checkout sessions, customer portal access, and automatic webhook subscription updates.
