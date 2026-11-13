# CRITICAL BUGS & REMEDIATION LOG — LINKEDIN AUTOPILOT SAAS
## GT InnoX LLP | Private Beta Hardening

This document tracks all critical, high, and medium severity reliability and security bugs discovered during the repository forensic audit, their exact root causes, repro scenarios, remediations, and regression verification tests.

---

## Bug Tracker & Matrix

| Bug ID | Title | File Path | Severity | Status | Regression Test |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **BUG-001** | Missing Execution Lease Tokens in Publishing Pipeline | `src/lib/queue/publisher.ts` | **P1 (Critical)** | **REMEDIATED** | `tests/serverless-scheduler.test.ts` |
| **BUG-002** | Non-Atomic Retries Between Posts and Scheduled Jobs | `src/app/api/cron/publish/route.ts` | **P1 (Critical)** | **REMEDIATED** | `tests/staging-postgres-integration.test.ts` |
| **BUG-003** | False Healthy Reporting on Failed Scheduler Execution | `src/app/api/health/route.ts` | **P2 (High)** | **REMEDIATED** | `tests/serverless-scheduler.test.ts` |
| **BUG-004** | Vercel Edge Micro-Caching of Health Telemetry | `src/app/api/health/route.ts` | **P1 (Critical)** | **REMEDIATED** | `tests/stripe-disablement.test.ts` |
| **BUG-005** | Stale Lock Reclamation Without Lease Expiration Recheck | `src/app/api/cron/publish/route.ts` | **P1 (Critical)** | **REMEDIATED** | `tests/serverless-scheduler.test.ts` |
| **BUG-006** | In-Memory Test Harness Lack of Mock Sorting & RPCs | `src/lib/supabase/admin.ts` | **P2 (Medium)** | **REMEDIATED** | `tests/serverless-scheduler.test.ts` |

---

## Detailed Bug Analysis & Technical Remediations

### BUG-001: Missing Execution Lease Tokens in Publishing Pipeline
- **Affected File:** `src/lib/queue/publisher.ts`
- **Function:** `executePublishPipeline(postId: string)`
- **Actual Behavior:** Prior to remediation, `executePublishPipeline` executed a basic CAS update setting `status = 'processing'`, but failed to record a unique ownership claim token or lease expiration timestamp. If execution stalled, competing workers or the cron reclamation loop could take over an in-flight operation.
- **Reproduction Scenario:** Two concurrent invocations selecting the same post within a 5-millisecond window could both enter `executePublishPipeline()` if network latency delayed LinkedIn response, leading to duplicate publishing.
- **Remediation:** 
  1. Added `claim_token UUID` and `lease_expires_at TIMESTAMPTZ` columns to `public.posts` and `public.scheduled_jobs`.
  2. Implemented `public.claim_post_for_publishing()` stored procedure with 300s lease duration.
  3. Validates that the active caller still owns the `claim_token` before finalizing state transitions.
- **Verification:** Verified via `tests/serverless-scheduler.test.ts` ("Lease Ownership: UUID claim token locks post and competing claim is rejected").

---

### BUG-002: Non-Atomic Retries Between Posts and Scheduled Jobs
- **Affected Files:** `src/app/api/cron/publish/route.ts` & `src/lib/queue/publisher.ts`
- **Function:** `markPostFailed()` & cron retry handler
- **Actual Behavior:** When LinkedIn returned a publishing failure, `publisher.ts` updated both tables to `failed`. Separately, `route.ts` attempted to update `posts` and `scheduled_jobs` back to `scheduled`. If a server crash or network timeout occurred between these updates, `posts` became `scheduled` while `scheduled_jobs` remained `failed` (or vice versa), permanently desynchronizing the scheduler queue.
- **Reproduction Scenario:** Simulated database network disconnection during retry update left orphan post in scheduled state with no active scheduled_job.
- **Remediation:** Implemented `public.handle_publishing_failure_and_retry()` PostgreSQL `SECURITY DEFINER` function that performs all checks, exponential backoff calculation ($2^{\text{attempts}}$ minutes), attempt counter increment, and table updates within an atomic PostgreSQL transaction.
- **Verification:** Verified via `tests/staging-postgres-integration.test.ts` (Group 8) and `tests/serverless-scheduler.test.ts`.

---

### BUG-003: False Healthy Reporting on Failed Scheduler Execution
- **Affected File:** `src/app/api/health/route.ts`
- **Component:** `checks.scheduler_execution`
- **Actual Behavior:** The health route evaluated worker heartbeat freshness (<90s), but defaulted `latest_execution_status` to `'completed'` if telemetry was missing and did not mark the check as `degraded` when `scheduler_execution_logs.status === 'failed'`.
- **Reproduction Scenario:** A cron invocation fails due to an upstream LinkedIn outage; `/api/health` continued reporting `healthy` because the heartbeat timestamp was recent.
- **Remediation:** 
  - If `latestLog && latestLog.status === 'failed'`, `scheduler_execution` explicitly reports `status: 'degraded'` with the exact failed count.
  - If required telemetry is missing, reports `status: 'degraded'`.
- **Verification:** Verified via `tests/serverless-scheduler.test.ts` ("Health: Reports degraded status when latest scheduler execution log recorded a failed status").

---

### BUG-004: Vercel Edge Micro-Caching of Health Telemetry
- **Affected File:** `src/app/api/health/route.ts`
- **Actual Behavior:** Because Next.js App Router defaults can cache dynamic routes in Vercel edge networks unless explicitly disabled, calls to `/api/health` returned stale heartbeat timestamps (over 1000 seconds old) despite the live database receiving fresh heartbeats every minute.
- **Remediation:** Configured `export const revalidate = 0;`, `export const fetchCache = 'force-no-store';`, and explicit HTTP response headers:
  `Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate`, `Pragma: no-cache`, `Expires: 0`.
- **Verification:** Production inspection confirmed zero-second cache TTL.
