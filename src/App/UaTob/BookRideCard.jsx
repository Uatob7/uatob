// BookRideCard.jsx — Multi-step Book a Ride flow
// Steps: 0=landing, 1=pickup, 2=dropoff, 3=ride type, 4=when,
//        5=date(sched), 6=time(sched), 7=discount, 8=payment, 9=card input, 10=cash confirm, 11=success

import { useState, useRef, useEffect } from 'react';

// ── tokens (inline so component is self-contained) ───────────────────────────
const C = {
  bg:          '#050A06',
  bgDeep:      '#030604',
  panel:       'rgba(255,255,255,.035)',
  border:      'rgba(34,197,94,.18)',
  borderDim:   'rgba(34,197,94,.09)',
  green:       '#22C55E',
  greenBright: '#4ADE80',
  greenSoft:   '#34D399',
  white:       '#fff',
  dim:         'rgba(255,255,255,.22)',
  fade:        'rgba(255,255,255,.10)',
  faint:       'rgba(255,255,255,.06)',
};
const MONO = "'JetBrains Mono','SFMono-Regular',monospace";
const COND = "'Barlow Condensed','Barlow',sans-serif";
const SANS = "'Inter','Helvetica Neue',sans-serif";

const KF = `
  @keyframes brSlideUp   { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes brFadeIn    { from{opacity:0} to{opacity:1} }
  @keyframes brBlink     { 0%,100%{opacity:1} 50%{opacity:.22} }
  @keyframes brGlowPulse { 0%,100%{box-shadow:0 0 18px rgba(74,222,128,.22)} 50%{box-shadow:0 0 32px rgba(74,222,128,.48)} }
  @keyframes brSpin      { to{transform:rotate(360deg)} }
  @keyframes brCheckPop  { 0%{opacity:0;transform:scale(.4)} 60%{transform:scale(1.18)} 80%{transform:scale(.93)} 100%{opacity:1;transform:scale(1)} }
  @keyframes brRingOut   { 0%{transform:scale(.6);opacity:.8} 100%{transform:scale(2.2);opacity:0} }
  @keyframes brSuccessIn { from{opacity:0;transform:translateY(16px) scale(.96)} to{opacity:1;transform:translateY(0) scale(1)} }
`;

// ── tiny icon set ────────────────────────────────────────────────────────────
function Ico({ n, size = 14, color = 'currentColor', sw = 1.7 }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (n) {
    case 'x':       return <svg {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
    case 'back':    return <svg {...p}><polyline points="15 18 9 12 15 6"/></svg>;
    case 'pin':     return <svg {...p}><path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>;
    case 'car':     return <svg {...p}><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v4h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>;
    case 'clock':   return <svg {...p}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
    case 'cal':     return <svg {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
    case 'tag':     return <svg {...p}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>;
    case 'card':    return <svg {...p}><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>;
    case 'cash':    return <svg {...p}><rect x="2" y="6" width="20" height="12" rx="1"/><circle cx="12" cy="12" r="3"/><path d="M2 10h2M20 10h2M2 14h2M20 14h2"/></svg>;
    case 'phone':   return <svg {...p}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12 19.79 19.79 0 0 1 1.05 3.4 2 2 0 0 1 3 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16z"/></svg>;
    case 'check':   return <svg {...p}><polyline points="20 6 9 17 4 12"/></svg>;
    case 'user':    return <svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
    case 'suv':     return <svg {...p}><rect x="1" y="5" width="16" height="12" rx="2"/><path d="M17 8h3l3 4v4h-6V8z"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/></svg>;
    case 'van':     return <svg {...p}><rect x="1" y="4" width="22" height="14" rx="2"/><circle cx="7" cy="20" r="2"/><circle cx="17" cy="20" r="2"/><path d="M1 14h22"/></svg>;
    default:        return null;
  }
}

// ── reusable atoms ───────────────────────────────────────────────────────────
function Btn({ label, onClick, variant = 'primary', disabled = false, style: sx = {} }) {
  const base = {
    width: '100%', padding: '9px 0', borderRadius: 10, cursor: disabled ? 'not-allowed' : 'pointer',
    border: 'none', fontFamily: COND, fontSize: 11.5, fontWeight: 800,
    letterSpacing: '.14em', textTransform: 'uppercase', transition: 'opacity .15s',
    opacity: disabled ? .4 : 1, ...sx,
  };
  const styles = {
    primary:  { background: 'linear-gradient(135deg,#22C55E,#16A34A)', color: '#fff',
                boxShadow: '0 4px 18px rgba(34,197,94,.3)', animation: 'brGlowPulse 2.8s ease-in-out infinite' },
    ghost:    { background: 'rgba(255,255,255,.04)', color: C.dim,
                border: '1px solid rgba(255,255,255,.09)' },
    outline:  { background: 'transparent', color: C.greenBright,
                border: `1px solid ${C.border}` },
  };
  return <button onClick={disabled ? undefined : onClick} style={{ ...base, ...styles[variant] }}>{label}</button>;
}


function AddressInput({ label, placeholder, value, onChange, onSubmit, autoFocus }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontFamily: COND, fontSize: 8.5, fontWeight: 800, letterSpacing: '.14em',
        color: C.greenBright, textTransform: 'uppercase' }}>{label}</div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: C.faint, border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 12px',
      }}>
        <Ico n="pin" size={13} color={C.greenSoft}/>
        <input
          autoFocus={autoFocus}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && value.trim() && onSubmit()}
          placeholder={placeholder}
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            fontFamily: MONO, fontSize: 10.5, color: '#fff',
            caretColor: C.greenBright,
          }}
        />
        {value.trim() && (
          <button onClick={onSubmit} style={{
            background: C.green, border: 'none', borderRadius: 7, padding: '3px 8px',
            cursor: 'pointer', fontFamily: COND, fontSize: 9, fontWeight: 800,
            letterSpacing: '.1em', color: '#fff',
          }}>OK</button>
        )}
      </div>
    </div>
  );
}

// ── ride types ───────────────────────────────────────────────────────────────
const RIDE_TYPES = [
  { id: 'economy',  label: 'Economy',  sub: '1–4 riders',  icon: 'car',  price: '$' },
  { id: 'comfort',  label: 'Comfort',  sub: '1–4 riders',  icon: 'car',  price: '$$' },
  { id: 'suv',      label: 'SUV',      sub: '1–6 riders',  icon: 'suv',  price: '$$$' },
  { id: 'xl',       label: 'XL Van',   sub: '1–8 riders',  icon: 'van',  price: '$$$$' },
];

// ── date / time helpers ──────────────────────────────────────────────────────
function buildDates() {
  const out = [];
  const now = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    out.push(d);
  }
  return out;
}
const DATES = buildDates();
const TIME_SLOTS = ['On time', '+15 min', '+30 min', '+1 hour'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── header ───────────────────────────────────────────────────────────────────
function CardHeader({ step, onBack, onReset, pickup, dropoff, rideType }) {
  const showBack  = step > 0;
  const showRoute = step >= 3 && pickup;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {showBack && (
          <button onClick={onBack} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: C.dim, padding: 0, display: 'flex', alignItems: 'center',
          }}>
            <Ico n="back" size={16} color={C.dim}/>
          </button>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: COND, fontSize: 10, fontWeight: 800, letterSpacing: '.16em',
            color: C.greenBright, textTransform: 'uppercase' }}>
            {step === 0 ? 'Book a Ride' :
             step === 1 ? 'Pickup Location' :
             step === 2 ? 'Drop-off Location' :
             step === 3 ? 'Choose Ride' :
             step === 4 ? 'When?' :
             step === 5 ? 'Pick a Date' :
             step === 6 ? 'Pick a Time' :
             step === 7 ? 'Discount Code' :
             step === 8 ? 'Payment' :
             step === 9 ? 'Card Details' :
             step === 10 ? 'Cash Ride' :
             step === 11 ? 'Ride Requested' : 'Book a Ride'}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 8, color: C.dim, marginTop: 1 }}>Orlando, FL</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.greenBright,
              boxShadow: `0 0 6px ${C.greenBright}`, animation: 'brBlink 1.6s ease-in-out infinite' }}/>
            <span style={{ fontFamily: MONO, fontSize: 7.5, fontWeight: 700, color: C.greenBright }}>LIVE</span>
          </div>
          {step > 0 && (
            <button onClick={onReset} style={{
              background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)',
              borderRadius: 7, width: 22, height: 22, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Ico n="x" size={11} color={C.dim}/>
            </button>
          )}
        </div>
      </div>

      {/* route summary pill */}
      {showRoute && (
        <div style={{
          background: C.faint, border: `1px solid ${C.borderDim}`, borderRadius: 8,
          padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 3,
          animation: 'brFadeIn .3s ease both',
        }}>
          {[
            { dot: C.greenBright, glow: true,  val: pickup },
            { dot: 'rgba(255,255,255,.4)', glow: false, val: dropoff || '—' },
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: r.dot, boxShadow: r.glow ? `0 0 5px ${C.greenBright}88` : 'none' }}/>
              <span style={{ fontFamily: MONO, fontSize: 8.5, color: 'rgba(255,255,255,.5)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>
                {r.val}
              </span>
            </div>
          ))}
          {rideType && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
              <Ico n="car" size={9} color={C.dim}/>
              <span style={{ fontFamily: COND, fontSize: 8, fontWeight: 700, letterSpacing: '.1em',
                color: C.dim, textTransform: 'uppercase' }}>{rideType}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
export default function BookRideCard({ onRequest, onBook, onBookingComplete, onActiveChange }) {
  const [step,       setStep]       = useState(0);
  const [pickup,     setPickup]     = useState('');
  const [dropoff,    setDropoff]    = useState('');
  const [pickupDraft,setPickupDraft]= useState('');
  const [dropoffDraft,setDropoffDraft]=useState('');
  const [rideType,   setRideType]   = useState(null);
  const [when,       setWhen]       = useState(null);   // 'now' | 'scheduled'
  const [selDate,    setSelDate]    = useState(null);
  const [selTime,    setSelTime]    = useState(null);
  const [discount,   setDiscount]   = useState('');
  const [discApplied,setDiscApplied]= useState(false);
  const [payment,    setPayment]    = useState(null);
  const [cardNum,    setCardNum]    = useState('');
  const [cardExp,    setCardExp]    = useState('');
  const [cardCvv,    setCardCvv]    = useState('');
  const [ridePayload,setRidePayload]= useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [countdown,  setCountdown]  = useState(5);
  const dateScrollRef = useRef(null);
  const countdownRef  = useRef(null);

  // ── build & submit payload ─────────────────────────────────────────────────
  const submitRide = (extraFields = {}) => {
    setSubmitting(true);
    const payload = {
      id:        `ride_${Date.now()}`,
      createdAt: new Date().toISOString(),
      pickup,
      dropoff,
      rideType,
      when,
      scheduledDate: selDate !== null ? DATES[selDate].toISOString() : null,
      scheduledTime: selTime !== null ? TIME_SLOTS[selTime] : null,
      discountCode:  discApplied ? discount : null,
      payment:       payment,
      status:        'pending',
      ...extraFields,
    };
    setRidePayload(payload);
    onRequest?.(payload);
    // small artificial delay for feel
    setTimeout(() => {
      setSubmitting(false);
      setStep(11);
      setCountdown(5);
    }, 900);
  };

  // ── countdown auto-reset on success screen ─────────────────────────────────
  useEffect(() => {
    if (step !== 11) return;
    countdownRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(countdownRef.current); reset(); onBookingComplete?.(); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, [step]); // eslint-disable-line

  const reset = () => {
    onActiveChange?.(false);
    setStep(0); setPickup(''); setDropoff(''); setPickupDraft(''); setDropoffDraft('');
    setRideType(null); setWhen(null); setSelDate(null); setSelTime(null);
    setDiscount(''); setDiscApplied(false); setPayment(null);
    setCardNum(''); setCardExp(''); setCardCvv('');
    setRidePayload(null); setSubmitting(false); setCountdown(5);
    clearInterval(countdownRef.current);
  };

  const back = () => {
    if (step === 9 || step === 10) { setStep(8); return; }
    if (step === 8) { setStep(7); return; }
    if (step === 7) { setStep(when === 'scheduled' ? 6 : 4); return; }
    if (step === 6) { setStep(5); return; }
    if (step === 5) { setStep(4); return; }
    if (step === 4) { setStep(3); return; }
    if (step === 3) { setStep(2); return; }
    if (step === 2) { setDropoff(''); setDropoffDraft(''); setStep(1); return; }
    if (step === 1) { setPickup(''); setPickupDraft(''); setStep(0); return; }
    setStep(s => Math.max(0, s - 1));
  };

  // ── step renderers ─────────────────────────────────────────────────────────

  // STEP 0 — landing
  const renderLanding = () => (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
      background: 'rgba(34,197,94,.05)', border: `1px solid ${C.borderDim}`,
      borderRadius: 14, padding: '12px 14px', animation: 'brSlideUp .3s ease both',
    }}>
      {/* icon + text */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          background: 'rgba(34,197,94,.1)', border: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 14px rgba(74,222,128,.15)',
        }}>
          <Ico n="car" size={19} color={C.greenBright}/>
        </div>
        <div>
          <div style={{ fontFamily: COND, fontSize: 18, fontWeight: 900, letterSpacing: '.05em', color: '#fff', lineHeight: 1.1 }}>
            Need a ride?
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.greenBright, boxShadow: `0 0 5px ${C.greenBright}`, animation: 'brBlink 1.6s ease-in-out infinite' }}/>
            <span style={{ fontFamily: MONO, fontSize: 8, color: C.dim }}>drivers nearby · flat-rate</span>
          </div>
        </div>
      </div>

      {/* request button */}
      <button
        onClick={() => { onActiveChange?.(true); setStep(1); }}
        style={{
          flexShrink: 0, background: 'linear-gradient(135deg,#22C55E,#16A34A)', color: '#fff',
          border: 'none', borderRadius: 10, padding: '9px 15px', cursor: 'pointer',
          fontFamily: COND, fontSize: 11, fontWeight: 800, letterSpacing: '.14em',
          textTransform: 'uppercase', boxShadow: '0 4px 18px rgba(34,197,94,.35)',
          animation: 'brGlowPulse 2.8s ease-in-out infinite',
        }}
      >
        Request
      </button>
    </div>
  );

  // STEP 1 — pickup
  const renderPickup = () => (
    <div style={{ animation: 'brSlideUp .3s ease both' }}>
      <AddressInput
        label="Pickup Address" placeholder="Enter pickup location"
        value={pickupDraft} onChange={setPickupDraft} autoFocus
        onSubmit={() => { setPickup(pickupDraft); setStep(2); }}
      />
    </div>
  );

  // STEP 2 — dropoff
  const renderDropoff = () => (
    <div style={{ animation: 'brSlideUp .3s ease both' }}>
      <AddressInput
        label="Drop-off Address" placeholder="Enter destination"
        value={dropoffDraft} onChange={setDropoffDraft} autoFocus
        onSubmit={() => { setDropoff(dropoffDraft); setStep(3); }}
      />
    </div>
  );

  // STEP 3 — ride type
  const renderRideType = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, animation: 'brSlideUp .3s ease both' }}>
      {RIDE_TYPES.map(rt => (
        <button key={rt.id} onClick={() => { setRideType(rt.label); setStep(4); }} style={{
          display: 'flex', alignItems: 'center', gap: 11, padding: '9px 12px', borderRadius: 10,
          background: rideType === rt.label ? 'rgba(34,197,94,.12)' : C.faint,
          border: `1px solid ${rideType === rt.label ? C.border : C.borderDim}`,
          cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9, flexShrink: 0,
            background: 'rgba(34,197,94,.08)', border: `1px solid ${C.borderDim}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Ico n={rt.icon} size={16} color={C.greenSoft}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: COND, fontSize: 11.5, fontWeight: 800, letterSpacing: '.08em', color: '#fff' }}>
              {rt.label}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 8.5, color: C.dim }}>{rt.sub}</div>
          </div>
          <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: C.greenBright }}>{rt.price}</span>
        </button>
      ))}
    </div>
  );

  // STEP 4 — when
  const renderWhen = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, animation: 'brSlideUp .3s ease both' }}>
      {[
        { id: 'now',       icon: 'clock', label: 'Leave Now',  sub: 'Pickup in ~5–15 min' },
        { id: 'scheduled', icon: 'cal',   label: 'Schedule',   sub: 'Pick a date & time' },
      ].map(w => (
        <button key={w.id} onClick={() => { setWhen(w.id); setStep(w.id === 'now' ? 7 : 5); }} style={{
          display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px', borderRadius: 10,
          background: C.faint, border: `1px solid ${C.borderDim}`,
          cursor: 'pointer', transition: 'all .15s',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: 'rgba(34,197,94,.08)', border: `1px solid ${C.borderDim}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Ico n={w.icon} size={17} color={C.greenSoft}/>
          </div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontFamily: COND, fontSize: 12, fontWeight: 800, letterSpacing: '.08em', color: '#fff' }}>
              {w.label}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 8.5, color: C.dim }}>{w.sub}</div>
          </div>
          <Ico n="back" size={14} color={C.dim} style={{ transform: 'rotate(180deg)' }}/>
        </button>
      ))}
    </div>
  );

  // STEP 5 — date picker (horizontal scroll)
  const renderDate = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, animation: 'brSlideUp .3s ease both' }}>
      <div style={{ fontFamily: MONO, fontSize: 8.5, color: C.dim, textAlign: 'center' }}>
        Swipe to select a date
      </div>
      <div ref={dateScrollRef} style={{
        display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 4,
        scrollbarWidth: 'none', msOverflowStyle: 'none',
      }}>
        <style>{`.ua-scroll::-webkit-scrollbar{display:none}`}</style>
        {DATES.map((d, i) => {
          const sel = selDate === i;
          return (
            <button key={i} onClick={() => setSelDate(i)} style={{
              flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 3, padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
              background: sel ? 'rgba(34,197,94,.18)' : C.faint,
              border: `1px solid ${sel ? C.green : C.borderDim}`,
              transition: 'all .15s', minWidth: 48,
            }}>
              <span style={{ fontFamily: COND, fontSize: 8, fontWeight: 700, letterSpacing: '.1em',
                color: sel ? C.greenBright : C.dim, textTransform: 'uppercase' }}>{DAYS[d.getDay()]}</span>
              <span style={{ fontFamily: COND, fontSize: 17, fontWeight: 900, color: sel ? '#fff' : 'rgba(255,255,255,.55)',
                lineHeight: 1 }}>{d.getDate()}</span>
              <span style={{ fontFamily: MONO, fontSize: 7.5, color: sel ? C.greenSoft : C.fade }}>{MONTHS[d.getMonth()]}</span>
            </button>
          );
        })}
      </div>
      <Btn label="Confirm Date" onClick={() => setStep(6)} disabled={selDate === null}/>
    </div>
  );

  // STEP 6 — time picker
  const renderTime = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, animation: 'brSlideUp .3s ease both' }}>
      <div style={{ fontFamily: MONO, fontSize: 8.5, color: C.dim, textAlign: 'center' }}>
        {selDate !== null
          ? `${DAYS[DATES[selDate].getDay()]} ${MONTHS[DATES[selDate].getMonth()]} ${DATES[selDate].getDate()}`
          : ''}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
        {TIME_SLOTS.map((t, i) => {
          const sel = selTime === i;
          return (
            <button key={i} onClick={() => setSelTime(i)} style={{
              padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
              background: sel ? 'rgba(34,197,94,.18)' : C.faint,
              border: `1px solid ${sel ? C.green : C.borderDim}`,
              transition: 'all .15s',
            }}>
              <div style={{ fontFamily: COND, fontSize: 12, fontWeight: 800, color: sel ? '#fff' : 'rgba(255,255,255,.6)',
                letterSpacing: '.06em' }}>{t}</div>
            </button>
          );
        })}
      </div>
      <Btn label="Confirm Time" onClick={() => setStep(7)} disabled={selTime === null}/>
    </div>
  );

  // STEP 7 — discount
  const renderDiscount = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, animation: 'brSlideUp .3s ease both' }}>
      <div style={{ fontFamily: MONO, fontSize: 8.5, color: C.dim, textAlign: 'center' }}>
        Have a promo code? Enter it below.
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: C.faint, border: `1px solid ${discApplied ? C.green : C.border}`, borderRadius: 10, padding: '9px 12px',
      }}>
        <Ico n="tag" size={13} color={discApplied ? C.greenBright : C.dim}/>
        <input
          autoFocus
          value={discount}
          onChange={e => { setDiscount(e.target.value.toUpperCase()); setDiscApplied(false); }}
          placeholder="PROMO CODE"
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            fontFamily: MONO, fontSize: 11, color: discApplied ? C.greenBright : '#fff',
            letterSpacing: '.12em', caretColor: C.greenBright,
          }}
        />
        {discount.length > 0 && !discApplied && (
          <button onClick={() => setDiscApplied(true)} style={{
            background: C.green, border: 'none', borderRadius: 7, padding: '3px 9px',
            cursor: 'pointer', fontFamily: COND, fontSize: 9, fontWeight: 800,
            letterSpacing: '.1em', color: '#fff',
          }}>APPLY</button>
        )}
        {discApplied && <Ico n="check" size={13} color={C.greenBright}/>}
      </div>
      {discApplied && (
        <div style={{ fontFamily: MONO, fontSize: 8.5, color: C.greenBright, textAlign: 'center',
          animation: 'brFadeIn .3s ease both' }}>
          ✓ Code applied
        </div>
      )}
      <Btn label="Continue" onClick={() => setStep(8)}/>
      <Btn label="Skip" variant="ghost" onClick={() => setStep(8)}/>
    </div>
  );

  // STEP 8 — payment choice
  const renderPayment = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, animation: 'brSlideUp .3s ease both' }}>
      {[
        { id: 'card',     icon: 'card',  label: 'Credit / Debit Card', sub: 'Visa, Mastercard, Amex' },
        { id: 'cashapp',  icon: 'phone', label: 'Cash App',             sub: '$Cashtag instant pay'   },
        { id: 'cash',     icon: 'cash',  label: 'Cash',                 sub: 'Pay driver directly'    },
      ].map(pm => (
        <button key={pm.id} onClick={() => {
          setPayment(pm.id);
          if (pm.id === 'card')    { setStep(9); return; }
          if (pm.id === 'cashapp') { window.open('https://cash.app', '_blank'); return; }
          if (pm.id === 'cash')    { setStep(10); return; }
        }} style={{
          display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 10,
          background: C.faint, border: `1px solid ${C.borderDim}`,
          cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9, flexShrink: 0,
            background: 'rgba(34,197,94,.08)', border: `1px solid ${C.borderDim}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Ico n={pm.icon} size={16} color={C.greenSoft}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: COND, fontSize: 11, fontWeight: 800, letterSpacing: '.06em', color: '#fff' }}>
              {pm.label}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 8, color: C.dim }}>{pm.sub}</div>
          </div>
          <Ico n="back" size={13} color={C.fade}/>
        </button>
      ))}
    </div>
  );

  // STEP 9 — card input
  const renderCard = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9, animation: 'brSlideUp .3s ease both' }}>
      {[
        { label: 'Card Number', val: cardNum, set: setCardNum, ph: '1234 5678 9012 3456', maxLen: 19,
          fmt: v => v.replace(/\D/g,'').replace(/(.{4})/g,'$1 ').trim().slice(0,19) },
        { label: 'Expiry', val: cardExp, set: setCardExp, ph: 'MM / YY', maxLen: 7,
          fmt: v => { const d = v.replace(/\D/g,''); return d.length > 2 ? `${d.slice(0,2)} / ${d.slice(2,4)}` : d; } },
        { label: 'CVV', val: cardCvv, set: setCardCvv, ph: '•••', maxLen: 4,
          fmt: v => v.replace(/\D/g,'').slice(0,4) },
      ].map((f, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontFamily: COND, fontSize: 8.5, fontWeight: 800, letterSpacing: '.12em',
            color: C.dim, textTransform: 'uppercase' }}>{f.label}</div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: C.faint, border: `1px solid ${C.border}`, borderRadius: 9, padding: '8px 11px',
          }}>
            <input
              autoFocus={i === 0}
              value={f.val}
              maxLength={f.maxLen}
              onChange={e => f.set(f.fmt(e.target.value))}
              placeholder={f.ph}
              inputMode="numeric"
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                fontFamily: MONO, fontSize: 11, color: '#fff',
                caretColor: C.greenBright, letterSpacing: '.06em',
              }}
            />
          </div>
        </div>
      ))}
      <Btn
        label={submitting ? "Requesting…" : "Request Ride"}
        onClick={() => submitRide({ cardNum, cardExp })}
        disabled={submitting || cardNum.length < 19 || cardExp.length < 7 || cardCvv.length < 3}
      />
      <Btn label="Back" variant="ghost" onClick={() => setStep(8)}/>
    </div>
  );

  // STEP 10 — cash confirm
  const renderCash = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, animation: 'brSlideUp .3s ease both' }}>
      <div style={{
        background: 'rgba(34,197,94,.07)', border: `1px solid ${C.border}`, borderRadius: 12,
        padding: '16px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14, background: 'rgba(34,197,94,.14)',
          border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Ico n="cash" size={22} color={C.greenBright}/>
        </div>
        <div style={{ fontFamily: COND, fontSize: 13, fontWeight: 800, letterSpacing: '.06em', color: '#fff' }}>
          Pay Driver in Cash
        </div>
        <div style={{ fontFamily: MONO, fontSize: 9, color: C.dim, textAlign: 'center', lineHeight: 1.6 }}>
          Please have the exact fare ready.<br/>Your driver will confirm the amount.
        </div>
      </div>
      <Btn label={submitting ? "Requesting…" : "Request Ride"} disabled={submitting} onClick={() => submitRide({ payment: 'cash' })}/>
      <Btn label="Back" variant="ghost" onClick={() => setStep(8)}/>
    </div>
  );

  // STEP 11 — success
  const renderSuccess = () => {
    const p = ridePayload;
    const pmLabels = { card: 'Card', cash: 'Cash', cashapp: 'Cash App' };
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, animation: 'brSuccessIn .5s cubic-bezier(.34,1.2,.64,1) both' }}>

        {/* animated check */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 2px', position: 'relative' }}>
          {[1,2].map(i => (
            <div key={i} style={{
              position: 'absolute', top: '50%', left: '50%',
              width: 72, height: 72, borderRadius: '50%', marginLeft: -36, marginTop: -36,
              border: `1.5px solid ${C.green}`,
              animation: `brRingOut ${1 + i * 0.4}s ease-out ${i * 0.25}s both`,
            }}/>
          ))}
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(34,197,94,.14)', border: `2px solid ${C.green}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'brCheckPop .55s cubic-bezier(.34,1.4,.64,1) .1s both',
            boxShadow: `0 0 28px rgba(74,222,128,.35)`,
            position: 'relative', zIndex: 1,
          }}>
            <Ico n="check" size={28} color={C.greenBright} sw={2.5}/>
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontFamily: COND, fontSize: 18, fontWeight: 900, letterSpacing: '.06em', color: '#fff' }}>
            Ride Requested!
          </div>
          <div style={{ fontFamily: MONO, fontSize: 8.5, color: C.dim, marginTop: 4 }}>
            Looking for your driver…
          </div>
        </div>

        {/* payload summary */}
        {p && (
          <div style={{
            background: C.faint, border: `1px solid ${C.borderDim}`, borderRadius: 11,
            padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7,
            animation: 'brFadeIn .4s ease .25s both',
          }}>
            {[
              { label: 'FROM',    val: p.pickup },
              { label: 'TO',      val: p.dropoff },
              { label: 'RIDE',    val: p.rideType },
              { label: 'WHEN',    val: p.when === 'now' ? 'Leave Now' : `Scheduled · ${p.scheduledTime || ''}` },
              { label: 'PAY',     val: pmLabels[p.payment] || p.payment },
              ...(p.discountCode ? [{ label: 'PROMO', val: p.discountCode }] : []),
              { label: 'REF',     val: p.id?.slice(-10).toUpperCase() },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ fontFamily: COND, fontSize: 7.5, fontWeight: 800, letterSpacing: '.12em',
                  color: C.dim, textTransform: 'uppercase', minWidth: 38, paddingTop: 1 }}>{r.label}</span>
                <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,.7)',
                  flex: 1, wordBreak: 'break-all', lineHeight: 1.4 }}>{r.val}</span>
              </div>
            ))}
          </div>
        )}

        {/* countdown */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <div style={{ fontFamily: MONO, fontSize: 8.5, color: C.dim }}>
            Returning in
          </div>
          <div style={{
            fontFamily: MONO, fontSize: 11, fontWeight: 800, color: C.greenBright,
            minWidth: 18, textAlign: 'center',
          }}>{countdown}</div>
          <div style={{ fontFamily: MONO, fontSize: 8.5, color: C.dim }}>s</div>
        </div>

        <Btn label="Book Another Ride" onClick={() => { reset(); onBookingComplete?.(); }}/>
      </div>
    );
  };

  // submitting overlay
  const renderSubmitting = () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 14, padding: '24px 0', animation: 'brFadeIn .2s ease both' }}>
      <div style={{
        width: 38, height: 38, borderRadius: '50%',
        border: `2px solid rgba(34,197,94,.15)`, borderTop: `2px solid ${C.green}`,
        animation: 'brSpin .8s linear infinite',
      }}/>
      <span style={{ fontFamily: MONO, fontSize: 10, color: C.dim, letterSpacing: '.06em' }}>
        sending request…
      </span>
    </div>
  );

  // ── render ─────────────────────────────────────────────────────────────────
  const body = () => {
    if (submitting) return renderSubmitting();
    switch (step) {
      case 0:  return renderLanding();
      case 1:  return renderPickup();
      case 2:  return renderDropoff();
      case 3:  return renderRideType();
      case 4:  return renderWhen();
      case 5:  return renderDate();
      case 6:  return renderTime();
      case 7:  return renderDiscount();
      case 8:  return renderPayment();
      case 9:  return renderCard();
      case 10: return renderCash();
      case 11: return renderSuccess();
      default: return null;
    }
  };

  return (
    <>
      <style>{KF}</style>
      <div style={{
        background: 'rgba(5,10,6,.82)', backdropFilter: 'blur(14px)',
        border: `1px solid ${C.border}`, borderRadius: 16,
        padding: '12px 12px 14px', display: 'flex', flexDirection: 'column', gap: 10,
        boxShadow: '0 8px 40px rgba(0,0,0,.55), 0 0 0 1px rgba(34,197,94,.06)',
        userSelect: 'none',
      }}>
        <CardHeader step={step} onBack={back} onReset={reset} pickup={pickup} dropoff={dropoff} rideType={rideType}/>
        <div style={{ height: 1, background: C.borderDim }}/>
        {body()}
      </div>
    </>
  );
}
