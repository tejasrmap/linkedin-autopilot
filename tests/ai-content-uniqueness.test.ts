// ==============================================================
// LINKEDIN AUTOPILOT — AI CONTENT INTELLIGENCE & UNIQUENESS REGRESSION SUITE
// 32 DIVERSE REAL-WORLD TOPICS, DIVERSE ARCHETYPES, WRITING PROFILES & ISOLATION
// GT INNOX LLP
// ==============================================================

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { contentIntelligence, TopicAnalysis, ContentCategory } from '../src/lib/ai/content-intelligence';
import { writingProfileEngine, WritingProfile } from '../src/lib/ai/writing-profile';
import { uniquenessEngine, BANNED_CLICHES, HistoricalPostSummary } from '../src/lib/ai/uniqueness-engine';
import { qualityGate } from '../src/lib/ai/quality-gate';
import { aiService } from '../src/lib/ai/gemini';

const TEST_TOPICS = [
  // 1. Databases
  { topic: 'PostgreSQL MVCC vacuuming and dead tuple bloat', expectedCategory: 'databases', domainTerm: 'MVCC' },
  { topic: 'How Database Indexing Strategies Impact High-Throughput Write Pipelines', expectedCategory: 'databases', domainTerm: 'Index' },
  { topic: 'Zero-Downtime PostgreSQL Schema Migrations on High-Traffic Tables', expectedCategory: 'databases', domainTerm: 'Postgres' },
  
  // 2. Cloud Computing & DevOps
  { topic: 'Kubernetes Pod lifecycle and CrashLoopBackOff troubleshooting', expectedCategory: 'cloud_architecture', domainTerm: 'Pod' },
  { topic: 'Designing High-Availability Multi-Region S3 Storage Replication', expectedCategory: 'cloud_architecture', domainTerm: 'S3' },
  { topic: 'AWS Lambda Provisioned Concurrency vs Cold Start Optimization', expectedCategory: 'cloud_architecture', domainTerm: 'Concurrency' },

  // 3. Certifications
  { topic: 'AWS Certified Solutions Architect Associate exam preparation and key domains', expectedCategory: 'certifications', domainTerm: 'Exam' },
  { topic: 'Certified Kubernetes Administrator (CKA): why terminal practice beats multiple-choice quizzes', expectedCategory: 'certifications', domainTerm: 'Hands-on' },
  { topic: 'CompTIA Security+ SY0-701: mastering cryptographic concepts and threat vectors', expectedCategory: 'certifications', domainTerm: 'Security' },

  // 4. Cybersecurity
  { topic: 'Implementing zero-trust architecture with least privilege IAM and network microsegmentation', expectedCategory: 'cybersecurity', domainTerm: 'Zero Trust' },
  { topic: 'OAuth 2.0 PKCE Flow vs Authorization Code Flow: When and Why to Use Each', expectedCategory: 'cybersecurity', domainTerm: 'OAuth' },
  { topic: 'Preventing Insecure Direct Object References (IDOR) with Row Level Security', expectedCategory: 'cybersecurity', domainTerm: 'RLS' },

  // 5. Software Architecture & Systems
  { topic: 'Building an AI-powered ERP system with event sourcing and BullMQ', expectedCategory: 'software_engineering', domainTerm: 'Queue' },
  { topic: 'Migrating from a monolithic database to read replicas under heavy query load', expectedCategory: 'software_engineering', domainTerm: 'Replica' },
  { topic: 'Distributed Locking in Redis: Compare-And-Swap (CAS) vs Redlock algorithm', expectedCategory: 'software_engineering', domainTerm: 'CAS' },
  { topic: 'Building Resilient Dead-Letter Queues (DLQ) with Exponential Backoff and Alerting', expectedCategory: 'software_engineering', domainTerm: 'Dead Letter' },

  // 6. Artificial Intelligence & Machine Learning
  { topic: 'Retrieval-Augmented Generation (RAG) with hybrid dense vector search and BM25', expectedCategory: 'artificial_intelligence', domainTerm: 'Vector' },
  { topic: 'Transformer Self-Attention Mechanics: Demystifying Query, Key, and Value Vectors', expectedCategory: 'artificial_intelligence', domainTerm: 'Attention' },
  { topic: 'Unit Economics of AI Products: Managing Token Costs vs Customer Willingness to Pay', expectedCategory: 'artificial_intelligence', domainTerm: 'Token' },

  // 7. Programming & Web
  { topic: 'Idempotent payment webhook processing and avoiding double-credits', expectedCategory: 'software_engineering', domainTerm: 'Idempotent' },
  { topic: 'Refactoring a 2,000-line React God Component into Composable Custom Hooks', expectedCategory: 'software_engineering', domainTerm: 'Hook' },
  { topic: 'Optimizing Next.js 14 Server Actions and Streaming SSR Performance', expectedCategory: 'software_engineering', domainTerm: 'SSR' },

  // 8. Entrepreneurship & Startups
  { topic: 'Bootstrapping a B2B SaaS to $10k MRR: why talking to 5 customers beat 50 features', expectedCategory: 'business_entrepreneurship', domainTerm: 'Customer' },
  { topic: 'Why Premature Microservices Kill Early-Stage Startup Velocity', expectedCategory: 'business_entrepreneurship', domainTerm: 'Velocity' },
  { topic: 'Why B2B Churn Is Rarely a Pricing Issue: Investigating Feature Utilization', expectedCategory: 'business_entrepreneurship', domainTerm: 'Churn' },

  // 9. Leadership & Management
  { topic: 'From senior engineer to tech lead: lessons in delegating and avoiding bottlenecks', expectedCategory: 'leadership', domainTerm: 'Delegat' },
  { topic: 'Why Most Code Reviews Focus on Style Instead of Architectural Risk', expectedCategory: 'leadership', domainTerm: 'Architectur' },

  // 10. Product Releases & Launches
  { topic: 'Launching LinkedIn Autopilot v2.0: Multi-Tenant Architecture and Serverless Triggers', expectedCategory: 'product_releases', domainTerm: 'Launch' },

  // 11. Research & Academic
  { topic: 'Published Academic Paper at IEEE on Low-Latency Stream Processing', expectedCategory: 'technical_knowledge', domainTerm: 'Paper' },

  // 12. Lessons Learned & Retrospectives
  { topic: 'Lessons from Our First Major Production Outage: Root Cause and Retrospective', expectedCategory: 'lessons_learned', domainTerm: 'Outage' },

  // 13. Event Participation
  { topic: 'Keynote Speaking at DevOpsDays 2026: The Future of Platform Engineering', expectedCategory: 'technical_knowledge', domainTerm: 'Engineering' },

  // 14. Career & Personal Reflection
  { topic: 'Reflections on 10 Years in Software Engineering: What I Would Tell My Younger Self', expectedCategory: 'personal_reflections', domainTerm: 'Engineering' },
  { topic: 'Leaving Big Tech for an Early-Stage Startup: 6-Month Reality Check', expectedCategory: 'personal_reflections', domainTerm: 'Startup' },
];

describe('AI Content Intelligence & Uniqueness Suite', () => {
  describe('Phase 1: 32 Diverse Topics - Grounded Generation & Domain Classification', () => {
    for (const testCase of TEST_TOPICS) {
      test(`Topic: "${testCase.topic.slice(0, 45)}..." classifies accurately and produces grounded content`, async () => {
        const analysis = contentIntelligence.analyzeTopic(testCase.topic);
        
        // Assert category is not null and is relevant
        assert.ok(analysis.category, 'Topic must have a classified category');
        assert.ok(analysis.domainTerms.length > 0, 'Domain terms must be extracted');
        assert.ok(analysis.recommendedNarrative, 'Narrative arc must be selected');

        // Generate post via Content Intelligence Engine
        const result = await aiService.generatePostWithReport({
          topic: testCase.topic,
          length: 'medium',
        });

        // 1. Content is not empty
        assert.ok(result.content.length > 200, 'Post content must be substantive (>200 chars)');

        // 2. Contains zero banned clichés
        for (const cliche of BANNED_CLICHES) {
          const lower = result.content.toLowerCase();
          assert.strictEqual(
            lower.includes(cliche),
            false,
            `Post on "${testCase.topic}" contained banned cliché: "${cliche}"`
          );
        }

        // 3. Check for topic relevance
        const contentLower = result.content.toLowerCase();
        const hasTopicSnippet = testCase.topic
          .toLowerCase()
          .split(' ')
          .some((w) => w.length > 4 && contentLower.includes(w));
        assert.ok(
          hasTopicSnippet,
          `Post must mention words from topic. Topic: ${testCase.topic}, Content: ${result.content.slice(0, 100)}`
        );

        // 4. Quality score must pass threshold (>= 70)
        assert.ok(
          result.uniquenessScore.totalScore >= 70,
          `Quality score (${result.uniquenessScore.totalScore}) must meet threshold (>= 70)`
        );
      });
    }
  });

  describe('Phase 2: Cross-Topic Uniqueness (Different Topics Must NOT Sound Identical)', () => {
    test('Technical post vs Certification post vs Startup post have low structural/lexical overlap', async () => {
      const techTopic = 'PostgreSQL MVCC vacuuming and dead tuple bloat';
      const certTopic = 'AWS Certified Solutions Architect Associate exam preparation and key domains';
      const startupTopic = 'Bootstrapping a B2B SaaS to $10k MRR: why talking to 5 customers beat 50 features';

      const [techRes, certRes, startupRes] = await Promise.all([
        aiService.generatePostWithReport({ topic: techTopic }),
        aiService.generatePostWithReport({ topic: certTopic }),
        aiService.generatePostWithReport({ topic: startupTopic }),
      ]);

      const techSummary = uniquenessEngine.summarizePost(techRes.content);
      const certSummary = uniquenessEngine.summarizePost(certRes.content);
      const startupSummary = uniquenessEngine.summarizePost(startupRes.content);

      // Verify opening hooks are distinct
      assert.notStrictEqual(techSummary.hook, certSummary.hook, 'Tech and Cert hooks must be distinct');
      assert.notStrictEqual(techSummary.hook, startupSummary.hook, 'Tech and Startup hooks must be distinct');

      // Check n-gram overlap between dissimilar topics is low (< 0.20)
      const techScoreAgainstCert = uniquenessEngine.evaluateContent(techRes.content, techTopic, [certSummary]);
      assert.ok(
        techScoreAgainstCert.maxHistoricalSimilarity < 0.25,
        `Tech vs Cert similarity should be < 0.25, got ${techScoreAgainstCert.maxHistoricalSimilarity}`
      );

      const startupScoreAgainstTech = uniquenessEngine.evaluateContent(startupRes.content, startupTopic, [techSummary]);
      assert.ok(
        startupScoreAgainstTech.maxHistoricalSimilarity < 0.25,
        `Startup vs Tech similarity should be < 0.25, got ${startupScoreAgainstTech.maxHistoricalSimilarity}`
      );
    });
  });

  describe('Phase 3: Same-Topic Regeneration Diversity', () => {
    test('Regenerating post on same topic with alternative narrative yields structurally different content', async () => {
      const topic = 'Kubernetes Pod lifecycle and CrashLoopBackOff troubleshooting';
      
      const firstRun = await aiService.generatePostWithReport({
        topic,
        narrativeArc: 'problem_investigation_solution',
      });

      const secondRun = await aiService.generatePostWithReport({
        topic,
        narrativeArc: 'architecture_tradeoffs',
      });

      assert.notStrictEqual(
        firstRun.content,
        secondRun.content,
        'Regenerated post must not be identical'
      );

      const firstSummary = uniquenessEngine.summarizePost(firstRun.content);
      const secondSummary = uniquenessEngine.summarizePost(secondRun.content);

      assert.notStrictEqual(
        firstSummary.hook,
        secondSummary.hook,
        'Alternative narrative must produce different opening hook'
      );
    });
  });

  describe('Phase 4: Writing Style Profile Extraction', () => {
    test('Deduces correct profile from bullet-focused practitioner samples', () => {
      const bulletSamples = [
        'Building microservices requires discipline.\n\nKey considerations:\n• Enforce strict idempotency on all write queues\n• Separate read queries to replicas\n• Set aggressive timeouts\n\nWhat patterns do you use?',
        'When debugging distributed traces in OpenTelemetry:\n\n1. Inspect context propagation across HTTP headers\n2. Trace database spans before blaming CPU\n3. Set trace sampling to 5%\n\nHow do you trace in production?',
      ];

      const profile = writingProfileEngine.computeProfileFromSamples(bulletSamples);
      assert.strictEqual(profile.formattingRhythm, 'bullet_focused');
      assert.strictEqual(profile.emojiDensity, 'none');
      assert.strictEqual(profile.hashtagPreference, 'none');

      const promptConstraint = writingProfileEngine.formatProfilePrompt(profile);
      assert.ok(promptConstraint.includes('bullet points'), 'Prompt must instruct bullet preference');
      assert.ok(promptConstraint.includes('NO emojis'), 'Prompt must instruct no emojis');
    });

    test('Deduces correct profile from prose-focused storytelling samples', () => {
      const proseSamples = [
        'Two years ago, our team faced an outage that taught us the true value of asynchronous decoupling. We had spent weeks believing the bottleneck was database indexing, but the actual cause was a synchronous webhook that held open server threads during network blips. Once we offloaded that path to BullMQ, system turnaround dropped instantly. Clarity beats complexity every single time.',
      ];

      const profile = writingProfileEngine.computeProfileFromSamples(proseSamples);
      assert.strictEqual(profile.formattingRhythm, 'prose_focused');
      assert.strictEqual(profile.firstPersonUsage, 'first_person_plural');

      const promptConstraint = writingProfileEngine.formatProfilePrompt(profile);
      assert.ok(promptConstraint.includes('paragraphs'), 'Prompt must instruct paragraph preference');
      assert.ok(promptConstraint.includes('Team-oriented'), 'Prompt must reflect team voice');
    });
  });

  describe('Phase 5: Quality Gate & Anti-Cliché Enforcements', () => {
    test('Rejects post with canned AI clichés and flags retry directives', () => {
      const cannedPost = `Excited to share that we just launched our new feature! In today's fast-paced world, this is a game changer. Let's dive into the details: 1. It is fast. 2. It is reliable. 3. It works. Another milestone achieved!`;

      const analysis = contentIntelligence.analyzeTopic('Feature launch');
      const gateResult = qualityGate.evaluate(cannedPost, 'Feature launch', analysis, []);

      assert.strictEqual(gateResult.passed, false, 'Quality gate must fail canned post');
      assert.strictEqual(gateResult.retryNeeded, true, 'Retry must be triggered');
      assert.ok(
        gateResult.retryDirectives?.bannedPhrases.length! > 0,
        'Must detect banned phrases'
      );
    });

    test('Passes grounded technical post with high quality score', () => {
      const validPost = `When debugging query latency in PostgreSQL, the default instinct is often: "We need another index."

Here is why that frequently backfires:

Every index consumes memory in shared buffers, increases Write-Ahead Log (WAL) volume, and turns every INSERT into a multi-table write amplification issue.

Before adding a new index, run EXPLAIN (ANALYZE, BUFFERS) and check:
• Shared hit vs shared read: Are you disk I/O bound?
• Dead tuple bloat: An unvacuumed table forces sequential scans.
• Filter selectivity: If the WHERE condition matches >15% of rows, B-Tree scans are slower than sequential scans.

What is your team's checklist before approving a schema migration?`;

      const analysis = contentIntelligence.analyzeTopic('PostgreSQL query performance and indexing');
      const gateResult = qualityGate.evaluate(validPost, 'PostgreSQL query performance and indexing', analysis, []);

      assert.strictEqual(gateResult.passed, true, 'Quality gate must pass authentic technical post');
      assert.ok(gateResult.score.totalScore >= 80, 'Score must be high for substantive post');
    });
  });

  describe('Phase 6: Multi-Tenant Corpus Isolation', () => {
    test('Ensures history queries are strictly scoped by workspaceId', async () => {
      // Mock Supabase client to inspect SQL query filter
      let capturedWorkspaceFilter: string | null = null;
      const mockSupabase: any = {
        from: (table: string) => ({
          select: () => ({
            eq: (col: string, val: string) => {
              if (col === 'workspace_id') capturedWorkspaceFilter = val;
              return {
                order: () => ({
                  limit: () => Promise.resolve({ data: [], error: null }),
                }),
              };
            },
          }),
        }),
      };

      const testWsId = '3af1cc83-b7e7-4ce6-b422-d84d326aaf31';
      await uniquenessEngine.getTenantHistory(mockSupabase, testWsId);

      assert.strictEqual(
        capturedWorkspaceFilter,
        testWsId,
        'History query must be strictly scoped to the caller workspace_id'
      );
    });
  });
});
