-- ==============================================================
-- LINKEDIN AUTOPILOT - DATABASE INITIALIZATION SCHEMA
-- BY GT INNOX LLP
-- ==============================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT UNIQUE NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. WORKSPACES TABLE
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. WORKSPACE MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.workspace_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'approver', 'viewer')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE (workspace_id, user_id)
);

-- 4. SOCIAL ACCOUNTS TABLE
CREATE TABLE IF NOT EXISTS public.social_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'linkedin',
    provider_account_id TEXT NOT NULL,
    account_name TEXT NOT NULL,
    account_type TEXT NOT NULL CHECK (account_type IN ('member', 'organization')),
    encrypted_access_token TEXT NOT NULL,
    token_expires_at TIMESTAMPTZ,
    scopes TEXT[] DEFAULT ARRAY[]::TEXT[],
    connection_status TEXT NOT NULL DEFAULT 'active' CHECK (connection_status IN ('active', 'expired', 'disconnected', 'unauthorized')),
    profile_image_url TEXT,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE (workspace_id, provider, provider_account_id)
);

-- 5. POSTS TABLE
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    social_account_id UUID REFERENCES public.social_accounts(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    media_assets JSONB DEFAULT '[]'::JSONB,
    post_type TEXT NOT NULL DEFAULT 'text' CHECK (post_type IN ('text', 'image', 'video', 'document', 'article')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'scheduled', 'processing', 'published', 'failed', 'cancelled')),
    scheduled_at TIMESTAMPTZ,
    timezone TEXT DEFAULT 'UTC',
    published_at TIMESTAMPTZ,
    provider_post_id TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 6. SCHEDULED JOBS TABLE
CREATE TABLE IF NOT EXISTS public.scheduled_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    queue_job_id TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'queued', 'processing', 'completed', 'failed', 'cancelled')),
    attempts INT DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 7. MEDIA ASSETS TABLE
CREATE TABLE IF NOT EXISTS public.media_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 8. AI GENERATIONS TABLE
CREATE TABLE IF NOT EXISTS public.ai_generations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    generated_content TEXT NOT NULL,
    generation_type TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 9. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('success', 'error', 'info', 'warning')),
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 10. POST ANALYTICS TABLE
CREATE TABLE IF NOT EXISTS public.post_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    metric_name TEXT NOT NULL,
    metric_value NUMERIC NOT NULL DEFAULT 0,
    collected_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 11. POST PUBLISH ATTEMPTS TABLE
CREATE TABLE IF NOT EXISTS public.post_publish_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    attempt_number INT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('started', 'succeeded', 'failed')),
    provider_response JSONB DEFAULT '{}'::JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 12. CONTENT TEMPLATES TABLE
CREATE TABLE IF NOT EXISTS public.content_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 13. BRAND SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.brand_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    brand_name TEXT NOT NULL,
    industry TEXT,
    target_audience TEXT,
    brand_voice TEXT,
    preferred_hashtags TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE (workspace_id)
);

-- 14. SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL DEFAULT 'free' CHECK (plan_id IN ('free', 'pro', 'business', 'agency')),
    provider_subscription_id TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'trialing')),
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE (workspace_id)
);

-- ==============================================================
-- INDEXES FOR PERFORMANCE
-- ==============================================================
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_posts_workspace ON public.posts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON public.posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_at ON public.posts(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_status ON public.scheduled_jobs(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_social_accounts_workspace ON public.social_accounts(workspace_id);

-- ==============================================================
-- HELPER FUNCTIONS & RLS
-- ==============================================================

-- Helper function to check if auth.uid() has access to a workspace
CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.workspace_members
        WHERE workspace_id = ws_id AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Helper function to get role of current user in workspace
CREATE OR REPLACE FUNCTION public.get_workspace_role(ws_id UUID)
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role FROM public.workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid();
    RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Grant execution to all roles so RLS policies can evaluate them
GRANT EXECUTE ON FUNCTION public.is_workspace_member(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_workspace_role(UUID) TO anon, authenticated, service_role;

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_publish_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Profiles: users can select/update their own profile
CREATE POLICY "Users can view profiles in their workspaces or own" ON public.profiles
    FOR SELECT USING (
        id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.workspace_members wm1
            JOIN public.workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
            WHERE wm1.user_id = auth.uid() AND wm2.user_id = public.profiles.id
        )
    );
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (id = auth.uid());

-- Workspaces: members can view their workspaces
CREATE POLICY "Members can view workspaces" ON public.workspaces
    FOR SELECT USING (public.is_workspace_member(id));
CREATE POLICY "Owners can update workspaces" ON public.workspaces
    FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Users can create workspaces" ON public.workspaces
    FOR INSERT WITH CHECK (owner_id = auth.uid());

-- Workspace members
CREATE POLICY "Members can view membership" ON public.workspace_members
    FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Admins/Owners can manage members" ON public.workspace_members
    FOR ALL USING (public.get_workspace_role(workspace_id) IN ('owner', 'admin'));

-- Social Accounts
CREATE POLICY "Members can view social accounts" ON public.social_accounts
    FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Admins/Owners can manage social accounts" ON public.social_accounts
    FOR ALL USING (public.get_workspace_role(workspace_id) IN ('owner', 'admin'));

-- Posts
CREATE POLICY "Members can view posts" ON public.posts
    FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Editors/Admins/Owners can create/edit posts" ON public.posts
    FOR ALL USING (public.get_workspace_role(workspace_id) IN ('owner', 'admin', 'editor', 'approver'));

-- Scheduled Jobs
CREATE POLICY "Members can view jobs" ON public.scheduled_jobs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.posts p WHERE p.id = scheduled_jobs.post_id AND public.is_workspace_member(p.workspace_id))
    );

-- Media Assets
CREATE POLICY "Members can view media assets" ON public.media_assets
    FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Members can insert media assets" ON public.media_assets
    FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id));

-- AI Generations
CREATE POLICY "Members can view ai generations" ON public.ai_generations
    FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Members can insert ai generations" ON public.ai_generations
    FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id));

-- Notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE USING (user_id = auth.uid());

-- Post Analytics
CREATE POLICY "Members can view post analytics" ON public.post_analytics
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_analytics.post_id AND public.is_workspace_member(p.workspace_id))
    );

-- Post Publish Attempts
CREATE POLICY "Members can view post publish attempts" ON public.post_publish_attempts
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_publish_attempts.post_id AND public.is_workspace_member(p.workspace_id))
    );

-- Content Templates
CREATE POLICY "Members can view templates" ON public.content_templates
    FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Members can create templates" ON public.content_templates
    FOR ALL USING (public.get_workspace_role(workspace_id) IN ('owner', 'admin', 'editor'));

-- Brand Settings
CREATE POLICY "Members can view brand settings" ON public.brand_settings
    FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY "Admins/Owners can manage brand settings" ON public.brand_settings
    FOR ALL USING (public.get_workspace_role(workspace_id) IN ('owner', 'admin'));

-- Subscriptions
CREATE POLICY "Members can view subscription" ON public.subscriptions
    FOR SELECT USING (public.is_workspace_member(workspace_id));

-- ==============================================================
-- TRIGGER FOR AUTOMATIC PROFILE & DEFAULT WORKSPACE ON SIGNUP
-- ==============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_ws_id UUID;
    user_display_name TEXT;
BEGIN
    user_display_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));

    -- Insert into profiles
    INSERT INTO public.profiles (id, full_name, email, avatar_url)
    VALUES (NEW.id, user_display_name, NEW.email, NEW.raw_user_meta_data->>'avatar_url');

    -- Insert default personal workspace
    INSERT INTO public.workspaces (name, slug, owner_id)
    VALUES (user_display_name || '''s Workspace', 'ws-' || substr(md5(random()::text), 1, 8), NEW.id)
    RETURNING id INTO new_ws_id;

    -- Add user as owner in workspace_members
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (new_ws_id, NEW.id, 'owner');

    -- Insert free subscription for workspace
    INSERT INTO public.subscriptions (workspace_id, plan_id, status)
    VALUES (new_ws_id, 'free', 'active');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Trigger execution on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

