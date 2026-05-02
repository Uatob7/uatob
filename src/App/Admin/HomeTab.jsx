import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Activity, DollarSign, Car, Shield, RefreshCw,
  Filter, Search, X, ChevronDown, BarChart3, Sparkles,
  Clock, Mail, Users, ArrowUpRight, Phone, MessageSquare,
  CheckCircle2, Navigation, Send, Zap, TrendingUp,
} from "lucide-react";

/* ══════════════════════════════════════════════════════════════
   GLOBAL STYLES
══════════════════════════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');

:root {
  --bg:           #0A0A0F;
  --bg-card:      #111118;
  --bg-lift:      #18181F;
  --bg-raise:     #1E1E27;
  --border:       rgba(255,255,255,.06);
  --border-mid:   rgba(255,255,255,.10);
  --border-hi:    rgba(255,255,255,.18);
  --ink:          #F4F4F8;
  --ink-2:        #C8C8D4;
  --ink-3:        #8888A0;
  --ink-4:        #5C5C72;
  --ink-5:        #3A3A50;
  --teal:         #0D9488;
  --teal-lo:      rgba(13,148,136,.12);
  --teal-hi:      rgba(13,148,136,.28);
  --cyan:         #0891B2;
  --cyan-lo:      rgba(8,145,178,.12);
  --green:        #10B981;
  --green-lo:     rgba(16,185,129,.12);
  --amber:        #F59E0B;
  --amber-lo:     rgba(245,158,11,.12);
  --red:          #EF4444;
  --red-lo:       rgba(239,68,68,.12);
  --blue:         #3B82F6;
  --blue-lo:      rgba(59,130,246,.12);
  --font:         'DM Sans', system-ui, sans-serif;
  --font-display: 'Syne', sans-serif;
  --mono:         'DM Mono', monospace;
  --radius:       14px;
  --radius-sm:    9px;
}

.ht * { box-sizing: border-box; margin: 0; padding: 0; }
.ht {
  font-family: var(--font);
  background: var(--bg);
  color: var(--ink);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}

/* ── Animations ── */
@keyframes ht-up     { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
@keyframes ht-spin   { to{transform:rotate(360deg)} }
@keyframes ht-ring   { 0%{transform:scale(.8);opacity:.8} 100%{transform:scale(2.2);opacity:0} }
@keyframes ht-pulse  { 0%,100%{opacity:1} 50%{opacity:.25} }
@keyframes ht-glow   { 0%,100%{opacity:.6} 50%{opacity:1} }
@keyframes ht-slide  { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
@keyframes ht-pop    { 0%{transform:scale(.92);opacity:0} 60%{transform:scale(1.04)} 100%{transform:scale(1);opacity:1} }
@keyframes ht-msgIn  { from{opacity:0;transform:translateY(100%)} to{opacity:1;transform:translateY(0)} }
@keyframes ht-shimmer{ 0%{background-position:-200% 0} 100%{background-position:200% 0} }

.ht-up   { animation: ht-up   .42s cubic-bezier(.22,1,.36,1) both; }
.ht-pop  { animation: ht-pop  .38s cubic-bezier(.22,1,.36,1) both; }
.ht-spin { animation: ht-spin 1s linear infinite; }

/* ── Cards ── */
.ht-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  position: relative;
  overflow: hidden;
}
.ht-glass {
  background: rgba(255,255,255,.03);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--border-mid);
  border-radius: var(--radius);
}

/* ── Pills ── */
.ht-pill {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 10px; font-weight: 600; letter-spacing: .04em;
  padding: 3px 8px; border-radius: 6px; white-space: nowrap;
  font-family: var(--font);
}

/* ── Inputs ── */
.ht-search {
  display: flex; align-items: center; gap: 9px;
  background: var(--bg-lift); border: 1px solid var(--border-mid);
  border-radius: var(--radius-sm); padding: 0 14px; height: 40px; transition: all .18s;
}
.ht-search:focus-within {
  border-color: var(--teal);
  box-shadow: 0 0 0 3px var(--teal-lo);
}
.ht-search input {
  flex: 1; border: none; outline: none; background: transparent;
  font-family: var(--font); font-size: 13px; color: var(--ink); font-weight: 500;
}
.ht-search input::placeholder { color: var(--ink-4); }

/* ── Select ── */
.ht-sel { position: relative; flex: 1; min-width: 100px; }
.ht-sel select {
  width: 100%; padding: 7px 26px 7px 10px;
  border-radius: var(--radius-sm); border: 1px solid var(--border-mid);
  font-size: 11px; font-weight: 600; color: var(--ink-2);
  background: var(--bg-lift); appearance: none; outline: none;
  cursor: pointer; font-family: var(--font); transition: all .18s;
}
.ht-sel select:focus { border-color: var(--teal); box-shadow: 0 0 0 3px var(--teal-lo); }

/* ── Buttons ── */
.ht-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 13px; border-radius: var(--radius-sm);
  border: 1px solid var(--border-mid); background: var(--bg-lift);
  font-family: var(--font); font-size: 11.5px; font-weight: 600;
  color: var(--ink-2); cursor: pointer; transition: all .15s;
}
.ht-btn:hover { border-color: var(--border-hi); color: var(--ink); }
.ht-btn.active { background: var(--teal); color: #fff; border-color: var(--teal); }

/* ── Quick action ── */
.ht-qa {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 7px;
  padding: 9px 12px; border-radius: 10px; border: 1px solid var(--border-mid);
  background: var(--bg-lift); font-family: var(--font);
  font-size: 12px; font-weight: 600; color: var(--ink-3);
  cursor: pointer; transition: all .18s; white-space: nowrap;
}
.ht-qa:hover { border-color: var(--border-hi); color: var(--ink-2); background: var(--bg-raise); }
.ht-qa.teal  { border-color: var(--teal-hi); background: var(--teal-lo); color: var(--teal); }
.ht-qa.teal:hover { background: rgba(13,148,136,.22); }
.ht-qa.green { border-color: rgba(16,185,129,.25); background: var(--green-lo); color: var(--green); }
.ht-qa.green:hover { background: rgba(16,185,129,.22); }

/* ── Scrollbar ── */
.ht ::-webkit-scrollbar { width: 4px; }
.ht ::-webkit-scrollbar-track { background: transparent; }
.ht ::-webkit-scrollbar-thumb { background: var(--border-mid); border-radius: 2px; }

/* ── Map overrides ── */
.ht-map .mapboxgl-ctrl-logo,
.ht-map .mapboxgl-ctrl-attrib-button { display: none !important; }
.ht-map .mapboxgl-ctrl-attrib {
  font-size: 7px !important; opacity: .08 !important;
  background: transparent !important;
}

/* ── Message sheet ── */
.ht-msg-overlay {
  position: fixed; inset: 0; z-index: 999;
  display: flex; align-items: flex-end; justify-content: center;
}
.ht-msg-backdrop {
  position: absolute; inset: 0;
  background: rgba(5,5,10,.72); backdrop-filter: blur(14px);
  animation: ht-up .22s ease both;
}
.ht-msg-sheet {
  position: relative; z-index: 10;
  width: 100%; max-width: 500px;
  background: var(--bg-card);
  border: 1px solid var(--border-mid);
  border-bottom: none;
  border-radius: 22px 22px 0 0;
  box-shadow: 0 -24px 80px rgba(0,0,0,.5);
  padding: 20px 20px calc(24px + env(safe-area-inset-bottom));
  animation: ht-msgIn .36s cubic-bezier(.22,1,.36,1) both;
}

/* ── Mapbox pulse ── */
@keyframes mapPing { 0%{transform:scale(.8);opacity:.9} 100%{transform:scale(2.4);opacity:0} }
`;

/* ══════════════════════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════════════════════ */
const MAPBOX_TOKEN = 'pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA';

const STATUS_CFG = {
  searching_driver: { label: "Searching",   color: "#F59E0B", bg: "rgba(245,158,11,.12)",  border: "rgba(245,158,11,.25)"  },
  driver_assigned:  { label: "Assigned",    color: "#3B82F6", bg: "rgba(59,130,246,.12)",  border: "rgba(59,130,246,.25)"  },
  driver_arriving:  { label: "Arriving",    color: "#0891B2", bg: "rgba(8,145,178,.12)",   border: "rgba(8,145,178,.25)"   },
  arrived:          { label: "Arrived",     color: "#10B981", bg: "rgba(16,185,129,.12)",  border: "rgba(16,185,129,.25)"  },
  in_progress:      { label: "In Progress", color: "#0D9488", bg: "rgba(13,148,136,.12)",  border: "rgba(13,148,136,.25)"  },
  completed:        { label: "Completed",   color: "#6B7280", bg: "rgba(107,114,128,.10)", border: "rgba(107,114,128,.2)"  },
  cancelled:        { label: "Cancelled",   color: "#EF4444", bg: "rgba(239,68,68,.12)",   border: "rgba(239,68,68,.25)"   },
};
const PAY_CFG = {
  succeeded: { bg: "rgba(16,185,129,.1)",  color: "#10B981", label: "Paid"    },
  pending:   { bg: "rgba(245,158,11,.1)",  color: "#F59E0B", label: "Pending" },
  failed:    { bg: "rgba(239,68,68,.1)",   color: "#EF4444", label: "Failed"  },
};
const PAYOUT_CFG = {
  processing: { bg: "rgba(59,130,246,.1)",  color: "#3B82F6", label: "Processing" },
  pending:    { bg: "rgba(245,158,11,.1)",  color: "#F59E0B", label: "Pending"    },
  paid:       { bg: "rgba(16,185,129,.1)",  color: "#10B981", label: "Paid Out"   },
  failed:     { bg: "rgba(239,68,68,.1)",   color: "#EF4444", label: "Failed"     },
};
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const QUICK_MSGS = [
  "Driver is on the way to your pickup.",
  "Your driver is about 2 minutes away.",
  "Driver has arrived — please head outside.",
  "Slight delay due to traffic. Apologies.",
  "Your ride is going smoothly. Almost there.",
];

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
function tsToMs(ts) {
  if (!ts) return 0;
  if (ts?.seconds) return ts.seconds * 1000;
  if (typeof ts === "number") return ts;
  return 0;
}
function timeAgo(ts) {
  if (!ts) return "—";
  const secs = ts?.seconds ?? Math.floor((typeof ts === "number" ? ts : 0) / 1000);
  const diff  = Math.floor(Date.now() / 1000) - secs;
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  return `${Math.floor(diff/3600)}h ago`;
}
function shortAddr(s = "") { return s.split(",")[0].trim() || s; }
function fmtMMSS(s) {
  const a = Math.abs(Math.round(s));
  return `${Math.floor(a/60)}:${String(a%60).padStart(2,"0")}`;
}
function initials(name = "") {
  return name.split(" ").filter(Boolean).map(w => w[0]).join("").slice(0,2).toUpperCase() || "?";
}
function safeNum(v) { const n = Number(v); return isFinite(n) ? n : 0; }

/* ══════════════════════════════════════════════════════════════
   POLYLINE DECODER
══════════════════════════════════════════════════════════════ */
function decodePolyline(enc) {
  if (!enc) return [];
  const pts = []; let i = 0, lat = 0, lng = 0;
  while (i < enc.length) {
    let b, shift = 0, result = 0;
    do { b = enc.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = enc.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : result >> 1;
    pts.push([lat / 1e5, lng / 1e5]);
  }
  return pts;
}

/* ══════════════════════════════════════════════════════════════
   MAPBOX LOADER (singleton)
══════════════════════════════════════════════════════════════ */
let _mbReady = false, _mbQ = [];
function loadMapbox(cb) {
  if (_mbReady && window.mapboxgl) { cb(); return; }
  _mbQ.push(cb);
  if (document.getElementById("mb-css")) { if (_mbReady) cb(); return; }
  const link = Object.assign(document.createElement("link"), {
    id: "mb-css", rel: "stylesheet",
    href: "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css",
  });
  document.head.appendChild(link);
  const script = Object.assign(document.createElement("script"), {
    src: "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js",
    onload: () => { _mbReady = true; _mbQ.forEach(f => f()); _mbQ = []; },
  });
  document.head.appendChild(script);
}

/* ══════════════════════════════════════════════════════════════
   SMART CARD MAP
  Status-aware Mapbox map with polyline, driver/rider markers
══════════════════════════════════════════════════════════════ */
function CardMap({ ride, status }) {
  const containerRef   = useRef(null);
  const mapRef         = useRef(null);
  const markersRef     = useRef([]);
  const initRef        = useRef(false);

  // Derived state flags
  const isSearching  = status === "searching_driver";
  const isAssigned   = ["driver_assigned","driver_arriving"].includes(status);
  const isArrived    = status === "arrived";
  const isInProgress = status === "in_progress";
  const isCompleted  = status === "completed";
  const isCancelled  = status === "cancelled";
  const isActive     = isAssigned || isArrived || isInProgress;

  // Route line color by status
  const routeColor = isSearching   ? "#F59E0B"
    : isCancelled  ? "#EF4444"
    : isCompleted  ? "#4B5563"
    : isArrived    ? "#10B981"
    : isInProgress ? "#0D9488"
    : "#3B82F6";

  // Map style — dark for all (matches our dark theme)
  const mapStyle = "mapbox://styles/mapbox/dark-v11";

  const routeCoords = useMemo(() =>
    decodePolyline(ride.polyline).map(p => [p[1], p[0]]),
    [ride.polyline]
  );

  const hasDriver = !!(safeNum(ride.driverLat) && safeNum(ride.driverLng));
  const hasRider  = !!(safeNum(ride.riderLat)  && safeNum(ride.riderLng));

  // Compute tight bounds including all relevant points
  const bounds = useMemo(() => {
    const pts = [...routeCoords];
    if (hasDriver) pts.push([safeNum(ride.driverLng), safeNum(ride.driverLat)]);
    if (hasRider)  pts.push([safeNum(ride.riderLng),  safeNum(ride.riderLat)]);
    if (ride.pickupLat  && ride.pickupLng)  pts.push([safeNum(ride.pickupLng),  safeNum(ride.pickupLat)]);
    if (ride.dropoffLat && ride.dropoffLng) pts.push([safeNum(ride.dropoffLng), safeNum(ride.dropoffLat)]);
    if (!pts.length) return null;
    return {
      minLng: Math.min(...pts.map(p => p[0])), maxLng: Math.max(...pts.map(p => p[0])),
      minLat: Math.min(...pts.map(p => p[1])), maxLat: Math.max(...pts.map(p => p[1])),
    };
  }, [routeCoords, hasDriver, hasRider,
      ride.driverLat, ride.driverLng, ride.riderLat, ride.riderLng,
      ride.pickupLat, ride.pickupLng, ride.dropoffLat, ride.dropoffLng]);

  const center = useMemo(() => bounds
    ? [(bounds.minLng + bounds.maxLng) / 2, (bounds.minLat + bounds.maxLat) / 2]
    : [-81.3792, 28.5383],
    [bounds]
  );

  // ── Init map ──
  useEffect(() => {
    if (!containerRef.current || initRef.current) return;
    loadMapbox(() => {
      if (!containerRef.current || initRef.current) return;
      initRef.current = true;
      window.mapboxgl.accessToken = MAPBOX_TOKEN;
      mapRef.current = new window.mapboxgl.Map({
        container: containerRef.current,
        style: mapStyle,
        center, zoom: 13,
        attributionControl: false,
        interactive: false,
        fadeDuration: 0,
      });
      mapRef.current.addControl(
        new window.mapboxgl.AttributionControl({ compact: true }), "bottom-right"
      );
    });
    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; initRef.current = false; }
    };
  }, []);

  // ── Draw / update polyline + markers ──
  useEffect(() => {
    if (!mapRef.current) return;
    const draw = () => {
      if (!mapRef.current?.isStyleLoaded()) { setTimeout(draw, 80); return; }

      // ── Polyline ──
      if (routeCoords.length > 1) {
        const geo = { type: "Feature", geometry: { type: "LineString", coordinates: routeCoords } };
        if (mapRef.current.getSource("route")) {
          mapRef.current.getSource("route").setData(geo);
          // Update colors dynamically
          if (mapRef.current.getLayer("route-fill")) {
            mapRef.current.setPaintProperty("route-fill", "line-color", routeColor);
          }
        } else {
          mapRef.current.addSource("route", { type: "geojson", data: geo });
          // Outer glow
          mapRef.current.addLayer({ id: "route-glow", type: "line", source: "route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": routeColor, "line-width": 16, "line-opacity": 0.08, "line-blur": 8 } });
          // Casing (dark border for contrast on dark map)
          mapRef.current.addLayer({ id: "route-case", type: "line", source: "route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": "#000", "line-width": 6, "line-opacity": 0.7 } });
          // Main fill
          mapRef.current.addLayer({ id: "route-fill", type: "line", source: "route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": routeColor, "line-width": 3.5, "line-opacity": isCancelled ? 0.5 : 0.95 } });
          // Animated dots (active & arrived)
          if (isActive || isArrived) {
            mapRef.current.addLayer({ id: "route-dots", type: "line", source: "route",
              layout: { "line-cap": "round", "line-join": "round" },
              paint: { "line-color": "rgba(255,255,255,.45)", "line-width": 1.5, "line-dasharray": [0, 5] } });
          }
        }
      }

      // ── Clear old markers ──
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      // ── PICKUP PIN (green pulse ring) ──
      // Show for: searching, assigned, arriving, arrived (driver coming to pickup)
      const showPickup = !isInProgress && !isCompleted && !isCancelled;
      if (safeNum(ride.pickupLat) && safeNum(ride.pickupLng) && showPickup) {
        const el = document.createElement("div");
        el.style.cssText = "position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;";
        el.innerHTML = `
          <div style="position:absolute;inset:0;border-radius:50%;border:2px solid rgba(16,185,129,.5);animation:mapPing 2s ease-out infinite;"></div>
          <div style="width:13px;height:13px;border-radius:50%;background:#10B981;border:2.5px solid #fff;box-shadow:0 0 12px rgba(16,185,129,.7);position:relative;z-index:1;"></div>
        `;
        markersRef.current.push(
          new window.mapboxgl.Marker({ element: el, anchor: "center" })
            .setLngLat([safeNum(ride.pickupLng), safeNum(ride.pickupLat)])
            .addTo(mapRef.current)
        );
      }

      // ── PICKUP PIN (dimmed, completed/cancelled) ──
      if (safeNum(ride.pickupLat) && safeNum(ride.pickupLng) && (isCompleted || isCancelled)) {
        const el = document.createElement("div");
        el.innerHTML = `<div style="width:10px;height:10px;border-radius:50%;background:rgba(255,255,255,.25);border:2px solid rgba(255,255,255,.15);"></div>`;
        markersRef.current.push(
          new window.mapboxgl.Marker({ element: el, anchor: "center" })
            .setLngLat([safeNum(ride.pickupLng), safeNum(ride.pickupLat)])
            .addTo(mapRef.current)
        );
      }

      // ── DROPOFF PIN (teardrop) ──
      if (safeNum(ride.dropoffLat) && safeNum(ride.dropoffLng)) {
        const el = document.createElement("div");
        el.style.cssText = "filter:drop-shadow(0 4px 12px rgba(0,0,0,0.6));";
        const pinColor = isCancelled ? "#EF4444" : isCompleted ? "#6B7280" : isInProgress || isArrived ? "#0D9488" : "#3B82F6";
        el.innerHTML = `
          <svg width="24" height="32" viewBox="0 0 24 32" fill="none">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 20 12 20S24 21 24 12C24 5.37 18.63 0 12 0z" fill="${pinColor}"/>
            <circle cx="12" cy="12" r="5" fill="rgba(255,255,255,.95)"/>
            ${!isCompleted && !isCancelled ? `<circle cx="12" cy="12" r="2.5" fill="${pinColor}"/>` : ""}
          </svg>
        `;
        markersRef.current.push(
          new window.mapboxgl.Marker({ element: el, anchor: "bottom" })
            .setLngLat([safeNum(ride.dropoffLng), safeNum(ride.dropoffLat)])
            .addTo(mapRef.current)
        );
      }

      // ── DRIVER MARKER ──
      // Show for all active statuses — blue pulsing dot
      if (hasDriver && (isActive || isArrived)) {
        const el = document.createElement("div");
        el.style.cssText = "position:relative;width:24px;height:24px;";
        el.innerHTML = `
          <div style="position:absolute;inset:0;border-radius:50%;border:2px solid rgba(59,130,246,.5);animation:mapPing 2s ease-out infinite;animation-delay:.3s;"></div>
          <div style="position:absolute;inset:3px;border-radius:50%;background:#3B82F6;border:2.5px solid #fff;box-shadow:0 2px 14px rgba(59,130,246,.8);"></div>
        `;
        markersRef.current.push(
          new window.mapboxgl.Marker({ element: el, anchor: "center" })
            .setLngLat([safeNum(ride.driverLng), safeNum(ride.driverLat)])
            .addTo(mapRef.current)
        );
      }

      // ── DRIVER on in_progress — teal car icon ──
      if (hasDriver && isInProgress) {
        const el = document.createElement("div");
        el.style.cssText = "position:relative;width:28px;height:28px;";
        el.innerHTML = `
          <div style="position:absolute;inset:0;border-radius:50%;border:2px solid rgba(13,148,136,.55);animation:mapPing 2s ease-out infinite;animation-delay:.3s;"></div>
          <div style="position:absolute;inset:3px;border-radius:50%;background:#0D9488;border:2.5px solid #fff;box-shadow:0 2px 16px rgba(13,148,136,.8);display:flex;align-items:center;justify-content:center;">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M3 4h10l1 5H2L3 4z" fill="white" opacity=".9"/>
              <path d="M2 9h12v3a1 1 0 01-1 1H3a1 1 0 01-1-1V9z" fill="white"/>
              <circle cx="5" cy="13.5" r="1.5" fill="rgba(255,255,255,.5)"/>
              <circle cx="11" cy="13.5" r="1.5" fill="rgba(255,255,255,.5)"/>
            </svg>
          </div>
        `;
        markersRef.current.push(
          new window.mapboxgl.Marker({ element: el, anchor: "center" })
            .setLngLat([safeNum(ride.driverLng), safeNum(ride.driverLat)])
            .addTo(mapRef.current)
        );
      }

      // ── RIDER MARKER (in_progress only — white dot) ──
      if (hasRider && isInProgress) {
        const el = document.createElement("div");
        el.style.cssText = "position:relative;width:18px;height:18px;display:flex;align-items:center;justify-content:center;";
        el.innerHTML = `
          <div style="width:11px;height:11px;border-radius:50%;background:#fff;border:2.5px solid #0D9488;box-shadow:0 2px 8px rgba(0,0,0,.5);"></div>
        `;
        markersRef.current.push(
          new window.mapboxgl.Marker({ element: el, anchor: "center" })
            .setLngLat([safeNum(ride.riderLng), safeNum(ride.riderLat)])
            .addTo(mapRef.current)
        );
      }

      // ── ARRIVED: big pulse on pickup ──
      if (isArrived && safeNum(ride.pickupLat) && safeNum(ride.pickupLng)) {
        const el = document.createElement("div");
        el.style.cssText = "position:relative;width:36px;height:36px;display:flex;align-items:center;justify-content:center;";
        el.innerHTML = `
          <div style="position:absolute;inset:0;border-radius:50%;border:3px solid rgba(16,185,129,.6);animation:mapPing 1.5s ease-out infinite;"></div>
          <div style="position:absolute;inset:4px;border-radius:50%;border:2px solid rgba(16,185,129,.3);animation:mapPing 1.5s ease-out infinite;animation-delay:.35s;"></div>
          <div style="width:14px;height:14px;border-radius:50%;background:#10B981;border:3px solid #fff;box-shadow:0 0 18px rgba(16,185,129,.8);z-index:1;"></div>
        `;
        markersRef.current.push(
          new window.mapboxgl.Marker({ element: el, anchor: "center" })
            .setLngLat([safeNum(ride.pickupLng), safeNum(ride.pickupLat)])
            .addTo(mapRef.current)
        );
      }

      // ── Fit bounds ──
      if (bounds) {
        const pad = isSearching ? 60 : 44;
        mapRef.current.fitBounds(
          [[bounds.minLng, bounds.minLat], [bounds.maxLng, bounds.maxLat]],
          { padding: pad, maxZoom: 16, duration: 0 }
        );
      }
    };
    if (mapRef.current.loaded()) draw();
    else mapRef.current.once("load", draw);
  }, [routeCoords, bounds, hasDriver, hasRider, status,
      ride.driverLat, ride.driverLng, ride.riderLat, ride.riderLng,
      ride.pickupLat, ride.pickupLng, ride.dropoffLat, ride.dropoffLng]);

  return (
    <div ref={containerRef} className="ht-map"
      style={{ width: "100%", height: "100%", borderRadius: "inherit" }} />
  );
}

/* ══════════════════════════════════════════════════════════════
   PROGRESS BARS
══════════════════════════════════════════════════════════════ */
function Bar({ pct = 0, color = "#0D9488", label }) {
  return (
    <div style={{ height: 2, background: "rgba(255,255,255,.05)", position: "relative", overflow: "visible" }}>
      <div style={{
        position: "absolute", top: 0, left: 0, bottom: 0,
        width: `${Math.min(Math.max(pct,0),100)}%`,
        background: color, transition: "width .4s ease",
        boxShadow: `0 0 10px ${color}88`,
      }}/>
      {label && (
        <div style={{
          position: "absolute", top: -1,
          left: `${Math.min(Math.max(pct,5),87)}%`,
          transform: "translate(-50%,-100%)",
          background: color, color: "#fff",
          fontSize: 9, fontWeight: 700, padding: "3px 7px",
          borderRadius: 5, whiteSpace: "nowrap",
          fontFamily: "var(--mono)", letterSpacing: ".02em",
          zIndex: 10, boxShadow: `0 2px 10px ${color}66`,
        }}>{label}</div>
      )}
    </div>
  );
}
function SearchTimerBar({ expiresAt, emailDispatchAt, createdAt }) {
  const [pct, setPct] = useState(100);
  const [left, setLeft] = useState(null);
  const raf = useRef(null);
  useEffect(() => {
    const exMs = tsToMs(expiresAt); if (!exMs) return;
    const startMs = tsToMs(emailDispatchAt) || tsToMs(createdAt) || (exMs - 25*60*1000);
    const totalMs = exMs - startMs;
    const tick = () => {
      const now = Date.now();
      const rem = Math.max((exMs - now) / 1000, 0);
      setPct(Math.max(((exMs - now) / totalMs) * 100, 0));
      setLeft(Math.ceil(rem));
      if (rem > 0) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [expiresAt]);
  const c = left === null ? "#5C5C72" : left > 300 ? "#F59E0B" : left > 60 ? "#EA580C" : "#EF4444";
  return <Bar pct={pct} color={c} label={left != null ? (left > 0 ? fmtMMSS(left) : "EXPIRED") : "…"}/>;
}
function AssignedBar({ acceptedAt, etaMin }) {
  const [elapsed, setElapsed] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const ms = tsToMs(acceptedAt); if (!ms) return;
    const tick = () => { setElapsed(Math.floor((Date.now()-ms)/1000)); raf.current = requestAnimationFrame(tick); };
    raf.current = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf.current);
  }, [acceptedAt]);
  const total = (etaMin ?? 0) * 60;
  const pct   = total > 0 ? Math.min((elapsed/total)*100, 100) : 0;
  const isLate = total > 0 && elapsed > total;
  const c = isLate ? "#EF4444" : pct > 80 ? "#EA580C" : "#3B82F6";
  return <Bar pct={pct} color={c} label={isLate ? `+${fmtMMSS(elapsed-total)}` : etaMin != null ? `${etaMin}m ETA` : fmtMMSS(elapsed)}/>;
}
function TripBar({ startedAt, tripDurationMin }) {
  const [elapsed, setElapsed] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const ms = tsToMs(startedAt); if (!ms) return;
    const tick = () => { setElapsed(Math.floor((Date.now()-ms)/1000)); raf.current = requestAnimationFrame(tick); };
    raf.current = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf.current);
  }, [startedAt]);
  const total = (tripDurationMin ?? 0) * 60;
  const pct   = total > 0 ? Math.min((elapsed/total)*100, 100) : 0;
  const rem   = Math.max(total - elapsed, 0);
  const c = pct > 90 ? "#EF4444" : pct > 65 ? "#F59E0B" : "#0D9488";
  return <Bar pct={pct} color={c} label={total > 0 ? (elapsed > total ? `+${fmtMMSS(elapsed-total)}` : `${fmtMMSS(rem)} left`) : fmtMMSS(elapsed)}/>;
}
function StatusBar({ ride }) {
  switch (ride.status) {
    case "searching_driver": return <SearchTimerBar expiresAt={ride.expiresAt} emailDispatchAt={ride.emailDispatchAt} createdAt={ride.createdAt}/>;
    case "driver_assigned":
    case "driver_arriving":  return <AssignedBar acceptedAt={ride.acceptedAt} etaMin={ride.driverEtaMin ?? ride.driverInfo?.etaMin}/>;
    case "arrived":          return <Bar pct={100} color="#10B981" label="ARRIVED"/>;
    case "in_progress":      return <TripBar startedAt={ride.startedAt} tripDurationMin={ride.tripDurationMin}/>;
    case "completed":        return <div style={{ height: 2, background: "linear-gradient(90deg, rgba(13,148,136,.6), rgba(8,145,178,.4))" }}/>;
    case "cancelled":        return <div style={{ height: 2, background: "rgba(239,68,68,.5)" }}/>;
    default:                 return <div style={{ height: 2, background: "var(--border)" }}/>;
  }
}

/* ══════════════════════════════════════════════════════════════
   MESSAGE MODAL
══════════════════════════════════════════════════════════════ */
function MessageModal({ ride, onClose, onSend }) {
  const [text, setText] = useState("");
  const driverLabel = ride.driverName ?? `Driver ···${(ride.driverUid ?? "").slice(-4)}`;
  const riderLabel  = ride.riderName  ?? `Rider ···${(ride.uid ?? "").slice(-4)}`;

  return (
    <div className="ht-msg-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ht-msg-backdrop" onClick={onClose}/>
      <div className="ht-msg-sheet">
        {/* Drag handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border-hi)", margin: "0 auto 20px" }}/>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 700, color: "var(--ink)", letterSpacing: "-.01em" }}>
              Message Driver
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-4)", fontWeight: 500, marginTop: 4 }}>
              {driverLabel} · Ride for {riderLabel}
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: 9,
            border: "1px solid var(--border-mid)", background: "var(--bg-lift)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "var(--ink-4)",
          }}>
            <X size={14}/>
          </button>
        </div>

        {/* Quick picks */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--ink-4)", marginBottom: 8 }}>
            Quick Messages
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {QUICK_MSGS.map((msg, i) => (
              <button key={i} onClick={() => setText(msg)} style={{
                textAlign: "left", padding: "9px 13px",
                borderRadius: 9,
                border: `1px solid ${text === msg ? "var(--teal-hi)" : "var(--border)"}`,
                background: text === msg ? "var(--teal-lo)" : "var(--bg-lift)",
                fontSize: 13, fontWeight: 500,
                color: text === msg ? "var(--teal)" : "var(--ink-3)",
                cursor: "pointer", transition: "all .14s",
                fontFamily: "var(--font)",
              }}>
                {msg}
              </button>
            ))}
          </div>
        </div>

        {/* Custom textarea */}
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Or type a custom message…"
          rows={2}
          style={{
            width: "100%", padding: "10px 13px", borderRadius: 10,
            border: "1px solid var(--border-mid)", background: "var(--bg-lift)",
            fontSize: 13, fontWeight: 500, color: "var(--ink)",
            fontFamily: "var(--font)", outline: "none", resize: "none",
            marginBottom: 12, transition: "border-color .15s",
          }}
          onFocus={e => e.target.style.borderColor = "var(--teal)"}
          onBlur={e => e.target.style.borderColor = "var(--border-mid)"}
        />

        {/* Send */}
        <button
          onClick={() => { if (text.trim()) { onSend(text.trim()); onClose(); }}}
          disabled={!text.trim()}
          style={{
            width: "100%", padding: "13px",
            borderRadius: 12, border: "none",
            background: text.trim()
              ? "linear-gradient(135deg, #0D9488, #0891B2)"
              : "var(--bg-raise)",
            color: text.trim() ? "#fff" : "var(--ink-5)",
            fontSize: 14, fontWeight: 700,
            cursor: text.trim() ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            fontFamily: "var(--font-display)", letterSpacing: ".02em",
            transition: "all .18s",
            boxShadow: text.trim() ? "0 4px 20px rgba(13,148,136,.4)" : "none",
          }}
        >
          <Send size={15}/>
          Send Message
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   RIDE CARD
══════════════════════════════════════════════════════════════ */
function RideCard({ ride, index, onMessageDriver, onCallDriver }) {
  const [msgOpen, setMsgOpen] = useState(false);

  const status      = ride.status ?? "unknown";
  const riderLabel  = ride.riderName  ?? `Rider ···${(ride.uid ?? "").slice(-4)}`;
  const driverLabel = ride.driverName ?? (ride.driverUid ? `Driver ···${ride.driverUid.slice(-4)}` : null);

  const s   = STATUS_CFG[status]          ?? { label: status,               color: "#6B7280", bg: "rgba(107,114,128,.1)", border: "rgba(107,114,128,.2)" };
  const pm  = PAY_CFG[ride.paymentStatus] ?? { bg: "rgba(107,114,128,.1)", color: "#6B7280", label: ride.paymentStatus ?? "—" };
  const po  = PAYOUT_CFG[ride.payoutStatus] ?? { bg: "rgba(107,114,128,.1)", color: "#6B7280", label: ride.payoutStatus ?? "—" };

  const isActive     = ["driver_assigned","driver_arriving","arrived","in_progress"].includes(status);
  const isCompleted  = status === "completed";
  const isCancelled  = status === "cancelled";
  const isSearching  = status === "searching_driver";
  const isInProgress = status === "in_progress";
  const isArrived    = status === "arrived";
  const hasDriver    = !!(ride.driverUid);

  const etaText = useMemo(() => {
    if (isInProgress && ride.dropoffEtaMin)  return `${ride.dropoffEtaMin}m to dropoff`;
    if (isActive && ride.driverEtaMin)       return `${ride.driverEtaMin}m to pickup`;
    return null;
  }, [status, ride.dropoffEtaMin, ride.driverEtaMin, isActive, isInProgress]);

  // Top accent stripe color
  const accentColor = isCancelled ? "#EF4444"
    : isCompleted    ? "rgba(107,114,128,.5)"
    : isSearching    ? "#F59E0B"
    : isArrived      ? "#10B981"
    : isInProgress   ? "linear-gradient(90deg, #0D9488, #0891B2)"
    : isActive       ? "#3B82F6"
    : "rgba(107,114,128,.4)";

  return (
    <>
      <div
        className="ht-card ht-up"
        style={{
          animationDelay: `${index * 60}ms`,
          border: isActive ? `1px solid ${s.border}` : "1px solid var(--border)",
          boxShadow: isActive ? `0 0 0 1px ${s.border}, 0 8px 32px rgba(0,0,0,.25)` : "0 4px 20px rgba(0,0,0,.2)",
        }}
      >
        {/* ── Accent stripe ── */}
        <div style={{ height: 2.5, background: accentColor, opacity: isCancelled ? 0.6 : 1 }}/>

        {/* ── Header ── */}
        <div style={{ padding: "14px 16px 10px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          {/* Avatar + names */}
          <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0, flex: 1 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              background: isCancelled
                ? "linear-gradient(135deg,#7F1D1D,#450A0A)"
                : isCompleted
                ? "linear-gradient(135deg,#3F3F46,#27272A)"
                : "linear-gradient(135deg,#0D9488,#0891B2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 800, color: "#fff",
              boxShadow: isActive ? `0 4px 16px ${s.color}44` : "0 2px 8px rgba(0,0,0,.3)",
              letterSpacing: "-.01em",
            }}>
              {initials(riderLabel)}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)", letterSpacing: "-.015em", marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {riderLabel}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                {driverLabel ? (
                  <>
                    <Car size={10} color="var(--ink-4)"/>
                    <span style={{ fontSize: 11.5, color: "var(--ink-3)", fontWeight: 500 }}>{driverLabel}</span>
                  </>
                ) : (
                  <span style={{ fontSize: 11, color: "#F59E0B", fontWeight: 600, fontStyle: "italic" }}>
                    No driver assigned
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Status + fare */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
            <span className="ht-pill" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
              <span style={{
                width: 5, height: 5, borderRadius: "50%",
                background: s.color,
                animation: isActive ? "ht-pulse 1.5s ease-in-out infinite" : "none",
              }}/>
              {s.label}
            </span>
            <div style={{
              fontFamily: "var(--font-display)",
              fontSize: 24, fontWeight: 800,
              color: isCancelled ? "var(--ink-4)" : "var(--ink)",
              letterSpacing: "-.04em", lineHeight: 1,
              fontFeatureSettings: "'tnum'",
            }}>
              {ride.fareTotal != null ? `$${Number(ride.fareTotal).toFixed(2)}` : "—"}
            </div>
          </div>
        </div>

        {/* ── MAP ── */}
        <div style={{
          position: "relative", height: 172,
          margin: "0 12px 10px",
          borderRadius: 11, overflow: "hidden",
          border: `1px solid ${isActive ? s.border : "var(--border)"}`,
          boxShadow: isActive ? `inset 0 0 0 1px ${s.color}15` : "none",
        }}>
          <CardMap ride={ride} status={status}/>

          {/* Pickup chip */}
          <div style={{
            position: "absolute", top: 8, left: 8, zIndex: 20,
            display: "flex", alignItems: "center", gap: 5,
            background: "rgba(10,10,15,.82)", backdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,.08)", borderRadius: 7,
            padding: "5px 9px", maxWidth: "55%",
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981", flexShrink: 0, boxShadow: "0 0 6px rgba(16,185,129,.8)" }}/>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: "rgba(255,255,255,.85)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {shortAddr(ride.pickup) || "Pickup"}
            </span>
          </div>

          {/* Dropoff chip */}
          <div style={{
            position: "absolute", bottom: 8, right: 8, zIndex: 20,
            display: "flex", alignItems: "center", gap: 5,
            background: "rgba(10,10,15,.82)", backdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,.08)", borderRadius: 7,
            padding: "5px 9px", maxWidth: "55%",
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, flexShrink: 0 }}/>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: "rgba(255,255,255,.85)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {shortAddr(ride.dropoff) || "Dropoff"}
            </span>
          </div>

          {/* LIVE badge */}
          {isActive && (
            <div style={{
              position: "absolute", top: 8, right: 8, zIndex: 20,
              display: "flex", alignItems: "center", gap: 5,
              background: "rgba(10,10,15,.82)", backdropFilter: "blur(10px)",
              border: `1px solid ${s.border}`, borderRadius: 20,
              padding: "4px 9px",
            }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: s.color, boxShadow: `0 0 7px ${s.color}`, animation: "ht-pulse 1.4s ease-in-out infinite" }}/>
              <span style={{ fontSize: 9, fontWeight: 700, color: s.color, letterSpacing: ".07em", textTransform: "uppercase" }}>Live</span>
            </div>
          )}

          {/* In-progress legend */}
          {isInProgress && (
            <div style={{
              position: "absolute", bottom: 8, left: 8, zIndex: 20,
              display: "flex", alignItems: "center", gap: 8,
              background: "rgba(10,10,15,.82)", backdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,.08)", borderRadius: 7,
              padding: "5px 9px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#3B82F6", boxShadow: "0 0 5px rgba(59,130,246,.8)" }}/>
                <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,.6)" }}>Driver</span>
              </div>
              <div style={{ width: 1, height: 8, background: "rgba(255,255,255,.12)" }}/>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", border: "1.5px solid #0D9488" }}/>
                <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,.6)" }}>Rider</span>
              </div>
            </div>
          )}

          {/* Cancelled overlay */}
          {isCancelled && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(239,68,68,.06)", zIndex: 10, pointerEvents: "none" }}/>
          )}
        </div>

        {/* ── ACTION BUTTONS ── */}
        {hasDriver && !isCompleted && !isCancelled && (
          <div style={{ display: "flex", gap: 8, padding: "0 12px 10px" }}>
            <button
              className="ht-qa teal"
              onClick={() => setMsgOpen(true)}
            >
              <MessageSquare size={13}/>
              Message Driver
            </button>
            <button
              className="ht-qa green"
              onClick={() => onCallDriver?.(ride)}
            >
              <Phone size={13}/>
              Call Driver
            </button>
          </div>
        )}

        {/* ── Footer ── */}
        <div style={{ padding: "8px 14px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Chips row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {ride.rideLabel && (
                <span className="ht-pill" style={{ background: "var(--bg-lift)", color: "var(--ink-3)", border: "1px solid var(--border-mid)", textTransform: "capitalize" }}>
                  {ride.rideLabel}
                </span>
              )}
              {ride.tripDistanceMiles != null && (
                <span className="ht-pill" style={{ background: "var(--bg-lift)", color: "var(--ink-3)", border: "1px solid var(--border)" }}>
                  {Number(ride.tripDistanceMiles).toFixed(1)} mi
                </span>
              )}
              {ride.tripDurationMin != null && (
                <span className="ht-pill" style={{ background: "var(--bg-lift)", color: "var(--ink-3)", border: "1px solid var(--border)" }}>
                  ~{ride.tripDurationMin} min
                </span>
              )}
              {etaText && (
                <span className="ht-pill" style={{ background: "var(--teal-lo)", color: "var(--teal)", border: "1px solid var(--teal-hi)" }}>
                  <Clock size={8}/> {etaText}
                </span>
              )}
              {isSearching && (
                <span className="ht-pill" style={{ background: "var(--amber-lo)", color: "var(--amber)", border: "1px solid rgba(245,158,11,.25)" }}>
                  <Users size={8}/> {Object.keys(ride.emailSentToDrivers ?? {}).length} notified
                </span>
              )}
            </div>
            <span style={{ fontSize: 10, color: "var(--ink-5)", fontWeight: 500, fontFamily: "var(--mono)", whiteSpace: "nowrap" }}>
              {timeAgo(ride.createdAt)}
            </span>
          </div>

          {/* Payment row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid var(--border)", flexWrap: "wrap", gap: 6 }}>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              <span className="ht-pill" style={{
                background: ride.paymentMethod === "cashapp" ? "var(--green-lo)" : "var(--blue-lo)",
                color:      ride.paymentMethod === "cashapp" ? "var(--green)"    : "var(--blue)",
                border: "none",
              }}>
                {ride.paymentMethod === "cashapp" ? "Cash App" : ride.paymentMethod === "card" ? "Card" : (ride.paymentMethod ?? "—")}
              </span>
              <span className="ht-pill" style={{ background: pm.bg, color: pm.color, border: "none" }}>{pm.label}</span>
              <span className="ht-pill" style={{ background: po.bg, color: po.color, border: "none" }}>{po.label}</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-4)", fontWeight: 500, fontFamily: "var(--mono)", display: "flex", gap: 4, alignItems: "center" }}>
              <span style={{ color: "var(--teal)", fontWeight: 700 }}>${Number(ride.driverPayout ?? 0).toFixed(2)}</span>
              <span style={{ color: "var(--ink-5)" }}>drv</span>
              <span style={{ color: "var(--ink-5)" }}>·</span>
              <span style={{ color: "var(--cyan)", fontWeight: 700 }}>${Number(ride.platformFee ?? 0).toFixed(2)}</span>
              <span style={{ color: "var(--ink-5)" }}>fee</span>
            </div>
          </div>
        </div>

        {/* ── Progress bar ── */}
        <StatusBar ride={ride}/>
      </div>

      {msgOpen && (
        <MessageModal
          ride={ride}
          onClose={() => setMsgOpen(false)}
          onSend={(text) => onMessageDriver?.(ride, text)}
        />
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
   WEEKLY EARNINGS CHART
══════════════════════════════════════════════════════════════ */
function WeekChart({ allRides = [] }) {
  const now    = new Date();
  const sunday = new Date(now); sunday.setHours(0,0,0,0); sunday.setDate(now.getDate() - now.getDay());
  const buckets = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday); d.setDate(sunday.getDate() + i);
    return { label: DAYS[d.getDay()], dateStr: d.toDateString(),
      isToday: d.toDateString() === now.toDateString(), isFuture: d > now,
      rides: 0, fare: 0, platform: 0, payout: 0 };
  });
  allRides.filter(r => r.status === "completed").forEach(r => {
    const ms = tsToMs(r.completedAt ?? r.updatedAt ?? r.createdAt); if (!ms) return;
    const d = new Date(ms); d.setHours(0,0,0,0);
    const idx = buckets.findIndex(b => b.dateStr === d.toDateString()); if (idx === -1) return;
    buckets[idx].rides++;
    buckets[idx].fare     += Number(r.fareTotal    ?? 0);
    buckets[idx].platform += Number(r.platformFee  ?? 0);
    buckets[idx].payout   += Number(r.driverPayout ?? 0);
  });
  const totalFare     = buckets.reduce((s,b) => s + b.fare, 0);
  const totalRides    = buckets.reduce((s,b) => s + b.rides, 0);
  const totalPlatform = buckets.reduce((s,b) => s + b.platform, 0);
  const totalPayout   = buckets.reduce((s,b) => s + b.payout, 0);
  const maxFare       = Math.max(...buckets.map(b => b.fare), 1);
  const [hov, setHov] = useState(null);
  const h = hov !== null ? buckets[hov] : null;

  return (
    <div className="ht-card ht-up" style={{ marginBottom: 12, animationDelay: "60ms" }}>
      {/* Header */}
      <div style={{ padding: "18px 18px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <TrendingUp size={13} color="var(--teal)"/>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, color: "var(--ink)", letterSpacing: "-.01em" }}>
              This Week
            </span>
            <span className="ht-pill" style={{ background: "var(--bg-lift)", color: "var(--ink-4)", border: "1px solid var(--border)" }}>
              {totalRides} rides
            </span>
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-5)", fontWeight: 400 }}>Sun – Sat · completed only</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 800, color: "var(--ink)", letterSpacing: "-.04em", lineHeight: 1, fontFeatureSettings: "'tnum'" }}>
            ${totalFare.toFixed(2)}
          </div>
          <div style={{ fontSize: 9, color: "var(--ink-5)", fontWeight: 700, marginTop: 3, letterSpacing: ".06em", textTransform: "uppercase" }}>
            Total Fare
          </div>
        </div>
      </div>

      {/* Bar chart */}
      <div style={{ padding: "18px 18px 6px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 88 }}>
          {buckets.map((b, i) => {
            const pct = b.isFuture ? 0 : Math.max((b.fare / maxFare) * 100, b.rides > 0 ? 6 : 0);
            const isH = hov === i;
            return (
              <div key={b.label}
                onMouseEnter={() => setHov(i)}
                onMouseLeave={() => setHov(null)}
                style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "default" }}
              >
                {!b.isFuture && b.rides > 0 ? (
                  <span style={{ fontSize: 8.5, color: b.isToday ? "var(--teal)" : "var(--ink-4)", fontWeight: 700, fontFamily: "var(--mono)" }}>
                    ${b.fare.toFixed(0)}
                  </span>
                ) : <div style={{ flex: 1 }}/>}
                <div style={{
                  width: "100%",
                  height: b.isFuture ? 3 : `${Math.max(pct, 3)}%`, minHeight: 3,
                  borderRadius: "4px 4px 2px 2px",
                  background: b.isFuture ? "var(--bg-lift)"
                    : b.isToday
                      ? "linear-gradient(180deg, #0D9488, #0891B2)"
                      : isH ? "var(--ink-3)" : "var(--bg-raise)",
                  border: b.isToday ? "none" : "1px solid var(--border)",
                  boxShadow: b.isToday && !b.isFuture ? "0 4px 14px rgba(13,148,136,.4)" : "none",
                  transition: "all .3s cubic-bezier(.22,1,.36,1)",
                }}/>
                <span style={{ fontSize: 9, color: b.isToday ? "var(--teal)" : "var(--ink-5)", fontWeight: b.isToday ? 700 : 400 }}>
                  {b.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hover detail */}
      {h && !h.isFuture && (
        <div style={{ margin: "0 18px 14px", padding: "12px 14px", background: "var(--bg-lift)", border: "1px solid var(--border-mid)", borderRadius: 10, display: "flex", gap: 20, flexWrap: "wrap" }}>
          {[
            { l: h.label,    v: `${h.rides} ride${h.rides !== 1 ? "s" : ""}`, c: "var(--ink)"  },
            { l: "Fare",     v: `$${h.fare.toFixed(2)}`,                       c: "var(--ink)"  },
            { l: "Platform", v: `$${h.platform.toFixed(2)}`,                   c: "var(--cyan)" },
            { l: "Driver",   v: `$${h.payout.toFixed(2)}`,                     c: "var(--teal)" },
          ].map(it => (
            <div key={it.l}>
              <div style={{ fontSize: 9, color: "var(--ink-5)", letterSpacing: ".05em", textTransform: "uppercase", fontWeight: 600, marginBottom: 3 }}>{it.l}</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 16, color: it.c, fontWeight: 700, fontFeatureSettings: "'tnum'" }}>{it.v}</div>
            </div>
          ))}
        </div>
      )}

      {/* Footer totals */}
      <div style={{ display: "flex", borderTop: "1px solid var(--border)" }}>
        {[
          { l: "Total Fare",    v: `$${totalFare.toFixed(2)}`,     c: "var(--ink)"  },
          { l: "Platform",      v: `$${totalPlatform.toFixed(2)}`, c: "var(--cyan)" },
          { l: "Driver Payout", v: `$${totalPayout.toFixed(2)}`,   c: "var(--teal)" },
        ].map((it, i) => (
          <div key={it.l} style={{ flex: 1, textAlign: "center", padding: "13px 6px", borderRight: i < 2 ? "1px solid var(--border)" : "none" }}>
            <div style={{ fontSize: 9, color: "var(--ink-5)", letterSpacing: ".05em", marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>{it.l}</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 17, color: it.c, fontWeight: 800, letterSpacing: "-.025em", fontFeatureSettings: "'tnum'" }}>{it.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   FILTER PANEL
══════════════════════════════════════════════════════════════ */
function FilterPanel({ filters, onChange, onClear, count }) {
  return (
    <div className="ht-up" style={{
      background: "var(--bg-card)", border: "1px solid var(--border-mid)",
      borderRadius: 12, padding: 14, marginBottom: 10,
      display: "flex", flexDirection: "column", gap: 9,
    }}>
      <div className="ht-search">
        <Search size={13} color="var(--ink-4)"/>
        <input value={filters.search} onChange={e => onChange("search", e.target.value)} placeholder="Search address, name, city…"/>
        {filters.search && (
          <button onClick={() => onChange("search", "")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-4)", display: "flex", padding: 0 }}>
            <X size={12}/>
          </button>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[
          { key: "status",        opts: [["","All statuses"],["searching_driver","Searching"],["driver_assigned","Assigned"],["arrived","Arrived"],["in_progress","In Progress"],["completed","Completed"],["cancelled","Cancelled"]] },
          { key: "paymentMethod", opts: [["","All payments"],["card","Card"],["cashapp","Cash App"]] },
          { key: "paymentStatus", opts: [["","Pay status"],["succeeded","Paid"],["pending","Pending"],["failed","Failed"]] },
          { key: "payoutStatus",  opts: [["","Payout"],["processing","Processing"],["pending","Pending"],["paid","Paid"],["failed","Failed"]] },
        ].map(({ key, opts }) => (
          <div className="ht-sel" key={key}>
            <select value={filters[key]} onChange={e => onChange(key, e.target.value)}>
              {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <ChevronDown size={10} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "var(--ink-5)", pointerEvents: "none" }}/>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "var(--ink-5)", fontWeight: 500 }}>{count} ride{count !== 1 ? "s" : ""} shown</span>
        <button onClick={onClear} style={{ fontSize: 11, fontWeight: 700, color: "var(--red)", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font)" }}>
          Clear filters
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   HOMETAB — Main export
══════════════════════════════════════════════════════════════ */
const DEFAULT_FILTERS = { search: "", status: "", paymentMethod: "", paymentStatus: "", payoutStatus: "" };

export function HomeTab({
  liveRides = [], allRides = [], allApprovals = [], totalAccounts = 0,
  uatobdrivers = [], activeRides = [], searchingRides = [],
  totalRides = 0, activeDrivers = [], revenue = 0,
  onToast, onMessageDriver, onCallDriver,
}) {
  const [refreshing,  setRefreshing]  = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters,     setFilters]     = useState(DEFAULT_FILTERS);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); onToast?.("Refreshed"); }, 1100);
  };
  const onChange    = (k, v) => setFilters(p => ({ ...p, [k]: v }));
  const onClear     = () => setFilters(DEFAULT_FILTERS);
  const activeCount = Object.values(filters).filter(Boolean).length;

  const filtered = useMemo(() => liveRides.filter(ride => {
    if (filters.search) {
      const q   = filters.search.toLowerCase();
      const hay = [ride.pickup, ride.dropoff, ride.pickupCity, ride.dropoffCity,
                   ride.riderName, ride.driverName, ride.pickupZip, ride.dropoffZip]
        .map(v => (v ?? "").toLowerCase()).join(" ");
      if (!hay.includes(q)) return false;
    }
    if (filters.status        && ride.status        !== filters.status)        return false;
    if (filters.paymentMethod && ride.paymentMethod !== filters.paymentMethod) return false;
    if (filters.paymentStatus && ride.paymentStatus !== filters.paymentStatus) return false;
    if (filters.payoutStatus  && ride.payoutStatus  !== filters.payoutStatus)  return false;
    return true;
  }), [liveRides, filters]);

  const kpiRows = [
    { val: totalAccounts,         sub: "Accounts",  color: "#0D9488" },
    { val: uatobdrivers.length,   sub: "Drivers",   color: "#3B82F6" },
    { val: activeRides.length,    sub: "Active",    color: "#10B981" },
    { val: searchingRides.length, sub: "Searching", color: "#F59E0B" },
  ];

  const statCards = [
    { label: "Total Rides",    val: totalRides || liveRides.length, color: "#3B82F6", Icon: Activity   },
    { label: "Active Drivers", val: activeDrivers.length,          color: "#10B981", Icon: Car        },
    { label: "Revenue Today",  val: `$${Number(revenue ?? 0).toFixed(2)}`, color: "#F59E0B", Icon: DollarSign },
    { label: "Pending Apps",   val: allApprovals.length,           color: "#EF4444", Icon: Shield     },
  ];

  return (
    <>
      <style>{CSS}</style>
      <div className="ht" style={{ padding: "0 12px 40px" }}>

        {/* ── KPI strip ── */}
        <div className="ht-card ht-up" style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", padding: "4px 4px 4px 0" }}>
            <div style={{ display: "flex", flex: 1, overflowX: "auto" }}>
              {kpiRows.map(({ val, sub, color }, i, arr) => (
                <div key={sub} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 16px",
                  borderRight: i < arr.length - 1 ? "1px solid var(--border)" : "none",
                  flexShrink: 0,
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}` }}/>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 800, color: "#F4F4F8", letterSpacing: "-.03em", fontFeatureSettings: "'tnum'" }}>{val}</span>
                  <span style={{ fontSize: 11, color: "var(--ink-4)", fontWeight: 500 }}>{sub}</span>
                </div>
              ))}
            </div>
            <button
              onClick={handleRefresh}
              style={{ width: 36, height: 36, borderRadius: 9, border: "1px solid var(--border-mid)", background: "var(--bg-lift)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--ink-4)", flexShrink: 0, marginRight: 10, transition: "all .15s" }}
            >
              <RefreshCw size={13} className={refreshing ? "ht-spin" : ""}/>
            </button>
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
          {statCards.map(({ label, val, color, Icon }, i) => (
            <div key={label} className="ht-card ht-up" style={{ padding: "16px", animationDelay: `${i * 40}ms` }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: color, opacity: .8 }}/>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: `${color}15`, border: `1px solid ${color}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={14} color={color} strokeWidth={2}/>
                </div>
                <ArrowUpRight size={11} color="var(--ink-5)"/>
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--ink)", fontWeight: 800, letterSpacing: "-.04em", lineHeight: 1, fontFeatureSettings: "'tnum'", marginBottom: 5 }}>{val}</div>
              <div style={{ fontSize: 11, color: "var(--ink-4)", fontWeight: 500 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── Weekly chart ── */}
        <WeekChart allRides={allRides.length > 0 ? allRides : liveRides}/>

        {/* ── Rides header ── */}
        <div className="ht-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, animationDelay: "140ms" }}>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, color: "var(--ink)", letterSpacing: "-.01em" }}>
              Live Rides
            </div>
            <div style={{ fontSize: 10.5, color: "var(--ink-5)", fontWeight: 400, marginTop: 2 }}>
              {filtered.length} of {liveRides.length} showing
            </div>
          </div>
          <button onClick={() => setShowFilters(p => !p)} className={`ht-btn${showFilters || activeCount > 0 ? " active" : ""}`}>
            <Filter size={11}/>
            Filter
            {activeCount > 0 && (
              <span style={{ width: 16, height: 16, borderRadius: "50%", background: showFilters ? "rgba(255,255,255,.25)" : "rgba(255,255,255,.2)", color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {activeCount}
              </span>
            )}
          </button>
        </div>

        {showFilters && <FilterPanel filters={filters} onChange={onChange} onClear={onClear} count={filtered.length}/>}

        {/* ── Ride list ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.length === 0 && (
            <div className="ht-card" style={{ textAlign: "center", padding: "56px 24px" }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "var(--bg-lift)", margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border-mid)" }}>
                <Sparkles size={20} color="var(--ink-4)"/>
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 15, color: "var(--ink)", fontWeight: 700, marginBottom: 5 }}>No rides found</div>
              <div style={{ fontSize: 12.5, color: "var(--ink-4)", fontWeight: 400 }}>
                {activeCount > 0 ? "Try clearing your filters" : "Waiting for incoming rides…"}
              </div>
            </div>
          )}
          {filtered.map((ride, i) => (
            <RideCard
              key={ride.id}
              ride={ride}
              index={i}
              onMessageDriver={onMessageDriver}
              onCallDriver={onCallDriver}
            />
          ))}
        </div>
      </div>
    </>
  );
}
