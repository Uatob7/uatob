import { C } from '@/App/Drivers/constants.js';

export default function StatTiles({ earnings, online }) {
  const accentColor = online ? C.onlineGreen : C.offlineInk;

  const changePercent = earnings?.week?.changePercent ?? 0;
  const changeLabel   = `${changePercent >= 0 ? "+" : ""}${changePercent}% vs last week`;

  const tiles = [
    {
      label: "Today",
      val:   `$${(earnings?.today?.earnings ?? 0).toFixed(2)}`,
      sub:   `${earnings?.today?.trips ?? 0} trips`,
      hi:    true,
    },
    {
      label: "This Week",
      val:   `$${(earnings?.week?.earnings ?? 0).toFixed(2)}`,
      sub:   changeLabel,
    },
    {
      label: "This Month",
      val:   `$${(earnings?.month?.earnings ?? 0).toFixed(2)}`,
      sub:   `${earnings?.month?.trips ?? 0} trips`,
    },
  ];

  return (
    <div style={{ display: "flex", gap: 10 }}>
      {tiles.map((s, i) => (
        <div
          key={s.label}
          style={{
            background:   C.surface,
            border:       `1px solid ${C.border}`,
            borderRadius: 18,
            padding:      18,
            flex:         1,
            boxShadow:    `0 2px 10px ${C.shadow}`,
            animation:    `revealUp .4s ease-out ${0.1 + i * 0.07}s forwards`,
            opacity:      0,
            transition:   "box-shadow .2s, transform .2s",
          }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 6px 22px ${C.shadowMd}`; e.currentTarget.style.transform = "translateY(-1px)"; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 2px 10px ${C.shadow}`;   e.currentTarget.style.transform = ""; }}
        >
          <div className="lbl">{s.label}</div>
          <div
            className="mono condensed"
            style={{
              fontSize:      24,
              fontWeight:    700,
              color:         s.hi ? accentColor : C.text,
              letterSpacing: "-0.5px",
              lineHeight:    1.1,
            }}
          >
            {s.val}
          </div>
          <div
            style={{
              fontSize:  11,
              color:     s.sub.includes("+") ? C.green : s.sub.includes("-") ? C.red ?? "#EF4444" : C.textDim,
              marginTop: 4,
              fontWeight: 600,
            }}
          >
            {s.sub}
          </div>
        </div>
      ))}
    </div>
  );
}