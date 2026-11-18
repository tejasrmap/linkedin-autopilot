'use client';

import React, { useState, useEffect } from 'react';
import { PageHeader, ActionButton } from '@/components/magicpath/common';
import { Icon } from '@/components/magicpath/icons';
import { useToast } from '@/components/ui/toast';
import { Modal } from '@/components/ui/modal';

export default function BillingPage() {
  const toast = useToast();
  const [subData, setSubData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showManageModal, setShowManageModal] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

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
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePortalRedirect = async () => {
    setRedirecting(true);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
          return;
        }
      }
      toast.info('Stripe billing portal is unconfigured or not active.');
    } catch {
      toast.error('Could not open billing portal.');
    } finally {
      setRedirecting(false);
    }
  };

  const planName = subData?.tier?.name || (subData?.tier === 'pro' ? 'Pro Growth' : 'Free Starter');
  const isPaid = Boolean(subData?.isPaid);
  const postsCount = subData?.usage?.postsCreatedThisMonth ?? 0;
  const postsLimit = subData?.limits?.maxPostsPerMonth ?? 15;
  const aiCount = subData?.usage?.aiGenerationsThisMonth ?? 0;
  const aiLimit = subData?.limits?.aiCredits ?? 50;
  const accountsCount = subData?.usage?.connectedAccounts ?? 0;
  const accountsLimit = subData?.limits?.maxAccounts ?? 1;

  return (
    <>
      <PageHeader screen="billing" />

      {/* Plan Banner */}
      <section className="plan-banner">
        <div>
          <span className="eyebrow light">CURRENT WORKSPACE PLAN</span>
          <h2>{planName}</h2>
          <p>{isPaid ? 'Active paid subscription with full feature access.' : 'Complimentary workspace plan with core scheduling and AI.'}</p>
        </div>
        <div className="plan-price">
          <b>{isPaid ? '$29' : '$0'}</b>
          <span>/ month</span>
        </div>
        <button
          type="button"
          className="btn btn-white"
          onClick={() => setShowManageModal(true)}
        >
          Manage plan
        </button>
      </section>

      {/* Real Usage & Account Limits Grid */}
      <div className="billing-grid">
        <section className="panel usage-panel">
          <div className="panel-heading">
            <div>
              <h3>Monthly usage</h3>
              <p>Current billing period</p>
            </div>
          </div>

          {[
            ['Posts created', postsCount, postsLimit],
            ['AI writing requests', aiCount, aiLimit],
            ['Connected LinkedIn accounts', accountsCount, accountsLimit],
          ].map(([label, value, max]) => {
            const pct = Math.min(100, Math.round((Number(value) / Number(max)) * 100));
            return (
              <div className="usage-row" key={label as string}>
                <div>
                  <b>{label}</b>
                  <span>
                    {value} of {max}
                  </span>
                </div>
                <div className="usage-track">
                  <i style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </section>

        <section className="panel payment-panel">
          <div className="panel-heading">
            <div>
              <h3>Payment method</h3>
              <p>Stripe payment configuration</p>
            </div>
          </div>

          {isPaid ? (
            <div className="payment-method">
              <span className="payment-icon">CARD</span>
              <div>
                <b>Active card on file</b>
                <small>Managed securely by Stripe</small>
              </div>
              <button
                type="button"
                className="text-button"
                onClick={handlePortalRedirect}
                disabled={redirecting}
              >
                {redirecting ? 'Opening…' : 'Manage on Stripe'}
              </button>
            </div>
          ) : (
            <div style={{ padding: '24px 0', color: 'var(--muted)', fontSize: '12px' }}>
              No credit card required on the Free Starter plan. Upgrade to Pro for unlimited scheduling and multi-account publishing.
            </div>
          )}

          <button
            type="button"
            className="billing-link"
            onClick={handlePortalRedirect}
            disabled={redirecting}
          >
            <span>View invoices and receipts</span>
            <Icon name="arrow" size={14} />
          </button>
        </section>
      </div>

      <Modal
        isOpen={showManageModal}
        onClose={() => setShowManageModal(false)}
        title="Manage Subscription"
        description="Upgrade your workspace plan or access the Stripe customer portal."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ padding: '14px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--surface-soft)' }}>
            <b style={{ fontSize: '13px' }}>Current Plan: {planName}</b>
            <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--muted)' }}>
              Status: {isPaid ? 'Active Paid' : 'Active Free Tier'}
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowManageModal(false)}
            >
              Close
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handlePortalRedirect}
              disabled={redirecting}
            >
              <Icon name="credit" size={14} />
              <span>{redirecting ? 'Opening Stripe…' : 'Open Stripe Customer Portal'}</span>
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
