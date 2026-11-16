-- ============================================================================
-- PROPOSAL / AUDIT MIGRATION: ATOMIC OPTIMISTIC LOCKING & DRAFT CAS UPDATES
-- Migration ID: 20261116000012_atomic_draft_optimistic_locking.sql
-- Status: PROPOSAL ONLY — NOT APPLIED TO PRODUCTION DATABASE
-- ============================================================================
--
-- ARCHITECTURAL CONTEXT & IMPLICATIONS:
-- 1. Problem Statement:
--    A non-atomic "read-then-write" pattern (SELECT updated_at -> evaluate in JS -> UPDATE)
--    creates a race window where two concurrent editing sessions (e.g., two browser tabs,
--    or autosave colliding with manual publish) could both read timestamp T0 and overwrite
--    each other's edits, leading to lost updates.
--
-- 2. Chosen Atomic Strategy: PostgREST Single-Statement CAS:
--    In Supabase PostgREST, executing:
--      UPDATE posts
--      SET content = $1, ..., updated_at = NOW()
--      WHERE id = $2 AND workspace_id = $3 AND updated_at = $4
--      RETURNING *;
--    is executed as a single atomic SQL statement inside PostgreSQL.
--    PostgreSQL automatically acquires an exclusive row-level write lock before evaluating
--    the WHERE clause. If another transaction has committed an update in the interim,
--    updated_at will differ, 0 rows are updated, and PostgREST returns null.
--    This provides atomic compare-and-swap (CAS) guarantees without requiring custom RPCs.
--
-- 3. Stored Procedure (PL/pgSQL RPC) Alternative:
--    Below is the formal PL/pgSQL function proposal for teams desiring explicit database-side
--    lock acquisition (SELECT FOR UPDATE) and standardized error code signaling.
--
-- 4. Timestamp Precision & Tolerance Considerations:
--    PostgreSQL `timestamptz` stores microsecond precision (6 decimal places), whereas
--    JavaScript `Date.toISOString()` produces millisecond precision (3 decimal places).
--    When using string-based timestamp comparisons, PostgreSQL handles ISO 8601 strings
--    cast to `timestamptz`. To prevent sub-millisecond truncation mismatches, both
--    approaches compare via `timestamptz` equality or `date_trunc('milliseconds', ...)`.
-- ============================================================================

-- Function: update_post_atomic (Proposal)
CREATE OR REPLACE FUNCTION update_post_atomic(
    p_post_id UUID,
    p_workspace_id UUID,
    p_expected_updated_at TIMESTAMPTZ,
    p_content TEXT DEFAULT NULL,
    p_post_type TEXT DEFAULT NULL,
    p_social_account_id UUID DEFAULT NULL,
    p_media_assets JSONB DEFAULT NULL,
    p_status TEXT DEFAULT NULL,
    p_scheduled_at TIMESTAMPTZ DEFAULT NULL,
    p_timezone TEXT DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    status_code INT,
    error_code TEXT,
    error_message TEXT,
    post_id UUID,
    updated_at TIMESTAMPTZ,
    current_post JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_current_record RECORD;
    v_new_updated_at TIMESTAMPTZ := NOW();
BEGIN
    -- 1. Lock and fetch current row scoped strictly to the authorized workspace
    SELECT * INTO v_current_record
    FROM posts
    WHERE id = p_post_id AND workspace_id = p_workspace_id
    FOR UPDATE;

    -- 2. Verify existence and workspace isolation
    IF NOT FOUND THEN
        RETURN QUERY SELECT
            FALSE,
            404,
            'NOT_FOUND'::TEXT,
            'Post not found or inaccessible in requested workspace.'::TEXT,
            p_post_id,
            NULL::TIMESTAMPTZ,
            NULL::JSONB;
        RETURN;
    END IF;

    -- 3. Invariant check: published posts cannot be reverted to draft
    IF v_current_record.status = 'published' AND p_status = 'draft' THEN
        RETURN QUERY SELECT
            FALSE,
            400,
            'INVALID_STATUS_TRANSITION'::TEXT,
            'Cannot revert a published post back to draft status.'::TEXT,
            p_post_id,
            v_current_record.updated_at,
            to_jsonb(v_current_record);
        RETURN;
    END IF;

    -- 4. Atomic optimistic concurrency check (when expected timestamp is supplied)
    IF p_expected_updated_at IS NOT NULL THEN
        -- Compare at millisecond precision to accommodate JavaScript ISO string serialization
        IF date_trunc('milliseconds', v_current_record.updated_at) <> date_trunc('milliseconds', p_expected_updated_at) THEN
            RETURN QUERY SELECT
                FALSE,
                409,
                'CONCURRENT_MODIFICATION'::TEXT,
                'Draft has been modified concurrently by another session.'::TEXT,
                p_post_id,
                v_current_record.updated_at,
                to_jsonb(v_current_record);
            RETURN;
        END IF;
    END IF;

    -- 5. Perform authoritative atomic update
    UPDATE posts
    SET
        content = COALESCE(p_content, content),
        post_type = COALESCE(p_post_type, post_type),
        social_account_id = CASE WHEN p_social_account_id IS NOT NULL THEN p_social_account_id ELSE social_account_id END,
        media_assets = COALESCE(p_media_assets, media_assets),
        status = COALESCE(p_status, status),
        scheduled_at = CASE WHEN p_scheduled_at IS NOT NULL THEN p_scheduled_at ELSE scheduled_at END,
        timezone = COALESCE(p_timezone, timezone),
        updated_at = v_new_updated_at
    WHERE id = p_post_id AND workspace_id = p_workspace_id;

    -- 6. Fetch updated record
    SELECT * INTO v_current_record
    FROM posts
    WHERE id = p_post_id AND workspace_id = p_workspace_id;

    RETURN QUERY SELECT
        TRUE,
        200,
        NULL::TEXT,
        NULL::TEXT,
        p_post_id,
        v_new_updated_at,
        to_jsonb(v_current_record);
    RETURN;
END;
$$;
