'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { Modal } from '@/components/ui/modal';
import { SocialAccount } from '@/types';
import {
  Sparkles,
  RefreshCw,
  Hash,
  Lightbulb,
  Calendar,
  Sliders,
  Copy,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Check,
  Loader2,
  FileText,
  ChevronDown,
  ChevronUp,
  Eye,
  Edit3,
  Save,
  X,
  Tag,
  CalendarCheck,
  Building,
  User,
  Clock,
  CheckCircle2,
} from 'lucide-react';

export default function AIStudioPage() {
  const router = useRouter();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'generate' | 'rewrite' | 'hashtags' | 'ideas' | 'calendar' | 'brand'>('generate');

  // Accounts for Bulk Scheduling
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  // Generate State
  const [topic, setTopic] = useState('');
  const [audience, setAudience] = useState('Founders, CTOs, and Engineers');
  const [tone, setTone] = useState('Thought leadership & inspiring');
  const [postLength, setPostLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [contentType, setContentType] = useState('Actionable Framework');
  const [generatedPost, setGeneratedPost] = useState('');
  const [loadingGenerate, setLoadingGenerate] = useState(false);

  // Rewrite State
  const [draftToRewrite, setDraftToRewrite] = useState('');
  const [rewriteTone, setRewriteTone] = useState<'professional' | 'conversational' | 'technical' | 'educational' | 'persuasive' | 'storytelling'>('storytelling');
  const [rewrittenPost, setRewrittenPost] = useState('');
  const [loadingRewrite, setLoadingRewrite] = useState(false);

  // Hashtags State
  const [hashtagTopic, setHashtagTopic] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [loadingHashtags, setLoadingHashtags] = useState(false);

  // Ideas State
  const [ideasIndustry, setIdeasIndustry] = useState('B2B SaaS and AI Software');
  const [ideas, setIdeas] = useState<any[]>([]);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [expandedIdeaIdx, setExpandedIdeaIdx] = useState<number | null>(null);

  // Calendar State & Interactive Controls
  const [calendarIndustry, setCalendarIndustry] = useState('Enterprise Technology Solutions');
  const [calendarPlan, setCalendarPlan] = useState<any[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [expandedCalendarDay, setExpandedCalendarDay] = useState<number | null>(null);

  // 1. Bulk Hashtags State
  const [bulkHashtags, setBulkHashtags] = useState('#Leadership #Innovation #Growth');
  const [showHashtagBar, setShowHashtagBar] = useState(true);
  const [loadingSuggestTags, setLoadingSuggestTags] = useState(false);

  // 2. Post Editing State
  const [editingDayIdx, setEditingDayIdx] = useState<number | null>(null);
  const [editTheme, setEditTheme] = useState('');
  const [editHook, setEditHook] = useState('');
  const [editFullDraft, setEditFullDraft] = useState('');

  // 4. Bulk Scheduling Modal State
  const [showBulkScheduleModal, setShowBulkScheduleModal] = useState(false);
  const [scheduleWeekChoice, setScheduleWeekChoice] = useState<'next_week' | 'current_week' | 'custom'>('next_week');
  const [customStartDate, setCustomStartDate] = useState('');
  const [scheduleCadence, setScheduleCadence] = useState<'daily' | 'weekdays' | 'two_weeks'>('daily');
  const [scheduleTime, setScheduleTime] = useState('09:30');
  const [schedulingBulk, setSchedulingBulk] = useState(false);

  // Brand Voice State
  const [brandName, setBrandName] = useState('GT InnoX LLP');
  const [brandIndustry, setBrandIndustry] = useState('AI & Software Engineering');
  const [brandVoice, setBrandVoice] = useState('Visionary, rigorous, results-focused');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [savedBrand, setSavedBrand] = useState(false);

  // Copy indicator state
  const [copied, setCopied] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<string | null>(null);

  // Fetch connected LinkedIn accounts on mount
  useEffect(() => {
    fetchAccounts();
    // Default custom date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setCustomStartDate(tomorrow.toISOString().split('T')[0]);

    if (typeof window !== 'undefined') {
      const storedKey = localStorage.getItem('gemini_api_key') || '';
      setGeminiApiKey(storedKey);
    }
  }, []);

  const getAiHeaders = () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (geminiApiKey.trim()) {
      headers['x-gemini-key'] = geminiApiKey.trim();
    }
    return headers;
  };

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/linkedin/accounts');
      if (res.ok) {
        const data = await res.json();
        const accs = data.accounts || [];
        setAccounts(accs);
        if (accs.length > 0) {
          setSelectedAccountId(accs[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyTextWithFeedback = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(id);
    toast.success('Full post copied to clipboard!');
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const sendToComposer = (text: string) => {
    router.push(`/composer?content=${encodeURIComponent(text)}`);
  };

  // 1. Generate Post
  const handleGenerate = async () => {
    const activeTopic = topic.trim() || 'Why most B2B founders struggle with enterprise sales in their first year';
    if (!topic.trim()) {
      setTopic(activeTopic);
    }
    setLoadingGenerate(true);
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: getAiHeaders(),
        body: JSON.stringify({
          topic: activeTopic,
          targetAudience: audience,
          tone,
          length: postLength,
          contentType,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setGeneratedPost(data.content);
        toast.success('Generated high-retention post draft!');
      } else {
        toast.error(data.error || 'Failed to generate post');
      }
    } catch (e: any) {
      toast.error(e.message || 'Error communicating with AI service');
    } finally {
      setLoadingGenerate(false);
    }
  };

  // 2. Rewrite Post
  const handleRewrite = async () => {
    if (!draftToRewrite.trim()) return;
    setLoadingRewrite(true);
    try {
      const res = await fetch('/api/ai/rewrite', {
        method: 'POST',
        headers: getAiHeaders(),
        body: JSON.stringify({
          content: draftToRewrite,
          targetTone: rewriteTone,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRewrittenPost(data.content);
        toast.success(`Rewritten post in ${rewriteTone} voice!`);
      } else {
        toast.error(data.error || 'Failed to rewrite post');
      }
    } catch (e: any) {
      toast.error(e.message || 'Error communicating with AI service');
    } finally {
      setLoadingRewrite(false);
    }
  };

  // 3. Hashtags
  const handleHashtags = async () => {
    if (!hashtagTopic.trim()) return;
    setLoadingHashtags(true);
    try {
      const res = await fetch('/api/ai/hashtags', {
        method: 'POST',
        headers: getAiHeaders(),
        body: JSON.stringify({ topic: hashtagTopic }),
      });
      const data = await res.json();
      if (res.ok) {
        setHashtags(data.hashtags || []);
        toast.success(`Discovered ${data.hashtags?.length || 0} optimized hashtags!`);
      } else {
        toast.error(data.error || 'Failed to generate hashtags');
      }
    } catch (e: any) {
      toast.error(e.message || 'Error communicating with AI service');
    } finally {
      setLoadingHashtags(false);
    }
  };

  // 4. Ideas
  const handleIdeas = async () => {
    if (!ideasIndustry.trim()) return;
    setLoadingIdeas(true);
    try {
      const res = await fetch('/api/ai/ideas', {
        method: 'POST',
        headers: getAiHeaders(),
        body: JSON.stringify({ industry: ideasIndustry }),
      });
      const data = await res.json();
      if (res.ok) {
        setIdeas(data.ideas || []);
        toast.success(`Generated ${data.ideas?.length || 0} viral hook ideas!`);
      } else {
        toast.error(data.error || 'Failed to generate ideas');
      }
    } catch (e: any) {
      toast.error(e.message || 'Error communicating with AI service');
    } finally {
      setLoadingIdeas(false);
    }
  };

  // 5. Calendar Plan
  const handleCalendar = async () => {
    if (!calendarIndustry.trim()) return;
    setLoadingCalendar(true);
    try {
      const res = await fetch('/api/ai/calendar', {
        method: 'POST',
        headers: getAiHeaders(),
        body: JSON.stringify({ industry: calendarIndustry }),
      });
      const data = await res.json();
      if (res.ok) {
        setCalendarPlan(data.plan || []);
        toast.success('Generated 7-day strategic calendar!');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCalendar(false);
    }
  };

  // 1. Bulk Hashtags Handlers
  const handleSuggestHashtags = async () => {
    setLoadingSuggestTags(true);
    try {
      const res = await fetch('/api/ai/hashtags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: calendarIndustry || 'Technology Leadership' }),
      });
      const data = await res.json();
      if (res.ok && data.hashtags && data.hashtags.length > 0) {
        setBulkHashtags(data.hashtags.join(' '));
        toast.success('Generated suggested hashtags!');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSuggestTags(false);
    }
  };

  // Helper to replace trailing hashtag blocks without duplicating
  const replaceTrailingHashtags = (text: string, newHashtagsStr: string): string => {
    const lines = text.trim().split('\n');

    // Pop trailing lines from the bottom if they contain hashtags or are blank
    while (lines.length > 0) {
      const lastLine = lines[lines.length - 1].trim();
      if (lastLine === '') {
        lines.pop();
        continue;
      }
      // Check if the line consists entirely of hashtags (e.g. #Tag1 #Tag2)
      const tokens = lastLine.split(/\s+/).filter(Boolean);
      const isHashtagLine = tokens.length > 0 && tokens.every((token) => token.startsWith('#'));

      if (isHashtagLine) {
        lines.pop();
      } else {
        break;
      }
    }

    const baseText = lines.join('\n').trim();

    // Normalize new hashtags: ensure each tag starts with '#'
    const formattedTags = newHashtagsStr
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`))
      .join(' ');

    if (!formattedTags) return baseText;
    return `${baseText}\n\n${formattedTags}`;
  };

  const handleApplyHashtagsToAll = () => {
    if (!bulkHashtags.trim()) {
      toast.error('Please enter at least one hashtag to apply');
      return;
    }

    const updated = calendarPlan.map((item) => {
      const currentDraft = (item.fullDraft || item.hook || '').trim();
      const updatedDraft = replaceTrailingHashtags(currentDraft, bulkHashtags);
      return {
        ...item,
        fullDraft: updatedDraft,
      };
    });

    setCalendarPlan(updated);
    toast.success(`Updated hashtags across all ${calendarPlan.length} posts!`);
  };

  // 2. Post Editing Handlers
  const startEditing = (idx: number) => {
    const item = calendarPlan[idx];
    setEditingDayIdx(idx);
    setEditTheme(item.theme || '');
    setEditHook(item.hook || '');
    setEditFullDraft(item.fullDraft || `${item.hook}\n\n${item.theme}`);
  };

  const saveEditing = () => {
    if (editingDayIdx === null) return;
    const updated = [...calendarPlan];
    updated[editingDayIdx] = {
      ...updated[editingDayIdx],
      theme: editTheme,
      hook: editHook,
      fullDraft: editFullDraft,
    };
    setCalendarPlan(updated);
    toast.success(`Saved changes to ${updated[editingDayIdx].day} post!`);
    setEditingDayIdx(null);
  };

  const cancelEditing = () => {
    setEditingDayIdx(null);
  };

  // 3. Post Reordering Handler
  const movePost = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= calendarPlan.length) return;
    const updated = [...calendarPlan];
    const daysList = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    const temp = updated[fromIdx];
    updated[fromIdx] = updated[toIdx];
    updated[toIdx] = temp;

    // Resequence the day labels so the schedule flows logically (Monday -> Sunday)
    const resequenced = updated.map((item, idx) => ({
      ...item,
      day: daysList[idx] || `Day ${idx + 1}`,
    }));

    setCalendarPlan(resequenced);
    toast.success(`Moved post: ${daysList[fromIdx]} ↔ ${daysList[toIdx]}`);
  };

  // 4. Computed Slots for Bulk Scheduling
  const computedSlots = useMemo(() => {
    if (calendarPlan.length === 0) return [];
    const today = new Date();
    let baseDate = new Date();

    if (scheduleWeekChoice === 'next_week') {
      const dayOfWeek = today.getDay(); // 0 is Sun, 1 is Mon...
      const daysUntilNextMon = ((8 - dayOfWeek) % 7) || 7;
      baseDate.setDate(today.getDate() + daysUntilNextMon);
    } else if (scheduleWeekChoice === 'current_week') {
      baseDate.setDate(today.getDate() + 1);
    } else if (scheduleWeekChoice === 'custom' && customStartDate) {
      baseDate = new Date(customStartDate);
    }

    const [hours, minutes] = scheduleTime.split(':').map(Number);

    return calendarPlan.map((item, idx) => {
      const slotDate = new Date(baseDate);
      if (scheduleCadence === 'daily') {
        slotDate.setDate(baseDate.getDate() + idx);
      } else if (scheduleCadence === 'two_weeks') {
        slotDate.setDate(baseDate.getDate() + idx * 2);
      } else if (scheduleCadence === 'weekdays') {
        let added = 0;
        let cur = new Date(baseDate);
        while (added < idx) {
          cur.setDate(cur.getDate() + 1);
          if (cur.getDay() !== 0 && cur.getDay() !== 6) {
            added++;
          }
        }
        slotDate.setTime(cur.getTime());
      }
      slotDate.setHours(hours || 9, minutes || 30, 0, 0);

      return {
        index: idx,
        day: item.day,
        theme: item.theme,
        hook: item.hook,
        content: item.fullDraft || item.hook,
        scheduledAt: slotDate,
        dateString: slotDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
        timeString: slotDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
    });
  }, [calendarPlan, scheduleWeekChoice, customStartDate, scheduleCadence, scheduleTime]);

  const handleBulkSchedule = async () => {
    if (calendarPlan.length === 0) return;
    if (!selectedAccountId) {
      toast.error('Please select an authorized LinkedIn destination first');
      return;
    }

    setSchedulingBulk(true);
    try {
      const slots = computedSlots;
      const postsPayload = slots.map((s) => ({
        content: s.content,
        postType: 'text',
        scheduledAt: s.scheduledAt.toISOString(),
        socialAccountId: selectedAccountId,
      }));

      const res = await fetch('/api/posts/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          socialAccountId: selectedAccountId,
          posts: postsPayload,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        toast.success(`🎉 Successfully scheduled all ${data.processed || slots.length} posts into your queue!`);
        setShowBulkScheduleModal(false);
      } else {
        toast.error(data.error || 'Failed to bulk-schedule posts');
      }
    } catch (err: any) {
      toast.error('Error scheduling posts: ' + err.message);
    } finally {
      setSchedulingBulk(false);
    }
  };

  // 6. Save Brand Settings
  const handleSaveBrand = async () => {
    try {
      await fetch('/api/brand-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandName,
          industry: brandIndustry,
          brandVoice,
        }),
      });
      setSavedBrand(true);
      setTimeout(() => setSavedBrand(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-500" />
          AI Content Studio
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Powered by Google Gemini. Generate viral posts, rewrite hooks, extract hashtags, and build strategic calendars.
        </p>
      </div>

      {/* Studio Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-1 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('generate')}
          className={`flex items-center gap-2 px-3 py-2 rounded-t-lg transition-colors ${
            activeTab === 'generate'
              ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Generate Post
        </button>

        <button
          onClick={() => setActiveTab('rewrite')}
          className={`flex items-center gap-2 px-3 py-2 rounded-t-lg transition-colors ${
            activeTab === 'rewrite'
              ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Rewrite & Tone
        </button>

        <button
          onClick={() => setActiveTab('hashtags')}
          className={`flex items-center gap-2 px-3 py-2 rounded-t-lg transition-colors ${
            activeTab === 'hashtags'
              ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Hash className="w-3.5 h-3.5" />
          Hashtags
        </button>

        <button
          onClick={() => setActiveTab('ideas')}
          className={`flex items-center gap-2 px-3 py-2 rounded-t-lg transition-colors ${
            activeTab === 'ideas'
              ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Lightbulb className="w-3.5 h-3.5" />
          Post Ideas
        </button>

        <button
          onClick={() => setActiveTab('calendar')}
          className={`flex items-center gap-2 px-3 py-2 rounded-t-lg transition-colors ${
            activeTab === 'calendar'
              ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          7-Day Plan
        </button>

        <button
          onClick={() => setActiveTab('brand')}
          className={`flex items-center gap-2 px-3 py-2 rounded-t-lg transition-colors ${
            activeTab === 'brand'
              ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
              : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          Brand Voice
        </button>
      </div>

      {/* Tab 1: Generate Post */}
      {activeTab === 'generate' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Post Topic or Prompt
              </label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Why most B2B founders struggle with enterprise sales in their first year..."
                rows={4}
                className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Quick-Start Prompt Starters */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold text-slate-400">Quick Prompt Starters:</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Why most B2B founders struggle with enterprise sales in year one',
                  '3 non-negotiable rules we use to eliminate meeting fatigue',
                  'The uncomfortable truth about premature software optimization',
                  'How consistent weekly LinkedIn posting beats erratic daily noise',
                ].map((starter, sIdx) => (
                  <button
                    key={sIdx}
                    type="button"
                    onClick={() => setTopic(starter)}
                    className="text-[10px] px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900/60 hover:border-blue-500/50 hover:text-blue-500 text-slate-600 dark:text-slate-300 transition-colors truncate max-w-full text-left"
                  >
                    💡 {starter}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Audience
                </label>
                <input
                  type="text"
                  value={audience}
                  onChange={(e) => setAudience(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Desired Tone
                </label>
                <input
                  type="text"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Post Length
                </label>
                <div className="relative">
                  <select
                    value={postLength}
                    onChange={(e) => setPostLength(e.target.value as any)}
                    className="w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-[#0f172a] pl-3 pr-8 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer transition-all shadow-sm"
                  >
                    <option value="short" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100 py-1.5">Short (&lt; 500 chars)</option>
                    <option value="medium" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100 py-1.5">Medium (600 - 1200 chars)</option>
                    <option value="long" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100 py-1.5">Long In-Depth (1200+ chars)</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Content Type
                </label>
                <input
                  type="text"
                  value={contentType}
                  onChange={(e) => setContentType(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2"
                />
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={loadingGenerate}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-600/30 transition-all disabled:opacity-50"
            >
              {loadingGenerate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generate Post with Gemini
            </button>
          </div>

          {/* Generated Result Output */}
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  AI Generated Draft
                </span>
                {generatedPost && (
                  <button
                    onClick={() => handleCopy(generatedPost)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                )}
              </div>

              <div className="py-4 text-xs leading-relaxed whitespace-pre-wrap font-normal text-slate-800 dark:text-slate-200 min-h-[220px]">
                {loadingGenerate ? (
                  <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                    <span>Gemini is generating your LinkedIn post...</span>
                  </div>
                ) : generatedPost ? (
                  generatedPost
                ) : (
                  <div className="flex items-center justify-center h-48 text-slate-400 text-center">
                    Enter a topic on the left and click Generate Post.
                  </div>
                )}
              </div>
            </div>

            {generatedPost && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  onClick={() => sendToComposer(generatedPost)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition-colors"
                >
                  Send to Composer <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Rewrite & Tone */}
      {activeTab === 'rewrite' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Original Post or Rough Notes
              </label>
              <textarea
                value={draftToRewrite}
                onChange={(e) => setDraftToRewrite(e.target.value)}
                placeholder="Paste your existing post or thoughts to polish and transform..."
                rows={6}
                className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target Tone
              </label>
              <div className="relative">
                <select
                  value={rewriteTone}
                  onChange={(e) => setRewriteTone(e.target.value as any)}
                  className="w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-[#0f172a] pl-3 pr-8 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer transition-all shadow-sm"
                >
                  <option value="storytelling" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100 py-1.5">Storytelling &amp; Emotional Hook</option>
                  <option value="professional" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100 py-1.5">Professional &amp; Executive</option>
                  <option value="conversational" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100 py-1.5">Conversational &amp; Friendly</option>
                  <option value="technical" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100 py-1.5">Technical Breakdown &amp; In-Depth</option>
                  <option value="educational" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100 py-1.5">Educational &amp; Actionable Tips</option>
                  <option value="persuasive" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100 py-1.5">Persuasive &amp; High-Converting</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>

            <button
              onClick={handleRewrite}
              disabled={loadingRewrite || !draftToRewrite.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-600/30 transition-all disabled:opacity-50"
            >
              {loadingRewrite ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Rewrite Post
            </button>
          </div>

          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Rewritten Output
                </span>
                {rewrittenPost && (
                  <button
                    onClick={() => handleCopy(rewrittenPost)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                )}
              </div>

              <div className="py-4 text-xs leading-relaxed whitespace-pre-wrap font-normal text-slate-800 dark:text-slate-200 min-h-[220px]">
                {loadingRewrite ? (
                  <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                    <span>Rewriting your post...</span>
                  </div>
                ) : rewrittenPost ? (
                  rewrittenPost
                ) : (
                  <div className="flex items-center justify-center h-48 text-slate-400 text-center">
                    Paste your text on the left and choose a target tone.
                  </div>
                )}
              </div>
            </div>

            {rewrittenPost && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                <button
                  onClick={() => sendToComposer(rewrittenPost)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm transition-colors"
                >
                  Send to Composer <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Hashtags */}
      {activeTab === 'hashtags' && (
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={hashtagTopic}
              onChange={(e) => setHashtagTopic(e.target.value)}
              placeholder="Enter post topic, niche, or keywords (e.g. Generative AI, Founder journey)..."
              className="flex-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200"
            />
            <button
              onClick={handleHashtags}
              disabled={loadingHashtags || !hashtagTopic.trim()}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loadingHashtags ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Hash className="w-3.5 h-3.5" />}
              Find Hashtags
            </button>
          </div>

          <div className="pt-2">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              Suggested Hashtags
            </div>
            {hashtags.length === 0 ? (
              <div className="text-xs text-slate-400 py-6 text-center">
                Search for a topic to generate high-reach LinkedIn hashtags.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {hashtags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleCopy(tag)}
                    className="px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-100/50 transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Post Ideas */}
      {activeTab === 'ideas' && (
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={ideasIndustry}
              onChange={(e) => setIdeasIndustry(e.target.value)}
              placeholder="Enter your industry or specialty (e.g. Fintech, Healthcare AI)..."
              className="flex-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200"
            />
            <button
              onClick={handleIdeas}
              disabled={loadingIdeas || !ideasIndustry.trim()}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loadingIdeas ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lightbulb className="w-3.5 h-3.5" />}
              Generate Ideas
            </button>
          </div>

          <div className="space-y-3 pt-2">
            {ideas.length === 0 ? (
              <div className="text-xs text-slate-400 py-6 text-center">
                Click Generate Ideas to get 5 viral concepts tailored for your industry.
              </div>
            ) : (
              ideas.map((idea, idx) => {
                const isExpanded = expandedIdeaIdx === idx;
                const fullPostText =
                  idea.fullDraft ||
                  `${idea.hook}\n\nKey Insights:\n${idea.outline}\n\nExecution Principles:\n• Eliminate operational drag\n• Standardize high-leverage workflows\n• Iterate based on real metrics\n\nWhat is your team's perspective on this?\n\n#Leadership #Innovation #Growth #LinkedIn`;

                return (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3 text-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="font-bold text-slate-800 dark:text-slate-100 text-sm">{idea.title}</div>
                        <div className="text-blue-600 dark:text-blue-400 italic mt-1">&quot;{idea.hook}&quot;</div>
                        <div className="text-slate-500 dark:text-slate-400 mt-1">{idea.outline}</div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap sm:flex-nowrap">
                        <button
                          onClick={() => setExpandedIdeaIdx(isExpanded ? null : idx)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-[11px] font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{isExpanded ? 'Hide Draft' : 'View Full Post'}</span>
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>

                        <button
                          onClick={() => copyTextWithFeedback(fullPostText, `idea-${idx}`)}
                          className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                          title="Copy Full Post"
                        >
                          {copiedIdx === `idea-${idx}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <button
                          onClick={() => sendToComposer(fullPostText)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold transition-all shadow-sm"
                        >
                          <span>Open in Composer</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          <span>FULL PUBLICATION-READY DRAFT:</span>
                          <span className="font-mono">{fullPostText.length} characters</span>
                        </div>
                        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 whitespace-pre-wrap leading-relaxed font-sans text-xs max-h-60 overflow-y-auto selection:bg-blue-500 selection:text-white">
                          {fullPostText}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab 5: 7-Day Plan */}
      {activeTab === 'calendar' && (
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-4">
          {/* Header Controls */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            <div className="flex-1 flex flex-col sm:flex-row gap-2.5">
              <input
                type="text"
                value={calendarIndustry}
                onChange={(e) => setCalendarIndustry(e.target.value)}
                placeholder="Industry or niche for content schedule (e.g. ERP in Construction, B2B SaaS)..."
                className="flex-1 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3.5 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
              <button
                onClick={handleCalendar}
                disabled={loadingCalendar || !calendarIndustry.trim()}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm shadow-blue-600/20 flex-shrink-0"
              >
                {loadingCalendar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
                <span>{calendarPlan.length > 0 ? 'Rebuild 7-Day Plan' : 'Build 7-Day Calendar'}</span>
              </button>
            </div>

            {calendarPlan.length > 0 && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setShowHashtagBar(!showHashtagBar)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    showHashtagBar
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                  title="Toggle Global Hashtag Tool"
                >
                  <Tag className="w-3.5 h-3.5" />
                  <span>Hashtag Tools</span>
                </button>

                <button
                  onClick={() => setShowBulkScheduleModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-sm shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <CalendarCheck className="w-3.5 h-3.5" />
                  <span>Schedule All 7 Posts</span>
                </button>
              </div>
            )}
          </div>

          {/* 1. Global Hashtag Injector Bar */}
          {showHashtagBar && calendarPlan.length > 0 && (
            <div className="p-3.5 rounded-xl border border-blue-200/60 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 min-w-0">
                <Tag className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <span className="font-semibold whitespace-nowrap">Global Hashtags:</span>
                <input
                  type="text"
                  value={bulkHashtags}
                  onChange={(e) => setBulkHashtags(e.target.value)}
                  placeholder="#Leadership #Growth #Innovation..."
                  className="flex-1 md:w-80 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleSuggestHashtags}
                  disabled={loadingSuggestTags}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {loadingSuggestTags ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3 text-blue-500" />}
                  <span>Auto-Suggest</span>
                </button>

                <button
                  onClick={handleApplyHashtagsToAll}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] shadow-sm transition-all"
                >
                  Apply to All 7 Posts
                </button>
              </div>
            </div>
          )}

          {/* 7-Day Plan Cards */}
          <div className="space-y-3 pt-2">
            {calendarPlan.length === 0 ? (
              <div className="text-xs text-slate-400 py-12 text-center space-y-2">
                <Calendar className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
                <div className="font-semibold text-slate-600 dark:text-slate-400">No Content Calendar Generated</div>
                <p className="text-[11px] text-slate-400">
                  Enter your industry above and click &quot;Build 7-Day Calendar&quot; to generate an end-to-end strategic publishing schedule.
                </p>
              </div>
            ) : (
              calendarPlan.map((item, idx) => {
                const isExpanded = expandedCalendarDay === idx;
                const isEditing = editingDayIdx === idx;
                const fullPostText =
                  item.fullDraft ||
                  `${item.hook}\n\nStrategic Perspective:\n${item.theme}\n\nKey Takeaways:\n• Standardize workflows\n• Reduce friction\n• Measure high-leverage outcomes\n\nWhat is your team's perspective?\n\n#Leadership #Innovation #Growth`;

                return (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 space-y-3 text-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-sm"
                  >
                    <div className="flex flex-col md:flex-row items-start justify-between gap-3">
                      {/* 3. Reorder Buttons (Move Up & Down) */}
                      <div className="flex md:flex-col items-center gap-1 self-start flex-shrink-0 bg-white dark:bg-slate-800/80 p-1 rounded-lg border border-slate-200 dark:border-slate-700/60">
                        <button
                          onClick={() => movePost(idx, idx - 1)}
                          disabled={idx === 0}
                          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-25 transition-colors"
                          title="Move Post Up in Schedule"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-[10px] font-bold font-mono text-slate-400 px-1">
                          {idx + 1}
                        </span>
                        <button
                          onClick={() => movePost(idx, idx + 1)}
                          disabled={idx === calendarPlan.length - 1}
                          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-25 transition-colors"
                          title="Move Post Down in Schedule"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Post Content / Inline Editor */}
                      <div className="flex-1 min-w-0 space-y-2">
                        {isEditing ? (
                          /* 2. Inline Post Editor */
                          <div className="space-y-2.5 p-3.5 rounded-xl border border-blue-500/40 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 animate-in fade-in duration-150">
                            <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                              <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                                Editing {item.day} Post Draft
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {editFullDraft.length} / 3000 chars
                              </span>
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                                Strategic Theme
                              </label>
                              <input
                                type="text"
                                value={editTheme}
                                onChange={(e) => setEditTheme(e.target.value)}
                                className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-slate-800 dark:text-slate-200 font-medium"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                                Opening Hook
                              </label>
                              <input
                                type="text"
                                value={editHook}
                                onChange={(e) => setEditHook(e.target.value)}
                                className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-1.5 text-slate-800 dark:text-slate-200"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                                Full Publication-Ready Body
                              </label>
                              <textarea
                                value={editFullDraft}
                                onChange={(e) => setEditFullDraft(e.target.value)}
                                rows={7}
                                className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 text-slate-800 dark:text-slate-200 leading-relaxed font-sans whitespace-pre-wrap"
                              />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                onClick={cancelEditing}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300 transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Cancel</span>
                              </button>
                              <button
                                onClick={saveEditing}
                                className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold transition-all shadow-sm"
                              >
                                <Save className="w-3.5 h-3.5" />
                                <span>Save Changes</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Standard View */
                          <>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-blue-600 dark:text-blue-400 text-sm">{item.day}</span>
                              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                {item.contentType || item.format}
                              </span>
                            </div>
                            <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs mt-0.5">{item.theme}</div>
                            <div className="text-slate-500 dark:text-slate-400 italic text-[11px]">&quot;{item.hook}&quot;</div>
                          </>
                        )}
                      </div>

                      {/* Right Action Bar */}
                      {!isEditing && (
                        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap sm:flex-nowrap self-end md:self-center">
                          {/* Edit Post Button */}
                          <button
                            onClick={() => startEditing(idx)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                            title="Edit this post draft"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-blue-500" />
                            <span>Edit</span>
                          </button>

                          {/* View Full Post Toggle */}
                          <button
                            onClick={() => setExpandedCalendarDay(isExpanded ? null : idx)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-[11px] font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{isExpanded ? 'Hide Draft' : 'View Full Post'}</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>

                          {/* Copy Post Button */}
                          <button
                            onClick={() => copyTextWithFeedback(fullPostText, `cal-${idx}`)}
                            className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                            title="Copy Full Post"
                          >
                            {copiedIdx === `cal-${idx}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Open in Composer */}
                          <button
                            onClick={() => sendToComposer(fullPostText)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold transition-all shadow-sm"
                            title="Open in Post Studio & Composer"
                          >
                            <span>Create Post</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Expandable Full Post Preview */}
                    {isExpanded && !isEditing && (
                      <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          <span>FULL PUBLICATION-READY POST ({item.day.toUpperCase()}):</span>
                          <span className="font-mono">{fullPostText.length} characters</span>
                        </div>
                        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 whitespace-pre-wrap leading-relaxed font-sans text-xs max-h-60 overflow-y-auto selection:bg-blue-500 selection:text-white">
                          {fullPostText}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 4. Bulk Schedule Modal */}
      <Modal
        isOpen={showBulkScheduleModal}
        onClose={() => setShowBulkScheduleModal(false)}
        title="Schedule All 7 LinkedIn Posts"
        description="Automate delivery of your 7-day strategic calendar to your connected LinkedIn destination in the selected order and timeframe."
        maxWidth="2xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="text-[11px] text-slate-400">
              Total to schedule: <strong className="text-slate-700 dark:text-slate-200">{calendarPlan.length} posts</strong>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowBulkScheduleModal(false)}
                disabled={schedulingBulk}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkSchedule}
                disabled={schedulingBulk || calendarPlan.length === 0 || !selectedAccountId}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold text-xs shadow-sm shadow-emerald-500/25 transition-all disabled:opacity-50"
              >
                {schedulingBulk ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarCheck className="w-3.5 h-3.5" />}
                <span>Confirm &amp; Schedule All 7</span>
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Destination Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              LinkedIn Publishing Destination
            </label>
            {accounts.length === 0 ? (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs">
                No LinkedIn account connected. Please visit LinkedIn Accounts settings first to authorize your profile or company page.
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f172a] pl-3 pr-8 py-2.5 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer shadow-sm transition-all"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id} className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100 py-2">
                      {acc.account_name} ({acc.account_type === 'organization' ? 'LinkedIn Company Page' : 'Personal Profile'})
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3.5 pointer-events-none" />
              </div>
            )}
          </div>

          {/* Schedule Week & Timing Configuration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
            {/* Week Choice */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Target Week
              </label>
              <div className="relative">
                <select
                  value={scheduleWeekChoice}
                  onChange={(e) => setScheduleWeekChoice(e.target.value as any)}
                  className="w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f172a] pl-3 pr-8 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer shadow-sm transition-all"
                >
                  <option value="next_week" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100 py-1.5">Next Week</option>
                  <option value="current_week" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100 py-1.5">Tomorrow</option>
                  <option value="custom" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100 py-1.5">Custom Date</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
              </div>
            </div>

            {/* Cadence */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Posting Cadence
              </label>
              <div className="relative">
                <select
                  value={scheduleCadence}
                  onChange={(e) => setScheduleCadence(e.target.value as any)}
                  className="w-full appearance-none rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f172a] pl-3 pr-8 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer shadow-sm transition-all"
                >
                  <option value="daily" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100 py-1.5">Daily (7 Days)</option>
                  <option value="weekdays" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100 py-1.5">Weekdays (Mon-Fri)</option>
                  <option value="two_weeks" className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-slate-100 py-1.5">Every 2 Days (2 Wks)</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-3 pointer-events-none" />
              </div>
            </div>

            {/* Time */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Preferred Time
              </label>
              <input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f172a] px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
          </div>

          {/* Custom Date Input if selected */}
          {scheduleWeekChoice === 'custom' && (
            <div className="animate-in fade-in duration-150">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                Select Custom Start Date
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f172a] px-3 py-2 text-slate-800 dark:text-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
          )}

          {/* Timeline Slots Preview */}
          <div>
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center justify-between">
              <span>Scheduled Timeline Preview ({computedSlots.length} Slots)</span>
              <span className="text-[10px] text-slate-400">Order preserved as arranged</span>
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {computedSlots.map((slot) => (
                <div
                  key={slot.index}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-bold text-blue-600 dark:text-blue-400 text-[11px] w-20 flex-shrink-0">
                      {slot.day}
                    </span>
                    <span className="truncate text-slate-700 dark:text-slate-300 font-medium max-w-sm text-[11px]">
                      {slot.hook}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-600 dark:text-emerald-400 flex-shrink-0 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                    <Clock className="w-3 h-3" />
                    <span>{slot.dateString} at {slot.timeString}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Tab 6: Brand Voice Settings */}
      {activeTab === 'brand' && (
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] max-w-xl space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Brand Name
            </label>
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Industry & Niche
            </label>
            <input
              type="text"
              value={brandIndustry}
              onChange={(e) => setBrandIndustry(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Writing Style & Brand Voice
            </label>
            <input
              type="text"
              value={brandVoice}
              onChange={(e) => setBrandVoice(e.target.value)}
              placeholder="e.g. Bold, technical, data-driven, authentic"
              className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200"
            />
          </div>

          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                <span>Google Gemini API Key (Optional)</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">Stored securely in browser</span>
            </label>
            <input
              type="password"
              value={geminiApiKey}
              onChange={(e) => {
                setGeminiApiKey(e.target.value);
                if (typeof window !== 'undefined') {
                  localStorage.setItem('gemini_api_key', e.target.value);
                }
              }}
              placeholder="AIzaSy... (Paste Gemini key to enable live Google Gemini 1.5 Flash)"
              className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200 font-mono"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              If omitted, our high-variety built-in GT InnoX generative engine runs automatically with dynamic topic variations and non-repeating frameworks.
            </p>
          </div>

          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                localStorage.setItem('gemini_api_key', geminiApiKey.trim());
              }
              handleSaveBrand();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            {savedBrand ? <Check className="w-4 h-4" /> : null}
            {savedBrand ? 'Settings & API Key Saved' : 'Save Brand Settings'}
          </button>
        </div>
      )}
    </div>
  );
}

