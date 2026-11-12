-- ==============================================================
-- LINKEDIN AUTOPILOT - COMPLETE FIX FOR SUPABASE PERMISSIONS & DEV SEED
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/lrctjyjowhtxrydutezk/sql
-- ==============================================================

-- 1. Ensure dev profile exists (needed for foreign keys)
INSERT INTO public.profiles (id, email, full_name, role)
VALUES ('00000000-0000-0000-0000-000000000001', 'admin@gtinnox.com', 'Lead Developer', 'superadmin')
ON CONFLICT (id) DO UPDATE SET full_name = 'Lead Developer';

-- 2. Make owner_id nullable so workspaces can exist smoothly in dev mode
ALTER TABLE public.workspaces ALTER COLUMN owner_id DROP NOT NULL;

-- 3. Insert default workspace for dev mode
INSERT INTO public.workspaces (id, name, slug, owner_id)
VALUES ('00000000-0000-0000-0000-000000000002', 'Main Workspace', 'main-ws', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO UPDATE SET name = 'Main Workspace';

-- 4. Add workspace membership
INSERT INTO public.workspace_members (workspace_id, user_id, role)
VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'owner')
ON CONFLICT (workspace_id, user_id) DO NOTHING;

-- 5. Open RLS policies to allow publishable/anon key or server backend operations
DROP POLICY IF EXISTS "Admins/Owners can manage social accounts" ON public.social_accounts;
DROP POLICY IF EXISTS "Members can view social accounts" ON public.social_accounts;
CREATE POLICY "Allow all on social_accounts" ON public.social_accounts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Editors/Admins/Owners can create/edit posts" ON public.posts;
DROP POLICY IF EXISTS "Members can view posts" ON public.posts;
CREATE POLICY "Allow all on posts" ON public.posts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Allow all on notifications" ON public.notifications FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Members can view jobs" ON public.scheduled_jobs;
CREATE POLICY "Allow all on scheduled_jobs" ON public.scheduled_jobs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Members can view post analytics" ON public.post_analytics;
CREATE POLICY "Allow all on post_analytics" ON public.post_analytics FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Members can view attempts" ON public.post_publish_attempts;
CREATE POLICY "Allow all on post_publish_attempts" ON public.post_publish_attempts FOR ALL USING (true) WITH CHECK (true);

-- 6. Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION public.is_workspace_member(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_workspace_role(UUID) TO anon, authenticated, service_role;
