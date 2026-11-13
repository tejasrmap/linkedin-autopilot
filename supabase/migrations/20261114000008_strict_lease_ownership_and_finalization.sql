-- ====================================================================
-- SUPABASE MIGRATION: 20261114000008_strict_lease_ownership_and_finalization.sql
-- LinkedIn Autopilot - Strict Lease Ownership, Finalization & State Consistency
-- By GT InnoX LLP
-- ====================================================================

-- 1. Hardened Stored Procedure: Atomic Claim with UUID Lease Token
-- Validates:
-- - target_post_id is NOT NULL
-- - new_claim_token is NOT NULL
-- - lease_duration_seconds > 0 (defaults to 300)
-- - Only transitions if post is eligible ('scheduled', 'approved', 'draft')
--   OR stale processing (lease_expires_at < now OR updated_at < now - 5m)
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
    effective_lease_seconds INT := COALESCE(lease_duration_seconds, 300);
    lease_until TIMESTAMPTZ;
BEGIN
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

-- 2. Hardened Stored Procedure: Strict Atomic Failure & Exponential Backoff Retry
-- Validates:
-- - expected_claim_token is NOT NULL
-- - post exists
-- - post is NOT already published (immutable)
-- - stored claim_token is NOT NULL (unowned posts rejected)
-- - stored claim_token strictly matches expected_claim_token
-- - lease has NOT expired (lease_expires_at >= clock_timestamp())
-- - scheduled_jobs records synchronized; missing records inserted; duplicates cancelled
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
    -- 1. Validate inputs
    IF target_post_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'reason', 'target_post_id_required');
    END IF;

    IF expected_claim_token IS NULL THEN
        RETURN jsonb_build_object('success', false, 'reason', 'expected_claim_token_required');
    END IF;

    -- 2. Lock post FOR UPDATE
    SELECT id, status, claim_token, lease_expires_at INTO current_post
    FROM public.posts
    WHERE id = target_post_id
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

    -- 7. Inspect corresponding scheduled_jobs record
    SELECT id, attempts, status INTO current_job
    FROM public.scheduled_jobs
    WHERE post_id = target_post_id
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    next_attempt := COALESCE(current_job.attempts, 0) + 1;

    -- Cancel any duplicate or older scheduled_jobs for this post
    IF current_job.id IS NOT NULL THEN
        UPDATE public.scheduled_jobs
        SET status = 'cancelled', updated_at = now_ts
        WHERE post_id = target_post_id
          AND id <> current_job.id
          AND status IN ('scheduled', 'queued', 'processing');
    END IF;

    -- 8. Check retry eligibility vs terminal failure
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

        -- Atomically update scheduled_jobs or insert if missing
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
        ELSE
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
                error_message,
                now_ts,
                now_ts
            );
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
                'Exhausted max retries (' || max_attempts || '): ' || error_message,
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

-- 3. Stored Procedure: Atomic Finalization of Successful Publishing
-- Validates:
-- - target_post_id and expected_claim_token are NOT NULL
-- - post exists and is locked FOR UPDATE
-- - post is NOT already published
-- - stored claim_token is NOT NULL and matches expected_claim_token
-- - lease has NOT expired
-- - atomically updates posts to 'published' and clears claim_token/lease
-- - atomically marks scheduled_jobs as 'completed'
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
BEGIN
    -- 1. Validate inputs
    IF target_post_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'reason', 'target_post_id_required');
    END IF;

    IF expected_claim_token IS NULL THEN
        RETURN jsonb_build_object('success', false, 'reason', 'expected_claim_token_required');
    END IF;

    IF provider_post_id IS NULL OR length(trim(provider_post_id)) = 0 THEN
        RETURN jsonb_build_object('success', false, 'reason', 'provider_post_id_required');
    END IF;

    -- 2. Lock post FOR UPDATE
    SELECT id, status, claim_token, lease_expires_at INTO current_post
    FROM public.posts
    WHERE id = target_post_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'reason', 'post_not_found');
    END IF;

    -- 3. If already published, abort
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
        provider_post_id = provider_post_id,
        claim_token = NULL,
        lease_expires_at = NULL,
        error_message = NULL,
        updated_at = now_ts
    WHERE id = target_post_id;

    -- 8. Atomically synchronize scheduled_jobs
    UPDATE public.scheduled_jobs
    SET
        status = 'completed',
        claim_token = NULL,
        lease_expires_at = NULL,
        updated_at = now_ts
    WHERE post_id = target_post_id
      AND status IN ('processing', 'scheduled', 'queued');

    -- Cancel any older duplicate scheduled_jobs
    UPDATE public.scheduled_jobs
    SET status = 'cancelled', updated_at = now_ts
    WHERE post_id = target_post_id
      AND status NOT IN ('completed', 'cancelled');

    RETURN jsonb_build_object(
        'success', true,
        'post_id', target_post_id,
        'provider_post_id', provider_post_id,
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

