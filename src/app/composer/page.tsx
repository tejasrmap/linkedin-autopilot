'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Send,
  Calendar,
  Save,
  Image,
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
} from 'lucide-react';
import { SocialAccount } from '@/types';

function ComposerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialContent = searchParams.get('content') || '';

  const [content, setContent] = useState(initialContent);
  const [postType, setPostType] = useState<'text' | 'image' | 'video' | 'document'>('text');
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [mediaAssets, setMediaAssets] = useState<any[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchAccounts();
    // Default scheduled date to tomorrow at 10:00 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setScheduledDate(tomorrow.toISOString().split('T')[0]);
    setScheduledTime('10:00');
  }, []);

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/linkedin/accounts');
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
        if (data.accounts && data.accounts.length > 0) {
          setSelectedAccount(data.accounts[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingMedia(true);
    setStatusMessage(null);

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
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setUploadingMedia(false);
    }
  };

  const removeMedia = () => {
    setMediaAssets([]);
    setPostType('text');
  };

  const handleSavePost = async (publishNow = false, asDraft = false) => {
    if (!content.trim()) {
      setStatusMessage({ type: 'error', text: 'Please enter post content.' });
      return;
    }

    if (!selectedAccount && !asDraft) {
      setStatusMessage({ type: 'error', text: 'Please select a LinkedIn account before publishing or scheduling.' });
      return;
    }

    setSubmitting(true);
    setStatusMessage(null);

    let finalScheduledAt: string | null = null;
    if (scheduleMode && !publishNow && !asDraft) {
      if (!scheduledDate || !scheduledTime) {
        setStatusMessage({ type: 'error', text: 'Please select both date and time for scheduling.' });
        setSubmitting(false);
        return;
      }
      const combined = new Date(`${scheduledDate}T${scheduledTime}:00`);
      if (combined.getTime() <= Date.now()) {
        setStatusMessage({ type: 'error', text: 'Scheduled time must be in the future.' });
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
        setStatusMessage({ type: 'success', text: 'Post published successfully to LinkedIn!' });
      } else if (scheduleMode) {
        setStatusMessage({ type: 'success', text: 'Post scheduled successfully in queue!' });
      } else {
        setStatusMessage({ type: 'success', text: 'Draft saved successfully.' });
      }

      setTimeout(() => {
        router.push(publishNow ? '/posts?tab=published' : scheduleMode ? '/posts?tab=scheduled' : '/posts?tab=draft');
      }, 1200);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const charCount = content.length;
  const maxChars = 3000;
  const selectedAccObj = accounts.find((a) => a.id === selectedAccount);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            Post Composer
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Create, preview, schedule, and publish rich LinkedIn content.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSavePost(false, true)}
            disabled={submitting}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            Save Draft
          </button>

          <button
            onClick={() => setScheduleMode(!scheduleMode)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
              scheduleMode
                ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300'
                : 'border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            {scheduleMode ? 'Schedule Enabled' : 'Schedule'}
          </button>

          {scheduleMode ? (
            <button
              onClick={() => handleSavePost(false, false)}
              disabled={submitting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-600/30 transition-all disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
              Schedule Post
            </button>
          ) : (
            <button
              onClick={() => handleSavePost(true, false)}
              disabled={submitting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-600/30 transition-all disabled:opacity-50"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Publish Now
            </button>
          )}
        </div>
      </div>

      {/* Status Alert Banner */}
      {statusMessage && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
          }`}
        >
          {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {statusMessage.text}
        </div>
      )}

      {/* Main Composer Layout: 2 Columns (Editor vs Live LinkedIn Preview) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Editor & Settings */}
        <div className="lg:col-span-7 space-y-4">
          {/* Account Selector */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827]">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Publishing Account
            </label>
            {accounts.length === 0 ? (
              <div className="text-xs text-slate-400">
                No accounts connected.{' '}
                <a href="/accounts" className="text-blue-600 underline">
                  Connect LinkedIn
                </a>
              </div>
            ) : (
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.account_name} ({acc.account_type === 'organization' ? 'Company Page' : 'Personal Profile'})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Scheduling Details Card */}
          {scheduleMode && (
            <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/30 dark:bg-blue-950/20 space-y-3">
              <div className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                Schedule Date & Time
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
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200"
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
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200"
                  />
                </div>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Timezone: <span className="font-semibold">{timezone}</span> (Jobs are stored in UTC and dispatched by BullMQ worker).
              </div>
            </div>
          )}

          {/* Text Area Card */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden flex flex-col">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What do you want to talk about? Write your LinkedIn post here..."
              rows={10}
              maxLength={maxChars}
              className="w-full p-4 text-sm bg-transparent resize-y border-none focus:outline-none text-slate-900 dark:text-slate-100 placeholder-slate-400 leading-relaxed"
            />

            {/* Media Preview Attachment in Editor */}
            {mediaAssets.length > 0 && (
              <div className="px-4 pb-3">
                <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate">
                    {postType === 'image' && <Image className="w-4 h-4 text-blue-500 flex-shrink-0" />}
                    {postType === 'video' && <Video className="w-4 h-4 text-purple-500 flex-shrink-0" />}
                    {postType === 'document' && <FileText className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                    <span className="truncate text-slate-800 dark:text-slate-200 font-medium">
                      {mediaAssets[0].file_name}
                    </span>
                  </div>
                  <button
                    onClick={removeMedia}
                    className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Editor Bottom Bar */}
            <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="cursor-pointer p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors">
                  <Image className="w-4 h-4" />
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
                  className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-indigo-500 transition-colors"
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

              {/* Character Counter */}
              <div className="text-xs font-mono text-slate-400">
                <span className={charCount > 2800 ? 'text-amber-500 font-bold' : ''}>{charCount}</span> / {maxChars}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live LinkedIn Preview Card */}
        <div className="lg:col-span-5 space-y-4">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Live Feed Preview
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-sm overflow-hidden text-slate-900 dark:text-slate-100">
            {/* LinkedIn Card Header */}
            <div className="p-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {selectedAccObj?.profile_image_url ? (
                  <img
                    src={selectedAccObj.profile_image_url}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  selectedAccObj?.account_name?.[0] || 'L'
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-xs truncate">
                  {selectedAccObj?.account_name || 'LinkedIn User'}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {selectedAccObj?.account_type === 'organization'
                    ? 'Company Page • GT InnoX Partner'
                    : 'Product Leader & Founder'}
                </div>
                <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                  <span>Just now</span>
                  <span>•</span>
                  <Globe className="w-2.5 h-2.5" />
                </div>
              </div>
              <Linkedin className="w-4 h-4 text-blue-600" />
            </div>

            {/* LinkedIn Card Body */}
            <div className="px-4 pb-3 text-xs leading-relaxed whitespace-pre-wrap font-normal">
              {content || <span className="text-slate-400 italic">Your post content will appear here in real-time...</span>}
            </div>

            {/* Media Attachment Preview */}
            {mediaAssets.length > 0 && mediaAssets[0].url && (
              <div className="border-t border-b border-slate-100 dark:border-slate-800 bg-slate-900 max-h-80 overflow-hidden flex items-center justify-center">
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
                  <div className="p-8 text-center text-xs text-white flex flex-col items-center gap-2">
                    <FileText className="w-8 h-8 text-blue-400" />
                    <span>{mediaAssets[0].file_name}</span>
                  </div>
                )}
              </div>
            )}

            {/* Mock LinkedIn Interaction Bar */}
            <div className="p-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 px-4">
              <button className="flex items-center gap-1.5 py-1 hover:text-blue-600 transition-colors">
                <ThumbsUp className="w-3.5 h-3.5" /> Like
              </button>
              <button className="flex items-center gap-1.5 py-1 hover:text-blue-600 transition-colors">
                <MessageSquare className="w-3.5 h-3.5" /> Comment
              </button>
              <button className="flex items-center gap-1.5 py-1 hover:text-blue-600 transition-colors">
                <Share2 className="w-3.5 h-3.5" /> Repost
              </button>
              <button className="flex items-center gap-1.5 py-1 hover:text-blue-600 transition-colors">
                <Send className="w-3.5 h-3.5" /> Send
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
