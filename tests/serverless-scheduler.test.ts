// ==============================================================
// LINKEDIN AUTOPILOT - SERVERLESS SCHEDULER TESTS
// BY GT INNOX LLP
// ==============================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { GET as cronPublishHandler } from '../src/app/api/cron/publish/route';
import { GET as healthHandler } from '../src/app/api/health/route';
import { createAdminClient } from '../src/lib/supabase/admin';

// Configure test environment flags
process.env.MOCK_SUPABASE_FOR_TESTS = 'true';
process.env.CRON_SECRET = 'test_cron_secret_secure_123';

test('Serverless Scheduler: Rejects unauthorized requests when CRON_SECRET is set', async () => {
  const req = new Request('http://localhost:3000/api/cron/publish', {
    method: 'GET',
    headers: {},
  });

  const res = await cronPublishHandler(req);
  assert.equal(res.status, 401, 'Should return 401 Unauthorized without credentials');
  const body = await res.json();
  assert.equal(body.error, 'Unauthorized cron request');
});

test('Serverless Scheduler: Authorizes requests with x-vercel-cron header', async () => {
  const req = new Request('http://localhost:3000/api/cron/publish', {
    method: 'GET',
    headers: { 'x-vercel-cron': '1' },
  });

  const res = await cronPublishHandler(req);
  assert.equal(res.status, 200, 'Should authorize Vercel cron header');
  const body = await res.json();
  assert.equal(body.success, true);
});

test('Serverless Scheduler: Authorizes requests with Authorization Bearer header', async () => {
  const req = new Request('http://localhost:3000/api/cron/publish', {
    method: 'GET',
    headers: { authorization: 'Bearer test_cron_secret_secure_123' },
  });

  const res = await cronPublishHandler(req);
  assert.equal(res.status, 200, 'Should authorize valid bearer token');
  const body = await res.json();
  assert.equal(body.success, true);
});

test('Serverless Scheduler: Authorizes requests with query parameter key', async () => {
  const req = new Request('http://localhost:3000/api/cron/publish?key=test_cron_secret_secure_123', {
    method: 'GET',
  });

  const res = await cronPublishHandler(req);
  assert.equal(res.status, 200, 'Should authorize valid query key');
  const body = await res.json();
  assert.equal(body.success, true);
});

test('Serverless Scheduler: Emits worker_heartbeats telemetry and recovers health check', async () => {
  const admin = createAdminClient();

  // First invoke cron to record heartbeat
  const req = new Request('http://localhost:3000/api/cron/publish', {
    method: 'GET',
    headers: { 'x-vercel-cron': '1' },
  });
  const res = await cronPublishHandler(req);
  assert.equal(res.status, 200);

  // Check worker_heartbeats table
  const { data: hb } = await admin
    .from('worker_heartbeats')
    .select('*')
    .eq('id', 'primary_worker')
    .maybeSingle();

  assert.ok(hb, 'Heartbeat record must exist');
  assert.equal(hb.id, 'primary_worker');
  assert.equal(hb.mode, 'Vercel Serverless Cron Engine');
  assert.ok(hb.last_seen_at);

  // Health endpoint should now report healthy worker_engine
  const healthRes = await healthHandler();
  assert.equal(healthRes.status, 200);
  const healthBody = await healthRes.json();
  assert.equal(healthBody.checks.worker_engine.status, 'healthy');
  assert.match(healthBody.checks.worker_engine.message, /Scheduler active/);
});

test('Serverless Scheduler: Handles no due posts gracefully without errors', async () => {
  const req = new Request('http://localhost:3000/api/cron/publish', {
    method: 'GET',
    headers: { 'x-vercel-cron': '1' },
  });
  const res = await cronPublishHandler(req);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.processed, 0);
  assert.equal(body.message, 'No pending scheduled posts due for publishing.');
});

test('Serverless Scheduler: Reclaims stale processing locks (>5 minutes old)', async () => {
  const admin = createAdminClient();
  const staleTimeIso = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  // Insert a mock post stuck in 'processing'
  const mockPostId = 'stale-post-lock-id-999';
  await admin.from('posts').insert({
    id: mockPostId,
    workspace_id: 'test-workspace-id',
    content: 'Stale test post',
    status: 'processing',
    updated_at: staleTimeIso,
  });

  const req = new Request('http://localhost:3000/api/cron/publish', {
    method: 'GET',
    headers: { 'x-vercel-cron': '1' },
  });
  const res = await cronPublishHandler(req);
  const body = await res.json();

  assert.equal(body.success, true);
  assert.ok(body.reclaimedStale >= 1, 'Should reclaim at least 1 stale lock');

  // Verify post status recovered to 'scheduled'
  const { data: recoveredPost } = await admin
    .from('posts')
    .select('status, error_message')
    .eq('id', mockPostId)
    .single();

  assert.equal(recoveredPost?.status, 'scheduled');
  assert.match(recoveredPost?.error_message || '', /Recovered from timed-out/);
});

test('Serverless Scheduler: Concurrency - Prevents duplicate publishing under simultaneous cron calls', async () => {
  const admin = createAdminClient();
  const pastTimeIso = new Date(Date.now() - 60 * 1000).toISOString();
  const concurrentPostId = 'concurrent-post-id-1234';

  // Seed a due post
  await admin.from('posts').insert({
    id: concurrentPostId,
    workspace_id: 'test-workspace-id',
    content: 'Concurrent test post',
    status: 'scheduled',
    scheduled_at: pastTimeIso,
    updated_at: pastTimeIso,
  });

  // Seed scheduled_jobs entry
  await admin.from('scheduled_jobs').insert({
    id: 'job-concurrent-1234',
    post_id: concurrentPostId,
    status: 'scheduled',
    scheduled_at: pastTimeIso,
    attempts: 0,
  });

  // Trigger two simultaneous cron requests
  const req1 = new Request('http://localhost:3000/api/cron/publish', {
    method: 'GET',
    headers: { 'x-vercel-cron': '1' },
  });
  const req2 = new Request('http://localhost:3000/api/cron/publish', {
    method: 'GET',
    headers: { 'x-vercel-cron': '1' },
  });

  const [res1, res2] = await Promise.all([cronPublishHandler(req1), cronPublishHandler(req2)]);

  assert.equal(res1.status, 200);
  assert.equal(res2.status, 200);

  // One may have claimed it or attempted it, but never duplicate successes
  const body1 = await res1.json();
  const body2 = await res2.json();

  const totalSucceeded = (body1.succeeded || 0) + (body2.succeeded || 0);
  assert.ok(totalSucceeded <= 1, 'Never allow duplicate publishing of the same post across simultaneous cron executions');
});
