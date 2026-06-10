/**
 * AccountCard.jsx — Rider account face for the StatusCard HUD
 */

import { useState, useMemo } from 'react';
import signUp from '@/firebase/auth/signup';
import signIn from "@/firebase/auth/signin";
import resetPassword from "@/firebase/auth/passwordReset";

// ── tokens ──────────────────────────────────────────────────────────────────
const C = {
  bg: '#050A06',
  panel: 'rgba(255,255,255,.035)',
  border: 'rgba(34,197,94,.18)',
  borderDim: 'rgba(34,197,94,.09)',
  green: '#22C55E',
  greenBright: '#4ADE80',
  greenSoft: '#34D399',
  white: '#fff',
  dim: 'rgba(255,255,255,.22)',
  fade: 'rgba(255,255,255,.10)',
  faint: 'rgba(255,255,255,.06)',
  amber: 'rgba(251,191,36,.9)',
  amberDim: 'rgba(251,191,36,.18)',
  purple: 'rgba(192,132,252,.9)',
  purpleDim: 'rgba(192,132,252,.14)',
};

const MONO = "'JetBrains Mono','SFMono-Regular',monospace";
const COND = "'Barlow Condensed','Barlow',sans-serif";

// ── helpers ────────────────────────────────────────────────────────────────
function tsToMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  return 0;
}

function fmtMoney(cents) {
  if (!cents && cents !== 0) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtDate(ts) {
  const ms = tsToMillis(ts);
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
}

function initials(name) {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ── icon ────────────────────────────────────────────────────────────────────
function Ico({ n, size = 14, color = 'currentColor', sw = 1.7 }) {
  const p = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: sw,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };

  switch (n) {
    case 'mail':
      return (
        <svg {...p}>
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <polyline points="2,4 12,13 22,4" />
        </svg>
      );
    case 'phone':
      return (
        <svg {...p}>
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12 19.79 19.79 0 0 1 1.05 3.4 2 2 0 0 1 3 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16z" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...p}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    default:
      return null;
  }
}

// ── AUTH CARD ───────────────────────────────────────────────────────────────
function AuthCard({ onSignUp, onSignIn, onClose }) {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { result, error } = await signIn(email, password);

    if (error) setError(error.message || 'Login failed');
    else onSignIn?.(result.user);

    setLoading(false);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { result, error } = await signUp(email, password, displayName);

    if (error) setError(error.message || 'Sign up failed');
    else onSignUp?.(result.user);

    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontFamily: COND, fontSize: 10, color: C.greenBright }}>
        {mode === 'signin' ? 'Sign In' : 'Create Account'}
      </div>

      {mode === 'signup' && (
        <input
          placeholder="Full name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      )}

      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      {mode === 'signup' && (
        <input
          type="password"
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      )}

      {error && <div style={{ color: 'red', fontSize: 10 }}>{error}</div>}

      <button onClick={mode === 'signin' ? handleSignIn : handleSignUp}>
        {loading ? '...' : mode === 'signin' ? 'Sign In' : 'Sign Up'}
      </button>

      <button onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
        Switch Mode
      </button>
    </div>
  );
}

// ── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function AccountCard({
  uid,
  account = null,
  rides = [],
  onEdit,
  onSignOut,
  onSignUp,
  onSignIn,
  onCloseAuth,
}) {
  const isAuthed = !!uid;

  const stats = useMemo(() => {
    const completed = rides.filter(r => r.status === 'completed');
    const spend = completed.reduce((s, r) => s + (r.fareCents || 0), 0);
    return { total: completed.length, spend };
  }, [rides]);

  const totalRides = account?.totalRides ?? stats.total;
  const totalSpend = account?.totalSpend ?? stats.spend;

  // ─────────────────────────────────────────────
  // NOT AUTHED
  // ─────────────────────────────────────────────
  if (!isAuthed) {
    return (
      <div style={{ padding: 12 }}>
        <div style={{ fontFamily: COND, fontSize: 10, color: C.greenBright }}>
          Welcome
        </div>

        <AuthCard
          onSignUp={onSignUp}
          onSignIn={onSignIn}
          onClose={onCloseAuth}
        />
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // AUTHED
  // ─────────────────────────────────────────────
  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* HEADER */}
      <div>
        <div style={{ fontFamily: COND, fontSize: 10, color: C.greenBright }}>
          Welcome Back, Rider
        </div>

        <div style={{ fontFamily: MONO, fontSize: 8, color: C.dim }}>
          Active Session
        </div>
      </div>

      {/* USER */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{
          width: 42,
          height: 42,
          borderRadius: 10,
          background: 'rgba(34,197,94,.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <span style={{ fontFamily: COND, color: C.greenBright }}>
            {initials(account?.displayName)}
          </span>
        </div>

        <div>
          <div style={{ fontFamily: COND, color: '#fff' }}>
            {account?.displayName || 'Rider'}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: C.dim }}>
            {account?.email}
          </div>
        </div>
      </div>

      {/* STATS */}
      <div style={{ display: 'flex', gap: 10 }}>
        <div>Rides: {totalRides}</div>
        <div>Spent: {fmtMoney(totalSpend)}</div>
      </div>

      {/* ACTION */}
      <button onClick={onSignOut}>
        Sign Out
      </button>
    </div>
  );
}