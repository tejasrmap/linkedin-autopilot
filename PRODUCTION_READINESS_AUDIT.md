# PRODUCTION READINESS AUDIT — LINKEDIN AUTOPILOT
## GT InnoX LLP | Autonomous Engineering Mission

**Company:** GT InnoX LLP  
**Repository:** `https://github.com/tejasrmap/linkedin-autopilot`  
**Production URL:** `https://autopilot.gtinnox.in`  
**Audit Date:** November 14, 2026 (00:15 IST / 18:45 UTC)  
**Audited Branch:** `feature/production-readiness-beta-hardening` (branched from latest `main` @ `11775fa`)  

---

## 1. Executive Forensic Summary

A comprehensive forensic audit of the entire codebase, git commit tree, remote branches, live Supabase database (`lrctjyjowhtxrydutezk.supabase.co`), and production deployment (`https://autopilot.gtinnox.in`) was executed.

### Critical Milestones Authenticated:
1. **Live Publishing Verified**: Real scheduled post `3c2a4633-d479-4e7f-b029-f98d008e4b7b` ("Testing AutoPilot") was scheduled for `2026-11-13T18:39:00Z` and **successfully published to the owner's personal LinkedIn profile** at `2026-11-13T18:39:03.203Z` (`provider_post_id: urn:li:share:7527077585500078080`).
2. **pg_cron + pg_net Dispatch Operational**: The Supabase migration `20261113000006` is actively firing `private.invoke_serverless_publish_cron()` every 60 seconds (`* * * * *`), dispatching HTTP POST requests via `pg_net` to `/api/cron/publish`.
3. **Serverless Worker Pulse Active**: The heartbeat in `worker_heartbeats` (`id: 'primary_worker'`) is updated every minute by the cron route handler.
4. **Preserved Future Post**: An upcoming post (`175ca017-43cd-44b2-bb28-c018c0bb68bb`) is scheduled for `2026-11-13T23:55:00Z` (approx. 5 hours out) and remains untouched.
5. **Frozen Integrations**: LinkedIn Company Page / Organization integration and Stripe billing disablement remain 100% frozen and intact.

---

## 2. Forensic Findings Classification

### Finding 1: Vercel Production Stale Response Caching on Health Endpoint (P1 — Production Blocker)
- **File**: `src/app/api/health/route.ts`
- **Root Cause**: The route exports `export const dynamic = 'force-dynamic';`, but lacks explicit cache-control headers (`no-store, max-age=0`). Vercel's edge cache / micro-cache served stale responses for `/api/health` displaying an outdated heartbeat timestamp from 18:26:01Z (age > 1000s) even while the live database was updating every 60 seconds at 18:45:00Z and 18:46:00Z.
- **Reproduction**: Calling `https://autopilot.gtinnox.in/api/health` repeatedly returned a stale `last_execution_at` of `2026-11-13T18:26:01Z` while direct database queries showed `2026-11-13T18:46:00Z`.
- **Business Impact**: Operations dashboards and monitoring tools trigger false-alarm alerts indicating the worker is stopped when the scheduler is healthy.
- **Correction**: Add explicit `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate` response headers and set `revalidate = 0` to guarantee real-time evaluation.

### Finding 2: Dual State Inconsistency Between `posts` and `scheduled_jobs` on Retry (P1 — Production Blocker)
- **File**: `src/app/api/cron/publish/route.ts` (lines 140–180) & `src/lib/queue/publisher.ts` (lines 355–375)
- **Root Cause**: In `publisher.ts`, when LinkedIn returns an error, `markPostFailed` transitions both `posts` and `scheduled_jobs` to `status: 'failed'`. In `route.ts`, the retry handler attempted to update `scheduled_jobs` with `.eq('status', 'processing')`. Because `publisher.ts` had already set `status: 'failed'`, the update condition matched 0 rows, leaving `posts.status = 'scheduled'` (for retry) while `scheduled_jobs.status = 'failed'`, causing queue desynchronization.
- **Reproduction**: Triggering a publication with a transient network error creates an orphan scheduled post that is never picked up on subsequent cron cycles.
- **Business Impact**: Transient failures fail permanently instead of retrying, violating the 3-attempt exponential backoff SLA.
- **Correction**: Unify the state transition logic; update `scheduled_jobs` conditionally where `status IN ('failed', 'processing')` and synchronize the retry schedule atomically.

### Finding 3: Missing Job Ownership Lease Token in Publishing Pipeline (P2 — Beta Blocker)
- **File**: `src/lib/queue/publisher.ts` (lines 167–180)
- **Root Cause**: The Compare-And-Swap (CAS) in `executePublishPipeline` sets `status: 'processing'` but does not record an execution lease ID or owner token. If an execution exceeds normal latency, a concurrent cron reclamation could reclaim the job while the first process is mid-flight.
- **Reproduction**: If LinkedIn takes 20 seconds to respond and a manual or second cron claims the post, both processes could attempt publication.
- **Business Impact**: Risk of duplicate posts published to personal LinkedIn profiles during network spikes.
- **Correction**: Introduce an atomic `claim_token` (UUID) or lease verification during post processing so only the claiming worker can finalize state transitions.

### Finding 4: In-Memory Test Harness Masking Database Quirks (P2 — Beta Blocker)
- **File**: `src/lib/supabase/admin.ts` (lines 16–233)
- **Root Cause**: When `MOCK_SUPABASE_FOR_TESTS = 'true'`, the application routes database calls to an in-memory mock store that approximates SQL queries. While fast for unit testing, it cannot detect real PostgreSQL locking conflicts, transaction deadlocks, or schema constraint syntax errors.
- **Business Impact**: False confidence during local testing before pushing to production.
- **Correction**: Maintain strict separation between mock unit suites and real PostgreSQL staging integration suites (`tests/staging-postgres-integration.test.ts`).

---

## 3. Git & Remote Audit Trail

- **Base Main Commit**: `11775fa` (Merge pull request #9)
- **Merged PRs**: PR #8 (`feature/serverless-scheduler-migration`), PR #9 (`feature/serverless-trigger-final-audit`)
- **Active Working Branch**: `feature/production-readiness-beta-hardening`
- **Frozen Modules Audited**:
  - `src/lib/linkedin/client.ts` (Company Page/Org methods: frozen, unmodified)
  - `src/app/api/billing/*` (Stripe billing: strictly disabled, HTTP 503 fail-safe)
  - `src/lib/billing.ts` (`isBillingEnabled() === false`)
