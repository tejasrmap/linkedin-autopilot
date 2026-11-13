'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { GTInnoXLogo } from '@/components/brand/gtinnox-logo';
import {
  Lock,
  Mail,
  Loader2,
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
  Sparkles,
  Building2,
  Zap,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw error;
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen max-h-screen w-full flex bg-[#070b14] text-slate-100 relative overflow-hidden font-sans select-none">
      {/* Background Decorative Ambient Glows */}
      <div className="absolute -top-32 -left-32 w-80 h-80 bg-blue-600/20 rounded-full blur-[110px] pointer-events-none" />
      <div className="absolute top-1/2 -right-32 w-96 h-96 bg-indigo-600/15 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute -bottom-32 left-1/3 w-72 h-72 bg-cyan-600/15 rounded-full blur-[110px] pointer-events-none" />

      {/* Subtle Dot Grid Pattern Overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative z-10 w-full grid grid-cols-1 lg:grid-cols-12 h-screen max-h-screen overflow-hidden">
        {/* Left Side: Brand Narrative & Enterprise Capabilities (Desktop Only) */}
        <div className="hidden lg:flex lg:col-span-7 flex-col justify-between p-8 xl:p-12 border-r border-slate-800/60 bg-gradient-to-b from-slate-900/40 via-transparent to-slate-950/60 backdrop-blur-sm h-full overflow-hidden">
          {/* Top Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700/60 p-1 flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/10">
              <GTInnoXLogo className="w-full h-full drop-shadow" />
            </div>
            <div>
              <div className="font-bold text-sm tracking-tight text-white flex items-center gap-2">
                LinkedIn Autopilot
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  v2.0 Enterprise
                </span>
              </div>
              <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                <span>By</span>
                <span className="font-semibold bg-gradient-to-r from-cyan-400 via-indigo-400 to-pink-400 bg-clip-text text-transparent">GT InnoX LLP</span>
              </div>
            </div>
          </div>

          {/* Hero Value Prop */}
          <div className="space-y-5 max-w-xl my-auto py-4">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/60 border border-slate-700/60 text-[11px] text-slate-300 backdrop-blur-md">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>Next-Generation Social Media Architecture</span>
              </div>
              <h2 className="text-2xl xl:text-3xl font-extrabold tracking-tight text-white leading-tight">
                Dual Destination Publishing & Autonomous LinkedIn Scheduling.
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Connect personal creator profiles and verified LinkedIn Company Pages. Schedule high-converting content with BullMQ job recovery, CAS idempotency locks, and AI-driven copy generation.
              </p>
            </div>

            {/* Feature Highlights Cards */}
            <div className="grid grid-cols-1 gap-2.5">
              <div className="p-3 rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md flex items-start gap-3 hover:border-slate-700/80 transition-colors">
                <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex-shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">Dual Destination Engine</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-normal">
                    Direct author URN routing to member profiles (<code className="text-slate-300 font-mono">urn:li:person:</code>) and company pages (<code className="text-slate-300 font-mono">urn:li:organization:</code>).
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md flex items-start gap-3 hover:border-slate-700/80 transition-colors">
                <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex-shrink-0">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">Persistent BullMQ Queue Worker</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-normal">
                    Millisecond-accurate delayed jobs, atomic Redis locking to prevent duplicate posts, and automatic recovery.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md flex items-start gap-3 hover:border-slate-700/80 transition-colors">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex-shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">AES-256-GCM Vault Security</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-normal">
                    All OAuth tokens are encrypted at rest with 256-bit authentication tags and partitioned by tenant workspaces.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Left Footer Security Badge */}
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-3 border-t border-slate-800/50">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Official LinkedIn REST API v202401</span>
            </div>
            <span>© 2026 GT InnoX LLP</span>
          </div>
        </div>

        {/* Right Side: High-End Glassmorphic Login Form */}
        <div className="col-span-1 lg:col-span-5 flex flex-col justify-center items-center p-6 lg:p-8 xl:p-12 relative h-full overflow-hidden">
          <div className="w-full max-w-sm space-y-4">
            {/* Mobile Brand Header */}
            <div className="lg:hidden text-center space-y-2 mb-2">
              <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700/60 p-1.5 flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/20">
                <GTInnoXLogo className="w-full h-full drop-shadow" />
              </div>
              <h1 className="text-lg font-bold tracking-tight text-white">
                LinkedIn Autopilot
              </h1>
              <p className="text-[11px] text-slate-400">
                GT InnoX LLP • Enterprise Social Automation
              </p>
            </div>

            {/* Glassmorphic Form Card */}
            <div className="rounded-2xl border border-slate-800/90 bg-slate-900/60 backdrop-blur-2xl p-6 sm:p-7 shadow-2xl ring-1 ring-white/5 space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-bold tracking-tight text-white">
                  Sign in to your account
                </h2>
                <p className="text-[11px] text-slate-400">
                  Enter your workspace credentials to access the console
                </p>
              </div>

              {/* Error Message */}
              {errorMsg && (
                <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-start gap-2 animate-in fade-in duration-200">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 flex-shrink-0" />
                  <span className="leading-relaxed">{errorMsg}</span>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleLogin} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      required
                      autoComplete="email"
                      className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-800 bg-slate-950/60 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-300">
                      Password
                    </label>
                    <span className="text-[10px] text-blue-400 hover:text-blue-300 cursor-pointer transition-colors">
                      Forgot password?
                    </span>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      autoComplete="current-password"
                      className="w-full pl-9 pr-9 py-2 rounded-xl border border-slate-800 bg-slate-950/60 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2 p-1 text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-slate-400">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0 focus:ring-offset-0"
                    />
                    <span>Remember this device</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs tracking-wide shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group mt-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In to Workspace</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </button>
              </form>

              {/* Register Callout */}
              <div className="text-center text-xs text-slate-400 pt-2 border-t border-slate-800/60">
                Don&apos;t have a workspace?{' '}
                <Link
                  href="/register"
                  className="text-blue-400 hover:text-blue-300 font-semibold transition-colors inline-flex items-center gap-1"
                >
                  Create one now
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* Bottom Enterprise Trust Footnote */}
            <div className="text-center text-[10px] text-slate-500">
              <div className="flex items-center justify-center gap-2">
                <span>SOC 2 Compliant Storage</span>
                <span>•</span>
                <span>End-to-End Encryption</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
