'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/magicpath/common';
import { Icon } from '@/components/magicpath/icons';

export default function TermsPage() {
  const [activeSection, setActiveSection] = useState<'terms' | 'acceptable' | 'liability'>('terms');

  return (
    <>
      <PageHeader
        title="Terms of Service"
        subtitle="Understand how your workspace and content are handled."
      />

      <section className="panel legal-panel">
        <div className="legal-toc">
          <b>On this page</b>
          <button
            type="button"
            className={activeSection === 'terms' ? 'active' : ''}
            onClick={() => setActiveSection('terms')}
          >
            Terms of service
          </button>
          <button
            type="button"
            className={activeSection === 'acceptable' ? 'active' : ''}
            onClick={() => setActiveSection('acceptable')}
          >
            Acceptable use
          </button>
          <button
            type="button"
            className={activeSection === 'liability' ? 'active' : ''}
            onClick={() => setActiveSection('liability')}
          >
            Liability &amp; uptime
          </button>
          <Link href="/privacy" style={{ textDecoration: 'none' }}>
            <button type="button">Privacy policy</button>
          </Link>
        </div>

        <article className="legal-copy">
          <span className="eyebrow">LAST UPDATED · NOVEMBER 2026</span>
          <h2>Terms of Service</h2>
          <p>
            By accessing or using LinkedIn Autopilot, provided by GT InnoX LLP, you agree to comply
            with and be bound by these Terms of Service.
          </p>

          <h3>Acceptable use</h3>
          <p>
            You agree not to use the platform to distribute spam, misleading content, or engage in
            automated activity that violates LinkedIn’s Community Guidelines or Developer Terms of
            Service.
          </p>

          <h3>Intellectual property</h3>
          <p>
            You retain full copyright and intellectual property rights to all content, drafts, and
            media created or scheduled through your workspace. GT InnoX LLP does not claim any
            ownership over your published posts.
          </p>

          <h3>Service uptime</h3>
          <p>
            We strive to provide 99.9% service uptime for automated background queues. In the event
            of LinkedIn API downtime or throttling, scheduled jobs are safely queued and retried
            with exponential backoff.
          </p>

          <Link href="/dashboard" className="text-button" style={{ textDecoration: 'none' }}>
            Back to workspace <Icon name="arrow" size={14} />
          </Link>
        </article>
      </section>
    </>
  );
}
