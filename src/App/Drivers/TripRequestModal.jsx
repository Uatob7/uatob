/**
 * TripRequestModal.jsx  — Full-screen incoming-ride request (driver-facing)
 * ════════════════════════════════════════════════════════════════════════════
 * The decision screen: a ride comes in, the driver has ~60s to take it.
 * Slide RIGHT → Accept · Slide LEFT → Decline.
 *
 * This revision brings it up to ActiveTripScreen quality:
 * ──────────────────────────────────────────────────────
 *   • Animated route. The driver→pickup line draws itself in on arrival, then
 *     carries a flowing marching-dash overlay so it always reads as "live."
 *   • Radar ping at pickup. Concentric rings pulse out from the pickup pin —
 *     on-brand with the HomeTab radar aesthetic; reads as "rider waiting here."
 *   • Cinematic intro. The camera eases/zooms onto the scene as the panel rises.
 *   • Urgency system. A draining top bar + countdown ring shift green→amber→red,
 *     and at ≤10s the whole sheet picks up a red heartbeat so a late accept is
 *     never an accident.
 *   • Driver-decision metrics. The fare counts up on mount and is paired with
 *     the numbers drivers actually judge a ride on: $/mi and $/min, plus pickup
 *     distance/ETA and the trip's own distance/time.
 *   • Context chips. Scheduled rides surface their time; long hauls flag as
 *     LONG TRIP; surge is called out.
 *   • Privacy preserved. Exact addresses stay redacted to a city/area hint until
 *     the driver accepts, then reveal with a smooth transition.
 *
 * Props (unchanged — drop-in replacement)
 * ───────────────────────────────────────
 *   driver          { uid, lat, lng, firstName }
 *   tripRequest     Firestore ride doc
 *   requestTimer    number (seconds remaining, 0–60)
 *   onAccept        () => void
 *   onDecline       () => void
 *   actionPending   boolean
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Zap } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebase_app } from '@/firebase/config';
import { TYPE_COLOR, TYPE_LABEL } from '@/App/Drivers/constants.js';

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
const DRAW_MS         = 850;   // route draw-in duration
const FARE_COUNT_MS   = 650;   // fare count-up duration
const DASH_THROTTLE_MS = 55;   // flowing-dash frame interval
const LONG_TRIP_MI    = 15;    // threshold to flag a long haul
const DANGER_AT       = 10;    // seconds remaining → urgency escalation

// ─── payment config ─────────────────────────────────────────────────────────
const PAY_CFG = {
  cash:    { label:'CASH',     color:'#F59E0B', bg:'rgba(245,158,11,.13)', border:'rgba(245,158,11,.32)', icon:'💵' },
  card:    { label:'CARD',     color:'#60A5FA', bg:'rgba(96,165,250,.12)', border:'rgba(96,165,250,.28)', icon:'💳' },
  cashapp: { label:'CASH APP', color:'#34D399', bg:'rgba(52,211,153,.12)', border:'rgba(52,211,153,.28)', icon:'$'  },
};

// animated marching-dash frames for the flowing route
const DASH_FRAMES = [
  [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5],
  [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0], [0, 0.5, 3, 3.5],
  [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5],
  [0, 3, 3, 1], [0, 3.5, 3, 0.5],
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

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

/**
 * Redacted view (before accept): show only "City, ST" — no street at all.
 */
function redactAddress(raw) {
  if (!raw) return '•••• ••••';
  const parts = String(raw).split(',').map(s => s.trim()).filter(Boolean);
  const city  = parts[1] ?? '';
  const state = parts[2] ?? '';
  const area  = [city, state].filter(Boolean).join(', ');
  return area ? `•••• ${area}` : '•••• ••••';
}

/**
 * Revealed view (after accept): real address with the street number masked.
 */
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

  outer.appendChild(glow);
  outer.appendChild(ring);
  outer.appendChild(body);
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
// Mounts once, stays alive; route draws in + flows; pickup pings.
// ═══════════════════════════════════════════════════════════════════════════════
function FullscreenMap({ driverLat, driverLng, pickupLat, pickupLng, polyline, onReady }) {
  const containerRef  = useRef(null);
  const mapRef        = useRef(null);
  const markersRef    = useRef([]);
  const initRef       = useRef(false);
  const styleReadyRef = useRef(false);
  const pendingRef    = useRef([]);
  const drawRafRef    = useRef(0);
  const dashRafRef    = useRef(0);
  const dashStepRef   = useRef(0);
  const lastDashRef   = useRef(0);
  const drawnRef      = useRef(false);

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
      markersRef.current.forEach(m => { try { m.remove(); } catch (e) {} });
      markersRef.current = [];
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

      // fit the full route + endpoints into view
      const pts = [...routeCoords];
      if (driverLat && driverLng) pts.push([driverLng, driverLat]);
      if (pickupLat && pickupLng) pts.push([pickupLng, pickupLat]);
      if (pts.length >= 2) {
        const lngs = pts.map(p => p[0]);
        const lats = pts.map(p => p[1]);
        map.fitBounds(
          [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
          { padding: { top: 170, bottom: 340, left: 60, right: 60 }, maxZoom: 15.5, pitch: 52, duration: 1100 },
        );
      }

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

  // ── place / update markers ──────────────────────────────────────────────────
  useEffect(() => {
    whenReady(() => {
      const map = mapRef.current;
      if (!map) return;

      markersRef.current.forEach(m => { try { m.remove(); } catch (e) {} });
      markersRef.current = [];

      // driver puck
      if (driverLat && driverLng) {
        markersRef.current.push(
          new window.mapboxgl.Marker({ element: makeDriverPuckEl(), anchor: 'center' })
            .setLngLat([driverLng, driverLat]).addTo(map),
        );
      }

      // pickup: radar ping (beneath) + label pin (above)
      if (pickupLat && pickupLng) {
        markersRef.current.push(
          new window.mapboxgl.Marker({ element: makePickupPingEl(), anchor: 'center' })
            .setLngLat([pickupLng, pickupLat]).addTo(map),
        );
        markersRef.current.push(
          new window.mapboxgl.Marker({ element: makePickupLabelEl(), anchor: 'bottom' })
            .setLngLat([pickupLng, pickupLat]).addTo(map),
        );
      }
    });
  // eslint-disable-next-line
  }, [driverLat, driverLng, pickupLat, pickupLng]);

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIMER RING — escalates to red as time runs out
// ═══════════════════════════════════════════════════════════════════════════════
function TimerRing({ timer, total = 60 }) {
  const R    = 20;
  const circ = 2 * Math.PI * R;
  const pct  = Math.max(0, Math.min(1, timer / total));
  const danger = timer <= DANGER_AT;
  const warn   = timer <= 20 && !danger;
  const stroke = danger ? C.redDeep : warn ? C.amberBright : C.greenBright;

  return (
    <div style={{ position: 'relative', width: 52, height: 52, flexShrink: 0 }}>
      <svg width="52" height="52" viewBox="0 0 52 52" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="26" cy="26" r={R} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="3" />
        <circle cx="26" cy="26" r={R} fill="none"
          stroke={stroke} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          style={{
            transition: 'stroke-dashoffset 1s linear, stroke .3s ease',
            filter: `drop-shadow(0 0 5px ${stroke}aa)`,
          }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: MONO, fontSize: 15, fontWeight: 700,
        color: danger ? C.redDeep : C.white,
        borderRadius: '50%',
        animation: danger ? 'trm2-alert 1s ease-in-out infinite' : 'none',
        transition: 'color .3s',
      }}>
        {timer}
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
// METRIC TILE — small label/value stack
// ═══════════════════════════════════════════════════════════════════════════════
function MetricTile({ label, value, accent }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 0, flex: 1 }}>
      <div style={{
        fontFamily: MONO, fontSize: 14, fontWeight: 800,
        color: accent || C.white, lineHeight: 1.15,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {value}
      </div>
      <div style={{ fontFamily: COND, fontSize: 8, fontWeight: 800, letterSpacing: '.13em', color: C.inkDim, marginTop: 3 }}>
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
      background: bg, border: `1px solid ${border}`, borderRadius: 7,
      padding: '3px 8px',
      fontFamily: COND, fontSize: 10, fontWeight: 800, letterSpacing: '.08em', color,
    }}>
      {icon}{children}
    </span>
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
    return () => window.removeEventListener('resize', measure);
  }, [measure]);

  const clientX   = (e) => e.touches?.[0]?.clientX ?? e.clientX ?? 0;
  const setOffset = (px) => { offsetRef.current = px; setX(px); };

  const onDown = (e) => {
    if (pending || disabled || result) return;
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
        onAccept?.();
      } else if (ratio <= -COMMIT) {
        setOffset(-halfRef.current);
        setResult('decline');
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
            position:'absolute', top:PAD, left:`calc(50% - ${THUMB/2}px + ${x}px)`,
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
              : 'left .28s cubic-bezier(.34,1.1,.64,1), background .2s, box-shadow .2s',
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
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function TripRequestModal({
  driver,
  tripRequest,
  requestTimer,
  onAccept,
  onDecline,
  actionPending = false,
}) {
  const [polyline,   setPolyline]   = useState(null);
  const [driverDist, setDriverDist] = useState(null);
  const [driverEta,  setDriverEta]  = useState(null);
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [accepted,   setAccepted]   = useState(false);
  const [mapReady,   setMapReady]   = useState(false);
  const [displayFare, setDisplayFare] = useState(0);   // count-up value
  const prevTripId = useRef(null);
  const fareRafRef = useRef(0);

  const payout = Number(tripRequest?.driverPayout) || 0;

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
      .trm2-map .mapboxgl-ctrl-logo,
      .trm2-map .mapboxgl-ctrl-attrib { display:none !important; }
    `;
    document.head.appendChild(style);
  }, []);

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
  const danger  = requestTimer <= DANGER_AT;

  const handleAccept = () => { setAccepted(true); onAccept?.(); };

  return (
    <div style={{ position:'fixed', inset:0, zIndex:800, background:C.bg, fontFamily:MONO }}>

      {/* ── full-screen map — mounts once, polyline feeds in reactively ── */}
      <div className="trm2-map" style={{ position:'absolute', inset:0 }}>
        <FullscreenMap
          driverLat={driver?.lat}
          driverLng={driver?.lng}
          pickupLat={tripRequest.pickupLat}
          pickupLng={tripRequest.pickupLng}
          polyline={polyline}
          onReady={() => setMapReady(true)}
        />
      </div>

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
          'linear-gradient(to bottom, rgba(3,6,4,.55) 0%, transparent 20%, transparent 40%, rgba(2,5,3,.92) 100%)',
        ].join(', '),
      }}/>

      {/* ── urgency vignette when time is short ── */}
      {danger && (
        <div style={{
          position:'absolute', inset:0, zIndex:6, pointerEvents:'none',
          background:'radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(239,68,68,.14) 100%)',
          animation:'trm2-alert 1s ease-in-out infinite',
        }}/>
      )}

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
            height:'100%', width:`${Math.max(0, Math.min(1, requestTimer/60)) * 100}%`,
            background: danger ? C.redDeep : requestTimer <= 20 ? C.amberBright : rideColor,
            borderRadius:2, boxShadow:`0 0 10px currentColor`,
            transition:'width 1s linear, background .3s ease',
          }}/>
        </div>
      </div>

      {/* ── floating pickup-proximity pill (mirrors ActiveTripScreen EtaCard) ── */}
      {!loadingGeo && (driverDist || driverEta) && (
        <div style={{
          position:'absolute', top:'calc(82px + env(safe-area-inset-top))',
          left:'50%', transform:'translateX(-50%)', zIndex:22, pointerEvents:'none',
          display:'flex', alignItems:'center', gap:9,
          background:C.panelDeep, backdropFilter:'blur(14px)',
          border:`1px solid ${C.greenBright}33`, borderRadius:99, padding:'6px 15px',
          boxShadow:`0 8px 26px rgba(0,0,0,.6), 0 0 22px ${C.greenBright}14`,
          animation:'trm2-fadein .5s .25s ease both', whiteSpace:'nowrap',
        }}>
          <span style={{ width:6, height:6, borderRadius:'50%', background:C.greenBright, boxShadow:`0 0 6px ${C.greenBright}`, animation:'trm2-blink 1.6s ease-in-out infinite', display:'inline-block' }}/>
          {driverDist && <span style={{ fontFamily:MONO, fontSize:12, fontWeight:800, color:C.white }}>{driverDist}</span>}
          {driverDist && driverEta && <span style={{ width:1, height:11, background:'rgba(255,255,255,.16)' }}/>}
          {driverEta && (
            <span style={{ fontFamily:MONO, fontSize:12, fontWeight:800, color:C.greenBright }}>
              {driverEta} <span style={{ fontFamily:COND, fontWeight:700, letterSpacing:'.08em', color:C.greenSoft }}>TO PICKUP</span>
            </span>
          )}
        </div>
      )}

      {/* ── bottom panel ── */}
      <div style={{ position:'absolute', bottom:0, left:0, right:0, zIndex:30, animation:'trm2-slideup .45s cubic-bezier(.34,1.1,.64,1) both' }}>
        <div style={{
          background:C.panelDeep,
          borderTop:`1px solid ${danger ? 'rgba(239,68,68,.4)' : `${rideColor}28`}`,
          borderRadius:'26px 26px 0 0',
          backdropFilter:'blur(20px)',
          boxShadow:`0 -16px 56px rgba(0,0,0,.7), 0 0 44px ${rideColor}0e`,
          padding:'12px 18px max(20px, calc(env(safe-area-inset-bottom) + 14px))',
          animation: danger ? 'trm2-heartbeat 1s ease-in-out infinite' : 'none',
        }}>
          {/* drag handle */}
          <div style={{ width:36, height:3.5, borderRadius:2, background:'rgba(255,255,255,.12)', margin:'0 auto 12px' }}/>

          {/* ── fare hero + payment ── */}
          <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', marginBottom:6 }}>
            <div>
              <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
                <span style={{ fontFamily:COND, fontSize:48, fontWeight:900, lineHeight:.9, letterSpacing:'.01em', color:C.white }}>
                  {money(displayFare)}
                </span>
                {surge > 1 && (
                  <span style={{ display:'inline-flex', alignItems:'center', gap:3, background:'rgba(234,179,8,.12)', border:'1px solid rgba(234,179,8,.3)', borderRadius:6, padding:'3px 7px', fontFamily:COND, fontSize:10, fontWeight:800, letterSpacing:'.06em', color:'#EAB308' }}>
                    <Zap size={9} color="#EAB308" fill="#EAB308"/>
                    {surge}× SURGE
                  </span>
                )}
              </div>
              {/* earnings rate — driver's decision metric */}
              {(perMile || perMin) && (
                <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:5 }}>
                  {perMile && (
                    <span style={{ fontFamily:MONO, fontSize:11, fontWeight:700, color:C.greenSoft }}>
                      {money(perMile)}<span style={{ color:C.ink, fontWeight:600 }}>/mi</span>
                    </span>
                  )}
                  {perMile && perMin && <span style={{ width:1, height:10, background:'rgba(255,255,255,.14)' }}/>}
                  {perMin && (
                    <span style={{ fontFamily:MONO, fontSize:11, fontWeight:700, color:C.greenSoft }}>
                      {money(perMin)}<span style={{ color:C.ink, fontWeight:600 }}>/min</span>
                    </span>
                  )}
                </div>
              )}
            </div>
            <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:payCfg.bg, border:`1px solid ${payCfg.border}`, borderRadius:10, padding:'6px 12px' }}>
              <span style={{ fontSize:12, color:payCfg.color }}>{payCfg.icon}</span>
              <span style={{ fontFamily:MONO, fontSize:10, fontWeight:800, letterSpacing:'.1em', color:payCfg.color }}>{payCfg.label}</span>
            </div>
          </div>

          {/* ── context chips ── */}
          {(isScheduled || isLongTrip) && (
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
              {isScheduled && (
                <Chip color={C.violet} bg="rgba(192,132,252,.12)" border="rgba(192,132,252,.3)"
                  icon={<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={C.violet} strokeWidth="2.4" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>}>
                  SCHEDULED{schedClock ? ` · ${schedClock}` : ''}
                </Chip>
              )}
              {isLongTrip && (
                <Chip color={C.cyan} bg="rgba(103,232,249,.1)" border="rgba(103,232,249,.28)"
                  icon={<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={C.cyan} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>}>
                  LONG TRIP
                </Chip>
              )}
            </div>
          )}
          {!(isScheduled || isLongTrip) && <div style={{ height:8 }}/>}

          {/* ── route strip ── */}
          <div style={{ display:'flex', gap:12, alignItems:'stretch', background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.06)', borderRadius:14, padding:'10px 13px', marginBottom:12 }}>
            <RouteRail/>
            <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:9 }}>
              <AddressRow label="Pickup"   raw={tripRequest.pickup}  accepted={accepted} dimmed={false}/>
              <AddressRow label="Drop-off" raw={tripRequest.dropoff} accepted={accepted} dimmed={true}/>
            </div>
          </div>

          {/* ── trip metrics row ── */}
          <div style={{
            display:'flex', alignItems:'stretch', gap:0, marginBottom:14,
            background:'rgba(255,255,255,.025)', border:'1px solid rgba(255,255,255,.05)',
            borderRadius:12, padding:'9px 4px',
          }}>
            <MetricTile label="TRIP DIST" value={miles > 0 ? `${miles.toFixed(1)} mi` : '—'}/>
            <div style={{ width:1, background:'rgba(255,255,255,.07)', margin:'2px 0' }}/>
            <MetricTile label="TRIP TIME" value={mins > 0 ? `${mins} min` : '—'}/>
            <div style={{ width:1, background:'rgba(255,255,255,.07)', margin:'2px 0' }}/>
            <MetricTile label="TO PICKUP" value={driverDist || '—'} accent={C.greenBright}/>
          </div>

          {/* ── bidirectional slide ── */}
          <BidirectionalSlide
            onAccept={handleAccept}
            onDecline={onDecline}
            pending={actionPending}
            disabled={false}
          />
        </div>
      </div>
    </div>
  );
}