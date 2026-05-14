
import { useEffect, useState, useMemo } from 'react';
import { Car, Users, Radar, MapPin, Activity, Clock, ChevronRight, DollarSign, Navigation } from 'lucide-react';
import { C } from '@/App/Drivers/constants.js';

/**
 * Calculate distance between two coordinates (haversine formula)
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Convert lat/lon to percentage position on map viewport (simplified)
 */
const latlngToMapPercent = (driverLat, driverLon, rideLat, rideLon) => {
  // Simple conversion - in production you'd use actual map bounds
  const deltaLat = (rideLat - driverLat) * 111; // 1 degree ≈ 111 km
  const deltaLon = (rideLon - driverLon) * 85.4; // Adjusted for latitude
  
  const x = 50 + (deltaLon / 5) * 10; // Map to 0-100%
  const y = 50 - (deltaLat / 5) * 10;
  
  return {
    x: Math.max(5, Math.min(95, x)),
    y: Math.max(5, Math.min(95, y)),
  };
};

/**
 * Enhanced Live Map with interactive ride selection
 * Shows real-time search requests as dots with detailed information
 *
 * Props:
 *   online      — boolean
 *   driver      — driver object with location { lat, lng }
 *   searches    — array of active search objects
 *   activeTrip  — active trip object or null
 *   onRideAccepted — (optional) callback when driver selects a ride
 */
export default function LiveMap({ online, driver, searches = [], activeTrip, onRideAccepted }) {
  const [tick, setTick] = useState(0);
  const [selectedRideId, setSelectedRideId] = useState(null);
  const [hoveredRideId, setHoveredRideId] = useState(null);

  // Heartbeat for "last update" indicator
  useEffect(() => {
    if (!online) return;
    const id = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(id);
  }, [online]);

  if (!online || activeTrip) return null;

  // Process searches into displayable ride data with calculated distances
  const processedRides = useMemo(() => {
    if (!driver?.lat || !driver?.lng) return [];
    
    return searches
      .filter(s => s.status === "searching_driver")
      .map(ride => {
        const distance = calculateDistance(
          driver.lat, driver.lng,
          ride.pickupLat || ride.pickup?.lat, 
          ride.pickupLng || ride.pickup?.lng
        );
        const mapPos = latlngToMapPercent(
          driver.lat, driver.lng,
          ride.pickupLat || ride.pickup?.lat,
          ride.pickupLng || ride.pickup?.lng
        );
        return {
          ...ride,
          distance,
          mapX: mapPos.x,
          mapY: mapPos.y,
          estimatedEarnings: ride.fare || Math.round(distance * 1.5 + 3),
        };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 8); // Show max 8 dots on map
  }, [searches, driver]);

  const closestRider = processedRides.length > 0 ? processedRides[0].distance : null;
  const selectedRide = processedRides.find(r => r.id === selectedRideId);
  const hoveredRide = processedRides.find(r => r.id === hoveredRideId);

  return (
    <div style={{
      position: "relative",
      height: 280,
      borderRadius: 22,
      overflow: "hidden",
      background: "linear-gradient(135deg,#0F1F17 0%,#0A1814 50%,#0F1F17 100%)",
      boxShadow: "0 12px 40px rgba(0,0,0,.18), 0 2px 8px rgba(0,0,0,.08), inset 0 1px 0 rgba(255,255,255,.04)",
      animation: "lmReveal .4s ease-out both",
      display: "flex", flexDirection: "column",
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
        @keyframes lmDotSelect {
          0% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.4); }
          100% { transform: translate(-50%, -50%) scale(1.2); }
        }
      `}</style>

      {/* ── Main Map Area ── */}
      <div style={{ flex: 1, position: "relative", minHeight: 200 }}>
        {/* Background: suggested street grid (SVG) */}
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

        {/* Radar sweep cone */}
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

        {/* Static radar rings */}
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

        {/* Rider dots - Interactive */}
        {processedRides.map((ride, i) => {
          const isHovered = hoveredRideId === ride.id;
          const isSelected = selectedRideId === ride.id;
          
          return (
            <div
              key={ride.id}
              onMouseEnter={() => setHoveredRideId(ride.id)}
              onMouseLeave={() => setHoveredRideId(null)}
              onClick={() => setSelectedRideId(ride.id)}
              style={{
                position: "absolute",
                left: `${ride.mapX}%`,
                top: `${ride.mapY}%`,
                transform: "translate(-50%, -50%)",
                zIndex: isSelected ? 50 : isHovered ? 45 : 4,
                cursor: "pointer",
                transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
                animation: isSelected ? `lmDotSelect 0.6s ease-out` : `lmFadeIn .5s cubic-bezier(.34,1.4,.64,1) ${i * 0.12}s both, lmDotPulse 2.4s ease-in-out ${i * 0.3}s infinite`,
              }}
            >
              {/* Halo */}
              <div style={{
                position: "absolute", 
                inset: isSelected ? -12 : -6,
                borderRadius: "50%",
                background: isSelected 
                  ? "radial-gradient(circle, rgba(34,197,94,0.4) 0%, transparent 70%)"
                  : "radial-gradient(circle, rgba(96,165,250,0.3) 0%, transparent 70%)",
                pointerEvents: "none",
                transition: "all 0.3s ease",
              }}/>
              
              {/* Dot */}
              <div style={{
                position: "relative",
                width: isSelected ? 28 : 22,
                height: isSelected ? 28 : 22,
                background: isSelected
                  ? "linear-gradient(135deg,#22C55E,#16A34A)"
                  : isHovered
                  ? "linear-gradient(135deg,#60A5FA,#3B82F6)"
                  : "linear-gradient(135deg,#60A5FA,#3B82F6)",
                border: "2px solid rgba(255,255,255,0.95)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: isSelected
                  ? "0 8px 24px rgba(34,197,94,0.6), 0 0 0 6px rgba(34,197,94,0.18)"
                  : "0 4px 12px rgba(59,130,246,0.5), 0 0 0 4px rgba(59,130,246,0.18)",
                transition: "all 0.3s ease",
              }}>
                <Users size={isSelected ? 12 : 9} color="#fff" strokeWidth={2.4}/>
              </div>
            </div>
          );
        })}

        {/* Driver car pin (center) */}
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

        {/* Top status banner */}
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
              {processedRides.length} nearby
            </span>
          </div>
        </div>
      </div>

      {/* ── Bottom Status Chip ── */}
      <div style={{
        padding: "12px",
        background: "rgba(0,0,0,0.4)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
        display: "flex", gap: 8,
      }}>
        {selectedRide ? (
          /* ── Ride Details Panel ── */
          <div style={{
            flex: 1,
            background: "rgba(255,255,255,0.95)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.4)",
            borderRadius: 14,
            padding: "12px",
            display: "flex", alignItems: "stretch", gap: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
            animation: "lmReveal 0.3s ease-out",
          }}>
            {/* Left: Location & Distance */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{
                  fontSize: 11, fontWeight: 600, color: C.textDim,
                  textTransform: "uppercase", letterSpacing: "0.5px",
                  marginBottom: 2,
                }}>
                  Pickup Location
                </div>
                <div style={{
                  fontSize: 13, fontWeight: 700, color: C.text,
                  lineHeight: 1.2,
                  marginBottom: 6,
                }}>
                  {selectedRide.pickupAddress || `${selectedRide.pickupLat?.toFixed(3)}, ${selectedRide.pickupLng?.toFixed(3)}`}
                </div>
              </div>
              <div style={{
                display: "flex", alignItems: "center", gap: 4,
                fontSize: 10, fontWeight: 600, color: C.textDim,
              }}>
                <Navigation size={10} strokeWidth={2}/>
                {selectedRide.distance.toFixed(1)} miles away
              </div>
            </div>

            {/* Middle: Fare Info */}
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              borderRight: "1px solid rgba(0,0,0,0.08)",
              paddingRight: 12,
            }}>
              <div style={{
                fontSize: 10, fontWeight: 600, color: C.textDim,
                marginBottom: 4,
              }}>
                Estimated
              </div>
              <div style={{
                fontSize: 18, fontWeight: 800, color: "#22C55E",
                display: "flex", alignItems: "baseline", gap: 2,
              }}>
                <DollarSign size={14} strokeWidth={2.4}/>
                {selectedRide.estimatedEarnings}
              </div>
            </div>

            {/* Right: Accept Button */}
            <div style={{
              display: "flex", alignItems: "center",
              paddingLeft: 12,
              borderLeft: "1px solid rgba(0,0,0,0.08)",
            }}>
              <button
                onClick={() => {
                  onRideAccepted?.(selectedRide);
                  setSelectedRideId(null);
                }}
                style={{
                  padding: "8px 12px",
                  background: "linear-gradient(135deg,#22C55E,#16A34A)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                  transition: "all 0.2s ease",
                  boxShadow: "0 4px 12px rgba(34,196,93,0.4)",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => e.target.style.boxShadow = "0 6px 20px rgba(34,196,93,0.6)"}
                onMouseLeave={(e) => e.target.style.boxShadow = "0 4px 12px rgba(34,196,93,0.4)"}
              >
                Accept <ChevronRight size={14} strokeWidth={2.4}/>
              </button>
            </div>
          </div>
        ) : (
          /* ── Default Status Chip ── */
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
              background: processedRides.length > 0
                ? "linear-gradient(135deg,#3B82F6,#2563EB)"
                : "linear-gradient(135deg,#22C55E,#16A34A)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
              boxShadow: processedRides.length > 0
                ? "0 4px 12px rgba(37,99,235,0.4)"
                : "0 4px 12px rgba(22,163,74,0.4)",
            }}>
              {processedRides.length > 0
                ? <Users size={14} color="#fff" strokeWidth={2.2}/>
                : <Activity size={14} color="#fff" strokeWidth={2.2}/>
              }
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="condensed" style={{
                fontSize: 13, fontWeight: 800, color: C.text,
                letterSpacing: "-0.2px", lineHeight: 1.1,
              }}>
                {processedRides.length > 0
                  ? `${processedRides.length} rider${processedRides.length > 1 ? "s" : ""} nearby`
                  : "Scanning your area"}
              </div>
              <div style={{
                fontSize: 10.5, fontWeight: 600, color: C.textDim,
                marginTop: 1,
                display: "flex", alignItems: "center", gap: 5,
              }}>
                {processedRides.length > 0 && closestRider != null ? (
                  <>
                    <MapPin size={9} strokeWidth={2.2}/>
                    <span>Closest {closestRider.toFixed(1)} mi • Click a dot</span>
                  </>
                ) : (
                  <>
                    <Clock size={9} strokeWidth={2.2}/>
                    <span>Updated just now</span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}