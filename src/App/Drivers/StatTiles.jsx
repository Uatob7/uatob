import { useMemo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useSettleDriverCash } from '@/App/Drivers/useSettleDriverCash';

export default function StatTiles({ earnings, online, driver }) {
  const cb           = driver?.cashBalance ?? {};
  const cashOwed     = Number(cb.cashOwed     ?? 0);
  const platformOwes = Number(cb.platformOwes ?? 0);
  const cashRides           = Number(cb.cashRides           ?? 0);
  const cardRides           = Number(cb.cardRides           ?? 0);
  const cashAppRides        = Number(cb.cashAppRides        ?? 0);
  const cardRidesPending    = Number(cb.cardRidesPending    ?? 0);
  const cashAppRidesPending = Number(cb.cashAppRidesPending ?? 0);
  const totalRides          = cashRides + cardRides + cashAppRides;
  const netPayout    = platformOwes - cashOwed;

  const today          = earnings?.today ?? {};
  const week           = earnings?.week  ?? {};
  const dailyBreakdown = Array.isArray(week.dailyBreakdown) ? week.dailyBreakdown : [];
  const todayEarnings  = Number(today.earnings ?? 0);
  const todayTrips     = Number(today.trips    ?? 0);

  const { settle, loading: settling, settled } = useSettleDriverCash();

  const isSettled  = settled || (cashOwed <= 0 && platformOwes <= 0);
  const driverUid  = driver?.uid ?? driver?.id ?? null;

  const weekSoFar = useMemo(() =>
    dailyBreakdown.reduce((sum, d) => sum + (Number(d?.amount) || 0), 0),
  [dailyBreakdown]);

  const maxBar = useMemo(() => {
    if (!dailyBreakdown.length) return 1;
    return Math.max(...dailyBreakdown.map(d => Number(d?.amount) || 0), 1);
  }, [dailyBreakdown]);

  const avgDay = useMemo(() => {
    const prior = dailyBreakdown.filter(d => d?.amount != null && !d?.isToday);
    if (!prior.length) return 0;
    return prior.reduce((s, d) => s + (Number(d.amount) || 0), 0) / prior.length;
  }, [dailyBreakdown]);

  const delta = avgDay > 0 && todayEarnings > 0
    ? Math.round(((todayEarnings - avgDay) / avgDay) * 100)
    : null;
  const up = delta != null && delta >= 0;

  const [dollars, cents] = todayEarnings.toFixed(2).split('.');
  const avgPx = avgDay > 0 ? 44 * (avgDay / maxBar) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <style>{`
        @keyframes stBarGrow { from { transform: scaleY(0.05); } to { transform: scaleY(1); } }
      `}</style>

      {/* ── Earnings row ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14 }}>

        {/* Left: numbers */}
        <div style={{ flex: 1, minWidth: 0 }}>
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

        {/* Right: sparkline */}
        {dailyBreakdown.length > 0 && (
          <div style={{ flexShrink: 0 }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 4, height: 44 }}>
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
                    width: 7, height: 44 * (pct / 100), minHeight: 4,
                    borderRadius: '2px 2px 1px 1px',
                    background: isFuture
                      ? 'rgba(255,255,255,.1)'
                      : d?.isToday
                        ? 'linear-gradient(180deg,#93C5FD,#3B82F6)'
                        : amt > 0 ? 'rgba(96,165,250,.38)' : 'rgba(255,255,255,.08)',
                    opacity: isFuture ? 0.4 : 1,
                    transformOrigin: 'bottom',
                    animation: `stBarGrow .5s cubic-bezier(.34,1.2,.64,1) ${0.1 + i * 0.04}s both`,
                    boxShadow: d?.isToday && !isFuture ? '0 0 10px rgba(59,130,246,.6)' : 'none',
                  }}/>
                );
              })}
            </div>
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

      {/* ── Cash balance panel ── */}
      {totalRides > 0 && (
        <div style={{
          padding: '10px 12px', borderRadius: 11,
          background: isSettled
            ? 'rgba(52,211,153,.07)'
            : netPayout > 0
              ? 'rgba(52,211,153,.07)'
              : 'rgba(251,113,133,.08)',
          border: `1px solid ${isSettled
            ? 'rgba(52,211,153,.2)'
            : netPayout > 0
              ? 'rgba(52,211,153,.2)'
              : 'rgba(251,113,133,.22)'}`,
        }}>
          {/* Balance row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{
              fontFamily: '"JetBrains Mono",monospace', fontSize: 9, fontWeight: 700,
              letterSpacing: '.08em', textTransform: 'uppercase',
              color: isSettled
                ? 'rgba(52,211,153,.7)'
                : netPayout > 0
                  ? 'rgba(52,211,153,.7)'
                  : 'rgba(251,113,133,.7)',
            }}>
              {isSettled
                ? 'Balance clear'
                : netPayout > 0
                  ? 'UaTob owes you'
                  : 'Cash owed to UaTob'}
            </span>
            <span style={{
              fontFamily: '"JetBrains Mono",monospace', fontSize: 13, fontWeight: 800,
              color: isSettled
                ? '#34D399'
                : netPayout > 0
                  ? '#34D399'
                  : '#FB7185',
            }}>
              {isSettled
                ? '✓'
                : netPayout > 0
                  ? `+$${netPayout.toFixed(2)}`
                  : `-$${Math.abs(netPayout).toFixed(2)}`}
            </span>
          </div>

          {/* Method pills + settle button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
            {cashRides > 0 && (
              <span style={{
                fontFamily: '"JetBrains Mono",monospace', fontSize: 8.5, fontWeight: 700,
                padding: '2px 8px', borderRadius: 99,
                background: 'rgba(251,191,36,.12)', border: '1px solid rgba(251,191,36,.25)',
                color: '#FBBF24',
              }}>
                {cashRides} cash
              </span>
            )}
            {cardRidesPending > 0 && (
              <span style={{
                fontFamily: '"JetBrains Mono",monospace', fontSize: 8.5, fontWeight: 700,
                padding: '2px 8px', borderRadius: 99,
                background: 'rgba(96,165,250,.12)', border: '1px solid rgba(96,165,250,.25)',
                color: '#60A5FA',
              }}>
                {cardRidesPending} card
              </span>
            )}
            {cashAppRidesPending > 0 && (
              <span style={{
                fontFamily: '"JetBrains Mono",monospace', fontSize: 8.5, fontWeight: 700,
                padding: '2px 8px', borderRadius: 99,
                background: 'rgba(52,211,153,.12)', border: '1px solid rgba(52,211,153,.25)',
                color: '#34D399',
              }}>
                {cashAppRidesPending} cash app
              </span>
            )}

            {/* Settle button — shown when platform owes driver */}
            {!isSettled && platformOwes > 0 && driverUid && (
              <button
                onClick={() => settle(driverUid)}
                disabled={settling}
                style={{
                  marginLeft: 'auto', flexShrink: 0,
                  padding: '3px 11px', borderRadius: 99, cursor: settling ? 'not-allowed' : 'pointer',
                  fontFamily: '"JetBrains Mono",monospace', fontSize: 8.5, fontWeight: 800,
                  letterSpacing: '.06em', textTransform: 'uppercase',
                  color: settling ? 'rgba(52,211,153,.4)' : '#34D399',
                  background: settling ? 'rgba(52,211,153,.05)' : 'rgba(52,211,153,.14)',
                  border: `1px solid ${settling ? 'rgba(52,211,153,.15)' : 'rgba(52,211,153,.35)'}`,
                  transition: 'all .2s ease',
                  opacity: settling ? 0.6 : 1,
                }}
              >
                {settling ? 'Settling…' : 'Settle'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
