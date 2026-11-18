'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Icon } from '@/components/magicpath/icons';
import { GTInnoXLogo } from '@/components/brand/gtinnox-logo';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) {
        router.push('/dashboard');
      }
    });
  }, [router]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setErrorMsg('Please fill in all fields.');
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
        setErrorMsg(error.message || 'Registration failed.');
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
    <div className="auth-screen">
      <div className="auth-brand">
        <div
          className="brand-mark"
          style={{
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            padding: '3px',
            borderRadius: '9px',
          }}
        >
          <GTInnoXLogo width={25} height={16} />
        </div>
        <div>
          <b>autopilot</b>
          <small>BY GT INNOX</small>
        </div>
      </div>

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
              padding: '8px 12px',
              borderRadius: '7px',
              background: '#fef2f2',
              color: '#b91c1c',
              fontSize: '11px',
              border: '1px solid #fecaca',
            }}
          >
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: '7px',
              background: '#f0fdf4',
              color: '#15803d',
              fontSize: '11px',
              border: '1px solid #bbf7d0',
            }}
          >
            {successMsg}
          </div>
        )}

        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label>
            Your name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              required
            />
          </label>

          <label>
            Work email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
            />
          </label>

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'} <Icon name="arrow" size={16} />
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
          <Icon name="linkedin" size={15} /> Continue with LinkedIn
        </button>

        <div className="auth-switch">
          Already have an account?{' '}
          <Link href="/login" style={{ fontWeight: 600 }}>
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
