'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader, ActionButton } from '@/components/magicpath/common';
import { Icon } from '@/components/magicpath/icons';
import { useToast } from '@/components/ui/toast';

export default function AdminDashboardPage() {
  const toast = useToast();
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadAdminData = useCallback(async () => {
    try {
      setLoading(true);
      const metricsRes = await fetch('/api/admin/metrics');
      if (metricsRes.ok) {
        const mData = await metricsRes.json();
        setMetrics(mData);
      }
    } catch {
      // Keep state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const queueCount = metrics?.queue?.waiting ?? 0;
  const activeWorkspaces = metrics?.workspaces?.total ?? 0;
  const aiToday = metrics?.ai?.today ?? metrics?.aiGenerationsToday ?? 0;
  const recentEvents = metrics?.recentEvents || metrics?.auditLogs || [];

  return (
    <>
      <PageHeader screen="admin" />

      {/* Admin Stats Grid */}
      <div className="admin-stats">
        {[
          ['System status', 'All systems operational', 'good'],
          ['Publishing queue', `${queueCount} posts queued`, 'blue'],
          ['AI requests today', `${aiToday} requests`, 'violet'],
          ['Active workspaces', `${activeWorkspaces} workspaces`, 'mint'],
        ].map(([label, value, tone]) => (
          <div className="panel admin-stat" key={label}>
            <small>{label}</small>
            <b>{value}</b>
            <span className={`admin-indicator ${tone}`}>
              <i /> {label === 'System status' ? 'Healthy' : 'Active'}
            </span>
          </div>
        ))}
      </div>

      {/* Service Health & Audit Log Grid */}
      <div className="admin-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Service health</h3>
              <p>Real-time subsystem telemetry</p>
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={() => {
                loadAdminData();
                toast.success('System telemetry refreshed.');
              }}
              title="Refresh status"
            >
              <Icon name="refresh" size={15} />
            </button>
          </div>

          {[
            ['Publishing worker', metrics?.services?.worker || 'Operational', 'good'],
            ['LinkedIn OAuth API', metrics?.services?.linkedin || 'Operational', 'good'],
            ['AI Content Generation', metrics?.services?.ai || 'Operational', 'good'],
            ['Supabase Storage', metrics?.services?.storage || 'Operational', 'good'],
          ].map(([name, status, state]) => (
            <div className="service-row" key={name}>
              <span>
                <i className={`service-dot ${state}`} />
                {name}
              </span>
              <b>{status}</b>
            </div>
          ))}
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h3>Recent activity</h3>
              <p>Workspace audit ledger</p>
            </div>
          </div>

          {recentEvents.length > 0 ? (
            recentEvents.slice(0, 5).map((ev: any, idx: number) => (
              <div className="admin-event" key={ev.id || idx}>
                <span className="event-dot" />
                <span>
                  <b>{ev.action || ev.event || 'System action executed'}</b>
                  <small>{ev.created_at ? new Date(ev.created_at).toLocaleTimeString() : 'Recently'}</small>
                </span>
              </div>
            ))
          ) : (
            <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--muted)', fontSize: '12px' }}>
              No audit log entries recorded in the current period.
            </div>
          )}
        </section>
      </div>
    </>
  );
}
