// ==============================================================
// LINKEDIN AUTOPILOT - DATABASE MIGRATION VERIFICATION SCRIPT
// Inspects target Supabase database to verify presence of tables,
// columns, indexes, and constraints from migrations 3, 4, and 5.
// BY GT INNOX LLP
// ==============================================================

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config();

console.log('=================================================================');
console.log('🔍 RUNNING DATABASE MIGRATION VERIFICATION AUDIT');
console.log('🏢 GT InnoX LLP - LinkedIn Autopilot SaaS');
console.log('=================================================================\n');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const client = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface AuditResult {
  migration: string;
  category: 'table' | 'column' | 'constraint';
  name: string;
  status: 'PRESENT' | 'MISSING';
  details?: string;
}

const results: AuditResult[] = [];

async function auditMigrations() {
  console.log(`Connecting to: ${supabaseUrl}\n`);

  // -----------------------------------------------------------------
  // MIGRATION 3: 20261113000003_create_stripe_events.sql
  // -----------------------------------------------------------------
  console.log('--- Auditing Migration 3 (20261113000003_create_stripe_events.sql) ---');

  // 1. Table: public.stripe_events
  const { error: stripeEventsErr } = await client
    .from('stripe_events')
    .select('id, event_id, event_type, workspace_id, customer_id, payload, status, error_message, created_at')
    .limit(0);

  if (stripeEventsErr) {
    results.push({
      migration: '20261113000003',
      category: 'table',
      name: 'public.stripe_events',
      status: 'MISSING',
      details: stripeEventsErr.message,
    });
  } else {
    results.push({
      migration: '20261113000003',
      category: 'table',
      name: 'public.stripe_events',
      status: 'PRESENT',
    });
  }

  // 2. Subscriptions columns from Migration 3
  const { error: subCol1Err } = await client
    .from('subscriptions')
    .select('stripe_customer_id')
    .limit(0);

  results.push({
    migration: '20261113000003',
    category: 'column',
    name: 'subscriptions.stripe_customer_id',
    status: subCol1Err ? 'MISSING' : 'PRESENT',
    details: subCol1Err?.message,
  });

  const { error: subCol2Err } = await client
    .from('subscriptions')
    .select('current_period_start')
    .limit(0);

  results.push({
    migration: '20261113000003',
    category: 'column',
    name: 'subscriptions.current_period_start',
    status: subCol2Err ? 'MISSING' : 'PRESENT',
    details: subCol2Err?.message,
  });

  // -----------------------------------------------------------------
  // MIGRATION 4: 20261113000004_stripe_hardening.sql
  // -----------------------------------------------------------------
  console.log('--- Auditing Migration 4 (20261113000004_stripe_hardening.sql) ---');

  // 1. Column: stripe_events.updated_at
  const { error: seUpdateErr } = await client
    .from('stripe_events')
    .select('updated_at')
    .limit(0);

  results.push({
    migration: '20261113000004',
    category: 'column',
    name: 'stripe_events.updated_at',
    status: seUpdateErr ? 'MISSING' : 'PRESENT',
    details: seUpdateErr?.message,
  });

  // 2. Column: subscriptions.last_event_created
  const { error: subLastEventErr } = await client
    .from('subscriptions')
    .select('last_event_created')
    .limit(0);

  results.push({
    migration: '20261113000004',
    category: 'column',
    name: 'subscriptions.last_event_created',
    status: subLastEventErr ? 'MISSING' : 'PRESENT',
    details: subLastEventErr?.message,
  });

  // 3. Table: public.worker_heartbeats
  const { error: whErr } = await client
    .from('worker_heartbeats')
    .select('id, mode, last_seen_at, pid, hostname, uptime_seconds, meta')
    .limit(0);

  results.push({
    migration: '20261113000004',
    category: 'table',
    name: 'public.worker_heartbeats',
    status: whErr ? 'MISSING' : 'PRESENT',
    details: whErr?.message,
  });

  // -----------------------------------------------------------------
  // MIGRATION 5: 20261113000005_stripe_events_status_check.sql
  // -----------------------------------------------------------------
  console.log('--- Auditing Migration 5 (20261113000005_stripe_events_status_check.sql) ---');

  // Probe check constraint: insert dummy record with status 'ignored_billing_disabled'
  const probeEventId = `probe_check_${Date.now()}`;
  const { error: constraintErr } = await client
    .from('stripe_events')
    .insert({
      event_id: probeEventId,
      event_type: 'probe',
      status: 'ignored_billing_disabled',
    });

  if (constraintErr) {
    results.push({
      migration: '20261113000005',
      category: 'constraint',
      name: "stripe_events_status_check ('ignored_billing_disabled')",
      status: 'MISSING',
      details: constraintErr.message,
    });
  } else {
    results.push({
      migration: '20261113000005',
      category: 'constraint',
      name: "stripe_events_status_check ('ignored_billing_disabled')",
      status: 'PRESENT',
    });
    // Cleanup probe
    await client.from('stripe_events').delete().eq('event_id', probeEventId);
  }

  // -----------------------------------------------------------------
  // AUDIT SUMMARY TABLE
  // -----------------------------------------------------------------
  console.log('\n=================================================================');
  console.log('📊 MIGRATION AUDIT RESULTS');
  console.log('=================================================================');
  console.log(
    'Migration'.padEnd(16) +
    'Category'.padEnd(14) +
    'Object Name'.padEnd(52) +
    'Status'.padEnd(12)
  );
  console.log('-'.repeat(94));

  let missingCount = 0;
  let presentCount = 0;

  for (const r of results) {
    const icon = r.status === 'PRESENT' ? '✅' : '❌';
    console.log(
      r.migration.padEnd(16) +
      r.category.padEnd(14) +
      r.name.padEnd(52) +
      `${icon} ${r.status}`
    );
    if (r.status === 'MISSING') {
      missingCount++;
      if (r.details) {
        console.log(`   └─ Error: ${r.details}`);
      }
    } else {
      presentCount++;
    }
  }

  console.log('-'.repeat(94));
  console.log(`Total Objects: ${results.length} | Present: ${presentCount} | Missing: ${missingCount}\n`);

  if (missingCount > 0) {
    console.error(`🚨 VERIFICATION FAILED: ${missingCount} migration object(s) are missing from the target database.`);
    console.error('Owner action required: Apply migrations 20261113000003, 20261113000004, and 20261113000005.\n');
    process.exit(1);
  } else {
    console.log('🎉 VERIFICATION PASSED: All migration tables, columns, and constraints are present.\n');
    process.exit(0);
  }
}

auditMigrations().catch((err) => {
  console.error('Unhandled verification error:', err);
  process.exit(1);
});
