-- ==============================================================
-- LINKEDIN AUTOPILOT - STRIPE WEBHOOK EVENT LEDGER & BILLING SCHEMA
-- MIGRATION: 20261113000003_create_stripe_events.sql
-- BY GT INNOX LLP
-- ==============================================================

-- 1. Create stripe_events table for webhook idempotency
CREATE TABLE IF NOT EXISTS public.stripe_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
    customer_id TEXT,
    payload JSONB,
    status TEXT NOT NULL DEFAULT 'processed' CHECK (status IN ('processing', 'processed', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_event_id ON public.stripe_events(event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_events_workspace ON public.stripe_events(workspace_id);

-- Enable RLS
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access on stripe_events"
    ON public.stripe_events
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Workspace members read-only for audit if workspace_id matches
CREATE POLICY "Members view workspace stripe events"
    ON public.stripe_events
    FOR SELECT
    USING (public.is_workspace_member(workspace_id));

-- 2. Enhance subscriptions table for exact Stripe customer and period tracking
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ;

