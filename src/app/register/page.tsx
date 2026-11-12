'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  User,
  Lock,
  Mail,
  Loader2,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Sparkles,
  Building2,
  ShieldCheck,
  Zap,
} from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [registered, setRegistered] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      if (error) {
        throw error;
      }

      setRegistered(true);
      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed.');
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

      {/* Grid Pattern Overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative z-10 w-full grid grid-cols-1 lg:grid-cols-12 h-screen max-h-screen overflow-hidden">
        {/* Left Side: Brand Narrative */}
        <div className="hidden lg:flex lg:col-span-7 flex-col justify-between p-8 xl:p-12 border-r border-slate-800/60 bg-gradient-to-b from-slate-900/40 via-transparent to-slate-950/60 backdrop-blur-sm h-full overflow-hidden">
          {/* Top Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-base shadow-lg shadow-blue-500/30 ring-1 ring-white/20">
              LP
            </div>
            <div>
              <div className="font-bold text-sm tracking-tight text-white flex items-center gap-2">
                LinkedIn Autopilot
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  v2.0 Enterprise
                </span>
              </div>
              <div className="text-[11px] text-slate-400">By GT InnoX LLP</div>
            </div>
          </div>

          {/* Hero Value Prop */}
          <div className="space-y-5 max-w-xl my-auto py-4">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/60 border border-slate-700/60 text-[11px] text-slate-300 backdrop-blur-md">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>Zero-Latency Multi-Tenant Workspace</span>
              </div>
              <h2 className="text-2xl xl:text-3xl font-extrabold tracking-tight text-white leading-tight">
                Scale Your LinkedIn Reach on Autopilot.
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Set up your team workspace in seconds. Publish natively to creator profiles and company pages with AI-assisted copywriting and precision scheduling.
              </p>
            </div>

            {/* Feature Highlights */}
            <div className="grid grid-cols-1 gap-2.5">
              <div className="p-3 rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex-shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">Automated Organization Setup</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-normal">
                    Preconfigured row-level security and auto-provisioned workspace membership on signup.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex-shrink-0">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">Full AI Content Studio</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-normal">
                    Viral hook generation, tone rewriting, and 7-day content calendars powered by Google Gemini.
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex-shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">AES-256-GCM Vault Security</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-normal">
                    Encrypted OAuth credentials with strict row-level security policy isolation.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-3 border-t border-slate-800/50">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Official LinkedIn REST API v202401</span>
            </div>
            <span>© 2026 GT InnoX LLP</span>
          </div>
        </div>

        {/* Right Side: Registration Form */}
        <div className="col-span-1 lg:col-span-5 flex flex-col justify-center items-center p-6 lg:p-8 xl:p-12 relative h-full overflow-hidden">
          <div className="w-full max-w-sm space-y-4">
            {/* Mobile Header */}
            <div className="lg:hidden text-center space-y-1 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-lg mx-auto shadow-lg shadow-blue-500/30">
                LP
              </div>
              <h1 className="text-lg font-bold tracking-tight text-white">
                LinkedIn Autopilot
              </h1>
              <p className="text-[11px] text-slate-400">
                GT InnoX LLP • Enterprise Social Automation
              </p>
            </div>

            {/* Form Card */}
            <div className="rounded-2xl border border-slate-800/90 bg-slate-900/60 backdrop-blur-2xl p-6 sm:p-7 shadow-2xl ring-1 ring-white/5 space-y-4">
              <div className="space-y-1">
                <h2 className="text-lg font-bold tracking-tight text-white">
                  Create your workspace
                </h2>
                <p className="text-[11px] text-slate-400">
                  Start publishing to personal profiles and company pages
                </p>
              </div>

              {registered && (
                <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in duration-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Workspace created! Redirecting to dashboard...</span>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs flex items-start gap-2 animate-in fade-in duration-200">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 flex-shrink-0" />
                  <span className="leading-relaxed">{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Teja Ganugula"
                      required
                      autoComplete="name"
                      className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-800 bg-slate-950/60 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Work Email Address
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
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      autoComplete="new-password"
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
                  <p className="text-[10px] text-slate-500 mt-1">Minimum 8 characters with letters & numbers</p>
                </div>

                <button
                  type="submit"
                  disabled={loading || registered}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs tracking-wide shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group mt-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Creating Workspace...</span>
                    </>
                  ) : (
                    <>
                      <span>Create Free Workspace</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </button>
              </form>

              <div className="text-center text-xs text-slate-400 pt-2 border-t border-slate-800/60">
                Already have an account?{' '}
                <Link
                  href="/login"
                  className="text-blue-400 hover:text-blue-300 font-semibold transition-colors inline-flex items-center gap-1"
                >
                  Sign in here
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            <div className="text-center text-[10px] text-slate-500">
              <span>By continuing, you agree to GT InnoX terms</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
