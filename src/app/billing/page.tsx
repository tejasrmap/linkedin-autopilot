'use client';

import React, { useState, useEffect } from 'react';
import { CreditCard, Check, Zap, Building2, Crown, Shield, Loader2, ArrowRight, X, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { Modal } from '@/components/ui/modal';

const plans = [
  {
    tier: 'free',
    name: 'Free Starter',
    price: '$0',
    period: 'forever',
    description: 'Perfect for individual founders testing LinkedIn Autopilot.',
    features: [
      '1 Connected LinkedIn Profile',
      '15 Scheduled Posts per Month',
      'Basic Gemini AI Captions (50 credits)',
      'Standard Community Support',
    ],
  },
  {
    tier: 'pro',
    name: 'Pro Growth',
    price: '$29',
    period: '/month',
    description: 'For growing creators, consultants, and executive leaders.',
    features: [
      'Up to 5 LinkedIn Accounts & Pages',
      '500 Posts per Month Scheduling',
      'Full AI Content Studio & Rewriter (2,000 credits)',
      'High-Resolution Media & Video Publishing',
      'BullMQ Automated Worker Queue & Delayed Dispatch',
    ],
    highlight: true,
  },
  {
    tier: 'agency',
    name: 'Agency Enterprise',
    price: '$199',
    period: '/month',
    description: 'For agencies managing content across multiple client brands.',
    features: [
      'Up to 50 Accounts & Workspaces',
      '5,000 Posts per Month',
      'Team Roles (Owner, Admin, Editor, Approver)',
      'Multi-Client Brand Voice Architecture',
      'Priority Job Dispatching & 24/7 SLA',
      'Direct Support from GT InnoX LLP',
    ],
  },
];

export default function BillingPage() {
  const toast = useToast();
  const [subData, setSubData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  const handleProceedToCheckout = async () => {
    if (!selectedPlan) return;
    try {
      setCheckingOut(true);
      toast.info('Connecting to Stripe checkout session...');
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: selectedPlan.tier }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        toast.info(data.message || 'Stripe merchant keys required in Vercel to process live cards.');
        setShowCheckoutModal(false);
      }
    } catch (e: any) {
      toast.error('Failed to initiate checkout.');
    } finally {
      setCheckingOut(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/subscription');
      if (res.ok) {
        const data = await res.json();
        setSubData(data);
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const activeTier = subData?.plan?.tier || 'pro';
  const usage = subData?.usage || {
    postsThisMonth: 0,
    postsLimit: 500,
    connectedAccounts: 0,
    accountsLimit: 5,
    aiCreditsUsed: 0,
    aiCreditsLimit: 2000,
    videoPublishingEnabled: true,
  };

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

      {/* Real Live Usage Stats */}
      {subData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-2">
            <span className="text-[11px] font-semibold text-slate-500">Posts This Month</span>
            <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {usage.postsThisMonth} / {usage.postsLimit}
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, (usage.postsThisMonth / usage.postsLimit) * 100)}%` }}
              />
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-2">
            <span className="text-[11px] font-semibold text-slate-500">Connected Accounts</span>
            <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {usage.connectedAccounts} / {usage.accountsLimit}
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, (usage.connectedAccounts / usage.accountsLimit) * 100)}%` }}
              />
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-2">
            <span className="text-[11px] font-semibold text-slate-500">AI Studio Credits</span>
            <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {usage.aiCreditsUsed} / {usage.aiCreditsLimit}
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, (usage.aiCreditsUsed / usage.aiCreditsLimit) * 100)}%` }}
              />
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-2">
            <span className="text-[11px] font-semibold text-slate-500">Video Publishing</span>
            <div className="text-xl font-bold text-emerald-500 flex items-center gap-1.5">
              <Check className="w-5 h-5" />
              <span>{usage.videoPublishingEnabled ? 'Enabled' : 'Disabled'}</span>
            </div>
            <span className="text-[10px] text-slate-400">Included in {subData.plan.name}</span>
          </div>
        </div>
      )}

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {plans.map((p, idx) => {
          const isCurrent = activeTier === p.tier;
          return (
            <div
              key={idx}
              className={`p-6 rounded-2xl border flex flex-col justify-between ${
                isCurrent
                  ? 'border-emerald-500 dark:border-emerald-500 bg-white dark:bg-[#111827] shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/20'
                  : p.highlight
                  ? 'border-blue-500 dark:border-blue-500 bg-white dark:bg-[#111827] shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/20'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-sm'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-base text-slate-900 dark:text-slate-100">{p.name}</span>
                  {isCurrent && (
                    <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Active Plan
                    </span>
                  )}
                  {p.highlight && !isCurrent && (
                    <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      Recommended
                    </span>
                  )}
                </div>

                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">{p.price}</span>
                  <span className="text-xs text-slate-400">{p.period}</span>
                </div>

                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{p.description}</p>

                <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                  {p.features.map((feat, fIdx) => (
                    <div key={fIdx} className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                      <Check className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  disabled={isCurrent}
                  onClick={() => {
                    setSelectedPlan(p);
                    setShowCheckoutModal(true);
                  }}
                  className={`w-full py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isCurrent
                      ? 'border border-slate-200 dark:border-slate-800 text-slate-400 cursor-default bg-slate-50 dark:bg-slate-900'
                      : p.highlight
                      ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-500/25'
                      : 'border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {isCurrent ? 'Current Plan' : `Upgrade to ${p.name}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Commercial Architecture Transparency */}
      <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 text-xs text-slate-500 dark:text-slate-400 flex items-start gap-3">
        <Shield className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
        <p className="leading-relaxed">
          The subscription data schema is backed by the Supabase PostgreSQL <code className="font-mono text-slate-700 dark:text-slate-300">subscriptions</code> table. In alignment with GT InnoX LLP development principles, payment simulation is disabled. Connect your live Stripe or payment gateway credentials via <code className="font-mono">STRIPE_SECRET_KEY</code> and <code className="font-mono">STRIPE_WEBHOOK_SECRET</code> to enable automated subscription webhooks.
        </p>
      </div>

      {/* Checkout / Commercial Activation Modal */}
      <Modal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        title={selectedPlan ? `Upgrade to ${selectedPlan.name}` : 'Commercial Checkout'}
        maxWidth="lg"
      >
        <div className="space-y-4 text-xs">
          <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 text-slate-700 dark:text-slate-300 space-y-2">
            <div className="font-bold text-sm text-blue-950 dark:text-blue-100 flex items-center justify-between">
              <span>{selectedPlan?.name}</span>
              <span className="text-base font-extrabold">{selectedPlan?.price}{selectedPlan?.period}</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {selectedPlan?.description}
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-emerald-500" />
              Production Merchant Gateway Configuration
            </h4>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              To process live transactions securely without payment simulation, ensure the following environment keys are configured in your Vercel deployment:
            </p>

            <div className="p-3 rounded-lg bg-slate-900 text-slate-300 font-mono text-[11px] space-y-1">
              <div>STRIPE_SECRET_KEY=sk_live_...</div>
              <div>STRIPE_WEBHOOK_SECRET=whsec_...</div>
              <div>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...</div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
            <button
              onClick={() => setShowCheckoutModal(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Close
            </button>
            <button
              onClick={handleProceedToCheckout}
              disabled={checkingOut}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {checkingOut && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Proceed to Secure Checkout →
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
