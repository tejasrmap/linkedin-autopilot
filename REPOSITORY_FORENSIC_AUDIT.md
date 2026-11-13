# REPOSITORY FORENSIC AUDIT — LINKEDIN AUTOPILOT SAAS
## GT InnoX LLP | Autonomous Engineering Mission

**Product:** LinkedIn Autopilot SaaS  
**Company:** GT InnoX LLP  
**Repository:** `https://github.com/tejasrmap/linkedin-autopilot`  
**Production Domain:** `https://autopilot.gtinnox.in`  
**Base Commit on `main`:** `110bf98b6984e94bf126e9b53756dd52fc50b51d`  
**Active Working Branch:** `feature/master-beta-hardening`  
**Audit Timestamp:** November 14, 2026 (00:55 IST / 19:25 UTC)  

---

## 1. Executive Summary

A comprehensive, ground-truth forensic audit of the LinkedIn Autopilot SaaS repository was conducted to inspect all components of the application across architecture, database reliability, publishing idempotency, authentication, multi-tenant isolation, telemetry, and security.

### Verified Operational Milestones:
1. **Live Publishing Verified**: Live post `3c2a4633-d479-4e7f-b029-f98d008e4b7b` ("Testing AutoPilot") was successfully published to personal LinkedIn profile at `2026-11-13T18:39:03.203Z` (`provider_post_id: urn:li:share:7527077585500078080`).
2. **Serverless Trigger Operational**: Supabase PostgreSQL native `pg_cron` extension executes `private.invoke_serverless_publish_cron()` every 60 seconds (`* * * * *`), dispatching HTTP requests via `pg_net` to `/api/cron/publish` with Bearer authentication using credentials safely loaded from Supabase Vault.
3. **No Persistent External Worker Hosting**: Neither Railway, Render, VPS, nor AWS ECS is required. The system runs 100% on Vercel Serverless + Supabase Managed PostgreSQL + LinkedIn REST API.
4. **Preserved Future Posts**: All scheduled posts in the database (including post `175ca017-43cd-44b2-bb28-c018c0bb68bb` scheduled for 23:55 UTC) remain untouched and valid.
5. **Frozen Integrations**: LinkedIn Company Page / Organization publishing logic and Stripe billing disablement (`isBillingEnabled() === false`) remain strictly frozen and untouched.

---

## 2. Directory Structure & Component Inventory

```
├── .env.local (Protected local configuration)
├── next.config.mjs (Strict Content-Security-Policy & security headers)
├── package.json (Next.js 14.2.23, React 18.3.1, @supabase/supabase-js 2.48.1)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── cron/publish/route.ts (Serverless scheduler batch processor)
│   │   │   ├── health/route.ts (Operational health check with cache protection)
│   │   │   ├── billing/ (Stripe routes with fail-safe HTTP 503 disablement)
│   │   │   ├── linkedin/ (OAuth connection, callback, disconnect)
│   │   │   └── posts/ (CRUD, scheduling, immediate publishing)
│   ├── lib/
│   │   ├── queue/
│   │   │   ├── publisher.ts (Publishing pipeline, claim token lease, atomic retries)
│   │   │   └── redis.ts (Optional BullMQ/Redis fallback)
│   │   ├── linkedin/client.ts (LinkedIn REST API client, OAuth, media upload)
│   │   ├── encryption.ts (AES-256-GCM token encryption with 16-byte IV & AuthTag)
│   │   ├── billing.ts (Strict authoritative feature flag resolution)
│   │   └── supabase/admin.ts (Service-role client & test mock harness)
├── supabase/
│   └── migrations/ (Declarative migrations 20261113000001 through 20261114000007)
└── tests/ (10 comprehensive test suites spanning 140+ assertions)
```

---

## 3. Forensic Finding Classification & Ranking

### Finding 1: Lack of Execution Lease Tokens in Publishing Pipeline (P1 — Remediated)
- **File:** `src/lib/queue/publisher.ts`
- **Component:** `executePublishPipeline()`
- **Actual Behavior (Before):** The publishing pipeline marked a post `processing` via CAS, but did not generate a unique execution claim token or lease expiration timestamp. If execution stalled, competing workers or the cron reclamation loop could take over an in-flight operation.
- **Severity:** P1 (Production-blocking reliability issue)
- **Remediation:** 
  - Added `claim_token UUID` and `lease_expires_at TIMESTAMPTZ` to `public.posts` and `public.scheduled_jobs`.
  - Created atomic stored procedure `public.claim_post_for_publishing()` with a 5-minute lease duration.
  - Required matching `claim_token` validation before updating post to `published` or handling failure.
- **Regression Test:** `tests/serverless-scheduler.test.ts` ("Lease Ownership: UUID claim token locks post and competing claim is rejected").

### Finding 2: Uncoordinated Client-Side Retry Transitions (P1 — Remediated)
- **File:** `src/app/api/cron/publish/route.ts` & `src/lib/queue/publisher.ts`
- **Component:** `markPostFailed()` & cron retry handler
- **Actual Behavior (Before):** `publisher.ts` marked posts and jobs as `failed`, while `route.ts` separately updated them back to `scheduled` for retry. Network or server interruption between these calls left database tables in inconsistent states.
- **Severity:** P1 (Production-blocking reliability issue)
- **Remediation:** 
  - Created `public.handle_publishing_failure_and_retry()` PostgreSQL `SECURITY DEFINER` function.
  - Validates post ownership, current attempts, calculates exponential backoff ($2^{\text{attempts}}$ minutes), increments attempt counters, and synchronizes `posts` and `scheduled_jobs` atomically.
  - Strictly rejects reopening published posts.
- **Regression Test:** `tests/serverless-scheduler.test.ts` ("Atomic Retry RPC: handle_publishing_failure_and_retry...") and `tests/staging-postgres-integration.test.ts` (Group 8).

### Finding 3: Health Endpoint False-Healthy Masking on Failed Scheduler Executions (P2 — Remediated)
- **File:** `src/app/api/health/route.ts`
- **Component:** `checks.scheduler_execution`
- **Actual Behavior (Before):** If a worker heartbeat was fresh (<90s), the endpoint reported `healthy` even if the latest scheduler execution log had `status = 'failed'`, and defaulted missing telemetry to `completed`.
- **Severity:** P2 (Important beta observability issue)
- **Remediation:** 
  - If `latestLog && latestLog.status === 'failed'`, `scheduler_execution` strictly reports `status: 'degraded'`.
  - Distinguishes trigger dispatch, HTTP delivery, and publication success.
- **Regression Test:** `tests/serverless-scheduler.test.ts` ("Health: Reports degraded status when latest scheduler execution log recorded a failed status").

---

## 4. Protected Subsystems Verification

1. **LinkedIn Organization / Company Page Integration**:
   - `src/lib/linkedin/client.ts` organization functions were inspected and verified completely unchanged.
   - All tests run strictly with personal member profile scopes (`w_member_social`).
2. **Stripe Billing Disablement**:
   - `isBillingEnabled()` strictly resolves to `false`.
   - `/api/billing/checkout` and `/api/billing/portal` return `HTTP 503` with `{ error: "Billing is temporarily unavailable." }`.
   - Stripe webhooks verify signatures, acknowledge with `HTTP 200`, and log events as `ignored_billing_disabled` without executing ledger mutations.
