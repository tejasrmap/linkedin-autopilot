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
CREATE POLICY "Allow dev full access" ON public.social_accounts FOR ALL USING (true);
CREATE POLICY "Allow dev full access" ON public.posts FOR ALL USING (true);
CREATE POLICY "Allow dev full access" ON public.scheduled_jobs FOR ALL USING (true);
CREATE POLICY "Allow dev full access" ON public.notifications FOR ALL USING (true);
CREATE POLICY "Allow dev full access" ON public.post_analytics FOR ALL USING (true);
CREATE POLICY "Allow dev full access" ON public.post_publish_attempts FOR ALL USING (true);
```
While designed for rapid local developer iteration, these policies bypass all tenant boundaries for `anon` and `authenticated` roles connecting directly through Supabase client libraries.

Migration `20261115000010_strict_workspace_rls_hardening.sql` safely drops these open policies and establishes strict, defense-in-depth Row Level Security based on workspace membership.

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
    'post_publish_attempts'
)
ORDER BY tablename, policyname;
```

Confirm whether policies named `"Allow dev full access"`, `"dev_access_social_accounts"`, or similar `USING (true)` policies exist.

---

## 3. Step-by-Step Deployment Instructions

1. Log into your Supabase Dashboard: https://supabase.com/dashboard/project/iqfblmcyqmxoeyfexjkg
2. Navigate to the **SQL Editor** tab.
3. Open or paste the full contents of `supabase/migrations/20261115000010_strict_workspace_rls_hardening.sql`.
4. Review the script. Note that it executes within an explicit transaction (`BEGIN; ... COMMIT;`), ensuring atomic application.
5. Click **Run** to execute the migration.
6. Verify output confirms:
   - Helper functions created: `public.is_workspace_member(uuid)` and `public.get_user_workspace_role(uuid)`.
   - Permissive dev policies dropped.
   - Strict workspace-scoped policies created for:
     - `public.social_accounts`
     - `public.posts`
     - `public.scheduled_jobs`
     - `public.post_analytics`
     - `public.post_publish_attempts`
     - `public.notifications`

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
    'post_publish_attempts'
)
AND qual = 'true'
AND NOT (roles @> ARRAY['service_role']::name[]);
```
*Expected Result:* 0 rows returned.

### Test 2: Verify Helper Functions Exist and Have Fixed Search Paths
```sql
SELECT
    p.proname,
    p.prosecdef AS is_security_definer,
    p.proconfig AS search_path_config
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN ('is_workspace_member', 'get_user_workspace_role');
```
*Expected Result:*
- Both functions return `is_security_definer = true`.
- Both functions have `search_path_config = {search_path=pg_catalog, public}`.

### Test 3: Verify Service Role Retains Full Access
```sql
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename IN ('social_accounts', 'posts', 'scheduled_jobs', 'notifications', 'post_analytics', 'post_publish_attempts')
AND policyname LIKE '%service_role%'
ORDER BY tablename;
```
*Expected Result:* Each table has a dedicated policy granting full access to `service_role`.

---

## 5. Rollback Plan

If unexpected application permission errors occur, execute the rollback script below to temporarily re-enable developer access while investigating:

```sql
BEGIN;

-- Temporarily permit authenticated users while debugging
CREATE POLICY "Temp dev access social_accounts" ON public.social_accounts FOR ALL TO authenticated USING (true);
CREATE POLICY "Temp dev access posts" ON public.posts FOR ALL TO authenticated USING (true);
CREATE POLICY "Temp dev access scheduled_jobs" ON public.scheduled_jobs FOR ALL TO authenticated USING (true);
CREATE POLICY "Temp dev access notifications" ON public.notifications FOR ALL TO authenticated USING (true);
CREATE POLICY "Temp dev access post_analytics" ON public.post_analytics FOR ALL TO authenticated USING (true);
CREATE POLICY "Temp dev access post_publish_attempts" ON public.post_publish_attempts FOR ALL TO authenticated USING (true);

COMMIT;
```
> [!WARNING]
> Do NOT leave rollback policies active in production for beta users. Rollback must only be used as a temporary diagnostic measure.
