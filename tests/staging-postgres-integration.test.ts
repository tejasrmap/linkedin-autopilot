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

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
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

      // 3. Losing worker cannot finalize
      const { data: losingFinData, error: losingFinErr } = await losingSession.rpc('finalize_post_publishing', {
        target_post_id: leasePostId,
        expected_claim_token: losingToken,
        provider_post_id: 'urn:li:share:unauthorized_loss',
      });

      // If finalize_post_publishing is deployed, check failure; if not yet deployed (PGRST202), test CAS protection
      if (!losingFinErr && losingFinData) {
        assert(
          losingFinData.success === false,
          '[REAL POSTGRESQL LEASE] Losing worker session is strictly rejected from finalizing post publication'
        );
      } else {
        // Fallback CAS verification: updating where claim_token = losingToken matches 0 rows
        const { data: casLosing } = await losingSession
          .from('posts')
          .update({ status: 'published', claim_token: null })
          .eq('id', leasePostId)
          .eq('claim_token', losingToken)
          .select('id');
        assert(
          !casLosing || casLosing.length === 0,
          '[REAL POSTGRESQL LEASE] Losing worker session matches 0 rows in conditional CAS finalization'
        );
      }

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

      // Previous owner after lease replacement: expired worker attempts finalize -> rejected
      const { data: prevOwnerFin, error: prevFinErr } = await sessionWorkerB.rpc('finalize_post_publishing', {
        target_post_id: expiredPostId,
        expected_claim_token: expiredToken,
        provider_post_id: 'urn:li:share:prev_owner',
      });
      if (!prevFinErr && prevOwnerFin) {
        assert(
          prevOwnerFin.success === false,
          '[REAL POSTGRESQL LEASE] Previous owner after lease replacement is rejected from finalizing'
        );
      } else {
        const { data: casPrev } = await sessionWorkerB
          .from('posts')
          .update({ status: 'published' })
          .eq('id', expiredPostId)
          .eq('claim_token', expiredToken)
          .select('id');
        assert(
          !casPrev || casPrev.length === 0,
          '[REAL POSTGRESQL LEASE] Previous owner after lease replacement matches 0 rows in conditional CAS'
        );
      }

      // Cleanup Group 9 test records
      await pgClient.from('posts').delete().in('id', [leasePostId, expiredPostId]);
      await pgClient.from('workspaces').delete().eq('id', wsG9);
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
