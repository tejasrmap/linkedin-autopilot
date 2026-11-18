'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
      publishedCount: 0,
      scheduledCount: 0,
      draftCount: 0,
      failedCount: 0,
      accountsConnected: 0,
      engagement: {
        impressions: 0,
        reactions: 0,
        comments: 0,
        reposts: 0,
        rate: '0%',
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

  // Map real posts
  const displayPosts: PostItem[] = recentPosts.slice(0, 4).map((p: any) => ({
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
  }));

  // Calculate real week rhythm from posts
  const weekData = useMemo(() => {
    const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    const now = new Date();
    // Monday of current week
    const currentDay = (now.getDay() + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - currentDay);
    monday.setHours(0, 0, 0, 0);

    const counts = [0, 0, 0, 0, 0, 0, 0];
    let plannedCount = 0;

    for (const post of recentPosts) {
      const targetDate = post.scheduled_at ? new Date(post.scheduled_at) : new Date(post.created_at);
      const diffDays = Math.floor((targetDate.getTime() - monday.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays < 7) {
        counts[diffDays]++;
        if (post.status === 'scheduled' || post.status === 'published') {
          plannedCount++;
        }
      }
    }

    const maxCount = Math.max(...counts, 1);
    const bars = days.map((day, i) => ({
      day,
      count: counts[i],
      height: counts[i] > 0 ? Math.min(100, Math.round((counts[i] / maxCount) * 100)) : 0,
    }));

    return { bars, plannedCount };
  }, [recentPosts]);

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

      {/* 4 Real KPI Stat Cards */}
      <section className="stat-grid">
        <div className="stat-card">
          <div className="stat-top">
            <span>Posts published</span>
            <span className="stat-icon blue">
              <Icon name="check" size={16} />
            </span>
          </div>
          <strong>{metrics.publishedCount ?? 0}</strong>
          <small>{metrics.publishedCount > 0 ? `${metrics.publishedCount} total` : 'None published yet'}</small>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Scheduled</span>
            <span className="stat-icon violet">
              <Icon name="calendar" size={16} />
            </span>
          </div>
          <strong>{metrics.scheduledCount ?? 0}</strong>
          <small>{metrics.scheduledCount > 0 ? `${metrics.scheduledCount} queued` : 'No upcoming posts'}</small>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Impressions</span>
            <span className="stat-icon mint">
              <Icon name="chart" size={16} />
            </span>
          </div>
          <strong>{metrics.engagement?.impressions || 0}</strong>
          <small>Total post views</small>
        </div>

        <div className="stat-card">
          <div className="stat-top">
            <span>Engagement rate</span>
            <span className="stat-icon amber">
              <Icon name="sparkles" size={16} />
            </span>
          </div>
          <strong>{metrics.engagement?.rate || '0%'}</strong>
          <small>Reactions and comments</small>
        </div>
      </section>

      {/* Recent Posts + Real Week Rhythm */}
      <div className="overview-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Recent posts</h3>
              <p>Your latest writing and updates</p>
            </div>
            <Link href="/posts" className="text-button" style={{ textDecoration: 'none' }}>
              View all <Icon name="arrow" size={14} />
            </Link>
          </div>
          <div className="post-list">
            {displayPosts.length > 0 ? (
              displayPosts.slice(0, 3).map((p, idx) => (
                <PostRow
                  key={p.id || idx}
                  post={p}
                  href={p.status === 'Draft' ? `/composer?draftId=${p.id || ''}` : `/posts?tab=${p.status.toLowerCase()}`}
                />
              ))
            ) : (
              <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: '12px' }}>
                No posts created yet. Start with a prompt above or click <b>New post</b>.
              </div>
            )}
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
            {weekData.bars.map((item, i) => (
              <button
                key={i}
                type="button"
                className="week-day"
                onClick={() => router.push('/calendar')}
                title={`${item.count} post${item.count === 1 ? '' : 's'}`}
              >
                <span className="bar-track">
                  <i style={{ height: `${item.height}%` }} />
                </span>
                <small>{item.day}</small>
              </button>
            ))}
          </div>
          <div className="week-note">
            <span className="live-dot" />
            <span>
              <b>{weekData.plannedCount} post{weekData.plannedCount === 1 ? '' : 's'} planned</b> this week
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
