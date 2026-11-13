-- ==============================================================
-- LINKEDIN AUTOPILOT - STRIPE HARDENING & WORKER HEARTBEATS
-- MIGRATION: 20261113000004_stripe_hardening.sql
-- BY GT INNOX LLP
-- ==============================================================

-- 1. Enhance stripe_events with updated_at
ALTER TABLE public.stripe_events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Enhance subscriptions with last_event_created for out-of-order rejection
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS last_event_created BIGINT DEFAULT 0;

-- 3. Create worker_heartbeats table for live daemon health monitoring
CREATE TABLE IF NOT EXISTS public.worker_heartbeats (
    id TEXT PRIMARY KEY DEFAULT 'primary_worker',
    mode TEXT NOT NULL DEFAULT 'polling',
    last_seen_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    pid INTEGER,
    hostname TEXT,
    uptime_seconds INTEGER DEFAULT 0,
    meta JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.worker_heartbeats ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'worker_heartbeats' AND policyname = 'Service role full access on worker_heartbeats'
    ) THEN
        CREATE POLICY "Service role full access on worker_heartbeats"
            ON public.worker_heartbeats
            FOR ALL
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

