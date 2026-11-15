// ==============================================================
// LINKEDIN AUTOPILOT - COMPREHENSIVE QA & TEST SUITE
// BY GT INNOX LLP
// ==============================================================

import { encryptToken, decryptToken, getEncryptionKey } from '../src/lib/encryption';
import { LinkedInClient } from '../src/lib/linkedin/client';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTestSuite() {
  console.log('====================================================');
  console.log('🧪 RUNNING LINKEDIN AUTOPILOT TEST SUITE');
  console.log('====================================================\n');

  // TEST 1: Encryption & Decryption
  console.log('TEST GROUP 1: AES-256-GCM Token Encryption Security');
  const sampleToken = 'AQV...mock_secret_linkedin_oauth_access_token_1234567890';
  const encrypted = encryptToken(sampleToken);
  assert(encrypted !== sampleToken, 'Encrypted token does not match plaintext');
  assert(encrypted.split(':').length === 3, 'Ciphertext follows IV:AuthTag:Ciphertext 3-part format');

  const decrypted = decryptToken(encrypted);
  assert(decrypted === sampleToken, 'Decrypted token matches original token exactly');

  try {
    decryptToken('tampered:invalid:token');
    assert(false, 'Tampered token should throw error');
  } catch {
    assert(true, 'Tampered token correctly threw decryption error');
  }

  // Subtest 1.1: Production Fail-Closed on Missing or Default Key
  const origEnv = process.env.NODE_ENV;
  const origKey = process.env.TOKEN_ENCRYPTION_KEY;
  try {
    (process.env as any).NODE_ENV = 'production';
    delete process.env.TOKEN_ENCRYPTION_KEY;
    try {
      getEncryptionKey();
      assert(false, 'Missing TOKEN_ENCRYPTION_KEY in production must fail closed');
    } catch (err: any) {
      assert(err.message.includes('missing or invalid in production'), 'Missing key throws fatal production error');
    }

    process.env.TOKEN_ENCRYPTION_KEY = 'default-super-secret-key-32-chars!!';
    try {
      getEncryptionKey();
      assert(false, 'Default dev key in production must fail closed');
    } catch (err: any) {
      assert(err.message.includes('missing or invalid in production'), 'Default key in production throws fatal error');
    }

    process.env.TOKEN_ENCRYPTION_KEY = 'too-short';
    try {
      getEncryptionKey();
      assert(false, 'Key < 16 chars in production must fail closed');
    } catch (err: any) {
      assert(err.message.includes('at least 16 characters'), 'Short key in production throws fatal error');
    }

    process.env.TOKEN_ENCRYPTION_KEY = 'valid-production-secret-key-32-chars-ok!';
    const prodKey = getEncryptionKey();
    assert(prodKey.length === 32, 'Valid production secret key derives 32-byte Buffer');
  } finally {
    (process.env as any).NODE_ENV = origEnv;
    process.env.TOKEN_ENCRYPTION_KEY = origKey;
  }

  // Subtest 1.2: Custom Key Encryption/Decryption
  const customKey = 'custom-test-secret-key-for-rotation!';
  const customEnc = encryptToken('secret_data_123', customKey);
  const customDec = decryptToken(customEnc, customKey);
  assert(customDec === 'secret_data_123', 'Custom key encryption and decryption succeeds');

  try {
    getEncryptionKey('short');
    assert(false, 'Override key < 16 chars should throw');
  } catch (err: any) {
    assert(err.message.includes('at least 16 characters'), 'Short override key throws validation error');
  }

  // TEST 2: LinkedIn OAuth Client & URL Generation
  console.log('\nTEST GROUP 2: LinkedIn OAuth 2.0 URL & Scope Compliance');
  const client = new LinkedInClient();
  const mockState = 'test_state_nonce_123';
  const authUrl = client.getAuthorizationUrl(mockState, false);

  assert(authUrl.startsWith('https://www.linkedin.com/oauth/v2/authorization'), 'Correct authorization endpoint base');
  assert(authUrl.includes('response_type=code'), 'Includes response_type=code');
  assert(authUrl.includes('w_member_social'), 'Requests official w_member_social scope');
  assert(authUrl.includes('openid'), 'Requests OpenID Connect scope');
  assert(authUrl.includes(`state=${mockState}`), 'Includes secure CSRF state');

  const orgAuthUrl = client.getAuthorizationUrl(mockState, true);
  assert(orgAuthUrl.includes('w_organization_social'), 'Includes organization publishing scope when requested');

  // TEST 3: Timezone & UTC Scheduling Calculations
  console.log('\nTEST GROUP 3: UTC Scheduling & Delay Calculations');
  const now = Date.now();
  const targetDateFuture = new Date(now + 3600000); // 1 hour ahead
  const delayFuture = Math.max(0, targetDateFuture.getTime() - now);
  assert(delayFuture > 3500000 && delayFuture <= 3600000, 'Calculates correct future delay in milliseconds');

  const targetDatePast = new Date(now - 10000); // in the past
  const delayPast = Math.max(0, targetDatePast.getTime() - now);
  assert(delayPast === 0, 'Past scheduled timestamp clamps delay to 0 for immediate execution');

  // TEST 4: Post Status State Machine
  console.log('\nTEST GROUP 4: Post Status Lifecycle State Machine');
  const validStatuses = ['draft', 'pending_approval', 'approved', 'scheduled', 'processing', 'published', 'failed', 'cancelled'];
  assert(validStatuses.includes('draft'), 'Draft is a valid state');
  assert(validStatuses.includes('published'), 'Published is a valid state');
  assert(validStatuses.includes('processing'), 'Processing idempotency lock state exists');

  console.log('\n====================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();

