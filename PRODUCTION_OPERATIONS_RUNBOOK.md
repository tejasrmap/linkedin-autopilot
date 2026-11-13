# PRODUCTION OPERATIONS RUNBOOK — LINKEDIN AUTOPILOT SAAS
## GT InnoX LLP | DevSecOps & Site Reliability Operations Guide

**Production URL:** `https://autopilot.gtinnox.in`  
**Database:** Supabase Managed PostgreSQL (`lrctjyjowhtxrydutezk.supabase.co`)  
**Deployment Platform:** Vercel Global Edge Network (Next.js 14)  
**Scheduler Topology:** Supabase `pg_cron` (1 min) → `pg_net` → Vercel `/api/cron/publish`  

---

## 1. Routine Health Monitoring

### Health Endpoint Check
Monitor `GET https://autopilot.gtinnox.in/api/health` every 1–2 minutes:

- **Healthy Status (HTTP 200)**:
  - `database.status === 'healthy'`
  - `linkedin_api.status === 'healthy'`
  - `scheduler_execution.status === 'healthy'` (heartbeat $<90$s ago, latest execution status: completed)
  - `stuck_scheduled_jobs.status === 'healthy'` (0 stuck jobs $>10$m)
- **Degraded Status (HTTP 200)**:
  - Scheduler heartbeat is older than 90s, or latest execution status is `failed`. Web API remains accessible.
- **Unhealthy Status (HTTP 503)**:
  - Database connectivity lost.

---

## 2. Supabase pg_cron Inspection & Diagnostics

### View Active Cron Jobs
```sql
SELECT * FROM cron.job WHERE jobname = 'linkedin-autopilot-publish-cron';
```

### View Recent Cron Execution History
```sql
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

### View Application Scheduler Execution Logs
```sql
SELECT * FROM public.scheduler_execution_logs ORDER BY invoked_at DESC LIMIT 10;
```

### Check Active Leases & Processing Posts
```sql
SELECT id, status, claim_token, lease_expires_at, updated_at 
FROM public.posts 
WHERE status = 'processing';
```

---

## 3. Database Migration Deployment Step

When merging `feature/master-beta-hardening`:
1. Open Supabase Dashboard → SQL Editor.
2. Run migration: `supabase/migrations/20261114000007_scheduler_lease_and_atomic_retry.sql`.
3. Verify stored procedures:
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('claim_post_for_publishing', 'handle_publishing_failure_and_retry');
```

---

## 4. Emergency Incident Procedures

### A. Incident: Scheduler Stops Dispatching
1. Query `cron.job_run_details` to check for PostgreSQL-level execution errors.
2. Verify that `vault.decrypted_secrets` contains `cron_secret`.
3. Test manual dispatch via `private.invoke_serverless_publish_cron()`.

### B. Incident: LinkedIn API Down / Rate Limited
1. The serverless scheduler automatically records failures and backs off by $2^n$ minutes (2m, 4m, 8m).
2. After 3 attempts, the post transitions to terminal `failed` status and alerts the user without looping indefinitely.

### C. Incident: Stuck Processing Job
1. The scheduler automatically reclaims posts stuck in `status = 'processing'` where `lease_expires_at < now` or `updated_at < now - 5m`.
2. To manually release a lease:
```sql
UPDATE public.posts 
SET status = 'scheduled', claim_token = NULL, lease_expires_at = NULL, updated_at = NOW() 
WHERE id = '<POST_ID>' AND status = 'processing';
```
