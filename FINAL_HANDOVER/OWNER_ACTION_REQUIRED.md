# OWNER ACTION REQUIRED — POST-HARDENING DEPLOYMENT CHECKLIST
## GT InnoX LLP | LinkedIn Autopilot SaaS

**Classification:** CONTROLLED BETA PREPARATION COMPLETE  
**Production Domain:** https://autopilot.gtinnox.in  

---

## 1. ESSENTIAL VERCEL ENVIRONMENT VARIABLES

To complete production activation for the hardened release, verify these environment variables in your **Vercel Project Settings -> Environment Variables**:

1. **`ADMIN_EMAILS` (Mandatory for Platform Administration):**
   * Value: `tejag.vijay@gmail.com,admin@gtinnox.in`
   * *Purpose:* Required by the fail-closed administrator security architecture. Any user not in this list will be treated strictly as a single-workspace member.

2. **Stripe Billing Keys (When Activating Commercial Payments):**
   * `STRIPE_SECRET_KEY`: `sk_live_...` (or `sk_test_...` for test sandbox)
   * `STRIPE_WEBHOOK_SECRET`: `whsec_...`
   * `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: `pk_live_...`
   * *Webhook Endpoint:* `https://autopilot.gtinnox.in/api/billing/webhook` (select `customer.subscription.*` and `invoice.payment_*` events).

---

## 2. SUPABASE DATABASE MIGRATION CHECK

* **Migration file:** `supabase/migrations/20261113000004_stripe_hardening.sql`
* If running a separate production Supabase instance from your local environment, run the SQL in your [Supabase SQL Editor](https://supabase.com/dashboard/project/lrctjyjowhtxrydutezk/sql) to ensure `worker_heartbeats` table exists for live daemon telemetry.

---

## 3. CONTROLLED BETA ONBOARDING

* Follow [FINAL_BETA_ENTRY_CHECKLIST.md](file:///c:/Users/tejag/Downloads/GT-Scheduler/FINAL_HANDOVER/FINAL_BETA_ENTRY_CHECKLIST.md) to invite your first cohort of beta users.
* Users can sign up directly at `https://autopilot.gtinnox.in/register` and connect their LinkedIn personal profile.
