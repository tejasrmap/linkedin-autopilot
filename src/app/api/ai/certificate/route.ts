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
    const auth = await getAuthContext();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rate = checkRateLimit(`certificate-ai:${auth.workspaceId}:${auth.user.id}`, {
      limit: 5,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return NextResponse.json({ error: 'Too many certificate drafts. Please wait a minute and try again.' }, { status: 429 });
    }

    const form = await request.formData();
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
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Upload a certificate PDF, PNG, or JPG file.' }, { status: 400 });
    }
    if (!MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Unsupported file. Use PDF, PNG, or JPG.' }, { status: 400 });
    }
    if (file.size === 0 || file.size > MAX_CERTIFICATE_BYTES) {
      return NextResponse.json({ error: 'Certificate must be between 1 byte and 10 MB.' }, { status: 400 });
    }

    const apiKey = (request.headers.get('x-gemini-key') || process.env.GEMINI_API_KEY || '').trim();
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API key is not configured. Add your key in AI Studio or ask an administrator to configure GEMINI_API_KEY.' }, { status: 503 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
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
    const raw = result.response.text().trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    let extracted: any;
    try {
      extracted = JSON.parse(raw);
    } catch {
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
