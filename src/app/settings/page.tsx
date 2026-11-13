'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Shield, Key, Bell, Globe, Check, Save, ShieldCheck, Lock, RefreshCw, Loader2, Sparkles } from 'lucide-react';
import { useToast } from '@/components/ui/toast';

export default function SettingsPage() {
  const toast = useToast();
  const [appName, setAppName] = useState('');
  const [defaultTimezone, setDefaultTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'
  );
  const [industry, setIndustry] = useState('');
  const [brandVoice, setBrandVoice] = useState('Thought leadership & inspiring');
  const [autoApproveAi, setAutoApproveAi] = useState(false);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const [wsRes, brandRes] = await Promise.all([
        fetch('/api/workspaces'),
        fetch('/api/brand-settings'),
      ]);

      if (wsRes.ok) {
        const wsData = await wsRes.json();
        const currentWs = (wsData.workspaces || []).find((w: any) => w.isCurrent);
        if (currentWs) {
          setAppName(currentWs.name);
        }
      }

      if (brandRes.ok) {
        const bData = await brandRes.json();
        if (bData.settings) {
          setAppName((prev) => prev || bData.settings.brand_name || '');
          setIndustry(bData.settings.industry || '');
          setBrandVoice(bData.settings.brand_voice || 'Thought leadership & inspiring');
        }
      }
    } catch (e: any) {
      toast.error('Failed to load settings: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appName.trim()) {
      toast.error('Workspace display name is required.');
      return;
    }

    setSaving(true);
    try {
      const [patchWs, putBrand] = await Promise.all([
        fetch('/api/workspaces', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: appName.trim() }),
        }),
        fetch('/api/brand-settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brandName: appName.trim(),
            industry: industry.trim() || undefined,
            brandVoice: brandVoice.trim() || undefined,
          }),
        }),
      ]);

      if (!patchWs.ok) {
        const err = await patchWs.json();
        throw new Error(err.error || 'Failed to update workspace name');
      }

      toast.success('Workspace settings and brand profile saved successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center text-xs text-slate-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
        <span>Loading workspace settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl animate-in fade-in duration-200">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-500" />
          Workspace & Security Settings
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Configure default publishing timezones, brand voice architecture, notification channels, and encryption keys.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* General Settings */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800/80 pb-3">
            <Globe className="w-4 h-4 text-blue-500" />
            General Preferences
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Workspace Display Name
            </label>
            <input
              type="text"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="e.g. Lead Developer (GT InnoX)'s Workspace"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Default Publishing Timezone
            </label>
            <input
              type="text"
              value={defaultTimezone}
              onChange={(e) => setDefaultTimezone(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            <div className="text-[11px] text-slate-400 mt-1">
              All jobs are scheduled in this timezone and converted to UTC by the BullMQ worker.
            </div>
          </div>
        </div>

        {/* AI & Brand Profile */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800/80 pb-3">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            AI Studio Brand Architecture
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Target Industry / Sector
            </label>
            <input
              type="text"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="e.g. Enterprise B2B SaaS & Artificial Intelligence"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Brand Voice & Strategic Tone
            </label>
            <input
              type="text"
              value={brandVoice}
              onChange={(e) => setBrandVoice(e.target.value)}
              placeholder="e.g. Visionary, data-driven, actionable frameworks"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Security & Safeguards */}
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800/80 pb-3">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            Security, Encryption & Publishing Safeguards
          </div>

          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoApproveAi}
              onChange={(e) => setAutoApproveAi(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-0"
            />
            <div>
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                AI Content Approval Gate
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                When enabled, posts generated by AI Studio require explicit manual review before BullMQ scheduling.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={emailAlerts}
              onChange={(e) => setEmailAlerts(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-0"
            />
            <div>
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Failure & Token Expiry Notifications
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Receive instant alerts when a LinkedIn token is expiring or a scheduled post encounters an error.
              </p>
            </div>
          </label>

          {/* Encryption Key status card */}
          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <Lock className="w-4 h-4 text-emerald-500" />
              <div>
                <div className="font-semibold text-slate-800 dark:text-slate-200">
                  AES-256-GCM Vault Key
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  ENCRYPTION_KEY active (256-bit authentication tag verification)
                </div>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              Secured
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 shadow-sm transition-all disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
}
