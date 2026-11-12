// ==============================================================
// LINKEDIN AUTOPILOT - CRON SCHEDULER API (REDIS-FREE ENGINE)
// BY GT INNOX LLP
// ==============================================================

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { executePublishPipeline } from '@/lib/queue/publisher';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow full 60s for batch publishing

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Protect endpoint if CRON_SECRET is configured
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && searchParams.get('key') !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  try {
    // 1. Fetch due scheduled jobs from Supabase
    const { data: dueJobs, error } = await supabase
      .from('scheduled_jobs')
      .select('id, post_id, status, scheduled_at')
      .eq('status', 'scheduled')
      .lte('scheduled_at', nowIso)
      .limit(20);

    if (error) {
      logger.error('Cron failed to query due jobs', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!dueJobs || dueJobs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending scheduled posts due for publishing.',
        timestamp: nowIso,
        processed: 0,
      });
    }

    logger.info(`Cron Scheduler: Found ${dueJobs.length} due post(s) to publish at ${nowIso}`);

    const results: Array<{ postId: string; success: boolean; error?: string }> = [];

    // 2. Process each due post through the CAS-locked publishing pipeline
    for (const job of dueJobs) {
      try {
        const publishRes = await executePublishPipeline(job.post_id);
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

    const succeededCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      success: true,
      timestamp: nowIso,
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

