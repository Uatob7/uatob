import { useMemo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

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

  // Average of completed prior days (excludes today + future) → gives today's number meaning
  const avgDay = useMemo(() => {
    const prior = dailyBreakdown.filter(d => d?.amount != null && !d?.isToday);
    if (!prior.length) return 0;
    return prior.reduce((s, d) => s + (Number(d.amount) || 0), 0) / prior.length;
  }, [dailyBreakdown]);

  const delta = avgDay > 0 && todayEarnings > 0
    ? Math.round(((todayEarnings - avgDay) / avgDay) * 100)
    : null;
  const up = delta != null && delta >= 0;

  // Split currency so digits are the hero and the symbol/cents recede
  const [dollars, cents] = todayEarnings.toFixed(2).split('.');
  const avgPx = avgDay > 0 ? 44 * (avgDay / maxBar) : 0;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14 }}>
      <style>{`
        @keyframes stBarGrow { from { transform: scaleY(0.05); } to { transform: scaleY(1); } }
      `}</style>

      {/* ── Left: numbers ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Hero number + trend */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap' }}>
          <div className="condensed" style={{
            color: '#fff', letterSpacing: '-1px', lineHeight: 1,
            fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
          }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: 'rgba(147,197,253,.5)', marginRight: 1 }}>$</span>
            <span style={{ fontSize: 34, fontWeight: 900 }}>{dollars}</span>
            <span style={{ fontSize: 19, fontWeight: 800, color: 'rgba(255,255,255,.55)' }}>.{cents}</span>
          </div>

          {delta != null && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 2,
              fontSize: 10.5, fontWeight: 800, fontFamily: '"JetBrains Mono",monospace',
              color: up ? '#34D399' : '#FB7185',
              background: up ? 'rgba(52,211,153,.12)' : 'rgba(251,113,133,.12)',
              border: `1px solid ${up ? 'rgba(52,211,153,.28)' : 'rgba(251,113,133,.28)'}`,
              padding: '1px 7px 1px 5px', borderRadius: 99,
            }}>
              {up ? <TrendingUp size={11} strokeWidth={2.6}/> : <TrendingDown size={11} strokeWidth={2.6}/>}
              {Math.abs(delta)}%
            </span>
          )}
        </div>

        {/* Meta line */}
        <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(147,197,253,.65)', marginTop: 7, lineHeight: 1.4 }}>
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

      {/* ── Right: sparkline with average baseline ── */}
      {dailyBreakdown.length > 0 && (
        <div style={{ flexShrink: 0 }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 4, height: 44 }}>
            {/* dashed weekly-average baseline */}
            {avgPx > 0 && (
              <div style={{
                position: 'absolute', left: 0, right: 0, bottom: avgPx, height: 0,
                borderTop: '1px dashed rgba(147,197,253,.35)', pointerEvents: 'none',
              }}/>
            )}
            {dailyBreakdown.map((d, i) => {
              const isFuture = d?.amount == null;
              const amt      = Number(d?.amount) || 0;
              const pct      = isFuture ? 6 : Math.max((amt / maxBar) * 100, amt > 0 ? 14 : 6);
              return (
                <div key={d?.day ?? i} style={{
                  width: 7,
                  height: 44 * (pct / 100),
                  minHeight: 4,
                  borderRadius: '2px 2px 1px 1px',
                  background: isFuture
                    ? 'rgba(255,255,255,.1)'
                    : d?.isToday
                      ? 'linear-gradient(180deg,#93C5FD,#3B82F6)'
                      : amt > 0
                        ? 'rgba(96,165,250,.38)'
                        : 'rgba(255,255,255,.08)',
                  opacity: isFuture ? 0.4 : 1,
                  transformOrigin: 'bottom',
                  animation: `stBarGrow .5s cubic-bezier(.34,1.2,.64,1) ${0.1 + i * 0.04}s both`,
                  boxShadow: d?.isToday && !isFuture ? '0 0 10px rgba(59,130,246,.6)' : 'none',
                }}/>
              );
            })}
          </div>

          {/* day initials, aligned under bars */}
          <div style={{ display: 'flex', gap: 4, marginTop: 5 }}>
            {dailyBreakdown.map((d, i) => (
              <span key={d?.day ?? i} style={{
                width: 7, textAlign: 'center',
                fontSize: 7.5, fontWeight: 700, letterSpacing: '.02em',
                color: d?.isToday ? '#93C5FD' : 'rgba(255,255,255,.25)',
                textTransform: 'uppercase', fontFamily: '"JetBrains Mono",monospace',
              }}>
                {d?.day ? String(d.day).slice(0, 1) : ''}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
