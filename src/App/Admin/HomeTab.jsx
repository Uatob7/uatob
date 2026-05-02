import { useState, useMemo, useEffect, useRef, useCallback } from "react";

/* ─── Real Ride Data (seeded from Firestore screenshots) ─────────── */
const REAL_RIDES = [
  {
    id: "8mWRKSw2DroFWYizmM3k",
    status: "completed",
    riderName: "Rider ···aiEA",
    driverName: "Marcus",
    driverUid: "fR1aGa2AHod1aVuyaiEA95RqDYp1",
    driverPhone: "+14075550192",
    pickup: "2382 Locke Ave, Orlando, FL 32818, USA",
    dropoff: "3024 North Powers Drive, Orlando, FL, USA",
    pickupCity: "Orlando", dropoffCity: "Orlando",
    pickupZip: "32818", dropoffZip: "32818",
    pickupLat: 28.5730545, pickupLng: -81.4696329,
    dropoffLat: 28.5819909, dropoffLng: -81.4694363,
    driverLat: 28.5730736, driverLng: -81.4696329,
    riderLat: 28.5730797, riderLng: -81.4696158,
    fareTotal: 6.99, driverPayout: 5.24, platformFee: 1.75,
    paymentMethod: "cashapp", paymentStatus: "succeeded", payoutStatus: "processing",
    rideLabel: "Standard", rideType: "standard",
    tripDistanceMiles: 0.93, tripDurationMin: 5,
    driverEtaMin: 1, driverDistanceMiles: 0,
    riderDropoffDistanceMiles: 0.9, riderDropoffEtaMin: 5,
    polyline: "wtkmDp~fpNxACLI?a@GeF@s@{\\F_C?{@?qXHBjBFJIdEBTDNRT",
    createdAt: { seconds: Math.floor(new Date("2026-05-02T14:39:20Z").getTime()/1000) },
    acceptedAt: { seconds: Math.floor(new Date("2026-05-02T14:40:05Z").getTime()/1000) },
    arrivedAt: { seconds: Math.floor(new Date("2026-05-02T14:40:45Z").getTime()/1000) },
    startedAt: { seconds: Math.floor(new Date("2026-05-02T14:41:02Z").getTime()/1000) },
    completedAt: { seconds: Math.floor(new Date("2026-05-02T14:41:19Z").getTime()/1000) },
    updatedAt: { seconds: Math.floor(new Date("2026-05-02T14:41:19Z").getTime()/1000) },
    expiresAt: { seconds: Math.floor(new Date("2026-05-02T14:46:20Z").getTime()/1000) },
    adminNotified: true,
    tripProgress: 0.032258064516129115,
    searchExtended: 4,
    emailSentToDrivers: { "fR1aGa2AHod1aVuyaiEA95RqDYp1": true },
    pushSentToDrivers:  { "fR1aGa2AHod1aVuyaiEA95RqDYp1": true },
  },
  {
    id: "JHO90nQbNjxupu0ql86Z",
    status: "in_progress",
    riderName: "Jordan T.",
    driverName: "Daria",
    driverUid: "driverUID002",
    driverPhone: "+14075550183",
    pickup: "1801 Princeton St, Orlando, FL 32803",
    dropoff: "8300 International Dr, Orlando, FL 32819",
    pickupCity: "Orlando", dropoffCity: "Orlando",
    pickupZip: "32803", dropoffZip: "32819",
    pickupLat: 28.5572, pickupLng: -81.3588,
    dropoffLat: 28.4273, dropoffLng: -81.4664,
    driverLat: 28.5480, driverLng: -81.3710,
    riderLat: 28.5572, riderLng: -81.3588,
    fareTotal: 14.50, driverPayout: 10.88, platformFee: 3.62,
    paymentMethod: "card", paymentStatus: "succeeded", payoutStatus: "pending",
    rideLabel: "Standard", rideType: "standard",
    tripDistanceMiles: 9.2, tripDurationMin: 18,
    driverEtaMin: 0, dropoffEtaMin: 11,
    polyline: null,
    createdAt: { seconds: Math.floor(Date.now()/1000) - 600 },
    acceptedAt: { seconds: Math.floor(Date.now()/1000) - 540 },
    startedAt:  { seconds: Math.floor(Date.now()/1000) - 420 },
    updatedAt:  { seconds: Math.floor(Date.now()/1000) - 60 },
    tripProgress: 0.38,
  },
  {
    id: "UIcvbeFIZl8xtT5ERcxv",
    status: "searching_driver",
    riderName: "Priya S.",
    driverName: null,
    driverUid: null,
    driverPhone: null,
    pickup: "5445 Millenia Blvd, Orlando, FL 32839",
    dropoff: "Orlando International Airport",
    pickupCity: "Orlando", dropoffCity: "Orlando",
    pickupZip: "32839", dropoffZip: "32827",
    pickupLat: 28.5127, pickupLng: -81.4340,
    dropoffLat: 28.4312, dropoffLng: -81.3081,
    fareTotal: 22.75, driverPayout: 17.06, platformFee: 5.69,
    paymentMethod: "card", paymentStatus: "succeeded", payoutStatus: "pending",
    rideLabel: "Standard", rideType: "standard",
    tripDistanceMiles: 7.4, tripDurationMin: 21,
    polyline: null,
    createdAt:         { seconds: Math.floor(Date.now()/1000) - 180 },
    emailDispatchAt:   { seconds: Math.floor(Date.now()/1000) - 160 },
    expiresAt:         { seconds: Math.floor(Date.now()/1000) + 220 },
    updatedAt:         { seconds: Math.floor(Date.now()/1000) - 10 },
    emailSentToDrivers: { a: true, b: true, c: true },
    candidateDriverUids: ["a","b","c","d"],
    searchExtended: 2,
  },
  {
    id: "a7pvdsoPp9cbUGiLPk3L",
    status: "driver_assigned",
    riderName: "Kevin R.",
    driverName: "Tobias",
    driverUid: "driverUID004",
    driverPhone: "+14075550177",
    pickup: "The Mall at Millenia, Orlando FL",
    dropoff: "Disney Springs, Lake Buena Vista, FL",
    pickupCity: "Orlando", dropoffCity: "Lake Buena Vista",
    pickupZip: "32839", dropoffZip: "32836",
    pickupLat: 28.5098, pickupLng: -81.4349,
    dropoffLat: 28.3713, dropoffLng: -81.5190,
    driverLat: 28.5160, driverLng: -81.4410,
    riderLat: 28.5098, riderLng: -81.4349,
    fareTotal: 28.00, driverPayout: 21.00, platformFee: 7.00,
    paymentMethod: "cashapp", paymentStatus: "succeeded", payoutStatus: "pending",
    rideLabel: "Standard", rideType: "standard",
    tripDistanceMiles: 11.3, tripDurationMin: 22,
    driverEtaMin: 4,
    polyline: null,
    createdAt:  { seconds: Math.floor(Date.now()/1000) - 420 },
    acceptedAt: { seconds: Math.floor(Date.now()/1000) - 380 },
    updatedAt:  { seconds: Math.floor(Date.now()/1000) - 30 },
  },
];

/* ─── Design System ──────────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800;900&family=DM+Mono:wght@400;500;600&display=swap');

:root {
  --bg:        #0D0F12;
  --bg-card:   #131619;
  --bg-raised: #1A1D22;
  --bg-hover:  #1E2228;
  --bg-glass:  rgba(255,255,255,0.04);

  --border:    rgba(255,255,255,.07);
  --border-md: rgba(255,255,255,.11);
  --border-hi: rgba(255,255,255,.18);

  --ink:   #F0F2F5;
  --ink-2: #C8CDD6;
  --ink-3: #8A92A0;
  --ink-4: #565E6C;
  --ink-5: #363D48;

  --green:      #22C55E;
  --green-dim:  rgba(34,197,94,.12);
  --green-glow: rgba(34,197,94,.25);

  --blue:       #3B82F6;
  --blue-dim:   rgba(59,130,246,.12);
  --blue-glow:  rgba(59,130,246,.25);

  --amber:      #F59E0B;
  --amber-dim:  rgba(245,158,11,.12);

  --red:        #EF4444;
  --red-dim:    rgba(239,68,68,.12);

  --violet:     #A78BFA;
  --violet-dim: rgba(167,139,250,.12);

  --r:    14px;
  --r-sm: 10px;
  --r-xs: 7px;
  --font: 'DM Sans', sans-serif;
  --mono: 'DM Mono', monospace;
}

.ht * { box-sizing: border-box; margin: 0; padding: 0; }
.ht {
  font-family: var(--font);
  background: var(--bg);
  color: var(--ink);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
}

@keyframes fadeUp    { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
@keyframes spin      { to { transform: rotate(360deg) } }
@keyframes pulseRing { 0% { transform:scale(.8); opacity:.7 } 70% { transform:scale(1.55); opacity:0 } 100% { transform:scale(.8); opacity:0 } }
@keyframes blink     { 0%,100%{opacity:1} 50%{opacity:.35} }
@keyframes slideIn   { from { opacity:0; transform:translateY(-8px) scale(.97) } to { opacity:1; transform:translateY(0) scale(1) } }
@keyframes barGrow   { from { width:0 } }
@keyframes shimmer   { 0%{background-position:-200% 0} 100%{background-position:200% 0} }

.fade-up { animation: fadeUp .45s cubic-bezier(.22,1,.36,1) both; }
.spin    { animation: spin 1s linear infinite; }

.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--r);
  position: relative;
}
.card-hover {
  transition: border-color .18s, background .18s;
  cursor: default;
}
.card-hover:hover {
  border-color: var(--border-md);
  background: var(--bg-raised);
}

.pill {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 10px; font-weight: 600; letter-spacing: .03em;
  padding: 2.5px 8px; border-radius: 5px;
  white-space: nowrap;
}
.pill-mono { font-family: var(--mono); font-size: 10px; font-weight: 500; }

.live-dot {
  width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; position: relative;
}
.live-dot::after {
  content: '';
  position: absolute; inset: -4px; border-radius: 50%;
  border: 1.5px solid currentColor;
  animation: pulseRing 2.2s ease-out infinite; opacity: 0;
}

/* Mapbox overrides */
.rc-map .mapboxgl-ctrl-logo,
.rc-map .mapboxgl-ctrl-attrib { display: none !important; }

/* Quick action buttons */
.qa-btn {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  flex: 1; padding: 8px 10px; border-radius: 9px;
  border: 1px solid var(--border-md);
  background: var(--bg-raised);
  font-family: var(--font); font-size: 11.5px; font-weight: 600;
  color: var(--ink-2); cursor: pointer;
  transition: all .15s;
}
.qa-btn:hover { transform: translateY(-1px); }
.qa-btn.green { border-color: rgba(34,197,94,.3); color: var(--green); background: var(--green-dim); }
.qa-btn.green:hover { background: rgba(34,197,94,.18); border-color: rgba(34,197,94,.5); box-shadow: 0 4px 16px rgba(34,197,94,.15); }
.qa-btn.blue  { border-color: rgba(59,130,246,.3); color: var(--blue);  background: var(--blue-dim); }
.qa-btn.blue:hover  { background: rgba(59,130,246,.18); border-color: rgba(59,130,246,.5); box-shadow: 0 4px 16px rgba(59,130,246,.15); }

.ht ::-webkit-scrollbar { width: 3px; height: 3px; }
.ht ::-webkit-scrollbar-track { background: transparent; }
.ht ::-webkit-scrollbar-thumb { background: var(--border-md); border-radius: 2px; }

/* Toast */
.toast {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  background: var(--ink); color: var(--bg);
  font-family: var(--font); font-size: 12px; font-weight: 600;
  padding: 10px 18px; border-radius: 20px;
  box-shadow: 0 8px 32px rgba(0,0,0,.5);
  animation: slideIn .25s cubic-bezier(.22,1,.36,1);
  z-index: 9999; white-space: nowrap;
}
`;

/* ─── Helpers ────────────────────────────────────────────────────── */
function tsToMs(ts) {
  if (!ts) return 0;
  if (ts?.seconds) return ts.seconds * 1000;
  if (typeof ts === "number") return ts;
  return 0;
}
function timeAgo(ts) {
  if (!ts) return "—";
  const diff = Math.floor((Date.now() - tsToMs(ts)) / 1000);
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}
function shortAddr(addr = "") { return addr.split(",")[0] || addr; }
function fmtMMSS(s) {
  const a = Math.abs(Math.round(s));
  return `${Math.floor(a / 60)}:${String(a % 60).padStart(2, "0")}`;
}
function initials(name = "") {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";
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

/* ─── Mapbox loader ──────────────────────────────────────────────── */
const MAPBOX_TOKEN = 'pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA';
let _mbLoaded = false;
let _mbCbs = [];
function loadMapbox(cb) {
  if (_mbLoaded && window.mapboxgl) { cb(); return; }
  _mbCbs.push(cb);
  if (document.getElementById('mb-css')) { return; }
  const link = document.createElement('link');
  link.id = 'mb-css'; link.rel = 'stylesheet';
  link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css';
  document.head.appendChild(link);
  const s = document.createElement('script');
  s.src = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js';
  s.onload = () => { _mbLoaded = true; _mbCbs.forEach(fn => fn()); _mbCbs = []; };
  document.head.appendChild(s);
}

/* ─── Status config ──────────────────────────────────────────────── */
const STATUS = {
  searching_driver: { label: "Searching",   color: "#F59E0B", bg: "rgba(245,158,11,.14)", border: "rgba(245,158,11,.3)" },
  driver_assigned:  { label: "Assigned",    color: "#3B82F6", bg: "rgba(59,130,246,.14)", border: "rgba(59,130,246,.3)" },
  driver_arriving:  { label: "Arriving",    color: "#3B82F6", bg: "rgba(59,130,246,.14)", border: "rgba(59,130,246,.3)" },
  arrived:          { label: "Arrived",     color: "#22C55E", bg: "rgba(34,197,94,.14)",  border: "rgba(34,197,94,.3)" },
  in_progress:      { label: "In Progress", color: "#22C55E", bg: "rgba(34,197,94,.14)",  border: "rgba(34,197,94,.3)" },
  completed:        { label: "Completed",   color: "#8A92A0", bg: "rgba(138,146,160,.1)", border: "rgba(138,146,160,.2)" },
  cancelled:        { label: "Cancelled",   color: "#EF4444", bg: "rgba(239,68,68,.14)",  border: "rgba(239,68,68,.3)" },
};

/* ─── Mini Mapbox card map ───────────────────────────────────────── */
function CardMap({ ride, status }) {
  const ref      = useRef(null);
  const mapRef   = useRef(null);
  const marksRef = useRef([]);
  const initRef  = useRef(false);

  const isActive    = ["driver_assigned","driver_arriving","arrived","in_progress"].includes(status);
  const isCompleted = status === "completed";
  const isCancelled = status === "cancelled";

  const routeCoords = useMemo(() => {
    if (!ride.polyline) return [];
    return decodePolyline(ride.polyline).map(([la, lo]) => [lo, la]);
  }, [ride.polyline]);

  // Generate straight-line route if no polyline
  const displayCoords = useMemo(() => {
    if (routeCoords.length > 1) return routeCoords;
    if (ride.pickupLng && ride.dropoffLng) {
      return [
        [ride.pickupLng, ride.pickupLat],
        [ride.dropoffLng, ride.dropoffLat],
      ];
    }
    return [];
  }, [routeCoords, ride]);

  const bounds = useMemo(() => {
    const pts = [];
    if (ride.pickupLat)  pts.push([ride.pickupLng,  ride.pickupLat]);
    if (ride.dropoffLat) pts.push([ride.dropoffLng, ride.dropoffLat]);
    if (ride.driverLat)  pts.push([ride.driverLng,  ride.driverLat]);
    if (!pts.length) return null;
    return {
      minLng: Math.min(...pts.map(p => p[0])) - 0.003,
      maxLng: Math.max(...pts.map(p => p[0])) + 0.003,
      minLat: Math.min(...pts.map(p => p[1])) - 0.003,
      maxLat: Math.max(...pts.map(p => p[1])) + 0.003,
    };
  }, [ride]);

  useEffect(() => {
    if (!ref.current || initRef.current) return;
    loadMapbox(() => {
      if (!ref.current || initRef.current) return;
      initRef.current = true;
      window.mapboxgl.accessToken = MAPBOX_TOKEN;
      const center = bounds
        ? [(bounds.minLng + bounds.maxLng) / 2, (bounds.minLat + bounds.maxLat) / 2]
        : [ride.pickupLng ?? -81.4, ride.pickupLat ?? 28.54];
      mapRef.current = new window.mapboxgl.Map({
        container: ref.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center, zoom: 13.5,
        attributionControl: false,
        interactive: false,
        fadeDuration: 0,
      });
    });
    return () => {
      marksRef.current.forEach(m => m.remove()); marksRef.current = [];
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; initRef.current = false; }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const attach = () => {
      if (!mapRef.current?.isStyleLoaded()) { setTimeout(attach, 80); return; }

      // Route line
      if (displayCoords.length > 1) {
        const geo = { type: "Feature", geometry: { type: "LineString", coordinates: displayCoords } };
        const lineColor = isCancelled ? "#EF4444" : isCompleted ? "#6B7280" : "#22C55E";
        const isDashed  = displayCoords.length === 2; // straight-line = dashed
        if (mapRef.current.getSource("route")) {
          mapRef.current.getSource("route").setData(geo);
        } else {
          mapRef.current.addSource("route", { type: "geojson", data: geo });
          mapRef.current.addLayer({ id: "route-glow", type: "line", source: "route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": lineColor, "line-width": 10, "line-opacity": .12, "line-blur": 6 } });
          mapRef.current.addLayer({ id: "route-line", type: "line", source: "route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
              "line-color": lineColor, "line-width": isDashed ? 2 : 3,
              "line-opacity": isCancelled ? .5 : 1,
              ...(isDashed ? { "line-dasharray": [3, 3] } : {}),
            } });
        }
      }

      marksRef.current.forEach(m => m.remove()); marksRef.current = [];

      // Pickup marker — green ring
      if (ride.pickupLat && ride.pickupLng) {
        const el = document.createElement("div");
        el.style.cssText = "position:relative;width:18px;height:18px;display:flex;align-items:center;justify-content:center;";
        el.innerHTML = `
          <div style="width:10px;height:10px;border-radius:50%;background:#22C55E;border:2px solid #fff;box-shadow:0 0 10px rgba(34,197,94,.7);z-index:1;"></div>
          ${isActive ? `<div style="position:absolute;inset:-3px;border-radius:50%;border:1.5px solid rgba(34,197,94,.5);animation:pulseRing 2.2s ease-out infinite;"></div>` : ""}
        `;
        marksRef.current.push(
          new window.mapboxgl.Marker({ element: el, anchor: "center" })
            .setLngLat([ride.pickupLng, ride.pickupLat]).addTo(mapRef.current)
        );
      }

      // Dropoff marker — teardrop pin
      if (ride.dropoffLat && ride.dropoffLng) {
        const pinColor = isCancelled ? "#EF4444" : isCompleted ? "#8A92A0" : "#F0F2F5";
        const el = document.createElement("div");
        el.style.cssText = "filter:drop-shadow(0 3px 10px rgba(0,0,0,.6));";
        el.innerHTML = `
          <svg width="18" height="24" viewBox="0 0 18 24" fill="none">
            <path d="M9 0C4.03 0 0 4.03 0 9c0 6.75 9 15 9 15s9-8.25 9-15C18 4.03 13.97 0 9 0z" fill="${pinColor}"/>
            <circle cx="9" cy="9" r="3.5" fill="${isCompleted || isCancelled ? "rgba(0,0,0,.35)" : "#131619"}"/>
          </svg>`;
        marksRef.current.push(
          new window.mapboxgl.Marker({ element: el, anchor: "bottom" })
            .setLngLat([ride.dropoffLng, ride.dropoffLat]).addTo(mapRef.current)
        );
      }

      // Driver marker — blue pulsing dot
      if (ride.driverLat && ride.driverLng && isActive) {
        const el = document.createElement("div");
        el.style.cssText = "position:relative;width:14px;height:14px;";
        el.innerHTML = `
          <div style="width:14px;height:14px;border-radius:50%;background:#3B82F6;border:2px solid #fff;box-shadow:0 0 14px rgba(59,130,246,.8);"></div>
          <div style="position:absolute;inset:-5px;border-radius:50%;border:1.5px solid rgba(59,130,246,.4);animation:pulseRing 1.8s ease-out infinite;"></div>
        `;
        marksRef.current.push(
          new window.mapboxgl.Marker({ element: el, anchor: "center" })
            .setLngLat([ride.driverLng, ride.driverLat]).addTo(mapRef.current)
        );
      }

      // Rider marker — small white dot
      if (ride.riderLat && ride.riderLng && (isActive || isCompleted)) {
        const el = document.createElement("div");
        el.innerHTML = `<div style="width:8px;height:8px;border-radius:50%;background:#fff;border:1.5px solid rgba(255,255,255,.4);opacity:0.7;box-shadow:0 0 6px rgba(255,255,255,.3);"></div>`;
        marksRef.current.push(
          new window.mapboxgl.Marker({ element: el, anchor: "center" })
            .setLngLat([ride.riderLng, ride.riderLat]).addTo(mapRef.current)
        );
      }

      if (bounds) {
        mapRef.current.fitBounds(
          [[bounds.minLng, bounds.minLat], [bounds.maxLng, bounds.maxLat]],
          { padding: 30, maxZoom: 15.5, duration: 0 }
        );
      }
    };
    if (mapRef.current?.loaded()) attach();
    else mapRef.current?.once("load", attach);
  }, [displayCoords, bounds, ride, isActive, isCompleted, isCancelled]);

  return <div ref={ref} className="rc-map" style={{ width: "100%", height: "100%" }} />;
}

/* ─── Progress bars ──────────────────────────────────────────────── */
function ProgressBar({ pct = 0, color = "#22C55E", label, h = 3 }) {
  return (
    <div style={{ height: h, background: "rgba(255,255,255,.05)", position: "relative", overflow: "visible" }}>
      <div style={{ position: "absolute", inset: "0 auto 0 0", width: `${Math.min(Math.max(pct, 0), 100)}%`, background: color, transition: "width .4s ease", boxShadow: `0 0 10px ${color}66` }} />
      {label && (
        <div style={{ position: "absolute", top: 0, left: `${Math.min(Math.max(pct, 6), 90)}%`, transform: "translate(-50%, calc(-100% - 5px))", background: color, color: "#000", fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, fontFamily: "var(--mono)", whiteSpace: "nowrap", letterSpacing: ".04em", zIndex: 10 }}>
          {label}
        </div>
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
    const total = exMs - startMs;
    const tick = () => {
      const rem = Math.max((exMs - Date.now()) / 1000, 0);
      setPct(Math.max(((exMs - Date.now()) / total) * 100, 0));
      setLeft(Math.ceil(rem));
      if (rem > 0) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [expiresAt, emailDispatchAt, createdAt]);
  const c = left == null ? "#565E6C" : left > 300 ? "#F59E0B" : left > 60 ? "#F97316" : "#EF4444";
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
  const total = (etaMin ?? 0) * 60;
  const pct   = total > 0 ? Math.min((elapsed / total) * 100, 100) : 0;
  const late  = total > 0 && elapsed > total;
  const c     = late ? "#EF4444" : pct > 80 ? "#F97316" : "#3B82F6";
  return <ProgressBar pct={pct} color={c} label={late ? `+${fmtMMSS(elapsed - total)}` : etaMin != null ? `${etaMin}m ETA` : `${fmtMMSS(elapsed)}`} />;
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
  const c     = pct > 90 ? "#EF4444" : pct > 70 ? "#F59E0B" : "#22C55E";
  return <ProgressBar pct={pct} color={c} label={total > 0 ? (elapsed > total ? `+${fmtMMSS(elapsed - total)}` : `${fmtMMSS(rem)} left`) : `${fmtMMSS(elapsed)}`} />;
}

function StatusProgressBar({ ride }) {
  switch (ride.status) {
    case "searching_driver": return <SearchTimerBar expiresAt={ride.expiresAt} emailDispatchAt={ride.emailDispatchAt} createdAt={ride.createdAt} />;
    case "driver_assigned":
    case "driver_arriving":  return <AssignedBar acceptedAt={ride.acceptedAt} etaMin={ride.driverEtaMin} />;
    case "arrived":          return <ProgressBar pct={100} color="#22C55E" label="ARRIVED" />;
    case "in_progress":      return <TripBar startedAt={ride.startedAt} tripDurationMin={ride.tripDurationMin} />;
    case "completed":        return <div style={{ height: 3, background: "linear-gradient(90deg, #22C55E44, #22C55E22)" }} />;
    case "cancelled":        return <div style={{ height: 3, background: "linear-gradient(90deg, #EF4444, #EF444444)" }} />;
    default:                 return <div style={{ height: 3, background: "var(--border)" }} />;
  }
}

/* ─── Quick Action Buttons ───────────────────────────────────────── */
function QuickActions({ ride, onToast }) {
  const hasDriver = !!ride.driverName && !!ride.driverUid;
  const isActive  = ["driver_assigned","driver_arriving","arrived","in_progress"].includes(ride.status);
  if (!hasDriver || !isActive) return null;

  const handleMessage = () => {
    onToast?.(`💬 Opening chat with ${ride.driverName}…`);
  };
  const handleCall = () => {
    if (ride.driverPhone) window.location.href = `tel:${ride.driverPhone}`;
    onToast?.(`📞 Calling ${ride.driverName} at ${ride.driverPhone ?? "…"}`);
  };

  return (
    <div style={{ display: "flex", gap: 7, padding: "10px 14px 0" }}>
      <button className="qa-btn green" onClick={handleMessage}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        Message Driver
      </button>
      <button className="qa-btn blue" onClick={handleCall}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.24h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
        </svg>
        Call Driver
      </button>
    </div>
  );
}

/* ─── Ride Card ──────────────────────────────────────────────────── */
function RideCard({ ride, index, onToast }) {
  const status = ride.status ?? "unknown";
  const s = STATUS[status] ?? { label: status, color: "#8A92A0", bg: "rgba(138,146,160,.1)", border: "rgba(138,146,160,.2)" };

  const isActive    = ["driver_assigned","driver_arriving","arrived","in_progress"].includes(status);
  const isCompleted = status === "completed";
  const isCancelled = status === "cancelled";
  const isSearching = status === "searching_driver";

  const riderLabel  = ride.riderName  ?? `Rider ···${ride.uid?.slice(-4) ?? "?"}`;
  const driverLabel = ride.driverName ?? null;

  // Accent stripe color
  const stripeColor = isCancelled ? "#EF4444" : isCompleted ? "#22C55E22" : isSearching ? "#F59E0B" : isActive ? "#22C55E" : "#363D48";

  // Payment chips
  const pmColors = { cashapp: { bg: "rgba(34,197,94,.12)", color: "#22C55E", label: "Cash App" }, card: { bg: "rgba(59,130,246,.12)", color: "#3B82F6", label: "Card" } };
  const pm = pmColors[ride.paymentMethod] ?? { bg: "var(--bg-raised)", color: "var(--ink-3)", label: ride.paymentMethod ?? "—" };

  const psColors = { succeeded: { bg: "rgba(34,197,94,.12)", color: "#22C55E", label: "Paid" }, pending: { bg: "rgba(245,158,11,.12)", color: "#F59E0B", label: "Pending" }, failed: { bg: "rgba(239,68,68,.12)", color: "#EF4444", label: "Failed" } };
  const ps = psColors[ride.paymentStatus] ?? { bg: "var(--bg-raised)", color: "var(--ink-3)", label: ride.paymentStatus ?? "—" };

  const poColors = { processing: { bg: "rgba(59,130,246,.12)", color: "#3B82F6", label: "Processing" }, pending: { bg: "rgba(245,158,11,.12)", color: "#F59E0B", label: "Pending" }, paid: { bg: "rgba(34,197,94,.12)", color: "#22C55E", label: "Paid Out" }, failed: { bg: "rgba(239,68,68,.12)", color: "#EF4444", label: "Failed" } };
  const po = poColors[ride.payoutStatus] ?? { bg: "var(--bg-raised)", color: "var(--ink-3)", label: ride.payoutStatus ?? "—" };

  return (
    <div className="card card-hover fade-up" style={{ animationDelay: `${index * 60}ms`, overflow: "hidden", padding: 0 }}>

      {/* Top stripe */}
      <div style={{ height: 2.5, background: stripeColor }} />

      {/* Header */}
      <div style={{ padding: "13px 14px 11px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", gap: 10, minWidth: 0, alignItems: "center" }}>
          {/* Avatar */}
          <div style={{
            width: 38, height: 38, borderRadius: 11, flexShrink: 0,
            background: isCancelled ? "linear-gradient(135deg,#7F1D1D,#EF4444)"
              : isCompleted ? "linear-gradient(135deg,#1A2233,#22C55E44)"
              : "linear-gradient(135deg,#1A2233,#3B82F6)",
            border: `1px solid ${isCompleted ? "rgba(34,197,94,.2)" : "rgba(59,130,246,.2)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700, color: "#fff", letterSpacing: "-.01em",
          }}>
            {initials(riderLabel)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", letterSpacing: "-.02em", marginBottom: 2 }}>
              {riderLabel}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              {driverLabel
                ? <>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: isActive ? "#3B82F6" : "#565E6C" }} />
                    <span style={{ fontSize: 10.5, color: isActive ? "#3B82F6" : "var(--ink-3)", fontWeight: 600 }}>{driverLabel}</span>
                    {isActive && (
                      <div style={{ display: "flex", alignItems: "center", gap: 3, background: "rgba(59,130,246,.12)", border: "1px solid rgba(59,130,246,.2)", borderRadius: 4, padding: "1px 5px" }}>
                        <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#3B82F6", animation: "blink 1.4s ease-in-out infinite" }} />
                        <span style={{ fontSize: 9, fontWeight: 700, color: "#3B82F6", letterSpacing: ".04em" }}>DRIVER</span>
                      </div>
                    )}
                  </>
                : <span style={{ fontSize: 10.5, color: "#F59E0B", fontWeight: 600, fontStyle: "italic" }}>No driver assigned</span>
              }
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
          <div className="pill" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.color, boxShadow: `0 0 6px ${s.color}` }} />
            {s.label}
          </div>
          <div style={{ fontSize: 22, color: isCancelled ? "var(--ink-4)" : "var(--ink)", fontWeight: 800, letterSpacing: "-.04em", lineHeight: 1, fontFeatureSettings: "'tnum'", textDecoration: isCancelled ? "line-through" : "none" }}>
            {ride.fareTotal != null ? `$${ride.fareTotal.toFixed(2)}` : "—"}
          </div>
        </div>
      </div>

      {/* Quick Actions — above map for active rides */}
      <QuickActions ride={ride} onToast={onToast} />

      {/* Map */}
      <div style={{ position: "relative", height: 155, margin: "10px 14px 0", borderRadius: 10, overflow: "hidden", border: "1px solid var(--border-md)" }}>
        <CardMap ride={ride} status={status} />

        {/* Pickup overlay */}
        {ride.pickup && (
          <div style={{ position: "absolute", top: 7, left: 7, zIndex: 20, background: "rgba(19,22,25,0.88)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 7, padding: "3.5px 9px", display: "flex", alignItems: "center", gap: 5, maxWidth: "54%" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E", boxShadow: "0 0 8px rgba(34,197,94,.8)", flexShrink: 0 }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: "#F0F2F5", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {shortAddr(ride.pickup)}
            </span>
          </div>
        )}

        {/* Dropoff overlay */}
        {ride.dropoff && (
          <div style={{ position: "absolute", bottom: 7, right: 7, zIndex: 20, background: "rgba(240,242,245,0.93)", backdropFilter: "blur(10px)", border: "1px solid rgba(0,0,0,.08)", borderRadius: 7, padding: "3.5px 9px", display: "flex", alignItems: "center", gap: 5, maxWidth: "54%" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: isCancelled ? "#EF4444" : "#0D0F12", flexShrink: 0 }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: "#131619", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {shortAddr(ride.dropoff)}
            </span>
          </div>
        )}

        {/* LIVE badge */}
        {isActive && (
          <div style={{ position: "absolute", top: 7, right: 7, zIndex: 20, display: "flex", alignItems: "center", gap: 4, background: "rgba(34,197,94,.15)", border: "1px solid rgba(34,197,94,.35)", borderRadius: 14, padding: "2.5px 8px", backdropFilter: "blur(8px)" }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22C55E", animation: "blink 1.2s ease-in-out infinite" }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: "#22C55E", letterSpacing: ".06em" }}>LIVE</span>
          </div>
        )}

        {/* ETA chip when driver assigned */}
        {(status === "driver_assigned" || status === "driver_arriving") && ride.driverEtaMin != null && (
          <div style={{ position: "absolute", bottom: 7, left: 7, zIndex: 20, background: "rgba(59,130,246,.18)", border: "1px solid rgba(59,130,246,.4)", borderRadius: 7, padding: "3px 8px" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#3B82F6", fontFamily: "var(--mono)" }}>{ride.driverEtaMin}m to pickup</span>
          </div>
        )}

        {/* Trip progress when in_progress */}
        {status === "in_progress" && ride.dropoffEtaMin != null && (
          <div style={{ position: "absolute", bottom: 7, left: 7, zIndex: 20, background: "rgba(34,197,94,.18)", border: "1px solid rgba(34,197,94,.4)", borderRadius: 7, padding: "3px 8px" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#22C55E", fontFamily: "var(--mono)" }}>{ride.dropoffEtaMin}m to dropoff</span>
          </div>
        )}

        {/* Map legend for pins */}
        {(isActive || isCompleted) && (
          <div style={{ position: "absolute", bottom: 7, left: 7, zIndex: 20, display: "flex", gap: 5 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 3, background: "rgba(13,15,18,.75)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 5, padding: "2px 6px" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E" }} />
              <span style={{ fontSize: 8.5, fontWeight: 600, color: "rgba(255,255,255,.6)" }}>Pickup</span>
            </div>
            {ride.driverLat && isActive && (
              <div style={{ display: "flex", alignItems: "center", gap: 3, background: "rgba(13,15,18,.75)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 5, padding: "2px 6px" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#3B82F6" }} />
                <span style={{ fontSize: 8.5, fontWeight: 600, color: "rgba(255,255,255,.6)" }}>Driver</span>
              </div>
            )}
          </div>
        )}

        {isCancelled && <div style={{ position: "absolute", inset: 0, background: "rgba(239,68,68,.07)", zIndex: 10, pointerEvents: "none" }} />}
      </div>

      {/* Footer */}
      <div style={{ padding: "10px 14px 13px", display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Chips row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 5 }}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {ride.rideLabel && <span className="pill" style={{ background: "var(--bg-raised)", color: "var(--ink-3)", border: "1px solid var(--border-md)" }}>{ride.rideLabel}</span>}
            {ride.tripDistanceMiles != null && <span className="pill" style={{ background: "var(--bg-raised)", color: "var(--ink-3)", border: "1px solid var(--border-md)" }}>{ride.tripDistanceMiles} mi</span>}
            {ride.tripDurationMin   != null && <span className="pill" style={{ background: "var(--bg-raised)", color: "var(--ink-3)", border: "1px solid var(--border-md)" }}>~{ride.tripDurationMin}m</span>}
            {isSearching && (
              <span className="pill" style={{ background: "rgba(245,158,11,.12)", color: "#F59E0B", border: "1px solid rgba(245,158,11,.25)" }}>
                {Object.keys(ride.emailSentToDrivers ?? {}).length} emailed
              </span>
            )}
          </div>
          <span style={{ fontSize: 10, color: "var(--ink-4)", fontWeight: 500 }}>{timeAgo(ride.createdAt)}</span>
        </div>

        {/* Payment row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid var(--border)", flexWrap: "wrap", gap: 5 }}>
          <div style={{ display: "flex", gap: 4 }}>
            <span className="pill" style={{ background: pm.bg, color: pm.color }}>{pm.label}</span>
            <span className="pill" style={{ background: ps.bg, color: ps.color }}>{ps.label}</span>
            <span className="pill" style={{ background: po.bg, color: po.color }}>{po.label}</span>
          </div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-3)" }}>
            <span style={{ color: "#22C55E", fontWeight: 600 }}>${ride.driverPayout?.toFixed(2) ?? "—"}</span>
            <span style={{ color: "var(--ink-5)" }}> drv · </span>
            <span style={{ color: "#3B82F6", fontWeight: 600 }}>${ride.platformFee?.toFixed(2) ?? "—"}</span>
            <span style={{ color: "var(--ink-5)" }}> fee</span>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <StatusProgressBar ride={ride} />
    </div>
  );
}

/* ─── KPI Strip ──────────────────────────────────────────────────── */
function KpiStrip({ rides }) {
  const active    = rides.filter(r => ["driver_assigned","driver_arriving","arrived","in_progress"].includes(r.status));
  const searching = rides.filter(r => r.status === "searching_driver");
  const completed = rides.filter(r => r.status === "completed");
  const revenue   = completed.reduce((s, r) => s + (r.fareTotal ?? 0), 0);

  return (
    <div className="card fade-up" style={{ padding: "13px 14px", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "stretch", gap: 0, overflowX: "auto" }}>
        {[
          { val: rides.length,    sub: "Total Rides", dot: "#3B82F6" },
          { val: active.length,   sub: "Active",      dot: "#22C55E" },
          { val: searching.length,sub: "Searching",   dot: "#F59E0B" },
          { val: `$${revenue.toFixed(2)}`, sub: "Revenue", dot: "#A78BFA" },
        ].map(({ val, sub, dot }, i, arr) => (
          <div key={sub} style={{ display: "flex", alignItems: "center", gap: 9, padding: "4px 16px", borderRight: i < arr.length - 1 ? "1px solid var(--border)" : "none", flexShrink: 0 }}>
            <div className="live-dot" style={{ background: dot, color: dot }} />
            <span style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)", letterSpacing: "-.03em", fontFeatureSettings: "'tnum'" }}>{val}</span>
            <span style={{ fontSize: 10.5, color: "var(--ink-3)", fontWeight: 500 }}>{sub}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Toast ──────────────────────────────────────────────────────── */
function Toast({ msg, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2600); return () => clearTimeout(t); }, [msg]);
  return <div className="toast">{msg}</div>;
}

/* ─── HomeTab (exported) ─────────────────────────────────────────── */
export function HomeTab({ rides: propRides, onToast: externalToast }) {
  const rides = propRides ?? REAL_RIDES;
  const [toast, setToast] = useState(null);

  const onToast = useCallback((msg) => {
    setToast(msg);
    externalToast?.(msg);
  }, [externalToast]);

  const active    = rides.filter(r => ["driver_assigned","driver_arriving","arrived","in_progress"].includes(r.status));
  const searching = rides.filter(r => r.status === "searching_driver");
  const rest      = rides.filter(r => !["driver_assigned","driver_arriving","arrived","in_progress","searching_driver"].includes(r.status));

  // Sort: active first, then searching, then rest
  const sorted = [...active, ...searching, ...rest];

  return (
    <>
      <style>{CSS}</style>
      <div className="ht" style={{ padding: "12px 12px 40px" }}>

        <KpiStrip rides={rides} />

        {/* Section label */}
        <div className="fade-up" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, animationDelay: "80ms" }}>
          <div className="live-dot" style={{ background: "#22C55E", color: "#22C55E", width: 7, height: 7 }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", letterSpacing: "-.02em" }}>Live Rides</span>
          <span style={{ fontSize: 11, color: "var(--ink-4)", fontWeight: 500 }}>· {sorted.length} total</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sorted.map((ride, i) => (
            <RideCard key={ride.id} ride={ride} index={i} onToast={onToast} />
          ))}
        </div>

        {toast && <Toast msg={toast} onDone={() => setToast(null)} />}
      </div>
    </>
  );
}

/* ─── Standalone preview ─────────────────────────────────────────── */
export default function App() {
  return <HomeTab />;
}
