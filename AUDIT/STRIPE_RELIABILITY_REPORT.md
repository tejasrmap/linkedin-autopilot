# STRIPE RELIABILITY & BILLING AUDIT REPORT
**Company:** GT InnoX LLP  
**Product:** LinkedIn Autopilot SaaS  
**Date:** November 2026  
**Auditor:** Senior Full-Stack & Payment Integration Engineer  

---

## 1. Executive Summary
This document reviews the Stripe subscription lifecycle, webhook idempotency ledger, customer portal integration, and plan enforcement mechanisms for LinkedIn Autopilot.

---

## 2. Implemented Architecture & Reliability Standards

### 2.1 Durable Webhook Event Ledger (`stripe_events`)
- **Table:** `public.stripe_events`
- **Fields:** `event_id` (TEXT UNIQUE), `event_type`, `workspace_id`, `customer_id`, `status` ('processing', 'processed', 'failed'), `error_message`, `created_at`.
- **Deduplication Guarantee:** If Stripe retries an event delivery, the existing `event_id` is queried immediately. If status is `processed`, the endpoint returns `HTTP 200 { received: true, deduplicated: true }`.
- **Auditability:** Any uncaught error during processing updates `status = 'failed'` and stores the exact error message in `error_message`.

### 2.2 Exact Period Derivation vs Arbitrary Timestamps
- **Previous State:** Derived subscription expiration via arbitrary client estimate: `new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)`.
- **Remediated State:** Extracts exact billing timestamps directly from Stripe payload:
  - `current_period_start`: Derived from `subscription.current_period_start` (UNIX seconds).
  - `current_period_end`: Derived from `subscription.current_period_end` (UNIX seconds).
  - On `checkout.session.completed`, retrieves the live subscription object via `stripe.subscriptions.retrieve(subscriptionId)` to populate exact dates.

### 2.3 Out-of-Order Delivery Protection
- If a delayed `customer.subscription.updated` event arrives after a newer subscription state has already been committed, the endpoint checks `newEnd >= existingEnd` before applying updates, preventing backward time regressions.

### 2.4 Stripe Customer Billing Portal (`/api/billing/portal`)
- Enables customers to self-manage payment cards, view invoices, and manage subscription renewals directly on Stripe's hosted portal.
- Accessible via button on `/billing`.

---

## 3. Plan Enforcement Matrix

| Feature / Limit | Free Starter | Pro Growth ($29/mo) | Agency Enterprise ($199/mo) |
|---|---|---|---|
| Connected LinkedIn Accounts | 1 Account | Up to 5 Accounts | Up to 50 Accounts |
| Monthly Scheduled Posts | 15 Posts | 500 Posts | 5,000 Posts |
| AI Studio Credits | 50 Credits | 2,000 Credits | 10,000 Credits |
| Video & Carousel Uploads | Disabled | Enabled | Enabled |
| Team Roles & Multi-tenant Workspaces | 1 Workspace | 3 Workspaces | 50 Workspaces |
| Queue Priority | Standard | Priority Worker | Dedicated SLA |

