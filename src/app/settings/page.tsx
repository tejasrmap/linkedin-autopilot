'use client';

import React, { useState } from 'react';
import { Settings, Shield, Key, Bell, Globe, Check } from 'lucide-react';

export default function SettingsPage() {
  const [appName, setAppName] = useState('GT InnoX Autopilot');
  const [defaultTimezone, setDefaultTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  );
  const [autoApproveAi, setAutoApproveAi] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-2xl animate-in fade-in duration-200">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-500" />
          Workspace & Security Settings
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Configure default publishing timezones, AI approval gates, and encryption keys.
        </p>
      </div>

      <form onSubmit={handleSave} className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-5 text-xs">
        <div>
          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Workspace Display Name
          </label>
          <input
            type="text"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200"
          />
        </div>

        <div>
          <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Default Publishing Timezone
          </label>
          <input
            type="text"
            value={defaultTimezone}
            onChange={(e) => setDefaultTimezone(e.target.value)}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200"
          />
          <div className="text-[11px] text-slate-400 mt-1">
            All jobs are converted to UTC and dispatched by the BullMQ worker.
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoApproveAi}
              onChange={(e) => setAutoApproveAi(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-0 mt-0.5"
            />
            <div>
              <div className="font-semibold text-slate-800 dark:text-slate-200">
                AI Content Approval Gate (Safe Guard)
              </div>
              <div className="text-[11px] text-slate-400 leading-relaxed">
                When unchecked (default & recommended), all AI-generated posts require explicit human approval before being queued for LinkedIn publishing.
              </div>
            </div>
          </label>
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
            <Shield className="w-3.5 h-3.5 text-emerald-500" />
            Tokens AES-256-GCM Encrypted
          </div>

          <button
            type="submit"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
          >
            {saved ? <Check className="w-3.5 h-3.5" /> : null}
            {saved ? 'Saved Successfully' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

