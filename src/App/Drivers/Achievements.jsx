import { Star, Zap, Shield, Award } from 'lucide-react';
import { C } from '@/App/Drivers/constants.js';

const BADGES = [
  { icon: Star,   label: "Top Rated",  c: "#D97706",      earned: true  },
  { icon: Zap,    label: "Speed Star", c: C.purple,       earned: true  },
  { icon: Shield, label: "Safe Driver",c: C.blue,         earned: true  },
  { icon: Award,  label: "100 Trips",  c: C.onlineGreen,  earned: false },
];

/**
 * Achievement badge row.
 *
 * Props:
 *   online — bool (drives "See all" link color)
 */
export default function Achievements({ online }) {
  return (
    <div className="card" style={{ padding: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div className="condensed" style={{ fontSize: 17, fontWeight: 800, color: C.text, letterSpacing: "-0.3px" }}>
          Achievements
        </div>
        <span style={{ fontSize: 12, color: online ? C.onlineGreen : C.offlineInk, fontWeight: 700, cursor: "pointer" }}>
          See all
        </span>
      </div>

      <div style={{ display: "flex", gap: 9 }}>
        {BADGES.map(b => (
          <div
            key={b.label}
            style={{
              flex: 1,
              background: b.earned ? b.c + "0D" : C.surfaceAlt,
              border: `1px solid ${b.earned ? b.c + "35" : C.border}`,
              borderRadius: 15, padding: "13px 6px",
              textAlign: "center",
              opacity: b.earned ? 1 : 0.4,
            }}
          >
            <div style={{
              width: 34, height: 34,
              background: b.earned ? b.c + "18" : C.border,
              borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 8px",
            }}>
              <b.icon size={16} color={b.earned ? b.c : C.textDim}/>
            </div>
            <div className="condensed" style={{ fontSize: 10, fontWeight: 700, color: b.earned ? b.c : C.textDim, letterSpacing: ".5px" }}>
              {b.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}