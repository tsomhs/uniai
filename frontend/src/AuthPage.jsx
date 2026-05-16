import React, { useState } from 'react';
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  Database,
  ShieldCheck,
  BarChart2,
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

function FeatureItem({ icon, title, text }) {
  return (
    <div style={{
      display: 'flex',
      gap: '0.85rem',
      padding: '0.95rem',
      borderRadius: 14,
      background: `${T.surface}cc`,
      border: `1px solid ${T.border}`,
    }}>
      <div style={{
        width: 38,
        height: 38,
        flexShrink: 0,
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `${T.purple}24`,
        color: T.purpleSoft,
      }}>
        {icon}
      </div>

      <div>
        <div style={{ color: T.textPri, fontWeight: 700, fontSize: '0.9rem' }}>
          {title}
        </div>
        <div style={{ color: T.textDim, fontSize: '0.78rem', lineHeight: 1.5, marginTop: 3 }}>
          {text}
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  const [mode, setMode] = useState('login'); // login | signup
  const [showPassword, setShowPassword] = useState(false);
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

  const handleSubmit = (e) => {
    e.preventDefault();

    // This is only front-end UI logic.
    // Connect this function later to your FastAPI / auth endpoint.
    console.log(isSignup ? 'Sign up form submitted' : 'Login form submitted', form);
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
        maxWidth: 1120,
        display: 'grid',
        gridTemplateColumns: '1.05fr 0.95fr',
        gap: '1.5rem',
        alignItems: 'stretch',
      }}>

        {/* ── LEFT: Brand / Product copy ── */}
        <section style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 24,
          border: `1px solid ${T.border}`,
          background:
            `linear-gradient(145deg, ${T.surface} 0%, ${T.surface2} 55%, ${T.bg} 100%)`,
          padding: '2rem',
          minHeight: 620,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
        }}>
          <div style={{
            position: 'absolute',
            width: 260,
            height: 260,
            borderRadius: '50%',
            background: `${T.purple}33`,
            filter: 'blur(55px)',
            top: -70,
            right: -70,
          }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.45rem 0.75rem',
              borderRadius: 999,
              border: `1px solid ${T.border2}`,
              background: `${T.bg}99`,
              color: T.purpleSoft,
              fontSize: '0.8rem',
              fontWeight: 600,
              marginBottom: '1.35rem',
            }}>
              <Sparkles size={15} />
              Speak With Your Data
            </div>

            <h1 style={{
              margin: 0,
              fontSize: '3rem',
              lineHeight: 1.05,
              letterSpacing: '-0.055em',
              maxWidth: 540,
            }}>
              Turn your data into answers.
            </h1>

            <p style={{
              color: T.textMuted,
              fontSize: '1.02rem',
              lineHeight: 1.75,
              maxWidth: 560,
              marginTop: '1.15rem',
            }}>
              Sign in to ask questions, inspect dashboards, and explore insights
              from your connected database in a clean AI-powered workspace.
            </p>
          </div>

          <div style={{
            position: 'relative',
            zIndex: 1,
            display: 'grid',
            gap: '0.75rem',
            marginTop: '2rem',
          }}>
            <FeatureItem
              icon={<Database size={19} />}
              title="Connected data workspace"
              text="Ask natural-language questions and receive structured answers with charts."
            />
            <FeatureItem
              icon={<BarChart2 size={19} />}
              title="Dashboard-ready output"
              text="Open KPI cards, bar charts, line charts and tables in the Data Inspector."
            />
            <FeatureItem
              icon={<ShieldCheck size={19} />}
              title="Secure team access"
              text="Use this page as the starting point for your login and sign-up flow."
            />
          </div>

          <div style={{
            position: 'relative',
            zIndex: 1,
            color: T.textDim,
            fontSize: '0.75rem',
            marginTop: '1.5rem',
          }}>
            by <span style={{ color: T.purpleSoft, fontWeight: 700 }}>Prompt Masters</span>
          </div>
        </section>

        {/* ── RIGHT: Auth form ── */}
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

            {/* Toggle */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
              padding: 6,
              borderRadius: 14,
              background: T.surface,
              border: `1px solid ${T.border}`,
              marginBottom: '1.8rem',
            }}>
              {['login', 'signup'].map(item => {
                const active = mode === item;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setMode(item)}
                    style={{
                      border: 'none',
                      cursor: 'pointer',
                      borderRadius: 10,
                      padding: '0.75rem 1rem',
                      background: active ? T.purple : 'transparent',
                      color: active ? 'white' : T.textMuted,
                      fontWeight: 700,
                      transition: 'all 0.2s',
                    }}
                  >
                    {item === 'login' ? 'Log in' : 'Sign up'}
                  </button>
                );
              })}
            </div>

            <div style={{ marginBottom: '1.4rem' }}>
              <h2 style={{
                margin: 0,
                fontSize: '1.75rem',
                letterSpacing: '-0.035em',
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
                  ? 'Start using your AI data assistant with a new workspace account.'
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

              <button
                type="submit"
                style={{
                  marginTop: '0.45rem',
                  height: 52,
                  border: 'none',
                  borderRadius: 14,
                  cursor: 'pointer',
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
                }}
                onMouseOver={e => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = `0 18px 42px ${T.purple}44`;
                }}
                onMouseOut={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = `0 14px 32px ${T.purple}33`;
                }}
              >
                {isSignup ? 'Create account' : 'Log in'}
                <ArrowRight size={18} />
              </button>
            </form>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              margin: '1.35rem 0',
              color: T.textDim,
              fontSize: '0.78rem',
            }}>
              <div style={{ height: 1, flex: 1, background: T.border }} />
              or continue with
              <div style={{ height: 1, flex: 1, background: T.border }} />
            </div>

            <button
              type="button"
              style={{
                width: '100%',
                height: 48,
                borderRadius: 12,
                border: `1px solid ${T.border2}`,
                background: T.surface,
                color: T.textPri,
                cursor: 'pointer',
                fontWeight: 700,
                transition: 'all 0.2s',
              }}
              onMouseOver={e => {
                e.currentTarget.style.borderColor = T.purple;
                e.currentTarget.style.color = T.purpleSoft;
              }}
              onMouseOut={e => {
                e.currentTarget.style.borderColor = T.border2;
                e.currentTarget.style.color = T.textPri;
              }}
            >
              Google
            </button>

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
          @media (max-width: 920px) {
            div[style*="grid-template-columns: 1.05fr 0.95fr"] {
              grid-template-columns: 1fr !important;
            }

            section[style*="min-height: 620px"] {
              min-height: auto !important;
            }
          }

          input::placeholder {
            color: ${T.textDim};
          }
        `}
      </style>
    </div>
  );
}
