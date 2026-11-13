'use client';

import React, { useState, useEffect, useCallback, Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Modal } from '@/components/ui/modal';
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
  Search,
  Copy,
  Check,
  ExternalLink,
  Filter,
  ChevronDown,
  ChevronUp,
  Eye,
} from 'lucide-react';
import { Post } from '@/types';

function PostsContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'all';
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [destinationFilter, setDestinationFilter] = useState<'all' | 'member' | 'organization'>('all');

  // Full Post Viewing & Inline Expansion
  const [viewingPost, setViewingPost] = useState<Post | null>(null);
  const [expandedPostIds, setExpandedPostIds] = useState<Set<string>>(new Set());

  // Delete Confirm Dialog
  const [deletePostId, setDeletePostId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copiedPostId, setCopiedPostId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedPostIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const loadPosts = useCallback(async () => {
    try {
      setLoading(true);
      const url = activeTab === 'all' ? '/api/posts' : `/api/posts?status=${activeTab}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      }
    } catch (e: any) {
      toast.error('Failed to load posts: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [activeTab, toast]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const handlePublishNow = async (postId: string) => {
    setActionLoading(postId);
    try {
      const res = await fetch(`/api/posts/${postId}/publish`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast.success('Post published live to LinkedIn! 🎉');
        await loadPosts();
      } else {
        toast.error(data.error || 'Publish failed');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (postId: string) => {
    setActionLoading(postId);
    try {
      const res = await fetch(`/api/posts/${postId}/cancel`, { method: 'POST' });
      if (res.ok) {
        toast.info('Scheduled post cancelled');
        await loadPosts();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Cancel failed');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletePostId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/posts/${deletePostId}`, { method: 'DELETE' });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== deletePostId));
        toast.success('Post removed from queue');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete post');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeleting(false);
      setDeletePostId(null);
    }
  };

  const handleCopyContent = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPostId(id);
    toast.info('Post content copied to clipboard');
    setTimeout(() => setCopiedPostId(null), 2000);
  };

  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      // Search filter
      const matchesSearch =
        !searchQuery.trim() ||
        p.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.social_account?.account_name?.toLowerCase().includes(searchQuery.toLowerCase());

      // Destination filter
      const matchesDestination =
        destinationFilter === 'all' ||
        (destinationFilter === 'member' && p.social_account?.account_type === 'member') ||
        (destinationFilter === 'organization' && p.social_account?.account_type === 'organization');

      return matchesSearch && matchesDestination;
    });
  }, [posts, searchQuery, destinationFilter]);

  const tabs = [
    { id: 'all', name: 'All Posts', icon: FileText },
    { id: 'scheduled', name: 'Scheduled', icon: Clock },
    { id: 'published', name: 'Published', icon: CheckCircle2 },
    { id: 'draft', name: 'Drafts', icon: PlusCircle },
    { id: 'failed', name: 'Failed Attempts', icon: AlertOctagon },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Publishing Queue &amp; History
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Monitor, edit, and audit personal and company page publications across workspaces.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadPosts}
            disabled={loading}
            className="w-9 h-9 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-sm"
            title="Refresh Posts"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <Link
            href="/composer"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm shadow-blue-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Create New Post</span>
          </Link>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </div>

        {/* Right Search & Destination Filter */}
        <div className="flex items-center gap-2.5">
          {/* Destination Filter */}
          <div className="relative">
            <select
              value={destinationFilter}
              onChange={(e) => setDestinationFilter(e.target.value as any)}
              className="appearance-none text-xs rounded-xl border border-slate-200/80 dark:border-slate-700/80 bg-white/95 dark:bg-[#0f172a] pl-3 pr-8 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-medium cursor-pointer shadow-sm transition-all"
            >
              <option value="all" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100 py-1.5">All Destinations</option>
              <option value="member" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100 py-1.5">Personal Profiles</option>
              <option value="organization" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100 py-1.5">Company Pages</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          {/* Search Input */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search content..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-slate-400"
            />
          </div>
        </div>
      </div>

      {/* Posts List */}
      <div className="space-y-3.5">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span>Loading publications...</span>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="p-16 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-[#0f172a]/50 text-xs text-slate-400 space-y-3">
            <FileText className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
            <div className="font-semibold text-slate-700 dark:text-slate-300">No posts found</div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {searchQuery
                ? 'No posts match your search query. Try clearing the search filter.'
                : 'There are no posts in this category yet. Create your first post to get started.'}
            </p>
            <Link
              href="/composer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition-all"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Create Post</span>
            </Link>
          </div>
        ) : (
          filteredPosts.map((post) => {
            const isLoadingThis = actionLoading === post.id;
            const isOrg = post.social_account?.account_type === 'organization';
            const isCopied = copiedPostId === post.id;

            return (
              <div
                key={post.id}
                className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl shadow-sm flex flex-col md:flex-row items-start justify-between gap-4 text-xs hover:shadow-md transition-all group"
              >
                <div className="flex-1 space-y-3 min-w-0">
                  {/* Meta Bar */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                        post.status === 'published'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : post.status === 'scheduled'
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                          : post.status === 'failed'
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                          : post.status === 'processing'
                          ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 animate-pulse'
                          : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20'
                      }`}
                    >
                      {post.status}
                    </span>

                    <span className="text-slate-400 text-[11px]">
                      Format: <span className="font-semibold capitalize text-slate-600 dark:text-slate-300">{post.post_type}</span>
                    </span>

                    {/* Destination Pill */}
                    {post.social_account && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        {isOrg ? (
                          <>
                            <Building className="w-3 h-3 text-indigo-500 flex-shrink-0" />
                            <span className="truncate max-w-[140px]">{post.social_account.account_name}</span>
                            <span className="text-[9px] uppercase px-1 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">Page</span>
                          </>
                        ) : (
                          <>
                            <User className="w-3 h-3 text-blue-500 flex-shrink-0" />
                            <span className="truncate max-w-[140px]">{post.social_account.account_name}</span>
                            <span className="text-[9px] uppercase px-1 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">Profile</span>
                          </>
                        )}
                      </span>
                    )}

                    {post.scheduled_at && (
                      <span className="text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1 text-[11px]">
                        <Calendar className="w-3 h-3" />
                        {new Date(post.scheduled_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    )}
                  </div>

                  {/* Post Content */}
                  {(() => {
                    const isExpanded = expandedPostIds.has(post.id);
                    const isLongText = (post.content || '').length > 180 || (post.content || '').includes('\n');

                    return (
                      <div className="relative">
                        <p className={`text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap ${isExpanded ? '' : 'line-clamp-3'}`}>
                          {post.content}
                        </p>

                        {isLongText && (
                          <div className="flex items-center gap-3 mt-2">
                            <button
                              onClick={() => toggleExpand(post.id)}
                              className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 transition-colors"
                            >
                              {isExpanded ? (
                                <>
                                  <span>Show less</span>
                                  <ChevronUp className="w-3 h-3" />
                                </>
                              ) : (
                                <>
                                  <span>Read entire post</span>
                                  <ChevronDown className="w-3 h-3" />
                                </>
                              )}
                            </button>

                            <button
                              onClick={() => setViewingPost(post)}
                              className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 transition-colors"
                            >
                              <Eye className="w-3 h-3" />
                              <span>View Full Post</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Error Banner if failed */}
                  {post.error_message && (
                    <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40 text-[11px] leading-relaxed">
                      <strong>Failure Note:</strong> {post.error_message}
                    </div>
                  )}

                  {/* LinkedIn Provider Post ID */}
                  {post.provider_post_id && (
                    <div className="text-[10px] text-slate-400 flex items-center gap-1.5 font-mono">
                      <Globe className="w-3 h-3 text-blue-500" />
                      <span>{post.provider_post_id}</span>
                    </div>
                  )}
                </div>

                {/* Actions Bar */}
                <div className="flex items-center gap-1.5 self-end md:self-center flex-shrink-0 pt-2 md:pt-0">
                  <button
                    onClick={() => setViewingPost(post)}
                    className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    title="View Entire Post"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleCopyContent(post.content, post.id)}
                    className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                    title="Copy Content"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>

                  {post.status !== 'published' && (
                    <button
                      onClick={() => handlePublishNow(post.id)}
                      disabled={isLoadingThis || post.status === 'processing'}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 transition-all disabled:opacity-50"
                      title="Publish Now"
                    >
                      {isLoadingThis ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      <span>Publish</span>
                    </button>
                  )}

                  {post.status === 'scheduled' && (
                    <button
                      onClick={() => handleCancel(post.id)}
                      disabled={isLoadingThis}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold transition-colors disabled:opacity-50"
                      title="Cancel Schedule"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                  )}

                  <button
                    onClick={() => setDeletePostId(post.id)}
                    disabled={isLoadingThis}
                    className="p-2 rounded-xl border border-slate-200/80 dark:border-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors disabled:opacity-50"
                    title="Delete Post"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* View Entire Post Modal */}
      {viewingPost && (
        <Modal
          isOpen={!!viewingPost}
          onClose={() => setViewingPost(null)}
          title="Publication Details"
          description={
            viewingPost.social_account
              ? `Destination: ${viewingPost.social_account.account_name} (${
                  viewingPost.social_account.account_type === 'organization' ? 'Company Page' : 'Personal Profile'
                })`
              : 'LinkedIn Post'
          }
          maxWidth="lg"
          footer={
            <div className="flex items-center justify-between w-full">
              <div className="text-[11px] text-slate-400 font-mono">
                {(viewingPost.content || '').length} / 3000 chars
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyContent(viewingPost.content, viewingPost.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors"
                >
                  {copiedPostId === viewingPost.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy Text</span>
                </button>

                <Link
                  href={`/composer?content=${encodeURIComponent(viewingPost.content)}`}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition-all"
                >
                  <span>Edit in Composer</span>
                </Link>

                <button
                  type="button"
                  onClick={() => setViewingPost(null)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          }
        >
          <div className="space-y-4">
            {/* Meta Bar */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                    viewingPost.status === 'published'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : viewingPost.status === 'scheduled'
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                      : viewingPost.status === 'failed'
                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                      : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20'
                  }`}
                >
                  {viewingPost.status}
                </span>
                <span className="text-slate-500">
                  Format: <strong className="capitalize text-slate-700 dark:text-slate-300">{viewingPost.post_type}</strong>
                </span>
              </div>

              {viewingPost.scheduled_at && (
                <span className="text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(viewingPost.scheduled_at).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </div>

            {/* Entire Post Box */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 leading-relaxed whitespace-pre-wrap font-sans text-xs max-h-[50vh] overflow-y-auto selection:bg-blue-500 selection:text-white">
              {viewingPost.content}
            </div>

            {/* Failure Info if any */}
            {viewingPost.error_message && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/40 text-xs">
                <strong>Failure Reason:</strong> {viewingPost.error_message}
              </div>
            )}

            {/* Provider Post URN */}
            {viewingPost.provider_post_id && (
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-500 flex items-center gap-2 font-mono">
                <Globe className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                <span className="truncate">{viewingPost.provider_post_id}</span>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deletePostId}
        onClose={() => setDeletePostId(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Publication"
        message="Are you sure you want to delete this publication? This action removes the post from your queue and cannot be undone."
        confirmText="Delete Post"
        variant="danger"
        loading={deleting}
      />
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
