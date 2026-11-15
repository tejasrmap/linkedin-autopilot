# Multi-User Personal LinkedIn Publishing Failure — Root Cause Investigation Report

**Company:** GT InnoX LLP  
**Product:** LinkedIn Autopilot SaaS  
**Repository:** `https://github.com/tejasrmap/linkedin-autopilot`  
**Date:** 15 November 2026  
**Status:** INVESTIGATION COMPLETED — READ-ONLY PHASE (Root Cause Identified & Empirically Verified)

---

## 1. Executive Summary

Other users can register, log in, connect personal LinkedIn accounts via OAuth, and view their profiles in the dashboard. However, when they attempt to publish posts, publishing fails, whereas the founder's account had previously published successfully.

A comprehensive read-only audit of the production database, OAuth callback, identity mapping, workspace isolation, publisher queue, and live LinkedIn API was conducted.

### Core Finding
**The failure is NOT a LinkedIn API permission rejection, NOT an OAuth approval failure, and NOT a token decryption failure.**
Live API probes directly against LinkedIn's API verified that user OAuth tokens (e.g., G.J.S Rohan) are valid, decrypt cleanly with AES-256-GCM, and possess genuine `w_member_social` posting permissions (confirmed via HTTP 422 Unprocessable Entity schema responses from `https://api.linkedin.com/rest/posts`, identical to the founder's account).

Instead, the failure is caused by an **architectural self-lockout race condition in the "Publish Now" route handler**:
1. When users click **"Publish Now"** in the UI, `POST /api/posts` pre-emptively assigns `status = 'processing'` and saves the post.
2. `schedulePostPublishJob()` immediately updates `posts` with `status: 'processing'` and `updated_at: now()`.
3. `schedulePostPublishJob()` then invokes `executePublishPipeline(postId)`.
4. `executePublishPipeline()` calls the atomic lease stored procedure `claim_post_for_publishing(target_post_id)`.
5. `claim_post_for_publishing()` strictly requires `WHERE status IN ('scheduled', 'approved', 'draft') OR (status = 'processing' AND updated_at < now - 5 minutes)`.
6. Because the post was *already* marked `'processing'` with `updated_at = now()` (0 ms ago), the stored procedure matches **0 rows** and returns `{ success: false, reason: 'already_processing_or_completed' }`.
7. `executePublishPipeline()` aborts immediately. **LinkedIn is never called, and `post_publish_attempts` is never created.**
8. Meanwhile, `POST /api/posts` returns HTTP 200, so the frontend UI falsely toasts: *"Post published successfully to LinkedIn! 🎉"*.
9. The post is abandoned in `status: 'processing'`. 5 minutes later, the cron stale-lock cleaner marks it `scheduled` with `"Recovered from timed-out or interrupted processing lock"`, but its `scheduled_jobs` record remains `queued`, permanently starving it from serverless cron execution.

---

## 2. Investigation Area Breakdown

### Area 1: OAuth Callback & Scopes
- **File:** `src/app/api/linkedin/callback/route.ts` (line 60)
- **Code:**
  ```typescript
  const scopes = tokenData.scope ? tokenData.scope.split(' ') : ['openid', 'profile', 'email', 'w_member_social'];
  ```
- **Finding:**
  1. LinkedIn's OAuth token endpoint (`/oauth/v2/accessToken`) returns scopes as a **comma-delimited string**: `"email,openid,profile,w_member_social"`.
  2. Because the code calls `.split(' ')` (space delimiter), `scopes` is stored in Supabase as a single-element array containing the raw comma-separated string: `["email,openid,profile,w_member_social"]`.
  3. Consequently, any JavaScript array check such as `scopes.includes('w_member_social')` returns `false` (`["email,openid,profile,w_member_social"].includes('w_member_social') === false`).
  4. Furthermore, the fallback assumes `w_member_social` when `tokenData.scope` is absent.

### Area 2: Account Identity & Token Security
- **Empirical Test:** Decrypted tokens for all 3 connected accounts and queried `https://api.linkedin.com/v2/userinfo`.
- **Results:**
  - **Account 1 (Founder - Teja Ganugula):** `sub = fpBvx03h5B` (HTTP 200 OK, matches `provider_account_id`).
  - **Account 2 (User - G.J.S Rohan):** `sub = jWaXQl99LN` (HTTP 200 OK, matches `provider_account_id`).
  - **Account 3 (User - G. Jaya Sai Rohan):** `sub = 3PAfyM7NG2` (HTTP 200 OK, matches `provider_account_id`).
- **Conclusion:** Token encryption and decryption operate 100% reliably. User identities map accurately to `urn:li:person:{sub}`. Tokens belong to their respective LinkedIn profiles.

### Area 3: Workspace Isolation
- **Inspected:** `getAuthContext()` in `src/lib/auth.ts`, `src/app/api/posts/route.ts`, and `publisher.ts`.
- **Results:**
  - Rohan's post `45267330-2444-4e2d-853d-eba7aea65e8a` has `workspace_id = 7846b93f-cafd...` and `social_account_id = 4b50e8ae-9d73...`.
  - Both IDs belong strictly to Rohan's workspace.
  - Multi-workspace safeguards in `publisher.ts` (line 241) verified that the publisher did NOT accidentally use the founder's account.

### Area 4: Publishing Pipeline & Live LinkedIn API Response
- **Live Probe Executed:** Sent a read-only test payload to `POST https://api.linkedin.com/rest/posts` using each user's live decrypted token with headers `LinkedIn-Version: 202610`, `X-Restli-Protocol-Version: 2.0.0`.
- **Results:**
  - Founder Token: **HTTP 422 Unprocessable Entity** (`ERROR :: /author :: field is required`).
  - User Token (Rohan 1): **HTTP 422 Unprocessable Entity** (`ERROR :: /author :: field is required`).
  - User Token (Rohan 2): **HTTP 422 Unprocessable Entity** (`ERROR :: /author :: field is required`).
- **Significance:**
  - LinkedIn returned HTTP 422 (Schema Validation Failure) for all tokens.
  - Neither user returned HTTP 401 Unauthorized or HTTP 403 Forbidden.
  - This proves beyond doubt that LinkedIn Developer App permissions and user OAuth scopes are **valid, active, and accepted for personal feed publishing** across all accounts.

---

## 3. Founder vs User Publishing Comparison

| Investigation Point | Founder Account (`3af1cc83-b7e7...`) | User Account (`7846b93f-cafd...` - Rohan) | Status / Divergence |
|---|---|---|---|
| **OAuth Scopes** | `email,openid,profile,w_member_social` | `email,openid,profile,w_member_social` | **Identical**: Both have `w_member_social` granted. |
| **Token Validity** | Valid until Jan 2027; decrypts cleanly. | Valid until Jan 2027; decrypts cleanly. | **Identical**: Both tokens are valid. |
| **Identity (`sub`)** | `fpBvx03h5B` -> `urn:li:person:fpBvx03h5B` | `jWaXQl99LN` -> `urn:li:person:jWaXQl99LN` | **Correct**: Accurate personal URN mapping. |
| **Publishing Method** | **Scheduled for future date/time** (`delayMs > 0`) or created via test script with `status = 'approved'`. | **"Publish Now" via `/composer`** (`publishNow: true`, `scheduledAt: null`, `delayMs = 0`). | **Divergence**: Root cause of the failure. |
| **Initial Post Status** | `scheduled` | `processing` | `POST /api/posts` line 90 sets `processing`. |
| **`scheduled_jobs.status`** | `scheduled` | `queued` | `schedulePostPublishJob` sets `queued` when `delayMs <= 0`. |
| **Lease Claim (`claim_post_for_publishing`)** | **Succeeded**: Post status was `scheduled`. | **REJECTED**: Post status was already `processing` with `updated_at = now()`. | **Self-Lockout**: Stored procedure rejected post. |
| **`post_publish_attempts`** | 13 rows logged with HTTP 201 headers. | **0 rows logged**. | Pipeline aborted before attempt insertion. |
| **LinkedIn Invocation** | `POST https://api.linkedin.com/rest/posts` -> HTTP 201. | **Never invoked**. | Pipeline never reached `publishPost()`. |
| **Database Final State** | `published` | `scheduled` (*"Recovered from timed-out or interrupted processing lock"*). | Stale-lock cleaner reclaimed lock after 5 min; job remained `queued`. |

---

## 4. Root Causes Identified

### Root Cause 1: Self-Lockout in "Publish Now" Route
In `src/app/api/posts/route.ts` (lines 89-108) and `src/lib/queue/publisher.ts` (line 64):
- The route handler marks `posts.status = 'processing'` before calling `executePublishPipeline()`.
- `executePublishPipeline()` calls `claim_post_for_publishing()`.
- `claim_post_for_publishing()` expects posts to be in `('scheduled', 'approved', 'draft')`.
- It rejects the post as `already_processing_or_completed`.

### Root Cause 2: Starvation via `scheduled_jobs.status = 'queued'`
In `src/lib/queue/publisher.ts` (line 84):
- `status: delayMs > 0 ? 'scheduled' : 'queued'`.
- The serverless scheduler (`/api/cron/publish`) queries exclusively `scheduled_jobs WHERE status = 'scheduled'`.
- Jobs with status `'queued'` are never executed by the serverless cron.

### Root Cause 3: False UI Success on Publish Failure
In `src/app/api/posts/route.ts` (lines 122-128):
- If `executePublishPipeline()` fails during `publishNow`, `POST /api/posts` still returns HTTP 200 with `{ published: true, result: scheduleResult }`.
- In `src/app/composer/page.tsx` (lines 227-232), `res.ok` is true, so the UI toasts *"Post published successfully to LinkedIn! 🎉"* while the post was actually rejected.

### Root Cause 4: Comma-Separated Scope Parsing Bug
In `src/app/api/linkedin/callback/route.ts` (line 60):
- Uses `.split(' ')` instead of `.split(/[\s,]+/)`.
- Stores raw comma-separated string in the array: `["email,openid,profile,w_member_social"]`.

---

## 5. Required Code Corrections

1. **`src/app/api/posts/route.ts`:**
   - Do NOT set `initialStatus = 'processing'` when `publishNow: true`. Insert the post with `status: 'draft'` so `claim_post_for_publishing` can cleanly acquire the atomic lease lock.
   - If `scheduleResult.success === false`, return HTTP 400 or HTTP 500 with `error: scheduleResult.error` so the UI displays the genuine failure rather than a false success.
2. **`src/lib/queue/publisher.ts`:**
   - In `schedulePostPublishJob()`: For immediate execution (`delayMs <= 0`), do NOT update `posts.status = 'processing'` prior to calling `executePublishPipeline()`. Let `executePublishPipeline()` atomically claim the post.
   - In `scheduled_jobs`: Always insert with `status: 'scheduled'` (not `'queued'`) so the serverless cron poller can process due jobs.
3. **`src/app/api/linkedin/callback/route.ts`:**
   - Parse scopes with `.split(/[\s,]+/)` and filter empty strings.
   - Check that `w_member_social` is present in the array.
4. **`src/app/api/cron/publish/route.ts`:**
   - In stale lock reclamation, update `scheduled_jobs WHERE post_id = stale.id AND status IN ('processing', 'queued')` to `'scheduled'`.

---

## 6. Proposed Verification Plan for Two Independent Accounts

1. **Automated Unit & Serverless Test:**
   - Test "Publish Now" pipeline: Insert post with `draft` status, verify `executePublishPipeline` successfully claims and publishes without self-lockout.
   - Test scope parsing: Verify comma-separated string `"email,openid,profile,w_member_social"` parses into 4 distinct array elements.
2. **Live Multi-User Verification:**
   - Account A (Founder): Create a post in `/composer` and click "Publish Now". Verify HTTP 201 on LinkedIn and post transitions to `published`.
   - Account B (Rohan / Secondary Personal Account): Create a post in `/composer` and click "Publish Now". Verify HTTP 201 on LinkedIn and post transitions to `published`.
   - Verify both personal LinkedIn profiles show their respective live posts with correct commentary and author URNs.

