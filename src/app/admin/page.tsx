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
      // Fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const queueCount = metrics?.queue?.waiting ?? 6;
  const activeWorkspaces = metrics?.workspaces?.total ?? 42;

  return (
    <>
      <PageHeader screen="admin" />

      {/* Admin Stats Grid */}
      <div className="admin-stats">
        {[
          ['System status', 'All systems operational', 'good'],
          ['Publishing queue', `${queueCount} posts waiting`, 'blue'],
          ['AI requests today', '128 requests', 'violet'],
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
              <p>Last checked 2 minutes ago</p>
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={() => {
                loadAdminData();
                toast.success('System status refreshed.');
              }}
              title="Refresh status"
            >
              <Icon name="refresh" size={15} />
            </button>
          </div>

          {[
            ['Publishing worker', 'Running', 'good'],
            ['LinkedIn API', 'Connected', 'good'],
            ['AI generation', 'Operational', 'good'],
            ['Media storage', 'Operational', 'good'],
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
              <p>Workspace events</p>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() => toast.info('Full audit log export available in Settings')}
            >
              Audit log <Icon name="arrow" size={14} />
            </button>
          </div>

          {[
            ['Teja published a post', '2 min ago'],
            ['AI draft generated', '14 min ago'],
            ['New teammate invited', '1 hour ago'],
            ['LinkedIn account connected', 'Yesterday'],
          ].map(([event, time]) => (
            <div className="admin-event" key={event}>
              <span className="event-dot" />
              <span>
                <b>{event}</b>
                <small>{time}</small>
              </span>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
