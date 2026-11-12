'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Clock,
  CheckCircle2,
  FileText,
  AlertOctagon,
  PlusCircle,
  Trash2,
  Send,
  Calendar,
  XCircle,
  RefreshCw,
  Loader2,
  Globe,
  Building,
  User,
} from 'lucide-react';
import { Post } from '@/types';

function PostsContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'all';

  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    loadPosts();
  }, [activeTab]);

  const loadPosts = async () => {
    try {
      setLoading(true);
      const url = activeTab === 'all' ? '/api/posts' : `/api/posts?status=${activeTab}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePublishNow = async (postId: string) => {
    setActionLoading(postId);
    try {
      const res = await fetch(`/api/posts/${postId}/publish`, { method: 'POST' });
      if (res.ok) {
        await loadPosts();
      } else {
        const data = await res.json();
        alert(data.error || 'Publish failed');
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (postId: string) => {
    setActionLoading(postId);
    try {
      const res = await fetch(`/api/posts/${postId}/cancel`, { method: 'POST' });
      if (res.ok) {
        await loadPosts();
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return;
    setActionLoading(postId);
    try {
      const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Posts & Content Queue
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Monitor, publish, reschedule, and manage all LinkedIn posts.
          </p>
        </div>
        <Link
          href="/composer"
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-600/30 transition-all self-start"
        >
          <PlusCircle className="w-4 h-4" />
          Create Post
        </Link>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-1 text-xs font-semibold overflow-x-auto">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3 py-2 rounded-t-lg transition-colors ${
            activeTab === 'all'
              ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          All Posts
        </button>

        <button
          onClick={() => setActiveTab('scheduled')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg transition-colors ${
            activeTab === 'scheduled'
              ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Scheduled Queue
        </button>

        <button
          onClick={() => setActiveTab('draft')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg transition-colors ${
            activeTab === 'draft'
              ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Drafts
        </button>

        <button
          onClick={() => setActiveTab('published')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg transition-colors ${
            activeTab === 'published'
              ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Published
        </button>

        <button
          onClick={() => setActiveTab('failed')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg transition-colors ${
            activeTab === 'failed'
              ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <AlertOctagon className="w-3.5 h-3.5" />
          Failed
        </button>
      </div>

      {/* Posts List */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-12 flex justify-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : posts.length === 0 ? (
          <div className="p-12 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400">
            No posts found in this view.
          </div>
        ) : (
          posts.map((post) => {
            const isLoadingThis = actionLoading === post.id;
            return (
              <div
                key={post.id}
                className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-sm flex flex-col md:flex-row items-start justify-between gap-4 text-xs"
              >
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        post.status === 'published'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : post.status === 'scheduled'
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                          : post.status === 'failed'
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                          : post.status === 'processing'
                          ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                          : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20'
                      }`}
                    >
                      {post.status}
                    </span>

                    <span className="text-slate-400">
                      Type: <span className="font-semibold capitalize">{post.post_type}</span>
                    </span>

                    {post.social_account && (
                      <span className="text-slate-400 flex items-center gap-1">
                        • Destination:{' '}
                        <span className="font-semibold text-slate-700 dark:text-slate-300 inline-flex items-center gap-1">
                          {post.social_account.account_type === 'organization' ? (
                            <>
                              <Building className="w-3 h-3 text-indigo-500" />
                              {post.social_account.account_name} (Company Page)
                            </>
                          ) : (
                            <>
                              <User className="w-3 h-3 text-blue-500" />
                              {post.social_account.account_name} (Personal)
                            </>
                          )}
                        </span>
                      </span>
                    )}

                    {post.scheduled_at && (
                      <span className="text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1">
                        • <Calendar className="w-3 h-3" />
                        {new Date(post.scheduled_at).toLocaleString()}
                      </span>
                    )}
                  </div>

                  <p className="text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {post.content}
                  </p>

                  {post.error_message && (
                    <div className="p-2 rounded bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40 text-[11px]">
                      Error: {post.error_message}
                    </div>
                  )}

                  {post.provider_post_id && (
                    <div className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Globe className="w-3 h-3 text-blue-500" />
                      LinkedIn ID: <span className="font-mono">{post.provider_post_id}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end md:self-center flex-shrink-0">
                  {post.status !== 'published' && (
                    <button
                      onClick={() => handlePublishNow(post.id)}
                      disabled={isLoadingThis}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                      title="Publish to LinkedIn Now"
                    >
                      {isLoadingThis ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      Publish Now
                    </button>
                  )}

                  {post.status === 'scheduled' && (
                    <button
                      onClick={() => handleCancel(post.id)}
                      disabled={isLoadingThis}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300"
                    >
                      <XCircle className="w-3 h-3" />
                      Cancel
                    </button>
                  )}

                  {post.status === 'failed' && (
                    <button
                      onClick={() => handlePublishNow(post.id)}
                      disabled={isLoadingThis}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 transition-colors"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Retry
                    </button>
                  )}

                  <button
                    onClick={() => handleDelete(post.id)}
                    disabled={isLoadingThis}
                    className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function PostsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Loading posts...</div>}>
      <PostsContent />
    </Suspense>
  );
}
