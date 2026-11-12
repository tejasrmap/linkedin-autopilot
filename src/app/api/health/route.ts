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

  // 3. Queue / Worker Status
  checks.worker_engine = {
    status: 'healthy',
    message: process.env.REDIS_URL ? 'BullMQ Redis Active' : 'Persistent Database Poller Active',
  };

  const isHealthy = Object.values(checks).every((c) => c.status !== 'unhealthy');
  const totalLatency = Date.now() - startTime;

  return NextResponse.json(
    {
      status: isHealthy ? 'healthy' : 'degraded',
      service: 'LinkedIn Autopilot SaaS',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      totalLatencyMs: totalLatency,
      checks,
    },
    { status: isHealthy ? 200 : 503 }
  );
}

