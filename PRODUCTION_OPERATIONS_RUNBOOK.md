# PRODUCTION OPERATIONS RUNBOOK — LINKEDIN AUTOPILOT
## GT InnoX LLP | DevSecOps & Site Reliability Guide

**Production URL**: `https://autopilot.gtinnox.in`  
**Database**: Supabase PostgreSQL (`lrctjyjowhtxrydutezk.supabase.co`)  
**Deployment**: Vercel Serverless (Next.js 14)  

---

## 1. Routine Health Monitoring

### Health Endpoint Check
Monitor `GET https://autopilot.gtinnox.in/api/health` every 1–2 minutes:

- **Healthy Status (HTTP 200)**:
  - `database.status === 'healthy'`
  - `linkedin_api.status === 'healthy'`
  - `scheduler_execution.status === 'healthy'` (last execution $<90$s ago)
  - `stuck_scheduled_jobs.status === 'healthy'` (0 stuck jobs $>10$m)
- **Degraded Status (HTTP 200)**:
  - Scheduler heartbeat is older than 90s (scheduler may have paused, but web API remains accessible).
  - Stuck jobs detected.
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
SELECT * FROM public.scheduler_execution_logs ORDER BY created_at DESC LIMIT 10;
```

---

## 3. Emergency Incident Response

### Incident: Scheduler Stops Dispatching
1. Query `cron.job_run_details` to check for PostgreSQL-level execution errors.
2. Verify that `cron_secret` exists in Supabase Vault:
   ```sql
   SELECT name, created_at FROM vault.decrypted_secrets WHERE name = 'cron_secret';
   ```
3. Test manual invocation of the stored procedure:
   ```sql
   SELECT private.invoke_serverless_publish_cron();
   ```
4. Check response status in `public.scheduler_execution_logs`.

### Incident: Post Stuck in "Processing"
If a post is stuck in `status: 'processing'` due to a sudden serverless function crash:
1. The cron endpoint automatically reclaims posts stuck for $>5$ minutes on its next run.
2. To manually reset a stuck post immediately:
   ```sql
   UPDATE public.posts 
   SET status = 'scheduled', updated_at = now() 
   WHERE id = '<POST_ID>' AND status = 'processing';

   UPDATE public.scheduled_jobs 
   SET status = 'scheduled', updated_at = now() 
   WHERE post_id = '<POST_ID>' AND status = 'processing';
   ```
