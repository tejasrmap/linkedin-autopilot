import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield, FileText, CheckCircle2 } from 'lucide-react';

export const metadata = {
  title: 'Terms of Service | LinkedIn Autopilot by GT InnoX LLP',
  description: 'Terms of Service and Customer Agreement for LinkedIn Autopilot by GT InnoX LLP.',
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-12 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
          <span className="text-xs text-slate-500 font-mono">Effective: November 2026</span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 sm:p-12 shadow-sm space-y-8">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                <FileText className="w-6 h-6" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Terms of Service
              </h1>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              GT InnoX LLP · LinkedIn Autopilot Commercial Agreement
            </p>
          </div>

          <section className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">1. Acceptance of Terms</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              By accessing, registering for, or using the LinkedIn Autopilot software-as-a-service application (“Service”), provided by GT InnoX LLP (“Company”, “we”, “us”, or “our”), you (“Customer”, “User”, or “You”) agree to be legally bound by these Terms of Service. If you are entering into this agreement on behalf of a company or other legal entity, you represent that you have the authority to bind such entity.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">2. Permitted Use & Official LinkedIn API Compliance</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              LinkedIn Autopilot operates strictly via the official LinkedIn REST APIs (Share on LinkedIn and Community Management APIs). Users must:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li>Adhere to LinkedIn’s Official Developer Agreement, User Agreement, and Community Guidelines.</li>
              <li>Refrain from using the Service to post abusive, defamatory, deceptive, illegal, or spam content.</li>
              <li>Never attempt scraping, undocumented automation, headless browser browser-hijacking, or bypassing official LinkedIn rate limits.</li>
              <li>Acknowledge that company page publishing requires verified Administrator or Content Admin permissions granted under LinkedIn Page Roles.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">3. User Accounts & Multi-Tenant Workspaces</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Account credentials must remain confidential. Workspaces are protected under Row Level Security (RLS). You are solely responsible for activities occurring under your credentials and workspaces. GT InnoX LLP reserves the right to suspend or terminate accounts that breach security protocols or violate third-party intellectual property.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">4. Artificial Intelligence Generation (Google Gemini)</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              The AI Content Studio utilizes Google Gemini LLM technology to facilitate drafting, hook formulation, and calendar generation. While the AI is trained for professional engagement, Customer retains full ownership, responsibility, and editorial review of all content before it is scheduled or published to LinkedIn.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">5. Subscriptions, Payments & Billing</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Paid plans (Starter, Pro, Enterprise) are billed on a recurring monthly or annual basis via Stripe. Cancellations take effect at the conclusion of the active billing cycle. GT InnoX LLP does not store complete credit card details on its servers; all payment transactions are tokenized and processed securely by Stripe.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">6. Service Availability & Disclaimers</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              The Service is provided on an “as is” and “as available” basis. While GT InnoX LLP strives for 99.9% uptime, we are not liable for interruptions resulting from upstream third-party API outages (including LinkedIn or Google Gemini maintenance or downtime).
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">7. Contact Information</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              For legal inquiries, dispute resolutions, or enterprise agreements, contact:
            </p>
            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl text-xs space-y-1 font-mono text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
              <p><strong>Entity:</strong> GT InnoX LLP</p>
              <p><strong>Product:</strong> LinkedIn Autopilot</p>
              <p><strong>Support Email:</strong> support@gtinnox.in / tejag.vijay@gmail.com</p>
              <p><strong>Website:</strong> https://autopilot.gtinnox.in</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
