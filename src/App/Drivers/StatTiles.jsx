import { useMemo } from 'react';

export default function StatTiles({ earnings, online }) {
  const today          = earnings?.today ?? {};
  const week           = earnings?.week  ?? {};
  const dailyBreakdown = Array.isArray(week.dailyBreakdown) ? week.dailyBreakdown : [];
  const todayEarnings  = Number(today.earnings ?? 0);
  const todayTrips     = Number(today.trips    ?? 0);

  const weekSoFar = useMemo(() =>
    dailyBreakdown.reduce((sum, d) => sum + (Number(d?.amount) || 0), 0),
  [dailyBreakdown]);

  const maxBar = useMemo(() => {
    if (!dailyBreakdown.length) return 1;
    return Math.max(...dailyBreakdown.map(d => Number(d?.amount) || 0), 1);
  }, [dailyBreakdown]);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14 }}>
      <style>{`
        @keyframes stBarGrow { from { transform: scaleY(0.05); } to { transform: scaleY(1); } }
      `}</style>

      {/* ── Left: numbers ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Today's earnings */}
        <div className="condensed" style={{
          fontSize: 34, fontWeight: 900, color: '#fff',
          letterSpacing: '-1px', lineHeight: 1, fontVariantNumeric: 'tabular-nums',
        }}>
          ${todayEarnings.toFixed(2)}
        </div>

        {/* Meta line */}
        <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(147,197,253,.65)', marginTop: 6, lineHeight: 1.4 }}>
          {todayTrips} trip{todayTrips !== 1 ? 's' : ''} today
          {weekSoFar > 0 && (
            <>
              <span style={{ margin: '0 6px', color: 'rgba(255,255,255,.2)' }}>·</span>
              <span style={{ color: '#93C5FD', fontFamily: '"JetBrains Mono",monospace', fontWeight: 700 }}>
                ${weekSoFar.toFixed(2)}
              </span>
              <span style={{ color: 'rgba(255,255,255,.35)', marginLeft: 4 }}>this week</span>
            </>
          )}
        </div>
      </div>

      {/* ── Right: sparkline ── */}
      {dailyBreakdown.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 44, flexShrink: 0 }}>
          {dailyBreakdown.map((d, i) => {
            const isFuture = d?.amount == null;
            const amt      = Number(d?.amount) || 0;
            const pct      = isFuture ? 6 : Math.max((amt / maxBar) * 100, amt > 0 ? 14 : 6);
            return (
              <div key={d?.day ?? i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: 7,
                  height: 44 * (pct / 100),
                  minHeight: 4,
                  borderRadius: '2px 2px 1px 1px',
                  background: isFuture
                    ? 'rgba(255,255,255,.1)'
                    : d?.isToday
                      ? 'linear-gradient(180deg,#60A5FA,#3B82F6)'
                      : amt > 0
                        ? 'rgba(96,165,250,.35)'
                        : 'rgba(255,255,255,.08)',
                  opacity: isFuture ? 0.4 : 1,
                  transformOrigin: 'bottom',
                  animation: `stBarGrow .5s cubic-bezier(.34,1.2,.64,1) ${0.1 + i * 0.04}s both`,
                  boxShadow: d?.isToday && !isFuture ? '0 2px 8px rgba(59,130,246,.5)' : 'none',
                }}/>
                {d?.day && (
                  <span style={{
                    fontSize: 7.5, fontWeight: 700, letterSpacing: '.04em',
                    color: d?.isToday ? '#93C5FD' : 'rgba(255,255,255,.25)',
                    textTransform: 'uppercase', fontFamily: '"JetBrains Mono",monospace',
                  }}>
                    {String(d.day).slice(0, 1)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}