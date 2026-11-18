'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageHeader, PostRow, PostItem } from '@/components/magicpath/common';
import { Icon } from '@/components/magicpath/icons';

export default function DashboardPage() {
  const router = useRouter();
  const [idea, setIdea] = useState('');
  const [metrics, setMetrics] = useState<any>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem('autopilot_metrics');
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return {
      totalPosts: 0,
      publishedCount: 18,
      scheduledCount: 6,
      draftCount: 4,
      failedCount: 0,
      accountsConnected: 1,
      engagement: {
        impressions: '24.8k',
        reactions: '1,592',
        comments: '284',
        reposts: '42',
      },
    };
  });
  const [recentPosts, setRecentPosts] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem('autopilot_recent_posts');
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return [];
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [analyticsRes, postsRes] = await Promise.all([
        fetch('/api/analytics/overview'),
        fetch('/api/posts'),
      ]);

      if (analyticsRes.ok) {
        const aData = await analyticsRes.json();
        if (aData.metrics) {
          setMetrics(aData.metrics);
          sessionStorage.setItem('autopilot_metrics', JSON.stringify(aData.metrics));
        }
      }

      if (postsRes.ok) {
        const pData = await postsRes.json();
        const posts = pData.posts || [];
        setRecentPosts(posts);
        sessionStorage.setItem('autopilot_recent_posts', JSON.stringify(posts));
      }
    } catch (e) {
      console.error('Failed to load dashboard:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSendPrompt = () => {
    if (idea.trim()) {
      sessionStorage.setItem('autopilot_pending_topic', idea.trim());
      router.push(`/ai-studio?topic=${encodeURIComponent(idea.trim())}`);
    } else {
      router.push('/composer');
    }
  };

  // Default display posts if empty
  const displayPosts: PostItem[] =
    recentPosts.length > 0
      ? recentPosts.slice(0, 4).map((p: any) => ({
          id: p.id,
          title: p.content?.substring(0, 70) + (p.content?.length > 70 ? '…' : '') || 'Untitled update',
          status:
            p.status === 'published'
              ? 'Published'
              : p.status === 'scheduled'
              ? 'Scheduled'
              : 'Draft',
          time: p.scheduled_at
            ? new Date(p.scheduled_at).toLocaleDateString([], { month: 'short', day: 'numeric' })
            : p.created_at
            ? new Date(p.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })
            : 'Recently',
          type: 'LinkedIn post',
          color: p.status === 'published' ? 'blue' : p.status === 'scheduled' ? 'violet' : 'mint',
        }))
      : [
          {
            title: 'The best product teams don’t move faster. They remove friction.',
            status: 'Published',
            time: 'Today · 9:42 AM',
            type: 'Text post',
            color: 'blue',
          },
          {
            title: 'Three lessons from building in public this quarter',
            status: 'Scheduled',
            time: 'Tomorrow · 10:00 AM',
            type: 'Thought leadership',
            color: 'violet',
          },
          {
            title: 'A small framework for better customer interviews',
            status: 'Draft',
            time: 'Edited yesterday',
            type: 'Text post',
            color: 'mint',
          },
          {
            title: 'What we learned from our latest launch',
            status: 'Published',
            time: 'Nov 14 · 8:30 AM',
            type: 'Product update',
            color: 'amber',
          },
        ];

  return (
    <>
      <PageHeader screen="overview" />

      {/* Hero Welcome Card with AI Prompt Box */}
      <section className="welcome-card">
        <div className="welcome-copy">
          <div className="welcome-kicker">
            <span className="live-dot" /> YOUR LINKEDIN WORKSPACE
          </div>
          <h2>What would you like to share today?</h2>
          <p>Start with a thought, shape it with AI, and publish when it feels right.</p>
        </div>

        <div className="prompt-box">
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="Write an idea, paste a draft, or tell us what you’re working on…"
            aria-label="Start a post idea"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendPrompt();
              }
            }}
          />
          <div className="prompt-footer">
            <div className="prompt-hints">
              <button
                type="button"
                onClick={() => {
                  setIdea('Share a practical lesson from a recent project');
                  router.push('/ai-studio?topic=' + encodeURIComponent('Share a practical lesson from a recent project'));
                }}
              >
                <Icon name="sparkles" size={15} /> Help me find an angle
              </button>
              <button
                type="button"
                onClick={() => router.push('/templates')}
              >
                <Icon name="file" size={15} /> Use a template
              </button>
            </div>
            <button
              type="button"
              className="send-button"
              onClick={handleSendPrompt}
              aria-label="Continue"
            >
              <Icon name="arrow" size={18} />
            </button>
          </div>
        </div>

        <div className="welcome-shortcuts">
          <span>Quick start</span>
          <button type="button" onClick={() => router.push('/ai-studio')}>
            <Icon name="sparkles" size={15} /> Generate with AI
          </button>
          <button type="button" onClick={() => router.push('/calendar')}>
            <Icon name="calendar" size={15} /> Plan your week
          </button>
          <button type="button" onClick={() => router.push('/composer')}>
            <Icon name="pen" size={15} /> Write from scratch
          </button>
        </div>
      </section>

      {/* 4 Key Stat Cards */}
      <section className="stat-grid">
        <div className="stat-card">
          <div className="stat-top">
            <span>Posts published</span>
            <span className="stat-icon blue">
              <Icon name="check" size={16} />
            </span>
          </div>
          <strong>{metrics.publishedCount ?? 18}</strong>
          <small>+4 this month</small>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Scheduled</span>
            <span className="stat-icon violet">
              <Icon name="calendar" size={16} />
            </span>
          </div>
          <strong>{metrics.scheduledCount ?? 6}</strong>
          <small>Next one tomorrow</small>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Impressions</span>
            <span className="stat-icon mint">
              <Icon name="chart" size={16} />
            </span>
          </div>
          <strong>{metrics.engagement?.impressions || '24.8k'}</strong>
          <small>+18.6% vs last month</small>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Engagement rate</span>
            <span className="stat-icon amber">
              <Icon name="sparkles" size={16} />
            </span>
          </div>
          <strong>6.4%</strong>
          <small>+0.8% vs last month</small>
        </div>
      </section>

      {/* Recent Posts + Week Rhythm */}
      <div className="overview-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Recent posts</h3>
              <p>Your latest activity</p>
            </div>
            <Link href="/posts?tab=published" className="text-button" style={{ textDecoration: 'none' }}>
              View all <Icon name="arrow" size={14} />
            </Link>
          </div>
          <div className="post-list">
            {displayPosts.slice(0, 3).map((p, idx) => (
              <PostRow
                key={p.id || idx}
                post={p}
                href={p.status === 'Draft' ? `/composer?draftId=${p.id || ''}` : `/posts?tab=${p.status.toLowerCase()}`}
              />
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>This week</h3>
              <p>Your publishing rhythm</p>
            </div>
            <Link href="/calendar" className="icon-button" aria-label="Open calendar" style={{ textDecoration: 'none' }}>
              <Icon name="arrow" size={16} />
            </Link>
          </div>
          <div className="week-chart">
            {[
              ['M', 42],
              ['T', 68],
              ['W', 34],
              ['T', 84],
              ['F', 55],
              ['S', 23],
              ['S', 15],
            ].map(([day, height], i) => (
              <button
                key={i}
                type="button"
                className="week-day"
                onClick={() => router.push('/calendar')}
              >
                <span className="bar-track">
                  <i style={{ height: `${height}%` }} />
                </span>
                <small>{day}</small>
              </button>
            ))}
          </div>
          <div className="week-note">
            <span className="live-dot" />
            <span>
              <b>2 posts planned</b> this week
            </span>
            <button type="button" onClick={() => router.push('/calendar')}>
              See calendar
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
