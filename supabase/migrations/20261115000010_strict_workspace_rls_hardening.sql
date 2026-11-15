-- ====================================================================
-- SUPABASE MIGRATION: 20261115000010_strict_workspace_rls_hardening.sql
-- LinkedIn Autopilot - Strict Multi-Tenant Row Level Security (RLS) Hardening
-- By GT InnoX LLP
--
-- STATUS: FORWARD-ONLY IDEMPOTENT MIGRATION (PRE-BETA REMEDIATION)
-- Purpose:
-- Replaces overly permissive "Allow all on ..." development policies
-- from migration 20261113000001 with strict, workspace-membership-scoped
-- Row Level Security. Eliminates cross-tenant data leakage, blocks anonymous
-- PostgREST access, restricts SECURITY DEFINER execution privileges, and
-- protects queue/ledger tables from unauthorized client mutation.
-- ====================================================================

BEGIN;

-- ====================================================================
-- 1. HARDENED HELPER FUNCTIONS (SECURITY DEFINER with strict search_path)
-- ====================================================================

CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
BEGIN
    IF ws_id IS NULL OR auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.workspace_id = ws_id AND wm.user_id = auth.uid()
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_workspace_role(ws_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
    user_role TEXT;
BEGIN
    IF ws_id IS NULL OR auth.uid() IS NULL THEN
        RETURN NULL;
    END IF;
    SELECT wm.role INTO user_role FROM public.workspace_members wm
    WHERE wm.workspace_id = ws_id AND wm.user_id = auth.uid();
    RETURN user_role;
END;
$$;

-- Restrict function execution: Revoke from PUBLIC and anon; grant strictly to authenticated and service_role
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_workspace_role(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_workspace_role(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_workspace_role(UUID) TO authenticated, service_role;

-- ====================================================================
-- 2. HARDEN social_accounts
-- ====================================================================
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on social_accounts" ON public.social_accounts;
DROP POLICY IF EXISTS "Allow dev full access" ON public.social_accounts;
DROP POLICY IF EXISTS "dev_access_social_accounts" ON public.social_accounts;
DROP POLICY IF EXISTS "Members can view social accounts" ON public.social_accounts;
DROP POLICY IF EXISTS "Admins/Owners can manage social accounts" ON public.social_accounts;
DROP POLICY IF EXISTS "Admins/Owners can insert social accounts" ON public.social_accounts;
DROP POLICY IF EXISTS "Admins/Owners can update social accounts" ON public.social_accounts;
DROP POLICY IF EXISTS "Admins/Owners can delete social accounts" ON public.social_accounts;

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

-- ====================================================================
-- 3. HARDEN posts
-- ====================================================================
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on posts" ON public.posts;
DROP POLICY IF EXISTS "Allow dev full access" ON public.posts;
DROP POLICY IF EXISTS "dev_access_posts" ON public.posts;
DROP POLICY IF EXISTS "Members can view posts" ON public.posts;
DROP POLICY IF EXISTS "Editors/Admins/Owners can create/edit posts" ON public.posts;
DROP POLICY IF EXISTS "Editors/Admins/Owners can insert posts" ON public.posts;
DROP POLICY IF EXISTS "Editors/Admins/Owners can update posts" ON public.posts;
DROP POLICY IF EXISTS "Editors/Admins/Owners can delete posts" ON public.posts;

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

-- ====================================================================
-- 4. HARDEN scheduled_jobs (SELECT ONLY FOR AUTHENTICATED USERS)
-- Mutations strictly reserved for service_role and atomic SECURITY DEFINER RPCs.
-- ====================================================================
ALTER TABLE public.scheduled_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on scheduled_jobs" ON public.scheduled_jobs;
DROP POLICY IF EXISTS "Allow dev full access" ON public.scheduled_jobs;
DROP POLICY IF EXISTS "dev_access_scheduled_jobs" ON public.scheduled_jobs;
DROP POLICY IF EXISTS "Members can view jobs" ON public.scheduled_jobs;
DROP POLICY IF EXISTS "Members can view scheduled_jobs" ON public.scheduled_jobs;
DROP POLICY IF EXISTS "Members can manage scheduled_jobs" ON public.scheduled_jobs;

CREATE POLICY "Members can view scheduled_jobs" ON public.scheduled_jobs
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.posts p
        WHERE p.id = scheduled_jobs.post_id
          AND public.is_workspace_member(p.workspace_id)
    ));

-- ====================================================================
-- 5. HARDEN notifications
-- ====================================================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow dev full access" ON public.notifications;
DROP POLICY IF EXISTS "dev_access_notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;

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

-- ====================================================================
-- 6. HARDEN post_analytics (SELECT ONLY FOR AUTHENTICATED USERS)
-- Mutations strictly reserved for background worker / sync jobs via service_role.
-- ====================================================================
ALTER TABLE public.post_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on post_analytics" ON public.post_analytics;
DROP POLICY IF EXISTS "Allow dev full access" ON public.post_analytics;
DROP POLICY IF EXISTS "dev_access_post_analytics" ON public.post_analytics;
DROP POLICY IF EXISTS "Members can view post analytics" ON public.post_analytics;
DROP POLICY IF EXISTS "Members can view post_analytics" ON public.post_analytics;

CREATE POLICY "Members can view post_analytics" ON public.post_analytics
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.posts p
        WHERE p.id = post_analytics.post_id
          AND public.is_workspace_member(p.workspace_id)
    ));

-- ====================================================================
-- 7. HARDEN post_publish_attempts (AUDIT LOG - SELECT ONLY FOR AUTHENTICATED)
-- Mutations strictly reserved for publishing pipeline via service_role.
-- ====================================================================
ALTER TABLE public.post_publish_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on post_publish_attempts" ON public.post_publish_attempts;
DROP POLICY IF EXISTS "Allow dev full access" ON public.post_publish_attempts;
DROP POLICY IF EXISTS "dev_access_post_publish_attempts" ON public.post_publish_attempts;
DROP POLICY IF EXISTS "Members can view attempts" ON public.post_publish_attempts;
DROP POLICY IF EXISTS "Members can view post publish attempts" ON public.post_publish_attempts;
DROP POLICY IF EXISTS "Members can view post_publish_attempts" ON public.post_publish_attempts;

CREATE POLICY "Members can view post_publish_attempts" ON public.post_publish_attempts
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.posts p
        WHERE p.id = post_publish_attempts.post_id
          AND public.is_workspace_member(p.workspace_id)
    ));

-- ====================================================================
-- 8. HARDEN media_assets
-- ====================================================================
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view media assets" ON public.media_assets;
DROP POLICY IF EXISTS "Members can insert media assets" ON public.media_assets;
DROP POLICY IF EXISTS "Members can update media assets" ON public.media_assets;
DROP POLICY IF EXISTS "Members can delete media assets" ON public.media_assets;

CREATE POLICY "Members can view media assets" ON public.media_assets
    FOR SELECT TO authenticated
    USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can insert media assets" ON public.media_assets
    FOR INSERT TO authenticated
    WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can update media assets" ON public.media_assets
    FOR UPDATE TO authenticated
    USING (public.get_workspace_role(workspace_id) IN ('owner', 'admin', 'editor'))
    WITH CHECK (public.get_workspace_role(workspace_id) IN ('owner', 'admin', 'editor'));

CREATE POLICY "Members can delete media assets" ON public.media_assets
    FOR DELETE TO authenticated
    USING (public.get_workspace_role(workspace_id) IN ('owner', 'admin', 'editor'));

-- ====================================================================
-- 9. HARDEN ai_generations
-- ====================================================================
ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view ai generations" ON public.ai_generations;
DROP POLICY IF EXISTS "Members can insert ai generations" ON public.ai_generations;

CREATE POLICY "Members can view ai generations" ON public.ai_generations
    FOR SELECT TO authenticated
    USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can insert ai generations" ON public.ai_generations
    FOR INSERT TO authenticated
    WITH CHECK (public.is_workspace_member(workspace_id));

-- ====================================================================
-- 10. HARDEN content_templates
-- ====================================================================
ALTER TABLE public.content_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view templates" ON public.content_templates;
DROP POLICY IF EXISTS "Members can create templates" ON public.content_templates;
DROP POLICY IF EXISTS "Members can manage templates" ON public.content_templates;

CREATE POLICY "Members can view templates" ON public.content_templates
    FOR SELECT TO authenticated
    USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can manage templates" ON public.content_templates
    FOR ALL TO authenticated
    USING (public.get_workspace_role(workspace_id) IN ('owner', 'admin', 'editor'))
    WITH CHECK (public.get_workspace_role(workspace_id) IN ('owner', 'admin', 'editor'));

-- ====================================================================
-- 11. HARDEN brand_settings
-- ====================================================================
ALTER TABLE public.brand_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view brand settings" ON public.brand_settings;
DROP POLICY IF EXISTS "Admins/Owners can manage brand settings" ON public.brand_settings;

CREATE POLICY "Members can view brand settings" ON public.brand_settings
    FOR SELECT TO authenticated
    USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Admins/Owners can manage brand settings" ON public.brand_settings
    FOR ALL TO authenticated
    USING (public.get_workspace_role(workspace_id) IN ('owner', 'admin'))
    WITH CHECK (public.get_workspace_role(workspace_id) IN ('owner', 'admin'));

-- ====================================================================
-- 12. HARDEN support_tickets
-- ====================================================================
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view support tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Members can create support tickets" ON public.support_tickets;

CREATE POLICY "Members can view support tickets" ON public.support_tickets
    FOR SELECT TO authenticated
    USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can create support tickets" ON public.support_tickets
    FOR INSERT TO authenticated
    WITH CHECK (public.is_workspace_member(workspace_id));

COMMIT;
