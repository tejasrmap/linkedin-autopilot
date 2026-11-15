# LinkedIn Autopilot — Security & Row Level Security (RLS) Deep-Dive Audit

**Company:** GT InnoX LLP  
**Repository:** https://github.com/tejasrmap/linkedin-autopilot  
**Document:** `SECURITY_AND_RLS_AUDIT.md`  
**Classification:** Confidential Security Evaluation  

---

## 1. Executive Summary

This security audit inspects the multi-tenant isolation, cryptographic posture, and database authorization boundaries of LinkedIn Autopilot. 

**Key Takeaways:**
1. **Server Route Handlers Are Secure:** Next.js route handlers consistently resolve the caller's workspace membership via `getAuthContext()` and filter database operations with `.eq('workspace_id', auth.workspaceId)`. API-level cross-tenant IDOR attacks are blocked and validated by tests.
2. **Database RLS Has a Critical Exposure via PostgREST:** Migration `20261113000001_fix_dev_and_service_rls.sql` instituted `USING (true) WITH CHECK (true)` policies on core multi-tenant tables. Any external user with the public `NEXT_PUBLIC_SUPABASE_ANON_KEY` can query PostgREST directly from their browser or terminal to bypass Next.js route handlers and read all records.
3. **Cryptographic Storage Is Structurally Sound:** LinkedIn OAuth tokens are encrypted using AES-256-GCM with dynamic 16-byte initialization vectors and 16-byte authentication tags. However, `TOKEN_ENCRYPTION_KEY` contains an insecure dev fallback that must be strictly enforced in production.

---

## 2. Table-by-Table Row Level Security (RLS) Audit

| Table | RLS Enabled? | Current Active Policy | PostgREST Direct Access Risk | Severity |
| :--- | :---: | :--- | :--- | :---: |
| `public.profiles` | YES | `Users can view profiles in their workspaces or own` / `update own profile` | Secure: Scoped to user ID and workspace membership. | Low |
| `public.workspaces` | YES | `Members can view workspaces` / `Owners can update` | Secure: Uses `is_workspace_member(id)`. | Low |
| `public.workspace_members`| YES | `Members can view membership` / `Admins/Owners manage` | Secure: Scoped to user's workspaces. | Low |
| `public.social_accounts` | YES | **`Allow all on social_accounts` (`USING (true)`)** | **CRITICAL: Full leak of foreign accounts, provider IDs, profile names, and encrypted tokens.** | **CRITICAL** |
| `public.posts` | YES | **`Allow all on posts` (`USING (true)`)** | **CRITICAL: Full read/write access to all customer posts across all workspaces.** | **CRITICAL** |
| `public.scheduled_jobs` | YES | **`Allow all on scheduled_jobs` (`USING (true)`)** | **CRITICAL: Full access to scheduler queues, attempts, and error logs.** | **CRITICAL** |
| `public.notifications` | YES | **`Allow all on notifications` (`USING (true)`)** | **HIGH: Read access to user notifications, post alerts, and private emails.** | **HIGH** |
| `public.post_analytics` | YES | **`Allow all on post_analytics` (`USING (true)`)** | **HIGH: Unrestricted access to post analytics metrics.** | **HIGH** |
| `public.post_publish_attempts`| YES | **`Allow all on post_publish_attempts` (`USING (true)`)** | **HIGH: Full leak of provider post URNs and raw LinkedIn API response JSON.** | **HIGH** |
| `public.media_assets` | YES | `Members can view/insert media assets` | Secure: Scoped by `workspace_id`. | Low |
| `public.ai_generations` | YES | `Members can view/insert ai generations` | Secure: Scoped by `workspace_id`. | Low |
| `public.content_templates`| YES | `Members can view/create templates` | Secure: Scoped by `workspace_id`. | Low |
| `public.brand_settings` | YES | `Members can view / Admins manage brand settings` | Secure: Scoped by `workspace_id`. | Low |
| `public.subscriptions` | YES | `Members can view subscription` | Secure: Scoped by `workspace_id`. | Low |
| `public.support_tickets` | YES | `Users can view/insert workspace tickets` | Secure: Scoped to workspace + superadmin bypass. | Low |
| `public.stripe_events` | YES | `Service role full access` / `Members view workspace` | Secure: Read-only to workspace, write strictly service_role. | Low |
| `public.worker_heartbeats`| YES | `Service role full access on worker_heartbeats` | Secure: Service role only. | Low |
| `public.scheduler_execution_logs` | YES | `Allow service_role full access` | Secure: Service role only. | Low |

---

## 3. Exploit Scenario: PostgREST Direct Client Access

### Vulnerability Mechanism
In `supabase/migrations/20261113000001_fix_dev_and_service_rls.sql`:
```sql
-- Lines 26-33:
DROP POLICY IF EXISTS "Admins/Owners can manage social accounts" ON public.social_accounts;
DROP POLICY IF EXISTS "Members can view social accounts" ON public.social_accounts;
CREATE POLICY "Allow all on social_accounts" ON public.social_accounts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Editors/Admins/Owners can create/edit posts" ON public.posts;
DROP POLICY IF EXISTS "Members can view posts" ON public.posts;
CREATE POLICY "Allow all on posts" ON public.posts FOR ALL USING (true) WITH CHECK (true);
```

### Attack Vector
1. Attacker signs up for an account on `https://autopilot.gtinnox.in`.
2. Attacker opens browser DevTools console or uses `curl`.
3. Attacker extracts `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publicly exposed by Next.js client bundle).
4. Attacker executes:
   ```bash
   curl -H "apikey: <NEXT_PUBLIC_SUPABASE_ANON_KEY>" \
        -H "Authorization: Bearer <USER_JWT>" \
        "https://<project-ref>.supabase.co/rest/v1/social_accounts?select=*"
   ```
5. Because the policy is `FOR ALL USING (true) WITH CHECK (true)`, PostgreSQL evaluates the condition as true for every row in the table, returning all social accounts of all customers, including `encrypted_access_token`.

### Proposed Forward-Only RLS Hardening SQL
```sql
-- Forward-only Migration: Restore Strict Multi-Tenant Isolation
DROP POLICY IF EXISTS "Allow all on social_accounts" ON public.social_accounts;
CREATE POLICY "Members can view social accounts" ON public.social_accounts
    FOR SELECT TO authenticated
    USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Admins/Owners can manage social accounts" ON public.social_accounts
    FOR ALL TO authenticated
    USING (public.get_workspace_role(workspace_id) IN ('owner', 'admin'))
    WITH CHECK (public.get_workspace_role(workspace_id) IN ('owner', 'admin'));

DROP POLICY IF EXISTS "Allow all on posts" ON public.posts;
CREATE POLICY "Members can view posts" ON public.posts
    FOR SELECT TO authenticated
    USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Editors/Admins/Owners can manage posts" ON public.posts
    FOR ALL TO authenticated
    USING (public.get_workspace_role(workspace_id) IN ('owner', 'admin', 'editor'))
    WITH CHECK (public.get_workspace_role(workspace_id) IN ('owner', 'admin', 'editor'));

DROP POLICY IF EXISTS "Allow all on notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Allow all on scheduled_jobs" ON public.scheduled_jobs;
CREATE POLICY "Members can view jobs" ON public.scheduled_jobs
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.posts 
        WHERE posts.id = scheduled_jobs.post_id 
          AND public.is_workspace_member(posts.workspace_id)
    ));

DROP POLICY IF EXISTS "Allow all on post_analytics" ON public.post_analytics;
CREATE POLICY "Members can view post analytics" ON public.post_analytics
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.posts 
        WHERE posts.id = post_analytics.post_id 
          AND public.is_workspace_member(posts.workspace_id)
    ));

DROP POLICY IF EXISTS "Allow all on post_publish_attempts" ON public.post_publish_attempts;
CREATE POLICY "Members can view publish attempts" ON public.post_publish_attempts
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.posts 
        WHERE posts.id = post_publish_attempts.post_id 
          AND public.is_workspace_member(posts.workspace_id)
    ));
```

---

## 4. Cryptographic Security & Secrets Management

### A. AES-256-GCM Implementation
- **Cipher:** `aes-256-gcm`.
- **Key Derivation:** `crypto.createHash('sha256').update(secret).digest()`. Guarantees exact 32 bytes (256 bits).
- **IV Generation:** `crypto.randomBytes(16)` per encryption call. Zero IV reuse.
- **Integrity Tag:** 16-byte authenticated tag verified with `decipher.setAuthTag(authTag)`.
- **Finding (Medium Severity):** `src/lib/encryption.ts` line 11 provides a default fallback string:
  ```ts
  const secret = process.env.TOKEN_ENCRYPTION_KEY || 'default-super-secret-key-32-chars!!';
  ```
  **Remediation:** In production (`process.env.NODE_ENV === 'production'`), `getEncryptionKey()` must throw a fatal configuration error if `TOKEN_ENCRYPTION_KEY` is undefined or contains the default fallback string.

### B. CRON_SECRET & Webhook Authentication
- **CRON_SECRET:** In `src/app/api/cron/publish/route.ts`, constant-time comparison is used to validate the `Authorization: Bearer <secret>` header. Rejects secret passed in URL parameters to avoid logging secrets in server access logs. Fails closed with HTTP 500 if unset.
- **Stripe Webhook Signature:** In `src/app/api/billing/webhook/route.ts`, signature verification uses `stripe.webhooks.constructEvent(body, signature, secret)`. Requests missing or with invalid signatures are rejected with HTTP 400.

---

## 5. Multi-Tenant API Route Authorization Audit

| Route Handler | Method | Workspace Verification | Role Check | IDOR Protection Status |
| :--- | :---: | :--- | :--- | :---: |
| `/api/posts` | GET | `.eq('workspace_id', auth.workspaceId)` | Any Member | SECURE |
| `/api/posts` | POST | Enforced in body insert | Owner, Admin, Editor | SECURE |
| `/api/posts/[id]` | GET | `.eq('workspace_id', auth.workspaceId)` | Any Member | SECURE |
| `/api/posts/[id]` | PATCH | `.eq('workspace_id', auth.workspaceId)` | Owner, Admin, Editor | SECURE |
| `/api/posts/[id]` | DELETE| `.eq('workspace_id', auth.workspaceId)` | Owner, Admin, Editor | SECURE |
| `/api/posts/[id]/publish` | POST | `.eq('workspace_id', auth.workspaceId)` | Owner, Admin, Editor, Approver | SECURE |
| `/api/posts/[id]/schedule`| POST | `.eq('workspace_id', auth.workspaceId)` | Owner, Admin, Editor, Approver | SECURE |
| `/api/posts/[id]/cancel` | POST | `.eq('workspace_id', auth.workspaceId)` | Owner, Admin, Editor | SECURE |
| `/api/posts/bulk` | POST | Default & item account workspace check | Owner, Admin, Editor | SECURE |
| `/api/linkedin/accounts` | GET | `.eq('workspace_id', auth.workspaceId)` | Any Member | SECURE |
| `/api/linkedin/disconnect`| POST | `.eq('workspace_id', auth.workspaceId)` | Owner, Admin, Editor | SECURE |
| `/api/workspaces/members` | GET | `.eq('workspace_id', auth.workspaceId)` | Any Member | SECURE |
| `/api/workspaces/members` | POST | `.eq('workspace_id', auth.workspaceId)` | Owner, Admin | SECURE |
| `/api/workspaces/members` | DELETE| `.eq('workspace_id', auth.workspaceId)` | Owner, Admin | SECURE |
| `/api/media` | GET | `.eq('workspace_id', auth.workspaceId)` | Any Member | SECURE |
| `/api/media/upload` | POST | Enforced storage path & DB insert | Any Member | SECURE |
| `/api/templates` | GET | `.eq('workspace_id', auth.workspaceId)` | Any Member | SECURE |
| `/api/templates` | POST | Enforced in body insert | Any Member | SECURE |
| `/api/analytics/overview` | GET | Posts and Accounts filtered by workspace | Any Member | **PARTIAL LEAK: `post_analytics` unconstrained** |

---

## 6. Security Audit Summary & Gate Sign-off

- **Application Backend Authorization:** PASSED (95%).
- **Database PostgREST RLS:** FAILED (Requires forward-only migration before public beta).
- **Token Cryptography:** PASSED with recommendation to enforce strict env validation.
- **CSRF & OAuth Validation:** PASSED.
- **Admin Superuser Gate:** PASSED (Strict fail-closed on `ADMIN_EMAILS`).

