import { useState, useMemo, useEffect, useRef } from "react";
import {
  Activity, DollarSign, Car, Shield,
  RefreshCw, Filter, Search, X, ChevronDown, TrendingUp,
  MapPin, Clock, Mail, Users, ArrowUpRight, Zap,
  Navigation, CheckCircle2, XCircle, AlertCircle,
  Radio, BarChart3, Sparkles,
} from "lucide-react";

/* ─── Design Tokens ─────────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700;800;900&display=swap');

:root {
  --bg:          #FAFAFA;
  --bg-card:     #FFFFFF;
  --bg-soft:     #F4F4F5;
  --bg-subtle:   #F9FAFB;

  --border:      rgba(0,0,0,.06);
  --border-mid:  rgba(0,0,0,.10);
  --border-strong: rgba(0,0,0,.16);

  --ink:         #09090B;
  --ink-2:       #27272A;
  --ink-3:       #52525B;
  --ink-4:       #71717A;
  --ink-5:       #A1A1AA;

  --green:       #16A34A;
  --green-soft:  #DCFCE7;
  --green-bg:    rgba(22,163,74,.08);

  --blue:        #2563EB;
  --blue-soft:   #DBEAFE;
  --blue-bg:     rgba(37,99,235,.08);

  --amber:       #D97706;
  --amber-soft:  #FEF3C7;
  --amber-bg:    rgba(217,119,6,.08);

  --red:         #DC2626;
  --red-soft:    #FEE2E2;
  --red-bg:      rgba(220,38,38,.08);

  --violet:      #7C3AED;
  --violet-bg:   rgba(124,58,237,.08);

  --r:           14px;
  --r-sm:        10px;
  --r-xs:        7px;
  --font:        'Inter', system-ui, sans-serif;
  --mono:        'JetBrains Mono', monospace;
}

.ht * { box-sizing: border-box; margin: 0; padding: 0; }
.ht {
  font-family: var(--font);
  background: var(--bg);
  color: var(--ink);
  min-height: 100vh;
  font-feature-settings: 'cv11', 'ss01', 'ss03';
  -webkit-font-smoothing: antialiased;
}

@keyframes fadeUp     { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
@keyframes spin       { to { transform: rotate(360deg) } }
@keyframes pulseDot   { 0%,100% { opacity:1; transform:scale(1) } 50% { opacity:.4; transform:scale(.6) } }
@keyframes pulseRing  { 0%   { transform:scale(.85); opacity:.6 } 70% { transform:scale(1.5); opacity:0 } 100% { transform:scale(.85); opacity:0 } }
@keyframes shimmer    { 0% { background-position:-200% 0 } 100% { background-position:200% 0 } }
@keyframes carBob     { 0%,100%{transform:translateX(-50%) translateY(-50%) scale(1)} 50%{transform:translateX(-50%) translateY(-50%) scale(1.08)} }

.fade-up { animation: fadeUp .4s cubic-bezier(.22,1,.36,1) both; }
.spin    { animation: spin 1.1s linear infinite; }

.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--r);
  position: relative;
}
.card-hover { transition: border-color .18s, transform .18s, box-shadow .18s; }
.card-hover:hover {
  border-color: var(--border-mid);
  box-shadow: 0 1px 3px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.06);
}

.live-dot {
  width: 6px; height: 6px; border-radius: 50%;
  flex-shrink: 0; position: relative;
}
.live-dot::after {
  content: '';
  position: absolute; inset: -3px; border-radius: 50%;
  border: 1.5px solid currentColor;
  animation: pulseRing 2s ease-out infinite;
  opacity: 0;
}

.pill {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 10.5px; font-weight: 600; letter-spacing: .02em;
  padding: 3px 9px; border-radius: 6px;
}
.pill-mono { font-family: var(--mono); font-weight: 500; font-size: 10px; letter-spacing: .04em; }

.search-wrap {
  display: flex; align-items: center; gap: 9px;
  background: var(--bg-soft); border: 1px solid var(--border-mid);
  border-radius: var(--r-sm); padding: 0 14px; height: 40px;
  transition: all .18s;
}
.search-wrap:focus-within {
  border-color: var(--ink); background: var(--bg-card);
  box-shadow: 0 0 0 3px rgba(0,0,0,.05);
}
.search-wrap input {
  flex: 1; border: none; outline: none; background: transparent;
  font-family: var(--font); font-size: 13px; color: var(--ink); font-weight: 500;
}
.search-wrap input::placeholder { color: var(--ink-5); font-weight: 400; }

.sel-wrap { position: relative; flex: 1; min-width: 110px; }
.sel-wrap select {
  width: 100%; padding: 8px 28px 8px 12px;
  border-radius: 8px; border: 1px solid var(--border-mid);
  font-size: 11.5px; font-weight: 600; color: var(--ink-2);
  background: var(--bg-card); appearance: none; outline: none;
  cursor: pointer; font-family: var(--font);
  transition: border-color .18s;
}
.sel-wrap select:hover { border-color: var(--border-strong); }
.sel-wrap select:focus { border-color: var(--ink); box-shadow: 0 0 0 3px rgba(0,0,0,.05); }

.action-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 12px; border-radius: 9px;
  border: 1px solid var(--border-mid);
  background: var(--bg-card); font-family: var(--font);
  font-size: 11.5px; font-weight: 600; color: var(--ink-2);
  cursor: pointer; transition: all .15s;
}
.action-btn:hover { border-color: var(--border-strong); background: var(--bg-soft); }
.action-btn.active { background: var(--ink); color: #fff; border-color: var(--ink); }

.chart-bar {
  border-radius: 6px 6px 3px 3px;
  transition: all .4s cubic-bezier(.22,1,.36,1);
}

.ht ::-webkit-scrollbar { width: 4px; height: 4px; }
.ht ::-webkit-scrollbar-track { background: transparent; }
.ht ::-webkit-scrollbar-thumb { background: var(--border-mid); border-radius: 2px; }

/* Mapbox overrides inside ride card */
.rc-map .mapboxgl-ctrl-logo,
.rc-map .mapboxgl-ctrl-attrib { display: none !important; }
`;

/* ─── Helpers ────────────────────────────────────────────────────── */
function timeAgo(ts) {
  if (!ts) return "—";
  const seconds = ts?.seconds ?? Math.floor(ts / 1000);
  const diff    = Math.floor(Date.now() / 1000) - seconds;
  if (diff < 60)   return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}
function shortAddr(addr = "") { return addr.split(",")[0] || addr; }
function tsToMs(ts) {
  if (!ts) return 0;
  if (ts?.seconds) return ts.seconds * 1000;
  if (typeof ts === "number") return ts;
  return 0;
}
function fmtMMSS(s) {
  const a = Math.abs(Math.round(s));
  return `${Math.floor(a / 60)}:${String(a % 60).padStart(2, "0")}`;
}
function initials(name = "") {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";
}

/* ─── Status Configs ─────────────────────────────────────────────── */
const STATUS = {
  searching_driver: { label: "Searching",   accent: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
  driver_assigned:  { label: "Assigned",    accent: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE" },
  driver_arriving:  { label: "Arriving",    accent: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE" },
  arrived:          { label: "Arrived",     accent: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0" },
  in_progress:      { label: "In Progress", accent: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0" },
  completed:        { label: "Completed",   accent: "#52525B", bg: "#F4F4F5", border: "#E4E4E7" },
  cancelled:        { label: "Cancelled",   accent: "#DC2626", bg: "#FEF2F2", border: "#FECACA" },
};
const PAY_STATUS = {
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

/* ─── Mapbox loader ──────────────────────────────────────────────── */
const MAPBOX_TOKEN = 'pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA';
let _mbLoaded = false;
let _mbCallbacks = [];
function loadMapbox(cb) {
  if (_mbLoaded && window.mapboxgl) { cb(); return; }
  _mbCallbacks.push(cb);
  if (document.getElementById('mapbox-css')) {
    if (_mbLoaded) { cb(); } return;
  }
  const link = document.createElement('link');
  link.id = 'mapbox-css'; link.rel = 'stylesheet';
  link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css';
  document.head.appendChild(link);
  const script = document.createElement('script');
  script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js';
  script.onload = () => { _mbLoaded = true; _mbCallbacks.forEach(fn => fn()); _mbCallbacks = []; };
  document.head.appendChild(script);
}

/* ─── Polyline decoder ───────────────────────────────────────────── */
function decodePolyline(encoded) {
  if (!encoded) return [];
  const pts = [];
  let i = 0, lat = 0, lng = 0;
  while (i < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    pts.push([lat / 1e5, lng / 1e5]);
  }
  return pts;
}

/* ─── Card Mapbox Mini-Map ───────────────────────────────────────── */
function CardMap({ ride, status }) {
  const containerRef   = useRef(null);
  const mapRef         = useRef(null);
  const markersRef     = useRef([]);
  const initializedRef = useRef(false);

  const isActive    = ["driver_assigned","driver_arriving","arrived","in_progress"].includes(status);
  const isCompleted = status === "completed";
  const isCancelled = status === "cancelled";

  const routeCoords = useMemo(() => {
    if (!ride.polyline) return [];
    return decodePolyline(ride.polyline).map(p => [p[1], p[0]]);
  }, [ride.polyline]);

  const hasDriver = !!(ride.driverLat && ride.driverLng);

  // Choose map style: dark for active, light-muted for completed/cancelled
  const mapStyle = (isCompleted || isCancelled)
    ? 'mapbox://styles/mapbox/light-v11'
    : 'mapbox://styles/mapbox/dark-v11';

  // Build bounding box from route + pickup + dropoff + driver
  const bounds = useMemo(() => {
    const pts = [];
    if (routeCoords.length) routeCoords.forEach(p => pts.push(p));
    if (ride.pickupLat  && ride.pickupLng)  pts.push([ride.pickupLng,  ride.pickupLat]);
    if (ride.dropoffLat && ride.dropoffLng) pts.push([ride.dropoffLng, ride.dropoffLat]);
    if (hasDriver) pts.push([ride.driverLng, ride.driverLat]);
    if (!pts.length) return null;
    return {
      minLng: Math.min(...pts.map(p => p[0])),
      maxLng: Math.max(...pts.map(p => p[0])),
      minLat: Math.min(...pts.map(p => p[1])),
      maxLat: Math.max(...pts.map(p => p[1])),
    };
  }, [routeCoords, ride.pickupLat, ride.pickupLng, ride.dropoffLat, ride.dropoffLng, ride.driverLat, ride.driverLng]);

  const center = useMemo(() => {
    if (bounds) return [(bounds.minLng + bounds.maxLng) / 2, (bounds.minLat + bounds.maxLat) / 2];
    if (ride.pickupLng && ride.pickupLat) return [ride.pickupLng, ride.pickupLat];
    return [-81.3792, 28.5383];
  }, [bounds]);

  // Init map
  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return;
    loadMapbox(() => {
      if (!containerRef.current || initializedRef.current) return;
      initializedRef.current = true;
      window.mapboxgl.accessToken = MAPBOX_TOKEN;
      mapRef.current = new window.mapboxgl.Map({
        container: containerRef.current,
        style: mapStyle,
        center,
        zoom: 12,
        attributionControl: false,
        interactive: false,
        fadeDuration: 0,
      });
    });
    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; initializedRef.current = false; }
    };
  }, []);

  // Route + markers
  useEffect(() => {
    if (!mapRef.current) return;
    const attach = () => {
      if (!mapRef.current?.isStyleLoaded()) { setTimeout(attach, 80); return; }

      // ── Route line ──
      if (routeCoords.length > 1) {
        const geo = { type: 'Feature', geometry: { type: 'LineString', coordinates: routeCoords } };
        const routeColor  = isCancelled ? '#DC2626' : isCompleted ? '#94A3B8' : '#22C55E';
        const glowOpacity = (isCancelled || isCompleted) ? 0.06 : 0.14;

        if (mapRef.current.getSource('route')) {
          mapRef.current.getSource('route').setData(geo);
        } else {
          mapRef.current.addSource('route', { type: 'geojson', data: geo });
          mapRef.current.addLayer({ id: 'route-glow', type: 'line', source: 'route',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': '#ffffff', 'line-width': 12, 'line-opacity': glowOpacity, 'line-blur': 6 } });
          mapRef.current.addLayer({ id: 'route-main', type: 'line', source: 'route',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: { 'line-color': routeColor, 'line-width': 3, 'line-opacity': isCancelled ? 0.55 : 1 } });
          // Subtle dash overlay
          if (!isCancelled && !isCompleted) {
            mapRef.current.addLayer({ id: 'route-dash', type: 'line', source: 'route',
              layout: { 'line-cap': 'round', 'line-join': 'round' },
              paint: { 'line-color': '#fff', 'line-width': 1.2, 'line-opacity': 0.3, 'line-dasharray': [0, 5] } });
          }
        }
      }

      // ── Clear old markers ──
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      // ── Pickup pin ──
      if (ride.pickupLat && ride.pickupLng) {
        const el = document.createElement('div');
        el.style.cssText = 'position:relative;width:22px;height:22px;display:flex;align-items:center;justify-content:center;';
        el.innerHTML = `
          <div style="width:11px;height:11px;border-radius:50%;background:#22C55E;border:2.5px solid #fff;box-shadow:0 2px 8px rgba(34,197,94,.6);z-index:1;position:relative;"></div>
          ${isActive ? `<div style="position:absolute;inset:0;border-radius:50%;border:1.5px solid rgba(34,197,94,.4);animation:pulseRing 2.2s ease-out infinite;"></div>` : ''}
        `;
        markersRef.current.push(
          new window.mapboxgl.Marker({ element: el, anchor: 'center' })
            .setLngLat([ride.pickupLng, ride.pickupLat]).addTo(mapRef.current)
        );
      }

      // ── Dropoff pin ──
      if (ride.dropoffLat && ride.dropoffLng) {
        const el = document.createElement('div');
        el.innerHTML = `
          <div style="position:relative;">
            <svg width="20" height="26" viewBox="0 0 20 26" fill="none">
              <path d="M10 0C4.48 0 0 4.48 0 10c0 7.5 10 16 10 16s10-8.5 10-16C20 4.48 15.52 0 10 0z" fill="${isCancelled ? '#DC2626' : isCompleted ? '#71717A' : '#111827'}"/>
              <circle cx="10" cy="10" r="4" fill="#fff"/>
              ${!isCompleted && !isCancelled ? '<circle cx="10" cy="10" r="1.8" fill="#111827"/>' : ''}
            </svg>
          </div>
        `;
        el.style.cssText = 'filter:drop-shadow(0 3px 8px rgba(0,0,0,0.45));';
        markersRef.current.push(
          new window.mapboxgl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([ride.dropoffLng, ride.dropoffLat]).addTo(mapRef.current)
        );
      }

      // ── Driver / car dot ──
      if (hasDriver && isActive) {
        const el = document.createElement('div');
        el.style.cssText = 'position:relative;width:16px;height:16px;';
        el.innerHTML = `
          <div style="width:16px;height:16px;border-radius:50%;background:#3B82F6;border:2.5px solid #fff;box-shadow:0 0 14px rgba(59,130,246,.8);animation:carBob 2.2s ease-in-out infinite;"></div>
          <div style="position:absolute;inset:-5px;border-radius:50%;border:1.5px solid rgba(59,130,246,.35);animation:pulseRing 2s ease-out infinite;"></div>
        `;
        markersRef.current.push(
          new window.mapboxgl.Marker({ element: el, anchor: 'center' })
            .setLngLat([ride.driverLng, ride.driverLat]).addTo(mapRef.current)
        );
      }

      // ── Fit bounds ──
      if (bounds) {
        mapRef.current.fitBounds(
          [[bounds.minLng, bounds.minLat], [bounds.maxLng, bounds.maxLat]],
          { padding: 32, maxZoom: 15, duration: 0 }
        );
      }
    };
    if (mapRef.current.loaded()) attach();
    else mapRef.current.once('load', attach);
  }, [routeCoords, bounds, ride.pickupLat, ride.pickupLng, ride.dropoffLat, ride.dropoffLng, hasDriver, isActive, isCancelled, isCompleted]);

  return (
    <div
      ref={containerRef}
      className="rc-map"
      style={{ width: '100%', height: '100%' }}
    />
  );
}

/* ─── Progress Bars ──────────────────────────────────────────────── */
function ProgressBar({ pct = 0, color = "#16A34A", label, height = 3 }) {
  return (
    <div style={{ height, background: "rgba(0,0,0,.05)", position: "relative", overflow: "visible" }}>
      <div style={{
        position: "absolute", top: 0, left: 0, bottom: 0,
        width: `${Math.min(Math.max(pct, 0), 100)}%`,
        background: color,
        transition: "width .3s ease",
        boxShadow: `0 0 8px ${color}55`,
      }} />
      {label && (
        <div style={{
          position: "absolute", top: -1,
          left: `${Math.min(Math.max(pct, 6), 88)}%`,
          transform: "translate(-50%, -100%)",
          background: color, color: "#fff",
          fontSize: 9, fontWeight: 700,
          padding: "3px 7px", borderRadius: 5,
          whiteSpace: "nowrap", fontFamily: "var(--mono)",
          letterSpacing: ".02em", pointerEvents: "none",
          zIndex: 10, boxShadow: `0 2px 8px ${color}55`,
        }}>{label}</div>
      )}
    </div>
  );
}

function SearchTimerBar({ expiresAt, emailDispatchAt, createdAt }) {
  const [pct, setPct]   = useState(100);
  const [left, setLeft] = useState(null);
  const raf             = useRef(null);
  useEffect(() => {
    const exMs   = tsToMs(expiresAt); if (!exMs) return;
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
  }, [expiresAt, emailDispatchAt, createdAt]);
  const c = left === null ? "#A1A1AA" : left > 300 ? "#D97706" : left > 60 ? "#EA580C" : "#DC2626";
  return <ProgressBar pct={pct} color={c} label={left != null ? (left > 0 ? fmtMMSS(left) : "EXPIRED") : "…"} />;
}

function AssignedBar({ acceptedAt, etaMin }) {
  const [elapsed, setElapsed] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const ms = tsToMs(acceptedAt); if (!ms) return;
    const tick = () => { setElapsed(Math.floor((Date.now() - ms) / 1000)); raf.current = requestAnimationFrame(tick); };
    raf.current = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf.current);
  }, [acceptedAt]);
  const total  = (etaMin ?? 0) * 60;
  const pct    = total > 0 ? Math.min((elapsed / total) * 100, 100) : 0;
  const isLate = total > 0 && elapsed > total;
  const c      = isLate ? "#DC2626" : pct > 80 ? "#EA580C" : "#2563EB";
  return <ProgressBar pct={pct} color={c} label={isLate ? `+${fmtMMSS(elapsed - total)}` : etaMin != null ? `${etaMin}m ETA` : `${fmtMMSS(elapsed)}`} />;
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
  const c     = pct > 90 ? "#DC2626" : pct > 70 ? "#D97706" : "#16A34A";
  return <ProgressBar pct={pct} color={c} label={total > 0 ? (elapsed > total ? `+${fmtMMSS(elapsed - total)}` : `${fmtMMSS(rem)} left`) : `${fmtMMSS(elapsed)}`} />;
}

/* ─── Status Bar selector ────────────────────────────────────────── */
function StatusBar({ ride }) {
  switch (ride.status) {
    case "searching_driver": return <SearchTimerBar expiresAt={ride.expiresAt} emailDispatchAt={ride.emailDispatchAt} createdAt={ride.createdAt} />;
    case "driver_assigned":
    case "driver_arriving":  return <AssignedBar acceptedAt={ride.acceptedAt} etaMin={ride.driverInfo?.etaMin} />;
    case "arrived":          return <ProgressBar pct={100} color="#16A34A" label="ARRIVED" />;
    case "in_progress":      return <TripBar startedAt={ride.startedAt} tripDurationMin={ride.tripDurationMin} />;
    case "completed":        return <div style={{ height: 3, background: "var(--bg-soft)" }} />;
    case "cancelled":        return <div style={{ height: 3, background: "linear-gradient(90deg,#DC2626,#FECACA)" }} />;
    default:                 return <div style={{ height: 3, background: "var(--border)" }} />;
  }
}

/* ─── Ride Card ──────────────────────────────────────────────────── */
function RideCard({ ride, index }) {
  const riderLabel  = ride.riderName  ?? `Rider ···${ride.uid?.slice(-4) ?? "?"}`;
  const driverLabel = ride.driverName ?? (ride.driverUid ? `Driver ···${ride.driverUid.slice(-4)}` : null);
  const status      = ride.status ?? "unknown";

  const s  = STATUS[status]               ?? { label: status,         accent: "#71717A", bg: "#F4F4F5", border: "#E4E4E7" };
  const pm = PAY_STATUS[ride.paymentStatus] ?? { bg: "#F4F4F5", color: "#71717A", label: ride.paymentStatus ?? "—" };
  const po = PAYOUT[ride.payoutStatus]      ?? { bg: "#F4F4F5", color: "#71717A", label: ride.payoutStatus  ?? "—" };

  const isActive    = ["driver_assigned","driver_arriving","arrived","in_progress"].includes(status);
  const isCompleted = status === "completed";
  const isCancelled = status === "cancelled";
  const isSearching = status === "searching_driver";

  const hasMap = !!(ride.pickupLat || ride.dropoffLat || ride.polyline);

  /* ── ETA chip ── */
  const etaChip = useMemo(() => {
    if (isActive && ride.driverInfo?.etaMin != null)
      return `${ride.driverInfo.etaMin}m to pickup`;
    if (status === "in_progress" && ride.dropoffEtaMin != null)
      return `${ride.dropoffEtaMin}m to dropoff`;
    return null;
  }, [status, ride.driverInfo?.etaMin, ride.dropoffEtaMin, isActive]);

  const accentLine = isCancelled ? "#DC2626" : isCompleted ? "#E4E4E7" : isSearching ? "#D97706" : "#16A34A";

  return (
    <div
      className="card card-hover fade-up"
      style={{
        animationDelay: `${200 + index * 50}ms`,
        padding: 0,
        overflow: "hidden",
      }}
    >
      {/* ── Top accent stripe ── */}
      <div style={{ height: 2.5, background: accentLine, opacity: isCancelled ? 0.6 : 1 }} />

      {/* ── Body ── */}
      <div style={{ display: "flex", minHeight: 0 }}>

        {/* ──────── LEFT COLUMN ──────── */}
        <div style={{ flex: 1, minWidth: 0, padding: "14px 16px 14px 16px", display: "flex", flexDirection: "column", gap: 11 }}>

          {/* Header row: avatar + name + status + fare */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              {/* Avatar */}
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: isCompleted
                  ? "linear-gradient(135deg,#3F3F46,#27272A)"
                  : isCancelled
                  ? "linear-gradient(135deg,#DC2626,#991B1B)"
                  : "linear-gradient(135deg,#18181B,#09090B)",
                border: "1px solid rgba(0,0,0,.1)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700, color: "#fff",
                boxShadow: "0 2px 8px rgba(0,0,0,.08)",
                letterSpacing: ".02em",
              }}>
                {initials(riderLabel)}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 700, color: "var(--ink)",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  letterSpacing: "-.01em", marginBottom: 2,
                }}>
                  {riderLabel}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  {driverLabel
                    ? <><Car size={9} color="var(--ink-5)" /><span style={{ fontSize: 10.5, color: "var(--ink-4)", fontWeight: 500 }}>{driverLabel}</span></>
                    : <span style={{ fontSize: 10.5, color: "#D97706", fontWeight: 600, fontStyle: "italic" }}>No driver</span>
                  }
                </div>
              </div>
            </div>

            {/* Status + fare */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
              <div className="pill" style={{ background: s.bg, color: s.accent, border: `1px solid ${s.border}` }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.accent, boxShadow: `0 0 5px ${s.accent}88` }} />
                {s.label}
              </div>
              <div style={{
                fontSize: 20, color: "var(--ink)", fontWeight: 800,
                letterSpacing: "-.03em", lineHeight: 1,
                fontFeatureSettings: "'tnum'",
                opacity: isCancelled ? 0.4 : 1,
              }}>
                {ride.fareTotal != null ? `$${ride.fareTotal.toFixed(2)}` : "—"}
              </div>
            </div>
          </div>

          {/* ── Route strip ── */}
          <div style={{
            background: "var(--bg-subtle)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "10px 12px",
            position: "relative",
          }}>
            {/* Connector line */}
            <div style={{ position: "absolute", left: 19, top: 18, bottom: 18, width: 1.5, background: "linear-gradient(180deg,#16A34A 0%,rgba(0,0,0,.1) 100%)" }} />

            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {[
                { dot: "#22C55E", lbl: "Pickup",  addr: shortAddr(ride.pickup),  city: ride.pickupCity  },
                { dot: "#111827", lbl: "Dropoff", addr: shortAddr(ride.dropoff), city: ride.dropoffCity },
              ].map(({ dot, lbl, addr, city }) => (
                <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: dot, flexShrink: 0,
                    border: "2px solid var(--bg-card)", zIndex: 1,
                    boxShadow: `0 0 0 1.5px ${dot}`,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 9, color: "var(--ink-5)", letterSpacing: ".05em", textTransform: "uppercase", fontWeight: 600, marginBottom: 1 }}>{lbl}</div>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {addr || "—"}
                      {city && <span style={{ color: "var(--ink-5)", fontWeight: 400 }}> · {city}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Bottom meta row ── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            {/* Left chips */}
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {ride.rideLabel && (
                <span className="pill" style={{ background: "var(--bg-soft)", color: "var(--ink-3)", border: "1px solid var(--border)", textTransform: "capitalize" }}>
                  {ride.rideLabel}
                </span>
              )}
              {ride.tripDistanceMiles != null && (
                <span className="pill" style={{ background: "var(--bg-soft)", color: "var(--ink-3)", border: "1px solid var(--border)" }}>
                  {ride.tripDistanceMiles} mi
                </span>
              )}
              {ride.tripDurationMin != null && (
                <span className="pill" style={{ background: "var(--bg-soft)", color: "var(--ink-3)", border: "1px solid var(--border)" }}>
                  ~{ride.tripDurationMin}m
                </span>
              )}
              {etaChip && (
                <span className="pill" style={{ background: "var(--green-bg)", color: "var(--green)", border: "1px solid rgba(22,163,74,.15)" }}>
                  <Clock size={8} /> {etaChip}
                </span>
              )}
            </div>
            {/* Time ago */}
            <span style={{ fontSize: 10.5, color: "var(--ink-5)", fontWeight: 500, whiteSpace: "nowrap" }}>
              {timeAgo(ride.createdAt)} ago
            </span>
          </div>

          {/* ── Searching pill row (if searching) ── */}
          {isSearching && (
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              <span className="pill" style={{ background: "#FEF3C7", color: "#92400E" }}>
                <Users size={8} /> {(ride.candidateDriverUids ?? []).length} candidates
              </span>
              <span className="pill" style={{ background: Object.keys(ride.emailSentToDrivers ?? {}).length > 0 ? "#DCFCE7" : "var(--bg-soft)", color: Object.keys(ride.emailSentToDrivers ?? {}).length > 0 ? "#166534" : "var(--ink-4)" }}>
                <Mail size={8} /> {Object.keys(ride.emailSentToDrivers ?? {}).length} emailed
              </span>
            </div>
          )}

          {/* ── Footer: payment info ── */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTop: "1px solid var(--border)", flexWrap: "wrap", gap: 6 }}>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              <span className="pill" style={{
                background: ride.paymentMethod === "cashapp" ? "#F0FDF4" : "#EFF6FF",
                color:      ride.paymentMethod === "cashapp" ? "#16A34A" : "#2563EB",
              }}>
                {ride.paymentMethod === "cashapp" ? "Cash App" : ride.paymentMethod === "card" ? "Card" : (ride.paymentMethod ?? "—")}
              </span>
              <span className="pill" style={{ background: pm.bg, color: pm.color }}>{pm.label}</span>
              <span className="pill" style={{ background: po.bg, color: po.color }}>{po.label}</span>
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-4)", fontWeight: 500, fontFeatureSettings: "'tnum'" }}>
              <span style={{ color: "var(--green)", fontWeight: 700 }}>${ride.driverPayout?.toFixed(2) ?? "—"}</span>
              <span> drv · </span>
              <span style={{ color: "var(--blue)", fontWeight: 700 }}>${ride.platformFee?.toFixed(2) ?? "—"}</span>
              <span> fee</span>
            </div>
          </div>
        </div>

        {/* ──────── RIGHT COLUMN: MAP ──────── */}
        {hasMap && (
          <div style={{
            width: 148,
            flexShrink: 0,
            position: "relative",
            borderLeft: "1px solid var(--border)",
            overflow: "hidden",
          }}>
            <CardMap ride={ride} status={status} />

            {/* Gradient fade on left edge so it blends with the card */}
            <div style={{
              position: "absolute",
              top: 0, left: 0, bottom: 0,
              width: 18,
              background: "linear-gradient(to right, rgba(255,255,255,1), rgba(255,255,255,0))",
              pointerEvents: "none",
              zIndex: 10,
            }} />

            {/* Status overlay badge */}
            {isActive && (
              <div style={{
                position: "absolute",
                top: 8, right: 8, zIndex: 20,
                display: "flex", alignItems: "center", gap: 4,
                background: "rgba(9,9,11,0.80)", backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,.1)",
                borderRadius: 20, padding: "3px 8px",
              }}>
                <div className="live-dot" style={{ background: "#22C55E", color: "#22C55E", width: 5, height: 5 }} />
                <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,.85)", letterSpacing: ".06em", textTransform: "uppercase" }}>Live</span>
              </div>
            )}

            {/* Completed stamp */}
            {isCompleted && (
              <div style={{
                position: "absolute",
                top: 8, right: 8, zIndex: 20,
                background: "rgba(255,255,255,0.88)", backdropFilter: "blur(8px)",
                border: "1px solid rgba(0,0,0,.08)",
                borderRadius: 20, padding: "3px 8px",
              }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: "#52525B", letterSpacing: ".06em", textTransform: "uppercase" }}>Done</span>
              </div>
            )}

            {/* Cancelled stamp */}
            {isCancelled && (
              <div style={{
                position: "absolute",
                top: 8, right: 8, zIndex: 20,
                background: "rgba(254,242,242,0.92)", backdropFilter: "blur(8px)",
                border: "1px solid rgba(220,38,38,.2)",
                borderRadius: 20, padding: "3px 8px",
              }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: "#DC2626", letterSpacing: ".06em", textTransform: "uppercase" }}>Cancelled</span>
              </div>
            )}

            {/* Distance chip at bottom */}
            {ride.tripDistanceMiles != null && (
              <div style={{
                position: "absolute",
                bottom: 8, left: "50%", transform: "translateX(-50%)",
                zIndex: 20,
                background: "rgba(9,9,11,0.75)", backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,.1)",
                borderRadius: 20, padding: "3px 9px",
                whiteSpace: "nowrap",
              }}>
                <span style={{
                  fontSize: 9.5, fontWeight: 600,
                  fontFamily: "var(--mono)",
                  color: "rgba(255,255,255,.85)",
                }}>
                  {ride.tripDistanceMiles} mi
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Progress bar footer ── */}
      <StatusBar ride={ride} />
    </div>
  );
}

/* ─── Weekly Summary ─────────────────────────────────────────────── */
function WeekChart({ allRides = [] }) {
  const now    = new Date();
  const sunday = new Date(now);
  sunday.setHours(0,0,0,0);
  sunday.setDate(now.getDate() - now.getDay());

  const buckets = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday); d.setDate(sunday.getDate() + i);
    return { label: DAYS[d.getDay()], dateStr: d.toDateString(),
      isToday: d.toDateString() === now.toDateString(),
      isFuture: d > now, rides: 0, fare: 0, platform: 0, payout: 0 };
  });

  allRides.filter(r => r.status === "completed").forEach(r => {
    const ms = tsToMs(r.completedAt ?? r.updatedAt ?? r.createdAt);
    if (!ms) return;
    const d = new Date(ms); d.setHours(0,0,0,0);
    const idx = buckets.findIndex(b => b.dateStr === d.toDateString());
    if (idx === -1) return;
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
    <div className="card fade-up" style={{ marginBottom: 12, animationDelay: "60ms", overflow: "hidden" }}>
      <div style={{ padding: "20px 22px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <BarChart3 size={14} color="var(--ink-3)" />
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", letterSpacing: "-.01em" }}>This Week</span>
            <span className="pill" style={{ background: "var(--bg-soft)", color: "var(--ink-3)" }}>{totalRides} rides</span>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--ink-4)", fontWeight: 500 }}>Sunday – Saturday performance</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--ink)", letterSpacing: "-.03em", lineHeight: 1, fontFeatureSettings: "'tnum'" }}>${totalFare.toFixed(2)}</div>
          <div style={{ fontSize: 10.5, color: "var(--ink-4)", fontWeight: 500, marginTop: 4, letterSpacing: ".02em" }}>TOTAL FARE</div>
        </div>
      </div>
      <div style={{ padding: "22px 22px 6px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 92 }}>
          {buckets.map((b, i) => {
            const pct = b.isFuture ? 0 : Math.max((b.fare / maxFare) * 100, b.rides > 0 ? 8 : 0);
            const isH = hov === i;
            return (
              <div key={b.label} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}
                style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, cursor: "default" }}>
                {!b.isFuture && b.rides > 0 && (
                  <div className="pill-mono" style={{ fontSize: 9, color: b.isToday ? "var(--green)" : "var(--ink-4)", fontWeight: 600 }}>${b.fare.toFixed(0)}</div>
                )}
                {(b.isFuture || b.rides === 0) && <div style={{ flex: 1 }} />}
                <div className="chart-bar" style={{
                  width: "100%",
                  height: b.isFuture ? 4 : `${Math.max(pct, 6)}%`,
                  minHeight: 4,
                  background: b.isFuture ? "var(--bg-soft)"
                    : b.isToday ? (isH ? "linear-gradient(180deg,#22C55E,#16A34A 70%,#15803D)" : "linear-gradient(180deg,#22C55E,#16A34A)")
                    : isH ? "var(--ink-2)" : "var(--ink-5)",
                  boxShadow: b.isToday && !b.isFuture ? "0 4px 14px rgba(22,163,74,.25)" : "none",
                  opacity: !b.isToday && !isH && !b.isFuture ? .5 : 1,
                }} />
                <div style={{ fontSize: 10, letterSpacing: ".02em", color: b.isToday ? "var(--green)" : "var(--ink-4)", fontWeight: b.isToday ? 700 : 500 }}>{b.label}</div>
              </div>
            );
          })}
        </div>
      </div>
      {h && !h.isFuture && (
        <div style={{ margin: "0 22px 18px", padding: "12px 14px", background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 10, display: "flex", gap: 24, flexWrap: "wrap" }}>
          {[
            { label: h.label,     val: `${h.rides} ride${h.rides !== 1 ? "s" : ""}`, color: "var(--ink)"  },
            { label: "Fare",      val: `$${h.fare.toFixed(2)}`,                       color: "var(--ink)"  },
            { label: "Platform",  val: `$${h.platform.toFixed(2)}`,                  color: "var(--blue)" },
            { label: "Driver",    val: `$${h.payout.toFixed(2)}`,                    color: "var(--green)" },
          ].map(it => (
            <div key={it.label}>
              <div style={{ fontSize: 9.5, color: "var(--ink-4)", letterSpacing: ".02em", marginBottom: 3, fontWeight: 600, textTransform: "uppercase" }}>{it.label}</div>
              <div style={{ fontSize: 16, color: it.color, fontWeight: 700, fontFeatureSettings: "'tnum'", letterSpacing: "-.02em" }}>{it.val}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", borderTop: "1px solid var(--border)" }}>
        {[
          { label: "Total Fare",    val: `$${totalFare.toFixed(2)}`,     color: "var(--ink)"   },
          { label: "Platform Fee",  val: `$${totalPlatform.toFixed(2)}`, color: "var(--blue)"  },
          { label: "Driver Payout", val: `$${totalPayout.toFixed(2)}`,   color: "var(--green)" },
        ].map((it, i) => (
          <div key={it.label} style={{ flex: 1, textAlign: "center", padding: "16px 8px", borderRight: i < 2 ? "1px solid var(--border)" : "none" }}>
            <div style={{ fontSize: 9.5, color: "var(--ink-4)", letterSpacing: ".02em", marginBottom: 5, fontWeight: 600, textTransform: "uppercase" }}>{it.label}</div>
            <div style={{ fontSize: 18, color: it.color, fontWeight: 800, letterSpacing: "-.02em", fontFeatureSettings: "'tnum'" }}>{it.val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Filter Panel ───────────────────────────────────────────────── */
function FilterPanel({ filters, onChange, onClear, count }) {
  return (
    <div className="fade-up" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 14, marginBottom: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="search-wrap">
        <Search size={13} color="var(--ink-5)" />
        <input value={filters.search} onChange={e => onChange("search", e.target.value)} placeholder="Search address, city, zip…" />
        {filters.search && (
          <button onClick={() => onChange("search", "")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-4)", display: "flex", padding: 0 }}>
            <X size={13} />
          </button>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[
          { key: "status",        opts: [["","All statuses"],["searching_driver","Searching"],["driver_assigned","Assigned"],["arrived","Arrived"],["in_progress","In Progress"],["completed","Completed"],["cancelled","Cancelled"]] },
          { key: "paymentMethod", opts: [["","All payments"],["card","Card"],["cashapp","Cash App"]] },
          { key: "paymentStatus", opts: [["","Pay status"],["succeeded","Paid"],["pending","Pending"],["failed","Failed"]] },
          { key: "payoutStatus",  opts: [["","Payout status"],["processing","Processing"],["pending","Pending"],["paid","Paid"],["failed","Failed"]] },
        ].map(({ key, opts }) => (
          <div className="sel-wrap" key={key}>
            <select value={filters[key]} onChange={e => onChange(key, e.target.value)}>
              {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <ChevronDown size={11} style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", color: "var(--ink-4)", pointerEvents: "none" }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4 }}>
        <span style={{ fontSize: 11, color: "var(--ink-4)", fontWeight: 500 }}>{count} ride{count !== 1 ? "s" : ""} matching</span>
        <button onClick={onClear} style={{ fontSize: 11, fontWeight: 600, color: "var(--red)", background: "none", border: "none", cursor: "pointer" }}>Clear all</button>
      </div>
    </div>
  );
}

/* ─── HomeTab ────────────────────────────────────────────────────── */
const DEFAULT_FILTERS = { search: "", status: "", paymentMethod: "", paymentStatus: "", payoutStatus: "" };

export function HomeTab({
  liveRides = [], allRides = [], allApprovals = [], totalAccounts = 0,
  uatobdrivers = [], activeRides = [], searchingRides = [],
  totalRides = 0, activeDrivers = [], revenue = 0, onToast,
}) {
  const [refreshing,  setRefreshing]  = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters,     setFilters]     = useState(DEFAULT_FILTERS);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); onToast?.("Data refreshed"); }, 1100);
  };
  const onChange    = (k, v) => setFilters(p => ({ ...p, [k]: v }));
  const onClear     = () => setFilters(DEFAULT_FILTERS);
  const activeCount = Object.values(filters).filter(Boolean).length;

  const filtered = useMemo(() => liveRides.filter(ride => {
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const s = [ride.pickup, ride.dropoff, ride.pickupCity, ride.dropoffCity, ride.pickupZip, ride.dropoffZip].map(v => (v ?? "").toLowerCase()).join(" ");
      if (!s.includes(q)) return false;
    }
    if (filters.status        && ride.status        !== filters.status)        return false;
    if (filters.paymentMethod && ride.paymentMethod !== filters.paymentMethod) return false;
    if (filters.paymentStatus && ride.paymentStatus !== filters.paymentStatus) return false;
    if (filters.payoutStatus  && ride.payoutStatus  !== filters.payoutStatus)  return false;
    return true;
  }), [liveRides, filters]);

  const statRows = [
    { label: "Total Rides",    val: totalRides ?? liveRides.length,                   accent: "#2563EB", Icon: Activity,   delay: 0   },
    { label: "Active Drivers", val: activeDrivers.length,                             accent: "#16A34A", Icon: Car,        delay: 50  },
    { label: "Revenue Today",  val: revenue != null ? `$${revenue.toFixed(2)}` : "—", accent: "#D97706", Icon: DollarSign, delay: 100 },
    { label: "Pending Apps",   val: allApprovals.length,                              accent: "#DC2626", Icon: Shield,     delay: 150 },
  ];

  return (
    <>
      <style>{CSS}</style>
      <div className="ht" style={{ padding: "0 14px 32px" }}>

        {/* ── KPI strip ── */}
        <div className="card fade-up" style={{ padding: "12px 14px", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ display: "flex", gap: 0, overflowX: "auto", flex: 1 }}>
              {[
                { val: totalAccounts,         sub: "Accounts",  dot: "#16A34A" },
                { val: uatobdrivers.length,   sub: "Drivers",   dot: "#2563EB" },
                { val: activeRides.length,    sub: "Active",    dot: "#16A34A" },
                { val: searchingRides.length, sub: "Searching", dot: "#D97706" },
              ].map(({ val, sub, dot }, i) => (
                <div key={sub} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "4px 14px",
                  borderRight: i < 3 ? "1px solid var(--border)" : "none",
                  flexShrink: 0,
                }}>
                  <div className="live-dot" style={{ background: dot, color: dot }} />
                  <span style={{ fontSize: 17, fontWeight: 800, color: "var(--ink)", letterSpacing: "-.02em", fontFeatureSettings: "'tnum'" }}>{val}</span>
                  <span style={{ fontSize: 11, color: "var(--ink-4)", fontWeight: 500 }}>{sub}</span>
                </div>
              ))}
            </div>
            <button onClick={handleRefresh} style={{
              width: 34, height: 34, borderRadius: 9,
              border: "1px solid var(--border-mid)", background: "var(--bg-card)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "var(--ink-3)", flexShrink: 0, transition: "all .15s",
            }}>
              <RefreshCw size={13} className={refreshing ? "spin" : ""} />
            </button>
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
          {statRows.map(({ label, val, accent, Icon, delay }) => (
            <div key={label} className="card card-hover fade-up" style={{ padding: "16px", animationDelay: `${delay}ms`, overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: accent, opacity: .8 }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: `${accent}12`, border: `1px solid ${accent}25`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={14} color={accent} strokeWidth={2.2} />
                </div>
                <ArrowUpRight size={11} color="var(--ink-5)" />
              </div>
              <div style={{ fontSize: 24, color: "var(--ink)", fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1, fontFeatureSettings: "'tnum'", marginBottom: 5 }}>{val}</div>
              <div style={{ fontSize: 11, color: "var(--ink-4)", fontWeight: 500 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── Weekly chart ── */}
        <WeekChart allRides={allRides.length > 0 ? allRides : liveRides} />

        {/* ── Rides header ── */}
        <div className="fade-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, animationDelay: "180ms" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", letterSpacing: "-.02em" }}>Live Rides</div>
              {liveRides.length > 0 && (
                <div style={{ fontSize: 11, color: "var(--ink-4)", fontWeight: 500, marginTop: 1 }}>
                  Showing {filtered.length} of {liveRides.length}
                </div>
              )}
            </div>
            <div className="live-dot" style={{ background: "#16A34A", color: "#16A34A", width: 7, height: 7 }} />
          </div>
          <button onClick={() => setShowFilters(p => !p)} className={`action-btn ${showFilters || activeCount > 0 ? "active" : ""}`}>
            <Filter size={11} />
            Filter
            {activeCount > 0 && (
              <span style={{ width: 17, height: 17, borderRadius: "50%", background: "#fff", color: "var(--ink)", fontSize: 9.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {activeCount}
              </span>
            )}
          </button>
        </div>

        {showFilters && <FilterPanel filters={filters} onChange={onChange} onClear={onClear} count={filtered.length} />}

        {/* ── Ride list ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.length === 0 && (
            <div className="card" style={{ textAlign: "center", padding: "48px 20px" }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--bg-soft)", margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Sparkles size={20} color="var(--ink-5)" />
              </div>
              <div style={{ fontSize: 14, color: "var(--ink)", fontWeight: 700, marginBottom: 4 }}>No rides found</div>
              <div style={{ fontSize: 12, color: "var(--ink-4)", fontWeight: 500 }}>
                {activeCount > 0 ? "Try clearing some filters" : "Waiting for new rides…"}
              </div>
            </div>
          )}
          {filtered.map((ride, i) => <RideCard key={ride.id} ride={ride} index={i} />)}
        </div>
      </div>
    </>
  );
}
