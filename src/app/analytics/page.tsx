'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  const impressions = metrics?.engagement?.impressions ?? 0;
  const reactions = metrics?.engagement?.reactions ?? 0;
  const comments = metrics?.engagement?.comments ?? 0;
  const engagementRate = metrics?.engagement?.rate ?? '0%';

  // 30-Day Activity Distribution from Real Published Posts
  const chartBars = useMemo(() => {
    const bars: number[] = new Array(30).fill(0);
    const now = new Date();

    for (const post of posts) {
      const pubDate = new Date(post.published_at || post.created_at);
      const diffDays = Math.floor((now.getTime() - pubDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays < 30) {
        bars[29 - diffDays]++;
      }
    }

    const max = Math.max(...bars, 1);
    return bars.map((count) => (count > 0 ? Math.min(100, Math.round((count / max) * 100)) : 4));
  }, [posts]);

  return (
    <>
      <PageHeader screen="analytics" />

      {/* KPI Stats Grid */}
      <div className="stat-grid analytics-stats">
        {[
          ['Impressions', impressions, 'Total views'],
          ['Reactions', reactions, 'Likes & endorsements'],
          ['Comments', comments, 'Community responses'],
          ['Engagement', engagementRate, 'Interactions per view'],
        ].map(([label, value, note], i) => (
          <div className="stat-card" key={label as string}>
            <div className="stat-top">
              <span>{label}</span>
              <span className={`stat-icon ${['blue', 'violet', 'mint', 'amber'][i]}`}>
                <Icon name={i === 0 ? 'chart' : 'sparkles'} size={16} />
              </span>
            </div>
            <strong>{value}</strong>
            <small>{note}</small>
          </div>
        ))}
      </div>

      {/* Analytics Chart & Top Post */}
      <div className="analytics-grid">
        <section className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h3>Publishing activity</h3>
              <p>Last 30 days ({posts.length} published post{posts.length === 1 ? '' : 's'})</p>
            </div>
            <span className="view-toggle">
              Last 30 days
            </span>
          </div>

          <div className="chart-area">
            <div className="chart-y">
              <span>High</span>
              <span>Med</span>
              <span>Low</span>
              <span>0</span>
            </div>
            <div className="chart-plot">
              <div className="chart-gridlines">
                <i />
                <i />
                <i />
                <i />
              </div>
              <div className="chart-bars">
                {chartBars.map((h, i) => (
                  <i key={i} style={{ height: `${h}%` }} />
                ))}
              </div>
              <div className="chart-x">
                <span>30d ago</span>
                <span>21d ago</span>
                <span>14d ago</span>
                <span>7d ago</span>
                <span>Today</span>
              </div>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Top performing post</h3>
              <p>Based on published engagement</p>
            </div>
            <Icon name="chart" size={17} />
          </div>

          {topPost ? (
            <div className="top-post-card">
              <span className="top-post-badge">RECENT PUBLISHED</span>
              <h4>{topPost.content?.substring(0, 85) + (topPost.content?.length > 85 ? '…' : '')}</h4>
              <div className="top-post-numbers">
                <div>
                  <b>{(topPost as any).stats?.impressions || 0}</b>
                  <small>Impressions</small>
                </div>
                <div>
                  <b>{(topPost as any).stats?.reactions || 0}</b>
                  <small>Reactions</small>
                </div>
              </div>
              <Link
                href={`/posts?tab=published`}
                className="text-button"
                style={{ textDecoration: 'none' }}
              >
                View post <Icon name="arrow" size={14} />
              </Link>
            </div>
          ) : (
            <div style={{ padding: '36px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: '12px' }}>
              No published posts yet. Scheduled and published updates will appear here with engagement statistics.
            </div>
          )}
        </section>
      </div>
    </>
  );
}
