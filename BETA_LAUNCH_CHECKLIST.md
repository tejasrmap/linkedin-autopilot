# LinkedIn Autopilot — Beta Launch Execution Checklist

**Company:** GT InnoX LLP  
**Product:** LinkedIn Autopilot SaaS  
**Document:** `BETA_LAUNCH_CHECKLIST.md`  
**Execution Target:** Controlled External Beta (Cohort 1: 10–25 Users)  

---

## 1. Pre-Launch Mandatory Fixes (Blocking Beta)

Before inviting any external beta users, complete these four mandatory actions:

### Task 1: Allow Public Access to Legal Pages in Middleware (15 Minutes)
- **Problem:** `src/middleware.ts` redirects unauthenticated visitors to `/login`, blocking LinkedIn app review teams and prospective beta users from viewing `/privacy` and `/terms`.
- **Target File:** `src/middleware.ts`
- **Remediation:** Update `isPublicOrApi` or `isAuthPage` check:
  ```ts
  const isPublicPage =
    path === '/' ||
    path.startsWith('/privacy') ||
    path.startsWith('/terms') ||
    path.startsWith('/login') ||
    path.startsWith('/register');
  ```
- **Verification:** Run `curl -I https://autopilot.gtinnox.in/privacy` and confirm HTTP 200 (not HTTP 307).

---

### Task 2: Constrain Post Analytics Overview Query to Caller's Workspace (10 Minutes)
- **Problem:** `src/app/api/analytics/overview/route.ts` queries `post_analytics` across all workspaces without filtering by `workspace_id` or `post_id`.
- **Target File:** `src/app/api/analytics/overview/route.ts`
- **Remediation:** Extract post IDs from `allPosts` and constrain the query:
  ```ts
  const postIds = allPosts.map((p) => p.id);
  let analyticsRows: any[] = [];
  if (postIds.length > 0) {
    const { data } = await admin
      .from('post_analytics')
      .select('metric_name, metric_value')
      .in('post_id', postIds);
    analyticsRows = data || [];
  }
  ```
- **Verification:** Create two test workspaces with analytics rows; verify Workspace A's `/api/analytics/overview` returns only Workspace A's metrics.

---

### Task 3: Fail Closed on Storage Upload Failures (10 Minutes)
- **Problem:** `src/app/api/media/upload/route.ts` catches storage upload failures with a warning and continues to insert a broken database record.
- **Target File:** `src/app/api/media/upload/route.ts`
- **Remediation:** Return HTTP 500 if `uploadErr` is present:
  ```ts
  if (uploadErr) {
    console.error('Storage upload failed:', uploadErr);
    return NextResponse.json({ error: `Failed to upload media to storage: ${uploadErr.message}` }, { status: 500 });
  }
  ```
- **Verification:** Attempt upload with misconfigured bucket; verify request aborts cleanly with descriptive error toast.

---

### Task 4: Execute Migration 9 in Production Supabase SQL Editor (5 Minutes)
- **Problem:** Production Supabase currently has legacy stored procedures; migration `20261115000009_harden_plpgsql_parameters_and_rpc_safety.sql` is pending application.
- **Target File:** `supabase/migrations/20261115000009_harden_plpgsql_parameters_and_rpc_safety.sql`
- **Remediation:** Open Supabase SQL Editor, paste the SQL from migration 9, and click **Run**.
- **Verification:** In SQL Editor, execute:
  ```sql
  SELECT proname, proargnames FROM pg_proc WHERE proname IN ('claim_post_for_publishing', 'finalize_post_publishing', 'handle_publishing_failure_and_retry');
  ```
  Confirm canonical argument names exist.

---

## 2. Beta Environment & Secrets Validation Checklist

Confirm all required production environment variables are configured in the Vercel Production Environment Settings:

- [ ] `NEXT_PUBLIC_SUPABASE_URL`: Points to production Supabase project (`https://lrctjyjowhtxrydutezk.supabase.co`).
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Configured and valid.
- [ ] `SUPABASE_SERVICE_ROLE_KEY`: Service role secret configured (never exposed in client bundle).
- [ ] `LINKEDIN_CLIENT_ID`: Official LinkedIn Developer App Client ID.
- [ ] `LINKEDIN_CLIENT_SECRET`: Official LinkedIn Developer App Client Secret.
- [ ] `TOKEN_ENCRYPTION_KEY`: Strong, unique 64-character hex secret for AES-256-GCM encryption.
- [ ] `CRON_SECRET`: High-entropy random secret matching `pg_cron` / `pg_net` Bearer token header.
- [ ] `BILLING_ENABLED`: Set to `"false"` (Stripe disabled for beta).
- [ ] `GEMINI_API_KEY`: Production Google AI Studio API key for AI Studio generation.
- [ ] `ADMIN_EMAILS`: Authorized GT InnoX superadmin emails (`tejag.vijay@gmail.com`).

---

## 3. Operational Infrastructure & Health Check Verification

Before onboarding beta users, verify the operational telemetry endpoints:

1. **Health Telemetry Endpoint:**
   - Execute: `curl -s https://autopilot.gtinnox.in/api/health | jq .`
   - Verify `api_server: "healthy"`.
   - Verify `database: "healthy"`.
   - Verify `linkedin_api: "healthy"`.
   - Verify `stuck_scheduled_jobs: "healthy"`.
2. **Cron Scheduler Verification:**
   - In Supabase SQL Editor, verify `pg_cron` schedule:
     ```sql
     SELECT jobid, jobname, schedule, command, active FROM cron.job;
     ```
   - Verify job runs every 60 seconds calling `https://autopilot.gtinnox.in/api/cron/publish`.
   - Inspect recent HTTP responses in `net._http_response`:
     ```sql
     SELECT status_code, content FROM net._http_response ORDER BY id DESC LIMIT 5;
     ```
     Confirm `status_code = 200`.

---

## 4. Beta User Onboarding Protocol (Cohort 1)

1. **Cohort Sizing:** Strictly limit Cohort 1 to **10–25 trusted external founders and content creators**.
2. **Invitation Process:**
   - Provide direct registration link: `https://autopilot.gtinnox.in/register`.
   - User registers with email/password; Supabase auto-provisions their personal workspace.
3. **LinkedIn Connection Instructions:**
   - Guide user to `/accounts`.
   - Click **Connect Destination** -> Redirects to official LinkedIn OAuth consent screen.
   - User grants permission -> Redirected back with `active` badge.
4. **Publishing Guidelines for Beta Users:**
   - Recommend testing immediate publishing ("Publish Now") first.
   - Test scheduling a post 10 minutes into the future.
   - Inform users that LinkedIn Company Page / Organization publishing is disabled during Cohort 1 pending partner approval.
5. **Support Channel:**
   - Users submit feedback directly using the in-app **Support Tickets** modal or email `support@gtinnox.com`.

---

## 5. Incident Response & Monitoring Runbook

| Incident | Detection Signal | Immediate Action |
| :--- | :--- | :--- |
| **LinkedIn Token Expiry / Revocation** | `publishResult.error` contains "revoked" or "expired" | System automatically marks account `disconnected` and prompts user in dashboard to reconnect. |
| **Scheduler Stall** | `/api/health` reports `scheduler_execution: "degraded"` | Check `net._http_response` in Supabase; verify `CRON_SECRET` matches. If pg_cron paused, unpause job. |
| **Stuck Processing Post (>10m)** | `/api/health` reports `stuck_scheduled_jobs: "degraded"` | Automated recovery in `/api/cron/publish` reclaims stale posts (>5m) on the next 60s tick. Manual CAS reset available via `/api/admin`. |
| **Ambiguous Network Timeout** | `publishResult.isAmbiguous = true` | Automatic author reconciliation (`reconcileRecentAuthorPost`) inspects recent LinkedIn activity before failing. |

