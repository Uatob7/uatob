// src/App/PaymentModal.jsx
import React, { useMemo, useState } from 'react';
import { X, CreditCard, Check, Loader2, ShieldCheck, Wallet, Smartphone, Banknote } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebase_app } from '@/firebase/config';

// ── Callables ─────────────────────────────────────────────────────────
const functions           = getFunctions(firebase_app, "us-east1");
const callCardPayment     = httpsCallable(functions, "cardPayment");
const callCashAppPayment  = httpsCallable(functions, "cashAppPayment");
const callCashPayment     = httpsCallable(functions, "cashPayment");

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

/* ── Theme ───────────────────────────────────────────── */
const T = {
  text:        '#111827',
  textMuted:   '#6B7280',
  accent:      '#16A34A',
  accentLight: '#ECFDF5',
  accentBorder:'#BBF7D0',
  bg:          '#FFFFFF',
};

/* ── Payment Methods ─────────────────────────────────── */
const PAYMENT_METHODS = [
  { id: 'card',    label: 'Credit / Debit Card', color: '#16A34A' },
  { id: 'cashapp', label: 'Cash App',            color: '#00D632' },
  { id: 'cash',    label: 'Cash',                color: '#D97706' },
];

/* ── Card Element Options ────────────────────────────── */
const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: '#111827',
      fontFamily: '"Outfit", system-ui, sans-serif',
      fontSize: '16px',
      fontSmoothing: 'antialiased',
      '::placeholder': { color: '#9CA3AF' },
      iconColor: '#16A34A',
    },
    invalid: { color: '#DC2626', iconColor: '#DC2626' },
  },
  hidePostalCode: true,
};

/* ── Card Form ───────────────────────────────────────── */
function CardForm({ uid, bookingPayload, onSuccess, onError }) {
  const stripe   = useStripe();
  const elements = useElements();

  const [loading,      setLoading]      = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [error,        setError]        = useState('');

  const total = Number(bookingPayload?.fareEstimate || 0).toFixed(2);

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

      const { data } = await callCardPayment({
        uid,
        paymentMethodId: paymentMethod.id,
        bookingPayload,
      });

      // 3D Secure flow
      if (data.requiresAction && data.clientSecret) {
        const { error: actionError, paymentIntent } =
          await stripe.handleCardAction(data.clientSecret);
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
    <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
      <div style={{
        border: `1.5px solid ${error ? '#FCA5A5' : '#BBF7D0'}`,
        borderRadius: 16,
        padding: 16,
        background: '#fff',
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: T.textMuted }}>
          Card Details
        </div>
        <CardElement
          options={CARD_ELEMENT_OPTIONS}
          onChange={(e) => {
            setCardComplete(e.complete);
            setError(e.error?.message || '');
          }}
        />
      </div>

      {error && (
        <div style={{
          marginTop: 10, padding: 12, borderRadius: 12,
          background: '#FEF2F2', border: '1px solid #FECACA',
          color: '#B91C1C', fontSize: 13, fontWeight: 600,
        }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || !cardComplete || loading}
        style={{
          width: '100%', marginTop: 16, padding: 16, borderRadius: 16,
          border: 'none', background: 'linear-gradient(135deg,#16A34A,#15803D)',
          color: '#fff', fontWeight: 800, fontSize: 15,
          fontFamily: '"Outfit",system-ui,sans-serif',
          cursor: (!stripe || !cardComplete || loading) ? 'not-allowed' : 'pointer',
          opacity: (!stripe || !cardComplete || loading) ? 0.7 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        {loading
          ? <><Loader2 size={18} className="spin" /> Processing...</>
          : `Confirm & Pay · $${total}`
        }
      </button>
    </form>
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

  const total       = useMemo(() => Number(bookingPayload?.fareEstimate || 0).toFixed(2), [bookingPayload]);
  const rideType    = bookingPayload?.rideType          ?? 'standard';
  const miles       = bookingPayload?.tripDistanceMiles ?? 0;
  const durationMin = bookingPayload?.tripDurationMin   ?? 0;

  const handleSelectPayment = (id) => {
    setTopError('');
    setSelectedPayment(id);
  };

  // ── Cash App ──────────────────────────────────────────
  const handleConfirmCashApp = async () => {
    setTopError('');
    setCashAppLoading(true);
    try {
      const { data } = await callCashAppPayment({ uid, bookingPayload });

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
      const { data } = await callCashPayment({ uid, bookingPayload });

      if (!data.success) throw new Error(data.message || 'Failed to book cash ride.');
      onSuccess?.({ method: 'cash', rideId: data.rideId });
      onClose?.();
    } catch (err) {
      setTopError(err.message || 'Cash booking failed.');
    } finally {
      setCashLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes sheetUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .payment-sheet { animation: sheetUp 0.35s cubic-bezier(0.32, 0.72, 0, 1) forwards; }
        .sheet-handle { width: 40px; height: 4px; background: #D1D5DB; border-radius: 99px; margin: 0 auto 20px; }
        .sheet-scroll { overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; }
        .sheet-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, minHeight: '100dvh',
          background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          display: 'flex', flexDirection: 'column',
          justifyContent: 'flex-end', alignItems: 'center',
          zIndex: 999,
        }}
      >
        <div
          className="payment-sheet"
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: '560px', maxHeight: '92dvh',
            background: 'linear-gradient(180deg,#FFFFFF 0%,#FAFAFA 100%)',
            borderRadius: '26px 26px 0 0',
            paddingTop: '14px',
            paddingLeft: '24px', paddingRight: '24px',
            paddingBottom: 'max(env(safe-area-inset-bottom,0px),24px)',
            boxShadow: '0 -12px 60px rgba(0,0,0,0.18)',
            border: '1px solid rgba(229,231,235,.9)', borderBottom: 'none',
            display: 'flex', flexDirection: 'column',
            position: 'relative',
          }}
        >
          <div className="sheet-handle" />

          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 18, right: 18,
              width: 38, height: 38, borderRadius: 12,
              border: 'none', background: '#F3F4F6',
              color: T.textMuted,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', zIndex: 10,
            }}
          >
            <X size={18} />
          </button>

          <div className="sheet-scroll" style={{ flex: 1, paddingBottom: 24 }}>

            {/* Header */}
            <div style={{ marginBottom: 22 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: '#ECFDF5', border: '1px solid #BBF7D0',
                color: '#166534', borderRadius: 999, padding: '6px 12px',
                fontSize: 11, fontWeight: 800, letterSpacing: '.7px',
                textTransform: 'uppercase', marginBottom: 14,
              }}>
                <ShieldCheck size={14} /> Secure Checkout
              </div>
              <h3 style={{ fontSize: 28, fontWeight: 900, color: T.text, marginBottom: 6, letterSpacing: '-0.8px' }}>
                Payment
              </h3>
              <p style={{ fontSize: 14, color: T.textMuted, lineHeight: 1.6 }}>
                Choose how you want to pay before we assign your driver.
              </p>
            </div>

            {/* Top error */}
            {topError && (
              <div style={{
                marginBottom: 16, padding: '13px 14px', borderRadius: 14,
                background: '#FEF2F2', border: '1px solid #FECACA',
                color: '#B91C1C', fontSize: 13, fontWeight: 700,
              }}>
                {topError}
              </div>
            )}

            {/* Payment method selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 22 }}>
              {PAYMENT_METHODS.map((opt) => {
                const isActive = selectedPayment === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectPayment(opt.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                      padding: 14, borderRadius: 18, cursor: 'pointer',
                      background: isActive ? `${opt.color}12` : '#FFFFFF',
                      border: isActive ? `1.8px solid ${opt.color}` : '1.5px solid #E5E7EB',
                      transition: 'all 0.2s ease',
                      boxShadow: isActive ? `0 8px 24px ${opt.color}14` : '0 2px 8px rgba(0,0,0,.03)',
                    }}
                  >
                    <div style={{
                      width: 50, height: 50, borderRadius: 15, flexShrink: 0,
                      background: isActive ? `${opt.color}18` : '#F3F4F6',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {opt.id === 'card'    && <CreditCard size={22} color={isActive ? opt.color : '#9CA3AF'} />}
                      {opt.id === 'cashapp' && <span style={{ fontSize: 22, fontWeight: 900, color: isActive ? opt.color : '#9CA3AF', fontFamily: 'system-ui' }}>$</span>}
                      {opt.id === 'cash'    && <Banknote size={22} color={isActive ? opt.color : '#9CA3AF'} />}
                    </div>
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: T.text, marginBottom: 2 }}>{opt.label}</div>
                      <div style={{ fontSize: 12, color: T.textMuted, lineHeight: 1.4 }}>
                        {opt.id === 'card'    && 'Enter your card securely and pay instantly'}
                        {opt.id === 'cashapp' && 'Opens Cash App on your device to pay'}
                        {opt.id === 'cash'    && 'Pay your driver in cash when you arrive'}
                      </div>
                    </div>
                    {isActive
                      ? <div style={{ width: 24, height: 24, borderRadius: '50%', background: opt.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 6px 16px ${opt.color}40` }}><Check size={13} color="#fff" strokeWidth={3} /></div>
                      : <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid #D1D5DB', flexShrink: 0 }} />
                    }
                  </button>
                );
              })}
            </div>

            {/* Fare summary */}
            <div style={{
              background: 'linear-gradient(135deg,#F0FDF4,#DCFCE7)',
              border: '1.5px solid #BBF7D0', borderRadius: 20,
              padding: '18px 20px', marginBottom: 18,
              boxShadow: '0 8px 24px rgba(22,163,74,.08)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 800, letterSpacing: '.8px', textTransform: 'uppercase' }}>Trip Total</div>
                  <div style={{ fontSize: 13, color: T.textMuted, marginTop: 6, lineHeight: 1.5 }}>
                    {rideType.charAt(0).toUpperCase() + rideType.slice(1)} · {miles} mi · ~{durationMin} min
                  </div>
                </div>
                <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: 34, fontWeight: 800, color: T.accent, letterSpacing: '-1px' }}>
                  ${total}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#166534', fontSize: 12, fontWeight: 700 }}>
                <Wallet size={14} />
                {selectedPayment === 'cash'
                  ? 'Pay your driver directly in cash after the ride'
                  : 'Payment is processed before driver assignment'
                }
              </div>
            </div>

            {/* ── Card UI ───────────────────────────────────── */}
            {selectedPayment === 'card' && (
              <CardForm
                uid={uid}
                bookingPayload={bookingPayload}
                onSuccess={(result) => { onSuccess?.(result); onClose?.(); }}
                onError={(msg) => setTopError(msg)}
              />
            )}

            {/* ── Cash App UI ───────────────────────────────── */}
            {selectedPayment === 'cashapp' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20 }}>
                  <div style={{ height: 1, flex: 1, background: '#E5E7EB' }} />
                  <span style={{ fontSize: 13, color: T.textMuted, fontWeight: 600 }}>
                    You'll pay{' '}
                    <span style={{ color: '#00D632', fontWeight: 900, fontFamily: '"JetBrains Mono",monospace' }}>
                      ${total}
                    </span>
                  </span>
                  <div style={{ height: 1, flex: 1, background: '#E5E7EB' }} />
                </div>

                <button
                  onClick={handleConfirmCashApp}
                  disabled={cashAppLoading}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 14, padding: '19px 24px', borderRadius: 20, border: 'none',
                    background: cashAppLoading
                      ? 'linear-gradient(135deg,#00b82b,#009e25)'
                      : 'linear-gradient(135deg,#00D632,#00b82b)',
                    cursor: cashAppLoading ? 'not-allowed' : 'pointer',
                    boxShadow: cashAppLoading ? 'none' : '0 10px 32px rgba(0,214,50,.40)',
                    transition: 'all 0.22s ease',
                    transform: cashAppLoading ? 'scale(0.98)' : 'scale(1)',
                  }}
                >
                  {cashAppLoading ? (
                    <>
                      <Loader2 size={22} color="#fff" className="spin" />
                      <span style={{ fontSize: 17, fontWeight: 800, color: '#fff', fontFamily: '"Outfit",system-ui,sans-serif' }}>
                        Opening Cash App...
                      </span>
                    </>
                  ) : (
                    <>
                      <div style={{ width: 36, height: 36, background: '#fff', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 10px rgba(0,0,0,.14)' }}>
                        <span style={{ fontSize: 22, fontWeight: 900, color: '#00D632', fontFamily: 'system-ui', lineHeight: 1 }}>$</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.75)', letterSpacing: '1px', textTransform: 'uppercase', lineHeight: 1, marginBottom: 3 }}>
                          Tap to pay
                        </span>
                        <span style={{ fontSize: 18, fontWeight: 900, color: '#fff', fontFamily: '"Outfit",system-ui,sans-serif', letterSpacing: '-0.3px', lineHeight: 1 }}>
                          Open Cash App &amp; Pay
                        </span>
                      </div>
                      <div style={{ marginLeft: 'auto', background: 'rgba(255,255,255,.2)', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Smartphone size={18} color="#fff" />
                      </div>
                    </>
                  )}
                </button>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14 }}>
                  <ShieldCheck size={13} color={T.textMuted} />
                  <span style={{ fontSize: 11.5, color: T.textMuted, fontWeight: 500 }}>
                    Opens Cash App on your device to confirm payment
                  </span>
                </div>
              </>
            )}

            {/* ── Cash UI ───────────────────────────────────── */}
            {selectedPayment === 'cash' && (
              <>
                {/* Info banner */}
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  background: '#FFFBEB', border: '1.5px solid #FDE68A',
                  borderRadius: 16, padding: '14px 16px', marginBottom: 20,
                }}>
                  <Banknote size={20} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#92400E', marginBottom: 4 }}>
                      Pay your driver directly
                    </div>
                    <div style={{ fontSize: 12, color: '#B45309', lineHeight: 1.6 }}>
                      Have <strong style={{ fontFamily: '"JetBrains Mono",monospace' }}>${total}</strong> in cash ready when your driver arrives. Your driver will confirm receipt at the end of the trip.
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 20 }}>
                  <div style={{ height: 1, flex: 1, background: '#E5E7EB' }} />
                  <span style={{ fontSize: 13, color: T.textMuted, fontWeight: 600 }}>
                    Exact amount:{' '}
                    <span style={{ color: '#D97706', fontWeight: 900, fontFamily: '"JetBrains Mono",monospace' }}>
                      ${total}
                    </span>
                  </span>
                  <div style={{ height: 1, flex: 1, background: '#E5E7EB' }} />
                </div>

                <button
                  onClick={handleConfirmCash}
                  disabled={cashLoading}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 14, padding: '19px 24px', borderRadius: 20, border: 'none',
                    background: cashLoading
                      ? 'linear-gradient(135deg,#b45309,#92400e)'
                      : 'linear-gradient(135deg,#D97706,#B45309)',
                    cursor: cashLoading ? 'not-allowed' : 'pointer',
                    boxShadow: cashLoading ? 'none' : '0 10px 32px rgba(217,119,6,.35)',
                    transition: 'all 0.22s ease',
                    transform: cashLoading ? 'scale(0.98)' : 'scale(1)',
                  }}
                >
                  {cashLoading ? (
                    <>
                      <Loader2 size={22} color="#fff" className="spin" />
                      <span style={{ fontSize: 17, fontWeight: 800, color: '#fff', fontFamily: '"Outfit",system-ui,sans-serif' }}>
                        Booking Ride...
                      </span>
                    </>
                  ) : (
                    <>
                      <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,.2)', borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Banknote size={20} color="#fff" />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.75)', letterSpacing: '1px', textTransform: 'uppercase', lineHeight: 1, marginBottom: 3 }}>
                          Cash payment
                        </span>
                        <span style={{ fontSize: 18, fontWeight: 900, color: '#fff', fontFamily: '"Outfit",system-ui,sans-serif', letterSpacing: '-0.3px', lineHeight: 1 }}>
                          Confirm &amp; Find Driver
                        </span>
                      </div>
                      <div style={{ marginLeft: 'auto', background: 'rgba(255,255,255,.2)', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Check size={18} color="#fff" strokeWidth={2.5} />
                      </div>
                    </>
                  )}
                </button>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14 }}>
                  <ShieldCheck size={13} color={T.textMuted} />
                  <span style={{ fontSize: 11.5, color: T.textMuted, fontWeight: 500 }}>
                    Driver will be assigned immediately after confirming
                  </span>
                </div>
              </>
            )}

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
      <PaymentModalInner {...props} />
    </Elements>
  );
}