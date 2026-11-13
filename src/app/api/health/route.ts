// ==============================================================
// LINKEDIN AUTOPILOT - OPERATIONAL HEALTH CHECK API
// BY GT INNOX LLP
// ==============================================================

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();
  const checks: Record<string, { status: 'healthy' | 'degraded' | 'unhealthy'; latencyMs?: number; message?: string; details?: any }> = {};

  // 1. API Availability
  // Implicitly healthy as route handler is responsive
  checks.api_server = {
    status: 'healthy',
    message: 'Next.js API server is operational and responsive',
  };

  // 2. Database Health Check
  const dbStart = Date.now();
  try {
    const admin = createAdminClient();
    const { error } = await admin.from('workspaces').select('id').limit(1);
    const dbLatency = Date.now() - dbStart;

    if (error) {
      checks.database = { status: 'degraded', latencyMs: dbLatency, message: error.message };
    } else {
      checks.database = { status: 'healthy', latencyMs: dbLatency };
    }
  } catch (err: any) {
    checks.database = { status: 'unhealthy', latencyMs: Date.now() - dbStart, message: err.message };
  }

  // 3. LinkedIn API Reachability
  const liStart = Date.now();
  try {
    const liRes = await fetch('https://api.linkedin.com/v2/userinfo', {
      method: 'GET',
      headers: { Authorization: 'Bearer ping_check' },
    });
    const liLatency = Date.now() - liStart;
    // 401 Unauthorized means the API server is reachable and active
    if (liRes.status === 401 || liRes.ok) {
      checks.linkedin_api = { status: 'healthy', latencyMs: liLatency };
    } else {
      checks.linkedin_api = { status: 'degraded', latencyMs: liLatency, message: `HTTP ${liRes.status}` };
    }
  } catch (err: any) {
    checks.linkedin_api = { status: 'degraded', latencyMs: Date.now() - liStart, message: err.message };
  }

  // 4. Last Successful Scheduler Execution Check
  // Evaluates public.worker_heartbeats to verify the scheduler is executing periodically
  const workerStart = Date.now();
  const SCHEDULER_HEARTBEAT_THRESHOLD_SECONDS = 90; // Standard 90s freshness threshold

  try {
    const admin = createAdminClient();
    const { data: heartbeat, error: hbError } = await admin
      .from('worker_heartbeats')
      .select('id, mode, last_seen_at, uptime_seconds, meta')
      .eq('id', 'primary_worker')
      .maybeSingle();

    const workerLatency = Date.now() - workerStart;

    if (hbError) {
      checks.scheduler_execution = {
        status: 'degraded',
        latencyMs: workerLatency,
        message: 'Database query failed when reading scheduler heartbeat',
      };
    } else if (!heartbeat || !heartbeat.last_seen_at) {
      checks.scheduler_execution = {
        status: 'degraded',
        latencyMs: workerLatency,
        message: 'No scheduler execution record found. Cron trigger has not fired yet.',
      };
    } else {
      const lastSeenTime = new Date(heartbeat.last_seen_at).getTime();
      const ageSeconds = Math.max(0, Math.floor((Date.now() - lastSeenTime) / 1000));

      if (isNaN(lastSeenTime) || ageSeconds > SCHEDULER_HEARTBEAT_THRESHOLD_SECONDS) {
        checks.scheduler_execution = {
          status: 'degraded',
          latencyMs: workerLatency,
          message: `Scheduler execution is stale (${ageSeconds}s ago; threshold is ${SCHEDULER_HEARTBEAT_THRESHOLD_SECONDS}s). Trigger may have stopped.`,
          details: { last_execution_at: heartbeat.last_seen_at, age_seconds: ageSeconds },
        };
      } else {
        checks.scheduler_execution = {
          status: 'healthy',
          latencyMs: workerLatency,
          message: `Scheduler active (${heartbeat.mode || 'serverless'}, last execution ${ageSeconds}s ago)`,
          details: {
            last_execution_at: heartbeat.last_seen_at,
            last_execution_duration_ms: heartbeat.meta?.last_execution_duration_ms,
            age_seconds: ageSeconds,
          },
        };
      }
    }
  } catch (err: any) {
    checks.scheduler_execution = {
      status: 'unhealthy',
      latencyMs: Date.now() - workerStart,
      message: err.message || 'Scheduler check failed',
    };
  }

  // 5. Last Successful Publication Telemetry
  // Queries recent successful post publication attempts from the post_publish_attempts ledger
  try {
    const admin = createAdminClient();
    const { data: latestSuccess, error: pubError } = await admin
      .from('post_publish_attempts')
      .select('created_at, post_id')
      .eq('status', 'succeeded')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pubError) {
      checks.last_successful_publication = {
        status: 'healthy',
        message: 'Unable to query publication history (non-fatal)',
      };
    } else if (latestSuccess && latestSuccess.created_at) {
      checks.last_successful_publication = {
        status: 'healthy',
        message: `Last post published at ${latestSuccess.created_at}`,
        details: {
          last_published_at: latestSuccess.created_at,
          post_id: latestSuccess.post_id,
        },
      };
    } else {
      checks.last_successful_publication = {
        status: 'healthy',
        message: 'No published posts recorded yet in ledger',
      };
    }
  } catch (err: any) {
    checks.last_successful_publication = {
      status: 'healthy',
      message: 'Publication ledger check skipped',
    };
  }

  // 6. Stuck Scheduled Jobs Check
  // Explicitly detects posts stuck in 'processing' status > 10 minutes
  try {
    const admin = createAdminClient();
    const tenMinAgoIso = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: stuckPosts, error: stuckErr } = await admin
      .from('posts')
      .select('id, scheduled_at, updated_at')
      .eq('status', 'processing')
      .lt('updated_at', tenMinAgoIso)
      .limit(5);

    if (stuckErr) {
      checks.stuck_scheduled_jobs = {
        status: 'degraded',
        message: `Failed to query stuck posts: ${stuckErr.message}`,
      };
    } else if (stuckPosts && stuckPosts.length > 0) {
      checks.stuck_scheduled_jobs = {
        status: 'degraded',
        message: `${stuckPosts.length} post(s) stuck in processing state for >10m without resolution`,
        details: { count: stuckPosts.length, sample_ids: stuckPosts.map((p) => p.id) },
      };
    } else {
      checks.stuck_scheduled_jobs = {
        status: 'healthy',
        message: 'No stuck processing jobs detected',
      };
    }
  } catch (err: any) {
    checks.stuck_scheduled_jobs = {
      status: 'healthy',
      message: 'Stuck jobs query skipped',
    };
  }

  // Backward-compatibility alias for worker_engine
  checks.worker_engine = checks.scheduler_execution;

  // OVERALL STATUS DISCRIMINATION:
  // - API health is governed by database connectivity.
  // - If scheduler or stuck jobs are degraded, overall status reports 'degraded' without taking down the web API.
  const isApiUnhealthy = checks.database?.status === 'unhealthy';
  const allChecksHealthy = Object.values(checks).every((c) => c.status === 'healthy');

  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (isApiUnhealthy) {
    overallStatus = 'unhealthy';
  } else if (!allChecksHealthy) {
    overallStatus = 'degraded';
  }

  const totalLatency = Date.now() - startTime;

  return NextResponse.json(
    {
      status: overallStatus,
      service: 'LinkedIn Autopilot SaaS',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      totalLatencyMs: totalLatency,
      checks,
    },
    { status: isApiUnhealthy ? 503 : 200 }
  );
}
