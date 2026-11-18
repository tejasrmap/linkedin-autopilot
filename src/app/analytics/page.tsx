'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/magicpath/common';
import { Icon } from '@/components/magicpath/icons';
import { Post } from '@/types';

export default function AnalyticsPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const [overviewRes, postsRes] = await Promise.all([
        fetch('/api/analytics/overview'),
        fetch('/api/posts?status=published'),
      ]);

      if (overviewRes.ok) {
        const oData = await overviewRes.json();
        setMetrics(oData.metrics);
      }

      if (postsRes.ok) {
        const pData = await postsRes.json();
        setPosts(pData.posts || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const topPost = posts[0];
  const impressions = metrics?.engagement?.impressions ?? '24,810';
  const reactions = metrics?.engagement?.reactions ?? '1,592';
  const comments = metrics?.engagement?.comments ?? '284';

  return (
    <>
      <PageHeader screen="analytics" />

      {/* KPI Stats Grid */}
      <div className="stat-grid analytics-stats">
        {[
          ['Impressions', impressions, '18.6%'],
          ['Reactions', reactions, '12.4%'],
          ['Comments', comments, '9.2%'],
          ['Engagement', '6.4%', '0.8%'],
        ].map(([label, value, delta], i) => (
          <div className="stat-card" key={label}>
            <div className="stat-top">
              <span>{label}</span>
              <span className={`stat-icon ${['blue', 'violet', 'mint', 'amber'][i]}`}>
                <Icon name={i === 0 ? 'chart' : 'sparkles'} size={16} />
              </span>
            </div>
            <strong>{value}</strong>
            <small className="positive">↑ {delta} vs previous period</small>
          </div>
        ))}
      </div>

      {/* Analytics Chart & Top Post */}
      <div className="analytics-grid">
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h3>Audience engagement</h3>
              <p>Last 30 days</p>
            </div>
            <button type="button" className="view-toggle">
              Last 30 days <Icon name="chevron" size={14} />
            </button>
          </div>

          <div className="chart-area">
            <div className="chart-y">
              <span>1.2k</span>
              <span>900</span>
              <span>600</span>
              <span>300</span>
              <span>0</span>
            </div>
            <div className="chart-plot">
              <div className="chart-gridlines">
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
              <div className="chart-bars">
                {[
                  32, 48, 39, 67, 53, 81, 45, 61, 74, 48, 88, 66, 55, 73, 92, 58, 70, 42, 85, 62,
                  78, 54, 90, 70, 58, 82, 46, 68, 94, 74,
                ].map((h, i) => (
                  <i key={i} style={{ height: `${h}%` }} />
                ))}
              </div>
              <div className="chart-x">
                <span>Day 1</span>
                <span>Day 7</span>
                <span>Day 14</span>
                <span>Day 21</span>
                <span>Day 30</span>
              </div>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Top performing post</h3>
              <p>This month</p>
            </div>
            <Icon name="chart" size={17} />
          </div>

          <div className="top-post-card">
            <span className="top-post-badge">BEST THIS MONTH</span>
            <h4>
              {topPost?.content?.substring(0, 75) ||
                'The best product teams don’t move faster. They remove friction.'}
            </h4>
            <div className="top-post-numbers">
              <div>
                <b>8.2k</b>
                <small>Impressions</small>
              </div>
              <div>
                <b>8.1%</b>
                <small>Engagement</small>
              </div>
            </div>
            <Link
              href="/posts?tab=published"
              className="text-button"
              style={{ textDecoration: 'none' }}
            >
              View post <Icon name="arrow" size={14} />
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
