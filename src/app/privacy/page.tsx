import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield, Lock, Eye, Database } from 'lucide-react';

export const metadata = {
  title: 'Privacy Policy | LinkedIn Autopilot by GT InnoX LLP',
  description: 'Privacy Policy and Data Protection standards for LinkedIn Autopilot by GT InnoX LLP.',
};

export default function PrivacyPolicyPage() {
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
          <span className="text-xs text-slate-500 font-mono">Last Updated: November 2026</span>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 sm:p-12 shadow-sm space-y-8">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                <Shield className="w-6 h-6" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                Privacy Policy
              </h1>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              GT InnoX LLP · Data Protection, Encryption & Official LinkedIn Compliance
            </p>
          </div>

          <section className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">1. Introduction & Commitment</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              GT InnoX LLP is committed to protecting the privacy, security, and integrity of your data. This Privacy Policy details how we collect, process, encrypt, and handle personal data and social media tokens when you use LinkedIn Autopilot (“Service”).
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">2. Information We Collect</h2>
            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-500" /> Account & Profile Information
                </p>
                <p>When you register, we collect your email address, full name, and workspace preferences.</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-emerald-500" /> LinkedIn OAuth Credentials
                </p>
                <p>
                  When connecting your LinkedIn account, we receive OAuth 2.0 access tokens, your public profile URN (`urn:li:person:...`), profile name, and authorized organization identifiers. All access tokens are encrypted at rest using AES-256-GCM encryption before database persistence.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Eye className="w-4 h-4 text-purple-500" /> Content & Analytics Data
                </p>
                <p>
                  Drafted posts, uploaded media assets (stored in secure Supabase Storage buckets), scheduling calendars, and engagement metrics fetched directly via LinkedIn’s Share Statistics API.
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">3. How We Use Your Data</h2>
            <ul className="list-disc pl-6 space-y-2 text-sm text-slate-600 dark:text-slate-400">
              <li>To provide automated multi-destination publishing to your LinkedIn Personal Profile and authorized Company Pages.</li>
              <li>To power Google Gemini AI content generation and hook formatting according to your explicit prompts.</li>
              <li>To manage multi-tenant workspace isolation and prevent cross-tenant data leakage.</li>
              <li>To deliver operational alerts, ticket status updates, and critical system notifications.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">4. Token Security & No Third-Party Selling</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              We <strong>NEVER</strong> sell, rent, monetize, or trade your personal data, post content, or LinkedIn OAuth tokens. All access tokens are decrypted strictly in isolated server-side workers during immediate scheduled post delivery and are never exposed to browser clients.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">5. Data Retention & Account Deletion</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              You may disconnect your LinkedIn account or request full workspace deletion at any time via Settings. Upon disconnection, stored tokens and authorization credentials are permanently invalidated and purged from our database.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">6. Security Inquiries & Contact</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              For privacy requests, GDPR compliance queries, or data removal, please contact:
            </p>
            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl text-xs space-y-1 font-mono text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
              <p><strong>Entity:</strong> GT InnoX LLP (Privacy & Data Protection Officer)</p>
              <p><strong>Email:</strong> privacy@gtinnox.in / tejag.vijay@gmail.com</p>
              <p><strong>Security Operations:</strong> Hyderabad, Telangana, India</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
