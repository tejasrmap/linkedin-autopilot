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
  const { searchParams } = new URL(request.url);
  const authHeader = request.headers.get('authorization');
  const vercelCronHeader = request.headers.get('x-vercel-cron');
  const cronSecret = process.env.CRON_SECRET;

  // Protect endpoint: Allow Vercel Cron header OR matching CRON_SECRET (bearer or query)
  const isVercelCron = vercelCronHeader === '1' || vercelCronHeader === 'true';
  const isBearerAuthorized = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const isKeyAuthorized = cronSecret && searchParams.get('key') === cronSecret;

  if (cronSecret && !isVercelCron && !isBearerAuthorized && !isKeyAuthorized) {
    return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();

  try {
    // 1. Telemetry / Heartbeat Emission for Serverless Health Verification
    // Updates public.worker_heartbeats so /api/health reliably reports 'healthy' without a persistent daemon
    try {
      await supabase.from('worker_heartbeats').upsert(
        {
          id: 'primary_worker',
          mode: 'Vercel Serverless Cron Engine',
          last_seen_at: nowIso,
          uptime_seconds: 0,
          meta: {
            provider: 'vercel-cron',
            invoked_at: nowIso,
            source: isVercelCron ? 'vercel-cron-header' : 'authorized-cron-trigger',
          },
        },
        { onConflict: 'id' }
      );
    } catch (hbErr: any) {
      logger.warn('Failed to record serverless worker heartbeat', { error: hbErr?.message || String(hbErr) });
    }

    // 2. Stale Lock Reclamation: Recover posts stuck in 'processing' for > 5 minutes
    const staleThresholdIso = new Date(now.getTime() - STALE_PROCESSING_THRESHOLD_MS).toISOString();
    const { data: stalePosts } = await supabase
      .from('posts')
      .select('id, scheduled_at, updated_at')
      .eq('status', 'processing')
      .lt('updated_at', staleThresholdIso)
      .limit(10);

    let reclaimedCount = 0;
    if (stalePosts && stalePosts.length > 0) {
      for (const stale of stalePosts) {
        // Atomic compare-and-swap reclamation back to 'scheduled' if still stale
        const { error: reclaimErr } = await supabase
          .from('posts')
          .update({
            status: 'scheduled',
            updated_at: nowIso,
            error_message: 'Recovered from timed-out or interrupted processing lock',
          })
          .eq('id', stale.id)
          .eq('status', 'processing');

        if (!reclaimErr) {
          reclaimedCount++;
          // Also sync scheduled_jobs if present
          await supabase
            .from('scheduled_jobs')
            .update({ status: 'scheduled', updated_at: nowIso })
            .eq('post_id', stale.id)
            .eq('status', 'processing');
        }
      }
      logger.info(`Reclaimed ${reclaimedCount} stale processing post(s).`);
    }

    // 3. Fetch due scheduled jobs from Supabase
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

    if (!dueJobs || dueJobs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending scheduled posts due for publishing.',
        timestamp: nowIso,
        reclaimedStale: reclaimedCount,
        processed: 0,
      });
    }

    logger.info(`Cron Scheduler: Found ${dueJobs.length} due post(s) to publish at ${nowIso}`);

    const results: Array<{ postId: string; success: boolean; error?: string }> = [];

    // 4. Process each due post through the CAS-locked publishing pipeline
    for (const job of dueJobs) {
      try {
        const publishRes = await executePublishPipeline(job.post_id);
        results.push({
          postId: job.post_id,
          success: publishRes.success,
          error: publishRes.error,
        });

        // 5. Exponential Backoff on Failure (Max 3 attempts)
        if (!publishRes.success && publishRes.error) {
          const currentAttempts = (job.attempts || 0) + 1;
          const MAX_ATTEMPTS = 3;

          if (currentAttempts < MAX_ATTEMPTS) {
            // Delay next attempt: 2^attempts minutes (2m, 4m, 8m)
            const backoffMinutes = Math.pow(2, currentAttempts);
            const retryAtIso = new Date(now.getTime() + backoffMinutes * 60 * 1000).toISOString();

            await supabase
              .from('scheduled_jobs')
              .update({
                status: 'scheduled',
                scheduled_at: retryAtIso,
                attempts: currentAttempts,
                last_error: publishRes.error,
                updated_at: nowIso,
              })
              .eq('id', job.id);

            // Keep post as scheduled with updated scheduled_at so it gets picked up on retry
            await supabase
              .from('posts')
              .update({
                status: 'scheduled',
                scheduled_at: retryAtIso,
                error_message: `Attempt ${currentAttempts} failed: ${publishRes.error}. Next retry scheduled for ${retryAtIso}`,
                updated_at: nowIso,
              })
              .eq('id', job.post_id);
          }
        }
      } catch (postErr: any) {
        results.push({
          postId: job.post_id,
          success: false,
          error: postErr.message,
        });
      }
    }

    const succeededCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      success: true,
      timestamp: nowIso,
      reclaimedStale: reclaimedCount,
      totalDue: dueJobs.length,
      succeeded: succeededCount,
      failed: dueJobs.length - succeededCount,
      results,
    });
  } catch (err: any) {
    logger.error('Unexpected cron error', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
