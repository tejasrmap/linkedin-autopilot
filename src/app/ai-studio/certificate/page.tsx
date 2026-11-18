'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Award, UploadCloud, Sparkles, Copy, ArrowRight, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

type Certificate = {
  certificateName: string; issuer: string; recipientName: string; issueDate: string;
  expiryDate: string; credentialId: string; skills: string[]; confidenceNotes: string[];
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
    if (!file) { toast.error('Choose your certificate PDF or image first.'); return; }
    setBusy(true); setCertificate(null); setDraft('');
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
      toast.success('Draft generated. Check every detail against your certificate.');
    } catch (error: any) { toast.error(error.message || 'Could not process certificate.'); }
    finally { setBusy(false); }
  }

  async function copyDraft() {
    await navigator.clipboard.writeText(draft);
    toast.success('Announcement copied.');
  }

  return (
    <div className="chat-page chat-page-certificate space-y-6">
      <header className="flex items-start gap-3">
        <div className="rounded-xl bg-indigo-500/10 p-3 text-indigo-500"><Award className="w-6 h-6" /></div>
        <div><h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Certificate post</h1>
          <p className="text-sm text-slate-500 mt-1">Turn a certificate into a polished LinkedIn post.</p></div>
      </header>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-4">
        <div>
          <label className="block text-sm font-semibold mb-2">Certificate (PDF, PNG, JPG · max 10 MB)</label>
          <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 p-8 cursor-pointer hover:border-indigo-500">
            <UploadCloud className="w-8 h-8 text-indigo-500" />
            <span className="text-sm font-medium text-center">{file ? file.name : 'Choose your certificate file'}</span>
            <span className="text-xs text-slate-500">Processed in memory; this feature does not save the uploaded file.</span>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
          </label>
        </div>
        <div>
          <label className="block text-sm font-semibold mb-1">Verification URL (optional)</label>
          <input value={verificationUrl} onChange={e => setVerificationUrl(e.target.value)} placeholder="https://credential-provider.example/..." className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm" />
          <p className="text-xs text-slate-500 mt-1">The URL is recorded as user-provided context only; it is not opened or independently verified.</p>
        </div>
        <button onClick={generate} disabled={busy || !file} className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm py-3 flex items-center justify-center gap-2">
          <Sparkles className="w-4 h-4" />{busy ? 'Extracting certificate details…' : 'Generate LinkedIn announcement'}
        </button>
      </section>

      {certificate && <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-3">
        <div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Extracted certificate details</div>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          {([['Credential', certificate.certificateName], ['Issuer', certificate.issuer], ['Recipient', certificate.recipientName], ['Issue date', certificate.issueDate], ['Expiry date', certificate.expiryDate], ['Credential ID', certificate.credentialId]] as const).map(([label, value]) =>
            <div key={label} className="rounded-lg bg-slate-50 dark:bg-slate-900 p-3"><div className="text-xs text-slate-500">{label}</div><div className="font-medium mt-1 break-words">{value || 'Not detected'}</div></div>)}
        </div>
        {certificate.skills.length > 0 && <p className="text-sm"><b>Skills / subjects:</b> {certificate.skills.join(', ')}</p>}
        {certificate.confidenceNotes.length > 0 && <p className="text-sm text-amber-600 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />Please verify: {certificate.confidenceNotes.join('; ')}</p>}
      </section>}

      {draft && <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 space-y-3">
        <div className="flex items-center justify-between"><h2 className="font-semibold">Review and edit your LinkedIn post</h2>
          <button onClick={copyDraft} className="text-sm text-indigo-600 flex items-center gap-1"><Copy className="w-4 h-4" />Copy</button></div>
        <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={12} className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent p-3 text-sm leading-6" />
        <div className="rounded-lg bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">AI extraction is not proof of authenticity. Verify all details and edit the draft before publishing.</div>
        <button onClick={() => router.push('/composer?content=' + encodeURIComponent(draft) + '&fromAi=true')} className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm py-3 flex items-center justify-center gap-2">Continue to LinkedIn composer <ArrowRight className="w-4 h-4" /></button>
      </section>}
    </div>
  );
}
