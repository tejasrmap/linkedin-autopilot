'use client';

import React, { useState, useEffect, useCallback, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Modal } from '@/components/ui/modal';
import { PageHeader, ActionButton, StatusPill, Screen } from '@/components/magicpath/common';
import { Icon } from '@/components/magicpath/icons';
import { Post } from '@/types';

function PostsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'all';
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingPost, setViewingPost] = useState<Post | null>(null);
  const [deletePostId, setDeletePostId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const getWorkspaceHeader = useCallback((): Record<string, string> => {
    if (typeof window === 'undefined') return {};
    try {
      const ws = JSON.parse(sessionStorage.getItem('autopilot_current_ws') || '{}');
      return ws.id ? { 'x-workspace-id': String(ws.id) } : {};
    } catch {
      return {};
    }
  }, []);

  const loadPosts = useCallback(async () => {
    try {
      setLoading(true);
      const url = activeTab === 'all' ? '/api/posts' : `/api/posts?status=${activeTab}`;
      const res = await fetch(url, {
        headers: getWorkspaceHeader(),
      });
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      }
    } catch (e: any) {
      toast.error('Failed to load posts: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [activeTab, toast, getWorkspaceHeader]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const handleDelete = async () => {
    if (!deletePostId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/posts/${deletePostId}`, {
        method: 'DELETE',
        headers: getWorkspaceHeader(),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete post');
      }
      toast.success('Post removed successfully.');
      setDeletePostId(null);
      loadPosts();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      if (!searchQuery) return true;
      return (
        p.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.status?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [posts, searchQuery]);

  const screenName: Screen =
    activeTab === 'scheduled'
      ? 'scheduled'
      : activeTab === 'draft'
      ? 'drafts'
      : activeTab === 'published'
      ? 'published'
      : 'overview';

  const tabTitle =
    activeTab === 'scheduled'
      ? 'Scheduled Posts'
      : activeTab === 'draft'
      ? 'Drafts'
      : activeTab === 'published'
      ? 'Published Posts'
      : 'All Posts';

  const tabSubtitle =
    activeTab === 'scheduled'
      ? 'Everything queued for the days ahead.'
      : activeTab === 'draft'
      ? 'Ideas in progress, ready when you are.'
      : activeTab === 'published'
      ? 'A history of what you’ve shared.'
      : 'Manage all content across your LinkedIn workspace.';

  return (
    <>
      <PageHeader
        title={tabTitle}
        subtitle={tabSubtitle}
        action={activeTab === 'draft' ? 'New draft' : 'Create post'}
        actionHref="/composer"
      />

      <section className="panel list-panel">
        <div className="list-controls">
          <div className="search-field">
            <Icon name="search" size={16} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search posts"
              aria-label="Search posts"
            />
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            {['all', 'scheduled', 'draft', 'published'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setActiveTab(tab);
                  router.push(tab === 'all' ? '/posts' : `/posts?tab=${tab}`);
                }}
                className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-secondary'}`}
                style={{ textTransform: 'capitalize' }}
              >
                {tab === 'draft' ? 'Drafts' : tab}
              </button>
            ))}
          </div>

          <button type="button" className="view-toggle">
            Newest first <Icon name="chevron" size={14} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontSize: '12px' }}>
            Loading posts…
          </div>
        ) : filteredPosts.length > 0 ? (
          <div className="post-list">
            {filteredPosts.map((post) => {
              const statusLower = post.status.toLowerCase();
              const colorClass =
                statusLower === 'published'
                  ? 'blue'
                  : statusLower === 'scheduled'
                  ? 'violet'
                  : 'mint';
              const iconName =
                statusLower === 'published' ? 'check' : statusLower === 'scheduled' ? 'clock' : 'file';

              const formattedTime = post.scheduled_at
                ? new Date(post.scheduled_at).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : new Date(post.created_at).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                  });

              return (
                <div
                  key={post.id}
                  className="post-row"
                  onClick={() => setViewingPost(post)}
                  style={{ cursor: 'pointer' }}
                >
                  <span className={`post-mark mark-${colorClass}`}>
                    <Icon name={iconName} size={16} />
                  </span>
                  <span className="post-copy">
                    <strong>{post.content?.substring(0, 80) || 'Untitled post'}</strong>
                    <small>
                      {formattedTime} <span>·</span> {post.post_type || 'Text post'}
                    </small>
                  </span>
                  <StatusPill>{post.status}</StatusPill>
                  <Icon name="chevron" size={16} />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <span className="empty-icon">
              <Icon name={activeTab === 'scheduled' ? 'calendar' : 'file'} size={20} />
            </span>
            <h3>No {activeTab} posts found</h3>
            <p>
              {searchQuery
                ? 'Try a different search query.'
                : 'Your posts will show here when they’re ready.'}
            </p>
            {!searchQuery && (
              <ActionButton onClick={() => router.push('/composer')}>
                Create a post <Icon name="arrow" size={15} />
              </ActionButton>
            )}
          </div>
        )}
      </section>

      {/* Post Details Modal */}
      {viewingPost && (
        <Modal
          isOpen={true}
          onClose={() => setViewingPost(null)}
          title={`Post Details · ${viewingPost.status}`}
        >
          <div className="space-y-4">
            <div
              style={{
                background: 'var(--surface-soft)',
                border: '1px solid var(--line)',
                borderRadius: '8px',
                padding: '14px',
                fontSize: '12px',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                maxHeight: '300px',
                overflowY: 'auto',
              }}
            >
              {viewingPost.content}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--muted)' }}>
              <span>Type: {viewingPost.post_type || 'text'}</span>
              <span>
                {viewingPost.scheduled_at
                  ? `Scheduled: ${new Date(viewingPost.scheduled_at).toLocaleString()}`
                  : `Created: ${new Date(viewingPost.created_at).toLocaleString()}`}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid var(--line)' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  const id = viewingPost.id;
                  setViewingPost(null);
                  setDeletePostId(id);
                }}
                style={{ color: '#e05252' }}
              >
                Delete
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <ActionButton
                  kind="secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(viewingPost.content);
                    toast.success('Post content copied to clipboard');
                  }}
                >
                  <Icon name="copy" size={14} /> Copy text
                </ActionButton>

                <ActionButton
                  onClick={() => {
                    router.push(`/composer?draftId=${viewingPost.id}`);
                  }}
                >
                  Edit in Composer <Icon name="arrow" size={14} />
                </ActionButton>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deletePostId}
        onClose={() => setDeletePostId(null)}
        onConfirm={handleDelete}
        title="Delete Post"
        message="Are you sure you want to delete this post? This action cannot be undone."
        confirmText={deleting ? 'Deleting…' : 'Delete'}
        variant="danger"
      />
    </>
  );
}

export default function PostsPage() {
  return (
    <Suspense fallback={<div className="panel" style={{ padding: '30px' }}>Loading posts…</div>}>
      <PostsContent />
    </Suspense>
  );
}
