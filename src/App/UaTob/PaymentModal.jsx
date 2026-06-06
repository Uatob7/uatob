// src/App/PaymentModal.jsx
import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  X, CreditCard, Check, Loader2, ShieldCheck, Wallet,
  Smartphone, Banknote, Lock, ChevronRight, Receipt,
  ArrowRight, Clock, MapPin, CalendarClock, Tag, ChevronDown,
  Calendar, AlertCircle, Sparkles,
} from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebase_app } from '@/firebase/config';

// ── Callables ─────────────────────────────────────────────────────────
const functions          = getFunctions(firebase_app, "us-east1");
const callCardPayment    = httpsCallable(functions, "cardPayment");
const callCashAppPayment = httpsCallable(functions, "cashAppPayment");
const callCashPayment    = httpsCallable(functions, "cashPayment");
const callValidatePromo  = httpsCallable(functions, "validatePromoCode"); // new

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

/* ── Theme ───────────────────────────────────────────── */
const T = {
  text:        '#0F172A',
  textMid:     '#475569',
  textMuted:   '#94A3B8',
  border:      '#E5E7EB',
  borderSoft:  '#F1F5F9',
  surface:     '#FFFFFF',
  surfaceAlt:  '#F8FAFC',
  green:       '#16A34A',
  greenDark:   '#15803D',
  greenLight:  '#F0FDF4',
  greenBorder: '#BBF7D0',
  amber:       '#D97706',
  amberLight:  '#FFFBEB',
  cashApp:     '#00D632',
  indigo:      '#4F46E5',
  indigoLight: '#EEF2FF',
  indigoBorder:'#C7D2FE',
};

/* ── Payment Methods ─────────────────────────────────── */
const PAYMENT_METHODS = [
  { id: 'card',    label: 'Card',     sub: 'Credit / Debit', color: T.green   },
  { id: 'cashapp', label: 'Cash App', sub: '$cashtag',       color: T.cashApp },
  { id: 'cash',    label: 'Cash',     sub: 'Pay in person',  color: T.amber   },
];

/* ── Card Element Options ────────────────────────────── */
const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: '#0F172A',
      fontFamily: '"Outfit", system-ui, sans-serif',
      fontSize: '16px',
      fontSmoothing: 'antialiased',
      '::placeholder': { color: '#94A3B8' },
      iconColor: '#16A34A',
    },
    invalid: { color: '#DC2626', iconColor: '#DC2626' },
  },
  hidePostalCode: true,
};

/* ── Helpers ─────────────────────────────────────────── */
function CashAppLogo({ size = 22, color = '#fff', bgColor = T.cashApp }) {
  return (
    <div style={{
      width: size, height: size,
      background: bgColor,
      borderRadius: size * 0.22,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <span style={{
        fontSize: size * 0.7, fontWeight: 900, color,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        lineHeight: 1, marginTop: -size * 0.04,
      }}>$</span>
    </div>
  );
}

function MethodIcon({ id, color, size = 20, active }) {
  if (id === 'card')    return <CreditCard size={size} color={color} strokeWidth={active ? 2.4 : 2}/>;
  if (id === 'cashapp') return <CashAppLogo size={size + 2} bgColor={active ? T.cashApp : '#94A3B8'}/>;
  if (id === 'cash')    return <Banknote   size={size} color={color} strokeWidth={active ? 2.4 : 2}/>;
  return null;
}

/* ── Fare Breakdown ──────────────────────────────────── */
function FareBreakdown({ payload, expanded }) {
  if (!expanded || !payload?.breakdown) return null;
  const items = Array.isArray(payload.breakdown)
    ? payload.breakdown
    : Object.entries(payload.breakdown).map(([key, val]) => ({ key, ...val }));
  return (
    <div style={{
      marginTop: 10, padding: '12px 14px',
      background: 'rgba(255,255,255,0.7)',
      border: `1px solid rgba(22,163,74,0.15)`,
      borderRadius: 12,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      {items.filter(it => Number(it.amount) > 0 || it.key === 'minimumFareNote').map((it, i) => (
        <div key={it.key ?? i} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: 12,
          color: it.key === 'minimumFareNote' ? T.green : T.textMid,
          fontWeight: it.key === 'minimumFareNote' ? 700 : 500,
        }}>
          <span>
            {it.label}
            {it.note && <span style={{ color: T.textMuted, marginLeft: 4, fontWeight: 500 }}>· {it.note}</span>}
          </span>
          <span style={{ fontFamily: '"JetBrains Mono",monospace', fontWeight: 700, color: it.amount === 0 ? T.textMuted : T.text }}>
            {it.amount === 0 ? '—' : `$${Number(it.amount).toFixed(2)}`}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Schedule Picker ─────────────────────────────────── */
function SchedulePicker({ scheduledAt, onChange }) {
  // Build min datetime = now + 15 min
  const minDate = useMemo(() => {
    const d = new Date(Date.now() + 15 * 60 * 1000);
    // format for datetime-local input: YYYY-MM-DDTHH:mm
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, []);

  // Build max = 7 days from now
  const maxDate = useMemo(() => {
    const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, []);

  const formatted = useMemo(() => {
    if (!scheduledAt) return null;
    return new Date(scheduledAt).toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  }, [scheduledAt]);

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Section label */}
      <div style={{
        fontSize: 10.5, fontWeight: 700,
        color: T.textMid,
        letterSpacing: '.12em',
        textTransform: 'uppercase',
        marginBottom: 10,
        display: 'flex', alignItems: 'center', gap: 5,
      }}>
        <CalendarClock size={11} strokeWidth={2.4}/>
        Pickup Time
      </div>

      {/* Toggle row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
        marginBottom: scheduledAt ? 10 : 0,
      }}>
        {/* Ride Now */}
        <button
          type="button"
          onClick={() => onChange(null)}
          style={{
            padding: '12px 10px',
            borderRadius: 12,
            border: `1.5px solid ${!scheduledAt ? T.green : T.border}`,
            background: !scheduledAt ? T.greenLight : T.surface,
            cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
            transition: 'all .18s',
          }}
        >
          {!scheduledAt && (
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: T.green,
              boxShadow: `0 0 0 3px ${T.greenBorder}`,
              animation: 'pulse 2s infinite',
            }}/>
          )}
          {scheduledAt && <Clock size={15} color={T.textMuted} strokeWidth={2}/>}
          <span style={{
            fontSize: 12, fontWeight: 800,
            color: !scheduledAt ? T.greenDark : T.text,
          }}>Ride Now</span>
          <span style={{ fontSize: 10, color: T.textMuted, fontWeight: 500 }}>Depart ASAP</span>
        </button>

        {/* Schedule */}
        <button
          type="button"
          onClick={() => {
            if (!scheduledAt) {
              // default to now + 1 hour, rounded to nearest 15
              const d = new Date(Date.now() + 60 * 60 * 1000);
              d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
              onChange(d.toISOString());
            }
          }}
          style={{
            padding: '12px 10px',
            borderRadius: 12,
            border: `1.5px solid ${scheduledAt ? T.indigo : T.border}`,
            background: scheduledAt ? T.indigoLight : T.surface,
            cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
            transition: 'all .18s',
          }}
        >
          <Calendar size={15} color={scheduledAt ? T.indigo : T.textMuted} strokeWidth={2}/>
          <span style={{
            fontSize: 12, fontWeight: 800,
            color: scheduledAt ? T.indigo : T.text,
          }}>Schedule</span>
          <span style={{ fontSize: 10, color: T.textMuted, fontWeight: 500 }}>Pick date & time</span>
        </button>
      </div>

      {/* DateTime input — only shown when scheduled */}
      {scheduledAt !== null && (
        <div style={{
          border: `1.5px solid ${T.indigoBorder}`,
          borderRadius: 12,
          overflow: 'hidden',
          background: T.indigoLight,
          animation: 'scaleIn .2s ease',
        }}>
          {/* Formatted preview */}
          {formatted && (
            <div style={{
              padding: '10px 14px 0',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <CalendarClock size={13} color={T.indigo} strokeWidth={2.2}/>
              <span style={{
                fontSize: 12.5, fontWeight: 700,
                color: T.indigo,
              }}>
                {formatted}
              </span>
            </div>
          )}
          <div style={{ padding: '8px 14px 12px' }}>
            <input
              type="datetime-local"
              min={minDate}
              max={maxDate}
              value={scheduledAt ? scheduledAt.slice(0, 16) : ''}
              onChange={e => {
                if (e.target.value) {
                  onChange(new Date(e.target.value).toISOString());
                }
              }}
              style={{
                width: '100%',
                border: 'none',
                background: 'transparent',
                fontFamily: '"Outfit", system-ui, sans-serif',
                fontSize: 13,
                fontWeight: 600,
                color: T.text,
                outline: 'none',
                cursor: 'pointer',
                colorScheme: 'light',
              }}
            />
          </div>
          <div style={{
            padding: '8px 14px',
            borderTop: `1px solid ${T.indigoBorder}`,
            fontSize: 10.5, color: T.indigo, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <AlertCircle size={10} strokeWidth={2.4}/>
            Schedulable up to 7 days ahead · min 15 min from now
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Promo Code Box ──────────────────────────────────── */
function PromoBox({ originalTotal, onDiscountApplied, discount, setDiscount }) {
  const [code,        setCode]        = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [applied,     setApplied]     = useState(false); // code successfully applied
  const inputRef = useRef(null);

  const handleApply = async () => {
    if (!code.trim()) return;
    setError('');
    setLoading(true);
    try {
      const { data } = await callValidatePromo({ code: code.trim().toUpperCase() });
      if (!data.valid) throw new Error(data.message || 'Invalid promo code.');

      // data.discountType: 'percent' | 'flat'
      // data.discountValue: number
      const raw = originalTotal;
      let savings = 0;
      if (data.discountType === 'percent') {
        savings = (raw * data.discountValue) / 100;
      } else {
        savings = Math.min(data.discountValue, raw);
      }
      const newTotal = Math.max(0, raw - savings).toFixed(2);

      setDiscount({ code: code.trim().toUpperCase(), savings: savings.toFixed(2), newTotal, discountType: data.discountType, discountValue: data.discountValue });
      setApplied(true);
      onDiscountApplied?.({ code: code.trim().toUpperCase(), newTotal, savings: savings.toFixed(2) });
    } catch (err) {
      setError(err.message || 'Could not apply code.');
      setDiscount(null);
      setApplied(false);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = () => {
    setCode('');
    setDiscount(null);
    setApplied(false);
    setError('');
    onDiscountApplied?.(null);
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 10.5, fontWeight: 700,
        color: T.textMid,
        letterSpacing: '.12em',
        textTransform: 'uppercase',
        marginBottom: 10,
        display: 'flex', alignItems: 'center', gap: 5,
      }}>
        <Tag size={11} strokeWidth={2.4}/>
        Promo Code
      </div>

      {/* Applied state */}
      {applied && discount ? (
        <div style={{
          border: `1.5px solid ${T.greenBorder}`,
          borderRadius: 12,
          background: T.greenLight,
          padding: '12px 14px',
          animation: 'scaleIn .2s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 26, height: 26, borderRadius: 8,
                background: T.green,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Sparkles size={13} color="#fff" strokeWidth={2.2}/>
              </div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 800, color: T.greenDark }}>
                  {discount.code}
                </div>
                <div style={{ fontSize: 10.5, color: T.green, fontWeight: 600 }}>
                  {discount.discountType === 'percent'
                    ? `${discount.discountValue}% off applied`
                    : `$${discount.savings} off applied`}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRemove}
              style={{
                background: 'none', border: 'none',
                cursor: 'pointer', padding: 4,
                color: T.textMuted, borderRadius: 6,
                display: 'flex', alignItems: 'center',
              }}
            >
              <X size={14}/>
            </button>
          </div>

          {/* Savings row */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            paddingTop: 8,
            borderTop: `1px solid ${T.greenBorder}`,
          }}>
            <span style={{ fontSize: 11.5, color: T.green, fontWeight: 600 }}>You save</span>
            <span style={{
              fontFamily: '"JetBrains Mono",monospace',
              fontSize: 13, fontWeight: 800,
              color: T.greenDark,
            }}>
              −${discount.savings}
            </span>
          </div>
        </div>
      ) : (
        /* Input state */
        <div>
          <div style={{
            display: 'flex', gap: 8,
          }}>
            <div style={{
              flex: 1,
              border: `1.5px solid ${error ? '#FCA5A5' : T.border}`,
              borderRadius: 11,
              background: T.surface,
              display: 'flex', alignItems: 'center',
              padding: '0 12px',
              gap: 7,
              transition: 'border-color .18s',
            }}>
              <Tag size={13} color={code ? T.text : T.textMuted} strokeWidth={2}/>
              <input
                ref={inputRef}
                type="text"
                placeholder="Enter code"
                value={code}
                onChange={e => {
                  setCode(e.target.value.toUpperCase());
                  setError('');
                }}
                onKeyDown={e => { if (e.key === 'Enter') handleApply(); }}
                maxLength={20}
                style={{
                  flex: 1,
                  border: 'none', outline: 'none',
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: 13, fontWeight: 700,
                  color: T.text,
                  background: 'transparent',
                  letterSpacing: '.05em',
                  padding: '12px 0',
                }}
              />
              {code && (
                <button
                  type="button"
                  onClick={() => { setCode(''); setError(''); inputRef.current?.focus(); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textMuted, padding: 2 }}
                >
                  <X size={13}/>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleApply}
              disabled={!code.trim() || loading}
              style={{
                padding: '0 16px',
                borderRadius: 11,
                border: 'none',
                background: code.trim() && !loading
                  ? `linear-gradient(135deg, #22C55E, #15803D)`
                  : T.borderSoft,
                color: code.trim() && !loading ? '#fff' : T.textMuted,
                fontFamily: '"Outfit", system-ui, sans-serif',
                fontWeight: 800,
                fontSize: 13,
                cursor: !code.trim() || loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
                whiteSpace: 'nowrap',
                transition: 'all .18s',
                minWidth: 72,
                justifyContent: 'center',
              }}
            >
              {loading ? <Loader2 size={14} className="spin"/> : 'Apply'}
            </button>
          </div>

          {error && (
            <div style={{
              marginTop: 7,
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 11.5, fontWeight: 600, color: '#B91C1C',
            }}>
              <AlertCircle size={11} strokeWidth={2.4}/>
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Card Form ───────────────────────────────────────── */
function CardForm({ uid, bookingPayload, total, onSuccess, onError }) {
  const stripe   = useStripe();
  const elements = useElements();
  const [loading,      setLoading]      = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [error,        setError]        = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!stripe || !elements) return;
    setLoading(true);
    try {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) throw new Error('Card not ready.');
      const { error: createError, paymentMethod } =
        await stripe.createPaymentMethod({ type: 'card', card: cardElement });
      if (createError) throw new Error(createError.message);

      const { data } = await callCardPayment({ uid, paymentMethodId: paymentMethod.id, bookingPayload });

      if (data.requiresAction && data.clientSecret) {
        const { error: actionError, paymentIntent } = await stripe.handleCardAction(data.clientSecret);
        if (actionError) throw new Error(actionError.message);
        if (paymentIntent?.status !== 'succeeded') throw new Error('Payment not completed.');
        return onSuccess?.({ method: 'card', rideId: data.rideId, paymentIntent: paymentIntent.id });
      }
      if (!data.success) throw new Error(data.message || 'Payment failed.');
      onSuccess?.({ method: 'card', rideId: data.rideId, paymentIntent: data.paymentIntent || null });
    } catch (err) {
      const msg = err.message || 'Payment failed';
      setError(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{
        border: `1.5px solid ${error ? '#FCA5A5' : T.borderSoft}`,
        borderRadius: 14, padding: '14px 16px',
        background: T.surface, marginBottom: 12, transition: 'border-color .2s',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 10.5, fontWeight: 700, color: T.textMid,
          letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 10,
        }}>
          <Lock size={11} strokeWidth={2.4}/>
          Card Information
        </div>
        <CardElement
          options={CARD_ELEMENT_OPTIONS}
          onChange={(e) => { setCardComplete(e.complete); setError(e.error?.message || ''); }}
        />
      </div>

      {error && (
        <div style={{
          padding: '10px 12px', borderRadius: 10,
          background: '#FEF2F2', border: '1px solid #FECACA',
          color: '#B91C1C', fontSize: 12, fontWeight: 600,
          marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span>⚠</span>{error}
        </div>
      )}

      <PrimaryCTA
        loading={loading}
        disabled={!stripe || !cardComplete || loading}
        loadingText="Processing payment…"
        color={T.green}
        gradientFrom="#22C55E"
        gradientTo="#15803D"
      >
        <Lock size={15} strokeWidth={2.6}/>
        Pay ${total}
      </PrimaryCTA>
      <SecurityFootnote/>
    </form>
  );
}

/* ── Unified Primary CTA ─────────────────────────────── */
function PrimaryCTA({
  loading, disabled, loadingText = "Processing…",
  color = T.green, gradientFrom = "#22C55E", gradientTo = "#15803D",
  onClick, children,
}) {
  return (
    <button
      type={onClick ? "button" : "submit"}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%', padding: '17px 22px', borderRadius: 16, border: 'none',
        background: disabled ? '#E2E8F0' : `linear-gradient(135deg,${gradientFrom},${gradientTo})`,
        color: disabled ? T.textMuted : '#fff',
        fontFamily: '"Outfit",system-ui,sans-serif', fontWeight: 800, fontSize: 15,
        letterSpacing: '-0.1px', cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
        boxShadow: disabled ? 'none' : `0 10px 28px ${color}45`,
        transition: 'transform .12s, box-shadow .15s',
      }}
      onMouseDown={e => { if (!disabled) e.currentTarget.style.transform = 'scale(.985)'; }}
      onMouseUp={e   => { e.currentTarget.style.transform = ''; }}
    >
      {loading ? (<><Loader2 size={17} className="spin"/>{loadingText}</>) : children}
    </button>
  );
}

function SecurityFootnote() {
  return (
    <div style={{
      marginTop: 10,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      fontSize: 11, color: T.textMuted, fontWeight: 500,
    }}>
      <ShieldCheck size={11} strokeWidth={2.4}/>
      Secured by Stripe · 256-bit encryption
    </div>
  );
}

/* ── Inner Modal ─────────────────────────────────────── */
function PaymentModalInner({
  uid,
  bookingPayload,
  selectedPayment,
  setSelectedPayment,
  onClose,
  onSuccess,
}) {
  const stripe = useStripe();

  const [cashLoading,    setCashLoading]    = useState(false);
  const [cashAppLoading, setCashAppLoading] = useState(false);
  const [topError,       setTopError]       = useState('');
  const [showBreakdown,  setShowBreakdown]  = useState(false);

  // ── Schedule state ──────────────────────────────────
  // null = ride now; ISO string = scheduled time
  const [scheduledAt, setScheduledAt] = useState(null);

  // ── Promo / discount state ──────────────────────────
  const [discount, setDiscount] = useState(null);
  // discount: { code, savings, newTotal, discountType, discountValue }

  const baseTotal = useMemo(() => Number(bookingPayload?.fareEstimate || 0), [bookingPayload]);
  const total     = useMemo(() => {
    if (discount?.newTotal !== undefined) return Number(discount.newTotal).toFixed(2);
    return baseTotal.toFixed(2);
  }, [baseTotal, discount]);

  const rideType    = bookingPayload?.rideType          ?? 'standard';
  const miles       = bookingPayload?.tripDistanceMiles ?? 0;
  const durationMin = bookingPayload?.tripDurationMin   ?? 0;
  const hasBreakdown = !!bookingPayload?.breakdown;

  const rideLabel = rideType.charAt(0).toUpperCase() + rideType.slice(1);

  // Build the final payload merging schedule + discount + original
  const finalPayload = useMemo(() => ({
    ...bookingPayload,
    fareEstimate: total,
    ...(scheduledAt ? { scheduledAt, isScheduled: true } : { isScheduled: false }),
    ...(discount    ? { promoCode: discount.code, discountAmount: discount.savings } : {}),
  }), [bookingPayload, total, scheduledAt, discount]);

  const handleSelectPayment = (id) => { setTopError(''); setSelectedPayment(id); };

  // ── Cash App ──────────────────────────────────────────
  const handleConfirmCashApp = async () => {
    setTopError('');
    setCashAppLoading(true);
    try {
      const { data } = await callCashAppPayment({ uid, bookingPayload: finalPayload });
      if (!data.clientSecret) throw new Error(data.message || 'Failed to initiate Cash App payment.');
      const { error: stripeError } = await stripe.confirmCashappPayment(data.clientSecret, {
        payment_method: { cashapp: {} },
        return_url: `${window.location.origin}`,
      });
      if (stripeError) throw new Error(stripeError.message || 'Cash App payment failed.');
      onSuccess?.({ method: 'cashapp', rideId: data.rideId });
    } catch (err) {
      setTopError(err.message || 'Cash App payment failed.');
    } finally {
      setCashAppLoading(false);
    }
  };

  // ── Cash ──────────────────────────────────────────────
  const handleConfirmCash = async () => {
    setTopError('');
    setCashLoading(true);
    try {
      const { data } = await callCashPayment({ uid, bookingPayload: finalPayload });
      if (!data.success) throw new Error(data.message || 'Failed to book cash ride.');
      onSuccess?.({ method: 'cash', rideId: data.rideId });
      onClose?.();
    } catch (err) {
      setTopError(err.message || 'Cash booking failed.');
    } finally {
      setCashLoading(false);
    }
  };

  // Scheduled label for CTA
  const scheduleLabel = useMemo(() => {
    if (!scheduledAt) return null;
    return new Date(scheduledAt).toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  }, [scheduledAt]);

  return (
    <>
      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin    { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes sheetUp { from { transform: translateY(100%); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes scaleIn { from { transform: scale(.95); opacity: 0 } to { transform: scale(1); opacity: 1 } }
        @keyframes pulse   {
          0%, 100% { box-shadow: 0 0 0 3px rgba(22,163,74,0.25); }
          50%       { box-shadow: 0 0 0 6px rgba(22,163,74,0.1); }
        }

        .pmt-sheet  { animation: sheetUp 0.36s cubic-bezier(0.32, 0.72, 0, 1) forwards; }
        .pmt-handle { width: 38px; height: 4px; background: #CBD5E1; border-radius: 99px; margin: 0 auto; }
        .pmt-scroll { overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
        .pmt-scroll::-webkit-scrollbar { display: none; }

        .method-btn { transition: all 0.18s cubic-bezier(.4,0,.2,1); will-change: transform; }
        .method-btn:active:not([data-active="true"]) { transform: scale(.97); }
        .method-content { animation: scaleIn .25s cubic-bezier(.4,0,.2,1) forwards; }
      `}</style>

      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, minHeight: '100dvh',
          background: 'rgba(15,23,42,.55)',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          display: 'flex', flexDirection: 'column',
          justifyContent: 'flex-end', alignItems: 'center',
          zIndex: 999,
          animation: 'fadeIn .25s ease forwards',
        }}
      >
        <div
          className="pmt-sheet"
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: '520px', maxHeight: '94dvh',
            background: T.surface,
            borderRadius: '28px 28px 0 0',
            paddingTop: 12,
            paddingBottom: 'max(env(safe-area-inset-bottom,0px),20px)',
            boxShadow: '0 -20px 60px rgba(15,23,42,0.25)',
            display: 'flex', flexDirection: 'column',
            position: 'relative', overflow: 'hidden',
          }}
        >
          {/* Drag handle */}
          <div style={{ padding: '0 0 12px' }}>
            <div className="pmt-handle"/>
          </div>

          {/* STICKY HEADER */}
          <div style={{
            padding: '4px 22px 18px',
            borderBottom: `1px solid ${T.borderSoft}`,
            position: 'relative', background: T.surface,
          }}>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                position: 'absolute', top: 4, right: 18,
                width: 36, height: 36, borderRadius: 11,
                border: 'none', background: T.surfaceAlt, color: T.textMid,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'background .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = T.borderSoft; }}
              onMouseLeave={e => { e.currentTarget.style.background = T.surfaceAlt; }}
            >
              <X size={17}/>
            </button>

            <div style={{
              fontSize: 10.5, fontWeight: 700, color: T.textMid,
              letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 6,
            }}>
              Confirm Payment
            </div>

            {/* Total with strikethrough if discounted */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
              <span style={{
                fontFamily: '"JetBrains Mono",monospace',
                fontSize: 42, fontWeight: 800, color: T.text,
                letterSpacing: '-1.2px', lineHeight: 1,
              }}>
                ${total}
              </span>
              {discount && (
                <span style={{
                  fontFamily: '"JetBrains Mono",monospace',
                  fontSize: 20, fontWeight: 600,
                  color: T.textMuted,
                  textDecoration: 'line-through',
                  letterSpacing: '-0.5px',
                }}>
                  ${baseTotal.toFixed(2)}
                </span>
              )}
              <span style={{ fontSize: 13, color: T.textMid, fontWeight: 600 }}>USD</span>
            </div>

            {/* Trip meta */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: 12, color: T.textMid, fontWeight: 600, flexWrap: 'wrap',
            }}>
              <span style={{
                background: T.greenLight, color: T.greenDark,
                border: `1px solid ${T.greenBorder}`,
                padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700,
              }}>
                {rideLabel}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <MapPin size={11} strokeWidth={2.4}/>{miles} mi
              </span>
              <span style={{ color: T.textMuted }}>·</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <Clock size={11} strokeWidth={2.4}/>~{durationMin} min
              </span>
              {/* Scheduled badge */}
              {scheduledAt && (
                <>
                  <span style={{ color: T.textMuted }}>·</span>
                  <span style={{
                    background: T.indigoLight, color: T.indigo,
                    border: `1px solid ${T.indigoBorder}`,
                    padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                  }}>
                    <CalendarClock size={9} strokeWidth={2.4}/>
                    {scheduleLabel}
                  </span>
                </>
              )}
              {/* Promo badge */}
              {discount && (
                <>
                  <span style={{ color: T.textMuted }}>·</span>
                  <span style={{
                    background: T.greenLight, color: T.greenDark,
                    border: `1px solid ${T.greenBorder}`,
                    padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                  }}>
                    <Sparkles size={9} strokeWidth={2.4}/>
                    −${discount.savings}
                  </span>
                </>
              )}
            </div>

            <FareBreakdown payload={bookingPayload} expanded={showBreakdown}/>
          </div>

          {/* SCROLLABLE BODY */}
          <div className="pmt-scroll" style={{ flex: 1, padding: '18px 22px 24px' }}>

            {topError && (
              <div style={{
                marginBottom: 16, padding: '11px 13px', borderRadius: 12,
                background: '#FEF2F2', border: '1px solid #FECACA',
                color: '#B91C1C', fontSize: 12.5, fontWeight: 600,
                display: 'flex', alignItems: 'flex-start', gap: 8,
              }}>
                <span style={{ flexShrink: 0 }}>⚠</span>{topError}
              </div>
            )}

            {/* ── Schedule Picker ── */}
            <SchedulePicker scheduledAt={scheduledAt} onChange={setScheduledAt}/>

            {/* ── Promo Code ── */}
            <PromoBox
              originalTotal={baseTotal}
              discount={discount}
              setDiscount={setDiscount}
              onDiscountApplied={(d) => {
                // d = null when removed
                if (!d) setDiscount(null);
              }}
            />

            {/* ── Divider ── */}
            <div style={{ height: 1, background: T.borderSoft, marginBottom: 20 }}/>

            {/* ── Method tabs ── */}
            <div style={{
              fontSize: 10.5, fontWeight: 700, color: T.textMid,
              letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 10,
            }}>
              Pay With
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8, marginBottom: 22,
            }}>
              {PAYMENT_METHODS.map((opt) => {
                const isActive = selectedPayment === opt.id;
                return (
                  <button
                    key={opt.id} type="button" data-active={isActive}
                    className="method-btn"
                    onClick={() => handleSelectPayment(opt.id)}
                    style={{
                      padding: '14px 10px', borderRadius: 14, cursor: 'pointer',
                      background: isActive ? `${opt.color}0d` : T.surface,
                      border: isActive ? `1.8px solid ${opt.color}` : `1.5px solid ${T.border}`,
                      boxShadow: isActive ? `0 6px 18px ${opt.color}1f` : 'none',
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      gap: 7, position: 'relative',
                    }}
                  >
                    {isActive && (
                      <div style={{
                        position: 'absolute', top: -6, right: -6,
                        width: 20, height: 20, borderRadius: '50%',
                        background: opt.color, border: '2.5px solid #fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: `0 4px 10px ${opt.color}55`,
                      }}>
                        <Check size={10} color="#fff" strokeWidth={3.5}/>
                      </div>
                    )}
                    <MethodIcon id={opt.id} color={isActive ? opt.color : T.textMuted} size={22} active={isActive}/>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: isActive ? opt.color : T.text, letterSpacing: '-0.1px' }}>
                      {opt.label}
                    </div>
                    <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 600, marginTop: -3 }}>
                      {opt.sub}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* ── Method-specific UI ── */}
            <div className="method-content" key={selectedPayment}>

              {selectedPayment === 'card' && (
                <CardForm
                  uid={uid}
                  bookingPayload={finalPayload}
                  total={total}
                  onSuccess={(result) => { onSuccess?.(result); onClose?.(); }}
                  onError={(msg) => setTopError(msg)}
                />
              )}

              {selectedPayment === 'cashapp' && (
                <>
                  <div style={{
                    background: T.surfaceAlt, border: `1px solid ${T.borderSoft}`,
                    borderRadius: 14, padding: '14px 16px', marginBottom: 12,
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <CashAppLogo size={32} bgColor={T.cashApp}/>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 800, color: T.text, marginBottom: 2 }}>
                        Pay with Cash App
                      </div>
                      <div style={{ fontSize: 11.5, color: T.textMid, fontWeight: 500, lineHeight: 1.4 }}>
                        We'll redirect you to confirm in the Cash App
                      </div>
                    </div>
                    <ChevronRight size={16} color={T.textMuted}/>
                  </div>

                  <PrimaryCTA
                    loading={cashAppLoading} disabled={cashAppLoading}
                    loadingText="Opening Cash App…"
                    onClick={handleConfirmCashApp}
                    color={T.cashApp} gradientFrom="#00E03A" gradientTo="#00b82b"
                  >
                    <CashAppLogo size={18} bgColor="rgba(255,255,255,0.22)"/>
                    Continue to Cash App
                    <ArrowRight size={15} strokeWidth={2.6}/>
                  </PrimaryCTA>
                  <SecurityFootnote/>
                </>
              )}

              {selectedPayment === 'cash' && (
                <>
                  <div style={{
                    background: T.amberLight, border: '1px solid #FDE68A',
                    borderRadius: 14, padding: '14px 16px', marginBottom: 12,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                      <Banknote size={18} color={T.amber} strokeWidth={2.2} style={{ flexShrink: 0, marginTop: 1 }}/>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: '#92400E', marginBottom: 3 }}>
                          Pay your driver in cash
                        </div>
                        <div style={{ fontSize: 12, color: '#B45309', fontWeight: 500, lineHeight: 1.5 }}>
                          Have <strong style={{ fontFamily: '"JetBrains Mono",monospace', color: '#92400E' }}>${total}</strong> ready when your driver arrives. Exact change appreciated.
                        </div>
                      </div>
                    </div>
                    <div style={{
                      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
                      paddingTop: 10, borderTop: '1px solid rgba(180,83,9,0.15)',
                    }}>
                      <div>
                        <div style={{ fontSize: 9.5, fontWeight: 700, color: '#B45309', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 2 }}>
                          You'll need
                        </div>
                        <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 16, fontWeight: 800, color: '#92400E' }}>
                          ${total}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9.5, fontWeight: 700, color: '#B45309', letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 2 }}>
                          When to pay
                        </div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#92400E', marginTop: 1 }}>
                          {scheduledAt ? 'On driver arrival' : 'Driver Arrival'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <PrimaryCTA
                    loading={cashLoading} disabled={cashLoading}
                    loadingText="Booking ride…"
                    onClick={handleConfirmCash}
                    color={T.amber} gradientFrom="#F59E0B" gradientTo="#B45309"
                  >
                    <Banknote size={16} strokeWidth={2.4}/>
                    {scheduledAt ? `Schedule · $${total}` : `Confirm cash · $${total}`}
                  </PrimaryCTA>

                  <div style={{
                    marginTop: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    fontSize: 11, color: T.textMuted, fontWeight: 500,
                  }}>
                    <ShieldCheck size={11} strokeWidth={2.4}/>
                    Driver matched immediately after confirming
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

/* ── Default export ──────────────────────────────────── */
export default function PaymentModal(props) {
  return (
    <Elements stripe={stripePromise}>
      <PaymentModalInner {...props}/>
    </Elements>
  );
}
