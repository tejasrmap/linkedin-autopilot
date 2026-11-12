'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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
} from 'lucide-react';
import { SocialAccount } from '@/types';

function AccountsContent() {
  const searchParams = useSearchParams();
  const connectedParam = searchParams.get('connected');
  const errorParam = searchParams.get('error');

  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [requestOrg, setRequestOrg] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [connectUrl, setConnectUrl] = useState('');
  const [currentOrigin, setCurrentOrigin] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentOrigin(window.location.origin);
    }
    fetchAccounts();
    fetchConnectUrl();
  }, [requestOrg]);

  const fetchConnectUrl = async () => {
    try {
      const res = await fetch(`/api/linkedin/connect?org=${requestOrg}`);
      if (res.ok) {
        const data = await res.json();
        setConnectUrl(data.url || '');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleManualCodeExchange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;

    setManualSubmitting(true);
    try {
      // If user pasted full callback URL, extract code and state
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
      alert(`Invalid URL or code: ${err.message}`);
      setManualSubmitting(false);
    }
  };

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/linkedin/accounts');
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
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
        alert(data.error || 'Failed to start LinkedIn OAuth flow');
        setConnecting(false);
      }
    } catch (e: any) {
      alert(e.message);
      setConnecting(false);
    }
  };

  const handleDisconnect = async (accountId: string) => {
    if (!confirm('Are you sure you want to disconnect this LinkedIn account?')) return;
    try {
      const res = await fetch('/api/linkedin/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });
      if (res.ok) {
        await fetchAccounts();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Linkedin className="w-5 h-5 text-blue-600" />
            LinkedIn Accounts
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage authorized LinkedIn personal profiles and company pages.
          </p>
        </div>

        {/* Connect Action */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={requestOrg}
              onChange={(e) => setRequestOrg(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-0"
            />
            Include Company Pages
          </label>

          <button
            onClick={handleConnect}
            disabled={connecting}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-600/30 transition-all disabled:opacity-50"
          >
            {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Connect LinkedIn
          </button>
        </div>
      </div>

      {/* Step-by-Step Authorization Instructions Card */}
      <div className="p-5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 space-y-4 text-xs">
        <div className="flex items-center justify-between">
          <div className="font-bold text-sm text-blue-950 dark:text-blue-100 flex items-center gap-2">
            <Linkedin className="w-4 h-4 text-blue-600" />
            Live LinkedIn Member Authorization Instructions (Phase 3.1)
          </div>
          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            Client ID: 86pecf126iu1v4
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-slate-700 dark:text-slate-300">
          <div className="p-3 rounded-lg border border-slate-200/60 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 space-y-1">
            <div className="font-bold text-blue-600 dark:text-blue-400">Step 1: Check Redirect URI</div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              In the LinkedIn Developer Portal under <strong className="text-slate-700 dark:text-slate-300">Auth &gt; Authorized redirect URLs</strong>, confirm that <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-blue-600 dark:text-blue-400 font-mono text-[10px] break-all">{currentOrigin ? `${currentOrigin}/api/linkedin/callback` : 'https://autopilot.apecpowersolutions.com/api/linkedin/callback'}</code> is added.
            </p>
          </div>

          <div className="p-3 rounded-lg border border-slate-200/60 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 space-y-1">
            <div className="font-bold text-blue-600 dark:text-blue-400">Step 2: Scopes &amp; Permissions</div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              The authorization requests <strong className="text-slate-700 dark:text-slate-300">openid, profile, email, w_member_social</strong> to publish posts and display your profile name and picture.
            </p>
          </div>

          <div className="p-3 rounded-lg border border-slate-200/60 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 space-y-1">
            <div className="font-bold text-blue-600 dark:text-blue-400">Step 3: Click Connect</div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Click <strong className="text-slate-700 dark:text-slate-300">Authorize LinkedIn Account</strong> below to open the official LinkedIn permission prompt.
            </p>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-blue-200/60 dark:border-blue-900/40">
          <div className="flex items-center gap-2">
            <button
              onClick={handleConnect}
              disabled={connecting || !connectUrl}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-all disabled:opacity-50"
            >
              {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
              Authorize LinkedIn Account
            </button>

            {connectUrl && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(connectUrl);
                  alert('Authorization URL copied to clipboard!');
                }}
                className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                title="Copy Authorization URL"
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
              className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-200 text-xs"
            />
            <button
              type="submit"
              disabled={manualSubmitting || !manualCode.trim()}
              className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50 flex-shrink-0"
            >
              {manualSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Submit'}
            </button>
          </form>
        </div>
      </div>

      {/* Connection notification */}
      {connectedParam && (
        <div className="p-3.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          LinkedIn account successfully authenticated and ready for automated publishing!
        </div>
      )}

      {errorParam && (
        <div className="p-3.5 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          LinkedIn Connection Note: {decodeURIComponent(errorParam)}
        </div>
      )}

      {/* Account Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-full py-12 flex justify-center text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="col-span-full p-12 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400 space-y-3">
            <Linkedin className="w-8 h-8 text-blue-500 mx-auto opacity-60" />
            <p>No LinkedIn accounts connected yet.</p>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              Connect your LinkedIn profile or company page using official OAuth 2.0 to begin publishing.
            </p>
          </div>
        ) : (
          accounts.map((acc) => (
            <div
              key={acc.id}
              className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-sm space-y-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-base flex-shrink-0">
                    {acc.profile_image_url ? (
                      <img
                        src={acc.profile_image_url}
                        alt=""
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      acc.account_name[0]
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      {acc.account_name}
                    </h3>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                      {acc.account_type === 'organization' ? (
                        <>
                          <Building className="w-3 h-3 text-indigo-500" /> Company Page
                        </>
                      ) : (
                        <>
                          <User className="w-3 h-3 text-blue-500" /> Member Profile
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    acc.connection_status === 'active'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                  }`}
                >
                  {acc.connection_status}
                </span>
              </div>

              {/* Scopes & Details */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span>Granted Permissions:</span>
                  <span className="font-mono text-[10px] text-slate-700 dark:text-slate-300">
                    {(acc.scopes || []).slice(0, 3).join(', ')}
                    {acc.scopes && acc.scopes.length > 3 ? ` +${acc.scopes.length - 3}` : ''}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-500">
                  <span>Connected On:</span>
                  <span>{new Date(acc.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Disconnect Action */}
              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => handleDisconnect(acc.id)}
                  className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 font-semibold transition-colors"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  Disconnect
                </button>
              </div>
            </div>
          ))
        )}
      </div>
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
