-- ==============================================================
-- LINKEDIN AUTOPILOT - SUPPORT TICKETS & FEEDBACK SCHEMA
-- BY GT INNOX LLP
-- ==============================================================

CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('publishing', 'ai_generation', 'scheduling', 'accounts', 'billing', 'general')),
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_tickets' AND policyname = 'Users can view workspace tickets') THEN
        CREATE POLICY "Users can view workspace tickets" ON public.support_tickets
            FOR SELECT USING (public.is_workspace_member(workspace_id));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_tickets' AND policyname = 'Users can insert workspace tickets') THEN
        CREATE POLICY "Users can insert workspace tickets" ON public.support_tickets
            FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id));
    END IF;
END $$;
