# WORKER RELIABILITY REPORT
**Company:** GT InnoX LLP  
**Product:** LinkedIn Autopilot SaaS  
**Process:** `src/worker/index.ts`  
**Date:** November 2026  

---

## 1. Dual-Engine Deployment Model

The LinkedIn Autopilot background worker operates on a zero-single-point-of-failure dual-engine model:

1. **Primary Queue (BullMQ + Redis):**
   - Active when `REDIS_URL` is configured.
   - Concurrency: 5 simultaneous workers.
   - Job lifecycle events: `ready`, `completed`, `failed`.
   - Exponential backoff retry strategy: Attempt 1 = 5s, Attempt 2 = 10s, Attempt 3 = 20s.

2. **Persistent Database Poller (Self-Healing Fallback):**
   - Automatically active in `src/worker/index.ts` regardless of Redis state.
   - Polls `public.scheduled_jobs` every 5 seconds for `scheduled_at <= NOW()` and `status = 'scheduled'`.
   - Guarantees zero missed publishing events during Redis maintenance or container restarts.

3. **Serverless Cron Backup (Vercel Cron):**
   - Vercel Cron executes `/api/cron/publish` every 1 minute as an external failover.

---

## 2. Graceful Shutdown & Recovery Procedures

- **Signals Handled:** `SIGINT`, `SIGTERM`.
- **Shutdown Protocol:**
  - Clears `pollInterval`.
  - Closes BullMQ worker waiting for currently running publishing jobs to finish.
  - Disconnects Redis connection cleanly.
- **Overdue Recovery on Startup:** Immediately queries `checkDueScheduledJobs()` upon initialization to catch up on any jobs that matured during a process restart.

