'use client';

import React, { useState } from 'react';
import { Users, ShieldCheck, Mail, Plus, UserCheck, Shield, Sparkles, Building, Check, Trash2, Key } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { Modal } from '@/components/ui/modal';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'Owner' | 'Admin' | 'Editor' | 'Approver' | 'Viewer';
  status: 'Active' | 'Pending';
  avatar?: string;
}

export default function TeamPage() {
  const toast = useToast();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<'Admin' | 'Editor' | 'Approver' | 'Viewer'>('Editor');
  const [sending, setSending] = useState(false);

  const [members, setMembers] = useState<TeamMember[]>([
    { id: '1', name: 'Teja Ganugula (You)', email: 'tejag.vijay@gmail.com', role: 'Owner', status: 'Active' },
    { id: '2', name: 'Growth Team Lead', email: 'growth@gtinnox.com', role: 'Admin', status: 'Active' },
    { id: '3', name: 'Content Strategist', email: 'editorial@gtinnox.com', role: 'Editor', status: 'Pending' },
  ]);

  const handleSendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      toast.error('Please specify a valid email address.');
      return;
    }

    setSending(true);
    setTimeout(() => {
      const newMember: TeamMember = {
        id: Math.random().toString(36).substring(7),
        name: inviteName.trim() || inviteEmail.split('@')[0],
        email: inviteEmail.trim(),
        role: inviteRole,
        status: 'Pending',
      };
      setMembers([...members, newMember]);
      setSending(false);
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteName('');
      toast.success(`Invitation sent to ${newMember.email} as ${newMember.role}!`);
    }, 600);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'Owner':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 border-purple-200 dark:border-purple-800';
      case 'Admin':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'Editor':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'Approver':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

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

        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 shadow-sm transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          Invite Member
        </button>
      </div>

      {/* Role explanation cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827]">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
            Owner & Admin
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Full workspace governance, LinkedIn token management, member invitations, and billing.
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827]">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Editor
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Drafts posts, designs templates, generates AI copy, and uploads media assets.
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827]">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Approver
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Reviews pending drafts and authorizes immediate or scheduled BullMQ publishing.
          </p>
        </div>

        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827]">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
            Viewer
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Read-only access to calendar, analytics metrics, and published LinkedIn feed history.
          </p>
        </div>
      </div>

      {/* Members table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            Active Team Members ({members.length})
          </h2>
          <span className="text-[11px] text-slate-400">
            Enterprise Plan (Unlimited Seats)
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {members.map((member) => (
            <div key={member.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-white text-xs shadow-sm">
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    {member.name}
                    {member.status === 'Pending' && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                        Invite Pending
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    {member.email}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${getRoleBadge(member.role)}`}>
                  {member.role}
                </span>

                {member.role !== 'Owner' && (
                  <button
                    onClick={() => {
                      setMembers(members.filter((m) => m.id !== member.id));
                      toast.info(`Removed ${member.name} from workspace`);
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
              placeholder="sarah@gtinnox.com"
              required
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Assigned Role & Permissions
            </label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as any)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Admin">Admin (Full Workspace Management)</option>
              <option value="Editor">Editor (Author & Schedule Posts)</option>
              <option value="Approver">Approver (Review & Approve Posts)</option>
              <option value="Viewer">Viewer (Read-only Access)</option>
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowInviteModal(false)}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending}
              className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <Mail className="w-3.5 h-3.5" />
              {sending ? 'Sending Invite...' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
