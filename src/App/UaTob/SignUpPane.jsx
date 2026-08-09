// SignUpPane.jsx
// Shown on the You tab when the rider isn't signed in. Collects first name,
// last name, phone, email + password and requires agreeing to the account
// terms, then creates the Firebase auth user + Accounts profile. Returning
// users can flip to a compact log-in. New-design (dark) styling.

import { useState } from 'react';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';
import { firebase_app } from '@/firebase/config';
import signUp from '@/firebase/auth/signup';
import signIn from '@/firebase/auth/signin';
import { useCreateAccount } from '@/App/UaTob/useCreateAccount';
import { C, MONO, COND, BODY } from '@/App/UaTob/theme';

// Florida service areas — where the rider mostly rides. Doubles as a city signal
// for local SEO / landing pages down the line.
const FL_CITIES = [
  'Orlando', 'Kissimmee', 'Sanford', 'Winter Park', 'Lake Nona', 'Apopka', 'Ocoee', 'Winter Garden',
  'Altamonte Springs', 'Oviedo', 'Clermont', 'Pine Hills', 'Windermere', 'St. Cloud', 'Lake Buena Vista',
  'Miami', 'Miami Beach', 'Fort Lauderdale', 'Hollywood', 'Hialeah', 'Coral Gables', 'Doral',
  'Tampa', 'St. Petersburg', 'Clearwater', 'Brandon', 'Lakeland',
  'Jacksonville', 'St. Augustine',
  'Tallahassee', 'Gainesville', 'Ocala', 'Daytona Beach', 'Melbourne', 'Palm Bay', 'Cocoa',
  'West Palm Beach', 'Boca Raton', 'Fort Myers', 'Cape Coral', 'Naples', 'Sarasota', 'Port St. Lucie',
  'Pensacola', 'Panama City', 'Key West',
];

function Field({ label, ...props }) {
  return (
    <label style={{ display: 'block', flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: COND, fontSize: 9, fontWeight: 800, letterSpacing: '.16em', color: C.inkDim, textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
      <input
        {...props}
        style={{
          width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,.03)',
          border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 13px', outline: 'none',
          fontFamily: BODY, fontSize: 14, fontWeight: 600, color: C.inkBright, caretColor: C.greenBright, colorScheme: 'dark',
        }}
        onFocus={(e) => { e.target.style.borderColor = C.borderBright; e.target.style.background = 'rgba(34,197,94,.06)'; }}
        onBlur={(e) => { e.target.style.borderColor = C.border; e.target.style.background = 'rgba(255,255,255,.03)'; }}
      />
    </label>
  );
}

export default function SignUpPane() {
  const [mode, setMode] = useState('signup'); // 'signup' | 'login'
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const { createAccount } = useCreateAccount();
  const isSignup = mode === 'signup';

  const handleForgot = async () => {
    setError(''); setNotice('');
    if (!/\S+@\S+\.\S+/.test(email)) { setError('Enter your email above, then tap “Forgot password.”'); return; }
    setBusy(true);
    try {
      await sendPasswordResetEmail(getAuth(firebase_app), email.trim());
      setNotice(`Password reset link sent to ${email.trim()}. Check your inbox.`);
    } catch (err) {
      setError(friendly(err));
    } finally { setBusy(false); }
  };

  const valid = isSignup
    ? (first.trim() && last.trim() && phone.trim() && /\S+@\S+\.\S+/.test(email) && password.length >= 6 && agree)
    : (/\S+@\S+\.\S+/.test(email) && password.length >= 1);

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!valid || busy) return;
    setBusy(true);
    setError('');
    try {
      if (isSignup) {
        const { result, error: err } = await signUp(email.trim(), password);
        if (err || !result?.user) throw new Error(friendly(err));
        await createAccount({
          uid: result.user.uid,
          email: email.trim(),
          name: `${first.trim()} ${last.trim()}`,
          firstName: first.trim(), lastName: last.trim(), phone: phone.trim(),
          serviceArea: city || null,
        });
      } else {
        const { error: err } = await signIn(email.trim(), password);
        if (err) throw new Error(friendly(err));
      }
      // AuthContext picks up the new uid → the account view renders automatically.
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.');
      setBusy(false);
    }
  };

  return (
    <div style={{ animation: 'urUp .38s cubic-bezier(.34,1.1,.64,1) both' }}>
      <div style={{ fontFamily: COND, fontSize: 11, fontWeight: 800, letterSpacing: '.22em', textTransform: 'uppercase', color: C.inkDim }}>Account</div>
      <div style={{ fontFamily: COND, fontSize: 27, fontWeight: 800, lineHeight: 1, margin: '5px 0 2px' }}>{isSignup ? 'Create your account' : 'Welcome back'}</div>
      <div style={{ fontFamily: MONO, fontSize: 10.5, color: C.inkMid, marginBottom: 18 }}>{isSignup ? 'Join UaTob to request rides and add credit.' : 'Sign in to continue.'}</div>

      {error && (
        <div style={{ display: 'flex', gap: 8, padding: '11px 13px', marginBottom: 14, borderRadius: 12, background: 'rgba(248,113,113,.08)', border: '1px solid rgba(248,113,113,.3)' }}>
          <span style={{ fontSize: 13 }}>⚠️</span>
          <span style={{ fontFamily: MONO, fontSize: 11, color: C.red, lineHeight: 1.5 }}>{error}</span>
        </div>
      )}
      {notice && (
        <div style={{ display: 'flex', gap: 8, padding: '11px 13px', marginBottom: 14, borderRadius: 12, background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.3)' }}>
          <span style={{ fontSize: 13 }}>✅</span>
          <span style={{ fontFamily: MONO, fontSize: 11, color: C.greenBright, lineHeight: 1.5 }}>{notice}</span>
        </div>
      )}

      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {isSignup && (
          <div style={{ display: 'flex', gap: 10 }}>
            <Field label="First name" value={first} onChange={(e) => setFirst(e.target.value)} placeholder="Jordan" autoComplete="given-name" />
            <Field label="Last name" value={last} onChange={(e) => setLast(e.target.value)} placeholder="Ellis" autoComplete="family-name" />
          </div>
        )}
        {isSignup && (
          <Field label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(407) 555-0142" autoComplete="tel" inputMode="tel" />
        )}
        {isSignup && (
          <label style={{ display: 'block' }}>
            <div style={{ fontFamily: COND, fontSize: 9, fontWeight: 800, letterSpacing: '.16em', color: C.inkDim, textTransform: 'uppercase', marginBottom: 5 }}>Service area</div>
            <select
              value={city} onChange={(e) => setCity(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,.03)',
                border: `1px solid ${C.border}`, borderRadius: 12, padding: '12px 13px', outline: 'none',
                fontFamily: BODY, fontSize: 14, fontWeight: 600, color: city ? C.inkBright : C.inkDim,
                caretColor: C.greenBright, colorScheme: 'dark', appearance: 'none', WebkitAppearance: 'none',
                backgroundImage: 'linear-gradient(45deg,transparent 50%,rgba(92,235,160,.7) 50%),linear-gradient(135deg,rgba(92,235,160,.7) 50%,transparent 50%)',
                backgroundPosition: 'calc(100% - 18px) 19px, calc(100% - 13px) 19px', backgroundSize: '5px 5px, 5px 5px', backgroundRepeat: 'no-repeat',
              }}
              onFocus={(e) => { e.target.style.borderColor = C.borderBright; e.target.style.background = 'rgba(34,197,94,.06)'; }}
              onBlur={(e) => { e.target.style.borderColor = C.border; e.target.style.background = 'rgba(255,255,255,.03)'; }}
            >
              <option value="" disabled>Choose your city…</option>
              {FL_CITIES.map((c) => <option key={c} value={c} style={{ color: '#0b120d' }}>{c}, FL</option>)}
            </select>
          </label>
        )}
        <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" inputMode="email" />
        <Field label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={isSignup ? 'At least 6 characters' : '••••••••'} autoComplete={isSignup ? 'new-password' : 'current-password'} />

        {!isSignup && (
          <div style={{ textAlign: 'right', marginTop: -4 }}>
            <button type="button" onClick={handleForgot} disabled={busy} style={{ background: 'none', border: 'none', cursor: busy ? 'wait' : 'pointer', fontFamily: MONO, fontSize: 10.5, fontWeight: 700, color: C.greenSoft, textDecoration: 'underline' }}>
              Forgot password?
            </button>
          </div>
        )}

        {isSignup && (
          <button type="button" onClick={() => setAgree((v) => !v)} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', background: 'none', border: 'none', padding: '2px 0', textAlign: 'left' }}>
            <span style={{
              width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 900, color: '#04150a',
              border: `1.5px solid ${agree ? C.greenBright : C.inkFade}`, background: agree ? C.greenBright : 'transparent',
            }}>{agree ? '✓' : ''}</span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: C.inkMid, lineHeight: 1.6 }}>
              I agree to the{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: C.greenSoft, textDecoration: 'underline' }}>Terms</a>
              {' '}and{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: C.greenSoft, textDecoration: 'underline' }}>Privacy Policy</a>.
            </span>
          </button>
        )}

        <button type="submit" disabled={!valid || busy} style={{
          width: '100%', border: 'none', borderRadius: 16, padding: 16, marginTop: 4, cursor: valid && !busy ? 'pointer' : 'not-allowed',
          fontFamily: COND, fontSize: 16, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase',
          color: valid ? '#04150a' : C.inkDim,
          background: valid ? 'linear-gradient(135deg,#2FE08A,#17B673 55%,#15803D)' : 'rgba(255,255,255,.05)',
          boxShadow: valid ? '0 10px 30px rgba(34,197,94,.3)' : 'none',
        }}>
          {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Log in'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <span style={{ fontFamily: MONO, fontSize: 10.5, color: C.inkMid }}>{isSignup ? 'Already have an account? ' : "Don't have an account? "}</span>
        <button onClick={() => { setMode(isSignup ? 'login' : 'signup'); setError(''); setNotice(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: COND, fontSize: 12.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: C.greenBright }}>
          {isSignup ? 'Log in' : 'Sign up'}
        </button>
      </div>
    </div>
  );
}

function friendly(err) {
  const code = err?.code || '';
  if (code.includes('email-already-in-use')) return 'That email already has an account — log in instead.';
  if (code.includes('invalid-email')) return 'That email address looks invalid.';
  if (code.includes('weak-password')) return 'Password should be at least 6 characters.';
  if (code.includes('wrong-password') || code.includes('invalid-credential')) return 'Wrong email or password.';
  if (code.includes('user-not-found')) return 'No account found for that email.';
  if (code.includes('too-many-requests')) return 'Too many attempts — try again shortly.';
  return err?.message || 'Something went wrong. Try again.';
}
