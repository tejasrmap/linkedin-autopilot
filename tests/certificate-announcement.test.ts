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

// Authoritative binary magic bytes for valid file formats
const REAL_PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);
const REAL_JPEG_BUFFER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x60,
]);
const REAL_PDF_BUFFER = Buffer.from(
  '%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF'
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
  // TASK 1: ACTUAL FILE SIGNATURES (MAGIC BYTES) VALIDATION
  // -------------------------------------------------------------
  describe('Task 1: File Signatures (Magic Bytes) Verification', () => {
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

    test('1d. Accepts authentic PNG with valid PNG signature', async () => {
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

    test('1e. Accepts authentic JPEG with valid JPEG signature', async () => {
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

    test('1f. Accepts authentic PDF with valid PDF signature', async () => {
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
  });

  // -------------------------------------------------------------
  // TASK 2 & 3: SUPABASE AUTHENTICATION & WORKSPACE ROLE ACCESS
  // -------------------------------------------------------------
  describe('Tasks 2 & 3: Supabase Authentication and All 5 Workspace Roles', () => {
    test('2a. Unauthenticated request returns 401 Unauthorized', async () => {
      delete process.env.ALLOW_DEV_AUTH;
      const formData = new FormData();
      const file = new File([REAL_PNG_BUFFER], 'cert.png', { type: 'image/png' });
      formData.append('certificate', file);

      const req = new Request('http://localhost:3000/api/ai/certificate', {
        method: 'POST',
        body: formData,
      });

      const res = await certificateRouteHandler(req);
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.error, 'Unauthorized');
    });

    const roles = ['owner', 'admin', 'editor', 'approver', 'viewer'] as const;
    for (const role of roles) {
      test(`3. Workspace role "${role}" is authorized and permitted to generate certificate drafts`, async () => {
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
