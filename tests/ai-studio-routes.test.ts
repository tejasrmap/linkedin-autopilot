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

  beforeEach(() => {
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

    test('Unauthenticated request without session returns 401 Unauthorized', async () => {
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
  // PHASE 4: ZOD VALIDATION & ERROR CLASSIFICATION
  // -------------------------------------------------------------
  describe('Phase 4: Client Validation Errors Return HTTP 400 with Details', () => {
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
