import { useState } from 'react';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { firebase_app } from '@/firebase/config';

const auth = getAuth(firebase_app);

const COND = "'Barlow Condensed','Arial Narrow',sans-serif";
const MONO = "'JetBrains Mono','SFMono-Regular',monospace";
const SANS = "'Barlow',system-ui,sans-serif";

export default function DriverLoginModal({ systemError } = {}) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(systemError ?? '');
  const [showPw,   setShowPw]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // onAuthStateChanged in AuthContext will set uid → app re-renders automatically
    } catch (err) {
      const map = {
        'auth/user-not-found':       'No account found with that email.',
        'auth/wrong-password':       'Incorrect password. Please try again.',
        'auth/invalid-email':        'Enter a valid email address.',
        'auth/invalid-credential':   'Incorrect email or password.',
        'auth/too-many-requests':    'Too many attempts. Wait a moment and try again.',
        'auth/user-disabled':        'This account has been disabled.',
        'auth/network-request-failed': 'Check your connection and try again.',
      };
      setError(map[err.code] || 'Sign-in failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#030604',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '24px 20px',
      fontFamily: SANS,
    }}>
      <style>{`
        @keyframes dlFadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes dlSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes dlPulse {
          0%,100% { opacity: 1; } 50% { opacity: .55; }
        }
        .dl-input {
          width: 100%;
          box-sizing: border-box;
          padding: 14px 16px;
          borderRadius: 12px;
          background: rgba(255,255,255,.04);
          border: 1.5px solid rgba(255,255,255,.1);
          color: #fff;
          font-size: 15px;
          font-family: ${SANS};
          outline: none;
          transition: border-color .18s;
          -webkit-text-fill-color: #fff;
        }
        .dl-input:focus {
          border-color: rgba(34,197,94,.5);
        }
        .dl-input::placeholder { color: rgba(255,255,255,.28); }
      `}</style>

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 400,
        animation: 'dlFadeUp .4s cubic-bezier(.34,1.2,.64,1) both',
      }}>

        {/* Logo mark */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 36 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: 'rgba(34,197,94,.1)',
            border: '1.5px solid rgba(34,197,94,.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 14,
          }}>
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M8 24L16 8L24 24" stroke="#22C55E" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10.5 19H21.5" stroke="#22C55E" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{ fontFamily: COND, fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: '-.5px', lineHeight: 1 }}>
            UaTob Driver
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, color: 'rgba(74,222,128,.55)', letterSpacing: '.12em', textTransform: 'uppercase', marginTop: 6 }}>
            Driver Portal
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Email */}
          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', fontFamily: MONO, fontSize: 9, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', marginBottom: 7 }}>
              Email
            </label>
            <input
              className="dl-input"
              type="email"
              autoComplete="email"
              placeholder="you@email.com"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }}
              disabled={loading}
              required
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '14px 16px', borderRadius: 12,
                background: 'rgba(255,255,255,.04)',
                border: '1.5px solid rgba(255,255,255,.1)',
                color: '#fff', fontSize: 15,
                fontFamily: SANS, outline: 'none',
                transition: 'border-color .18s',
              }}
              onFocus={e  => (e.target.style.borderColor = 'rgba(34,197,94,.5)')}
              onBlur={e   => (e.target.style.borderColor = 'rgba(255,255,255,.1)')}
            />
          </div>

          {/* Password */}
          <div>
            <label style={{ display: 'block', fontFamily: MONO, fontSize: 9, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', marginBottom: 7 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                disabled={loading}
                required
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '14px 48px 14px 16px', borderRadius: 12,
                  background: 'rgba(255,255,255,.04)',
                  border: '1.5px solid rgba(255,255,255,.1)',
                  color: '#fff', fontSize: 15,
                  fontFamily: SANS, outline: 'none',
                  transition: 'border-color .18s',
                }}
                onFocus={e  => (e.target.style.borderColor = 'rgba(34,197,94,.5)')}
                onBlur={e   => (e.target.style.borderColor = 'rgba(255,255,255,.1)')}
              />
              {/* show/hide toggle */}
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                style={{
                  position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: 4, color: 'rgba(255,255,255,.3)', lineHeight: 1,
                }}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0112 20C7 20 2.73 16.39 1 12a10.05 10.05 0 014.47-5.42M9.9 4.24A9.12 9.12 0 0112 4c5 0 9.27 3.61 11 8a10.07 10.07 0 01-1.31 2.59M1 1l22 22"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: '11px 14px', borderRadius: 10,
              background: 'rgba(248,113,113,.08)',
              border: '1px solid rgba(248,113,113,.22)',
              fontFamily: SANS, fontSize: 13, fontWeight: 600,
              color: '#FCA5A5', lineHeight: 1.5,
            }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !email.trim() || !password}
            style={{
              marginTop: 4,
              width: '100%', padding: '15px 0', borderRadius: 13, border: 'none',
              background: loading || !email.trim() || !password
                ? 'rgba(34,197,94,.18)'
                : 'linear-gradient(135deg,#22C55E,#16A34A 55%,#15803D)',
              color: loading || !email.trim() || !password ? 'rgba(74,222,128,.5)' : '#030604',
              fontSize: 16, fontWeight: 800, fontFamily: COND,
              letterSpacing: '.06em', textTransform: 'uppercase',
              cursor: loading || !email.trim() || !password ? 'not-allowed' : 'pointer',
              boxShadow: loading || !email.trim() || !password
                ? 'none'
                : '0 0 24px rgba(34,197,94,.3)',
              transition: 'all .18s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {loading ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(74,222,128,.7)" strokeWidth="2.5"
                  style={{ animation: 'dlSpin 1s linear infinite' }}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
                Signing in…
              </>
            ) : 'Sign In'}
          </button>

        </form>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 28 }}>
          <p style={{ fontFamily: SANS, fontSize: 12.5, color: 'rgba(255,255,255,.25)', margin: 0, lineHeight: 1.6 }}>
            Drivers only. Need help?{' '}
            <a href="mailto:support@uatob.com" style={{ color: 'rgba(74,222,128,.6)', textDecoration: 'none', fontWeight: 700 }}>
              support@uatob.com
            </a>
          </p>
        </div>

      </div>
    </div>
  );
}
