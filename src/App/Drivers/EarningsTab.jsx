import { C, EARNINGS_DATA } from '@/App/Drivers/constants.js';

const MAX_EARNING = Math.max(...EARNINGS_DATA.map(d => d.amount));

/**
 * Earnings tab — weekly bar chart, breakdown bars, summary tiles.
 *
 * Props:
 *   earnings — { today, week, trips }
 *   online   — bool (drives accent color)
 */
export default function EarningsTab({ earnings, online }) {
  const accentColor = online ? C.onlineGreen : C.offlineInk;

  return (
    <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14, animation: "slideUp .38s ease-out forwards" }}>
      <div className="condensed" style={{ fontSize: 28, fontWeight: 900, color: C.text, letterSpacing: "-0.5px" }}>
        Earnings
      </div>

      {/* Weekly bar chart */}
      <div className="card" style={{ padding: "22px" }}>
        <div className="condensed" style={{ fontSize: 13, fontWeight: 700, color: C.textMid, marginBottom: 18, letterSpacing: "1px", textTransform: "uppercase" }}>
          This Week
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 110 }}>
          {EARNINGS_DATA.map(d => {
            const isToday = d.day === "Fri";
            const pct     = (d.amount / MAX_EARNING) * 100;
            return (
              <div key={d.day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                {pct > 68 && (
                  <div className="mono" style={{ fontSize: 9, color: isToday ? accentColor : C.textDim, fontWeight: 700 }}>
                    ${d.amount}
                  </div>
                )}
                <div style={{
                  width: "100%", height: `${pct}px`,
                  background: isToday
                    ? (online ? "linear-gradient(180deg,#22C55E,#16A34A)" : "linear-gradient(180deg,#374151,#111827)")
                    : C.surfaceAlt,
                  borderRadius: "5px 5px 3px 3px", minHeight: 6,
                  boxShadow: isToday ? (online ? "0 0 14px rgba(22,163,74,.3)" : "0 0 14px rgba(17,24,39,.15)") : "none",
                  border: isToday
                    ? (online ? "1px solid rgba(22,163,74,.25)" : "1px solid rgba(17,24,39,.2)")
                    : `1px solid ${C.border}`,
                  transition: "height .5s ease-out",
                }}/>
                <div className="condensed" style={{ fontSize: 10, fontWeight: 700, color: isToday ? accentColor : C.textDim, letterSpacing: ".5px" }}>
                  {d.day.toUpperCase()}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Breakdown bars */}
      <div className="card" style={{ padding: "22px" }}>
        <div className="condensed" style={{ fontSize: 13, fontWeight: 700, color: C.textMid, marginBottom: 18, letterSpacing: "1px", textTransform: "uppercase" }}>
          Breakdown
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            { label: "Base Fare",      amount: "$780.00", pct: 84, c: accentColor },
            { label: "Surge Earnings", amount: "$98.00",  pct: 11, c: C.blue     },
            { label: "Tips",           amount: "$51.00",  pct: 5,  c: C.green    },
          ].map(item => (
            <div key={item.label}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>{item.label}</span>
                <span className="mono" style={{ fontSize: 13.5, fontWeight: 700, color: item.c }}>{item.amount}</span>
              </div>
              <div style={{ height: 6, background: C.surfaceAlt, borderRadius: 3, overflow: "hidden", border: `1px solid ${C.border}` }}>
                <div style={{ width: `${item.pct}%`, height: "100%", background: item.c, borderRadius: 3 }}/>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary tiles */}
      <div style={{ display: "flex", gap: 10 }}>
        {[
          { label: "This Week",  val: `$${earnings.week.toFixed(0)}`, sub: "47 trips"  },
          { label: "This Month", val: "$3,840",                        sub: "189 trips" },
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