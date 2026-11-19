'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { PageHeader, ActionButton } from '@/components/magicpath/common';
import { Icon } from '@/components/magicpath/icons';
import { SocialAccount } from '@/types';

function ComposerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialContent = searchParams.get('content') || searchParams.get('template') || '';
  const initialDraftId = searchParams.get('draftId') || null;
  const initialTone = searchParams.get('tone') || null;
  const isFromAi = searchParams.get('fromAi') === 'true';
  const toast = useToast();

  const [content, setContent] = useState(initialContent);
  const [draftId, setDraftId] = useState<string | null>(initialDraftId);
  const [sourceTone, setSourceTone] = useState<string | null>(initialTone);
  const [saveStatus, setSaveStatus] = useState<
    'idle' | 'unsaved' | 'saving' | 'saved' | 'error' | 'conflict' | 'offline'
  >('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [lastSavedUpdatedAt, setLastSavedUpdatedAt] = useState<string | null>(null);
  const [hasUserModified, setHasUserModified] = useState(false);
  const [postType, setPostType] = useState<'text' | 'image' | 'video' | 'document'>('text');
  const [accounts, setAccounts] = useState<SocialAccount[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem('autopilot_accounts');
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return [];
  });
  const [accountsLoading, setAccountsLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      return !sessionStorage.getItem('autopilot_accounts');
    }
    return true;
  });
  const [selectedAccount, setSelectedAccount] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem('autopilot_accounts');
        if (cached) {
          const parsed = JSON.parse(cached);
          const firstMember = parsed.find((a: any) => a.account_type === 'member') || parsed[0];
          if (firstMember) return firstMember.id;
        }
      } catch {}
    }
    return '';
  });
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [mediaAssets, setMediaAssets] = useState<any[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [timezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [submitting, setSubmitting] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const getStorageKey = useCallback(() => {
    if (typeof window === 'undefined') return 'autopilot_composer_draft';
    try {
      const ws = JSON.parse(sessionStorage.getItem('autopilot_current_ws') || '{}');
      const user = JSON.parse(sessionStorage.getItem('autopilot_user') || '{}');
      const wsId = ws.id || 'default_ws';
      const userId = user.id || 'default_user';
      return `autopilot_draft_${wsId}_${userId}`;
    } catch {
      return 'autopilot_composer_draft';
    }
  }, []);

  const getWorkspaceHeader = useCallback((): Record<string, string> => {
    if (typeof window === 'undefined') return {};
    try {
      const ws = JSON.parse(sessionStorage.getItem('autopilot_current_ws') || '{}');
      return ws.id ? { 'x-workspace-id': String(ws.id) } : {};
    } catch {
      return {};
    }
  }, []);

  // Restore draft on initial mount
  useEffect(() => {
    let mounted = true;

    async function restoreDraft() {
      if (initialDraftId) {
        try {
          const res = await fetch(`/api/posts/${initialDraftId}`, {
            headers: getWorkspaceHeader(),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.post && mounted) {
              if (initialContent && isFromAi) {
                setContent(initialContent);
                setHasUserModified(true);
              } else {
                setContent(data.post.content || '');
              }
              setDraftId(data.post.id);
              if (data.post.post_type) setPostType(data.post.post_type);
              if (data.post.social_account_id) setSelectedAccount(data.post.social_account_id);
              if (data.post.media_assets) setMediaAssets(data.post.media_assets);
              setLastSavedUpdatedAt(data.post.updated_at);
              setSaveStatus('saved');
              setLastSavedAt(new Date(data.post.updated_at));
              return;
            }
          }
        } catch {
          // Fall through to local storage if network fails
        }
      }

      if (initialContent) {
        setContent(initialContent);
        setHasUserModified(true);
        setSaveStatus('unsaved');
        return;
      }

      // Check local storage for uncommitted drafts
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem(getStorageKey());
          if (raw) {
            const cached = JSON.parse(raw);
            if (cached.content && mounted) {
              setContent(cached.content);
              if (cached.draftId) setDraftId(cached.draftId);
              if (cached.postType) setPostType(cached.postType);
              if (cached.selectedAccount) setSelectedAccount(cached.selectedAccount);
              if (cached.mediaAssets) setMediaAssets(cached.mediaAssets);
              if (cached.tone) setSourceTone(cached.tone);
              setSaveStatus('saved');
              toast.info('Restored in-progress draft from your last session');
            }
          }
        } catch {}
      }
    }

    restoreDraft();
    return () => {
      mounted = false;
    };
  }, [initialDraftId, initialContent, isFromAi, getStorageKey, getWorkspaceHeader, toast]);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch('/api/linkedin/accounts');
      if (res.ok) {
        const data = await res.json();
        const accs: SocialAccount[] = data.accounts || [];
        setAccounts(accs);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('autopilot_accounts', JSON.stringify(accs));
        }
        if (accs.length > 0 && !selectedAccount) {
          const firstMember = accs.find((a) => a.account_type === 'member') || accs[0];
          setSelectedAccount(firstMember.id);
        }
      }
    } catch (e: any) {
      toast.error('Failed to load LinkedIn accounts: ' + e.message);
    } finally {
      setAccountsLoading(false);
    }
  }, [selectedAccount, toast]);

  useEffect(() => {
    fetchAccounts();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setScheduledDate(tomorrow.toISOString().split('T')[0]);
    setScheduledTime('10:00');
  }, [fetchAccounts]);

  // Autosave execution function
  const triggerAutosave = useCallback(
    async (forced = false) => {
      if (!content.trim()) return;
      if (!hasUserModified && !forced) return;

      setSaveStatus('saving');

      try {
        if (draftId) {
          const res = await fetch(`/api/posts/${draftId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              ...getWorkspaceHeader(),
            },
            body: JSON.stringify({
              content,
              postType,
              socialAccountId: selectedAccount || null,
              mediaAssets,
              status: 'draft',
              expectedUpdatedAt: lastSavedUpdatedAt || undefined,
            }),
          });

          if (res.status === 409) {
            setSaveStatus('conflict');
            toast.error('Conflict: Draft was updated in another session.');
            return;
          }

          if (!res.ok) {
            throw new Error('Autosave failed');
          }

          const data = await res.json();
          setLastSavedUpdatedAt(data.post.updated_at);
          setSaveStatus('saved');
          setLastSavedAt(new Date());
        } else {
          const res = await fetch('/api/posts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getWorkspaceHeader(),
            },
            body: JSON.stringify({
              content,
              postType,
              socialAccountId: selectedAccount || null,
              mediaAssets,
              status: 'draft',
            }),
          });

          if (!res.ok) {
            throw new Error('Initial draft creation failed');
          }

          const data = await res.json();
          const newId = data.post.id;
          setDraftId(newId);
          setLastSavedUpdatedAt(data.post.updated_at);
          setSaveStatus('saved');
          setLastSavedAt(new Date());

          if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            params.set('draftId', newId);
            if (sourceTone) params.set('tone', sourceTone);
            window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
          }
        }
      } catch {
        setSaveStatus('error');
      }
    },
    [
      content,
      hasUserModified,
      draftId,
      postType,
      selectedAccount,
      mediaAssets,
      lastSavedUpdatedAt,
      getWorkspaceHeader,
      sourceTone,
      toast,
    ]
  );

  // Debounced autosave effect
  useEffect(() => {
    if (!hasUserModified) return;

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          getStorageKey(),
          JSON.stringify({
            draftId,
            content,
            postType,
            selectedAccount,
            mediaAssets,
            tone: sourceTone,
            updatedAt: Date.now(),
          })
        );
      } catch {}
    }

    setSaveStatus('unsaved');
    const timer = setTimeout(() => {
      triggerAutosave();
    }, 1500);

    return () => clearTimeout(timer);
  }, [
    content,
    postType,
    selectedAccount,
    mediaAssets,
    hasUserModified,
    triggerAutosave,
    getStorageKey,
    draftId,
    sourceTone,
  ]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingMedia(true);
    try {
      const file = files[0];
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Upload failed');
      }

      const data = await res.json();
      setMediaAssets([data.media]);
      if (file.type.startsWith('image/')) setPostType('image');
      else if (file.type.startsWith('video/')) setPostType('video');
      else setPostType('document');

      setHasUserModified(true);
      toast.success(`Media attached: ${file.name}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploadingMedia(false);
    }
  };

  const removeMedia = () => {
    setMediaAssets([]);
    setPostType('text');
    setHasUserModified(true);
    toast.info('Media attachment removed');
  };

  const handleSavePost = async (publishNow = false, asDraft = false) => {
    if (submitting) return;

    if (!content.trim()) {
      toast.error('Please enter post content.');
      return;
    }

    if (!selectedAccount && !asDraft) {
      toast.error('Please select a LinkedIn destination before publishing.');
      return;
    }

    setSubmitting(true);

    let finalScheduledAt: string | null = null;
    if (scheduleMode && !publishNow && !asDraft) {
      if (!scheduledDate || !scheduledTime) {
        toast.error('Please select both date and time for scheduling.');
        setSubmitting(false);
        return;
      }
      const combined = new Date(`${scheduledDate}T${scheduledTime}:00`);
      if (combined.getTime() <= Date.now()) {
        toast.error('Scheduled time must be in the future.');
        setSubmitting(false);
        return;
      }
      finalScheduledAt = combined.toISOString();
    }

    try {
      if (asDraft) {
        if (draftId) {
          const res = await fetch(`/api/posts/${draftId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              ...getWorkspaceHeader(),
            },
            body: JSON.stringify({
              content,
              socialAccountId: selectedAccount || null,
              postType,
              mediaAssets,
              status: 'draft',
              expectedUpdatedAt: lastSavedUpdatedAt || undefined,
            }),
          });
          if (res.status === 409) {
            setSaveStatus('conflict');
            toast.error('Conflict: Draft was modified in another session.');
            setSubmitting(false);
            return;
          }
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to update draft');
          setLastSavedUpdatedAt(data.post.updated_at);
          setSaveStatus('saved');
          setLastSavedAt(new Date());
          toast.success('Draft saved successfully.');
        } else {
          const res = await fetch('/api/posts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getWorkspaceHeader(),
            },
            body: JSON.stringify({
              content,
              socialAccountId: selectedAccount || null,
              postType,
              mediaAssets,
              status: 'draft',
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to save draft');
          setDraftId(data.post.id);
          setLastSavedUpdatedAt(data.post.updated_at);
          setSaveStatus('saved');
          setLastSavedAt(new Date());
          toast.success('Draft saved successfully.');
        }

        setTimeout(() => {
          router.push('/posts?tab=draft');
        }, 600);
        return;
      }

      if (scheduleMode && !publishNow) {
        const targetPostId = draftId;
        if (targetPostId) {
          const updateRes = await fetch(`/api/posts/${targetPostId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              ...getWorkspaceHeader(),
            },
            body: JSON.stringify({
              content,
              socialAccountId: selectedAccount || null,
              postType,
              mediaAssets,
              scheduledAt: finalScheduledAt,
              timezone,
              expectedUpdatedAt: lastSavedUpdatedAt || undefined,
            }),
          });
          if (updateRes.status === 409) {
            setSaveStatus('conflict');
            toast.error('Conflict: Draft was modified in another session.');
            setSubmitting(false);
            return;
          }
          if (!updateRes.ok) {
            const err = await updateRes.json();
            throw new Error(err.error || 'Failed to update draft before scheduling');
          }
          const schedRes = await fetch(`/api/posts/${targetPostId}/schedule`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getWorkspaceHeader(),
            },
            body: JSON.stringify({
              scheduledAt: finalScheduledAt,
              timezone,
            }),
          });
          const schedData = await schedRes.json();
          if (!schedRes.ok) throw new Error(schedData.error || 'Failed to schedule post');
        } else {
          const createRes = await fetch('/api/posts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getWorkspaceHeader(),
            },
            body: JSON.stringify({
              content,
              socialAccountId: selectedAccount || null,
              postType,
              mediaAssets,
              status: 'scheduled',
              scheduledAt: finalScheduledAt,
              timezone,
            }),
          });
          const createData = await createRes.json();
          if (!createRes.ok) throw new Error(createData.error || 'Failed to create and schedule post');
        }

        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem(getStorageKey());
          } catch {}
        }

        toast.success('Post scheduled in queue! 🚀');
        setTimeout(() => {
          router.push('/posts?tab=scheduled');
        }, 600);
        return;
      }

      if (publishNow) {
        const targetPostId = draftId;
        if (targetPostId) {
          const updateRes = await fetch(`/api/posts/${targetPostId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              ...getWorkspaceHeader(),
            },
            body: JSON.stringify({
              content,
              socialAccountId: selectedAccount || null,
              postType,
              mediaAssets,
              expectedUpdatedAt: lastSavedUpdatedAt || undefined,
            }),
          });
          if (updateRes.status === 409) {
            setSaveStatus('conflict');
            toast.error('Conflict: Draft was modified in another session.');
            setSubmitting(false);
            return;
          }
          if (!updateRes.ok) {
            const err = await updateRes.json();
            throw new Error(err.error || 'Failed to update draft before publishing');
          }
          const pubRes = await fetch(`/api/posts/${targetPostId}/publish`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getWorkspaceHeader(),
            },
          });
          const pubData = await pubRes.json();
          if (!pubRes.ok) throw new Error(pubData.error || 'Publishing failed');
        } else {
          const createRes = await fetch('/api/posts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getWorkspaceHeader(),
            },
            body: JSON.stringify({
              content,
              socialAccountId: selectedAccount || null,
              postType,
              mediaAssets,
              publishNow: true,
            }),
          });
          const createData = await createRes.json();
          if (!createRes.ok) throw new Error(createData.error || 'Publishing failed');
          if (!createData.published) {
            throw new Error(createData.error || 'Publishing failed. Post saved in drafts.');
          }
        }

        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem(getStorageKey());
          } catch {}
        }

        toast.success('Post published successfully to LinkedIn! 🎉');
        setTimeout(() => {
          router.push('/posts?tab=published');
        }, 600);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendToAiRewrite = () => {
    if (!content.trim()) {
      toast.error('Enter some text first to rewrite it.');
      return;
    }
    const params = new URLSearchParams();
    params.set('tab', 'rewrite');
    params.set('content', content);
    if (draftId) params.set('draftId', draftId);
    if (sourceTone) params.set('tone', sourceTone);
    router.push(`/ai-studio?${params.toString()}`);
  };

  const currentAcc = accounts.find((a) => a.id === selectedAccount);
  const accountDisplayName = currentAcc?.account_name || 'Personal profile';
  const accountSubtitle =
    currentAcc?.account_type === 'organization' ? 'Company page' : 'Personal profile';

  const renderSaveStatusText = () => {
    if (saveStatus === 'saving') return 'Saving draft…';
    if (saveStatus === 'saved') {
      return lastSavedAt ? `Saved ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Saved just now';
    }
    if (saveStatus === 'unsaved') return 'Unsaved edits';
    if (saveStatus === 'conflict') return 'Conflict: edited elsewhere';
    if (saveStatus === 'error') return 'Save failed · Retrying';
    return 'Draft ready';
  };

  return (
    <>
      <PageHeader screen="composer" />

      {/* Composer Toolbar: Account Selector & Draft Status */}
      <div className="composer-toolbar">
        <div style={{ position: 'relative' }}>
          <div
            className="account-select"
            onClick={() => setShowAccountDropdown(!showAccountDropdown)}
            style={{ cursor: 'pointer' }}
          >
            <span className="linkedin-avatar">
              <Icon name="linkedin" size={16} />
            </span>
            <span>
              <b>{accountDisplayName}</b>
              <small>{accountSubtitle}</small>
            </span>
            <Icon name="chevron" size={15} />
          </div>

          {showAccountDropdown && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                left: 0,
                width: '240px',
                zIndex: 30,
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: '9px',
                padding: '6px',
                boxShadow: 'var(--shadow)',
              }}
            >
              {accounts.length === 0 ? (
                <div style={{ padding: '8px', fontSize: '11px', color: 'var(--muted)' }}>
                  No accounts found. Connect one in Accounts.
                </div>
              ) : (
                accounts.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => {
                      setSelectedAccount(acc.id);
                      setShowAccountDropdown(false);
                      setHasUserModified(true);
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 8px',
                      borderRadius: '6px',
                      background: selectedAccount === acc.id ? 'var(--sidebar)' : 'transparent',
                      border: 0,
                      cursor: 'pointer',
                      fontSize: '11px',
                      color: 'var(--ink)',
                      textAlign: 'left',
                    }}
                  >
                    <span>
                      <b>{acc.account_name}</b>
                      <small style={{ display: 'block', color: 'var(--muted)', fontSize: '10px' }}>
                        {acc.account_type === 'organization' ? 'Company Page' : 'Personal Profile'}
                      </small>
                    </span>
                    {selectedAccount === acc.id && <Icon name="check" size={14} />}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <span className="draft-saved">
          <i /> {renderSaveStatusText()}
        </span>
      </div>

      {/* Editor & Preview Grid */}
      <div className="composer-grid">
        <section className="panel editor-panel">
          <div className="editor-top">
            <h3>Your post</h3>
            <button
              type="button"
              className="text-button"
              onClick={handleSendToAiRewrite}
              title="Enhance or change tone in AI Studio"
            >
              <Icon name="sparkles" size={15} /> Write with AI
            </button>
          </div>

          <textarea
            className="composer-textarea"
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setHasUserModified(true);
            }}
            placeholder="What would you like your network to know?"
            aria-label="Post content"
          />

          {/* Attached Media Pill */}
          {mediaAssets.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 10px',
                margin: '8px 0',
                background: 'var(--brand-soft)',
                border: '1px solid var(--brand-line)',
                borderRadius: '8px',
                fontSize: '11px',
              }}
            >
              <Icon name="image" size={15} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {mediaAssets[0].name || 'Attached file'}
              </span>
              <button
                type="button"
                onClick={removeMedia}
                style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--muted)' }}
                title="Remove attachment"
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          )}

          <div className="editor-footer">
            <div className="editor-tools">
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  color: 'var(--muted)',
                }}
              >
                <input
                  type="file"
                  accept="image/*,video/*,application/pdf"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <Icon name="image" size={17} />
                <span>{uploadingMedia ? 'Uploading…' : 'Add media'}</span>
              </label>

              <button
                type="button"
                onClick={() => {
                  const tags = ' #Leadership #BuildInPublic #Innovation';
                  setContent((prev) => prev + tags);
                  setHasUserModified(true);
                  toast.info('Suggested hashtags added');
                }}
              >
                <Icon name="sparkles" size={16} /> Hashtags
              </button>
            </div>

            <span>
              {content.length} / 3,000
            </span>
          </div>

          {/* Schedule Row */}
          <div className="schedule-row">
            <div>
              <b>When should this go out?</b>
              <small>Choose a time that works for your audience.</small>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => {
                  setScheduledDate(e.target.value);
                  setScheduleMode(true);
                }}
                className="ai-text-input"
                style={{ width: '130px', padding: '4px 8px', fontSize: '11px' }}
              />
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => {
                  setScheduledTime(e.target.value);
                  setScheduleMode(true);
                }}
                className="ai-text-input"
                style={{ width: '90px', padding: '4px 8px', fontSize: '11px' }}
              />
            </div>
          </div>
        </section>

        {/* Live LinkedIn Preview */}
        <section className="preview-wrap">
          <div className="preview-label">LINKEDIN PREVIEW</div>
          <article className="linkedin-preview">
            <div className="preview-profile">
              <div className="profile-avatar" style={{ overflow: 'hidden' }}>
                {currentAcc?.profile_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentAcc.profile_image_url}
                    alt={accountDisplayName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  accountDisplayName ? accountDisplayName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : 'TG'
                )}
              </div>
              <div>
                <b>{accountDisplayName}</b>
                <small>Product builder · GT InnoX</small>
                <small>
                  Just now · <Icon name="globe" size={11} />
                </small>
              </div>
              <button type="button" className="plain-icon">
                <Icon name="more" size={18} />
              </button>
            </div>

            <p className="preview-copy">
              {content || 'Your post preview will appear here as you write.'}
            </p>

            {mediaAssets.length > 0 && (
              <div
                style={{
                  margin: '10px 0',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  background: 'var(--surface-soft)',
                  border: '1px solid var(--line)',
                  padding: '12px',
                  textAlign: 'center',
                  fontSize: '11px',
                  color: 'var(--muted)',
                }}
              >
                📎 Media attachment ({mediaAssets[0].name || 'preview'})
              </div>
            )}

            <div className="preview-reactions">
              <span>👍 ❤️ 👏</span>
              <span>42 reactions · 8 comments</span>
            </div>
            <div className="preview-divider" />
            <div className="preview-buttons">
              <span>Like</span>
              <span>Comment</span>
              <span>Repost</span>
              <span>Send</span>
            </div>
          </article>
          <div className="preview-tip">
            <Icon name="sparkles" size={15} />
            <span>Posts with a clear first line invite people to keep reading.</span>
          </div>
        </section>
      </div>

      {/* Composer Bottom Actions */}
      <div className="composer-bottom">
        <button
          type="button"
          className="text-button"
          onClick={() => handleSavePost(false, true)}
          disabled={submitting}
        >
          Save draft
        </button>

        <div style={{ display: 'flex', gap: '8px' }}>
          <ActionButton
            kind="secondary"
            onClick={() => handleSavePost(true, false)}
            disabled={submitting || !content.trim()}
          >
            Publish now
          </ActionButton>

          <ActionButton
            kind="primary"
            onClick={() => handleSavePost(false, false)}
            disabled={submitting || !content.trim()}
          >
            {submitting ? 'Scheduling…' : 'Schedule post'} <Icon name="arrow" size={15} />
          </ActionButton>
        </div>
      </div>
    </>
  );
}

export default function ComposerPage() {
  return (
    <Suspense fallback={<div className="panel" style={{ padding: '30px' }}>Loading composer…</div>}>
      <ComposerContent />
    </Suspense>
  );
}
