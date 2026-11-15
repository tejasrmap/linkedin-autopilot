-- ====================================================================
-- SUPABASE MIGRATION: 20261115000009_harden_plpgsql_parameters_and_rpc_safety.sql
-- LinkedIn Autopilot - Unambiguous PL/pgSQL Parameters & RPC Safety Hardening
-- By GT InnoX LLP
--
-- STATUS: FORWARD-ONLY MIGRATION (UNAPPLIED IN PRODUCTION)
-- Purpose:
-- Eliminates potential PL/pgSQL variable-vs-column collisions (e.g. provider_post_id = provider_post_id
-- and error_message = error_message) by standardizing on p_ prefixed parameters and qualified table column
-- references throughout all publishing RPC stored procedures.
-- ====================================================================

-- 1. Hardened Stored Procedure: Atomic Claim with Explicit Parameter Names
CREATE OR REPLACE FUNCTION public.claim_post_for_publishing(
    p_target_post_id UUID,
    p_new_claim_token UUID,
    p_lease_duration_seconds INT DEFAULT 300
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    claimed_post RECORD;
    now_ts TIMESTAMPTZ := clock_timestamp();
    effective_lease_seconds INT := COALESCE(p_lease_duration_seconds, 300);
    lease_until TIMESTAMPTZ;
BEGIN
    IF p_target_post_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'reason', 'target_post_id_required');
    END IF;

    IF p_new_claim_token IS NULL THEN
        RETURN jsonb_build_object('success', false, 'reason', 'claim_token_required');
    END IF;

    IF effective_lease_seconds <= 0 THEN
        effective_lease_seconds := 300;
    END IF;

    lease_until := now_ts + (effective_lease_seconds || ' seconds')::INTERVAL;

    -- Atomically lock and transition post if eligible or stale
    UPDATE public.posts
    SET 
        status = 'processing',
        claim_token = p_new_claim_token,
        lease_expires_at = lease_until,
        updated_at = now_ts
    WHERE posts.id = p_target_post_id
      AND (
          posts.status IN ('scheduled', 'approved', 'draft')
          OR (posts.status = 'processing' AND (posts.lease_expires_at < now_ts OR posts.lease_expires_at IS NULL AND posts.updated_at < now_ts - INTERVAL '5 minutes'))
      )
    RETURNING posts.id, posts.workspace_id, posts.content, posts.post_type, posts.media_assets, posts.social_account_id, posts.created_by, posts.status, posts.claim_token, posts.lease_expires_at
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
        claim_token = p_new_claim_token,
        lease_expires_at = lease_until,
        updated_at = now_ts
    WHERE scheduled_jobs.post_id = p_target_post_id
      AND scheduled_jobs.status IN ('scheduled', 'queued', 'processing');

    RETURN jsonb_build_object(
        'success', true,
        'post_id', claimed_post.id,
        'claim_token', claimed_post.claim_token,
        'lease_expires_at', claimed_post.lease_expires_at
    );
END;
$$;

-- 2. Hardened Stored Procedure: Strict Atomic Failure & Exponential Backoff Retry
CREATE OR REPLACE FUNCTION public.handle_publishing_failure_and_retry(
    p_target_post_id UUID,
    p_expected_claim_token UUID,
    p_error_message TEXT,
    p_max_attempts INT DEFAULT 3
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
    -- 1. Validate inputs
    IF p_target_post_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'reason', 'target_post_id_required');
    END IF;

    IF p_expected_claim_token IS NULL THEN
        RETURN jsonb_build_object('success', false, 'reason', 'expected_claim_token_required');
    END IF;

    -- 2. Lock post FOR UPDATE
    SELECT posts.id, posts.status, posts.claim_token, posts.lease_expires_at INTO current_post
    FROM public.posts
    WHERE posts.id = p_target_post_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'reason', 'post_not_found');
    END IF;

    -- 3. Published posts are strictly immutable and can never be reopened or failed
    IF current_post.status = 'published' THEN
        RETURN jsonb_build_object('success', false, 'reason', 'post_already_published');
    END IF;

    -- 4. Reject if post has no active claim token (unowned or already cleared)
    IF current_post.claim_token IS NULL THEN
        RETURN jsonb_build_object('success', false, 'reason', 'claim_token_missing_unowned');
    END IF;

    -- 5. Reject if stored claim token does not match expected claim token
    IF current_post.claim_token <> p_expected_claim_token THEN
        RETURN jsonb_build_object('success', false, 'reason', 'claim_token_mismatch_lease_lost');
    END IF;

    -- 6. Reject if lease has expired
    IF current_post.lease_expires_at IS NULL OR current_post.lease_expires_at < now_ts THEN
        RETURN jsonb_build_object('success', false, 'reason', 'lease_expired');
    END IF;

    -- 7. Find and lock the primary scheduled_job
    SELECT scheduled_jobs.id, scheduled_jobs.attempts, scheduled_jobs.status INTO current_job
    FROM public.scheduled_jobs
    WHERE scheduled_jobs.post_id = p_target_post_id
    ORDER BY scheduled_jobs.created_at DESC
    LIMIT 1
    FOR UPDATE;

    -- Deterministically cancel any duplicate/older scheduled_jobs records
    UPDATE public.scheduled_jobs
    SET status = 'cancelled', updated_at = now_ts
    WHERE scheduled_jobs.post_id = p_target_post_id
      AND (current_job.id IS NULL OR scheduled_jobs.id <> current_job.id)
      AND scheduled_jobs.status IN ('scheduled', 'queued', 'processing');

    next_attempt := COALESCE(current_job.attempts, 0) + 1;

    -- 8. Branch based on retry threshold
    IF next_attempt < p_max_attempts THEN
        backoff_minutes := POWER(2, next_attempt)::INT;
        retry_at := now_ts + (backoff_minutes || ' minutes')::INTERVAL;

        -- Reopen post for scheduled retry and clear lease ownership
        UPDATE public.posts
        SET
            status = 'scheduled',
            scheduled_at = retry_at,
            claim_token = NULL,
            lease_expires_at = NULL,
            error_message = 'Attempt ' || next_attempt || ' failed: ' || p_error_message || '. Retry scheduled for ' || retry_at::TEXT,
            updated_at = now_ts
        WHERE posts.id = p_target_post_id;

        IF current_job.id IS NOT NULL THEN
            UPDATE public.scheduled_jobs
            SET
                status = 'scheduled',
                scheduled_at = retry_at,
                attempts = next_attempt,
                claim_token = NULL,
                lease_expires_at = NULL,
                last_error = p_error_message,
                updated_at = now_ts
            WHERE scheduled_jobs.id = current_job.id;
        ELSE
            -- Self-healing: if scheduled_job was missing, insert authoritative record
            INSERT INTO public.scheduled_jobs (
                post_id,
                status,
                scheduled_at,
                attempts,
                last_error,
                created_at,
                updated_at
            ) VALUES (
                p_target_post_id,
                'scheduled',
                retry_at,
                next_attempt,
                p_error_message,
                now_ts,
                now_ts
            );
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'action', 'scheduled_retry',
            'attempts', next_attempt,
            'retry_at', retry_at,
            'backoff_minutes', backoff_minutes
        );
    ELSE
        -- Terminal failure: max attempts reached
        UPDATE public.posts
        SET
            status = 'failed',
            claim_token = NULL,
            lease_expires_at = NULL,
            error_message = 'Exhausted max retries (' || p_max_attempts || '): ' || p_error_message,
            updated_at = now_ts
        WHERE posts.id = p_target_post_id;

        IF current_job.id IS NOT NULL THEN
            UPDATE public.scheduled_jobs
            SET
                status = 'failed',
                attempts = next_attempt,
                claim_token = NULL,
                lease_expires_at = NULL,
                last_error = 'Exhausted max retries (' || p_max_attempts || '): ' || p_error_message,
                updated_at = now_ts
            WHERE scheduled_jobs.id = current_job.id;
        ELSE
            INSERT INTO public.scheduled_jobs (
                post_id,
                status,
                attempts,
                last_error,
                created_at,
                updated_at
            ) VALUES (
                p_target_post_id,
                'failed',
                next_attempt,
                'Exhausted max retries (' || p_max_attempts || '): ' || p_error_message,
                now_ts,
                now_ts
            );
        END IF;

        RETURN jsonb_build_object(
            'success', true,
            'action', 'marked_failed_terminal',
            'attempts', next_attempt
        );
    END IF;
END;
$$;

-- 3. Hardened Stored Procedure: Atomic Finalization of Successful Publishing
CREATE OR REPLACE FUNCTION public.finalize_post_publishing(
    p_target_post_id UUID,
    p_expected_claim_token UUID,
    p_provider_post_id TEXT,
    p_raw_response JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    current_post RECORD;
    now_ts TIMESTAMPTZ := clock_timestamp();
BEGIN
    -- 1. Validate inputs
    IF p_target_post_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'reason', 'target_post_id_required');
    END IF;

    IF p_expected_claim_token IS NULL THEN
        RETURN jsonb_build_object('success', false, 'reason', 'expected_claim_token_required');
    END IF;

    IF p_provider_post_id IS NULL OR length(trim(p_provider_post_id)) = 0 THEN
        RETURN jsonb_build_object('success', false, 'reason', 'provider_post_id_required');
    END IF;

    -- 2. Lock post FOR UPDATE
    SELECT posts.id, posts.status, posts.claim_token, posts.lease_expires_at INTO current_post
    FROM public.posts
    WHERE posts.id = p_target_post_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'reason', 'post_not_found');
    END IF;

    -- 3. If already published, abort cleanly
    IF current_post.status = 'published' THEN
        RETURN jsonb_build_object('success', false, 'reason', 'post_already_published');
    END IF;

    -- 4. Stored claim token must exist
    IF current_post.claim_token IS NULL THEN
        RETURN jsonb_build_object('success', false, 'reason', 'claim_token_missing_unowned');
    END IF;

    -- 5. Stored claim token must strictly match expected claim token
    IF current_post.claim_token <> p_expected_claim_token THEN
        RETURN jsonb_build_object('success', false, 'reason', 'claim_token_mismatch_lease_lost');
    END IF;

    -- 6. Lease must not be expired
    IF current_post.lease_expires_at IS NULL OR current_post.lease_expires_at < now_ts THEN
        RETURN jsonb_build_object('success', false, 'reason', 'lease_expired');
    END IF;

    -- 7. Atomically transition post to published with unambiguous column qualification
    UPDATE public.posts
    SET
        status = 'published',
        published_at = now_ts,
        provider_post_id = p_provider_post_id,
        claim_token = NULL,
        lease_expires_at = NULL,
        error_message = NULL,
        updated_at = now_ts
    WHERE posts.id = p_target_post_id;

    -- 8. Atomically synchronize scheduled_jobs
    UPDATE public.scheduled_jobs
    SET
        status = 'completed',
        claim_token = NULL,
        lease_expires_at = NULL,
        updated_at = now_ts
    WHERE scheduled_jobs.post_id = p_target_post_id
      AND scheduled_jobs.status IN ('processing', 'scheduled', 'queued');

    -- Cancel any older duplicate scheduled_jobs
    UPDATE public.scheduled_jobs
    SET status = 'cancelled', updated_at = now_ts
    WHERE scheduled_jobs.post_id = p_target_post_id
      AND scheduled_jobs.status NOT IN ('completed', 'cancelled');

    RETURN jsonb_build_object(
        'success', true,
        'post_id', p_target_post_id,
        'provider_post_id', p_provider_post_id,
        'published_at', now_ts
    );
END;
$$;

-- Revoke all public execution and grant strictly to postgres and service_role
REVOKE ALL ON FUNCTION public.claim_post_for_publishing(UUID, UUID, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_post_for_publishing(UUID, UUID, INT) TO postgres, service_role;

REVOKE ALL ON FUNCTION public.handle_publishing_failure_and_retry(UUID, UUID, TEXT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_publishing_failure_and_retry(UUID, UUID, TEXT, INT) TO postgres, service_role;

REVOKE ALL ON FUNCTION public.finalize_post_publishing(UUID, UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_post_publishing(UUID, UUID, TEXT, JSONB) TO postgres, service_role;
