import React from 'react';
import { X, CreditCard, Check } from 'lucide-react';
import { CashAppIcon } from '@/App/Brand.jsx';
import { PAYMENT_METHODS, PRICING, THEME as T } from '@/App/pricing.js';

export default function PaymentModal({
  fareData, tripData, selectedRide,
  selectedPayment, setSelectedPayment,
  onConfirm, onClose,
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ maxWidth: '470px' }} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} style={{ position: 'absolute', top: '18px', right: '18px', background: '#F3F4F6', border: 'none', cursor: 'pointer', color: T.textMuted, width: '34px', height: '34px', borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={17}/>
        </button>

        <h3 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '5px', color: T.text, letterSpacing: '-0.5px' }}>Payment</h3>
        <p style={{ fontSize: '14px', color: T.textMuted, marginBottom: '22px', fontWeight: 500 }}>Select your preferred method</p>

        {/* Payment method options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', marginBottom: '22px' }}>
          {PAYMENT_METHODS.map(opt => {
            const isActive = selectedPayment === opt.id;
            return (
              <div key={opt.id} className={`pay-opt ${isActive ? opt.activeClass : ''}`} onClick={() => setSelectedPayment(opt.id)}>
                <div style={{ width: '44px', height: '44px', background: isActive ? `${opt.color}18` : '#F3F4F6', borderRadius: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .22s' }}>
                  {opt.id === 'card'
                    ? <CreditCard size={21} color={isActive ? opt.color : '#D1D5DB'}/>
                    : <CashAppIcon size={21} color={isActive ? opt.color : '#D1D5DB'}/>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '15px', fontWeight: 700, color: T.text, marginBottom: '2px' }}>{opt.label}</div>
                  <div style={{ fontSize: '12px', color: T.textMuted }}>{opt.sub}</div>
                </div>
                {isActive && (
                  <div style={{ width: '21px', height: '21px', background: opt.color, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Check size={12} color="#fff" strokeWidth={3}/>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Fare summary */}
        {fareData && (
          <div style={{ background: 'linear-gradient(135deg,#F0FDF4,#DCFCE7)', border: `1.5px solid ${T.accentBorder}`, borderRadius: '16px', padding: '18px 20px', marginBottom: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <div className="lbl">Trip Total</div>
                <div style={{ fontSize: '12px', color: T.textMuted, marginTop: '3px' }}>
                  {PRICING[selectedRide]?.label} · {tripData?.actualMiles} mi · ~{tripData?.totalMin} min
                </div>
              </div>
              <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: '32px', fontWeight: 700, letterSpacing: '-1px', color: T.accent }}>${fareData.total}</div>
            </div>
            <div style={{ display: 'flex', gap: '10px', paddingTop: '12px', borderTop: `1px dashed ${T.accentBorder}`, flexWrap: 'wrap' }}>
              {[
                { label: 'Base + Fee', val: `$${(fareData.breakdown.base + fareData.breakdown.bookingFee).toFixed(2)}` },
                { label: 'Distance',   val: `$${fareData.breakdown.distance.toFixed(2)}` },
                { label: 'Time',       val: `$${fareData.breakdown.time.toFixed(2)}` },
                ...(fareData.breakdown.surge > 0 ? [{ label: 'Surge', val: `+$${fareData.breakdown.surge.toFixed(2)}`, accent: true }] : []),
              ].map((item, i) => (
                <div key={i} style={{ flex: 1, textAlign: 'center', minWidth: '60px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: T.textMuted, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '3px' }}>{item.label}</div>
                  <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: '13px', fontWeight: 700, color: item.accent ? T.accent : T.text }}>{item.val}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button className="cta-btn" onClick={onConfirm}>Confirm & Pay · ${fareData?.total}</button>
      </div>
    </div>
  );
}
