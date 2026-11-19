'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Icon } from '@/components/magicpath/icons';
import { GTInnoXLogo } from '@/components/brand/gtinnox-logo';
import { useTheme } from '@/components/theme-provider';

export default function RegisterPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setErrorMsg('Please fill in all fields.');
      return;
    }

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: name.trim(),
          },
        },
      });

      if (error) {
        setErrorMsg(error.message || 'Failed to create account.');
        return;
      }

      if (data.session) {
        router.push('/dashboard');
      } else {
        setSuccessMsg('Account created! Please check your email to confirm your account.');
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
        <h1>Create your workspace</h1>
        <p>A calmer, more consistent way to show up on LinkedIn.</p>

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

        {successMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: '#f0fdf4',
              color: '#15803d',
              fontSize: '12px',
              border: '1px solid #bbf7d0',
              marginBottom: '16px',
            }}
          >
            {successMsg}
          </div>
        )}

        <form onSubmit={handleRegister}>
          <div className="auth-field">
            <label htmlFor="reg-name">Your name</label>
            <input
              id="reg-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              required
              autoComplete="name"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="reg-email">Work email</label>
            <input
              id="reg-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="reg-password">Password</label>
            <input
              id="reg-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              autoComplete="new-password"
            />
          </div>

          <button type="submit" className="auth-submit" disabled={loading}>
            <span>{loading ? 'Creating workspace…' : 'Create account'}</span>
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
          Already have an account?{' '}
          <Link href="/login">
            Sign in
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
