-- ====================================================================
-- SUPABASE MIGRATION: 20261113000006_serverless_scheduler_pg_cron.sql
-- LinkedIn Autopilot - Native Serverless Scheduler Engine
-- By GT InnoX LLP
-- ====================================================================

-- 1. Enable required extensions for scheduled serverless requests
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage on schemas to postgres and service_role
GRANT USAGE ON SCHEMA cron TO postgres, service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres, service_role;
GRANT USAGE ON SCHEMA net TO postgres, service_role;

-- 2. Create or verify serverless publishing metadata tracking table
CREATE TABLE IF NOT EXISTS public.scheduler_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoked_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    trigger_source TEXT NOT NULL DEFAULT 'pg_cron',
    status TEXT NOT NULL DEFAULT 'started', -- 'started', 'completed', 'failed'
    due_jobs_count INTEGER DEFAULT 0,
    published_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    error_message TEXT,
    execution_duration_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_scheduler_logs_invoked_at ON public.scheduler_execution_logs (invoked_at DESC);

-- Enable RLS and service role access
ALTER TABLE public.scheduler_execution_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'scheduler_execution_logs' 
        AND policyname = 'Allow service_role full access to scheduler_execution_logs'
    ) THEN
        CREATE POLICY "Allow service_role full access to scheduler_execution_logs"
            ON public.scheduler_execution_logs
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- 3. Stored Procedure for Safe Invocation of /api/cron/publish
-- This procedure reads the target URL and CRON_SECRET from app settings or parameters
-- and issues an asynchronous HTTP POST/GET via pg_net with Authorization Bearer header.
CREATE OR REPLACE FUNCTION public.invoke_serverless_publish_cron(
    target_base_url TEXT DEFAULT 'https://autopilot.gtinnox.in',
    secret_key TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    request_id BIGINT;
    resolved_secret TEXT;
    headers_json JSONB;
BEGIN
    -- If no secret passed, attempt to read from current_setting or use configured parameter
    resolved_secret := COALESCE(secret_key, current_setting('app.settings.cron_secret', true));

    IF resolved_secret IS NULL OR length(trim(resolved_secret)) = 0 THEN
        RAISE EXCEPTION 'CRON_SECRET is required to invoke serverless publisher';
    END IF;

    headers_json := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || resolved_secret,
        'User-Agent', 'Supabase-pg_cron/1.0 (GT InnoX Autopilot)'
    );

    SELECT net.http_post(
        url := target_base_url || '/api/cron/publish',
        headers := headers_json,
        body := jsonb_build_object('source', 'pg_cron', 'invoked_at', now())::jsonb,
        timeout_milliseconds := 55000
    ) INTO request_id;

    RETURN request_id;
END;
$$;

-- 4. Set up recurring 1-minute cron job in pg_cron
-- Unschedules any existing job first to prevent duplicates
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'linkedin-autopilot-publish-cron') THEN
        PERFORM cron.unschedule('linkedin-autopilot-publish-cron');
    END IF;
END $$;

-- Schedule the job to run every minute (* * * * *)
-- Note: In production, the actual invocation runs:
-- SELECT cron.schedule('linkedin-autopilot-publish-cron', '* * * * *', 
--   $$ SELECT public.invoke_serverless_publish_cron('https://autopilot.gtinnox.in', '<CRON_SECRET>'); $$);
