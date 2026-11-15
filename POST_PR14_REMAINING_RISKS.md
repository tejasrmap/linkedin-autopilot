# POST-PR #14 REMAINING RISKS & ARCHITECTURAL ASSESSMENT

**Company:** GT InnoX LLP  
**Product:** LinkedIn Autopilot SaaS  
**Repository:** `https://github.com/tejasrmap/linkedin-autopilot`  
**Base Commit:** `95d0382a34e79d5b7bfc3dc8b75a18ddbd4ae71b`  
**Branch:** `audit/post-pr14-production-readiness`  
**Date:** 15 November 2026  

---

## 1. Overview of Remaining Risks

While application-level security, tenant isolation, and scheduler concurrency are now fully hardened, several architectural, third-party, and database configuration risks remain for production release.

---

## 2. Risk Matrix

| Risk ID | Category | Severity | Description | Mitigation Status | Action Needed |
|---|---|---|---|---|---|
| **R-01** | Database Migration | Medium | Migration `20261115000009` is unapplied in production | Dual-compatibility maintained in code | Apply migration in Supabase SQL Editor |
| **R-02** | Database Security | High | RLS policies on `posts`, `social_accounts` allow all (`true`) | Server routes enforce strict workspace checks | Create forward-only RLS migration before public beta |
| **R-03** | Third-Party API | High | LinkedIn Company Page API product pending approval | Company Page publishing frozen | Await LinkedIn Developer verification |
| **R-04** | Billing / Subscriptions | Low | Stripe billing disabled (`isBillingEnabled() === false`) | Fail-closed HTTP 503 on checkout/portal | Enable billing only when ready for paid plans |
| **R-05** | Infrastructure | Low | Vercel serverless execution timeout (60s `maxDuration`) | Serverless cron processes batches under 60s | Keep batch limit at 20 posts per invocation |
| **R-06** | Network / Ambiguity | Low | Ambiguous timeout during LinkedIn post transmission | Automated reconciliation strategy implemented | Monitor author reconciliation logs |

---

## 3. Deep-Dive on Specific Risks

### R-01: Unapplied Production Migration `20261115000009`
- **Current State:** The production database currently runs migration `20261114000008`. Migration `20261115000009_harden_plpgsql_parameters_and_rpc_safety.sql` has not been executed in the production Supabase instance.
- **Risk Evaluation:**
  - If the application code had passed only `p_` parameter names, PostgREST would return `PGRST202` on production.
  - To prevent downtime, the application code in `src/lib/queue/publisher.ts` passes dual parameter keys (`p_target_post_id` and `target_post_id`, etc.).
  - Therefore, the application functions identically whether migration 9 is applied or pending.
- **Recommendation:** Apply migration 9 in Supabase SQL Editor during a scheduled maintenance window.

---

### R-02: Permissive Database-Level RLS Policies
- **Current State:** Migration `20261113000001_fix_dev_and_service_rls.sql` introduced `CREATE POLICY "Allow all on posts" ON public.posts FOR ALL USING (true) WITH CHECK (true)` and similar policies on `social_accounts`, `notifications`, and `scheduled_jobs`.
- **Risk Evaluation:**
  - The Next.js web application interacts with Supabase almost exclusively via server-side route handlers using the service-role client (`createAdminClient()`), which bypasses RLS.
  - Following the fixes in PR #14 and this audit, all route handlers (`/api/posts`, `/api/posts/[id]`, `/api/posts/[id]/publish`, `/api/posts/[id]/schedule`, `/api/posts/[id]/cancel`, `/api/posts/bulk`, `/api/linkedin/accounts`, `/api/linkedin/disconnect`) strictly validate workspace ownership and user role.
  - However, if a client attempts to query Supabase directly using `NEXT_PUBLIC_SUPABASE_ANON_KEY`, PostgreSQL will not enforce workspace boundaries at the row level.
- **Recommendation:** Prepare a forward-only migration to re-enable strict RLS policies using `public.is_workspace_member(workspace_id)` before general availability.

---

### R-03: LinkedIn Company Page Integration Freeze
- **Current State:** Publishing to LinkedIn Company Pages requires the **Community Management API** product on LinkedIn Developer App `86pecf126iu1v4`.
- **Risk Evaluation:**
  - Organization accounts cannot publish until LinkedIn approves the product access.
  - The application correctly isolates personal member publishing (`w_member_social`, author URN `urn:li:person:<id>`) from organization publishing (`w_organization_social`, author URN `urn:li:organization:<id>`).
- **Recommendation:** Maintain the freeze on Company Page publishing until LinkedIn developer approval is granted.

---

### R-04: Stripe Disablement
- **Current State:** `BILLING_ENABLED` is unset or false. `isBillingEnabled()` returns `false`.
- **Risk Evaluation:**
  - All billing routes (`/api/billing/checkout`, `/api/billing/portal`) return HTTP 503 fail-closed responses.
  - Webhooks verify signatures and record unapplied events as `ignored_billing_disabled`.
  - All users default to the "free" tier with starter limits.
- **Recommendation:** Keep Stripe billing disabled until launch.
