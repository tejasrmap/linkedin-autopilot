'use client';

import React, { useState } from 'react';
import { Users, ShieldCheck, Mail, Plus, UserCheck } from 'lucide-react';

export default function TeamPage() {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [invited, setInvited] = useState(false);

  const teamMembers = [
    { name: 'Lead Architect (You)', email: 'admin@gtinnox.com', role: 'Owner', status: 'Active' },
    { name: 'Senior Growth Editor', email: 'growth@gtinnox.com', role: 'Admin', status: 'Active' },
    { name: 'Content Strategist', email: 'content@gtinnox.com', role: 'Editor', status: 'Invited' },
  ];

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInvited(true);
    setTimeout(() => {
      setInviteEmail('');
      setInvited(false);
    }, 2500);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-500" />
          Team Workspace & Collaboration
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Role-based workspace permissions with row-level security isolation (Owner, Admin, Editor, Approver, Viewer).
        </p>
      </div>

      {/* Invite Member Card */}
      <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] max-w-2xl space-y-3">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
          <Mail className="w-4 h-4 text-blue-500" />
          Invite Team Member
        </h2>
        <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3 text-xs">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="colleague@gtinnox.com"
            className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200"
            required
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200"
          >
            <option value="admin">Admin</option>
            <option value="editor">Editor</option>
            <option value="approver">Approver</option>
            <option value="viewer">Viewer</option>
          </select>
          <button
            type="submit"
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Send Invite
          </button>
        </form>

        {invited && (
          <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
            <UserCheck className="w-4 h-4" />
            Invitation sent to {inviteEmail}!
          </div>
        )}
      </div>

      {/* Members Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800 font-bold text-xs text-slate-800 dark:text-slate-200">
          Active Workspace Members
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          {teamMembers.map((member, idx) => (
            <div key={idx} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-800 dark:text-slate-200">{member.name}</div>
                <div className="text-slate-400">{member.email}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60 text-[11px]">
                  {member.role}
                </span>
                <span className="text-[10px] text-slate-400 uppercase font-mono">{member.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

