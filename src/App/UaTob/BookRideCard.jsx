// BookRideCard.jsx
// Steps: 0=landing, 1=pickup, 2=dropoff, 3=ride-type, 4=when,
//        5=date, 6=time, 7=discount, 8=payment, 9=card, 10=cash, 11=success
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

import { useAutocomplete } from '@/App/UaTob/useAutocomplete';
import { useRoute }        from '@/App/UaTob/useRoute';
import { useQuotes }       from '@/App/UaTob/useQuotes';
import { useGeo }          from '@/App/UaTob/useGeo';
import { usePromo }        from '@/App/UaTob/usePromo';
import { useCardPayment }  from '@/App/UaTob/useCardPayment';
import { useCashAppPayment } from '@/App/UaTob/useCashAppPayment';
import { useCashPayment }    from '@/App/UaTob/useCashPayment';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

// ── design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:          '#050A06',
  bgDeep:      '#030604',
  bgCard:      'rgba(255,255,255,.035)',
  bgElevated:  'rgba(255,255,255,.055)',
  border:      'rgba(34,197,94,.20)',
  borderDim:   'rgba(34,197,94,.09)',
  borderFaint: 'rgba(255,255,255,.07)',
  green:       '#22C55E',
  greenBright: '#4ADE80',
  greenSoft:   '#34D399',
  greenDim:    'rgba(34,197,94,.08)',
  greenGlow:   'rgba(34,197,94,.22)',
  white:       '#fff',
  dim:         'rgba(255,255,255,.32)',
  fade:        'rgba(255,255,255,.14)',
  faint:       'rgba(255,255,255,.06)',
  amber:       '#F59E0B',
  amberDim:    'rgba(245,158,11,.09)',
  amberBorder: 'rgba(245,158,11,.30)',
  red:         '#F87171',
  redDim:      'rgba(248,113,113,.09)',
  cashApp:     '#00D632',
  indigo:      '#818CF8',
};
const MONO = "'JetBrains Mono','SFMono-Regular',monospace";
const COND = "'Barlow Condensed','Barlow',sans-serif";
const SANS = "'Inter','Helvetica Neue',sans-serif";

// ── keyframes ────────────────────────────────────────────────────────────────
const KF = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');

  @keyframes brSlideUp   { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes brFadeIn    { from{opacity:0} to{opacity:1} }
  @keyframes brBlink     { 0%,100%{opacity:1} 50%{opacity:.22} }
  @keyframes brGlowPulse { 0%,100%{box-shadow:0 0 18px rgba(74,222,128,.22)} 50%{box-shadow:0 0 32px rgba(74,222,128,.48)} }
  @keyframes brSpin      { to{transform:rotate(360deg)} }
  @keyframes brCheckPop  { 0%{opacity:0;transform:scale(.4)} 60%{transform:scale(1.18)} 80%{transform:scale(.93)} 100%{opacity:1;transform:scale(1)} }
  @keyframes brRingOut   { 0%{transform:scale(.6);opacity:.8} 100%{transform:scale(2.2);opacity:0} }
  @keyframes brSuccessIn { from{opacity:0;transform:translateY(16px) scale(.96)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes brPulse     { 0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,.35)} 50%{box-shadow:0 0 0 7px rgba(34,197,94,0)} }
  @keyframes brDotPop    { 0%{transform:scale(0)} 70%{transform:scale(1.25)} 100%{transform:scale(1)} }

  .br-dropdown {
    position:absolute; top:calc(100% + 5px); left:0; right:0; z-index:300;
    background:#0D1A0F; border:1px solid rgba(34,197,94,.22); border-radius:11px;
    overflow:hidden; box-shadow:0 12px 36px rgba(0,0,0,.6);
  }
  .br-sug {
    display:flex; align-items:flex-start; gap:9px; padding:10px 12px;
    cursor:pointer; border-bottom:1px solid rgba(255,255,255,.04);
    transition:background .12s;
  }
  .br-sug:last-child { border-bottom:none; }
  .br-sug:hover, .br-sug.active { background:rgba(34,197,94,.09); }
  .br-sug-main { font-family:${COND}; font-size:11px; font-weight:700; color:#fff; }
  .br-sug-sub  { font-family:${MONO}; font-size:8.5px; color:rgba(255,255,255,.35); margin-top:1px; }

  .br-stripe-el .StripeElement { padding:0; }

  .br-ride-row { transition:background .14s,border-color .14s; }
  .br-ride-row:hover { background:rgba(34,197,94,.09) !important; }

  .br-pm-row { transition:background .14s,border-color .14s; }
  .br-pm-row:hover { background:rgba(34,197,94,.09) !important; }

  .br-cal-day { transition:background .12s,color .12s; border-radius:7px; cursor:pointer; }
  .br-cal-day:hover:not(.dis):not(.sel) { background:rgba(129,140,248,.14); }

  .br-hour { transition:background .12s; border-radius:8px; cursor:pointer; }
  .br-hour:hover:not(.dis-h):not(.sel-h) { background:rgba(255,255,255,.07); }

  .br-min-btn { transition:all .12s; }
  .br-min-btn:hover:not(:disabled) { border-color:rgba(129,140,248,.6) !important; }
`;

// ── tiny svg icons ────────────────────────────────────────────────────────────
function Ico({ n, size = 14, color = 'currentColor', sw = 1.7 }) {
  const p = { width:size, height:size, viewBox:'0 0 24 24', fill:'none',
    stroke:color, strokeWidth:sw, strokeLinecap:'round', strokeLinejoin:'round' };
  switch (n) {
    case 'x':      return <svg {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
    case 'back':   return <svg {...p}><polyline points="15 18 9 12 15 6"/></svg>;
    case 'fwd':    return <svg {...p}><polyline points="9 18 15 12 9 6"/></svg>;
    case 'pin':    return <svg {...p}><path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>;
    case 'car':    return <svg {...p}><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v4h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>;
    case 'suv':    return <svg {...p}><rect x="1" y="5" width="16" height="12" rx="2"/><path d="M17 8h3l3 4v4h-6V8z"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/></svg>;
    case 'van':    return <svg {...p}><rect x="1" y="4" width="22" height="14" rx="2"/><circle cx="7" cy="20" r="2"/><circle cx="17" cy="20" r="2"/><path d="M1 14h22"/></svg>;
    case 'zap':    return <svg {...p}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
    case 'clock':  return <svg {...p}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
    case 'cal':    return <svg {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
    case 'tag':    return <svg {...p}><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>;
    case 'card':   return <svg {...p}><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>;
    case 'cash':   return <svg {...p}><rect x="2" y="6" width="20" height="12" rx="1"/><circle cx="12" cy="12" r="3"/><path d="M2 10h2M20 10h2M2 14h2M20 14h2"/></svg>;
    case 'phone':  return <svg {...p}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12 19.79 19.79 0 0 1 1.05 3.4 2 2 0 0 1 3 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16z"/></svg>;
    case 'check':  return <svg {...p}><polyline points="20 6 9 17 4 12"/></svg>;
    case 'user':   return <svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
    case 'locate': return <svg {...p}><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="9" strokeDasharray="2 3"/></svg>;
    case 'warn':   return <svg {...p}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
    case 'shield': return <svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
    case 'lock':   return <svg {...p}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
    case 'spark':  return <svg {...p}><path d="M12 3l1.5 4.5H18l-3.75 2.75 1.5 4.5L12 12l-3.75 2.75 1.5-4.5L6 7.5h4.5L12 3z"/></svg>;
    case 'trend':  return <svg {...p}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>;
    default:       return null;
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────
const pad   = n  => String(n).padStart(2, '0');
const money = n  => Number(n || 0).toFixed(2);
const DAYS_SHORT  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS_SHORT= ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_FULL = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];
const DAYS_MINI   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function getRideIcon(id) {
  if (id === 'premium') return 'zap';
  if (id === 'xl')      return 'van';
  if (id === 'suv')     return 'suv';
  return 'car';
}

// build payload from all gathered data
function buildPayload({ pickup, dropoff, tripData, quotesData, rideId, selectedQuote, scheduledAt, promoDiscount }) {
  return {
    pickup:            pickup,
    dropoff:           dropoff,
    pickupCity:        tripData?.pickupCity   || '',
    pickupZip:         tripData?.pickupZip    || '',
    pickupLat:         tripData?.pickupLat    ?? null,
    pickupLng:         tripData?.pickupLng    ?? null,
    dropoffCity:       tripData?.dropoffCity  || '',
    dropoffZip:        tripData?.dropoffZip   || '',
    dropoffLat:        tripData?.dropoffLat   ?? null,
    dropoffLng:        tripData?.dropoffLng   ?? null,
    miles:             tripData?.miles,
    durationMin:       tripData?.durationMin,
    durationText:      tripData?.durationText,
    tripDistanceMiles: tripData?.miles,
    tripDurationMin:   tripData?.durationMin,
    rideType:          rideId,
    rideLabel:         selectedQuote?.label   || rideId,
    fareEstimate:      selectedQuote?.total,
    breakdown:         selectedQuote?.breakdown || {},
    receipt:           selectedQuote?.receipt   || [],
    allQuotes:         quotesData?.rides        || {},
    driverInfo:        quotesData?.driverInfo   ?? null,
    polyline:          tripData?.polyline       || null,
    scheduledAt:       scheduledAt             || null,
    isScheduled:       !!scheduledAt,
    promoCode:         promoDiscount?.code      || null,
    discountAmount:    promoDiscount?.savings   || null,
    status:            'searching_driver',
    createdAt:         new Date().toISOString(),
  };
}

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner({ size = 20, color = C.green }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `2px solid rgba(34,197,94,.12)`,
      borderTop: `2px solid ${color}`,
      animation: 'brSpin .75s linear infinite', flexShrink: 0,
    }}/>
  );
}

// ── PrimaryBtn ────────────────────────────────────────────────────────────────
function PrimaryBtn({ children, onClick, disabled, loading, style: sx = {} }) {
  return (
    <button
      type="button"
      onClick={disabled || loading ? undefined : onClick}
      style={{
        width: '100%', padding: '11px 0', borderRadius: 11, border: 'none',
        background: disabled || loading
          ? 'rgba(255,255,255,.06)'
          : 'linear-gradient(135deg,#22C55E,#16A34A)',
        color: disabled || loading ? C.fade : '#fff',
        fontFamily: COND, fontSize: 12, fontWeight: 800, letterSpacing: '.14em',
        textTransform: 'uppercase', cursor: disabled || loading ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        boxShadow: disabled || loading ? 'none' : '0 4px 18px rgba(34,197,94,.3)',
        animation: disabled || loading ? 'none' : 'brGlowPulse 2.8s ease-in-out infinite',
        transition: 'background .15s, color .15s',
        ...sx,
      }}
    >
      {loading ? <><Spinner size={14}/> Processing…</> : children}
    </button>
  );
}

function GhostBtn({ children, onClick, style: sx = {} }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%', padding: '9px 0', borderRadius: 10, border: '1px solid rgba(255,255,255,.09)',
        background: 'rgba(255,255,255,.04)', color: C.dim,
        fontFamily: COND, fontSize: 11, fontWeight: 700, letterSpacing: '.12em',
        textTransform: 'uppercase', cursor: 'pointer', transition: 'background .12s',
        ...sx,
      }}
    >
      {children}
    </button>
  );
}

// ── PlaceInput with autocomplete + ghost text ─────────────────────────────────
function PlaceInput({ label, placeholder, value, onChange, onLocationRequest, autoFocus }) {
  const { predictions, fetch: fetchSug, clear: clearSug } = useAutocomplete(250);
  const [ghost,       setGhost]       = useState('');
  const [activeIdx,   setActiveIdx]   = useState(-1);
  const [focused,     setFocused]     = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const h = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) { clearSug(); setGhost(''); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [clearSug]);

  useEffect(() => {
    const first = predictions[0]?.description || '';
    setGhost(
      first.toLowerCase().startsWith(value.toLowerCase()) && value.length > 1
        ? first.slice(value.length) : ''
    );
  }, [predictions, value]);

  const handleChange = e => {
    const v = e.target.value;
    onChange(v);
    setActiveIdx(-1);
    fetchSug(v);
  };

  const handleSelect = desc => {
    onChange(desc); clearSug(); setGhost(''); setActiveIdx(-1);
  };

  const handleKey = e => {
    if ((e.key === 'Tab' || e.key === 'ArrowRight') && ghost && activeIdx === -1) {
      e.preventDefault(); handleSelect(value + ghost); return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, predictions.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)); }
    if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); handleSelect(predictions[activeIdx].description); }
    if (e.key === 'Escape') { clearSug(); setGhost(''); }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
      <div style={{ fontFamily:COND, fontSize:8.5, fontWeight:800, letterSpacing:'.14em',
        color:C.greenBright, textTransform:'uppercase' }}>{label}</div>
      <div ref={wrapRef} style={{ position:'relative' }}>
        {/* input row */}
        <div style={{
          display:'flex', alignItems:'center', gap:8,
          background: focused ? 'rgba(34,197,94,.07)' : C.faint,
          border: `1px solid ${focused ? C.border : C.borderDim}`,
          borderRadius:10, padding:'9px 12px',
          transition:'background .15s,border-color .15s',
        }}>
          <Ico n="pin" size={13} color={focused ? C.greenBright : C.dim}/>

          {/* ghost text overlay */}
          {ghost && focused && (
            <div style={{
              position:'absolute', left:'calc(12px + 13px + 8px)', top:0, bottom:0,
              display:'flex', alignItems:'center', pointerEvents:'none', zIndex:0,
              fontFamily:MONO, fontSize:10.5, color:'rgba(255,255,255,.22)',
              whiteSpace:'nowrap', overflow:'hidden',
            }}>
              <span style={{ color:'transparent' }}>{value}</span>
              <span>{ghost}</span>
            </div>
          )}

          <input
            autoFocus={autoFocus}
            value={value}
            onChange={handleChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={handleKey}
            placeholder={placeholder}
            autoComplete="off"
            style={{
              flex:1, background:'none', border:'none', outline:'none',
              fontFamily:MONO, fontSize:10.5, color:'#fff',
              caretColor:C.greenBright, position:'relative', zIndex:1,
            }}
          />

          {onLocationRequest && !value && (
            <button type="button" onClick={onLocationRequest} style={{
              background:'none', border:'none', cursor:'pointer', padding:0,
              color:C.dim, display:'flex', alignItems:'center',
              transition:'color .12s',
            }}
              onMouseEnter={e => e.currentTarget.style.color = C.greenBright}
              onMouseLeave={e => e.currentTarget.style.color = C.dim}
            >
              <Ico n="locate" size={14}/>
            </button>
          )}

          {value && (
            <button type="button" onClick={() => { onChange(''); clearSug(); setGhost(''); }} style={{
              background:'rgba(255,255,255,.08)', border:'none', borderRadius:'50%',
              width:18, height:18, cursor:'pointer', padding:0,
              display:'flex', alignItems:'center', justifyContent:'center', color:C.dim, flexShrink:0,
            }}>
              <Ico n="x" size={10}/>
            </button>
          )}
        </div>

        {/* dropdown */}
        {predictions.length > 0 && focused && (
          <div className="br-dropdown">
            {predictions.map((s, i) => {
              const main = s.structured_formatting?.main_text || s.description;
              const sub  = s.structured_formatting?.secondary_text || '';
              return (
                <div
                  key={s.place_id}
                  className={`br-sug${i === activeIdx ? ' active' : ''}`}
                  onMouseDown={() => handleSelect(s.description)}
                  onMouseEnter={() => setActiveIdx(i)}
                >
                  <Ico n="pin" size={11} color={C.dim} style={{ marginTop:2, flexShrink:0 }}/>
                  <div>
                    <div className="br-sug-main">{main}</div>
                    {sub && <div className="br-sug-sub">{sub}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────
function CardHeader({ step, onBack, onReset, pickup, dropoff, rideLabel }) {
  const showBack  = step > 0 && step < 11;
  const showRoute = step >= 3 && pickup;

  const TITLES = [
    'Book a Ride','Pickup Location','Drop-off Location','Choose Ride',
    'When?','Pick a Date','Pick a Time','Discount Code',
    'Payment','Card Details','Cash Ride','Ride Requested',
  ];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        {showBack && (
          <button onClick={onBack} style={{
            background:'none', border:'none', cursor:'pointer',
            color:C.dim, padding:0, display:'flex', alignItems:'center', flexShrink:0,
          }}>
            <Ico n="back" size={17} color={C.dim}/>
          </button>
        )}

        <div style={{ flex:1 }}>
          <div style={{ fontFamily:COND, fontSize:10.5, fontWeight:800, letterSpacing:'.16em',
            color:C.greenBright, textTransform:'uppercase', lineHeight:1 }}>
            {TITLES[step] || 'Book a Ride'}
          </div>
          <div style={{ fontFamily:MONO, fontSize:8, color:C.fade, marginTop:2 }}>
            Orlando, FL · flat-rate · no surge
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            <div style={{ width:5, height:5, borderRadius:'50%', background:C.greenBright,
              boxShadow:`0 0 6px ${C.greenBright}`, animation:'brBlink 1.6s ease-in-out infinite' }}/>
            <span style={{ fontFamily:MONO, fontSize:7.5, fontWeight:700, color:C.greenBright }}>LIVE</span>
          </div>
          {step > 0 && step < 11 && (
            <button onClick={onReset} style={{
              background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)',
              borderRadius:7, width:22, height:22, cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <Ico n="x" size={10} color={C.dim}/>
            </button>
          )}
        </div>
      </div>

      {showRoute && (
        <div style={{
          background:C.faint, border:`1px solid ${C.borderDim}`, borderRadius:9,
          padding:'7px 11px', display:'flex', flexDirection:'column', gap:4,
          animation:'brFadeIn .3s ease both',
        }}>
          {[
            { dot:C.greenBright, glow:true,  val:pickup },
            { dot:'rgba(255,255,255,.35)', glow:false, val:dropoff || '—' },
          ].map((r, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:7 }}>
              <div style={{ width:6, height:6, borderRadius:'50%', flexShrink:0,
                background:r.dot, boxShadow:r.glow ? `0 0 5px ${C.greenBright}88` : 'none' }}/>
              <span style={{ fontFamily:MONO, fontSize:8.5, color:'rgba(255,255,255,.45)',
                whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:230 }}>
                {r.val}
              </span>
            </div>
          ))}
          {rideLabel && (
            <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:1 }}>
              <Ico n="car" size={9} color={C.fade}/>
              <span style={{ fontFamily:COND, fontSize:8, fontWeight:700, letterSpacing:'.1em',
                color:C.fade, textTransform:'uppercase' }}>{rideLabel}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── DriverBanner ──────────────────────────────────────────────────────────────
function DriverBanner({ driverInfo }) {
  if (!driverInfo) {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 11px',
        background:C.amberDim, border:`1px solid ${C.amberBorder}`, borderRadius:9 }}>
        <Ico n="warn" size={12} color={C.amber}/>
        <span style={{ fontFamily:MONO, fontSize:8.5, color:C.amber, fontWeight:500 }}>
          Drivers limited · we'll keep searching
        </span>
      </div>
    );
  }
  const stale = driverInfo.stale;
  const count = driverInfo.driverCount ?? 1;
  const miles = driverInfo.nearestMiles;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 11px',
      background:C.greenDim, border:`1px solid ${C.borderDim}`, borderRadius:9 }}>
      <div style={{ width:6, height:6, borderRadius:'50%', flexShrink:0,
        background: stale ? 'rgba(255,255,255,.3)' : C.greenBright,
        animation: stale ? 'none' : 'brBlink 1.6s ease-in-out infinite' }}/>
      <span style={{ fontFamily:MONO, fontSize:8.5, color: stale ? C.dim : C.greenBright, flex:1 }}>
        {stale
          ? `${count} driver nearby · estimated location`
          : `${count} driver${count !== 1 ? 's' : ''} nearby`}
      </span>
      {miles != null && (
        <span style={{ fontFamily:MONO, fontSize:8, color:C.dim }}>{miles} mi</span>
      )}
    </div>
  );
}

// ── Calendar sub-component ────────────────────────────────────────────────────
function CalendarPicker({ selYear, selMonth, selDay, onDayClick, onPrevMonth, onNextMonth }) {
  const today = useMemo(() => new Date(), []);
  const maxDate = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + 7); return d; }, []);
  const daysInMonth = new Date(selYear, selMonth + 1, 0).getDate();
  const firstDow    = new Date(selYear, selMonth, 1).getDay();

  const isDisabled = (y, m, d) => {
    const dt = new Date(y, m, d);
    dt.setHours(0,0,0,0);
    const t  = new Date(); t.setHours(0,0,0,0);
    const mx = new Date(maxDate); mx.setHours(0,0,0,0);
    return dt < t || dt > mx;
  };
  const isSelected = (y, m, d) => selDay?.y === y && selDay?.m === m && selDay?.d === d;
  const isToday    = (y, m, d) => today.getFullYear() === y && today.getMonth() === m && today.getDate() === d;

  return (
    <div style={{ border:`1px solid rgba(129,140,248,.28)`, borderRadius:13,
      background:'#0A1A0C', overflow:'hidden' }}>
      {/* month nav */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'9px 13px 8px', borderBottom:`1px solid ${C.borderFaint}` }}>
        <button type="button" onClick={onPrevMonth} style={{ background:'none', border:'none', cursor:'pointer', color:C.dim, padding:4, borderRadius:7, display:'flex' }}>
          <Ico n="back" size={13} color={C.dim}/>
        </button>
        <span style={{ fontFamily:COND, fontSize:12, fontWeight:800, letterSpacing:'.06em', color:'#fff' }}>
          {MONTHS_FULL[selMonth]} {selYear}
        </span>
        <button type="button" onClick={onNextMonth} style={{ background:'none', border:'none', cursor:'pointer', color:C.dim, padding:4, borderRadius:7, display:'flex' }}>
          <Ico n="fwd" size={13} color={C.dim}/>
        </button>
      </div>

      <div style={{ padding:'10px 11px 12px' }}>
        {/* day-of-week headers */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:4 }}>
          {DAYS_MINI.map(d => (
            <div key={d} style={{ textAlign:'center', fontSize:9, fontWeight:700,
              color:C.fade, fontFamily:MONO, padding:'2px 0' }}>{d}</div>
          ))}
        </div>
        {/* day cells */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
          {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`}/>)}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => {
            const dis = isDisabled(selYear, selMonth, d);
            const sel = isSelected(selYear, selMonth, d);
            const tod = isToday(selYear, selMonth, d);
            return (
              <div
                key={d}
                className={`br-cal-day${dis ? ' dis' : ''}${sel ? ' sel' : ''}`}
                onClick={() => !dis && onDayClick(selYear, selMonth, d)}
                style={{
                  textAlign:'center', padding:'6px 2px',
                  fontSize:11, fontWeight: sel || tod ? 700 : 500, fontFamily:MONO,
                  color: dis ? 'rgba(255,255,255,.18)' : sel ? '#0A1A0C' : tod ? C.indigo : '#fff',
                  background: sel ? C.indigo : tod && !sel ? 'rgba(129,140,248,.12)' : 'transparent',
                  cursor: dis ? 'not-allowed' : 'pointer', opacity: dis ? 0.4 : 1,
                  position:'relative',
                }}
              >
                {d}
                {tod && !sel && (
                  <div style={{ position:'absolute', bottom:2, left:'50%', transform:'translateX(-50%)',
                    width:3, height:3, borderRadius:'50%', background:C.indigo }}/>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ padding:'7px 13px', borderTop:`1px solid ${C.borderFaint}`,
        fontSize:9.5, color:C.fade, fontFamily:MONO, display:'flex', alignItems:'center', gap:4 }}>
        <Ico n="warn" size={9} color={C.fade}/>
        Available 15 min – 7 days ahead
      </div>
    </div>
  );
}

// ── Stripe card form inner ────────────────────────────────────────────────────
const CARD_OPTS = {
  style: {
    base: {
      color: '#fff',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '14px',
      '::placeholder': { color: 'rgba(255,255,255,.28)' },
      iconColor: C.greenBright,
    },
    invalid: { color: C.red, iconColor: C.red },
  },
  hidePostalCode: true,
};

function StripeCardForm({ uid, bookingPayload, total, scheduled, onSuccess, onError }) {
  const { loading, error, complete, focused, setComplete, setError, setFocused, handleSubmit } =
    useCardPayment({ uid, bookingPayload, onSuccess, onError });

  return (
    <form onSubmit={handleSubmit}>
      <div className="br-stripe-el" style={{
        border: `1.5px solid ${error ? C.red : focused ? C.green : C.borderFaint}`,
        borderRadius:11, padding:'13px 14px', background:C.faint,
        marginBottom:10, transition:'border-color .2s',
        boxShadow: focused ? `0 0 0 3px ${C.greenDim}` : 'none',
      }}>
        <div style={{ fontSize:8.5, fontWeight:700, color:C.dim, letterSpacing:'.1em',
          textTransform:'uppercase', fontFamily:MONO, marginBottom:10,
          display:'flex', alignItems:'center', gap:5 }}>
          <Ico n="lock" size={9} color={C.dim}/> Card Details
        </div>
        <CardElement
          options={CARD_OPTS}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={e => { setComplete(e.complete); setError(e.error?.message || ''); }}
        />
      </div>

      {error && (
        <div style={{ padding:'9px 11px', borderRadius:9, background:C.redDim,
          border:`1px solid rgba(248,113,113,.2)`, color:C.red, fontSize:11,
          fontWeight:500, marginBottom:10, display:'flex', alignItems:'center', gap:6, fontFamily:MONO }}>
          <Ico n="warn" size={12} color={C.red}/>{error}
        </div>
      )}

      <PrimaryBtn
        loading={loading}
        disabled={!complete || loading}
        onClick={handleSubmit}
      >
        <Ico n="lock" size={13}/>
        {scheduled ? `Schedule · $${total}` : `Pay $${total}`}
      </PrimaryBtn>

      <div style={{ marginTop:8, display:'flex', alignItems:'center', justifyContent:'center',
        gap:5, fontSize:9.5, color:C.fade, fontFamily:MONO }}>
        <Ico n="shield" size={9} color={C.fade}/> Secured by Stripe · 256-bit TLS
      </div>
    </form>
  );
}

// ── CashApp panel ─────────────────────────────────────────────────────────────
function CashAppPanel({ uid, bookingPayload, total, scheduled, onSuccess, onError }) {
  const { loading, handleCashApp } = useCashAppPayment({ uid, bookingPayload, onSuccess, onError });
  return (
    <>
      <div style={{ background:'rgba(0,214,50,.07)', border:`1px solid rgba(0,214,50,.22)`,
        borderRadius:11, padding:'12px 13px', marginBottom:10,
        display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:32, height:32, borderRadius:9, background:C.cashApp,
          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <span style={{ fontSize:16, fontWeight:900, color:'#000', fontFamily:'system-ui', lineHeight:1 }}>$</span>
        </div>
        <div>
          <div style={{ fontFamily:COND, fontSize:12, fontWeight:800, color:'#fff', marginBottom:2 }}>
            Pay with Cash App
          </div>
          <div style={{ fontFamily:MONO, fontSize:8.5, color:C.dim }}>
            You'll confirm in the Cash App
          </div>
        </div>
      </div>
      <PrimaryBtn loading={loading} disabled={loading} onClick={handleCashApp}
        style={{ background:'linear-gradient(135deg,#00E03A,#00B82B)',
          boxShadow:'0 4px 18px rgba(0,214,50,.3)', animation:'none' }}>
        {scheduled ? `Schedule · $${total}` : 'Continue to Cash App'}
        <Ico n="fwd" size={13}/>
      </PrimaryBtn>
    </>
  );
}

// ── Cash panel ────────────────────────────────────────────────────────────────
function CashPanel({ uid, bookingPayload, total, scheduled, scheduledAt, onSuccess, onError, onClose }) {
  const { loading, handleCash } = useCashPayment({ uid, bookingPayload, onSuccess, onError, onClose });
  return (
    <>
      <div style={{ background:C.amberDim, border:`1px solid ${C.amberBorder}`,
        borderRadius:11, padding:'14px 13px', marginBottom:10 }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:9, marginBottom:10 }}>
          <Ico n="cash" size={16} color={C.amber} style={{ flexShrink:0, marginTop:1 }}/>
          <div>
            <div style={{ fontFamily:COND, fontSize:12.5, fontWeight:800, color:C.amber, marginBottom:2 }}>
              Pay driver in cash
            </div>
            <div style={{ fontFamily:MONO, fontSize:8.5, color:'rgba(245,158,11,.75)', lineHeight:1.6 }}>
              Have <strong style={{ color:C.amber }}>${total}</strong> ready on arrival.
              Exact change appreciated.
            </div>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8,
          paddingTop:10, borderTop:`1px solid rgba(245,158,11,.14)` }}>
          <div>
            <div style={{ fontSize:8, fontWeight:700, color:C.amber, letterSpacing:'.1em',
              textTransform:'uppercase', fontFamily:MONO, marginBottom:3 }}>Amount Due</div>
            <div style={{ fontFamily:MONO, fontSize:18, fontWeight:700, color:C.amber }}>${total}</div>
          </div>
          <div>
            <div style={{ fontSize:8, fontWeight:700, color:C.amber, letterSpacing:'.1em',
              textTransform:'uppercase', fontFamily:MONO, marginBottom:3 }}>When</div>
            <div style={{ fontFamily:MONO, fontSize:11, color:C.amber }}>
              {scheduledAt ? 'On driver arrival' : 'Driver arrival'}
            </div>
          </div>
        </div>
      </div>
      <PrimaryBtn loading={loading} disabled={loading} onClick={handleCash}
        style={{ background:'linear-gradient(135deg,#F59E0B,#B45309)',
          boxShadow:'0 4px 18px rgba(245,158,11,.28)', animation:'none' }}>
        <Ico n="cash" size={14}/>
        {scheduledAt ? `Schedule · $${total}` : `Confirm Cash · $${total}`}
      </PrimaryBtn>
    </>
  );
}

// ── PromoRow ──────────────────────────────────────────────────────────────────
function PromoRow({ originalTotal, onDiscountChange }) {
  const promo = usePromo(originalTotal);

  useEffect(() => { onDiscountChange(promo.discount); }, [promo.discount]);

  if (promo.discount) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'9px 12px', border:`1px solid ${C.border}`, borderRadius:10,
        background:C.greenDim, animation:'brFadeIn .25s ease both' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Ico n="spark" size={12} color={C.greenBright}/>
          <div>
            <div style={{ fontFamily:MONO, fontSize:11, fontWeight:700, color:C.greenBright }}>
              {promo.discount.code}
            </div>
            <div style={{ fontFamily:MONO, fontSize:8.5, color:C.dim }}>−${promo.discount.savings} off</div>
          </div>
        </div>
        <button type="button" onClick={promo.handleRemove}
          style={{ background:'none', border:'none', cursor:'pointer', color:C.dim, padding:3 }}>
          <Ico n="x" size={12}/>
        </button>
      </div>
    );
  }

  if (!promo.open) {
    return (
      <button type="button" onClick={() => promo.setOpen(true)} style={{
        background:'none', border:`1px dashed ${C.borderFaint}`, borderRadius:10,
        padding:'8px 12px', cursor:'pointer', width:'100%',
        display:'flex', alignItems:'center', gap:7,
        color:C.fade, fontFamily:MONO, fontSize:10, fontWeight:500,
      }}>
        <Ico n="tag" size:11/> Have a promo code?
      </button>
    );
  }

  return (
    <div>
      <div style={{ display:'flex', gap:6,
        border:`1px solid ${promo.error ? C.red : C.borderDim}`,
        borderRadius:10, overflow:'hidden', background:C.faint }}>
        <Ico n="tag" size={12} color={C.dim} style={{ margin:'auto 0 auto 11px', flexShrink:0 }}/>
        <input
          className="br-promo-input"
          placeholder="PROMO CODE"
          value={promo.code}
          onChange={e => promo.setCode(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && promo.handleApply()}
          maxLength={20} autoFocus
          style={{
            flex:1, background:'none', border:'none', outline:'none',
            fontFamily:MONO, fontSize:11, color:'#fff', letterSpacing:'.1em',
            padding:'10px 8px', caretColor:C.greenBright,
          }}
        />
        <button type="button" onClick={promo.handleApply}
          disabled={!promo.code.trim() || promo.loading}
          style={{
            padding:'0 14px', background: promo.code.trim() && !promo.loading ? C.green : C.faint,
            border:'none', cursor: promo.code.trim() && !promo.loading ? 'pointer' : 'not-allowed',
            fontFamily:COND, fontWeight:800, fontSize:10.5, letterSpacing:'.1em',
            color: promo.code.trim() && !promo.loading ? '#fff' : C.fade,
            flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center',
          }}>
          {promo.loading ? <Spinner size={12}/> : 'APPLY'}
        </button>
      </div>
      {promo.error && (
        <div style={{ marginTop:5, display:'flex', alignItems:'center', gap:5,
          fontSize:10, color:C.red, fontFamily:MONO }}>
          <Ico n="warn" size={10} color={C.red}/>{promo.error}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════════════
function BookRideCardInner({ uid, onRequest, onBookingComplete, onActiveChange }) {
  // ── step & nav ─────────────────────────────────────────────────────────────
  const [step, setStep] = useState(0);

  // ── address ────────────────────────────────────────────────────────────────
  const [pickup,  setPickupVal]  = useState('');
  const [dropoff, setDropoffVal] = useState('');

  // ── hooks ──────────────────────────────────────────────────────────────────
  const { tripData,   loading:loadingTrip,   error:routeErr,   reset:resetRoute  } = useRoute(pickup, dropoff);
  const { quotesData, loading:loadingQuotes, error:quotesErr,  reset:resetQuotes } = useQuotes(tripData);
  const { resolve:resolveGeo, loading:geoLoading, error:geoErr, clear:clearGeoErr } = useGeo();

  // ── ride selection ─────────────────────────────────────────────────────────
  const [selectedRide, setSelectedRide] = useState('standard');

  const rideOptions = useMemo(() => Object.values(quotesData?.rides || {}), [quotesData]);
  const resolvedRideId = useMemo(() => {
    if (!quotesData) return selectedRide;
    return quotesData.rides?.[selectedRide]
      ? selectedRide
      : (Object.keys(quotesData.rides || {})[0] ?? selectedRide);
  }, [quotesData, selectedRide]);
  const selectedQuote = useMemo(() => quotesData?.rides?.[resolvedRideId] || null, [quotesData, resolvedRideId]);
  const driverInfo    = useMemo(() => quotesData?.driverInfo ?? null, [quotesData]);

  const isLoadingData = loadingTrip || loadingQuotes;
  const dataError     = routeErr || quotesErr;

  // ── scheduling ─────────────────────────────────────────────────────────────
  const [when,      setWhen]     = useState(null);   // 'now' | 'scheduled'
  const [calYear,   setCalYear]  = useState(() => new Date().getFullYear());
  const [calMonth,  setCalMonth] = useState(() => new Date().getMonth());
  const [selDay,    setSelDay]   = useState(null);   // { y, m, d }
  const [selHour,   setSelHour]  = useState(null);
  const [selMinute, setSelMinute]= useState(null);

  // build ISO scheduledAt from selected day + hour + minute
  const scheduledAt = useMemo(() => {
    if (when !== 'scheduled' || !selDay || selHour === null || selMinute === null) return null;
    const dt = new Date(selDay.y, selDay.m, selDay.d, selHour, selMinute, 0, 0);
    return dt.toISOString();
  }, [when, selDay, selHour, selMinute]);

  const isMinuteDisabled = useCallback((h, m) => {
    if (!selDay) return true;
    const dt   = new Date(selDay.y, selDay.m, selDay.d, h, m, 0, 0);
    const soon = new Date(Date.now() + 15 * 60 * 1000);
    return dt < soon;
  }, [selDay]);

  const isHourDisabled = useCallback(h => {
    if (!selDay) return true;
    // hour is available if at least one minute slot is enabled
    return [0, 15, 30, 45].every(m => isMinuteDisabled(h, m));
  }, [selDay, isMinuteDisabled]);

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);

  // ── promo / discount ───────────────────────────────────────────────────────
  const [promoDiscount, setPromoDiscount] = useState(null);

  // ── payment ────────────────────────────────────────────────────────────────
  const [selectedPayment, setSelectedPayment] = useState('card');
  const [payError,        setPayError]         = useState('');

  // ── success ────────────────────────────────────────────────────────────────
  const [finalPayload, setFinalPayload] = useState(null);
  const [countdown,    setCountdown]    = useState(5);
  const countdownRef = useRef(null);

  // ── geo ────────────────────────────────────────────────────────────────────
  const [showGeoAlert, setShowGeoAlert] = useState(false);

  // ── computed total ─────────────────────────────────────────────────────────
  const baseTotal = useMemo(() => Number(selectedQuote?.total || 0), [selectedQuote]);
  const grandTotal = useMemo(() => {
    if (promoDiscount?.newTotal !== undefined) return Number(promoDiscount.newTotal).toFixed(2);
    return baseTotal.toFixed(2);
  }, [baseTotal, promoDiscount]);

  // ── assembled booking payload (passed to payment hooks) ────────────────────
  const bookingPayload = useMemo(() => {
    if (!tripData || !quotesData || !selectedQuote) return null;
    const base = buildPayload({ pickup, dropoff, tripData, quotesData,
      rideId: resolvedRideId, selectedQuote, scheduledAt, promoDiscount });
    return {
      ...base,
      fareEstimate:   grandTotal,
      ...(promoDiscount ? { promoCode: promoDiscount.code, discountAmount: promoDiscount.savings } : {}),
    };
  }, [tripData, quotesData, selectedQuote, resolvedRideId, pickup, dropoff, scheduledAt, promoDiscount, grandTotal]);

  // ── countdown on success ────────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 11) return;
    setCountdown(5);
    countdownRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(countdownRef.current); reset(); onBookingComplete?.(); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(countdownRef.current);
  }, [step]);

  // ── reset ──────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    onActiveChange?.(false);
    setStep(0);
    setPickupVal(''); setDropoffVal('');
    resetRoute(); resetQuotes();
    setSelectedRide('standard');
    setWhen(null);
    setCalYear(new Date().getFullYear()); setCalMonth(new Date().getMonth());
    setSelDay(null); setSelHour(null); setSelMinute(null);
    setPromoDiscount(null);
    setSelectedPayment('card'); setPayError('');
    setFinalPayload(null);
    setShowGeoAlert(false); clearGeoErr();
    clearInterval(countdownRef.current);
  }, [resetRoute, resetQuotes, clearGeoErr, onActiveChange]);

  // ── back ───────────────────────────────────────────────────────────────────
  const back = useCallback(() => {
    setPayError('');
    if (step === 9 || step === 10) { setStep(8); return; }
    if (step === 8) { setStep(7); return; }
    if (step === 7) { setStep(when === 'scheduled' ? 6 : 4); return; }
    if (step === 6) { setStep(5); return; }
    if (step === 5) { setStep(4); return; }
    if (step === 4) { setStep(3); return; }
    if (step === 3) { setStep(2); return; }
    if (step === 2) { setDropoffVal(''); setStep(1); return; }
    if (step === 1) { setPickupVal('');  setStep(0); return; }
    setStep(s => Math.max(0, s - 1));
  }, [step, when]);

  // ── geo ────────────────────────────────────────────────────────────────────
  const handleGeoAllow = useCallback(async () => {
    try {
      const addr = await resolveGeo();
      setPickupVal(addr);
      setShowGeoAlert(false);
    } catch { /* geoErr shown inline */ }
  }, [resolveGeo]);

  // ── payment success / error ────────────────────────────────────────────────
  const handlePaySuccess = useCallback((result) => {
    setFinalPayload(bookingPayload);
    onRequest?.(bookingPayload);
    setStep(11);
  }, [bookingPayload, onRequest]);

  const handlePayError = useCallback((msg) => {
    setPayError(msg);
  }, []);

  // ── calendar helpers ───────────────────────────────────────────────────────
  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  };

  // ── step renderers ─────────────────────────────────────────────────────────

  // STEP 0 — landing
  const renderLanding = () => (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:14,
      background:'rgba(34,197,94,.05)', border:`1px solid ${C.borderDim}`,
      borderRadius:14, padding:'13px 14px', animation:'brSlideUp .3s ease both' }}>
      <div style={{ display:'flex', alignItems:'center', gap:11 }}>
        <div style={{ width:42, height:42, borderRadius:12, flexShrink:0,
          background:'rgba(34,197,94,.1)', border:`1px solid ${C.border}`,
          display:'flex', alignItems:'center', justifyContent:'center',
          boxShadow:'0 0 14px rgba(74,222,128,.15)' }}>
          <Ico n="car" size={20} color={C.greenBright}/>
        </div>
        <div>
          <div style={{ fontFamily:COND, fontSize:20, fontWeight:900, letterSpacing:'.04em',
            color:'#fff', lineHeight:1.05 }}>Need a ride?</div>
          <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:4 }}>
            <div style={{ width:5, height:5, borderRadius:'50%', background:C.greenBright,
              boxShadow:`0 0 5px ${C.greenBright}`, animation:'brBlink 1.6s ease-in-out infinite' }}/>
            <span style={{ fontFamily:MONO, fontSize:8, color:C.dim }}>drivers nearby · flat-rate · no surge</span>
          </div>
        </div>
      </div>
      <button
        onClick={() => { onActiveChange?.(true); setStep(1); }}
        style={{ flexShrink:0, background:'linear-gradient(135deg,#22C55E,#16A34A)', color:'#fff',
          border:'none', borderRadius:10, padding:'10px 16px', cursor:'pointer',
          fontFamily:COND, fontSize:11.5, fontWeight:800, letterSpacing:'.14em', textTransform:'uppercase',
          boxShadow:'0 4px 18px rgba(34,197,94,.35)', animation:'brGlowPulse 2.8s ease-in-out infinite' }}>
        Request
      </button>
    </div>
  );

  // STEP 1 — pickup
  const renderPickup = () => (
    <div style={{ display:'flex', flexDirection:'column', gap:10, animation:'brSlideUp .3s ease both' }}>
      {(showGeoAlert || geoLoading || geoErr) && (
        <div style={{ background: geoErr ? C.redDim : C.greenDim,
          border:`1px solid ${geoErr ? 'rgba(248,113,113,.3)' : C.border}`, borderRadius:10, padding:'11px 13px',
          display:'flex', alignItems:'center', gap:9, animation:'brFadeIn .2s ease both' }}>
          {geoLoading
            ? <Spinner size={14}/>
            : <Ico n={geoErr ? 'warn' : 'locate'} size={14} color={geoErr ? C.red : C.greenBright}/>}
          <span style={{ flex:1, fontFamily:MONO, fontSize:9.5,
            color: geoErr ? C.red : C.greenBright, fontWeight:500 }}>
            {geoLoading ? 'Getting your location…' : geoErr || 'Use your current location?'}
          </span>
          {!geoLoading && (
            <div style={{ display:'flex', gap:6 }}>
              {!geoErr && (
                <button onClick={handleGeoAllow} style={{ background:C.green, border:'none', borderRadius:7,
                  padding:'5px 10px', cursor:'pointer', fontFamily:COND, fontSize:9.5, fontWeight:800,
                  letterSpacing:'.1em', color:'#fff' }}>Allow</button>
              )}
              <button onClick={() => { setShowGeoAlert(false); clearGeoErr(); }}
                style={{ background:'rgba(255,255,255,.06)', border:'none', borderRadius:7,
                  padding:'5px 8px', cursor:'pointer', color:C.dim }}>
                <Ico n="x" size={11}/>
              </button>
            </div>
          )}
        </div>
      )}

      <PlaceInput
        label="Pickup Address" placeholder="Where are you?"
        value={pickup} onChange={setPickupVal} autoFocus
        onLocationRequest={() => { clearGeoErr(); setShowGeoAlert(true); }}
      />
      <PrimaryBtn disabled={!pickup.trim()} onClick={() => setStep(2)}>
        Set Pickup <Ico n="fwd" size={13}/>
      </PrimaryBtn>
    </div>
  );

  // STEP 2 — dropoff
  const renderDropoff = () => (
    <div style={{ display:'flex', flexDirection:'column', gap:10, animation:'brSlideUp .3s ease both' }}>
      <PlaceInput
        label="Drop-off Address" placeholder="Where to?"
        value={dropoff} onChange={setDropoffVal} autoFocus
      />

      {isLoadingData && (
        <div style={{ display:'flex', alignItems:'center', gap:9, padding:'9px 12px',
          background:C.faint, border:`1px solid ${C.borderDim}`, borderRadius:10 }}>
          <Spinner size={14}/>
          <span style={{ fontFamily:MONO, fontSize:9, color:C.dim }}>
            {loadingTrip ? 'Calculating route…' : 'Calculating prices…'}
          </span>
        </div>
      )}

      {dataError && !isLoadingData && (
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 12px',
          background:C.redDim, border:`1px solid rgba(248,113,113,.2)`, borderRadius:10 }}>
          <Ico n="warn" size={13} color={C.red}/>
          <span style={{ fontFamily:MONO, fontSize:9.5, color:C.red }}>{dataError}</span>
        </div>
      )}

      <PrimaryBtn
        disabled={!dropoff.trim() || isLoadingData || !!dataError}
        loading={isLoadingData}
        onClick={() => setStep(3)}
      >
        Get Prices <Ico n="fwd" size={13}/>
      </PrimaryBtn>
    </div>
  );

  // STEP 3 — ride type
  const renderRideType = () => (
    <div style={{ display:'flex', flexDirection:'column', gap:8, animation:'brSlideUp .3s ease both' }}>
      {/* stats row */}
      {tripData && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:1,
          background:C.borderFaint, borderRadius:10, overflow:'hidden', marginBottom:4 }}>
          {[
            { lbl:'DISTANCE', val:`${tripData.miles} mi` },
            { lbl:'DURATION', val:`${tripData.durationMin} min` },
            { lbl:'FARE',     val:`$${selectedQuote?.total || '—'}`, hi:true },
          ].map((s, i) => (
            <div key={i} style={{ padding:'9px 10px', background:C.faint,
              borderRight: i < 2 ? `1px solid ${C.borderFaint}` : 'none' }}>
              <div style={{ fontFamily:MONO, fontSize:7.5, fontWeight:700, letterSpacing:'.1em',
                color:C.dim, textTransform:'uppercase', marginBottom:3 }}>{s.lbl}</div>
              <div style={{ fontFamily:MONO, fontSize:14, fontWeight:700,
                color: s.hi ? C.greenBright : '#fff' }}>{s.val}</div>
            </div>
          ))}
        </div>
      )}

      {rideOptions.length === 0 && isLoadingData && (
        <div style={{ display:'flex', justifyContent:'center', padding:'16px 0' }}>
          <Spinner size={22}/>
        </div>
      )}

      {rideOptions.map(ride => {
        const active   = resolvedRideId === ride.id;
        const etaStale = typeof ride.eta === 'string' && ride.eta.startsWith('~');
        const etaNone  = ride.eta == null;
        return (
          <button
            key={ride.id}
            className="br-ride-row"
            onClick={() => { setSelectedRide(ride.id); setStep(4); }}
            style={{ display:'flex', alignItems:'center', gap:11, padding:'10px 13px',
              borderRadius:11, background: active ? 'rgba(34,197,94,.12)' : C.faint,
              border:`1px solid ${active ? C.green : C.borderDim}`,
              cursor:'pointer', textAlign:'left' }}
          >
            <div style={{ width:36, height:36, borderRadius:10, flexShrink:0,
              background: active ? 'rgba(34,197,94,.15)' : 'rgba(255,255,255,.05)',
              border:`1px solid ${active ? C.border : C.borderDim}`,
              display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Ico n={getRideIcon(ride.id)} size={17} color={active ? C.greenBright : C.dim}/>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily:COND, fontSize:12.5, fontWeight:800, letterSpacing:'.06em',
                color: active ? '#fff' : 'rgba(255,255,255,.75)', marginBottom:2 }}>{ride.label}</div>
              <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                {etaNone
                  ? <span style={{ fontFamily:MONO, fontSize:8, color:C.amber }}>No ETA</span>
                  : <span style={{ fontFamily:MONO, fontSize:8,
                      color: etaStale ? C.dim : C.greenSoft }}>
                      <Ico n="clock" size={9} color={etaStale ? C.dim : C.greenSoft}/> {ride.eta}
                    </span>
                }
                <span style={{ fontFamily:MONO, fontSize:8, color:C.fade }}>· {ride.capacity}</span>
              </div>
            </div>
            <div style={{ fontFamily:MONO, fontSize:16, fontWeight:700,
              color: active ? C.greenBright : 'rgba(255,255,255,.6)' }}>
              ${Number(ride.total).toFixed(2)}
            </div>
          </button>
        );
      })}

      {driverInfo !== undefined && <DriverBanner driverInfo={driverInfo}/>}
    </div>
  );

  // STEP 4 — when
  const renderWhen = () => (
    <div style={{ display:'flex', flexDirection:'column', gap:8, animation:'brSlideUp .3s ease both' }}>
      {[
        { id:'now',       icon:'clock', label:'Leave Now',  sub:'Pickup in ~5–15 min' },
        { id:'scheduled', icon:'cal',   label:'Schedule',   sub:'Pick a date & time' },
      ].map(w => (
        <button key={w.id} className="br-pm-row"
          onClick={() => { setWhen(w.id); setStep(w.id === 'now' ? 7 : 5); }}
          style={{ display:'flex', alignItems:'center', gap:11, padding:'12px 14px', borderRadius:11,
            background:C.faint, border:`1px solid ${C.borderDim}`,
            cursor:'pointer', transition:'all .15s', textAlign:'left' }}>
          <div style={{ width:38, height:38, borderRadius:10, flexShrink:0,
            background:'rgba(34,197,94,.08)', border:`1px solid ${C.borderDim}`,
            display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Ico n={w.icon} size={18} color={C.greenSoft}/>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:COND, fontSize:13, fontWeight:800, letterSpacing:'.06em', color:'#fff' }}>
              {w.label}</div>
            <div style={{ fontFamily:MONO, fontSize:8.5, color:C.dim, marginTop:2 }}>{w.sub}</div>
          </div>
          <Ico n="fwd" size={14} color={C.fade}/>
        </button>
      ))}
    </div>
  );

  // STEP 5 — date
  const renderDate = () => (
    <div style={{ display:'flex', flexDirection:'column', gap:10, animation:'brSlideUp .3s ease both' }}>
      <CalendarPicker
        selYear={calYear} selMonth={calMonth} selDay={selDay}
        onDayClick={(y, m, d) => { setSelDay({ y, m, d }); setSelHour(null); setSelMinute(null); }}
        onPrevMonth={prevMonth} onNextMonth={nextMonth}
      />
      <PrimaryBtn disabled={!selDay} onClick={() => setStep(6)}>
        Confirm Date <Ico n="fwd" size={13}/>
      </PrimaryBtn>
    </div>
  );

  // STEP 6 — time (hour + minute → real ISO timestamp)
  const renderTime = () => (
    <div style={{ display:'flex', flexDirection:'column', gap:10, animation:'brSlideUp .3s ease both' }}>
      {selDay && (
        <div style={{ fontFamily:MONO, fontSize:9, color:C.dim, textAlign:'center' }}>
          {DAYS_SHORT[new Date(selDay.y, selDay.m, selDay.d).getDay()]}{' '}
          {MONTHS_SHORT[selDay.m]} {selDay.d}, {selDay.y}
        </div>
      )}

      {/* hour grid */}
      <div>
        <div style={{ fontFamily:MONO, fontSize:8.5, fontWeight:700, color:C.dim,
          letterSpacing:'.1em', textTransform:'uppercase', marginBottom:7 }}>Select Hour</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:4 }}>
          {hours.map(h => {
            const dis = isHourDisabled(h);
            const sel = selHour === h;
            const lbl = h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h-12}p`;
            return (
              <div key={h} className={`br-hour${sel ? ' sel-h' : ''}${dis ? ' dis-h' : ''}`}
                onClick={() => { if (!dis) { setSelHour(h); setSelMinute(null); } }}
                style={{ textAlign:'center', padding:'7px 3px', fontSize:10.5,
                  fontFamily:MONO, fontWeight:500,
                  color: dis ? 'rgba(255,255,255,.18)' : sel ? '#0A1A0C' : '#fff',
                  background: sel ? C.indigo : 'transparent',
                  opacity: dis ? 0.3 : 1, cursor: dis ? 'not-allowed' : 'pointer' }}>
                {lbl}
              </div>
            );
          })}
        </div>
      </div>

      {/* minute picker */}
      {selHour !== null && (
        <div style={{ animation:'brFadeIn .22s ease both' }}>
          <div style={{ fontFamily:MONO, fontSize:8.5, fontWeight:700, color:C.dim,
            letterSpacing:'.1em', textTransform:'uppercase', marginBottom:7 }}>Select Minute</div>
          <div style={{ display:'flex', gap:7 }}>
            {[0, 15, 30, 45].map(m => {
              const dis = isMinuteDisabled(selHour, m);
              const sel = selMinute === m;
              return (
                <button key={m} type="button" className="br-min-btn"
                  onClick={() => { if (!dis) { setSelMinute(m); } }}
                  disabled={dis}
                  style={{ flex:1, padding:'10px 0', borderRadius:10,
                    border:`1.5px solid ${sel ? C.indigo : C.borderFaint}`,
                    background: sel ? C.indigo : 'transparent',
                    cursor: dis ? 'not-allowed' : 'pointer', opacity: dis ? 0.3 : 1,
                    fontFamily:MONO, fontSize:12, fontWeight:600,
                    color: sel ? '#0A1A0C' : '#fff' }}>
                  :{pad(m)}
                </button>
              );
            })}
          </div>
          <div style={{ marginTop:7, fontSize:9.5, color:C.fade, fontFamily:MONO,
            display:'flex', alignItems:'center', gap:4 }}>
            <Ico n="warn" size={9} color={C.fade}/> Tap a minute to set your schedule
          </div>
        </div>
      )}

      {/* confirm — only available once a full time is selected */}
      {scheduledAt && (
        <div style={{ animation:'brFadeIn .2s ease both' }}>
          <div style={{ padding:'9px 12px', background:C.greenDim, border:`1px solid ${C.border}`,
            borderRadius:9, fontFamily:MONO, fontSize:9.5, color:C.greenBright,
            marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
            <Ico n="cal" size={11} color={C.greenBright}/>
            {new Date(scheduledAt).toLocaleString('en-US', {
              weekday:'short', month:'short', day:'numeric',
              hour:'numeric', minute:'2-digit', hour12:true })}
          </div>
          <PrimaryBtn onClick={() => setStep(7)}>
            Confirm Time <Ico n="fwd" size={13}/>
          </PrimaryBtn>
        </div>
      )}
    </div>
  );

  // STEP 7 — discount / promo
  const renderDiscount = () => (
    <div style={{ display:'flex', flexDirection:'column', gap:10, animation:'brSlideUp .3s ease both' }}>
      <div style={{ fontFamily:MONO, fontSize:9, color:C.dim, textAlign:'center' }}>
        Have a promo code? Enter it below.
      </div>
      <PromoRow originalTotal={baseTotal} onDiscountChange={setPromoDiscount}/>
      {promoDiscount && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'8px 12px', background:C.greenDim, border:`1px solid ${C.border}`,
          borderRadius:9, fontFamily:MONO, fontSize:9.5, color:C.greenBright }}>
          <span>Fare after promo</span>
          <span>${grandTotal}</span>
        </div>
      )}
      <PrimaryBtn onClick={() => setStep(8)}>Continue <Ico n="fwd" size={13}/></PrimaryBtn>
      <GhostBtn onClick={() => setStep(8)}>Skip</GhostBtn>
    </div>
  );

  // STEP 8 — payment choice
  const renderPayment = () => (
    <div style={{ display:'flex', flexDirection:'column', gap:8, animation:'brSlideUp .3s ease both' }}>
      {/* fare summary */}
      <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between',
        padding:'10px 13px', background:C.faint, border:`1px solid ${C.borderDim}`, borderRadius:10 }}>
        <span style={{ fontFamily:MONO, fontSize:9, color:C.dim }}>Total due</span>
        <span style={{ fontFamily:MONO, fontSize:22, fontWeight:700, color:C.greenBright,
          letterSpacing:'-1px' }}>${grandTotal}</span>
      </div>

      {payError && (
        <div style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 12px',
          background:C.redDim, border:`1px solid rgba(248,113,113,.2)`, borderRadius:9,
          fontFamily:MONO, fontSize:9.5, color:C.red }}>
          <Ico n="warn" size={12} color={C.red}/>{payError}
        </div>
      )}

      {[
        { id:'card',    icon:'card',  label:'Credit / Debit Card', sub:'Visa · Mastercard · Amex' },
        { id:'cashapp', icon:'phone', label:'Cash App',             sub:'$Cashtag instant pay' },
        { id:'cash',    icon:'cash',  label:'Cash',                 sub:'Pay driver directly' },
      ].map(pm => (
        <button key={pm.id} className="br-pm-row"
          onClick={() => {
            setPayError(''); setSelectedPayment(pm.id);
            if (pm.id === 'card')    setStep(9);
            if (pm.id === 'cashapp') setStep(9); // same step, panel switches
            if (pm.id === 'cash')    setStep(10);
          }}
          style={{ display:'flex', alignItems:'center', gap:11, padding:'11px 13px', borderRadius:11,
            background: selectedPayment === pm.id ? 'rgba(34,197,94,.10)' : C.faint,
            border:`1px solid ${selectedPayment === pm.id ? C.green : C.borderDim}`,
            cursor:'pointer', textAlign:'left' }}>
          <div style={{ width:36, height:36, borderRadius:10, flexShrink:0,
            background:'rgba(34,197,94,.07)', border:`1px solid ${C.borderDim}`,
            display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Ico n={pm.icon} size={17} color={selectedPayment === pm.id ? C.greenBright : C.dim}/>
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:COND, fontSize:12, fontWeight:800, letterSpacing:'.06em',
              color: selectedPayment === pm.id ? '#fff' : 'rgba(255,255,255,.65)' }}>{pm.label}</div>
            <div style={{ fontFamily:MONO, fontSize:8.5, color:C.dim, marginTop:1 }}>{pm.sub}</div>
          </div>
          <Ico n="fwd" size={13} color={C.fade}/>
        </button>
      ))}
    </div>
  );

  // STEP 9 — card or cashapp panel
  const renderCardOrCashApp = () => (
    <div style={{ animation:'brSlideUp .3s ease both' }}>
      {selectedPayment === 'cashapp'
        ? <CashAppPanel uid={uid} bookingPayload={bookingPayload}
            total={grandTotal} scheduled={!!scheduledAt}
            onSuccess={handlePaySuccess} onError={handlePayError}/>
        : <StripeCardForm uid={uid} bookingPayload={bookingPayload}
            total={grandTotal} scheduled={!!scheduledAt}
            onSuccess={handlePaySuccess} onError={handlePayError}/>
      }
    </div>
  );

  // STEP 10 — cash confirm
  const renderCash = () => (
    <div style={{ animation:'brSlideUp .3s ease both' }}>
      <CashPanel uid={uid} bookingPayload={bookingPayload}
        total={grandTotal} scheduled={!!scheduledAt} scheduledAt={scheduledAt}
        onSuccess={handlePaySuccess} onError={handlePayError}
        onClose={reset}/>
    </div>
  );

  // STEP 11 — success
  const renderSuccess = () => {
    const p = finalPayload;
    return (
      <div style={{ display:'flex', flexDirection:'column', gap:13,
        animation:'brSuccessIn .5s cubic-bezier(.34,1.2,.64,1) both' }}>

        {/* animated check */}
        <div style={{ display:'flex', justifyContent:'center', padding:'8px 0 4px', position:'relative' }}>
          {[1,2].map(i => (
            <div key={i} style={{
              position:'absolute', top:'50%', left:'50%',
              width:72, height:72, borderRadius:'50%', marginLeft:-36, marginTop:-36,
              border:`1.5px solid ${C.green}`,
              animation:`brRingOut ${1 + i * 0.4}s ease-out ${i * 0.25}s both`,
            }}/>
          ))}
          <div style={{ width:64, height:64, borderRadius:'50%',
            background:'rgba(34,197,94,.14)', border:`2px solid ${C.green}`,
            display:'flex', alignItems:'center', justifyContent:'center',
            animation:'brCheckPop .55s cubic-bezier(.34,1.4,.64,1) .1s both',
            boxShadow:`0 0 30px rgba(74,222,128,.38)`, position:'relative', zIndex:1 }}>
            <Ico n="check" size={28} color={C.greenBright} sw={2.5}/>
          </div>
        </div>

        <div style={{ textAlign:'center' }}>
          <div style={{ fontFamily:COND, fontSize:20, fontWeight:900, letterSpacing:'.05em', color:'#fff' }}>
            {p?.isScheduled ? 'Ride Scheduled!' : 'Ride Requested!'}
          </div>
          <div style={{ fontFamily:MONO, fontSize:9, color:C.dim, marginTop:4 }}>
            {p?.isScheduled ? 'Your driver will be assigned before pickup.' : 'Looking for your driver…'}
          </div>
        </div>

        {/* payload summary */}
        {p && (
          <div style={{ background:C.faint, border:`1px solid ${C.borderDim}`, borderRadius:11,
            padding:'11px 13px', display:'flex', flexDirection:'column', gap:8,
            animation:'brFadeIn .4s ease .25s both' }}>
            {[
              { lbl:'FROM',    val: p.pickup },
              { lbl:'TO',      val: p.dropoff },
              { lbl:'RIDE',    val: p.rideLabel },
              { lbl:'FARE',    val: `$${p.fareEstimate}` },
              { lbl:'WHEN',    val: p.isScheduled
                ? new Date(p.scheduledAt).toLocaleString('en-US', {
                    month:'short', day:'numeric', hour:'numeric', minute:'2-digit', hour12:true })
                : 'Leave Now' },
              ...(p.promoCode ? [{ lbl:'PROMO', val: p.promoCode }] : []),
              ...(p.driverInfo?.driverCount ? [{ lbl:'DRIVERS', val: `${p.driverInfo.driverCount} nearby` }] : []),
            ].map((r, i) => (
              <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:9 }}>
                <span style={{ fontFamily:COND, fontSize:8, fontWeight:800, letterSpacing:'.12em',
                  color:C.dim, textTransform:'uppercase', minWidth:42, paddingTop:1 }}>{r.lbl}</span>
                <span style={{ fontFamily:MONO, fontSize:9.5, color:'rgba(255,255,255,.7)',
                  flex:1, wordBreak:'break-all', lineHeight:1.45 }}>{r.val}</span>
              </div>
            ))}
          </div>
        )}

        {/* countdown */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
          <span style={{ fontFamily:MONO, fontSize:8.5, color:C.dim }}>Returning in</span>
          <span style={{ fontFamily:MONO, fontSize:12, fontWeight:800, color:C.greenBright,
            minWidth:16, textAlign:'center' }}>{countdown}</span>
          <span style={{ fontFamily:MONO, fontSize:8.5, color:C.dim }}>s</span>
        </div>

        <PrimaryBtn onClick={() => { reset(); onBookingComplete?.(); }}>
          Book Another Ride
        </PrimaryBtn>
      </div>
    );
  };

  // ── render body ────────────────────────────────────────────────────────────
  const body = () => {
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
      case 9:  return renderCardOrCashApp();
      case 10: return renderCash();
      case 11: return renderSuccess();
      default: return null;
    }
  };

  return (
    <>
      <style>{KF}</style>
      <div style={{
        background:'rgba(5,10,6,.85)', backdropFilter:'blur(16px)',
        border:`1px solid ${C.border}`, borderRadius:17,
        padding:'13px 13px 15px', display:'flex', flexDirection:'column', gap:11,
        boxShadow:'0 8px 40px rgba(0,0,0,.55), 0 0 0 1px rgba(34,197,94,.06)',
        userSelect:'none',
      }}>
        <CardHeader
          step={step} onBack={back} onReset={reset}
          pickup={pickup} dropoff={dropoff}
          rideLabel={selectedQuote?.label || null}
        />
        <div style={{ height:1, background:C.borderDim }}/>
        {body()}
      </div>
    </>
  );
}

// ── wrap in Elements for Stripe ───────────────────────────────────────────────
export default function BookRideCard(props) {
  return (
    <Elements stripe={stripePromise}>
      <BookRideCardInner {...props}/>
    </Elements>
  );
}
