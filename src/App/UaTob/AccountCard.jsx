/**
 * AccountCard.jsx — Rider account face for the UaTob HUD
 * Steps: 0=name, 1=phone, 2=email, 3=password
 */

import { useState, useMemo, useCallback } from 'react';
import signUp        from '@/firebase/auth/signup';
import signIn        from '@/firebase/auth/signin';
import resetPassword from '@/firebase/auth/passwordReset';
import { useCreateAccount } from '@/App/UaTob/useCreateAccount';

// ── tokens ────────────────────────────────────────────────────────────────────
const C = {
  bg:           '#050A06',
  bgCard:       'rgba(255,255,255,.035)',
  bgElevated:   'rgba(255,255,255,.055)',
  border:       'rgba(34,197,94,.20)',
  borderDim:    'rgba(34,197,94,.09)',
  borderFaint:  'rgba(255,255,255,.07)',
  green:        '#22C55E',
  greenBright:  '#4ADE80',
  greenSoft:    '#34D399',
  greenDim:     'rgba(34,197,94,.08)',
  white:        '#fff',
  dim:          'rgba(255,255,255,.32)',
  fade:         'rgba(255,255,255,.14)',
  faint:        'rgba(255,255,255,.06)',
  amber:        '#F59E0B',
  amberDim:     'rgba(245,158,11,.09)',
  amberBorder:  'rgba(245,158,11,.28)',
  red:          '#F87171',
  redDim:       'rgba(248,113,113,.09)',
  indigo:       '#818CF8',
  indigoDim:    'rgba(129,140,248,.09)',
  indigoBorder: 'rgba(129,140,248,.28)',
};
const MONO = "'JetBrains Mono','SFMono-Regular',monospace";
const COND = "'Barlow Condensed','Barlow',sans-serif";
const SANS = "'Inter','Helvetica Neue',sans-serif";

// ── keyframes ─────────────────────────────────────────────────────────────────
const KF = `
  @keyframes acSlideUp  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes acFadeIn   { from{opacity:0} to{opacity:1} }
  @keyframes acBlink    { 0%,100%{opacity:1} 50%{opacity:.22} }
  @keyframes acSpin     { to{transform:rotate(360deg)} }
  @keyframes acPop      { 0%{transform:scale(.4);opacity:0} 60%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
  @keyframes acGlow     { 0%,100%{box-shadow:0 0 18px rgba(74,222,128,.22)} 50%{box-shadow:0 0 32px rgba(74,222,128,.48)} }
  @keyframes acStepFill { from{width:0} to{width:100%} }
`;

// ── helpers ───────────────────────────────────────────────────────────────────
function initials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}
function fmtDate(ts) {
  if (!ts) return '—';
  const ms = typeof ts.toMillis === 'function' ? ts.toMillis()
    : ts?.seconds ? ts.seconds * 1000 : typeof ts === 'number' ? ts : 0;
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtPhone(v) {
  const d = v.replace(/\D/g, '').slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0,3)}) ${d.slice(3)}`;
  return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
}

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner({ size = 16, color = C.green }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `2px solid rgba(34,197,94,.12)`,
      borderTop: `2px solid ${color}`,
      animation: 'acSpin .7s linear infinite', flexShrink: 0,
    }}/>
  );
}

// ── Ico ───────────────────────────────────────────────────────────────────────
function Ico({ n, size = 14, color = 'currentColor', sw = 1.7 }) {
  const p = { width:size, height:size, viewBox:'0 0 24 24', fill:'none',
    stroke:color, strokeWidth:sw, strokeLinecap:'round', strokeLinejoin:'round' };
  switch(n) {
    case 'user':   return <svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
    case 'phone':  return <svg {...p}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12 19.79 19.79 0 0 1 1.05 3.4 2 2 0 0 1 3 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16z"/></svg>;
    case 'mail':   return <svg {...p}><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/></svg>;
    case 'lock':   return <svg {...p}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
    case 'eye':    return <svg {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
    case 'eyeoff': return <svg {...p}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
    case 'check':  return <svg {...p}><polyline points="20 6 9 17 4 12"/></svg>;
    case 'warn':   return <svg {...p}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
    case 'car':    return <svg {...p}><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v4h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>;
    case 'star':   return <svg {...p}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
    case 'sign-out': return <svg {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
    case 'back':   return <svg {...p}><polyline points="15 18 9 12 15 6"/></svg>;
    case 'fwd':    return <svg {...p}><polyline points="9 18 15 12 9 6"/></svg>;
    case 'shield': return <svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
    case 'reset':  return <svg {...p}><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.96"/></svg>;
    default: return null;
  }
}

// ── Field ─────────────────────────────────────────────────────────────────────
function Field({ label, icon, type = 'text', value, onChange, placeholder, autoFocus, rightEl, error }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
      <div style={{ fontFamily:COND, fontSize:8.5, fontWeight:800, letterSpacing:'.14em',
        color: error ? C.red : C.greenBright, textTransform:'uppercase' }}>
        {label}
      </div>
      <div style={{
        display:'flex', alignItems:'center', gap:8,
        background: focused ? 'rgba(34,197,94,.07)' : C.faint,
        border: `1px solid ${error ? 'rgba(248,113,113,.4)' : focused ? C.border : C.borderDim}`,
        borderRadius:10, padding:'10px 12px', transition:'all .15s',
        boxShadow: focused ? `0 0 0 3px ${C.greenDim}` : 'none',
      }}>
        {icon && <Ico n={icon} size={13} color={error ? C.red : focused ? C.greenBright : C.dim}/>}
        <input
          autoFocus={autoFocus}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          style={{ flex:1, background:'none', border:'none', outline:'none',
            fontFamily:MONO, fontSize:11, color:'#fff', caretColor:C.greenBright }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {rightEl}
      </div>
      {error && (
        <div style={{ display:'flex', alignItems:'center', gap:4,
          fontFamily:MONO, fontSize:9, color:C.red }}>
          <Ico n="warn" size={9} color={C.red}/>{error}
        </div>
      )}
    </div>
  );
}

// ── PrimaryBtn ────────────────────────────────────────────────────────────────
function PrimaryBtn({ children, onClick, disabled, loading, style: sx = {} }) {
  return (
    <button type="button" onClick={disabled || loading ? undefined : onClick} style={{
      width:'100%', padding:'11px 0', borderRadius:11, border:'none',
      background: disabled || loading ? 'rgba(255,255,255,.06)' : 'linear-gradient(135deg,#22C55E,#16A34A)',
      color: disabled || loading ? C.fade : '#fff',
      fontFamily:COND, fontSize:12, fontWeight:800, letterSpacing:'.14em',
      textTransform:'uppercase', cursor: disabled || loading ? 'not-allowed' : 'pointer',
      display:'flex', alignItems:'center', justifyContent:'center', gap:7,
      boxShadow: disabled || loading ? 'none' : '0 4px 18px rgba(34,197,94,.3)',
      animation: disabled || loading ? 'none' : 'acGlow 2.8s ease-in-out infinite',
      transition:'all .15s', ...sx,
    }}>
      {loading ? <><Spinner size={13}/> Please wait…</> : children}
    </button>
  );
}

function GhostBtn({ children, onClick, style: sx = {} }) {
  return (
    <button type="button" onClick={onClick} style={{
      width:'100%', padding:'9px 0', borderRadius:10,
      border:'1px solid rgba(255,255,255,.09)', background:'rgba(255,255,255,.04)',
      color:C.dim, fontFamily:COND, fontSize:11, fontWeight:700,
      letterSpacing:'.12em', textTransform:'uppercase', cursor:'pointer',
      transition:'background .12s', ...sx,
    }}>
      {children}
    </button>
  );
}

// ── StepDots ──────────────────────────────────────────────────────────────────
const STEP_LABELS = ['Name', 'Phone', 'Email', 'Password'];

function StepDots({ step, total = 4 }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{ flex:1, height:2, borderRadius:2, overflow:'hidden',
          background: i < step ? C.green : i === step ? C.borderDim : C.borderDim }}>
          {i === step && (
            <div style={{ height:'100%', background:C.greenBright,
              animation:'acStepFill .4s ease both', width:'100%' }}/>
          )}
          {i < step && <div style={{ height:'100%', background:C.green, width:'100%' }}/>}
        </div>
      ))}
      <span style={{ fontFamily:MONO, fontSize:8, color:C.dim, whiteSpace:'nowrap', flexShrink:0 }}>
        {step + 1} / {total}
      </span>
    </div>
  );
}

// ── SIGNUP FLOW ───────────────────────────────────────────────────────────────
function SignupFlow({ onDone, onSwitchToLogin }) {
  const [step,            setStep]            = useState(0);
  const [name,            setName]            = useState('');
  const [phone,           setPhone]           = useState('');
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [showPass,        setShowPass]        = useState(false);
  const [fieldError,      setFieldError]      = useState('');
  const [loading,         setLoading]         = useState(false);

  const { createAccount } = useCreateAccount();

  const validate = () => {
    if (step === 0 && name.trim().length < 2)
      return 'Enter your full name';
    if (step === 1 && phone.replace(/\D/g,'').length < 10)
      return 'Enter a valid 10-digit phone number';
    if (step === 2 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return 'Enter a valid email address';
    if (step === 3 && password.length < 6)
      return 'Password must be at least 6 characters';
    return '';
  };

  const next = () => {
    const err = validate();
    if (err) { setFieldError(err); return; }
    setFieldError('');
    setStep(s => s + 1);
  };

  const handleKey = e => { if (e.key === 'Enter') step < 3 ? next() : submit(); };

  const submit = async () => {
    const err = validate();
    if (err) { setFieldError(err); return; }
    setLoading(true);
    setFieldError('');
    try {
      const { result, error } = await signUp(email, password, name);
      if (error) throw new Error(error.message || 'Sign up failed');
      const user = result.user;
      await createAccount({ uid: user.uid, email: user.email, name });
      onDone?.(user);
    } catch (e) {
      setFieldError(e.message);
      setLoading(false);
    }
  };

  const stepContent = () => {
    switch(step) {
      case 0: return (
        <Field label="Full Name" icon="user" value={name}
          onChange={e => { setName(e.target.value); setFieldError(''); }}
          placeholder="Jane Smith" autoFocus error={fieldError}
          onKeyDown={handleKey}/>
      );
      case 1: return (
        <Field label="Phone Number" icon="phone" type="tel" value={phone}
          onChange={e => { setPhone(fmtPhone(e.target.value)); setFieldError(''); }}
          placeholder="(407) 555-0100" autoFocus error={fieldError}/>
      );
      case 2: return (
        <Field label="Email Address" icon="mail" type="email" value={email}
          onChange={e => { setEmail(e.target.value); setFieldError(''); }}
          placeholder="jane@email.com" autoFocus error={fieldError}/>
      );
      case 3: return (
        <Field label="Password" icon="lock"
          type={showPass ? 'text' : 'password'} value={password}
          onChange={e => { setPassword(e.target.value); setFieldError(''); }}
          placeholder="Min. 6 characters" autoFocus error={fieldError}
          rightEl={
            <button type="button" onClick={() => setShowPass(v => !v)}
              style={{ background:'none', border:'none', cursor:'pointer',
                color:C.dim, padding:0, display:'flex', alignItems:'center' }}>
              <Ico n={showPass ? 'eyeoff' : 'eye'} size={13} color={C.dim}/>
            </button>
          }/>
      );
      default: return null;
    }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14,
      animation:'acSlideUp .3s ease both' }}>

      {/* Header */}
      <div>
        <div style={{ fontFamily:COND, fontSize:18, fontWeight:900,
          letterSpacing:'.04em', color:'#fff', lineHeight:1.1 }}>
          Create account
        </div>
        <div style={{ fontFamily:MONO, fontSize:8.5, color:C.dim, marginTop:3 }}>
          {STEP_LABELS[step]} · step {step + 1} of 4
        </div>
      </div>

      <StepDots step={step}/>

      {/* Step field */}
      <div key={step} style={{ animation:'acSlideUp .25s ease both' }}>
        {stepContent()}
      </div>

      {/* Actions */}
      {step < 3
        ? <PrimaryBtn onClick={next} disabled={
            (step === 0 && !name.trim()) ||
            (step === 1 && phone.replace(/\D/g,'').length < 10) ||
            (step === 2 && !email.trim())
          }>
            Next <Ico n="fwd" size={13} color="#fff"/>
          </PrimaryBtn>
        : <PrimaryBtn onClick={submit} loading={loading} disabled={password.length < 6 || loading}>
            <Ico n="shield" size={13} color="#fff"/> Create Account
          </PrimaryBtn>
      }

      {step > 0 && (
        <GhostBtn onClick={() => { setFieldError(''); setStep(s => s - 1); }}>
          <Ico n="back" size={11} color={C.dim}/> Back
        </GhostBtn>
      )}

      {/* Switch to login */}
      <div style={{ textAlign:'center', fontFamily:MONO, fontSize:9, color:C.dim }}>
        Already have an account?{' '}
        <button type="button" onClick={onSwitchToLogin} style={{
          background:'none', border:'none', cursor:'pointer',
          fontFamily:MONO, fontSize:9, color:C.greenBright, fontWeight:700,
          textDecoration:'underline',
        }}>
          Sign in
        </button>
      </div>
    </div>
  );
}

// ── LOGIN FLOW ────────────────────────────────────────────────────────────────
function LoginFlow({ onDone, onSwitchToSignup }) {
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [showPass,  setShowPass]  = useState(false);
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { setError('Email and password required'); return; }
    setLoading(true); setError('');
    const { result, error: err } = await signIn(email, password);
    if (err) { setError(err.message || 'Login failed'); setLoading(false); return; }
    onDone?.(result.user);
  };

  const handleReset = async () => {
    if (!email) { setError('Enter your email first'); return; }
    setResetting(true);
    await resetPassword(email);
    setResetSent(true);
    setResetting(false);
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14,
      animation:'acSlideUp .3s ease both' }}>

      <div>
        <div style={{ fontFamily:COND, fontSize:18, fontWeight:900,
          letterSpacing:'.04em', color:'#fff', lineHeight:1.1 }}>
          Welcome back
        </div>
        <div style={{ fontFamily:MONO, fontSize:8.5, color:C.dim, marginTop:3 }}>
          Sign in to your account
        </div>
      </div>

      <Field label="Email" icon="mail" type="email" value={email}
        onChange={e => { setEmail(e.target.value); setError(''); }}
        placeholder="jane@email.com" autoFocus/>

      <Field label="Password" icon="lock"
        type={showPass ? 'text' : 'password'} value={password}
        onChange={e => { setPassword(e.target.value); setError(''); }}
        placeholder="Your password"
        rightEl={
          <button type="button" onClick={() => setShowPass(v => !v)}
            style={{ background:'none', border:'none', cursor:'pointer',
              color:C.dim, padding:0, display:'flex', alignItems:'center' }}>
            <Ico n={showPass ? 'eyeoff' : 'eye'} size={13} color={C.dim}/>
          </button>
        }/>

      {error && (
        <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 11px',
          background:C.redDim, border:'1px solid rgba(248,113,113,.2)',
          borderRadius:9, fontFamily:MONO, fontSize:9.5, color:C.red }}>
          <Ico n="warn" size={11} color={C.red}/>{error}
        </div>
      )}

      {resetSent && (
        <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 11px',
          background:C.greenDim, border:`1px solid ${C.border}`,
          borderRadius:9, fontFamily:MONO, fontSize:9.5, color:C.greenBright }}>
          <Ico n="check" size={11} color={C.greenBright}/>Reset email sent
        </div>
      )}

      <PrimaryBtn onClick={handleLogin} loading={loading}
        disabled={!email || !password || loading}>
        Sign In <Ico n="fwd" size={13} color="#fff"/>
      </PrimaryBtn>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <button type="button" onClick={handleReset} disabled={resetting}
          style={{ background:'none', border:'none', cursor:'pointer',
            fontFamily:MONO, fontSize:9, color:C.dim,
            display:'flex', alignItems:'center', gap:4 }}>
          <Ico n="reset" size={10} color={C.dim}/>
          {resetting ? 'Sending…' : 'Forgot password'}
        </button>

        <button type="button" onClick={onSwitchToSignup}
          style={{ background:'none', border:'none', cursor:'pointer',
            fontFamily:MONO, fontSize:9, color:C.greenBright, fontWeight:700,
            textDecoration:'underline' }}>
          Create account
        </button>
      </div>
    </div>
  );
}

// ── AUTHED VIEW ───────────────────────────────────────────────────────────────
function AuthedView({ uid, account, rides = [], onSignOut }) {
  const stats = useMemo(() => {
    const done  = rides.filter(r => r.status === 'completed');
    const spend = done.reduce((s, r) => s + Number(r.fareTotal || 0), 0);
    return { count: done.length, spend };
  }, [rides]);

  const totalRides = account?.totalRides ?? stats.count;
  const totalSpend = account?.totalSpend ?? stats.spend;
  const memberSince = fmtDate(account?.createdAt);

  const name  = account?.displayName || account?.name || 'Rider';
  const email = account?.email || '';
  const phone = account?.phone || '';

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12,
      animation:'acSlideUp .3s ease both' }}>

      {/* Avatar + name */}
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <div style={{
          width:48, height:48, borderRadius:13, flexShrink:0,
          background:'rgba(34,197,94,.1)', border:`1px solid ${C.border}`,
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow:'0 0 16px rgba(74,222,128,.18)',
        }}>
          <span style={{ fontFamily:COND, fontSize:16, fontWeight:900,
            color:C.greenBright, letterSpacing:'.04em' }}>
            {initials(name)}
          </span>
        </div>
        <div style={{ minWidth:0 }}>
          <div style={{ fontFamily:COND, fontSize:17, fontWeight:900,
            letterSpacing:'.03em', color:'#fff', lineHeight:1.1 }}>
            {name}
          </div>
          <div style={{ fontFamily:MONO, fontSize:8.5, color:C.dim,
            marginTop:3, display:'flex', alignItems:'center', gap:4 }}>
            <div style={{ width:5, height:5, borderRadius:'50%', background:C.greenBright,
              boxShadow:`0 0 5px ${C.greenBright}`,
              animation:'acBlink 1.6s ease-in-out infinite' }}/>
            Active rider
          </div>
        </div>
      </div>

      <div style={{ height:1, background:C.borderDim }}/>

      {/* Contact info */}
      <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
        {[
          { icon:'mail',  val: email || '—' },
          { icon:'phone', val: phone || '—' },
        ].map((r, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:8,
            fontFamily:MONO, fontSize:9.5, color:C.dim }}>
            <Ico n={r.icon} size={11} color={C.fade}/>
            <span style={{ color: r.val === '—' ? C.fade : 'rgba(255,255,255,.55)' }}>
              {r.val}
            </span>
          </div>
        ))}
      </div>

      {/* Stats row */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:1,
        background:C.borderFaint, borderRadius:10, overflow:'hidden' }}>
        {[
          { lbl:'RIDES',   val: totalRides },
          { lbl:'SPENT',   val: `$${Number(totalSpend).toFixed(2)}` },
          { lbl:'MEMBER',  val: memberSince },
        ].map((s, i) => (
          <div key={i} style={{ padding:'9px 10px', background:C.faint,
            borderRight: i < 2 ? `1px solid ${C.borderFaint}` : 'none' }}>
            <div style={{ fontFamily:MONO, fontSize:7, fontWeight:700,
              letterSpacing:'.1em', color:C.dim, textTransform:'uppercase',
              marginBottom:4 }}>{s.lbl}</div>
            <div style={{ fontFamily:MONO, fontSize:13, fontWeight:700,
              color: i === 0 ? C.greenBright : i === 1 ? C.greenSoft : 'rgba(255,255,255,.6)' }}>
              {s.val}
            </div>
          </div>
        ))}
      </div>

      {/* Recent ride */}
      {rides.length > 0 && (() => {
        const last = [...rides].sort((a,b) => {
          const ta = a.createdAt?.seconds || 0;
          const tb = b.createdAt?.seconds || 0;
          return tb - ta;
        })[0];
        return (
          <div style={{ background:C.faint, border:`1px solid ${C.borderFaint}`,
            borderRadius:10, padding:'9px 11px', display:'flex',
            flexDirection:'column', gap:5 }}>
            <div style={{ fontFamily:COND, fontSize:8, fontWeight:800,
              letterSpacing:'.14em', color:C.dim, textTransform:'uppercase' }}>
              Last Ride
            </div>
            {[
              { dot:C.greenBright, val: last.pickup  || '—' },
              { dot:C.indigo,      val: last.dropoff || '—' },
            ].map((r, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:7 }}>
                <div style={{ width:5, height:5, borderRadius:'50%', flexShrink:0,
                  background:r.dot, boxShadow: i===0 ? `0 0 5px ${r.dot}88` : 'none' }}/>
                <span style={{ fontFamily:MONO, fontSize:9, color:'rgba(255,255,255,.45)',
                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {r.val}
                </span>
              </div>
            ))}
            <div style={{ display:'flex', alignItems:'center',
              justifyContent:'space-between', marginTop:2 }}>
              <span style={{ fontFamily:COND, fontSize:9, fontWeight:700,
                letterSpacing:'.08em', color:C.fade,
                textTransform:'uppercase' }}>
                {last.rideLabel || last.rideType || 'Standard'}
              </span>
              <span style={{ fontFamily:MONO, fontSize:12, fontWeight:800,
                color:C.greenBright }}>
                ${Number(last.fareTotal || 0).toFixed(2)}
              </span>
            </div>
          </div>
        );
      })()}

      {/* Sign out */}
      <button type="button" onClick={onSignOut} style={{
        width:'100%', padding:'9px 0', borderRadius:10,
        border:'1px solid rgba(248,113,113,.18)',
        background:'rgba(248,113,113,.05)', cursor:'pointer',
        display:'flex', alignItems:'center', justifyContent:'center', gap:7,
        fontFamily:COND, fontSize:11, fontWeight:700, letterSpacing:'.12em',
        textTransform:'uppercase', color:'rgba(248,113,113,.7)',
        transition:'background .12s',
      }}>
        <Ico n="sign-out" size={12} color="rgba(248,113,113,.7)"/>
        Sign Out
      </button>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function AccountCard({
  uid,
  account   = null,
  rides     = [],
  onSignOut,
  onSignUp,
  onSignIn,
}) {
  const [authMode, setAuthMode] = useState('signup'); // 'signup' | 'login'

  if (uid) {
    return (
      <>
        <style>{KF}</style>
        <div style={{ padding:'12px 13px 14px' }}>
          <AuthedView
            uid={uid}
            account={account}
            rides={rides}
            onSignOut={onSignOut}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <style>{KF}</style>
      <div style={{ padding:'12px 13px 14px' }}>

        {/* Brand mark */}
        <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:16 }}>
          <div style={{ width:32, height:32, borderRadius:9,
            background:'rgba(34,197,94,.1)', border:`1px solid ${C.border}`,
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:'0 0 12px rgba(74,222,128,.15)' }}>
            <Ico n="car" size={16} color={C.greenBright}/>
          </div>
          <div>
            <div style={{ fontFamily:COND, fontSize:13, fontWeight:900,
              letterSpacing:'.08em', color:'#fff', lineHeight:1 }}>
              UaTob
            </div>
            <div style={{ fontFamily:MONO, fontSize:7.5, color:C.dim, marginTop:1 }}>
              Orlando, FL · flat-rate
            </div>
          </div>
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:4 }}>
            <div style={{ width:5, height:5, borderRadius:'50%', background:C.greenBright,
              boxShadow:`0 0 5px ${C.greenBright}`,
              animation:'acBlink 1.6s ease-in-out infinite' }}/>
            <span style={{ fontFamily:MONO, fontSize:7.5, fontWeight:700,
              color:C.greenBright }}>LIVE</span>
          </div>
        </div>

        <div style={{ height:1, background:C.borderDim, marginBottom:16 }}/>

        {authMode === 'signup'
          ? <SignupFlow
              onDone={onSignUp}
              onSwitchToLogin={() => setAuthMode('login')}
            />
          : <LoginFlow
              onDone={onSignIn}
              onSwitchToSignup={() => setAuthMode('signup')}
            />
        }
      </div>
    </>
  );
}