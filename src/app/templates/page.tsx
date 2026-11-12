'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bookmark, Plus, ArrowRight, Loader2, Sparkles, Folder, Trash2, Copy } from 'lucide-react';
import { ContentTemplate } from '@/types';
import { useToast } from '@/components/ui/toast';
import { Modal } from '@/components/ui/modal';

export default function TemplatesPage() {
  const router = useRouter();
  const toast = useToast();
  const [templates, setTemplates] = useState<ContentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Framework');
  const [saving, setSaving] = useState(false);

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
    } catch (e: any) {
      toast.error('Failed to load templates: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error('Please enter both template title and content.');
      return;
    }
    try {
      setSaving(true);
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, category }),
      });
      if (res.ok) {
        setTitle('');
        setContent('');
        setShowCreate(false);
        toast.success('Template saved successfully!');
        await fetchTemplates();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to save template');
      }
    } catch (e: any) {
      toast.error(e.message || 'Error saving template');
    } finally {
      setSaving(false);
    }
  };

  const applyTemplateInComposer = (tContent: string) => {
    router.push(`/composer?template=${encodeURIComponent(tContent)}`);
    toast.info('Loaded template into Composer');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-blue-500" />
            Content Architecture Templates
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            High-converting LinkedIn post frameworks, viral hooks, and product launch sequences.
          </p>
        </div>

        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 shadow-sm transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          Create Template
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 text-slate-400 text-xs">
          <Loader2 className="w-6 h-6 animate-spin mb-2 text-blue-500" />
          Loading templates...
        </div>
      ) : templates.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-slate-300 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/30">
          <Bookmark className="w-8 h-8 text-slate-400 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">No custom templates yet</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Build your library of high-retention frameworks to accelerate writing.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 px-3.5 py-1.5 rounded-lg bg-blue-600 text-white font-medium text-xs hover:bg-blue-700 transition-colors inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Create First Template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] flex flex-col justify-between hover:border-blue-500/50 hover:shadow-lg transition-all group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                    {tpl.category}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(tpl.content);
                      toast.success('Template content copied!');
                    }}
                    title="Copy template"
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2">
                  {tpl.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-4 font-mono bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800/80 whitespace-pre-wrap">
                  {tpl.content}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {tpl.content.length} chars
                </span>
                <button
                  onClick={() => applyTemplateInComposer(tpl.content)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                >
                  Apply in Composer
                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modern Create Template Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Content Framework Template"
        maxWidth="xl"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Template Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 5-Step Problem / Agitate / Solve Framework"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Framework">Framework</option>
              <option value="Storytelling">Storytelling</option>
              <option value="Product Launch">Product Launch</option>
              <option value="Hiring / Culture">Hiring / Culture</option>
              <option value="Educational / How-to">Educational / How-to</option>
              <option value="Contrarian Take">Contrarian Take</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Template Body / Prompt Structure
            </label>
            <textarea
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write the hook, body placeholders [Insight 1], and call-to-action..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 text-xs font-mono text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => setShowCreate(false)}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Save Template
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
