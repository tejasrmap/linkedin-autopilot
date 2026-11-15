# POST-PR #14 PRODUCTION READINESS AUDIT

**Company:** GT InnoX LLP  
**Product:** LinkedIn Autopilot SaaS  
**Repository:** `https://github.com/tejasrmap/linkedin-autopilot`  
**Base Commit:** `95d0382a34e79d5b7bfc3dc8b75a18ddbd4ae71b` (`origin/main`, PR #14 merge)  
**Branch:** `audit/post-pr14-production-readiness`  
**Date:** 15 November 2026  
**Auditor:** Principal SaaS Architect & Reliability Lead  
**Audit Verdict:** **CONDITIONAL PASS — MANUAL ACTIONS REQUIRED**

---

## 1. Executive Summary

An independent, source-code-level forensic audit of LinkedIn Autopilot was conducted following the merge of PR #14 (`95d0382`). PR #14 successfully hardened PL/pgSQL parameters, tightened RPC missing-function detection, enforced fail-closed OAuth scopes, and protected job rollbacks with optimistic locking.

However, an exhaustive end-to-end trace of multi-user operations, tenant isolation boundaries, and scheduler concurrency revealed **5 confirmed defects and 2 critical architectural risks** that required immediate correction or documented manual remediation:

1. **Defect 1 (Cross-Tenant IDOR on Direct Post Publishing):** `/api/posts/[id]/publish/route.ts` validated user roles but failed to verify whether the target `postId` belonged to the authenticated user's workspace. An authenticated user in Workspace A could trigger immediate publishing of posts belonging to Workspace B.
2. **Defect 2 (Cross-Tenant IDOR on Post Scheduling):** `/api/posts/[id]/schedule/route.ts` failed to verify workspace ownership before passing `params.id` to `schedulePostPublishJob()`, enabling cross-workspace post scheduling.
3. **Defect 3 (Cross-Tenant IDOR & Post Immutability Violation on Post Cancellation):** `/api/posts/[id]/cancel/route.ts` and `cancelScheduledJob()` in `src/lib/queue/publisher.ts` lacked workspace scoping and status checks. Any user could cancel posts in foreign workspaces, and `cancelScheduledJob()` blindly updated posts to `draft`, allowing already `published` or in-flight `processing` posts to be reopened in violation of post immutability.
4. **Defect 4 (Cross-Tenant Social Account Assignment in Bulk Scheduling):** `/api/posts/bulk/route.ts` accepted default and per-item `socialAccountId` values without verifying workspace ownership, allowing posts to reference foreign social accounts.
5. **Defect 5 (Missing Fail-Closed Guard & Parameter Ambiguity in `claim_post_for_publishing`):** In `executePublishPipeline()`, `claim_post_for_publishing` only passed legacy parameter names (missing `p_` dual parameter keys) and its `else` branch ran an unverified CAS fallback on any database error (including timeouts `57014` and connection drops `08006`), bypassing `isRpcFunctionMissingError()`.

All 5 defects have been corrected in branch `audit/post-pr14-production-readiness` with 166 automated tests passing across all suites.

---

## 2. Forensic Findings & Detailed Defect Analysis

### Finding 1: Cross-Tenant IDOR in `/api/posts/[id]/publish/route.ts`
- **Severity:** High / Critical
- **Location:** `src/app/api/posts/[id]/publish/route.ts`
- **Reproduction Scenario:**
  1. Attacker authenticates with an `editor` or `admin` role in Workspace A.
  2. Attacker obtains or guesses `postId` belonging to Workspace B.
  3. Attacker sends `POST /api/posts/<workspace_b_post_id>/publish`.
  4. Server verified `auth.role` in Workspace A, then called `executePublishPipeline(params.id)` using the service role admin client.
  5. `claim_post_for_publishing` claimed the post without workspace filtering.
  6. The post was published to LinkedIn under Workspace B's linked account.
- **Impact:** Unauthorized cross-workspace post execution and privacy breach.
- **Implemented Fix:** Added mandatory server-side verification:
  ```typescript
  const { data: post, error: postErr } = await admin
    .from('posts')
    .select('id, workspace_id')
    .eq('id', params.id)
    .eq('workspace_id', auth.workspaceId)
    .maybeSingle();

  if (postErr || !post) {
    return NextResponse.json({ error: 'Post not found or inaccessible.' }, { status: 404 });
  }
  ```
- **Test Coverage:** Verified in `tests/multi-user-publishing-reliability.test.ts`.

---

### Finding 2: Cross-Tenant IDOR in `/api/posts/[id]/schedule/route.ts`
- **Severity:** High
- **Location:** `src/app/api/posts/[id]/schedule/route.ts`
- **Reproduction Scenario:**
  1. Attacker in Workspace A submits `POST /api/posts/<workspace_b_post_id>/schedule` with a future timestamp.
  2. The endpoint passed `params.id` directly to `schedulePostPublishJob(params.id, auth.workspaceId, scheduledDate)`.
  3. `schedulePostPublishJob()` updated `posts` by `id` without checking `workspace_id`.
- **Impact:** Unauthorized rescheduling and modification of foreign workspace posts.
- **Implemented Fix:** Added role check and workspace ownership validation:
  ```typescript
  if (!['owner', 'admin', 'editor', 'approver'].includes(auth.role)) {
    return NextResponse.json({ error: 'Permission denied: cannot schedule posts' }, { status: 403 });
  }
  const { data: post, error: postErr } = await admin
    .from('posts')
    .select('id, workspace_id')
    .eq('id', params.id)
    .eq('workspace_id', auth.workspaceId)
    .maybeSingle();

  if (postErr || !post) {
    return NextResponse.json({ error: 'Post not found or inaccessible.' }, { status: 404 });
  }
  ```
- **Test Coverage:** Verified in `tests/multi-user-publishing-reliability.test.ts`.

---

### Finding 3: Cross-Tenant IDOR & Post Immutability Violation in `/api/posts/[id]/cancel/route.ts` & `cancelScheduledJob()`
- **Severity:** High
- **Location:** `src/app/api/posts/[id]/cancel/route.ts` and `src/lib/queue/publisher.ts`
- **Reproduction Scenario:**
  1. Any authenticated user in any workspace could call `POST /api/posts/<any_post_id>/cancel`.
  2. `cancelScheduledJob(postId)` executed an unconditional update `.update({ status: 'draft' }).eq('id', postId)`.
  3. If called on a post that was `published` or currently `processing`, the post status was overwritten back to `draft`, violating core post immutability guarantees.
- **Impact:** Reopening published posts, corrupting worker execution state, and cross-workspace post disruption.
- **Implemented Fix:**
  1. In `cancel/route.ts`, enforced workspace ownership and validated that `['scheduled', 'pending_approval'].includes(post.status)`.
  2. In `cancelScheduledJob(postId, workspaceId?)`, added `.in('status', ['scheduled', 'pending_approval'])` and verified updated row count via `.select('id')`. Rejects cancellation for `published` or `processing` posts.
- **Test Coverage:** Added 3 regression tests in `tests/multi-user-publishing-reliability.test.ts`.

---

### Finding 4: Cross-Tenant Social Account Assignment in `/api/posts/bulk/route.ts`
- **Severity:** High
- **Location:** `src/app/api/posts/bulk/route.ts`
- **Reproduction Scenario:**
  1. User in Workspace A called `POST /api/posts/bulk` passing a `socialAccountId` belonging to Workspace B.
  2. The endpoint inserted the post without verifying that `socialAccountId` belonged to `auth.workspaceId`.
  3. When subsequently processed, the pipeline failed with a security violation.
- **Impact:** Database pollution with orphaned cross-tenant post references.
- **Implemented Fix:** Added strict workspace verification for both default and per-item social account IDs:
  ```typescript
  if (defaultAccountId) {
    const { data: validDefault } = await admin
      .from('social_accounts')
      .select('id')
      .eq('id', defaultAccountId)
      .eq('workspace_id', auth.workspaceId)
      .maybeSingle();

    if (!validDefault) {
      return NextResponse.json(
        { error: 'Invalid default social account: Account does not belong to this workspace.' },
        { status: 403 }
      );
    }
  }
  ```
- **Test Coverage:** Verified in `tests/multi-user-publishing-reliability.test.ts`.

---

### Finding 5: Missing Fail-Closed Guard & Ambiguous Parameters in `claim_post_for_publishing`
- **Severity:** High
- **Location:** `src/lib/queue/publisher.ts` (`executePublishPipeline`)
- **Reproduction Scenario:**
  1. `claim_post_for_publishing` was invoked with only legacy parameter names (`target_post_id`), risking `PGRST202` when migration 9 is applied.
  2. The `else` block caught any `rpcErr` (including statement timeouts `57014` and connection failures `08006`) and fell back directly to an unverified CAS update on `posts` without synchronizing `scheduled_jobs`.
- **Impact:** Bypassed fail-closed concurrency controls during database connection drops or timeouts.
- **Implemented Fix:**
  1. Passed dual parameters (`p_target_post_id` and `target_post_id`, etc.).
  2. Restricted fallback strictly to `isRpcFunctionMissingError(rpcErr, 'claim_post_for_publishing')`.
  3. Synchronized `scheduled_jobs` in the fallback CAS update.
  4. Operational errors fail closed and return `{ success: false, error: ... }`.
- **Test Coverage:** Verified in `tests/multi-user-publishing-reliability.test.ts`.

---

### Finding 6: Permissive RLS in Migration `20261113000001_fix_dev_and_service_rls.sql`
- **Severity:** Medium (Mitigated by server-side checks, requires pre-beta migration)
- **Location:** `supabase/migrations/20261113000001_fix_dev_and_service_rls.sql`
- **Observation:** In early dev mode, RLS policies on `posts`, `social_accounts`, and `scheduled_jobs` were set to `USING (true) WITH CHECK (true)`. While all Next.js API route handlers now strictly validate workspace ownership, a direct client query using the publishable key could bypass tenant isolation at the database layer.
- **Status:** Documented in `POST_PR14_REMAINING_RISKS.md` and `POST_PR14_MANUAL_DEPLOYMENT_CHECKLIST.md` for a forward-only migration before public beta.

---

### Finding 7: Unapplied Production Migration `20261115000009`
- **Severity:** Medium (Operational)
- **Location:** `supabase/migrations/20261115000009_harden_plpgsql_parameters_and_rpc_safety.sql`
- **Observation:** Migration 9 standardizes PL/pgSQL parameters and column qualification. It is currently unapplied in the production Supabase database. Application code in PR #14 and this audit maintains 100% dual compatibility with both migration 8 and migration 9.
- **Action Required:** Documented in `POST_PR14_MANUAL_DEPLOYMENT_CHECKLIST.md` for manual execution in Supabase SQL Editor.

---

## 3. Verification & Test Evidence Summary

All 7 test suites, TypeScript compilation, ESLint, and Next.js production build were executed:

| Test Suite | Command | Total | Passed | Failed | Status |
|---|---|---|---|---|---|
| Multi-User Publishing Reliability | `npm run test:multi-user` | 28 | 28 | 0 | **PASS** |
| Serverless Scheduler & Health | `npm run test:serverless` | 27 | 27 | 0 | **PASS** |
| Stripe Disablement & Idempotency | `npm run test:disablement` | 44 | 44 | 0 | **PASS** |
| Worker Recovery & Heartbeat | `npm run test:worker` | 16 | 16 | 0 | **PASS** |
| Admin Authorization & Hardening | `npm run test:hardening` | 13 | 13 | 0 | **PASS** |
| Real PostgreSQL Staging Integration | `npm run test:postgres` | 23 | 23 | 0 | **PASS** |
| Core Cryptography & Scheduling | `npm test` | 15 | 15 | 0 | **PASS** |
| TypeScript Typecheck | `npx tsc --noEmit` | — | 0 errors | 0 | **PASS** |
| ESLint | `npm run lint` | — | 0 warnings | 0 | **PASS** |
| Next.js Production Build | `npm run build` | 45 routes | 45 optimized | 0 | **PASS** |

**Total Automated Tests:** 166 passing tests (100% pass rate).
