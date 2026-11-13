// ==============================================================
// LINKEDIN AUTOPILOT - SERVERLESS SCHEDULER & CRON TESTS
// BY GT INNOX LLP
// ==============================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { GET as cronPublishHandler, POST as cronPostPublishHandler } from '../src/app/api/cron/publish/route';
import { GET as healthHandler } from '../src/app/api/health/route';
import { createAdminClient } from '../src/lib/supabase/admin';

// Configure test environment flags
process.env.MOCK_SUPABASE_FOR_TESTS = 'true';
process.env.CRON_SECRET = 'test_cron_secret_secure_123';

test('Security: Fails closed with 500 when CRON_SECRET is missing or empty', async () => {
  const originalSecret = process.env.CRON_SECRET;
  try {
    delete process.env.CRON_SECRET;
    const req = new Request('http://localhost:3000/api/cron/publish', {
      method: 'GET',
      headers: { authorization: 'Bearer test_cron_secret_secure_123' },
    });
    const res = await cronPublishHandler(req);
    assert.equal(res.status, 500, 'Must fail closed with 500 when server CRON_SECRET is unconfigured');
    const body = await res.json();
    assert.match(body.error, /CRON_SECRET is not configured/);
  } finally {
    process.env.CRON_SECRET = originalSecret;
  }
});

test('Security: Rejects requests missing Authorization header with 401', async () => {
  const req = new Request('http://localhost:3000/api/cron/publish', {
    method: 'GET',
    headers: {},
  });

  const res = await cronPublishHandler(req);
  assert.equal(res.status, 401, 'Should return 401 Unauthorized without credentials');
  const body = await res.json();
  assert.match(body.error, /Valid Authorization Bearer header is required/);
});

test('Security: Rejects secret passed in query parameters (prevents logging secrets)', async () => {
  const req = new Request('http://localhost:3000/api/cron/publish?key=test_cron_secret_secure_123', {
    method: 'GET',
  });

  const res = await cronPublishHandler(req);
  assert.equal(res.status, 401, 'Must reject credentials passed in query parameters');
});

test('Security: Rejects mismatched bearer tokens with 401', async () => {
  const req = new Request('http://localhost:3000/api/cron/publish', {
    method: 'GET',
    headers: { authorization: 'Bearer wrong_invalid_secret_token' },
  });

  const res = await cronPublishHandler(req);
  assert.equal(res.status, 401, 'Must reject invalid bearer token');
});

test('Security: Authorizes valid Authorization Bearer header on GET and POST', async () => {
  const reqGet = new Request('http://localhost:3000/api/cron/publish', {
    method: 'GET',
    headers: { authorization: 'Bearer test_cron_secret_secure_123' },
  });
  const resGet = await cronPublishHandler(reqGet);
  assert.equal(resGet.status, 200, 'Should authorize valid bearer token on GET');
  const bodyGet = await resGet.json();
  assert.equal(bodyGet.success, true);

  const reqPost = new Request('http://localhost:3000/api/cron/publish', {
    method: 'POST',
    headers: {
      authorization: 'Bearer test_cron_secret_secure_123',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ source: 'pg_cron' }),
  });
  const resPost = await cronPostPublishHandler(reqPost);
  assert.equal(resPost.status, 200, 'Should authorize valid bearer token on POST (pg_net)');
  const bodyPost = await resPost.json();
  assert.equal(bodyPost.success, true);
});

test('Scheduling: Handles empty due post queues cleanly', async () => {
  const req = new Request('http://localhost:3000/api/cron/publish', {
    method: 'GET',
    headers: { authorization: 'Bearer test_cron_secret_secure_123' },
  });
  const res = await cronPublishHandler(req);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.totalDue, 0);
  assert.equal(body.succeeded, 0);
  assert.equal(body.failed, 0);
});

test('Concurrency: Prevents duplicate publishing across simultaneous cron invocations', async () => {
  const admin = createAdminClient();
  const pastTimeIso = new Date(Date.now() - 60 * 1000).toISOString();
  const concurrentPostId = 'simultaneous-safe-post-987';

  await admin.from('posts').insert({
    id: concurrentPostId,
    workspace_id: 'test-workspace-id',
    content: 'Concurrent execution test post',
    status: 'scheduled',
    scheduled_at: pastTimeIso,
    updated_at: pastTimeIso,
  });

  await admin.from('scheduled_jobs').insert({
    id: 'job-simultaneous-987',
    post_id: concurrentPostId,
    status: 'scheduled',
    scheduled_at: pastTimeIso,
    attempts: 0,
  });

  const req1 = new Request('http://localhost:3000/api/cron/publish', {
    method: 'GET',
    headers: { authorization: 'Bearer test_cron_secret_secure_123' },
  });
  const req2 = new Request('http://localhost:3000/api/cron/publish', {
    method: 'GET',
    headers: { authorization: 'Bearer test_cron_secret_secure_123' },
  });

  const [res1, res2] = await Promise.all([cronPublishHandler(req1), cronPublishHandler(req2)]);

  assert.equal(res1.status, 200);
  assert.equal(res2.status, 200);

  const body1 = await res1.json();
  const body2 = await res2.json();

  const totalSucceeded = (body1.succeeded || 0) + (body2.succeeded || 0);
  assert.ok(totalSucceeded <= 1, 'Simultaneous requests cannot publish the same post multiple times');
});

test('Stale Reclamation: Rechecks BOTH status=processing and updated_at < cutoff', async () => {
  const admin = createAdminClient();
  const staleTimeIso = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const mockStalePostId = 'stale-cutoff-recheck-post-1';

  await admin.from('posts').insert({
    id: mockStalePostId,
    workspace_id: 'test-workspace-id',
    content: 'Stale test post for atomic recheck',
    status: 'processing',
    updated_at: staleTimeIso,
  });

  const req = new Request('http://localhost:3000/api/cron/publish', {
    method: 'GET',
    headers: { authorization: 'Bearer test_cron_secret_secure_123' },
  });
  const res = await cronPublishHandler(req);
  const body = await res.json();

  assert.equal(body.success, true);
  assert.ok(body.reclaimedStale >= 1, 'Should reclaim the stale processing lock');

  // Verify post returned to scheduled
  const { data: reclaimed } = await admin
    .from('posts')
    .select('status, error_message')
    .eq('id', mockStalePostId)
    .single();

  assert.equal(reclaimed?.status, 'scheduled');
  assert.match(reclaimed?.error_message || '', /Recovered from timed-out/);
});

test('Retry Hardening: Never reopens completed or published jobs', async () => {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const completedPostId = 'already-completed-post-555';

  await admin.from('posts').insert({
    id: completedPostId,
    workspace_id: 'test-workspace-id',
    content: 'Already published post',
    status: 'published',
    updated_at: nowIso,
  });

  // Attempting conditional update on post with status in ['failed', 'processing']
  const { data: updated } = await admin
    .from('posts')
    .update({ status: 'scheduled' })
    .eq('id', completedPostId)
    .in('status', ['failed', 'processing'])
    .select('id');

  assert.equal(updated && updated.length, 0, 'Must NOT update or reopen post that is already published');
});

test('Health: Distinguishes API, Database, Scheduler, Publication, and Stuck Jobs', async () => {
  const healthRes = await healthHandler();
  assert.equal(healthRes.status, 200);
  const body = await healthRes.json();

  assert.ok(body.checks.api_server, 'Must include api_server check');
  assert.equal(body.checks.api_server.status, 'healthy');

  assert.ok(body.checks.database, 'Must include database check');
  assert.equal(body.checks.database.status, 'healthy');

  assert.ok(body.checks.scheduler_execution, 'Must include scheduler_execution check');
  assert.equal(body.checks.scheduler_execution.status, 'healthy');

  assert.ok(body.checks.last_successful_publication, 'Must include last_successful_publication check');
  assert.equal(body.checks.last_successful_publication.status, 'healthy');

  assert.ok(body.checks.stuck_scheduled_jobs, 'Must include stuck_scheduled_jobs check');
  assert.equal(body.checks.stuck_scheduled_jobs.status, 'healthy');
});

test('Lease Ownership: UUID claim token locks post and competing claim is rejected', async () => {
  const admin = createAdminClient();
  const testPostId = 'lease-token-test-post-001';
  const claimToken1 = '11111111-1111-4111-a111-111111111111';
  const claimToken2 = '22222222-2222-4222-a222-222222222222';

  await admin.from('posts').insert({
    id: testPostId,
    workspace_id: 'test-workspace-id',
    content: 'Testing lease token ownership',
    status: 'scheduled',
    scheduled_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // First claim must succeed
  const { data: claim1 } = await admin.rpc('claim_post_for_publishing', {
    target_post_id: testPostId,
    new_claim_token: claimToken1,
    lease_duration_seconds: 300,
  });
  assert.equal(claim1.success, true);
  assert.equal(claim1.claim_token, claimToken1);

  // Competing claim with different token must be rejected
  const { data: claim2 } = await admin.rpc('claim_post_for_publishing', {
    target_post_id: testPostId,
    new_claim_token: claimToken2,
    lease_duration_seconds: 300,
  });
  assert.equal(claim2.success, false);
  assert.equal(claim2.reason, 'already_processing_or_completed');
});

test('Atomic Retry RPC: handle_publishing_failure_and_retry calculates exponential backoff and prevents reopening published posts', async () => {
  const admin = createAdminClient();
  const retryPostId = 'retry-rpc-test-post-002';
  const claimToken = '33333333-3333-4333-a333-333333333333';

  await admin.from('posts').insert({
    id: retryPostId,
    workspace_id: 'test-workspace-id',
    content: 'Testing atomic retry RPC backoff',
    status: 'processing',
    claim_token: claimToken,
    updated_at: new Date().toISOString(),
  });

  await admin.from('scheduled_jobs').insert({
    id: 'retry-job-002',
    post_id: retryPostId,
    status: 'processing',
    attempts: 0,
    claim_token: claimToken,
  });

  // Attempt 1 failure -> schedules retry (attempt 1 < 3)
  const { data: res1 } = await admin.rpc('handle_publishing_failure_and_retry', {
    target_post_id: retryPostId,
    expected_claim_token: claimToken,
    error_message: 'LinkedIn API 500 error',
    max_attempts: 3,
  });

  assert.equal(res1.success, true);
  assert.equal(res1.action, 'scheduled_retry');
  assert.equal(res1.attempts, 1);
  assert.ok(res1.retry_at);

  // Verify published post cannot be reopened by failure/retry RPC
  const publishedPostId = 'immutable-published-post-003';
  await admin.from('posts').insert({
    id: publishedPostId,
    workspace_id: 'test-workspace-id',
    content: 'Published post should never reopen',
    status: 'published',
    updated_at: new Date().toISOString(),
  });

  const { data: resPublished } = await admin.rpc('handle_publishing_failure_and_retry', {
    target_post_id: publishedPostId,
    expected_claim_token: claimToken,
    error_message: 'Spurious error',
    max_attempts: 3,
  });

  assert.equal(resPublished.success, false);
  assert.equal(resPublished.reason, 'post_already_published');
});

test('Health: Reports degraded status when latest scheduler execution log recorded a failed status', async () => {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  // Insert a failed execution log
  await admin.from('scheduler_execution_logs').insert({
    id: 'log-failed-001',
    invoked_at: nowIso,
    status: 'failed',
    due_jobs_count: 1,
    published_count: 0,
    failed_count: 1,
    execution_duration_ms: 120,
  });

  const healthRes = await healthHandler();
  assert.equal(healthRes.status, 200, 'Health endpoint responds with 200 degraded status');
  const body = await healthRes.json();

  assert.equal(body.checks.scheduler_execution.status, 'degraded');
  assert.match(body.checks.scheduler_execution.message, /Latest scheduler execution recorded a failed status/);
  assert.equal(body.status, 'degraded');
});

test('Lease Ownership: Rejects NULL or empty expected claim token in retry and finalize', async () => {
  const admin = createAdminClient();
  const testPostId = 'null-token-test-post-101';

  await admin.from('posts').insert({
    id: testPostId,
    workspace_id: 'test-ws',
    content: 'Null token rejection test',
    status: 'processing',
    claim_token: 'valid-claim-token-123',
    lease_expires_at: new Date(Date.now() + 300000).toISOString(),
  });

  // Null expected token in retry RPC
  const { data: retryNull } = await admin.rpc('handle_publishing_failure_and_retry', {
    target_post_id: testPostId,
    expected_claim_token: null as any,
    error_message: 'Some error',
  });
  assert.equal(retryNull.success, false);
  assert.equal(retryNull.reason, 'expected_claim_token_required');

  // Null expected token in finalize RPC
  const { data: finalizeNull } = await admin.rpc('finalize_post_publishing', {
    target_post_id: testPostId,
    expected_claim_token: null as any,
    provider_post_id: 'urn:li:share:123',
  });
  assert.equal(finalizeNull.success, false);
  assert.equal(finalizeNull.reason, 'expected_claim_token_required');
});

test('Lease Ownership: Rejects operations when stored claim token is NULL (unowned post)', async () => {
  const admin = createAdminClient();
  const unownedPostId = 'unowned-post-102';

  await admin.from('posts').insert({
    id: unownedPostId,
    workspace_id: 'test-ws',
    content: 'Unowned post test',
    status: 'processing',
    claim_token: null,
    lease_expires_at: new Date(Date.now() + 300000).toISOString(),
  });

  const { data: retryRes } = await admin.rpc('handle_publishing_failure_and_retry', {
    target_post_id: unownedPostId,
    expected_claim_token: 'worker-token-xyz',
    error_message: 'Some error',
  });
  assert.equal(retryRes.success, false);
  assert.equal(retryRes.reason, 'claim_token_missing_unowned');

  const { data: finalizeRes } = await admin.rpc('finalize_post_publishing', {
    target_post_id: unownedPostId,
    expected_claim_token: 'worker-token-xyz',
    provider_post_id: 'urn:li:share:102',
  });
  assert.equal(finalizeRes.success, false);
  assert.equal(finalizeRes.reason, 'claim_token_missing_unowned');
});

test('Lease Ownership: Rejects operations when claim token does not match (losing worker)', async () => {
  const admin = createAdminClient();
  const postMismatchId = 'mismatch-post-103';
  const winningToken = 'winning-worker-token-aaa';
  const losingToken = 'losing-worker-token-bbb';

  await admin.from('posts').insert({
    id: postMismatchId,
    workspace_id: 'test-ws',
    content: 'Mismatch test post',
    status: 'processing',
    claim_token: winningToken,
    lease_expires_at: new Date(Date.now() + 300000).toISOString(),
  });

  // Losing worker tries to fail/retry
  const { data: retryRes } = await admin.rpc('handle_publishing_failure_and_retry', {
    target_post_id: postMismatchId,
    expected_claim_token: losingToken,
    error_message: 'Losing worker error',
  });
  assert.equal(retryRes.success, false);
  assert.equal(retryRes.reason, 'claim_token_mismatch_lease_lost');

  // Losing worker tries to finalize
  const { data: finalizeRes } = await admin.rpc('finalize_post_publishing', {
    target_post_id: postMismatchId,
    expected_claim_token: losingToken,
    provider_post_id: 'urn:li:share:103',
  });
  assert.equal(finalizeRes.success, false);
  assert.equal(finalizeRes.reason, 'claim_token_mismatch_lease_lost');

  // Verify winning token remains completely intact
  const { data: postCheck } = await admin.from('posts').select('claim_token, status').eq('id', postMismatchId).single();
  assert.ok(postCheck);
  assert.equal(postCheck.claim_token, winningToken);
  assert.equal(postCheck.status, 'processing');
});

test('Lease Ownership: Rejects operations when lease has expired', async () => {
  const admin = createAdminClient();
  const expiredPostId = 'expired-lease-post-104';
  const workerToken = 'token-expired-worker';
  const pastIso = new Date(Date.now() - 60000).toISOString();

  await admin.from('posts').insert({
    id: expiredPostId,
    workspace_id: 'test-ws',
    content: 'Expired lease post',
    status: 'processing',
    claim_token: workerToken,
    lease_expires_at: pastIso,
  });

  const { data: retryRes } = await admin.rpc('handle_publishing_failure_and_retry', {
    target_post_id: expiredPostId,
    expected_claim_token: workerToken,
    error_message: 'Timed out call',
  });
  assert.equal(retryRes.success, false);
  assert.equal(retryRes.reason, 'lease_expired');

  const { data: finalizeRes } = await admin.rpc('finalize_post_publishing', {
    target_post_id: expiredPostId,
    expected_claim_token: workerToken,
    provider_post_id: 'urn:li:share:104',
  });
  assert.equal(finalizeRes.success, false);
  assert.equal(finalizeRes.reason, 'lease_expired');
});

test('Lease Ownership: Missing scheduled_jobs record is inserted during failure retry, preventing orphaned post', async () => {
  const admin = createAdminClient();
  const orphanPostId = 'orphan-post-without-job-105';
  const workerToken = 'token-orphan-worker';

  await admin.from('posts').insert({
    id: orphanPostId,
    workspace_id: 'test-ws',
    content: 'Orphan post without scheduled job',
    status: 'processing',
    claim_token: workerToken,
    lease_expires_at: new Date(Date.now() + 300000).toISOString(),
  });

  // No scheduled_jobs row exists for orphanPostId
  const { data: retryRes } = await admin.rpc('handle_publishing_failure_and_retry', {
    target_post_id: orphanPostId,
    expected_claim_token: workerToken,
    error_message: 'Initial failure on missing job post',
    max_attempts: 3,
  });

  assert.equal(retryRes.success, true);
  assert.equal(retryRes.action, 'scheduled_retry');

  // Verify scheduled_jobs row was created
  const { data: jobs } = await admin.from('scheduled_jobs').select('*').eq('post_id', orphanPostId);
  assert.ok(jobs && jobs.length === 1, 'Must insert a missing scheduled_jobs row');
  assert.equal(jobs[0].status, 'scheduled');
  assert.equal(jobs[0].attempts, 1);
});

test('Lease Ownership: Duplicate scheduled_jobs records are cancelled deterministically', async () => {
  const admin = createAdminClient();
  const dupPostId = 'dup-jobs-post-106';
  const workerToken = 'token-dup-worker';

  await admin.from('posts').insert({
    id: dupPostId,
    workspace_id: 'test-ws',
    content: 'Post with duplicate scheduled jobs',
    status: 'processing',
    claim_token: workerToken,
    lease_expires_at: new Date(Date.now() + 300000).toISOString(),
  });

  // Insert primary and duplicate scheduled_jobs
  await admin.from('scheduled_jobs').insert([
    {
      id: 'job-primary-106',
      post_id: dupPostId,
      status: 'processing',
      attempts: 0,
      created_at: new Date(Date.now() - 1000).toISOString(),
    },
    {
      id: 'job-duplicate-106',
      post_id: dupPostId,
      status: 'scheduled',
      attempts: 0,
      created_at: new Date(Date.now() - 5000).toISOString(),
    },
  ]);

  const { data: retryRes } = await admin.rpc('handle_publishing_failure_and_retry', {
    target_post_id: dupPostId,
    expected_claim_token: workerToken,
    error_message: 'Network issue',
    max_attempts: 3,
  });

  assert.equal(retryRes.success, true);

  // Check scheduled_jobs: duplicate should be cancelled
  const { data: jobs } = await admin.from('scheduled_jobs').select('*').eq('post_id', dupPostId);
  assert.ok(jobs);
  const cancelled = jobs.filter((j: any) => j.status === 'cancelled');
  const scheduled = jobs.filter((j: any) => j.status === 'scheduled');

  assert.equal(cancelled.length, 1, 'Older duplicate must be cancelled');
  assert.equal(scheduled.length, 1, 'Authoritative job must be scheduled');
});

test('Lease Ownership: Atomic finalize_post_publishing updates posts and scheduled_jobs and clears lease tokens', async () => {
  const admin = createAdminClient();
  const finPostId = 'finalize-clean-post-107';
  const workerToken = 'token-finalize-worker';

  await admin.from('posts').insert({
    id: finPostId,
    workspace_id: 'test-ws',
    content: 'Clean finalize test post',
    status: 'processing',
    claim_token: workerToken,
    lease_expires_at: new Date(Date.now() + 300000).toISOString(),
  });

  await admin.from('scheduled_jobs').insert({
    id: 'job-fin-107',
    post_id: finPostId,
    status: 'processing',
    claim_token: workerToken,
  });

  const { data: finRes } = await admin.rpc('finalize_post_publishing', {
    target_post_id: finPostId,
    expected_claim_token: workerToken,
    provider_post_id: 'urn:li:share:published-107',
  });

  assert.equal(finRes.success, true);
  assert.equal(finRes.provider_post_id, 'urn:li:share:published-107');

  const { data: postRecord } = await admin.from('posts').select('*').eq('id', finPostId).single();
  assert.equal(postRecord.status, 'published');
  assert.equal(postRecord.claim_token, null);
  assert.equal(postRecord.lease_expires_at, null);
  assert.equal(postRecord.provider_post_id, 'urn:li:share:published-107');

  const { data: jobRecord } = await admin.from('scheduled_jobs').select('*').eq('id', 'job-fin-107').single();
  assert.equal(jobRecord.status, 'completed');
  assert.equal(jobRecord.claim_token, null);
  assert.equal(jobRecord.lease_expires_at, null);
});

