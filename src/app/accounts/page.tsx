'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Modal } from '@/components/ui/modal';
import { PageHeader, ActionButton } from '@/components/magicpath/common';
import { Icon } from '@/components/magicpath/icons';
import { SocialAccount } from '@/types';

function AccountsContent() {
  const searchParams = useSearchParams();
  const connectedParam = searchParams.get('connected');
  const errorParam = searchParams.get('error');
  const toast = useToast();

  const [accounts, setAccounts] = useState<SocialAccount[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem('autopilot_accounts');
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return [];
  });
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnectAccountId, setDisconnectAccountId] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [orgIdInput, setOrgIdInput] = useState('');
  const [orgNameInput, setOrgNameInput] = useState('');
  const [linkingOrg, setLinkingOrg] = useState(false);

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/linkedin/accounts');
      if (res.ok) {
        const data = await res.json();
        const accs = data.accounts || [];
        setAccounts(accs);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('autopilot_accounts', JSON.stringify(accs));
        }
      }
    } catch (e: any) {
      toast.error('Failed to load accounts: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAccounts();
    if (connectedParam === 'true') {
      toast.success('LinkedIn account connected successfully!');
    } else if (errorParam) {
      toast.error(`LinkedIn connection error: ${errorParam}`);
    }
  }, [connectedParam, errorParam, fetchAccounts, toast]);

  const handleConnect = async (isOrg = false) => {
    setConnecting(true);
    try {
      const res = await fetch(`/api/linkedin/auth?organization=${isOrg}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to initialize LinkedIn OAuth');
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (e: any) {
      toast.error(e.message);
      setConnecting(false);
    }
  };

  const handleLinkOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgIdInput.trim() || !orgNameInput.trim()) return;
    setLinkingOrg(true);
    try {
      const res = await fetch('/api/linkedin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationUrn: orgIdInput.trim(),
          organizationName: orgNameInput.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to link LinkedIn organization');
      }
      toast.success(`Organization ${orgNameInput} linked!`);
      setShowOrgModal(false);
      setOrgIdInput('');
      setOrgNameInput('');
      await fetchAccounts();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLinkingOrg(false);
    }
  };

  const handleDisconnect = async () => {
    if (!disconnectAccountId) return;
    setDisconnecting(true);
    try {
      const res = await fetch(`/api/linkedin/accounts/${disconnectAccountId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to disconnect account');
      toast.success('Account disconnected');
      setDisconnectAccountId(null);
      await fetchAccounts();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDisconnecting(false);
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'TG';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <>
      <PageHeader
        screen="accounts"
        action={connecting ? 'Connecting…' : 'Connect account'}
        onAction={() => handleConnect(false)}
      />

      {loading && accounts.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontSize: '12px' }}>
          Loading accounts…
        </div>
      ) : accounts.length > 0 ? (
        <div className="space-y-4">
          {accounts.map((acc) => {
            const isOrg = acc.account_type === 'organization';
            return (
              <section className="panel account-card" key={acc.id}>
                <div className="account-top">
                  <div className="profile-avatar large" style={{ overflow: 'hidden' }}>
                    {acc.profile_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={acc.profile_image_url}
                        alt={acc.account_name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      getInitials(acc.account_name)
                    )}
                  </div>
                  <div className="account-name">
                    <span className="connected-badge">
                      <i /> CONNECTED
                    </span>
                    <h3>{acc.account_name}</h3>
                    <p>
                      {isOrg ? 'Company Page' : 'Personal profile'} · {acc.provider_account_id}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="plain-icon"
                    onClick={() => setDisconnectAccountId(acc.id)}
                    title="Disconnect account"
                  >
                    <Icon name="close" size={17} />
                  </button>
                </div>

                <div className="account-stats">
                  <div>
                    <b>OAuth 2.0</b>
                    <small>Authentication</small>
                  </div>
                  <div>
                    <b>{new Date(acc.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</b>
                    <small>Connected date</small>
                  </div>
                  <div>
                    <b>{isOrg ? 'Organization' : 'Profile'}</b>
                    <small>Account scope</small>
                  </div>
                </div>

                <div className="account-footer">
                  <span>
                    <Icon name="shield" size={15} /> Secure OAuth connection
                  </span>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setDisconnectAccountId(acc.id)}
                  >
                    Disconnect <Icon name="arrow" size={14} />
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <section className="panel account-card">
          <div className="account-top">
            <div className="profile-avatar large">TG</div>
            <div className="account-name">
              <span className="status-pill status-draft">
                <i /> NOT CONNECTED
              </span>
              <h3>No LinkedIn accounts connected yet</h3>
              <p>Connect your personal profile to start publishing.</p>
            </div>
          </div>
          <div className="account-footer" style={{ borderTop: 0, marginTop: '16px' }}>
            <span>
              <Icon name="shield" size={15} /> Secure LinkedIn OAuth 2.0
            </span>
            <ActionButton onClick={() => handleConnect(false)}>
              Connect personal profile <Icon name="arrow" size={15} />
            </ActionButton>
          </div>
        </section>
      )}

      {/* Connect Company Page Banner */}
      <div className="connect-banner">
        <div className="connect-icon">
          <Icon name="linkedin" size={20} />
        </div>
        <div>
          <b>Publish to a company page too</b>
          <p>Connect another destination to manage personal and company content side by side.</p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setShowOrgModal(true)}
        >
          Connect page <Icon name="arrow" size={14} />
        </button>
      </div>

      {/* Organization Modal */}
      <Modal
        isOpen={showOrgModal}
        onClose={() => setShowOrgModal(false)}
        title="Connect LinkedIn Company Page"
      >
        <form onSubmit={handleLinkOrg} className="space-y-4">
          <div>
            <label className="field-label" htmlFor="org-name">
              Company Page Name
            </label>
            <input
              id="org-name"
              type="text"
              className="ai-text-input"
              value={orgNameInput}
              onChange={(e) => setOrgNameInput(e.target.value)}
              placeholder="e.g. Acme Corporation"
              required
            />
          </div>

          <div>
            <label className="field-label" htmlFor="org-urn">
              Organization URN / ID
            </label>
            <input
              id="org-urn"
              type="text"
              className="ai-text-input"
              value={orgIdInput}
              onChange={(e) => setOrgIdInput(e.target.value)}
              placeholder="urn:li:organization:12345678 or 12345678"
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowOrgModal(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={linkingOrg || !orgNameInput.trim() || !orgIdInput.trim()}
            >
              {linkingOrg ? 'Connecting…' : 'Connect Page'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Disconnect Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!disconnectAccountId}
        onClose={() => setDisconnectAccountId(null)}
        onConfirm={handleDisconnect}
        title="Disconnect LinkedIn Account"
        message="Are you sure you want to disconnect this LinkedIn account? Scheduled posts pending for this account will need to be reassigned."
        confirmText={disconnecting ? 'Disconnecting…' : 'Disconnect'}
        variant="danger"
      />
    </>
  );
}

export default function AccountsPage() {
  return (
    <Suspense fallback={<div className="panel" style={{ padding: '30px' }}>Loading accounts…</div>}>
      <AccountsContent />
    </Suspense>
  );
}
