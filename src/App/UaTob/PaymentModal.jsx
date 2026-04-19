// src/App/PaymentModal.jsx
import React, { useMemo, useState } from 'react';
import { X, CreditCard, Check, Loader2, ShieldCheck, Wallet, Smartphone } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';


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

  console.log('Booking Payload in CardForm:', bookingPayload); // Debug log

  const stripe   = useStripe();
  const elements = useElements();

  const [loading,      setLoading]      = useState(false);
  const [cardReady,    setCardReady]    = useState(false);
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
      if (!cardElement) throw new Error('Card input is not ready yet.');

      const { error: createError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      });

      if (createError) throw new Error(createError.message || 'Could not create payment method.');

      const res = await fetch('https://cardpayment-ady2s2xhhq-uc.a.run.app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, paymentMethodId: paymentMethod.id, bookingPayload }),
      });

      const data = await res.json();

      // ── Handle 3D Secure ──────────────────────────────────
      if (data.requiresAction && data.clientSecret) {
        const { error: actionError, paymentIntent } = await stripe.handleCardAction(data.clientSecret);
        if (actionError) throw new Error(actionError.message || '3D Secure authentication failed.');
        if (paymentIntent?.status !== 'succeeded') throw new Error('Payment not completed after authentication.');
        return onSuccess?.({ method: 'card', rideId: data.rideId, paymentIntent: paymentIntent.id });
      }

      if (!res.ok || !data.success) throw new Error(data.message || 'Card payment failed.');
      onSuccess?.({ method: 'card', rideId: data.rideId, paymentIntent: data.paymentIntent || null });

    } catch (err) {
      const msg = err.message || 'Payment failed.';
      setError(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: '16px' }}>
      <div style={{
        border: `1.5px solid ${error ? '#FCA5A5' : cardReady ? '#BBF7D0' : T.accentBorder}`,
        borderRadius: '16px', background: '#fff', padding: '16px 14px',
        boxShadow: cardReady ? '0 6px 18px rgba(22,163,74,.06)' : 'none',
        transition: 'all .2s ease',
      }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: T.textMuted, marginBottom: '10px', letterSpacing: '.5px', textTransform: 'uppercase' }}>
          Card Details
        </div>
        <CardElement
          options={CARD_ELEMENT_OPTIONS}
          onReady={() => setCardReady(true)}
          onChange={(e) => {
            setCardComplete(!!e.complete);
            setError(e.error ? e.error.message : '');
          }}
        />
      </div>

      {error && (
        <div style={{ marginTop: '10px', padding: '12px 14px', borderRadius: '12px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', fontSize: '13px', fontWeight: 600 }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || !cardComplete || loading}
        style={{
          width: '100%', marginTop: '16px', padding: '16px', borderRadius: '16px',
          border: 'none', background: 'linear-gradient(135deg,#16A34A,#15803D)',
          color: '#fff', fontSize: '16px', fontWeight: 800, cursor: !stripe || !cardComplete || loading ? 'not-allowed' : 'pointer',
          opacity: !stripe || !cardComplete || loading ? 0.7 : 1,
          boxShadow: '0 8px 24px rgba(22,163,74,.3)', transition: 'all .2s ease',
          fontFamily: '"Outfit",system-ui,sans-serif',
        }}
      >
        {loading ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <Loader2 size={18} className="spin" /> Processing Payment...
          </span>
        ) : `Confirm & Pay · $${total}`}
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

  const [cashLoading, setCashLoading] = useState(false);
  const [topError,    setTopError]    = useState('');

  const total       = useMemo(() => Number(bookingPayload?.fareEstimate || 0).toFixed(2), [bookingPayload]);
  const rideType    = bookingPayload?.rideType          ?? 'standard';
  const miles       = bookingPayload?.tripDistanceMiles ?? 0;
  const durationMin = bookingPayload?.tripDurationMin   ?? 0;

  const handleSelectPayment = (id) => {
    setTopError('');
    setSelectedPayment(id);
  };

  const handleConfirmCash = async () => {
    setTopError('');
    setCashLoading(true);
    try {
      const res = await fetch('https://cashapppayment-ady2s2xhhq-uc.a.run.app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, bookingPayload }),
      });

      const data = await res.json();
      if (!res.ok || !data.clientSecret) throw new Error(data.message || 'Failed to initiate Cash App payment.');

      const { error: stripeError } = await stripe.confirmCashappPayment(data.clientSecret, {
        payment_method: { cashapp: {} },
        return_url: `${window.location.origin}`,
      });

      if (stripeError) throw new Error(stripeError.message || 'Cash App payment failed.');
      onSuccess?.({ method: 'cashapp', rideId: data.rideId });

    } catch (err) {
      setTopError(err.message || 'Cash App payment failed.');
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

      <div onClick={onClose} style={{ position: 'fixed', inset: 0, minHeight: '100dvh', background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', zIndex: 999 }}>
        <div className="payment-sheet" onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '560px', maxHeight: '92dvh', background: 'linear-gradient(180deg,#FFFFFF 0%,#FAFAFA 100%)', borderRadius: '26px 26px 0 0', paddingTop: '14px', paddingLeft: '24px', paddingRight: '24px', paddingBottom: 'max(env(safe-area-inset-bottom,0px),24px)', boxShadow: '0 -12px 60px rgba(0,0,0,0.18)', border: '1px solid rgba(229,231,235,.9)', borderBottom: 'none', display: 'flex', flexDirection: 'column' }}>

          <div className="sheet-handle" />

          <div className="sheet-scroll" style={{ flex: 1, paddingBottom: '24px' }}>

            <button onClick={onClose} style={{ position: 'absolute', top: '18px', right: '18px', width: '38px', height: '38px', borderRadius: '12px', border: 'none', background: '#F3F4F6', color: T.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={18} />
            </button>

            {/* Header */}
            <div style={{ marginBottom: '22px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#ECFDF5', border: '1px solid #BBF7D0', color: '#166534', borderRadius: '999px', padding: '6px 12px', fontSize: '11px', fontWeight: 800, letterSpacing: '.7px', textTransform: 'uppercase', marginBottom: '14px' }}>
                <ShieldCheck size={14} /> Secure Checkout
              </div>
              <h3 style={{ fontSize: '28px', fontWeight: 900, color: T.text, marginBottom: '6px', letterSpacing: '-0.8px' }}>Payment</h3>
              <p style={{ fontSize: '14px', color: T.textMuted, lineHeight: 1.6 }}>Choose how you want to pay before we assign your driver.</p>
            </div>

            {/* Top error */}
            {topError && (
              <div style={{ marginBottom: '16px', padding: '13px 14px', borderRadius: '14px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', fontSize: '13px', fontWeight: 700 }}>
                {topError}
              </div>
            )}

            {/* Payment method selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '22px' }}>
              {PAYMENT_METHODS.map((opt) => {
                const isActive = selectedPayment === opt.id;
                return (
                  <button key={opt.id} type="button" onClick={() => handleSelectPayment(opt.id)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '14px', padding: '14px', borderRadius: '18px', background: isActive ? `${opt.color}12` : '#FFFFFF', cursor: 'pointer', border: isActive ? `1.8px solid ${opt.color}` : '1.5px solid #E5E7EB', transition: 'all 0.2s ease', boxShadow: isActive ? `0 8px 24px ${opt.color}14` : '0 2px 8px rgba(0,0,0,.03)' }}
                  >
                    <div style={{ width: '50px', height: '50px', borderRadius: '15px', background: isActive ? `${opt.color}18` : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {opt.id === 'card'
                        ? <CreditCard size={22} color={isActive ? opt.color : '#9CA3AF'} />
                        : <span style={{ fontSize: '22px', fontWeight: 900, color: isActive ? opt.color : '#9CA3AF', fontFamily: 'system-ui' }}>$</span>
                      }
                    </div>
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{ fontSize: '15px', fontWeight: 800, color: T.text, marginBottom: '2px' }}>{opt.label}</div>
                      <div style={{ fontSize: '12px', color: T.textMuted, lineHeight: 1.4 }}>
                        {opt.id === 'card' ? 'Enter your card securely and pay instantly' : 'Opens Cash App on your device to pay'}
                      </div>
                    </div>
                    {isActive
                      ? <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: opt.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 6px 16px ${opt.color}40` }}><Check size={13} color="#fff" strokeWidth={3} /></div>
                      : <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '2px solid #D1D5DB', flexShrink: 0 }} />
                    }
                  </button>
                );
              })}
            </div>

            {/* Fare summary */}
            <div style={{ background: 'linear-gradient(135deg,#F0FDF4,#DCFCE7)', border: '1.5px solid #BBF7D0', borderRadius: '20px', padding: '18px 20px', marginBottom: '18px', boxShadow: '0 8px 24px rgba(22,163,74,.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: T.textMuted, fontWeight: 800, letterSpacing: '.8px', textTransform: 'uppercase' }}>Trip Total</div>
                  <div style={{ fontSize: '13px', color: T.textMuted, marginTop: '6px', lineHeight: 1.5 }}>
                    {rideType.charAt(0).toUpperCase() + rideType.slice(1)} · {miles} mi · ~{durationMin} min
                  </div>
                </div>
                <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: '34px', fontWeight: 800, color: T.accent, letterSpacing: '-1px' }}>
                  ${total}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', fontSize: '12px', fontWeight: 700 }}>
                <Wallet size={14} /> Payment is processed before driver assignment
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '20px' }}>
                  <div style={{ height: '1px', flex: 1, background: '#E5E7EB' }} />
                  <span style={{ fontSize: '13px', color: T.textMuted, fontWeight: 600 }}>
                    You'll pay{' '}
                    <span style={{ color: '#00D632', fontWeight: 900, fontFamily: '"JetBrains Mono",monospace' }}>
                      ${total}
                    </span>
                  </span>
                  <div style={{ height: '1px', flex: 1, background: '#E5E7EB' }} />
                </div>

                <button
                  onClick={handleConfirmCash}
                  disabled={cashLoading}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: '14px', padding: '19px 24px', borderRadius: '20px', border: 'none',
                    background: cashLoading ? 'linear-gradient(135deg,#00b82b,#009e25)' : 'linear-gradient(135deg,#00D632,#00b82b)',
                    cursor: cashLoading ? 'not-allowed' : 'pointer',
                    boxShadow: cashLoading ? 'none' : '0 10px 32px rgba(0,214,50,.40)',
                    transition: 'all 0.22s ease',
                    transform: cashLoading ? 'scale(0.98)' : 'scale(1)',
                  }}
                >
                  {cashLoading ? (
                    <>
                      <Loader2 size={22} color="#fff" className="spin" />
                      <span style={{ fontSize: '17px', fontWeight: 800, color: '#fff', fontFamily: '"Outfit",system-ui,sans-serif' }}>
                        Opening Cash App...
                      </span>
                    </>
                  ) : (
                    <>
                      <div style={{ width: '36px', height: '36px', background: '#fff', borderRadius: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 10px rgba(0,0,0,.14)' }}>
                        <span style={{ fontSize: '22px', fontWeight: 900, color: '#00D632', fontFamily: 'system-ui', lineHeight: 1 }}>$</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,.75)', letterSpacing: '1px', textTransform: 'uppercase', lineHeight: 1, marginBottom: '3px' }}>
                          Tap to pay
                        </span>
                        <span style={{ fontSize: '18px', fontWeight: 900, color: '#fff', fontFamily: '"Outfit",system-ui,sans-serif', letterSpacing: '-0.3px', lineHeight: 1 }}>
                          Open Cash App &amp; Pay
                        </span>
                      </div>
                      <div style={{ marginLeft: 'auto', background: 'rgba(255,255,255,.2)', borderRadius: '10px', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Smartphone size={18} color="#fff" />
                      </div>
                    </>
                  )}
                </button>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '14px' }}>
                  <ShieldCheck size={13} color={T.textMuted} />
                  <span style={{ fontSize: '11.5px', color: T.textMuted, fontWeight: 500 }}>
                    Opens Cash App on your device to confirm payment
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