# LinkedIn Autopilot — Post-PR #11 Production Scheduler Corrective Patch Report

**Company:** GT InnoX LLP  
**Repository:** `https://github.com/tejasrmap/linkedin-autopilot`  
**Base Branch:** `main` (commit `70390c4` - PR #11 merge)  
**Patch Branch:** `fix/post-pr11-lease-ownership`  
**Date:** 14 November 2026  
**Status:** READY FOR REVIEW (Undeployed & Unmerged)

---

## 1. Executive Summary & Objective

Following the merge of PR #8, #9, #10, and #11, a post-merge production safety audit was conducted on the serverless scheduler and publishing pipeline.
While the one-minute recurring scheduler successfully operates on Supabase `pg_cron` + `pg_net` without external persistent workers, the source review discovered potential race conditions and ownership bypasses in the lease ownership validation and client-side fallback logic:

1. **Weak Lease Ownership Check in RPC:**
   In migration `20261114000007_scheduler_lease_and_atomic_retry.sql`:
   ```sql
   IF expected_claim_token IS NOT NULL
      AND current_post.claim_token IS NOT NULL
      AND current_post.claim_token <> expected_claim_token
   THEN
     RETURN jsonb_build_object('success', false, 'reason', 'claim_token_mismatch_lease_lost');
   END IF;
   ```
   If `expected_claim_token` was provided but `current_post.claim_token` was `NULL` (unowned post), or if `expected_claim_token` was `NULL`, execution could proceed past the guard. Furthermore, lease expiration (`lease_expires_at < clock_timestamp()`) was not checked inside this block.

2. **Unsafe Fallback Overwriting Winning Worker State:**
   In `src/lib/queue/publisher.ts`, if `handle_publishing_failure_and_retry` returned `success: false` (e.g. lease lost to competing worker or post already published), the client code entered `if (rpcErr || !retryData?.success)` and executed an unconditional `.update({ status: 'failed' }).eq('id', post.id)`. This permitted a stale or losing worker to overwrite the winning worker's post state with `failed`.

3. **Non-Atomic Success Finalization:**
   On successful publishing or timeout reconciliation, `posts` and `scheduled_jobs` were updated via separate non-atomic client queries. If the lease expired during HTTP transmission to LinkedIn, the worker could mark `scheduled_jobs` completed even if another worker had reclaimed the post.

4. **Orphan Post Risk on Missing `scheduled_jobs`:**
   If a post lacked a corresponding `scheduled_jobs` record, retry updates to `scheduled_jobs` matched 0 rows, leaving an orphan post that would never be picked up by the cron poller.

5. **Potential Duplicate Publishing on Ambiguous Timeouts:**
   When LinkedIn network calls timed out, the post could be scheduled for retry without first verifying whether the post actually went live on LinkedIn prior to the subsequent retry call.

---

## 2. Corrective Remediation (Phase-by-Phase)

### A. Forward-Only Migration (`20261114000008_strict_lease_ownership_and_finalization.sql`)
- **Forward-Only, Non-Destructive:** Does not alter or rewrite `20261114000007`. Replaces procedures idempotently using `CREATE OR REPLACE FUNCTION`.
- **`claim_post_for_publishing` Hardening:**
  - Strictly requires `target_post_id` and `new_claim_token` to be non-NULL.
  - Grants a 300-second lease with monotonic timestamp `now_ts := clock_timestamp()`.
  - Atomically claims posts in eligible states or stale processing states (`lease_expires_at < now_ts` or `updated_at < now_ts - 5m`).
- **`handle_publishing_failure_and_retry` Hardening:**
  - Strictly requires non-NULL `expected_claim_token`.
  - Acquires row-level lock `FOR UPDATE` on `posts`.
  - Immutability check: Rejects with `'post_already_published'` if post is published.
  - Rejects if `current_post.claim_token IS NULL` (`'claim_token_missing_unowned'`).
  - Rejects if `current_post.claim_token <> expected_claim_token` (`'claim_token_mismatch_lease_lost'`).
  - Rejects if `current_post.lease_expires_at < now_ts` (`'lease_expired'`).
  - Atomically calculates exponential backoff (`2^attempt` minutes).
  - Handles duplicate `scheduled_jobs`: Identifies the authoritative job and marks older duplicates as `'cancelled'`.
  - Handles missing `scheduled_jobs`: Inserts a new authoritative record so posts are never orphaned.
- **`finalize_post_publishing` (New Transactional RPC):**
  - Requires non-NULL `target_post_id`, `expected_claim_token`, and non-empty `provider_post_id`.
  - Locks post `FOR UPDATE`.
  - Rejects published posts, missing stored tokens, token mismatches, and expired leases.
  - Atomically transitions post to `'published'`, clears claim tokens and lease expirations, and sets `provider_post_id`.
  - Atomically marks `scheduled_jobs` as `'completed'` and cancels older duplicates.
- **Privilege Hardening:** Revokes execution from `PUBLIC, anon, authenticated` and grants strictly to `postgres, service_role`.

### B. Application Publishing Pipeline Hardening (`src/lib/queue/publisher.ts`)
1. **Pre-Publish Ambiguous Timeout Reconciliation:**
   Before dispatching a post to LinkedIn, if the post had previously recorded an ambiguous timeout, `linkedInClient.reconcileRecentAuthorPost()` checks the author's live LinkedIn feed. If the post is already published, it finalizes immediately without re-posting, eliminating duplicate publishing.
2. **Unified Atomic Finalization:**
   Both primary publish and live timeout reconciliation call `finalize_post_publishing` RPC.
   If the RPC rejects the finalization (lease lost or expired), the application logs the rejection and does NOT mutate database state.
3. **Removal of Unsafe Fallbacks:**
   In `markPostFailed()`:
   - Aborts immediately if no active claim token is present.
   - If `handle_publishing_failure_and_retry` returns `success: false`, execution returns immediately without mutating state.
   - Fallback updates only execute if `rpcErr` (missing RPC), and even then enforce `.eq('claim_token', activeClaimToken)`. If 0 rows match, no update occurs.

### C. Test Harness Alignment (`src/lib/supabase/admin.ts`)
- Updated mock test store to support array batch inserts.
- Implemented strict RPC handlers for `claim_post_for_publishing`, `handle_publishing_failure_and_retry`, and `finalize_post_publishing` in the offline test harness.

---

## 3. Test Verification & Evidence

### Test Execution Summary (All Executed Live)

| Test Suite | Command | Total Tests | Passed | Failed | Result |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Serverless Scheduler & Cron Suite** | `npm run test:serverless` | 20 | 20 | 0 | **PASSED** |
| **Real PostgreSQL Staging Integration** | `npm run test:postgres` | 23 | 23 | 0 | **PASSED** |
| **Hardened Stripe Disablement Suite** | `npm run test:disablement` | 44 | 44 | 0 | **PASSED** |
| **Worker Recovery & Heartbeat Suite** | `npm run test:worker` | 16 | 16 | 0 | **PASSED** |
| **Admin & CAS Hardening Suite** | `npm run test:hardening` | 13 | 13 | 0 | **PASSED** |
| **Core Encryption & State Suite** | `npm test` | 15 | 15 | 0 | **PASSED** |
| **TypeScript Typecheck** | `npx tsc --noEmit` | N/A | Clean | 0 errors | **PASSED** |
| **ESLint Code Quality** | `npm run lint` | N/A | Clean | 0 warnings | **PASSED** |
| **Next.js Production Build** | `npm run build` | 45 routes | 45 routes | 0 errors | **PASSED** |

### Breakdown of Real PostgreSQL Staging Integration Tests (Group 9)
Executed against live Supabase PostgreSQL staging database with separate concurrent client sessions:
- `[REAL POSTGRESQL LEASE] Exactly ONE competing worker session successfully claims lease with UUID claim token`: **PASSED**
- `[REAL POSTGRESQL LEASE] Losing worker session is strictly rejected from triggering failure/retry`: **PASSED**
- `[REAL POSTGRESQL LEASE] Losing worker session is strictly rejected from finalizing post publication`: **PASSED**
- `[REAL POSTGRESQL LEASE] Operations with NULL expected claim token are strictly rejected`: **PASSED**
- `[REAL POSTGRESQL LEASE] Worker with expired lease is strictly rejected from executing failure/retry`: **PASSED**
- `[REAL POSTGRESQL LEASE] Expired lease is safely and atomically reclaimed by a new worker session`: **PASSED**
- `[REAL POSTGRESQL LEASE] Previous owner after lease replacement is rejected from finalizing`: **PASSED**

---

## 4. Distinction Between Executed vs Inspected Tests

- **Executed Live:**
  - `tests/serverless-scheduler.test.ts` (20 tests passed via `tsx --test`)
  - `tests/staging-postgres-integration.test.ts` (23 tests passed directly against remote Supabase database)
  - `tests/stripe-disablement.test.ts` (44 tests passed)
  - `tests/worker-recovery.test.ts` (16 tests passed)
  - `tests/hardening-suite.test.ts` (13 tests passed)
  - `tests/suite.test.ts` (15 tests passed)
  - Next.js full production compilation (45/45 routes compiled)
- **Inspected Only:**
  - Real LinkedIn live publishing (`publish-live-post.ts`) was inspected only and **not executed** to prevent live spam on user accounts, as mandated by the mission safety restrictions.

---

## 5. Security & Isolation Compliance

1. **Production Invariance:**
   - No production migrations executed.
   - No production environment variables, API secrets, or OAuth credentials altered.
   - No external persistent workers or VPS introduced.
2. **Feature Freeze Compliance:**
   - LinkedIn Company Page / Organization integration remained 100% untouched.
   - Stripe billing remains strictly disabled (`isBillingEnabled() === false`).
3. **Backward Compatibility:**
   - Existing scheduled posts and user data in the database remain completely intact.
   - Forward-only migration is non-destructive.
