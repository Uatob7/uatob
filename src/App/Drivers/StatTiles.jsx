import { C } from '@/App/Drivers/constants.js';

/**
 * Three summary stat tiles shown on the home tab.
 *
 * Props:
 *   earnings  — { today: number, week: number, trips: number }
 *   online    — bool (drives accent color)
 */
export default function StatTiles({ earnings, online }) {
  const accentColor = online ? C.onlineGreen : C.offlineInk;

  const tiles = [
    { label: "Today",      val: `$${earnings.today}`,            sub: `${earnings.trips} trips`, hi: true  },
    { label: "This Week",  val: `$${earnings.week.toFixed(0)}`,  sub: "+12% vs last"                       },
    { label: "Acceptance", val: "94%",                           sub: "rate"                               },
  ];

  return (
    <div style={{ display: "flex", gap: 10 }}>
      {tiles.map((s, i) => (
        <div
          key={s.label}
          style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 18, padding: 18, flex: 1,
            boxShadow: `0 2px 10px ${C.shadow}`,
            animation: `revealUp .4s ease-out ${0.1 + i * 0.07}s forwards`,
            opacity: 0,
            transition: "box-shadow .2s, transform .2s",
          }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 6px 22px ${C.shadowMd}`; e.currentTarget.style.transform = "translateY(-1px)"; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 2px 10px ${C.shadow}`;   e.currentTarget.style.transform = ""; }}
        >
          <div className="lbl">{s.label}</div>
          <div className="mono condensed" style={{ fontSize: 24, fontWeight: 700, color: s.hi ? accentColor : C.text, letterSpacing: "-0.5px", lineHeight: 1.1 }}>
            {s.val}
          </div>
          <div style={{ fontSize: 11, color: s.sub.includes("+") ? C.green : C.textDim, marginTop: 4, fontWeight: 600 }}>
            {s.sub}
          </div>
        </div>
      ))}
    </div>
  );
}