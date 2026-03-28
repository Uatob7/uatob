import React, { useState } from 'react';
import { X, CreditCard, Check } from 'lucide-react';
import { CashAppIcon } from '@/App/Brand.jsx';
import { PAYMENT_METHODS, PRICING, THEME as T } from '@/App/pricing.js';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe('pk_test_XXXXXXXXXXXXXXXX'); // Stripe publishable key

// ---------------- Card Form ----------------
function CardForm({ fareData, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!stripe || !elements) return;

    const cardElement = elements.getElement(CardElement);
    const { error: createError, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
    });

    if (createError) {
      setError(createError.message);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('https://YOUR_FIREBASE_FUNCTIONS_URL/processCardPayment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fareData, paymentMethodId: paymentMethod.id }),
      });
      const data = await res.json();
      if (data.success) onSuccess(data.rideId);
      else setError(data.message);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
      <div style={{ padding: '12px', border: `1px solid ${T.accentBorder}`, borderRadius: '12px', background: '#F9FAFB' }}>
        <CardElement />
      </div>
      {error && <div style={{ color: 'red', fontSize: '12px' }}>{error}</div>}
      <button type="submit" className="cta-btn" disabled={!stripe || loading} style={{ marginTop: '8px' }}>
        {loading ? 'Processing...' : `Confirm & Pay · $${fareData.total}`}
      </button>
    </form>
  );
}

// ---------------- Payment Modal ----------------
export default function PaymentModal({
  fareData, tripData, selectedRide,
  selectedPayment, setSelectedPayment,
  onClose,
}) {
  const [showCardForm, setShowCardForm] = useState(false);

  const handleConfirmCash = async () => {
    try {
      const res = await fetch('https://YOUR_FIREBASE_FUNCTIONS_URL/processCashAppPayment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fareData }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Payment success! Ride created. Ride ID: ${data.rideId}`);
        onClose();
      } else {
        alert('Payment failed: ' + data.message);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div
      className="modal-overlay"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 999 }}
      onClick={onClose}
    >
      <div
        className="modal-box"
        style={{
          maxWidth: '480px',
          width: '90%',
          background: '#fff',
          borderRadius: '20px',
          padding: '28px 24px',
          position: 'relative',
          boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            border: 'none',
            background: '#F3F4F6',
            color: T.textMuted,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={17} />
        </button>

        {/* Header */}
        <h3 style={{ fontSize: '24px', fontWeight: 800, color: T.text, marginBottom: '6px' }}>Payment</h3>
        <p style={{ fontSize: '14px', color: T.textMuted, marginBottom: '22px' }}>
          Select your preferred method
        </p>

        {/* Payment Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '22px' }}>
          {PAYMENT_METHODS.map(opt => {
            const isActive = selectedPayment === opt.id;
            return (
              <div
                key={opt.id}
                onClick={() => {
                  setSelectedPayment(opt.id);
                  setShowCardForm(opt.id === 'card');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  borderRadius: '14px',
                  background: isActive ? `${opt.color}10` : '#F9FAFB',
                  cursor: 'pointer',
                  border: isActive ? `1.5px solid ${opt.color}` : `1.5px solid ${T.accentBorder}`,
                  transition: 'all 0.2s',
                }}
              >
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: isActive ? `${opt.color}20` : '#F3F4F6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {opt.id === 'card' ? <CreditCard size={21} color={isActive ? opt.color : '#D1D5DB'} /> : <CashAppIcon size={21} color={isActive ? opt.color : '#D1D5DB'} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: T.text }}>{opt.label}</div>
                  <div style={{ fontSize: '12px', color: T.textMuted }}>{opt.sub}</div>
                </div>
                {isActive && (
                  <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: opt.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Check size={12} color="#fff" strokeWidth={3} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Fare Summary */}
        <div style={{
          background: 'linear-gradient(135deg,#F0FDF4,#DCFCE7)',
          border: `1.5px solid ${T.accentBorder}`,
          borderRadius: '16px',
          padding: '18px 20px',
          marginBottom: '18px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '12px', color: T.textMuted }}>Trip Total</div>
              <div style={{ fontSize: '12px', color: T.textMuted, marginTop: '3px' }}>
                {PRICING[selectedRide]?.label} · {tripData?.actualMiles} mi · ~{tripData?.totalMin} min
              </div>
            </div>
            <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: '32px', fontWeight: 700, color: T.accent }}>
              ${fareData.total}
            </div>
          </div>
        </div>

        {/* Show Stripe Card Form or Cash App Button */}
        {showCardForm ? (
          <Elements stripe={stripePromise}>
            <CardForm fareData={fareData} onSuccess={() => onClose()} />
          </Elements>
        ) : selectedPayment === 'cash' ? (
          <button className="cta-btn" onClick={handleConfirmCash}>
            Confirm & Pay · ${fareData.total} via Cash App
          </button>
        ) : null}
      </div>
    </div>
  );
}