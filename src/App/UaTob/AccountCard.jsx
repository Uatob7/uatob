/**
 * AccountCard.jsx — Rider account face for the UaTob HUD
 *
 * Darker substrate, better signup flow, password strength meter,
 * two-step sign-out confirm, tier ribbon, action rail, expandable last ride.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import signUp        from '@/firebase/auth/signup';
import signIn        from '@/firebase/auth/signin';
import signOutUser   from '@/firebase/auth/signOutUser';
import resetPassword from '@/firebase/auth/passwordReset';
import { useCreateAccount } from '@/App/UaTob/useCreateAccount';
import { storage, ref, uploadBytesResumable, getDownloadURL } from '@/firebase/config';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

const db = getFirestore(firebase_app);

// ── tokens (darker palette) ───────────────────────────────────────────────────
const C = {
  surface:      '#02080B',
  surfaceDeep:  '#01060A',
  surfaceCard:  'rgba(255,255,255,.03)',
  surfaceWell:  'rgba(0,0,0,.35)',
  surfaceField: 'rgba(255,255,255,.025)',
  border:        'rgba(34,197,94,.18)',
  borderDim:     'rgba(34,197,94,.08)',
  borderFaint:   'rgba(255,255,255,.05)',
  borderShadow:  'rgba(0,0,0,.45)',
  green:         '#22C55E',
  greenBright:   '#4ADE80',
  greenSoft:     '#34D399',
  greenDeep:     '#16A34A',
  greenGlow:     'rgba(74,222,128,.18)',
  greenDim:      'rgba(34,197,94,.08)',
  amber:         '#F59E0B',
  amberBright:   '#FBBF24',
  amberDim:      'rgba(245,158,11,.08)',
  amberBorder:   'rgba(245,158,11,.26)',
  red:           '#F87171',
  redDim:        'rgba(248,113,113,.08)',
  redBorder:     'rgba(248,113,113,.28)',
  indigo:        '#818CF8',
  indigoBright:  '#A5B4FC',
  violet:        '#C084FC',
  cyan:          '#67E8F9',
  white:         '#fff',
  inkText:       'rgba(255,255,255,.55)',
  dim:           'rgba(255,255,255,.32)',
  fade:          'rgba(255,255,255,.14)',
  faint:         'rgba(255,255,255,.06)',
};
const MONO = "'JetBrains Mono','SFMono-Regular',monospace";
const COND = "'Barlow Condensed','Barlow',sans-serif";
const SANS = "'Inter','Helvetica Neue',sans-serif";

const KF = `
  @keyframes acSlideUp   { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes acSlideDown { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
  @keyframes acFadeIn    { from{opacity:0} to{opacity:1} }
  @keyframes acBlink     { 0%,100%{opacity:1} 50%{opacity:.22} }
  @keyframes acSpin      { to{transform:rotate(360deg)} }
  @keyframes acGlow      { 0%,100%{box-shadow:0 0 18px rgba(74,222,128,.22)} 50%{box-shadow:0 0 32px rgba(74,222,128,.48)} }
  @keyframes acStepFill  { from{transform:scaleX(0)} to{transform:scaleX(1)} }
  @keyframes acRippleOut { 0%{transform:scale(.5);opacity:.55} 100%{transform:scale(2.4);opacity:0} }
  @keyframes acCheckPop  { 0%{transform:scale(.4);opacity:0} 60%{transform:scale(1.2)} 100%{transform:scale(1);opacity:1} }
  @keyframes acShake     { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-4px)} 40%,80%{transform:translateX(4px)} }
`;

// ── helpers ───────────────────────────────────────────────────────────────────
function initials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}
function tsToMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') { const p = Date.parse(ts); return Number.isNaN(p) ? 0 : p; }
  return 0;
}
function fmtDate(ts) {
  const ms = tsToMillis(ts);
  if (!ms) return '—';
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtAccountAge(ts) {
  const ms = tsToMillis(ts);
  if (!ms) return null;
  const days = Math.max(0, Math.floor((Date.now() - ms) / 86400000));
  if (days < 1)   return 'today';
  if (days < 7)   return `${days}d`;
  if (days < 30)  return `${Math.floor(days / 7)}wk`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}yr`;
}
function fmtPhoneInput(v) {
  const d = String(v ?? '').replace(/\D/g, '').slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0,3)}) ${d.slice(3)}`;
  return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
}
function emailValid(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s || ''); }

function tierFor(count) {
  if (count >= 100) return { label: 'Platinum', accent: '#E0E7FF', deep: '#A5B4FC' };
  if (count >= 50)  return { label: 'Gold',     accent: '#FBBF24', deep: '#F59E0B' };
  if (count >= 15)  return { label: 'Silver',   accent: '#E5E7EB', deep: '#9CA3AF' };
  if (count >= 3)   return { label: 'Bronze',   accent: '#FCA46D', deep: '#C2410C' };
  return                   { label: 'New',      accent: C.greenBright, deep: C.green };
}

function passwordStrength(pw) {
  if (!pw) return { score: 0, label: '—', color: C.fade };
  let s = 0;
  if (pw.length >= 6)  s++;
  if (pw.length >= 10) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) s++;
  const map = [
    { label: 'too short',   color: C.red        },
    { label: 'weak',        color: C.red        },
    { label: 'okay',        color: C.amberBright },
    { label: 'strong',      color: C.greenSoft  },
    { label: 'very strong', color: C.greenBright },
  ];
  return { score: s, ...map[s] };
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
function Ico({ n, size = 14, color = 'currentColor', sw = 1.7, style: sx }) {
  const p = {
    width:size, height:size, viewBox:'0 0 24 24', fill:'none',
    stroke:color, strokeWidth:sw, strokeLinecap:'round', strokeLinejoin:'round', style:sx,
  };
  switch(n) {
    case 'user':     return <svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
    case 'phone':    return <svg {...p}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12 19.79 19.79 0 0 1 1.05 3.4 2 2 0 0 1 3 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16z"/></svg>;
    case 'mail':     return <svg {...p}><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/></svg>;
    case 'lock':     return <svg {...p}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
    case 'eye':      return <svg {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
    case 'eyeoff':   return <svg {...p}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>;
    case 'check':    return <svg {...p}><polyline points="20 6 9 17 4 12"/></svg>;
    case 'warn':     return <svg {...p}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
    case 'car':      return <svg {...p}><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v4h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>;
    case 'star':     return <svg {...p}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
    case 'sign-out': return <svg {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
    case 'back':     return <svg {...p}><polyline points="15 18 9 12 15 6"/></svg>;
    case 'fwd':      return <svg {...p}><polyline points="9 18 15 12 9 6"/></svg>;
    case 'shield':   return <svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
    case 'reset':    return <svg {...p}><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.96"/></svg>;
    case 'wallet':   return <svg {...p}><path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h16v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7"/><circle cx="17" cy="13" r="1.4" fill={color}/></svg>;
    case 'receipt':  return <svg {...p}><path d="M4 2v20l2-1.5L8 22l2-1.5L12 22l2-1.5L16 22l2-1.5L20 22V2l-2 1.5L16 2l-2 1.5L12 2l-2 1.5L8 2 6 3.5 4 2z"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="13" y2="16"/></svg>;
    case 'help':     return <svg {...p}><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.4-1 .8-1 1.7"/><circle cx="12" cy="17" r=".5" fill={color}/></svg>;
    case 'spark':    return <svg {...p}><path d="M12 3l1.5 4.5H18l-3.75 2.75 1.5 4.5L12 12l-3.75 2.75 1.5-4.5L6 7.5h4.5L12 3z"/></svg>;
    case 'edit':     return <svg {...p}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
    case 'chevD':    return <svg {...p}><polyline points="6 9 12 15 18 9"/></svg>;
    case 'route':    return <svg {...p}><circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H14a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h5.5"/></svg>;
    case 'clock':    return <svg {...p}><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>;
    case 'x':        return <svg {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
    default: return null;
  }
}

// ── Field ─────────────────────────────────────────────────────────────────────
function Field({ label, icon, type='text', value, onChange, onKeyDown, placeholder, autoFocus, rightEl, error, valid, hint }) {
  const [focused, setFocused] = useState(false);
  const showCheck = valid && !error;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6 }}>
        <span style={{
          fontFamily:COND, fontSize:8.5, fontWeight:800, letterSpacing:'.14em',
          color: error ? C.red : focused ? C.greenBright : 'rgba(74,222,128,.7)',
          textTransform:'uppercase',
        }}>
          {label}
        </span>
        {hint && !error && (
          <span style={{ fontFamily:MONO, fontSize:8, color:C.fade }}>{hint}</span>
        )}
      </div>
      <div style={{
        display:'flex', alignItems:'center', gap:8,
        background: focused ? 'rgba(34,197,94,.05)' : C.surfaceField,
        border: `1px solid ${error ? 'rgba(248,113,113,.4)' : focused ? C.border : C.borderDim}`,
        borderRadius:10, padding:'10px 12px', transition:'all .15s',
        boxShadow: focused
          ? `0 0 0 3px rgba(34,197,94,.07), inset 0 1px 2px ${C.borderShadow}`
          : `inset 0 1px 2px ${C.borderShadow}`,
      }}>
        {icon && <Ico n={icon} size={13} color={error ? C.red : focused ? C.greenBright : C.dim}/>}
        <input
          autoFocus={autoFocus}
          type={type}
          value={value}
          onChange={onChange}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          style={{
            flex:1, background:'none', border:'none', outline:'none',
            fontFamily:MONO, fontSize:11, color:'#fff', caretColor:C.greenBright,
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {showCheck && (
          <div style={{
            width:16, height:16, borderRadius:'50%',
            background:'rgba(34,197,94,.18)', border:`1px solid ${C.border}`,
            display:'flex', alignItems:'center', justifyContent:'center',
            animation:'acCheckPop .3s cubic-bezier(.34,1.4,.64,1) both',
          }}>
            <Ico n="check" size={9} color={C.greenBright} sw={2.4}/>
          </div>
        )}
        {rightEl}
      </div>
      {error && (
        <div style={{ display:'flex', alignItems:'center', gap:5, fontFamily:MONO, fontSize:9, color:C.red, animation:'acFadeIn .2s ease both' }}>
          <Ico n="warn" size={9} color={C.red}/>{error}
        </div>
      )}
    </div>
  );
}

// ── Buttons ───────────────────────────────────────────────────────────────────
function PrimaryBtn({ children, onClick, disabled, loading, style: sx = {} }) {
  return (
    <button type="button" onClick={disabled || loading ? undefined : onClick} style={{
      width:'100%', padding:'11px 0', borderRadius:11, border:'none',
      background: disabled || loading ? 'rgba(255,255,255,.05)' : 'linear-gradient(135deg,#22C55E,#16A34A)',
      color: disabled || loading ? C.fade : '#fff',
      fontFamily:COND, fontSize:12, fontWeight:800, letterSpacing:'.14em',
      textTransform:'uppercase', cursor: disabled || loading ? 'not-allowed' : 'pointer',
      display:'flex', alignItems:'center', justifyContent:'center', gap:7,
      boxShadow: disabled || loading ? 'none' : '0 4px 18px rgba(34,197,94,.3), inset 0 1px 0 rgba(255,255,255,.18)',
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
      border:'1px solid rgba(255,255,255,.07)', background:'rgba(255,255,255,.025)',
      color:C.dim, fontFamily:COND, fontSize:11, fontWeight:700,
      letterSpacing:'.12em', textTransform:'uppercase', cursor:'pointer',
      display:'flex', alignItems:'center', justifyContent:'center', gap:6,
      transition:'background .12s', ...sx,
    }}>
      {children}
    </button>
  );
}

// ── Step progress rail ────────────────────────────────────────────────────────
const STEP_LABELS  = ['Your name', 'Phone', 'Email', 'Password'];
const STEP_ICONS   = ['user', 'phone', 'mail', 'lock'];
const STEP_TAGLINE = [
  'Tell us how to address you.',
  'For ride updates and driver contact.',
  'We use this to send your receipts.',
  'Choose a secure password.',
];

function StepRail({ step, total = 4 }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
      {Array.from({ length: total }, (_, i) => {
        const done = i < step;
        const cur  = i === step;
        return (
          <div key={i} style={{ flex:1, height:2.5, borderRadius:2, overflow:'hidden', background:'rgba(255,255,255,.06)' }}>
            {(done || cur) && (
              <div style={{
                height:'100%', borderRadius:2, transformOrigin:'left',
                background: done ? C.green : C.greenBright,
                opacity: done ? 0.85 : 1,
                boxShadow: cur ? `0 0 6px ${C.greenBright}` : 'none',
                animation: cur ? 'acStepFill .35s ease both' : 'none',
                width:'100%',
              }}/>
            )}
          </div>
        );
      })}
      <span style={{ fontFamily:MONO, fontSize:8, color:C.dim, whiteSpace:'nowrap', flexShrink:0 }}>
        {step + 1}/{total}
      </span>
    </div>
  );
}

function StepHeader({ step }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:11 }}>
      <div style={{
        width:38, height:38, borderRadius:11, flexShrink:0,
        background:'rgba(34,197,94,.08)', border:`1px solid ${C.border}`,
        display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow:'inset 0 1px 0 rgba(255,255,255,.04), 0 4px 14px rgba(0,0,0,.4)',
      }}>
        <Ico n={STEP_ICONS[step]} size={15} color={C.greenBright}/>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontFamily:COND, fontSize:17, fontWeight:900, letterSpacing:'.03em', color:'#fff', lineHeight:1.1 }}>
          {STEP_LABELS[step]}
        </div>
        <div style={{ fontFamily:MONO, fontSize:8.5, color:C.dim, marginTop:3 }}>
          {STEP_TAGLINE[step]}
        </div>
      </div>
    </div>
  );
}

// ── Inline banners ────────────────────────────────────────────────────────────
function Banner({ kind = 'error', children }) {
  const map = {
    error: { bg:C.redDim,                    bd:'rgba(248,113,113,.22)', fg:C.red,         ic:'warn'  },
    ok:    { bg:'rgba(34,197,94,.08)',        bd:C.border,               fg:C.greenBright, ic:'check' },
    info:  { bg:C.faint,                     bd:C.borderFaint,           fg:C.dim,         ic:'shield'},
  };
  const m = map[kind] || map.error;
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:6, padding:'8px 11px',
      background:m.bg, border:`1px solid ${m.bd}`, borderRadius:9,
      fontFamily:MONO, fontSize:9.5, color:m.fg, animation:'acFadeIn .2s ease both',
    }}>
      <Ico n={m.ic} size={11} color={m.fg}/>{children}
    </div>
  );
}

// ── Password strength meter ───────────────────────────────────────────────────
function StrengthMeter({ password }) {
  const s = passwordStrength(password);
  if (!password) return null;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:7 }}>
      <div style={{ display:'flex', gap:3, flex:1 }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{
            flex:1, height:3, borderRadius:2,
            background: i <= s.score ? s.color : 'rgba(255,255,255,.07)',
            transition:'background .2s',
          }}/>
        ))}
      </div>
      <span style={{
        fontFamily:MONO, fontSize:8.5, fontWeight:700, color:s.color,
        letterSpacing:'.04em', textTransform:'uppercase', minWidth:58, textAlign:'right',
      }}>
        {s.label}
      </span>
    </div>
  );
}

// ── Brand strip ───────────────────────────────────────────────────────────────
function BrandStrip() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:9 }}>
      <div style={{
        width:32, height:32, borderRadius:9, flexShrink:0,
        background:'rgba(34,197,94,.08)', border:`1px solid ${C.border}`,
        display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow:'inset 0 1px 0 rgba(255,255,255,.04), 0 0 14px rgba(74,222,128,.16)',
      }}>
        <Ico n="car" size={16} color={C.greenBright}/>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontFamily:COND, fontSize:13, fontWeight:900, letterSpacing:'.08em', color:'#fff', lineHeight:1 }}>UaTob</div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
        <div style={{ width:5, height:5, borderRadius:'50%', background:C.greenBright, boxShadow:`0 0 5px ${C.greenBright}`, animation:'acBlink 1.6s ease-in-out infinite' }}/>
        <span style={{ fontFamily:MONO, fontSize:7.5, fontWeight:700, color:C.greenBright }}>LIVE</span>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SIGNUP FLOW
// ═════════════════════════════════════════════════════════════════════════════
function SignupFlow({ onDone, onSwitchToLogin }) {
  const [step,       setStep]       = useState(0);
  const [name,       setName]       = useState('');
  const [phone,      setPhone]      = useState('');
  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [showPass,   setShowPass]   = useState(false);
  const [fieldError, setFieldError] = useState('');
  const [loading,    setLoading]    = useState(false);
  const [shake,      setShake]      = useState(false);

  const { createAccount } = useCreateAccount();

  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 450);
  }, []);

  const validate = useCallback(() => {
    if (step === 0 && name.trim().length < 2)          return 'Enter your full name';
    if (step === 1 && phone.replace(/\D/g,'').length < 10) return 'Enter a valid 10-digit number';
    if (step === 2 && !emailValid(email))               return 'Enter a valid email address';
    if (step === 3 && password.length < 6)             return 'Password must be at least 6 characters';
    return '';
  }, [step, name, phone, email, password]);

  const next = useCallback(() => {
    const err = validate();
    if (err) { setFieldError(err); triggerShake(); return; }
    setFieldError('');
    setStep(s => s + 1);
  }, [validate, triggerShake]);

  const handleKey = useCallback((e) => {
    if (e.key === 'Enter') { step < 3 ? next() : submit(); }
  }, [step, next]);

  const submit = useCallback(async () => {
    const err = validate();
    if (err) { setFieldError(err); triggerShake(); return; }
    setLoading(true);
    setFieldError('');
    try {
      const { result, error } = await signUp(email, password, name);
      if (error) throw new Error(error.message || 'Sign up failed');
      const user = result.user;
      await createAccount({ uid: user.uid, email: user.email, name, phone: phone.replace(/\D/g,'') });
      onDone?.(user);
    } catch (e) {
      setFieldError(e.message);
      triggerShake();
      setLoading(false);
    }
  }, [validate, email, password, name, phone, createAccount, onDone, triggerShake]);

  // Per-step field
  const fieldNode = (() => {
    switch (step) {
      case 0: return (
        <Field label="Full Name" icon="user" value={name}
          onChange={e => { setName(e.target.value); setFieldError(''); }}
          placeholder="Jane Smith" autoFocus
          valid={name.trim().length >= 2}
          error={fieldError} onKeyDown={handleKey}/>
      );
      case 1: return (
        <Field label="Phone Number" icon="phone" type="tel" value={phone}
          onChange={e => { setPhone(fmtPhoneInput(e.target.value)); setFieldError(''); }}
          placeholder="(407) 555-0100" autoFocus
          valid={phone.replace(/\D/g,'').length === 10}
          hint="US numbers only" error={fieldError} onKeyDown={handleKey}/>
      );
      case 2: return (
        <Field label="Email Address" icon="mail" type="email" value={email}
          onChange={e => { setEmail(e.target.value); setFieldError(''); }}
          placeholder="jane@email.com" autoFocus
          valid={emailValid(email)}
          error={fieldError} onKeyDown={handleKey}/>
      );
      case 3: return (
        <>
          <Field label="Password" icon="lock"
            type={showPass ? 'text' : 'password'} value={password}
            onChange={e => { setPassword(e.target.value); setFieldError(''); }}
            placeholder="Min. 6 characters" autoFocus
            valid={password.length >= 6}
            error={fieldError} onKeyDown={handleKey}
            rightEl={
              <button type="button" onClick={() => setShowPass(v => !v)}
                style={{ background:'none', border:'none', cursor:'pointer', color:C.dim, padding:0, display:'flex', alignItems:'center' }}>
                <Ico n={showPass ? 'eyeoff' : 'eye'} size={13} color={C.dim}/>
              </button>
            }/>
          <StrengthMeter password={password}/>
        </>
      );
      default: return null;
    }
  })();

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14, animation:'acSlideUp .3s ease both' }}>
      <StepHeader step={step}/>
      <StepRail step={step}/>

      <div key={step}
        style={{ display:'flex', flexDirection:'column', gap:10, animation:`acSlideUp .25s ease both${shake ? ', acShake .4s ease' : ''}` }}>
        {fieldNode}
      </div>

      {step < 3
        ? <PrimaryBtn onClick={next}
            disabled={(step===0 && name.trim().length<2)||(step===1 && phone.replace(/\D/g,'').length<10)||(step===2 && !emailValid(email))}>
            Continue <Ico n="fwd" size={13} color="#fff"/>
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

// ═════════════════════════════════════════════════════════════════════════════
// LOGIN FLOW
// ═════════════════════════════════════════════════════════════════════════════
function LoginFlow({ onDone, onSwitchToSignup }) {
  const [email,        setEmail]        = useState('');
  const [password,     setPassword]     = useState('');
  const [showPass,     setShowPass]     = useState(false);
  const [error,        setError]        = useState('');
  const [loading,      setLoading]      = useState(false);
  const [mode,         setMode]         = useState('login'); // 'login' | 'reset'
  const [resetEmail,   setResetEmail]   = useState('');
  const [resetSent,    setResetSent]    = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleLogin = useCallback(async () => {
    if (!email || !password) { setError('Email and password required'); return; }
    setLoading(true); setError('');
    const { result, error: err } = await signIn(email, password);
    if (err) { setError(err.message || 'Sign-in failed'); setLoading(false); return; }
    onDone?.(result.user);
  }, [email, password, onDone]);

  const handleReset = useCallback(async () => {
    if (!resetEmail) { setError('Enter your email address'); return; }
    setResetLoading(true);
    await resetPassword(resetEmail);
    setResetSent(true);
    setResetLoading(false);
  }, [resetEmail]);

  const handleKey = useCallback((e) => { if (e.key === 'Enter') handleLogin(); }, [handleLogin]);

  if (mode === 'reset') {
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:14, animation:'acSlideUp .3s ease both' }}>
        <div>
          <div style={{ fontFamily:COND, fontSize:17, fontWeight:900, letterSpacing:'.03em', color:'#fff', lineHeight:1.1 }}>
            Reset password
          </div>
          <div style={{ fontFamily:MONO, fontSize:8.5, color:C.dim, marginTop:3 }}>
            We'll send a link to your inbox.
          </div>
        </div>

        {!resetSent ? (
          <>
            <Field label="Email Address" icon="mail" type="email" value={resetEmail}
              onChange={e => { setResetEmail(e.target.value); setError(''); }}
              placeholder="jane@email.com" autoFocus
              valid={emailValid(resetEmail)} error={error}/>
            <PrimaryBtn onClick={handleReset} loading={resetLoading}
              disabled={!emailValid(resetEmail) || resetLoading}>
              <Ico n="reset" size={13} color="#fff"/> Send Reset Link
            </PrimaryBtn>
          </>
        ) : (
          <Banner kind="ok">Reset email sent — check your inbox.</Banner>
        )}

        <GhostBtn onClick={() => { setMode('login'); setError(''); setResetSent(false); }}>
          <Ico n="back" size={11} color={C.dim}/> Back to sign in
        </GhostBtn>
      </div>
    );
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14, animation:'acSlideUp .3s ease both' }}>
      <div>
        <div style={{ fontFamily:COND, fontSize:17, fontWeight:900, letterSpacing:'.03em', color:'#fff', lineHeight:1.1 }}>
          Welcome back
        </div>
        <div style={{ fontFamily:MONO, fontSize:8.5, color:C.dim, marginTop:3 }}>
          Sign in to your rider account
        </div>
      </div>

      <Field label="Email" icon="mail" type="email" value={email}
        onChange={e => { setEmail(e.target.value); setError(''); }}
        placeholder="jane@email.com" autoFocus
        valid={emailValid(email)} onKeyDown={handleKey}/>

      <Field label="Password" icon="lock"
        type={showPass ? 'text' : 'password'} value={password}
        onChange={e => { setPassword(e.target.value); setError(''); }}
        placeholder="Your password" onKeyDown={handleKey}
        rightEl={
          <button type="button" onClick={() => setShowPass(v => !v)}
            style={{ background:'none', border:'none', cursor:'pointer', color:C.dim, padding:0, display:'flex', alignItems:'center' }}>
            <Ico n={showPass ? 'eyeoff' : 'eye'} size={13} color={C.dim}/>
          </button>
        }/>

      {error && <Banner kind="error">{error}</Banner>}

      <PrimaryBtn onClick={handleLogin} loading={loading} disabled={!email || !password || loading}>
        Sign In <Ico n="fwd" size={13} color="#fff"/>
      </PrimaryBtn>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <button type="button" onClick={() => { setMode('reset'); setResetEmail(email); setError(''); }}
          style={{ background:'none', border:'none', cursor:'pointer', fontFamily:MONO, fontSize:9, color:C.dim, display:'flex', alignItems:'center', gap:4 }}>
          <Ico n="reset" size={10} color={C.dim}/> Forgot password?
        </button>
        <button type="button" onClick={onSwitchToSignup}
          style={{ background:'none', border:'none', cursor:'pointer', fontFamily:MONO, fontSize:9, color:C.greenBright, fontWeight:700, textDecoration:'underline' }}>
          Create account
        </button>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// AUTHED VIEW
// ═════════════════════════════════════════════════════════════════════════════
function AuthedView({ uid, account, rides = [] }) {
  const [signOutConfirm, setSignOutConfirm] = useState(false);
  const [signingOut,     setSigningOut]     = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoProgress,  setPhotoProgress]  = useState(0);
  const [photoError,     setPhotoError]     = useState('');
  const fileInputRef = useRef(null);

  const stats = useMemo(() => {
    const done  = rides.filter(r => r.status === 'completed');
    const spend = done.reduce((s, r) => s + Number(r.fareTotal || 0), 0);
    return { count: done.length, spend };
  }, [rides]);

  const totalRides  = account?.totalRides ?? stats.count;
  const totalSpend  = account?.totalSpend ?? stats.spend;
  const accountAge  = fmtAccountAge(account?.createdAt);
  const memberSince = fmtDate(account?.createdAt);
  const name     = account?.displayName || account?.name || 'Rider';
  const photoURL = account?.photoURL || null;
  const tier     = tierFor(totalRides);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    await signOutUser();
    setSigningOut(false);
  }, []);

  const handlePhotoChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file || !uid) return;
    setPhotoError('');
    setPhotoUploading(true);
    setPhotoProgress(0);
    try {
      const path    = `profile-photos/${uid}/${Date.now()}-${file.name}`;
      const fileRef = ref(storage, path);
      await new Promise((resolve, reject) => {
        const task = uploadBytesResumable(fileRef, file);
        task.on('state_changed',
          snap => setPhotoProgress(Math.round(snap.bytesTransferred / snap.totalBytes * 100)),
          reject,
          resolve,
        );
      });
      const url = await getDownloadURL(fileRef);
      await updateDoc(doc(db, 'Accounts', uid), { photoURL: url });
    } catch (err) {
      setPhotoError('Upload failed — try again');
    } finally {
      setPhotoUploading(false);
      e.target.value = '';
    }
  }, [uid]);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:9, animation:'acSlideUp .3s ease both' }}>

      {/* hidden file input */}
      <input
        ref={fileInputRef} type="file" accept="image/*"
        onChange={handlePhotoChange}
        style={{ display:'none' }}
      />

      {/* ── Header row: avatar + name + tier ──────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ position:'relative', flexShrink:0 }}>
          <div style={{
            position:'absolute', inset:-3, borderRadius:13,
            border:`1px solid ${tier.accent}33`,
            animation:'acRippleOut 3s ease-out 1s infinite',
            pointerEvents:'none',
          }}/>
          {/* clickable avatar */}
          <button
            type="button"
            onClick={() => !photoUploading && fileInputRef.current?.click()}
            style={{
              width:40, height:40, borderRadius:11, padding:0, border:'none',
              background:'rgba(0,0,0,.45)',
              outline:`1.5px solid ${tier.accent}55`,
              boxShadow:`0 0 14px ${tier.accent}1A`,
              cursor: photoUploading ? 'not-allowed' : 'pointer',
              overflow:'hidden', position:'relative',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}
          >
            {photoURL ? (
              <img src={photoURL} alt="avatar"
                style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:11 }}/>
            ) : (
              <span style={{ fontFamily:COND, fontSize:15, fontWeight:900, color:tier.accent, letterSpacing:'.04em' }}>
                {initials(name)}
              </span>
            )}
            {/* camera overlay */}
            {!photoUploading && (
              <div style={{
                position:'absolute', inset:0, borderRadius:11,
                background:'rgba(0,0,0,.52)',
                display:'flex', alignItems:'center', justifyContent:'center',
                opacity:0,
                transition:'opacity .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0'}
              >
                <Ico n="edit" size={13} color="#fff"/>
              </div>
            )}
            {/* upload progress overlay */}
            {photoUploading && (
              <div style={{
                position:'absolute', inset:0, borderRadius:11,
                background:'rgba(0,0,0,.7)',
                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3,
              }}>
                <Spinner size={12}/>
                <span style={{ fontFamily:MONO, fontSize:7, color:'#fff' }}>{photoProgress}%</span>
              </div>
            )}
          </button>
        </div>

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily:COND, fontSize:15, fontWeight:900, letterSpacing:'.03em', color:'#fff', lineHeight:1.1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {name}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:3 }}>
            <span style={{
              fontFamily:COND, fontSize:7.5, fontWeight:800, letterSpacing:'.14em',
              textTransform:'uppercase', padding:'1px 6px', borderRadius:4,
              background:`${tier.accent}15`, border:`1px solid ${tier.accent}33`,
              color:tier.accent,
            }}>
              <Ico n="spark" size={7} color={tier.accent} style={{ marginRight:2, verticalAlign:'middle' }}/>
              {tier.label}
            </span>
            <div style={{ display:'flex', alignItems:'center', gap:3 }}>
              <div style={{ width:4, height:4, borderRadius:'50%', background:C.greenBright, boxShadow:`0 0 4px ${C.greenBright}`, animation:'acBlink 1.6s ease-in-out infinite' }}/>
              <span style={{ fontFamily:MONO, fontSize:7.5, color:C.dim }}>active</span>
            </div>
          </div>
        </div>
      </div>

      {photoError && <Banner kind="error">{photoError}</Banner>}

      {/* ── Stats strip ─────────────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:1, background:'rgba(255,255,255,.04)', borderRadius:9, overflow:'hidden' }}>
        {[
          { lbl:'RIDES',  val: totalRides,                         color: C.greenBright },
          { lbl:'SPENT',  val: `$${Number(totalSpend).toFixed(2)}`, color: C.greenSoft  },
          { lbl:'MEMBER', val: accountAge || memberSince,           color: 'rgba(255,255,255,.5)' },
        ].map((s, i) => (
          <div key={i} style={{
            padding:'7px 8px', background:'rgba(0,0,0,.22)',
            borderRight: i < 2 ? '1px solid rgba(255,255,255,.04)' : 'none',
          }}>
            <div style={{ fontFamily:COND, fontSize:7, fontWeight:800, letterSpacing:'.1em', color:C.fade, textTransform:'uppercase', marginBottom:3 }}>
              {s.lbl}
            </div>
            <div style={{ fontFamily:MONO, fontSize:12, fontWeight:700, color:s.color }}>
              {s.val}
            </div>
          </div>
        ))}
      </div>

      {/* ── Sign-out (two-step) ──────────────────────────────────────── */}
      {!signOutConfirm ? (
        <button type="button" onClick={() => setSignOutConfirm(true)} style={{
          width:'100%', padding:'8px 0', borderRadius:9,
          border:'1px solid rgba(248,113,113,.15)', background:'rgba(248,113,113,.04)',
          cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6,
          fontFamily:COND, fontSize:10, fontWeight:700, letterSpacing:'.12em',
          textTransform:'uppercase', color:'rgba(248,113,113,.6)',
          transition:'background .12s',
        }}>
          <Ico n="sign-out" size={11} color="rgba(248,113,113,.6)"/>
          Sign Out
        </button>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:6, animation:'acSlideUp .2s ease both' }}>
          <div style={{ fontFamily:MONO, fontSize:9, color:C.dim, textAlign:'center' }}>
            Sign out of your rider account?
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <GhostBtn onClick={() => setSignOutConfirm(false)} style={{ flex:1 }}>
              Cancel
            </GhostBtn>
            <button type="button" onClick={handleSignOut} disabled={signingOut} style={{
              flex:1, padding:'8px 0', borderRadius:9,
              border:'1px solid rgba(248,113,113,.35)', background:'rgba(248,113,113,.12)',
              cursor: signingOut ? 'not-allowed' : 'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', gap:6,
              fontFamily:COND, fontSize:10, fontWeight:800, letterSpacing:'.12em',
              textTransform:'uppercase', color:C.red, opacity: signingOut ? 0.6 : 1,
            }}>
              {signingOut
                ? <><Spinner size={11}/> Signing out…</>
                : <><Ico n="sign-out" size={11} color={C.red}/> Confirm</>
              }
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ROOT
// ═════════════════════════════════════════════════════════════════════════════
export default function AccountCard({ uid, account = null, rides = [], onSignUp, onSignIn }) {
  const [authMode, setAuthMode] = useState('signup');

  return (
    <>
      <style>{KF}</style>
      <div style={{
        background: `linear-gradient(180deg, ${C.surface}, ${C.surfaceDeep})`,
        borderRadius: 14,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.04), inset 0 0 0 1px rgba(34,197,94,.07)',
      }}>
        <div style={{ padding:'12px 13px 14px' }}>
          {uid ? (
            <AuthedView uid={uid} account={account} rides={rides}/>
          ) : (
            <>
              <BrandStrip/>
              <div style={{ height:1, background:'rgba(255,255,255,.05)', margin:'13px 0' }}/>
              {authMode === 'signup'
                ? <SignupFlow onDone={onSignUp} onSwitchToLogin={() => setAuthMode('login')}/>
                : <LoginFlow  onDone={onSignIn} onSwitchToSignup={() => setAuthMode('signup')}/>
              }
            </>
          )}
        </div>
      </div>
    </>
  );
}
