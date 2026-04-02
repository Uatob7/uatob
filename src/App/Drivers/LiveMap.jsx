import { Car, Users } from 'lucide-react';
import { C } from '@/App/Drivers/constants.js';

// Deterministic dot positions — one per ride, spread across the map
const DOT_POSITIONS = [
  { x: 18, y: 28 },
  { x: 58, y: 42 },
  { x: 72, y: 20 },
  { x: 38, y: 68 },
  { x: 82, y: 55 },
  { x: 25, y: 55 },
  { x: 65, y: 75 },
  { x: 90, y: 35 },
];

/**
 * Decorative map widget shown when the driver is online but not on a trip.
 *
 * Props:
 *   online      — boolean
 *   rides       — array of ride docs from useDriverRides
 *   activeTrip  — active trip object or null
 */
export default function LiveMap({ online, rides, activeTrip }) {
  if (!online || activeTrip) return null;

  const nearbyRides = rides.filter(r => r.status === "searching_driver");
  const dotCount    = Math.min(nearbyRides.length, DOT_POSITIONS.length);
  const dots        = DOT_POSITIONS.slice(0, dotCount);

  return (
    <div className="map-area" style={{ height: 190, animation: "scaleIn .4s ease-out" }}>
      {/* Grid pattern */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: .07 }}>
        <defs>
          <pattern id="mg" width="36" height="36" patternUnits="userSpaceOnUse">
            <path d="M36 0L0 0 0 36" fill="none" stroke="#16A34A" strokeWidth="0.8"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#mg)"/>
      </svg>

      {/* Diagonal stripe overlay */}
      <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(45deg,transparent,transparent 60px,rgba(22,163,74,.018) 60px,rgba(22,163,74,.018) 61px)" }}/>

      {/* Rider dots — one per searching_driver ride */}
      {dots.map((p, i) => (
        <div
          key={nearbyRides[i]?.id ?? i}
          style={{
            position: "absolute", left: `${p.x}%`, top: `${p.y}%`,
            transform: "translate(-50%,-50%)",
            animation: "pulse 2.2s ease-in-out infinite",
            animationDelay: `${i * 0.35}s`,
          }}
        >
          <div style={{
            width: 24, height: 24,
            background: "rgba(37,99,235,.08)",
            border: "1.5px solid rgba(37,99,235,.25)",
            borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Users size={10} color={C.blue}/>
          </div>
        </div>
      ))}

      {/* Driver car pin */}
      <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", zIndex: 3 }}>
        <div style={{
          width: 54, height: 54,
          background: "linear-gradient(135deg,#22C55E,#16A34A 55%,#15803D)",
          borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "3px solid rgba(255,255,255,.9)",
          boxShadow: "0 0 0 6px rgba(22,163,74,.15), 0 6px 20px rgba(22,163,74,.35)",
          animation: "greenRing 2.5s ease-in-out infinite",
        }}>
          <Car size={22} color="#fff"/>
        </div>
      </div>

      {/* Status chip */}
      <div style={{
        position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)",
        background: "rgba(255,255,255,.94)", backdropFilter: "blur(12px)",
        border: `1px solid ${C.border}`, borderRadius: 100,
        padding: "7px 16px", whiteSpace: "nowrap",
        boxShadow: `0 4px 16px ${C.shadow}`,
      }}>
        <span className="condensed" style={{ fontSize: 12.5, fontWeight: 700, color: C.text, letterSpacing: ".5px" }}>
          {nearbyRides.length > 0
            ? `${nearbyRides.length} RIDER${nearbyRides.length > 1 ? "S" : ""} NEARBY — SCANNING`
            : "SCANNING FOR RIDERS..."}
        </span>
      </div>
    </div>
  );
}