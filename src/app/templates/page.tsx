'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader, ActionButton } from '@/components/magicpath/common';
import { Icon } from '@/components/magicpath/icons';
import { ContentTemplate } from '@/types';
import { useToast } from '@/components/ui/toast';
import { Modal } from '@/components/ui/modal';

const builtInTemplates = [
  {
    title: 'A lesson learned',
    description: 'Share a specific lesson and what it changed for your team.',
    body: 'The best lessons usually come from projects that didn’t go as planned.\n\nHere’s what happened:\n1. We assumed…\n2. The reality was…\n3. What we changed moving forward…\n\nWhat’s one recent lesson you’d share?',
    tone: 'blue',
    category: 'Story',
  },
  {
    title: 'A point of view',
    description: 'Lead with a belief. Support it with a clear reason.',
    body: 'Most teams in our industry optimize for speed when they should optimize for clarity.\n\nHere is why:\n• Speed without alignment multiplies mistakes\n• Clear requirements remove unnecessary friction\n\nWhat is your perspective?',
    tone: 'violet',
    category: 'Thought leadership',
  },
  {
    title: 'A small win',
    description: 'Celebrate progress and the people behind it.',
    body: 'Huge milestone for our team today! 🚀\n\nWe just launched our new publishing architecture.\n\nA huge thank you to everyone who made this possible. The journey is just getting started.',
    tone: 'mint',
    category: 'Milestone',
  },
  {
    title: 'A practical how-to',
    description: 'Turn a repeatable process into helpful steps.',
    body: 'How to run effective asynchronous standups in 4 steps:\n\n1. What shipped yesterday\n2. What is shipping today\n3. Blockers\n4. Who needs feedback\n\nKeep it under 3 minutes.',
    tone: 'amber',
    category: 'Educational',
  },
  {
    title: 'A customer moment',
    description: 'Tell the story of a meaningful customer outcome.',
    body: 'Earlier this week, a customer told us our tool cut their content planning time by 80%.\n\nMoments like this remind us why we build what we build.',
    tone: 'rose',
    category: 'Customer story',
  },
  {
    title: 'A weekly reflection',
    description: 'Close the week with one useful observation.',
    body: 'Three things I noticed while shipping products this week:\n\n1. Simple beats clever every time\n2. Documentation is a superpower\n3. Feedback loops make or break momentum',
    tone: 'blue',
    category: 'Reflection',
  },
];

export default function TemplatesPage() {
  const router = useRouter();
  const toast = useToast();
  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('Framework');
  const [saving, setSaving] = useState(false);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch {
      // Fallback to built-in
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    setSaving(true);
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          content: newContent.trim(),
          category: newCategory,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save template');
      }

      toast.success('Template saved successfully');
      setShowCreate(false);
      setNewTitle('');
      setNewContent('');
      await fetchTemplates();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUseTemplate = (templateBody: string) => {
    router.push(`/composer?content=${encodeURIComponent(templateBody)}`);
  };

  return (
    <>
      <PageHeader
        screen="templates"
        action="Create template"
        onAction={() => setShowCreate(true)}
      />

      <div className="template-grid">
        {builtInTemplates.map((t) => (
          <button
            type="button"
            className="template-card"
            key={t.title}
            onClick={() => handleUseTemplate(t.body)}
          >
            <span className={`template-icon ${t.tone}`}>
              <Icon name="file" size={18} />
            </span>
            <span className="template-category">{t.category}</span>
            <h3>{t.title}</h3>
            <p>{t.description}</p>
            <span className="template-use">
              Use template <Icon name="arrow" size={14} />
            </span>
          </button>
        ))}

        {templates.map((t, idx) => (
          <button
            type="button"
            className="template-card"
            key={t.id || idx}
            onClick={() => handleUseTemplate(t.content)}
          >
            <span className="template-icon violet">
              <Icon name="bookmark" size={18} />
            </span>
            <span className="template-category">{t.category || 'Custom'}</span>
            <h3>{t.title}</h3>
            <p>{t.content.substring(0, 80)}…</p>
            <span className="template-use">
              Use template <Icon name="arrow" size={14} />
            </span>
          </button>
        ))}
      </div>

      {/* Create Template Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Content Template"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="field-label" htmlFor="tpl-title">
              Template Title
            </label>
            <input
              id="tpl-title"
              type="text"
              className="ai-text-input"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Weekly Roundup"
              required
            />
          </div>

          <div>
            <label className="field-label" htmlFor="tpl-cat">
              Category
            </label>
            <input
              id="tpl-cat"
              type="text"
              className="ai-text-input"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="e.g. Leadership, Framework, Story"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="tpl-content">
              Post Template Body
            </label>
            <textarea
              id="tpl-content"
              className="large-textarea"
              rows={6}
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="Write the starting framework for this template…"
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || !newTitle.trim() || !newContent.trim()}
            >
              {saving ? 'Saving…' : 'Save Template'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
