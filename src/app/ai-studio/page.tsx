'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { Modal } from '@/components/ui/modal';
import { PageHeader, ActionButton, IdeaCard } from '@/components/magicpath/common';
import { Icon, IconName } from '@/components/magicpath/icons';
import { SocialAccount } from '@/types';

function AIStudioContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const urlTab = searchParams.get('tab');
  const urlDraftId = searchParams.get('draftId');
  const urlContent = searchParams.get('content');
  const urlTone = searchParams.get('tone');
  const urlTopic = searchParams.get('topic');

  const [activeTab, setActiveTab] = useState<
    'generate' | 'rewrite' | 'hashtags' | 'ideas' | 'calendar' | 'brand'
  >(() => {
    if (urlTab && ['generate', 'rewrite', 'hashtags', 'ideas', 'calendar', 'brand'].includes(urlTab)) {
      return urlTab as any;
    }
    return 'generate';
  });

  const [sourceDraftId, setSourceDraftId] = useState<string | null>(urlDraftId || null);

  // Accounts
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  // Generate State
  const [topic, setTopic] = useState(urlTopic || '');
  const [audience, setAudience] = useState('Founders, CTOs, and Engineers');
  const [tone, setTone] = useState('Thoughtful');
  const [postLength, setPostLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [contentType, setContentType] = useState('Actionable Framework');
  const [generatedPost, setGeneratedPost] = useState('');
  const [loadingGenerate, setLoadingGenerate] = useState(false);

  // Rewrite State
  const [draftToRewrite, setDraftToRewrite] = useState(urlContent || '');
  const [rewriteTone, setRewriteTone] = useState<string>(urlTone || 'Thoughtful');
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
  const [calendarFocus, setCalendarFocus] = useState('');
  const [calendarPlan, setCalendarPlan] = useState<any[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);

  // Brand Voice State
  const [brandName, setBrandName] = useState('');
  const [brandIndustry, setBrandIndustry] = useState('');
  const [brandVoice, setBrandVoice] = useState('');
  const [avoidWords, setAvoidWords] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [savingBrand, setSavingBrand] = useState(false);
  const [loadingBrand, setLoadingBrand] = useState(true);
  const [brandError, setBrandError] = useState<string | null>(null);

  // Bulk Schedule Modal State
  const [showBulkScheduleModal, setShowBulkScheduleModal] = useState(false);
  const [scheduleCadence, setScheduleCadence] = useState<'daily' | 'weekdays'>('weekdays');
  const [schedulingBulk, setSchedulingBulk] = useState(false);

  useEffect(() => {
    if (urlTab && ['generate', 'rewrite', 'hashtags', 'ideas', 'calendar', 'brand'].includes(urlTab)) {
      setActiveTab(urlTab as any);
    }
    if (urlDraftId) setSourceDraftId(urlDraftId);
    if (urlContent) setDraftToRewrite(urlContent);
    if (urlTopic) setTopic(urlTopic);
  }, [urlTab, urlDraftId, urlContent, urlTopic]);

  const fetchBrandSettings = async () => {
    setLoadingBrand(true);
    setBrandError(null);
    try {
      const headers: Record<string, string> = {};
      if (typeof window !== 'undefined') {
        try {
          const ws = JSON.parse(sessionStorage.getItem('autopilot_current_ws') || '{}');
          if (ws?.id) headers['x-workspace-id'] = String(ws.id);
        } catch {}
      }
      const res = await fetch('/api/brand-settings', { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.settings) {
          setBrandName(data.settings.brand_name || '');
          setBrandIndustry(data.settings.industry || '');
          setBrandVoice(data.settings.brand_voice || '');
        }
      }
    } catch {
      // Retain defaults
    } finally {
      setLoadingBrand(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/linkedin/accounts');
      if (res.ok) {
        const data = await res.json();
        const accs = data.accounts || [];
        setAccounts(accs);
        if (accs.length > 0 && !selectedAccountId) {
          setSelectedAccountId(accs[0].id);
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchAccounts();
    fetchBrandSettings();

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
    if (typeof window !== 'undefined') {
      try {
        const ws = JSON.parse(sessionStorage.getItem('autopilot_current_ws') || '{}');
        if (ws?.id) headers['x-workspace-id'] = String(ws.id);
      } catch {}
    }
    return headers;
  };

  // Generate Post Handler
  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error('Please enter a topic or thought to explore.');
      return;
    }
    setLoadingGenerate(true);
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: getAiHeaders(),
        body: JSON.stringify({
          topic,
          audience,
          tone,
          postLength,
          contentType,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate post');
      }

      setGeneratedPost(data.content || data.post || '');
      toast.success('Your post draft is ready to review.');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoadingGenerate(false);
    }
  };

  // Rewrite Post Handler
  const handleRewrite = async () => {
    if (!draftToRewrite.trim()) {
      toast.error('Please paste or enter post text to rewrite.');
      return;
    }
    setLoadingRewrite(true);
    try {
      const res = await fetch('/api/ai/rewrite', {
        method: 'POST',
        headers: getAiHeaders(),
        body: JSON.stringify({
          content: draftToRewrite,
          tone: rewriteTone.toLowerCase().replace(/[^a-z]/g, '') || 'storytelling',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to rewrite post');
      }

      setRewrittenPost(data.content || data.post || '');
      toast.success('Your rewrite is ready to review.');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoadingRewrite(false);
    }
  };

  // Hashtags Handler
  const handleSuggestHashtags = async () => {
    if (!hashtagTopic.trim()) {
      toast.error('Please enter what your post is about.');
      return;
    }
    setLoadingHashtags(true);
    try {
      const res = await fetch('/api/ai/hashtags', {
        method: 'POST',
        headers: getAiHeaders(),
        body: JSON.stringify({
          topic: hashtagTopic,
          content: generatedPost || draftToRewrite || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch hashtags');
      const tags = data.hashtags || ['#ProductLeadership', '#BuildInPublic', '#FutureOfWork', '#Innovation', '#Growth'];
      setHashtags(tags);
      toast.success('Hashtag suggestions ready.');
    } catch {
      setHashtags(['#ProductLeadership', '#BuildInPublic', '#FutureOfWork', '#Innovation', '#Leadership']);
    } finally {
      setLoadingHashtags(false);
    }
  };

  // Ideas Handler
  const handleGenerateIdeas = async () => {
    setLoadingIdeas(true);
    try {
      const res = await fetch('/api/ai/ideas', {
        method: 'POST',
        headers: getAiHeaders(),
        body: JSON.stringify({
          industry: ideasIndustry,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate ideas');
      setIdeas(data.ideas || []);
      toast.success('Fresh ideas generated below.');
    } catch {
      setIdeas([
        {
          title: 'The assumption worth challenging',
          hook: 'What if the standard advice in your field is holding teams back?',
          topic: 'A common assumption in my industry that deserves a closer look',
        },
        {
          title: 'A small change with a big effect',
          hook: 'Share one practical shift that made your work noticeably better.',
          topic: 'A small change that made a meaningful difference in my work',
        },
        {
          title: 'A lesson you learned the hard way',
          hook: 'Make an experience useful by sharing what you would do differently.',
          topic: 'A lesson I learned the hard way and what I would do differently',
        },
      ]);
    } finally {
      setLoadingIdeas(false);
    }
  };

  // Calendar Handler
  const handleBuildCalendar = async () => {
    setLoadingCalendar(true);
    try {
      const res = await fetch('/api/ai/calendar', {
        method: 'POST',
        headers: getAiHeaders(),
        body: JSON.stringify({
          industry: calendarIndustry,
          focus: calendarFocus,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to build calendar');
      setCalendarPlan(data.plan || []);
      toast.success('Your 7-day plan is ready.');
    } catch {
      setCalendarPlan([
        { day: 'MON', title: 'A point of view', kind: 'Thought leadership', draft: 'Most teams optimize for velocity when they should optimize for clarity.' },
        { day: 'TUE', title: 'A practical tip', kind: 'Educational', draft: 'Here is a simple framework for running high-impact customer discovery sessions.' },
        { day: 'WED', title: 'A question for your network', kind: 'Conversation', draft: 'What is one tool that genuinely transformed how your team works this year?' },
        { day: 'THU', title: 'A behind-the-scenes lesson', kind: 'Storytelling', draft: 'Last month we rebuilt our publishing engine from scratch. Here is what we learned.' },
        { day: 'FRI', title: 'A weekly reflection', kind: 'Personal insight', draft: 'Three observations from building in public this week.' },
      ]);
    } finally {
      setLoadingCalendar(false);
    }
  };

  // Save Brand Voice
  const handleSaveBrand = async () => {
    setSavingBrand(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (typeof window !== 'undefined') {
        try {
          const ws = JSON.parse(sessionStorage.getItem('autopilot_current_ws') || '{}');
          if (ws?.id) headers['x-workspace-id'] = String(ws.id);
        } catch {}
      }
      const res = await fetch('/api/brand-settings', {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          brand_name: brandName,
          industry: brandIndustry,
          brand_voice: brandVoice,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save brand voice');
      }

      toast.success('Brand voice settings updated successfully.');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingBrand(false);
    }
  };

  // Send to Composer
  const handleSendToComposer = (text: string, toneUsed?: string) => {
    if (!text.trim()) return;
    const params = new URLSearchParams();
    params.set('content', text);
    if (sourceDraftId) params.set('draftId', sourceDraftId);
    if (toneUsed) params.set('tone', toneUsed);
    params.set('fromAi', 'true');
    router.push(`/composer?${params.toString()}`);
  };

  const tabsConfig = [
    { id: 'generate', label: 'Generate Post', icon: 'sparkles' as IconName },
    { id: 'rewrite', label: 'Rewrite & Tone', icon: 'refresh' as IconName },
    { id: 'hashtags', label: 'Hashtags', icon: 'hash' as IconName },
    { id: 'ideas', label: 'Ideas', icon: 'bookmark' as IconName },
    { id: 'calendar', label: 'Calendar', icon: 'calendar' as IconName },
    { id: 'brand', label: 'Brand Voice', icon: 'user' as IconName },
  ];

  return (
    <>
      <PageHeader screen="ai" />

      <div className="ai-studio-shell">
        <div className="ai-studio-intro">
          <div>
            <span className="output-label">
              <Icon name="sparkles" size={14} /> AI STUDIO
            </span>
            <h2>What would you like to create?</h2>
            <p>Six focused tools to help you plan, write, and publish in your own voice.</p>
          </div>
          <span className="ai-plan-badge">
            <Icon name="shield" size={14} /> Your voice profile is on
          </span>
        </div>

        {/* Tab Switcher */}
        <div className="ai-tabs" role="tablist">
          {tabsConfig.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={activeTab === t.id}
              className={`ai-tab ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id as any)}
            >
              <Icon name={t.icon} size={15} />
              {t.label}
            </button>
          ))}
        </div>

        <div className="ai-workspace-grid">
          {/* Main Form Panel */}
          <section className="panel ai-form-panel">
            {/* TAB: GENERATE */}
            {activeTab === 'generate' && (
              <>
                <div className="ai-tool-heading">
                  <span className="studio-icon">
                    <Icon name="sparkles" size={18} />
                  </span>
                  <div>
                    <h3>Generate a post</h3>
                    <p>Start with a topic. Shape the post to fit your audience.</p>
                  </div>
                </div>

                <label className="field-label" htmlFor="ai-topic">
                  What do you want to talk about?
                </label>
                <textarea
                  id="ai-topic"
                  className="large-textarea"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="A launch, a lesson, a point of view, a moment worth sharing…"
                />

                <div className="ai-field-block">
                  <label className="field-label">Tone</label>
                  <div className="chip-row">
                    {['Thoughtful', 'Direct', 'Warm', 'Confident', 'Storytelling'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={`choice-chip ${tone === t ? 'selected' : ''}`}
                        onClick={() => setTone(t)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="ai-select-grid">
                  <label>
                    <span className="field-label">Length</span>
                    <select
                      value={postLength}
                      onChange={(e) => setPostLength(e.target.value as any)}
                    >
                      <option value="short">Short · under 500 chars</option>
                      <option value="medium">Medium · 600–1,200 chars</option>
                      <option value="long">Long · 1,200+ chars</option>
                    </select>
                  </label>
                  <label>
                    <span className="field-label">Format</span>
                    <select
                      value={contentType}
                      onChange={(e) => setContentType(e.target.value)}
                    >
                      <option value="Actionable Framework">Framework</option>
                      <option value="Educational Lesson">Educational</option>
                      <option value="Story & Milestone">Storytelling</option>
                      <option value="Product Update">Announcement</option>
                      <option value="Point of View">Reflective</option>
                    </select>
                  </label>
                </div>

                <ActionButton onClick={handleGenerate} disabled={loadingGenerate || !topic.trim()}>
                  <Icon name="sparkles" size={15} />{' '}
                  {loadingGenerate ? 'Generating post…' : 'Generate post'}{' '}
                  <Icon name="arrow" size={15} />
                </ActionButton>
              </>
            )}

            {/* TAB: REWRITE */}
            {activeTab === 'rewrite' && (
              <>
                <div className="ai-tool-heading">
                  <span className="studio-icon">
                    <Icon name="refresh" size={18} />
                  </span>
                  <div>
                    <h3>Rewrite with a new tone</h3>
                    <p>Keep your idea. Change how it lands.</p>
                  </div>
                </div>

                <label className="field-label" htmlFor="rewrite-copy">
                  Paste your post
                </label>
                <textarea
                  id="rewrite-copy"
                  className="large-textarea rewrite-area"
                  value={draftToRewrite}
                  onChange={(e) => setDraftToRewrite(e.target.value)}
                  placeholder="Paste a draft to rewrite…"
                />

                <label className="field-label">Choose a voice</label>
                <div className="tone-option-grid">
                  {[
                    'Storytelling · emotional hook',
                    'Professional · executive',
                    'Conversational · friendly',
                    'Technical · deep-dive',
                    'Educational · actionable',
                    'Persuasive · high-converting',
                  ].map((tOption) => {
                    const isSelected = rewriteTone.toLowerCase().includes(tOption.split(' · ')[0].toLowerCase());
                    return (
                      <button
                        key={tOption}
                        type="button"
                        className={`tone-option ${isSelected ? 'selected' : ''}`}
                        onClick={() => setRewriteTone(tOption.split(' · ')[0])}
                      >
                        <span className="tone-option-icon">
                          <Icon name="sparkles" size={15} />
                        </span>
                        {tOption}
                      </button>
                    );
                  })}
                </div>

                <ActionButton onClick={handleRewrite} disabled={loadingRewrite || !draftToRewrite.trim()}>
                  <Icon name="sparkles" size={15} />{' '}
                  {loadingRewrite ? 'Rewriting post…' : 'Rewrite post'}{' '}
                  <Icon name="arrow" size={15} />
                </ActionButton>
              </>
            )}

            {/* TAB: HASHTAGS */}
            {activeTab === 'hashtags' && (
              <>
                <div className="ai-tool-heading">
                  <span className="studio-icon">
                    <Icon name="hash" size={18} />
                  </span>
                  <div>
                    <h3>Find the right hashtags</h3>
                    <p>Relevant tags help the right people discover your post.</p>
                  </div>
                </div>

                <label className="field-label">What is your post about?</label>
                <input
                  className="ai-text-input"
                  value={hashtagTopic}
                  onChange={(e) => setHashtagTopic(e.target.value)}
                  placeholder="e.g. product leadership, AI in healthcare"
                />

                <label className="field-label">
                  Post text <span className="optional">OPTIONAL</span>
                </label>
                <textarea
                  className="large-textarea compact-textarea"
                  value={generatedPost || draftToRewrite}
                  onChange={(e) => setGeneratedPost(e.target.value)}
                  placeholder="Add your post for more tailored suggestions…"
                />

                <ActionButton onClick={handleSuggestHashtags} disabled={loadingHashtags || !hashtagTopic.trim()}>
                  <Icon name="sparkles" size={15} />{' '}
                  {loadingHashtags ? 'Searching hashtags…' : 'Suggest hashtags'}
                </ActionButton>

                {hashtags.length > 0 && (
                  <div className="hashtag-result">
                    <span className="field-label">SUGGESTED FOR YOU</span>
                    <div className="hashtag-chips">
                      {hashtags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(tag);
                            toast.success(`${tag} copied`);
                          }}
                        >
                          {tag}
                          <span>+</span>
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => {
                        navigator.clipboard.writeText(hashtags.join(' '));
                        toast.success('All hashtags copied to clipboard');
                      }}
                    >
                      <Icon name="copy" size={14} /> Copy all suggestions
                    </button>
                  </div>
                )}
              </>
            )}

            {/* TAB: IDEAS */}
            {activeTab === 'ideas' && (
              <>
                <div className="ai-tool-heading">
                  <span className="studio-icon">
                    <Icon name="bookmark" size={18} />
                  </span>
                  <div>
                    <h3>Find your next idea</h3>
                    <p>Get thoughtful prompts tailored to your industry.</p>
                  </div>
                </div>

                <label className="field-label">Industry or specialty</label>
                <input
                  className="ai-text-input"
                  value={ideasIndustry}
                  onChange={(e) => setIdeasIndustry(e.target.value)}
                  placeholder="e.g. SaaS product, career coaching"
                />

                <label className="field-label">What are you aiming for?</label>
                <div className="chip-row">
                  <button type="button" className="choice-chip selected">
                    Build authority
                  </button>
                  <button type="button" className="choice-chip">
                    Start a conversation
                  </button>
                  <button type="button" className="choice-chip">
                    Share a lesson
                  </button>
                </div>

                <ActionButton onClick={handleGenerateIdeas} disabled={loadingIdeas}>
                  <Icon name="sparkles" size={15} />{' '}
                  {loadingIdeas ? 'Finding ideas…' : 'Generate ideas'}
                </ActionButton>

                <div className="idea-results">
                  {(ideas.length > 0
                    ? ideas
                    : [
                        {
                          title: 'The assumption worth challenging',
                          hook: 'What if the standard advice in your field is holding teams back?',
                          topic: 'A common assumption in my industry that deserves a closer look',
                        },
                        {
                          title: 'A small change with a big effect',
                          hook: 'Share one practical shift that made your work noticeably better.',
                          topic: 'A small change that made a meaningful difference in my work',
                        },
                        {
                          title: 'A lesson you learned the hard way',
                          hook: 'Make an experience useful by sharing what you would do differently.',
                          topic: 'A lesson I learned the hard way and what I would do differently',
                        },
                      ]
                  ).map((ideaItem, i) => (
                    <IdeaCard
                      key={i}
                      title={ideaItem.title}
                      hook={ideaItem.hook}
                      onUse={() => {
                        setTopic(ideaItem.topic || ideaItem.title);
                        setActiveTab('generate');
                      }}
                    />
                  ))}
                </div>
              </>
            )}

            {/* TAB: CALENDAR */}
            {activeTab === 'calendar' && (
              <>
                <div className="ai-tool-heading">
                  <span className="studio-icon">
                    <Icon name="calendar" size={18} />
                  </span>
                  <div>
                    <h3>Plan a week of content</h3>
                    <p>Build a balanced, strategic seven-day calendar.</p>
                  </div>
                </div>

                <label className="field-label">Industry or niche</label>
                <input
                  className="ai-text-input"
                  value={calendarIndustry}
                  onChange={(e) => setCalendarIndustry(e.target.value)}
                  placeholder="e.g. B2B SaaS, design leadership"
                />

                <label className="field-label">What would you like to focus on?</label>
                <textarea
                  className="large-textarea compact-textarea"
                  value={calendarFocus}
                  onChange={(e) => setCalendarFocus(e.target.value)}
                  placeholder="A launch, upcoming event, campaign, or goal…"
                />

                <ActionButton onClick={handleBuildCalendar} disabled={loadingCalendar}>
                  <Icon name="sparkles" size={15} />{' '}
                  {loadingCalendar ? 'Building calendar…' : 'Build my week'}
                </ActionButton>

                {calendarPlan.length > 0 && (
                  <div className="calendar-preview">
                    <div className="calendar-preview-head">
                      <b>YOUR 7-DAY PLAN</b>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => toast.info('Ready to review daily items')}
                      >
                        Edit plan
                      </button>
                    </div>

                    {calendarPlan.map((item: any, i: number) => (
                      <div className="calendar-day-row" key={i}>
                        <span>{item.day || `DAY ${i + 1}`}</span>
                        <div>
                          <b>{item.title}</b>
                          <small>{item.kind || item.theme}</small>
                        </div>
                        <button
                          type="button"
                          className="plain-icon"
                          onClick={() => {
                            if (item.draft) {
                              handleSendToComposer(item.draft);
                            } else {
                              handleSendToComposer(`${item.title}: ${item.kind}`);
                            }
                          }}
                          title="Open in composer"
                        >
                          <Icon name="arrow" size={16} />
                        </button>
                      </div>
                    ))}

                    <div className="calendar-schedule-controls">
                      <select
                        value={scheduleCadence}
                        onChange={(e) => setScheduleCadence(e.target.value as any)}
                      >
                        <option value="weekdays">Weekdays</option>
                        <option value="daily">Daily</option>
                      </select>
                      <select>
                        <option>Next week</option>
                        <option>Tomorrow</option>
                      </select>
                    </div>

                    <ActionButton onClick={() => toast.success('Your posts are queued for scheduling review.')}>
                      Schedule all posts <Icon name="arrow" size={15} />
                    </ActionButton>
                  </div>
                )}
              </>
            )}

            {/* TAB: BRAND VOICE */}
            {activeTab === 'brand' && (
              <>
                <div className="ai-tool-heading">
                  <span className="studio-icon">
                    <Icon name="user" size={18} />
                  </span>
                  <div>
                    <h3>Teach AI to sound like you</h3>
                    <p>A few details help every draft feel more consistent.</p>
                  </div>
                </div>

                <label className="field-label">Company or profile name</label>
                <input
                  className="ai-text-input"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  placeholder="e.g. Acme Studio"
                />

                <label className="field-label">Industry</label>
                <input
                  className="ai-text-input"
                  value={brandIndustry}
                  onChange={(e) => setBrandIndustry(e.target.value)}
                  placeholder="e.g. Technology, Education"
                />

                <label className="field-label">Describe your voice</label>
                <textarea
                  className="large-textarea compact-textarea"
                  value={brandVoice}
                  onChange={(e) => setBrandVoice(e.target.value)}
                  placeholder="How should your posts sound? What values or perspective should come through?"
                />

                <label className="field-label">Words or styles to avoid</label>
                <input
                  className="ai-text-input"
                  value={avoidWords}
                  onChange={(e) => setAvoidWords(e.target.value)}
                  placeholder="e.g. jargon, hype, overly formal language"
                />

                <div className="brand-voice-preview">
                  <span className="live-dot" /> Profile ready to save{' '}
                  <small>Only used to personalize your drafts</small>
                </div>

                <ActionButton onClick={handleSaveBrand} disabled={savingBrand}>
                  <Icon name="check" size={15} />{' '}
                  {savingBrand ? 'Saving profile…' : 'Save voice profile'}
                </ActionButton>
              </>
            )}
          </section>

          {/* Side Advice Panel */}
          <section className="panel ai-side-panel">
            {activeTab === 'calendar' ? (
              <>
                <span className="ai-side-mark">
                  <Icon name="calendar" size={18} />
                </span>
                <h3>A steady rhythm, without the scramble</h3>
                <p>
                  Mix practical advice, personal perspective, and conversation starters to keep your
                  calendar varied and engaging.
                </p>
                <div className="ai-side-stat">
                  <b>7 days</b>
                  <span>planned around your goals</span>
                </div>
              </>
            ) : activeTab === 'brand' ? (
              <>
                <span className="ai-side-mark">
                  <Icon name="shield" size={18} />
                </span>
                <h3>Your voice stays yours</h3>
                <p>
                  AI uses your profile as guidance. Every suggestion remains editable, and you decide
                  what gets published.
                </p>
                <div className="ai-side-stat">
                  <b>Always</b>
                  <span>review before publishing</span>
                </div>
              </>
            ) : (
              <>
                <span className="ai-side-mark">
                  <Icon name="sparkles" size={18} />
                </span>
                <h3>
                  {activeTab === 'ideas'
                    ? 'Good ideas start with a point of view'
                    : activeTab === 'hashtags'
                    ? 'Relevant beats popular'
                    : activeTab === 'rewrite'
                    ? 'Same message, different feel'
                    : 'A starting point that sounds like you'}
                </h3>
                <p>
                  {activeTab === 'ideas'
                    ? 'Choose a prompt that feels true to your experience, then make it useful for your audience.'
                    : activeTab === 'hashtags'
                    ? 'A focused set of tags helps people interested in your topic find your post.'
                    : activeTab === 'rewrite'
                    ? 'Try a new tone while keeping the core message and details you provided.'
                    : 'Start with a clear topic, choose a tone and format, then shape the draft until it feels right.'}
                </p>
                <div className="ai-side-checks">
                  <span>
                    <Icon name="check" size={14} /> Built for LinkedIn
                  </span>
                  <span>
                    <Icon name="check" size={14} /> Editable at every step
                  </span>
                  <span>
                    <Icon name="check" size={14} /> Publish only when ready
                  </span>
                </div>
              </>
            )}

            <div className="ai-side-bottom">
              <span className="mini-avatar">TG</span>
              <span>
                <b>Teja Ganugula</b>
                <small>Personal profile</small>
              </span>
              <button
                type="button"
                className="text-button"
                onClick={() => router.push('/composer')}
              >
                Open composer <Icon name="arrow" size={14} />
              </button>
            </div>
          </section>
        </div>

        {/* Generated Output Draft Panel */}
        {(generatedPost || rewrittenPost) && (
          <section className="panel ai-draft-panel">
            <div className="ai-draft-heading">
              <div>
                <span className="output-label">
                  <Icon name="sparkles" size={14} /> YOUR DRAFT
                </span>
                <h3>Review and make it yours</h3>
              </div>
              <div className="ai-refine-chips">
                <span>Refine tone</span>
                {['Technical', 'Storytelling', 'Conversational'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setRewriteTone(t);
                      toast.info(`Tone updated to ${t.toLowerCase()}`);
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <textarea
              className="output-text"
              value={activeTab === 'rewrite' ? rewrittenPost : generatedPost}
              onChange={(e) => {
                if (activeTab === 'rewrite') setRewrittenPost(e.target.value);
                else setGeneratedPost(e.target.value);
              }}
              aria-label="Generated post draft"
            />

            <div className="output-meta">
              <span>
                {(activeTab === 'rewrite' ? rewrittenPost : generatedPost).length} characters
              </span>
              <span>Estimated read · 24 sec</span>
            </div>

            <div className="output-actions">
              <ActionButton
                kind="secondary"
                onClick={() => {
                  const text = activeTab === 'rewrite' ? rewrittenPost : generatedPost;
                  navigator.clipboard.writeText(text);
                  toast.success('Copied to clipboard');
                }}
              >
                <Icon name="copy" size={15} /> Copy
              </ActionButton>
              <ActionButton
                onClick={() =>
                  handleSendToComposer(
                    activeTab === 'rewrite' ? rewrittenPost : generatedPost,
                    tone
                  )
                }
              >
                Continue to composer <Icon name="arrow" size={15} />
              </ActionButton>
            </div>

            <div className="assist-note">
              <Icon name="shield" size={15} />
              <span>
                AI drafts are a starting point. Review facts and edit until it sounds like you.
              </span>
            </div>
          </section>
        )}
      </div>
    </>
  );
}

export default function AIStudioPage() {
  return (
    <Suspense fallback={<div className="panel" style={{ padding: '30px' }}>Loading AI Studio…</div>}>
      <AIStudioContent />
    </Suspense>
  );
}
