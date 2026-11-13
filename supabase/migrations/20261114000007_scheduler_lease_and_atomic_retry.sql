-- ====================================================================
-- SUPABASE MIGRATION: 20261114000007_scheduler_lease_and_atomic_retry.sql
-- LinkedIn Autopilot - Atomic Execution Leases and Atomic Retry RPC
-- By GT InnoX LLP
-- ====================================================================

-- 1. Add execution claim tokens and lease timestamps to public.posts
ALTER TABLE public.posts
    ADD COLUMN IF NOT EXISTS claim_token UUID,
    ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_posts_lease_expires_at ON public.posts (lease_expires_at) WHERE status = 'processing';

-- 2. Add claim_token and lease_expires_at to public.scheduled_jobs
ALTER TABLE public.scheduled_jobs
    ADD COLUMN IF NOT EXISTS claim_token UUID,
    ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_lease ON public.scheduled_jobs (lease_expires_at) WHERE status = 'processing';

-- 3. Stored Procedure: Atomic Claim with UUID Lease Token
-- Claims an eligible post for publishing only if it is in ('scheduled', 'approved', 'draft')
-- OR if it has a stale expired lease (> 5 minutes old in processing).
CREATE OR REPLACE FUNCTION public.claim_post_for_publishing(
    target_post_id UUID,
    new_claim_token UUID,
    lease_duration_seconds INT DEFAULT 300
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    claimed_post RECORD;
    now_ts TIMESTAMPTZ := clock_timestamp();
    lease_until TIMESTAMPTZ := clock_timestamp() + (lease_duration_seconds || ' seconds')::INTERVAL;
BEGIN
    -- Atomically lock and transition post if eligible or stale
    UPDATE public.posts
    SET 
        status = 'processing',
        claim_token = new_claim_token,
        lease_expires_at = lease_until,
        updated_at = now_ts
    WHERE id = target_post_id
      AND (
          status IN ('scheduled', 'approved', 'draft')
          OR (status = 'processing' AND (lease_expires_at < now_ts OR lease_expires_at IS NULL AND updated_at < now_ts - INTERVAL '5 minutes'))
      )
    RETURNING id, workspace_id, content, post_type, media_assets, social_account_id, created_by, status, claim_token, lease_expires_at
    INTO claimed_post;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'reason', 'already_processing_or_completed'
        );
    END IF;

    -- Synchronize scheduled_jobs record atomically
    UPDATE public.scheduled_jobs
    SET
        status = 'processing',
        claim_token = new_claim_token,
        lease_expires_at = lease_until,
        updated_at = now_ts
    WHERE post_id = target_post_id
      AND status IN ('scheduled', 'queued', 'processing');

    RETURN jsonb_build_object(
        'success', true,
        'post_id', claimed_post.id,
        'claim_token', claimed_post.claim_token,
        'lease_expires_at', claimed_post.lease_expires_at
    );
END;
$$;

-- 4. Stored Procedure: Atomic Retry State Transition
-- Atomically handles attempt outcome and exponential backoff retry calculation in a single transaction.
-- Strictly validates lease ownership (claim_token) and prevents published posts from being reopened.
CREATE OR REPLACE FUNCTION public.handle_publishing_failure_and_retry(
    target_post_id UUID,
    expected_claim_token UUID,
    error_message TEXT,
    max_attempts INT DEFAULT 3
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    current_job RECORD;
    current_post RECORD;
    now_ts TIMESTAMPTZ := clock_timestamp();
    next_attempt INT;
    backoff_minutes INT;
    retry_at TIMESTAMPTZ;
BEGIN
    -- 1. Verify post existence and lease ownership
    SELECT id, status, claim_token INTO current_post
    FROM public.posts
    WHERE id = target_post_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'reason', 'post_not_found');
    END IF;

    -- Published posts are strictly immutable and can never be reopened or failed
    IF current_post.status = 'published' THEN
        RETURN jsonb_build_object('success', false, 'reason', 'post_already_published');
    END IF;

    -- Verify that the caller still owns the active lease token
    IF expected_claim_token IS NOT NULL AND current_post.claim_token IS NOT NULL AND current_post.claim_token <> expected_claim_token THEN
        RETURN jsonb_build_object('success', false, 'reason', 'claim_token_mismatch_lease_lost');
    END IF;

    -- 2. Inspect corresponding scheduled_jobs record
    SELECT id, attempts, status INTO current_job
    FROM public.scheduled_jobs
    WHERE post_id = target_post_id
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    next_attempt := COALESCE(current_job.attempts, 0) + 1;

    -- 3. Check retry eligibility vs terminal failure
    IF next_attempt < max_attempts THEN
        -- Exponential backoff: 2^attempt minutes (2m, 4m, 8m)
        backoff_minutes := POWER(2, next_attempt);
        retry_at := now_ts + (backoff_minutes || ' minutes')::INTERVAL;

        -- Atomically update posts
        UPDATE public.posts
        SET
            status = 'scheduled',
            scheduled_at = retry_at,
            claim_token = NULL,
            lease_expires_at = NULL,
            error_message = 'Attempt ' || next_attempt || ' failed: ' || error_message || '. Retry scheduled for ' || retry_at::TEXT,
            updated_at = now_ts
        WHERE id = target_post_id;

        -- Atomically update scheduled_jobs
        IF current_job.id IS NOT NULL THEN
            UPDATE public.scheduled_jobs
            SET
                status = 'scheduled',
                scheduled_at = retry_at,
                attempts = next_attempt,
                claim_token = NULL,
                lease_expires_at = NULL,
                last_error = error_message,
                updated_at = now_ts
            WHERE id = current_job.id;
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'action', 'scheduled_retry',
            'attempts', next_attempt,
            'retry_at', retry_at
        );
    ELSE
        -- Terminal failure reached
        UPDATE public.posts
        SET
            status = 'failed',
            claim_token = NULL,
            lease_expires_at = NULL,
            error_message = 'Exhausted max retries (' || max_attempts || '): ' || error_message,
            updated_at = now_ts
        WHERE id = target_post_id;

        IF current_job.id IS NOT NULL THEN
            UPDATE public.scheduled_jobs
            SET
                status = 'failed',
                attempts = next_attempt,
                claim_token = NULL,
                lease_expires_at = NULL,
                last_error = 'Exhausted max retries (' || max_attempts || '): ' || error_message,
                updated_at = now_ts
            WHERE id = current_job.id;
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'action', 'marked_failed_terminal',
            'attempts', next_attempt
        );
    END IF;
END;
$$;

-- Restrict execution to postgres and service_role
REVOKE ALL ON FUNCTION public.claim_post_for_publishing(UUID, UUID, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_post_for_publishing(UUID, UUID, INT) TO postgres, service_role;

REVOKE ALL ON FUNCTION public.handle_publishing_failure_and_retry(UUID, UUID, TEXT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_publishing_failure_and_retry(UUID, UUID, TEXT, INT) TO postgres, service_role;

