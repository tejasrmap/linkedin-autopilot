'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Clock,
  FileText,
  AlertOctagon,
  TrendingUp,
  Linkedin,
  ArrowUpRight,
  PlusCircle,
  Eye,
  ThumbsUp,
  MessageSquare,
  Repeat2,
  Calendar,
  AlertCircle,
  Sparkles,
  Building,
  User,
  ArrowRight,
  RefreshCw,
  Loader2,
} from 'lucide-react';

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
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner / Welcome Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              Workspace Overview
            </h1>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              Enterprise Live
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Centralized multi-destination publishing, automated scheduling, and AI studio for GT InnoX LLP.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadDashboardData}
            disabled={loading}
            className="w-9 h-9 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm"
            title="Refresh Metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <Link
            href="/ai-studio"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100/50 transition-all shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            <span>AI Studio</span>
          </Link>

          <Link
            href="/composer"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm shadow-blue-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Create Post</span>
          </Link>
        </div>
      </div>

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

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Published */}
        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl shadow-sm hover:shadow-md transition-all space-y-2 group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Total Published</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center transition-transform group-hover:scale-110">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight">
            {metrics.publishedCount}
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800/80">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            <span>Confirmed via LinkedIn REST API</span>
          </div>
        </div>

        {/* Scheduled */}
        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl shadow-sm hover:shadow-md transition-all space-y-2 group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Scheduled Queue</span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center transition-transform group-hover:scale-110">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight">
            {metrics.scheduledCount}
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800/80">
            <Calendar className="w-3.5 h-3.5 text-blue-500" />
            <span>Automated by background worker</span>
          </div>
        </div>

        {/* Drafts */}
        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl shadow-sm hover:shadow-md transition-all space-y-2 group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Drafts Saved</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center transition-transform group-hover:scale-110">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight">
            {metrics.draftCount}
          </div>
          <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80">
            Ready for review or scheduling
          </div>
        </div>

        {/* Failed */}
        <div className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl shadow-sm hover:shadow-md transition-all space-y-2 group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Failed Attempts</span>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center transition-transform group-hover:scale-110">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight">
            {metrics.failedCount}
          </div>
          <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800/80">
            Retryable with 1-click in Queue
          </div>
        </div>
      </div>

      {/* Engagement Stats Grid (Real Data / Official Notice) */}
      <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              <span>Official Engagement Analytics</span>
            </h2>
            <p className="text-xs text-slate-400">Retrieved from LinkedIn Share Statistics API</p>
          </div>
          <Link
            href="/analytics"
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline"
          >
            <span>Full Report</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <Eye className="w-3.5 h-3.5 text-blue-500" /> Impressions
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {metrics.engagement.impressions !== null ? metrics.engagement.impressions : 'Pending'}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <ThumbsUp className="w-3.5 h-3.5 text-emerald-500" /> Reactions
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {metrics.engagement.reactions !== null ? metrics.engagement.reactions : 'Pending'}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <MessageSquare className="w-3.5 h-3.5 text-indigo-500" /> Comments
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {metrics.engagement.comments !== null ? metrics.engagement.comments : 'Pending'}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
              <Repeat2 className="w-3.5 h-3.5 text-amber-500" /> Reposts
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {metrics.engagement.reposts !== null ? metrics.engagement.reposts : 'Pending'}
            </div>
          </div>
        </div>

        {metrics.engagement.notice && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 text-[11px] text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-800/50">
            <AlertCircle className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <span>{metrics.engagement.notice}</span>
          </div>
        )}
      </div>

      {/* Dual Column: Upcoming Scheduled & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Scheduled Posts */}
        <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <span>Upcoming Scheduled Posts</span>
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
              <span>Recent Publishing Activity</span>
            </div>
            <Link href="/posts?tab=published" className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
              View History
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
