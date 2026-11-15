# LinkedIn Autopilot — Known Issues, Technical Debt & Risk Register

**Company:** GT InnoX LLP  
**Product:** LinkedIn Autopilot SaaS  
**Document:** `KNOWN_ISSUES_AND_RISKS.md`  
**Classification:** Engineering & Architecture Risk Log  

---

## 1. Risk Matrix & Severity Summary

| Issue ID | Domain | Severity | Production Change Required? | Status |
| :---: | :--- | :---: | :---: | :---: |
| **SEC-001** | PostgREST Database-Level RLS Permissiveness | **CRITICAL** | **YES (Migration)** | Open |
| **UX-001** | Middleware Blocks Public Access to `/privacy` & `/terms` | **HIGH** | **YES (Code Deploy)** | Open |
| **API-001** | Cross-Tenant Post Analytics Overview Aggregation | **HIGH** | **YES (Code Deploy)** | Open |
| **OPS-001** | Production Application of Migration 9 Pending | **MEDIUM** | **YES (SQL Editor)** | Pending Execution |
| **MED-001** | Silent DB Record Creation on Supabase Storage Failure | **MEDIUM** | **YES (Code Deploy)** | Open |
| **SEC-002** | Insecure Fallback Key in Token Encryption | **MEDIUM** | **YES (Code Deploy)** | Open |
| **DAT-001** | Potential Workspace Slug Millisecond Collision | **LOW** | **YES (Code Deploy)** | Open |
| **EXT-001** | LinkedIn Organization Page Integration Frozen | **LOW** | **NO (Design Decision)** | Intended for Beta |
| **BIL-001** | Stripe Billing & Paid Subscriptions Disabled | **LOW** | **NO (Design Decision)** | Intended for Beta |

---

## 2. Detailed Findings & Risk Analysis

---

### SEC-001: PostgREST Database-Level RLS Permissiveness
- **Severity:** **CRITICAL**
- **Exact File / Policy Involved:**  
  `supabase/migrations/20261113000001_fix_dev_and_service_rls.sql` (lines 28, 32, 36, 39, 42, 45)  
  Policies: `"Allow all on social_accounts"`, `"Allow all on posts"`, `"Allow all on scheduled_jobs"`, `"Allow all on notifications"`, `"Allow all on post_analytics"`, `"Allow all on post_publish_attempts"`.
- **Evidence:**
  ```sql
  CREATE POLICY "Allow all on social_accounts" ON public.social_accounts FOR ALL USING (true) WITH CHECK (true);
  CREATE POLICY "Allow all on posts" ON public.posts FOR ALL USING (true) WITH CHECK (true);
  ```
- **User Impact:**  
  While Next.js route handlers enforce workspace isolation at the application layer, the Supabase PostgREST HTTP endpoint is directly exposed. Any authenticated or anonymous user with the public `NEXT_PUBLIC_SUPABASE_ANON_KEY` can make direct REST requests to `https://<ref>.supabase.co/rest/v1/social_accounts` and `posts` and dump all records across all workspaces, including encrypted tokens and post content.
- **Recommended Remediation:**  
  Apply a forward-only migration that drops the `"Allow all on ..."` policies and restores strict multi-tenant checks (`public.is_workspace_member(workspace_id)`).
- **Production Changes Required:** **YES (Database Migration via SQL Editor)**.

---

### UX-001: Middleware Blocks Public Access to `/privacy` & `/terms`
- **Severity:** **HIGH**
- **Exact File / Function Involved:**  
  `src/middleware.ts` (lines 69-75)
- **Evidence:**
  ```ts
  const isAuthPage = path.startsWith('/login') || path.startsWith('/register');
  if (!user && !isAuthPage) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }
  ```
- **User Impact:**  
  Unauthenticated visitors who click "Privacy Policy" or "Terms of Service" on the login/register screens or external links are automatically redirected to `/login`. LinkedIn Developer App Reviewers will fail app compliance verification if the public Privacy Policy URL is not viewable without authentication.
- **Recommended Remediation:**  
  Expand the public path whitelist in `src/middleware.ts`:
  ```ts
  const isPublicPage =
    path === '/' ||
    path.startsWith('/privacy') ||
    path.startsWith('/terms') ||
    path.startsWith('/login') ||
    path.startsWith('/register');
  ```
- **Production Changes Required:** **YES (Code modification & Vercel deployment)**.

---

### API-001: Cross-Tenant Post Analytics Overview Aggregation
- **Severity:** **HIGH**
- **Exact File / Function Involved:**  
  `src/app/api/analytics/overview/route.ts` (lines 33-35)
- **Evidence:**
  ```ts
  // 3. Post analytics records
  const { data: analyticsRows } = await admin
    .from('post_analytics')
    .select('metric_name, metric_value');
  ```
- **User Impact:**  
  The overview analytics query queries `post_analytics` using the administrative service-role client without filtering by `workspace_id` or the caller's post IDs. The impressions, reactions, comments, and reposts aggregated and returned to the caller's dashboard represent the sum across **all customers on the platform**, leaking platform-wide activity levels.
- **Recommended Remediation:**  
  Filter `post_analytics` using the post IDs belonging to the authenticated workspace:
  ```ts
  const postIds = allPosts.map((p) => p.id);
  const { data: analyticsRows } = postIds.length > 0
    ? await admin.from('post_analytics').select('metric_name, metric_value').in('post_id', postIds)
    : { data: [] };
  ```
- **Production Changes Required:** **YES (Code modification & Vercel deployment)**.

---

### OPS-001: Production Application of Migration 9 Pending
- **Severity:** **MEDIUM**
- **Exact File / Function Involved:**  
  `supabase/migrations/20261115000009_harden_plpgsql_parameters_and_rpc_safety.sql`  
  Functions: `claim_post_for_publishing`, `finalize_post_publishing`, `handle_publishing_failure_and_retry`.
- **Evidence:**  
  The migration was corrected to resolve PostgreSQL error `42P13: cannot change name of input parameter "target_post_id"` and enforce atomic `scheduled_jobs` row verification, but has not yet been executed in the production Supabase SQL Editor.
- **User Impact:**  
  Until applied, production runs older stored procedure bytecode that does not verify `ROW_COUNT` when updating `scheduled_jobs` during claims.
- **Recommended Remediation:**  
  Open Supabase SQL Editor and execute the corrected SQL script.
- **Production Changes Required:** **YES (Execute SQL in Supabase)**.

---

### MED-001: Silent DB Record Creation on Supabase Storage Failure
- **Severity:** **MEDIUM**
- **Exact File / Function Involved:**  
  `src/app/api/media/upload/route.ts` (lines 47-50)
- **Evidence:**
  ```ts
  if (uploadErr) {
    // If bucket does not exist or storage error, handle cleanly
    console.warn('Storage upload note:', uploadErr.message);
  }
  // Continues to insert into media_assets table with publicUrl pointing to nonexistent binary!
  ```
- **User Impact:**  
  If the Supabase `post-assets` storage bucket is full, unavailable, or encounters permission issues, the API does not fail the upload. It creates a database asset entry with a broken URL, which later causes publishing failures when LinkedIn attempts to fetch the image/video binary.
- **Recommended Remediation:**  
  Return HTTP 500 immediately if `uploadErr` is returned from `admin.storage.upload()`.
- **Production Changes Required:** **YES (Code modification & Vercel deployment)**.

---

### SEC-002: Insecure Fallback Key in Token Encryption
- **Severity:** **MEDIUM**
- **Exact File / Function Involved:**  
  `src/lib/encryption.ts` (line 11)
- **Evidence:**
  ```ts
  function getEncryptionKey(): Buffer {
    const secret = process.env.TOKEN_ENCRYPTION_KEY || 'default-super-secret-key-32-chars!!';
    return crypto.createHash('sha256').update(secret).digest();
  }
  ```
- **User Impact:**  
  If `TOKEN_ENCRYPTION_KEY` is accidentally omitted in production environment variables, the system silently encrypts and stores OAuth tokens using the publicly known default fallback string instead of failing closed.
- **Recommended Remediation:**  
  Throw an error in production if `TOKEN_ENCRYPTION_KEY` is undefined or contains the default fallback string.
- **Production Changes Required:** **YES (Code modification & Vercel deployment)**.

---

### DAT-001: Potential Workspace Slug Millisecond Collision
- **Severity:** **LOW**
- **Exact File / Function Involved:**  
  `src/lib/auth.ts` (line 114)
- **Evidence:**
  ```ts
  slug: `ws-${Date.now().toString(36)}`,
  ```
- **User Impact:**  
  If two users register within the same millisecond, `Date.now().toString(36)` generates identical slug strings. The unique constraint on `workspaces.slug` will abort the second user's registration with a database unique violation.
- **Recommended Remediation:**  
  Append random bytes: `ws-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`.
- **Production Changes Required:** **YES (Code modification & Vercel deployment)**.

---

### EXT-001: LinkedIn Organization Page Integration Frozen
- **Severity:** **LOW (Design Decision)**
- **User Impact:**  
  Users cannot publish to LinkedIn Company Pages during Beta Cohort 1.
- **Status:** Intentional. Company page publishing requires LinkedIn Community Management API partner approval. UI cleanly labels organization linking as pending approval.

---

### BIL-001: Stripe Billing & Paid Subscriptions Disabled
- **Severity:** **LOW (Design Decision)**
- **User Impact:**  
  Users cannot enter credit cards or purchase paid plans. All users are placed on the generous Free Starter tier.
- **Status:** Intentional. Stripe billing is disabled for Beta (`isBillingEnabled() === false`).

