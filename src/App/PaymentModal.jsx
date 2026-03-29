// src/App/PaymentModal.jsx
import React, { useMemo, useState } from 'react';
import { X, CreditCard, Check, Loader2, ShieldCheck, Wallet } from 'lucide-react';
import { CashAppIcon } from '@/App/Brand.jsx';
import { PAYMENT_METHODS, PRICING, THEME as T } from '@/App/pricing.js';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

/* ── Stripe Card Input Style ─────────────────────────── */
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
    invalid: {
      color: '#DC2626',
      iconColor: '#DC2626',
    },
  },
  hidePostalCode: true,
};

/* ── Card Form ───────────────────────────────────────── */
function CardForm({ bookingPayload, onSuccess, onError }) {
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
        body: JSON.stringify({
          paymentMethodId: paymentMethod.id,
          fareData: {
            // Pass full bookingPayload so backend createRideDoc gets everything
            ...bookingPayload,
            total:      bookingPayload.fareEstimate,
            miles:      bookingPayload.tripDistanceMiles,
            durationMin: bookingPayload.tripDurationMin,
          },
        }),
      });

      const data = await res.json();

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
      <div
        style={{
          border: `1.5px solid ${error ? '#FCA5A5' : cardReady ? '#BBF7D0' : T.accentBorder}`,
          borderRadius: '16px',
          background: '#fff',
          padding: '16px 14px',
          boxShadow: cardReady ? '0 6px 18px rgba(22,163,74,.06)' : 'none',
          transition: 'all .2s ease',
        }}
      >
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
        className="cta-btn"
        style={{
          width: '100%',
          marginTop: '16px',
          opacity: !stripe || !cardComplete || loading ? 0.7 : 1,
          cursor: !stripe || !cardComplete || loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <Loader2 size={18} className="spin" />
            Processing Payment...
          </span>
        ) : (
          `Confirm & Pay · $${total}`
        )}
      </button>
    </form>
  );
}

/* ── Main Payment Modal ──────────────────────────────── */
export default function PaymentModal({
  bookingPayload,       // ← single source of truth
  selectedPayment,
  setSelectedPayment,
  onClose,
  onSuccess,
}) {
  const [cashLoading, setCashLoading] = useState(false);
  const [topError,    setTopError]    = useState('');

  const total      = useMemo(() => Number(bookingPayload?.fareEstimate || 0).toFixed(2), [bookingPayload]);
  const rideType   = bookingPayload?.rideType   ?? 'standard';
  const miles      = bookingPayload?.tripDistanceMiles ?? 0;
  const durationMin = bookingPayload?.tripDurationMin  ?? 0;

  const handleSelectPayment = (id) => {
    setTopError('');
    setSelectedPayment(id);
  };

  const handleConfirmCash = async () => {
    setTopError('');
    setCashLoading(true);

    try {
      const res = await fetch('https://cashapppayment-j2jspuowha-uc.a.run.app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fareData: {
            ...bookingPayload,
            total:       bookingPayload.fareEstimate,
            miles:       bookingPayload.tripDistanceMiles,
            durationMin: bookingPayload.tripDurationMin,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Cash App payment failed.');

      onSuccess?.({ method: 'cash', rideId: data.rideId });

    } catch (err) {
      setTopError(err.message || 'Cash App payment failed.');
    } finally {
      setCashLoading(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(6px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 999, padding: '20px' }}
      onClick={onClose}
    >
      <div
        className="modal-box"
        style={{ maxWidth: '520px', width: '100%', background: 'linear-gradient(180deg,#FFFFFF 0%,#FAFAFA 100%)', borderRadius: '26px', padding: '28px 24px 24px', position: 'relative', boxShadow: '0 24px 80px rgba(0,0,0,0.18)', border: '1px solid rgba(229,231,235,.9)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

        {/* Close */}
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: '18px', right: '18px', width: '38px', height: '38px', borderRadius: '12px', border: 'none', background: '#F3F4F6', color: T.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div style={{ marginBottom: '22px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#ECFDF5', border: '1px solid #BBF7D0', color: '#166534', borderRadius: '999px', padding: '6px 12px', fontSize: '11px', fontWeight: 800, letterSpacing: '.7px', textTransform: 'uppercase', marginBottom: '14px' }}>
            <ShieldCheck size={14} />
            Secure Checkout
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
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelectPayment(opt.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '14px', padding: '14px',
                  borderRadius: '18px', background: isActive ? `${opt.color}12` : '#FFFFFF', cursor: 'pointer',
                  border: isActive ? `1.8px solid ${opt.color}` : `1.5px solid ${T.accentBorder}`,
                  transition: 'all 0.2s ease', boxShadow: isActive ? `0 8px 24px ${opt.color}14` : '0 2px 8px rgba(0,0,0,.03)',
                }}
              >
                <div style={{ width: '50px', height: '50px', borderRadius: '15px', background: isActive ? `${opt.color}18` : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {opt.id === 'card'
                    ? <CreditCard size={22} color={isActive ? opt.color : '#9CA3AF'} />
                    : <CashAppIcon size={22} color={isActive ? opt.color : '#9CA3AF'} />}
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: T.text, marginBottom: '2px' }}>{opt.label}</div>
                  <div style={{ fontSize: '12px', color: T.textMuted, lineHeight: 1.4 }}>
                    {opt.id === 'card' ? 'Enter your card securely and pay instantly' : 'Tap confirm to continue with Cash App'}
                  </div>
                </div>
                {isActive ? (
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: opt.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 6px 16px ${opt.color}40` }}>
                    <Check size={13} color="#fff" strokeWidth={3} />
                  </div>
                ) : (
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '2px solid #D1D5DB', flexShrink: 0 }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Fare summary */}
        <div style={{ background: 'linear-gradient(135deg,#F0FDF4,#DCFCE7)', border: `1.5px solid ${T.accentBorder}`, borderRadius: '20px', padding: '18px 20px', marginBottom: '18px', boxShadow: '0 8px 24px rgba(22,163,74,.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '11px', color: T.textMuted, fontWeight: 800, letterSpacing: '.8px', textTransform: 'uppercase' }}>Trip Total</div>
              <div style={{ fontSize: '13px', color: T.textMuted, marginTop: '6px', lineHeight: 1.5 }}>
                {PRICING[rideType]?.label || 'Ride'} · {miles} mi · ~{durationMin} min
              </div>
            </div>
            <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: '34px', fontWeight: 800, color: T.accent, letterSpacing: '-1px' }}>
              ${total}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', fontSize: '12px', fontWeight: 700 }}>
            <Wallet size={14} />
            Payment is processed before driver assignment
          </div>
        </div>

        {/* Card form */}
        {selectedPayment === 'card' && (
          <Elements stripe={stripePromise}>
            <CardForm
              bookingPayload={bookingPayload}
              onSuccess={(result) => { onSuccess?.(result); onClose?.(); }}
              onError={(msg) => setTopError(msg)}
            />
          </Elements>
        )}

        {/* Cash App button */}
        {selectedPayment === 'cash' && (
          <button
            className="cta-btn"
            onClick={handleConfirmCash}
            disabled={cashLoading}
            style={{ width: '100%', padding: '15px 18px', borderRadius: '16px', fontWeight: 800, marginTop: '6px', opacity: cashLoading ? 0.8 : 1, cursor: cashLoading ? 'not-allowed' : 'pointer' }}
          >
            {cashLoading ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <Loader2 size={18} className="spin" /> Processing Cash App...
              </span>
            ) : (
              `Confirm & Pay · $${total} via Cash App`
            )}
          </button>
        )}
      </div>
    </div>
  );
}