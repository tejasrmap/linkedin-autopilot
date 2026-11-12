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
} from 'lucide-react';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<any>({
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
  });
  const [recentPosts, setRecentPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
        setMetrics(aData.metrics);
      }

      if (postsRes.ok) {
        const pData = await postsRes.json();
        setRecentPosts(pData.posts || []);
      }
    } catch (e) {
      console.error('Failed to load dashboard:', e);
    } finally {
      setLoading(false);
    }
  };

  const upcomingScheduled = recentPosts.filter((p) => p.status === 'scheduled').slice(0, 4);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner / Greeting */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            LinkedIn Autopilot Dashboard
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Centralized publishing, automated scheduling, and AI studio for GT InnoX LLP.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/ai-studio"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100/50 transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            AI Studio
          </Link>
          <Link
            href="/composer"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-600/30 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            Create Post
          </Link>
        </div>
      </div>

      {/* Onboarding Alert if no accounts are connected */}
      {metrics.accountsConnected === 0 && !loading && (
        <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white flex-shrink-0">
              <Linkedin className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-sm text-blue-900 dark:text-blue-100">
                Connect your LinkedIn Account
              </div>
              <div className="text-xs text-blue-700 dark:text-blue-300">
                To start scheduling and automatically publishing posts, connect your personal profile or company page.
              </div>
            </div>
          </div>
          <Link
            href="/accounts"
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors text-center"
          >
            Connect LinkedIn
          </Link>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Published */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Published</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            {metrics.publishedCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            Live posts on LinkedIn
          </div>
        </div>

        {/* Scheduled */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Scheduled In Queue</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            {metrics.scheduledCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-blue-500" />
            Automated by BullMQ worker
          </div>
        </div>

        {/* Drafts */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Drafts Saved</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            {metrics.draftCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Ready for review or scheduling</div>
        </div>

        {/* Failed */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Failed Attempts</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            {metrics.failedCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Retryable with 1-click</div>
        </div>
      </div>

      {/* Engagement Stats Grid (Real Data / Official Notice) */}
      <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">LinkedIn Engagement Analytics</h2>
            <p className="text-xs text-slate-400">Official engagement metrics retrieved via LinkedIn REST API</p>
          </div>
          <Link href="/analytics" className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
            View Analytics <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Eye className="w-3.5 h-3.5 text-blue-500" /> Impressions
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
              {metrics.engagement.impressions !== null ? metrics.engagement.impressions : 'Not Available'}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ThumbsUp className="w-3.5 h-3.5 text-emerald-500" /> Reactions
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
              {metrics.engagement.reactions !== null ? metrics.engagement.reactions : 'Not Available'}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <MessageSquare className="w-3.5 h-3.5 text-indigo-500" /> Comments
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
              {metrics.engagement.comments !== null ? metrics.engagement.comments : 'Not Available'}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Repeat2 className="w-3.5 h-3.5 text-amber-500" /> Reposts
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
              {metrics.engagement.reposts !== null ? metrics.engagement.reposts : 'Not Available'}
            </div>
          </div>
        </div>

        {metrics.engagement.notice && (
          <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/40 text-[11px] text-slate-400 border border-slate-200/50 dark:border-slate-800/50">
            <AlertCircle className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
            <span>{metrics.engagement.notice}</span>
          </div>
        )}
      </div>

      {/* Dual Column: Upcoming Scheduled & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Scheduled Posts */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              Upcoming Scheduled Posts
            </div>
            <Link href="/posts?tab=scheduled" className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              View All
            </Link>
          </div>

          <div className="flex-1 space-y-3">
            {upcomingScheduled.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                No scheduled posts in the queue.
                <div className="mt-2">
                  <Link href="/composer" className="text-blue-600 dark:text-blue-400 font-semibold underline">
                    Schedule a post now
                  </Link>
                </div>
              </div>
            ) : (
              upcomingScheduled.map((post) => (
                <div
                  key={post.id}
                  className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="flex-1">
                    <p className="line-clamp-2 text-slate-800 dark:text-slate-200 font-medium">
                      {post.content}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                      <span className="flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400">
                        <Calendar className="w-3 h-3" />
                        {post.scheduled_at ? new Date(post.scheduled_at).toLocaleString() : 'Pending'}
                      </span>
                      <span>•</span>
                      <span>{post.social_account?.account_name || 'LinkedIn Account'}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              Recent Publishing Activity
            </div>
            <Link href="/posts?tab=published" className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              View History
            </Link>
          </div>

          <div className="flex-1 space-y-3">
            {recentPosts.slice(0, 4).length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                No recent activity recorded.
              </div>
            ) : (
              recentPosts.slice(0, 4).map((post) => (
                <div
                  key={post.id}
                  className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          post.status === 'published'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            : post.status === 'scheduled'
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                            : post.status === 'failed'
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                            : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20'
                        }`}
                      >
                        {post.status}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(post.created_at).toLocaleDateString()}
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

