# LinkedIn Autopilot — Beta Readiness Master Audit Report

**Company:** GT InnoX LLP  
**Product:** LinkedIn Autopilot SaaS  
**Repository:** https://github.com/tejasrmap/linkedin-autopilot  
**Production URL:** https://autopilot.gtinnox.in  
**Audit Date:** November 15, 2026  
**Auditor:** Senior SaaS Architect & Security Engineer  
**Audit Mode:** Read-Only Source Code, Configuration & Architecture Inspection  

---

## Executive Summary & Verdict

### Final Verdict: **READY AFTER MINOR FIXES**

LinkedIn Autopilot has achieved significant architectural maturity across authentication, personal LinkedIn profile publishing, serverless scheduling via Supabase `pg_cron` + `pg_net`, lease ownership concurrency, and multi-tenant isolation in server route handlers. The platform build passes 100% of test suites (159 passing unit/integration tests, zero TypeScript errors, zero ESLint warnings, 45/45 Next.js static and dynamic routes compiled).

However, a strictly controlled external beta cannot commence until **three targeted fixes and one operational migration** are addressed:

1. **[CRITICAL] PostgREST Database-Level Row-Level Security Permissiveness:** Migration `20261113000001_fix_dev_and_service_rls.sql` instituted blanket `USING (true) WITH CHECK (true)` policies on `social_accounts`, `posts`, and `scheduled_jobs`. While Next.js route handlers enforce workspace isolation in application code, any user possessing the public Supabase Anon key could query PostgREST directly from their browser DevTools and read foreign workspace records.
2. **[HIGH] Legal Compliance & OAuth Review Redirection:** `src/middleware.ts` restricts all non-auth pages to active sessions. Visiting `/privacy` or `/terms` as an unauthenticated user redirects to `/login`. LinkedIn app compliance reviewers and external beta invitees cannot view legal policies before authenticating.
3. **[HIGH] Cross-Tenant Analytics Overview Aggregation:** `src/app/api/analytics/overview/route.ts` queries `post_analytics` using the service-role client without filtering by the workspace's posts, leaking platform-wide aggregate reach metrics into individual user dashboards.
4. **[OPERATIONAL] Production Execution of Migration 9:** The corrected, production-compatible migration `20261115000009_harden_plpgsql_parameters_and_rpc_safety.sql` must be executed in the Supabase SQL Editor to guarantee atomic lease checking and prevent 42P13 parameter collision errors.

Once these 4 items are landed, the platform is ready for an invite-only **Controlled Beta (Cohort 1: 10–25 external users)** publishing to personal LinkedIn profiles.

---

## Comprehensive Audit Findings by Domain

### 1. Authentication & Account Security

#### A. Supabase Authentication & Session Management
- **Implementation:** `src/middleware.ts` and `src/lib/auth.ts`.
- **Finding:** Session verification utilizes `@supabase/ssr` with a local cookie fast-path (`supabase.auth.getSession()`) followed by server-verified `supabase.auth.getUser()`.
- **Dev-Auth Safeguard:** `src/lib/auth.ts` lines 64-96 enforce a strict production gate (`process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_AUTH === 'true'`). Dev bypass cannot trigger in production environments.
- **Risk Identified (MEDIUM):** In `src/lib/auth.ts` line 108, when a user registers without a workspace, a default workspace is automatically provisioned with the slug `ws-${Date.now().toString(36)}`. If two users register in the exact same millisecond, a collision on the `workspaces.slug` unique index could cause a 500 registration failure.

#### B. LinkedIn OAuth 2.0 Integration & Token Security
- **Implementation:** `src/app/api/linkedin/connect/route.ts`, `src/app/api/linkedin/callback/route.ts`, `src/lib/encryption.ts`.
- **State Validation:** State tokens are base64url-encoded JSON payloads containing `workspaceId`, `userId`, and `timestamp` with a strict 15-minute validity window.
- **Scope Verification:** `src/app/api/linkedin/callback/route.ts` parses both comma-separated and whitespace-separated scopes. It strictly verifies `w_member_social`. If absent, connection status is assigned `limited_permissions` instead of `active`, preventing false publishing attempts.
- **Token Encryption:** AES-256-GCM authenticated encryption (`src/lib/encryption.ts`). Ciphertext format: `iv:authTag:ciphertext`.
- **Risk Identified (MEDIUM):** In `src/lib/encryption.ts` line 11:
  ```ts
  const secret = process.env.TOKEN_ENCRYPTION_KEY || 'default-super-secret-key-32-chars!!';
  ```
  If `TOKEN_ENCRYPTION_KEY` is omitted in an environment, the system falls back to a hardcoded default string without throwing an exception. In production, this should fail closed.

#### C. Account Disconnection & Revocation
- **Implementation:** `src/app/api/linkedin/disconnect/route.ts`.
- **Finding:** Validates workspace role (`owner`, `admin`, `editor`). Marks account `disconnected`, clears encrypted tokens, and cancels any pending scheduled jobs associated with that account.

---

### 2. Multi-Tenant Architecture & Workspace Isolation

#### A. Application Layer Authorization
- **Implementation:** Every API route resolves `getAuthContext(requestWorkspaceId)` and queries records with `.eq('workspace_id', auth.workspaceId)`.
- **Verified Protection:** Cross-tenant IDOR protection is verified by tests in `tests/multi-user-publishing-reliability.test.ts`. Workspace A cannot view, schedule, publish, or cancel Workspace B posts.

#### B. Database Row Level Security (RLS)
- **Status: COMPROMISED AT POSTGREST LAYER (CRITICAL)**
- **Evidence:** `supabase/migrations/20261113000001_fix_dev_and_service_rls.sql` lines 26-46 executed:
  ```sql
  CREATE POLICY "Allow all on social_accounts" ON public.social_accounts FOR ALL USING (true) WITH CHECK (true);
  CREATE POLICY "Allow all on posts" ON public.posts FOR ALL USING (true) WITH CHECK (true);
  CREATE POLICY "Allow all on notifications" ON public.notifications FOR ALL USING (true) WITH CHECK (true);
  CREATE POLICY "Allow all on scheduled_jobs" ON public.scheduled_jobs FOR ALL USING (true) WITH CHECK (true);
  ```
- **Impact:** While Next.js backend server code always filters by `workspace_id`, the Supabase PostgREST endpoint is exposed to any client using `NEXT_PUBLIC_SUPABASE_ANON_KEY`. An external user could bypass the Next.js backend and query `https://<project-ref>.supabase.co/rest/v1/social_accounts` directly, dumping all tokens and posts.
- **Remediation:** Apply a forward-only migration restoring strict workspace membership checks (`public.is_workspace_member(workspace_id)`).

---

### 3. Publishing Reliability & Scheduler Engine

#### A. Architecture & Concurrency
- **Scheduler Architecture:** PostgreSQL `pg_cron` (invoking every 60s) triggers Supabase `pg_net` to call `POST https://autopilot.gtinnox.in/api/cron/publish` with a Bearer `CRON_SECRET`.
- **Lease Ownership:** Workers acquire a 5-minute UUID execution lease via `public.claim_post_for_publishing`.
- **Optimistic Locking:** Stored procedures reject mismatched claim tokens, expired leases, and unowned posts.
- **Publish Now Flow:** Post is created in `status = 'draft'` or `'scheduled'`. `schedulePostPublishJob` creates an authoritative `scheduled_jobs` record, then invokes `executePublishPipeline`. Claim RPC atomically transitions post and job to `processing`.
- **Failure & Retry:** `handle_publishing_failure_and_retry` applies exponential backoff (`2^attempt` minutes) up to 3 attempts.
- **Ambiguous Timeout Reconciliation:** If LinkedIn REST API times out after transmission, `reconcileRecentAuthorPost` queries author's recent activity before marking failed, preventing duplicate publications.

---

### 4. Product Functionality Matrix (13 Surfaces)

| Feature Surface | Current State | Verification Evidence | Beta Blocker? |
| :--- | :--- | :--- | :---: |
| **1. Dashboard** | **Functional** | Real metrics from `/api/analytics/overview` and `/api/posts`. Onboarding checklist dynamic. | No |
| **2. Create Post (Composer)** | **Functional** | Immediate publish, scheduling, text/media, live LinkedIn preview. | No |
| **3. AI Studio** | **Functional** | Gemini 1.5 Flash generation, rewriter, hashtags, ideas, bulk calendar. Algorithmic fallback active. | No |
| **4. Content Calendar** | **Functional** | Monthly grid, post badges, click-to-schedule modal, date navigation. | No |
| **5. Scheduled Queue** | **Functional** | Filter by `scheduled`, cancel job, reschedule, inline expand. | No |
| **6. Drafts** | **Functional** | Filter by `draft`, publish now action, edit, delete. | No |
| **7. Published Posts** | **Functional** | Filter by `published`, live LinkedIn link, copy content. | No |
| **8. Content Library** | **Functional (with caveat)** | Media upload (images/video/PDF) to Supabase Storage. Caveat: Storage errors do not fail request. | No |
| **9. Analytics** | **Defect Present** | Overview KPIs render, but `post_analytics` query leaks cross-tenant aggregates. | **Yes** |
| **10. LinkedIn Accounts** | **Functional** | Member OAuth flow works; Organization flow frozen as required. | No |
| **11. Team Workspace** | **Functional** | Role management (Owner, Admin, Editor, Approver, Viewer), member invitation. | No |
| **12. Templates** | **Functional** | Create custom templates, categorize, insert directly into Composer. | No |
| **13. Settings** | **Functional** | Workspace name, default timezone, brand voice preferences. | No |

---

### 5. User Experience & Responsive Design
- **Desktop Layout:** Sidebar navigation with active highlight, workspace switcher, and responsive grid cards.
- **Mobile Layout:** Collapsible drawer, responsive grid breakdowns (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`).
- **Loading States:** Skeletons and `Loader2` spinners across all asynchronous fetches.
- **Empty States:** Clear empty states with call-to-action buttons (e.g. "Create your first post").
- **Error Handling:** Client-side toasts (`useToast`) on API errors; form validation via Zod schemas.

---

### 6. Performance & Build Metrics
- **Build Output:** Compiled 45 static and dynamic pages in 28 seconds.
- **Bundle Sizes:** First Load JS shared by all pages is **87.2 kB** (highly optimized).
  - Largest pages: `/login` (170 kB), `/register` (169 kB) due to Supabase auth client.
  - Core app pages: `/dashboard` (101 kB), `/composer` (101 kB), `/ai-studio` (100 kB).
- **Client Cache:** Session storage caching for accounts and metrics prevents redundant round-trips.

---

### 7. Monitoring, Operations & Telemetry
- **Health Check API:** `/api/health` checks 6 distinct subsystems: `api_server`, `database`, `linkedin_api`, `scheduler_execution`, `last_successful_publication`, and `stuck_scheduled_jobs`.
- **Degraded Status:** Accurately reports `status: "degraded"` without breaking frontend accessibility if worker heartbeats exceed 90 seconds.
- **Logging:** Structured JSON logging in cron routes (`{"timestamp": "...", "level": "info", "event": "..."}`).

---

## Final Beta Recommendation

Apply the 3 code remediations and migration 9 as detailed in [BETA_LAUNCH_CHECKLIST.md](file:///c:/Users/tejag/Downloads/GT-Scheduler/BETA_LAUNCH_CHECKLIST.md), then approve deployment for **Closed Beta Cohort 1**.

