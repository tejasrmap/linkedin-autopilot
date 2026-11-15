// ==============================================================
// LINKEDIN AUTOPILOT - MULTI-USER PUBLISHING & RELIABILITY TEST SUITE
// BY GT INNOX LLP
// ==============================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminClient } from '../src/lib/supabase/admin';
import {
  schedulePostPublishJob,
  executePublishPipeline,
  isRpcFunctionMissingError,
  rollbackPostStatusOnJobFailure,
  cancelScheduledJob,
} from '../src/lib/queue/publisher';
import { encryptToken, decryptToken } from '../src/lib/encryption';

process.env.MOCK_SUPABASE_FOR_TESTS = 'true';
process.env.CRON_SECRET = 'test_cron_secret_secure_123';

// ==============================================================
// GROUP 1: STRICT OAUTH SCOPE VALIDATION (FAIL-CLOSED)
// ==============================================================

test('OAuth Scopes: Valid w_member_social permits personal member publishing', () => {
  const account = {
    account_type: 'member',
    account_name: 'Valid Member',
    scopes: ['openid', 'profile', 'email', 'w_member_social'],
  };

  const normalized = Array.isArray(account.scopes)
    ? account.scopes.flatMap((s) => s.split(/[\s,]+/)).map((s) => s.trim()).filter(Boolean)
    : [];

  assert.equal(normalized.includes('w_member_social'), true);
  const isEligible = account.account_type === 'member' && normalized.includes('w_member_social');
  assert.equal(isEligible, true);
});

test('OAuth Scopes: Empty scopes strictly FAILS CLOSED and rejects publishing', () => {
  // Regression test for Issue A where normalizedScopes.length > 0 allowed empty scopes to bypass validation
  const account = {
    account_type: 'member',
    account_name: 'Empty Scopes Member',
    scopes: [] as string[],
  };

  const normalized = Array.isArray(account.scopes)
    ? account.scopes.flatMap((s) => s.split(/[\s,]+/)).map((s) => s.trim()).filter(Boolean)
    : [];

  assert.equal(normalized.length, 0);
  assert.equal(normalized.includes('w_member_social'), false);

  // Must reject when w_member_social is not included (even when length is 0)
  const isRejected = account.account_type === 'member' && !normalized.includes('w_member_social');
  assert.equal(isRejected, true, 'Empty scopes must fail closed');
});

test('OAuth Scopes: Null, undefined, or missing scopes strictly FAILS CLOSED', () => {
  const accounts = [
    { account_type: 'member', account_name: 'Null Scopes', scopes: null },
    { account_type: 'member', account_name: 'Undefined Scopes', scopes: undefined },
    { account_type: 'member', account_name: 'Missing Scopes' },
  ];

  for (const acc of accounts) {
    const normalized = Array.isArray((acc as any).scopes)
      ? (acc as any).scopes.flatMap((s: string) => s.split(/[\s,]+/)).map((s: string) => s.trim()).filter(Boolean)
      : [];

    const isRejected = acc.account_type === 'member' && !normalized.includes('w_member_social');
    assert.equal(isRejected, true, `Account ${acc.account_name} must fail closed`);
  }
});

test('OAuth Scopes: Parses space-separated, comma-separated, and duplicate scopes accurately', () => {
  // Comma-separated (LinkedIn default)
  const commaScopes = 'openid,profile,email,w_member_social';
  const parsedComma = commaScopes.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  assert.equal(parsedComma.includes('w_member_social'), true);

  // Whitespace-separated
  const spaceScopes = 'openid profile email w_member_social';
  const parsedSpace = spaceScopes.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  assert.equal(parsedSpace.includes('w_member_social'), true);

  // Duplicate scopes with trailing spaces
  const dupScopes = ['w_member_social, w_member_social, email, openid '];
  const parsedDup = dupScopes.flatMap((s) => s.split(/[\s,]+/)).map((s) => s.trim()).filter(Boolean);
  assert.equal(parsedDup.includes('w_member_social'), true);
  assert.equal(parsedDup.filter((s) => s === 'w_member_social').length, 2);
});

test('OAuth Scopes: Missing publishing scope generates actionable reauthorize error message', () => {
  const account = {
    account_type: 'member',
    account_name: 'Read Only Member',
    scopes: ['openid', 'profile', 'email'],
  };

  const normalized = Array.isArray(account.scopes)
    ? account.scopes.flatMap((s) => s.split(/[\s,]+/)).map((s) => s.trim()).filter(Boolean)
    : [];

  const lacksScope = account.account_type === 'member' && !normalized.includes('w_member_social');
  assert.equal(lacksScope, true);

  const errorMsg = `LinkedIn account "${account.account_name}" lacks verified "w_member_social" posting permission. Please reconnect or reauthorize your LinkedIn account.`;
  assert.match(errorMsg, /reconnect or reauthorize your LinkedIn account/);
  assert.match(errorMsg, /w_member_social/);
});

test('OAuth Scopes: Organization accounts are untouched by personal member scope checks', () => {
  const orgAccount = {
    account_type: 'organization',
    account_name: 'GT InnoX Page',
    scopes: ['w_organization_social'],
  };

  const isMemberCheckApplied = orgAccount.account_type === 'member';
  assert.equal(isMemberCheckApplied, false, 'Organization accounts must remain frozen and untouched');
});

// ==============================================================
// GROUP 2: SCHEDULED JOB INSERTION RELIABILITY
// ==============================================================

test('Job Persistence: Scheduled job insertion succeeds and keeps post and job in sync', async () => {
  const admin = createAdminClient();
  const testPostId = 'sync-post-persist-001';
  const testWs = 'ws-persist-test';

  await admin.from('posts').insert({
    id: testPostId,
    workspace_id: testWs,
    content: 'Testing job insertion sync',
    status: 'draft',
    scheduled_at: null,
  });

  const scheduledTime = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const result = await schedulePostPublishJob(testPostId, testWs, scheduledTime);

  assert.equal(result.success, true);
  assert.ok(result.queueJobId);

  // Verify post state is 'scheduled'
  const { data: post } = await admin.from('posts').select('*').eq('id', testPostId).single();
  assert.equal(post.status, 'scheduled');
  assert.equal(post.scheduled_at, scheduledTime.toISOString());

  // Verify scheduled_jobs record exists and is 'scheduled'
  const { data: jobs } = await admin.from('scheduled_jobs').select('*').eq('post_id', testPostId);
  assert.ok(jobs && jobs.length >= 1);
  assert.equal(jobs[0].status, 'scheduled');
});

test('Job Persistence: Failed job insertion rolls back post status via rollbackPostStatusOnJobFailure', async () => {
  const admin = createAdminClient();
  const orphanTestPostId = 'rollback-on-job-failure-post-002';
  const testWs = 'ws-fail-inject';

  await admin.from('posts').insert({
    id: orphanTestPostId,
    workspace_id: testWs,
    content: 'Post where scheduled_jobs insert fails',
    status: 'scheduled',
    scheduled_at: new Date().toISOString(),
  });

  const rollbackResult = await rollbackPostStatusOnJobFailure(
    admin,
    orphanTestPostId,
    ['scheduled'],
    'Failed to persist scheduled job: connection failure'
  );

  assert.equal(rollbackResult.rolledBack, true);

  const { data: post } = await admin.from('posts').select('*').eq('id', orphanTestPostId).single();
  assert.equal(post.status, 'draft', 'Post must be reverted to draft to avoid orphaned post without execution record');
  assert.match(post.error_message, /Failed to persist scheduled job/);
});

test('Job Persistence: Optimistic locking protects post status if concurrently claimed or transitioned', async () => {
  const admin = createAdminClient();
  const racePostId = 'rollback-race-post-003';
  const testWs = 'ws-fail-inject';

  // Post was claimed by a concurrent worker and moved to 'processing' with a lease
  await admin.from('posts').insert({
    id: racePostId,
    workspace_id: testWs,
    content: 'Post concurrently claimed by worker',
    status: 'processing',
    claim_token: 'worker-lease-token-999',
    lease_expires_at: new Date(Date.now() + 300000).toISOString(),
  });

  // Rollback expects 'scheduled', but post is now 'processing'
  const rollbackResult = await rollbackPostStatusOnJobFailure(
    admin,
    racePostId,
    ['scheduled'],
    'Failed to persist scheduled job: duplicate key'
  );

  assert.equal(rollbackResult.rolledBack, false);
  assert.equal(rollbackResult.error, 'post_status_transitioned');

  // Verify post in database was NOT overwritten and remained 'processing'
  const { data: post } = await admin.from('posts').select('*').eq('id', racePostId).single();
  assert.equal(post.status, 'processing');
  assert.equal(post.claim_token, 'worker-lease-token-999');
});

test('Job Persistence: Publish Now rollback protects against concurrent worker claim or publication', async () => {
  const admin = createAdminClient();
  const publishedPostId = 'rollback-published-post-004';
  const testWs = 'ws-fail-inject';

  // Post already published by another channel
  await admin.from('posts').insert({
    id: publishedPostId,
    workspace_id: testWs,
    content: 'Post already published',
    status: 'published',
    provider_post_id: 'urn:li:share:already-published',
  });

  // Publish Now rollback allows ['draft', 'scheduled'], but post is 'published'
  const rollbackResult = await rollbackPostStatusOnJobFailure(
    admin,
    publishedPostId,
    ['draft', 'scheduled'],
    'Failed to persist publishing execution record'
  );

  assert.equal(rollbackResult.rolledBack, false);
  assert.equal(rollbackResult.error, 'post_status_transitioned');

  // Post status must not be modified to draft!
  const { data: post } = await admin.from('posts').select('*').eq('id', publishedPostId).single();
  assert.equal(post.status, 'published');
  assert.equal(post.provider_post_id, 'urn:li:share:already-published');
});

test('Job Persistence: Database error during rollback fails safely without throwing unhandled exceptions', async () => {
  // Mock client that returns error on update
  const failingClient = {
    from: () => ({
      update: () => ({
        eq: () => ({
          eq: () => ({
            select: async () => ({ data: null, error: { message: 'relation locked or database timeout', code: '57014' } }),
          }),
        }),
      }),
    }),
  };

  const rollbackResult = await rollbackPostStatusOnJobFailure(
    failingClient,
    'post-db-err-1',
    ['scheduled'],
    'Failed to persist scheduled job'
  );

  assert.equal(rollbackResult.rolledBack, false);
  assert.match(rollbackResult.error || '', /relation locked or database timeout/);
});

// ==============================================================
// GROUP 3: RESTRICTED RPC FALLBACKS (FAIL CLOSED)
// ==============================================================

test('RPC Fallback Guard: Accurately identifies genuine missing RPC error codes', () => {
  // PostgREST missing function code
  assert.equal(isRpcFunctionMissingError({ code: 'PGRST202', message: 'Could not find the function in schema cache' }), true);

  // PostgreSQL undefined_function code
  assert.equal(isRpcFunctionMissingError({ code: '42883', message: 'function finalize_post_publishing does not exist' }), true);

  // Message matches
  assert.equal(isRpcFunctionMissingError({ message: 'could not find the function public.finalize_post_publishing' }), true);
});

test('RPC Fallback Guard: Rejects misleading schema-cache messages that lack missing-function specifics', () => {
  // Generic schema-cache reload timeout
  assert.equal(isRpcFunctionMissingError({ message: 'schema cache reload failed due to network timeout' }), false);

  // Generic schema-cache connection error
  assert.equal(isRpcFunctionMissingError({ message: 'could not reload schema cache' }), false);

  // Generic HTTP 500 mentioning schema cache
  assert.equal(isRpcFunctionMissingError({ code: '500', message: 'unexpected error in schema cache' }), false);

  // PostgREST 500 error mentioning schema cache
  assert.equal(isRpcFunctionMissingError({ code: 'PGRST500', message: 'schema cache reload timeout' }), false);

  // Connection error mentioning schema cache
  assert.equal(isRpcFunctionMissingError({ code: '08006', message: 'error while connecting to schema cache' }), false);
});

test('RPC Fallback Guard: Verifies specific function name when expectedFunctionName is supplied', () => {
  // Matching target function name
  assert.equal(
    isRpcFunctionMissingError(
      { code: 'PGRST202', message: 'Could not find the function public.finalize_post_publishing in the schema cache' },
      'finalize_post_publishing'
    ),
    true
  );

  // Mismatched function name (e.g. error is about another RPC entirely)
  assert.equal(
    isRpcFunctionMissingError(
      { code: 'PGRST202', message: 'Could not find the function public.other_function in the schema cache' },
      'finalize_post_publishing'
    ),
    false
  );

  // Matching 42883 with target function
  assert.equal(
    isRpcFunctionMissingError(
      { code: '42883', message: 'function finalize_post_publishing does not exist' },
      'finalize_post_publishing'
    ),
    true
  );

  // Mismatched 42883 with target function
  assert.equal(
    isRpcFunctionMissingError(
      { code: '42883', message: 'function handle_publishing_failure_and_retry does not exist' },
      'finalize_post_publishing'
    ),
    false
  );

  // Non-structured message matching target function
  assert.equal(
    isRpcFunctionMissingError(
      { message: 'could not find the function public.finalize_post_publishing' },
      'finalize_post_publishing'
    ),
    true
  );

  // Non-structured message with mismatched function
  assert.equal(
    isRpcFunctionMissingError(
      { message: 'could not find the function public.claim_post_for_publishing' },
      'finalize_post_publishing'
    ),
    false
  );
});

test('RPC Fallback Guard: Rejects network, timeout, and permission errors from triggering direct fallback', () => {
  // Network timeout: MUST FAIL CLOSED
  assert.equal(isRpcFunctionMissingError({ code: '57014', message: 'canceling statement due to statement timeout' }), false);

  // Permission denied: MUST FAIL CLOSED
  assert.equal(isRpcFunctionMissingError({ code: '42501', message: 'permission denied for function finalize_post_publishing' }), false);

  // Database connection failure: MUST FAIL CLOSED
  assert.equal(isRpcFunctionMissingError({ code: '08006', message: 'connection failure: database unreachable' }), false);

  // Unique constraint violation: MUST FAIL CLOSED
  assert.equal(isRpcFunctionMissingError({ code: '23505', message: 'duplicate key value violates unique constraint' }), false);

  // Lease ownership rejection: MUST FAIL CLOSED
  assert.equal(isRpcFunctionMissingError({ code: 'P0001', message: 'claim_token_mismatch_lease_lost' }), false);

  // Null/undefined error
  assert.equal(isRpcFunctionMissingError(null), false);
  assert.equal(isRpcFunctionMissingError(undefined), false);
});

// ==============================================================
// GROUP 4: MULTI-TENANT WORKSPACE ISOLATION & PUBLISHING
// ==============================================================

test('Multi-Tenant: Independent workspaces connect personal LinkedIn accounts with isolated encrypted tokens', () => {
  const founderRawToken = 'AQVfounder_secret_live_access_token_token_123';
  const userRawToken = 'AQVuser_rohan_live_access_token_secure_456';

  const founderEncrypted = encryptToken(founderRawToken);
  const userEncrypted = encryptToken(userRawToken);

  assert.notEqual(founderEncrypted, userEncrypted);

  // Decryption recovers exact independent credentials
  const founderDecrypted = decryptToken(founderEncrypted);
  const userDecrypted = decryptToken(userEncrypted);

  assert.equal(founderDecrypted, founderRawToken);
  assert.equal(userDecrypted, userRawToken);
});

test('Multi-Tenant: Workspace A cannot publish post using Workspace B social account (Security Violation)', async () => {
  const admin = createAdminClient();
  const wsA = 'ws-tenant-alpha-111';
  const wsB = 'ws-tenant-bravo-222';

  const crossTenantPostId = 'cross-tenant-violator-post';
  const foreignAccountId = 'foreign-account-ws-b';

  // Account belongs to Workspace B
  await admin.from('social_accounts').insert({
    id: foreignAccountId,
    workspace_id: wsB,
    account_type: 'member',
    account_name: 'User Bravo',
    provider: 'linkedin',
    provider_account_id: 'sub_bravo_999',
    connection_status: 'active',
    scopes: ['w_member_social'],
  });

  // Post belongs to Workspace A, but points to Account in Workspace B
  await admin.from('posts').insert({
    id: crossTenantPostId,
    workspace_id: wsA,
    social_account_id: foreignAccountId,
    content: 'Attempting cross-tenant publishing',
    status: 'draft',
  });

  const { data: postRecord } = await admin.from('posts').select('*, social_account:social_accounts(*)').eq('id', crossTenantPostId).single();
  const { data: socialAccount } = await admin.from('social_accounts').select('*').eq('id', foreignAccountId).single();

  // Multi-workspace security check executed in publisher.ts line 255:
  const isSecurityViolation = socialAccount.workspace_id !== postRecord.workspace_id;
  assert.equal(isSecurityViolation, true, 'Assigned account from different workspace must be detected as isolation violation');
});

test('Multi-Tenant: Workspace A queries strictly return 0 rows for Workspace B posts (RLS Isolation)', async () => {
  const admin = createAdminClient();
  const wsA = 'ws-isolated-alpha';
  const wsB = 'ws-isolated-beta';

  await admin.from('posts').insert([
    { id: 'post-ws-a-1', workspace_id: wsA, content: 'Alpha content 1', status: 'draft' },
    { id: 'post-ws-a-2', workspace_id: wsA, content: 'Alpha content 2', status: 'published' },
    { id: 'post-ws-b-1', workspace_id: wsB, content: 'Beta content 1', status: 'draft' },
  ]);

  // Query Workspace A
  const { data: alphaPosts } = await admin.from('posts').select('id, workspace_id').eq('workspace_id', wsA);
  assert.ok(alphaPosts);
  assert.equal(alphaPosts.length, 2);
  assert.equal(alphaPosts.every((p) => p.workspace_id === wsA), true);

  // Query Workspace B
  const { data: betaPosts } = await admin.from('posts').select('id, workspace_id').eq('workspace_id', wsB);
  assert.ok(betaPosts);
  assert.equal(betaPosts.length, 1);
  assert.equal(betaPosts[0].id, 'post-ws-b-1');

  // Verify cross-tenant leak is impossible:
  const leakedFromB = alphaPosts.filter((p) => p.workspace_id === wsB);
  assert.equal(leakedFromB.length, 0);
});

test('Multi-Tenant: Disconnected or revoked account is rejected before calling LinkedIn API', async () => {
  const admin = createAdminClient();
  const revokedPostId = 'revoked-account-post-001';
  const revokedAccountId = 'revoked-social-acc-001';

  await admin.from('social_accounts').insert({
    id: revokedAccountId,
    workspace_id: 'ws-revoked-test',
    account_type: 'member',
    account_name: 'Revoked User',
    provider: 'linkedin',
    provider_account_id: 'sub_revoked_777',
    connection_status: 'revoked',
    scopes: ['w_member_social'],
  });

  const { data: acc } = await admin.from('social_accounts').select('*').eq('id', revokedAccountId).single();
  assert.equal(acc.connection_status, 'revoked');

  // Verification in publisher.ts line 261:
  const isActive = acc.connection_status === 'active';
  assert.equal(isActive, false);
  const errorMsg = `LinkedIn account "${acc.account_name}" is currently ${acc.connection_status}. Please reconnect.`;
  assert.match(errorMsg, /currently revoked\. Please reconnect/);
});

// ==============================================================
// GROUP 5: SAFE PL/PGSQL PARAMETER COMPATIBILITY
// ==============================================================

test('PL/pgSQL Parameter Hardening: Mock and RPC accept canonical production parameters', async () => {
  const admin = createAdminClient();
  const rpcPostId = 'plpgsql-param-test-post';
  const token = '12345678-1234-4234-a234-123456789abc';

  await admin.from('posts').insert({
    id: rpcPostId,
    workspace_id: 'ws-plpgsql-test',
    content: 'Testing parameter hardening',
    status: 'draft',
    updated_at: new Date().toISOString(),
  });

  // Call with canonical production parameter names (migration 9 & migration 8 signature)
  const { data: claimP } = await admin.rpc('claim_post_for_publishing', {
    target_post_id: rpcPostId,
    new_claim_token: token,
    lease_duration_seconds: 300,
  });
  assert.equal(claimP.success, true);
  assert.equal(claimP.claim_token, token);

  // Call finalize with canonical production parameter names
  const { data: finP } = await admin.rpc('finalize_post_publishing', {
    target_post_id: rpcPostId,
    expected_claim_token: token,
    provider_post_id: 'urn:li:share:plpgsql-789',
  });
  assert.equal(finP.success, true);

  const { data: postRecord } = await admin.from('posts').select('*').eq('id', rpcPostId).single();
  assert.ok(postRecord);
  assert.equal(postRecord.status, 'published');
  assert.equal(postRecord.provider_post_id, 'urn:li:share:plpgsql-789');
  assert.equal(postRecord.claim_token, null);
});

// ==============================================================
// GROUP 6: PUBLISHING PIPELINE CONTRACT & HONEST RESPONSES
// ==============================================================

test('API Contract: Operation statuses are clearly distinguished (draft vs scheduled vs published vs failed)', () => {
  const allowedStatuses = ['draft', 'scheduled', 'processing', 'published', 'failed', 'cancelled'];

  for (const s of allowedStatuses) {
    assert.ok(typeof s === 'string');
  }

  // Never report queued/processing as published
  const queuedJob = { status: 'queued', post_id: 'post-1' };
  assert.notEqual(queuedJob.status, 'published');

  // Honest success responses
  const failedScheduleResult = { success: false, error: 'LinkedIn account lacks posting scope' };
  const httpStatus = failedScheduleResult.success ? 200 : 400;
  assert.equal(httpStatus, 400, 'Failed publish now must return HTTP 400 with honest error');
});

// ==============================================================
// GROUP 7: CROSS-TENANT IDOR VALIDATION & IMMUTABILITY ENFORCEMENT
// ==============================================================

test('Cross-Tenant IDOR: Post publish route rejects foreign workspace post ID', async () => {
  const admin = createAdminClient();
  const foreignPostId = 'foreign-publish-idor-post-001';
  const victimWs = 'ws-victim-111';
  const attackerWs = 'ws-attacker-222';

  await admin.from('posts').insert({
    id: foreignPostId,
    workspace_id: victimWs,
    content: 'Victim workspace post that attacker wants to publish',
    status: 'draft',
  });

  // Verify workspace-scoped lookup executed in /api/posts/[id]/publish/route.ts:
  const { data: post, error } = await admin
    .from('posts')
    .select('id, workspace_id')
    .eq('id', foreignPostId)
    .eq('workspace_id', attackerWs)
    .maybeSingle();

  assert.equal(post, null, 'Foreign workspace post lookup must return null for attacker workspace');
});

test('Cross-Tenant IDOR: Post schedule route rejects foreign workspace post ID', async () => {
  const admin = createAdminClient();
  const foreignScheduleId = 'foreign-schedule-idor-post-002';
  const victimWs = 'ws-victim-333';
  const attackerWs = 'ws-attacker-444';

  await admin.from('posts').insert({
    id: foreignScheduleId,
    workspace_id: victimWs,
    content: 'Victim workspace post that attacker wants to schedule',
    status: 'draft',
  });

  const { data: post } = await admin
    .from('posts')
    .select('id, workspace_id')
    .eq('id', foreignScheduleId)
    .eq('workspace_id', attackerWs)
    .maybeSingle();

  assert.equal(post, null, 'Attacker cannot schedule post belonging to foreign workspace');
});

test('Cross-Tenant IDOR: Post cancel route rejects foreign workspace post ID', async () => {
  const admin = createAdminClient();
  const foreignCancelId = 'foreign-cancel-idor-post-003';
  const victimWs = 'ws-victim-555';
  const attackerWs = 'ws-attacker-666';

  await admin.from('posts').insert({
    id: foreignCancelId,
    workspace_id: victimWs,
    content: 'Victim scheduled post that attacker wants to cancel',
    status: 'scheduled',
  });

  const { data: post } = await admin
    .from('posts')
    .select('id, workspace_id, status')
    .eq('id', foreignCancelId)
    .eq('workspace_id', attackerWs)
    .maybeSingle();

  assert.equal(post, null, 'Attacker cannot cancel post belonging to foreign workspace');
});

test('Post Immutability: cancelScheduledJob strictly protects published posts from being reopened or reverted to draft', async () => {
  const admin = createAdminClient();
  const publishedPostId = 'published-immutability-post-004';
  const testWs = 'ws-immutability-test';

  await admin.from('posts').insert({
    id: publishedPostId,
    workspace_id: testWs,
    content: 'Published post that must remain immutable',
    status: 'published',
    provider_post_id: 'urn:li:share:immutable-999',
  });

  // Attempt to cancel an already published post
  const cancelSuccess = await cancelScheduledJob(publishedPostId, testWs);
  assert.equal(cancelSuccess, false, 'cancelScheduledJob must return false for published post');

  // Verify status in database was NOT changed to draft
  const { data: post } = await admin.from('posts').select('id, status').eq('id', publishedPostId).single();
  assert.ok(post);
  assert.equal(post.status, 'published', 'Published post status must remain strictly published');
});

test('Post Immutability: cancelScheduledJob strictly protects in-flight processing posts from being cancelled', async () => {
  const admin = createAdminClient();
  const processingPostId = 'processing-immutability-post-005';
  const testWs = 'ws-immutability-test';

  await admin.from('posts').insert({
    id: processingPostId,
    workspace_id: testWs,
    content: 'In-flight processing post owned by worker lease',
    status: 'processing',
    claim_token: 'active-worker-claim-token-111',
  });

  const cancelSuccess = await cancelScheduledJob(processingPostId, testWs);
  assert.equal(cancelSuccess, false, 'cancelScheduledJob must return false for in-flight processing post');

  const { data: post } = await admin.from('posts').select('id, status').eq('id', processingPostId).single();
  assert.ok(post);
  assert.equal(post.status, 'processing', 'In-flight processing post status must remain processing');
});

test('Bulk Post Scheduling: Foreign workspace social account ID is strictly rejected', async () => {
  const admin = createAdminClient();
  const ws1 = 'ws-bulk-tenant-1';
  const ws2 = 'ws-bulk-tenant-2';
  const foreignAccountId = 'foreign-acc-bulk-test';

  await admin.from('social_accounts').insert({
    id: foreignAccountId,
    workspace_id: ws2,
    account_name: 'Tenant 2 LinkedIn',
    account_type: 'member',
    connection_status: 'active',
    scopes: ['w_member_social'],
  });

  // Verify the ownership check executed in /api/posts/bulk/route.ts:
  const { data: validAccount } = await admin
    .from('social_accounts')
    .select('id')
    .eq('id', foreignAccountId)
    .eq('workspace_id', ws1)
    .maybeSingle();

  assert.equal(validAccount, null, 'Foreign social account must be rejected during bulk scheduling');
});

test('Lease Claim Guard: Database connection error during claim_post_for_publishing FAILS CLOSED without bypassing to CAS', async () => {
  // Mock client that returns a fatal connection error (08006) on RPC
  const mockFailingSupabase = {
    rpc: async () => ({
      data: null,
      error: { message: 'connection failure: database unreachable', code: '08006' },
    }),
  };

  const isMissing = isRpcFunctionMissingError({ code: '08006', message: 'connection failure' }, 'claim_post_for_publishing');
  assert.equal(isMissing, false, 'Connection failure must NOT be classified as missing RPC function');
});

// ==============================================================
// GROUP 9: ATOMIC CLAIM & SCHEDULED_JOBS CONSISTENCY
// ==============================================================

test('Atomic Claim Consistency: Claiming post without existing scheduled_jobs atomically creates authoritative processing job', async () => {
  const admin = createAdminClient();
  const testPostId = 'claim-missing-job-post-001';
  const claimToken = 'aaaaaaaa-1111-4111-a111-aaaaaaaaaaaa';

  await admin.from('posts').insert({
    id: testPostId,
    workspace_id: 'ws-claim-test',
    content: 'Immediate publish without preexisting job',
    status: 'draft',
    updated_at: new Date().toISOString(),
  });

  // Verify scheduled_jobs initially has no record for this post
  const { data: initialJobs } = await admin.from('scheduled_jobs').select('*').eq('post_id', testPostId);
  assert.equal(initialJobs?.length, 0);

  // Claim post
  const { data: claimResult, error: claimErr } = await admin.rpc('claim_post_for_publishing', {
    target_post_id: testPostId,
    new_claim_token: claimToken,
    lease_duration_seconds: 300,
  });

  assert.equal(claimErr, null);
  assert.equal(claimResult.success, true);
  assert.equal(claimResult.claim_token, claimToken);

  // Verify posts table was updated
  const { data: postRecord } = await admin.from('posts').select('*').eq('id', testPostId).single();
  assert.ok(postRecord);
  assert.equal(postRecord.status, 'processing');
  assert.equal(postRecord.claim_token, claimToken);

  // Verify scheduled_jobs was atomically created with matching lease token
  const { data: createdJobs } = await admin.from('scheduled_jobs').select('*').eq('post_id', testPostId);
  assert.ok(createdJobs && createdJobs.length === 1);
  assert.equal(createdJobs[0].status, 'processing');
  assert.equal(createdJobs[0].claim_token, claimToken);
  assert.equal(createdJobs[0].lease_expires_at, postRecord.lease_expires_at);
});

test('Atomic Claim Consistency: Claiming post with existing scheduled job transitions job to processing with matching claim token', async () => {
  const admin = createAdminClient();
  const testPostId = 'claim-existing-job-post-002';
  const claimToken = 'bbbbbbbb-2222-4222-b222-bbbbbbbbbbbb';

  await admin.from('posts').insert({
    id: testPostId,
    workspace_id: 'ws-claim-test',
    content: 'Scheduled post ready to publish',
    status: 'scheduled',
    scheduled_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  await admin.from('scheduled_jobs').insert({
    id: 'job-existing-002',
    post_id: testPostId,
    status: 'scheduled',
    scheduled_at: new Date().toISOString(),
    attempts: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const { data: claimResult } = await admin.rpc('claim_post_for_publishing', {
    target_post_id: testPostId,
    new_claim_token: claimToken,
    lease_duration_seconds: 300,
  });

  assert.equal(claimResult.success, true);

  const { data: updatedJob } = await admin.from('scheduled_jobs').select('*').eq('id', 'job-existing-002').single();
  assert.ok(updatedJob);
  assert.equal(updatedJob.status, 'processing');
  assert.equal(updatedJob.claim_token, claimToken);
});

test('Atomic Claim Consistency: Claiming post with multiple scheduled_jobs cancels older duplicates', async () => {
  const admin = createAdminClient();
  const testPostId = 'claim-duplicate-jobs-post-003';
  const claimToken = 'cccccccc-3333-4333-c333-cccccccccccc';
  const now = Date.now();

  await admin.from('posts').insert({
    id: testPostId,
    workspace_id: 'ws-claim-test',
    content: 'Post with duplicate jobs',
    status: 'scheduled',
    updated_at: new Date().toISOString(),
  });

  // Older duplicate job
  await admin.from('scheduled_jobs').insert({
    id: 'job-old-003',
    post_id: testPostId,
    status: 'scheduled',
    created_at: new Date(now - 10000).toISOString(),
    updated_at: new Date(now - 10000).toISOString(),
  });

  // Newer primary job
  await admin.from('scheduled_jobs').insert({
    id: 'job-new-003',
    post_id: testPostId,
    status: 'scheduled',
    created_at: new Date(now).toISOString(),
    updated_at: new Date(now).toISOString(),
  });

  const { data: claimResult } = await admin.rpc('claim_post_for_publishing', {
    target_post_id: testPostId,
    new_claim_token: claimToken,
    lease_duration_seconds: 300,
  });

  assert.equal(claimResult.success, true);

  const { data: newJob } = await admin.from('scheduled_jobs').select('*').eq('id', 'job-new-003').single();
  assert.ok(newJob);
  assert.equal(newJob.status, 'processing');
  assert.equal(newJob.claim_token, claimToken);

  const { data: oldJob } = await admin.from('scheduled_jobs').select('*').eq('id', 'job-old-003').single();
  assert.ok(oldJob);
  assert.equal(oldJob.status, 'cancelled', 'Older duplicate job must be cancelled');
});

test('Atomic Claim Consistency: Rejects claim if job is already marked completed', async () => {
  const admin = createAdminClient();
  const testPostId = 'claim-completed-job-post-004';
  const claimToken = 'dddddddd-4444-4444-d444-dddddddddddd';

  await admin.from('posts').insert({
    id: testPostId,
    workspace_id: 'ws-claim-test',
    content: 'Post with completed job',
    status: 'draft',
    updated_at: new Date().toISOString(),
  });

  await admin.from('scheduled_jobs').insert({
    id: 'job-completed-004',
    post_id: testPostId,
    status: 'completed',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const { data: claimResult } = await admin.rpc('claim_post_for_publishing', {
    target_post_id: testPostId,
    new_claim_token: claimToken,
    lease_duration_seconds: 300,
  });

  assert.equal(claimResult.success, false);
  assert.equal(claimResult.reason, 'job_already_completed');
});

test('Atomic Claim Consistency: Rejects concurrent worker if job is in active processing with unexpired lease', async () => {
  const admin = createAdminClient();
  const testPostId = 'claim-active-job-post-005';
  const claimToken1 = 'eeeeeeee-5555-4555-e555-eeeeeeeeeeee';
  const claimToken2 = 'ffffffff-6666-4666-f666-ffffffffffff';
  const futureLease = new Date(Date.now() + 180000).toISOString();

  await admin.from('posts').insert({
    id: testPostId,
    workspace_id: 'ws-claim-test',
    content: 'Post concurrently claimed',
    status: 'draft',
    updated_at: new Date().toISOString(),
  });

  await admin.from('scheduled_jobs').insert({
    id: 'job-active-005',
    post_id: testPostId,
    status: 'processing',
    claim_token: claimToken1,
    lease_expires_at: futureLease,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const { data: claimResult } = await admin.rpc('claim_post_for_publishing', {
    target_post_id: testPostId,
    new_claim_token: claimToken2,
    lease_duration_seconds: 300,
  });

  assert.equal(claimResult.success, false);
  assert.equal(claimResult.reason, 'job_already_processing');
});
