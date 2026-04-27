import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Calendar, CalendarDays, Sun } from 'lucide-react';
import { C } from '@/App/Drivers/constants.js';

/**
 * StatTiles — tri-tier earnings glance.
 *
 * Layout: a hero "Today" card (taller, branded) sits above two compact
 * Week / Month side-by-side tiles. The hero shows a mini sparkline of the
 * week so the live "today" number always has visual context.
 */
export default function StatTiles({ earnings, online }) {
  const accentColor = online ? C.onlineGreen : C.text;

  const today          = earnings?.today ?? {};
  const week           = earnings?.week ?? {};
  const month          = earnings?.month ?? {};
  const dailyBreakdown = week.dailyBreakdown ?? [];

  const todayEarnings  = Number(today.earnings ?? 0);
  const todayTrips     = today.trips ?? 0;
  const weekEarnings   = Number(week.earnings ?? 0);
  const weekTrips      = week.trips ?? 0;
  const monthEarnings  = Number(month.earnings ?? 0);
  const monthTrips     = month.trips ?? 0;
  const changePercent  = week.changePercent ?? 0;
  const lastWeek       = week.lastWeekEarnings ?? 0;

  // Compute the running week total UP TO today (not the full 7-day total)
  // so the sparkline visually grows with the driver's actual progress
  const weekSoFar = useMemo(() => {
    return dailyBreakdown.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  }, [dailyBreakdown]);

  const maxBar = useMemo(() => {
    return Math.max(...dailyBreakdown.map(d => Number(d.amount) || 0), 1);
  }, [dailyBreakdown]);

  const isUp = changePercent >= 0;
  const trendColor = isUp ? "#16A34A" : "#DC2626";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <style>{`
        @keyframes stRevealUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes stBarGrow {
          from { transform: scaleY(0.05); }
          to   { transform: scaleY(1); }
        }
        @keyframes stShimmer {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
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

      {/* ── Week + Month duo ── */}
      <div style={{ display: "flex", gap: 10 }}>
        {/* Week */}
        <div style={{
          flex: 1,
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          padding: "14px 14px 12px",
          position: "relative",
          overflow: "hidden",
          boxShadow: `0 1px 3px ${C.shadow}`,
          animation: "stRevealUp .4s ease-out .18s both",
          transition: "box-shadow .2s, transform .2s, border-color .2s",
        }}
          onMouseEnter={e => {
            e.currentTarget.style.boxShadow = `0 6px 18px ${C.shadow}`;
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.borderColor = "#D1D5DB";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.boxShadow = `0 1px 3px ${C.shadow}`;
            e.currentTarget.style.transform = "";
            e.currentTarget.style.borderColor = C.border;
          }}
        >
          {/* Top accent line */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 2,
            background: "linear-gradient(90deg,#3B82F6,#2563EB)",
            opacity: 0.5,
          }}/>

          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
            <Calendar size={11} color="#2563EB" strokeWidth={2.4}/>
            <span className="mono" style={{
              fontSize: 9.5, fontWeight: 800, letterSpacing: ".08em",
              textTransform: "uppercase", color: C.textDim,
            }}>
              This Week
            </span>
          </div>

          <div className="condensed" style={{
            fontSize: 22, fontWeight: 900, color: C.text,
            letterSpacing: "-0.5px", lineHeight: 1.05,
            fontVariantNumeric: "tabular-nums",
          }}>
            ${weekEarnings.toFixed(2)}
          </div>

          {/* Trend chip */}
          {(weekEarnings > 0 || lastWeek > 0) ? (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 3,
              marginTop: 6,
              padding: "2px 7px",
              borderRadius: 100,
              background: isUp ? "rgba(22,163,74,.10)" : "rgba(220,38,38,.10)",
              border: `1px solid ${isUp ? "rgba(22,163,74,.2)" : "rgba(220,38,38,.2)"}`,
              fontSize: 10, fontWeight: 700,
              color: trendColor,
            }}>
              {isUp
                ? <TrendingUp size={10} strokeWidth={2.4}/>
                : <TrendingDown size={10} strokeWidth={2.4}/>}
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {isUp ? "+" : ""}{changePercent}%
              </span>
            </div>
          ) : (
            <div style={{
              fontSize: 10.5, fontWeight: 600, color: C.textDim, marginTop: 6,
            }}>
              {weekTrips} trip{weekTrips !== 1 ? "s" : ""}
            </div>
          )}
        </div>

        {/* Month */}
        <div style={{
          flex: 1,
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          padding: "14px 14px 12px",
          position: "relative",
          overflow: "hidden",
          boxShadow: `0 1px 3px ${C.shadow}`,
          animation: "stRevealUp .4s ease-out .26s both",
          transition: "box-shadow .2s, transform .2s, border-color .2s",
        }}
          onMouseEnter={e => {
            e.currentTarget.style.boxShadow = `0 6px 18px ${C.shadow}`;
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.borderColor = "#D1D5DB";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.boxShadow = `0 1px 3px ${C.shadow}`;
            e.currentTarget.style.transform = "";
            e.currentTarget.style.borderColor = C.border;
          }}
        >
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 2,
            background: "linear-gradient(90deg,#7C3AED,#5B21B6)",
            opacity: 0.5,
          }}/>

          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
            <CalendarDays size={11} color="#7C3AED" strokeWidth={2.4}/>
            <span className="mono" style={{
              fontSize: 9.5, fontWeight: 800, letterSpacing: ".08em",
              textTransform: "uppercase", color: C.textDim,
            }}>
              This Month
            </span>
          </div>

          <div className="condensed" style={{
            fontSize: 22, fontWeight: 900, color: C.text,
            letterSpacing: "-0.5px", lineHeight: 1.05,
            fontVariantNumeric: "tabular-nums",
          }}>
            ${monthEarnings.toFixed(2)}
          </div>

          <div style={{
            fontSize: 10.5, fontWeight: 600, color: C.textDim, marginTop: 6,
          }}>
            {monthTrips} trip{monthTrips !== 1 ? "s" : ""}
            {monthTrips > 0 && (
              <>
                <span style={{ margin: "0 4px", color: C.border }}>·</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  ${(monthEarnings / monthTrips).toFixed(2)} avg
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}