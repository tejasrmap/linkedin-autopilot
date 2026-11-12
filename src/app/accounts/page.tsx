'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui/toast';
import { Modal } from '@/components/ui/modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Linkedin,
  CheckCircle2,
  AlertCircle,
  Plus,
  Building,
  User,
  Shield,
  Unlink,
  Loader2,
  ExternalLink,
  Copy,
  Check,
  KeyRound,
  ShieldCheck,
  ChevronDown,
} from 'lucide-react';
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
  const [loading, setLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      return !sessionStorage.getItem('autopilot_accounts');
    }
    return true;
  });
  const [connecting, setConnecting] = useState(false);
  const [requestOrg, setRequestOrg] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [connectUrl, setConnectUrl] = useState('');
  const [currentOrigin, setCurrentOrigin] = useState('');

  // Modals & Dialogs
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [orgIdInput, setOrgIdInput] = useState('');
  const [orgNameInput, setOrgNameInput] = useState('');
  const [orgVanityInput, setOrgVanityInput] = useState('');
  const [linkingOrg, setLinkingOrg] = useState(false);

  const [disconnectAccountId, setDisconnectAccountId] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const [copiedUrnId, setCopiedUrnId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentOrigin(window.location.origin);
    }
    fetchAccounts();
    fetchConnectUrl();
  }, [requestOrg]);

  const fetchAccounts = async () => {
    try {
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
  };

  const fetchConnectUrl = async () => {
    try {
      const res = await fetch(`/api/linkedin/connect?org=${requestOrg}`);
      if (res.ok) {
        const data = await res.json();
        setConnectUrl(data.url || '');
      }
    } catch {
      // Non-blocking
    }
  };

  const handleConnect = async () => {
    try {
      setConnecting(true);
      const url = `/api/linkedin/connect?org=${requestOrg}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error || 'Failed to start LinkedIn OAuth flow');
        setConnecting(false);
      }
    } catch (e: any) {
      toast.error(e.message);
      setConnecting(false);
    }
  };

  const handleLinkCompanyPage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgIdInput.trim() || !orgNameInput.trim()) return;

    setLinkingOrg(true);
    try {
      const res = await fetch('/api/linkedin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgIdInput.trim(),
          organizationName: orgNameInput.trim(),
          vanityName: orgVanityInput.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to link company page');
      }

      toast.success(`Company Page "${orgNameInput}" linked! (URN: ${data.authorUrn})`);
      setOrgIdInput('');
      setOrgNameInput('');
      setOrgVanityInput('');
      setShowOrgModal(false);
      await fetchAccounts();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLinkingOrg(false);
    }
  };

  const handleConfirmDisconnect = async () => {
    if (!disconnectAccountId) return;
    setDisconnecting(true);
    try {
      const res = await fetch('/api/linkedin/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: disconnectAccountId }),
      });
      if (res.ok) {
        toast.success('LinkedIn account disconnected successfully');
        await fetchAccounts();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to disconnect account');
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDisconnecting(false);
      setDisconnectAccountId(null);
    }
  };

  const handleCopyLink = () => {
    if (!connectUrl) return;
    navigator.clipboard.writeText(connectUrl);
    toast.success('Authorization link copied to clipboard!');
  };

  const handleCopyUrn = (urn: string, id: string) => {
    navigator.clipboard.writeText(urn);
    setCopiedUrnId(id);
    toast.info(`Copied ${urn} to clipboard`);
    setTimeout(() => setCopiedUrnId(null), 2000);
  };

  const handleManualCodeExchange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;

    setManualSubmitting(true);
    try {
      let code = manualCode.trim();
      let state = '';

      if (code.includes('code=')) {
        const urlObj = new URL(code.startsWith('http') ? code : `http://localhost:3000${code}`);
        code = urlObj.searchParams.get('code') || code;
        state = urlObj.searchParams.get('state') || '';
      }

      const callbackUrl = `/api/linkedin/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
      window.location.href = callbackUrl;
    } catch (err: any) {
      toast.error(`Invalid URL or code: ${err.message}`);
      setManualSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Linkedin className="w-5 h-5 text-blue-600" />
            LinkedIn Destinations
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage authorized LinkedIn personal profiles and organization company pages for your workspace.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowOrgModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-indigo-200 dark:border-indigo-800/80 text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/30 hover:bg-indigo-100/70 dark:hover:bg-indigo-900/40 transition-all shadow-sm"
          >
            <Building className="w-3.5 h-3.5 text-indigo-500" />
            <span>Link Company Page</span>
          </button>

          <button
            onClick={handleConnect}
            disabled={connecting}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-sm shadow-blue-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            <span>Connect Personal Profile</span>
          </button>
        </div>
      </div>

      {/* Connection notification banners if returning from OAuth */}
      {connectedParam && (
        <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-3 backdrop-blur-sm">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-500" />
          <div>
            <div className="font-bold">LinkedIn Authentication Complete 🎉</div>
            <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
              Your LinkedIn account was verified and securely encrypted. You can now schedule and publish posts.
            </div>
          </div>
        </div>
      )}

      {errorParam && (
        <div className="p-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-3 backdrop-blur-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500" />
          <div>
            <div className="font-bold">OAuth Connection Notice</div>
            <div className="text-[11px] text-rose-700 dark:text-rose-400 mt-0.5">
              {decodeURIComponent(errorParam)}
            </div>
          </div>
        </div>
      )}

      {/* Dual Destination Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="p-4 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/20 backdrop-blur-sm space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
              <span>Personal Profile Publishing</span>
            </div>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Verified &amp; Active
            </span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
            Personal feed publishing uses official scope <code className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">w_member_social</code> and author URN <code className="font-mono text-slate-700 dark:text-slate-300">urn:li:person:&lt;id&gt;</code>. Verified live with HTTP 201 Created.
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/20 backdrop-blur-sm space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Building className="w-4 h-4" />
              </div>
              <span>Company Page Publishing</span>
            </div>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              Awaiting Community Mgmt API
            </span>
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
            Requires LinkedIn <strong>Community Management API</strong> product on Developer App (Client ID: 86pecf126iu1v4). Dual-destination architecture and author URNs (<code className="font-mono text-slate-700 dark:text-slate-300">urn:li:organization:&lt;id&gt;</code>) are fully implemented.
          </p>
        </div>
      </div>

      {/* Connected Account Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Active Workspace Destinations ({accounts.length})
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {loading ? (
            <div className="col-span-full py-16 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <span>Loading connected destinations...</span>
            </div>
          ) : accounts.length === 0 ? (
            <div className="col-span-full p-12 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-[#0f172a]/50 text-xs text-slate-400 space-y-3">
              <Linkedin className="w-8 h-8 text-blue-500 mx-auto opacity-50" />
              <div className="font-semibold text-slate-700 dark:text-slate-300">No destinations connected yet</div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Authorize your LinkedIn personal profile or link your company page using official OAuth 2.0 to begin publishing.
              </p>
            </div>
          ) : (
            accounts.map((acc) => {
              const isOrg = acc.account_type === 'organization';
              const authorUrn = isOrg
                ? `urn:li:organization:${acc.provider_account_id}`
                : `urn:li:person:${acc.provider_account_id}`;
              const isCopied = copiedUrnId === acc.id;

              return (
                <div
                  key={acc.id}
                  className="p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#0f172a]/95 backdrop-blur-xl shadow-sm space-y-4 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-12 h-12 flex items-center justify-center text-white font-bold text-base flex-shrink-0 shadow-sm ${
                          isOrg
                            ? 'rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600'
                            : 'rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600'
                        }`}
                      >
                        {acc.profile_image_url ? (
                          <img
                            src={acc.profile_image_url}
                            alt=""
                            className={`w-12 h-12 object-cover ${isOrg ? 'rounded-xl' : 'rounded-full'}`}
                          />
                        ) : isOrg ? (
                          <Building className="w-6 h-6 text-white" />
                        ) : (
                          acc.account_name[0]
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                            {acc.account_name}
                          </h3>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                          {isOrg ? (
                            <>
                              <Building className="w-3 h-3 text-indigo-500" />
                              <span className="font-medium text-indigo-600 dark:text-indigo-400">Company Page Destination</span>
                            </>
                          ) : (
                            <>
                              <User className="w-3 h-3 text-blue-500" />
                              <span className="font-medium text-blue-600 dark:text-blue-400">Personal Member Profile</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex-shrink-0 ${
                        acc.connection_status === 'active'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {acc.connection_status}
                    </span>
                  </div>

                  {/* URN Chip */}
                  <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                      <KeyRound className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{authorUrn}</span>
                    </div>
                    <button
                      onClick={() => handleCopyUrn(authorUrn, acc.id)}
                      className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors flex-shrink-0 ml-2"
                      title="Copy Author URN"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Permissions & Disconnect */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Encrypted AES-256</span>
                    </div>

                    <button
                      onClick={() => setDisconnectAccountId(acc.id)}
                      className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 font-semibold transition-colors"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                      <span>Disconnect</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Step-by-Step Authorization Instructions Card */}
      <div className="p-5 rounded-2xl border border-blue-200/80 dark:border-blue-900/50 bg-blue-50/30 dark:bg-blue-950/20 backdrop-blur-sm space-y-4 text-xs">
        <div className="flex items-center justify-between">
          <div className="font-bold text-sm text-blue-950 dark:text-blue-100 flex items-center gap-2">
            <Linkedin className="w-4 h-4 text-blue-600" />
            Live LinkedIn Member Authorization Instructions (Phase 3.1)
          </div>
          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            Client ID: 86pecf126iu1v4
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-slate-700 dark:text-slate-300">
          <div className="p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 space-y-1">
            <div className="font-bold text-blue-600 dark:text-blue-400">Step 1: Check Redirect URI</div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              In LinkedIn Developer Portal under <strong className="text-slate-700 dark:text-slate-300">Auth &gt; Authorized redirect URLs</strong>, confirm that <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-blue-600 dark:text-blue-400 font-mono text-[10px] break-all">{currentOrigin ? `${currentOrigin}/api/linkedin/callback` : 'https://autopilot.apecpowersolutions.com/api/linkedin/callback'}</code> is added.
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 space-y-1">
            <div className="font-bold text-blue-600 dark:text-blue-400">Step 2: Scopes &amp; Permissions</div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Requests <strong className="text-slate-700 dark:text-slate-300">openid, profile, email, w_member_social</strong> to publish posts and display member profile name and avatar.
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 space-y-1">
            <div className="font-bold text-blue-600 dark:text-blue-400">Step 3: Click Connect</div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Click <strong className="text-slate-700 dark:text-slate-300">Authorize LinkedIn Account</strong> below to open the official LinkedIn permission consent dialog.
            </p>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-blue-200/60 dark:border-blue-900/40">
          <div className="flex items-center gap-2">
            <button
              onClick={handleConnect}
              disabled={connecting || !connectUrl}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-500/25 transition-all disabled:opacity-50 text-xs"
            >
              {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
              <span>Authorize LinkedIn Account</span>
            </button>

            {connectUrl && (
              <button
                onClick={handleCopyLink}
                className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 transition-colors text-xs"
              >
                Copy Auth Link
              </button>
            )}
          </div>

          {/* Manual Callback URL input if opened in separate browser */}
          <form onSubmit={handleManualCodeExchange} className="flex items-center gap-2 flex-1 sm:max-w-md">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Paste redirect URL or authorization code here..."
              className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={manualSubmitting || !manualCode.trim()}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50 flex-shrink-0 text-xs shadow-sm transition-all"
            >
              {manualSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Submit'}
            </button>
          </form>
        </div>
      </div>

      {/* Link Company Page Modal */}
      <Modal
        isOpen={showOrgModal}
        onClose={() => setShowOrgModal(false)}
        title="Link LinkedIn Company Page"
        description="Add your LinkedIn Company Page with its Organization ID to enable company feed publishing."
        icon={<Building className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowOrgModal(false)}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleLinkCompanyPage}
              disabled={linkingOrg || !orgIdInput.trim() || !orgNameInput.trim()}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm shadow-indigo-500/25 transition-all disabled:opacity-50"
            >
              {linkingOrg && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save &amp; Link Page
            </button>
          </>
        }
      >
        <form onSubmit={handleLinkCompanyPage} className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Organization Numeric ID *
            </label>
            <input
              type="text"
              value={orgIdInput}
              onChange={(e) => setOrgIdInput(e.target.value)}
              placeholder="e.g. 10594382 (found in your LinkedIn page admin URL)"
              required
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Company Page Name *
            </label>
            <input
              type="text"
              value={orgNameInput}
              onChange={(e) => setOrgNameInput(e.target.value)}
              placeholder="e.g. GT InnoX LLP, APEC Power..."
              required
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Vanity Name (optional)
            </label>
            <input
              type="text"
              value={orgVanityInput}
              onChange={(e) => setOrgVanityInput(e.target.value)}
              placeholder="e.g. gt-innox"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3.5 py-2.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 text-xs"
            />
          </div>
        </form>
      </Modal>

      {/* Disconnect Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!disconnectAccountId}
        onClose={() => setDisconnectAccountId(null)}
        onConfirm={handleConfirmDisconnect}
        title="Disconnect LinkedIn Destination"
        message="Are you sure you want to disconnect this LinkedIn destination? Any scheduled posts assigned to this account will fail until an active account is linked."
        confirmText="Disconnect Account"
        variant="danger"
        loading={disconnecting}
      />
    </div>
  );
}

export default function AccountsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Loading accounts...</div>}>
      <AccountsContent />
    </Suspense>
  );
}
