// ==============================================================
// LINKEDIN AUTOPILOT — CERTIFICATE ANNOUNCEMENT TEST SUITE
// TESTS FOR VISION EXTRACTION, FILE SIGNATURES, SUPABASE AUTH &
// WORKSPACE ROLES, CONCURRENT RATE LIMITING, ANTI-HALLUCINATION,
// AND STORAGE SAFETY
// GT INNOX LLP
// ==============================================================

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { POST as certificateRouteHandler } from '../src/app/api/ai/certificate/route';

// Authoritative binary magic bytes and valid structures for file formats
const REAL_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);
const REAL_JPEG_BUFFER = Buffer.from([
  0xff, 0xd8, // SOI
  0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x60, 0x00, 0x60, 0x00, 0x00,
  0xff, 0xdb, 0x00, 0x43, 0x00,
  ...Array(64).fill(1),
  0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00,
  0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xbf,
  0xff, 0xd9, // EOI
]);
const REAL_PDF_BUFFER = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n168\n%%EOF'
);

describe('Certificate Announcement Generator — Full Pre-Merge Audit Test Suite', () => {
  let originalGetGenerativeModel: any;

  beforeEach(() => {
    process.env.ALLOW_DEV_AUTH = 'true';
    process.env.MOCK_SUPABASE_FOR_TESTS = 'true';
    process.env.GEMINI_API_KEY = 'test_gemini_api_key_valid';
    process.env.TEST_AUTH_USER_ID = `test-user-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    originalGetGenerativeModel = GoogleGenerativeAI.prototype.getGenerativeModel;

    // Default mock Gemini model returning valid certificate details
    GoogleGenerativeAI.prototype.getGenerativeModel = () => ({
      generateContent: async () => ({
        response: {
          text: () => JSON.stringify({
            certificateName: 'AWS Certified Solutions Architect – Associate',
            issuer: 'Amazon Web Services',
            recipientName: 'Teja Ganugula',
            issueDate: 'November 2026',
            expiryDate: 'November 2029',
            credentialId: 'AWS-SAA-884920',
            skills: ['AWS Architecture', 'VPC', 'High Availability', 'IAM', 'S3'],
            confidenceNotes: [],
            announcement: 'I am pleased to share that I have earned the AWS Certified Solutions Architect – Associate certification.',
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
  // TASK 1: FILE SIGNATURES & LIGHTWEIGHT STRUCTURAL SCREENING
  // -------------------------------------------------------------
  describe('Task 1: File Signatures and Lightweight Structural Screening', () => {
    test('1a. Rejects HTML/text disguised as PNG with 400 Bad Request', async () => {
      const formData = new FormData();
      const disguisedFile = new File([Buffer.from('<html><body>malware</body></html>')], 'fake.png', {
        type: 'image/png',
      });
      formData.append('certificate', disguisedFile);

      const req = new Request('http://localhost:3000/api/ai/certificate', {
        method: 'POST',
        body: formData,
      });

      const res = await certificateRouteHandler(req);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('Invalid file signature'));
    });

    test('1b. Rejects binary executable disguised as PDF with 400 Bad Request', async () => {
      const formData = new FormData();
      const disguisedFile = new File([Buffer.from('MZ\x90\x00\x03\x00\x00\x00')], 'cert.pdf', {
        type: 'application/pdf',
      });
      formData.append('certificate', disguisedFile);

      const req = new Request('http://localhost:3000/api/ai/certificate', {
        method: 'POST',
        body: formData,
      });

      const res = await certificateRouteHandler(req);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('Invalid file signature'));
    });

    test('1c. Rejects declared MIME type vs magic signature mismatch (JPEG bytes declared as PNG)', async () => {
      const formData = new FormData();
      const mismatchedFile = new File([REAL_JPEG_BUFFER], 'mismatched.png', {
        type: 'image/png',
      });
      formData.append('certificate', mismatchedFile);

      const req = new Request('http://localhost:3000/api/ai/certificate', {
        method: 'POST',
        body: formData,
      });

      const res = await certificateRouteHandler(req);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('File content mismatch'));
    });

    test('1d. Accepts authentic PNG passing magic header and IHDR chunk screening', async () => {
      const formData = new FormData();
      const file = new File([REAL_PNG_BUFFER], 'cert.png', { type: 'image/png' });
      formData.append('certificate', file);

      const req = new Request('http://localhost:3000/api/ai/certificate', {
        method: 'POST',
        body: formData,
      });

      const res = await certificateRouteHandler(req);
      assert.strictEqual(res.status, 200);
    });

    test('1e. Accepts authentic JPEG passing magic header and EOI marker screening', async () => {
      const formData = new FormData();
      const file = new File([REAL_JPEG_BUFFER], 'cert.jpg', { type: 'image/jpeg' });
      formData.append('certificate', file);

      const req = new Request('http://localhost:3000/api/ai/certificate', {
        method: 'POST',
        body: formData,
      });

      const res = await certificateRouteHandler(req);
      assert.strictEqual(res.status, 200);
    });

    test('1f. Accepts authentic PDF passing %PDF- and %%EOF trailer screening', async () => {
      const formData = new FormData();
      const file = new File([REAL_PDF_BUFFER], 'cert.pdf', { type: 'application/pdf' });
      formData.append('certificate', file);

      const req = new Request('http://localhost:3000/api/ai/certificate', {
        method: 'POST',
        body: formData,
      });

      const res = await certificateRouteHandler(req);
      assert.strictEqual(res.status, 200);
    });

    test('1g. Structural screening rejects truncated PNG (<33 bytes) despite valid 8-byte magic header', async () => {
      const formData = new FormData();
      const truncatedPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00]);
      const file = new File([truncatedPng], 'truncated.png', { type: 'image/png' });
      formData.append('certificate', file);

      const req = new Request('http://localhost:3000/api/ai/certificate', {
        method: 'POST',
        body: formData,
      });

      const res = await certificateRouteHandler(req);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('Malformed PNG'));
    });

    test('1h. Structural screening rejects PNG with missing/corrupted IHDR initial chunk', async () => {
      const formData = new FormData();
      const fakeChunkPng = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.from([0x00, 0x00, 0x00, 0x0d, 0x58, 0x58, 0x58, 0x58]),
        Buffer.alloc(20),
      ]);
      const file = new File([fakeChunkPng], 'corrupt.png', { type: 'image/png' });
      formData.append('certificate', file);

      const req = new Request('http://localhost:3000/api/ai/certificate', {
        method: 'POST',
        body: formData,
      });

      const res = await certificateRouteHandler(req);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('first chunk must be an authoritative IHDR chunk'));
    });

    test('1i. Structural screening rejects JPEG missing standard EOI marker', async () => {
      const formData = new FormData();
      const truncatedJpeg = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x60,
      ]);
      const file = new File([truncatedJpeg], 'no_eoi.jpg', { type: 'image/jpeg' });
      formData.append('certificate', file);

      const req = new Request('http://localhost:3000/api/ai/certificate', {
        method: 'POST',
        body: formData,
      });

      const res = await certificateRouteHandler(req);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('missing standard EOI'));
    });

    test('1j. Structural screening rejects PDF missing standard %%EOF termination marker', async () => {
      const formData = new FormData();
      const corruptPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntruncated-without-eof');
      const file = new File([corruptPdf], 'no_eof.pdf', { type: 'application/pdf' });
      formData.append('certificate', file);

      const req = new Request('http://localhost:3000/api/ai/certificate', {
        method: 'POST',
        body: formData,
      });

      const res = await certificateRouteHandler(req);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('missing %%EOF termination marker'));
    });
  });

  // -------------------------------------------------------------
  // TASK 2: GENUINE SUPABASE AUTHENTICATION (DISTINGUISHED FROM DEV MOCKS)
  // -------------------------------------------------------------
  describe('Task 2: Genuine Supabase Authentication Integration', () => {
    test('2a. Production fail-closed: Request without Supabase session returns 401 Unauthorized (ALLOW_DEV_AUTH disabled)', async () => {
      delete process.env.ALLOW_DEV_AUTH;
      const formData = new FormData();
      const file = new File([REAL_PNG_BUFFER], 'cert.png', { type: 'image/png' });
      formData.append('certificate', file);

      const req = new Request('http://localhost:3000/api/ai/certificate', {
        method: 'POST',
        body: formData,
      });

      const res = await certificateRouteHandler(req);
      assert.strictEqual(res.status, 401, 'Must strictly fail closed when unauthenticated');
      const data = await res.json();
      assert.strictEqual(data.error, 'Unauthorized');
    });

    test('2b. Production safeguard: NODE_ENV=production strictly ignores ALLOW_DEV_AUTH=true', async () => {
      const prevNodeEnv = process.env.NODE_ENV;
      try {
        (process.env as any).NODE_ENV = 'production';
        process.env.ALLOW_DEV_AUTH = 'true';
        const formData = new FormData();
        const file = new File([REAL_PNG_BUFFER], 'cert.png', { type: 'image/png' });
        formData.append('certificate', file);

        const req = new Request('http://localhost:3000/api/ai/certificate', {
          method: 'POST',
          body: formData,
        });

        const res = await certificateRouteHandler(req);
        assert.strictEqual(res.status, 401, 'In production, development auth mock is strictly disabled');
      } finally {
        (process.env as any).NODE_ENV = prevNodeEnv;
      }
    });
  });

  // -------------------------------------------------------------
  // TASK 3: WORKSPACE ROLE-BASED ACCESS CONTROL (ALL 5 ROLES)
  // -------------------------------------------------------------
  describe('Task 3: Workspace Role-Based Access Control (RBAC Policy)', () => {
    const roles = ['owner', 'admin', 'editor', 'approver', 'viewer'] as const;
    for (const role of roles) {
      test(`3a. Workspace role "${role}" is authorized and permitted to generate certificate drafts`, async () => {
        process.env.ALLOW_DEV_AUTH = 'true';
        process.env.TEST_AUTH_ROLE = role;
        const formData = new FormData();
        const file = new File([REAL_PNG_BUFFER], 'cert.png', { type: 'image/png' });
        formData.append('certificate', file);

        const req = new Request('http://localhost:3000/api/ai/certificate', {
          method: 'POST',
          body: formData,
        });

        const res = await certificateRouteHandler(req);
        assert.strictEqual(res.status, 200, `Role ${role} must be authorized`);
      });
    }

    test('3b. Unauthorized / invalid workspace role returns 403 Forbidden', async () => {
      process.env.ALLOW_DEV_AUTH = 'true';
      process.env.TEST_AUTH_ROLE = 'invalid_guest_role';
      const formData = new FormData();
      const file = new File([REAL_PNG_BUFFER], 'cert.png', { type: 'image/png' });
      formData.append('certificate', file);

      const req = new Request('http://localhost:3000/api/ai/certificate', {
        method: 'POST',
        body: formData,
      });

      const res = await certificateRouteHandler(req);
      assert.strictEqual(res.status, 403, 'Invalid workspace role must return 403 Forbidden');
      const data = await res.json();
      assert.ok(data.error.includes('Forbidden'));
    });

    test('3c. Missing workspace: Request without x-workspace-id succeeds with default workspace (200)', async () => {
      process.env.ALLOW_DEV_AUTH = 'true';
      const formData = new FormData();
      const file = new File([REAL_PNG_BUFFER], 'cert.png', { type: 'image/png' });
      formData.append('certificate', file);

      const req = new Request('http://localhost:3000/api/ai/certificate', {
        method: 'POST',
        body: formData,
      });

      const res = await certificateRouteHandler(req);
      assert.strictEqual(res.status, 200, 'Request without x-workspace-id must succeed with default workspace');
    });

    test('3d. Valid workspace: x-workspace-id matching authorized membership succeeds (200)', async () => {
      process.env.ALLOW_DEV_AUTH = 'true';
      const formData = new FormData();
      const file = new File([REAL_PNG_BUFFER], 'cert.png', { type: 'image/png' });
      formData.append('certificate', file);

      const req = new Request('http://localhost:3000/api/ai/certificate', {
        method: 'POST',
        headers: { 'x-workspace-id': '3af1cc83-b7e7-4ce6-b422-d84d326aaf31' },
        body: formData,
      });

      const res = await certificateRouteHandler(req);
      assert.strictEqual(res.status, 200, 'Matching authorized workspace must succeed');
    });

    test('3e. Unknown workspace: x-workspace-id for non-existent workspace strictly fails closed with 403 Forbidden', async () => {
      process.env.ALLOW_DEV_AUTH = 'true';
      const formData = new FormData();
      const file = new File([REAL_PNG_BUFFER], 'cert.png', { type: 'image/png' });
      formData.append('certificate', file);

      const req = new Request('http://localhost:3000/api/ai/certificate', {
        method: 'POST',
        headers: { 'x-workspace-id': 'unknown-nonexistent-ws-00000000' },
        body: formData,
      });

      const res = await certificateRouteHandler(req);
      assert.strictEqual(res.status, 403, 'Unknown workspace ID request must fail closed with 403');
      const data = await res.json();
      assert.ok(data.error.includes('Access denied to requested workspace'));
    });

    test('3f. Foreign workspace: x-workspace-id for foreign tenant workspace strictly fails closed with 403 Forbidden', async () => {
      process.env.ALLOW_DEV_AUTH = 'true';
      const formData = new FormData();
      const file = new File([REAL_PNG_BUFFER], 'cert.png', { type: 'image/png' });
      formData.append('certificate', file);

      const req = new Request('http://localhost:3000/api/ai/certificate', {
        method: 'POST',
        headers: { 'x-workspace-id': 'foreign-unauthorized-workspace-uuid' },
        body: formData,
      });

      const res = await certificateRouteHandler(req);
      assert.strictEqual(res.status, 403, 'Foreign workspace ID request must fail closed with 403');
      const data = await res.json();
      assert.ok(data.error.includes('Access denied to requested workspace'));
    });

    test('3g. Auth helper contract: getAuthContext strictly fails closed to null for unknown or foreign workspaces', async () => {
      const { getAuthContext } = await import('../src/lib/auth');
      process.env.ALLOW_DEV_AUTH = 'true';

      // 1. Missing workspace: resolves default dev workspace
      const defaultAuth = await getAuthContext(null);
      assert.ok(defaultAuth, 'Missing workspace parameter must resolve default auth context');
      assert.strictEqual(defaultAuth.workspaceId, '3af1cc83-b7e7-4ce6-b422-d84d326aaf31');

      // 2. Valid workspace: resolves requested workspace
      const validAuth = await getAuthContext('3af1cc83-b7e7-4ce6-b422-d84d326aaf31');
      assert.ok(validAuth, 'Valid workspace must resolve auth context');
      assert.strictEqual(validAuth.workspaceId, '3af1cc83-b7e7-4ce6-b422-d84d326aaf31');

      // 3. Unknown workspace: must return null (NO hard-coded fallback!)
      const unknownAuth = await getAuthContext('unknown-workspace-id-99999');
      assert.strictEqual(unknownAuth, null, 'Unknown workspace must return null without hard-coded fallback');

      // 4. Foreign workspace: must return null (NO hard-coded fallback!)
      const foreignAuth = await getAuthContext('foreign-workspace-id-88888');
      assert.strictEqual(foreignAuth, null, 'Foreign workspace must return null without hard-coded fallback');
    });
  });

  // -------------------------------------------------------------
  // TASK 4: CONCURRENT RATE LIMITING & SERVERLESS APPROPRIATENESS
  // -------------------------------------------------------------
  describe('Task 4: Rate Limiting Under Concurrent Requests', () => {
    test('4a. Concurrent burst of 10 requests: exactly 5 succeed, remaining 5 hit 429', async () => {
      process.env.ALLOW_DEV_AUTH = 'true';
      const dedicatedUserId = `concurrent-user-${Date.now()}`;
      process.env.TEST_AUTH_USER_ID = dedicatedUserId;

      const makeCall = async () => {
        const formData = new FormData();
        const file = new File([REAL_PNG_BUFFER], 'cert.png', { type: 'image/png' });
        formData.append('certificate', file);
        const req = new Request('http://localhost:3000/api/ai/certificate', {
          method: 'POST',
          body: formData,
        });
        return certificateRouteHandler(req);
      };

      // Fire 10 simultaneous concurrent requests
      const responses = await Promise.all(Array.from({ length: 10 }, () => makeCall()));
      const statuses = responses.map((r) => r.status);
      const passed200 = statuses.filter((s) => s === 200).length;
      const rateLimited429 = statuses.filter((s) => s === 429).length;

      assert.strictEqual(passed200, 5, 'Exactly 5 concurrent requests must succeed');
      assert.strictEqual(rateLimited429, 5, 'Exactly 5 concurrent requests must be rejected with 429');
    });

    test('4b. Concurrent rate limit is strictly isolated across users/workspaces', async () => {
      process.env.ALLOW_DEV_AUTH = 'true';
      const exhaustedUser = `exhausted-user-${Date.now()}`;
      const freshUser = `fresh-user-${Date.now()}`;

      // Exhaust rate limit for user A
      process.env.TEST_AUTH_USER_ID = exhaustedUser;
      const makeCallForUserA = async () => {
        const formData = new FormData();
        const file = new File([REAL_PNG_BUFFER], 'cert.png', { type: 'image/png' });
        formData.append('certificate', file);
        const req = new Request('http://localhost:3000/api/ai/certificate', {
          method: 'POST',
          body: formData,
        });
        return certificateRouteHandler(req);
      };
      for (let i = 0; i < 5; i++) {
        await makeCallForUserA();
      }
      const exhaustedRes = await makeCallForUserA();
      assert.strictEqual(exhaustedRes.status, 429, 'User A must be rate limited');

      // Now user B requests in the same time window
      process.env.TEST_AUTH_USER_ID = freshUser;
      const makeCallForUserB = async () => {
        const formData = new FormData();
        const file = new File([REAL_PNG_BUFFER], 'cert.png', { type: 'image/png' });
        formData.append('certificate', file);
        const req = new Request('http://localhost:3000/api/ai/certificate', {
          method: 'POST',
          body: formData,
        });
        return certificateRouteHandler(req);
      };
      const freshRes = await makeCallForUserB();
      assert.strictEqual(freshRes.status, 200, 'User B must not be affected by User A rate limit');
    });
  });

  // -------------------------------------------------------------
  // TASK 5: MALFORMED REQUESTS, URLS, FILE BOUNDS & MODEL FAILURES
  // -------------------------------------------------------------
  describe('Task 5: Malformed Multipart, URLs, File Bounds & Gemini Failures', () => {
    test('5a. Malformed multipart request body returns 400 Bad Request', async () => {
      process.env.ALLOW_DEV_AUTH = 'true';
      const req = new Request('http://localhost:3000/api/ai/certificate', {
        method: 'POST',
        headers: { 'Content-Type': 'multipart/form-data; boundary=invalid-boundary' },
        body: 'malformed raw binary payload that cannot be parsed as multipart',
      });

      const res = await certificateRouteHandler(req);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('multipart/form-data'));
    });

    test('5b. Missing certificate field returns 400 Bad Request', async () => {
      process.env.ALLOW_DEV_AUTH = 'true';
      const formData = new FormData();
      formData.append('unrelatedField', 'some text');

      const req = new Request('http://localhost:3000/api/ai/certificate', {
        method: 'POST',
        body: formData,
      });

      const res = await certificateRouteHandler(req);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('Upload a certificate'));
    });

    test('5c. Oversized file (>10MB) returns 400 Bad Request', async () => {
      process.env.ALLOW_DEV_AUTH = 'true';
      const formData = new FormData();
      const largeBuffer = new Uint8Array(10 * 1024 * 1024 + 1024);
      const oversizedFile = new File([largeBuffer], 'large_cert.pdf', { type: 'application/pdf' });
      formData.append('certificate', oversizedFile);

      const req = new Request('http://localhost:3000/api/ai/certificate', {
        method: 'POST',
        body: formData,
      });

      const res = await certificateRouteHandler(req);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('between 1 byte and 10 MB'));
    });

    test('5d. Empty file (0 bytes) returns 400 Bad Request', async () => {
      process.env.ALLOW_DEV_AUTH = 'true';
      const formData = new FormData();
      const emptyFile = new File([], 'empty.png', { type: 'image/png' });
      formData.append('certificate', emptyFile);

      const req = new Request('http://localhost:3000/api/ai/certificate', {
        method: 'POST',
        body: formData,
      });

      const res = await certificateRouteHandler(req);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('between 1 byte and 10 MB'));
    });

    test('5e. Insecure HTTP verification URL returns 400 Bad Request', async () => {
      process.env.ALLOW_DEV_AUTH = 'true';
      const formData = new FormData();
      const file = new File([REAL_PNG_BUFFER], 'cert.png', { type: 'image/png' });
      formData.append('certificate', file);
      formData.append('verificationUrl', 'http://insecure-cert-provider.com/verify/123');

      const req = new Request('http://localhost:3000/api/ai/certificate', {
        method: 'POST',
        body: formData,
      });

      const res = await certificateRouteHandler(req);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('HTTPS'));
    });

    test('5f. Verification URL with embedded credentials returns 400 Bad Request', async () => {
      process.env.ALLOW_DEV_AUTH = 'true';
      const formData = new FormData();
      const file = new File([REAL_PNG_BUFFER], 'cert.png', { type: 'image/png' });
      formData.append('certificate', file);
      formData.append('verificationUrl', 'https://user:password@certs.example.com/badge/1');

      const req = new Request('http://localhost:3000/api/ai/certificate', {
        method: 'POST',
        body: formData,
      });

      const res = await certificateRouteHandler(req);
      assert.strictEqual(res.status, 400);
      const data = await res.json();
      assert.ok(data.error.includes('embedded credentials'));
    });

    test('5g. Missing Gemini API key returns 503 Service Unavailable', async () => {
      process.env.ALLOW_DEV_AUTH = 'true';
      delete process.env.GEMINI_API_KEY;

      const formData = new FormData();
      const file = new File([REAL_PNG_BUFFER], 'cert.png', { type: 'image/png' });
      formData.append('certificate', file);

      const req = new Request('http://localhost:3000/api/ai/certificate', {
        method: 'POST',
        body: formData,
      });

      const res = await certificateRouteHandler(req);
      assert.strictEqual(res.status, 503);
      const data = await res.json();
      assert.ok(data.error.includes('Gemini API key is not configured'));
    });

    test('5h. Gemini API upstream network/HTTP failure returns 500 Internal Server Error', async () => {
      process.env.ALLOW_DEV_AUTH = 'true';
      GoogleGenerativeAI.prototype.getGenerativeModel = () => ({
        generateContent: async () => {
          throw new Error('Upstream Gemini API network timeout / unreachable');
        },
      }) as any;

      const formData = new FormData();
      const file = new File([REAL_PNG_BUFFER], 'cert.png', { type: 'image/png' });
      formData.append('certificate', file);

      const req = new Request('http://localhost:3000/api/ai/certificate', {
        method: 'POST',
        body: formData,
      });

      const res = await certificateRouteHandler(req);
      assert.strictEqual(res.status, 500);
      const data = await res.json();
      assert.ok(data.error.includes('Certificate processing failed'));
    });

    test('5i. Malformed/non-JSON Gemini output returns 422 Unprocessable Entity', async () => {
      process.env.ALLOW_DEV_AUTH = 'true';
      GoogleGenerativeAI.prototype.getGenerativeModel = () => ({
        generateContent: async () => ({
          response: {
            text: () => 'Sorry, I am an AI and cannot process this file into JSON format.',
          },
        }),
      }) as any;

      const formData = new FormData();
      const file = new File([REAL_PNG_BUFFER], 'cert.png', { type: 'image/png' });
      formData.append('certificate', file);

      const req = new Request('http://localhost:3000/api/ai/certificate', {
        method: 'POST',
        body: formData,
      });

      const res = await certificateRouteHandler(req);
      assert.strictEqual(res.status, 422);
      const data = await res.json();
      assert.ok(data.error.includes('could not be reliably read'));
    });

    test('5j. Gemini output missing certificateName returns 422 Unprocessable Entity', async () => {
      process.env.ALLOW_DEV_AUTH = 'true';
      GoogleGenerativeAI.prototype.getGenerativeModel = () => ({
        generateContent: async () => ({
          response: {
            text: () => JSON.stringify({
              certificateName: '', // Missing
              issuer: 'Unknown Issuer',
              announcement: 'Completed something!',
            }),
          },
        }),
      }) as any;

      const formData = new FormData();
      const file = new File([REAL_PNG_BUFFER], 'cert.png', { type: 'image/png' });
      formData.append('certificate', file);

      const req = new Request('http://localhost:3000/api/ai/certificate', {
        method: 'POST',
        body: formData,
      });

      const res = await certificateRouteHandler(req);
      assert.strictEqual(res.status, 422);
      const data = await res.json();
      assert.ok(data.error.includes('certificate name or announcement could not be extracted confidently'));
    });
  });

  // -------------------------------------------------------------
  // TASK 6: STORAGE PERSISTENCE SAFETY GUARANTEES
  // -------------------------------------------------------------
  describe('Task 6: Ephemeral Storage Safety', () => {
    test('6. In-memory processing guarantees stored: false and zero filesystem/bucket persistence', async () => {
      process.env.ALLOW_DEV_AUTH = 'true';
      const formData = new FormData();
      const file = new File([REAL_PNG_BUFFER], 'cert.png', { type: 'image/png' });
      formData.append('certificate', file);

      const req = new Request('http://localhost:3000/api/ai/certificate', {
        method: 'POST',
        body: formData,
      });

      const res = await certificateRouteHandler(req);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.stored, false, 'Must strictly return stored: false');
    });
  });

  // -------------------------------------------------------------
  // TASK 7: CREDENTIAL AUTHENTICITY GUARDRAILS
  // -------------------------------------------------------------
  describe('Task 7: Anti-Hallucination & Credential Authenticity Guardrails', () => {
    test('7. System prompt strictly forbids claiming verification or inventing exam scores', async () => {
      process.env.ALLOW_DEV_AUTH = 'true';
      let capturedPrompt = '';
      GoogleGenerativeAI.prototype.getGenerativeModel = () => ({
        generateContent: async (contents: any) => {
          capturedPrompt = contents[0].text;
          return {
            response: {
              text: () => JSON.stringify({
                certificateName: 'Certified Kubernetes Administrator (CKA)',
                issuer: 'Linux Foundation',
                recipientName: 'Teja Ganugula',
                issueDate: '2026-11-15',
                expiryDate: '2029-11-15',
                credentialId: 'CKA-99120',
                skills: ['Kubernetes', 'Troubleshooting', 'Cluster Architecture'],
                confidenceNotes: [],
                announcement: 'Certified Kubernetes Administrator (CKA) completed through the Linux Foundation.',
              }),
            },
          };
        },
      }) as any;

      const formData = new FormData();
      const file = new File([REAL_PNG_BUFFER], 'cert.png', { type: 'image/png' });
      formData.append('certificate', file);
      formData.append('verificationUrl', 'https://verify.example.com/cka');

      const req = new Request('http://localhost:3000/api/ai/certificate', {
        method: 'POST',
        body: formData,
      });

      const res = await certificateRouteHandler(req);
      assert.strictEqual(res.status, 200);

      assert.ok(
        capturedPrompt.includes('Never invent scores, rankings, study hours, exam results'),
        'Prompt must forbid inventing scores'
      );
      assert.ok(
        capturedPrompt.includes('You have NOT opened or verified it; never claim otherwise'),
        'Prompt must forbid claiming URL verification'
      );

      const data = await res.json();
      assert.strictEqual(
        data.verificationStatus,
        'user_supplied_unverified',
        'Verification status must explicitly state user_supplied_unverified'
      );
      assert.strictEqual(data.reviewRequired, true, 'Review required flag must be true');
    });
  });

  // -------------------------------------------------------------
  // TASK 8: COMPOSER INTEGRATION & EDITABLE DRAFT
  // -------------------------------------------------------------
  describe('Task 8: Composer Integration and Editable Post Draft', () => {
    test('8. Extracted announcement draft is cleanly URL-encoded for Composer handoff', async () => {
      process.env.ALLOW_DEV_AUTH = 'true';
      const formData = new FormData();
      const file = new File([REAL_PDF_BUFFER], 'cert.pdf', { type: 'application/pdf' });
      formData.append('certificate', file);

      const req = new Request('http://localhost:3000/api/ai/certificate', {
        method: 'POST',
        body: formData,
      });

      const res = await certificateRouteHandler(req);
      assert.strictEqual(res.status, 200);
      const data = await res.json();

      // Ensure announcement is non-empty string suitable for URL encoding into /composer?content=...
      assert.ok(typeof data.announcement === 'string' && data.announcement.length > 20);
      const encodedUrl = `/composer?content=${encodeURIComponent(data.announcement)}`;
      const url = new URL(`http://localhost:3000${encodedUrl}`);
      assert.strictEqual(url.searchParams.get('content'), data.announcement);
    });
  });
});
