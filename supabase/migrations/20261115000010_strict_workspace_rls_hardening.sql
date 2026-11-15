-- ====================================================================
-- SUPABASE MIGRATION: 20261115000010_strict_workspace_rls_hardening.sql
-- LinkedIn Autopilot - Strict Multi-Tenant Row Level Security (RLS) Hardening
-- By GT InnoX LLP
--
-- STATUS: FORWARD-ONLY MIGRATION (PRE-BETA REMEDIATION)
-- Purpose:
-- Replaces overly permissive "Allow all on ..." policies introduced in
-- migration 20261113000001 with strict workspace membership and role-based
-- policies. Guarantees zero cross-tenant access via PostgREST and rejects
-- all anonymous access to private workspace data.
-- ====================================================================

-- 1. Hardened Helper Functions (SECURITY DEFINER with explicit search_path)
CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF ws_id IS NULL OR auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = ws_id AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.get_workspace_role(ws_id UUID)
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    IF ws_id IS NULL OR auth.uid() IS NULL THEN
        RETURN NULL;
    END IF;
    SELECT role INTO user_role FROM public.workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid();
    RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

GRANT EXECUTE ON FUNCTION public.is_workspace_member(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_workspace_role(UUID) TO authenticated, service_role;

-- 2. HARDEN social_accounts
DROP POLICY IF EXISTS "Allow all on social_accounts" ON public.social_accounts;
DROP POLICY IF EXISTS "Members can view social accounts" ON public.social_accounts;
DROP POLICY IF EXISTS "Admins/Owners can manage social accounts" ON public.social_accounts;

CREATE POLICY "Members can view social accounts" ON public.social_accounts
    FOR SELECT TO authenticated
    USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Admins/Owners can insert social accounts" ON public.social_accounts
    FOR INSERT TO authenticated
    WITH CHECK (public.get_workspace_role(workspace_id) IN ('owner', 'admin', 'editor'));

CREATE POLICY "Admins/Owners can update social accounts" ON public.social_accounts
    FOR UPDATE TO authenticated
    USING (public.get_workspace_role(workspace_id) IN ('owner', 'admin', 'editor'))
    WITH CHECK (public.get_workspace_role(workspace_id) IN ('owner', 'admin', 'editor'));

CREATE POLICY "Admins/Owners can delete social accounts" ON public.social_accounts
    FOR DELETE TO authenticated
    USING (public.get_workspace_role(workspace_id) IN ('owner', 'admin'));

-- 3. HARDEN posts
DROP POLICY IF EXISTS "Allow all on posts" ON public.posts;
DROP POLICY IF EXISTS "Members can view posts" ON public.posts;
DROP POLICY IF EXISTS "Editors/Admins/Owners can create/edit posts" ON public.posts;

CREATE POLICY "Members can view posts" ON public.posts
    FOR SELECT TO authenticated
    USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Editors/Admins/Owners can insert posts" ON public.posts
    FOR INSERT TO authenticated
    WITH CHECK (public.get_workspace_role(workspace_id) IN ('owner', 'admin', 'editor', 'approver'));

CREATE POLICY "Editors/Admins/Owners can update posts" ON public.posts
    FOR UPDATE TO authenticated
    USING (public.get_workspace_role(workspace_id) IN ('owner', 'admin', 'editor', 'approver'))
    WITH CHECK (public.get_workspace_role(workspace_id) IN ('owner', 'admin', 'editor', 'approver'));

CREATE POLICY "Editors/Admins/Owners can delete posts" ON public.posts
    FOR DELETE TO authenticated
    USING (public.get_workspace_role(workspace_id) IN ('owner', 'admin', 'editor'));

-- 4. HARDEN scheduled_jobs
DROP POLICY IF EXISTS "Allow all on scheduled_jobs" ON public.scheduled_jobs;
DROP POLICY IF EXISTS "Members can view jobs" ON public.scheduled_jobs;

CREATE POLICY "Members can view scheduled_jobs" ON public.scheduled_jobs
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.posts
        WHERE posts.id = scheduled_jobs.post_id
          AND public.is_workspace_member(posts.workspace_id)
    ));

CREATE POLICY "Members can manage scheduled_jobs" ON public.scheduled_jobs
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.posts
        WHERE posts.id = scheduled_jobs.post_id
          AND public.get_workspace_role(posts.workspace_id) IN ('owner', 'admin', 'editor', 'approver')
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.posts
        WHERE posts.id = scheduled_jobs.post_id
          AND public.get_workspace_role(posts.workspace_id) IN ('owner', 'admin', 'editor', 'approver')
    ));

-- 5. HARDEN notifications
DROP POLICY IF EXISTS "Allow all on notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;

CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() AND (workspace_id IS NULL OR public.is_workspace_member(workspace_id)));

CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications" ON public.notifications
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());

-- 6. HARDEN post_analytics
DROP POLICY IF EXISTS "Allow all on post_analytics" ON public.post_analytics;
DROP POLICY IF EXISTS "Members can view post analytics" ON public.post_analytics;

CREATE POLICY "Members can view post_analytics" ON public.post_analytics
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.posts
        WHERE posts.id = post_analytics.post_id
          AND public.is_workspace_member(posts.workspace_id)
    ));

-- 7. HARDEN post_publish_attempts
DROP POLICY IF EXISTS "Allow all on post_publish_attempts" ON public.post_publish_attempts;
DROP POLICY IF EXISTS "Members can view attempts" ON public.post_publish_attempts;
DROP POLICY IF EXISTS "Members can view post publish attempts" ON public.post_publish_attempts;

CREATE POLICY "Members can view post_publish_attempts" ON public.post_publish_attempts
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.posts
        WHERE posts.id = post_publish_attempts.post_id
          AND public.is_workspace_member(posts.workspace_id)
    ));

-- 8. HARDEN media_assets (Add missing DELETE and UPDATE policies)
DROP POLICY IF EXISTS "Members can delete media assets" ON public.media_assets;
CREATE POLICY "Members can delete media assets" ON public.media_assets
    FOR DELETE TO authenticated
    USING (public.get_workspace_role(workspace_id) IN ('owner', 'admin', 'editor'));

DROP POLICY IF EXISTS "Members can update media assets" ON public.media_assets;
CREATE POLICY "Members can update media assets" ON public.media_assets
    FOR UPDATE TO authenticated
    USING (public.get_workspace_role(workspace_id) IN ('owner', 'admin', 'editor'))
    WITH CHECK (public.get_workspace_role(workspace_id) IN ('owner', 'admin', 'editor'));
