import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 60;

const RequestSchema = z.object({
  verificationUrl: z.string().trim().max(2048).optional().default(''),
});

const MAX_CERTIFICATE_BYTES = 10 * 1024 * 1024;
const MIME_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg']);

/**
 * Detects authoritative MIME type from binary magic bytes (file signature).
 * Rejects files whose magic numbers do not match standard PDF, PNG, or JPEG signatures.
 */
function detectFileSignature(bytes: Buffer): 'application/pdf' | 'image/png' | 'image/jpeg' | null {
  if (bytes.length < 3) return null;

  // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  // JPEG magic bytes: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  // PDF magic bytes: %PDF (25 50 44 46)
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  ) {
    return 'application/pdf';
  }

  return null;
}

function isSafeHttpsUrl(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const requestWorkspaceId = request.headers.get('x-workspace-id') || null;
    const auth = await getAuthContext(requestWorkspaceId);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const VALID_WORKSPACE_ROLES = ['owner', 'admin', 'editor', 'approver', 'viewer'] as const;
    if (!VALID_WORKSPACE_ROLES.includes(auth.role as any)) {
      return NextResponse.json({ error: 'Forbidden: Invalid workspace membership' }, { status: 403 });
    }

    const rate = checkRateLimit(`certificate-ai:${auth.workspaceId}:${auth.user.id}`, {
      limit: 5,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json({ error: 'Too many certificate drafts. Please wait a minute and try again.' }, { status: 429 });
    }

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ error: 'Invalid form submission. Upload a certificate file via multipart/form-data.' }, { status: 400 });
    }
    const file = form.get('certificate');
    const verificationUrlValue = form.get('verificationUrl');
    const parsed = RequestSchema.safeParse({
      verificationUrl: typeof verificationUrlValue === 'string' ? verificationUrlValue : '',
    });
    if (!parsed.success) return NextResponse.json({ error: 'Invalid verification URL.' }, { status: 400 });
    const verificationUrl = parsed.data.verificationUrl;

    if (!isSafeHttpsUrl(verificationUrl)) {
      return NextResponse.json({ error: 'Verification links must use HTTPS and must not include embedded credentials.' }, { status: 400 });
    }
    if (!(file instanceof File) || typeof (file as any).arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'Upload a certificate PDF, PNG, or JPG file.' }, { status: 400 });
    }
    if (!MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Unsupported file. Use PDF, PNG, or JPG.' }, { status: 400 });
    }
    if (file.size === 0 || file.size > MAX_CERTIFICATE_BYTES) {
      return NextResponse.json({ error: 'Certificate must be between 1 byte and 10 MB.' }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());

    // Validate true file signature against binary magic bytes
    const detectedMime = detectFileSignature(bytes);
    if (!detectedMime) {
      return NextResponse.json(
        { error: 'Invalid file signature. File content does not match supported PDF, PNG, or JPG formats.' },
        { status: 400 }
      );
    }
    if (detectedMime !== file.type) {
      return NextResponse.json(
        { error: `File content mismatch: declared MIME type "${file.type}" does not match file signature "${detectedMime}".` },
        { status: 400 }
      );
    }

    const apiKey = (request.headers.get('x-gemini-key') || process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key is not configured. Add your key in AI Studio or ask an administrator to configure GEMINI_API_KEY.' }, { status: 503 });
    }
    const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `You extract facts from a user's certificate and draft a LinkedIn announcement.
Return ONLY valid JSON with this exact shape:
{
  "certificateName": "string or empty",
  "issuer": "string or empty",
  "recipientName": "string or empty",
  "issueDate": "string or empty",
  "expiryDate": "string or empty",
  "credentialId": "string or empty",
  "skills": ["only explicitly supported skills"],
  "confidenceNotes": ["uncertain, unreadable, or missing fields"],
  "announcement": "editable LinkedIn announcement"
}
Rules:
- Extract only text/details visible in the uploaded certificate.
- Do not infer that the credential is active, independently verified, accredited, or valid.
- A supplied verification URL is a user-provided reference only. You have NOT opened or verified it; never claim otherwise.
- Never invent scores, rankings, study hours, exam results, dates, personal struggles, or achievements.
- Do not invent a first-person learning journey. Use neutral wording unless the certificate itself supports a fact.
- If recipient name is unclear, leave it empty and avoid addressing the reader by name.
- If a field cannot be read, leave it empty and add a confidence note.
- Keep announcement professional, specific, natural, and concise. Include a placeholder-free draft only from supported details.
User-supplied verification URL (not fetched or verified): ${verificationUrl || 'Not provided'}
Uploaded filename (untrusted label): ${file.name}
`;

    const result = await model.generateContent([
      { text: prompt },
      { inlineData: { mimeType: file.type, data: bytes.toString('base64') } },
    ]);
    const raw = result.response.text().trim();
    let jsonText = raw;
    const codeBlockMatch = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1].trim();
    } else {
      jsonText = jsonText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    }

    let extracted: any;
    try {
      extracted = JSON.parse(jsonText);
    } catch {
      const jsonObjectMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonObjectMatch) {
        try {
          extracted = JSON.parse(jsonObjectMatch[0]);
        } catch {
          // fall through
        }
      }
    }
    if (!extracted || typeof extracted !== 'object') {
      console.error('[Certificate AI] Model returned invalid JSON');
      return NextResponse.json({ error: 'The certificate could not be reliably read. Try a clearer image or PDF.' }, { status: 422 });
    }

    const cleanString = (value: unknown, max = 500) =>
      typeof value === 'string' ? value.trim().slice(0, max) : '';
    const skills = Array.isArray(extracted.skills)
      ? extracted.skills.filter((v: unknown) => typeof v === 'string').slice(0, 20).map((v: string) => v.slice(0, 100))
      : [];
    const confidenceNotes = Array.isArray(extracted.confidenceNotes)
      ? extracted.confidenceNotes.filter((v: unknown) => typeof v === 'string').slice(0, 10).map((v: string) => v.slice(0, 300))
      : [];

    const certificate = {
      certificateName: cleanString(extracted.certificateName),
      issuer: cleanString(extracted.issuer),
      recipientName: cleanString(extracted.recipientName),
      issueDate: cleanString(extracted.issueDate, 100),
      expiryDate: cleanString(extracted.expiryDate, 100),
      credentialId: cleanString(extracted.credentialId, 150),
      skills,
      confidenceNotes,
    };
    const announcement = cleanString(extracted.announcement, 5000);
    if (!certificate.certificateName || !announcement) {
      return NextResponse.json({
        error: 'The certificate name or announcement could not be extracted confidently. Please upload a clearer certificate.',
        certificate,
      }, { status: 422 });
    }

    return NextResponse.json({
      certificate,
      announcement,
      verificationUrl,
      verificationStatus: verificationUrl ? 'user_supplied_unverified' : 'not_provided',
      reviewRequired: true,
      stored: false,
    });
  } catch (error: any) {
    console.error('[Certificate AI Route Error]:', error);
    return NextResponse.json({ error: 'Certificate processing failed. Please try again with a smaller or clearer file.' }, { status: 500 });
  }
}
