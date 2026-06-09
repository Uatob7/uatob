// BookRideCard.jsx — Face 0: Book a Ride

import { C, MONO, COND }  from '@/App/UaTob/Statuscardtokens';

export default function BookRideCard({ onBook }) {
  return (
    <div style={{ padding: '12px 12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div>
          <div style={{
            fontFamily: COND, fontSize: 10, fontWeight: 800, letterSpacing: '.16em',
            color: C.greenBright, textTransform: 'uppercase',
          }}>Book a Ride</div>
          <div style={{ fontFamily: MONO, fontSize: 8.5, color: C.inkTextDim, marginTop: 1 }}>
            Orlando, FL
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%', background: C.greenBright,
            boxShadow: `0 0 6px ${C.greenBright}`,
            animation: 'uaBlink 1.6s ease-in-out infinite',
          }}/>
          <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: C.greenBright }}>
            LIVE
          </span>
        </div>
      </div>

      {/* Pickup / Dropoff rows */}
      <div style={{
        borderRadius: 10, overflow: 'hidden',
        border: '1px solid rgba(34,197,94,.18)',
        background: 'rgba(255,255,255,.03)',
      }}>
        {[
          { label: 'Pickup',   placeholder: 'Where are you?', dot: C.greenBright, glow: true  },
          { label: 'Drop-off', placeholder: 'Where to?',      dot: 'rgba(255,255,255,.55)', glow: false },
        ].map((row, i) => (
          <div key={i}>
            {i > 0 && <div style={{ height: 1, background: 'rgba(34,197,94,.1)', margin: '0 10px' }}/>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 11px' }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: row.dot,
                boxShadow: row.glow ? `0 0 5px ${C.greenBright}88` : 'none',
              }}/>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontFamily: COND, fontSize: 7.5, fontWeight: 800, letterSpacing: '.1em',
                  color: C.inkTextDim, textTransform: 'uppercase',
                }}>{row.label}</div>
                <div style={{
                  fontFamily: MONO, fontSize: 10, fontWeight: 600,
                  color: 'rgba(255,255,255,.35)',
                }}>{row.placeholder}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button onClick={onBook} style={{
        width: '100%', padding: '9px 0', borderRadius: 10,
        background: 'linear-gradient(135deg, #22C55E, #16A34A)',
        border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 18px rgba(34,197,94,.35)',
        animation: 'uaGlowPulse 2.8s ease-in-out infinite',
      }}>
        <span style={{
          fontFamily: COND, fontSize: 11, fontWeight: 800, letterSpacing: '.14em',
          color: '#fff', textTransform: 'uppercase',
        }}>Request Ride</span>
      </button>
    </div>
  );
}