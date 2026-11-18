'use client';

import React, { useState, useEffect } from 'react';
import { PageHeader, ActionButton } from '@/components/magicpath/common';
import { Icon } from '@/components/magicpath/icons';
import { useToast } from '@/components/ui/toast';
import { Modal } from '@/components/ui/modal';

export default function BillingPage() {
  const toast = useToast();
  const [showManageModal, setShowManageModal] = useState(false);

  return (
    <>
      <PageHeader screen="billing" />

      {/* Plan Banner */}
      <section className="plan-banner">
        <div>
          <span className="eyebrow light">CURRENT PLAN</span>
          <h2>Pro workspace</h2>
          <p>Everything you need to build a consistent LinkedIn presence.</p>
        </div>
        <div className="plan-price">
          <b>$24</b>
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

      {/* Usage & Payment Methods Grid */}
      <div className="billing-grid">
        <section className="panel usage-panel">
          <div className="panel-heading">
            <div>
              <h3>Monthly usage</h3>
              <p>Resets on next billing cycle</p>
            </div>
          </div>

          {[
            ['Scheduled posts', 18, 60],
            ['AI writing credits', 32, 100],
            ['Media storage', 2.4, 10],
          ].map(([label, value, max]) => (
            <div className="usage-row" key={label as string}>
              <div>
                <b>{label}</b>
                <span>
                  {value}
                  {label === 'Media storage' ? ' GB' : ''} of {max}
                  {label === 'Media storage' ? ' GB' : ''}
                </span>
              </div>
              <div className="usage-track">
                <i style={{ width: `${(Number(value) / Number(max)) * 100}%` }} />
              </div>
            </div>
          ))}
        </section>

        <section className="panel payment-panel">
          <div className="panel-heading">
            <div>
              <h3>Payment method</h3>
              <p>Your next invoice is next month</p>
            </div>
          </div>

          <div className="payment-method">
            <span className="payment-icon">VISA</span>
            <div>
              <b>Visa ending in 4242</b>
              <small>Expires 08/28</small>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() => toast.info('Payment methods managed via Stripe Billing')}
            >
              Edit
            </button>
          </div>

          <button
            type="button"
            className="billing-link"
            onClick={() => toast.info('Invoice history loaded')}
          >
            View invoice history <Icon name="arrow" size={14} />
          </button>
        </section>
      </div>

      <Modal
        isOpen={showManageModal}
        onClose={() => setShowManageModal(false)}
        title="Manage Plan &amp; Subscription"
      >
        <div className="space-y-4">
          <p style={{ fontSize: '12px', color: 'var(--muted)', margin: 0 }}>
            You are currently on the <b>Pro workspace plan ($24/month)</b>. Your subscription
            renews automatically every month.
          </p>

          <div
            style={{
              padding: '12px',
              borderRadius: '8px',
              border: '1px solid var(--line)',
              background: 'var(--surface-soft)',
              fontSize: '11px',
            }}
          >
            <b>Included in your plan:</b>
            <ul style={{ margin: '8px 0 0', paddingLeft: '16px', lineHeight: 1.6 }}>
              <li>Unlimited draft autosaving &amp; concurrency protection</li>
              <li>Multi-destination LinkedIn scheduling</li>
              <li>AI Studio generation, tone rewriting &amp; hashtag discovery</li>
              <li>Certificate post extraction with in-memory validation</li>
            </ul>
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
              onClick={() => {
                setShowManageModal(false);
                toast.success('Redirecting to Stripe Customer Portal…');
              }}
            >
              Customer Portal <Icon name="external" size={14} />
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
