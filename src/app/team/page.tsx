'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  ShieldCheck,
  Mail,
  Plus,
  UserCheck,
  Shield,
  Sparkles,
  Building,
  Check,
  Trash2,
  Key,
  ChevronDown,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface TeamMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'editor' | 'approver' | 'viewer';
  avatarUrl?: string;
  createdAt: string;
  isCurrent?: boolean;
}

export default function TeamPage() {
  const toast = useToast();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [currentRole, setCurrentRole] = useState<string>('viewer');
  const [loading, setLoading] = useState(true);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'editor' | 'approver' | 'viewer'>('editor');
  const [sending, setSending] = useState(false);

  const [deleteMemberId, setDeleteMemberId] = useState<string | null>(null);
  const [deleteMemberName, setDeleteMemberName] = useState<string>('');
  const [deleting, setDeleting] = useState(false);

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/workspaces/members');
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
        setCurrentRole(data.currentRole || 'viewer');
      }
    } catch (e: any) {
      toast.error('Failed to load workspace members: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      toast.error('Please specify a valid email address.');
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/workspaces/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
          fullName: inviteName.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send invitation');
      }

      toast.success(data.message || `Member added with ${inviteRole} role!`);
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteName('');
      await fetchMembers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteMemberId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/workspaces/members?id=${deleteMemberId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove member');

      toast.success(`Removed ${deleteMemberName} from workspace`);
      setMembers((prev) => prev.filter((m) => m.id !== deleteMemberId));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
      setDeleteMemberId(null);
    }
  };

  const getRoleBadge = (role: string) => {
    const r = role.toLowerCase();
    switch (r) {
      case 'owner':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'admin':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'editor':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'approver':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  const canManage = currentRole === 'owner' || currentRole === 'admin';

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            Team Workspace & Access Control
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Multi-seat role-based permissions with row-level security isolation (Owner, Admin, Editor, Approver, Viewer).
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 shadow-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Invite Member
          </button>
        )}
      </div>

      {/* Role explanation cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827]">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
            Owner & Admin
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Full workspace governance, LinkedIn account OAuth connection, and billing control.
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827]">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Editor
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Create, draft, and schedule posts for BullMQ queue dispatch.
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827]">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Approver
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Mandatory content gateway: reviews and approves high-visibility corporate posts.
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827]">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
            <span className="w-2 h-2 rounded-full bg-slate-500"></span>
            Viewer
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Read-only access to calendar, live analytics, and published history.
          </p>
        </div>
      </div>

      {/* Members List Table Card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            Active Team Members ({members.length})
          </h2>
          <span className="text-[11px] text-slate-400">
            Enterprise Plan (Unlimited Seats)
          </span>
        </div>

        {loading ? (
          <div className="p-8 flex items-center justify-center text-xs text-slate-400 gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            <span>Loading workspace members...</span>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {members.map((member) => (
              <div
                key={member.id}
                className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white text-xs shadow-sm">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      {member.name}
                      {member.isCurrent && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                          You
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      {member.email}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`text-[11px] font-semibold uppercase px-2.5 py-1 rounded-full border ${getRoleBadge(
                      member.role
                    )}`}
                  >
                    {member.role}
                  </span>

                  {canManage && member.role !== 'owner' && !member.isCurrent && (
                    <button
                      onClick={() => {
                        setDeleteMemberId(member.id);
                        setDeleteMemberName(member.name);
                      }}
                      title="Remove member"
                      className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite Member Modal */}
      <Modal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Invite New Collaborator"
        maxWidth="md"
      >
        <form onSubmit={handleSendInvite} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="e.g. Sarah Jenkins"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Work Email Address
            </label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="sarah@company.com"
              required
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Role & Permissions
            </label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as any)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="editor">Editor — Can author, draft, and schedule posts</option>
              <option value="approver">Approver — Can review and approve scheduled posts</option>
              <option value="admin">Admin — Can manage members, settings, and accounts</option>
              <option value="viewer">Viewer — Read-only visibility to calendar & analytics</option>
            </select>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowInviteModal(false)}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending}
              className="px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 shadow-sm flex items-center gap-1.5"
            >
              {sending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Inviting...</span>
                </>
              ) : (
                <span>Send Invitation</span>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete Modal */}
      <ConfirmDialog
        isOpen={!!deleteMemberId}
        onClose={() => setDeleteMemberId(null)}
        onConfirm={handleConfirmDelete}
        title="Remove Team Member"
        message={`Are you sure you want to remove ${deleteMemberName} from this workspace? They will immediately lose access to all posts, connected accounts, and analytics.`}
        confirmText="Remove Member"
        loading={deleting}
        variant="danger"
      />
    </div>
  );
}
