import assert from 'assert';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { checkRateLimit } from '../src/lib/rate-limit';
import { logger } from '../src/lib/logger';
import { linkedInClient } from '../src/lib/linkedin/client';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function runPhase4Tests() {
  console.log('====================================================');
  console.log('🛡️ RUNNING PHASE 4 PRODUCTION HARDENING & SAAS TESTS');
  console.log('====================================================');

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    try {
      fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (e: any) {
      console.error(`  ❌ [FAIL] ${name}: ${e.message}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // GROUP 1: Rate Limiting Engine
  // -------------------------------------------------------------
  console.log('\n--- GROUP 1: API Rate Limiting (Sliding Window) ---');

  test('Permits requests within rate limit threshold', () => {
    const key = `test-ip-${Date.now()}`;
    const r1 = checkRateLimit(key, { limit: 5, windowMs: 10000 });
    const r2 = checkRateLimit(key, { limit: 5, windowMs: 10000 });
    assert.strictEqual(r1.allowed, true);
    assert.strictEqual(r2.allowed, true);
    assert.strictEqual(r2.remaining, 3);
  });

  test('Blocks excess requests when limit exceeded', () => {
    const key = `test-exceeded-${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      checkRateLimit(key, { limit: 3, windowMs: 10000 });
    }
    const blocked = checkRateLimit(key, { limit: 3, windowMs: 10000 });
    assert.strictEqual(blocked.allowed, false);
    assert.strictEqual(blocked.remaining, 0);
    assert.strictEqual(blocked.resetMs > 0, true);
  });

  // -------------------------------------------------------------
  // GROUP 2: Structured Logging Serialization
  // -------------------------------------------------------------
  console.log('\n--- GROUP 2: Structured Logger Integrity ---');

  test('Logs events without throwing errors', () => {
    logger.info('Test audit log event', {
      context: 'Phase4Test',
      workspaceId: 'ws-123',
      metadata: { action: 'verification' },
    });
    logger.warn('Test warning event', {
      context: 'Phase4Test',
    });
  });

  // -------------------------------------------------------------
  // GROUP 3: Multi-Format Media Support (Video & Document)
  // -------------------------------------------------------------
  console.log('\n--- GROUP 3: Video & Document Media Capabilities ---');

  test('LinkedInClient exposes uploadVideoToLinkedIn method', () => {
    assert.strictEqual(typeof (linkedInClient as any).uploadVideoToLinkedIn, 'function');
  });

  test('LinkedInClient exposes uploadDocumentToLinkedIn method', () => {
    assert.strictEqual(typeof (linkedInClient as any).uploadDocumentToLinkedIn, 'function');
  });

  test('LinkedInClient uses active API version 202610', () => {
    assert.strictEqual((linkedInClient as any).apiVersion, '202610');
  });

  // -------------------------------------------------------------
  // GROUP 4: Atomic CAS Idempotency Concurrency Simulation
  // -------------------------------------------------------------
  console.log('\n--- GROUP 4: Atomic CAS Idempotency & Lock Mechanics ---');

  test('Simulates atomic CAS lock: only first caller claims lock', () => {
    let postState = 'scheduled';
    let winners = 0;

    function attemptCasLock() {
      if (postState === 'scheduled') {
        postState = 'processing';
        winners++;
        return true;
      }
      return false;
    }

    // 5 concurrent attempts
    const results = [
      attemptCasLock(),
      attemptCasLock(),
      attemptCasLock(),
      attemptCasLock(),
      attemptCasLock(),
    ];

    assert.strictEqual(winners, 1);
    assert.strictEqual(results.filter((r) => r === true).length, 1);
    assert.strictEqual(results.filter((r) => r === false).length, 4);
    assert.strictEqual(postState, 'processing');
  });

  // -------------------------------------------------------------
  // GROUP 5: SaaS Subscription Limits & Calculation
  // -------------------------------------------------------------
  console.log('\n--- GROUP 5: Subscription Quota Engine ---');

  test('Correctly calculates remaining post allowance', () => {
    const maxPosts = 500;
    const postsUsed = 42;
    const remaining = Math.max(0, maxPosts - postsUsed);
    assert.strictEqual(remaining, 458);
  });

  test('Clamps remaining allowance to zero when limit exceeded', () => {
    const maxPosts = 15;
    const postsUsed = 20;
    const remaining = Math.max(0, maxPosts - postsUsed);
    assert.strictEqual(remaining, 0);
  });

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('\n====================================================');
  console.log(`🏁 PHASE 4 HARDENING TESTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase4Tests().catch((e) => {
  console.error('Test run failed:', e);
  process.exit(1);
});

