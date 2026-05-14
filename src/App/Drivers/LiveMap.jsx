import { useEffect, useRef, useState, useCallback } from 'react';
import { Car, Users, Activity, Clock, Wifi } from 'lucide-react';

const MAPBOX_TOKEN = "pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA";

// Dark UaTob-branded Mapbox style override params
const MAP_STYLE = "mapbox://styles/mapbox/dark-v11";

// Demo rider positions (offset from driver center in degrees)
const RIDER_OFFSETS = [
  { dlat:  0.018, dlng:  0.024 },
  { dlat: -0.021, dlng:  0.031 },
  { dlat:  0.009, dlng: -0.028 },
  { dlat: -0.033, dlng: -0.015 },
  { dlat:  0.027, dlng:  0.011 },
];

/**
 * LiveMap v2
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
  const driverMarkerRef = useRef(null);
  const pulseTimerRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const [tick, setTick] = useState(0);
  const [sweepAngle, setSweepAngle] = useState(0);

  // Radar sweep animation
  useEffect(() => {
    if (!online || activeTrip) return;
    let angle = 0;
    const id = setInterval(() => {
      angle = (angle + 2) % 360;
      setSweepAngle(angle);
    }, 30);
    return () => clearInterval(id);
  }, [online, activeTrip]);

  // Tick for "last update"
  useEffect(() => {
    if (!online) return;
    const id = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(id);
  }, [online]);

  // Initialize Mapbox
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
        // Subtle green tint overlay on roads
        map.setPaintProperty('road-primary', 'line-color', '#1a2e1a');
        mapRef.current = map;
        setMapReady(true);

        // Slow drift animation
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

  // Place/update driver marker
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const mapboxgl = window.mapboxgl;
    const driverLat = driver?.lat ?? 28.5383;
    const driverLng = driver?.lng ?? -81.3792;

    if (driverMarkerRef.current) {
      driverMarkerRef.current.setLngLat([driverLng, driverLat]);
    } else {
      const el = document.createElement('div');
      el.innerHTML = `
        <div style="
          position:relative;
          width:52px; height:52px;
          display:flex; align-items:center; justify-content:center;
        ">
          <div style="
            position:absolute; inset:-10px; border-radius:50%;
            background:radial-gradient(circle, rgba(34,197,94,0.35) 0%, transparent 70%);
            animation:driverGlow 2s ease-in-out infinite;
          "></div>
          <div style="
            position:absolute; inset:-4px; border-radius:50%;
            border:2px solid rgba(34,197,94,0.5);
            animation:driverRing 2s ease-out infinite;
          "></div>
          <div style="
            width:48px; height:48px; border-radius:50%;
            background:linear-gradient(145deg,#22C55E 0%,#16A34A 55%,#14532d);
            border:2.5px solid rgba(255,255,255,0.92);
            display:flex; align-items:center; justify-content:center;
            box-shadow:0 0 0 5px rgba(34,197,94,0.2), 0 8px 24px rgba(22,163,74,0.55);
          ">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/>
              <rect x="9" y="11" width="14" height="10" rx="2"/>
              <circle cx="12" cy="21" r="1"/>
              <circle cx="20" cy="21" r="1"/>
            </svg>
          </div>
        </div>
        <style>
          @keyframes driverGlow {
            0%,100%{opacity:.7;transform:scale(1);}
            50%{opacity:1;transform:scale(1.08);}
          }
          @keyframes driverRing {
            0%{transform:scale(1);opacity:.8;}
            100%{transform:scale(1.9);opacity:0;}
          }
        </style>
      `;
      el.style.cssText = 'cursor:default; pointer-events:none;';

      driverMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([driverLng, driverLat])
        .addTo(mapRef.current);
    }
  }, [mapReady, driver?.lat, driver?.lng]);

  // Place rider dots
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const mapboxgl = window.mapboxgl;
    const driverLat = driver?.lat ?? 28.5383;
    const driverLng = driver?.lng ?? -81.3792;

    // Remove old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const count = Math.min(searches.length || 3, RIDER_OFFSETS.length);
    const usedOffsets = RIDER_OFFSETS.slice(0, count);

    usedOffsets.forEach((off, i) => {
      const el = document.createElement('div');
      el.innerHTML = `
        <div style="
          position:relative;
          width:28px; height:28px;
          display:flex; align-items:center; justify-content:center;
          animation:riderFadeIn .5s cubic-bezier(.34,1.4,.64,1) ${i * 0.1}s both;
        ">
          <div style="
            position:absolute; inset:-5px; border-radius:50%;
            background:radial-gradient(circle, rgba(96,165,250,0.35) 0%, transparent 70%);
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
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
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

  const nearbyCount = searches.length || 3; // fallback for demo
  const closestMi = 0.4;

  // Sweep cone via SVG overlay
  const sweepRad = (sweepAngle * Math.PI) / 180;
  const sweepEndRad = ((sweepAngle + 75) * Math.PI) / 180;
  const R = 160;
  const cx = 50, cy = 50; // percent

  return (
    <div style={{
      position: "relative",
      height: 240,
      borderRadius: 20,
      overflow: "hidden",
      boxShadow: "0 20px 60px rgba(0,0,0,.35), 0 0 0 1px rgba(34,197,94,0.15)",
    }}>

      {/* ── Mapbox container ── */}
      <div
        ref={mapContainerRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />

      {/* ── Radar sweep overlay (SVG, above map) ── */}
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
            {/* Sweep gradient */}
            <radialGradient id="sweepGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(34,197,94,0.55)"/>
              <stop offset="100%" stopColor="rgba(34,197,94,0)"/>
            </radialGradient>
            {/* Vignette */}
            <radialGradient id="mapVig" cx="50%" cy="50%" r="60%">
              <stop offset="40%" stopColor="transparent"/>
              <stop offset="100%" stopColor="rgba(0,0,0,0.6)"/>
            </radialGradient>
          </defs>

          {/* Vignette frame */}
          <rect width="100" height="100" fill="url(#mapVig)" />

          {/* Radar sweep cone */}
          <path
            d={`M 50 50
                L ${50 + 55 * Math.cos(sweepRad - 0.1)} ${50 + 55 * Math.sin(sweepRad - 0.1)}
                A 55 55 0 0 1 ${50 + 55 * Math.cos(sweepEndRad)} ${50 + 55 * Math.sin(sweepEndRad)}
                Z`}
            fill="url(#sweepGrad)"
            opacity="0.65"
          />

          {/* Sweep leading edge */}
          <line
            x1="50" y1="50"
            x2={50 + 55 * Math.cos(sweepEndRad)}
            y2={50 + 55 * Math.sin(sweepEndRad)}
            stroke="rgba(34,197,94,0.9)"
            strokeWidth="0.4"
          />

          {/* Radar rings */}
          {[18, 32, 46].map((r, i) => (
            <circle
              key={i}
              cx="50" cy="50" r={r}
              fill="none"
              stroke="rgba(34,197,94,0.18)"
              strokeWidth="0.35"
              strokeDasharray="1.5 2"
            />
          ))}
        </svg>
      )}

      {/* ── Loading shimmer (pre-map) ── */}
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
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", letterSpacing: ".08em", fontWeight: 600 }}>
            Locating…
          </span>
          <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
        </div>
      )}

      {/* ── Top HUD bar ── */}
      <div style={{
        position: "absolute", top: 10, left: 10, right: 10,
        display: "flex", justifyContent: "space-between", alignItems: "center",
        zIndex: 20, pointerEvents: "none",
      }}>
        {/* Live pill */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "rgba(0,0,0,0.62)",
          backdropFilter: "blur(14px)",
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
          }}>
            Online
          </span>
        </div>

        {/* Signal strength */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          background: "rgba(0,0,0,0.62)",
          backdropFilter: "blur(14px)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 100, padding: "5px 12px", gap: 6,
        }}>
          <Wifi size={10} color="rgba(255,255,255,.8)" strokeWidth={2.4}/>
          <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.8)" }}>
            Scanning
          </span>
        </div>
      </div>

      {/* ── Bottom info card ── */}
      <div style={{
        position: "absolute", bottom: 10, left: 10, right: 10,
        zIndex: 20, pointerEvents: "none",
      }}>
        <div style={{
          background: "rgba(8, 16, 10, 0.82)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(34,197,94,0.22)",
          borderRadius: 14,
          padding: "10px 14px",
          display: "flex", alignItems: "center", gap: 10,
          boxShadow: "0 8px 32px rgba(0,0,0,.35)",
        }}>
          {/* Icon */}
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

          {/* Text */}
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
              fontSize: 10.5, fontWeight: 600,
              color: "rgba(255,255,255,.45)",
              marginTop: 2,
              display: "flex", alignItems: "center", gap: 5,
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

          {/* Rider count badge */}
          {nearbyCount > 0 && (
            <div style={{
              minWidth: 28, height: 28,
              background: "linear-gradient(135deg,rgba(59,130,246,0.25),rgba(29,78,216,0.25))",
              border: "1px solid rgba(96,165,250,0.4)",
              borderRadius: 8,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}>
              <span style={{
                fontSize: 12, fontWeight: 800,
                color: "#93C5FD",
              }}>
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
