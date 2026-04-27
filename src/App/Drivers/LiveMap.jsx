import { useEffect, useState, useMemo } from 'react';
import { Car, Users, Radar, MapPin, Activity, Clock } from 'lucide-react';
import { C } from '@/App/Drivers/constants.js';

// Deterministic dot positions — staged across the map with realistic distances
const DOT_POSITIONS = [
  { x: 22, y: 32, distance: 0.4 },
  { x: 68, y: 28, distance: 0.7 },
  { x: 78, y: 60, distance: 1.1 },
  { x: 32, y: 70, distance: 1.4 },
  { x: 88, y: 42, distance: 1.8 },
  { x: 12, y: 58, distance: 2.2 },
  { x: 56, y: 80, distance: 2.6 },
  { x: 92, y: 18, distance: 3.0 },
];

/**
 * Decorative live map shown when the driver is online and idle.
 *
 * Props:
 *   online      — boolean
 *   rides       — array of ride docs from useDriverRides
 *   activeTrip  — active trip object or null
 *   onlineSince — (optional) Date or timestamp
 */
export default function LiveMap({ online, rides = [], activeTrip, onlineSince }) {
  const [tick, setTick] = useState(0);

  // Heartbeat for "last update" indicator
  useEffect(() => {
    if (!online) return;
    const id = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(id);
  }, [online]);

  if (!online || activeTrip) return null;

  const nearbyRides = rides.filter(r => r.status === "searching_driver");
  const dotCount    = Math.min(nearbyRides.length, DOT_POSITIONS.length);
  const dots        = DOT_POSITIONS.slice(0, dotCount);

  // Closest rider distance (decorative)
  const closestRider = dots.length > 0
    ? Math.min(...dots.map(d => d.distance))
    : null;

  return (
    <div style={{
      position: "relative",
      height: 220,
      borderRadius: 22,
      overflow: "hidden",
      background: "linear-gradient(135deg,#0F1F17 0%,#0A1814 50%,#0F1F17 100%)",
      boxShadow: "0 12px 40px rgba(0,0,0,.18), 0 2px 8px rgba(0,0,0,.08), inset 0 1px 0 rgba(255,255,255,.04)",
      animation: "lmReveal .4s ease-out both",
    }}>
      <style>{`
        @keyframes lmReveal {
          from { opacity: 0; transform: scale(.97); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes lmRadarSweep {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes lmRipple {
          0%   { transform: translate(-50%, -50%) scale(0.4); opacity: 0.6; }
          100% { transform: translate(-50%, -50%) scale(2.2); opacity: 0; }
        }
        @keyframes lmCarBreathe {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50%      { transform: translate(-50%, -50%) scale(1.06); }
        }
        @keyframes lmDotPulse {
          0%, 100% { opacity: 0.85; transform: translate(-50%, -50%) scale(1); }
          50%      { opacity: 1;    transform: translate(-50%, -50%) scale(1.15); }
        }
        @keyframes lmFadeIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes lmRoadFlow {
          to { stroke-dashoffset: -50; }
        }
        @keyframes lmLiveDot {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.4; }
        }
      `}</style>

      {/* ── Background: suggested street grid (SVG) ── */}
      <svg
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          {/* Subtle grid */}
          <pattern id="lmGrid" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M8 0L0 0 0 8" fill="none" stroke="rgba(34,197,94,0.06)" strokeWidth="0.15"/>
          </pattern>

          {/* Radial vignette */}
          <radialGradient id="lmVig" cx="50%" cy="50%" r="60%">
            <stop offset="0%"  stopColor="rgba(34,197,94,0.08)"/>
            <stop offset="60%" stopColor="rgba(34,197,94,0.03)"/>
            <stop offset="100%" stopColor="rgba(0,0,0,0.45)"/>
          </radialGradient>
        </defs>

        <rect width="100" height="100" fill="url(#lmGrid)"/>

        {/* Suggested streets — major arteries */}
        <path d="M 0 32 L 100 30" stroke="rgba(255,255,255,0.07)" strokeWidth="2.4" strokeLinecap="round"/>
        <path d="M 0 68 L 100 70" stroke="rgba(255,255,255,0.06)" strokeWidth="2.0" strokeLinecap="round"/>
        <path d="M 28 0 L 26 100" stroke="rgba(255,255,255,0.07)" strokeWidth="2.2" strokeLinecap="round"/>
        <path d="M 72 0 L 74 100" stroke="rgba(255,255,255,0.06)" strokeWidth="2.0" strokeLinecap="round"/>

        {/* Dashed lane markings on main routes */}
        <path
          d="M 0 31 L 100 30"
          stroke="rgba(34,197,94,0.35)"
          strokeWidth="0.3"
          strokeDasharray="3 4"
          style={{ animation: "lmRoadFlow 2s linear infinite" }}
        />
        <path
          d="M 73 0 L 73 100"
          stroke="rgba(34,197,94,0.30)"
          strokeWidth="0.3"
          strokeDasharray="3 4"
          style={{ animation: "lmRoadFlow 2.6s linear infinite" }}
        />

        {/* Vignette overlay */}
        <rect width="100" height="100" fill="url(#lmVig)"/>
      </svg>

      {/* ── Radar sweep cone ── */}
      <div style={{
        position: "absolute", left: "50%", top: "50%",
        width: 360, height: 360,
        transform: "translate(-50%, -50%)",
        animation: "lmRadarSweep 5s linear infinite",
        pointerEvents: "none",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          background: "conic-gradient(from 0deg, rgba(34,197,94,0) 0deg, rgba(34,197,94,0) 280deg, rgba(34,197,94,0.18) 350deg, rgba(34,197,94,0.45) 360deg)",
          borderRadius: "50%",
          filter: "blur(2px)",
        }}/>
      </div>

      {/* ── Static radar rings emanating from center ── */}
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          position: "absolute", left: "50%", top: "50%",
          width: 80, height: 80,
          borderRadius: "50%",
          border: "1.5px solid rgba(34,197,94,0.5)",
          transform: "translate(-50%, -50%)",
          animation: `lmRipple 3s ease-out ${i * 1}s infinite`,
          pointerEvents: "none",
        }}/>
      ))}

      {/* ── Rider dots ── */}
      {dots.map((p, i) => (
        <div
          key={nearbyRides[i]?.id ?? i}
          style={{
            position: "absolute",
            left: `${p.x}%`, top: `${p.y}%`,
            transform: "translate(-50%, -50%)",
            zIndex: 4,
            animation: `lmFadeIn .5s cubic-bezier(.34,1.4,.64,1) ${i * 0.12}s both, lmDotPulse 2.4s ease-in-out ${i * 0.3}s infinite`,
          }}
        >
          {/* Halo */}
          <div style={{
            position: "absolute", inset: -6,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(96,165,250,0.3) 0%, transparent 70%)",
            pointerEvents: "none",
          }}/>
          {/* Dot */}
          <div style={{
            position: "relative",
            width: 22, height: 22,
            background: "linear-gradient(135deg,#60A5FA,#3B82F6)",
            border: "2px solid rgba(255,255,255,0.95)",
            borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(59,130,246,0.5), 0 0 0 4px rgba(59,130,246,0.18)",
          }}>
            <Users size={9} color="#fff" strokeWidth={2.4}/>
          </div>
        </div>
      ))}

      {/* ── Driver car pin (center) ── */}
      <div style={{
        position: "absolute", left: "50%", top: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 5,
        animation: "lmCarBreathe 3s ease-in-out infinite",
      }}>
        {/* Outer glow */}
        <div style={{
          position: "absolute", inset: -14, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(34,197,94,0.4) 0%, transparent 60%)",
          pointerEvents: "none",
          filter: "blur(4px)",
        }}/>
        <div style={{
          position: "relative",
          width: 56, height: 56,
          background: "linear-gradient(135deg,#22C55E,#16A34A 55%,#15803D)",
          borderRadius: "50%",
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "3px solid rgba(255,255,255,0.95)",
          boxShadow: "0 0 0 6px rgba(34,197,94,0.18), 0 8px 20px rgba(22,163,74,0.5)",
        }}>
          <Car size={22} color="#fff" strokeWidth={2}/>
        </div>
      </div>

      {/* ── Top status banner ── */}
      <div style={{
        position: "absolute", top: 12, left: 12, right: 12,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        zIndex: 10,
        pointerEvents: "none",
      }}>
        {/* Live indicator */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(34,197,94,0.3)",
          borderRadius: 100,
          padding: "5px 11px",
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "#4ADE80",
            boxShadow: "0 0 8px rgba(74,222,128,0.7)",
            animation: "lmLiveDot 1.6s ease-in-out infinite",
          }}/>
          <span className="mono" style={{
            fontSize: 9.5, fontWeight: 800, letterSpacing: ".1em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.92)",
          }}>
            Live
          </span>
        </div>

        {/* Radar status (top-right) */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 100,
          padding: "5px 11px",
        }}>
          <Radar size={10} color="rgba(255,255,255,0.85)" strokeWidth={2.4}/>
          <span style={{
            fontSize: 10, fontWeight: 700,
            color: "rgba(255,255,255,0.85)",
          }}>
            Active
          </span>
        </div>
      </div>

      {/* ── Bottom status chip ── */}
      <div style={{
        position: "absolute", bottom: 12, left: 12, right: 12,
        zIndex: 10,
        display: "flex", gap: 8,
        pointerEvents: "none",
      }}>
        <div style={{
          flex: 1,
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.4)",
          borderRadius: 14,
          padding: "9px 12px",
          display: "flex", alignItems: "center", gap: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: nearbyRides.length > 0
              ? "linear-gradient(135deg,#3B82F6,#2563EB)"
              : "linear-gradient(135deg,#22C55E,#16A34A)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
            boxShadow: nearbyRides.length > 0
              ? "0 4px 12px rgba(37,99,235,0.4)"
              : "0 4px 12px rgba(22,163,74,0.4)",
          }}>
            {nearbyRides.length > 0
              ? <Users size={14} color="#fff" strokeWidth={2.2}/>
              : <Activity size={14} color="#fff" strokeWidth={2.2}/>
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="condensed" style={{
              fontSize: 13, fontWeight: 800, color: C.text,
              letterSpacing: "-0.2px", lineHeight: 1.1,
            }}>
              {nearbyRides.length > 0
                ? `${nearbyRides.length} rider${nearbyRides.length > 1 ? "s" : ""} nearby`
                : "Scanning your area"}
            </div>
            <div style={{
              fontSize: 10.5, fontWeight: 600, color: C.textDim,
              marginTop: 1,
              display: "flex", alignItems: "center", gap: 5,
            }}>
              {nearbyRides.length > 0 && closestRider != null ? (
                <>
                  <MapPin size={9} strokeWidth={2.2}/>
                  Closest {closestRider.toFixed(1)} mi
                  <span style={{ width: 2, height: 2, borderRadius: "50%", background: C.border }}/>
                  <span>Stay ready</span>
                </>
              ) : (
                <>
                  <Clock size={9} strokeWidth={2.2}/>
                  Updated just now
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}