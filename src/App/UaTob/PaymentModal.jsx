// src/App/PaymentModal.jsx
import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { X, CreditCard, Check, Loader2, ShieldCheck, Wallet, Smartphone } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

/* ── Theme ───────────────────────────────────────────── */
const T = {
  text: '#111827',
  textMuted: '#6B7280',
  accent: '#16A34A',
  accentLight: '#ECFDF5',
  accentBorder: '#BBF7D0',
  bg: '#FFFFFF',
};

/* ── Payment Methods ─────────────────────────────────── */
const PAYMENT_METHODS = [
  { id: 'card', label: 'Credit / Debit Card', color: '#16A34A' },
  { id: 'cashapp', label: 'Cash App', color: '#00D632' },
];

/* ── Card Options ───────────────────────────────────── */
const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: '#111827',
      fontFamily: '"Outfit", system-ui, sans-serif',
      fontSize: '16px',
      '::placeholder': { color: '#9CA3AF' },
      iconColor: '#16A34A',
    },
    invalid: { color: '#DC2626', iconColor: '#DC2626' },
  },
  hidePostalCode: true,
};

/* ── Card Form ───────────────────────────────────────── */
function CardForm({ uid, bookingPayload, onSuccess, onError }) {
  const stripe = useStripe();
  const elements = useElements();

  const [loading, setLoading] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [error, setError] = useState('');

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
        await stripe.createPaymentMethod({
          type: 'card',
          card: cardElement,
        });

      if (createError) throw new Error(createError.message);

      const { data } = await axios.post(
        'https://cardpayment-ady2s2xhhq-uc.a.run.app',
        {
          uid,
          paymentMethodId: paymentMethod.id,
          bookingPayload,
        }
      );

      // 3D Secure flow
      if (data.requiresAction && data.clientSecret) {
        const { error: actionError, paymentIntent } =
          await stripe.handleCardAction(data.clientSecret);

        if (actionError) throw new Error(actionError.message);
        if (paymentIntent?.status !== 'succeeded') {
          throw new Error('Payment not completed.');
        }

        return onSuccess?.({
          method: 'card',
          rideId: data.rideId,
          paymentIntent: paymentIntent.id,
        });
      }

      if (!data.success) throw new Error(data.message || 'Payment failed.');

      onSuccess?.({
        method: 'card',
        rideId: data.rideId,
        paymentIntent: data.paymentIntent || null,
      });
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Payment failed';

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
        <div style={{
          fontSize: 12,
          fontWeight: 700,
          marginBottom: 10,
          color: T.textMuted,
        }}>
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
          marginTop: 10,
          padding: 12,
          borderRadius: 12,
          background: '#FEF2F2',
          border: '1px solid #FECACA',
          color: '#B91C1C',
          fontSize: 13,
          fontWeight: 600,
        }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || !cardComplete || loading}
        style={{
          width: '100%',
          marginTop: 16,
          padding: 16,
          borderRadius: 16,
          border: 'none',
          background: 'linear-gradient(135deg,#16A34A,#15803D)',
          color: '#fff',
          fontWeight: 800,
          cursor: 'pointer',
          opacity: (!stripe || !cardComplete || loading) ? 0.7 : 1,
        }}
      >
        {loading ? (
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Loader2 size={18} className="spin" />
            Processing...
          </span>
        ) : (
          `Confirm & Pay · $${total}`
        )}
      </button>
    </form>
  );
}

/* ── Modal ───────────────────────────────────────────── */
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
  const [topError, setTopError] = useState('');

  const total = useMemo(
    () => Number(bookingPayload?.fareEstimate || 0).toFixed(2),
    [bookingPayload]
  );

  const handleSelect = (id) => {
    setTopError('');
    setSelectedPayment(id);
  };

  const handleCashApp = async () => {
    setCashLoading(true);
    setTopError('');

    try {
      const { data } = await axios.post(
        'https://cashapppayment-ady2s2xhhq-uc.a.run.app',
        {
          uid,
          bookingPayload,
        }
      );

      if (!data.clientSecret) {
        throw new Error(data.message || 'Cash App failed');
      }

      const { error } = await stripe.confirmCashappPayment(
        data.clientSecret,
        {
          payment_method: { cashapp: {} },
          return_url: window.location.origin,
        }
      );

      if (error) throw new Error(error.message);

      onSuccess?.({ method: 'cashapp', rideId: data.rideId });
      onClose?.();
    } catch (err) {
      setTopError(
        err.response?.data?.message || err.message || 'Cash App failed'
      );
    } finally {
      setCashLoading(false);
    }
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,.5)',
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      zIndex: 999,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%',
        maxWidth: 560,
        background: '#fff',
        borderRadius: '26px 26px 0 0',
        padding: 24,
      }}>

        <h2 style={{ fontSize: 24, fontWeight: 900 }}>Payment</h2>

        {PAYMENT_METHODS.map((m) => (
          <button
            key={m.id}
            onClick={() => handleSelect(m.id)}
            style={{
              width: '100%',
              padding: 14,
              marginTop: 10,
              borderRadius: 16,
              border: selectedPayment === m.id
                ? `2px solid ${m.color}`
                : '1px solid #E5E7EB',
              background: selectedPayment === m.id ? '#F0FDF4' : '#fff',
              cursor: 'pointer',
            }}
          >
            {m.label}
          </button>
        ))}

        <div style={{ marginTop: 20 }}>
          {selectedPayment === 'card' && (
            <CardForm
              uid={uid}
              bookingPayload={bookingPayload}
              onSuccess={(r) => {
                onSuccess?.(r);
                onClose?.();
              }}
              onError={setTopError}
            />
          )}

          {selectedPayment === 'cashapp' && (
            <button
              onClick={handleCashApp}
              disabled={cashLoading}
              style={{
                width: '100%',
                marginTop: 16,
                padding: 16,
                borderRadius: 16,
                background: '#00D632',
                color: '#fff',
                fontWeight: 900,
                border: 'none',
              }}
            >
              {cashLoading ? 'Opening Cash App...' : `Pay $${total}`}
            </button>
          )}
        </div>

        {topError && (
          <div style={{
            marginTop: 12,
            color: '#B91C1C',
            fontWeight: 700,
          }}>
            {topError}
          </div>
        )}

      </div>
    </div>
  );
}

/* ── Export ─────────────────────────────────────────── */
export default function PaymentModal(props) {
  return (
    <Elements stripe={stripePromise}>
      <PaymentModalInner {...props} />
    </Elements>
  );
}