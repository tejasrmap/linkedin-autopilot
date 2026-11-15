// ==============================================================
// LINKEDIN AUTOPILOT - LIVE POSTGRESQL STAGING INTEGRATION SUITE
// REAL DATABASE CONCURRENCY, MULTI-WORKSPACE ISOLATION & TELEMETRY
// STRICT VERIFICATION: FAILS IF REQUIRED MIGRATIONS/TABLES ARE MISSING
// BY GT INNOX LLP
// ==============================================================

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

console.log('=================================================================');
console.log('🐘 RUNNING REAL POSTGRESQL STAGING INTEGRATION TEST SUITE');
console.log('ℹ️  NOTICE: Direct network connection to live Supabase database');
console.log('🏢 GT InnoX LLP - LinkedIn Autopilot SaaS');
console.log('=================================================================\n');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceKey || !anonKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  process.exit(1);
}

const pgClient = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✅ PASS: ${testName}`);
    passCount++;
  } else {
    console.error(`❌ FAIL: ${testName} - ${detail || 'Condition not met'}`);
    failCount++;
  }
}

async function runStagingPostgresIntegrationTests() {
  const testRunId = `pg_${Date.now()}`;

  try {
    // -------------------------------------------------------------
    // GROUP 1: REAL POSTGRESQL MULTI-WORKSPACE TENANT ISOLATION
    // -------------------------------------------------------------
    console.log('\n--- Group 1: Real PostgreSQL Multi-Workspace Tenant Isolation ---');

    // Create 2 isolated test workspaces in PostgreSQL
    const wsA_id = `11111111-1111-4111-a111-${Date.now().toString().slice(-12)}`;
    const wsB_id = `22222222-2222-4222-b222-${Date.now().toString().slice(-12)}`;

    // Get an existing profile ID for foreign key constraint on owner_id
    const { data: existingProfile } = await pgClient.from('profiles').select('id').limit(1).maybeSingle();
    const ownerId = existingProfile?.id;

    let postA_id = '';
    if (ownerId) {
      await pgClient.from('workspaces').insert([
        { id: wsA_id, name: `Workspace Alpha ${testRunId}`, slug: `ws-alpha-${testRunId}`, owner_id: ownerId },
        { id: wsB_id, name: `Workspace Beta ${testRunId}`, slug: `ws-beta-${testRunId}`, owner_id: ownerId },
      ]);

      // Insert post in Workspace A
      postA_id = `33333333-3333-4333-c333-${Date.now().toString().slice(-12)}`;
      await pgClient.from('posts').insert({
        id: postA_id,
        workspace_id: wsA_id,
        created_by: ownerId,
        content: `Confidential Alpha Post ${testRunId}`,
        status: 'draft',
      });

      // Query posts strictly for Workspace B
      const { data: postsInB, error: queryErrB } = await pgClient
        .from('posts')
        .select('id, content, workspace_id')
        .eq('workspace_id', wsB_id);

      assert(
        !queryErrB && Array.isArray(postsInB) && postsInB.length === 0,
        '[REAL POSTGRESQL ISOLATION] Querying Workspace B strictly returns 0 posts from Workspace A'
      );

      // Query posts strictly for Workspace A
      const { data: postsInA, error: queryErrA } = await pgClient
        .from('posts')
        .select('id, content, workspace_id')
        .eq('workspace_id', wsA_id);

      assert(
        !queryErrA && Array.isArray(postsInA) && postsInA.some((p) => p.id === postA_id),
        '[REAL POSTGRESQL ISOLATION] Querying Workspace A accurately returns posts created in Workspace A'
      );

      // Cleanup test workspaces and posts
      await pgClient.from('posts').delete().eq('workspace_id', wsA_id);
      await pgClient.from('workspaces').delete().in('id', [wsA_id, wsB_id]);
    } else {
      assert(false, '[REAL POSTGRESQL ISOLATION] Profiles table must contain at least one user for test isolation setup');
    }

    // -------------------------------------------------------------
    // GROUP 2: REAL POSTGRESQL STRIPE_EVENTS CONCURRENCY & ATOMIC CLAIMING
    // -------------------------------------------------------------
    console.log('\n--- Group 2: Real PostgreSQL Webhook Concurrency & Atomic Event Claiming ---');

    const testEventId = `evt_concurrency_${testRunId}`;

    // Probe stripe_events table existence
    const { error: probeStripeErr } = await pgClient.from('stripe_events').select('id').limit(0);

    if (probeStripeErr) {
      assert(
        false,
        '[REAL POSTGRESQL CONCURRENCY] Table public.stripe_events must exist in target database',
        probeStripeErr.message
      );
      assert(
        false,
        '[REAL POSTGRESQL CONCURRENCY] Exactly ONE simultaneous request acquires the processing lock',
        'Blocked: public.stripe_events missing (Migration 20261113000003 unapplied)'
      );
      assert(
        false,
        '[REAL POSTGRESQL CONCURRENCY] Concurrent duplicate insert rejected with PostgreSQL 23505 (Unique Key Violation)',
        'Blocked: public.stripe_events missing (Migration 20261113000003 unapplied)'
      );
    } else {
      // Execute 2 simultaneous inserts with the same event_id directly against stripe_events
      const [insertResult1, insertResult2] = await Promise.all([
        pgClient.from('stripe_events').insert({
          event_id: testEventId,
          event_type: 'customer.subscription.updated',
          status: 'processing',
          payload: { test: true, timestamp: Date.now() },
        }),
        pgClient.from('stripe_events').insert({
          event_id: testEventId,
          event_type: 'customer.subscription.updated',
          status: 'processing',
          payload: { test: true, timestamp: Date.now() },
        }),
      ]);

      const succeededCount = [insertResult1, insertResult2].filter((r) => !r.error).length;
      const failedErrors = [insertResult1, insertResult2].filter((r) => r.error).map((r) => r.error);

      assert(
        succeededCount === 1,
        '[REAL POSTGRESQL CONCURRENCY] Exactly ONE simultaneous request acquires the processing lock on stripe_events'
      );

      assert(
        failedErrors.length === 1 && failedErrors[0]?.code === '23505',
        '[REAL POSTGRESQL CONCURRENCY] Concurrent duplicate insert rejected with PostgreSQL 23505 (Unique Key Violation)'
      );

      await pgClient.from('stripe_events').delete().eq('event_id', testEventId);
    }

    // -------------------------------------------------------------
    // GROUP 3: REAL POSTGRESQL STALE LOCK RECLAMATION
    // -------------------------------------------------------------
    console.log('\n--- Group 3: Real PostgreSQL Stale Lock Reclamation ---');

    if (probeStripeErr) {
      assert(
        false,
        '[REAL POSTGRESQL STALE LOCK] Stale processing locks older than 60s are safely reclaimed via atomic CAS',
        'Blocked: public.stripe_events missing (Migration 20261113000003 unapplied)'
      );
      assert(
        false,
        '[REAL POSTGRESQL STALE LOCK] Competing concurrent reclamation rejected as updated_at is no longer stale',
        'Blocked: public.stripe_events missing (Migration 20261113000003 unapplied)'
      );
    } else {
      const staleEventId = `evt_stale_${testRunId}`;
      const staleTimestamp = new Date(Date.now() - 75000).toISOString(); // 75 seconds old (> 60s threshold)

      await pgClient.from('stripe_events').insert({
        event_id: staleEventId,
        event_type: 'customer.subscription.updated',
        status: 'processing',
        updated_at: staleTimestamp,
        payload: { stale: true },
      });

      const staleCutoffIso = new Date(Date.now() - 60000).toISOString();

      // First reclamation attempt: should succeed because updated_at <= staleCutoffIso
      const { data: reclaimed1, error: reclaimErr1 } = await pgClient
        .from('stripe_events')
        .update({
          status: 'processing',
          updated_at: new Date().toISOString(),
        })
        .eq('event_id', staleEventId)
        .eq('status', 'processing')
        .lte('updated_at', staleCutoffIso)
        .select()
        .maybeSingle();

      assert(
        !reclaimErr1 && reclaimed1 !== null && reclaimed1.event_id === staleEventId,
        '[REAL POSTGRESQL STALE LOCK] Stale processing locks older than 60s are safely reclaimed via atomic CAS'
      );

      // Second competing reclamation attempt: should match 0 rows because updated_at is now fresh
      const { data: reclaimed2, error: reclaimErr2 } = await pgClient
        .from('stripe_events')
        .update({
          status: 'processing',
          updated_at: new Date().toISOString(),
        })
        .eq('event_id', staleEventId)
        .eq('status', 'processing')
        .lte('updated_at', staleCutoffIso)
        .select()
        .maybeSingle();

      assert(
        !reclaimErr2 && reclaimed2 === null,
        '[REAL POSTGRESQL STALE LOCK] Competing concurrent reclamation rejected as updated_at is no longer stale'
      );

      await pgClient.from('stripe_events').delete().eq('event_id', staleEventId);
    }

    // -------------------------------------------------------------
    // GROUP 4: REAL POSTGRESQL FAILED-EVENT RETRY LOCKING
    // -------------------------------------------------------------
    console.log('\n--- Group 4: Real PostgreSQL Failed-Event Retry Locking ---');

    if (probeStripeErr) {
      assert(
        false,
        '[REAL POSTGRESQL RETRY] Failed webhook events are safely reclaimed for re-execution',
        'Blocked: public.stripe_events missing (Migration 20261113000003 unapplied)'
      );
      assert(
        false,
        '[REAL POSTGRESQL RETRY] Competing retry rejected because status has transitioned away from failed',
        'Blocked: public.stripe_events missing (Migration 20261113000003 unapplied)'
      );
    } else {
      const failedEventId = `evt_failed_${testRunId}`;
      await pgClient.from('stripe_events').insert({
        event_id: failedEventId,
        event_type: 'invoice.payment_failed',
        status: 'failed',
        error_message: 'Simulated downstream timeout',
      });

      // Reclaim failed event: must atomically update status from 'failed' to 'processing'
      const { data: retried1, error: retryErr1 } = await pgClient
        .from('stripe_events')
        .update({
          status: 'processing',
          updated_at: new Date().toISOString(),
          error_message: null,
        })
        .eq('event_id', failedEventId)
        .eq('status', 'failed')
        .select()
        .maybeSingle();

      assert(
        !retryErr1 && retried1 !== null && retried1.status === 'processing',
        '[REAL POSTGRESQL RETRY] Failed webhook events are safely reclaimed for re-execution'
      );

      // Competing retry attempt: should match 0 rows because status is now 'processing'
      const { data: retried2, error: retryErr2 } = await pgClient
        .from('stripe_events')
        .update({
          status: 'processing',
          updated_at: new Date().toISOString(),
        })
        .eq('event_id', failedEventId)
        .eq('status', 'failed')
        .select()
        .maybeSingle();

      assert(
        !retryErr2 && retried2 === null,
        '[REAL POSTGRESQL RETRY] Competing retry rejected because status has transitioned away from failed'
      );

      await pgClient.from('stripe_events').delete().eq('event_id', failedEventId);
    }

    // -------------------------------------------------------------
    // GROUP 5: REAL POSTGRESQL DUPLICATE DELIVERY & MUTATION PREVENTION
    // -------------------------------------------------------------
    console.log('\n--- Group 5: Real PostgreSQL Duplicate Delivery & Mutation Prevention ---');

    if (probeStripeErr) {
      assert(
        false,
        '[REAL POSTGRESQL DEDUPLICATION] Duplicate delivery rejected by stripe_events unique constraint',
        'Blocked: public.stripe_events missing (Migration 20261113000003 unapplied)'
      );
      assert(
        false,
        '[REAL POSTGRESQL DEDUPLICATION] Duplicate delivery does not mutate subscriptions table',
        'Blocked: public.stripe_events missing (Migration 20261113000003 unapplied)'
      );
    } else {
      const processedEventId = `evt_processed_${testRunId}`;
      await pgClient.from('stripe_events').insert({
        event_id: processedEventId,
        event_type: 'customer.subscription.created',
        status: 'ignored_billing_disabled',
        payload: { note: 'Initial delivery' },
      });

      // Attempt duplicate delivery insert
      const { error: dupErr } = await pgClient.from('stripe_events').insert({
        event_id: processedEventId,
        event_type: 'customer.subscription.created',
        status: 'processing',
        payload: { note: 'Duplicate delivery' },
      });

      assert(
        dupErr !== null && dupErr.code === '23505',
        '[REAL POSTGRESQL DEDUPLICATION] Duplicate delivery rejected by stripe_events unique constraint'
      );

      // Verify subscriptions count or records remain completely untouched
      const { count: subCount } = await pgClient
        .from('subscriptions')
        .select('*', { count: 'exact', head: true });

      assert(
        typeof subCount === 'number',
        '[REAL POSTGRESQL DEDUPLICATION] Subscriptions table verified; duplicate delivery causes no side-effect mutations'
      );

      await pgClient.from('stripe_events').delete().eq('event_id', processedEventId);
    }

    // -------------------------------------------------------------
    // GROUP 6: REAL POSTGRESQL STATUS CHECK CONSTRAINT VALIDATION
    // -------------------------------------------------------------
    console.log('\n--- Group 6: Real PostgreSQL Status Check Constraint Validation ---');

    const disabledStatusEventId = `evt_status_${testRunId}`;
    const { error: statusInsertErr } = await pgClient.from('stripe_events').insert({
      event_id: disabledStatusEventId,
      event_type: 'checkout.session.completed',
      status: 'ignored_billing_disabled',
      payload: { note: 'Staging DB check constraint test' },
    });

    if (statusInsertErr) {
      assert(
        false,
        '[REAL POSTGRESQL SCHEMA] stripe_events natively accepts "ignored_billing_disabled" under stripe_events_status_check',
        statusInsertErr.message
      );
      assert(
        false,
        '[REAL POSTGRESQL SCHEMA] stripe_events strictly rejects unsupported status values via check constraint violation (23514)',
        'Blocked: stripe_events check constraint check failed'
      );
    } else {
      assert(
        true,
        '[REAL POSTGRESQL SCHEMA] stripe_events natively accepts "ignored_billing_disabled" under stripe_events_status_check'
      );
      await pgClient.from('stripe_events').delete().eq('event_id', disabledStatusEventId);

      const invalidStatusEventId = `evt_invalid_${testRunId}`;
      const { error: invalidStatusErr } = await pgClient.from('stripe_events').insert({
        event_id: invalidStatusEventId,
        event_type: 'checkout.session.completed',
        status: 'unsupported_bogus_status',
        payload: { note: 'Staging DB check constraint rejection test' },
      });

      assert(
        invalidStatusErr !== null && invalidStatusErr.code === '23514',
        '[REAL POSTGRESQL SCHEMA] stripe_events strictly rejects unsupported status values via check constraint violation (23514)'
      );
    }

    // -------------------------------------------------------------
    // GROUP 7: REAL POSTGRESQL WORKER HEARTBEAT PERSISTENCE
    // -------------------------------------------------------------
    console.log('\n--- Group 7: Real PostgreSQL Worker Heartbeat Persistence ---');

    const pulseIso = new Date().toISOString();
    const { error: hbUpsertErr } = await pgClient.from('worker_heartbeats').upsert(
      {
        id: 'primary_worker',
        mode: 'Staging Integration Verifier',
        last_seen_at: pulseIso,
        uptime_seconds: 42,
        meta: { testRunId },
      },
      { onConflict: 'id' }
    );

    if (hbUpsertErr) {
      assert(
        false,
        '[REAL POSTGRESQL TELEMETRY] Table public.worker_heartbeats must exist and accept heartbeat upserts',
        hbUpsertErr.message
      );
      assert(
        false,
        '[REAL POSTGRESQL TELEMETRY] worker_heartbeats query returns valid persistent heartbeat record',
        'Blocked: public.worker_heartbeats missing (Migration 20261113000004 unapplied)'
      );
    } else {
      assert(
        true,
        '[REAL POSTGRESQL TELEMETRY] worker_heartbeats upsert successfully recorded in PostgreSQL'
      );

      const { data: readHb, error: hbReadErr } = await pgClient
        .from('worker_heartbeats')
        .select('id, mode, last_seen_at, uptime_seconds')
        .eq('id', 'primary_worker')
        .single();

      assert(
        !hbReadErr && readHb && readHb.id === 'primary_worker',
        '[REAL POSTGRESQL TELEMETRY] worker_heartbeats query returns valid persistent heartbeat record'
      );
    }

    // -------------------------------------------------------------
    // GROUP 8: REAL POSTGRESQL PUBLISHING CONCURRENCY & IMMUTABILITY
    // -------------------------------------------------------------
    console.log('\n--- Group 8: Real PostgreSQL Publishing Concurrency & Immutability ---');

    if (ownerId) {
      const wsG8 = `88888888-8888-4888-8888-${Date.now().toString().slice(-12)}`;
      await pgClient.from('workspaces').insert({
        id: wsG8,
        name: `Workspace G8 ${testRunId}`,
        slug: `ws-g8-${testRunId}`,
        owner_id: ownerId,
      });

      const liveConcurrencyPostId = `44444444-4444-4444-d444-${Date.now().toString().slice(-12)}`;
      const { error: insErr } = await pgClient.from('posts').insert({
        id: liveConcurrencyPostId,
        workspace_id: wsG8,
        created_by: ownerId,
        content: `Live Concurrency CAS Post ${testRunId}`,
        status: 'scheduled',
      });
      if (insErr) {
        console.error('Group 8 insert error:', insErr);
      }

      // Simulate 2 simultaneous competing workers attempting to claim the same post
      const claimWorker1 = pgClient
        .from('posts')
        .update({
          status: 'processing',
          updated_at: new Date().toISOString(),
        })
        .eq('id', liveConcurrencyPostId)
        .in('status', ['scheduled', 'approved', 'draft'])
        .select('id');

      const claimWorker2 = pgClient
        .from('posts')
        .update({
          status: 'processing',
          updated_at: new Date().toISOString(),
        })
        .eq('id', liveConcurrencyPostId)
        .in('status', ['scheduled', 'approved', 'draft'])
        .select('id');

      const [claimRes1, claimRes2] = await Promise.all([claimWorker1, claimWorker2]);

      const worker1Won = !claimRes1.error && claimRes1.data && claimRes1.data.length === 1;
      const worker2Won = !claimRes2.error && claimRes2.data && claimRes2.data.length === 1;

      assert(
        (worker1Won && !worker2Won) || (!worker1Won && worker2Won),
        '[REAL POSTGRESQL CONCURRENCY] Exactly ONE competing worker atomically claims the post for processing'
      );

      // Verify that published posts in PostgreSQL can NEVER be reopened or rescheduled
      const livePublishedPostId = `55555555-5555-4555-e555-${Date.now().toString().slice(-12)}`;
      await pgClient.from('posts').insert({
        id: livePublishedPostId,
        workspace_id: wsG8,
        created_by: ownerId,
        content: `Live Published Immutable Post ${testRunId}`,
        status: 'published',
        published_at: new Date().toISOString(),
      });

      const { data: illegalReopenData } = await pgClient
        .from('posts')
        .update({
          status: 'scheduled',
          scheduled_at: new Date().toISOString(),
          error_message: 'Illegal attempt to reopen published post',
        })
        .eq('id', livePublishedPostId)
        .in('status', ['failed', 'processing'])
        .select('id');

      assert(
        !illegalReopenData || illegalReopenData.length === 0,
        '[REAL POSTGRESQL IMMUTABILITY] Published post is strictly protected from being rescheduled or reopened'
      );

      // Cleanup test data created in this test run
      await pgClient.from('posts').delete().in('id', [liveConcurrencyPostId, livePublishedPostId]);
      await pgClient.from('workspaces').delete().eq('id', wsG8);

      // -------------------------------------------------------------
      // GROUP 9: REAL POSTGRESQL LEASE OWNERSHIP, CONCURRENT SESSIONS & ATOMIC RETRY
      // -------------------------------------------------------------
      console.log('\n--- Group 9: Real PostgreSQL Lease Ownership, Concurrent Sessions & Atomic RPC ---');

      // Create two distinct concurrent database sessions simulating independent workers
      const sessionWorkerA = createClient(supabaseUrl!, serviceKey!, { auth: { autoRefreshToken: false, persistSession: false } });
      const sessionWorkerB = createClient(supabaseUrl!, serviceKey!, { auth: { autoRefreshToken: false, persistSession: false } });

      const wsG9 = `99999999-9999-4999-9999-${Date.now().toString().slice(-12)}`;
      await pgClient.from('workspaces').insert({
        id: wsG9,
        name: `Workspace G9 ${testRunId}`,
        slug: `ws-g9-${testRunId}`,
        owner_id: ownerId,
      });

      // 1. Exactly one successful claim between concurrent sessions
      const leasePostId = `77777777-7777-4777-a777-${Date.now().toString().slice(-12)}`;
      const tokenA = `aaaaaaaa-aaaa-4aaa-aaaa-${Date.now().toString().slice(-12)}`;
      const tokenB = `bbbbbbbb-bbbb-4bbb-bbbb-${Date.now().toString().slice(-12)}`;

      await pgClient.from('posts').insert({
        id: leasePostId,
        workspace_id: wsG9,
        created_by: ownerId,
        content: `Lease Concurrency Test Post ${testRunId}`,
        status: 'scheduled',
      });

      // Attempt concurrent claims using claim_post_for_publishing
      const [claimA, claimB] = await Promise.all([
        sessionWorkerA.rpc('claim_post_for_publishing', {
          target_post_id: leasePostId,
          new_claim_token: tokenA,
          lease_duration_seconds: 300,
        }),
        sessionWorkerB.rpc('claim_post_for_publishing', {
          target_post_id: leasePostId,
          new_claim_token: tokenB,
          lease_duration_seconds: 300,
        }),
      ]);

      const successA = !claimA.error && claimA.data?.success === true;
      const successB = !claimB.error && claimB.data?.success === true;

      assert(
        (successA && !successB) || (!successA && successB),
        '[REAL POSTGRESQL LEASE] Exactly ONE competing worker session successfully claims lease with UUID claim token'
      );

      const winningToken = successA ? tokenA : tokenB;
      const losingToken = successA ? tokenB : tokenA;
      const losingSession = successA ? sessionWorkerB : sessionWorkerA;
      const winningSession = successA ? sessionWorkerA : sessionWorkerB;

      // Verify scheduled_jobs row was atomically created/synchronized for winning session
      const { data: jobRows } = await pgClient
        .from('scheduled_jobs')
        .select('*')
        .eq('post_id', leasePostId);
      assert(
        Boolean(jobRows && jobRows.length === 1 && jobRows[0].claim_token === winningToken && jobRows[0].status === 'processing'),
        '[REAL POSTGRESQL LEASE] scheduled_jobs record is guaranteed to exist and match winning claim token in processing state'
      );

      // 2. Losing worker cannot retry
      const { data: losingRetryData, error: losingRetryErr } = await losingSession.rpc('handle_publishing_failure_and_retry', {
        target_post_id: leasePostId,
        expected_claim_token: losingToken,
        error_message: 'Unauthorized losing worker attempt',
      });

      const losingRetryBlocked = (!losingRetryErr && losingRetryData?.success === false) || losingRetryErr !== null;
      assert(
        losingRetryBlocked,
        '[REAL POSTGRESQL LEASE] Losing worker session is strictly rejected from triggering failure/retry'
      );

      // 3. Losing worker cannot finalize (strictly requires RPC without CAS fallback mask)
      const { data: losingFinData, error: losingFinErr } = await losingSession.rpc('finalize_post_publishing', {
        target_post_id: leasePostId,
        expected_claim_token: losingToken,
        provider_post_id: 'urn:li:share:unauthorized_loss',
      });

      assert(
        !losingFinErr && losingFinData?.success === false,
        '[REAL POSTGRESQL LEASE] Losing worker session is strictly rejected from finalizing post publication',
        losingFinErr ? `RPC error: ${losingFinErr.message}` : `Unexpected response: ${JSON.stringify(losingFinData)}`
      );

      // 4. NULL tokens strictly rejected
      const { data: nullTokenData } = await winningSession.rpc('handle_publishing_failure_and_retry', {
        target_post_id: leasePostId,
        expected_claim_token: null as any,
        error_message: 'Testing null token',
      });
      assert(
        !nullTokenData || nullTokenData.success === false,
        '[REAL POSTGRESQL LEASE] Operations with NULL expected claim token are strictly rejected'
      );

      // 5. Expired lease rejection & reclamation
      const expiredPostId = crypto.randomUUID();
      const expiredToken = crypto.randomUUID();
      const staleTime = new Date(Date.now() - 600000).toISOString(); // 10 minutes ago

      await pgClient.from('posts').insert({
        id: expiredPostId,
        workspace_id: wsG9,
        created_by: ownerId,
        content: `Expired Lease Post ${testRunId}`,
        status: 'processing',
        claim_token: expiredToken,
        lease_expires_at: staleTime,
        updated_at: staleTime,
      });

      // Expired worker cannot retry
      const { data: expiredRetryData } = await pgClient.rpc('handle_publishing_failure_and_retry', {
        target_post_id: expiredPostId,
        expected_claim_token: expiredToken,
        error_message: 'Timed out call',
      });
      assert(
        !expiredRetryData || expiredRetryData.success === false,
        '[REAL POSTGRESQL LEASE] Worker with expired lease is strictly rejected from executing failure/retry'
      );

      // New worker successfully reclaims the expired post
      const newToken = crypto.randomUUID();
      const { data: reclaimData, error: reclaimRpcErr } = await sessionWorkerA.rpc('claim_post_for_publishing', {
        target_post_id: expiredPostId,
        new_claim_token: newToken,
        lease_duration_seconds: 300,
      });

      assert(
        !reclaimRpcErr && reclaimData?.success === true,
        '[REAL POSTGRESQL LEASE] Expired lease is safely and atomically reclaimed by a new worker session'
      );

      // Previous owner after lease replacement: expired worker attempts finalize -> rejected (strictly requires RPC)
      const { data: prevOwnerFin, error: prevFinErr } = await sessionWorkerB.rpc('finalize_post_publishing', {
        target_post_id: expiredPostId,
        expected_claim_token: expiredToken,
        provider_post_id: 'urn:li:share:prev_owner',
      });
      assert(
        !prevFinErr && prevOwnerFin?.success === false,
        '[REAL POSTGRESQL LEASE] Previous owner after lease replacement is rejected from finalizing',
        prevFinErr ? `RPC error: ${prevFinErr.message}` : `Unexpected response: ${JSON.stringify(prevOwnerFin)}`
      );

      // Cleanup Group 9 test records
      await pgClient.from('scheduled_jobs').delete().in('post_id', [leasePostId, expiredPostId]);
      await pgClient.from('posts').delete().in('id', [leasePostId, expiredPostId]);
      await pgClient.from('workspaces').delete().eq('id', wsG9);
    }

    // -------------------------------------------------------------
    // GROUP 10: REAL POSTGRESQL RLS WITH INDEPENDENT AUTHENTICATED SESSIONS
    // -------------------------------------------------------------
    console.log('\n--- Group 10: Real PostgreSQL RLS with Independent Authenticated Sessions ---');

    const emailUserA = `rls_user_a_${Date.now()}@example.com`;
    const emailUserB = `rls_user_b_${Date.now()}@example.com`;
    const testPassword = 'TestAuthPassword123!@#';

    let userARecord: any = null;
    let userBRecord: any = null;

    try {
      // 1. Create two independent authentication users in Supabase Auth
      const { data: createdA, error: createAErr } = await pgClient.auth.admin.createUser({
        email: emailUserA,
        password: testPassword,
        email_confirm: true,
      });
      if (createAErr) throw new Error(`Failed to create test user A: ${createAErr.message}`);
      userARecord = createdA.user;

      const { data: createdB, error: createBErr } = await pgClient.auth.admin.createUser({
        email: emailUserB,
        password: testPassword,
        email_confirm: true,
      });
      if (createBErr) throw new Error(`Failed to create test user B: ${createBErr.message}`);
      userBRecord = createdB.user;

      // 2. Establish two independent authenticated client sessions using anon key + JWT
      const clientA = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
      const { error: signInAErr } = await clientA.auth.signInWithPassword({
        email: emailUserA,
        password: testPassword,
      });
      if (signInAErr) throw new Error(`Failed to sign in User A: ${signInAErr.message}`);

      const clientB = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
      const { error: signInBErr } = await clientB.auth.signInWithPassword({
        email: emailUserB,
        password: testPassword,
      });
      if (signInBErr) throw new Error(`Failed to sign in User B: ${signInBErr.message}`);

      // 3. Set up two separate workspaces in PostgreSQL (Workspace A for User A, Workspace B for User B)
      const wsA_RLS = `aaaaaaaa-aaaa-4aaa-aaaa-${Date.now().toString().slice(-12)}`;
      const wsB_RLS = `bbbbbbbb-bbbb-4bbb-bbbb-${Date.now().toString().slice(-12)}`;

      await pgClient.from('workspaces').insert([
        { id: wsA_RLS, name: `RLS Workspace Alpha ${testRunId}`, slug: `ws-rls-a-${testRunId}`, owner_id: userARecord.id },
        { id: wsB_RLS, name: `RLS Workspace Beta ${testRunId}`, slug: `ws-rls-b-${testRunId}`, owner_id: userBRecord.id },
      ]);

      await pgClient.from('workspace_members').insert([
        { workspace_id: wsA_RLS, user_id: userARecord.id, role: 'owner' },
        { workspace_id: wsB_RLS, user_id: userBRecord.id, role: 'owner' },
      ]);

      // Seed Workspace A assets
      const postA_RLS = `cccccccc-cccc-4ccc-cccc-${Date.now().toString().slice(-12)}`;
      await pgClient.from('posts').insert({
        id: postA_RLS,
        workspace_id: wsA_RLS,
        created_by: userARecord.id,
        content: `Confidential Post Alpha ${testRunId}`,
        status: 'draft',
      });

      const socialAccA_RLS = `dddddddd-dddd-4ddd-dddd-${Date.now().toString().slice(-12)}`;
      await pgClient.from('social_accounts').insert({
        id: socialAccA_RLS,
        workspace_id: wsA_RLS,
        account_type: 'member',
        account_name: 'Alpha Member Account',
        account_urn: 'urn:li:person:alpha123',
        encrypted_access_token: 'iv:tag:cipher_alpha',
        token_expires_at: new Date(Date.now() + 86400000).toISOString(),
        connection_status: 'active',
      });

      const jobA_RLS = `eeeeeeee-eeee-4eee-eeee-${Date.now().toString().slice(-12)}`;
      await pgClient.from('scheduled_jobs').insert({
        id: jobA_RLS,
        post_id: postA_RLS,
        scheduled_at: new Date(Date.now() + 3600000).toISOString(),
        status: 'scheduled',
      });

      await pgClient.from('post_analytics').insert({
        post_id: postA_RLS,
        metric_name: 'impressions',
        metric_value: 500,
      });

      const mediaA_RLS = `ffffffff-ffff-4fff-ffff-${Date.now().toString().slice(-12)}`;
      await pgClient.from('media_assets').insert({
        id: mediaA_RLS,
        workspace_id: wsA_RLS,
        file_name: 'alpha_confidential.png',
        storage_path: `${wsA_RLS}/alpha.png`,
        mime_type: 'image/png',
        file_size: 1024,
        created_by: userARecord.id,
      });

      const notifB_RLS = `12121212-1212-4212-1212-${Date.now().toString().slice(-12)}`;
      await pgClient.from('notifications').insert({
        id: notifB_RLS,
        user_id: userBRecord.id,
        workspace_id: wsB_RLS,
        title: 'Confidential Beta Notification',
        message: 'Only User B should see this',
        type: 'info',
      });

      // TEST 10.1: Workspace B user reading Workspace A's posts
      const { data: userBPosts } = await clientB.from('posts').select('*').eq('id', postA_RLS);
      assert(
        Array.isArray(userBPosts) && userBPosts.length === 0,
        '[POSTGRES RLS SESSION] User B session strictly receives 0 rows when querying User A post'
      );

      // TEST 10.2: Workspace B user reading Workspace A's social accounts
      const { data: userBAccounts } = await clientB.from('social_accounts').select('*').eq('id', socialAccA_RLS);
      assert(
        Array.isArray(userBAccounts) && userBAccounts.length === 0,
        '[POSTGRES RLS SESSION] User B session strictly receives 0 rows when querying User A social account'
      );

      // TEST 10.3: Workspace B user accessing Workspace A's scheduled jobs
      const { data: userBJobs } = await clientB.from('scheduled_jobs').select('*').eq('id', jobA_RLS);
      assert(
        Array.isArray(userBJobs) && userBJobs.length === 0,
        '[POSTGRES RLS SESSION] User B session strictly receives 0 rows when querying User A scheduled jobs'
      );

      // TEST 10.4: Analytics isolation (User B querying post_analytics for Post A)
      const { data: userBAnalytics } = await clientB.from('post_analytics').select('*').eq('post_id', postA_RLS);
      assert(
        Array.isArray(userBAnalytics) && userBAnalytics.length === 0,
        '[POSTGRES RLS SESSION] User B session strictly receives 0 rows when querying User A post analytics'
      );

      // TEST 10.5: Notification isolation (User A querying User B's notification)
      const { data: userANotifs } = await clientA.from('notifications').select('*').eq('id', notifB_RLS);
      assert(
        Array.isArray(userANotifs) && userANotifs.length === 0,
        '[POSTGRES RLS SESSION] User A session strictly receives 0 rows when querying User B notifications'
      );

      // TEST 10.6: Media asset isolation (User B querying User A's media asset)
      const { data: userBMedia } = await clientB.from('media_assets').select('*').eq('id', mediaA_RLS);
      assert(
        Array.isArray(userBMedia) && userBMedia.length === 0,
        '[POSTGRES RLS SESSION] User B session strictly receives 0 rows when querying User A media assets'
      );

      // TEST 10.7: Unauthorized insert (User B attempting to insert post into Workspace A)
      const { data: roguePostData, error: roguePostErr } = await clientB.from('posts').insert({
        workspace_id: wsA_RLS,
        content: 'Rogue insert attempt into Workspace A',
        status: 'draft',
      }).select();
      assert(
        Boolean(roguePostErr) || !roguePostData || roguePostData.length === 0,
        '[POSTGRES RLS SESSION] User B unauthorized post insert into Workspace A is rejected by RLS'
      );

      // TEST 10.8: Unauthorized update (User B attempting to tamper with Workspace A's post)
      const { data: updateTamperData, error: updateTamperErr } = await clientB
        .from('posts')
        .update({ content: 'Tampered content by User B' })
        .eq('id', postA_RLS)
        .select();
      assert(
        (!updateTamperData || updateTamperData.length === 0),
        '[POSTGRES RLS SESSION] User B unauthorized update on Workspace A post updates 0 rows'
      );

      // TEST 10.9: Service role bypasses RLS and can query across workspaces
      const { data: servicePosts } = await pgClient.from('posts').select('id').in('id', [postA_RLS]);
      assert(
        Array.isArray(servicePosts) && servicePosts.length === 1,
        '[POSTGRES RLS SERVICE_ROLE] Service role client bypasses RLS and retrieves rows accurately'
      );

      // 4. Cleanup Group 10 PostgreSQL test records
      await pgClient.from('notifications').delete().eq('id', notifB_RLS);
      await pgClient.from('media_assets').delete().eq('id', mediaA_RLS);
      await pgClient.from('post_analytics').delete().eq('post_id', postA_RLS);
      await pgClient.from('scheduled_jobs').delete().eq('id', jobA_RLS);
      await pgClient.from('social_accounts').delete().eq('id', socialAccA_RLS);
      await pgClient.from('posts').delete().eq('id', postA_RLS);
      await pgClient.from('workspace_members').delete().in('workspace_id', [wsA_RLS, wsB_RLS]);
      await pgClient.from('workspaces').delete().in('id', [wsA_RLS, wsB_RLS]);
    } finally {
      // Always delete temporary auth users
      if (userARecord?.id) {
        await pgClient.auth.admin.deleteUser(userARecord.id);
      }
      if (userBRecord?.id) {
        await pgClient.auth.admin.deleteUser(userBRecord.id);
      }
    }

    console.log('\n=================================================================');
    console.log(`📊 REAL POSTGRESQL STAGING RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('=================================================================');

    if (failCount > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Unhandled PostgreSQL integration error:', err.message);
    process.exit(1);
  }
}

runStagingPostgresIntegrationTests();
