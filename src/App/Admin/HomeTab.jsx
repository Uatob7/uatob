import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Activity, DollarSign, Car, Shield, RefreshCw,
  Filter, Search, X, ChevronDown, BarChart3, Sparkles,
  Clock, Mail, Users, ArrowUpRight, Phone, MessageSquare,
  CheckCircle2, Navigation, Send,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════
   DESIGN TOKENS + GLOBAL CSS
═══════════════════════════════════════════════════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700;800;900&display=swap');

:root {
  --bg:            #F7F7F8;
  --bg-card:       #FFFFFF;
  --bg-soft:       #F4F4F5;
  --bg-subtle:     #FAFAFA;
  --border:        rgba(0,0,0,.06);
  --border-mid:    rgba(0,0,0,.10);
  --border-strong: rgba(0,0,0,.18);
  --ink:           #09090B;
  --ink-2:         #27272A;
  --ink-3:         #52525B;
  --ink-4:         #71717A;
  --ink-5:         #A1A1AA;
  --green:         #16A34A;
  --green-bg:      rgba(22,163,74,.08);
  --blue:          #2563EB;
  --blue-bg:       rgba(37,99,235,.08);
  --amber:         #D97706;
  --amber-bg:      rgba(217,119,6,.08);
  --red:           #DC2626;
  --red-bg:        rgba(220,38,38,.08);
  --font:          'Inter', system-ui, sans-serif;
  --mono:          'JetBrains Mono', monospace;
}

.ht * { box-sizing: border-box; margin: 0; padding: 0; }
.ht {
  font-family: var(--font);
  background: var(--bg);
  color: var(--ink);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  font-feature-settings: 'cv11','ss01';
}

/* Animations */
@keyframes ht-fadeUp   { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
@keyframes ht-spin     { to{transform:rotate(360deg)} }
@keyframes ht-ring     { 0%{transform:scale(.85);opacity:.7} 70%{transform:scale(1.6);opacity:0} 100%{transform:scale(.85);opacity:0} }
@keyframes ht-pulse    { 0%,100%{opacity:1} 50%{opacity:.3} }
@keyframes ht-shimmer  { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
@keyframes ht-bob      { 0%,100%{transform:scale(1)} 50%{transform:scale(1.12)} }
@keyframes ht-msgIn    { from{opacity:0;transform:translateY(8px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }

.ht-fade  { animation: ht-fadeUp .38s cubic-bezier(.22,1,.36,1) both; }
.ht-spin  { animation: ht-spin 1.1s linear infinite; }

/* Cards */
.ht-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  position: relative;
  overflow: hidden;
}
.ht-card-hover {
  transition: border-color .18s, box-shadow .18s;
  cursor: default;
}
.ht-card-hover:hover {
  border-color: var(--border-mid);
  box-shadow: 0 2px 8px rgba(0,0,0,.04), 0 8px 28px rgba(0,0,0,.07);
}

/* Pills */
.ht-pill {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 10.5px; font-weight: 600; letter-spacing: .02em;
  padding: 3px 8px; border-radius: 6px; white-space: nowrap;
}

/* Live dot */
.ht-dot {
  width: 6px; height: 6px; border-radius: 50%;
  flex-shrink: 0; position: relative;
}
.ht-dot::after {
  content: '';
  position: absolute; inset: -3px; border-radius: 50%;
  border: 1.5px solid currentColor;
  animation: ht-ring 2.2s ease-out infinite; opacity: 0;
}

/* Search input */
.ht-search {
  display: flex; align-items: center; gap: 9px;
  background: var(--bg-soft); border: 1px solid var(--border-mid);
  border-radius: 10px; padding: 0 14px; height: 40px; transition: all .18s;
}
.ht-search:focus-within {
  border-color: var(--ink); background: var(--bg-card);
  box-shadow: 0 0 0 3px rgba(0,0,0,.05);
}
.ht-search input {
  flex: 1; border: none; outline: none; background: transparent;
  font-family: var(--font); font-size: 13px; color: var(--ink); font-weight: 500;
}
.ht-search input::placeholder { color: var(--ink-5); }

/* Select */
.ht-sel { position: relative; flex: 1; min-width: 100px; }
.ht-sel select {
  width: 100%; padding: 7px 26px 7px 11px;
  border-radius: 8px; border: 1px solid var(--border-mid);
  font-size: 11px; font-weight: 600; color: var(--ink-2);
  background: var(--bg-card); appearance: none; outline: none;
  cursor: pointer; font-family: var(--font); transition: border-color .18s;
}
.ht-sel select:focus { border-color: var(--ink); box-shadow: 0 0 0 3px rgba(0,0,0,.05); }

/* Action btns */
.ht-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 12px; border-radius: 9px;
  border: 1px solid var(--border-mid); background: var(--bg-card);
  font-family: var(--font); font-size: 11.5px; font-weight: 600;
  color: var(--ink-2); cursor: pointer; transition: all .15s;
}
.ht-btn:hover { border-color: var(--border-strong); background: var(--bg-soft); }
.ht-btn.active { background: var(--ink); color: #fff; border-color: var(--ink); }

/* Quick action btns inside card */
.ht-qa {
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 7px;
  padding: 9px 12px; border-radius: 10px; border: 1px solid var(--border-mid);
  background: var(--bg-subtle); font-family: var(--font);
  font-size: 12px; font-weight: 600; color: var(--ink-2);
  cursor: pointer; transition: all .16s; white-space: nowrap;
}
.ht-qa:hover { border-color: var(--border-strong); background: var(--bg-soft); }
.ht-qa.green { border-color: rgba(22,163,74,.25); background: rgba(22,163,74,.06); color: var(--green); }
.ht-qa.green:hover { background: rgba(22,163,74,.12); border-color: rgba(22,163,74,.4); }
.ht-qa.blue  { border-color: rgba(37,99,235,.22);  background: rgba(37,99,235,.05);  color: var(--blue); }
.ht-qa.blue:hover  { background: rgba(37,99,235,.11); border-color: rgba(37,99,235,.38); }

/* Scrollbar */
.ht ::-webkit-scrollbar { width: 4px; height: 4px; }
.ht ::-webkit-scrollbar-track { background: transparent; }
.ht ::-webkit-scrollbar-thumb { background: var(--border-mid); border-radius: 2px; }

/* Mapbox attribution strip */
.ht-map .mapboxgl-ctrl-logo,
.ht-map .mapboxgl-ctrl-attrib-button { display: none !important; }
.ht-map .mapboxgl-ctrl-attrib {
  font-size: 7px !important; opacity: .12 !important;
  background: transparent !important;
}
.ht-map .mapboxgl-ctrl-bottom-right { bottom: 2px !important; right: 2px !important; }

/* Message modal */
.ht-msg-modal {
  position: fixed; inset: 0; z-index: 900;
  display: flex; align-items: flex-end; justify-content: center;
  padding: 0 0 env(safe-area-inset-bottom);
}
.ht-msg-backdrop {
  position: absolute; inset: 0;
  background: rgba(9,9,11,.55); backdrop-filter: blur(12px);
  animation: ht-fadeUp .2s ease both;
}
.ht-msg-sheet {
  position: relative; z-index: 10;
  width: 100%; max-width: 480px;
  background: var(--bg-card); border-radius: 22px 22px 0 0;
  border: 1px solid var(--border); border-bottom: none;
  box-shadow: 0 -16px 60px rgba(0,0,0,.12);
  padding: 20px 20px 24px;
  animation: ht-msgIn .32s cubic-bezier(.22,1,.36,1) both;
}
`;

/* ═══════════════════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════════════════ */
const MAPBOX_TOKEN = 'pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA';

const STATUS = {
  searching_driver: { label: "Searching",   accent: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
  driver_assigned:  { label: "Assigned",    accent: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE" },
  driver_arriving:  { label: "Arriving",    accent: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE" },
  arrived:          { label: "Arrived",     accent: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0" },
  in_progress:      { label: "In Progress", accent: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0" },
  completed:        { label: "Completed",   accent: "#52525B", bg: "#F4F4F5", border: "#E4E4E7" },
  cancelled:        { label: "Cancelled",   accent: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
};
const PAY = {
  succeeded: { bg: "#F0FDF4", color: "#16A34A", label: "Paid"    },
  pending:   { bg: "#FFFBEB", color: "#D97706", label: "Pending" },
  failed:    { bg: "#FEF2F2", color: "#DC2626", label: "Failed"  },
};
const PAYOUT = {
  processing: { bg: "#EFF6FF", color: "#2563EB", label: "Processing" },
  pending:    { bg: "#FFFBEB", color: "#D97706", label: "Pending"    },
  paid:       { bg: "#F0FDF4", color: "#16A34A", label: "Paid Out"   },
  failed:     { bg: "#FEF2F2", color: "#DC2626", label: "Failed"     },
};
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

/* ═══════════════════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════════════════ */
function tsToMs(ts) {
  if (!ts) return 0;
  if (ts?.seconds) return ts.seconds * 1000;
  if (typeof ts === "number") return ts;
  return 0;
}
function timeAgo(ts) {
  if (!ts) return "—";
  const secs = ts?.seconds ?? Math.floor((typeof ts === "number" ? ts : 0) / 1000);
  const diff = Math.floor(Date.now() / 1000) - secs;
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}
function shortAddr(s = "") { return s.split(",")[0].trim() || s; }
function fmtMMSS(s) {
  const a = Math.abs(Math.round(s));
  return `${Math.floor(a / 60)}:${String(a % 60).padStart(2, "0")}`;
}
function initials(name = "") {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";
}
function safeNum(v) { const n = Number(v); return isFinite(n) ? n : 0; }

/* ═══════════════════════════════════════════════════════════════════
   MAPBOX LOADER (singleton)
═══════════════════════════════════════════════════════════════════ */
let _mbReady = false;
let _mbQ = [];
function loadMapbox(cb) {
  if (_mbReady && window.mapboxgl) { cb(); return; }
  _mbQ.push(cb);
  if (document.getElementById("mb-css")) { if (_mbReady) { cb(); } return; }
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

/* ═══════════════════════════════════════════════════════════════════
   POLYLINE DECODER
═══════════════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════════════
   CARD MAP — Mapbox with polyline + driver + pickup + dropoff pins
═══════════════════════════════════════════════════════════════════ */
function CardMap({ ride, status }) {
  const containerRef   = useRef(null);
  const mapRef         = useRef(null);
  const markersRef     = useRef([]);
  const initializedRef = useRef(false);

  const isActive    = ["driver_assigned","driver_arriving","arrived","in_progress"].includes(status);
  const isCompleted = status === "completed";
  const isCancelled = status === "cancelled";

  // Route colour based on status
  const routeColor = isCancelled ? "#EF4444" : isCompleted ? "#94A3B8" : "#22C55E";
  const mapStyle   = (isCompleted || isCancelled)
    ? "mapbox://styles/mapbox/light-v11"
    : "mapbox://styles/mapbox/dark-v11";

  const routeCoords = useMemo(() =>
    decodePolyline(ride.polyline).map(p => [p[1], p[0]]),
    [ride.polyline]
  );

  const hasDriver = !!(safeNum(ride.driverLat) && safeNum(ride.driverLng));
  const hasRider  = !!(safeNum(ride.riderLat)  && safeNum(ride.riderLng));

  // Compute tight bounds: route + driver + rider + pickup + dropoff
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
  }, [routeCoords, hasDriver, hasRider, ride.driverLat, ride.driverLng, ride.riderLat, ride.riderLng,
      ride.pickupLat, ride.pickupLng, ride.dropoffLat, ride.dropoffLng]);

  const center = useMemo(() => {
    if (bounds) return [(bounds.minLng + bounds.maxLng) / 2, (bounds.minLat + bounds.maxLat) / 2];
    return [-81.3792, 28.5383];
  }, [bounds]);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return;
    loadMapbox(() => {
      if (!containerRef.current || initializedRef.current) return;
      initializedRef.current = true;
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
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; initializedRef.current = false; }
    };
  }, []);

  // Draw route + markers whenever data changes
  useEffect(() => {
    if (!mapRef.current) return;
    const draw = () => {
      if (!mapRef.current?.isStyleLoaded()) { setTimeout(draw, 80); return; }

      /* ── Route polyline ── */
      if (routeCoords.length > 1) {
        const geo = { type: "Feature", geometry: { type: "LineString", coordinates: routeCoords } };
        if (mapRef.current.getSource("route")) {
          mapRef.current.getSource("route").setData(geo);
        } else {
          mapRef.current.addSource("route", { type: "geojson", data: geo });
          // White glow halo
          mapRef.current.addLayer({ id: "route-halo", type: "line", source: "route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": "#fff", "line-width": 14, "line-opacity": isActive ? 0.1 : 0.05, "line-blur": 6 } });
          // Route casing (dark stroke for contrast)
          mapRef.current.addLayer({ id: "route-casing", type: "line", source: "route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": isCompleted || isCancelled ? "#e2e8f0" : "#0f172a", "line-width": 6.5, "line-opacity": 0.9 } });
          // Route fill
          mapRef.current.addLayer({ id: "route-fill", type: "line", source: "route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": routeColor, "line-width": 4, "line-opacity": isCancelled ? 0.55 : 1 } });
          // Animated dash overlay (active only)
          if (isActive) {
            mapRef.current.addLayer({ id: "route-dash", type: "line", source: "route",
              layout: { "line-cap": "round", "line-join": "round" },
              paint: { "line-color": "#fff", "line-width": 1.5, "line-opacity": 0.35, "line-dasharray": [0, 6] } });
          }
        }
      }

      /* ── Clear old markers ── */
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      /* ── Pickup pin (green circle) ── */
      if (safeNum(ride.pickupLat) && safeNum(ride.pickupLng)) {
        const el = document.createElement("div");
        el.style.cssText = "position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;";
        el.innerHTML = `
          <div style="
            width:12px;height:12px;border-radius:50%;
            background:#22C55E;border:2.5px solid #fff;
            box-shadow:0 2px 10px rgba(34,197,94,.65);
            position:relative;z-index:2;
          "></div>
          ${isActive ? `<div style="
            position:absolute;inset:0;border-radius:50%;
            border:2px solid rgba(34,197,94,.4);
            animation:ht-ring 2.2s ease-out infinite;
          "></div>` : ""}
        `;
        markersRef.current.push(
          new window.mapboxgl.Marker({ element: el, anchor: "center" })
            .setLngLat([safeNum(ride.pickupLng), safeNum(ride.pickupLat)])
            .addTo(mapRef.current)
        );
      }

      /* ── Dropoff pin (dark teardrop) ── */
      if (safeNum(ride.dropoffLat) && safeNum(ride.dropoffLng)) {
        const el = document.createElement("div");
        el.style.cssText = "filter:drop-shadow(0 4px 10px rgba(0,0,0,0.5));cursor:default;";
        const pinFill = isCancelled ? "#EF4444" : isCompleted ? "#64748B" : "#111827";
        el.innerHTML = `
          <svg width="22" height="30" viewBox="0 0 22 30" fill="none">
            <path d="M11 0C4.92 0 0 4.92 0 11c0 8.25 11 19 11 19s11-10.75 11-19C22 4.92 17.08 0 11 0z" fill="${pinFill}"/>
            <circle cx="11" cy="11" r="4.5" fill="#fff"/>
            ${!isCompleted && !isCancelled ? '<circle cx="11" cy="11" r="2" fill="' + pinFill + '"/>' : ""}
          </svg>
        `;
        markersRef.current.push(
          new window.mapboxgl.Marker({ element: el, anchor: "bottom" })
            .setLngLat([safeNum(ride.dropoffLng), safeNum(ride.dropoffLat)])
            .addTo(mapRef.current)
        );
      }

      /* ── Driver dot (blue pulsing) ── */
      if (hasDriver && isActive) {
        const el = document.createElement("div");
        el.style.cssText = "position:relative;width:20px;height:20px;";
        el.innerHTML = `
          <div style="
            position:absolute;inset:0;border-radius:50%;
            border:2px solid rgba(59,130,246,.45);
            animation:ht-ring 2s ease-out infinite;
          "></div>
          <div style="
            position:absolute;inset:3px;border-radius:50%;
            background:#3B82F6;border:2px solid #fff;
            box-shadow:0 2px 12px rgba(59,130,246,.75);
            animation:ht-bob 2.4s ease-in-out infinite;
          "></div>
        `;
        markersRef.current.push(
          new window.mapboxgl.Marker({ element: el, anchor: "center" })
            .setLngLat([safeNum(ride.driverLng), safeNum(ride.driverLat)])
            .addTo(mapRef.current)
        );
      }

      /* ── Rider dot (white dot shown during in_progress) ── */
      if (hasRider && status === "in_progress") {
        const el = document.createElement("div");
        el.style.cssText = "position:relative;width:14px;height:14px;";
        el.innerHTML = `
          <div style="
            width:14px;height:14px;border-radius:50%;
            background:#fff;border:2.5px solid #22C55E;
            box-shadow:0 2px 8px rgba(34,197,94,.5);
          "></div>
        `;
        markersRef.current.push(
          new window.mapboxgl.Marker({ element: el, anchor: "center" })
            .setLngLat([safeNum(ride.riderLng), safeNum(ride.riderLat)])
            .addTo(mapRef.current)
        );
      }

      /* ── Fit bounds ── */
      if (bounds) {
        mapRef.current.fitBounds(
          [[bounds.minLng, bounds.minLat], [bounds.maxLng, bounds.maxLat]],
          { padding: 36, maxZoom: 16, duration: 0 }
        );
      }
    };

    if (mapRef.current.loaded()) draw();
    else mapRef.current.once("load", draw);
  }, [routeCoords, bounds, hasDriver, hasRider, status, isActive, isCompleted, isCancelled,
      ride.driverLat, ride.driverLng, ride.riderLat, ride.riderLng,
      ride.pickupLat, ride.pickupLng, ride.dropoffLat, ride.dropoffLng]);

  return <div ref={containerRef} className="ht-map" style={{ width: "100%", height: "100%" }} />;
}

/* ═══════════════════════════════════════════════════════════════════
   PROGRESS BARS
═══════════════════════════════════════════════════════════════════ */
function Bar({ pct = 0, color = "#16A34A", label }) {
  return (
    <div style={{ height: 3, background: "rgba(0,0,0,.05)", position: "relative", overflow: "visible" }}>
      <div style={{
        position: "absolute", top: 0, left: 0, bottom: 0,
        width: `${Math.min(Math.max(pct, 0), 100)}%`,
        background: color, transition: "width .4s ease",
        boxShadow: `0 0 8px ${color}66`,
      }} />
      {label && (
        <div style={{
          position: "absolute", top: -1,
          left: `${Math.min(Math.max(pct, 5), 87)}%`,
          transform: "translate(-50%,-100%)",
          background: color, color: "#fff",
          fontSize: 9, fontWeight: 700, padding: "3px 7px",
          borderRadius: 5, whiteSpace: "nowrap",
          fontFamily: "var(--mono)", letterSpacing: ".02em",
          zIndex: 10, boxShadow: `0 2px 8px ${color}55`,
          pointerEvents: "none",
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
    const startMs = tsToMs(emailDispatchAt) || tsToMs(createdAt) || (exMs - 25 * 60 * 1000);
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
  const c = left === null ? "#A1A1AA" : left > 300 ? "#D97706" : left > 60 ? "#EA580C" : "#DC2626";
  return <Bar pct={pct} color={c} label={left != null ? (left > 0 ? fmtMMSS(left) : "EXPIRED") : "…"} />;
}

function AssignedBar({ acceptedAt, etaMin }) {
  const [elapsed, setElapsed] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const ms = tsToMs(acceptedAt); if (!ms) return;
    const tick = () => { setElapsed(Math.floor((Date.now() - ms) / 1000)); raf.current = requestAnimationFrame(tick); };
    raf.current = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf.current);
  }, [acceptedAt]);
  const total = (etaMin ?? 0) * 60;
  const pct   = total > 0 ? Math.min((elapsed / total) * 100, 100) : 0;
  const isLate = total > 0 && elapsed > total;
  const c = isLate ? "#DC2626" : pct > 80 ? "#EA580C" : "#2563EB";
  return <Bar pct={pct} color={c} label={isLate ? `+${fmtMMSS(elapsed - total)}` : etaMin != null ? `${etaMin}m ETA` : fmtMMSS(elapsed)} />;
}

function TripBar({ startedAt, tripDurationMin }) {
  const [elapsed, setElapsed] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const ms = tsToMs(startedAt); if (!ms) return;
    const tick = () => { setElapsed(Math.floor((Date.now() - ms) / 1000)); raf.current = requestAnimationFrame(tick); };
    raf.current = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf.current);
  }, [startedAt]);
  const total = (tripDurationMin ?? 0) * 60;
  const pct   = total > 0 ? Math.min((elapsed / total) * 100, 100) : 0;
  const rem   = Math.max(total - elapsed, 0);
  const c = pct > 90 ? "#DC2626" : pct > 70 ? "#D97706" : "#16A34A";
  return <Bar pct={pct} color={c} label={total > 0 ? (elapsed > total ? `+${fmtMMSS(elapsed - total)}` : `${fmtMMSS(rem)} left`) : fmtMMSS(elapsed)} />;
}

function StatusBar({ ride }) {
  switch (ride.status) {
    case "searching_driver": return <SearchTimerBar expiresAt={ride.expiresAt} emailDispatchAt={ride.emailDispatchAt} createdAt={ride.createdAt} />;
    case "driver_assigned":
    case "driver_arriving":  return <AssignedBar acceptedAt={ride.acceptedAt} etaMin={ride.driverEtaMin ?? ride.driverInfo?.etaMin} />;
    case "arrived":          return <Bar pct={100} color="#16A34A" label="ARRIVED" />;
    case "in_progress":      return <TripBar startedAt={ride.startedAt} tripDurationMin={ride.tripDurationMin} />;
    case "completed":        return <div style={{ height: 3, background: "var(--bg-soft)" }} />;
    case "cancelled":        return <div style={{ height: 3, background: "linear-gradient(90deg,#DC2626,#FECACA)" }} />;
    default:                 return <div style={{ height: 3, background: "var(--border)" }} />;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   MESSAGE MODAL
═══════════════════════════════════════════════════════════════════ */
const QUICK_MESSAGES = [
  "Driver is on their way to you.",
  "Your driver is about 2 minutes away.",
  "Your driver has arrived. Please head out.",
  "Your ride is going smoothly — ETA updated.",
  "There's a slight delay. We appreciate your patience.",
];

function MessageModal({ ride, onClose, onSend }) {
  const [text, setText] = useState("");
  const driverName = ride.driverName ?? `Driver ···${(ride.driverUid ?? "").slice(-4)}`;
  const riderName  = ride.riderName  ?? `Rider ···${(ride.uid ?? "").slice(-4)}`;

  return (
    <div className="ht-msg-modal" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ht-msg-backdrop" onClick={onClose} />
      <div className="ht-msg-sheet">
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border-mid)", margin: "0 auto 18px" }} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", letterSpacing: "-.02em" }}>
              Message Driver
            </div>
            <div style={{ fontSize: 11.5, color: "var(--ink-4)", fontWeight: 500, marginTop: 2 }}>
              {driverName} · Ride for {riderName}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border-mid)", background: "var(--bg-soft)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--ink-4)" }}>
            <X size={14} />
          </button>
        </div>

        {/* Quick messages */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
          <div style={{ fontSize: 10.5, color: "var(--ink-5)", fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase", marginBottom: 2 }}>
            Quick messages
          </div>
          {QUICK_MESSAGES.map((msg, i) => (
            <button key={i} onClick={() => setText(msg)} style={{
              textAlign: "left", padding: "9px 12px", borderRadius: 10,
              border: `1px solid ${text === msg ? "rgba(37,99,235,.35)" : "var(--border)"}`,
              background: text === msg ? "rgba(37,99,235,.06)" : "var(--bg-subtle)",
              fontSize: 12.5, fontWeight: 500, color: text === msg ? "var(--blue)" : "var(--ink-3)",
              cursor: "pointer", transition: "all .14s", fontFamily: "var(--font)",
            }}>
              {msg}
            </button>
          ))}
        </div>

        {/* Custom input */}
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Or type a custom message…"
          rows={2}
          style={{
            width: "100%", padding: "10px 12px", borderRadius: 10,
            border: "1px solid var(--border-mid)", background: "var(--bg-subtle)",
            fontSize: 13, fontWeight: 500, color: "var(--ink)",
            fontFamily: "var(--font)", outline: "none", resize: "none",
            marginBottom: 12, transition: "border-color .15s",
          }}
          onFocus={e => e.target.style.borderColor = "var(--ink)"}
          onBlur={e => e.target.style.borderColor = "var(--border-mid)"}
        />

        {/* Send btn */}
        <button
          onClick={() => { if (text.trim()) { onSend(text.trim()); onClose(); } }}
          disabled={!text.trim()}
          style={{
            width: "100%", padding: "12px", borderRadius: 12,
            border: "none",
            background: text.trim() ? "linear-gradient(135deg,#2563EB,#1D4ED8)" : "var(--bg-soft)",
            color: text.trim() ? "#fff" : "var(--ink-5)",
            fontSize: 13.5, fontWeight: 700, cursor: text.trim() ? "pointer" : "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            fontFamily: "var(--font)", transition: "all .18s",
            boxShadow: text.trim() ? "0 4px 16px rgba(37,99,235,.3)" : "none",
          }}
        >
          <Send size={14} />
          Send to Driver
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   RIDE CARD
═══════════════════════════════════════════════════════════════════ */
function RideCard({ ride, index, onMessageDriver, onCallDriver }) {
  const [msgOpen, setMsgOpen] = useState(false);

  const riderLabel  = ride.riderName  ?? `Rider ···${(ride.uid ?? "").slice(-4)}`;
  const driverLabel = ride.driverName ?? (ride.driverUid ? `Driver ···${ride.driverUid.slice(-4)}` : null);
  const status      = ride.status ?? "unknown";

  const s   = STATUS[status]                ?? { label: status,                     accent: "#71717A", bg: "#F4F4F5", border: "#E4E4E7" };
  const pm  = PAY[ride.paymentStatus]       ?? { bg: "#F4F4F5", color: "#71717A", label: ride.paymentStatus ?? "—" };
  const po  = PAYOUT[ride.payoutStatus]     ?? { bg: "#F4F4F5", color: "#71717A", label: ride.payoutStatus  ?? "—" };

  const isActive    = ["driver_assigned","driver_arriving","arrived","in_progress"].includes(status);
  const isCompleted = status === "completed";
  const isCancelled = status === "cancelled";
  const isSearching = status === "searching_driver";
  const hasDriver   = !!(ride.driverUid);

  /* ETA display */
  const etaText = useMemo(() => {
    if (status === "in_progress" && ride.dropoffEtaMin)  return `${ride.dropoffEtaMin}m to dropoff`;
    if (isActive && ride.driverEtaMin)                   return `${ride.driverEtaMin}m to pickup`;
    if (isActive && ride.driverInfo?.etaMin)             return `${ride.driverInfo.etaMin}m to pickup`;
    return null;
  }, [status, ride.dropoffEtaMin, ride.driverEtaMin, ride.driverInfo?.etaMin, isActive]);

  /* Accent stripe color */
  const accentColor = isCancelled ? "#EF4444"
    : isCompleted    ? "#94A3B8"
    : isSearching    ? "#F59E0B"
    : isActive       ? "#22C55E"
    : "#94A3B8";

  return (
    <>
      <div
        className="ht-card ht-card-hover ht-fade"
        style={{ animationDelay: `${180 + index * 45}ms` }}
      >
        {/* ── Accent stripe ── */}
        <div style={{ height: 3, background: accentColor, opacity: isCancelled ? 0.55 : 1 }} />

        {/* ── Header ── */}
        <div style={{ padding: "14px 16px 12px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          {/* Avatar + names */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 11, flexShrink: 0,
              background: isCancelled
                ? "linear-gradient(135deg,#EF4444,#B91C1C)"
                : isCompleted
                ? "linear-gradient(135deg,#52525B,#27272A)"
                : "linear-gradient(135deg,#1C1C1E,#09090B)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 800, color: "#fff",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,.1), 0 2px 8px rgba(0,0,0,.12)",
              letterSpacing: "-.01em",
            }}>
              {initials(riderLabel)}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)", letterSpacing: "-.015em", marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {riderLabel}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                {driverLabel
                  ? <>
                      <Car size={10} color="var(--ink-5)" />
                      <span style={{ fontSize: 11, color: "var(--ink-4)", fontWeight: 500 }}>{driverLabel}</span>
                    </>
                  : <span style={{ fontSize: 11, color: "#F59E0B", fontWeight: 600, fontStyle: "italic" }}>No driver assigned</span>
                }
              </div>
            </div>
          </div>

          {/* Status + fare */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
            <span className="ht-pill" style={{ background: s.bg, color: s.accent, border: `1px solid ${s.border}` }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.accent, boxShadow: `0 0 5px ${s.accent}` }} />
              {s.label}
            </span>
            <div style={{
              fontSize: 22, fontWeight: 800, color: isCancelled ? "var(--ink-4)" : "var(--ink)",
              letterSpacing: "-.035em", lineHeight: 1, fontFeatureSettings: "'tnum'",
            }}>
              {ride.fareTotal != null ? `$${Number(ride.fareTotal).toFixed(2)}` : "—"}
            </div>
          </div>
        </div>

        {/* ── MAP ── */}
        <div style={{ position: "relative", height: 162, margin: "0 14px", borderRadius: 12, overflow: "hidden", border: "1px solid var(--border-mid)" }}>
          <CardMap ride={ride} status={status} />

          {/* Pickup label — top-left */}
          <div style={{
            position: "absolute", top: 8, left: 8, zIndex: 20,
            display: "flex", alignItems: "center", gap: 5,
            background: "rgba(255,255,255,.93)", backdropFilter: "blur(8px)",
            border: "1px solid rgba(0,0,0,.08)", borderRadius: 8, padding: "5px 10px",
            maxWidth: "58%",
          }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22C55E", flexShrink: 0, boxShadow: "0 0 6px rgba(34,197,94,.7)" }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: "#09090B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {shortAddr(ride.pickup) || "Pickup"}
            </span>
          </div>

          {/* Dropoff label — bottom-right */}
          <div style={{
            position: "absolute", bottom: 8, right: 8, zIndex: 20,
            display: "flex", alignItems: "center", gap: 5,
            background: "rgba(9,9,11,.82)", backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: "5px 10px",
            maxWidth: "58%",
          }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: isCancelled ? "#EF4444" : isCompleted ? "#94A3B8" : "#fff", flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,.9)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {shortAddr(ride.dropoff) || "Dropoff"}
            </span>
          </div>

          {/* LIVE badge — top-right (active only) */}
          {isActive && (
            <div style={{
              position: "absolute", top: 8, right: 8, zIndex: 20,
              display: "flex", alignItems: "center", gap: 5,
              background: "rgba(9,9,11,.82)", backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,.1)", borderRadius: 20, padding: "4px 10px",
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E", boxShadow: "0 0 6px #22C55E", animation: "ht-pulse 1.5s ease-in-out infinite" }} />
              <span style={{ fontSize: 9.5, fontWeight: 700, color: "rgba(255,255,255,.85)", letterSpacing: ".06em", textTransform: "uppercase" }}>Live</span>
            </div>
          )}

          {/* Cancelled tint */}
          {isCancelled && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(239,68,68,.08)", zIndex: 10, pointerEvents: "none" }} />
          )}

          {/* Map legend — driver + rider dots (in_progress) */}
          {status === "in_progress" && (
            <div style={{
              position: "absolute", bottom: 8, left: 8, zIndex: 20,
              display: "flex", alignItems: "center", gap: 8,
              background: "rgba(9,9,11,.82)", backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, padding: "5px 10px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#3B82F6", boxShadow: "0 0 5px rgba(59,130,246,.7)" }} />
                <span style={{ fontSize: 9.5, fontWeight: 600, color: "rgba(255,255,255,.7)" }}>Driver</span>
              </div>
              <div style={{ width: 1, height: 10, background: "rgba(255,255,255,.15)" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff", border: "1.5px solid #22C55E" }} />
                <span style={{ fontSize: 9.5, fontWeight: 600, color: "rgba(255,255,255,.7)" }}>Rider</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Quick Action Buttons ── */}
        {hasDriver && !isCompleted && !isCancelled && (
          <div style={{ display: "flex", gap: 8, padding: "10px 14px 0" }}>
            <button
              className="ht-qa blue"
              onClick={() => setMsgOpen(true)}
            >
              <MessageSquare size={13} />
              Message Driver
            </button>
            <button
              className="ht-qa green"
              onClick={() => onCallDriver?.(ride)}
            >
              <Phone size={13} />
              Call Driver
            </button>
          </div>
        )}

        {/* ── Footer ── */}
        <div style={{ padding: "10px 16px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          {/* Meta chips */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {ride.rideLabel && (
                <span className="ht-pill" style={{ background: "var(--bg-soft)", color: "var(--ink-3)", border: "1px solid var(--border)", textTransform: "capitalize" }}>
                  {ride.rideLabel}
                </span>
              )}
              {ride.tripDistanceMiles != null && (
                <span className="ht-pill" style={{ background: "var(--bg-soft)", color: "var(--ink-3)", border: "1px solid var(--border)" }}>
                  {Number(ride.tripDistanceMiles).toFixed(1)} mi
                </span>
              )}
              {ride.tripDurationMin != null && (
                <span className="ht-pill" style={{ background: "var(--bg-soft)", color: "var(--ink-3)", border: "1px solid var(--border)" }}>
                  ~{ride.tripDurationMin} min
                </span>
              )}
              {etaText && (
                <span className="ht-pill" style={{ background: "var(--green-bg)", color: "var(--green)", border: "1px solid rgba(22,163,74,.18)" }}>
                  <Clock size={8} /> {etaText}
                </span>
              )}
              {isSearching && <>
                <span className="ht-pill" style={{ background: "#FFFBEB", color: "#92400E", border: "1px solid #FDE68A" }}>
                  <Users size={8} /> {(ride.candidateDriverUids ?? []).length} cands
                </span>
                <span className="ht-pill" style={{
                  background: Object.keys(ride.emailSentToDrivers ?? {}).length > 0 ? "#F0FDF4" : "var(--bg-soft)",
                  color:      Object.keys(ride.emailSentToDrivers ?? {}).length > 0 ? "#16A34A" : "var(--ink-4)",
                  border:     "1px solid var(--border)",
                }}>
                  <Mail size={8} /> {Object.keys(ride.emailSentToDrivers ?? {}).length} mailed
                </span>
              </>}
            </div>
            <span style={{ fontSize: 10.5, color: "var(--ink-5)", fontWeight: 500, whiteSpace: "nowrap" }}>
              {timeAgo(ride.createdAt)}
            </span>
          </div>

          {/* Payment row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid var(--border)", flexWrap: "wrap", gap: 6 }}>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              <span className="ht-pill" style={{
                background: ride.paymentMethod === "cashapp" ? "#F0FDF4" : "#EFF6FF",
                color:      ride.paymentMethod === "cashapp" ? "#16A34A" : "#2563EB",
              }}>
                {ride.paymentMethod === "cashapp" ? "Cash App" : ride.paymentMethod === "card" ? "Card" : (ride.paymentMethod ?? "—")}
              </span>
              <span className="ht-pill" style={{ background: pm.bg, color: pm.color }}>{pm.label}</span>
              <span className="ht-pill" style={{ background: po.bg, color: po.color }}>{po.label}</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-4)", fontWeight: 500, fontFeatureSettings: "'tnum'" }}>
              <span style={{ color: "var(--green)", fontWeight: 700 }}>${Number(ride.driverPayout ?? 0).toFixed(2)}</span>
              <span style={{ color: "var(--ink-5)" }}> drv · </span>
              <span style={{ color: "var(--blue)", fontWeight: 700 }}>${Number(ride.platformFee ?? 0).toFixed(2)}</span>
              <span style={{ color: "var(--ink-5)" }}> fee</span>
            </div>
          </div>
        </div>

        {/* ── Status progress bar ── */}
        <StatusBar ride={ride} />
      </div>

      {/* Message modal */}
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

/* ═══════════════════════════════════════════════════════════════════
   WEEKLY CHART
═══════════════════════════════════════════════════════════════════ */
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
  const totalFare     = buckets.reduce((s, b) => s + b.fare, 0);
  const totalRides    = buckets.reduce((s, b) => s + b.rides, 0);
  const totalPlatform = buckets.reduce((s, b) => s + b.platform, 0);
  const totalPayout   = buckets.reduce((s, b) => s + b.payout, 0);
  const maxFare       = Math.max(...buckets.map(b => b.fare), 1);
  const [hov, setHov] = useState(null);
  const h = hov !== null ? buckets[hov] : null;

  return (
    <div className="ht-card ht-fade" style={{ marginBottom: 12, animationDelay: "60ms" }}>
      {/* Header */}
      <div style={{ padding: "18px 20px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
            <BarChart3 size={13} color="var(--ink-4)" />
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", letterSpacing: "-.015em" }}>This Week</span>
            <span className="ht-pill" style={{ background: "var(--bg-soft)", color: "var(--ink-4)" }}>{totalRides} rides</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-5)", fontWeight: 500 }}>Sun – Sat · completed only</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: "var(--ink)", letterSpacing: "-.04em", lineHeight: 1, fontFeatureSettings: "'tnum'" }}>${totalFare.toFixed(2)}</div>
          <div style={{ fontSize: 9.5, color: "var(--ink-5)", fontWeight: 600, marginTop: 3, letterSpacing: ".04em", textTransform: "uppercase" }}>Total Fare</div>
        </div>
      </div>

      {/* Bars */}
      <div style={{ padding: "18px 20px 6px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 88 }}>
          {buckets.map((b, i) => {
            const pct = b.isFuture ? 0 : Math.max((b.fare / maxFare) * 100, b.rides > 0 ? 8 : 0);
            const isH = hov === i;
            return (
              <div key={b.label} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}
                style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 7, cursor: "default" }}>
                {!b.isFuture && b.rides > 0 && (
                  <span style={{ fontSize: 8.5, color: b.isToday ? "var(--green)" : "var(--ink-5)", fontWeight: 700, fontFamily: "var(--mono)" }}>
                    ${b.fare.toFixed(0)}
                  </span>
                )}
                {(b.isFuture || b.rides === 0) && <div style={{ flex: 1 }} />}
                <div style={{
                  width: "100%",
                  height: b.isFuture ? 3 : `${Math.max(pct, 4)}%`, minHeight: 3,
                  borderRadius: "5px 5px 2px 2px",
                  background: b.isFuture ? "var(--bg-soft)"
                    : b.isToday ? (isH ? "linear-gradient(180deg,#22C55E,#16A34A 70%,#15803D)" : "linear-gradient(180deg,#22C55E,#16A34A)")
                    : isH ? "var(--ink-2)" : "var(--ink-5)",
                  opacity: !b.isToday && !isH && !b.isFuture ? .45 : 1,
                  boxShadow: b.isToday && !b.isFuture ? "0 4px 12px rgba(22,163,74,.3)" : "none",
                  transition: "all .3s cubic-bezier(.22,1,.36,1)",
                }} />
                <span style={{ fontSize: 9.5, color: b.isToday ? "var(--green)" : "var(--ink-5)", fontWeight: b.isToday ? 700 : 500, letterSpacing: ".01em" }}>
                  {b.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hover detail */}
      {h && !h.isFuture && (
        <div style={{ margin: "0 20px 16px", padding: "12px 14px", background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 10, display: "flex", gap: 20, flexWrap: "wrap" }}>
          {[
            { l: h.label,    v: `${h.rides} ride${h.rides !== 1 ? "s" : ""}`, c: "var(--ink)"   },
            { l: "Fare",     v: `$${h.fare.toFixed(2)}`,                       c: "var(--ink)"   },
            { l: "Platform", v: `$${h.platform.toFixed(2)}`,                   c: "var(--blue)"  },
            { l: "Driver",   v: `$${h.payout.toFixed(2)}`,                     c: "var(--green)" },
          ].map(it => (
            <div key={it.l}>
              <div style={{ fontSize: 9, color: "var(--ink-5)", letterSpacing: ".05em", textTransform: "uppercase", fontWeight: 600, marginBottom: 3 }}>{it.l}</div>
              <div style={{ fontSize: 15, color: it.c, fontWeight: 700, fontFeatureSettings: "'tnum'" }}>{it.v}</div>
            </div>
          ))}
        </div>
      )}

      {/* Footer totals */}
      <div style={{ display: "flex", borderTop: "1px solid var(--border)" }}>
        {[
          { l: "Total Fare",    v: `$${totalFare.toFixed(2)}`,     c: "var(--ink)"   },
          { l: "Platform Fee",  v: `$${totalPlatform.toFixed(2)}`, c: "var(--blue)"  },
          { l: "Driver Payout", v: `$${totalPayout.toFixed(2)}`,   c: "var(--green)" },
        ].map((it, i) => (
          <div key={it.l} style={{ flex: 1, textAlign: "center", padding: "14px 6px", borderRight: i < 2 ? "1px solid var(--border)" : "none" }}>
            <div style={{ fontSize: 9, color: "var(--ink-5)", letterSpacing: ".05em", marginBottom: 4, fontWeight: 600, textTransform: "uppercase" }}>{it.l}</div>
            <div style={{ fontSize: 17, color: it.c, fontWeight: 800, letterSpacing: "-.025em", fontFeatureSettings: "'tnum'" }}>{it.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   FILTER PANEL
═══════════════════════════════════════════════════════════════════ */
function FilterPanel({ filters, onChange, onClear, count }) {
  return (
    <div className="ht-fade" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 14, marginBottom: 10, display: "flex", flexDirection: "column", gap: 9 }}>
      <div className="ht-search">
        <Search size={13} color="var(--ink-5)" />
        <input value={filters.search} onChange={e => onChange("search", e.target.value)} placeholder="Search address, name, city…" />
        {filters.search && (
          <button onClick={() => onChange("search", "")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-4)", display: "flex", padding: 0 }}>
            <X size={12} />
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
            <ChevronDown size={10} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "var(--ink-5)", pointerEvents: "none" }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "var(--ink-5)", fontWeight: 500 }}>{count} ride{count !== 1 ? "s" : ""}</span>
        <button onClick={onClear} style={{ fontSize: 11, fontWeight: 600, color: "var(--red)", background: "none", border: "none", cursor: "pointer" }}>Clear all</button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   HOMETAB
═══════════════════════════════════════════════════════════════════ */
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
      const q = filters.search.toLowerCase();
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

  const statCards = [
    { label: "Total Rides",    val: totalRides || liveRides.length,               accent: "#2563EB", Icon: Activity,    delay: 0   },
    { label: "Active Drivers", val: activeDrivers.length,                         accent: "#16A34A", Icon: Car,         delay: 40  },
    { label: "Revenue Today",  val: `$${Number(revenue ?? 0).toFixed(2)}`,        accent: "#D97706", Icon: DollarSign,  delay: 80  },
    { label: "Pending Apps",   val: allApprovals.length,                          accent: "#DC2626", Icon: Shield,      delay: 120 },
  ];

  return (
    <>
      <style>{CSS}</style>
      <div className="ht" style={{ padding: "0 14px 36px" }}>

        {/* ── KPI strip ── */}
        <div className="ht-card ht-fade" style={{ padding: "11px 14px", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", flex: 1, overflowX: "auto" }}>
              {[
                { val: totalAccounts,         sub: "Accounts",  dot: "#16A34A" },
                { val: uatobdrivers.length,   sub: "Drivers",   dot: "#2563EB" },
                { val: activeRides.length,    sub: "Active",    dot: "#22C55E" },
                { val: searchingRides.length, sub: "Searching", dot: "#F59E0B" },
              ].map(({ val, sub, dot }, i, arr) => (
                <div key={sub} style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "3px 14px",
                  borderRight: i < arr.length - 1 ? "1px solid var(--border)" : "none",
                  flexShrink: 0,
                }}>
                  <div className="ht-dot" style={{ background: dot, color: dot }} />
                  <span style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)", letterSpacing: "-.03em", fontFeatureSettings: "'tnum'" }}>{val}</span>
                  <span style={{ fontSize: 11, color: "var(--ink-5)", fontWeight: 500 }}>{sub}</span>
                </div>
              ))}
            </div>
            <button
              onClick={handleRefresh}
              style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid var(--border-mid)", background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--ink-4)", flexShrink: 0, transition: "all .15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-soft)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-card)"; }}
            >
              <RefreshCw size={13} className={refreshing ? "ht-spin" : ""} />
            </button>
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
          {statCards.map(({ label, val, accent, Icon, delay }) => (
            <div key={label} className="ht-card ht-card-hover ht-fade" style={{ padding: "15px", animationDelay: `${delay}ms` }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2.5, background: accent, opacity: .85 }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: `${accent}12`, border: `1px solid ${accent}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={14} color={accent} strokeWidth={2.2} />
                </div>
                <ArrowUpRight size={11} color="var(--ink-5)" />
              </div>
              <div style={{ fontSize: 23, color: "var(--ink)", fontWeight: 800, letterSpacing: "-.035em", lineHeight: 1, fontFeatureSettings: "'tnum'", marginBottom: 4 }}>{val}</div>
              <div style={{ fontSize: 11, color: "var(--ink-5)", fontWeight: 500 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── Weekly chart ── */}
        <WeekChart allRides={allRides.length > 0 ? allRides : liveRides} />

        {/* ── Rides header ── */}
        <div className="ht-fade" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, animationDelay: "160ms" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", letterSpacing: "-.02em" }}>Live Rides</div>
              <div style={{ fontSize: 10.5, color: "var(--ink-5)", fontWeight: 500, marginTop: 1 }}>
                {filtered.length} of {liveRides.length} showing
              </div>
            </div>
            <div className="ht-dot" style={{ background: "#22C55E", color: "#22C55E", width: 7, height: 7 }} />
          </div>
          <button onClick={() => setShowFilters(p => !p)} className={`ht-btn${showFilters || activeCount > 0 ? " active" : ""}`}>
            <Filter size={11} />
            Filter
            {activeCount > 0 && (
              <span style={{ width: 16, height: 16, borderRadius: "50%", background: showFilters ? "#fff" : "var(--ink)", color: showFilters ? "var(--ink)" : "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {activeCount}
              </span>
            )}
          </button>
        </div>

        {showFilters && <FilterPanel filters={filters} onChange={onChange} onClear={onClear} count={filtered.length} />}

        {/* ── Ride list ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.length === 0 && (
            <div className="ht-card" style={{ textAlign: "center", padding: "52px 20px" }}>
              <div style={{ width: 44, height: 44, borderRadius: 13, background: "var(--bg-soft)", margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Sparkles size={20} color="var(--ink-5)" />
              </div>
              <div style={{ fontSize: 14, color: "var(--ink)", fontWeight: 700, marginBottom: 4 }}>No rides found</div>
              <div style={{ fontSize: 12, color: "var(--ink-5)", fontWeight: 500 }}>
                {activeCount > 0 ? "Try clearing some filters" : "Waiting for new rides…"}
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
