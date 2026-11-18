'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Icon, IconName } from '@/components/magicpath/icons';

interface OnboardingCardProps {
  accountsConnected: number;
  totalPosts: number;
}

export function OnboardingCard({ accountsConnected, totalPosts }: OnboardingCardProps) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      const isDismissed = localStorage.getItem('autopilot_onboarding_dismissed') === 'true';
      setDismissed(isDismissed);
    } catch {}
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem('autopilot_onboarding_dismissed', 'true');
    } catch {}
  };

  if (dismissed) return null;

  const steps: {
    id: string;
    title: string;
    description: string;
    href: string;
    done: boolean;
    icon: IconName;
  }[] = [
    {
      id: 'connect_linkedin',
      title: 'Connect your LinkedIn account',
      description: 'Authorize your personal profile or company page via official OAuth 2.0.',
      href: '/accounts',
      done: accountsConnected > 0,
      icon: 'linkedin',
    },
    {
      id: 'brand_voice',
      title: 'Configure Brand Voice',
      description: 'Set your guidelines, tone, and audience niche in AI Studio.',
      href: '/ai-studio?tab=brand',
      done: false,
      icon: 'sparkles',
    },
    {
      id: 'first_post',
      title: 'Draft or schedule your first post',
      description: 'Write or generate content and schedule your publication slot.',
      href: '/composer',
      done: totalPosts > 0,
      icon: 'pen',
    },
  ];

  return (
    <section className="panel" style={{ padding: '18px 20px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: 'var(--brand)', display: 'grid', placeItems: 'center' }}>
            <Icon name="sparkles" size={17} />
          </span>
          <b style={{ fontSize: '13px', letterSpacing: '-0.02em' }}>Getting started with LinkedIn Autopilot</b>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="plain-icon"
          aria-label="Dismiss guide"
        >
          <Icon name="close" size={15} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
        {steps.map((step, idx) => (
          <Link
            key={step.id}
            href={step.href}
            style={{
              textDecoration: 'none',
              padding: '14px',
              borderRadius: '9px',
              border: '1px solid var(--line)',
              background: 'var(--surface-soft)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11px', fontWeight: 600, color: 'var(--ink)' }}>
                <Icon name={step.icon} size={15} />
                <span>Step {idx + 1}</span>
              </span>
              {step.done ? (
                <span className="toast-check" style={{ width: '15px', height: '15px' }}>
                  <Icon name="check" size={10} strokeWidth={2.4} />
                </span>
              ) : (
                <span style={{ color: 'var(--muted)', display: 'grid', placeItems: 'center' }}>
                  <Icon name="arrow" size={13} />
                </span>
              )}
            </div>
            <strong style={{ fontSize: '12px', color: 'var(--ink)' }}>{step.title}</strong>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--muted)', lineHeight: 1.4 }}>
              {step.description}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
