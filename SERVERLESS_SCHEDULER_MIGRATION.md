# LinkedIn Autopilot — Serverless Scheduling Architecture Migration

**Company:** GT InnoX LLP  
**Repository:** `tejasrmap/linkedin-autopilot`  
**Production URL:** `https://autopilot.gtinnox.in`  
**Branch:** `feature/serverless-scheduler-migration`  
**Date:** November 13, 2026  

---

## 1. Executive Summary

LinkedIn Autopilot has been successfully migrated to a **100% serverless scheduling architecture**, completely eliminating the need for Railway, Render, VPS, AWS ECS, or any persistent background Node.js worker daemon.

The application now operates entirely on:
1. **Vercel**: Next.js 14 web application, API routes, and native Vercel Cron.
2. **Supabase**: PostgreSQL database, authentication, and media storage.
3. **LinkedIn API**: Personal profile publishing.

---

## 2. Serverless Scheduling Architecture Overview

```mermaid
flowchart TD
    VC["Vercel Cron Trigger (* * * * *)"] -->|HTTP GET /api/cron/publish| API["Serverless Route Handler (maxDuration: 60s)"]
    API --> AUTH{"Auth Verification (x-vercel-cron or CRON_SECRET)"}
    AUTH -->|Unauthorized| REJ["HTTP 401 Unauthorized"]
    AUTH -->|Authorized| HB["1. Emit Telemetry to worker_heartbeats (id: 'primary_worker')"]
    HB --> REC["2. Reclaim Stale Processing Locks (>5m in 'processing')"]
    REC --> FETCH["3. Fetch Due Jobs (status: 'scheduled', scheduled_at <= now, limit 20)"]
    FETCH --> CAS["4. Atomic CAS State Claiming (status: 'scheduled' -> 'processing')"]
    CAS --> PUB["5. Execute LinkedIn Publishing Pipeline (Token decrypt, URN check, LinkedIn REST API)"]
    PUB -->|Success| COMP["Mark post 'published' & scheduled_job 'completed'"]
    PUB -->|Fail (Attempts < 3)| EXP["Bounded Exponential Backoff (Next retry: now + 2^n min)"]
    PUB -->|Fail (Attempts >= 3)| FAIL["Mark post 'failed' & notify user"]
    
    HEALTH["Client / Monitoring /api/health"] --> VERIF["Checks worker_heartbeats (<90s pulse) & DB & LinkedIn"]
    VERIF --> OK["Reports status: 'healthy'"]
```

### Key Technical Implementations:

1. **Vercel Cron Integration (`vercel.json`)**:
   - Configured `{ "crons": [{ "path": "/api/cron/publish", "schedule": "* * * * *" }] }`.
   - Fires natively every minute without keeping any persistent server running.

2. **Secure Cron Invocations (`src/app/api/cron/publish/route.ts`)**:
   - Securely accepts Vercel's automated `x-vercel-cron` header.
   - Also accepts standard `Authorization: Bearer <CRON_SECRET>` and query param `?key=<CRON_SECRET>` for manual runs or external monitoring pings.

3. **Serverless Worker Telemetry Pulse**:
   - Every minute on invocation, the serverless function upserts a heartbeat row into `public.worker_heartbeats`:
     - `id`: `'primary_worker'`
     - `mode`: `'Vercel Serverless Cron Engine'`
     - `last_seen_at`: ISO timestamp
     - `meta`: `{ "provider": "vercel-cron", "source": "..." }`
   - Keeps the `/api/health` monitor continuously in `status: "healthy"` without needing an external polling process.

4. **Atomic Concurrency & Stale Lock Reclamation**:
   - Double-publish prevention: Database state machine uses Compare-And-Swap (CAS) to atomically transition `status: 'scheduled' -> 'processing'`. Simultaneous cron invocations cannot publish the same post twice.
   - Crash/Timeout Resilience: If a serverless function times out or encounters a network disruption mid-publish, any job left in `'processing'` for longer than 5 minutes is automatically detected and safely reclaimed back to `'scheduled'`.

5. **Bounded Exponential Backoff**:
   - Failed attempts increment retry counters and schedule the next attempt with bounded backoff ($2^{\text{attempts}}$ minutes: 2m, 4m, 8m) before finally marking the post `'failed'` after 3 attempts.

6. **Backward Compatibility & Safe Rollback**:
   - The standalone BullMQ worker (`src/worker/index.ts`) and Redis queue structures remain intact. If `REDIS_URL` is configured, it operates alongside; if unset or absent, the serverless engine functions autonomously.

---

## 3. Verification & Test Execution Results

All automated suites and build checks passed with zero errors:

| Check / Test Suite | Command | Result | Status |
| :--- | :--- | :--- | :--- |
| **Serverless Scheduler Suite** | `npm run test:serverless` | **8 / 8 passed** | ✅ PASS |
| **Worker Recovery Suite** | `npm run test:worker` | **16 / 16 passed** | ✅ PASS |
| **Staging PostgreSQL Suite** | `npm run test:postgres` | **14 / 14 passed** | ✅ PASS |
| **Stripe Disablement Suite** | `npm run test:disablement` | **44 / 44 passed** | ✅ PASS |
| **TypeScript Typecheck** | `npx tsc --noEmit` | **0 errors** | ✅ PASS |
| **ESLint Audit** | `npm run lint` | **0 warnings, 0 errors** | ✅ PASS |
| **Next.js Production Build** | `npm run build` | **45 / 45 routes compiled** | ✅ PASS |

---

## 4. Environment Variables Reference

When deploying to Vercel, the following environment variables are required:

| Variable | Description |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Live Supabase project URL (`https://lrctjyjowhtxrydutezk.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role secret key |
| `CRON_SECRET` | Secret token used to authenticate Vercel Cron jobs |
| `BILLING_ENABLED` | Set strictly to `false` (Stripe remains disabled) |
| `LINKEDIN_CLIENT_ID` | LinkedIn OAuth application client ID |
| `LINKEDIN_CLIENT_SECRET` | LinkedIn OAuth application client secret |
| `TOKEN_ENCRYPTION_KEY` | 32-byte hex key for encrypting OAuth tokens at rest |

> [!NOTE]
> `REDIS_URL` is **no longer required** in production.

---

## 5. Rollback Plan

If required, rolling back to a persistent daemon can be accomplished instantaneously:
1. Re-deploy `src/worker/index.ts` to Railway, Render, or a VPS with `npm run worker`.
2. Delete `vercel.json` or remove the cron definition.
3. No database schema changes were made; all existing posts, schedules, and accounts remain 100% compatible.
