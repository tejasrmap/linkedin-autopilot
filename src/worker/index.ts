// ==============================================================
// LINKEDIN AUTOPILOT - PERSISTENT BACKGROUND WORKER
// BY GT INNOX LLP
// ==============================================================

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

import { Worker, Job } from 'bullmq';
import { getRedisConnection } from '../lib/queue/redis';
import { createAdminClient } from '../lib/supabase/admin';
import {
  LINKEDIN_PUBLISH_QUEUE_NAME,
  PublishJobData,
  executePublishPipeline,
} from '../lib/queue/publisher';

console.log('--------------------------------------------------');
console.log('🚀 LinkedIn Autopilot Background Worker Starting');
console.log('🏢 GT InnoX LLP');
console.log('--------------------------------------------------');

const hasRedisConfig = !!process.env.REDIS_URL;

let worker: Worker<PublishJobData> | null = null;
let connection: any = null;

if (hasRedisConfig) {
  try {
    connection = getRedisConnection();
    connection.on('error', (err: any) => {
      console.warn('[Worker-BullMQ] Redis status note:', err.message);
    });

    worker = new Worker<PublishJobData>(
      LINKEDIN_PUBLISH_QUEUE_NAME,
      async (job: Job<PublishJobData>) => {
        const { postId, attemptNumber } = job.data;
        console.log(`[Worker-BullMQ] Processing scheduled publish job for Post ${postId} (Attempt ${attemptNumber})...`);

        const result = await executePublishPipeline(postId);

        if (!result.success) {
          console.error(`[Worker-BullMQ] Failed publishing Post ${postId}: ${result.error}`);
          throw new Error(result.error);
        }

        console.log(`[Worker-BullMQ] Successfully published Post ${postId}! 🎉`);
        return result;
      },
      {
        connection: connection as any,
        concurrency: 5,
      }
    );

    worker.on('ready', () => {
      console.log('[Worker-BullMQ] Connected to Redis and ready to process jobs.');
    });

    worker.on('completed', (job: Job) => {
      console.log(`[Worker-BullMQ] Job ${job.id} completed successfully.`);
    });

    worker.on('failed', (job: Job | undefined, err: Error) => {
      console.error(`[Worker-BullMQ] Job ${job?.id} failed with error: ${err.message}`);
    });
  } catch (err: any) {
    console.warn('[Worker-BullMQ] Redis initialization skipped:', err.message);
  }
} else {
  console.log('[Worker] Running in Database Polling Scheduler mode (standalone persistent daemon).');
}

// -------------------------------------------------------------
// PERSISTENT DB POLLING DAEMON FOR SCHEDULED JOBS
// Guarantees scheduling execution even without external Redis service
// -------------------------------------------------------------
let isPolling = false;

async function checkDueScheduledJobs() {
  if (isPolling) return;
  isPolling = true;

  try {
    const supabase = createAdminClient();
    const nowIso = new Date().toISOString();

    const { data: dueJobs, error } = await supabase
      .from('scheduled_jobs')
      .select('id, post_id, status, scheduled_at')
      .eq('status', 'scheduled')
      .lte('scheduled_at', nowIso)
      .limit(10);

    if (error) {
      // Supabase query note
      return;
    }

    if (dueJobs && dueJobs.length > 0) {
      console.log(`[Worker-Scheduler] Found ${dueJobs.length} due scheduled post(s) to publish at ${nowIso}`);
      for (const job of dueJobs) {
        console.log(`[Worker-Scheduler] Processing scheduled post ID: ${job.post_id}...`);
        const result = await executePublishPipeline(job.post_id);
        if (result.success) {
          console.log(`[Worker-Scheduler] ✅ Successfully published scheduled post ${job.post_id}`);
        } else {
          console.error(`[Worker-Scheduler] ❌ Failed publishing scheduled post ${job.post_id}:`, result.error);
        }
      }
    }
  } catch (err: any) {
    console.error('[Worker-Scheduler] Error in polling loop:', err.message);
  } finally {
    isPolling = false;
  }
}

// Check every 5 seconds
const pollInterval = setInterval(checkDueScheduledJobs, 5000);
// Check immediately on startup to recover any pending overdue jobs
checkDueScheduledJobs();

// -------------------------------------------------------------
// LIVE WORKER HEARTBEAT TELEMETRY
// -------------------------------------------------------------
let heartbeatWarned = false;

async function recordHeartbeat() {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from('worker_heartbeats').upsert(
      {
        id: 'primary_worker',
        mode: hasRedisConfig ? 'BullMQ & DB Poller' : 'Persistent Standalone Poller',
        last_seen_at: new Date().toISOString(),
        pid: process.pid,
        uptime_seconds: Math.floor(process.uptime()),
        meta: {
          nodeVersion: process.version,
          platform: process.platform,
        },
      },
      { onConflict: 'id' }
    );
    if (error) {
      if (!heartbeatWarned) {
        console.warn('[Worker] Heartbeat note (run migration 20261113000004 if table missing):', error.message);
        heartbeatWarned = true;
      }
    }
  } catch (err: any) {
    console.warn('[Worker] Heartbeat error:', err.message);
  }
}

recordHeartbeat();
const heartbeatInterval = setInterval(recordHeartbeat, 15000);

async function shutdown() {
  console.log('\n[Worker] Gracefully shutting down worker...');
  clearInterval(pollInterval);
  clearInterval(heartbeatInterval);
  if (worker) {
    await worker.close();
  }
  if (connection) {
    connection.disconnect();
  }
  console.log('[Worker] Shutdown complete.');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

