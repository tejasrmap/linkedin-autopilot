// ==============================================================
// LINKEDIN AUTOPILOT - OPERATIONAL HEALTH CHECK API
// BY GT INNOX LLP
// ==============================================================

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();
  const checks: Record<string, { status: 'healthy' | 'degraded' | 'unhealthy'; latencyMs?: number; message?: string }> = {};

  // 1. Database Health Check
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

  // 2. LinkedIn API Reachability
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

  // 3. Queue / Worker Live Heartbeat Verification
  // Explicitly queries public.worker_heartbeats to verify background daemon pulse or Vercel Cron pulse
  const workerStart = Date.now();
  // Threshold of 90 seconds (standard heartbeat freshness threshold)
  const WORKER_HEARTBEAT_THRESHOLD_SECONDS = 90;

  try {
    const admin = createAdminClient();
    const { data: heartbeat, error: hbError } = await admin
      .from('worker_heartbeats')
      .select('id, mode, last_seen_at, uptime_seconds, meta')
      .eq('id', 'primary_worker')
      .maybeSingle();

    const workerLatency = Date.now() - workerStart;

    if (hbError) {
      checks.worker_engine = {
        status: 'degraded',
        latencyMs: workerLatency,
        message: 'Database query failed when reading worker heartbeat',
      };
    } else if (!heartbeat || !heartbeat.last_seen_at) {
      checks.worker_engine = {
        status: 'degraded',
        latencyMs: workerLatency,
        message: 'No worker heartbeat record found. Background worker or serverless cron is not registered or running.',
      };
    } else {
      const lastSeenTime = new Date(heartbeat.last_seen_at).getTime();
      const ageSeconds = Math.max(0, Math.floor((Date.now() - lastSeenTime) / 1000));

      if (isNaN(lastSeenTime) || ageSeconds > WORKER_HEARTBEAT_THRESHOLD_SECONDS) {
        checks.worker_engine = {
          status: 'degraded',
          latencyMs: workerLatency,
          message: `Worker heartbeat is stale (${ageSeconds}s old; threshold is ${WORKER_HEARTBEAT_THRESHOLD_SECONDS}s). Scheduler may be stopped.`,
        };
      } else {
        checks.worker_engine = {
          status: 'healthy',
          latencyMs: workerLatency,
          message: `Scheduler active (${heartbeat.mode || 'polling'}, last seen ${ageSeconds}s ago)`,
        };
      }
    }
  } catch (err: any) {
    checks.worker_engine = {
      status: 'unhealthy',
      latencyMs: Date.now() - workerStart,
      message: err.message || 'Worker check failed',
    };
  }

  // 4. Stuck Jobs Health Check (Detect if any jobs are stuck in 'processing' > 10 min)
  try {
    const admin = createAdminClient();
    const tenMinAgoIso = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: stuckPosts } = await admin
      .from('posts')
      .select('id')
      .eq('status', 'processing')
      .lt('updated_at', tenMinAgoIso)
      .limit(5);

    if (stuckPosts && stuckPosts.length > 0) {
      checks.stuck_jobs = {
        status: 'degraded',
        message: `${stuckPosts.length} post(s) stuck in processing state for >10m`,
      };
    } else {
      checks.stuck_jobs = {
        status: 'healthy',
        message: 'No stuck processing jobs detected',
      };
    }
  } catch (err: any) {
    // Non-fatal to primary checks
  }

  // ACCURATE HEALTH STATUS DISCRIMINATION:
  // - API health is governed by database connectivity.
  // - Worker health reports degraded if heartbeat is missing/stale without downing the web API.
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
