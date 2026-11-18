'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader, ActionButton } from '@/components/magicpath/common';
import { Icon, IconName } from '@/components/magicpath/icons';
import { useToast } from '@/components/ui/toast';

export default function SettingsPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'notifications' | 'brand' | 'security'>('profile');
  const [fullName, setFullName] = useState('Teja Ganugula');
  const [email, setEmail] = useState('teja@gtinnox.com');
  const [workspaceName, setWorkspaceName] = useState('GT InnoX Workspace');
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata'
  );
  const [industry, setIndustry] = useState('Technology & Software');
  const [brandVoice, setBrandVoice] = useState('Thoughtful & direct');
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      if (typeof window !== 'undefined') {
        const cachedUser = JSON.parse(sessionStorage.getItem('autopilot_user') || '{}');
        const cachedWs = JSON.parse(sessionStorage.getItem('autopilot_current_ws') || '{}');
        if (cachedUser.full_name) setFullName(cachedUser.full_name);
        if (cachedUser.email) setEmail(cachedUser.email);
        if (cachedWs.name) setWorkspaceName(cachedWs.name);
      }

      const [wsRes, brandRes] = await Promise.all([
        fetch('/api/workspaces'),
        fetch('/api/brand-settings'),
      ]);

      if (brandRes.ok) {
        const bData = await brandRes.json();
        if (bData.settings) {
          if (bData.settings.brand_name) setWorkspaceName(bData.settings.brand_name);
          if (bData.settings.industry) setIndustry(bData.settings.industry);
          if (bData.settings.brand_voice) setBrandVoice(bData.settings.brand_voice);
        }
      }
    } catch {
      // Keep defaults
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (typeof window !== 'undefined') {
        try {
          const ws = JSON.parse(sessionStorage.getItem('autopilot_current_ws') || '{}');
          if (ws?.id) headers['x-workspace-id'] = String(ws.id);
        } catch {}
      }

      await fetch('/api/brand-settings', {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          brand_name: workspaceName,
          industry,
          brand_voice: brandVoice,
        }),
      });

      toast.success('Workspace settings saved successfully.');
    } catch (e: any) {
      toast.error(e.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const tabs: { id: typeof activeTab; label: string; icon: IconName }[] = [
    { id: 'profile', label: 'Profile', icon: 'users' },
    { id: 'preferences', label: 'Preferences', icon: 'settings' },
    { id: 'notifications', label: 'Notifications', icon: 'bell' },
    { id: 'brand', label: 'Brand voice', icon: 'sparkles' },
    { id: 'security', label: 'Security', icon: 'shield' },
  ];

  return (
    <>
      <PageHeader screen="settings" />

      <div className="settings-layout">
        <nav className="settings-nav">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? 'active' : ''}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon name={tab.icon} size={16} />
              {tab.label}
            </button>
          ))}
        </nav>

        <section className="panel settings-panel">
          {activeTab === 'profile' && (
            <>
              <div className="panel-heading">
                <div>
                  <h3>Profile</h3>
                  <p>How your workspace appears to your team.</p>
                </div>
              </div>
              <div className="settings-form">
                <label>
                  Full name
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </label>
                <label>
                  Email address
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <label>
                  Workspace name
                  <input
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                  />
                </label>
                <label>
                  Timezone
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">America/New_York (EST)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                    <option value="Europe/London">Europe/London (GMT)</option>
                  </select>
                </label>
              </div>
            </>
          )}

          {activeTab === 'preferences' && (
            <>
              <div className="panel-heading">
                <div>
                  <h3>Workspace Preferences</h3>
                  <p>Customize scheduling and publishing defaults.</p>
                </div>
              </div>
              <div className="settings-form">
                <label>
                  Default Posting Hour
                  <select defaultValue="10:00">
                    <option value="09:00">9:00 AM</option>
                    <option value="10:00">10:00 AM (Recommended)</option>
                    <option value="14:00">2:00 PM</option>
                    <option value="18:00">6:00 PM</option>
                  </select>
                </label>
                <label>
                  Default Cadence
                  <select defaultValue="weekdays">
                    <option value="weekdays">Weekdays only</option>
                    <option value="daily">Daily including weekends</option>
                  </select>
                </label>
              </div>
            </>
          )}

          {activeTab === 'notifications' && (
            <>
              <div className="panel-heading">
                <div>
                  <h3>Notifications</h3>
                  <p>Manage email and in-app alerts for publishing events.</p>
                </div>
              </div>
              <div className="settings-form">
                <label style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>
                    <b>Publishing Success Notifications</b>
                    <small style={{ display: 'block', color: 'var(--muted)' }}>
                      Receive an alert when a scheduled post goes live.
                    </small>
                  </span>
                  <input
                    type="checkbox"
                    checked={emailAlerts}
                    onChange={(e) => setEmailAlerts(e.target.checked)}
                    style={{ width: '18px', height: '18px' }}
                  />
                </label>
              </div>
            </>
          )}

          {activeTab === 'brand' && (
            <>
              <div className="panel-heading">
                <div>
                  <h3>Brand Voice &amp; Tone</h3>
                  <p>Guide the AI studio in matching your personal style.</p>
                </div>
              </div>
              <div className="settings-form">
                <label>
                  Industry or Specialty
                  <input
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder="e.g. SaaS, Product Engineering"
                  />
                </label>
                <label>
                  Voice description
                  <textarea
                    rows={4}
                    value={brandVoice}
                    onChange={(e) => setBrandVoice(e.target.value)}
                    placeholder="Describe how your posts should sound…"
                  />
                </label>
              </div>
            </>
          )}

          {activeTab === 'security' && (
            <>
              <div className="panel-heading">
                <div>
                  <h3>Security &amp; Encryption</h3>
                  <p>Overview of authentication, tokens, and storage security.</p>
                </div>
              </div>
              <div className="settings-form">
                <div
                  style={{
                    padding: '14px',
                    borderRadius: '8px',
                    background: 'var(--surface-soft)',
                    border: '1px solid var(--line)',
                    fontSize: '11px',
                    lineHeight: 1.6,
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 600 }}>🔒 AES-256 Token Encryption Active</p>
                  <p style={{ margin: '6px 0 0', color: 'var(--muted)' }}>
                    LinkedIn OAuth refresh tokens are encrypted at rest with AES-256-GCM. Row-Level
                    Security (RLS) is enforced across all workspace queries.
                  </p>
                </div>
              </div>
            </>
          )}

          <div className="settings-save">
            <span>Changes save to your workspace profile.</span>
            <ActionButton onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </ActionButton>
          </div>
        </section>
      </div>
    </>
  );
}
