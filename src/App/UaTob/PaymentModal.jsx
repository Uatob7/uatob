// src/App/PaymentModal.jsx
import React, { useMemo, useState, useRef, useCallback } from 'react';
import {
  X, CreditCard, Check, Loader2, ShieldCheck,
  Banknote, Lock, ArrowRight, Clock, MapPin,
  Tag, Calendar, AlertCircle, Sparkles, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebase_app } from '@/firebase/config';

// ── Callables ──────────────────────────────────────────
const functions          = getFunctions(firebase_app, 'us-east1');
const callCardPayment    = httpsCallable(functions, 'cardPayment');
const callCashAppPayment = httpsCallable(functions, 'cashAppPayment');
const callCashPayment    = httpsCallable(functions, 'cashPayment');
const callValidatePromo  = httpsCallable(functions, 'validatePromoCode');
const stripePromise      = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

// ── Design tokens ──────────────────────────────────────
const T = {
  bg:          '#0C0F0C',
  bgCard:      '#141914',
  bgElevated:  '#1A201A',
  bgHighlight: '#1F271F',
  border:      'rgba(255,255,255,0.07)',
  borderMid:   'rgba(255,255,255,0.12)',
  borderGreen: 'rgba(34,197,94,0.35)',
  text:        '#F1F5F0',
  textMid:     '#8A9A88',
  textMuted:   '#4A5A48',
  green:       '#22C55E',
  greenDark:   '#16A34A',
  greenGlow:   'rgba(34,197,94,0.18)',
  greenDim:    'rgba(34,197,94,0.08)',
  cashApp:     '#00D632',
  amber:       '#F59E0B',
  amberDim:    'rgba(245,158,11,0.08)',
  amberBorder: 'rgba(245,158,11,0.3)',
  indigo:      '#818CF8',
  indigoDim:   'rgba(129,140,248,0.08)',
  indigoBorder:'rgba(129,140,248,0.3)',
  red:         '#F87171',
  redDim:      'rgba(248,113,113,0.08)',
};

// ── Payment methods ────────────────────────────────────
const METHODS = [
  { id: 'card',    label: 'Card',     sub: 'Credit / Debit', color: T.green,   gFrom: '#22C55E', gTo: '#15803D' },
  { id: 'cashapp', label: 'Cash App', sub: '$cashtag',       color: T.cashApp, gFrom: '#00E03A', gTo: '#00B82B' },
  { id: 'cash',    label: 'Cash',     sub: 'In person',      color: T.amber,   gFrom: '#F59E0B', gTo: '#B45309' },
];

const CARD_OPTIONS = {
  style: {
    base: {
      color: T.text,
      fontFamily: '"DM Mono", monospace',
      fontSize: '15px',
      fontSmoothing: 'antialiased',
      '::placeholder': { color: T.textMuted },
      iconColor: T.green,
    },
    invalid: { color: T.red, iconColor: T.red },
  },
  hidePostalCode: true,
};

// ── Tiny helpers ───────────────────────────────────────
const pad   = n => String(n).padStart(2, '0');
const DAYS  = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const MONTHS= ['January','February','March','April','May','June',
               'July','August','September','October','November','December'];

function CashAppLogo({ size = 22 }) {
  return (
    <div style={{
      width: size, height: size, background: T.cashApp,
      borderRadius: size * 0.26, display: 'flex',
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      <span style={{
        fontSize: size * 0.68, fontWeight: 900, color: '#000',
        fontFamily: 'system-ui', lineHeight: 1, marginTop: -size * 0.04,
      }}>$</span>
    </div>
  );
}

// ── CSS ────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Syne:wght@600;700;800&family=DM+Sans:wght@400;500;600&display=swap');

  .spin { animation: _spin 1s linear infinite; }
  @keyframes _spin    { to { transform: rotate(360deg); } }
  @keyframes _up      { from { transform: translateY(100%); opacity:0 } to { transform: translateY(0); opacity:1 } }
  @keyframes _fade    { from { opacity:0 } to { opacity:1 } }
  @keyframes _in      { from { transform:scale(.96); opacity:0 } to { transform:scale(1); opacity:1 } }
  @keyframes _pulse   {
    0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,.5); }
    50%      { box-shadow: 0 0 0 6px rgba(34,197,94,0); }
  }

  .pm-sheet  { animation: _up   .34s cubic-bezier(.32,.72,0,1) forwards; }
  .pm-fade   { animation: _fade .22s ease forwards; }
  .pm-in     { animation: _in   .22s cubic-bezier(.4,0,.2,1) forwards; }
  .pm-scroll { overflow-y:auto; -webkit-overflow-scrolling:touch; overscroll-behavior:contain; }
  .pm-scroll::-webkit-scrollbar { display:none; }

  .pm-method { transition: all .16s cubic-bezier(.4,0,.2,1); }
  .pm-method:active { transform: scale(.96); }
  .pm-btn    { transition: all .16s ease; }
  .pm-btn:hover:not(:disabled) { filter: brightness(1.08); }
  .pm-btn:active:not(:disabled) { transform: scale(.98); }

  .pm-cal-day { transition: all .14s ease; border-radius: 8px; cursor: pointer; }
  .pm-cal-day:hover:not(.disabled):not(.selected) { background: rgba(34,197,94,0.12); }

  .pm-hour { transition: all .14s ease; border-radius: 8px; cursor: pointer; }
  .pm-hour:hover:not(.selected-h) { background: rgba(255,255,255,0.06); }

  .pm-input {
    background: transparent; border: none; outline: none;
    font-family: 'DM Mono', monospace; color: ${T.text};
    font-size: 13px; font-weight: 500;
    width: 100%; padding: 10px 12px;
  }
  .pm-input::placeholder { color: ${T.textMuted}; }
`;

// ── Inline Schedule Picker (multi-step) ────────────────
// Steps: 'now' | 'cal' | 'time' | 'done'
// 'done'  = time fully confirmed, picker collapsed, summary shown on button
// Clicking Schedule button when 'done' → reopens 'cal' to edit (does NOT clear)
// Clicking Ride Now always resets everything
function SchedulePicker({ scheduledAt, onChange }) {
  const now = new Date();

  const [step,      setStep]      = useState('now');
  const [calYear,   setCalYear]   = useState(now.getFullYear());
  const [calMonth,  setCalMonth]  = useState(now.getMonth());
  const [selDay,    setSelDay]    = useState(null);
  const [selHour,   setSelHour]   = useState(null);
  const [selMinute, setSelMinute] = useState(null); // null = not yet picked

  const minDate = new Date(now.getTime() + 15 * 60 * 1000);
  const maxDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Only commit + close when ALL three are chosen
  const commitIfReady = useCallback((day, hour, minute) => {
    if (day === null || hour === null || minute === null) return;
    const d = new Date(day);
    d.setHours(hour, minute, 0, 0);
    onChange(d.toISOString());
    setStep('done'); // ← collapse the picker
  }, [onChange]);

  const handleSelectNow = () => {
    setStep('now');
    setSelDay(null); setSelHour(null); setSelMinute(null);
    onChange(null);
  };

  // Schedule button behaviour:
  // • 'now'  → open calendar (fresh)
  // • 'done' → reopen calendar to edit (keep existing selection visible)
  // • 'cal' / 'time' → cancel back to now
  const handleScheduleBtn = () => {
    if (step === 'now') {
      setStep('cal');
    } else if (step === 'done') {
      setStep('cal'); // edit — keep selDay/selHour/selMinute for visual context
    } else {
      // mid-flow cancel
      handleSelectNow();
    }
  };

  const firstDow = new Date(calYear, calMonth, 1).getDay();
  const daysInMo = new Date(calYear, calMonth + 1, 0).getDate();

  const isDayDisabled = (y, m, d) => {
    const date = new Date(y, m, d, 23, 59);
    return date < minDate || date > maxDate;
  };
  const isDaySelected = (y, m, d) => {
    if (!selDay) return false;
    return selDay.getFullYear()===y && selDay.getMonth()===m && selDay.getDate()===d;
  };
  const isToday = (y, m, d) =>
    y===now.getFullYear() && m===now.getMonth() && d===now.getDate();

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y=>y-1); }
    else setCalMonth(m=>m-1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y=>y+1); }
    else setCalMonth(m=>m+1);
  };

  const handleDayClick = (d) => {
    const date = new Date(calYear, calMonth, d);
    setSelDay(date);
    setSelHour(null);
    setSelMinute(null);
    setStep('time');
  };

  const hours = Array.from({length: 24}, (_,i) => i);
  const isHourDisabled = (h, min=0) => {
    if (!selDay) return true;
    const dt = new Date(selDay);
    dt.setHours(h, min, 0, 0);
    return dt < minDate;
  };

  const handleHourClick = (h) => {
    if (isHourDisabled(h)) return;
    setSelHour(h);
    setSelMinute(null); // reset minute when hour changes
  };

  const handleMinuteClick = (m) => {
    if (selHour === null) return;
    if (isHourDisabled(selHour, m)) return;
    setSelMinute(m);
    commitIfReady(selDay, selHour, m);
  };

  const summary = useMemo(() => {
    if (!scheduledAt) return null;
    return new Date(scheduledAt).toLocaleString('en-US', {
      weekday:'short', month:'short', day:'numeric',
      hour:'numeric', minute:'2-digit', hour12:true,
    });
  }, [scheduledAt]);

  const isScheduleActive = step !== 'now';
  const pickerOpen       = step === 'cal' || step === 'time';

  return (
    <div style={{ marginBottom: 14 }}>
      {/* ── Toggle row ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom: pickerOpen ? 10 : 0 }}>

        {/* Ride Now */}
        <button type="button" onClick={handleSelectNow} className="pm-method" style={{
          padding:'11px 10px', borderRadius:12, cursor:'pointer',
          background: !isScheduleActive ? T.greenDim : 'transparent',
          border: `1.5px solid ${!isScheduleActive ? T.green : T.border}`,
          display:'flex', flexDirection:'column', alignItems:'center', gap:5,
        }}>
          {!isScheduleActive
            ? <div style={{ width:7, height:7, borderRadius:'50%', background:T.green, animation:'_pulse 1.8s infinite' }}/>
            : <Clock size={13} color={T.textMuted} strokeWidth={2}/>
          }
          <span style={{ fontSize:11.5, fontWeight:700, color:!isScheduleActive ? T.green : T.text, fontFamily:'Syne' }}>
            Ride Now
          </span>
          <span style={{ fontSize:9.5, color:T.textMuted, fontWeight:500, fontFamily:'DM Sans' }}>Depart ASAP</span>
        </button>

        {/* Schedule */}
        <button type="button" onClick={handleScheduleBtn} className="pm-method" style={{
          padding:'11px 10px', borderRadius:12, cursor:'pointer',
          background: isScheduleActive ? T.indigoDim : 'transparent',
          border: `1.5px solid ${isScheduleActive ? T.indigo : T.border}`,
          display:'flex', flexDirection:'column', alignItems:'center', gap:5,
        }}>
          <Calendar size={13} color={isScheduleActive ? T.indigo : T.textMuted} strokeWidth={2}/>
          <span style={{ fontSize:11.5, fontWeight:700, color:isScheduleActive ? T.indigo : T.text, fontFamily:'Syne' }}>
            Schedule
          </span>
          {/* Show confirmed time when done, otherwise hint */}
          {step === 'done' && summary
            ? <span style={{ fontSize:9, color:T.indigo, fontWeight:600, fontFamily:'DM Sans', textAlign:'center', lineHeight:1.3 }}>
                {summary}
              </span>
            : <span style={{ fontSize:9.5, color:T.textMuted, fontWeight:500, fontFamily:'DM Sans' }}>
                {pickerOpen ? 'Cancel' : 'Pick time'}
              </span>
          }
        </button>
      </div>

      {/* ── Step: Calendar ── */}
      {step === 'cal' && (
        <div className="pm-in" style={{
          border:`1.5px solid ${T.indigoBorder}`,
          borderRadius:14, background:T.bgCard, overflow:'hidden',
        }}>
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'10px 14px 8px', borderBottom:`1px solid ${T.border}`,
          }}>
            <button type="button" onClick={prevMonth} className="pm-btn" style={{
              background:'none', border:'none', cursor:'pointer',
              color:T.textMid, padding:4, borderRadius:7, display:'flex', alignItems:'center',
            }}>
              <ChevronLeft size={14} strokeWidth={2.4}/>
            </button>
            <span style={{ fontFamily:'Syne', fontWeight:700, fontSize:12.5, color:T.text }}>
              {MONTHS[calMonth]} {calYear}
            </span>
            <button type="button" onClick={nextMonth} className="pm-btn" style={{
              background:'none', border:'none', cursor:'pointer',
              color:T.textMid, padding:4, borderRadius:7, display:'flex', alignItems:'center',
            }}>
              <ChevronRight size={14} strokeWidth={2.4}/>
            </button>
          </div>

          <div style={{ padding:'10px 12px 12px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:4 }}>
              {DAYS.map(d=>(
                <div key={d} style={{
                  textAlign:'center', fontSize:9.5, fontWeight:700,
                  color:T.textMuted, fontFamily:'DM Sans', padding:'3px 0',
                }}>{d}</div>
              ))}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
              {Array.from({length: firstDow}).map((_,i)=>(<div key={`e${i}`}/>))}
              {Array.from({length: daysInMo}, (_,i)=>i+1).map(d=>{
                const disabled = isDayDisabled(calYear, calMonth, d);
                const selected = isDaySelected(calYear, calMonth, d);
                const today    = isToday(calYear, calMonth, d);
                return (
                  <div
                    key={d}
                    className={`pm-cal-day${disabled?' disabled':''}`}
                    onClick={()=>!disabled && handleDayClick(d)}
                    style={{
                      textAlign:'center', padding:'6px 2px',
                      fontSize:11.5, fontWeight: today||selected ? 700 : 500,
                      fontFamily:'DM Mono',
                      color: disabled ? T.textMuted : selected ? '#000' : today ? T.indigo : T.text,
                      background: selected ? T.indigo : today && !selected ? T.indigoDim : 'transparent',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      opacity: disabled ? 0.35 : 1,
                      position:'relative',
                    }}
                  >
                    {d}
                    {today && !selected && (
                      <div style={{
                        position:'absolute', bottom:2, left:'50%',
                        transform:'translateX(-50%)',
                        width:3, height:3, borderRadius:'50%', background:T.indigo,
                      }}/>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{
            padding:'8px 14px', borderTop:`1px solid ${T.border}`,
            fontSize:10, color:T.textMuted, fontFamily:'DM Sans', fontWeight:500,
            display:'flex', alignItems:'center', gap:4,
          }}>
            <AlertCircle size={9} strokeWidth={2.4}/>
            Available 15 min – 7 days ahead
          </div>
        </div>
      )}

      {/* ── Step: Time ── */}
      {step === 'time' && selDay && (
        <div className="pm-in" style={{
          border:`1.5px solid ${T.indigoBorder}`,
          borderRadius:14, background:T.bgCard, overflow:'hidden',
        }}>
          <div style={{
            display:'flex', alignItems:'center', gap:8,
            padding:'10px 14px', borderBottom:`1px solid ${T.border}`,
          }}>
            <button type="button" onClick={()=>setStep('cal')} className="pm-btn" style={{
              background:'none', border:'none', cursor:'pointer',
              color:T.indigo, padding:0, display:'flex', alignItems:'center', gap:4,
            }}>
              <ChevronLeft size={13} strokeWidth={2.4}/>
              <span style={{ fontFamily:'DM Sans', fontSize:11, fontWeight:600, color:T.indigo }}>Back</span>
            </button>
            <span style={{ fontFamily:'Syne', fontSize:12, fontWeight:700, color:T.text }}>
              {selDay.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}
            </span>
          </div>

          <div style={{ padding:'10px 12px 12px' }}>
            {/* Hour grid */}
            <div style={{
              fontSize:9.5, fontWeight:700, color:T.textMuted,
              fontFamily:'DM Sans', letterSpacing:'.1em', textTransform:'uppercase', marginBottom:8,
            }}>Select Hour</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:4 }}>
              {hours.map(h => {
                const disabled = isHourDisabled(h);
                const selected = selHour === h;
                const label    = h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h-12}p`;
                return (
                  <div
                    key={h}
                    className={`pm-hour${selected?' selected-h':''}`}
                    onClick={()=>handleHourClick(h)}
                    style={{
                      textAlign:'center', padding:'7px 4px',
                      fontSize:11, fontFamily:'DM Mono', fontWeight:500,
                      color: disabled ? T.textMuted : selected ? '#000' : T.text,
                      background: selected ? T.indigo : 'transparent',
                      opacity: disabled ? 0.3 : 1,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      borderRadius:8,
                    }}
                  >
                    {label}
                  </div>
                );
              })}
            </div>

            {/* Minute chips — appear after hour is chosen */}
            {selHour !== null && (
              <div className="pm-in" style={{ marginTop:10 }}>
                <div style={{
                  fontSize:9.5, fontWeight:700, color:T.textMuted,
                  fontFamily:'DM Sans', letterSpacing:'.1em', textTransform:'uppercase', marginBottom:8,
                }}>Select Minute</div>
                <div style={{ display:'flex', gap:6 }}>
                  {[0, 15, 30, 45].map(m => {
                    const disabled = isHourDisabled(selHour, m);
                    const selected = selMinute === m;
                    return (
                      <button
                        key={m} type="button"
                        onClick={()=>handleMinuteClick(m)}
                        disabled={disabled}
                        className="pm-method"
                        style={{
                          flex:1, padding:'9px 0', borderRadius:10,
                          border:`1.5px solid ${selected ? T.indigo : T.border}`,
                          background: selected ? T.indigo : 'transparent',
                          cursor: disabled ? 'not-allowed' : 'pointer',
                          opacity: disabled ? 0.3 : 1,
                          fontFamily:'DM Mono', fontSize:12, fontWeight:600,
                          color: selected ? '#000' : T.text,
                        }}
                      >
                        :{pad(m)}
                      </button>
                    );
                  })}
                </div>
                <div style={{
                  marginTop:8, fontSize:10, color:T.textMuted,
                  fontFamily:'DM Sans', display:'flex', alignItems:'center', gap:4,
                }}>
                  <AlertCircle size={9} strokeWidth={2.4}/>
                  Tap a minute to confirm your schedule
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Promo Box ──────────────────────────────────────────
function PromoBox({ originalTotal, discount, setDiscount }) {
  const [code,    setCode]    = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [open,    setOpen]    = useState(false);

  const handleApply = async () => {
    if (!code.trim()) return;
    setError(''); setLoading(true);
    try {
      const { data } = await callValidatePromo({ code: code.trim().toUpperCase() });
      if (!data.valid) throw new Error(data.message || 'Invalid promo code.');
      const savings = data.discountType === 'percent'
        ? (originalTotal * data.discountValue) / 100
        : Math.min(data.discountValue, originalTotal);
      const newTotal = Math.max(0, originalTotal - savings).toFixed(2);
      setDiscount({ code: code.trim().toUpperCase(), savings: savings.toFixed(2), newTotal, discountType: data.discountType, discountValue: data.discountValue });
    } catch (err) {
      setError(err.message || 'Could not apply code.'); setDiscount(null);
    } finally { setLoading(false); }
  };

  const handleRemove = () => {
    setCode(''); setDiscount(null); setError(''); setOpen(false);
  };

  if (discount) {
    return (
      <div className="pm-in" style={{
        marginBottom:14, padding:'10px 13px',
        border:`1.5px solid ${T.borderGreen}`,
        borderRadius:12, background:T.greenDim,
        display:'flex', alignItems:'center', justifyContent:'space-between',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Sparkles size={13} color={T.green} strokeWidth={2}/>
          <div>
            <div style={{ fontFamily:'DM Mono', fontSize:12, fontWeight:600, color:T.green }}>{discount.code}</div>
            <div style={{ fontFamily:'DM Sans', fontSize:10, color:T.textMid }}>−${discount.savings} off</div>
          </div>
        </div>
        <button type="button" onClick={handleRemove} style={{
          background:'none', border:'none', cursor:'pointer', color:T.textMuted, padding:4,
        }}><X size={13}/></button>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={()=>setOpen(true)} className="pm-btn" style={{
        marginBottom:14, background:'none', border:`1px dashed ${T.border}`,
        borderRadius:10, padding:'9px 12px', cursor:'pointer', width:'100%',
        display:'flex', alignItems:'center', gap:7,
        color:T.textMuted, fontFamily:'DM Sans', fontSize:11.5, fontWeight:500,
      }}>
        <Tag size={12} strokeWidth={2}/> Have a promo code?
      </button>
    );
  }

  return (
    <div className="pm-in" style={{ marginBottom:14 }}>
      <div style={{
        display:'flex', gap:7,
        border:`1.5px solid ${error ? T.red : T.border}`,
        borderRadius:11, overflow:'hidden', background:T.bgCard,
      }}>
        <Tag size={13} color={T.textMuted} strokeWidth={2} style={{ margin:'auto 0 auto 12px', flexShrink:0 }}/>
        <input
          className="pm-input"
          placeholder="PROMO CODE"
          value={code}
          onChange={e=>{ setCode(e.target.value.toUpperCase()); setError(''); }}
          onKeyDown={e=>{ if(e.key==='Enter') handleApply(); }}
          maxLength={20}
          autoFocus
          style={{ letterSpacing:'.08em' }}
        />
        <button type="button" onClick={handleApply} disabled={!code.trim()||loading} className="pm-btn" style={{
          padding:'0 14px', background: code.trim()&&!loading ? T.green : T.bgHighlight,
          border:'none', cursor: !code.trim()||loading ? 'not-allowed' : 'pointer',
          fontFamily:'DM Sans', fontWeight:700, fontSize:12,
          color: code.trim()&&!loading ? '#000' : T.textMuted,
          flexShrink:0, minWidth:56, display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          {loading ? <Loader2 size={13} className="spin"/> : 'Apply'}
        </button>
      </div>
      {error && (
        <div style={{ marginTop:6, display:'flex', alignItems:'center', gap:5, fontSize:11, color:T.red, fontFamily:'DM Sans' }}>
          <AlertCircle size={10} strokeWidth={2.4}/>{error}
        </div>
      )}
    </div>
  );
}

// ── Card Form ──────────────────────────────────────────
function CardForm({ uid, bookingPayload, total, onSuccess, onError }) {
  const stripe   = useStripe();
  const elements = useElements();
  const [loading,  setLoading]  = useState(false);
  const [complete, setComplete] = useState(false);
  const [error,    setError]    = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    if (!stripe || !elements) return;
    setLoading(true);
    try {
      const card = elements.getElement(CardElement);
      const { error: ce, paymentMethod } = await stripe.createPaymentMethod({ type:'card', card });
      if (ce) throw new Error(ce.message);
      const { data } = await callCardPayment({ uid, paymentMethodId: paymentMethod.id, bookingPayload });
      if (data.requiresAction && data.clientSecret) {
        const { error: ae, paymentIntent } = await stripe.handleCardAction(data.clientSecret);
        if (ae) throw new Error(ae.message);
        if (paymentIntent?.status !== 'succeeded') throw new Error('Payment not completed.');
        return onSuccess?.({ method:'card', rideId:data.rideId, paymentIntent: paymentIntent.id });
      }
      if (!data.success) throw new Error(data.message || 'Payment failed.');
      onSuccess?.({ method:'card', rideId:data.rideId, paymentIntent: data.paymentIntent||null });
    } catch (err) {
      const m = err.message||'Payment failed'; setError(m); onError?.(m);
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{
        border:`1.5px solid ${error ? T.red : T.borderMid}`,
        borderRadius:12, padding:'12px 14px',
        background:T.bgCard, marginBottom:10,
        transition:'border-color .2s',
      }}>
        <div style={{
          display:'flex', alignItems:'center', gap:5,
          fontSize:9.5, fontWeight:700, color:T.textMuted,
          letterSpacing:'.1em', textTransform:'uppercase',
          fontFamily:'DM Sans', marginBottom:10,
        }}>
          <Lock size={10} strokeWidth={2.4}/> Card Details
        </div>
        <CardElement options={CARD_OPTIONS} onChange={e=>{ setComplete(e.complete); setError(e.error?.message||''); }}/>
      </div>
      {error && (
        <div style={{
          padding:'9px 11px', borderRadius:9,
          background:T.redDim, border:`1px solid rgba(248,113,113,.25)`,
          color:T.red, fontSize:11.5, fontWeight:500, marginBottom:10,
          display:'flex', alignItems:'center', gap:6, fontFamily:'DM Sans',
        }}>
          <AlertCircle size={12} strokeWidth={2.4}/>{error}
        </div>
      )}
      <CTA
        loading={loading} disabled={!stripe||!complete||loading}
        loadingText="Processing…" color={T.green} gFrom="#22C55E" gTo="#15803D"
      >
        <Lock size={14} strokeWidth={2.6}/> Pay ${total}
      </CTA>
      <SecureNote/>
    </form>
  );
}

// ── CTA button ─────────────────────────────────────────
function CTA({ loading, disabled, loadingText, color, gFrom, gTo, onClick, children }) {
  return (
    <button
      type={onClick ? 'button' : 'submit'}
      onClick={onClick} disabled={disabled}
      className="pm-btn"
      style={{
        width:'100%', padding:'15px 20px', borderRadius:14, border:'none',
        background: disabled ? T.bgHighlight : `linear-gradient(135deg,${gFrom},${gTo})`,
        color: disabled ? T.textMuted : '#000',
        fontFamily:'Syne', fontWeight:800, fontSize:14,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display:'flex', alignItems:'center', justifyContent:'center', gap:8,
        boxShadow: disabled ? 'none' : `0 8px 24px ${color}30`,
        letterSpacing:'-0.2px',
      }}
    >
      {loading ? (<><Loader2 size={15} className="spin"/>{loadingText}</>) : children}
    </button>
  );
}

function SecureNote() {
  return (
    <div style={{
      marginTop:9, display:'flex', alignItems:'center', justifyContent:'center', gap:5,
      fontSize:10.5, color:T.textMuted, fontWeight:500, fontFamily:'DM Sans',
    }}>
      <ShieldCheck size={10} strokeWidth={2.4}/> Secured by Stripe · 256-bit TLS
    </div>
  );
}

// ── Inner Modal ────────────────────────────────────────
function PaymentModalInner({ uid, bookingPayload, selectedPayment, setSelectedPayment, onClose, onSuccess }) {
  const stripe = useStripe();
  const [cashLoading,    setCashLoading]    = useState(false);
  const [cashAppLoading, setCashAppLoading] = useState(false);
  const [topError,       setTopError]       = useState('');
  const [scheduledAt,    setScheduledAt]    = useState(null);
  const [discount,       setDiscount]       = useState(null);

  const baseTotal = useMemo(()=> Number(bookingPayload?.fareEstimate||0), [bookingPayload]);
  const total     = useMemo(()=>{
    if (discount?.newTotal !== undefined) return Number(discount.newTotal).toFixed(2);
    return baseTotal.toFixed(2);
  }, [baseTotal, discount]);

  const rideType    = bookingPayload?.rideType          ?? 'standard';
  const miles       = bookingPayload?.tripDistanceMiles ?? 0;
  const durationMin = bookingPayload?.tripDurationMin   ?? 0;
  const rideLabel   = rideType.charAt(0).toUpperCase() + rideType.slice(1);

  const finalPayload = useMemo(()=>({
    ...bookingPayload,
    fareEstimate: total,
    ...(scheduledAt ? { scheduledAt, isScheduled:true } : { isScheduled:false }),
    ...(discount    ? { promoCode:discount.code, discountAmount:discount.savings } : {}),
  }), [bookingPayload, total, scheduledAt, discount]);

  const scheduleLabel = useMemo(()=>{
    if (!scheduledAt) return null;
    return new Date(scheduledAt).toLocaleString('en-US',{
      month:'short', day:'numeric', hour:'numeric', minute:'2-digit', hour12:true,
    });
  }, [scheduledAt]);

  const handleCashApp = async () => {
    setTopError(''); setCashAppLoading(true);
    try {
      const { data } = await callCashAppPayment({ uid, bookingPayload: finalPayload });
      if (!data.clientSecret) throw new Error(data.message||'Failed to initiate Cash App payment.');
      const { error: se } = await stripe.confirmCashappPayment(data.clientSecret, {
        payment_method:{ cashapp:{} },
        return_url: `${window.location.origin}`,
      });
      if (se) throw new Error(se.message||'Cash App payment failed.');
      onSuccess?.({ method:'cashapp', rideId: data.rideId });
    } catch(err) { setTopError(err.message||'Cash App payment failed.'); }
    finally { setCashAppLoading(false); }
  };

  const handleCash = async () => {
    setTopError(''); setCashLoading(true);
    try {
      const { data } = await callCashPayment({ uid, bookingPayload: finalPayload });
      if (!data.success) throw new Error(data.message||'Failed to book cash ride.');
      onSuccess?.({ method:'cash', rideId: data.rideId });
      onClose?.();
    } catch(err) { setTopError(err.message||'Cash booking failed.'); }
    finally { setCashLoading(false); }
  };

  return (
    <>
      <style>{CSS}</style>

      {/* Backdrop */}
      <div onClick={onClose} className="pm-fade" style={{
        position:'fixed', inset:0, minHeight:'100dvh',
        background:'rgba(0,0,0,.72)',
        backdropFilter:'blur(10px)', WebkitBackdropFilter:'blur(10px)',
        display:'flex', flexDirection:'column',
        justifyContent:'flex-end', alignItems:'center', zIndex:999,
      }}>
        {/* Sheet */}
        <div className="pm-sheet" onClick={e=>e.stopPropagation()} style={{
          width:'100%', maxWidth:520, maxHeight:'92dvh',
          background:T.bg,
          borderRadius:'24px 24px 0 0',
          paddingTop:12,
          paddingBottom:'max(env(safe-area-inset-bottom,0px),20px)',
          boxShadow:'0 -24px 80px rgba(0,0,0,.6)',
          display:'flex', flexDirection:'column',
          overflow:'hidden',
          border:`1px solid ${T.border}`,
          borderBottom:'none',
        }}>
          {/* Handle */}
          <div style={{ padding:'0 0 14px' }}>
            <div style={{ width:36, height:3.5, background:T.textMuted, borderRadius:99, margin:'0 auto', opacity:.4 }}/>
          </div>

          {/* Header */}
          <div style={{
            padding:'0 20px 14px',
            borderBottom:`1px solid ${T.border}`,
            background:T.bg,
          }}>
            {/* Close */}
            <button onClick={onClose} aria-label="Close" style={{
              position:'absolute', top:18, right:18,
              width:32, height:32, borderRadius:9,
              border:`1px solid ${T.border}`, background:T.bgCard, color:T.textMid,
              display:'flex', alignItems:'center', justifyContent:'center',
              cursor:'pointer',
            }}>
              <X size={14}/>
            </button>

            {/* Amount */}
            <div style={{ display:'flex', alignItems:'baseline', gap:8, marginBottom:5 }}>
              <span style={{
                fontFamily:'DM Mono', fontSize:40, fontWeight:500,
                color:T.text, letterSpacing:'-1.5px', lineHeight:1,
              }}>
                ${total}
              </span>
              {discount && (
                <span style={{
                  fontFamily:'DM Mono', fontSize:18, fontWeight:400,
                  color:T.textMuted, textDecoration:'line-through',
                }}>
                  ${baseTotal.toFixed(2)}
                </span>
              )}
              <span style={{ fontSize:11, color:T.textMuted, fontFamily:'DM Sans', fontWeight:500 }}>USD</span>
            </div>

            {/* Chips row */}
            <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
              <Chip color={T.green} colorBg={T.greenDim} border={T.borderGreen}>{rideLabel}</Chip>
              <Chip color={T.textMid} icon={<MapPin size={9} strokeWidth={2.5}/>}>{miles} mi</Chip>
              <Chip color={T.textMid} icon={<Clock size={9} strokeWidth={2.5}/>}>~{durationMin} min</Chip>
              {scheduledAt && (
                <Chip color={T.indigo} colorBg={T.indigoDim} border={T.indigoBorder} icon={<Calendar size={9} strokeWidth={2.4}/>}>
                  {scheduleLabel}
                </Chip>
              )}
              {discount && (
                <Chip color={T.green} colorBg={T.greenDim} border={T.borderGreen} icon={<Sparkles size={9} strokeWidth={2}/>}>
                  −${discount.savings}
                </Chip>
              )}
            </div>
          </div>

          {/* Scrollable body */}
          <div className="pm-scroll" style={{ flex:1, padding:'16px 20px 24px' }}>

            {topError && (
              <div style={{
                marginBottom:14, padding:'10px 12px', borderRadius:10,
                background:T.redDim, border:`1px solid rgba(248,113,113,.2)`,
                color:T.red, fontSize:12, fontWeight:500,
                display:'flex', alignItems:'flex-start', gap:7, fontFamily:'DM Sans',
              }}>
                <AlertCircle size={13} strokeWidth={2.2} style={{flexShrink:0, marginTop:1}}/>{topError}
              </div>
            )}

            {/* ── Schedule ── */}
            <SchedulePicker scheduledAt={scheduledAt} onChange={setScheduledAt}/>

            {/* ── Promo ── */}
            <PromoBox originalTotal={baseTotal} discount={discount} setDiscount={setDiscount}/>

            {/* ── Divider ── */}
            <div style={{ height:1, background:T.border, marginBottom:16 }}/>

            {/* ── Method selector ── */}
            <Label>Pay With</Label>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:7, marginBottom:18 }}>
              {METHODS.map(opt => {
                const active = selectedPayment === opt.id;
                return (
                  <button
                    key={opt.id} type="button"
                    className="pm-method"
                    onClick={()=>{ setTopError(''); setSelectedPayment(opt.id); }}
                    style={{
                      padding:'12px 8px', borderRadius:12, cursor:'pointer',
                      background: active ? `${opt.color}12` : T.bgCard,
                      border:`1.5px solid ${active ? opt.color : T.border}`,
                      boxShadow: active ? `0 4px 16px ${opt.color}25` : 'none',
                      display:'flex', flexDirection:'column', alignItems:'center', gap:6,
                      position:'relative',
                    }}
                  >
                    {active && (
                      <div style={{
                        position:'absolute', top:-6, right:-6,
                        width:18, height:18, borderRadius:'50%',
                        background:opt.color, border:'2px solid '+T.bg,
                        display:'flex', alignItems:'center', justifyContent:'center',
                      }}>
                        <Check size={9} color="#000" strokeWidth={3.5}/>
                      </div>
                    )}
                    {opt.id === 'card' && <CreditCard size={18} color={active ? opt.color : T.textMuted} strokeWidth={active?2.4:2}/>}
                    {opt.id === 'cashapp' && <CashAppLogo size={20}/>}
                    {opt.id === 'cash' && <Banknote size={18} color={active ? opt.color : T.textMuted} strokeWidth={active?2.4:2}/>}
                    <span style={{ fontSize:11.5, fontWeight:700, color:active ? opt.color : T.text, fontFamily:'Syne' }}>
                      {opt.label}
                    </span>
                    <span style={{ fontSize:9.5, color:T.textMuted, fontFamily:'DM Sans', fontWeight:500, marginTop:-3 }}>
                      {opt.sub}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* ── Method panels ── */}
            <div className="pm-in" key={selectedPayment}>

              {selectedPayment === 'card' && (
                <CardForm uid={uid} bookingPayload={finalPayload} total={total}
                  onSuccess={r=>{ onSuccess?.(r); onClose?.(); }}
                  onError={m=>setTopError(m)}
                />
              )}

              {selectedPayment === 'cashapp' && (
                <>
                  <div style={{
                    background:T.bgCard, border:`1px solid ${T.border}`,
                    borderRadius:12, padding:'12px 14px', marginBottom:10,
                    display:'flex', alignItems:'center', gap:10,
                  }}>
                    <CashAppLogo size={30}/>
                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily:'Syne', fontSize:13, fontWeight:700, color:T.text, marginBottom:2 }}>
                        Pay with Cash App
                      </div>
                      <div style={{ fontFamily:'DM Sans', fontSize:11, color:T.textMid }}>
                        You'll confirm in the Cash App
                      </div>
                    </div>
                    <ChevronRight size={14} color={T.textMuted}/>
                  </div>
                  <CTA loading={cashAppLoading} disabled={cashAppLoading}
                    loadingText="Opening Cash App…" onClick={handleCashApp}
                    color={T.cashApp} gFrom="#00E03A" gTo="#00B82B"
                  >
                    <CashAppLogo size={16}/>
                    Continue to Cash App
                    <ArrowRight size={13} strokeWidth={2.6}/>
                  </CTA>
                  <SecureNote/>
                </>
              )}

              {selectedPayment === 'cash' && (
                <>
                  <div style={{
                    background:T.amberDim, border:`1px solid ${T.amberBorder}`,
                    borderRadius:12, padding:'12px 14px', marginBottom:10,
                  }}>
                    <div style={{ display:'flex', alignItems:'flex-start', gap:9, marginBottom:10 }}>
                      <Banknote size={16} color={T.amber} strokeWidth={2.2} style={{flexShrink:0, marginTop:1}}/>
                      <div>
                        <div style={{ fontFamily:'Syne', fontSize:13, fontWeight:700, color:T.amber, marginBottom:2 }}>
                          Pay your driver in cash
                        </div>
                        <div style={{ fontFamily:'DM Sans', fontSize:11.5, color:'rgba(245,158,11,.8)', lineHeight:1.5 }}>
                          Have <strong style={{ fontFamily:'DM Mono', color:T.amber }}>${total}</strong> ready on arrival. Exact change appreciated.
                        </div>
                      </div>
                    </div>
                    <div style={{
                      display:'grid', gridTemplateColumns:'1fr 1fr', gap:8,
                      paddingTop:10, borderTop:`1px solid rgba(245,158,11,.15)`,
                    }}>
                      <div>
                        <div style={{ fontSize:9.5, fontWeight:700, color:T.amber, letterSpacing:'.08em', textTransform:'uppercase', fontFamily:'DM Sans', marginBottom:3 }}>
                          Amount Due
                        </div>
                        <div style={{ fontFamily:'DM Mono', fontSize:18, fontWeight:500, color:T.amber }}>${total}</div>
                      </div>
                      <div>
                        <div style={{ fontSize:9.5, fontWeight:700, color:T.amber, letterSpacing:'.08em', textTransform:'uppercase', fontFamily:'DM Sans', marginBottom:3 }}>
                          When
                        </div>
                        <div style={{ fontFamily:'DM Sans', fontSize:12, fontWeight:600, color:T.amber }}>
                          {scheduledAt ? 'On driver arrival' : 'Driver arrival'}
                        </div>
                      </div>
                    </div>
                  </div>
                  <CTA loading={cashLoading} disabled={cashLoading}
                    loadingText="Booking ride…" onClick={handleCash}
                    color={T.amber} gFrom="#F59E0B" gTo="#B45309"
                  >
                    <Banknote size={15} strokeWidth={2.4}/>
                    {scheduledAt ? `Schedule · $${total}` : `Confirm Cash · $${total}`}
                  </CTA>
                  <div style={{
                    marginTop:9, display:'flex', alignItems:'center', justifyContent:'center', gap:5,
                    fontSize:10.5, color:T.textMuted, fontFamily:'DM Sans',
                  }}>
                    <ShieldCheck size={10} strokeWidth={2.4}/>
                    Driver matched after confirming
                  </div>
                </>
              )}

            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Micro components ───────────────────────────────────
function Label({ children }) {
  return (
    <div style={{
      fontSize:9.5, fontWeight:700, color:T.textMuted,
      letterSpacing:'.12em', textTransform:'uppercase',
      fontFamily:'DM Sans', marginBottom:9,
    }}>{children}</div>
  );
}

function Chip({ children, color, colorBg, border, icon }) {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4,
      padding:'3px 8px', borderRadius:99,
      background: colorBg || 'transparent',
      border: `1px solid ${border || 'rgba(255,255,255,0.1)'}`,
      fontSize:10.5, fontWeight:600,
      color: color || T.textMid,
      fontFamily:'DM Sans',
    }}>
      {icon}{children}
    </span>
  );
}

// ── Default export ─────────────────────────────────────
export default function PaymentModal(props) {
  return (
    <Elements stripe={stripePromise}>
      <PaymentModalInner {...props}/>
    </Elements>
  );
}
