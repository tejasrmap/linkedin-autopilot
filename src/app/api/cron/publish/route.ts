// ==============================================================
// LINKEDIN AUTOPILOT - CRON SCHEDULER API (SERVERLESS ENGINE)
// BY GT INNOX LLP
// ==============================================================

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { executePublishPipeline } from '@/lib/queue/publisher';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for batch publishing on Vercel

const STALE_PROCESSING_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const MAX_BATCH_SIZE = 20;

export async function GET(request: Request) {
  return handleCronRequest(request);
}

export async function POST(request: Request) {
  return handleCronRequest(request);
}

async function handleCronRequest(request: Request) {
  const startTime = Date.now();
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // STRICT SECURITY & AUTHENTICATION ENFORCEMENT:
  // 1. Fail closed if CRON_SECRET is not configured on the server.
  if (!cronSecret || cronSecret.trim().length === 0) {
    logger.error('CRON_SECRET environment variable is missing or empty. Rejecting cron request.');
    return NextResponse.json(
      { error: 'Server misconfiguration: CRON_SECRET is not configured' },
      { status: 500 }
    );
  }

  // 2. Strictly require valid Authorization: Bearer <CRON_SECRET> header.
  // Query parameters are rejected to avoid logging sensitive secrets in access logs.
  if (!authHeader || authHeader !== `Bearer ${cronSecret.trim()}`) {
    logger.warn('Unauthorized cron request attempt rejected.');
    return NextResponse.json(
      { error: 'Unauthorized: Valid Authorization Bearer header is required' },
      { status: 401 }
    );
  }

  const supabase = createAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();

  try {
    // 1. Stale Lock Reclamation:
    // Atomic Compare-And-Swap rechecking BOTH status='processing' AND (lease_expires_at < nowIso OR updated_at < stale cutoff).
    // This strictly prevents concurrent scheduler executions from reclaiming an actively running job.
    const staleThresholdIso = new Date(now.getTime() - STALE_PROCESSING_THRESHOLD_MS).toISOString();
    
    // Discover posts candidate for reclamation
    const { data: stalePosts } = await supabase
      .from('posts')
      .select('id, scheduled_at, updated_at, lease_expires_at')
      .eq('status', 'processing')
      .lt('updated_at', staleThresholdIso)
      .limit(10);

    let reclaimedCount = 0;
    if (stalePosts && stalePosts.length > 0) {
      for (const stale of stalePosts) {
        // Atomic compare-and-swap reclamation back to 'scheduled':
        // Crucial: Must recheck BOTH status='processing' AND updated_at < staleThresholdIso
        // so that if another worker updated the timestamp in the interim, this reclamation cleanly aborts.
        const { data: updatedPost, error: reclaimErr } = await supabase
          .from('posts')
          .update({
            status: 'scheduled',
            claim_token: null,
            lease_expires_at: null,
            updated_at: nowIso,
            error_message: 'Recovered from timed-out or interrupted processing lock',
          })
          .eq('id', stale.id)
          .eq('status', 'processing')
          .lt('updated_at', staleThresholdIso)
          .select('id');

        if (!reclaimErr && updatedPost && updatedPost.length > 0) {
          reclaimedCount++;
          // Sync scheduled_jobs if present
          await supabase
            .from('scheduled_jobs')
            .update({
              status: 'scheduled',
              claim_token: null,
              lease_expires_at: null,
              updated_at: nowIso,
            })
            .eq('post_id', stale.id)
            .eq('status', 'processing');
        }
      }
      if (reclaimedCount > 0) {
        logger.info(`Reclaimed ${reclaimedCount} stale processing post(s).`);
      }
    }

    // 2. Fetch due scheduled jobs from Supabase
    const { data: dueJobs, error } = await supabase
      .from('scheduled_jobs')
      .select('id, post_id, status, scheduled_at, attempts')
      .eq('status', 'scheduled')
      .lte('scheduled_at', nowIso)
      .order('scheduled_at', { ascending: true })
      .limit(MAX_BATCH_SIZE);

    if (error) {
      logger.error('Cron failed to query due jobs', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const results: Array<{ postId: string; success: boolean; error?: string }> = [];

    // 3. Process each due post through the CAS-locked publishing pipeline with unique claim tokens
    if (dueJobs && dueJobs.length > 0) {
      logger.info(`Cron Scheduler: Found ${dueJobs.length} due post(s) to publish at ${nowIso}`);

      for (const job of dueJobs) {
        try {
          const claimToken = crypto.randomUUID();
          const publishRes = await executePublishPipeline(job.post_id, { claimToken });
          results.push({
            postId: job.post_id,
            success: publishRes.success,
            error: publishRes.error,
          });
        } catch (postErr: any) {
          results.push({
            postId: job.post_id,
            success: false,
            error: postErr.message,
          });
        }
      }
    }

    const succeededCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;
    const durationMs = Date.now() - startTime;

    // 4. Record execution log in scheduler_execution_logs
    try {
      await supabase.from('scheduler_execution_logs').insert({
        trigger_source: 'pg_cron',
        status: failedCount > 0 && succeededCount === 0 ? 'failed' : 'completed',
        due_jobs_count: dueJobs ? dueJobs.length : 0,
        published_count: succeededCount,
        failed_count: failedCount,
        reclaimed_stale_count: reclaimedCount,
        execution_duration_ms: durationMs,
      });
    } catch (logErr: any) {
      // Non-fatal
    }

    // 5. Update worker_heartbeats telemetry UPON SUCCESSFUL EXECUTION
    // Includes distinct operational counters for health discrimination
    try {
      await supabase.from('worker_heartbeats').upsert(
        {
          id: 'primary_worker',
          mode: 'Vercel Serverless Cron Engine',
          last_seen_at: nowIso,
          uptime_seconds: Math.floor(durationMs / 1000),
          meta: {
            provider: 'serverless-cron',
            last_execution_at: nowIso,
            last_execution_duration_ms: durationMs,
            last_published_count: succeededCount,
            last_failed_count: failedCount,
            last_reclaimed_stale: reclaimedCount,
            last_due_jobs_count: dueJobs ? dueJobs.length : 0,
            last_successful_publish_at: succeededCount > 0 ? nowIso : undefined,
          },
        },
        { onConflict: 'id' }
      );
    } catch (hbErr: any) {
      logger.warn('Failed to record serverless scheduler heartbeat', { error: hbErr?.message || String(hbErr) });
    }

    return NextResponse.json({
      success: true,
      timestamp: nowIso,
      durationMs,
      reclaimedStale: reclaimedCount,
      totalDue: dueJobs ? dueJobs.length : 0,
      succeeded: succeededCount,
      failed: failedCount,
      results,
    });
  } catch (err: any) {
    logger.error('Unexpected cron error', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
