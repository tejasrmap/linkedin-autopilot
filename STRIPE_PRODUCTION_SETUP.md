# STRIPE PRODUCTION SETUP GUIDE
**Product:** LinkedIn Autopilot SaaS  
**Company:** GT InnoX LLP  
**Date:** November 2026  
**Status:** Verification Ready / Integration Active  

---

## 1. Overview
LinkedIn Autopilot implements an enterprise-grade subscription and billing engine integrated with Stripe Checkout and Webhooks. This architecture strictly adheres to the principle of zero payment simulation: live or sandbox cards are processed exclusively through official Stripe-hosted sessions and cryptographically verified webhooks.

---

## 2. Environment Variables Required

Configure these keys in your hosting environment (Vercel Project Settings > Environment Variables):

| Key | Example / Description | Environment |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_...` or `sk_test_...` (Restricted API Key) | Server-only (Secret) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` (Signing secret from Stripe Dashboard) | Server-only (Secret) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_...` or `pk_test_...` | Browser & Server (Public) |

---

## 3. Stripe Dashboard Setup Step-by-Step

### 3.1 Create Products and Pricing in Stripe
1. Log into your [Stripe Dashboard](https://dashboard.stripe.com/).
2. Navigate to **Product Catalog** > **Add Product**:
   - **Product 1:**
     - Name: `LinkedIn Autopilot Pro Growth`
     - Price: `$29.00 USD`
     - Billing: `Recurring (Monthly)`
   - **Product 2:**
     - Name: `LinkedIn Autopilot Agency Enterprise`
     - Price: `$199.00 USD`
     - Billing: `Recurring (Monthly)`

### 3.2 Configure the Webhook Endpoint
1. Go to **Developers** > **Webhooks** > **Add Destination / Endpoint**.
2. **Endpoint URL:** `https://autopilot.gtinnox.in/api/billing/webhook`
3. **Select Events to Listen for:**
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
4. Click **Add Endpoint**.
5. Reveal the **Signing Secret** (`whsec_...`) and paste it as `STRIPE_WEBHOOK_SECRET` in your Vercel deployment settings.

---

## 4. Architectural Verification

### 4.1 Checkout Flow (`/api/billing/checkout`)
- User selects a tier (`pro` or `agency`) on `/billing`.
- Server creates a Stripe Checkout Session with `mode: 'subscription'`.
- Client is redirected to Stripe's secure HTTPS checkout page.
- On success: Redirects to `https://autopilot.gtinnox.in/billing?session_id=...&success=true`.
- On cancel: Redirects to `https://autopilot.gtinnox.in/billing?canceled=true`.

### 4.2 Webhook Flow (`/api/billing/webhook`)
- Stripe issues an HTTP POST payload with header `stripe-signature`.
- The webhook endpoint validates the cryptographic signature using `stripe.webhooks.constructEvent(body, signature, webhookSecret)`.
- On `checkout.session.completed`, the handler automatically upserts the record into the PostgreSQL `subscriptions` table:
  ```sql
  INSERT INTO public.subscriptions (workspace_id, plan_id, provider_subscription_id, status, current_period_end)
  VALUES (..., 'pro', 'sub_...', 'active', NOW() + INTERVAL '30 days')
  ON CONFLICT (workspace_id) DO UPDATE ...;
  ```
- On `customer.subscription.deleted`, the workspace plan automatically reverts to `free`.

---

## 5. Local Testing via Stripe CLI

To test webhooks locally during development:
```bash
# 1. Install & Login
stripe login

# 2. Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/billing/webhook

# 3. Trigger a test event
stripe trigger checkout.session.completed
```
