'use client';

import React from 'react';
import { CreditCard, Check, Zap, Building2, Crown, Shield } from 'lucide-react';

const plans = [
  {
    name: 'Free Starter',
    price: '$0',
    period: 'forever',
    description: 'Perfect for individual founders testing LinkedIn Autopilot.',
    features: [
      '1 Connected LinkedIn Profile',
      '10 Scheduled Posts in Queue',
      'Basic Gemini AI Captions',
      'Standard Community Support',
    ],
    current: true,
  },
  {
    name: 'Pro Growth',
    price: '$29',
    period: '/month',
    description: 'For growing creators, consultants, and executive leaders.',
    features: [
      'Up to 3 LinkedIn Accounts',
      'Unlimited Post Scheduling',
      'Full AI Content Studio & Rewriter',
      'High-Resolution Media Library',
      'BullMQ Automated Worker Queue',
    ],
    highlight: true,
  },
  {
    name: 'Business Team',
    price: '$79',
    period: '/month',
    description: 'For marketing teams and high-velocity B2B brands.',
    features: [
      'Up to 10 LinkedIn Accounts & Pages',
      'Team Roles & Approver Gateways',
      '7-Day AI Content Calendars',
      'Content Template Library',
      'Priority Job Dispatching',
    ],
  },
  {
    name: 'Agency Enterprise',
    price: '$199',
    period: '/month',
    description: 'For agencies managing content across multiple client brands.',
    features: [
      'Unlimited Accounts & Workspaces',
      'Dedicated Tenant Isolation',
      'Multi-Client Brand Voices',
      'Custom Rate-Limit Policies',
      'Direct Support from GT InnoX LLP',
    ],
  },
];

export default function BillingPage() {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-blue-500" />
          Subscription & Billing Architecture
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Scale your content publishing capacity with flexible commercial SaaS tiers.
        </p>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((p, idx) => (
          <div
            key={idx}
            className={`p-5 rounded-xl border flex flex-col justify-between ${
              p.highlight
                ? 'border-blue-500 dark:border-blue-500 bg-white dark:bg-[#111827] shadow-lg shadow-blue-500/10'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-sm'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-slate-900 dark:text-slate-100">{p.name}</span>
                {p.current && (
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Active
                  </span>
                )}
                {p.highlight && !p.current && (
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    Popular
                  </span>
                )}
              </div>

              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">{p.price}</span>
                <span className="text-xs text-slate-400">{p.period}</span>
              </div>

              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{p.description}</p>

              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                {p.features.map((feat, fIdx) => (
                  <div key={fIdx} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <Check className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                disabled={p.current}
                className={`w-full py-2 rounded-lg text-xs font-semibold transition-all ${
                  p.current
                    ? 'border border-slate-200 dark:border-slate-800 text-slate-400 cursor-default'
                    : p.highlight
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                    : 'border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {p.current ? 'Current Plan' : 'Upgrade Plan'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Commercial Architecture Transparency */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-xs text-slate-500 dark:text-slate-400 flex items-start gap-3">
        <Shield className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
        <p className="leading-relaxed">
          The subscription data schema is backed by the Supabase PostgreSQL <code className="font-mono text-slate-700 dark:text-slate-300">subscriptions</code> table. In alignment with GT InnoX LLP development principles, payment simulation is disabled. Connect your live Stripe or payment gateway credentials via <code className="font-mono">BILLING_PROVIDER_SECRET</code> and <code className="font-mono">BILLING_WEBHOOK_SECRET</code> to enable automated subscription webhooks.
        </p>
      </div>
    </div>
  );
}

