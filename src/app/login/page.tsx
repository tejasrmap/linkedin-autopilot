'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Icon } from '@/components/magicpath/icons';
import { GTInnoXLogo } from '@/components/brand/gtinnox-logo';
import { useTheme } from '@/components/theme-provider';

export default function LoginPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) {
        router.push('/dashboard');
      }
    });
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter your email and password.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMsg(error.message || 'Invalid login credentials.');
        return;
      }

      if (data.session) {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`auth-screen ${theme === 'dark' ? 'is-dark' : ''}`}>
      <Link href="/" className="auth-brand">
        <div className="brand-mark">
          <GTInnoXLogo width={25} height={16} />
        </div>
        <div className="brand-text">
          <b>autopilot</b>
          <small>BY GT INNOX</small>
        </div>
      </Link>

      <section className="auth-card">
        <div className="auth-card-mark">
          <Icon name="sparkles" size={18} />
        </div>
        <span className="eyebrow">YOUR LINKEDIN WORKSPACE</span>
        <h1>Welcome back</h1>
        <p>Sign in to continue building your professional presence.</p>

        {errorMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: '#fef2f2',
              color: '#b91c1c',
              fontSize: '12px',
              border: '1px solid #fecaca',
              marginBottom: '16px',
            }}
          >
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="auth-field">
            <label htmlFor="login-email">Work email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="auth-submit" disabled={loading}>
            <span>{loading ? 'Signing in…' : 'Sign in'}</span>
            <Icon name="arrow" size={15} />
          </button>
        </form>

        <div className="auth-separator">
          <span />
          or
          <span />
        </div>

        <button
          type="button"
          className="auth-secondary"
          onClick={() => {
            window.location.href = '/api/linkedin/auth';
          }}
        >
          <Icon name="linkedin" size={16} />
          <span>Continue with LinkedIn</span>
        </button>

        <div className="auth-switch">
          New to Autopilot?{' '}
          <Link href="/register">
            Create an account
          </Link>
        </div>
      </section>

      <div className="auth-footer">
        <span>© 2026 GT InnoX</span>
        <div>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </div>
        <Link href="/dashboard" className="auth-back">
          Back to workspace
        </Link>
      </div>
    </div>
  );
}
