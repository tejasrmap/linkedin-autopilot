'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { PageHeader, ActionButton } from '@/components/magicpath/common';
import { Icon } from '@/components/magicpath/icons';
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
      } else {
        setMembers([]);
      }
    } catch {
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setSending(true);
    try {
      const res = await fetch('/api/workspaces/members/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          name: inviteName.trim(),
          role: inviteRole,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send invitation');
      }

      toast.success(`Invitation sent to ${inviteEmail}`);
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

  const handleRemoveMember = async () => {
    if (!deleteMemberId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/workspaces/members/${deleteMemberId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to remove member');
      toast.success('Team member removed');
      setDeleteMemberId(null);
      await fetchMembers();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeleting(false);
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'TG';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const tones = ['blue', 'violet', 'mint', 'amber'];

  return (
    <>
      <PageHeader
        screen="team"
        action="Invite teammate"
        onAction={() => setShowInviteModal(true)}
      />

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>People in your workspace</h3>
            <p>Invite people to create and review posts with you.</p>
          </div>
          <span className="member-count">
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '30px', textAlign: 'center', color: 'var(--muted)', fontSize: '11px' }}>
            Loading team members…
          </div>
        ) : (
          <div className="member-list">
            {members.map((m, i) => {
              const tone = tones[i % tones.length];
              return (
                <div className="member-row" key={m.id || m.email}>
                  <div className={`profile-avatar tone-${tone}`}>{getInitials(m.name)}</div>
                  <div className="member-copy">
                    <b>
                      {m.name} {m.isCurrent && <small style={{ color: 'var(--brand)' }}>(You)</small>}
                    </b>
                    <small>{m.email}</small>
                  </div>
                  <span className="role-pill" style={{ textTransform: 'capitalize' }}>
                    {m.role}
                  </span>
                  {!m.isCurrent && (currentRole === 'owner' || currentRole === 'admin') && (
                    <button
                      type="button"
                      className="plain-icon"
                      onClick={() => {
                        setDeleteMemberId(m.id);
                        setDeleteMemberName(m.name);
                      }}
                      title="Remove member"
                    >
                      <Icon name="close" size={15} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="permission-note">
        <Icon name="shield" size={16} />
        <span>Only workspace owners and admins can change roles and remove members.</span>
      </div>

      {/* Invite Member Modal */}
      <Modal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Invite Teammate"
      >
        <form onSubmit={handleInvite} className="space-y-4">
          <div>
            <label className="field-label" htmlFor="inv-email">
              Email Address
            </label>
            <input
              id="inv-email"
              type="email"
              className="ai-text-input"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              required
            />
          </div>

          <div>
            <label className="field-label" htmlFor="inv-name">
              Full Name (Optional)
            </label>
            <input
              id="inv-name"
              type="text"
              className="ai-text-input"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="e.g. Jane Doe"
            />
          </div>

          <div>
            <label className="field-label">Role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as any)}
              className="ai-text-input"
            >
              <option value="admin">Admin · Full workspace access</option>
              <option value="editor">Editor · Create and edit posts</option>
              <option value="approver">Approver · Review and approve drafts</option>
              <option value="viewer">Viewer · Read-only access</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowInviteModal(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={sending || !inviteEmail.trim()}
            >
              {sending ? 'Sending…' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Remove Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!deleteMemberId}
        onClose={() => setDeleteMemberId(null)}
        onConfirm={handleRemoveMember}
        title="Remove Team Member"
        message={`Are you sure you want to remove ${deleteMemberName} from this workspace?`}
        confirmText={deleting ? 'Removing…' : 'Remove'}
        variant="danger"
      />
    </>
  );
}
