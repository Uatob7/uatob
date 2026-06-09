// ScheduledCard.jsx — Face 2: Scheduled Rides

import { useMemo } from 'react';
import { C, MONO, COND, tsToMillis, formatCountdown, fmtSchedTime } from '@/App/UaTob/Statuscardtokens';

export default function ScheduledCard({ scheduledRides, now }) {
  const sorted = useMemo(() => {
    return [...scheduledRides]
      .map(r => ({ ...r, _when: tsToMillis(r.scheduledAt) }))
      .sort((a, b) => a._when - b._when)
      .slice(0, 3);
  }, [scheduledRides]);

  return (
    <div style={{ padding: '12px 12px 14px', display: 'flex', flexDirection: 'column', gap: 9 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div>
          <div style={{
            fontFamily: COND, fontSize: 10, fontWeight: 800, letterSpacing: '.16em',
            color: C.violet, textTransform: 'uppercase',
          }}>Scheduled</div>
          <div style={{ fontFamily: MONO, fontSize: 8.5, color: C.inkTextDim, marginTop: 1 }}>
            {sorted.length} upcoming
          </div>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '12px 0',
          fontFamily: MONO, fontSize: 10, color: C.inkTextDim, lineHeight: 1.6,
        }}>
          No scheduled rides.<br/>
          <span style={{ color: C.violet, opacity: .7 }}>Book one anytime</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {sorted.map((r, i) => {
            const cd       = r._when ? r._when - now : null;
            const due      = cd !== null && cd <= 0;
            const urgent   = cd !== null && cd > 0 && cd < 15 * 60 * 1000;
            const dotColor = due || urgent ? C.red : C.violet;
            return (
              <div key={r.id || i} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px',
                borderRadius: 8, background: 'rgba(192,132,252,.06)',
                border: '1px solid rgba(192,132,252,.14)',
                animation: `uaCardFlip .3s ease ${i * 0.05}s both`,
              }}>
                <div style={{
                  width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                  background: dotColor, boxShadow: `0 0 6px ${dotColor}`,
                  animation: (due || urgent) ? 'uaBlink 1.2s ease-in-out infinite' : 'none',
                }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: MONO, fontSize: 10, fontWeight: 700, color: '#F3E8FF',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {r.pickupLabel || r.pickupAddress || 'Pickup'}
                  </div>
                  <div style={{
                    fontFamily: MONO, fontSize: 8.5, color: 'rgba(192,132,252,.6)', marginTop: 1,
                  }}>
                    {fmtSchedTime(r._when)}
                  </div>
                </div>
                <div style={{
                  fontFamily: MONO, fontSize: 9, fontWeight: 800, flexShrink: 0,
                  color:      due || urgent ? C.red : '#E9D5FF',
                  background: due || urgent ? 'rgba(248,113,113,.14)' : 'rgba(192,132,252,.12)',
                  padding: '2px 7px', borderRadius: 6,
                }}>
                  {cd !== null ? formatCountdown(cd) : '—'}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}