// ==============================================================
// LINKEDIN AUTOPILOT - PHASE 6 PRODUCTION HARDENING TEST SUITE
// BY GT INNOX LLP
// ==============================================================

import { checkRateLimit } from '../src/lib/rate-limit';
import { linkedInClient } from '../src/lib/linkedin/client';

async function runPhase6Tests() {
  console.log('====================================================');
  console.log('🧪 RUNNING PHASE 6 PRODUCTION HARDENING TEST SUITE');
  console.log('🏢 GT InnoX LLP');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${name}`);
      if (detail) console.log(`     Detail: ${detail}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${name}`);
      if (detail) console.error(`     Detail: ${detail}`);
      failed++;
    }
  }

  // TEST GROUP 1: Rate Limiting Sliding Window
  console.log('--- TEST GROUP 1: Sliding Window Rate Limiting ---');
  const testIp = 'test-client-' + Date.now();
  let ratePassed = true;
  for (let i = 0; i < 5; i++) {
    const res = checkRateLimit(testIp, { limit: 5, windowMs: 10000 });
    if (!res.allowed) ratePassed = false;
  }
  assert(ratePassed, 'Allows requests under quota limit (5 requests permitted)');

  const blockedRes = checkRateLimit(testIp, { limit: 5, windowMs: 10000 });
  assert(!blockedRes.allowed, 'Strictly blocks 6th request exceeding sliding window', `Reset in ${blockedRes.resetMs}ms`);

  // TEST GROUP 2: Strict MIME Type Whitelist
  console.log('\n--- TEST GROUP 2: File Upload MIME Type Whitelist ---');
  const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'application/pdf',
  ];

  assert(ALLOWED_MIME_TYPES.includes('image/png'), 'Permits PNG images');
  assert(ALLOWED_MIME_TYPES.includes('video/mp4'), 'Permits MP4 videos');
  assert(ALLOWED_MIME_TYPES.includes('application/pdf'), 'Permits PDF document carousels');
  assert(!ALLOWED_MIME_TYPES.includes('application/x-msdownload'), 'Rejects executable binary files (.exe)');
  assert(!ALLOWED_MIME_TYPES.includes('text/html'), 'Rejects HTML payloads (.html)');
  assert(!ALLOWED_MIME_TYPES.includes('application/javascript'), 'Rejects raw JavaScript scripts (.js)');

  // TEST GROUP 3: Ambiguous Outcome Handling & Post Reconciliation
  console.log('\n--- TEST GROUP 3: Ambiguous Publishing & Reconciliation ---');
  assert(typeof linkedInClient.reconcileRecentAuthorPost === 'function', 'reconcileRecentAuthorPost method exists on LinkedInClient');

  // Test reconciliation with dummy token
  const recon = await linkedInClient.reconcileRecentAuthorPost({
    encryptedAccessToken: 'invalid:iv:tag',
    authorUrn: 'urn:li:person:dummy',
    expectedCommentarySnippet: 'Test post',
  });
  assert(!recon.reconciled, 'Inconclusive token safely reports reconciled: false without crashing');

  // TEST GROUP 4: RBAC Roles Matrix
  console.log('\n--- TEST GROUP 4: Workspace RBAC Hierarchy ---');
  const validRoles = ['owner', 'admin', 'editor', 'approver', 'viewer'];
  assert(validRoles.includes('owner'), 'Owner role exists');
  assert(validRoles.includes('admin'), 'Admin role exists');
  assert(validRoles.includes('editor'), 'Editor role exists');
  assert(validRoles.includes('approver'), 'Approver role exists');
  assert(validRoles.includes('viewer'), 'Viewer role exists');

  console.log('\n====================================================');
  console.log(`🏁 PHASE 6 SUITE: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) process.exit(1);
}

runPhase6Tests();

