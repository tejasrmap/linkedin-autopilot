# RLS HARDENING DEPLOYMENT GUIDE
**Product:** LinkedIn Autopilot SaaS  
**Migration File:** `supabase/migrations/20261115000010_strict_workspace_rls_hardening.sql`  
**Target Environment:** Production Supabase PostgreSQL Database  
**Author:** Staff Security & Database Engineer (GT InnoX LLP)  
**Date:** November 15, 2026  

---

## 1. Why Migration 10 is Required

During the pre-beta security audit, inspection of the existing database migration history revealed that migration `20261113000001_fix_dev_and_service_rls.sql` introduced blanket permissive policies:
```sql
CREATE POLICY "Allow all on social_accounts" ON public.social_accounts FOR ALL USING (true);
CREATE POLICY "Allow all on posts" ON public.posts FOR ALL USING (true);
CREATE POLICY "Allow all on scheduled_jobs" ON public.scheduled_jobs FOR ALL USING (true);
CREATE POLICY "Allow all on notifications" ON public.notifications FOR ALL USING (true);
CREATE POLICY "Allow all on post_analytics" ON public.post_analytics FOR ALL USING (true);
CREATE POLICY "Allow all on post_publish_attempts" ON public.post_publish_attempts FOR ALL USING (true);
```
While intended for rapid local development, these policies completely bypass tenant boundaries for `anon` and `authenticated` roles connecting directly through Supabase PostgREST client libraries.

Migration `20261115000010_strict_workspace_rls_hardening.sql` safely drops these open policies and establishes strict, defense-in-depth Row Level Security based on workspace membership, role authorization, and engine ledger protection.

---

## 2. Pre-Deployment Verification

Before applying Migration 10, open the Supabase SQL Editor and run the following query to inspect existing active policies on the target tables:

```sql
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename IN (
    'social_accounts',
    'posts',
    'scheduled_jobs',
    'notifications',
    'post_analytics',
    'post_publish_attempts',
    'media_assets',
    'ai_generations',
    'content_templates',
    'brand_settings',
    'support_tickets'
)
ORDER BY tablename, policyname;
```

Confirm whether policies named `"Allow all on ..."`, `"Allow dev full access"`, `"dev_access_..."`, or similar `USING (true)` policies exist.

---

## 3. Step-by-Step Deployment Instructions

1. Log into your Supabase Dashboard: https://supabase.com/dashboard/project/iqfblmcyqmxoeyfexjkg
2. Navigate to the **SQL Editor** tab.
3. Open or paste the full contents of `supabase/migrations/20261115000010_strict_workspace_rls_hardening.sql`.
4. Review the script:
   - It executes within an explicit transaction block (`BEGIN; ... COMMIT;`), ensuring atomic all-or-nothing execution.
   - It is forward-only and idempotent (`CREATE OR REPLACE FUNCTION`, `DROP POLICY IF EXISTS`, `CREATE POLICY`).
5. Click **Run** to execute the migration.
6. Verify output confirms:
   - Helper functions updated: `public.is_workspace_member(uuid)` and `public.get_workspace_role(uuid)`.
   - Function execution privileges revoked from `PUBLIC` and `anon`; granted strictly to `authenticated` and `service_role`.
   - Permissive dev policies dropped across all tenant tables.
   - Strict workspace-scoped policies created for:
     - `public.social_accounts`
     - `public.posts`
     - `public.scheduled_jobs` (SELECT only for authenticated members; mutations strictly reserved for service_role and RPCs)
     - `public.notifications`
     - `public.post_analytics` (SELECT only)
     - `public.post_publish_attempts` (SELECT only)
     - `public.media_assets`
     - `public.ai_generations`
     - `public.content_templates`
     - `public.brand_settings`
     - `public.support_tickets`

---

## 4. Post-Deployment Verification Queries

Run the following verification suite in the Supabase SQL Editor to confirm tenant isolation:

### Test 1: Verify No Permissive `USING (true)` Policies Remain
```sql
SELECT tablename, policyname, qual
FROM pg_policies
WHERE tablename IN (
    'social_accounts',
    'posts',
    'scheduled_jobs',
    'notifications',
    'post_analytics',
    'post_publish_attempts',
    'media_assets',
    'ai_generations',
    'content_templates',
    'brand_settings',
    'support_tickets'
)
AND qual = 'true'
AND NOT (roles @> ARRAY['service_role']::name[]);
```
*Expected Result:* 0 rows returned.

### Test 2: Verify Helper Functions Exist and Have Strict Fixed Search Paths
```sql
SELECT
    p.proname,
    p.prosecdef AS is_security_definer,
    p.provolatile AS volatility,
    p.proconfig AS search_path_config
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN ('is_workspace_member', 'get_workspace_role');
```
*Expected Result:*
- Both functions return `is_security_definer = true`.
- Both functions return `volatility = s` (`STABLE`).
- Both functions return `search_path_config = {search_path=pg_catalog, public, auth}`.

### Test 3: Verify Function Execution Privileges
```sql
SELECT
    routine_name,
    grantee,
    privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
AND routine_name IN ('is_workspace_member', 'get_workspace_role');
```
*Expected Result:*
- `PUBLIC` and `anon` have no `EXECUTE` privileges.
- `authenticated` and `service_role` have `EXECUTE` privilege.

### Test 4: Verify Service Role Bypasses RLS Natively
```sql
SELECT rolname, rolbypassrls
FROM pg_roles
WHERE rolname = 'service_role';
```
*Expected Result:* `rolbypassrls = true`.  
In Supabase PostgreSQL, `service_role` possesses the native PostgreSQL `BYPASSRLS` attribute. All backend serverless routes, background workers, and queue processors connect using the service key and execute unrestricted without requiring permissive client policies.

---

## 5. Rollback Plan

If unexpected application permission errors occur, execute the rollback script below to safely re-establish the baseline workspace-scoped RLS policies from `20261112000000_init_schema.sql`.

> [!IMPORTANT]
> This rollback restores strict workspace membership constraints. It does **NOT** grant unrestricted `USING (true)` access to authenticated users.

```sql
BEGIN;

-- 1. Re-establish baseline workspace membership policies on posts
DROP POLICY IF EXISTS "Members can view posts" ON public.posts;
DROP POLICY IF EXISTS "Editors/Admins/Owners can insert posts" ON public.posts;
DROP POLICY IF EXISTS "Editors/Admins/Owners can update posts" ON public.posts;
DROP POLICY IF EXISTS "Editors/Admins/Owners can delete posts" ON public.posts;

CREATE POLICY "Members can view posts" ON public.posts
    FOR SELECT TO authenticated
    USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Editors/Admins/Owners can create/edit posts" ON public.posts
    FOR ALL TO authenticated
    USING (public.get_workspace_role(workspace_id) IN ('owner', 'admin', 'editor', 'approver'));

-- 2. Re-establish baseline policies on social_accounts
DROP POLICY IF EXISTS "Members can view social accounts" ON public.social_accounts;
DROP POLICY IF EXISTS "Admins/Owners can insert social accounts" ON public.social_accounts;
DROP POLICY IF EXISTS "Admins/Owners can update social accounts" ON public.social_accounts;
DROP POLICY IF EXISTS "Admins/Owners can delete social accounts" ON public.social_accounts;

CREATE POLICY "Members can view social accounts" ON public.social_accounts
    FOR SELECT TO authenticated
    USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Admins/Owners can manage social accounts" ON public.social_accounts
    FOR ALL TO authenticated
    USING (public.get_workspace_role(workspace_id) IN ('owner', 'admin'));

-- 3. Re-establish baseline policy on scheduled_jobs (SELECT only)
DROP POLICY IF EXISTS "Members can view scheduled_jobs" ON public.scheduled_jobs;
CREATE POLICY "Members can view jobs" ON public.scheduled_jobs
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.posts p
        WHERE p.id = scheduled_jobs.post_id AND public.is_workspace_member(p.workspace_id)
    ));

COMMIT;
```
