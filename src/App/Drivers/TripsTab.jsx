import { Car, Star } from 'lucide-react';
import { C, RECENT_TRIPS, TYPE_COLOR, TYPE_LABEL } from '@/App/Drivers/constants.js';

/**
 * Trip history tab.
 *
 * Props:
 *   earnings — { trips } (today's trip count for the badge)
 *   online   — bool (drives accent color)
 */
export default function TripsTab({ earnings, online }) {
  const accentColor = online ? C.onlineGreen : C.offlineInk;

  return (
    <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14, animation: "slideUp .38s ease-out forwards" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="condensed" style={{ fontSize: 28, fontWeight: 900, color: C.text, letterSpacing: "-0.5px" }}>
          Trip History
        </div>
        <div style={{
          background: online ? "rgba(22,163,74,.1)" : C.surfaceAlt,
          border: online ? "1px solid rgba(22,163,74,.25)" : `1px solid ${C.border}`,
          borderRadius: 100, padding: "5px 13px",
        }}>
          <span className="condensed" style={{ fontSize: 12, fontWeight: 700, color: online ? accentColor : C.textMid, letterSpacing: ".5px" }}>
            TODAY · {earnings.trips} TRIPS
          </span>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {RECENT_TRIPS.map((trip, i) => (
          <div
            key={trip.id}
            style={{
              padding: "16px 20px",
              borderBottom: i < RECENT_TRIPS.length - 1 ? `1px solid ${C.border}` : "none",
              display: "flex", gap: 14, alignItems: "center",
              cursor: "pointer", transition: "background .15s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = C.surfaceAlt}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <div style={{
              width: 42, height: 42,
              background: TYPE_COLOR[trip.type] + "12",
              border: `1px solid ${TYPE_COLOR[trip.type]}30`,
              borderRadius: 13,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <Car size={18} color={TYPE_COLOR[trip.type]}/>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 14.5, fontWeight: 700, color: C.text }}>{trip.rider}</span>
                <span
                  className="badge-chip"
                  style={{ background: TYPE_COLOR[trip.type] + "15", border: `1px solid ${TYPE_COLOR[trip.type]}30`, color: TYPE_COLOR[trip.type] }}
                >
                  {TYPE_LABEL[trip.type]}
                </span>
              </div>
              <div style={{ fontSize: 12, color: C.textDim, fontWeight: 500 }}>
                {trip.from} → {trip.to}
              </div>
            </div>

            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div className="mono" style={{ fontSize: 14.5, fontWeight: 700, color: accentColor }}>{trip.fare}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 2, justifyContent: "flex-end", marginTop: 3 }}>
                {[...Array(5)].map((_, s) => (
                  <Star key={s} size={9} fill={s < trip.rating ? "#F59E0B" : C.border} color={s < trip.rating ? "#F59E0B" : C.border}/>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ textAlign: "center", padding: "4px 0" }}>
        <span style={{ fontSize: 13, color: C.textDim, fontWeight: 600, cursor: "pointer" }}>
          Load more history
        </span>
      </div>
    </div>
  );
}