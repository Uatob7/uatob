import { useEffect, useRef, useState } from 'react';
import { Users, Activity, Clock, Wifi } from 'lucide-react';

const MAPBOX_TOKEN = "pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA";
const MAP_STYLE = "mapbox://styles/mapbox/dark-v11";


const RIDER_OFFSETS = [
  { dlat:  0.018, dlng:  0.024 },
  { dlat: -0.021, dlng:  0.031 },
  { dlat:  0.009, dlng: -0.028 },
  { dlat: -0.033, dlng: -0.015 },
  { dlat:  0.027, dlng:  0.011 },
];

/**
 * LiveMap v3
 *
 * Props:
 *   online      — boolean
 *   driver      — driver doc (needs lat/lng)
 *   searches    — array of search docs (optional)
 *   activeTrip  — active trip object or null
 */
export default function LiveMap({ online, driver, searches = [], activeTrip }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [mapReady, setMapReady] = useState(false);
  const [sweepAngle, setSweepAngle] = useState(0);

  // Radar sweep
  useEffect(() => {
    if (!online || activeTrip) return;
    let angle = 0;
    const id = setInterval(() => {
      angle = (angle + 2) % 360;
      setSweepAngle(angle);
    }, 30);
    return () => clearInterval(id);
  }, [online, activeTrip]);

  // Init Mapbox
  useEffect(() => {
    if (!online || activeTrip || mapRef.current) return;

    const script = document.createElement('script');
    script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js';
    script.async = true;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css';

    document.head.appendChild(link);
    document.head.appendChild(script);

    script.onload = () => {
      if (!mapContainerRef.current) return;
      const mapboxgl = window.mapboxgl;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      const driverLat = driver?.lat ?? 28.5383;
      const driverLng = driver?.lng ?? -81.3792;

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: MAP_STYLE,
        center: [driverLng, driverLat],
        zoom: 13.2,
        pitch: 42,
        bearing: -18,
        interactive: false,
        attributionControl: false,
        logoPosition: 'bottom-right',
      });

      map.on('load', () => {
        mapRef.current = map;
        setMapReady(true);

        let bearing = -18;
        const drift = setInterval(() => {
          bearing += 0.05;
          map.setBearing(bearing);
        }, 100);
        map.on('remove', () => clearInterval(drift));
      });
    };

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setMapReady(false);
      }
    };
  }, [online, activeTrip]);

  // Rider dots
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const mapboxgl = window.mapboxgl;
    const driverLat = driver?.lat ?? 28.5383;
    const driverLng = driver?.lng ?? -81.3792;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const count = Math.min(searches.length || 3, RIDER_OFFSETS.length);

    RIDER_OFFSETS.slice(0, count).forEach((off, i) => {
      const el = document.createElement('div');
      el.innerHTML = `
        <div style="
          position:relative; width:28px; height:28px;
          display:flex; align-items:center; justify-content:center;
          animation:riderFadeIn .5s cubic-bezier(.34,1.4,.64,1) ${i * 0.1}s both;
        ">
          <div style="
            position:absolute; inset:-5px; border-radius:50%;
            background:radial-gradient(circle, rgba(96,165,250,0.3) 0%, transparent 70%);
            animation:riderPulse 2.2s ease-in-out ${i * 0.4}s infinite;
          "></div>
          <div style="
            width:26px; height:26px; border-radius:50%;
            background:linear-gradient(145deg,#60A5FA,#2563EB);
            border:2px solid rgba(255,255,255,0.95);
            display:flex; align-items:center; justify-content:center;
            box-shadow:0 4px 12px rgba(37,99,235,0.5), 0 0 0 3px rgba(59,130,246,0.2);
          ">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
        </div>
        <style>
          @keyframes riderFadeIn{from{opacity:0;transform:scale(.3);}to{opacity:1;transform:scale(1);}}
          @keyframes riderPulse{0%,100%{opacity:.6;transform:scale(1);}50%{opacity:1;transform:scale(1.2);}}
        </style>
      `;
      el.style.cssText = 'cursor:default; pointer-events:none;';

      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([driverLng + off.dlng, driverLat + off.dlat])
        .addTo(mapRef.current);

      markersRef.current.push(marker);
    });
  }, [mapReady, searches.length, driver?.lat, driver?.lng]);

  if (!online || activeTrip) return null;

  const nearbyCount = searches.length || 3;
  const closestMi = 0.4;

  const toRad = deg => (deg * Math.PI) / 180;
  const R = 55;
  const trailAngle = sweepAngle;
  const leadAngle  = (sweepAngle + 72) % 360;

  const trailX = 50 + R * Math.cos(toRad(trailAngle));
  const trailY = 50 + R * Math.sin(toRad(trailAngle));
  const leadX  = 50 + R * Math.cos(toRad(leadAngle));
  const leadY  = 50 + R * Math.sin(toRad(leadAngle));

  // dot on the outermost ring where the beam tip lands
  const tipX = 50 + 52 * Math.cos(toRad(leadAngle));
  const tipY = 50 + 52 * Math.sin(toRad(leadAngle));

  return (
    <div style={{
      position: "relative",
      height: 240,
      borderRadius: 20,
      overflow: "hidden",
      boxShadow: "0 20px 60px rgba(0,0,0,.35), 0 0 0 1px rgba(34,197,94,0.15)",
    }}>

      {/* Mapbox */}
      <div
        ref={mapContainerRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />

      {/* SVG radar overlay */}
      {mapReady && (
        <svg
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            pointerEvents: "none",
          }}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <defs>
            <radialGradient id="sweepGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="rgba(34,197,94,0.75)"/>
              <stop offset="55%"  stopColor="rgba(34,197,94,0.22)"/>
              <stop offset="100%" stopColor="rgba(34,197,94,0)"/>
            </radialGradient>
            <radialGradient id="mapVig" cx="50%" cy="50%" r="60%">
              <stop offset="35%" stopColor="transparent"/>
              <stop offset="100%" stopColor="rgba(0,0,0,0.65)"/>
            </radialGradient>
          </defs>

          {/* Vignette */}
          <rect width="100" height="100" fill="url(#mapVig)"/>

          {/* Dashed radar rings */}
          {[16, 28, 40, 52].map((r, i) => (
            <circle
              key={i}
              cx="50" cy="50" r={r}
              fill="none"
              stroke="rgba(34,197,94,0.15)"
              strokeWidth="0.3"
              strokeDasharray="1.2 2.2"
            />
          ))}

          {/* Sweep cone */}
          <path
            d={`M 50 50 L ${trailX} ${trailY} A ${R} ${R} 0 0 1 ${leadX} ${leadY} Z`}
            fill="url(#sweepGrad)"
            opacity="0.72"
          />

          {/* Leading-edge beam line */}
          <line
            x1="50" y1="50"
            x2={leadX} y2={leadY}
            stroke="#4ADE80"
            strokeWidth="0.55"
            strokeLinecap="round"
            opacity="0.95"
          />

          {/* Bright flare dot where beam tip hits outermost ring */}
          <circle cx={tipX} cy={tipY} r="1.3" fill="#4ADE80" opacity="0.95"/>
          <circle cx={tipX} cy={tipY} r="2.4" fill="rgba(74,222,128,0.25)" opacity="0.9"/>

          {/* Center crosshair — small, minimal */}
          <line x1="47.5" y1="50" x2="52.5" y2="50" stroke="rgba(34,197,94,0.55)" strokeWidth="0.3"/>
          <line x1="50" y1="47.5" x2="50" y2="52.5" stroke="rgba(34,197,94,0.55)" strokeWidth="0.3"/>
          <circle cx="50" cy="50" r="0.9" fill="rgba(74,222,128,0.85)"/>
        </svg>
      )}

      {/* Loading */}
      {!mapReady && (
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(135deg,#0F1F17,#0A1814)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexDirection: "column", gap: 10,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%",
            border: "2.5px solid rgba(34,197,94,0.15)",
            borderTop: "2.5px solid #22C55E",
            animation: "spin .9s linear infinite",
          }}/>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: ".08em", fontWeight: 600 }}>
            Locating…
          </span>
          <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
        </div>
      )}

      {/* Top HUD */}
      <div style={{
        position: "absolute", top: 10, left: 10, right: 10,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        zIndex: 20, pointerEvents: "none",
      }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "rgba(0,0,0,0.62)", backdropFilter: "blur(14px)",
          border: "1px solid rgba(34,197,94,0.35)",
          borderRadius: 100, padding: "5px 12px",
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "#4ADE80",
            boxShadow: "0 0 8px rgba(74,222,128,.8)",
            animation: "livePulse 1.4s ease-in-out infinite",
          }}/>
          <span style={{
            fontSize: 10, fontWeight: 800, letterSpacing: ".12em",
            textTransform: "uppercase", color: "rgba(255,255,255,.92)",
            fontFamily: "monospace",
          }}>Online</span>
        </div>

        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "rgba(0,0,0,0.62)", backdropFilter: "blur(14px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 100, padding: "5px 12px",
        }}>
          <Wifi size={10} color="rgba(255,255,255,.8)" strokeWidth={2.4}/>
          <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.8)" }}>Scanning</span>
        </div>
      </div>

      {/* Bottom card */}
      <div style={{
        position: "absolute", bottom: 10, left: 10, right: 10,
        zIndex: 20, pointerEvents: "none",
      }}>
        <div style={{
          background: "rgba(8,16,10,0.82)", backdropFilter: "blur(20px)",
          border: "1px solid rgba(34,197,94,0.22)",
          borderRadius: 14, padding: "10px 14px",
          display: "flex", alignItems: "center", gap: 10,
          boxShadow: "0 8px 32px rgba(0,0,0,.35)",
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: nearbyCount > 0
              ? "linear-gradient(135deg,#3B82F6,#1d4ed8)"
              : "linear-gradient(135deg,#22C55E,#15803d)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: nearbyCount > 0
              ? "0 4px 12px rgba(29,78,216,.45)"
              : "0 4px 12px rgba(21,128,61,.45)",
          }}>
            {nearbyCount > 0
              ? <Users size={15} color="#fff" strokeWidth={2.2}/>
              : <Activity size={15} color="#fff" strokeWidth={2.2}/>
            }
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 800,
              color: "rgba(255,255,255,.95)",
              letterSpacing: "-0.2px", lineHeight: 1.2,
            }}>
              {nearbyCount > 0
                ? `${nearbyCount} rider${nearbyCount > 1 ? "s" : ""} nearby`
                : "Scanning area"}
            </div>
            <div style={{
              fontSize: 10.5, fontWeight: 600, color: "rgba(255,255,255,.45)",
              marginTop: 2, display: "flex", alignItems: "center", gap: 5,
            }}>
              <Clock size={9} strokeWidth={2.2} color="rgba(255,255,255,.4)"/>
              <span>Updated just now</span>
              {nearbyCount > 0 && (
                <>
                  <span style={{ width: 2, height: 2, borderRadius: "50%", background: "rgba(255,255,255,.25)", display: "inline-block" }}/>
                  <span style={{ color: "#4ADE80" }}>Closest {closestMi.toFixed(1)} mi</span>
                </>
              )}
            </div>
          </div>

          {nearbyCount > 0 && (
            <div style={{
              minWidth: 28, height: 28,
              background: "linear-gradient(135deg,rgba(59,130,246,0.25),rgba(29,78,216,0.25))",
              border: "1px solid rgba(96,165,250,0.4)",
              borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#93C5FD" }}>
                {nearbyCount}
              </span>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes livePulse {
          0%,100% { opacity:1; box-shadow:0 0 8px rgba(74,222,128,.8); }
          50%      { opacity:.5; box-shadow:0 0 4px rgba(74,222,128,.3); }
        }
      `}</style>
    </div>
  );
}
