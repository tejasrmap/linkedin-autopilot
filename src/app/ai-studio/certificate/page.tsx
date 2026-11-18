'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader, ActionButton } from '@/components/magicpath/common';
import { Icon } from '@/components/magicpath/icons';
import { useToast } from '@/components/ui/toast';

type Certificate = {
  certificateName: string;
  issuer: string;
  recipientName: string;
  issueDate: string;
  expiryDate: string;
  credentialId: string;
  skills: string[];
  confidenceNotes: string[];
};

export default function CertificateAnnouncementPage() {
  const router = useRouter();
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [verificationUrl, setVerificationUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [draft, setDraft] = useState('');

  async function generate() {
    if (!file) {
      toast.error('Choose your certificate PDF or image first.');
      return;
    }
    setBusy(true);
    setCertificate(null);
    setDraft('');
    try {
      const form = new FormData();
      form.append('certificate', file);
      form.append('verificationUrl', verificationUrl);
      const headers: Record<string, string> = {};
      const key = localStorage.getItem('gemini_api_key');
      if (key?.trim()) headers['x-gemini-key'] = key.trim();
      const response = await fetch('/api/ai/certificate', { method: 'POST', headers, body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Certificate processing failed.');
      setCertificate(result.certificate);
      setDraft(result.announcement);
      toast.success('Certificate details extracted. Review the draft before publishing.');
    } catch (error: any) {
      toast.error(error.message || 'Could not process certificate.');
    } finally {
      setBusy(false);
    }
  }

  const handleCopy = async () => {
    if (!draft) return;
    await navigator.clipboard.writeText(draft);
    toast.success('Announcement copied to clipboard.');
  };

  const handleContinueToComposer = () => {
    if (!draft) return;
    router.push('/composer?content=' + encodeURIComponent(draft) + '&fromAi=true');
  };

  return (
    <>
      <PageHeader screen="certificate" />

      <div className="certificate-layout">
        <section className="panel certificate-upload-panel">
          <div className="section-title">
            <span className="certificate-icon">
              <Icon name="award" size={19} />
            </span>
            <div>
              <h3>Share a milestone worth celebrating</h3>
              <p>We’ll help you turn the details into a genuine, editable post.</p>
            </div>
          </div>

          <div className="step-line">
            <span className={`step-number ${!certificate && !draft ? 'active' : ''}`}>1</span>
            <span>Upload credential</span>
            <i />
            <span className={`step-number ${certificate && !draft ? 'active' : ''}`}>2</span>
            <span>Review details</span>
            <i />
            <span className={`step-number ${draft ? 'active' : ''}`}>3</span>
            <span>Write post</span>
          </div>

          <label className="field-label">Your certificate</label>
          <label className="certificate-drop">
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <span className="upload-circle">
              <Icon name="upload" size={20} />
            </span>
            <b>{file ? file.name : 'Drop your certificate here'}</b>
            <small>
              {file ? 'Ready to process' : 'or browse files · PDF, PNG or JPG · up to 10 MB'}
            </small>
            <span className="drop-foot">
              <Icon name="shield" size={13} /> Your file is processed securely in memory and isn’t saved to disk.
            </span>
          </label>

          <label className="field-label" htmlFor="verify-url">
            Verification link <span className="optional">OPTIONAL</span>
          </label>
          <input
            id="verify-url"
            className="certificate-url"
            value={verificationUrl}
            onChange={(e) => setVerificationUrl(e.target.value)}
            placeholder="https://credential-provider.example/…"
          />

          <div className="certificate-note">
            <Icon name="info" size={15} />
            <span>
              AI can help organize the details, but always verify the name, issuer, and dates before sharing.
            </span>
          </div>

          <ActionButton disabled={!file || busy} onClick={generate}>
            <Icon name="sparkles" size={15} />{' '}
            {busy ? 'Extracting certificate details…' : 'Extract details'}{' '}
            <Icon name="arrow" size={15} />
          </ActionButton>

          {/* Extracted Certificate Details Card */}
          {certificate && (
            <div
              style={{
                marginTop: '20px',
                padding: '16px',
                borderRadius: '10px',
                border: '1px solid var(--line)',
                background: 'var(--surface-soft)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 600,
                  fontSize: '12px',
                  marginBottom: '12px',
                }}
              >
                <Icon name="check" size={16} /> Extracted certificate details
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '8px',
                  fontSize: '11px',
                }}
              >
                {[
                  ['Credential', certificate.certificateName],
                  ['Issuer', certificate.issuer],
                  ['Recipient', certificate.recipientName],
                  ['Issue date', certificate.issueDate],
                  ['Expiry date', certificate.expiryDate],
                  ['Credential ID', certificate.credentialId],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      background: 'var(--surface)',
                      padding: '8px 10px',
                      borderRadius: '7px',
                      border: '1px solid var(--line)',
                    }}
                  >
                    <div style={{ color: 'var(--muted)', fontSize: '9px', fontWeight: 600 }}>
                      {label}
                    </div>
                    <div style={{ fontWeight: 600, marginTop: '2px' }}>
                      {value || 'Not detected'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Draft Review & Continue to Composer */}
          {draft && (
            <div style={{ marginTop: '20px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                }}
              >
                <label className="field-label" style={{ margin: 0 }}>
                  Generated announcement post
                </label>
                <button
                  type="button"
                  className="text-button"
                  onClick={handleCopy}
                >
                  <Icon name="copy" size={14} /> Copy
                </button>
              </div>

              <textarea
                className="output-text"
                rows={8}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />

              <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <ActionButton onClick={handleContinueToComposer}>
                  Continue to LinkedIn composer <Icon name="arrow" size={15} />
                </ActionButton>
              </div>
            </div>
          )}
        </section>

        <aside className="panel certificate-side">
          <span className="certificate-side-mark">
            <Icon name="award" size={19} />
          </span>
          <h3>A post that still sounds like you</h3>
          <p>
            Keep the story personal. Share what you learned, why this milestone matters, or who helped you get here.
          </p>

          <div className="certificate-example">
            <span className="example-label">A GOOD START</span>
            <p>
              “I’m excited to share that I’ve completed… The most useful thing I learned along the way was…”
            </p>
          </div>

          <div className="privacy-small">
            <Icon name="shield" size={14} /> You review every detail before a post is created.
          </div>
        </aside>
      </div>
    </>
  );
}
