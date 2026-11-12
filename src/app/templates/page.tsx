'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bookmark, Plus, ArrowRight, Loader2 } from 'lucide-react';
import { ContentTemplate } from '@/types';

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Framework');

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!title.trim() || !content.trim()) return;
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, category }),
      });
      if (res.ok) {
        setTitle('');
        setContent('');
        setShowCreate(false);
        await fetchTemplates();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-blue-500" />
            Reusable Content Templates
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Standardize high-converting post layouts, frameworks, and company announcements.
          </p>
        </div>

        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-all self-start"
        >
          <Plus className="w-4 h-4" />
          New Template
        </button>
      </div>

      {showCreate && (
        <div className="p-5 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/20 dark:bg-blue-950/20 max-w-xl space-y-3 text-xs">
          <div className="font-bold text-slate-900 dark:text-slate-100">Create New Template</div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 5-Step Product Launch Breakdown"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Category
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Product Update, Thought Leadership, Case Study"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Template Content
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write the template structure with placeholders like [INSERT LESSON]..."
              rows={5}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setShowCreate(false)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold"
            >
              Save Template
            </button>
          </div>
        </div>
      )}

      {/* Templates List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-12 flex justify-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : templates.length === 0 ? (
          <div className="col-span-full p-12 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400">
            No templates saved yet. Create your first template to speed up weekly publishing.
          </div>
        ) : (
          templates.map((tpl) => (
            <div
              key={tpl.id}
              className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-sm flex flex-col justify-between text-xs space-y-3"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-slate-100">{tpl.title}</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {tpl.category}
                  </span>
                </div>
                <p className="mt-2 text-slate-600 dark:text-slate-300 line-clamp-4 leading-relaxed whitespace-pre-wrap">
                  {tpl.content}
                </p>
              </div>

              <button
                onClick={() => router.push(`/composer?content=${encodeURIComponent(tpl.content)}`)}
                className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-blue-600 dark:text-blue-400 font-semibold transition-colors"
              >
                Use Template <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

