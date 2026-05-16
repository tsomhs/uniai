import React, { useState } from 'react';
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
} from 'lucide-react';

// ─── Theme ────────────────────────────────────────────────────────────────────
// Same visual logic as App.jsx: dark background, purple highlights, soft borders.

const T = {
  bg: '#09090b',
  surface: '#18181b',
  surface2: '#111113',
  border: '#27272a',
  border2: '#3f3f46',
  textPri: '#e4e4e7',
  textMuted: '#a1a1aa',
  textDim: '#71717a',
  purple: '#9333ea',
  purpleHi: '#a855f7',
  purpleSoft: '#d8b4fe',
  userBg: '#7e22ce',
  userText: '#fdf4ff',
  green: '#10b981',
  amber: '#f59e0b',
};

function AuthInput({
  icon,
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  autoComplete,
  rightElement,
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
      <span style={{
        color: T.textMuted,
        fontSize: '0.78rem',
        fontWeight: 600,
        letterSpacing: '0.03em',
      }}>
        {label}
      </span>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        backgroundColor: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        padding: '0 0.95rem',
        transition: 'all 0.2s',
      }}
      onFocusCapture={e => {
        e.currentTarget.style.borderColor = T.purple;
        e.currentTarget.style.boxShadow = `0 0 0 3px ${T.purple}22`;
      }}
      onBlurCapture={e => {
        e.currentTarget.style.borderColor = T.border;
        e.currentTarget.style.boxShadow = 'none';
      }}
      >
        <span style={{ color: T.textDim, display: 'flex', alignItems: 'center' }}>
          {icon}
        </span>

        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          style={{
            flex: 1,
            height: 48,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: T.textPri,
            fontSize: '0.95rem',
          }}
        />

        {rightElement}
      </div>
    </label>
  );
}

const API = 'http://localhost:8000';

export default function AuthPage({ onLogin }) {
  const [mode, setMode] = useState('login'); // login | signup
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    remember: true,
  });

  const isSignup = mode === 'signup';

  const update = (field) => (e) => {
    const value = field === 'remember' ? e.target.checked : e.target.value;
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isSignup && !form.name.trim()) return setError('Please enter your full name.');
    if (!form.email.trim()) return setError('Please enter your email.');
    if (!form.password) return setError('Please enter a password.');

    setLoading(true);
    try {
      if (isSignup) {
        const r = await fetch(`${API}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name: form.name.trim(), email: form.email.trim().toLowerCase(), password: form.password }),
        });
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(d.detail || `Registration failed (${r.status})`);
        }
      }
      const lr = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: form.email.trim().toLowerCase(), password: form.password }),
      });
      if (!lr.ok) {
        const ld = await lr.json().catch(() => ({}));
        throw new Error(ld.detail || `Login failed (${lr.status})`);
      }
      const ld = await lr.json();
      onLogin(ld);
    } catch (err) {
      if (err.name === 'TypeError') {
        setError('Cannot reach the server. Make sure the backend is running.');
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background:
        `radial-gradient(circle at top left, ${T.purple}2d 0, transparent 34%),
         radial-gradient(circle at bottom right, ${T.purpleHi}24 0, transparent 32%),
         ${T.bg}`,
      color: T.textPri,
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      overflow: 'hidden',
    }}>

      <div style={{
        width: '100%',
        maxWidth: 500,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>

        {/* ── Auth form ── */}
        <main style={{
          borderRadius: 24,
          border: `1px solid ${T.border}`,
          background: `${T.bg}e6`,
          padding: '1.25rem',
          boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
          backdropFilter: 'blur(18px)',
          display: 'flex',
          alignItems: 'center',
        }}>
          <div style={{
            width: '100%',
            borderRadius: 20,
            background: T.surface2,
            border: `1px solid ${T.border}`,
            padding: '2rem',
          }}>

            <div style={{ marginBottom: '1.4rem' }}>
              <h2 style={{
                margin: 0,
                fontSize: '1.75rem',
                letterSpacing: '-0.035em',
                color: '#ffffff',
              }}>
                {isSignup ? 'Create your account' : 'Welcome back'}
              </h2>
              <p style={{
                margin: '0.55rem 0 0',
                color: T.textDim,
                lineHeight: 1.6,
                fontSize: '0.92rem',
              }}>
                {isSignup
                  ? ''
                  : 'Log in to continue your conversation with your data.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}>
              {isSignup && (
                <AuthInput
                  icon={<User size={18} />}
                  label="Full name"
                  value={form.name}
                  onChange={update('name')}
                  placeholder="Marios Sitaropoulos"
                  autoComplete="name"
                />
              )}

              <AuthInput
                icon={<Mail size={18} />}
                label="Email address"
                value={form.email}
                onChange={update('email')}
                placeholder="you@example.com"
                autoComplete="email"
              />

              <AuthInput
                icon={<Lock size={18} />}
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={update('password')}
                placeholder={isSignup ? 'Create a strong password' : 'Enter your password'}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'transparent',
                      border: 'none',
                      color: T.textDim,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
              />

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                marginTop: '0.1rem',
              }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.55rem',
                  color: T.textMuted,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                }}>
                  <input
                    type="checkbox"
                    checked={form.remember}
                    onChange={update('remember')}
                    style={{ accentColor: T.purple }}
                  />
                  Remember me
                </label>

                {!isSignup && (
                  <button
                    type="button"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: T.purpleSoft,
                      cursor: 'pointer',
                      fontSize: '0.84rem',
                      fontWeight: 600,
                    }}
                  >
                    Forgot password?
                  </button>
                )}
              </div>

              {error && (
                <div style={{
                  padding: '0.65rem 0.9rem',
                  borderRadius: 10,
                  background: '#450a0a',
                  border: '1px solid #7f1d1d',
                  color: '#fca5a5',
                  fontSize: '0.84rem',
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: '0.45rem',
                  height: 52,
                  border: 'none',
                  borderRadius: 14,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  background: `linear-gradient(135deg, ${T.purple}, ${T.purpleHi})`,
                  color: 'white',
                  fontSize: '0.96rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.6rem',
                  boxShadow: `0 14px 32px ${T.purple}33`,
                  transition: 'transform 0.18s, box-shadow 0.18s',
                  opacity: loading ? 0.7 : 1,
                }}
                onMouseOver={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 18px 42px ${T.purple}44`; } }}
                onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 14px 32px ${T.purple}33`; }}
              >
                {loading ? 'Please wait…' : (isSignup ? 'Create account' : 'Log in')}
                {!loading && <ArrowRight size={18} />}
              </button>
            </form>



            <p style={{
              textAlign: 'center',
              color: T.textDim,
              fontSize: '0.84rem',
              lineHeight: 1.6,
              margin: '1.35rem 0 0',
            }}>
              {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                type="button"
                onClick={() => setMode(isSignup ? 'login' : 'signup')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: T.purpleSoft,
                  cursor: 'pointer',
                  fontWeight: 800,
                  padding: 0,
                }}
              >
                {isSignup ? 'Log in' : 'Sign up'}
              </button>
            </p>
          </div>
        </main>
      </div>

      {/* Small responsive helper without external CSS file */}
      <style>
        {`
          input::placeholder {
            color: ${T.textDim};
          }
        `}
      </style>
    </div>
  );
}
