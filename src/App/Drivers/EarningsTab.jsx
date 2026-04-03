import { ArrowDownToLine } from 'lucide-react';
import { C } from '@/App/Drivers/constants.js';

export default function EarningsTab({ earnings, online }) {
  const accentColor = online ? C.onlineGreen : C.offlineInk;

  const weekEarnings    = earnings?.week?.earnings    ?? 0;
  const weekTrips       = earnings?.week?.trips       ?? 0;
  const monthEarnings   = earnings?.month?.earnings   ?? 0;
  const monthTrips      = earnings?.month?.trips      ?? 0;
  const changePercent   = earnings?.week?.changePercent ?? 0;
  const dailyBreakdown  = earnings?.week?.dailyBreakdown ?? [];
  const available       = monthEarnings.toFixed(2);

  // Max amount across days that have data (exclude null future days)
  const maxAmount = Math.max(
    ...dailyBreakdown.map(d => d.amount ?? 0),
    1  // avoid divide-by-zero if all zero
  );

  return (
    <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14, animation: "slideUp .38s ease-out forwards" }}>
      <div className="condensed" style={{ fontSize: 28, fontWeight: 900, color: C.text, letterSpacing: "-0.5px" }}>
        Earnings
      </div>

      {/* Weekly bar chart */}
      <div className="card" style={{ padding: "22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div className="condensed" style={{ fontSize: 13, fontWeight: 700, color: C.textMid, letterSpacing: "1px", textTransform: "uppercase" }}>
            This Week
          </div>
          <div style={{
            fontSize: 11, fontWeight: 700,
            color: changePercent >= 0 ? C.green : "#EF4444",
            background: changePercent >= 0 ? "rgba(22,163,74,.08)" : "rgba(239,68,68,.08)",
            border: `1px solid ${changePercent >= 0 ? "rgba(22,163,74,.2)" : "rgba(239,68,68,.2)"}`,
            borderRadius: 100, padding: "3px 10px",
          }}>
            {changePercent >= 0 ? "+" : ""}{changePercent}% vs last week
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 110 }}>
          {dailyBreakdown.length > 0
            ? dailyBreakdown.map((d, i) => {
                const isFuture = d.amount === null;
                const pct      = isFuture ? 0 : Math.max((d.amount / maxAmount) * 100, d.amount > 0 ? 6 : 0);
                return (
                  <div key={d.day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                    {/* Amount label — only show if bar is tall enough */}
                    {!isFuture && pct > 60 && (
                      <div className="mono" style={{ fontSize: 9, color: d.isToday ? accentColor : C.textDim, fontWeight: 700 }}>
                        ${d.amount}
                      </div>
                    )}
                    {/* Bar */}
                    <div style={{
                      width:        "100%",
                      height:       `${isFuture ? 6 : Math.max(pct, 6)}px`,
                      background:   isFuture
                        ? C.border
                        : d.isToday
                          ? (online ? "linear-gradient(180deg,#22C55E,#16A34A)" : "linear-gradient(180deg,#374151,#111827)")
                          : C.surfaceAlt,
                      borderRadius: "5px 5px 3px 3px",
                      boxShadow:    d.isToday && !isFuture
                        ? (online ? "0 0 14px rgba(22,163,74,.3)" : "0 0 14px rgba(17,24,39,.15)")
                        : "none",
                      border: d.isToday && !isFuture
                        ? (online ? "1px solid rgba(22,163,74,.25)" : "1px solid rgba(17,24,39,.2)")
                        : `1px solid ${C.border}`,
                      opacity:    isFuture ? 0.35 : 1,
                      transition: "height .5s ease-out",
                    }}/>
                    {/* Day label */}
                    <div className="condensed" style={{ fontSize: 10, fontWeight: 700, color: d.isToday ? accentColor : C.textDim, letterSpacing: ".5px" }}>
                      {d.day.toUpperCase()}
                    </div>
                  </div>
                );
              })
            : (
              // Loading skeleton bars
              Array.from({ length: 7 }).map((_, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                  <div style={{ width: "100%", height: 40, background: C.border, borderRadius: "5px 5px 3px 3px", opacity: 0.4 }}/>
                  <div style={{ width: 20, height: 8, background: C.border, borderRadius: 4, opacity: 0.4 }}/>
                </div>
              ))
            )
          }
        </div>
      </div>

      {/* Withdrawal card */}
      <div className="card" style={{ padding: "22px" }}>
        <div className="condensed" style={{ fontSize: 13, fontWeight: 700, color: C.textMid, marginBottom: 16, letterSpacing: "1px", textTransform: "uppercase" }}>
          Available to Withdraw
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div className="mono condensed" style={{ fontSize: 38, fontWeight: 700, color: C.text, letterSpacing: "-1px", lineHeight: 1 }}>
              ${available}
            </div>
            <div style={{ fontSize: 12, color: C.textDim, fontWeight: 600, marginTop: 4 }}>
              Instant transfer · usually &lt; 30 min
            </div>
          </div>
          <div style={{
            width: 52, height: 52,
            background: accentColor + "15",
            border: `1.5px solid ${accentColor}30`,
            borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <ArrowDownToLine size={22} color={accentColor} />
          </div>
        </div>

        <button
          style={{
            width: "100%", padding: "15px 20px",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
            background: online
              ? "linear-gradient(135deg,#22C55E,#16A34A 55%,#15803D)"
              : "linear-gradient(135deg,#374151,#111827)",
            border: "none", borderRadius: 13, color: "#fff",
            fontFamily: "'Barlow',sans-serif", fontWeight: 800, fontSize: 15,
            letterSpacing: ".3px", cursor: "pointer",
            boxShadow: online ? "0 4px 18px rgba(22,163,74,.28)" : "0 4px 18px rgba(0,0,0,.18)",
            transition: "filter .15s, transform .1s",
          }}
          onMouseEnter={e => { e.currentTarget.style.filter    = "brightness(1.08)"; }}
          onMouseLeave={e => { e.currentTarget.style.filter    = ""; }}
          onMouseDown={e  => { e.currentTarget.style.transform = "scale(.98)"; }}
          onMouseUp={e    => { e.currentTarget.style.transform = ""; }}
        >
          <ArrowDownToLine size={17} />
          Withdraw ${available}
        </button>
      </div>

      {/* Summary tiles */}
      <div style={{ display: "flex", gap: 10 }}>
        {[
          { label: "This Week",  val: `$${weekEarnings.toFixed(2)}`,  sub: `${weekTrips} trips`  },
          { label: "This Month", val: `$${monthEarnings.toFixed(2)}`, sub: `${monthTrips} trips` },
        ].map(c => (
          <div key={c.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: 18, flex: 1, textAlign: "center", boxShadow: `0 2px 10px ${C.shadow}` }}>
            <div className="lbl">{c.label}</div>
            <div className="mono condensed" style={{ fontSize: 24, fontWeight: 700, color: accentColor, letterSpacing: "-0.5px" }}>
              {c.val}
            </div>
            <div style={{ fontSize: 11, color: C.textDim, marginTop: 4, fontWeight: 600 }}>{c.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}