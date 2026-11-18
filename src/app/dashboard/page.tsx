'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Clock,
  CheckCircle2,
  Eye,
  TrendingUp,
  FileText,
  Linkedin,
  User,
  PlusCircle,
  Calendar,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

function MetricCard({ label, value, icon }: { label: string; value: React.ReactNode; icon: 'published' | 'scheduled' | 'impressions' | 'engagement' }) {
  const Icon = icon === 'published' ? CheckCircle2 : icon === 'scheduled' ? Clock : icon === 'impressions' ? Eye : TrendingUp;
  return (
    <article className="workspace-metric-card">
      <div className="workspace-metric-top"><span>{label}</span><span className="workspace-metric-icon"><Icon className="w-4 h-4" /></span></div>
      <strong>{value}</strong>
    </article>
  );
}

export default function DashboardPage() {
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
        impressions: null,
        reactions: null,
        comments: null,
        reposts: null,
        notice: null,
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
  const [loading, setLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      return !sessionStorage.getItem('autopilot_metrics');
    }
    return true;
  });

  const [quickPrompt, setQuickPrompt] = useState('');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [analyticsRes, postsRes] = await Promise.all([
        fetch('/api/analytics/overview'),
        fetch('/api/posts'),
      ]);

      if (analyticsRes.ok) {
        const aData = await analyticsRes.json();
        setMetrics(aData.metrics);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('autopilot_metrics', JSON.stringify(aData.metrics));
        }
      }

      if (postsRes.ok) {
        const pData = await postsRes.json();
        const posts = pData.posts || [];
        setRecentPosts(posts);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('autopilot_recent_posts', JSON.stringify(posts));
        }
      }
    } catch (e) {
      console.error('Failed to load dashboard:', e);
    } finally {
      setLoading(false);
    }
  };

  const upcomingScheduled = recentPosts.filter((p) => p.status === 'scheduled').slice(0, 4);
  const recentPublished = recentPosts.filter((p) => p.status === 'published').slice(0, 4);

  return (
    <div className="chat-page chat-page-dashboard space-y-6 animate-in fade-in duration-300">
      <header className="workspace-page-header">
        <div>
          <h1>Overview</h1>
          <p>Your LinkedIn workspace, at a glance.</p>
        </div>
      </header>

      <section className="chat-prompt-card chat-prompt-card-designed">
        <div className="chat-prompt-intro">
          <span className="chat-prompt-sparkle"><Sparkles className="w-4 h-4" /></span>
          <span className="chat-prompt-kicker">YOUR LINKEDIN WORKSPACE</span>
          <h2>What would you like to share today?</h2>
          <p>Start with a thought, shape it with AI, and publish when it feels right.</p>
        </div>
        <div className="chat-prompt-composer">
          <textarea
            value={quickPrompt}
            onChange={(event) => setQuickPrompt(event.target.value)}
            placeholder="Write an idea, paste a draft, or tell us what you’re working on…"
            aria-label="Start a post idea"
            rows={3}
          />
          <div className="chat-prompt-composer-footer">
            <div className="chat-prompt-actions">
              <span>Quick start</span>
              <Link href="/ai-studio"><Sparkles className="w-3.5 h-3.5" /> Generate with AI</Link>
              <Link href="/calendar"><Calendar className="w-3.5 h-3.5" /> Plan your week</Link>
              <Link href="/templates"><FileText className="w-3.5 h-3.5" /> Use a template</Link>
            </div>
            <Link
              href={quickPrompt.trim() ? `/ai-studio?topic=${encodeURIComponent(quickPrompt.trim())}` : '/composer'}
              className="chat-prompt-submit"
              aria-label="Continue"
            >
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Onboarding Banner if no accounts are connected */}
      {metrics.accountsConnected === 0 && !loading && (
        <div className="p-5 rounded-2xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 backdrop-blur-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center text-white flex-shrink-0 shadow-md shadow-blue-500/20">
              <Linkedin className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold text-sm text-blue-950 dark:text-blue-100">
                Connect your LinkedIn Profile or Company Page
              </div>
              <div className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                Enable automated background publishing and official REST analytics by authorizing LinkedIn OAuth.
              </div>
            </div>
          </div>
          <Link
            href="/accounts"
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-sm flex items-center justify-center gap-1.5 flex-shrink-0"
          >
            <span>Connect Destination</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      <section className="workspace-metric-grid" aria-label="Workspace performance">
        <MetricCard label="Posts published" value={loading ? '—' : metrics.publishedCount ?? 0} icon="published" />
        <MetricCard label="Scheduled" value={loading ? '—' : metrics.scheduledCount ?? 0} icon="scheduled" />
        <MetricCard label="Impressions" value={metrics.engagement?.impressions == null ? '—' : Number(metrics.engagement.impressions).toLocaleString()} icon="impressions" />
        <MetricCard label="Engagement rate" value={metrics.engagement?.impressions > 0 ? `${(((Number(metrics.engagement.reactions || 0) + Number(metrics.engagement.comments || 0) + Number(metrics.engagement.reposts || 0)) / Number(metrics.engagement.impressions)) * 100).toFixed(1)}%` : '—'} icon="engagement" />
      </section>

      {/* Dual Column: Upcoming Scheduled & Recent Activity */}
      <div className="workspace-post-panels grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Scheduled Posts */}
        <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <span>Upcoming</span>
            </div>
            <Link href="/posts?tab=scheduled" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
              View All
            </Link>
          </div>

          <div className="flex-1 space-y-3">
            {upcomingScheduled.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                <Clock className="w-6 h-6 mx-auto opacity-30" />
                <p>No scheduled posts in the queue.</p>
                <div>
                  <Link
                    href="/composer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition-all"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Schedule a Post</span>
                  </Link>
                </div>
              </div>
            ) : (
              upcomingScheduled.map((post) => {
                const isOrg = post.social_account?.account_type === 'organization';
                return (
                  <div
                    key={post.id}
                    className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-start justify-between gap-3 text-xs hover:border-blue-500/40 transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="line-clamp-2 text-slate-900 dark:text-slate-100 font-medium leading-relaxed">
                        {post.content}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-400 flex-wrap">
                        <span className="flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400">
                          <Calendar className="w-3 h-3" />
                          {post.scheduled_at ? new Date(post.scheduled_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Pending'}
                        </span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                          {isOrg ? <Building className="w-3 h-3 text-indigo-500" /> : <User className="w-3 h-3 text-blue-500" />}
                          {post.social_account?.account_name || 'LinkedIn Account'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span>Recent posts</span>
            </div>
            <Link href="/posts?tab=published" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
              View all
            </Link>
          </div>

          <div className="flex-1 space-y-3">
            {recentPublished.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                <CheckCircle2 className="w-6 h-6 mx-auto opacity-30" />
                <p>No recent activity recorded.</p>
              </div>
            ) : (
              recentPublished.map((post) => (
                <div
                  key={post.id}
                  className="p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        Published
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(post.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <p className="line-clamp-1 text-slate-800 dark:text-slate-200 font-medium">
                      {post.content}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
