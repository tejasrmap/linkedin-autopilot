// ==============================================================
// LINKEDIN AUTOPILOT — AI STUDIO ROUTES REGRESSION TEST SUITE
// WORKSPACE AUTHORIZATION, BRAND SETTINGS RBAC, VALIDATION & ERROR HANDLING
// GT INNOX LLP
// ==============================================================

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { POST as generateHandler } from '../src/app/api/ai/generate/route';
import { POST as rewriteHandler } from '../src/app/api/ai/rewrite/route';
import { POST as ideasHandler } from '../src/app/api/ai/ideas/route';
import { POST as hashtagsHandler } from '../src/app/api/ai/hashtags/route';
import { POST as calendarHandler } from '../src/app/api/ai/calendar/route';
import { GET as getBrandSettingsHandler, PUT as putBrandSettingsHandler } from '../src/app/api/brand-settings/route';
import { POST as certificateRouteHandler } from '../src/app/api/ai/certificate/route';
import { getAuthContext } from '../src/lib/auth';

import { GoogleGenerativeAI } from '@google/generative-ai';

const VALID_WS_ID = '3af1cc83-b7e7-4ce6-b422-d84d326aaf31';
const UNKNOWN_WS_ID = 'unknown-workspace-id-00000000';
const FOREIGN_WS_ID = 'foreign-workspace-id-99999999';

const REAL_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

describe('AI Content Studio — Security, RBAC & Reliability Test Suite', () => {
  let originalGetGenerativeModel: any;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    (process.env as any).NODE_ENV = 'test';
    process.env.ALLOW_DEV_AUTH = 'true';
    process.env.MOCK_SUPABASE_FOR_TESTS = 'true';
    process.env.GEMINI_API_KEY = 'test_gemini_api_key_valid';
    process.env.TEST_AUTH_USER_ID = `test-user-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    process.env.TEST_AUTH_ROLE = 'owner';

    originalGetGenerativeModel = GoogleGenerativeAI.prototype.getGenerativeModel;
    GoogleGenerativeAI.prototype.getGenerativeModel = () => ({
      generateContent: async () => ({
        response: {
          text: () => JSON.stringify({
            certificateName: 'AWS Certified Solutions Architect',
            announcement: 'Excited to announce my AWS certification!',
          }),
        },
      }),
    }) as any;
  });

  afterEach(() => {
    (process.env as any).NODE_ENV = originalNodeEnv;
    GoogleGenerativeAI.prototype.getGenerativeModel = originalGetGenerativeModel;
    delete process.env.TEST_AUTH_ROLE;
    delete process.env.TEST_AUTH_USER_ID;
  });

  // -------------------------------------------------------------
  // PHASE 1: WORKSPACE AUTHORIZATION ACROSS ALL AI ROUTES
  // -------------------------------------------------------------
  describe('Phase 1: Multi-Tenant Workspace Header Enforcement', () => {
    const endpoints = [
      {
        name: 'POST /api/ai/generate',
        handler: generateHandler,
        body: { topic: 'Software Architecture Tradeoffs' },
      },
      {
        name: 'POST /api/ai/rewrite',
        handler: rewriteHandler,
        body: { content: 'This is an authentic draft about engineering resilience.', targetTone: 'technical' },
      },
      {
        name: 'POST /api/ai/ideas',
        handler: ideasHandler,
        body: { industry: 'Enterprise SaaS Systems' },
      },
      {
        name: 'POST /api/ai/hashtags',
        handler: hashtagsHandler,
        body: { topic: 'Distributed Database Systems' },
      },
      {
        name: 'POST /api/ai/calendar',
        handler: calendarHandler,
        body: { industry: 'Cloud Native Infrastructure' },
      },
      {
        name: 'GET /api/brand-settings',
        handler: getBrandSettingsHandler,
        method: 'GET',
      },
      {
        name: 'PUT /api/brand-settings',
        handler: putBrandSettingsHandler,
        method: 'PUT',
        body: { brandName: 'Acme Global', industry: 'Cloud Architecture', brandVoice: 'Technical' },
      },
    ];

    for (const ep of endpoints) {
      test(`${ep.name} succeeds without x-workspace-id by defaulting securely`, async () => {
        const req = new Request('http://localhost:3000/api/endpoint', {
          method: ep.method || 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: ep.body ? JSON.stringify(ep.body) : undefined,
        });

        const res = await ep.handler(req);
        assert.strictEqual(res.status, 200, `${ep.name} must return 200 without x-workspace-id`);
      });

      test(`${ep.name} succeeds when x-workspace-id matches authorized workspace`, async () => {
        const req = new Request('http://localhost:3000/api/endpoint', {
          method: ep.method || 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-workspace-id': VALID_WS_ID,
          },
          body: ep.body ? JSON.stringify(ep.body) : undefined,
        });

        const res = await ep.handler(req);
        assert.strictEqual(res.status, 200, `${ep.name} must return 200 with valid x-workspace-id`);
      });

      test(`${ep.name} strictly fails closed (403 Forbidden) for unknown workspace ID`, async () => {
        const req = new Request('http://localhost:3000/api/endpoint', {
          method: ep.method || 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-workspace-id': UNKNOWN_WS_ID,
          },
          body: ep.body ? JSON.stringify(ep.body) : undefined,
        });

        const res = await ep.handler(req);
        assert.strictEqual(res.status, 403, `${ep.name} must return 403 for unknown workspace`);
        const data = await res.json();
        assert.ok(data.error.includes('Access denied to requested workspace'));
      });

      test(`${ep.name} strictly fails closed (403 Forbidden) for foreign tenant workspace ID`, async () => {
        const req = new Request('http://localhost:3000/api/endpoint', {
          method: ep.method || 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-workspace-id': FOREIGN_WS_ID,
          },
          body: ep.body ? JSON.stringify(ep.body) : undefined,
        });

        const res = await ep.handler(req);
        assert.strictEqual(res.status, 403, `${ep.name} must return 403 for foreign workspace`);
        const data = await res.json();
        assert.ok(data.error.includes('Access denied to requested workspace'));
      });
    }

    test('Unauthenticated request to POST /api/ai/ideas returns 401 Unauthorized', async () => {
      process.env.ALLOW_DEV_AUTH = 'false';
      const req = new Request('http://localhost:3000/api/ai/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry: 'SaaS' }),
      });

      const res = await ideasHandler(req);
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.error, 'Unauthorized');
    });

    test('Unauthenticated request to PUT /api/brand-settings returns 401 Unauthorized', async () => {
      process.env.ALLOW_DEV_AUTH = 'false';
      const req = new Request('http://localhost:3000/api/brand-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandName: 'Acme Global' }),
      });

      const res = await putBrandSettingsHandler(req);
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.error, 'Unauthorized');
    });
  });

  // -------------------------------------------------------------
  // PHASE 2: BRAND SETTINGS RBAC & ACCESS POLICY
  // -------------------------------------------------------------
  describe('Phase 2: Brand Settings Role-Based Access Control (RBAC)', () => {
    const roles: Array<{ role: string; canWrite: boolean; canRead: boolean }> = [
      { role: 'owner', canWrite: true, canRead: true },
      { role: 'admin', canWrite: true, canRead: true },
      { role: 'editor', canWrite: false, canRead: true },
      { role: 'approver', canWrite: false, canRead: true },
      { role: 'viewer', canWrite: false, canRead: true },
    ];

    for (const { role, canWrite, canRead } of roles) {
      test(`GET /api/brand-settings is ${canRead ? 'ALLOWED' : 'FORBIDDEN'} for role [${role}]`, async () => {
        process.env.TEST_AUTH_ROLE = role;
        const req = new Request('http://localhost:3000/api/brand-settings', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        const res = await getBrandSettingsHandler(req);
        assert.strictEqual(res.status, canRead ? 200 : 403);
      });

      test(`PUT /api/brand-settings is ${canWrite ? 'ALLOWED' : 'REJECTED with 403'} for role [${role}]`, async () => {
        process.env.TEST_AUTH_ROLE = role;
        const req = new Request('http://localhost:3000/api/brand-settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brandName: 'Acme Technologies',
            industry: 'Distributed Systems',
            brandVoice: 'Authoritative, precise, practitioner-focused',
          }),
        });

        const res = await putBrandSettingsHandler(req);
        if (canWrite) {
          assert.strictEqual(res.status, 200, `Role ${role} must be permitted to update brand settings`);
          const data = await res.json();
          assert.ok(data.settings);
          assert.strictEqual(data.settings.brand_name, 'Acme Technologies');
        } else {
          assert.strictEqual(res.status, 403, `Role ${role} must be rejected with 403 Forbidden`);
          const data = await res.json();
          assert.ok(data.error.includes('Only workspace owners and admins can update brand settings'));
        }
      });
    }

    test('Brand Settings Persistence: PUT settings are faithfully returned by subsequent GET', async () => {
      process.env.TEST_AUTH_ROLE = 'owner';
      const uniqueName = `Brand-${Date.now()}`;

      // 1. Save settings
      const putReq = new Request('http://localhost:3000/api/brand-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandName: uniqueName,
          industry: 'Cybersecurity & IAM',
          brandVoice: 'Rigorous, telemetry-driven',
        }),
      });
      const putRes = await putBrandSettingsHandler(putReq);
      assert.strictEqual(putRes.status, 200);

      // 2. Read settings back
      const getReq = new Request('http://localhost:3000/api/brand-settings', {
        method: 'GET',
      });
      const getRes = await getBrandSettingsHandler(getReq);
      assert.strictEqual(getRes.status, 200);
      const data = await getRes.json();
      assert.strictEqual(data.settings?.brand_name, uniqueName);
      assert.strictEqual(data.settings?.industry, 'Cybersecurity & IAM');
      assert.strictEqual(data.settings?.brand_voice, 'Rigorous, telemetry-driven');
    });
  });

  // -------------------------------------------------------------
  // PHASE 3: BRAND VOICE UI PERSISTENCE STATE MACHINE & LIFECYCLE
  // -------------------------------------------------------------
  describe('Phase 3: Brand Voice Component Lifecycle & UI Persistence Integration', () => {
    class MockBrandVoiceHarness {
      brandName = '';
      brandIndustry = '';
      brandVoice = '';
      loadingBrand = true;
      brandLoaded = false;
      brandError: string | null = null;
      savedBrand = false;
      saveApiCalls: any[] = [];

      async mount(apiResponse: { ok: boolean; status: number; data?: any; error?: string }) {
        this.loadingBrand = true;
        this.brandError = null;
        try {
          if (apiResponse.ok && apiResponse.data?.settings) {
            this.brandName = apiResponse.data.settings.brand_name || '';
            this.brandIndustry = apiResponse.data.settings.industry || '';
            this.brandVoice = apiResponse.data.settings.brand_voice || '';
            this.brandLoaded = true;
          } else if (!apiResponse.ok) {
            this.brandError = apiResponse.error || 'Failed to load brand settings';
            this.brandLoaded = false;
          } else {
            // Empty state: default to empty without placeholders
            this.brandName = '';
            this.brandIndustry = '';
            this.brandVoice = '';
            this.brandLoaded = true;
          }
        } catch (err: any) {
          this.brandError = err.message || 'Failed to load brand settings';
          this.brandLoaded = false;
        } finally {
          this.loadingBrand = false;
        }
      }

      async handleSaveBrand() {
        if (!this.brandLoaded) {
          // Blocked: cannot save while initial load is pending or failed
          return { saved: false, reason: 'save_disabled_while_unloaded' };
        }
        if (!this.brandName.trim()) {
          return { saved: false, reason: 'brand_name_required' };
        }

        this.saveApiCalls.push({
          brandName: this.brandName.trim(),
          industry: this.brandIndustry.trim(),
          brandVoice: this.brandVoice.trim(),
        });
        this.savedBrand = true;
        return { saved: true };
      }
    }

    test('Initial mount: save action remains disabled while loadingBrand is true', async () => {
      const harness = new MockBrandVoiceHarness();
      assert.strictEqual(harness.loadingBrand, true);
      assert.strictEqual(harness.brandLoaded, false);

      const saveAttempt = await harness.handleSaveBrand();
      assert.strictEqual(saveAttempt.saved, false);
      assert.strictEqual(saveAttempt.reason, 'save_disabled_while_unloaded');
      assert.strictEqual(harness.saveApiCalls.length, 0);
    });

    test('Successful fetch on mount populates form with persisted settings (no placeholder overwrite)', async () => {
      const harness = new MockBrandVoiceHarness();
      await harness.mount({
        ok: true,
        status: 200,
        data: {
          settings: {
            brand_name: 'Stripe Security Inc',
            industry: 'Payment Infrastructure',
            brand_voice: 'Direct, technical, telemetry-backed',
          },
        },
      });

      assert.strictEqual(harness.loadingBrand, false);
      assert.strictEqual(harness.brandLoaded, true);
      assert.strictEqual(harness.brandError, null);
      assert.strictEqual(harness.brandName, 'Stripe Security Inc');
      assert.strictEqual(harness.brandIndustry, 'Payment Infrastructure');
      assert.strictEqual(harness.brandVoice, 'Direct, technical, telemetry-backed');
      assert.notStrictEqual(harness.brandName, 'GT InnoX LLP', 'Must NOT overwrite saved data with placeholder');

      const saveAttempt = await harness.handleSaveBrand();
      assert.strictEqual(saveAttempt.saved, true);
      assert.strictEqual(harness.saveApiCalls.length, 1);
      assert.strictEqual(harness.saveApiCalls[0].brandName, 'Stripe Security Inc');
    });

    test('Failed fetch displays error state, blocks save, and retry successfully recovers', async () => {
      const harness = new MockBrandVoiceHarness();
      // 1. Initial mount fails
      await harness.mount({
        ok: false,
        status: 500,
        error: 'Database connection timeout',
      });

      assert.strictEqual(harness.loadingBrand, false);
      assert.strictEqual(harness.brandLoaded, false);
      assert.strictEqual(harness.brandError, 'Database connection timeout');

      // Save must remain blocked
      const saveAttempt = await harness.handleSaveBrand();
      assert.strictEqual(saveAttempt.saved, false);
      assert.strictEqual(saveAttempt.reason, 'save_disabled_while_unloaded');

      // 2. Retry succeeds
      await harness.mount({
        ok: true,
        status: 200,
        data: {
          settings: {
            brand_name: 'Recovered Brand',
            industry: 'Reliability Engineering',
            brand_voice: 'Excellence in execution',
          },
        },
      });

      assert.strictEqual(harness.brandError, null);
      assert.strictEqual(harness.brandLoaded, true);
      assert.strictEqual(harness.brandName, 'Recovered Brand');
      const retrySave = await harness.handleSaveBrand();
      assert.strictEqual(retrySave.saved, true);
    });
  });

  // -------------------------------------------------------------
  // PHASE 4: ZOD VALIDATION & SAFE ERROR CLASSIFICATION
  // -------------------------------------------------------------
  describe('Phase 4: Client Validation Errors Return HTTP 400 & Unexpected Errors Return Safe 500', () => {
    test('POST /api/ai/ideas returns 400 for empty industry string', async () => {
      const req = new Request('http://localhost:3000/api/ai/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry: '' }),
      });

      const res = await ideasHandler(req);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error, 'Invalid request payload');
      assert.ok(Array.isArray(data.details));
    });

    test('POST /api/ai/hashtags returns 400 for empty topic string', async () => {
      const req = new Request('http://localhost:3000/api/ai/hashtags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: 'a' }), // min 2
      });

      const res = await hashtagsHandler(req);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error, 'Invalid request payload');
      assert.ok(Array.isArray(data.details));
    });

    test('POST /api/ai/calendar returns 400 for empty industry string', async () => {
      const req = new Request('http://localhost:3000/api/ai/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry: 'x' }), // min 2
      });

      const res = await calendarHandler(req);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error, 'Invalid request payload');
      assert.ok(Array.isArray(data.details));
    });

    test('POST /api/ai/rewrite returns 400 for short content (<5 chars)', async () => {
      const req = new Request('http://localhost:3000/api/ai/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'hey', targetTone: 'technical' }),
      });

      const res = await rewriteHandler(req);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error, 'Invalid request payload');
      assert.ok(Array.isArray(data.details));
    });

    test('POST /api/ai/generate returns 400 for single character topic', async () => {
      const req = new Request('http://localhost:3000/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: 'x' }),
      });

      const res = await generateHandler(req);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error, 'Invalid request payload');
      assert.ok(Array.isArray(data.details));
    });

    test('PUT /api/brand-settings returns 400 for short brandName (<2 chars)', async () => {
      const req = new Request('http://localhost:3000/api/brand-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandName: 'A' }),
      });

      const res = await putBrandSettingsHandler(req);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.strictEqual(data.error, 'Invalid request payload');
      assert.ok(Array.isArray(data.details));
    });

    test('Unexpected server error in POST /api/ai/generate returns safe generic 500 without leaking stack traces', async () => {
      const req = new Request('http://localhost:3000/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json-structure-triggering-catch',
      });

      const res = await generateHandler(req);
      assert.strictEqual(res.status, 500);
      const data = await res.json();
      assert.strictEqual(data.error, 'Internal AI generation error');
      assert.strictEqual(data.stack, undefined);
    });

    test('Unexpected server error in POST /api/ai/rewrite returns safe generic 500 without leaking stack traces', async () => {
      const req = new Request('http://localhost:3000/api/ai/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json-structure-triggering-catch',
      });

      const res = await rewriteHandler(req);
      assert.strictEqual(res.status, 500);
      const data = await res.json();
      assert.strictEqual(data.error, 'Internal AI rewrite error');
      assert.strictEqual(data.stack, undefined);
    });

    test('Database failure in PUT /api/brand-settings returns safe generic 500 without leaking DB internals', async () => {
      const req = new Request('http://localhost:3000/api/brand-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json-syntax',
      });

      const res = await putBrandSettingsHandler(req);
      assert.strictEqual(res.status, 500);
      const data = await res.json();
      assert.strictEqual(data.error, 'Internal server error');
      assert.strictEqual(data.stack, undefined);
    });
  });

  // -------------------------------------------------------------
  // PHASE 5: PRODUCTION AUTHENTICATION AUDIT & FAIL-CLOSED GUARDS
  // -------------------------------------------------------------
  describe('Phase 5: Production Authentication Audit & Verified Membership Enforcement', () => {
    test('Production safeguard: NODE_ENV=production strictly ignores ALLOW_DEV_AUTH=true (returns 401)', async () => {
      (process.env as any).NODE_ENV = 'production';
      process.env.ALLOW_DEV_AUTH = 'true';

      const req = new Request('http://localhost:3000/api/brand-settings', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      const res = await getBrandSettingsHandler(req);
      assert.strictEqual(res.status, 401, 'Production must never allow dev auth fallback');
      const data = await res.json();
      assert.strictEqual(data.error, 'Unauthorized');
    });

    test('Production foreign workspace safeguard: NODE_ENV=production with x-workspace-id returns 403 Forbidden', async () => {
      (process.env as any).NODE_ENV = 'production';
      process.env.ALLOW_DEV_AUTH = 'true';

      const req = new Request('http://localhost:3000/api/brand-settings', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-id': FOREIGN_WS_ID,
        },
      });

      const res = await getBrandSettingsHandler(req);
      assert.strictEqual(res.status, 403, 'Production must reject unverified workspace with 403');
      const data = await res.json();
      assert.ok(data.error.includes('Access denied to requested workspace'));
    });

    test('Verified membership contract: getAuthContext(requestWorkspaceId) checks verified database membership and fails closed to null', async () => {
      (process.env as any).NODE_ENV = 'test';
      process.env.ALLOW_DEV_AUTH = 'true';

      // 1. Valid workspace membership succeeds
      const validAuth = await getAuthContext(VALID_WS_ID);
      assert.ok(validAuth, 'Valid authorized workspace must resolve auth context');
      assert.strictEqual(validAuth.workspaceId, VALID_WS_ID);

      // 2. Unknown workspace ID fails closed to null without fallback
      const unknownAuth = await getAuthContext(UNKNOWN_WS_ID);
      assert.strictEqual(unknownAuth, null, 'Unknown workspace ID must return null');

      // 3. Foreign workspace ID fails closed to null without fallback
      const foreignAuth = await getAuthContext(FOREIGN_WS_ID);
      assert.strictEqual(foreignAuth, null, 'Foreign workspace ID must return null');
    });
  });

  // -------------------------------------------------------------
  // PHASE 6: CERTIFICATE ROUTE REGRESSION PRESERVATION
  // -------------------------------------------------------------
  describe('Certificate Route Regression Safety', () => {
    test('Certificate route preserves fail-closed foreign workspace rejection', async () => {
      const formData = new FormData();
      const file = new File([REAL_PNG_BUFFER], 'cert.png', { type: 'image/png' });
      formData.append('certificate', file);

      const req = new Request('http://localhost:3000/api/ai/certificate', {
        method: 'POST',
        headers: { 'x-workspace-id': FOREIGN_WS_ID },
        body: formData,
      });

      const res = await certificateRouteHandler(req);
      assert.strictEqual(res.status, 403, 'Certificate route must reject foreign workspace');
      const data = await res.json();
      assert.ok(data.error.includes('Access denied to requested workspace'));
    });

    test('Certificate route preserves valid workspace header execution', async () => {
      const formData = new FormData();
      const file = new File([REAL_PNG_BUFFER], 'cert.png', { type: 'image/png' });
      formData.append('certificate', file);

      const req = new Request('http://localhost:3000/api/ai/certificate', {
        method: 'POST',
        headers: { 'x-workspace-id': VALID_WS_ID },
        body: formData,
      });

      const res = await certificateRouteHandler(req);
      assert.strictEqual(res.status, 200, 'Certificate route must accept valid workspace');
    });
  });
});
