'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import {
  Send,
  Calendar,
  Save,
  Image as ImageIcon,
  Video,
  FileText,
  Sparkles,
  Trash2,
  Linkedin,
  AlertCircle,
  CheckCircle2,
  Globe,
  MessageSquare,
  ThumbsUp,
  Share2,
  Loader2,
  Building,
  User,
  Plus,
  Clock,
  Sparkle,
  Eye,
  Check,
} from 'lucide-react';
import { SocialAccount } from '@/types';

function ComposerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialContent = searchParams.get('content') || '';
  const toast = useToast();

  const [content, setContent] = useState(initialContent);
  const [postType, setPostType] = useState<'text' | 'image' | 'video' | 'document'>('text');
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [destinationType, setDestinationType] = useState<'member' | 'organization'>('member');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [mediaAssets, setMediaAssets] = useState<any[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAccounts();
    // Default scheduled date to tomorrow at 10:00 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setScheduledDate(tomorrow.toISOString().split('T')[0]);
    setScheduledTime('10:00');
  }, []);

  const memberAccounts = accounts.filter((a) => a.account_type === 'member');
  const orgAccounts = accounts.filter((a) => a.account_type === 'organization');

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/linkedin/accounts');
      if (res.ok) {
        const data = await res.json();
        const accs: SocialAccount[] = data.accounts || [];
        setAccounts(accs);
        if (accs.length > 0) {
          const firstMember = accs.find((a) => a.account_type === 'member') || accs[0];
          setSelectedAccount(firstMember.id);
          setDestinationType(firstMember.account_type);
        }
      }
    } catch (e: any) {
      toast.error('Failed to load LinkedIn accounts: ' + e.message);
    }
  };

  const handleDestinationSwitch = (type: 'member' | 'organization') => {
    setDestinationType(type);
    if (type === 'member') {
      if (memberAccounts.length > 0) setSelectedAccount(memberAccounts[0].id);
    } else {
      if (orgAccounts.length > 0) setSelectedAccount(orgAccounts[0].id);
      else setSelectedAccount('');
    }
  };

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

      // Set postType automatically based on file MIME
      if (file.type.startsWith('image/')) setPostType('image');
      else if (file.type.startsWith('video/')) setPostType('video');
      else setPostType('document');

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
    toast.info('Media attachment removed');
  };

  const applySchedulePreset = (hoursFromNow: number) => {
    const target = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
    setScheduledDate(target.toISOString().split('T')[0]);
    const hours = String(target.getHours()).padStart(2, '0');
    const minutes = String(target.getMinutes()).padStart(2, '0');
    setScheduledTime(`${hours}:${minutes}`);
    setScheduleMode(true);
    toast.info(`Scheduled for ${target.toLocaleDateString()} at ${hours}:${minutes}`);
  };

  const handleSavePost = async (publishNow = false, asDraft = false) => {
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
      const payload = {
        content,
        socialAccountId: selectedAccount || null,
        postType,
        mediaAssets,
        status: asDraft ? 'draft' : scheduleMode ? 'scheduled' : 'processing',
        scheduledAt: finalScheduledAt,
        timezone,
        publishNow,
      };

      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to process post');
      }

      if (publishNow) {
        toast.success('Post published successfully to LinkedIn! 🎉');
      } else if (scheduleMode) {
        toast.success('Post scheduled in queue! 🚀');
      } else {
        toast.success('Draft saved successfully.');
      }

      setTimeout(() => {
        router.push(publishNow ? '/posts?tab=published' : scheduleMode ? '/posts?tab=scheduled' : '/posts?tab=draft');
      }, 1000);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const charCount = content.length;
  const maxChars = 3000;
  const charPercentage = Math.min(100, Math.round((charCount / maxChars) * 100));
  const selectedAccObj = accounts.find((a) => a.id === selectedAccount);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800/80">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            Post Studio &amp; Composer
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Author, preview, schedule, and publish rich multi-format LinkedIn content.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSavePost(false, true)}
            disabled={submitting}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Draft</span>
          </button>

          <button
            onClick={() => setScheduleMode(!scheduleMode)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
              scheduleMode
                ? 'bg-blue-50/80 border-blue-300 text-blue-700 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300 shadow-sm'
                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>{scheduleMode ? 'Schedule Active' : 'Schedule'}</span>
          </button>

          {scheduleMode ? (
            <button
              onClick={() => handleSavePost(false, false)}
              disabled={submitting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm shadow-blue-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
              <span>Schedule Post</span>
            </button>
          ) : (
            <button
              onClick={() => handleSavePost(true, false)}
              disabled={submitting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm shadow-blue-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              <span>Publish Now</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Composer Layout: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Editor & Settings */}
        <div className="lg:col-span-7 space-y-4">
          {/* Dual Destination Selector Card */}
          <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Publishing Destination
              </label>
              <span className="text-[11px] text-slate-400 font-mono">
                {destinationType === 'member' ? 'Member Profile' : 'Company Page'}
              </span>
            </div>

            {/* Segmented Destination Picker */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              <button
                type="button"
                onClick={() => handleDestinationSwitch('member')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                  destinationType === 'member'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Personal Profile</span>
                {memberAccounts.length > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleDestinationSwitch('organization')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                  destinationType === 'organization'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Building className="w-3.5 h-3.5" />
                <span>Company Page</span>
                {orgAccounts.length > 0 ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                ) : (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    Auth Required
                  </span>
                )}
              </button>
            </div>

            {/* Destination Specific Selector / Status */}
            {destinationType === 'member' ? (
              memberAccounts.length === 0 ? (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 flex items-center justify-between">
                  <span>No personal profile connected.</span>
                  <a href="/accounts" className="text-blue-600 hover:underline font-semibold flex items-center gap-1">
                    Connect Profile <Plus className="w-3 h-3" />
                  </a>
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-sm">
                      {memberAccounts[0].profile_image_url ? (
                        <img src={memberAccounts[0].profile_image_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        memberAccounts[0].account_name[0]
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-xs text-slate-900 dark:text-slate-100">{memberAccounts[0].account_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">Author URN: urn:li:person:{memberAccounts[0].provider_account_id}</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    Active
                  </span>
                </div>
              )
            ) : orgAccounts.length === 0 ? (
              <div className="p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="font-semibold flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Company Page Authorization Required
                    </div>
                    <p className="text-[11px] text-amber-700/80 dark:text-amber-400 leading-relaxed">
                      Company Page publishing requires the official LinkedIn <strong>Community Management API</strong> product.
                    </p>
                  </div>
                  <a
                    href="/accounts"
                    className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-[11px] flex-shrink-0 shadow-sm"
                  >
                    Authorize Page
                  </a>
                </div>
              </div>
            ) : (
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {orgAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.account_name} (URN: urn:li:organization:{acc.provider_account_id})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Scheduling Details Card */}
          {scheduleMode && (
            <div className="p-4 rounded-2xl border border-blue-200/80 dark:border-blue-900/50 bg-blue-50/30 dark:bg-blue-950/20 backdrop-blur-sm space-y-3.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-blue-950 dark:text-blue-100 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-500" />
                  <span>Scheduled Publication Window</span>
                </div>
                {/* Presets */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => applySchedulePreset(1)}
                    className="px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-white/60 dark:bg-slate-900/60 text-[10px] font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100/60 transition-colors"
                  >
                    In 1 hr
                  </button>
                  <button
                    type="button"
                    onClick={() => applySchedulePreset(24)}
                    className="px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-white/60 dark:bg-slate-900/60 text-[10px] font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100/60 transition-colors"
                  >
                    Tomorrow
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Time
                  </label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Timezone: <span className="font-semibold text-slate-700 dark:text-slate-300">{timezone}</span> (Jobs are executed automatically by the background runner).
              </div>
            </div>
          )}

          {/* Post Content Box */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500/50 transition-all">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What do you want to talk about? Share an insight, story, or project update..."
              rows={9}
              maxLength={maxChars}
              className="w-full p-4 text-sm bg-transparent resize-y border-none focus:outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 leading-relaxed"
            />

            {/* Media Preview Attachment in Editor */}
            {mediaAssets.length > 0 && (
              <div className="px-4 pb-3">
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5 truncate">
                    {postType === 'image' && <ImageIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />}
                    {postType === 'video' && <Video className="w-4 h-4 text-purple-500 flex-shrink-0" />}
                    {postType === 'document' && <FileText className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                    <div className="truncate min-w-0">
                      <div className="truncate text-slate-900 dark:text-slate-100 font-semibold">
                        {mediaAssets[0].file_name}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {mediaAssets[0].file_size ? `${Math.round(mediaAssets[0].file_size / 1024)} KB • ` : ''}
                        Attached to post
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={removeMedia}
                    className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Editor Bottom Bar */}
            <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="cursor-pointer p-2 rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors" title="Attach Media">
                  <ImageIcon className="w-4 h-4" />
                  <input
                    type="file"
                    accept="image/*,video/*,application/pdf"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => router.push('/ai-studio')}
                  className="p-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-500 transition-colors"
                  title="Enhance with AI Studio"
                >
                  <Sparkles className="w-4 h-4" />
                </button>
                {uploadingMedia && (
                  <span className="text-[11px] text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Uploading media...
                  </span>
                )}
              </div>

              {/* Character Counter Progress */}
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden hidden sm:block">
                  <div
                    className={`h-full transition-all ${
                      charPercentage > 90 ? 'bg-rose-500' : charPercentage > 75 ? 'bg-amber-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${charPercentage}%` }}
                  />
                </div>
                <span className={charCount > 2800 ? 'text-amber-500 font-bold' : ''}>{charCount}</span> / {maxChars}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Realistic Live LinkedIn Preview Card */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-blue-500" />
              Live Feed Preview
            </span>
            <span className="text-[10px] text-slate-400">Matches LinkedIn Web App</span>
          </div>

          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl shadow-md overflow-hidden text-slate-900 dark:text-slate-100 transition-all">
            {/* LinkedIn Card Header */}
            <div className="p-4 flex items-start gap-3">
              {destinationType === 'organization' || selectedAccObj?.account_type === 'organization' ? (
                <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm">
                  {selectedAccObj?.profile_image_url ? (
                    <img
                      src={selectedAccObj.profile_image_url}
                      alt=""
                      className="w-11 h-11 rounded-xl object-cover"
                    />
                  ) : (
                    <Building className="w-5 h-5 text-white" />
                  )}
                </div>
              ) : (
                <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm">
                  {selectedAccObj?.profile_image_url ? (
                    <img
                      src={selectedAccObj.profile_image_url}
                      alt=""
                      className="w-11 h-11 rounded-full object-cover"
                    />
                  ) : (
                    selectedAccObj?.account_name?.[0] || 'T'
                  )}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <div className="font-bold text-xs truncate">
                    {selectedAccObj?.account_name || (destinationType === 'organization' ? 'Company Page' : 'Personal Member')}
                  </div>
                  {destinationType === 'organization' && (
                    <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800 flex items-center gap-0.5">
                      + Follow
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {destinationType === 'organization' || selectedAccObj?.account_type === 'organization'
                    ? '1,840 followers • Technology, Information and Internet'
                    : 'Software Engineer & Tech Entrepreneur • 1st'}
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                  <span>Just now</span>
                  <span>•</span>
                  <Globe className="w-2.5 h-2.5" />
                </div>
              </div>
              <Linkedin className="w-4 h-4 text-blue-600 flex-shrink-0" />
            </div>

            {/* LinkedIn Card Body */}
            <div className="px-4 pb-3 text-xs leading-relaxed whitespace-pre-wrap font-normal">
              {content || <span className="text-slate-400 italic">Your post commentary will appear here in real-time...</span>}
            </div>

            {/* Media Attachment Preview */}
            {mediaAssets.length > 0 && mediaAssets[0].url && (
              <div className="border-t border-b border-slate-100 dark:border-slate-800/80 bg-slate-900 max-h-80 overflow-hidden flex items-center justify-center">
                {postType === 'image' && (
                  <img
                    src={mediaAssets[0].url}
                    alt="Uploaded media preview"
                    className="max-h-80 w-auto object-contain"
                  />
                )}
                {postType === 'video' && (
                  <video
                    src={mediaAssets[0].url}
                    controls
                    className="max-h-80 w-full"
                  />
                )}
                {postType === 'document' && (
                  <div className="p-8 text-center text-white space-y-2">
                    <FileText className="w-12 h-12 mx-auto text-emerald-400 opacity-80" />
                    <div className="font-semibold text-xs">{mediaAssets[0].file_name}</div>
                    <div className="text-[10px] text-slate-400">PDF Document Carousel</div>
                  </div>
                )}
              </div>
            )}

            {/* LinkedIn Reactions Summary Bar */}
            <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
              <div className="flex items-center gap-1">
                <div className="flex -space-x-1">
                  <div className="w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center text-[8px]">
                    👍
                  </div>
                  <div className="w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center text-[8px]">
                    ❤️
                  </div>
                  <div className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[8px]">
                    💡
                  </div>
                </div>
                <span className="ml-1">42 reactions</span>
              </div>
              <div className="flex items-center gap-2">
                <span>8 comments</span>
                <span>•</span>
                <span>3 reposts</span>
              </div>
            </div>

            {/* LinkedIn Card Action Buttons */}
            <div className="px-2 py-1.5 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-4 gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400 select-none">
              <button
                type="button"
                className="flex items-center justify-center gap-1.5 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <ThumbsUp className="w-3.5 h-3.5" />
                <span>Like</span>
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-1.5 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Comment</span>
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-1.5 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Repost</span>
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-1.5 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ComposerPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Loading composer...</div>}>
      <ComposerContent />
    </Suspense>
  );
}
