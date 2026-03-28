import React from 'react';
import { Check } from 'lucide-react';
import { THEME as T } from '@/App/pricing.js';

export default function ConfirmationModal({ assignedDriver, etaMinutes, fareData, tripData }) {
  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: '370px', textAlign: 'center' }}>
        <div style={{
          width: '70px', height: '70px', margin: '0 auto 18px',
          background: 'linear-gradient(135deg,#22C55E,#16A34A 55%,#15803D)',
          borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 12px 36px rgba(22,163,74,.38)', animation: 'greenGlow 2s ease-in-out infinite',
        }}>
          <Check size={38} color="#fff" strokeWidth={2.5}/>
        </div>

        <h3 style={{ fontSize: '26px', fontWeight: 900, marginBottom: '7px', color: T.text, letterSpacing: '-0.8px' }}>
          Confirmed!
        </h3>
        <p style={{ fontSize: '15px', color: T.textMid, marginBottom: '3px', fontWeight: 600 }}>
          Matched with {assignedDriver?.name}
        </p>
        <p style={{ fontSize: '13px', color: T.textMuted, marginBottom: '22px' }}>
          {assignedDriver?.vehicle} · {assignedDriver?.plate}
        </p>

        <div style={{ background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: '16px', padding: '18px', marginBottom: '12px' }}>
          <div className="lbl">Arriving in</div>
          <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: '46px', fontWeight: 700, color: T.accent, letterSpacing: '-2px', lineHeight: 1 }}>
            {etaMinutes}
            <span style={{ fontSize: '18px', fontWeight: 400, color: T.textMuted, marginLeft: '4px' }}>min</span>
          </div>
        </div>

        <div style={{ background: '#F0FDF4', border: `1px solid ${T.accentBorder}`, borderRadius: '12px', padding: '11px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: T.textMid }}>
            Fare · {tripData?.actualMiles} mi
          </span>
          <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: '16px', fontWeight: 700, color: T.accent }}>
            ${fareData?.total}
          </span>
        </div>
      </div>
    </div>
  );
}
