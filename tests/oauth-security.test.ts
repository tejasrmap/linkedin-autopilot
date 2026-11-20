// ==============================================================
// LINKEDIN AUTOPILOT - OAUTH SECURITY TEST SUITE (PR #38)
// TESTS: State generation, HMAC integrity, session cookie binding,
// CSRF protection, expiration, concurrent isolation, and Host header defenses.
// BY GT INNOX LLP
// ==============================================================

import { test, describe } from 'node:test';
import assert from 'node:assert';
import crypto from 'crypto';
import {
  createOAuthState,
  verifyOAuthState,
  getAuthoritativeRedirectUri,
  OAUTH_STATE_COOKIE_PREFIX,
} from '../src/lib/linkedin/oauth-state';

describe('PR #38 — LinkedIn OAuth Security & CSRF Defense Suite', () => {
  const testWorkspaceId = 'ws_12345678-1234-1234-1234-123456789abc';
  const testUserId = 'user_98765432-4321-4321-4321-cba987654321';

  describe('Cryptographic State Generation & Session Binding', () => {
    test('State generation produces cryptographically strong, non-deterministic values', () => {
      const state1 = createOAuthState({ workspaceId: testWorkspaceId, userId: testUserId });
      const state2 = createOAuthState({ workspaceId: testWorkspaceId, userId: testUserId });

      assert.notStrictEqual(state1.stateParam, state2.stateParam);
      assert.notStrictEqual(state1.cookieName, state2.cookieName);
      assert.notStrictEqual(state1.cookieValue, state2.cookieValue);
      assert.ok(state1.stateParam.includes('.'), 'State must be HMAC signed with a period separator');
    });

    test('Valid signed state matching browser session cookie validates successfully', () => {
      const { stateParam, cookieName, cookieValue } = createOAuthState({
        workspaceId: testWorkspaceId,
        userId: testUserId,
      });

      const cookies: Record<string, string> = {
        [cookieName]: cookieValue,
      };

      const result = verifyOAuthState({
        stateParam,
        getCookie: (name) => cookies[name],
      });

      assert.strictEqual(result.isValid, true);
      assert.strictEqual(result.payload?.workspaceId, testWorkspaceId);
      assert.strictEqual(result.payload?.userId, testUserId);
      assert.strictEqual(result.cookieNameToClear, cookieName);
    });

    test('Missing state parameter fails validation strictly', () => {
      const result = verifyOAuthState({
        stateParam: null,
        getCookie: () => undefined,
      });

      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.error, 'missing_state');
    });

    test('Tampered or modified state signature fails validation strictly', () => {
      const { stateParam, cookieName, cookieValue } = createOAuthState({
        workspaceId: testWorkspaceId,
        userId: testUserId,
      });

      const [payloadPart] = stateParam.split('.');
      const tamperedSignature = crypto.randomBytes(32).toString('hex');
      const tamperedState = `${payloadPart}.${tamperedSignature}`;

      const cookies: Record<string, string> = {
        [cookieName]: cookieValue,
      };

      const result = verifyOAuthState({
        stateParam: tamperedState,
        getCookie: (name) => cookies[name],
      });

      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.error, 'invalid_state_signature');
    });

    test('Tampered state payload with legitimate signature fails validation strictly', () => {
      const { stateParam, cookieName, cookieValue } = createOAuthState({
        workspaceId: testWorkspaceId,
        userId: testUserId,
      });

      const [, signaturePart] = stateParam.split('.');
      const forgedPayload = Buffer.from(
        JSON.stringify({
          workspaceId: 'attacker_workspace_id',
          userId: 'attacker_user_id',
          timestamp: Date.now(),
          nonce: 'nonce123',
        })
      ).toString('base64url');

      const tamperedState = `${forgedPayload}.${signaturePart}`;

      const cookies: Record<string, string> = {
        [cookieName]: cookieValue,
      };

      const result = verifyOAuthState({
        stateParam: tamperedState,
        getCookie: (name) => cookies[name],
      });

      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.error, 'invalid_state_signature');
    });

    test('Expired state (>15 minutes) is rejected strictly', () => {
      // Manually construct state older than 15 minutes
      const expiredTimestamp = Date.now() - 16 * 60 * 1000;
      const stateId = crypto.randomBytes(32).toString('hex');
      const payload = {
        stateId,
        workspaceId: testWorkspaceId,
        userId: testUserId,
        timestamp: expiredTimestamp,
        nonce: 'nonce_123',
      };

      const serialized = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const secret = process.env.LINKEDIN_OAUTH_STATE_SECRET || process.env.ENCRYPTION_KEY || process.env.LINKEDIN_CLIENT_SECRET || 'insecure_dev_oauth_state_secret_key_32_bytes!';
      const sig = crypto.createHmac('sha256', secret).update(serialized).digest('hex');
      const stateParam = `${serialized}.${sig}`;

      const cookieName = `${OAUTH_STATE_COOKIE_PREFIX}${stateId.slice(0, 16)}`;
      const cookieValue = crypto.createHmac('sha256', secret).update(`cookie:${stateId}:${testUserId}:${testWorkspaceId}`).digest('hex');

      const cookies: Record<string, string> = {
        [cookieName]: cookieValue,
      };

      const result = verifyOAuthState({
        stateParam,
        getCookie: (name) => cookies[name],
      });

      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.error, 'expired_state');
    });

    test('State from a different browser session (missing cookie) fails validation', () => {
      const { stateParam } = createOAuthState({
        workspaceId: testWorkspaceId,
        userId: testUserId,
      });

      // Browser cookies empty / from different session
      const cookies: Record<string, string> = {};

      const result = verifyOAuthState({
        stateParam,
        getCookie: (name) => cookies[name],
      });

      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.error, 'missing_session_binding_cookie');
    });

    test('State with mismatched session cookie fails validation strictly', () => {
      const { stateParam, cookieName } = createOAuthState({
        workspaceId: testWorkspaceId,
        userId: testUserId,
      });

      const cookies: Record<string, string> = {
        [cookieName]: 'forged_or_different_cookie_value_hex',
      };

      const result = verifyOAuthState({
        stateParam,
        getCookie: (name) => cookies[name],
      });

      assert.strictEqual(result.isValid, false);
      assert.strictEqual(result.error, 'session_binding_cookie_mismatch');
    });

    test('Multiple concurrent OAuth attempts maintain independent isolated states and cookies', () => {
      const attempt1 = createOAuthState({ workspaceId: testWorkspaceId, userId: testUserId });
      const attempt2 = createOAuthState({ workspaceId: testWorkspaceId, userId: testUserId });

      assert.notStrictEqual(attempt1.cookieName, attempt2.cookieName);

      const cookieJar: Record<string, string> = {
        [attempt1.cookieName]: attempt1.cookieValue,
        [attempt2.cookieName]: attempt2.cookieValue,
      };

      // Both must validate independently without collision
      const res1 = verifyOAuthState({ stateParam: attempt1.stateParam, getCookie: (n) => cookieJar[n] });
      const res2 = verifyOAuthState({ stateParam: attempt2.stateParam, getCookie: (n) => cookieJar[n] });

      assert.strictEqual(res1.isValid, true);
      assert.strictEqual(res2.isValid, true);
      assert.strictEqual(res1.payload?.stateId, attempt1.cookieName.replace(OAUTH_STATE_COOKIE_PREFIX, '') + res1.payload?.stateId.slice(16));
    });
  });

  describe('Redirect URI & Host Header Defense', () => {
    test('Allowed origins (production and local) resolve authoritative redirect URI', () => {
      const prodUri = getAuthoritativeRedirectUri('https://autopilot.gtinnox.in');
      assert.strictEqual(prodUri, 'https://autopilot.gtinnox.in/api/linkedin/callback');

      const localUri = getAuthoritativeRedirectUri('http://localhost:3000');
      assert.strictEqual(localUri, 'http://localhost:3000/api/linkedin/callback');

      const localIpUri = getAuthoritativeRedirectUri('http://127.0.0.1:3000');
      assert.strictEqual(localIpUri, 'http://127.0.0.1:3000/api/linkedin/callback');
    });

    test('Untrusted / attacker-controlled Host headers are rejected and fall back safely', () => {
      const attackerOrigins = [
        'https://attacker-steals-tokens.com',
        'http://malicious.evil',
        'https://gtinnox.in.attacker.org',
        'javascript:alert(1)',
      ];

      for (const untrusted of attackerOrigins) {
        const safeUri = getAuthoritativeRedirectUri(untrusted);
        assert.ok(!safeUri.includes(untrusted), `Untrusted origin ${untrusted} must not be present in redirect URI`);
        assert.ok(
          safeUri === 'https://autopilot.gtinnox.in/api/linkedin/callback' ||
          safeUri === process.env.LINKEDIN_REDIRECT_URI
        );
      }
    });
  });
});
