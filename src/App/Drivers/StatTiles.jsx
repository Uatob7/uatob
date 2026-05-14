import { useMemo } from 'react';
import { Sun } from 'lucide-react';
import { C } from '@/App/Drivers/constants.js';

/**
 * StatTiles — displays today's earnings.
 */
export default function StatTiles({ earnings, online }) {
  const accentColor = online ? C.onlineGreen : C.text;

  const today          = earnings?.today ?? {};
  const week           = earnings?.week ?? {};
  const dailyBreakdown = week.dailyBreakdown ?? [];

  const todayEarnings  = Number(today.earnings ?? 0);
  const todayTrips     = today.trips ?? 0;

  // Compute the running week total UP TO today (not the full 7-day total)
  // so the sparkline visually grows with the driver's actual progress
  const weekSoFar = useMemo(() => {
    return dailyBreakdown.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  }, [dailyBreakdown]);

  const maxBar = useMemo(() => {
    return Math.max(...dailyBreakdown.map(d => Number(d.amount) || 0), 1);
  }, [dailyBreakdown]);

  return (
    <div>
      <style>{`
        @keyframes stRevealUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes stBarGrow {
          from { transform: scaleY(0.05); }
          to   { transform: scaleY(1); }
        }
      `}</style>

      {/* ── Hero "Today" tile ── */}
      <div style={{
        background: online
          ? "linear-gradient(135deg,#F0FDF4 0%,#DCFCE7 50%,#F0FDF4 100%)"
          : "linear-gradient(135deg,#FAFAF7 0%,#F5F5F0 50%,#FAFAF7 100%)",
        border: online ? "1.5px solid rgba(22,163,74,.28)" : `1.5px solid ${C.border}`,
        borderRadius: 22,
        padding: "20px 22px 18px",
        position: "relative",
        overflow: "hidden",
        boxShadow: online
          ? "0 8px 28px rgba(22,163,74,.12), 0 1px 3px rgba(22,163,74,.06)"
          : `0 4px 16px ${C.shadow}`,
        animation: "stRevealUp .4s ease-out .1s both",
      }}>
        {/* Decorative diagonal stripes */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: online
            ? "repeating-linear-gradient(45deg,transparent,transparent 60px,rgba(22,163,74,.04) 60px,rgba(22,163,74,.04) 61px)"
            : "repeating-linear-gradient(45deg,transparent,transparent 60px,rgba(0,0,0,.012) 60px,rgba(0,0,0,.012) 61px)",
          pointerEvents: "none",
        }}/>

        {/* Decorative corner glow */}
        {online && (
          <div style={{
            position: "absolute", top: -50, right: -50,
            width: 160, height: 160, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(22,163,74,.18) 0%, transparent 70%)",
            pointerEvents: "none",
          }}/>
        )}

        <div style={{ position: "relative" }}>
          <div style={{
            display: "flex", alignItems: "flex-start", justifyContent: "space-between",
            marginBottom: 12, gap: 12,
          }}>
            <div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                marginBottom: 6,
                padding: "3px 9px",
                borderRadius: 100,
                background: online ? "rgba(22,163,74,.12)" : C.surfaceAlt,
                border: `1px solid ${online ? "rgba(22,163,74,.2)" : C.border}`,
              }}>
                <Sun size={10} color={online ? C.onlineGreen : C.textDim} strokeWidth={2.4}/>
                <span className="mono" style={{
                  fontSize: 9.5, fontWeight: 800, letterSpacing: ".1em",
                  textTransform: "uppercase",
                  color: online ? C.onlineGreen : C.textDim,
                }}>
                  Today
                </span>
              </div>

              <div className="condensed" style={{
                fontSize: 38,
                fontWeight: 900,
                color: C.text,
                letterSpacing: "-1px",
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
              }}>
                ${todayEarnings.toFixed(2)}
              </div>

              <div style={{
                fontSize: 12, fontWeight: 600, color: C.textMid,
                marginTop: 5,
              }}>
                {todayTrips} trip{todayTrips !== 1 ? "s" : ""}
                {weekSoFar > 0 && (
                  <>
                    <span style={{ margin: "0 6px", color: C.textDim }}>·</span>
                    <span style={{ color: online ? "#15803D" : C.textMid }}>
                      ${weekSoFar.toFixed(2)} this week
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Mini sparkline */}
            {dailyBreakdown.length > 0 && (
              <div style={{
                display: "flex", alignItems: "flex-end", gap: 3,
                height: 38, flexShrink: 0, paddingTop: 4,
              }}>
                {dailyBreakdown.map((d, i) => {
                  const isFuture = d.amount == null;
                  const amt = Number(d.amount) || 0;
                  const pct = isFuture ? 6 : Math.max((amt / maxBar) * 100, amt > 0 ? 12 : 6);
                  return (
                    <div key={d.day ?? i} style={{
                      width: 6,
                      height: `${pct}%`,
                      minHeight: 4,
                      borderRadius: "2px 2px 1px 1px",
                      background: isFuture
                        ? C.border
                        : d.isToday
                          ? (online ? "linear-gradient(180deg,#22C55E,#16A34A)" : "linear-gradient(180deg,#374151,#111827)")
                          : amt > 0
                            ? (online ? "rgba(22,163,74,.3)" : C.border)
                            : C.surfaceAlt,
                      opacity: isFuture ? 0.4 : 1,
                      transformOrigin: "bottom",
                      animation: `stBarGrow .5s cubic-bezier(.34,1.2,.64,1) ${0.2 + i * 0.04}s both`,
                      boxShadow: d.isToday && !isFuture
                        ? (online ? "0 2px 6px rgba(22,163,74,.35)" : "0 2px 6px rgba(0,0,0,.15)")
                        : "none",
                    }}/>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}