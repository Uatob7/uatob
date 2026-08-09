// DriverPushFace.jsx
// The "Turn on ride alerts" side of the driver StatusCard flip. Shows only when
// push isn't enabled yet; tapping Enable runs the parent's push-enable flow
// (request permission → register FCM token).

import { useState } from 'react';

const COND = "'Barlow Condensed',sans-serif";
const MONO = "'JetBrains Mono',monospace";

export default function DriverPushFace({ onEnable, denied }) {
  const [busy, setBusy] = useState(false);
  const enable = async (e) => {
    e?.stopPropagation?.();
    if (busy) return;
    setBusy(true);
    try { await onEnable?.(); } finally { setBusy(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 4, padding: '4px 6px' }}>
      <div style={{
        width: 52, height: 52, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
        background: 'rgba(251,191,36,.12)', border: '1px solid rgba(251,191,36,.32)', color: '#FBBF24', marginBottom: 6,
      }}>🔔</div>

      <div style={{ fontFamily: COND, fontSize: 20, fontWeight: 900, letterSpacing: '.02em', color: 'rgba(232,255,239,.95)', lineHeight: 1 }}>
        Turn on ride alerts
      </div>
      <div style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,.5)', lineHeight: 1.5, maxWidth: 260, marginTop: 2 }}>
        {denied
          ? 'Notifications are blocked. Re-enable them for UaTob in your browser settings to get ride requests.'
          : "Get pinged the instant a ride comes in — even with the app closed. Don't miss a fare."}
      </div>

      {!denied && (
        <button onClick={enable} disabled={busy} style={{
          marginTop: 12, border: 'none', cursor: busy ? 'wait' : 'pointer', borderRadius: 12, padding: '11px 26px',
          fontFamily: COND, fontSize: 14, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#150e02',
          background: 'linear-gradient(135deg,#FCD34D,#FBBF24 55%,#D97706)', boxShadow: '0 8px 22px rgba(251,191,36,.3)',
        }}>{busy ? 'Enabling…' : 'Enable alerts'}</button>
      )}
    </div>
  );
}
