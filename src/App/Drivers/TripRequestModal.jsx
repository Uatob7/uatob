/**
 * TripRequestModal.jsx — Full-screen incoming-ride request (driver-facing)
 * ════════════════════════════════════════════════════════════════════════════
 * The decision screen: a ride comes in, the driver has ~60s to take it.
 * Slide RIGHT → Accept · Slide LEFT → Decline.
 *
 * This build matches ActiveTripScreen: the map is the screen. A full-bleed
 * Mapbox view fills everything, and the decision panel is deliberately small.
 *
 * Behaviour the way ActiveTripScreen handles it:
 * ─────────────────────────────────────────────────────────────────────────
 *   • FULL MAP, COMPACT PANEL. While the driver→pickup route is still being
 *     fetched, the panel sits a little taller (it has nothing better to show, so
 *     it shows skeletons). The instant the polyline returns, the panel COLLAPSES
 *     to a compact card — fare, distance-to-pickup, the two addresses, and the
 *     slider — handing the rest of the screen to the map. A grab handle expands
 *     it again for the full breakdown (gauge, metrics, fare items).
 *   • DISTANCE TO PICKUP, FRONT AND CENTER. The moment the route resolves, a
 *     hero read shows exactly how far the driver is from the pickup (miles + ETA),
 *     and it keeps updating live from the device GPS as the driver moves.
 *   • LIVE PUCK. The driver puck tracks the live device location (falling back to
 *     the `driver` prop), exactly like ActiveTripScreen, and the deadhead distance
 *     recomputes from the live fix.
 *   • Animated route draw-in + flowing marching-dash, radar sweep, pickup pings,
 *     compass-to-pickup, count-up fare, urgency system, rider card, earnings
 *     gauge, fare breakdown, ACCEPTED / EXPIRED overlays — all retained.
 *
 * Props (unchanged — drop-in replacement)
 * ───────────────────────────────────────
 *   driver          { uid, lat, lng, firstName }
 *   tripRequest     Firestore ride doc
 *   requestTimer    number (seconds remaining, 0–60)
 *   onAccept        () => void
 *   onDecline       () => void
 *   actionPending   boolean
 *   useDeviceLocation boolean (default true) — live GPS puck + live deadhead
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Zap } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';
import { TYPE_COLOR, TYPE_LABEL } from '@/App/Drivers/constants.js';

const db                    = getFirestore(firebase_app);
const functions             = getFunctions(firebase_app, 'us-east1');
const callGetDriverToPickup = httpsCallable(functions, 'getDriverToPickup');

const MAPBOX_TOKEN = 'pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA';
const MB_VERSION   = 'v3.3.0';
const MAP_STYLE    = 'mapbox://styles/mapbox/dark-v11';

// ─── palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:          '#050A06',
  panel:       'rgba(5,10,6,.82)',
  panelDeep:   'rgba(2,5,3,.94)',
  green:       '#22C55E',
  greenBright: '#4ADE80',
  greenSoft:   '#34D399',
  amber:       '#FB923C',
  amberBright: '#FBBF24',
  red:         '#F87171',
  redDeep:     '#EF4444',
  white:       'rgba(255,255,255,.88)',
  ink:         'rgba(255,255,255,.42)',
  inkDim:      'rgba(255,255,255,.22)',
  inkFaint:    'rgba(255,255,255,.10)',
  cyan:        '#67E8F9',
  violet:      '#C084FC',
};

const MONO = "'JetBrains Mono','SFMono-Regular',monospace";
const COND = "'Barlow Condensed','Barlow',sans-serif";

// ─── tunables ───────────────────────────────────────────────────────────────
const DRAW_MS            = 850;   // route draw-in duration
const FARE_COUNT_MS      = 650;   // fare count-up duration
const DASH_THROTTLE_MS   = 55;    // flowing-dash frame interval
const LONG_TRIP_MI       = 15;    // threshold to flag a long haul
const DANGER_AT          = 10;    // seconds remaining → urgency escalation
const WARN_AT            = 20;    // seconds remaining → amber
const GAUGE_MAX_PER_MI   = 4.0;   // top of the earnings-quality gauge ($/mi)
const STALE_FIX_MS       = 30000; // a GPS fix older than this is ignored
const FIT_BOTTOM_COMPACT = 300;   // map fit bottom padding when panel is compact
const FIT_BOTTOM_EXPAND  = 380;   // map fit bottom padding when panel is expanded
const MPS_TO_MPH         = 2.2369362921;

// ─── payment config ─────────────────────────────────────────────────────────
const PAY_CFG = {
  cash:    { label:'CASH',     color:'#F59E0B', bg:'rgba(245,158,11,.13)', border:'rgba(245,158,11,.32)', icon:'💵' },
  card:    { label:'CARD',     color:'#60A5FA', bg:'rgba(96,165,250,.12)', border:'rgba(96,165,250,.28)', icon:'💳' },
  cashapp: { label:'CASH APP', color:'#34D399', bg:'rgba(52,211,153,.12)', border:'rgba(52,211,153,.28)', icon:'$'  },
};

// earnings-quality tiers, judged on $/mile (rough operational read, not advice)
const RATE_TIERS = [
  { min: 0.00, label: 'LOW',   color: C.redDeep },
  { min: 1.10, label: 'FAIR',  color: C.amberBright },
  { min: 1.85, label: 'GOOD',  color: C.greenSoft },
  { min: 2.75, label: 'GREAT', color: C.greenBright },
];

// animated marching-dash frames for the flowing route
const DASH_FRAMES = [
  [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5],
  [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0], [0, 0.5, 3, 3.5],
  [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5],
  [0, 3, 3, 1], [0, 3.5, 3, 0.5],
];

const COMPASS_PTS = ['N','NE','E','SE','S','SW','W','NW'];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
const DEG = Math.PI / 180;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const clamp01 = (n) => Math.max(0, Math.min(1, n));
const lerp = (a, b, t) => a + (b - a) * t;

/** great-circle distance in miles */
function haversineMi(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * DEG;
  const dLng = (lng2 - lng1) * DEG;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** initial bearing (deg, 0=N, clockwise) from A→B */
function bearingDeg(lat1, lng1, lat2, lng2) {
  const f1 = lat1 * DEG, f2 = lat2 * DEG;
  const dl = (lng2 - lng1) * DEG;
  const y = Math.sin(dl) * Math.cos(f2);
  const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

/** bearing degrees → cardinal label */
function cardinal(deg) {
  return COMPASS_PTS[Math.round(((deg % 360) / 45)) % 8];
}

/** Google encoded polyline → [[lat,lng], ...] */
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

/** Redacted view (before accept): only "City, ST" — no street. */
function redactAddress(raw) {
  if (!raw) return '•••• ••••';
  const parts = String(raw).split(',').map(s => s.trim()).filter(Boolean);
  const city  = parts[1] ?? '';
  const state = parts[2] ?? '';
  const area  = [city, state].filter(Boolean).join(', ');
  return area ? `•••• ${area}` : '•••• ••••';
}

/** Revealed view (after accept): real address with street number masked. */
function maskAddress(raw) {
  if (!raw) return '—';
  const parts = String(raw).split(',').map(s => s.trim()).filter(Boolean);
  if (!parts.length) return '—';
  const first = parts[0].replace(/^(\d+[A-Za-z]?)(\s+)/, (_, num, sp) =>
    `${'•'.repeat(Math.min(num.length, 4))}${sp}`
  );
  const tail    = parts.slice(1).filter(p => !/^USA$/i.test(p));
  const tailStr = tail.slice(0, 2).join(', ');
  return tailStr ? `${first} · ${tailStr}` : first;
}

/** robustly format a Firestore timestamp / date-ish value → "9:00 PM" */
function fmtClock(ts) {
  if (!ts) return null;
  let d;
  if (typeof ts.toDate === 'function') d = ts.toDate();
  else if (typeof ts.seconds === 'number') d = new Date(ts.seconds * 1000);
  else d = new Date(ts);
  if (isNaN(d.getTime())) return null;
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${m} ${ap}`;
}

/** money → "$12.34" */
const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;

/** miles → short label ("0.4 mi" / "12 mi" / "320 ft") */
function fmtMi(mi) {
  if (mi == null || !isFinite(mi)) return '—';
  if (mi < 0.1) return `${Math.round(mi * 5280)} ft`;
  if (mi < 10)  return `${mi.toFixed(1)} mi`;
  return `${Math.round(mi)} mi`;
}

/** minutes → "7 min" / "<1 min" */
function fmtMin(min) {
  if (min == null || !isFinite(min)) return '—';
  if (min < 1) return '<1 min';
  return `${Math.round(min)} min`;
}

/** initials from a name */
function getInitials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

/** first token of a name */
function firstName(name) {
  if (!name) return 'Rider';
  return name.trim().split(/\s+/)[0];
}

/** tier object for a $/mi value */
function tierForRate(perMile) {
  if (perMile == null) return RATE_TIERS[1];
  let t = RATE_TIERS[0];
  for (const tier of RATE_TIERS) if (perMile >= tier.min) t = tier;
  return t;
}

/** fire a haptic pulse if the platform supports it */
function haptic(pattern) {
  try { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern); } catch (e) {}
}

/** total length (mi) of a [lng,lat][] path */
function pathLengthMi(coords) {
  let s = 0;
  for (let i = 1; i < coords.length; i++) {
    s += haversineMi(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
  }
  return s;
}

/** parse a server "3.2 mi" / "1,240 ft" distance string → miles (number|null) */
function parseDistanceMi(text) {
  if (!text) return null;
  const m = String(text).replace(/,/g, '').match(/([\d.]+)\s*(mi|ft|km|m)?/i);
  if (!m) return null;
  const v = parseFloat(m[1]);
  if (!isFinite(v)) return null;
  const unit = (m[2] || 'mi').toLowerCase();
  if (unit === 'mi') return v;
  if (unit === 'ft') return v / 5280;
  if (unit === 'km') return v * 0.621371;
  if (unit === 'm')  return v * 0.000621371;
  return v;
}

/** parse a server "7 min" ETA string → minutes (number|null) */
function parseEtaMin(text) {
  if (!text) return null;
  const m = String(text).match(/([\d.]+)\s*(min|hr|h)?/i);
  if (!m) return null;
  const v = parseFloat(m[1]);
  if (!isFinite(v)) return null;
  const unit = (m[2] || 'min').toLowerCase();
  if (unit === 'hr' || unit === 'h') return v * 60;
  return v;
}

// ─── mapbox loader (deduped) ─────────────────────────────────────────────────
let _mbReady = false;
let _mbQueue = [];
function loadMapbox(cb) {
  if (_mbReady && window.mapboxgl) { cb(); return; }
  _mbQueue.push(cb);
  if (document.getElementById('trm2-mb-script')) return;
  const link = document.createElement('link');
  link.rel  = 'stylesheet';
  link.href = `https://api.mapbox.com/mapbox-gl-js/${MB_VERSION}/mapbox-gl.css`;
  document.head.appendChild(link);
  const script = document.createElement('script');
  script.id     = 'trm2-mb-script';
  script.src    = `https://api.mapbox.com/mapbox-gl-js/${MB_VERSION}/mapbox-gl.js`;
  script.onload = () => { _mbReady = true; _mbQueue.forEach(fn => fn()); _mbQueue = []; };
  document.head.appendChild(script);
}

// ─── driver puck DOM factory (mirrors ActiveTripScreen) ──────────────────────
function makeDriverPuckEl() {
  const outer = document.createElement('div');
  outer.style.cssText = [
    'position:relative', 'width:50px', 'height:50px',
    'display:flex', 'align-items:center', 'justify-content:center',
    'pointer-events:none',
  ].join(';');

  const glow = document.createElement('div');
  glow.style.cssText = [
    'position:absolute', 'inset:-10px', 'border-radius:50%',
    'background:radial-gradient(circle,rgba(74,222,128,.45) 0%,transparent 68%)',
  ].join(';');

  const ring = document.createElement('div');
  ring.style.cssText = [
    'position:absolute', 'inset:2px', 'border-radius:50%',
    'border:2px solid rgba(74,222,128,.45)',
    'animation:trm2-pulse 1.9s ease-in-out infinite',
  ].join(';');

  const rot = document.createElement('div');
  rot.style.cssText = [
    'position:absolute', 'inset:0', 'display:flex', 'align-items:center', 'justify-content:center',
    'transform:rotate(0deg)', 'transition:transform .25s linear', 'will-change:transform',
  ].join(';');

  const body = document.createElement('div');
  body.style.cssText = [
    'position:relative', 'width:40px', 'height:40px', 'border-radius:50%',
    'background:linear-gradient(145deg,#4ADE80 0%,#16A34A 100%)',
    'border:3px solid #fff',
    'box-shadow:0 4px 18px rgba(34,197,94,.75),0 2px 6px rgba(0,0,0,.5)',
    'display:flex', 'align-items:center', 'justify-content:center', 'z-index:1',
  ].join(';');
  body.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2 5 21l7-4 7 4z"/>
    </svg>`;

  rot.appendChild(body);
  outer.appendChild(glow);
  outer.appendChild(ring);
  outer.appendChild(rot);

  // expose a rotate hook (used when we have a live heading)
  outer._rotate = (deg) => { rot.style.transform = `rotate(${deg}deg)`; };
  return outer;
}

// ─── pickup pin + radar ping DOM factories ───────────────────────────────────
function makePickupLabelEl() {
  const el = document.createElement('div');
  el.style.cssText = 'display:flex;flex-direction:column;align-items:center;pointer-events:none;';
  el.innerHTML = `
    <div style="
      padding:4px 9px;border-radius:7px;white-space:nowrap;
      background:rgba(3,6,4,.9);border:1.5px solid rgba(74,222,128,.55);
      box-shadow:0 4px 14px rgba(0,0,0,.55),0 0 12px rgba(74,222,128,.28);
      color:#4ADE80;font-family:'JetBrains Mono',monospace;
      font-size:10px;font-weight:800;letter-spacing:.04em;">
      ● PICKUP
    </div>
    <div style="width:2px;height:10px;background:rgba(74,222,128,.5);margin-top:-1px;"></div>
    <div style="width:7px;height:7px;border-radius:50%;background:#4ADE80;box-shadow:0 0 9px #4ADE80;"></div>
  `;
  return el;
}

function makePickupPingEl() {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;width:0;height:0;pointer-events:none;';
  for (let i = 0; i < 3; i++) {
    const r = document.createElement('div');
    r.style.cssText = [
      'position:absolute', 'left:0', 'top:0', 'transform:translate(-50%,-50%)',
      'width:20px', 'height:20px', 'border-radius:50%',
      'border:1.5px solid rgba(74,222,128,.5)',
      `animation:trm2-ping 2.8s ${i * 0.9}s cubic-bezier(0,.4,.6,1) infinite`,
    ].join(';');
    wrap.appendChild(r);
  }
  return wrap;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FULL-SCREEN MAPBOX BACKGROUND
// Mounts once, stays alive. The route (driver→pickup) draws in + flows; the
// pickup pings; the driver puck tracks the live position; refits when the panel
// switches between compact and expanded so the route stays well-framed.
// ═══════════════════════════════════════════════════════════════════════════════
function FullscreenMap({
  driverLat, driverLng, driverHeading,
  pickupLat, pickupLng, polyline, compact, onReady,
}) {
  const containerRef   = useRef(null);
  const mapRef         = useRef(null);
  const pickupMkrsRef  = useRef([]);
  const driverMkrRef   = useRef(null);
  const driverElRef    = useRef(null);
  const initRef        = useRef(false);
  const styleReadyRef  = useRef(false);
  const pendingRef     = useRef([]);
  const drawRafRef     = useRef(0);
  const dashRafRef     = useRef(0);
  const dashStepRef    = useRef(0);
  const lastDashRef    = useRef(0);
  const drawnRef       = useRef(false);
  const fitRef         = useRef(null);   // {coords, endpoints} for refit

  const routeCoords = useMemo(() => {
    if (!polyline) return [];
    return decodePolyline(polyline).map(p => [p[1], p[0]]);
  }, [polyline]);

  // ── init map once ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (initRef.current || !containerRef.current) return;
    loadMapbox(() => {
      if (initRef.current || !containerRef.current) return;
      initRef.current = true;
      window.mapboxgl.accessToken = MAPBOX_TOKEN;

      const ctr = (driverLng && driverLat) ? [driverLng, driverLat]
                : (pickupLng && pickupLat) ? [pickupLng, pickupLat]
                : [-81.3792, 28.5383];

      mapRef.current = new window.mapboxgl.Map({
        container:          containerRef.current,
        style:              MAP_STYLE,
        center:             ctr,
        zoom:               11.5,      // start pulled back…
        pitch:              52,
        bearing:            -12,
        interactive:        false,
        attributionControl: false,
        fadeDuration:       300,
      });

      mapRef.current.on('load', () => {
        styleReadyRef.current = true;
        // …then ease in for a cinematic reveal
        try { mapRef.current.easeTo({ zoom: 13.5, duration: 1100, easing: easeOutCubic }); } catch (e) {}
        onReady?.();
        pendingRef.current.forEach(fn => fn());
        pendingRef.current = [];
      });
    });

    return () => {
      cancelAnimationFrame(drawRafRef.current);
      cancelAnimationFrame(dashRafRef.current);
      pickupMkrsRef.current.forEach(m => { try { m.remove(); } catch (e) {} });
      pickupMkrsRef.current = [];
      if (driverMkrRef.current) { try { driverMkrRef.current.remove(); } catch (e) {} driverMkrRef.current = null; }
      if (mapRef.current) {
        try { mapRef.current.remove(); } catch (e) {}
        mapRef.current = null;
        initRef.current = false;
        styleReadyRef.current = false;
        drawnRef.current = false;
      }
    };
  // eslint-disable-next-line
  }, []);

  // ── run fn now if style ready, else queue ───────────────────────────────────
  const whenReady = useCallback((fn) => {
    if (styleReadyRef.current && mapRef.current) fn();
    else pendingRef.current.push(fn);
  }, []);

  // ── flowing-dash loop (independent of geometry) ─────────────────────────────
  const startDashFlow = useCallback(() => {
    cancelAnimationFrame(dashRafRef.current);
    const loop = (now) => {
      dashRafRef.current = requestAnimationFrame(loop);
      const map = mapRef.current;
      if (!map || !map.getLayer('trm-dash')) return;
      if (now - lastDashRef.current < DASH_THROTTLE_MS) return;
      lastDashRef.current = now;
      dashStepRef.current = (dashStepRef.current + 1) % DASH_FRAMES.length;
      try { map.setPaintProperty('trm-dash', 'line-dasharray', DASH_FRAMES[dashStepRef.current]); } catch (e) {}
    };
    dashRafRef.current = requestAnimationFrame(loop);
  }, []);

  // ── compute + apply a fitBounds for the current geometry + panel mode ───────
  const applyFit = useCallback((immediate) => {
    const map = mapRef.current;
    const fit = fitRef.current;
    if (!map || !fit || !fit.pts || fit.pts.length < 2) return;
    const lngs = fit.pts.map(p => p[0]);
    const lats = fit.pts.map(p => p[1]);
    map.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      {
        padding: {
          top: 180,
          bottom: compact ? FIT_BOTTOM_COMPACT : FIT_BOTTOM_EXPAND,
          left: 60, right: 60,
        },
        maxZoom: 15.5, pitch: 52, duration: immediate ? 0 : 850,
      },
    );
  // eslint-disable-next-line
  }, [compact]);

  // ── draw / update route with an animated draw-in ────────────────────────────
  useEffect(() => {
    if (!routeCoords.length) return;

    whenReady(() => {
      const map = mapRef.current;
      if (!map) return;

      const fullGeo = (coords) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords } });

      // create layers once
      if (!map.getSource('trm-route')) {
        map.addSource('trm-route', { type: 'geojson', data: fullGeo([routeCoords[0], routeCoords[0]]) });
        map.addLayer({
          id: 'trm-glow', type: 'line', source: 'trm-route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': C.green, 'line-width': 18, 'line-opacity': 0.13, 'line-blur': 10 },
        });
        map.addLayer({
          id: 'trm-main', type: 'line', source: 'trm-route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': C.greenBright, 'line-width': 5, 'line-opacity': 1 },
        });
        map.addLayer({
          id: 'trm-dash', type: 'line', source: 'trm-route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#EAFFF2', 'line-width': 2, 'line-opacity': 0.5, 'line-dasharray': [0, 4, 3] },
        });
        startDashFlow();
      }

      // remember geometry for refit (route + endpoints)
      const pts = [...routeCoords];
      if (driverLat && driverLng) pts.push([driverLng, driverLat]);
      if (pickupLat && pickupLng) pts.push([pickupLng, pickupLat]);
      fitRef.current = { pts };
      applyFit(false);

      // animate the line drawing itself in (index-sliced)
      cancelAnimationFrame(drawRafRef.current);
      const total = routeCoords.length;
      const src   = () => map.getSource('trm-route');
      if (total <= 2 || drawnRef.current) {
        src()?.setData(fullGeo(routeCoords));
        drawnRef.current = true;
      } else {
        const start = performance.now();
        const step = (now) => {
          const t = Math.min(1, (now - start) / DRAW_MS);
          const n = Math.max(2, Math.floor(easeOutCubic(t) * total));
          src()?.setData(fullGeo(routeCoords.slice(0, n)));
          if (t < 1) drawRafRef.current = requestAnimationFrame(step);
          else { src()?.setData(fullGeo(routeCoords)); drawnRef.current = true; }
        };
        drawRafRef.current = requestAnimationFrame(step);
      }
    });
  // eslint-disable-next-line
  }, [routeCoords]);

  // ── refit when the panel mode (compact/expanded) changes ─────────────────────
  useEffect(() => {
    whenReady(() => applyFit(false));
  // eslint-disable-next-line
  }, [compact]);

  // ── place pickup markers once geometry known ─────────────────────────────────
  useEffect(() => {
    whenReady(() => {
      const map = mapRef.current;
      if (!map) return;

      pickupMkrsRef.current.forEach(m => { try { m.remove(); } catch (e) {} });
      pickupMkrsRef.current = [];

      if (pickupLat && pickupLng) {
        pickupMkrsRef.current.push(
          new window.mapboxgl.Marker({ element: makePickupPingEl(), anchor: 'center' })
            .setLngLat([pickupLng, pickupLat]).addTo(map),
        );
        pickupMkrsRef.current.push(
          new window.mapboxgl.Marker({ element: makePickupLabelEl(), anchor: 'bottom' })
            .setLngLat([pickupLng, pickupLat]).addTo(map),
        );
      }
    });
  // eslint-disable-next-line
  }, [pickupLat, pickupLng]);

  // ── driver puck: create once, then track live position/heading ───────────────
  useEffect(() => {
    whenReady(() => {
      const map = mapRef.current;
      if (!map || typeof driverLng !== 'number' || typeof driverLat !== 'number') return;

      if (!driverMkrRef.current) {
        const el = makeDriverPuckEl();
        driverElRef.current = el;
        driverMkrRef.current = new window.mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([driverLng, driverLat]).addTo(map);
      } else {
        driverMkrRef.current.setLngLat([driverLng, driverLat]);
      }
      if (driverElRef.current && typeof driverHeading === 'number' && driverElRef.current._rotate) {
        driverElRef.current._rotate(driverHeading);
      }
    });
  // eslint-disable-next-line
  }, [driverLat, driverLng, driverHeading]);

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RADAR SWEEP — slow rotating conic overlay over the map (incoming-signal feel)
// ═══════════════════════════════════════════════════════════════════════════════
function RadarSweep({ active }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none',
      overflow: 'hidden', opacity: active ? 1 : 0, transition: 'opacity .6s ease',
    }}>
      <div style={{
        position: 'absolute', top: '38%', left: '50%',
        width: '160vmax', height: '160vmax',
        transform: 'translate(-50%,-50%)',
        background: 'conic-gradient(from 0deg, transparent 0deg, rgba(74,222,128,.10) 28deg, rgba(74,222,128,.02) 46deg, transparent 60deg)',
        animation: 'trm2-sweep 6.5s linear infinite',
        maskImage: 'radial-gradient(circle at center, #000 12%, transparent 62%)',
        WebkitMaskImage: 'radial-gradient(circle at center, #000 12%, transparent 62%)',
      }}/>
      {[0.18, 0.34, 0.5].map((r, i) => (
        <div key={i} style={{
          position: 'absolute', top: '38%', left: '50%',
          width: `${r * 200}vmin`, height: `${r * 200}vmin`,
          transform: 'translate(-50%,-50%)', borderRadius: '50%',
          border: '1px solid rgba(74,222,128,.05)',
        }}/>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPASS-TO-PICKUP — bearing arrow + cardinal direction
// ═══════════════════════════════════════════════════════════════════════════════
function CompassToPickup({ bearing, distanceMi }) {
  if (bearing == null) return null;
  return (
    <div style={{
      position: 'absolute', top: 'calc(58px + env(safe-area-inset-top))', left: 14, zIndex: 21,
      display: 'flex', alignItems: 'center', gap: 9,
      background: C.panelDeep, backdropFilter: 'blur(12px)',
      border: '1px solid rgba(74,222,128,.25)', borderRadius: 14, padding: '7px 11px 7px 8px',
      boxShadow: '0 6px 20px rgba(0,0,0,.5)',
      animation: 'trm2-fadein .5s .15s ease both', pointerEvents: 'none',
    }}>
      <div style={{ position: 'relative', width: 34, height: 34, flexShrink: 0 }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: '1.5px solid rgba(74,222,128,.25)',
          background: 'radial-gradient(circle, rgba(74,222,128,.08), transparent 70%)',
        }}/>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          transform: `rotate(${bearing}deg)`, transition: 'transform .6s cubic-bezier(.34,1.1,.64,1)',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke={C.greenBright} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3 18 21 12 17 6 21z" fill={C.greenBright} fillOpacity="0.18"/>
          </svg>
        </div>
      </div>
      <div>
        <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 800, color: C.greenBright, lineHeight: 1 }}>
          {cardinal(bearing)}
        </div>
        <div style={{ fontFamily: COND, fontSize: 8, fontWeight: 800, letterSpacing: '.12em', color: C.inkDim, marginTop: 3 }}>
          {distanceMi != null ? `${distanceMi.toFixed(1)} MI OUT` : 'TO PICKUP'}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIMER RING — escalates to red as time runs out
// ═══════════════════════════════════════════════════════════════════════════════
function TimerRing({ timer, total = 60 }) {
  const R    = 20;
  const circ = 2 * Math.PI * R;
  const pct  = clamp01(timer / total);
  const danger = timer <= DANGER_AT;
  const warn   = timer <= WARN_AT && !danger;
  const stroke = danger ? C.redDeep : warn ? C.amberBright : C.greenBright;

  return (
    <div style={{ position: 'relative', width: 52, height: 52, flexShrink: 0 }}>
      <svg width="52" height="52" viewBox="0 0 52 52" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="26" cy="26" r={R} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="3" />
        <circle cx="26" cy="26" r={R} fill="none"
          stroke={stroke} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 1s linear, stroke .3s ease', filter: `drop-shadow(0 0 5px ${stroke}aa)` }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: MONO, fontSize: 15, fontWeight: 700,
        color: danger ? C.redDeep : C.white, borderRadius: '50%',
        animation: danger ? 'trm2-alert 1s ease-in-out infinite' : 'none',
        transition: 'color .3s',
      }}>
        {Math.max(0, timer)}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE RAIL
// ═══════════════════════════════════════════════════════════════════════════════
function RouteRail() {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0, paddingTop:3, gap:0 }}>
      <div style={{ width:9, height:9, borderRadius:'50%', background:C.greenBright, border:'1.5px solid rgba(255,255,255,.6)', boxShadow:`0 0 8px ${C.greenBright}` }} />
      <div style={{ width:1.5, height:26, background:`linear-gradient(to bottom, ${C.greenBright}55, rgba(255,255,255,.1))`, margin:'4px 0', borderRadius:2 }} />
      <div style={{ width:9, height:9, background:'rgba(255,255,255,.7)', transform:'rotate(45deg)', boxShadow:'0 0 6px rgba(255,255,255,.35)' }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADDRESS ROW — redacted until accepted, then revealed
// ═══════════════════════════════════════════════════════════════════════════════
function AddressRow({ label, raw, accepted, dimmed }) {
  const display    = accepted ? maskAddress(raw) : redactAddress(raw);
  const isRedacted = !accepted;

  return (
    <div>
      <div style={{
        fontFamily: COND, fontSize: 8, fontWeight: 800, letterSpacing: '.14em',
        color: C.inkDim, textTransform: 'uppercase', marginBottom: 2,
        display: 'flex', alignItems: 'center', gap: 5,
      }}>
        {label}
        {isRedacted && (
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={C.inkDim} strokeWidth="2.4">
            <rect x="5" y="11" width="14" height="9" rx="2"/>
            <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
          </svg>
        )}
      </div>
      <div style={{
        fontFamily: MONO, fontSize: 12,
        fontWeight: dimmed ? 600 : 700,
        color: isRedacted ? 'rgba(255,255,255,.34)' : dimmed ? 'rgba(255,255,255,.5)' : C.white,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        letterSpacing: isRedacted ? '.06em' : 'normal',
        transition: 'color .35s ease, letter-spacing .35s ease',
      }}>
        {display}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// METRIC TILE + SKELETON
// ═══════════════════════════════════════════════════════════════════════════════
function MetricTile({ label, value, accent, loading }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 0, flex: 1 }}>
      {loading ? (
        <div style={{
          height: 15, width: 46, margin: '0 auto', borderRadius: 5,
          background: 'linear-gradient(90deg,rgba(255,255,255,.05) 25%,rgba(255,255,255,.12) 50%,rgba(255,255,255,.05) 75%)',
          backgroundSize: '200% 100%', animation: 'trm2-shimmer 1.4s ease-in-out infinite',
        }}/>
      ) : (
        <div style={{
          fontFamily: MONO, fontSize: 14, fontWeight: 800, color: accent || C.white, lineHeight: 1.15,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {value}
        </div>
      )}
      <div style={{ fontFamily: COND, fontSize: 8, fontWeight: 800, letterSpacing: '.13em', color: C.inkDim, marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT CHIP
// ═══════════════════════════════════════════════════════════════════════════════
function Chip({ color, bg, border, children, icon }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: bg, border: `1px solid ${border}`, borderRadius: 7, padding: '3px 8px',
      fontFamily: COND, fontSize: 10, fontWeight: 800, letterSpacing: '.08em', color,
    }}>
      {icon}{children}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RIDER CARD — avatar, first name, rating, trips (fetched from account)
// ═══════════════════════════════════════════════════════════════════════════════
const cardWrap = {
  display: 'flex', alignItems: 'center', gap: 11,
  background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)',
  borderRadius: 14, padding: '9px 13px', marginBottom: 12,
};
const avatar = {
  width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '0 3px 14px rgba(0,0,0,.4)',
};

function RiderCard({ rider, loading, compact }) {
  if (loading) {
    return (
      <div style={{ ...cardWrap, marginBottom: compact ? 10 : 12 }}>
        <div style={{ ...avatar, background: 'rgba(255,255,255,.06)', animation: 'trm2-shimmer 1.4s ease-in-out infinite', backgroundSize: '200% 100%' }}/>
        <div style={{ flex: 1 }}>
          <div style={{ height: 12, width: '52%', borderRadius: 4, background: 'rgba(255,255,255,.08)', marginBottom: 6 }}/>
          <div style={{ height: 9, width: '34%', borderRadius: 4, background: 'rgba(255,255,255,.05)' }}/>
        </div>
      </div>
    );
  }
  if (!rider) return null;
  const rating = typeof rider.rating === 'number' ? rider.rating.toFixed(1) : null;
  const trips  = typeof rider.totalRides === 'number' ? rider.totalRides
               : typeof rider.tripsCount === 'number' ? rider.tripsCount : null;

  return (
    <div style={{ ...cardWrap, marginBottom: compact ? 10 : 12, padding: compact ? '7px 11px' : '9px 13px' }}>
      <div style={{ ...avatar, width: compact ? 32 : 38, height: compact ? 32 : 38, background: 'linear-gradient(135deg,#8B5CF6 0%,#4C1D95 100%)', border: '2px solid rgba(255,255,255,.6)' }}>
        <span style={{ fontFamily: MONO, fontSize: compact ? 12 : 14, fontWeight: 800, color: '#fff' }}>{getInitials(rider.name)}</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: COND, fontSize: compact ? 14 : 15, fontWeight: 800, letterSpacing: '.03em', color: C.white, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {firstName(rider.name)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 5 }}>
          {rating && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill={C.amberBright}>
                <polygon points="12 2 15 9 22 9 16.5 13.5 18.5 21 12 16.5 5.5 21 7.5 13.5 2 9 9 9"/>
              </svg>
              <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: C.amberBright }}>{rating}</span>
            </span>
          )}
          {trips != null && (
            <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: C.ink }}>
              {trips} <span style={{ fontFamily: COND, fontWeight: 700, letterSpacing: '.08em', color: C.inkDim }}>TRIPS</span>
            </span>
          )}
        </div>
      </div>
      <span style={{ fontFamily: COND, fontSize: 8, fontWeight: 800, letterSpacing: '.14em', color: C.inkDim }}>RIDER</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EARNINGS-QUALITY GAUGE — where this ride's $/mi sits across tiers
// ═══════════════════════════════════════════════════════════════════════════════
function EarningsGauge({ perMile }) {
  if (perMile == null) return null;
  const tier = tierForRate(perMile);
  const fill = clamp01(perMile / GAUGE_MAX_PER_MI);

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontFamily: COND, fontSize: 9, fontWeight: 800, letterSpacing: '.14em', color: C.inkDim }}>
          EARNINGS QUALITY
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, color: tier.color }}>
            {money(perMile)}<span style={{ color: C.ink, fontWeight: 600 }}>/mi</span>
          </span>
          <span style={{
            fontFamily: COND, fontSize: 9, fontWeight: 900, letterSpacing: '.12em',
            color: tier.color, background: `${tier.color}1f`, border: `1px solid ${tier.color}44`,
            borderRadius: 5, padding: '1.5px 6px',
          }}>
            {tier.label}
          </span>
        </span>
      </div>
      <div style={{ position: 'relative', height: 8, borderRadius: 6, overflow: 'hidden', background: 'rgba(255,255,255,.05)' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
          <div style={{ width: `${(1.10/GAUGE_MAX_PER_MI)*100}%`, background: 'rgba(239,68,68,.12)' }}/>
          <div style={{ width: `${((1.85-1.10)/GAUGE_MAX_PER_MI)*100}%`, background: 'rgba(251,191,36,.12)' }}/>
          <div style={{ width: `${((2.75-1.85)/GAUGE_MAX_PER_MI)*100}%`, background: 'rgba(52,211,153,.12)' }}/>
          <div style={{ flex: 1, background: 'rgba(74,222,128,.14)' }}/>
        </div>
        <div style={{
          position: 'absolute', top: 0, bottom: 0, left: 0, width: `${fill * 100}%`,
          background: `linear-gradient(90deg, ${tier.color}aa, ${tier.color})`,
          boxShadow: `0 0 10px ${tier.color}aa`,
          transition: 'width .7s cubic-bezier(.34,1.1,.64,1)',
        }}/>
        <div style={{
          position: 'absolute', top: -2, bottom: -2, left: `calc(${fill * 100}% - 1px)`,
          width: 2, background: '#fff', boxShadow: '0 0 6px rgba(255,255,255,.7)',
          transition: 'left .7s cubic-bezier(.34,1.1,.64,1)',
        }}/>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FARE BREAKDOWN — expandable line items
// ═══════════════════════════════════════════════════════════════════════════════
function prettyKey(k) {
  return String(k)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

function FareBreakdown({ trip, payout }) {
  const [open, setOpen] = useState(false);

  const rows = useMemo(() => {
    const fb = trip?.fareBreakdown;
    const out = [];
    if (fb && typeof fb === 'object') {
      for (const [k, v] of Object.entries(fb)) {
        if (typeof v === 'number') out.push({ label: prettyKey(k), value: v });
      }
    }
    if (out.length) return out;
    const total    = Number(trip?.fareTotal) || null;
    const platform = Number(trip?.platformFee) || null;
    const summary = [];
    if (total != null)    summary.push({ label: 'Rider Pays', value: total });
    if (platform != null) summary.push({ label: 'Platform Fee', value: -platform });
    summary.push({ label: 'Your Payout', value: payout, strong: true });
    return summary;
  }, [trip, payout]);

  if (!rows.length) return null;

  return (
    <div style={{ marginBottom: 12 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)',
          borderRadius: open ? '12px 12px 0 0' : 12, padding: '9px 13px', cursor: 'pointer',
          fontFamily: COND, fontSize: 10, fontWeight: 800, letterSpacing: '.12em', color: C.ink,
          transition: 'border-radius .2s',
        }}
      >
        FARE BREAKDOWN
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.ink} strokeWidth="2.4"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .25s ease' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      <div style={{
        overflow: 'hidden', maxHeight: open ? rows.length * 34 + 16 : 0,
        transition: 'max-height .3s cubic-bezier(.34,1.05,.64,1)',
        background: 'rgba(255,255,255,.02)', border: open ? '1px solid rgba(255,255,255,.06)' : '1px solid transparent',
        borderTop: 'none', borderRadius: '0 0 12px 12px',
      }}>
        <div style={{ padding: '6px 13px 10px' }}>
          {rows.map((r, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '5px 0', borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,.04)',
            }}>
              <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: r.strong ? 800 : 600, color: r.strong ? C.white : C.ink }}>
                {r.label}
              </span>
              <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 800, color: r.strong ? C.greenBright : r.value < 0 ? C.red : C.white }}>
                {r.value < 0 ? `−${money(Math.abs(r.value))}` : money(r.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PICKUP DISTANCE HERO — the headline answer to "how far am I from the pickup?"
// Appears the moment the route resolves. Shows live deadhead miles (recomputed
// from the device GPS as the driver moves) + ETA, with a stylized driver→pickup
// shape on the left. This is the primary read in the compact panel.
// ═══════════════════════════════════════════════════════════════════════════════
function PickupDistanceHero({ miles, etaMin, arrival, live, loading }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      background: `linear-gradient(135deg, rgba(34,197,94,.10), rgba(34,197,94,.03))`,
      border: `1px solid ${C.greenBright}33`,
      borderRadius: 16, padding: '11px 14px', marginBottom: 12,
      boxShadow: `inset 0 0 0 1px rgba(255,255,255,.02)`,
    }}>
      {/* driver → pickup mini shape */}
      <div style={{ position: 'relative', width: 46, height: 46, flexShrink: 0 }}>
        <svg width="46" height="46" viewBox="0 0 46 46" fill="none">
          <path d="M9 33 Q23 33 23 21 Q23 12 37 12" stroke={C.greenBright} strokeWidth="2"
            strokeLinecap="round" strokeDasharray="3 3" opacity="0.55"/>
          <circle cx="9" cy="33" r="4.5" fill={C.greenBright}/>
          <circle cx="9" cy="33" r="4.5" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.5"/>
          <path d="M37 7 l3.4 8.5 L37 13.4 L33.6 15.5 Z" fill={C.amberBright}/>
        </svg>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: COND, fontSize: 8.5, fontWeight: 800, letterSpacing: '.16em', color: C.inkDim, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
          DISTANCE TO PICKUP
          {live && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: C.greenBright }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: C.greenBright, boxShadow: `0 0 5px ${C.greenBright}`, animation: 'trm2-blink 1.4s ease-in-out infinite' }}/>
              LIVE
            </span>
          )}
        </div>
        {loading ? (
          <div style={{
            height: 22, width: 120, borderRadius: 6,
            background: 'linear-gradient(90deg,rgba(255,255,255,.05) 25%,rgba(255,255,255,.12) 50%,rgba(255,255,255,.05) 75%)',
            backgroundSize: '200% 100%', animation: 'trm2-shimmer 1.4s ease-in-out infinite',
          }}/>
        ) : (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: MONO, fontSize: 24, fontWeight: 800, color: C.greenBright, lineHeight: 1, textShadow: `0 0 16px ${C.greenBright}44` }}>
              {fmtMi(miles)}
            </span>
            {etaMin != null && (
              <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: C.greenSoft }}>
                · {fmtMin(etaMin)}
              </span>
            )}
            <span style={{ fontFamily: COND, fontSize: 9, fontWeight: 800, letterSpacing: '.1em', color: C.inkDim }}>
              AWAY
            </span>
          </div>
        )}
        {!loading && arrival && (
          <div style={{ fontFamily: COND, fontSize: 8.5, fontWeight: 700, letterSpacing: '.08em', color: C.inkFaint, marginTop: 3 }}>
            REACH PICKUP BY ~{arrival}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BIDIRECTIONAL SLIDE — right=accept, left=decline
// ═══════════════════════════════════════════════════════════════════════════════
function BidirectionalSlide({ onAccept, onDecline, pending, disabled }) {
  const trackRef    = useRef(null);
  const halfRef     = useRef(0);
  const draggingRef = useRef(false);
  const offsetRef   = useRef(0);
  const [x, setX]           = useState(0);
  const [result, setResult] = useState(null); // 'accept' | 'decline' | null
  const [nudge, setNudge]   = useState(false); // one-time idle teaching nudge

  const THUMB  = 58;
  const PAD    = 4;
  const COMMIT = 0.75;

  const measure = useCallback(() => {
    if (!trackRef.current) return;
    halfRef.current = Math.max(0, (trackRef.current.clientWidth - THUMB - PAD * 2) / 2);
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    const t  = setTimeout(() => { if (!draggingRef.current && !result) setNudge(true); }, 700);
    const t2 = setTimeout(() => setNudge(false), 1500);
    return () => { window.removeEventListener('resize', measure); clearTimeout(t); clearTimeout(t2); };
  }, [measure, result]);

  const clientX   = (e) => e.touches?.[0]?.clientX ?? e.clientX ?? 0;
  const setOffset = (px) => { offsetRef.current = px; setX(px); };

  const onDown = (e) => {
    if (pending || disabled || result) return;
    setNudge(false);
    draggingRef.current = true;
    measure();
    const startX      = clientX(e);
    const startOffset = offsetRef.current;

    const move = (ev) => {
      if (!draggingRef.current) return;
      let nx = startOffset + (clientX(ev) - startX);
      nx = Math.max(-halfRef.current, Math.min(halfRef.current, nx));
      setOffset(nx);
      if (ev.cancelable) ev.preventDefault();
    };

    const up = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);

      const ratio = halfRef.current ? offsetRef.current / halfRef.current : 0;
      if (ratio >= COMMIT) {
        setOffset(halfRef.current);
        setResult('accept');
        haptic([18, 40, 18]);
        onAccept?.();
      } else if (ratio <= -COMMIT) {
        setOffset(-halfRef.current);
        setResult('decline');
        haptic(24);
        onDecline?.();
      } else {
        setOffset(0);
      }
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', up);
  };

  const ratio        = halfRef.current ? x / halfRef.current : 0;
  const isRight      = ratio > 0;
  const isLeft       = ratio < 0;
  const acceptColor  = C.greenBright;
  const declineColor = C.redDeep;
  const activeColor  = isRight ? acceptColor : isLeft ? declineColor : acceptColor;

  return (
    <div style={{ position: 'relative', userSelect: 'none' }}>
      {/* end labels */}
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8, padding:'0 2px' }}>
        <span style={{
          fontFamily: COND, fontSize: 10, fontWeight: 800, letterSpacing: '.14em',
          color: isLeft ? declineColor : 'rgba(255,255,255,.22)', transition: 'color .2s',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {[0,1,2].map(i => (
            <svg key={i} width="9" height="9" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
              style={{ animation:`trm2-chev-left 1.3s ${i*.14}s ease-in-out infinite` }}>
              <polyline points="15 6 9 12 15 18"/>
            </svg>
          ))}
          DECLINE
        </span>
        <span style={{
          fontFamily: COND, fontSize: 10, fontWeight: 800, letterSpacing: '.14em',
          color: isRight ? acceptColor : 'rgba(255,255,255,.22)', transition: 'color .2s',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          ACCEPT
          {[0,1,2].map(i => (
            <svg key={i} width="9" height="9" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
              style={{ animation:`trm2-chev-right 1.3s ${i*.14}s ease-in-out infinite` }}>
              <polyline points="9 6 15 12 9 18"/>
            </svg>
          ))}
        </span>
      </div>

      {/* track */}
      <div
        ref={trackRef}
        style={{
          position: 'relative', width: '100%', height: THUMB + PAD * 2, borderRadius: 20,
          background: 'rgba(255,255,255,.04)',
          border: isRight ? `1px solid ${acceptColor}44` : isLeft ? `1px solid ${declineColor}44` : '1px solid rgba(255,255,255,.1)',
          overflow: 'hidden', transition: 'border-color .2s', touchAction: 'none',
        }}
      >
        {/* idle shimmer sweep */}
        {!pending && !result && x === 0 && (
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,.06) 50%, transparent 60%)',
            backgroundSize: '200% 100%', animation: 'trm2-shimmer 3.4s ease-in-out infinite',
          }}/>
        )}
        {/* decline fill (left) */}
        <div style={{
          position:'absolute', top:0, bottom:0, right:'50%',
          width: isLeft ? `${Math.abs(ratio) * 50}%` : 0,
          background: `linear-gradient(to left, ${declineColor}33, ${declineColor}18)`,
          transition: draggingRef.current ? 'none' : 'width .25s cubic-bezier(.34,1.1,.64,1)',
        }}/>
        {/* accept fill (right) */}
        <div style={{
          position:'absolute', top:0, bottom:0, left:'50%',
          width: isRight ? `${ratio * 50}%` : 0,
          background: `linear-gradient(to right, ${acceptColor}33, ${acceptColor}18)`,
          transition: draggingRef.current ? 'none' : 'width .25s cubic-bezier(.34,1.1,.64,1)',
        }}/>
        {/* center notch */}
        <div style={{
          position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
          width:1.5, height:28, borderRadius:2, background:'rgba(255,255,255,.14)', pointerEvents:'none',
        }}/>

        {/* thumb */}
        <div
          onPointerDown={onDown}
          onTouchStart={onDown}
          style={{
            position:'absolute', top:PAD,
            left:`calc(50% - ${THUMB/2}px + ${x + (nudge ? 7 : 0)}px)`,
            width:THUMB, height:THUMB, borderRadius:16,
            background: result === 'accept'  ? `linear-gradient(135deg, ${acceptColor}, #16A34A)`
                      : result === 'decline' ? `linear-gradient(135deg, ${declineColor}, #B91C1C)`
                      : pending              ? 'rgba(255,255,255,.1)'
                      : `linear-gradient(135deg, ${activeColor}ee, ${activeColor}99)`,
            boxShadow: pending ? 'none'
              : result === 'accept'  ? `0 4px 20px ${acceptColor}66, inset 0 1px 0 rgba(255,255,255,.3)`
              : result === 'decline' ? `0 4px 20px ${declineColor}66, inset 0 1px 0 rgba(255,255,255,.2)`
              : `0 4px 20px ${activeColor}55, inset 0 1px 0 rgba(255,255,255,.25)`,
            display:'flex', alignItems:'center', justifyContent:'center',
            cursor: pending || result ? 'default' : 'grab', touchAction:'none',
            transition: draggingRef.current
              ? 'background .12s, box-shadow .12s'
              : 'left .3s cubic-bezier(.34,1.3,.64,1), background .2s, box-shadow .2s',
            zIndex:2,
          }}
        >
          {pending ? (
            <div style={{ width:22, height:22, borderRadius:'50%', border:'2px solid rgba(0,0,0,.25)', borderTop:'2px solid #000', animation:'trm2-spin .7s linear infinite' }}/>
          ) : result === 'accept' ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          ) : result === 'decline' ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke={x !== 0 ? '#000' : C.white} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
              style={{ opacity: x !== 0 ? 1 : 0.8 }}>
              <path d="M7 12l-4 0M3 12l3-3M3 12l3 3M17 12l4 0M21 12l-3-3M21 12l-3 3"/>
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACCEPTED OVERLAY — brief success beat before the parent swaps screens
// ═══════════════════════════════════════════════════════════════════════════════
function AcceptedOverlay({ rider }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 90,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at 50% 45%, rgba(8,20,12,.86), rgba(2,5,3,.96))',
      backdropFilter: 'blur(6px)', animation: 'trm2-fadein .25s ease both',
    }}>
      <div style={{ position: 'relative', width: 110, height: 110, marginBottom: 22 }}>
        {[0,1].map(i => (
          <div key={i} style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            border: `2px solid ${C.greenBright}`,
            animation: `trm2-burst 1.4s ${i*0.25}s cubic-bezier(0,.4,.6,1) infinite`,
          }}/>
        ))}
        <div style={{
          position: 'absolute', inset: 18, borderRadius: '50%',
          background: 'rgba(34,197,94,.18)', border: `2px solid ${C.greenBright}88`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 40px ${C.greenBright}55`,
          animation: 'trm2-checkpop .5s cubic-bezier(.34,1.8,.64,1) both',
        }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none"
            stroke={C.greenBright} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
      </div>
      <div style={{ fontFamily: COND, fontSize: 26, fontWeight: 900, letterSpacing: '.18em', color: C.greenBright, textTransform: 'uppercase' }}>
        Ride Accepted
      </div>
      <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: C.ink, marginTop: 8, letterSpacing: '.04em' }}>
        {rider?.name ? `Heading to ${firstName(rider.name)}` : 'Starting navigation…'}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPIRED OVERLAY — request timed out
// ═══════════════════════════════════════════════════════════════════════════════
function ExpiredOverlay() {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 88,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(2,5,3,.84)', backdropFilter: 'blur(5px)',
      animation: 'trm2-fadein .3s ease both',
    }}>
      <div style={{
        width: 70, height: 70, borderRadius: '50%', marginBottom: 18,
        border: '2px solid rgba(255,255,255,.18)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.5)"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
        </svg>
      </div>
      <div style={{ fontFamily: COND, fontSize: 22, fontWeight: 900, letterSpacing: '.16em', color: 'rgba(255,255,255,.6)', textTransform: 'uppercase' }}>
        Request Expired
      </div>
      <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: C.inkDim, marginTop: 8 }}>
        Passed to the next driver
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTE CALLOUT — rider's pickup instructions / special requests (if any)
// ═══════════════════════════════════════════════════════════════════════════════
function NoteCallout({ note }) {
  const text = (note || '').toString().trim();
  if (!text) return null;
  return (
    <div style={{
      display: 'flex', gap: 9, alignItems: 'flex-start',
      background: 'rgba(103,232,249,.06)', border: '1px solid rgba(103,232,249,.2)',
      borderRadius: 12, padding: '9px 12px', marginBottom: 12,
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.cyan}
        strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
        style={{ flexShrink: 0, marginTop: 1 }}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <path d="M14 2v6h6M8 13h8M8 17h6"/>
      </svg>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: COND, fontSize: 8, fontWeight: 800, letterSpacing: '.14em', color: 'rgba(103,232,249,.7)', marginBottom: 2 }}>
          RIDER NOTE
        </div>
        <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: C.white, lineHeight: 1.45 }}>
          {text}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RATE PILLS — compact $/mi · $/min read (shown in the compact panel)
// ═══════════════════════════════════════════════════════════════════════════════
function RatePills({ perMile, perMin }) {
  if (!perMile && !perMin) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {perMile != null && (
        <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: C.greenSoft }}>
          {money(perMile)}<span style={{ color: C.ink, fontWeight: 600 }}>/mi</span>
        </span>
      )}
      {perMile != null && perMin != null && (
        <span style={{ width: 1, height: 10, background: 'rgba(255,255,255,.14)' }}/>
      )}
      {perMin != null && (
        <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: C.greenSoft }}>
          {money(perMin)}<span style={{ color: C.ink, fontWeight: 600 }}>/min</span>
        </span>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PANEL GRABBER — drag handle + DETAILS toggle that expands/collapses the panel
// ═══════════════════════════════════════════════════════════════════════════════
function PanelGrabber({ expanded, onToggle }) {
  return (
    <button
      onClick={onToggle}
      aria-label={expanded ? 'Collapse details' : 'Expand details'}
      style={{
        width: '100%', background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        padding: '2px 0 8px', WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div style={{ width: 36, height: 3.5, borderRadius: 2, background: 'rgba(255,255,255,.16)' }}/>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        fontFamily: COND, fontSize: 8.5, fontWeight: 800, letterSpacing: '.16em',
        color: C.inkDim, textTransform: 'uppercase',
      }}>
        {expanded ? 'Hide details' : 'Trip details'}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .25s ease' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </span>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// useLiveDriverLocation — device GPS watch, merged over the driver prop
// Mirrors ActiveTripScreen: derives a heading from movement, tracks freshness,
// and lets the puck + deadhead distance update live while the driver decides.
// ═══════════════════════════════════════════════════════════════════════════════
function useLiveDriverLocation(driver, enabled) {
  const [fix, setFix] = useState(null);     // { lat, lng, heading, ts }
  const [live, setLive] = useState(false);
  const watchIdRef = useRef(null);
  const lastRef    = useRef(null);

  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !navigator.geolocation) return;
    let first = false;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, heading } = pos.coords;
        let hd = (typeof heading === 'number' && !isNaN(heading)) ? heading : null;
        const prev = lastRef.current;
        if (hd == null && prev) {
          const moved = haversineMi(prev.lat, prev.lng, latitude, longitude) * 1609.34;
          if (moved >= 4) hd = bearingDeg(prev.lat, prev.lng, latitude, longitude);
        }
        lastRef.current = { lat: latitude, lng: longitude };
        setFix({ lat: latitude, lng: longitude, heading: hd, ts: Date.now() });
        if (!first) { first = true; setLive(true); }
      },
      () => setLive(false),
      { enableHighAccuracy: true, maximumAge: 1500, timeout: 12000 },
    );
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    };
  }, [enabled]);

  const fresh = fix && (Date.now() - fix.ts) < STALE_FIX_MS;
  const lat = fresh ? fix.lat : driver?.lat;
  const lng = fresh ? fix.lng : driver?.lng;
  const heading = fresh ? fix.heading : null;

  return {
    lat: typeof lat === 'number' ? lat : null,
    lng: typeof lng === 'number' ? lng : null,
    heading,
    live: !!(enabled && fresh),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROXIMITY METER — thin bar reinforcing how close the pickup is (0 → 10mi scale)
// Always visible (compact + expanded); pairs with the distance hero.
// ═══════════════════════════════════════════════════════════════════════════════
function ProximityMeter({ miles, maxMi = 10 }) {
  if (miles == null || !isFinite(miles)) return null;
  const fill = clamp01(miles / maxMi);
  const color = miles <= 2 ? C.greenBright : miles <= 5 ? C.greenSoft : miles <= 8 ? C.amberBright : C.amber;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontFamily: COND, fontSize: 8, fontWeight: 800, letterSpacing: '.14em', color: C.inkDim }}>
          PICKUP PROXIMITY
        </span>
        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color }}>
          {fmtMi(miles)}
        </span>
      </div>
      <div style={{ position: 'relative', height: 5, borderRadius: 4, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: 0, bottom: 0, left: 0, width: `${fill * 100}%`,
          background: `linear-gradient(90deg, ${color}, ${color}aa)`,
          boxShadow: `0 0 8px ${color}aa`,
          transition: 'width .6s cubic-bezier(.34,1.1,.64,1), background .3s ease',
        }}/>
        {/* close-range marker at 2mi */}
        <div style={{
          position: 'absolute', top: -1, bottom: -1, left: `${(2 / maxMi) * 100}%`,
          width: 1, background: 'rgba(255,255,255,.2)',
        }}/>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
        <span style={{ fontFamily: COND, fontSize: 7, fontWeight: 700, letterSpacing: '.1em', color: C.inkFaint }}>HERE</span>
        <span style={{ fontFamily: COND, fontSize: 7, fontWeight: 700, letterSpacing: '.1em', color: C.inkFaint }}>{maxMi}+ MI</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MINI ROUTE PROFILE — a tiny sparkline of the actual driver→pickup route shape,
// drawn straight from the decoded polyline. Reads as "here's the path I'd drive."
// ═══════════════════════════════════════════════════════════════════════════════
function MiniRouteProfile({ polyline, distanceText, routeMi }) {
  const path = useMemo(() => {
    const pts = decodePolyline(polyline);          // [[lat,lng],...]
    if (pts.length < 2) return null;
    const lats = pts.map(p => p[0]);
    const lngs = pts.map(p => p[1]);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const W = 100, H = 34, pad = 4;
    const spanLat = (maxLat - minLat) || 1e-6;
    const spanLng = (maxLng - minLng) || 1e-6;
    const sx = (lng) => pad + ((lng - minLng) / spanLng) * (W - pad * 2);
    const sy = (lat) => H - pad - ((lat - minLat) / spanLat) * (H - pad * 2); // invert: north=up
    const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p[1]).toFixed(1)} ${sy(p[0]).toFixed(1)}`).join(' ');
    const start = { x: sx(pts[0][1]), y: sy(pts[0][0]) };
    const end   = { x: sx(pts[pts.length - 1][1]), y: sy(pts[pts.length - 1][0]) };
    return { d, start, end };
  }, [polyline]);

  if (!path) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12,
      background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.05)',
      borderRadius: 12, padding: '10px 13px',
    }}>
      <svg width="100" height="34" viewBox="0 0 100 34" style={{ flexShrink: 0, overflow: 'visible' }}>
        {/* faint gridlines */}
        <line x1="0" y1="17" x2="100" y2="17" stroke="rgba(255,255,255,.05)" strokeWidth="0.6"/>
        <line x1="50" y1="0" x2="50" y2="34" stroke="rgba(255,255,255,.05)" strokeWidth="0.6"/>
        <path d={path.d} fill="none" stroke={C.green} strokeWidth="3.5" strokeOpacity="0.18"
          strokeLinecap="round" strokeLinejoin="round"/>
        <path d={path.d} fill="none" stroke={C.greenBright} strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx={path.start.x} cy={path.start.y} r="3" fill={C.greenBright} stroke="#fff" strokeWidth="1" strokeOpacity="0.6"/>
        <circle cx={path.end.x} cy={path.end.y} r="3" fill={C.amberBright} stroke="#fff" strokeWidth="1" strokeOpacity="0.6"/>
      </svg>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: COND, fontSize: 8, fontWeight: 800, letterSpacing: '.14em', color: C.inkDim, marginBottom: 2 }}>
          ROUTE TO PICKUP
        </div>
        <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 800, color: C.white }}>
          {distanceText || (routeMi != null ? fmtMi(routeMi) : '—')}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EARNINGS PROJECTION — gross $/hr across the engaged time (pickup + trip).
// A driver's real decision metric: not just total fare, but fare per hour worked.
// ═══════════════════════════════════════════════════════════════════════════════
function EarningsProjection({ payout, pickupMin, tripMin }) {
  const engagedMin = (Number(pickupMin) || 0) + (Number(tripMin) || 0);
  if (!payout || engagedMin <= 0) return null;
  const perHr = payout / (engagedMin / 60);
  const SCALE_MAX = 45;                            // top of the $/hr bar
  const fill = clamp01(perHr / SCALE_MAX);
  const color = perHr >= 30 ? C.greenBright : perHr >= 20 ? C.greenSoft : perHr >= 14 ? C.amberBright : C.redDeep;
  const tier  = perHr >= 30 ? 'STRONG' : perHr >= 20 ? 'SOLID' : perHr >= 14 ? 'OK' : 'LOW';

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontFamily: COND, fontSize: 9, fontWeight: 800, letterSpacing: '.14em', color: C.inkDim }}>
          PROJECTED $/HR
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 800, color }}>
            {money(perHr)}<span style={{ color: C.ink, fontWeight: 600 }}>/hr</span>
          </span>
          <span style={{
            fontFamily: COND, fontSize: 9, fontWeight: 900, letterSpacing: '.12em',
            color, background: `${color}1f`, border: `1px solid ${color}44`,
            borderRadius: 5, padding: '1.5px 6px',
          }}>
            {tier}
          </span>
        </span>
      </div>
      <div style={{ position: 'relative', height: 6, borderRadius: 5, background: 'rgba(255,255,255,.05)', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: 0, bottom: 0, left: 0, width: `${fill * 100}%`,
          background: `linear-gradient(90deg, ${color}aa, ${color})`, boxShadow: `0 0 9px ${color}aa`,
          transition: 'width .7s cubic-bezier(.34,1.1,.64,1)',
        }}/>
        {/* reference ticks at $15 / $25 / $35 */}
        {[15, 25, 35].map(v => (
          <div key={v} style={{
            position: 'absolute', top: -1, bottom: -1, left: `${(v / SCALE_MAX) * 100}%`,
            width: 1, background: 'rgba(255,255,255,.16)',
          }}/>
        ))}
      </div>
      <div style={{ fontFamily: COND, fontSize: 8, fontWeight: 700, letterSpacing: '.08em', color: C.inkFaint, marginTop: 4 }}>
        ~{Math.round(engagedMin)} MIN ENGAGED · PICKUP + TRIP
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RIDE SIGNALS — at-a-glance decision chips computed from the trip data
// ═══════════════════════════════════════════════════════════════════════════════
function SignalChip({ tone, children }) {
  const map = {
    good:    { color: C.greenBright, bg: 'rgba(74,222,128,.10)',  border: 'rgba(74,222,128,.3)' },
    warn:    { color: C.amberBright, bg: 'rgba(251,191,36,.10)',  border: 'rgba(251,191,36,.3)' },
    neutral: { color: C.cyan,        bg: 'rgba(103,232,249,.08)', border: 'rgba(103,232,249,.25)' },
  };
  const s = map[tone] || map.neutral;
  return (
    <span style={{
      fontFamily: COND, fontSize: 9.5, fontWeight: 800, letterSpacing: '.08em',
      color: s.color, background: s.bg, border: `1px solid ${s.border}`,
      borderRadius: 7, padding: '3px 8px', whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

function RideSignals({ perMile, deadheadMi, payMethod, surge, isScheduled, isLongTrip, dropoff }) {
  const signals = [];
  if (deadheadMi != null) {
    if (deadheadMi <= 2)      signals.push({ tone: 'good', text: 'CLOSE PICKUP' });
    else if (deadheadMi >= 6) signals.push({ tone: 'warn', text: 'FAR PICKUP' });
  }
  if (perMile != null) {
    const t = tierForRate(perMile);
    signals.push({ tone: perMile >= 1.85 ? 'good' : perMile >= 1.10 ? 'neutral' : 'warn', text: `${t.label} $/MI` });
  }
  if (surge > 1)        signals.push({ tone: 'good', text: `${surge}× SURGE` });
  if (payMethod === 'cash') signals.push({ tone: 'neutral', text: 'CASH' });
  if (isScheduled)      signals.push({ tone: 'neutral', text: 'SCHEDULED' });
  if (isLongTrip)       signals.push({ tone: 'neutral', text: 'LONG HAUL' });
  // airport keyword sniff on the drop-off
  if (dropoff && /airport|\bMCO\b|terminal/i.test(String(dropoff))) {
    signals.push({ tone: 'good', text: 'AIRPORT' });
  }
  if (!signals.length) return null;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: COND, fontSize: 8, fontWeight: 800, letterSpacing: '.16em', color: C.inkDim, marginBottom: 6 }}>
        SIGNALS
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {signals.map((s, i) => <SignalChip key={i} tone={s.tone}>{s.text}</SignalChip>)}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// fmtArrivalClock — "now + N minutes" → "9:42 PM"
// ═══════════════════════════════════════════════════════════════════════════════
function fmtArrivalClock(min) {
  if (min == null || !isFinite(min)) return null;
  const d = new Date(Date.now() + min * 60000);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${m} ${ap}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAP LEGEND — tiny key for the two pins (driver vs pickup), top-right of the map
// ═══════════════════════════════════════════════════════════════════════════════
function MapLegend() {
  const Row = ({ color, label, diamond }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{
        width: 7, height: 7, borderRadius: diamond ? 0 : '50%',
        transform: diamond ? 'rotate(45deg)' : 'none',
        background: color, boxShadow: `0 0 6px ${color}`,
      }}/>
      <span style={{ fontFamily: COND, fontSize: 8, fontWeight: 800, letterSpacing: '.1em', color: C.ink }}>
        {label}
      </span>
    </span>
  );
  return (
    <div style={{
      position: 'absolute', top: 'calc(58px + env(safe-area-inset-top))', right: 14, zIndex: 21,
      display: 'flex', flexDirection: 'column', gap: 6,
      background: C.panelDeep, backdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '8px 11px',
      boxShadow: '0 6px 20px rgba(0,0,0,.5)',
      animation: 'trm2-fadein .5s .2s ease both', pointerEvents: 'none',
    }}>
      <Row color={C.greenBright} label="YOU"/>
      <Row color={C.greenBright} label="PICKUP"/>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULED COUNTDOWN — for scheduled rides, time until the scheduled pickup
// ═══════════════════════════════════════════════════════════════════════════════
function ScheduledCountdown({ scheduledAt }) {
  if (!scheduledAt) return null;
  let when;
  if (typeof scheduledAt.toDate === 'function') when = scheduledAt.toDate();
  else if (typeof scheduledAt.seconds === 'number') when = new Date(scheduledAt.seconds * 1000);
  else when = new Date(scheduledAt);
  if (isNaN(when.getTime())) return null;

  const diffMs = when.getTime() - Date.now();
  const past = diffMs <= 0;
  const mins = Math.abs(Math.round(diffMs / 60000));
  const h = Math.floor(mins / 60), m = mins % 60;
  const rel = h > 0 ? `${h}h ${m}m` : `${m}m`;
  const clock = fmtClock(scheduledAt);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
      background: 'rgba(192,132,252,.08)', border: '1px solid rgba(192,132,252,.26)',
      borderRadius: 12, padding: '9px 13px',
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.violet}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: COND, fontSize: 8, fontWeight: 800, letterSpacing: '.14em', color: 'rgba(192,132,252,.7)', marginBottom: 1 }}>
          SCHEDULED PICKUP
        </div>
        <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 800, color: C.white }}>
          {clock || '—'} <span style={{ color: C.violet }}>· {past ? `${rel} ago` : `in ${rel}`}</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXTENDED METRICS — engaged-time read: route mi, $/hr, engaged min, arrival clock
// ═══════════════════════════════════════════════════════════════════════════════
function ExtendedMetrics({ routeMi, perHr, engagedMin, arrivalClock }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'stretch', gap: 0, marginBottom: 12,
      background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.05)',
      borderRadius: 12, padding: '9px 4px',
    }}>
      <MetricTile label="ROUTE MI"  value={routeMi != null ? fmtMi(routeMi) : '—'}/>
      <div style={{ width: 1, background: 'rgba(255,255,255,.07)', margin: '2px 0' }}/>
      <MetricTile label="$/HR"      value={perHr != null ? money(perHr) : '—'} accent={C.greenSoft}/>
      <div style={{ width: 1, background: 'rgba(255,255,255,.07)', margin: '2px 0' }}/>
      <MetricTile label="ENGAGED"   value={engagedMin != null ? `${Math.round(engagedMin)} min` : '—'}/>
      <div style={{ width: 1, background: 'rgba(255,255,255,.07)', margin: '2px 0' }}/>
      <MetricTile label="PICKUP BY" value={arrivalClock || '—'} accent={C.greenBright}/>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DECISION HINT — a single plain-language read of the ride (always visible)
// ═══════════════════════════════════════════════════════════════════════════════
function DecisionHint({ perMile, deadheadMi, surge }) {
  if (perMile == null && deadheadMi == null) return null;
  let tone = 'neutral', text = 'Review the numbers and decide.';
  const closeP = deadheadMi != null && deadheadMi <= 2;
  const farP   = deadheadMi != null && deadheadMi >= 6;
  const goodR  = perMile != null && perMile >= 1.85;
  const lowR   = perMile != null && perMile < 1.10;

  if (goodR && closeP)      { tone = 'good';    text = 'Close pickup, strong rate — a good grab.'; }
  else if (goodR && !farP)  { tone = 'good';    text = 'Solid rate for the distance.'; }
  else if (lowR && farP)    { tone = 'warn';    text = 'Long pickup for a low rate — weigh it.'; }
  else if (farP)            { tone = 'warn';    text = 'Pickup is a fair way out.'; }
  else if (surge > 1)       { tone = 'good';    text = 'Surge is active on this one.'; }

  const color = tone === 'good' ? C.greenBright : tone === 'warn' ? C.amberBright : C.ink;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
      fontFamily: COND, fontSize: 11, fontWeight: 600, letterSpacing: '.04em', color: C.ink,
    }}>
      <span style={{ color, fontSize: 13, lineHeight: 1 }}>›</span>
      <span><span style={{ color, fontWeight: 800 }}>{text}</span></span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EARNINGS DONUT — your payout as a share of what the rider pays (your cut)
// Complements the line-item breakdown with a single at-a-glance ratio.
// ═══════════════════════════════════════════════════════════════════════════════
function EarningsDonut({ payout, fareTotal }) {
  const total = Number(fareTotal) || 0;
  const pay   = Number(payout) || 0;
  if (total <= 0 || pay <= 0 || pay > total * 1.5) return null;   // need a sane ratio
  const frac  = clamp01(pay / total);
  const R = 26, CIRC = 2 * Math.PI * R;
  const dash = `${frac * CIRC} ${CIRC}`;
  const pct  = Math.round(frac * 100);
  const platformCut = Math.max(0, total - pay);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12,
      background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.05)',
      borderRadius: 12, padding: '11px 13px',
    }}>
      <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }}>
        <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="32" cy="32" r={R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="7"/>
          <circle cx="32" cy="32" r={R} fill="none"
            stroke={C.greenBright} strokeWidth="7" strokeLinecap="round"
            strokeDasharray={dash}
            style={{ transition: 'stroke-dasharray .7s cubic-bezier(.34,1.1,.64,1)', filter: `drop-shadow(0 0 4px ${C.greenBright}88)` }}/>
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 800, color: C.white, lineHeight: 1 }}>{pct}%</span>
          <span style={{ fontFamily: COND, fontSize: 7, fontWeight: 800, letterSpacing: '.1em', color: C.inkDim, marginTop: 1 }}>YOUR CUT</span>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: C.greenBright }}/>
            <span style={{ fontFamily: COND, fontSize: 10, fontWeight: 700, letterSpacing: '.06em', color: C.ink }}>You keep</span>
          </span>
          <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 800, color: C.greenBright }}>{money(pay)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(255,255,255,.18)' }}/>
            <span style={{ fontFamily: COND, fontSize: 10, fontWeight: 700, letterSpacing: '.06em', color: C.inkDim }}>Platform + fees</span>
          </span>
          <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: C.ink }}>{money(platformCut)}</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRIP TYPE ROW — ride class, payment, and seats at a glance (expanded)
// ═══════════════════════════════════════════════════════════════════════════════
function TripTypeRow({ label, payCfg, seats, rideColor }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
      background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.05)',
      borderRadius: 12, padding: '9px 13px',
    }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontFamily: COND, fontSize: 10, fontWeight: 800, letterSpacing: '.1em',
        color: rideColor, background: `${rideColor}14`, border: `1px solid ${rideColor}33`,
        borderRadius: 7, padding: '3px 9px',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: rideColor, boxShadow: `0 0 6px ${rideColor}` }}/>
        {(label || 'RIDE').toUpperCase()}
      </span>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        fontFamily: MONO, fontSize: 10, fontWeight: 800, letterSpacing: '.06em',
        color: payCfg.color, background: payCfg.bg, border: `1px solid ${payCfg.border}`,
        borderRadius: 7, padding: '3px 9px',
      }}>
        <span>{payCfg.icon}</span>{payCfg.label}
      </span>
      {seats != null && Number(seats) > 0 && (
        <span style={{
          marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4,
          fontFamily: MONO, fontSize: 11, fontWeight: 700, color: C.ink,
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.ink}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          {seats} <span style={{ fontFamily: COND, fontWeight: 700, letterSpacing: '.08em', color: C.inkDim }}>PAX</span>
        </span>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function TripRequestModal({
  driver,
  tripRequest,
  requestTimer,
  onAccept,
  onDecline,
  actionPending = false,
  useDeviceLocation = true,
}) {
  const [polyline,     setPolyline]     = useState(null);
  const [driverDist,   setDriverDist]   = useState(null);
  const [driverEta,    setDriverEta]    = useState(null);
  const [loadingGeo,   setLoadingGeo]   = useState(false);
  const [accepted,     setAccepted]     = useState(false);
  const [mapReady,     setMapReady]     = useState(false);
  const [displayFare,  setDisplayFare]  = useState(0);   // count-up value
  const [rider,        setRider]        = useState(null);
  const [riderLoading, setRiderLoading] = useState(false);
  const [panelExpanded, setPanelExpanded] = useState(true);  // collapses on polyline

  const prevTripId     = useRef(null);
  const fareRafRef     = useRef(0);
  const dangerFiredRef = useRef(false);
  const autoCollapsedRef = useRef(false);

  const payout = Number(tripRequest?.driverPayout) || 0;

  // ── live driver location (device GPS over prop) ──────────────────────────────
  const liveDriver = useLiveDriverLocation(driver, useDeviceLocation && !accepted);
  const dLat = liveDriver.lat ?? driver?.lat ?? null;
  const dLng = liveDriver.lng ?? driver?.lng ?? null;

  // ── inject keyframes + fonts once ────────────────────────────────────────────
  useEffect(() => {
    if (document.getElementById('trm2-css')) return;
    const style = document.createElement('style');
    style.id = 'trm2-css';
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700;800&display=swap');
      @keyframes trm2-spin        { to { transform: rotate(360deg); } }
      @keyframes trm2-blink       { 0%,100%{opacity:1} 50%{opacity:.2} }
      @keyframes trm2-pulse       { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(.75)} }
      @keyframes trm2-ping        { 0%{width:20px;height:20px;opacity:.7} 100%{width:170px;height:170px;opacity:0} }
      @keyframes trm2-alert       { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0)} 50%{box-shadow:0 0 0 8px rgba(239,68,68,.22)} }
      @keyframes trm2-heartbeat   { 0%,100%{border-color:rgba(239,68,68,.28);box-shadow:0 -16px 56px rgba(0,0,0,.7),0 0 30px rgba(239,68,68,.05)} 50%{border-color:rgba(239,68,68,.6);box-shadow:0 -16px 56px rgba(0,0,0,.7),0 0 44px rgba(239,68,68,.22)} }
      @keyframes trm2-slideup     { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
      @keyframes trm2-fadein      { from{opacity:0} to{opacity:1} }
      @keyframes trm2-chev-right  { 0%,100%{opacity:.3;transform:translateX(0)} 50%{opacity:1;transform:translateX(2.5px)} }
      @keyframes trm2-chev-left   { 0%,100%{opacity:.3;transform:translateX(0)} 50%{opacity:1;transform:translateX(-2.5px)} }
      @keyframes trm2-shimmer     { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
      @keyframes trm2-sweep       { to { transform: translate(-50%,-50%) rotate(360deg); } }
      @keyframes trm2-burst       { 0%{transform:scale(.4);opacity:.8} 100%{transform:scale(1.25);opacity:0} }
      @keyframes trm2-checkpop    { from{transform:scale(.5);opacity:0} to{transform:scale(1);opacity:1} }
      .trm2-map .mapboxgl-ctrl-logo,
      .trm2-map .mapboxgl-ctrl-attrib { display:none !important; }
    `;
    document.head.appendChild(style);
  }, []);

  // ── announce the request with a soft haptic ──────────────────────────────────
  useEffect(() => {
    if (tripRequest?.id) { haptic([0, 60, 70, 60]); dangerFiredRef.current = false; }
  }, [tripRequest?.id]);

  // ── single haptic pulse when we cross into the danger window ─────────────────
  useEffect(() => {
    if (requestTimer <= DANGER_AT && requestTimer > 0 && !dangerFiredRef.current) {
      dangerFiredRef.current = true;
      haptic([30, 30, 30]);
    }
  }, [requestTimer]);

  // ── fetch route + reset on new trip ──────────────────────────────────────────
  useEffect(() => {
    if (!tripRequest || !driver) return;
    if (prevTripId.current === tripRequest.id) return;
    prevTripId.current = tripRequest.id;
    setAccepted(false);
    setPolyline(null);
    setDriverDist(null);
    setDriverEta(null);
    setLoadingGeo(true);
    setPanelExpanded(true);          // start expanded while we fetch
    autoCollapsedRef.current = false;
    callGetDriverToPickup({
      driverLat: Number(driver.lat), driverLng: Number(driver.lng),
      pickupLat: Number(tripRequest.pickupLat), pickupLng: Number(tripRequest.pickupLng),
    }).then(({ data }) => {
      if (data?.success) {
        setDriverDist(data.distanceText ?? null);
        setDriverEta(data.etaText ?? null);
        setPolyline(data.polyline ?? null);
      }
    }).catch(console.error)
      .finally(() => setLoadingGeo(false));
  // eslint-disable-next-line
  }, [tripRequest?.id]);

  // ── collapse to compact the moment the polyline returns ──────────────────────
  useEffect(() => {
    if (polyline && !autoCollapsedRef.current) {
      autoCollapsedRef.current = true;
      // small beat so the draw-in reads, then hand the screen to the map
      const t = setTimeout(() => setPanelExpanded(false), 650);
      return () => clearTimeout(t);
    }
  }, [polyline]);

  // ── fetch rider account for the rider card ───────────────────────────────────
  useEffect(() => {
    const uid = tripRequest?.uid;
    if (!uid) { setRider(null); return; }
    setRiderLoading(true);
    setRider(null);
    getDoc(doc(db, 'Accounts', uid))
      .then(snap => { if (snap.exists()) setRider(snap.data()); })
      .catch(() => {})
      .finally(() => setRiderLoading(false));
  }, [tripRequest?.uid]);

  // ── fare count-up on each new trip ───────────────────────────────────────────
  useEffect(() => {
    cancelAnimationFrame(fareRafRef.current);
    if (!payout) { setDisplayFare(0); return; }
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / FARE_COUNT_MS);
      setDisplayFare(payout * easeOutCubic(t));
      if (t < 1) fareRafRef.current = requestAnimationFrame(step);
      else setDisplayFare(payout);
    };
    fareRafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(fareRafRef.current);
  }, [payout, tripRequest?.id]);

  if (!tripRequest) return null;

  // ── derived display values ───────────────────────────────────────────────────
  const payMethod = tripRequest.paymentMethod ?? 'card';
  const payCfg    = PAY_CFG[payMethod] ?? PAY_CFG.card;
  const rideColor = TYPE_COLOR[tripRequest.rideType] ?? '#3B82F6';
  const miles     = Number(tripRequest.tripDistanceMiles) || 0;
  const mins      = Number(tripRequest.tripDurationMin) || 0;
  const surge     = Number(tripRequest.surgeMultiplier) || 1;
  const isScheduled = !!tripRequest.isScheduled;
  const schedClock  = isScheduled ? fmtClock(tripRequest.scheduledAt) : null;
  const isLongTrip  = miles >= LONG_TRIP_MI;

  // earnings rate — the numbers a driver actually decides on
  const perMile = miles > 0 ? payout / miles : null;
  const perMin  = mins  > 0 ? payout / mins  : null;

  // ── how far is the driver from the pickup? (live) ────────────────────────────
  // Primary read is the live deadhead distance (recomputed from the device GPS
  // as the driver moves); the server's distance/eta text is the fallback.
  const liveDeadheadMi = (dLat != null && dLng != null && tripRequest.pickupLat && tripRequest.pickupLng)
    ? haversineMi(dLat, dLng, tripRequest.pickupLat, tripRequest.pickupLng)
    : null;
  const serverDistMi = parseDistanceMi(driverDist);
  const heroMiles    = liveDeadheadMi != null ? liveDeadheadMi : serverDistMi;
  const serverEtaMin = parseEtaMin(driverEta);
  const heroEtaMin   = serverEtaMin != null ? serverEtaMin
                     : (heroMiles != null ? (heroMiles / 24) * 60 : null);
  const deadheadMi   = liveDeadheadMi != null ? liveDeadheadMi : serverDistMi;
  const deadheadRatio = (deadheadMi != null && miles > 0) ? deadheadMi / miles : null;

  // bearing to pickup for the compass
  const pickupBearing = (dLat != null && dLng != null && tripRequest.pickupLat && tripRequest.pickupLng)
    ? bearingDeg(dLat, dLng, tripRequest.pickupLat, tripRequest.pickupLng)
    : null;

  const danger   = requestTimer <= DANGER_AT;
  const expired  = requestTimer <= 0 && !accepted;
  const compact  = !panelExpanded;
  const routeReady = !!polyline && !loadingGeo;

  // engaged-time economics for the projection + extended metrics
  const engagedMin = (heroEtaMin != null ? heroEtaMin : 0) + (mins || 0);
  const projPerHr  = (payout && engagedMin > 0) ? payout / (engagedMin / 60) : null;
  const arrivalClock = fmtArrivalClock(heroEtaMin);

  const handleAccept = () => { setAccepted(true); onAccept?.(); };

  return (
    <div style={{ position:'fixed', inset:0, zIndex:800, background:C.bg, fontFamily:MONO }}>

      {/* ── full-screen map — mounts once, polyline + live driver feed in ── */}
      <div className="trm2-map" style={{ position:'absolute', inset:0 }}>
        <FullscreenMap
          driverLat={dLat}
          driverLng={dLng}
          driverHeading={liveDriver.heading}
          pickupLat={tripRequest.pickupLat}
          pickupLng={tripRequest.pickupLng}
          polyline={polyline}
          compact={compact}
          onReady={() => setMapReady(true)}
        />
      </div>

      {/* radar sweep over the map */}
      <RadarSweep active={mapReady && !accepted && !expired}/>

      {/* loading shimmer (semi-transparent, doesn't hide the map) */}
      {(loadingGeo || !mapReady) && (
        <div style={{
          position:'absolute', inset:0, zIndex:3, pointerEvents:'none',
          background:'linear-gradient(90deg,rgba(5,10,6,.7) 25%,rgba(12,20,16,.55) 50%,rgba(5,10,6,.7) 75%)',
          backgroundSize:'200% 100%',
          animation:'trm2-shimmer 1.8s ease-in-out infinite',
        }}/>
      )}

      {/* ── depth vignette ── */}
      <div style={{
        position:'absolute', inset:0, zIndex:5, pointerEvents:'none',
        background:[
          'radial-gradient(ellipse at 50% 42%, transparent 34%, rgba(3,6,4,.3) 74%, rgba(3,6,4,.7) 100%)',
          'linear-gradient(to bottom, rgba(3,6,4,.55) 0%, transparent 20%, transparent 38%, rgba(2,5,3,.92) 100%)',
        ].join(', '),
      }}/>

      {/* ── urgency vignette when time is short ── */}
      {danger && !expired && (
        <div style={{
          position:'absolute', inset:0, zIndex:6, pointerEvents:'none',
          background:'radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(239,68,68,.14) 100%)',
          animation:'trm2-alert 1s ease-in-out infinite',
        }}/>
      )}

      {/* ── compass to pickup ── */}
      {mapReady && !accepted && !expired && (
        <CompassToPickup bearing={pickupBearing} distanceMi={deadheadMi}/>
      )}

      {/* ── map legend ── */}
      {mapReady && !accepted && !expired && <MapLegend/>}

      {/* ── top ribbon ── */}
      <div style={{
        position:'absolute', top:0, left:0, right:0, zIndex:20,
        paddingTop:'max(14px, env(safe-area-inset-top))', pointerEvents:'none',
        background:'linear-gradient(180deg, rgba(3,6,4,.6) 40%, transparent)',
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 18px', height:44 }}>
          <span style={{ fontFamily:COND, fontSize:12, fontWeight:800, letterSpacing:'.22em', color:'rgba(255,255,255,.45)' }}>
            UATOB
          </span>
          <div style={{
            display:'flex', alignItems:'center', gap:7,
            background:C.panelDeep, backdropFilter:'blur(12px)',
            border:`1px solid ${rideColor}44`, borderRadius:99, padding:'5px 12px',
            animation:'trm2-fadein .4s ease both',
          }}>
            {surge > 1 && <Zap size={10} color={rideColor}/>}
            <span style={{ width:6, height:6, borderRadius:'50%', background:rideColor, boxShadow:`0 0 8px ${rideColor}`, animation:'trm2-blink 1.4s ease-in-out infinite', display:'inline-block' }}/>
            <span style={{ fontFamily:COND, fontSize:10, fontWeight:800, letterSpacing:'.14em', color:rideColor }}>
              {isScheduled ? 'SCHEDULED' : 'NEW'} {(TYPE_LABEL[tripRequest.rideType] ?? 'RIDE').toUpperCase()}
            </span>
          </div>
          <TimerRing timer={requestTimer} total={60}/>
        </div>
        {/* draining urgency bar */}
        <div style={{ height:2.5, margin:'4px 16px 0', background:'rgba(255,255,255,.07)', borderRadius:2 }}>
          <div style={{
            height:'100%', width:`${clamp01(requestTimer/60) * 100}%`,
            background: danger ? C.redDeep : requestTimer <= WARN_AT ? C.amberBright : rideColor,
            borderRadius:2, boxShadow:`0 0 10px currentColor`,
            transition:'width 1s linear, background .3s ease',
          }}/>
        </div>
      </div>

      {/* ── floating pickup-proximity pill (server text, while expanded/among map) ── */}
      {routeReady && (driverDist || driverEta) && !accepted && !expired && (
        <div style={{
          position:'absolute', top:'calc(60px + env(safe-area-inset-top))