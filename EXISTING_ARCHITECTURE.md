# EXISTING ARCHITECTURE — LINKEDIN AUTOPILOT SAAS
## GT InnoX LLP | Serverless Architecture & Publishing Pipeline

**Product:** LinkedIn Autopilot SaaS  
**Company:** GT InnoX LLP  
**Repository:** `https://github.com/tejasrmap/linkedin-autopilot`  
**Production Domain:** `https://autopilot.gtinnox.in`  

---

## 1. High-Level Architecture Overview

The LinkedIn Autopilot platform operates on a 100% serverless, zero-maintenance infrastructure topology designed for reliability, scalability, and strict Vercel Hobby plan compatibility:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SUPABASE POSTGRESQL                             │
│                                                                        │
│   ┌────────────────────┐          ┌────────────────────────────────┐   │
│   │   pg_cron (1 min)  │ ───────► │         pg_net dispatch        │   │
│   └────────────────────┘          │  POST /api/cron/publish        │   │
│             ▲                     │  Bearer <Vault Secret>         │   │
│             │                     └────────────────┬───────────────┘   │
│             │                                      │                   │
└─────────────┼──────────────────────────────────────┼───────────────────┘
              │                                      │ HTTPS
              │                                      ▼
┌─────────────┼──────────────────────────────────────────────────────────┐
│             │                  VERCEL SERVERLESS APP                   │
│             │                                                          │
│   ┌─────────┴──────────┐          ┌────────────────────────────────┐   │
│   │ /api/health        │          │ /api/cron/publish Route        │   │
│   │ Cache-Control      │          │ - Authenticate Bearer Header   │   │
│   │ Freshness checks   │          │ - CAS Reclaim Stale Leases     │   │
│   └────────────────────┘          │ - Fetch Due Batch (≤ 20 posts) │   │
│                                   └────────────────┬───────────────┘   │
│                                                    │                   │
│                                                    ▼                   │
│                                   ┌────────────────────────────────┐   │
│                                   │ executePublishPipeline()       │   │
│                                   │ - Generate UUID claim token    │   │
│                                   │ - claim_post_for_publishing()  │   │
│                                   │ - Decrypt token (AES-256-GCM)  │   │
│                                   └────────────────┬───────────────┘   │
└────────────────────────────────────────────────────┼───────────────────┘
                                                     │ HTTPS REST
                                                     ▼
                                    ┌────────────────────────────────┐
                                    │      LINKEDIN REST API         │
                                    │ - /v2/ugcPosts or /rest/posts  │
                                    │ - Member profile publication   │
                                    └────────────────────────────────┘
```

---

## 2. Component Breakdown

### A. Recurring Trigger: Supabase `pg_cron` & `pg_net`
- **Schedule:** `* * * * *` (every 60 seconds).
- **Execution Function:** `private.invoke_serverless_publish_cron()`.
- **Security:** Secret is read directly from Supabase Vault (`vault.decrypted_secrets`), completely avoiding secrets in committed code, SQL literals, or logs.
- **Dispatch Mechanism:** Dispatches an asynchronous HTTP POST request using `net.http_post()` directly to `https://autopilot.gtinnox.in/api/cron/publish`.

### B. Serverless Execution Route: `/api/cron/publish`
- **Authentication:** Fails closed if `CRON_SECRET` is unset. Strictly requires `Authorization: Bearer <CRON_SECRET>`. Query parameters are rejected to prevent secret exposure in server logs.
- **Stale Lease Reclamation:** Queries posts in `status = 'processing'` where `lease_expires_at < now` or `updated_at < now - 5m`, safely clearing expired claims via atomic CAS.
- **Batch Processing:** Retrieves up to 20 due posts ordered by `scheduled_at ASC`.
- **Telemetry Recording:** Writes execution duration and outcomes to `public.scheduler_execution_logs` and records heartbeats to `public.worker_heartbeats`.

### C. Publishing Engine: `src/lib/queue/publisher.ts`
- **Atomic Lease Acquisition:** Calls `public.claim_post_for_publishing()` passing a unique `UUID` claim token and 300-second lease window.
- **Token Decryption:** Decrypts the author's LinkedIn access token using authenticated AES-256-GCM.
- **Ambiguous Timeout Reconciliation:** If a LinkedIn request times out after transmission, queries recent author posts via `reconcileRecentAuthorPost()` to verify if the post went live before declaring failure.
- **Atomic Failure Handling:** Calls `public.handle_publishing_failure_and_retry()` to atomically record attempts and schedule exponential backoff retries ($2^{\text{attempts}}$ minutes) or flag terminal failures.

### D. Observability: `/api/health`
- **Zero-Cache Response:** Emits `Cache-Control: no-store, no-cache, must-revalidate` and `revalidate = 0` to prevent stale Vercel edge caching.
- **Multi-Vector Telemetry:** Independently evaluates API response, PostgreSQL connectivity, LinkedIn API ping, heartbeat freshness (<90s), latest execution log status, and stuck processing posts (>10m).

---

## 3. Storage & Schema Entities

1. `public.posts`: Content, status, media assets, schedule timestamp, `claim_token`, and `lease_expires_at`.
2. `public.scheduled_jobs`: Job metadata, attempt counters, `claim_token`, and status.
3. `public.post_publish_attempts`: Complete audit ledger of all publish attempts, HTTP response codes, and timestamps.
4. `public.social_accounts`: Encrypted OAuth credentials, account type, connection status.
5. `public.scheduler_execution_logs`: History of scheduler invocations, duration, and processed job counts.
6. `public.worker_heartbeats`: Active worker and serverless heartbeat tracking.
