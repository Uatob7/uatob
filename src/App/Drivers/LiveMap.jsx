import { useEffect, useRef, useState, useMemo } from 'react';
import { Users, Activity, Clock, Wifi, MapPin, DollarSign, X } from 'lucide-react';

const MAPBOX_TOKEN = "pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA";
const MAP_STYLE = "mapbox://styles/mapbox/dark-v11";

// ── Tunables ─────────────────────────────────────────────────────────────────
const MAX_SEARCH_AGE_MS = 10 * 60 * 1000;  // ignore searches older than 10 min
const MAX_RADIUS_MILES  = 15;              // ignore searches farther than this
const MAX_VISIBLE       = 12;              // cap rider dots on map

// ── Helpers ─────────────────────────────────────────────────────────────────
function haversineMiles(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function timeAgo(ts) {
  if (!ts) return "";
  const ms = ts?.toMillis ? ts.toMillis() : (ts?.seconds ? ts.seconds * 1000 : Number(ts));
  const diffSec = Math.floor((Date.now() - ms) / 1000);
  if (diffSec < 30)   return "just now";
  if (diffSec < 60)   return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  return `${Math.floor(diffSec / 3600)}h ago`;
}

/**
 * LiveMap v4 — uses real search data
 *
 * Props:
 *   online      — boolean (driver toggled online)
 *   driver      — driver doc with { lat, lng, ... }
 *   searches    — array of Search docs from Firestore
 *                 each: { id, pickupLat, pickupLng, pickup, dropoff, miles, rides, createdAt }
 *   activeTrip  — active trip object or null (hides map if set)
 */
export default function LiveMap({ online, driver, searches = [], activeTrip }) {
  const mapContainerRef = useRef(null);
  const mapRef          = useRef(null);
  const markersRef      = useRef([]);
  const heatRef         = useRef(null);
  const [mapReady, setMapReady]     = useState(false);
  const [sweepAngle, setSweepAngle] = useState(0);
  const [selected,   setSelected]   = useState(null);

  // ── Filter + score searches against real driver location ────────────────────
  const visibleSearches = useMemo(() => {
    if (!driver?.lat || !driver?.lng) return [];
    const now = Date.now();

    return searches
      .filter(s => {
        if (typeof s.pickupLat !== "number" || typeof s.pickupLng !== "number") return false;
        const ageMs = now - (s.createdAt?.toMillis?.() ?? 0);
        if (ageMs > MAX_SEARCH_AGE_MS) return false;
        const dist = haversineMiles(driver.lat, driver.lng, s.pickupLat, s.pickupLng);
        if (dist > MAX_RADIUS_MILES) return false;
        return true;
      })
      .map(s => ({
        ...s,
        distMiles: haversineMiles(driver.lat, driver.lng, s.pickupLat, s.pickupLng),
      }))
      .sort((a, b) => a.distMiles - b.distMiles)
      .slice(0, MAX_VISIBLE);
  }, [searches, driver?.lat, driver?.lng]);

  const nearbyCount = visibleSearches.length;
  const closestMi   = nearbyCount > 0 ? visibleSearches[0].distMiles : null;

  // ── Radar sweep animation ───────────────────────────────────────────────────
  useEffect(() => {
    if (!online || activeTrip) return;
    let angle = 0;
    const id = setInterval(() => {
      angle = (angle + 2) % 360;
      setSweepAngle(angle);
    }, 30);
    return () => clearInterval(id);
  }, [online, activeTrip]);

  // ── Init Mapbox ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!online || activeTrip || mapRef.current) return;

    const script = document.createElement('script');
    script.src   = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js';
    script.async = true;

    const link = document.createElement('link');
    link.rel  = 'stylesheet';
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

  // ── Demand heatmap layer (clusters of pickup requests) ─────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    const features = visibleSearches.map(s => ({
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: [s.pickupLng, s.pickupLat] },
    }));

    const data = { type: "FeatureCollection", features };

    if (map.getSource("demand")) {
      map.getSource("demand").setData(data);
      return;
    }

    map.addSource("demand", { type: "geojson", data });
    map.addLayer({
      id: "demand-heat",
      type: "heatmap",
      source: "demand",
      maxzoom: 16,
      paint: {
        "heatmap-weight":    1,
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 10, 0.6, 15, 1.2],
        "heatmap-radius":    ["interpolate", ["linear"], ["zoom"], 10, 18,  15, 45],
        "heatmap-opacity":   0.55,
        "heatmap-color": [
          "interpolate", ["linear"], ["heatmap-density"],
          0,   "rgba(34,197,94,0)",
          0.3, "rgba(34,197,94,0.25)",
          0.6, "rgba(96,165,250,0.45)",
          1.0, "rgba(244,114,182,0.7)",
        ],
      },
    });
    heatRef.current = "demand-heat";
  }, [mapReady, visibleSearches]);

  // ── Render rider markers from real search positions ────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const mapboxgl = window.mapboxgl;
    const map = mapRef.current;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    visibleSearches.forEach((s, i) => {
      const el = document.createElement('div');
      el.style.cssText = 'cursor:pointer; pointer-events:auto;';
      el.innerHTML = `
        <div style="
          position:relative; width:30px; height:30px;
          display:flex; align-items:center; justify-content:center;
          animation:riderFadeIn .5s cubic-bezier(.34,1.4,.64,1) ${i * 0.06}s both;
        ">
          <div style="
            position:absolute; inset:-5px; border-radius:50%;
            background:radial-gradient(circle, rgba(96,165,250,0.35) 0%, transparent 70%);
            animation:riderPulse 2.2s ease-in-out ${i * 0.3}s infinite;
          "></div>
          <div style="
            width:28px; height:28px; border-radius:50%;
            background:linear-gradient(145deg,#60A5FA,#2563EB);
            border:2px solid rgba(255,255,255,0.95);
            display:flex; align-items:center; justify-content:center;
            box-shadow:0 4px 12px rgba(37,99,235,0.55), 0 0 0 3px rgba(59,130,246,0.22);
            transition:transform .15s;
          ">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
            </svg>
          </div>
        </div>
        <style>
          @keyframes riderFadeIn{from{opacity:0;transform:scale(.3);}to{opacity:1;transform:scale(1);}}
          @keyframes riderPulse{0%,100%{opacity:.6;transform:scale(1);}50%{opacity:1;transform:scale(1.25);}}
        </style>
      `;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelected(s);
      });
      el.addEventListener('mouseenter', () => {
        const inner = el.querySelector('div > div:last-child');
        if (inner) inner.style.transform = 'scale(1.15)';
      });
      el.addEventListener('mouseleave', () => {
        const inner = el.querySelector('div > div:last-child');
        if (inner) inner.style.transform = 'scale(1)';
      });

      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([s.pickupLng, s.pickupLat])
        .addTo(map);

      markersRef.current.push(marker);
    });

    // Auto-fit if we have searches, else center on driver
    if (visibleSearches.length > 0 && driver?.lat && driver?.lng) {
      const bounds = new mapboxgl.LngLatBounds(
        [driver.lng, driver.lat], [driver.lng, driver.lat]
      );
      visibleSearches.forEach(s => bounds.extend([s.pickupLng, s.pickupLat]));
      map.fitBounds(bounds, {
        padding: { top: 70, bottom: 90, left: 50, right: 50 },
        maxZoom: 14,
        duration: 1200,
        pitch: 42,
      });
    }
  }, [mapReady, visibleSearches, driver?.lat, driver?.lng]);

  if (!online || activeTrip) return null;

  // ── Radar geometry ────────────────────────────────────────────────────────
  const toRad = deg => (deg * Math.PI) / 180;
  const R = 55;
  const trailAngle = sweepAngle;
  const leadAngle  = (sweepAngle + 72) % 360;
  const trailX = 50 + R * Math.cos(toRad(trailAngle));
  const trailY = 50 + R * Math.sin(toRad(trailAngle));
  const leadX  = 50 + R * Math.cos(toRad(leadAngle));
  const leadY  = 50 + R * Math.sin(toRad(leadAngle));
  const tipX   = 50 + 52 * Math.cos(toRad(leadAngle));
  const tipY   = 50 + 52 * Math.sin(toRad(leadAngle));

  // Selected rider info
  const selectedFare = selected?.rides?.economy?.total ?? null;

  return (
    <div style={{
      position: "relative",
      height: 280,
      borderRadius: 20,
      overflow: "hidden",
      boxShadow: "0 20px 60px rgba(0,0,0,.35), 0 0 0 1px rgba(34,197,94,0.15)",
    }}>

      <div ref={mapContainerRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />

      {/* Radar overlay only when no riders are nearby — feels "scanning" */}
      {mapReady && nearbyCount === 0 && (
        <svg
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
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

          <rect width="100" height="100" fill="url(#mapVig)"/>

          {[16, 28, 40, 52].map((r, i) => (
            <circle key={i} cx="50" cy="50" r={r} fill="none"
              stroke="rgba(34,197,94,0.15)" strokeWidth="0.3" strokeDasharray="1.2 2.2" />
          ))}

          <path
            d={`M 50 50 L ${trailX} ${trailY} A ${R} ${R} 0 0 1 ${leadX} ${leadY} Z`}
            fill="url(#sweepGrad)" opacity="0.72"
          />
          <line x1="50" y1="50" x2={leadX} y2={leadY}
            stroke="#4ADE80" strokeWidth="0.55" strokeLinecap="round" opacity="0.95" />

          <circle cx={tipX} cy={tipY} r="1.3" fill="#4ADE80" opacity="0.95"/>
          <circle cx={tipX} cy={tipY} r="2.4" fill="rgba(74,222,128,0.25)" opacity="0.9"/>

          <line x1="47.5" y1="50" x2="52.5" y2="50" stroke="rgba(34,197,94,0.55)" strokeWidth="0.3"/>
          <line x1="50" y1="47.5" x2="50" y2="52.5" stroke="rgba(34,197,94,0.55)" strokeWidth="0.3"/>
          <circle cx="50" cy="50" r="0.9" fill="rgba(74,222,128,0.85)"/>
        </svg>
      )}

      {/* Vignette only when riders ARE there (no radar) */}
      {mapReady && nearbyCount > 0 && (
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(circle at 50% 50%, transparent 40%, rgba(0,0,0,0.55) 100%)",
        }}/>
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
          <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.8)" }}>
            {nearbyCount > 0 ? `${nearbyCount} active` : "Scanning"}
          </span>
        </div>
      </div>

      {/* Selected rider popup */}
      {selected && (
        <div style={{
          position: "absolute", top: 50, left: 10, right: 10,
          zIndex: 25,
          background: "rgba(8,16,10,0.92)", backdropFilter: "blur(20px)",
          border: "1px solid rgba(96,165,250,0.35)",
          borderRadius: 14, padding: "11px 13px",
          boxShadow: "0 12px 40px rgba(0,0,0,.55)",
          animation: "popIn .25s cubic-bezier(.34,1.4,.64,1)",
        }}>
          <button
            onClick={() => setSelected(null)}
            style={{
              position: "absolute", top: 6, right: 6,
              background: "rgba(255,255,255,0.07)", border: "none",
              borderRadius: 6, width: 22, height: 22,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "rgba(255,255,255,.6)",
            }}
            aria-label="Close"
          >
            <X size={12}/>
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <div style={{
              width: 7, height: 7, borderRadius: "50%",
              background: "#60A5FA", boxShadow: "0 0 6px rgba(96,165,250,0.8)",
            }}/>
            <span style={{
              fontSize: 9.5, fontWeight: 800, letterSpacing: ".1em",
              textTransform: "uppercase", color: "#93C5FD",
              fontFamily: "monospace",
            }}>
              Rider request • {timeAgo(selected.createdAt)}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
            <MapPin size={11} color="#60A5FA" strokeWidth={2.4} style={{ marginTop: 3, flexShrink: 0 }}/>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.92)", fontWeight: 600, lineHeight: 1.3 }}>
              {selected.pickup ?? "Pickup"}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
            <MapPin size={11} color="#22C55E" strokeWidth={2.4} style={{ marginTop: 3, flexShrink: 0 }}/>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.7)", lineHeight: 1.3 }}>
              {selected.dropoff ?? "Dropoff"}
            </div>
          </div>

          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            paddingTop: 7, borderTop: "1px solid rgba(255,255,255,.08)",
            fontSize: 10.5, fontWeight: 700,
          }}>
            <span style={{ color: "rgba(255,255,255,.55)" }}>
              {selected.distMiles.toFixed(1)} mi away • {selected.miles?.toFixed(1) ?? "?"} mi trip
            </span>
            {selectedFare != null && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 3,
                color: "#4ADE80", fontFamily: "monospace",
              }}>
                <DollarSign size={10} strokeWidth={2.6}/>
                {selectedFare.toFixed(2)}
              </span>
            )}
          </div>
        </div>
      )}

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
                ? `${nearbyCount} rider${nearbyCount > 1 ? "s" : ""} searching nearby`
                : "Scanning area"}
            </div>
            <div style={{
              fontSize: 10.5, fontWeight: 600, color: "rgba(255,255,255,.45)",
              marginTop: 2, display: "flex", alignItems: "center", gap: 5,
            }}>
          
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
        @keyframes popIn {
          from { opacity:0; transform:translateY(-8px) scale(.96); }
          to   { opacity:1; transform:none; }
        }
      `}</style>
    </div>
  );
}