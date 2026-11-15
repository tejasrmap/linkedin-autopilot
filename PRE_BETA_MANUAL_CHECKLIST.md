# PRE-BETA MANUAL ACTIONS CHECKLIST
**Product:** LinkedIn Autopilot SaaS  
**Company:** GT InnoX LLP  
**Production URL:** https://autopilot.gtinnox.in  
**Auditor:** Senior SaaS Architect & Security Engineer  
**Date:** November 15, 2026  

---

## 1. Database Migrations (Supabase Dashboard)

> [!NOTE]
> **Migration 9 Status:** Verified **ALREADY INSTALLED** in production.
> Live RPC probes confirm that canonical functions `claim_post_for_publishing`, `handle_publishing_failure_and_retry`, and `finalize_post_publishing(target_post_id, expected_claim_token, provider_post_id, raw_response)` are already deployed and operational in production PostgreSQL. **Do not re-execute Migration 9.**

> [!IMPORTANT]
> **Migration 10 Status:** **PENDING MANUAL RUN**.
> Only Migration 10 (`20261115000010_strict_workspace_rls_hardening.sql`) must be applied in the production Supabase SQL Editor by the platform administrator before launching the beta.

- [x] **Step 1.1: Migration 9 (Atomic Claim RPC Consistency)**
  - *Status:* **ALREADY INSTALLED & VERIFIED IN PRODUCTION**.
  - Verified active function signatures:
    - `public.claim_post_for_publishing(target_post_id uuid, new_claim_token uuid, lease_duration_seconds integer)`
    - `public.handle_publishing_failure_and_retry(target_post_id uuid, expected_claim_token uuid, error_message text, max_attempts integer)`
    - `public.finalize_post_publishing(target_post_id uuid, expected_claim_token uuid, provider_post_id text, raw_response jsonb)`
- [ ] **Step 1.2: Apply Migration 10 (Strict Workspace RLS Hardening)**
  - Open Supabase SQL Editor: https://supabase.com/dashboard/project/iqfblmcyqmxoeyfexjkg/sql
  - Follow the instructions in [RLS_HARDENING_DEPLOYMENT_GUIDE.md](file:///c:/Users/tejag/Downloads/GT-Scheduler/RLS_HARDENING_DEPLOYMENT_GUIDE.md).
  - Paste full contents of `supabase/migrations/20261115000010_strict_workspace_rls_hardening.sql`.
  - Click **Run** to execute within the atomic transaction.
  - Run verification queries in Section 4 of the guide to confirm no `USING (true)` policies remain.

---

## 2. Environment Variables & Secret Configuration (Vercel Dashboard)

- [ ] **Step 2.1: TOKEN_ENCRYPTION_KEY**
  - Verify `TOKEN_ENCRYPTION_KEY` is set in Vercel Production Environment Variables.
  - Value must be a cryptographically secure random string of at least 32 characters.
  - Value must **NOT** be `'default-super-secret-key-32-chars!!'`.
  - *Security Invariant:* Existing SHA-256 AES-256-GCM derivation is preserved; no token re-encryption is required.
- [ ] **Step 2.2: CRON_SECRET**
  - Verify `CRON_SECRET` is set in Vercel Production Environment Variables.
  - Verify external cron caller (e.g., cron-job.org or Vercel Cron) passes `Authorization: Bearer <CRON_SECRET>`.
- [ ] **Step 2.3: ADMIN_EMAILS**
  - Verify `ADMIN_EMAILS` is set to authorized administrator email addresses (comma-separated, e.g. `tejag.vijay@gmail.com`).
  - Confirm non-admin users cannot access `/admin` or invoke superadmin endpoints.
- [ ] **Step 2.4: BILLING_ENABLED**
  - Verify `BILLING_ENABLED=false` is set in production.
  - Confirm `/billing` displays free tier features and `/api/billing/checkout` returns HTTP 503.
- [ ] **Step 2.5: NEXT_PUBLIC_APP_URL**
  - Verify `NEXT_PUBLIC_APP_URL=https://autopilot.gtinnox.in`.

---

## 3. LinkedIn App Review & OAuth Configuration

- [ ] **Step 3.1: OAuth Redirect URIs**
  - Verify LinkedIn Developer Portal redirect URI is set to:
    `https://autopilot.gtinnox.in/api/linkedin/callback`
- [ ] **Step 3.2: Member Scope Permissions**
  - Confirm your LinkedIn Developer App has approved access to:
    - `openid`
    - `profile`
    - `email`
    - `w_member_social`
- [ ] **Step 3.3: Legal Pages Accessibility**
  - Verify in an incognito window without logging in:
    - `https://autopilot.gtinnox.in/privacy` opens the Privacy Policy page.
    - `https://autopilot.gtinnox.in/terms` opens the Terms of Service page.

---

## 4. Multi-Tenant Beta Smoke Test

- [ ] **Step 4.1: Beta User Onboarding**
  - Create two independent test accounts (User A and User B) in separate workspaces.
  - Connect personal LinkedIn account for User A.
  - Connect personal LinkedIn account for User B.
  - Verify User A's connected account is not visible to User B in `/accounts`.
- [ ] **Step 4.2: Isolated Publishing**
  - Create and publish a post as User A. Confirm publication succeeds.
  - Verify User B's dashboard does not list User A's post in `/posts` or `/calendar`.
  - Check `/analytics`: confirm User B's impressions count is 0 and does not aggregate User A's post metrics.

---

## 5. Final Beta Launch Verdict

| Gate | Criterion | Status |
| :--- | :--- | :--- |
| **Code Remediations** | All 5 beta-readiness security findings implemented & tested | **PASS** |
| **Live Postgres RLS Tests** | 33/33 tests pass against real PostgreSQL with authenticated sessions | **PASS** |
| **Automated Testing** | 38/38 multi-user tests, 27/27 scheduler tests, 44/44 disablement tests pass | **PASS** |
| **Type Safety & Build** | `tsc --noEmit`, `next lint`, `next build` clean | **PASS** |
| **Migration 9 Status** | Canonical atomic claim RPCs installed and verified | **VERIFIED INSTALLED** |
| **Migration 10 Status** | Strict RLS hardening applied in production Supabase | **PENDING MANUAL RUN** |
| **Overall Verdict** | Release Readiness Gate | **CONDITIONAL — MIGRATION 10 PENDING** |
