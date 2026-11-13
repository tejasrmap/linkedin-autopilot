-- ====================================================================
-- SUPABASE MIGRATION: 20261113000006_serverless_scheduler_pg_cron.sql
-- LinkedIn Autopilot - Production-Grade Serverless Scheduler Engine
-- By GT InnoX LLP
-- ====================================================================

-- 1. Enable required extensions for scheduled serverless requests
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- 2. Create scheduler execution logs table
CREATE TABLE IF NOT EXISTS public.scheduler_execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoked_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    trigger_source TEXT NOT NULL DEFAULT 'pg_cron',
    status TEXT NOT NULL DEFAULT 'started', -- 'started', 'completed', 'failed'
    due_jobs_count INTEGER DEFAULT 0,
    published_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    reclaimed_stale_count INTEGER DEFAULT 0,
    error_message TEXT,
    execution_duration_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_scheduler_logs_invoked_at ON public.scheduler_execution_logs (invoked_at DESC);
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

-- 3. Dedicated Schema and Stored Procedure for Safe Invocation of /api/cron/publish
-- Uses Supabase Vault (vault.decrypted_secrets) to retrieve the secret dynamically
-- Restricts target URL strictly to https://autopilot.gtinnox.in/api/cron/publish
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO postgres, service_role;

CREATE OR REPLACE FUNCTION private.invoke_serverless_publish_cron()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public, vault, extensions
AS $$
DECLARE
    request_id BIGINT;
    resolved_secret TEXT;
    target_url CONSTANT TEXT := 'https://autopilot.gtinnox.in/api/cron/publish';
    headers_json JSONB;
BEGIN
    -- 1. Dynamically retrieve CRON_SECRET from Supabase Vault
    SELECT decrypted_secret 
    INTO resolved_secret 
    FROM vault.decrypted_secrets 
    WHERE name = 'cron_secret'
    ORDER BY created_at DESC
    LIMIT 1;

    -- 2. Fallback check from database setting if vault secret is not populated yet
    IF resolved_secret IS NULL OR length(trim(resolved_secret)) = 0 THEN
        resolved_secret := current_setting('app.settings.cron_secret', true);
    END IF;

    -- 3. Fail closed if no secret could be resolved
    IF resolved_secret IS NULL OR length(trim(resolved_secret)) = 0 THEN
        INSERT INTO public.scheduler_execution_logs (trigger_source, status, error_message)
        VALUES ('pg_cron', 'failed', 'CRON_SECRET not found in vault.decrypted_secrets or app.settings.cron_secret');
        RAISE EXCEPTION 'CRON_SECRET is required to invoke serverless publisher';
    END IF;

    headers_json := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || resolved_secret,
        'User-Agent', 'Supabase-pg_cron/1.0 (GT InnoX Autopilot)'
    );

    -- 4. Dispatch asynchronous HTTP POST request to verified production endpoint via pg_net
    SELECT net.http_post(
        url := target_url,
        headers := headers_json,
        body := jsonb_build_object('source', 'pg_cron', 'invoked_at', now())::jsonb,
        timeout_milliseconds := 55000
    ) INTO request_id;

    -- 5. Record dispatch log
    INSERT INTO public.scheduler_execution_logs (trigger_source, status, error_message)
    VALUES ('pg_cron', 'dispatched', 'HTTP dispatch initiated with net request_id ' || request_id::text);

    RETURN request_id;
EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.scheduler_execution_logs (trigger_source, status, error_message)
    VALUES ('pg_cron', 'failed', SQLERRM);
    RAISE;
END;
$$;

-- Restrict execution privileges strictly to postgres and service_role
REVOKE ALL ON FUNCTION private.invoke_serverless_publish_cron() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.invoke_serverless_publish_cron() TO postgres, service_role;

-- 4. Idempotently configure the 1-minute recurring schedule in pg_cron
DO $$
BEGIN
    -- Unschedule existing job if already present to guarantee idempotency
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'linkedin-autopilot-publish-cron') THEN
        PERFORM cron.unschedule('linkedin-autopilot-publish-cron');
    END IF;

    -- Idempotently schedule the 1-minute job
    PERFORM cron.schedule(
        'linkedin-autopilot-publish-cron',
        '* * * * *',
        'SELECT private.invoke_serverless_publish_cron();'
    );
END $$;
