'use client';

import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Eye,
  ThumbsUp,
  MessageSquare,
  Repeat2,
  AlertCircle,
  ShieldAlert,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
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

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-500" />
          LinkedIn Engagement Analytics
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Official engagement data, post-level performance, and API metrics telemetry.
        </p>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : (
        <>
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827]">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Total Published</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
                {metrics?.publishedCount || 0}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Live on LinkedIn</div>
            </div>

            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827]">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Impressions</span>
                <Eye className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
                {metrics?.engagement?.impressions !== null ? metrics?.engagement?.impressions : 'Not Available'}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {metrics?.engagement?.impressions !== null ? 'Aggregated reach' : 'Permission restricted'}
              </div>
            </div>

            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827]">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Reactions</span>
                <ThumbsUp className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
                {metrics?.engagement?.reactions !== null ? metrics?.engagement?.reactions : 'Not Available'}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {metrics?.engagement?.reactions !== null ? 'Likes & Reactions' : 'Permission restricted'}
              </div>
            </div>

            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827]">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Comments & Reposts</span>
                <MessageSquare className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
                {metrics?.engagement?.comments !== null ? metrics?.engagement?.comments : 'Not Available'}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {metrics?.engagement?.comments !== null ? 'Discussions' : 'Permission restricted'}
              </div>
            </div>
          </div>

          {/* Official LinkedIn API Permission Explainer */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 space-y-2 text-xs">
            <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
              <ShieldAlert className="w-4 h-4 text-blue-500" />
              Official LinkedIn API Data Policy Notice
            </div>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
              LinkedIn strictly restricts member-level analytics to verified developer partners via the{' '}
              <strong className="text-slate-700 dark:text-slate-300">Community Management API</strong> and{' '}
              <strong className="text-slate-700 dark:text-slate-300">Organizational Entity Share Statistics</strong>.
              In accordance with GT InnoX product principles, LinkedIn Autopilot never fabricates or randomizes analytics numbers.
              When approved permissions are connected, real-time statistics automatically populate this dashboard.
            </p>
          </div>

          {/* Post-Level Breakdown */}
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Published Posts History
            </h2>

            {posts.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No published posts to display yet.
              </div>
            ) : (
              <div className="space-y-3">
                {posts.map((post) => (
                  <div
                    key={post.id}
                    className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex-1">
                      <p className="line-clamp-2 font-medium text-slate-800 dark:text-slate-200">
                        {post.content}
                      </p>
                      <div className="text-[10px] text-slate-400 mt-1">
                        Published on {post.published_at ? new Date(post.published_at).toLocaleString() : 'N/A'} • {post.social_account?.account_name || 'LinkedIn'}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-shrink-0">
                      <span className="font-mono bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px]">
                        ID: {post.provider_post_id?.slice(0, 15)}...
                      </span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        Confirmed Live
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

