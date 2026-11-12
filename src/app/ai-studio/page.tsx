'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import {
  Sparkles,
  RefreshCw,
  Hash,
  Lightbulb,
  Calendar,
  Sliders,
  Copy,
  ArrowRight,
  Check,
  Loader2,
  FileText,
} from 'lucide-react';

export default function AIStudioPage() {
  const router = useRouter();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'generate' | 'rewrite' | 'hashtags' | 'ideas' | 'calendar' | 'brand'>('generate');

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

  // Calendar State
  const [calendarIndustry, setCalendarIndustry] = useState('Enterprise Technology Solutions');
  const [calendarPlan, setCalendarPlan] = useState<any[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);

  // Brand Voice State
  const [brandName, setBrandName] = useState('GT InnoX LLP');
  const [brandIndustry, setBrandIndustry] = useState('AI & Software Engineering');
  const [brandVoice, setBrandVoice] = useState('Visionary, rigorous, results-focused');
  const [savedBrand, setSavedBrand] = useState(false);

  // Copy indicator state
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sendToComposer = (text: string) => {
    router.push(`/composer?content=${encodeURIComponent(text)}`);
  };

  // 1. Generate Post
  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoadingGenerate(true);
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industry: calendarIndustry }),
      });
      const data = await res.json();
      if (res.ok) {
        setCalendarPlan(data.plan || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCalendar(false);
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
                <select
                  value={postLength}
                  onChange={(e) => setPostLength(e.target.value as any)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2"
                >
                  <option value="short">Short (&lt; 500 chars)</option>
                  <option value="medium">Medium (600 - 1200 chars)</option>
                  <option value="long">Long In-Depth (1200+ chars)</option>
                </select>
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
              disabled={loadingGenerate || !topic.trim()}
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
              <select
                value={rewriteTone}
                onChange={(e) => setRewriteTone(e.target.value as any)}
                className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2"
              >
                <option value="storytelling">Storytelling & Emotional Hook</option>
                <option value="professional">Professional & Executive</option>
                <option value="conversational">Conversational & Friendly</option>
                <option value="technical">Technical Breakdown & In-Depth</option>
                <option value="educational">Educational & Actionable Tips</option>
                <option value="persuasive">Persuasive & High-Converting</option>
              </select>
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
              ideas.map((idea, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex-1">
                    <div className="font-bold text-slate-800 dark:text-slate-200">{idea.title}</div>
                    <div className="text-blue-600 dark:text-blue-400 italic mt-0.5">&quot;{idea.hook}&quot;</div>
                    <div className="text-slate-500 dark:text-slate-400 mt-1">{idea.outline}</div>
                  </div>
                  <button
                    onClick={() => sendToComposer(`${idea.hook}\n\n`)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-[11px] font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 flex-shrink-0"
                  >
                    Use Hook <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 5: 7-Day Plan */}
      {activeTab === 'calendar' && (
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={calendarIndustry}
              onChange={(e) => setCalendarIndustry(e.target.value)}
              placeholder="Industry or niche for content schedule..."
              className="flex-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200"
            />
            <button
              onClick={handleCalendar}
              disabled={loadingCalendar || !calendarIndustry.trim()}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loadingCalendar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
              Build 7-Day Calendar
            </button>
          </div>

          <div className="space-y-3 pt-2">
            {calendarPlan.length === 0 ? (
              <div className="text-xs text-slate-400 py-6 text-center">
                Generate an end-to-end 7-day content schedule with strategic angles.
              </div>
            ) : (
              calendarPlan.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-blue-600 dark:text-blue-400">{item.day}</span>
                      <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {item.contentType || item.format}
                      </span>
                    </div>
                    <div className="font-semibold text-slate-800 dark:text-slate-200 mt-1">{item.theme}</div>
                    <div className="text-slate-500 dark:text-slate-400 mt-0.5 italic">&quot;{item.hook}&quot;</div>
                  </div>
                  <button
                    onClick={() => sendToComposer(`${item.hook}\n\n`)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-[11px] font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 flex-shrink-0"
                  >
                    Create Post <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

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

          <button
            onClick={handleSaveBrand}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            {savedBrand ? <Check className="w-4 h-4" /> : null}
            {savedBrand ? 'Brand Settings Saved' : 'Save Brand Settings'}
          </button>
        </div>
      )}
    </div>
  );
}

