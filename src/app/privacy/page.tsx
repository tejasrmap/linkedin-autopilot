'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/magicpath/common';
import { Icon } from '@/components/magicpath/icons';

export default function PrivacyPage() {
  const [activeSection, setActiveSection] = useState<'overview' | 'data' | 'accounts' | 'contact'>('overview');

  return (
    <>
      <PageHeader screen="legal" />

      <section className="panel legal-panel">
        <div className="legal-toc">
          <b>On this page</b>
          <button
            type="button"
            className={activeSection === 'overview' ? 'active' : ''}
            onClick={() => setActiveSection('overview')}
          >
            Privacy overview
          </button>
          <button
            type="button"
            className={activeSection === 'data' ? 'active' : ''}
            onClick={() => setActiveSection('data')}
          >
            Data and content
          </button>
          <button
            type="button"
            className={activeSection === 'accounts' ? 'active' : ''}
            onClick={() => setActiveSection('accounts')}
          >
            Connected accounts
          </button>
          <Link href="/terms" style={{ textDecoration: 'none' }}>
            <button type="button">Terms of service</button>
          </Link>
        </div>

        <article className="legal-copy">
          <span className="eyebrow">LAST UPDATED · NOVEMBER 2026</span>
          <h2>Your content stays yours.</h2>
          <p>
            LinkedIn Autopilot by GT InnoX LLP helps you plan and publish professional content. Your
            workspace is designed to keep your drafts, account connections, and team activity clear
            and under your control.
          </p>

          <h3>What we store</h3>
          <p>
            We store the account and workspace information needed to provide scheduling, drafts,
            analytics, and collaboration features. Uploaded media is associated with your workspace
            so you can reuse it in future posts.
          </p>

          <h3>Connected accounts</h3>
          <p>
            When you connect LinkedIn, the connection is used to publish content you choose and show
            available account insights. You can disconnect an account at any time from LinkedIn
            accounts.
          </p>

          <h3>Your choices</h3>
          <p>
            You can review drafts before publishing, manage workspace access, disconnect destinations,
            or contact support with questions about your account.
          </p>

          <Link href="/dashboard" className="text-button" style={{ textDecoration: 'none' }}>
            Back to workspace <Icon name="arrow" size={14} />
          </Link>
        </article>
      </section>
    </>
  );
}
