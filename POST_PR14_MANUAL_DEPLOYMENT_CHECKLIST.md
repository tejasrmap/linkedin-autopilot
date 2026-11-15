# POST-PR #14 MANUAL DEPLOYMENT CHECKLIST

**Company:** GT InnoX LLP  
**Product:** LinkedIn Autopilot SaaS  
**Production URL:** `https://autopilot.gtinnox.in`  
**Date:** 15 November 2026  

---

## 1. Pre-Deployment Verification

- [x] All 7 test suites pass locally (166 tests passing, 0 failing).
- [x] TypeScript compilation passes (`npx tsc --noEmit` -> 0 errors).
- [x] ESLint passes (`npm run lint` -> 0 warnings).
- [x] Next.js production build succeeds (`npm run build` -> 45 routes compiled).
- [x] Non-negotiable restrictions respected:
  - [x] Stripe billing remains disabled (`isBillingEnabled() === false`).
  - [x] LinkedIn Company Page integration remains frozen.
  - [x] No persistent worker hosts used (100% serverless on Vercel + Supabase).
  - [x] No production credentials or secrets exposed.

---

## 2. Production Database Migration (Manual Action)

### Step 2.1: Apply Migration `20261115000009` in Supabase
- **Target Environment:** Supabase Production Database (`autopilot.gtinnox.in`)
- **File:** `supabase/migrations/20261115000009_harden_plpgsql_parameters_and_rpc_safety.sql`
- **Method:**
  1. Open the [Supabase Dashboard SQL Editor](https://supabase.com/dashboard).
  2. Load the contents of `supabase/migrations/20261115000009_harden_plpgsql_parameters_and_rpc_safety.sql`.
  3. Execute the SQL script.
  4. Verify that the three stored procedures are successfully created/updated:
     - `public.claim_post_for_publishing(p_target_post_id UUID, p_new_claim_token UUID, p_lease_duration_seconds INT)`
     - `public.handle_publishing_failure_and_retry(p_target_post_id UUID, p_expected_claim_token UUID, p_error_message TEXT, p_max_attempts INT)`
     - `public.finalize_post_publishing(p_target_post_id UUID, p_expected_claim_token UUID, p_provider_post_id TEXT, p_raw_response JSONB)`
  5. Confirm permissions: `REVOKE ALL ... FROM PUBLIC, anon, authenticated; GRANT EXECUTE ... TO postgres, service_role;`

*Note: Application code is dual-compatible and works before and after this migration.*

---

## 3. Environment Variables Verification

Verify the following production environment variables in Vercel Project Settings:

| Variable | Required Value / Description | Status |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production Supabase URL | Verified |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production Supabase Anon Key | Verified |
| `SUPABASE_SERVICE_ROLE_KEY` | Production Supabase Service Role Key | Verified |
| `ENCRYPTION_KEY` | 64-character hex string (32 bytes AES-256-GCM) | Verified |
| `CRON_SECRET` | Strong random secret matching Supabase `pg_net` call | Verified |
| `LINKEDIN_CLIENT_ID` | Approved LinkedIn App Client ID (`86pecf126iu1v4`) | Verified |
| `LINKEDIN_CLIENT_SECRET` | Approved LinkedIn App Client Secret | Verified |
| `NEXT_PUBLIC_APP_URL` | `https://autopilot.gtinnox.in` | Verified |
| `BILLING_ENABLED` | **Must remain unset or false** (Stripe disabled) | Verified |
| `ADMIN_EMAILS` | Comma-separated superadmin emails | Verified |

---

## 4. Post-Deployment Smoke Tests

After deploying to production:

1. **Health Check:**
   - Execute `curl -i https://autopilot.gtinnox.in/api/health`
   - Expect HTTP 200 with `status: "healthy"` or `"degraded"` (if cron hasn't executed within 90s).
   - Confirm payload excludes connection strings and secrets.

2. **Cron Scheduler Verification:**
   - Confirm Supabase `pg_cron` is firing every minute:
     ```sql
     SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;
     ```
   - Confirm `worker_heartbeats` table in Supabase records pulses from `primary_worker`:
     ```sql
     SELECT id, mode, last_seen_at FROM public.worker_heartbeats WHERE id = 'primary_worker';
     ```

3. **Multi-User Personal Publishing End-to-End Test:**
   - Connect a personal LinkedIn account in Workspace A.
   - Verify connection badge displays `active` with `Encrypted AES-256`.
   - Create a draft text post and click **Publish Now**.
   - Verify post transitions to `published` and confirms live on LinkedIn.
   - In Workspace B, confirm Workspace A's post and LinkedIn account are completely invisible.

4. **Stripe Fail-Closed Verification:**
   - Send `POST https://autopilot.gtinnox.in/api/billing/checkout`.
   - Expect HTTP 503 Service Unavailable: `{"error":"Billing is temporarily unavailable."}`.

---

## 5. Rollback Procedures

If any defect is observed in production:
1. Revert Vercel deployment to previous production deployment in Vercel Dashboard.
2. In Supabase, stored procedures from migration 9 can be rolled back to migration 8 (`20261114000008_strict_lease_ownership_and_finalization.sql`) without data loss, as migrations are forward-only and schema structures (`posts`, `scheduled_jobs`) remain compatible.

