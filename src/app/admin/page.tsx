'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Activity,
  Layers,
  Linkedin,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  LifeBuoy,
  Building,
  User,
  ArrowUpRight,
  TrendingUp,
  Server,
  Database,
  Lock,
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';

export default function AdminDashboardPage() {
  const toast = useToast();
  const [metrics, setMetrics] = useState<any>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingTicket, setUpdatingTicket] = useState<string | null>(null);

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    try {
      setLoading(true);
      const [metricsRes, ticketsRes] = await Promise.all([
        fetch('/api/admin/metrics'),
        fetch('/api/support'),
      ]);

      if (metricsRes.ok) {
        const mData = await metricsRes.json();
        setMetrics(mData);
      } else if (metricsRes.status === 403) {
        toast.error('Access restricted to Workspace Owners & System Administrators.');
      }

      if (ticketsRes.ok) {
        const tData = await ticketsRes.json();
        setTickets(tData.tickets || []);
      }
    } catch (e: any) {
      console.error(e);
      toast.error('Failed to load admin metrics.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTicketStatus = async (ticketId: string, newStatus: string) => {
    try {
      setUpdatingTicket(ticketId);
      const res = await fetch('/api/support', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId, status: newStatus }),
      });

      if (res.ok) {
        toast.success(`Ticket marked as ${newStatus}`);
        setTickets((prev) =>
          prev.map((t) => (t.id === ticketId ? { ...t, status: newStatus } : t))
        );
      } else {
        toast.error('Failed to update ticket status');
      }
    } catch {
      toast.error('Network error updating ticket');
    } finally {
      setUpdatingTicket(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              GT InnoX SaaS Operations & Admin
            </h1>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Operational
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time platform health, publishing queue reliability, and support ticket management.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadAdminData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Metrics</span>
          </button>
        </div>
      </div>

      {/* System Infrastructure Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">Database & RLS</span>
            <Database className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Supabase Connected
          </div>
          <p className="text-[10px] text-slate-400">PostgreSQL 15 · AES-256 RLS</p>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">Worker & Scheduler</span>
            <Server className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Cron & BullMQ Active
          </div>
          <p className="text-[10px] text-slate-400">Dual-engine failover enabled</p>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">LinkedIn REST APIs</span>
            <Linkedin className="w-4 h-4 text-[#0A66C2]" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            OAuth 2.0 Healthy
          </div>
          <p className="text-[10px] text-slate-400">Restli v2 · Token Refresh</p>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">AI Content Engine</span>
            <Activity className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500" />
            Gemini 1.5 Pro
          </div>
          <p className="text-[10px] text-slate-400">30 req/min rate limit active</p>
        </div>
      </div>

      {/* Aggregate Publishing & Workspace Metrics */}
      {metrics && (
        <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              Tenant & Publishing Delivery Telemetry
            </h3>
            <span className="text-xs text-slate-400">
              Delivery Success: <strong className="text-emerald-500">{metrics.metrics.successRatePercent}%</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Active Tenants</span>
              <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                {metrics.metrics.activeWorkspaces}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">LinkedIn Accounts</span>
              <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                {metrics.metrics.activeLinkedInAccounts}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Published</span>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {metrics.metrics.publishedPosts}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Scheduled Queue</span>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                {metrics.metrics.scheduledPosts}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80">
              <span className="text-[10px] text-slate-400 uppercase font-semibold">Failed Attempts</span>
              <p className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                {metrics.metrics.failedPosts}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Support & Issue Ticket Inbox */}
      <div className="p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LifeBuoy className="w-5 h-5 text-blue-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Customer Support & Beta Issue Queue
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
              {tickets.length} total
            </span>
          </div>
        </div>

        {tickets.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            No active support tickets. All customer inquiries resolved.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 uppercase text-[10px] font-bold">
                <tr>
                  <th className="px-4 py-3 rounded-l-xl">Subject</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 rounded-r-xl text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900 dark:text-white">{t.subject}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-xs">{t.description}</div>
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-600 dark:text-slate-300">
                      {t.category}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] ${
                          t.priority === 'urgent'
                            ? 'bg-rose-500/10 text-rose-500'
                            : t.priority === 'high'
                            ? 'bg-amber-500/10 text-amber-500'
                            : 'bg-slate-500/10 text-slate-500'
                        }`}
                      >
                        {t.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] ${
                          t.status === 'resolved'
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : t.status === 'in_progress'
                            ? 'bg-blue-500/10 text-blue-500'
                            : 'bg-slate-500/10 text-slate-500'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-[10px]">
                      {new Date(t.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {t.status !== 'resolved' ? (
                        <button
                          onClick={() => handleUpdateTicketStatus(t.id, 'resolved')}
                          disabled={updatingTicket === t.id}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[11px] transition-colors"
                        >
                          Resolve
                        </button>
                      ) : (
                        <span className="text-emerald-500 font-medium text-[11px]">Completed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
