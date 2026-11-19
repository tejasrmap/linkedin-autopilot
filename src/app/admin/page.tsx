'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/magicpath/common';
import { Icon } from '@/components/magicpath/icons';
import { useToast } from '@/components/ui/toast';

function formatStatus(val: any): string {
  if (!val) return 'Operational';
  if (typeof val === 'string') {
    return val.charAt(0).toUpperCase() + val.slice(1);
  }
  if (typeof val === 'object' && val.status) {
    return String(val.status).charAt(0).toUpperCase() + String(val.status).slice(1);
  }
  return 'Operational';
}

function getIndicatorTone(val: any): string {
  const status = typeof val === 'object' && val?.status ? String(val.status).toLowerCase() : String(val || '').toLowerCase();
  if (status === 'operational' || status === 'healthy' || status === 'good') return 'good';
  if (status === 'degraded' || status === 'warning') return 'warning';
  return 'bad';
}

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

  const queueCount = Number(metrics?.metrics?.scheduledPosts ?? metrics?.queue?.waiting ?? 0);
  const activeWorkspaces = Number(metrics?.metrics?.activeWorkspaces ?? metrics?.workspaces?.total ?? 0);
  const publishedCount = Number(metrics?.metrics?.publishedPosts ?? 0);
  const successRate = Number(metrics?.metrics?.successRatePercent ?? 100);

  const servicesList = [
    { name: 'Database (Supabase PostgreSQL)', raw: metrics?.services?.database },
    { name: 'Publishing Worker Daemon', raw: metrics?.services?.worker },
    { name: 'LinkedIn OAuth & REST API', raw: metrics?.services?.linkedinOAuth || metrics?.services?.linkedin },
    { name: 'AI Generation (Gemini 1.5 Pro)', raw: metrics?.services?.ai },
    { name: 'Queue Engine (Redis / BullMQ)', raw: metrics?.services?.redis },
    { name: 'Billing Engine (Razorpay INR)', raw: metrics?.services?.billing },
  ];

  const recentEvents = Array.isArray(metrics?.recentPublishActivity)
    ? metrics.recentPublishActivity
    : Array.isArray(metrics?.recentEvents)
    ? metrics.recentEvents
    : Array.isArray(metrics?.auditLogs)
    ? metrics.auditLogs
    : [];

  return (
    <>
      <PageHeader screen="admin" />

      {/* Admin Stats Grid */}
      <div className="admin-stats">
        {[
          ['System status', formatStatus(metrics?.systemHealth || 'Operational'), getIndicatorTone(metrics?.systemHealth || 'operational')],
          ['Scheduled queue', `${queueCount} posts scheduled`, 'blue'],
          ['Published posts', `${publishedCount} posts (${successRate}% success)`, 'mint'],
          ['Active workspaces', `${activeWorkspaces} active workspaces`, 'violet'],
        ].map(([label, value, tone]) => (
          <div className="panel admin-stat" key={label}>
            <small>{label}</small>
            <b>{value}</b>
            <span className={`admin-indicator ${tone}`}>
              <i /> {label === 'System status' ? formatStatus(metrics?.systemHealth || 'Operational') : 'Active'}
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

          {servicesList.map((svc) => (
            <div className="service-row" key={svc.name}>
              <span>
                <i className={`service-dot ${getIndicatorTone(svc.raw)}`} />
                {svc.name}
              </span>
              <b>{formatStatus(svc.raw)}</b>
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
            recentEvents.slice(0, 6).map((ev: any, idx: number) => {
              const title = typeof ev === 'string'
                ? ev
                : ev?.status
                ? `Publish attempt: ${ev.status}`
                : ev?.action || ev?.event || 'Publish event';
              const timeStr = ev?.created_at
                ? new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Recently';
              const errorMsg = ev?.error_message ? ` · ${ev.error_message}` : '';

              return (
                <div className="admin-event" key={ev?.id || idx}>
                  <span className="event-dot" />
                  <span>
                    <b>{String(title)}</b>
                    <small>{String(timeStr)}{errorMsg}</small>
                  </span>
                </div>
              );
            })
          ) : (
            <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--muted)', fontSize: '12px' }}>
              {loading ? 'Loading system telemetry…' : 'No audit log entries recorded in the current period.'}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
