// ==============================================================
// LINKEDIN AUTOPILOT — AI CONTENT INTELLIGENCE COMPREHENSIVE TEST MATRIX
// COVERS 10 MATRIX DIMENSIONS: MULTI-TOPIC, MULTI-USER, MULTI-TENANT,
// RETRIES, DEGRADATION, API KEY ABSENCE, PROFILE EXTRACTION & UNUSABLE TOPICS
// GT INNOX LLP
// ==============================================================

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { contentIntelligence } from '../src/lib/ai/content-intelligence';
import { writingProfileEngine } from '../src/lib/ai/writing-profile';
import { uniquenessEngine } from '../src/lib/ai/uniqueness-engine';
import { qualityGate } from '../src/lib/ai/quality-gate';
import { aiService } from '../src/lib/ai/gemini';

describe('AI Content Intelligence — Full Test Matrix', () => {
  // Dimension 1: Different Topics Across Multiple Domains
  describe('Dimension 1: Different Topics Produce Distinct Domain Substance', () => {
    const topics = [
      { name: 'AWS Certification', topic: 'AWS Certified Solutions Architect Associate exam preparation and key domains', expectedToken: 'VPC' },
      { name: 'PostgreSQL Indexing', topic: 'How Database Indexing Strategies Impact High-Throughput Write Pipelines', expectedToken: 'index' },
      { name: 'React Architecture', topic: 'Refactoring a 2,000-line React God Component into Composable Custom Hooks', expectedToken: 'hook' },
      { name: 'Startup Customer Validation', topic: 'Bootstrapping a B2B SaaS to $10k MRR: why talking to 5 customers beat 50 features', expectedToken: 'customer' },
      { name: 'Personal Learning', topic: 'Reflections on 10 Years in Software Engineering: What I Would Tell My Younger Self', expectedToken: 'engineering' },
      { name: 'Cybersecurity Auth', topic: 'OAuth 2.0 PKCE Flow vs Authorization Code Flow: When and Why to Use Each', expectedToken: 'pkce' },
      { name: 'Product Launch', topic: 'Launching LinkedIn Autopilot v2.0: Multi-Tenant Architecture and Serverless Triggers', expectedToken: 'launch' },
      { name: 'Business Leadership', topic: 'Why Most Code Reviews Focus on Style Instead of Architectural Risk', expectedToken: 'review' },
    ];

    for (const item of topics) {
      test(`Topic [${item.name}] generates substantive, domain-relevant content`, async () => {
        const result = await aiService.generatePostWithReport({ topic: item.topic });
        assert.ok(result.content.length > 150, 'Post content must be substantive');
        assert.ok(
          result.content.toLowerCase().includes(item.expectedToken.toLowerCase()),
          `Post for [${item.name}] must contain expected token "${item.expectedToken}"`
        );
      });
    }
  });

  // Dimension 2: Same Topic with Different Narrative Modes
  describe('Dimension 2: Same Topic with Different Narrative Modes', () => {
    test('Produces structurally different framing for architecture_tradeoffs vs problem_investigation_solution', async () => {
      const topic = 'Kubernetes Pod lifecycle and CrashLoopBackOff troubleshooting';
      const runA = await aiService.generatePostWithReport({ topic, narrativeArc: 'architecture_tradeoffs' });
      const runB = await aiService.generatePostWithReport({ topic, narrativeArc: 'problem_investigation_solution' });

      assert.notStrictEqual(runA.content, runB.content, 'Different narrative modes must not generate identical text');
      assert.ok(runA.content.includes('trade-off') || runA.content.includes('autoscaling'), 'Run A must reflect trade-offs');
      assert.ok(runB.content.includes('Exit code') || runB.content.includes('probes'), 'Run B must reflect investigation');
    });
  });

  // Dimension 3: Same Topic with Repeated Regeneration
  describe('Dimension 3: Same Topic with Repeated Regeneration', () => {
    test('Repeated generations on same topic evaluate uniqueness and track historical context', async () => {
      const topic = 'Zero-Downtime PostgreSQL Schema Migrations on High-Traffic Tables';
      const firstRun = await aiService.generatePostWithReport({ topic });
      const firstSummary = uniquenessEngine.summarizePost(firstRun.content);

      // Generate second post with alternative narrative arc
      const secondRun = await aiService.generatePostWithReport({
        topic,
        narrativeArc: 'architecture_tradeoffs',
      });

      // Evaluate second generation against the first post's summary
      const comparisonScore = uniquenessEngine.evaluateContent(secondRun.content, topic, [firstSummary]);
      assert.ok(secondRun.content.length > 150, 'Second run must produce substantive content');
      assert.ok(comparisonScore.totalScore > 0, 'Comparison score must evaluate successfully');
    });
  });

  // Dimension 4: Different Users in Same Workspace (Strict User Isolation)
  describe('Dimension 4: Different Users in Same Workspace Have Strictly Isolated Styles', () => {
    test('User A style does not contaminate User B writing profile', async () => {
      const userAPosts = [
        'Scaling microservices:\n\n- Idempotency on write queues\n- Separate read replicas\n- Timeout bounds',
        'Debugging production:\n\n- Inspect shared buffers\n- Alert on deadlocks\n- Trace query plans',
      ];
      const userBPosts = [
        'Reflecting on our journey building distributed infrastructure over the last five years. We realized that simple transactional databases beat complex premature microservices every single time.',
        'When our team faced unexpected traffic surges last winter, asynchronous message decoupling protected our core database.',
      ];

      const createClient = (userId: string) => ({
        from: () => ({
          select: () => {
            let capturedUser = '';
            const builder: any = {
              eq: (col: string, val: string) => {
                if (col === 'created_by') capturedUser = val;
                return builder;
              },
              order: () => builder,
              limit: () => {
                const posts = capturedUser === 'user-a' ? userAPosts : capturedUser === 'user-b' ? userBPosts : [];
                return Promise.resolve({ data: posts.map((content) => ({ content })), error: null });
              },
            };
            return builder;
          },
        }),
      });

      const profileA = await writingProfileEngine.extractProfile(createClient('user-a') as any, 'ws-common', 'user-a');
      const profileB = await writingProfileEngine.extractProfile(createClient('user-b') as any, 'ws-common', 'user-b');

      assert.strictEqual(profileA.formattingRhythm, 'bullet_focused');
      assert.strictEqual(profileB.formattingRhythm, 'prose_focused');
      assert.notStrictEqual(profileA.formattingRhythm, profileB.formattingRhythm);
    });
  });

  // Dimension 5: Different Workspaces (Strict Tenant Isolation)
  describe('Dimension 5: Different Workspaces Have Strictly Isolated History', () => {
    test('Tenant history query enforces workspace_id filtering', async () => {
      let capturedFilter = '';
      const mockSupabase: any = {
        from: () => ({
          select: () => ({
            eq: (col: string, val: string) => {
              if (col === 'workspace_id') capturedFilter = val;
              return {
                order: () => ({
                  limit: () => Promise.resolve({ data: [], error: null }),
                }),
              };
            },
          }),
        }),
      };

      const testWs = 'tenant-ws-alpha-99';
      await uniquenessEngine.getTenantHistory(mockSupabase, testWs);
      assert.strictEqual(capturedFilter, testWs, 'Query must be strictly isolated to the caller workspace_id');
    });
  });

  // Dimension 6: Missing Gemini API Key (Fallback Gracefulness & Truthful Degradation)
  describe('Dimension 6: Missing Gemini API Key Falls Back Safely with Degraded Status', () => {
    test('Without Gemini API key, returns grounded synthesis with qualityStatus: degraded and warnings', async () => {
      // Calling generatePostWithReport with no API key triggers offline fallback
      const result = await aiService.generatePostWithReport({
        topic: 'Distributed Locking in Redis: Compare-And-Swap (CAS) vs Redlock algorithm',
        apiKey: undefined,
      });

      assert.ok(result.content.length > 150, 'Fallback content must be substantive');
      assert.strictEqual(result.qualityStatus, 'degraded', 'Offline fallback must report qualityStatus: degraded');
      assert.ok(result.qualityWarnings.length > 0, 'Must include explicit offline fallback warnings');
      assert.ok(
        result.qualityWarnings.some((w) => w.includes('offline synthesis') || w.includes('unavailable')),
        'Warning must disclose offline synthesis'
      );
    });
  });

  // Dimension 7: Simulated Rate Limit / API Error Handling
  describe('Dimension 7: Gemini API Failure & Rate Limits', () => {
    test('Handles API failure gracefully without throwing and provides degraded result', async () => {
      // Even with an invalid dummy key that causes API failure, it should catch error and fall back
      const result = await aiService.generatePostWithReport({
        topic: 'PostgreSQL MVCC vacuuming and dead tuple bloat',
        apiKey: 'invalid-dummy-key-to-trigger-fallback',
      });

      assert.ok(result.content.length > 150, 'Must produce grounded fallback on error');
      assert.strictEqual(result.qualityStatus, 'degraded');
    });
  });

  // Dimension 8: Empty Historical Writing Profile
  describe('Dimension 8: Empty Historical Writing Profile', () => {
    test('Produces unpersonalized default profile with clear disclosure', () => {
      const defaultProfile = writingProfileEngine.getDefaultProfile('ws-new', 'user-new');
      assert.strictEqual(defaultProfile.isPersonalized, false);
      assert.strictEqual(defaultProfile.scope, 'unpersonalized_fallback');

      const prompt = writingProfileEngine.formatProfilePrompt(defaultProfile);
      assert.ok(prompt.includes('Unavailable') || prompt.includes('Insufficient'));
      assert.ok(prompt.includes('Do NOT fabricate personal experiences') || prompt.includes('Baseline Style'));
    });
  });

  // Dimension 9: Existing Historical Writing Profile (>= 2 Samples)
  describe('Dimension 9: Existing Historical Writing Profile (>= 2 Samples)', () => {
    test('Derives authentic profile patterns from verified samples', () => {
      const samples = [
        'Deep dive into OpenTelemetry spans:\n\n- Measure database query latency first\n- Correlate traces with error logs\n- Avoid over-sampling trace spans\n\nWhat is your observability strategy?',
        'When optimizing API latency:\n\n- Place caching as close to users as possible\n- Minimize database joins in request loops\n- Set aggressive connect timeouts\n\nHow do you measure latency?',
      ];

      const profile = writingProfileEngine.computeProfileFromSamples(samples, 'ws-existing', 'user-existing');
      assert.strictEqual(profile.isPersonalized, true);
      assert.strictEqual(profile.formattingRhythm, 'bullet_focused');
      assert.strictEqual(profile.sampleCount, 2);
    });
  });

  // Dimension 10: Unsupported or Ambiguous Topics
  describe('Dimension 10: Unsupported or Ambiguous Topics Return Generation Unavailable', () => {
    test('Rejects short or ambiguous prompt with failed quality status', async () => {
      const ambiguousTopic = 'Tips';
      const result = await aiService.generatePostWithReport({ topic: ambiguousTopic });

      assert.ok(
        result.content.includes('[Generation Unavailable]'),
        'Must return [Generation Unavailable] for ambiguous topic'
      );
      assert.strictEqual(result.qualityStatus, 'failed', 'Must report qualityStatus: failed');
      assert.strictEqual(result.passed, false, 'Must fail quality check');
      assert.ok(result.qualityWarnings.length > 0, 'Must provide actionable quality warning');
    });
  });
});
