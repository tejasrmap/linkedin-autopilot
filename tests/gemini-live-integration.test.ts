// ==============================================================
// LINKEDIN AUTOPILOT — GEMINI LIVE INTEGRATION TEST SUITE
// STRICTLY SEPARATED FROM DETERMINISTIC UNIT & FALLBACK TESTS
// RUNS LIVE CALLS ONLY WHEN GEMINI_API_KEY IS CONFIGURED
// GT INNOX LLP
// ==============================================================

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { aiService } from '../src/lib/ai/gemini';

const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);

describe('Gemini Live Integration Suite (Separated from Mocked/Unit Tests)', () => {
  if (!hasGeminiKey) {
    test('Gemini Live Integration: SKIPPED (GEMINI_API_KEY not set in test environment)', (t) => {
      console.log('-------------------------------------------------------------');
      console.log('ℹ️  GEMINI LIVE INTEGRATION TEST NOTICE:');
      console.log('   GEMINI_API_KEY is not present in the current environment.');
      console.log('   Live model calls are skipped to avoid mocking in integration tests.');
      console.log('   Deterministic fallback tests run in tests/ai-content-uniqueness.test.ts.');
      console.log('-------------------------------------------------------------');
      assert.ok(true, 'Live integration intentionally skipped when API key is missing');
    });
    return;
  }

  // Live model integration tests (only executed when valid GEMINI_API_KEY is supplied)
  test('Live Gemini: Generates grounded post with verified quality score', async () => {
    const result = await aiService.generatePostWithReport({
      topic: 'Optimizing Next.js 14 Server Actions and Streaming SSR Performance',
      apiKey: process.env.GEMINI_API_KEY,
    });

    assert.ok(result.content.length > 200, 'Live Gemini content must be substantive');
    assert.strictEqual(result.qualityStatus, 'verified', 'Live Gemini output should pass quality gate');
    assert.strictEqual(result.passed, true, 'Live output must pass verification');
  });

  test('Live Gemini: Generates dynamic hashtags tailored to topic', async () => {
    const tags = await aiService.generateHashtags(
      'Distributed Locking in Redis with Redlock vs CAS',
      4,
      process.env.GEMINI_API_KEY
    );

    assert.ok(tags.length >= 3, 'Must return at least 3 hashtags');
    assert.ok(tags.every((t) => t.startsWith('#')), 'All tags must start with #');
  });
});
