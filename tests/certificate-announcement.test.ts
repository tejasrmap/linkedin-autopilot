// ==============================================================
// LINKEDIN AUTOPILOT — CERTIFICATE ANNOUNCEMENT TEST SUITE
// TESTS FOR VISION EXTRACTION, VALIDATION, RATE LIMITING,
// REJECTION OF INVENTED METRICS, AND STORAGE SAFETY
// GT INNOX LLP
// ==============================================================

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { POST as certificateRouteHandler } from '../src/app/api/ai/certificate/route';

describe('Certificate Announcement Generator — Full Test Suite', () => {
  let originalGetGenerativeModel: any;

  beforeEach(() => {
    process.env.ALLOW_DEV_AUTH = 'true';
    process.env.MOCK_SUPABASE_FOR_TESTS = 'true';
    process.env.GEMINI_API_KEY = 'test_gemini_api_key_valid';
    process.env.TEST_AUTH_USER_ID = `test-user-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    originalGetGenerativeModel = GoogleGenerativeAI.prototype.getGenerativeModel;
  });

  afterEach(() => {
    GoogleGenerativeAI.prototype.getGenerativeModel = originalGetGenerativeModel;
    delete process.env.TEST_AUTH_ROLE;
    delete process.env.TEST_AUTH_USER_ID;
  });

  // Test 1: Unauthenticated requests
  test('1. Unauthenticated request returns 401 Unauthorized', async () => {
    delete process.env.ALLOW_DEV_AUTH;
    const formData = new FormData();
    const file = new File([Buffer.from('fake image')], 'cert.png', { type: 'image/png' });
    formData.append('certificate', file);

    const req = new Request('http://localhost:3000/api/ai/certificate', {
      method: 'POST',
      body: formData,
    });

    const res = await certificateRouteHandler(req);
    assert.strictEqual(res.status, 401, 'Must reject unauthenticated request with 401');
    const data = await res.json();
    assert.strictEqual(data.error, 'Unauthorized');
  });

  // Test 2: Invalid MIME types
  test('2. Unsupported file MIME type returns 400 Bad Request', async () => {
    process.env.ALLOW_DEV_AUTH = 'true';
    const formData = new FormData();
    const file = new File([Buffer.from('text file')], 'cert.txt', { type: 'text/plain' });
    formData.append('certificate', file);

    const req = new Request('http://localhost:3000/api/ai/certificate', {
      method: 'POST',
      body: formData,
    });

    const res = await certificateRouteHandler(req);
    assert.strictEqual(res.status, 400, 'Must reject text/plain with 400');
    const data = await res.json();
    assert.ok(data.error.includes('Unsupported file'), 'Error message must specify supported formats');
  });

  // Test 3: Oversized files & empty files
  test('3. Oversized file (>10MB) returns 400 Bad Request', async () => {
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
    assert.strictEqual(res.status, 400, 'Must reject >10MB with 400');
    const data = await res.json();
    assert.ok(data.error.includes('between 1 byte and 10 MB'));
  });

  test('3b. Empty file (0 bytes) returns 400 Bad Request', async () => {
    process.env.ALLOW_DEV_AUTH = 'true';
    const formData = new FormData();
    const emptyFile = new File([], 'empty.png', { type: 'image/png' });
    formData.append('certificate', emptyFile);

    const req = new Request('http://localhost:3000/api/ai/certificate', {
      method: 'POST',
      body: formData,
    });

    const res = await certificateRouteHandler(req);
    assert.strictEqual(res.status, 400, 'Must reject 0 byte file with 400');
    const data = await res.json();
    assert.ok(data.error.includes('between 1 byte and 10 MB'));
  });

  // Test 4: Missing Gemini API key
  test('4. Missing Gemini API key returns 503 Service Unavailable', async () => {
    process.env.ALLOW_DEV_AUTH = 'true';
    delete process.env.GEMINI_API_KEY;

    const formData = new FormData();
    const file = new File([Buffer.from('test data')], 'cert.png', { type: 'image/png' });
    formData.append('certificate', file);

    const req = new Request('http://localhost:3000/api/ai/certificate', {
      method: 'POST',
      body: formData,
    });

    const res = await certificateRouteHandler(req);
    assert.strictEqual(res.status, 503, 'Must return 503 when API key is missing');
    const data = await res.json();
    assert.ok(data.error.includes('Gemini API key is not configured'));
  });

  // Test 5: Invalid verification URLs
  test('5. Insecure (HTTP) verification URL returns 400 Bad Request', async () => {
    process.env.ALLOW_DEV_AUTH = 'true';
    const formData = new FormData();
    const file = new File([Buffer.from('test data')], 'cert.png', { type: 'image/png' });
    formData.append('certificate', file);
    formData.append('verificationUrl', 'http://insecure-cert-provider.com/verify/123');

    const req = new Request('http://localhost:3000/api/ai/certificate', {
      method: 'POST',
      body: formData,
    });

    const res = await certificateRouteHandler(req);
    assert.strictEqual(res.status, 400, 'Must reject HTTP URL');
    const data = await res.json();
    assert.ok(data.error.includes('HTTPS'));
  });

  test('5b. Verification URL with embedded credentials returns 400 Bad Request', async () => {
    process.env.ALLOW_DEV_AUTH = 'true';
    const formData = new FormData();
    const file = new File([Buffer.from('test data')], 'cert.png', { type: 'image/png' });
    formData.append('certificate', file);
    formData.append('verificationUrl', 'https://user:password@certs.example.com/badge/1');

    const req = new Request('http://localhost:3000/api/ai/certificate', {
      method: 'POST',
      body: formData,
    });

    const res = await certificateRouteHandler(req);
    assert.strictEqual(res.status, 400, 'Must reject embedded credentials');
    const data = await res.json();
    assert.ok(data.error.includes('embedded credentials'));
  });

  // Test 6: Malformed Gemini JSON response
  test('6. Malformed/non-JSON model response returns 422 Unprocessable Entity', async () => {
    process.env.ALLOW_DEV_AUTH = 'true';
    GoogleGenerativeAI.prototype.getGenerativeModel = () => ({
      generateContent: async () => ({
        response: {
          text: () => 'Sorry, I am an AI and cannot parse this image into JSON.',
        },
      }),
    }) as any;

    const formData = new FormData();
    const file = new File([Buffer.from('valid png data')], 'cert.png', { type: 'image/png' });
    formData.append('certificate', file);

    const req = new Request('http://localhost:3000/api/ai/certificate', {
      method: 'POST',
      body: formData,
    });

    const res = await certificateRouteHandler(req);
    assert.strictEqual(res.status, 422, 'Must return 422 for unparseable output');
    const data = await res.json();
    assert.ok(data.error.includes('could not be reliably read'));
  });

  // Test 7: Missing credential name
  test('7. Model output missing certificate name returns 422 Unprocessable Entity', async () => {
    process.env.ALLOW_DEV_AUTH = 'true';
    GoogleGenerativeAI.prototype.getGenerativeModel = () => ({
      generateContent: async () => ({
        response: {
          text: () => JSON.stringify({
            certificateName: '', // Empty credential name
            issuer: 'Unknown Issuer',
            recipientName: 'Alex',
            announcement: 'I completed something!',
          }),
        },
      }),
    }) as any;

    const formData = new FormData();
    const file = new File([Buffer.from('valid png data')], 'cert.png', { type: 'image/png' });
    formData.append('certificate', file);

    const req = new Request('http://localhost:3000/api/ai/certificate', {
      method: 'POST',
      body: formData,
    });

    const res = await certificateRouteHandler(req);
    assert.strictEqual(res.status, 422, 'Must return 422 when certificateName is missing');
    const data = await res.json();
    assert.ok(data.error.includes('certificate name or announcement could not be extracted confidently'));
  });

  // Test 8: Successful extraction and announcement
  test('8. Valid certificate image returns 200 with structured facts and announcement', async () => {
    process.env.ALLOW_DEV_AUTH = 'true';
    const mockModelOutput = {
      certificateName: 'AWS Certified Solutions Architect – Associate',
      issuer: 'Amazon Web Services',
      recipientName: 'Teja Ganugula',
      issueDate: 'November 2026',
      expiryDate: 'November 2029',
      credentialId: 'AWS-SAA-884920',
      skills: ['AWS Architecture', 'VPC', 'High Availability', 'IAM', 'S3'],
      confidenceNotes: [],
      announcement: 'I am pleased to share that I have earned the AWS Certified Solutions Architect – Associate certification. Looking forward to designing resilient distributed systems.',
    };

    GoogleGenerativeAI.prototype.getGenerativeModel = () => ({
      generateContent: async () => ({
        response: {
          text: () => '```json\n' + JSON.stringify(mockModelOutput) + '\n```',
        },
      }),
    }) as any;

    const formData = new FormData();
    const file = new File([Buffer.from('valid image bytes')], 'aws_cert.png', { type: 'image/png' });
    formData.append('certificate', file);
    formData.append('verificationUrl', 'https://www.credly.com/badges/sample-aws-badge');

    const req = new Request('http://localhost:3000/api/ai/certificate', {
      method: 'POST',
      headers: { 'x-gemini-key': 'user_custom_gemini_key' },
      body: formData,
    });

    const res = await certificateRouteHandler(req);
    assert.strictEqual(res.status, 200, 'Must return 200 for valid extraction');
    const data = await res.json();

    assert.strictEqual(data.certificate.certificateName, 'AWS Certified Solutions Architect – Associate');
    assert.strictEqual(data.certificate.issuer, 'Amazon Web Services');
    assert.strictEqual(data.certificate.credentialId, 'AWS-SAA-884920');
    assert.deepStrictEqual(data.certificate.skills, ['AWS Architecture', 'VPC', 'High Availability', 'IAM', 'S3']);
    assert.strictEqual(data.verificationUrl, 'https://www.credly.com/badges/sample-aws-badge');
    assert.strictEqual(data.verificationStatus, 'user_supplied_unverified');
    assert.strictEqual(data.stored, false, 'Must confirm file was never persisted to storage');
    assert.strictEqual(data.reviewRequired, true, 'Must signal that user review is required');
    assert.ok(data.announcement.length > 50, 'Must provide full announcement draft');
  });

  // Test 9: Rate limiting
  test('9. Exceeding 5 certificate requests per minute returns 429 Too Many Requests', async () => {
    process.env.ALLOW_DEV_AUTH = 'true';
    process.env.TEST_AUTH_USER_ID = 'rate-limit-dedicated-user';
    GoogleGenerativeAI.prototype.getGenerativeModel = () => ({
      generateContent: async () => ({
        response: {
          text: () => JSON.stringify({
            certificateName: 'Test Cert',
            issuer: 'Test Issuer',
            announcement: 'Test announcement',
          }),
        },
      }),
    }) as any;

    const makeCall = async () => {
      const formData = new FormData();
      const file = new File([Buffer.from('bytes')], 'cert.png', { type: 'image/png' });
      formData.append('certificate', file);
      const req = new Request('http://localhost:3000/api/ai/certificate', {
        method: 'POST',
        body: formData,
      });
      return certificateRouteHandler(req);
    };

    let hit429 = false;
    for (let i = 0; i < 7; i++) {
      const res = await makeCall();
      if (res.status === 429) {
        hit429 = true;
        const data = await res.json();
        assert.ok(data.error.includes('Too many certificate drafts'));
        break;
      }
    }
    assert.ok(hit429, 'Rate limiter must enforce 5 requests per minute and return 429');
  });

  // Test 10: No invented scores or unsupported achievements
  test('10. Prompt and response strictly forbid fabricating exam scores or study hours', async () => {
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
    const file = new File([Buffer.from('image')], 'cert.png', { type: 'image/png' });
    formData.append('certificate', file);
    formData.append('verificationUrl', 'https://verify.example.com/cka');

    const req = new Request('http://localhost:3000/api/ai/certificate', {
      method: 'POST',
      body: formData,
    });

    const res = await certificateRouteHandler(req);
    assert.strictEqual(res.status, 200);

    // Verify system prompt constraints
    assert.ok(capturedPrompt.includes('Never invent scores, rankings, study hours, exam results'), 'Prompt must prohibit inventing scores');
    assert.ok(capturedPrompt.includes('You have NOT opened or verified it; never claim otherwise'), 'Prompt must prohibit claiming URL verification');

    const data = await res.json();
    const lowerAnnouncement = data.announcement.toLowerCase();
    assert.strictEqual(lowerAnnouncement.includes('i scored'), false, 'Must not claim score');
    assert.strictEqual(lowerAnnouncement.includes('percentile'), false, 'Must not claim percentile');
    assert.strictEqual(data.verificationStatus, 'user_supplied_unverified', 'Verification status must be unverified');
  });

  // Test 11: Storage safety (Certificate is never stored)
  test('11. Storage safety: Endpoint processes file purely in-memory with stored: false', async () => {
    process.env.ALLOW_DEV_AUTH = 'true';
    GoogleGenerativeAI.prototype.getGenerativeModel = () => ({
      generateContent: async () => ({
        response: {
          text: () => JSON.stringify({
            certificateName: 'CompTIA Security+',
            issuer: 'CompTIA',
            announcement: 'Earned CompTIA Security+.',
          }),
        },
      }),
    }) as any;

    const formData = new FormData();
    const file = new File([Buffer.from('image bytes')], 'cert.png', { type: 'image/png' });
    formData.append('certificate', file);

    const req = new Request('http://localhost:3000/api/ai/certificate', {
      method: 'POST',
      body: formData,
    });

    const res = await certificateRouteHandler(req);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.stored, false, 'Must guarantee stored: false');
  });
});
