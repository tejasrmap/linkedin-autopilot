-- ====================================================================
-- SUPABASE MIGRATION: 20261115000009_harden_plpgsql_parameters_and_rpc_safety.sql
-- LinkedIn Autopilot - Production-Compatible RPC Safety Hardening
-- By GT InnoX LLP
--
-- STATUS: FORWARD-ONLY MIGRATION (CORRECTED FOR PRODUCTION COMPATIBILITY)
-- Purpose:
-- Preserves canonical production parameter names (target_post_id, new_claim_token,
-- expected_claim_token, error_message, provider_post_id) to avoid PostgreSQL error 42P13
-- (cannot change name of input parameter) during CREATE OR REPLACE FUNCTION.
-- Eliminates internal PL/pgSQL variable-vs-column collisions by using local variable
-- declarations (v_...) and fully qualified table column references.
-- ====================================================================

-- 1. Hardened Stored Procedure: Atomic Claim with UUID Lease Token and Synchronized Job Transition
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
    current_post RECORD;
    current_job RECORD;
    now_ts TIMESTAMPTZ := clock_timestamp();
    effective_lease_seconds INT := COALESCE(lease_duration_seconds, 300);
    lease_until TIMESTAMPTZ;
    is_post_eligible BOOLEAN;
    rows_affected INT;
BEGIN
    -- 1. Validate inputs
    IF target_post_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'reason', 'target_post_id_required');
    END IF;

    IF new_claim_token IS NULL THEN
        RETURN jsonb_build_object('success', false, 'reason', 'claim_token_required');
    END IF;

    IF effective_lease_seconds <= 0 THEN
        effective_lease_seconds := 300;
    END IF;

    lease_until := now_ts + (effective_lease_seconds || ' seconds')::INTERVAL;

    -- 2. Lock post FOR UPDATE in public.posts (primary deadlock-free lock order: posts -> scheduled_jobs)
    SELECT posts.id, posts.workspace_id, posts.content, posts.post_type, 
           posts.media_assets, posts.social_account_id, posts.created_by, 
           posts.status, posts.claim_token, posts.lease_expires_at, posts.updated_at
    INTO current_post
    FROM public.posts
    WHERE posts.id = target_post_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'reason', 'post_not_found');
    END IF;

    -- 3. Validate post eligibility
    -- Eligible if in ('scheduled', 'approved', 'draft') OR stale 'processing'
    is_post_eligible := (
        current_post.status IN ('scheduled', 'approved', 'draft')
        OR (
            current_post.status = 'processing' AND (
                current_post.lease_expires_at < now_ts
                OR (current_post.lease_expires_at IS NULL AND current_post.updated_at < now_ts - INTERVAL '5 minutes')
            )
        )
    );

    IF NOT is_post_eligible THEN
        RETURN jsonb_build_object('success', false, 'reason', 'already_processing_or_completed');
    END IF;

    -- 4. Lock latest scheduled_jobs record FOR UPDATE if one exists
    SELECT scheduled_jobs.id, scheduled_jobs.status, scheduled_jobs.claim_token, 
           scheduled_jobs.lease_expires_at, scheduled_jobs.updated_at, scheduled_jobs.attempts
    INTO current_job
    FROM public.scheduled_jobs
    WHERE scheduled_jobs.post_id = target_post_id
    ORDER BY scheduled_jobs.created_at DESC
    LIMIT 1
    FOR UPDATE;

    -- 5. Validate scheduled_job eligibility if record exists
    IF current_job.id IS NOT NULL THEN
        -- If job was completed, post cannot be claimed
        IF current_job.status = 'completed' THEN
            RETURN jsonb_build_object('success', false, 'reason', 'job_already_completed');
        END IF;

        -- If job is currently in processing with an unexpired active lease, reject concurrent worker
        IF current_job.status = 'processing' 
           AND current_job.lease_expires_at IS NOT NULL 
           AND current_job.lease_expires_at >= now_ts THEN
            RETURN jsonb_build_object('success', false, 'reason', 'job_already_processing');
        END IF;
    END IF;

    -- 6. Atomically update public.posts to 'processing' with verified lease
    UPDATE public.posts
    SET 
        status = 'processing',
        claim_token = new_claim_token,
        lease_expires_at = lease_until,
        updated_at = now_ts
    WHERE posts.id = target_post_id;

    GET DIAGNOSTICS rows_affected = ROW_COUNT;
    IF rows_affected <> 1 THEN
        RAISE EXCEPTION 'Atomic post claim update failed: expected 1 row, affected %', rows_affected;
    END IF;

    -- 7. Atomically synchronize or insert scheduled_jobs record
    IF current_job.id IS NOT NULL THEN
        -- Transition existing job to processing with verified lease token
        UPDATE public.scheduled_jobs
        SET
            status = 'processing',
            claim_token = new_claim_token,
            lease_expires_at = lease_until,
            updated_at = now_ts
        WHERE scheduled_jobs.id = current_job.id;

        GET DIAGNOSTICS rows_affected = ROW_COUNT;
        IF rows_affected <> 1 THEN
            RAISE EXCEPTION 'Atomic scheduled_job claim update failed: expected 1 row, affected %', rows_affected;
        END IF;

        -- Deterministically cancel any duplicate/older active jobs for this post
        UPDATE public.scheduled_jobs
        SET status = 'cancelled', updated_at = now_ts
        WHERE scheduled_jobs.post_id = target_post_id
          AND scheduled_jobs.id <> current_job.id
          AND scheduled_jobs.status IN ('scheduled', 'queued', 'processing');
    ELSE
        -- Legitimate immediate publishing or draft without preexisting job:
        -- Insert authoritative job record with active processing lease
        INSERT INTO public.scheduled_jobs (
            post_id,
            status,
            claim_token,
            lease_expires_at,
            attempts,
            scheduled_at,
            created_at,
            updated_at
        ) VALUES (
            target_post_id,
            'processing',
            new_claim_token,
            lease_until,
            0,
            now_ts,
            now_ts,
            now_ts
        );

        GET DIAGNOSTICS rows_affected = ROW_COUNT;
        IF rows_affected <> 1 THEN
            RAISE EXCEPTION 'Atomic scheduled_job creation failed: expected 1 row, affected %', rows_affected;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'post_id', target_post_id,
        'claim_token', new_claim_token,
        'lease_expires_at', lease_until
    );
END;
$$;

-- 2. Hardened Stored Procedure: Strict Atomic Failure & Exponential Backoff Retry
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
    v_error_message TEXT := error_message;
    v_max_attempts INT := COALESCE(max_attempts, 3);
    next_attempt INT;
    backoff_minutes INT;
    retry_at TIMESTAMPTZ;
BEGIN
    -- 1. Validate inputs
    IF target_post_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'reason', 'target_post_id_required');
    END IF;

    IF expected_claim_token IS NULL THEN
        RETURN jsonb_build_object('success', false, 'reason', 'expected_claim_token_required');
    END IF;

    -- 2. Lock post FOR UPDATE
    SELECT posts.id, posts.status, posts.claim_token, posts.lease_expires_at INTO current_post
    FROM public.posts
    WHERE posts.id = target_post_id
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
    IF current_post.claim_token <> expected_claim_token THEN
        RETURN jsonb_build_object('success', false, 'reason', 'claim_token_mismatch_lease_lost');
    END IF;

    -- 6. Reject if lease has expired
    IF current_post.lease_expires_at IS NULL OR current_post.lease_expires_at < now_ts THEN
        RETURN jsonb_build_object('success', false, 'reason', 'lease_expired');
    END IF;

    -- 7. Find and lock the primary scheduled_job
    SELECT scheduled_jobs.id, scheduled_jobs.attempts, scheduled_jobs.status INTO current_job
    FROM public.scheduled_jobs
    WHERE scheduled_jobs.post_id = target_post_id
    ORDER BY scheduled_jobs.created_at DESC
    LIMIT 1
    FOR UPDATE;

    -- Deterministically cancel any duplicate/older scheduled_jobs records
    UPDATE public.scheduled_jobs
    SET status = 'cancelled', updated_at = now_ts
    WHERE scheduled_jobs.post_id = target_post_id
      AND (current_job.id IS NULL OR scheduled_jobs.id <> current_job.id)
      AND scheduled_jobs.status IN ('scheduled', 'queued', 'processing');

    next_attempt := COALESCE(current_job.attempts, 0) + 1;

    -- 8. Branch based on retry threshold
    IF next_attempt < v_max_attempts THEN
        backoff_minutes := POWER(2, next_attempt)::INT;
        retry_at := now_ts + (backoff_minutes || ' minutes')::INTERVAL;

        -- Reopen post for scheduled retry and clear lease ownership
        UPDATE public.posts
        SET
            status = 'scheduled',
            scheduled_at = retry_at,
            claim_token = NULL,
            lease_expires_at = NULL,
            error_message = 'Attempt ' || next_attempt || ' failed: ' || v_error_message || '. Retry scheduled for ' || retry_at::TEXT,
            updated_at = now_ts
        WHERE posts.id = target_post_id;

        IF current_job.id IS NOT NULL THEN
            UPDATE public.scheduled_jobs
            SET
                status = 'scheduled',
                scheduled_at = retry_at,
                attempts = next_attempt,
                claim_token = NULL,
                lease_expires_at = NULL,
                last_error = v_error_message,
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
                target_post_id,
                'scheduled',
                retry_at,
                next_attempt,
                v_error_message,
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
            error_message = 'Exhausted max retries (' || v_max_attempts || '): ' || v_error_message,
            updated_at = now_ts
        WHERE posts.id = target_post_id;

        IF current_job.id IS NOT NULL THEN
            UPDATE public.scheduled_jobs
            SET
                status = 'failed',
                attempts = next_attempt,
                claim_token = NULL,
                lease_expires_at = NULL,
                last_error = 'Exhausted max retries (' || v_max_attempts || '): ' || v_error_message,
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
                target_post_id,
                'failed',
                next_attempt,
                'Exhausted max retries (' || v_max_attempts || '): ' || v_error_message,
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
    target_post_id UUID,
    expected_claim_token UUID,
    provider_post_id TEXT,
    raw_response JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    current_post RECORD;
    now_ts TIMESTAMPTZ := clock_timestamp();
    v_provider_post_id TEXT := provider_post_id;
    v_raw_response JSONB := raw_response;
BEGIN
    -- 1. Validate inputs
    IF target_post_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'reason', 'target_post_id_required');
    END IF;

    IF expected_claim_token IS NULL THEN
        RETURN jsonb_build_object('success', false, 'reason', 'expected_claim_token_required');
    END IF;

    IF v_provider_post_id IS NULL OR length(trim(v_provider_post_id)) = 0 THEN
        RETURN jsonb_build_object('success', false, 'reason', 'provider_post_id_required');
    END IF;

    -- 2. Lock post FOR UPDATE
    SELECT posts.id, posts.status, posts.claim_token, posts.lease_expires_at INTO current_post
    FROM public.posts
    WHERE posts.id = target_post_id
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
    IF current_post.claim_token <> expected_claim_token THEN
        RETURN jsonb_build_object('success', false, 'reason', 'claim_token_mismatch_lease_lost');
    END IF;

    -- 6. Lease must not be expired
    IF current_post.lease_expires_at IS NULL OR current_post.lease_expires_at < now_ts THEN
        RETURN jsonb_build_object('success', false, 'reason', 'lease_expired');
    END IF;

    -- 7. Atomically transition post to published
    UPDATE public.posts
    SET
        status = 'published',
        published_at = now_ts,
        provider_post_id = v_provider_post_id,
        claim_token = NULL,
        lease_expires_at = NULL,
        error_message = NULL,
        updated_at = now_ts
    WHERE posts.id = target_post_id;

    -- 8. Atomically synchronize scheduled_jobs
    UPDATE public.scheduled_jobs
    SET
        status = 'completed',
        claim_token = NULL,
        lease_expires_at = NULL,
        updated_at = now_ts
    WHERE scheduled_jobs.post_id = target_post_id
      AND scheduled_jobs.status IN ('processing', 'scheduled', 'queued');

    -- Cancel any older duplicate scheduled_jobs
    UPDATE public.scheduled_jobs
    SET status = 'cancelled', updated_at = now_ts
    WHERE scheduled_jobs.post_id = target_post_id
      AND scheduled_jobs.status NOT IN ('completed', 'cancelled');

    RETURN jsonb_build_object(
        'success', true,
        'post_id', target_post_id,
        'provider_post_id', v_provider_post_id,
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
