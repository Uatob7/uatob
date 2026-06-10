/**
 * UaTobApp.jsx — Rider-facing full-screen Mapbox HUD (realtime edition)
 *
 * Built on the same radar/HUD aesthetic as HomeTab.jsx, but adapted for riders:
 *  • Live geolocation watch with a smooth follow camera (no easeTo snapping)
 *  • Exponential ease so the world slides under a stationary rider
 *  • Movement trail behind the rider (radar mode only)
 *  • Heading compass + bearing-aware edge contacts (nearest searches & drivers
 *    that fall outside the radar's visible range arrow toward the edge)
 *  • Active-ride mode: pickup + driver markers + Polyline route via Mapbox
 *    Directions API, with the camera handing off from follow → fitBounds
 *  • Driver ETA / approach distance updates every second from the live driver
 *    snapshot, no extra reads required
 *  • Pulse halos, sweep arm, atmosphere, scanlines, corner brackets — same
 *    visual language as the driver side
 *
 * State machine (ride.status from Firestore is the source of truth):
 *   IDLE → searching_driver → driver_assigned → arrived → in_progress → completed
 *
 * Props:
 *   uid            string
 *   rides          array   — rider's ride history / active rides
 *   searches       array   — live search pool (for ambient heatmap)
 *   scheduledRides array   — rider's own scheduled rides
 *   trips          array   — completed trip history (falls back to rides)
 *   drivers        array   — nearby drivers (reserved; Firestore Drivers used as authoritative)
 *   account        object  — rider account doc
 *   createTrip     fn      — books a ride (payload => Promise)
 *   activeRide     object  — current ride doc, if any (overrides rides[] detection)
 *   onOpenSupport  fn      — opens support modal
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  collection,
  onSnapshot,
  getFirestore,
  doc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

const db = getFirestore(firebase_app);

import {
  FACE_BOOK,
  FACE_SEARCHES,
  FACE_SCHEDULED,
  FACE_NOTIFS,
  FACE_ACCOUNT,
  FACE_TRIPS,
  FACE_COUNT,
} from '@/App/UaTob/Statuscardtokens';

import StatusCard from '@/App/UaTob/StatusCard';

// ─── Design tokens ──────────────────────────────────────────────────────────
const C = {
  bg:          '#050A06',
  bgDeep:      '#030604',
  panel:       'rgba(5,10,6,.72)',
  green:       '#22C55E',
  greenBright: '#4ADE80',
  greenSoft:   '#34D399',
  greenGlow:   'rgba(74,222,128,.55)',
  amber:       '#FB923C',
  amberBright: '#FBBF24',
  violet:      '#C084FC',
  cyan:        '#67E8F9',
  red:         '#F87171',
  white:       '#fff',
  line:        'rgba(34,197,94,.25)',
  lineSoft:    'rgba(34,197,94,.14)',
  inkText:     'rgba(255,255,255,.42)',
  inkTextDim:  'rgba(255,255,255,.22)',
  inkTextFade: 'rgba(255,255,255,.10)',
};
const MONO = "'JetBrains Mono','SFMono-Regular',monospace";
const COND = "'Barlow Condensed','Barlow',sans-serif";
const SANS = "'Inter','Helvetica Neue',sans-serif";

// ─── Mapbox config ──────────────────────────────────────────────────────────
const MAPBOX_TOKEN = 'pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA';
const MAP_STYLE    = 'mapbox://styles/mapbox/dark-v11';

// Orlando fallback
const ORL_LNG = -81.3792;
const ORL_LAT =  28.5383;

// ─── Live-follow tunables (mirror driver-side semantics) ─────────────────────
const FOLLOW_SMOOTH            = 0.14;          // 0..1 per-frame ease toward latest fix
const STALE_FIX_MS             = 30_000;        // a fix older than this is treated as unknown
const GEO_OPTS                 = { enableHighAccuracy: true, maximumAge: 1000, timeout: 12000 };
const SHOW_MOVEMENT_TRAIL      = true;          // breadcrumb behind the rider (radar only)
const TRAIL_MAX_POINTS         = 60;
const TRAIL_MIN_MOVE_MI        = 0.004;         // ~21 ft min spacing
const TRAIL_PUSH_EVERY         = 4;             // sample every Nth follow frame
const MIN_MOVE_FOR_BEARING_MI  = 0.0025;        // ignore GPS jitter below this when deriving heading
const ACCOUNT_WRITE_THROTTLE   = 8_000;         // ms between Accounts/{uid} location writes

// ─── Radar tunables ──────────────────────────────────────────────────────────
const ON_RADAR_RANGE_MI        = 4.2;           // edge-contacts kick in beyond this
const MAX_EDGE_CONTACTS        = 6;
const RADAR_RINGS_MI           = [1, 2, 4, 6];

// ─── Trip / driver intercept tunables ────────────────────────────────────────
const DRIVER_AVG_MPH           = 27;            // for approach ETA when no Mapbox route is fresh
const ROUTE_REFETCH_MS         = 12_000;        // re-fetch driver→pickup polyline at most this often
const ROUTE_REFETCH_MIN_MOVE_MI= 0.05;          // …or once the driver has moved this far
const ARRIVAL_RADIUS_MI        = 0.05;          // ~80m: visual "driver here" snap

// ─── Empty GeoJSON constants ─────────────────────────────────────────────────
const EMPTY_LINE = { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } };
const EMPTY_FC   = { type: 'FeatureCollection', features: [] };

// ─── Boot sequence (terminal-style intro) ────────────────────────────────────
const BOOT_LINES = [
  'uatob rider terminal · v2.4',
  'establishing secure uplink ........... ok',
  'acquiring gps lock ................... ok',
  'syncing fleet positions .............. ok',
  'priming radar array .................. ok',
  'rider node online. ready to roll.',
];

// ─── Helpers ────────────────────────────────────────────────────────────────
function tsToMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') { const p = Date.parse(ts); return Number.isNaN(p) ? 0 : p; }
  return 0;
}

const lerp = (a, b, t) => a + (b - a) * t;

function haversineMiles(lat1, lng1, lat2, lng2) {
  const R    = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2
             + Math.cos(lat1 * Math.PI / 180)
             * Math.cos(lat2 * Math.PI / 180)
             * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingBetween(lat1, lng1, lat2, lng2) {
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const y  = Math.sin(Δλ) * Math.cos(φ2);
  const x  = Math.cos(φ1) * Math.sin(φ2)
           - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ  = Math.atan2(y, x) * 180 / Math.PI;
  return (θ + 360) % 360;
}

const normHdg = b => ((Number(b) || 0) % 360 + 360) % 360;
function compassLabel(b) {
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(normHdg(b) / 45) % 8];
}

function hasCoords(o) {
  return typeof o?.pickupLat === 'number' && typeof o?.pickupLng === 'number';
}

function fmtSpeed(mps) {
  if (mps == null || !isFinite(mps) || mps < 0) return null;
  const mph = mps * 2.236936;
  return mph < 1 ? null : String(Math.round(mph));
}

function fmtAccuracy(m) {
  if (m == null || !isFinite(m)) return null;
  return m < 1000 ? `±${Math.round(m)}m` : `±${(m / 1000).toFixed(1)}km`;
}

function fmtClock(ms) {
  const d = new Date(ms);
  const p = n => String(n).padStart(2, '0');
  const h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${p(d.getMinutes())}:${p(d.getSeconds())} ${ap}`;
}

function fmtMi(mi) {
  return mi != null && isFinite(mi) ? `${mi.toFixed(1)} mi` : null;
}

function fmtSecondsToMin(sec) {
  if (!isFinite(sec) || sec <= 0) return null;
  const m = Math.max(1, Math.round(sec / 60));
  return `${m} min`;
}

function fmtElapsed(ms) {
  if (!ms || ms < 0) ms = 0;
  const s   = Math.floor(ms / 1000);
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p   = n => String(n).padStart(2, '0');
  if (h > 0) return `${h}:${p(m)}:${p(sec)}`;
  return `${p(m)}:${p(sec)}`;
}

// Polyline decoder (Google encoded polyline — also what Mapbox Directions returns
// when geometries=polyline; we request geojson below but keep this around for
// scheduled-ride pre-decoded paths)
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

// ─── Keyframe CSS ────────────────────────────────────────────────────────────
const KEYFRAMES = `
  @keyframes uaSpin       { to { transform: rotate(360deg); } }
  @keyframes uaSlideUp    { from{opacity:0;transform:translateY(14px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes uaSlideDown  { from{opacity:0;transform:translateY(-10px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes uaFadeIn     { from{opacity:0} to{opacity:1} }
  @keyframes uaBlink      { 0%,100%{opacity:1} 50%{opacity:.22} }
  @keyframes uaRingPulse  { 0%,100%{transform:scale(1);opacity:.18} 50%{transform:scale(1.48);opacity:0} }
  @keyframes uaScan       { from{top:-80px} to{top:100%} }
  @keyframes uaBarPulse   { 0%,100%{transform:scaleY(.5);opacity:.45} 50%{transform:scaleY(1);opacity:1} }
  @keyframes uaCardFlip   { 0%{opacity:0;transform:translateY(8px) scale(.98)} 100%{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes uaGlowPulse  { 0%,100%{box-shadow:0 0 18px rgba(74,222,128,.25)} 50%{box-shadow:0 0 38px rgba(74,222,128,.55)} }
  @keyframes uaBootBlink  { 0%,100%{opacity:1} 50%{opacity:0} }
  @keyframes uaBracketGlow{ 0%,100%{opacity:.5} 50%{opacity:1} }
  @keyframes ua-driver-pulse { 0%{transform:translate(-50%,-50%) scale(.4);opacity:.7} 100%{transform:translate(-50%,-50%) scale(2.2);opacity:0} }
  @keyframes ua-rider-pulse  { 0%{transform:translate(-50%,-50%) scale(.5);opacity:.5} 100%{transform:translate(-50%,-50%) scale(2.6);opacity:0} }
  @keyframes ua-ring-out     { 0%{transform:translate(-50%,-50%) scale(.2);opacity:.9} 100%{transform:translate(-50%,-50%) scale(2.8);opacity:0} }
`;

// ═════════════════════════════════════════════════════════════════════════════
// LIVE RIDER POSITION HOOK
// Watches geolocation, derives heading when the OS doesn't provide one, and
// returns a merged "rider" object. Falls back to account.lat/lng for the first
// paint and any time the watch can't get a fix.
// ═════════════════════════════════════════════════════════════════════════════
function useLiveRiderPosition(account, onMove) {
  const [fix, setFix]   = useState(null);
  const [live, setLive] = useState(false);
  const watchRef        = useRef(null);
  const lastRef         = useRef(null);   // last [lng,lat] used to derive heading
  const onMoveRef       = useRef(onMove);

  useEffect(() => { onMoveRef.current = onMove; }, [onMove]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLive(false);
      return;
    }
    let firstFix = false;
    lastRef.current = null;

    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, heading, speed, accuracy } = pos.coords;

        // prefer device-reported heading; otherwise derive from movement
        let hdg = (typeof heading === 'number' && !isNaN(heading)) ? heading : null;
        if (hdg == null && lastRef.current) {
          const moved = haversineMiles(lastRef.current[1], lastRef.current[0], latitude, longitude);
          if (moved >= MIN_MOVE_FOR_BEARING_MI) {
            hdg = bearingBetween(lastRef.current[1], lastRef.current[0], latitude, longitude);
          }
        }
        lastRef.current = [longitude, latitude];

        const next = {
          lat:      latitude,
          lng:      longitude,
          heading:  hdg,
          speed:    (typeof speed === 'number' && speed >= 0) ? speed : null,
          accuracy: (typeof accuracy === 'number') ? accuracy : null,
          ts:       Date.now(),
        };
        setFix(next);
        if (!firstFix) { firstFix = true; setLive(true); }

        try { onMoveRef.current?.(next); } catch (e) {}
      },
      () => { setLive(false); },
      GEO_OPTS,
    );

    return () => {
      if (watchRef.current != null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchRef.current);
      }
      watchRef.current = null;
      setLive(false);
    };
  }, []);

  const fresh = fix && (Date.now() - fix.ts) < STALE_FIX_MS;

  const merged = useMemo(() => {
    if (fresh && fix) {
      return {
        lat: fix.lat,
        lng: fix.lng,
        heading:  fix.heading ?? null,
        speed:    fix.speed,
        accuracy: fix.accuracy,
        live:     true,
      };
    }
    if (typeof account?.lat === 'number' && typeof account?.lng === 'number') {
      return {
        lat: account.lat,
        lng: account.lng,
        heading:  null,
        speed:    null,
        accuracy: null,
        live:     false,
      };
    }
    return null;
  // eslint-disable-next-line
  }, [fix, fresh, account?.lat, account?.lng]);

  return { rider: merged, fix: fresh ? fix : null, live: live && !!fresh };
}

// ═════════════════════════════════════════════════════════════════════════════
// ACTIVE RIDE HOOK
// Picks the rider's "in-flight" ride from the rides array (or accepts an
// explicit prop), and — once a driver is assigned — subscribes to that
// driver's Drivers/{uid} doc for live position updates. This is what makes
// the rider's screen track an approaching driver in realtime.
// ═════════════════════════════════════════════════════════════════════════════
const ACTIVE_STATUSES = new Set([
  'searching_driver',
  'driver_assigned',
  'arrived',
  'in_progress',
]);

function useActiveRide(rides, explicit) {
  // Pick the "freshest" active ride: explicit prop wins, otherwise the most
  // recently updated ride in an active status. Completed/canceled rides are
  // never surfaced here — those flow through the completed-popup path.
  return useMemo(() => {
    if (explicit && ACTIVE_STATUSES.has(explicit.status)) return explicit;
    if (!Array.isArray(rides) || !rides.length) return null;
    let best = null;
    for (const r of rides) {
      if (!r || !ACTIVE_STATUSES.has(r.status)) continue;
      const t = tsToMillis(r.updatedAt) || tsToMillis(r.createdAt);
      if (!best || t > best._t) best = { ...r, _t: t };
    }
    return best;
  }, [rides, explicit]);
}

function useAssignedDriverLive(driverUid) {
  const [driver, setDriver] = useState(null);
  useEffect(() => {
    if (!driverUid) { setDriver(null); return; }
    const unsub = onSnapshot(doc(db, 'Drivers', driverUid), (snap) => {
      if (!snap.exists()) { setDriver(null); return; }
      const d = snap.data() || {};
      setDriver({
        uid:      driverUid,
        lat:      typeof d.lat === 'number' ? d.lat : null,
        lng:      typeof d.lng === 'number' ? d.lng : null,
        heading:  typeof d.heading === 'number' ? d.heading : null,
        firstName:d.firstName ?? d.name ?? null,
        car:      d.car ?? d.vehicle ?? null,
        plate:    d.plate ?? d.licensePlate ?? null,
        phone:    d.phone ?? null,
        photoURL: d.photoURL ?? null,
        rating:   typeof d.rating === 'number' ? d.rating : null,
        lastSeenAt: tsToMillis(d.presenceUpdatedAt ?? d.lastSeenAt ?? d.updatedAt),
      });
    }, () => setDriver(null));
    return () => unsub();
  }, [driverUid]);
  return driver;
}

// ═════════════════════════════════════════════════════════════════════════════
// MAPBOX DIRECTIONS HELPERS
// We request the driver→pickup polyline (and pickup→dropoff during the trip)
// directly from Mapbox so the rider sees the same route the driver app draws.
// Cached + throttled by ROUTE_REFETCH_MS / ROUTE_REFETCH_MIN_MOVE_MI.
// ═════════════════════════════════════════════════════════════════════════════
async function fetchRoute(fromLng, fromLat, toLng, toLat, signal) {
  if (![fromLng, fromLat, toLng, toLat].every(n => typeof n === 'number' && isFinite(n))) {
    return null;
  }
  const coords = `${fromLng},${fromLat};${toLng},${toLat}`;
  const url    = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}`
               + `?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
  try {
    const res  = await fetch(url, { signal });
    if (!res.ok) return null;
    const json = await res.json();
    const r    = json?.routes?.[0];
    if (!r?.geometry?.coordinates?.length) return null;
    return {
      coords:    r.geometry.coordinates,        // [[lng,lat], …]
      distance:  r.distance,                    // meters
      duration:  r.duration,                    // seconds
    };
  } catch { return null; }
}

// ─── GeoJSON builders ─────────────────────────────────────────────────────────
function buildSearchGeoJSON(searches = []) {
  return {
    type: 'FeatureCollection',
    features: searches.filter(hasCoords).map(s => ({
      type: 'Feature',
      properties: {
        guest: !s.uid || s.uid === 'null',
        age:   Math.min(1, Math.max(0, 1 - (Date.now() - tsToMillis(s.createdAt)) / (3 * 3600_000))),
      },
      geometry: { type: 'Point', coordinates: [s.pickupLng, s.pickupLat] },
    })),
  };
}

function buildScheduledGeoJSON(scheduledRides = []) {
  return {
    type: 'FeatureCollection',
    features: scheduledRides.filter(hasCoords).map(r => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: [r.pickupLng, r.pickupLat] },
    })),
  };
}

// ─── Driver intercept gather (similar shape to driver-side EdgeContacts) ─────
function gatherRadarContacts(rider, searches, drivers, scheduled) {
  const dLat = rider?.lat, dLng = rider?.lng;
  if (typeof dLat !== 'number' || typeof dLng !== 'number') return [];
  const out = [];
  searches.filter(hasCoords).forEach(s => {
    out.push({
      id:      `s_${s.id}`,
      kind:    (!s.uid || s.uid === 'null') ? 'guest' : 'search',
      dist:    haversineMiles(dLat, dLng, s.pickupLat, s.pickupLng),
      bearing: bearingBetween(dLat, dLng, s.pickupLat, s.pickupLng),
    });
  });
  drivers.forEach(d => {
    if (typeof d.lat !== 'number' || typeof d.lng !== 'number') return;
    out.push({
      id:      `d_${d.id}`,
      kind:    'driver',
      dist:    haversineMiles(dLat, dLng, d.lat, d.lng),
      bearing: bearingBetween(dLat, dLng, d.lat, d.lng),
    });
  });
  scheduled.filter(hasCoords).forEach(r => {
    out.push({
      id:      `r_${r.id}`,
      kind:    'sched',
      dist:    haversineMiles(dLat, dLng, r.pickupLat, r.pickupLng),
      bearing: bearingBetween(dLat, dLng, r.pickupLat, r.pickupLng),
    });
  });
  return out.sort((a, b) => a.dist - b.dist);
}

const CONTACT_COLOR = {
  search: C.greenBright,
  guest:  C.amber,
  driver: C.cyan,
  sched:  C.violet,
};

// ═════════════════════════════════════════════════════════════════════════════
// PRESENTATIONAL ATOMS
// ═════════════════════════════════════════════════════════════════════════════

function Icon({ name, size = 16, color = 'currentColor', stroke = 1.8 }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'chat':   return <svg {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
    case 'pin':    return <svg {...p}><path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>;
    case 'sat':    return <svg {...p}><path d="M4 13a8 8 0 0 1 7 7M4 17a4 4 0 0 1 3 3"/><circle cx="6" cy="19" r="1"/><path d="M12 3l4 4-3 3-4-4 3-3ZM15 9l4 4-3 3"/></svg>;
    case 'car':    return <svg {...p}><path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l2-4h12l2 4h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>;
    case 'clock':  return <svg {...p}><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>;
    case 'phone':  return <svg {...p}><path d="M22 16.9v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
    case 'shield': return <svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
    case 'route':  return <svg {...p}><circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H14a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h5.5"/></svg>;
    case 'check':  return <svg {...p}><polyline points="20 6 9 17 4 12"/></svg>;
    case 'x':      return <svg {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
    case 'spark':  return <svg {...p}><path d="M12 3l1.5 4.5H18l-3.75 2.75 1.5 4.5L12 12l-3.75 2.75 1.5-4.5L6 7.5h4.5L12 3z"/></svg>;
    case 'bolt':   return <svg {...p}><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/></svg>;
    case 'star':   return <svg {...p}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
    case 'wave':   return <svg {...p}><path d="M2 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0 2 4 2 4"/></svg>;
    default:       return null;
  }
}

function SignalBars({ active = true, color = C.greenBright }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 13 }}>
      {[5, 8, 11, 14].map((h, i) => (
        <div key={i} style={{
          width: 2.5, height: h, borderRadius: 1,
          background: active ? color : 'rgba(255,255,255,.13)',
          boxShadow: active ? `0 0 4px ${color}88` : 'none',
          animation: active ? `uaBarPulse 1.6s ease-in-out ${i * 0.18}s infinite` : 'none',
        }}/>
      ))}
    </div>
  );
}

// ─── Top Ribbon ──────────────────────────────────────────────────────────────
function TopRibbon({ now, mapReady, speed, accuracy, gpsLive, mode, modeColor }) {
  const liveColor = mode ? modeColor : (mapReady ? C.greenBright : C.inkTextDim);
  const liveLabel = mode || (mapReady ? 'LIVE' : 'SYNC');
  const lockLabel = gpsLive && accuracy ? accuracy : (gpsLive ? 'LOCK' : 'NO FIX');
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: 28, zIndex: 24,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 14px', pointerEvents: 'none',
      background: 'linear-gradient(180deg, rgba(3,6,4,.88), rgba(3,6,4,0))',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ fontFamily: COND, fontSize: 11, fontWeight: 800,
          letterSpacing: '.22em', color: 'rgba(255,255,255,.52)' }}>UATOB</span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: C.inkTextFade }}>·</span>
        <span style={{ fontFamily: COND, fontSize: 9.5, fontWeight: 700,
          letterSpacing: '.16em', color: C.inkTextDim }}>RIDER</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%', background: liveColor,
            boxShadow: `0 0 7px ${liveColor}`,
            animation: 'uaBlink 1.6s ease-in-out infinite',
          }}/>
          <span style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 800,
            letterSpacing: '.08em', color: liveColor }}>
            {liveLabel}
          </span>
        </div>
        {speed != null && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
            <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: C.greenSoft }}>
              {speed}
            </span>
            <span style={{ fontFamily: COND, fontSize: 7.5, fontWeight: 800,
              letterSpacing: '.1em', color: C.inkTextDim }}>MPH</span>
          </div>
        )}
        <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700,
          color: 'rgba(255,255,255,.4)' }}>{fmtClock(now)}</span>
        <Icon name="sat" size={11} color={gpsLive ? C.greenSoft : C.inkTextDim}/>
        <span style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 700, color: C.inkTextDim }}>
          {lockLabel}
        </span>
        <SignalBars active={gpsLive}/>
      </div>
    </div>
  );
}

// ─── Radar SVG overlay ───────────────────────────────────────────────────────
function RadarOverlay({ svgRef }) {
  return (
    <svg ref={svgRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 10 }}
      viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <radialGradient id="ua-sweepGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="rgba(34,197,94,0.45)"/>
          <stop offset="45%"  stopColor="rgba(34,197,94,0.12)"/>
          <stop offset="100%" stopColor="rgba(34,197,94,0)"/>
        </radialGradient>
        <radialGradient id="ua-sweepGrad2" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="rgba(74,222,128,0.16)"/>
          <stop offset="60%"  stopColor="rgba(74,222,128,0.04)"/>
          <stop offset="100%" stopColor="rgba(74,222,128,0)"/>
        </radialGradient>
        <radialGradient id="ua-vig" cx="50%" cy="50%" r="60%">
          <stop offset="30%" stopColor="transparent"/>
          <stop offset="100%" stopColor="rgba(0,0,0,0.6)"/>
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill="url(#ua-vig)"/>
      {[14, 25, 36, 47].map((r, i) => (
        <circle key={i} cx="50" cy="50" r={r} fill="none"
          stroke="rgba(34,197,94,0.09)" strokeWidth="0.25" strokeDasharray="1.2 2.4"/>
      ))}
      {Array.from({ length: 24 }).map((_, i) => {
        const a = i * 15 * Math.PI / 180; const major = i % 6 === 0;
        const r1 = major ? 45 : 46.4;
        const x1 = 50 + r1 * Math.sin(a), y1 = 50 - r1 * Math.cos(a);
        const x2 = 50 + 47.5 * Math.sin(a), y2 = 50 - 47.5 * Math.cos(a);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={major ? 'rgba(74,222,128,0.32)' : 'rgba(34,197,94,0.14)'}
          strokeWidth={major ? 0.4 : 0.22}/>;
      })}
      <line x1="46.5" y1="50" x2="53.5" y2="50" stroke="rgba(34,197,94,0.28)" strokeWidth="0.22"/>
      <line x1="50" y1="46.5" x2="50" y2="53.5" stroke="rgba(34,197,94,0.28)" strokeWidth="0.22"/>
      <circle cx="50" cy="50" r="0.75" fill="rgba(74,222,128,0.65)"/>
      <path id="ua-sweep2" d="M 50 50 L 50 0 A 55 55 0 0 1 50 0 Z" fill="url(#ua-sweepGrad2)" opacity="0.5"/>
      <path id="ua-sweep"  d="M 50 50 L 50 0 A 55 55 0 0 1 50 0 Z" fill="url(#ua-sweepGrad)"  opacity="0.75"/>
      <line id="ua-arm"    x1="50" y1="50" x2="50" y2="0" stroke="#4ADE80" strokeWidth="0.45" strokeLinecap="round" opacity="0.9"/>
      <circle id="ua-tipglow" cx="50" cy="0" r="2.2" fill="rgba(74,222,128,0.22)"/>
      <circle id="ua-tip"     cx="50" cy="0" r="1.1" fill="#4ADE80" opacity="0.95"/>
    </svg>
  );
}

function ScanlineOverlay() {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 8,
      pointerEvents: 'none', mixBlendMode: 'screen', opacity: .45 }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'repeating-linear-gradient(0deg, rgba(34,197,94,.03) 0px, rgba(34,197,94,.03) 1px, transparent 2px, transparent 4px)',
      }}/>
      <div style={{
        position: 'absolute', left: 0, right: 0, height: 80,
        background: 'linear-gradient(180deg, transparent, rgba(74,222,128,.04), transparent)',
        animation: 'uaScan 7s linear infinite',
      }}/>
    </div>
  );
}

function AtmosphereOverlay({ subdued = false }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 6, pointerEvents: 'none',
      background: subdued
        ? 'radial-gradient(ellipse at 50% 42%, transparent 45%, rgba(3,6,4,.4) 85%, rgba(3,6,4,.7) 100%)'
        : 'radial-gradient(ellipse at 50% 42%, transparent 35%, rgba(3,6,4,.5) 80%, rgba(3,6,4,.82) 100%)',
    }}/>
  );
}

function CornerBrackets() {
  const off = 12, sz = 24, th = 1.5, col = 'rgba(34,197,94,.35)';
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 12, pointerEvents: 'none' }}>
      {[
        { top: off, left: off,     bt: 1, bl: 1 },
        { top: off, right: off,    bt: 1, br: 1 },
        { bottom: off, left: off,  bb: 1, bl: 1 },
        { bottom: off, right: off, bb: 1, br: 1 },
      ].map((c, i) => (
        <div key={i} style={{
          position: 'absolute', width: sz, height: sz,
          top: c.top, left: c.left, right: c.right, bottom: c.bottom,
          borderTop:    c.bt ? `${th}px solid ${col}` : 'none',
          borderBottom: c.bb ? `${th}px solid ${col}` : 'none',
          borderLeft:   c.bl ? `${th}px solid ${col}` : 'none',
          borderRight:  c.br ? `${th}px solid ${col}` : 'none',
          animation: 'uaBracketGlow 4s ease-in-out infinite',
        }}/>
      ))}
    </div>
  );
}

// ─── Compass rose (HUD right edge) ───────────────────────────────────────────
function CompassRose({ bearing }) {
  const hdg = normHdg(bearing);
  return (
    <div style={{
      position: 'absolute', top: '50%', right: 12, transform: 'translateY(-50%)',
      zIndex: 14, pointerEvents: 'none', textAlign: 'center',
      animation: 'uaFadeIn .6s ease both',
    }}>
      <div style={{ position: 'relative', width: 58, height: 58 }}>
        <svg viewBox="0 0 100 100" width={58} height={58}
          style={{ transform: `rotate(${-hdg}deg)`, transition: 'transform .22s linear' }}>
          <circle cx="50" cy="50" r="46" fill="rgba(5,10,6,.55)"
            stroke="rgba(34,197,94,.22)" strokeWidth="1"/>
          {Array.from({ length: 24 }).map((_, i) => {
            const a = (i * 15) * Math.PI / 180;
            const major = i % 6 === 0;
            const r1 = major ? 38 : 42;
            const x1 = 50 + r1 * Math.sin(a), y1 = 50 - r1 * Math.cos(a);
            const x2 = 50 + 46 * Math.sin(a), y2 = 50 - 46 * Math.cos(a);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={major ? 'rgba(74,222,128,.55)' : 'rgba(34,197,94,.2)'}
              strokeWidth={major ? 1.1 : 0.6}/>;
          })}
          <polygon points="50,9 46,20 54,20" fill={C.red}/>
          <text x="50" y="33" textAnchor="middle" fontSize="9" fontWeight="800"
            fill="rgba(255,255,255,.5)" fontFamily="monospace">S</text>
          <text x="50" y="71" textAnchor="middle" fontSize="9" fontWeight="800"
            fill={C.red} fontFamily="monospace" transform="rotate(180 50 67)">N</text>
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800,
            color: C.greenBright, lineHeight: 1 }}>
            {String(Math.round(hdg)).padStart(3, '0')}
          </span>
          <span style={{ fontFamily: COND, fontSize: 7, fontWeight: 800,
            letterSpacing: '.14em', color: C.inkTextDim }}>
            {compassLabel(hdg)}
          </span>
        </div>
      </div>
    </div>
  );
}

function RangeRuler({ zoom }) {
  return (
    <div style={{
      position: 'absolute', top: '50%', left: 12, transform: 'translateY(-50%)',
      zIndex: 14, pointerEvents: 'none',
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 9,
      animation: 'uaFadeIn .6s ease both',
    }}>
      <div style={{ fontFamily: COND, fontSize: 8, fontWeight: 800,
        letterSpacing: '.16em', color: C.inkTextDim, marginBottom: 1 }}>RANGE</div>
      {RADAR_RINGS_MI.map((mi, i) => (
        <div key={mi} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: i === 0 ? 14 : 9, height: 1, background: 'rgba(34,197,94,.4)',
          }}/>
          <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: C.inkText }}>
            {mi}
          </span>
        </div>
      ))}
      <div style={{ marginTop: 2, fontFamily: MONO, fontSize: 8, fontWeight: 700,
        color: C.inkTextDim }}>
        z{(zoom ?? 12).toFixed(1)}
      </div>
    </div>
  );
}

function EdgeContacts({ contacts, mapBearing }) {
  const edge = contacts.filter(c => c.dist > ON_RADAR_RANGE_MI).slice(0, MAX_EDGE_CONTACTS);
  if (!edge.length) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 14, pointerEvents: 'none' }}>
      {edge.map((c) => {
        const screen = (c.bearing - mapBearing) * Math.PI / 180;
        const rx = 43, ry = 41;
        const left = 50 + rx * Math.sin(screen);
        const top  = 50 - ry * Math.cos(screen);
        const col  = CONTACT_COLOR[c.kind] || C.greenBright;
        const deg  = (c.bearing - mapBearing);
        return (
          <div key={c.id} style={{
            position: 'absolute', left: `${left}%`, top: `${top}%`,
            transform: 'translate(-50%, -50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          }}>
            <div style={{
              width: 0, height: 0,
              borderLeft: '4px solid transparent',
              borderRight: '4px solid transparent',
              borderBottom: `7px solid ${col}`,
              transform: `rotate(${deg}deg)`,
              filter: `drop-shadow(0 0 4px ${col})`,
              opacity: .9,
            }}/>
            <span style={{
              fontFamily: MONO, fontSize: 8, fontWeight: 700,
              color: col, textShadow: '0 1px 3px rgba(0,0,0,.8)',
            }}>
              {c.dist.toFixed(1)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Boot terminal ───────────────────────────────────────────────────────────
function BootSequence({ step }) {
  const lines = BOOT_LINES.slice(0, step);
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 40,
      background: 'radial-gradient(ellipse at 50% 45%, #07140A 0%, #030604 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      animation: 'uaFadeIn .3s ease both',
    }}>
      {[60, 110, 160, 210].map((r, i) => (
        <div key={i} style={{
          position: 'absolute', width: r * 2, height: r * 2, borderRadius: '50%',
          border: '1px solid rgba(34,197,94,.09)',
          animation: `uaRingPulse ${2.4 + i * 0.5}s ease-in-out ${i * 0.3}s infinite`,
        }}/>
      ))}
      <div style={{
        width: 'min(86vw, 360px)',
        background: 'rgba(5,12,7,.7)',
        border: '1px solid rgba(34,197,94,.2)',
        borderRadius: 12, padding: '16px 18px',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 18px 60px rgba(0,0,0,.6)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12,
          paddingBottom: 10, borderBottom: '1px solid rgba(34,197,94,.12)',
        }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {[C.red, C.amberBright, C.greenBright].map((c, i) => (
              <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: c, opacity: .8 }}/>
            ))}
          </div>
          <span style={{ fontFamily: COND, fontSize: 10, fontWeight: 800, letterSpacing: '.2em', color: C.inkTextDim }}>
            RIDER BOOT
          </span>
        </div>
        {lines.map((l, i) => {
          const isLast    = i === lines.length - 1;
          const isWelcome = l === BOOT_LINES[BOOT_LINES.length - 1] && step >= BOOT_LINES.length;
          return (
            <div key={i} style={{
              fontFamily: MONO, fontSize: 11, lineHeight: 1.7,
              color: isWelcome ? C.greenBright : 'rgba(120,200,150,.75)',
              fontWeight: isWelcome ? 700 : 500,
              animation: 'uaFadeIn .25s ease both',
            }}>
              <span style={{ color: 'rgba(74,222,128,.4)', marginRight: 6 }}>›</span>
              {l}
              {isLast && step < BOOT_LINES.length && (
                <span style={{
                  display: 'inline-block', width: 7, height: 12, marginLeft: 4,
                  background: C.greenBright, verticalAlign: 'middle',
                  animation: 'uaBootBlink .8s steps(1) infinite',
                }}/>
              )}
            </div>
          );
        })}
      </div>
      <div style={{
        marginTop: 16, fontFamily: COND, fontSize: 10, fontWeight: 700,
        letterSpacing: '.2em', color: C.inkTextFade,
      }}>
        ORLANDO · FL
      </div>
    </div>
  );
}

// ─── Support FAB ─────────────────────────────────────────────────────────────
function SupportFab({ onOpen, unread = 0 }) {
  const badgeText = unread > 99 ? '99+' : String(unread);
  return (
    <button onClick={onOpen} style={{
      position: 'absolute', bottom: 100, right: 16, zIndex: 26,
      width: 44, height: 44, borderRadius: 14, cursor: 'pointer',
      background: 'rgba(5,10,6,.78)', backdropFilter: 'blur(10px)',
      border: `1.5px solid ${unread > 0 ? 'rgba(248,113,113,.5)' : 'rgba(34,197,94,.3)'}`,
      boxShadow: `0 6px 20px rgba(0,0,0,.5), 0 0 14px ${unread > 0 ? 'rgba(248,113,113,.2)' : 'rgba(34,197,94,.15)'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'uaSlideUp .4s ease both',
    }} aria-label={unread ? `Support — ${unread} unread` : 'Support'}>
      <Icon name="chat" size={18} color={unread > 0 ? '#FCA5A5' : C.greenBright}/>
      {unread > 0 && (
        <div style={{
          position: 'absolute', top: -6, right: -6,
          minWidth: badgeText.length > 1 ? 20 : 18, height: 18,
          padding: badgeText.length > 1 ? '0 5px' : 0, borderRadius: 9,
          background: 'linear-gradient(135deg,#EF4444,#DC2626)',
          color: '#fff', fontSize: 10, fontWeight: 800,
          fontFamily: SANS,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid rgba(5,10,6,.9)',
          boxShadow: '0 2px 6px rgba(220,38,38,.5)',
        }}>{badgeText}</div>
      )}
    </button>
  );
}

// ─── Search ring marker ───────────────────────────────────────────────────────
function makeSearchRingEl(isGuest) {
  const col    = isGuest ? '#FB923C' : '#4ADE80';
  const colDim = isGuest ? 'rgba(251,146,60,'  : 'rgba(74,222,128,';

  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;width:0;height:0;pointer-events:none;';

  [0, 0.7, 1.4].forEach(delay => {
    const ring = document.createElement('div');
    ring.style.cssText = [
      'position:absolute', 'left:0', 'top:0',
      'width:26px', 'height:26px', 'border-radius:50%',
      `border:1.5px solid ${colDim}.55)`,
      'transform:translate(-50%,-50%) scale(.2)',
      `animation:ua-ring-out 2.4s ease-out ${delay}s infinite`,
    ].join(';');
    wrap.appendChild(ring);
  });

  const dot = document.createElement('div');
  dot.style.cssText = [
    'position:absolute', 'left:0', 'top:0',
    'width:8px', 'height:8px', 'border-radius:50%',
    `background:${col}`, `border:1.5px solid #fff`,
    `box-shadow:0 0 10px ${col}`,
    'transform:translate(-50%,-50%)',
  ].join(';');
  wrap.appendChild(dot);

  return wrap;
}

// ─── Online-driver dot marker (idle radar mode) ──────────────────────────────
function makeDriverDotEl() {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;width:0;height:0;pointer-events:none;';

  const pulse = document.createElement('div');
  pulse.style.cssText = [
    'position:absolute','left:0','top:0',
    'width:18px','height:18px','border-radius:50%',
    'border:1.5px solid rgba(74,222,128,.5)',
    'transform:translate(-50%,-50%) scale(.4)','opacity:0',
    'animation:ua-driver-pulse 2s ease-out infinite',
  ].join(';');

  const dot = document.createElement('div');
  dot.style.cssText = [
    'position:absolute','left:0','top:0',
    'width:10px','height:10px','border-radius:50%',
    'background:#22C55E','border:2px solid #fff',
    'box-shadow:0 0 8px rgba(34,197,94,.9)',
    'transform:translate(-50%,-50%)',
  ].join(';');

  wrap.appendChild(pulse);
  wrap.appendChild(dot);
  return wrap;
}

// ─── Rider self marker (always shown) ────────────────────────────────────────
function makeRiderEl() {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;width:0;height:0;pointer-events:none;';

  const pulse = document.createElement('div');
  pulse.style.cssText = [
    'position:absolute','left:0','top:0',
    'width:22px','height:22px','border-radius:50%',
    'background:rgba(74,222,128,.25)',
    'transform:translate(-50%,-50%) scale(.5)','opacity:0',
    'animation:ua-rider-pulse 2.4s ease-out infinite',
  ].join(';');

  const core = document.createElement('div');
  core.style.cssText = [
    'position:absolute','left:0','top:0',
    'width:14px','height:14px','border-radius:50%',
    'background:#fff','border:2px solid #4ADE80',
    'box-shadow:0 0 14px rgba(74,222,128,.95), 0 0 28px rgba(74,222,128,.45)',
    'transform:translate(-50%,-50%)',
  ].join(';');

  wrap.appendChild(pulse);
  wrap.appendChild(core);
  return wrap;
}

// ─── Assigned driver marker (active ride mode) ───────────────────────────────
function makeActiveDriverEl(heading = 0) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;width:0;height:0;pointer-events:none;';

  const halo = document.createElement('div');
  halo.style.cssText = [
    'position:absolute','left:0','top:0',
    'width:32px','height:32px','border-radius:50%',
    'background:rgba(103,232,249,.18)',
    'border:1.5px solid rgba(103,232,249,.6)',
    'transform:translate(-50%,-50%)',
    'box-shadow:0 0 18px rgba(103,232,249,.5)',
  ].join(';');

  const car = document.createElement('div');
  car.style.cssText = [
    'position:absolute','left:0','top:0',
    'width:22px','height:22px','border-radius:50%',
    'background:linear-gradient(135deg,#67E8F9,#22D3EE)',
    'border:2px solid #fff',
    'box-shadow:0 0 14px rgba(103,232,249,.9)',
    'transform:translate(-50%,-50%)',
    'display:flex','align-items:center','justify-content:center',
  ].join(';');
  car.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="#0F2933" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
      style="transform: rotate(${heading || 0}deg); transition: transform .25s linear;">
      <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l2-4h12l2 4h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/>
    </svg>
  `;

  wrap.appendChild(halo);
  wrap.appendChild(car);
  return { el: wrap, refs: { car, halo } };
}

// ─── Pickup marker (active ride mode) ────────────────────────────────────────
function makePickupEl() {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;width:0;height:0;pointer-events:none;';
  wrap.innerHTML = `
    <div style="
      position:absolute; left:0; top:0;
      width:14px; height:14px; border-radius:50%;
      background:#22C55E; border:2.5px solid #fff;
      box-shadow:0 0 12px rgba(34,197,94,.8);
      transform:translate(-50%,-50%);
    "></div>
    <div style="
      position:absolute; left:0; top:0;
      width:26px; height:26px; border-radius:50%;
      border:1.5px solid rgba(34,197,94,.4);
      transform:translate(-50%,-50%);
      animation: uaBlink 2s ease-in-out infinite;
    "></div>
  `;
  return wrap;
}

// ─── Dropoff marker (in-trip) ───────────────────────────────────────────────
function makeDropoffEl() {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;width:0;height:0;pointer-events:none;';
  wrap.innerHTML = `
    <div style="
      position:absolute; left:0; top:0;
      width:13px; height:13px;
      background:#fff;
      transform:translate(-50%,-50%) rotate(45deg);
      box-shadow:0 0 10px rgba(255,255,255,.5);
    "></div>
  `;
  return wrap;
}

// ═════════════════════════════════════════════════════════════════════════════
// ACTIVE-RIDE HUD
// Sits over the bottom of the map during a ride. Reads from the live ride doc
// + the live assigned-driver doc + the live route summary, and updates every
// second so the rider sees the world the same way the driver sees it on their
// side.
// ═════════════════════════════════════════════════════════════════════════════
const STATUS_DISPLAY = {
  searching_driver: { label: 'FINDING YOUR DRIVER', color: C.amberBright, blink: true,  showDriver: false },
  driver_assigned:  { label: 'DRIVER EN ROUTE',     color: C.cyan,        blink: true,  showDriver: true  },
  arrived:          { label: 'DRIVER ARRIVED',      color: C.greenBright, blink: true,  showDriver: true  },
  in_progress:      { label: 'TRIP IN PROGRESS',    color: C.amberBright, blink: false, showDriver: true  },
};

function ActiveRideHud({ ride, driver, route, now, onCancel, onContactDriver }) {
  if (!ride) return null;
  const disp = STATUS_DISPLAY[ride.status] || STATUS_DISPLAY.searching_driver;

  const pickup  = ride.pickup  || ride.pickupLabel  || '—';
  const dropoff = ride.dropoff || ride.dropoffLabel || '—';

  // Distance + ETA: prefer the Mapbox-derived route summary; otherwise fall
  // back to haversine + an assumed average speed.
  let distMi = null;
  let etaSec = null;
  if (route?.distance != null) distMi = route.distance / 1609.34;
  if (route?.duration != null) etaSec = route.duration;

  if (distMi == null && driver?.lat && driver?.lng && ride.pickupLat && ride.pickupLng) {
    distMi = haversineMiles(driver.lat, driver.lng, ride.pickupLat, ride.pickupLng);
    etaSec = Math.round((distMi / DRIVER_AVG_MPH) * 3600);
  }

  // In-progress: distance is rider → dropoff
  if (ride.status === 'in_progress' && driver?.lat && driver?.lng && ride.dropoffLat && ride.dropoffLng) {
    distMi = haversineMiles(driver.lat, driver.lng, ride.dropoffLat, ride.dropoffLng);
    etaSec = Math.round((distMi / DRIVER_AVG_MPH) * 3600);
  }

  // Trip running clock — starts when status becomes in_progress
  const tripStartedAt = tsToMillis(ride.tripStartedAt ?? ride.pickedUpAt ?? null);
  const elapsedMs = (ride.status === 'in_progress' && tripStartedAt > 0) ? (now - tripStartedAt) : 0;

  return (
    <div style={{
      position: 'absolute', bottom: 16, left: 12, right: 12, zIndex: 26,
      pointerEvents: 'auto',
      animation: 'uaSlideUp .4s cubic-bezier(.34,1.2,.64,1) both',
    }}>
      <div style={{
        background: 'linear-gradient(180deg, rgba(4,10,6,.94), rgba(2,6,4,.97))',
        border: `1px solid ${disp.color}44`,
        borderRadius: 18, overflow: 'hidden',
        boxShadow: `0 12px 40px rgba(0,0,0,.6), 0 0 32px ${disp.color}22`,
        backdropFilter: 'blur(14px)',
      }}>
        <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${disp.color}, transparent)` }}/>

        <div style={{ padding: '12px 14px 12px' }}>
          {/* Status + headline metric */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: disp.color, boxShadow: `0 0 8px ${disp.color}`,
                animation: disp.blink ? 'uaBlink 1.4s ease-in-out infinite' : 'none',
              }}/>
              <span style={{
                fontFamily: COND, fontSize: 10.5, fontWeight: 800,
                letterSpacing: '.16em', color: disp.color, textTransform: 'uppercase',
              }}>{disp.label}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              {distMi != null && (
                <span style={{
                  fontFamily: MONO, fontSize: 14, fontWeight: 800, color: disp.color,
                }}>{distMi.toFixed(1)}</span>
              )}
              {distMi != null && (
                <span style={{
                  fontFamily: COND, fontSize: 8.5, fontWeight: 800,
                  letterSpacing: '.12em', color: C.inkTextDim,
                }}>MI</span>
              )}
              {etaSec != null && (
                <>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,.18)', margin: '0 4px' }}>·</span>
                  <span style={{
                    fontFamily: MONO, fontSize: 13, fontWeight: 800, color: '#fff',
                  }}>{fmtSecondsToMin(etaSec) || '—'}</span>
                </>
              )}
              {ride.status === 'in_progress' && tripStartedAt > 0 && (
                <>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,.18)', margin: '0 4px' }}>·</span>
                  <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: C.amberBright }}>
                    {fmtElapsed(elapsedMs)}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Driver card (assigned / arrived / in_progress) */}
          {disp.showDriver && driver && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 11,
              padding: '10px 12px',
              background: 'rgba(255,255,255,.03)',
              border: '1px solid rgba(103,232,249,.18)',
              borderRadius: 12, marginBottom: 10,
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                background: 'rgba(103,232,249,.16)', color: C.cyan,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid rgba(103,232,249,.4)',
                overflow: 'hidden',
              }}>
                {driver.photoURL
                  ? <img src={driver.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                  : <Icon name="car" size={18} color={C.cyan}/>
                }
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: COND, fontSize: 13, fontWeight: 800,
                  letterSpacing: '.04em', color: '#fff',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {driver.firstName || 'Your driver'}
                  {typeof driver.rating === 'number' && (
                    <span style={{ marginLeft: 8, fontFamily: MONO, fontSize: 10, fontWeight: 700, color: C.amberBright }}>
                      ★ {driver.rating.toFixed(1)}
                    </span>
                  )}
                </div>
                <div style={{
                  fontFamily: MONO, fontSize: 9.5, color: 'rgba(255,255,255,.45)',
                  marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {driver.car || 'Vehicle'}
                  {driver.plate ? ` · ${driver.plate}` : ''}
                </div>
              </div>
              {driver.phone && onContactDriver && (
                <button onClick={() => onContactDriver(driver)}
                  style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    border: '1px solid rgba(74,222,128,.4)',
                    background: 'rgba(34,197,94,.14)', color: C.greenBright,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  aria-label="Call driver">
                  <Icon name="phone" size={14} color={C.greenBright}/>
                </button>
              )}
            </div>
          )}

          {/* Route summary */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              paddingTop: 3, flexShrink: 0,
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%', background: C.greenBright,
                boxShadow: `0 0 7px ${C.greenBright}88`,
              }}/>
              <div style={{
                width: 1.5, flex: 1, minHeight: 16,
                background: `linear-gradient(to bottom, ${C.greenBright}55, rgba(255,255,255,.1))`,
                margin: '3px 0', borderRadius: 2,
              }}/>
              <div style={{
                width: 8, height: 8,
                background: 'rgba(255,255,255,.65)',
                transform: 'rotate(45deg)', flexShrink: 0,
                boxShadow: '0 0 5px rgba(255,255,255,.3)',
              }}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontFamily: COND, fontSize: 8, fontWeight: 800, letterSpacing: '.14em', color: C.inkTextDim, textTransform: 'uppercase', marginBottom: 2 }}>
                  Pickup
                </div>
                <div style={{
                  fontFamily: MONO, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.88)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{pickup}</div>
              </div>
              <div>
                <div style={{ fontFamily: COND, fontSize: 8, fontWeight: 800, letterSpacing: '.14em', color: C.inkTextDim, textTransform: 'uppercase', marginBottom: 2 }}>
                  Drop-off
                </div>
                <div style={{
                  fontFamily: MONO, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.5)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{dropoff}</div>
              </div>
            </div>
            {typeof ride.fareTotal === 'number' && (
              <div style={{
                flexShrink: 0, display: 'flex', alignItems: 'center',
                fontFamily: MONO, fontSize: 18, fontWeight: 800, color: C.amberBright,
                textShadow: `0 0 14px ${C.amberBright}55`,
              }}>
                ${ride.fareTotal.toFixed(2)}
              </div>
            )}
          </div>

          {/* Footer: cancel while still searching, otherwise status hint */}
          {ride.status === 'searching_driver' && onCancel && (
            <button onClick={onCancel}
              style={{
                marginTop: 12, width: '100%', padding: '9px 0', borderRadius: 11,
                border: '1px solid rgba(248,113,113,.32)',
                background: 'rgba(248,113,113,.08)', color: C.red,
                fontFamily: COND, fontSize: 10.5, fontWeight: 800, letterSpacing: '.14em',
                textTransform: 'uppercase', cursor: 'pointer',
              }}>
              Cancel Search
            </button>
          )}
          {ride.status === 'arrived' && (
            <div style={{
              marginTop: 10, padding: '7px 11px',
              background: 'rgba(74,222,128,.1)', border: '1px solid rgba(74,222,128,.3)',
              borderRadius: 9, display: 'flex', alignItems: 'center', gap: 7,
            }}>
              <Icon name="wave" size={12} color={C.greenBright}/>
              <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, color: C.greenBright }}>
                Your driver is outside. Look for {driver?.car || 'the vehicle'}.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// COMPLETED TRIP POPUP — full-screen confirmation, mirrors driver-side popup
// ═════════════════════════════════════════════════════════════════════════════
function CompletedRidePopup({ ride, onDismiss, onRate }) {
  if (!ride) return null;
  const fare    = typeof ride.fareTotal === 'number' ? ride.fareTotal : null;
  const miles   = typeof ride.tripDistanceMiles === 'number' ? ride.tripDistanceMiles : null;
  const mins    = typeof ride.tripDurationMin   === 'number' ? ride.tripDurationMin   : null;
  const pickup  = ride.pickup  || ride.pickupLabel  || null;
  const dropoff = ride.dropoff || ride.dropoffLabel || null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'radial-gradient(ellipse at 50% 44%, #071509 0%, #030604 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      animation: 'uaFadeIn .3s ease both', padding: 20,
    }}>
      {[80, 140, 200].map((r, i) => (
        <div key={i} style={{
          position: 'absolute', width: r * 2, height: r * 2, borderRadius: '50%',
          border: '1px solid rgba(74,222,128,.07)',
          animation: `uaRingPulse ${2.8 + i * 0.6}s ease-in-out ${i * 0.4}s infinite`,
          pointerEvents: 'none',
        }}/>
      ))}

      <button onClick={onDismiss}
        style={{
          position: 'absolute', top: 'calc(14px + env(safe-area-inset-top))', right: 16,
          width: 38, height: 38, borderRadius: 12, border: '1px solid rgba(255,255,255,.12)',
          background: 'rgba(255,255,255,.06)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', zIndex: 2,
        }} aria-label="Dismiss">
        <Icon name="x" size={16} color="rgba(255,255,255,.6)"/>
      </button>

      <div style={{ position: 'relative', width: 100, height: 100, marginBottom: 24 }}>
        {[0, 1].map(i => (
          <div key={i} style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            border: `1.5px solid ${C.greenBright}`,
            animation: `uaRingPulse 2s ${i * 0.35}s cubic-bezier(0,.4,.6,1) infinite`,
          }}/>
        ))}
        <div style={{
          position: 'absolute', inset: 16, borderRadius: '50%',
          background: 'rgba(34,197,94,.15)', border: `1.5px solid ${C.greenBright}55`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 36px ${C.greenBright}44`,
        }}>
          <Icon name="check" size={30} color={C.greenBright} stroke={2.4}/>
        </div>
      </div>

      <div style={{
        fontFamily: COND, fontSize: 13, fontWeight: 800, letterSpacing: '.22em',
        color: C.greenBright, textTransform: 'uppercase', marginBottom: 6,
      }}>
        You've Arrived
      </div>

      {fare !== null && (
        <div style={{
          fontFamily: MONO, fontSize: 52, fontWeight: 800,
          color: C.amberBright, lineHeight: 1,
          textShadow: `0 0 40px ${C.amberBright}66`, marginBottom: 6,
        }}>
          ${fare.toFixed(2)}
        </div>
      )}
      <div style={{
        fontFamily: COND, fontSize: 10, fontWeight: 800, letterSpacing: '.18em',
        color: C.inkTextDim, marginBottom: 28,
      }}>
        TOTAL FARE
      </div>

      {(miles !== null || mins !== null) && (
        <div style={{
          display: 'flex', gap: 1, marginBottom: 28,
          background: 'rgba(255,255,255,.03)', border: '1px solid rgba(34,197,94,.14)',
          borderRadius: 14, overflow: 'hidden',
        }}>
          {miles !== null && (
            <div style={{ padding: '10px 22px', textAlign: 'center' }}>
              <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 800, color: '#fff' }}>{miles.toFixed(1)}</div>
              <div style={{ fontFamily: COND, fontSize: 8.5, fontWeight: 800, letterSpacing: '.14em', color: C.inkTextDim, marginTop: 2 }}>MILES</div>
            </div>
          )}
          {miles !== null && mins !== null && (
            <div style={{ width: 1, background: 'rgba(34,197,94,.12)', alignSelf: 'stretch' }}/>
          )}
          {mins !== null && (
            <div style={{ padding: '10px 22px', textAlign: 'center' }}>
              <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 800, color: '#fff' }}>{mins}</div>
              <div style={{ fontFamily: COND, fontSize: 8.5, fontWeight: 800, letterSpacing: '.14em', color: C.inkTextDim, marginTop: 2 }}>MINS</div>
            </div>
          )}
        </div>
      )}

      {(pickup || dropoff) && (
        <div style={{
          width: 'min(88vw, 340px)',
          background: 'rgba(255,255,255,.03)', border: '1px solid rgba(34,197,94,.12)',
          borderRadius: 14, padding: '12px 16px', marginBottom: 24,
        }}>
          {pickup && (
            <div style={{ marginBottom: dropoff ? 10 : 0 }}>
              <div style={{ fontFamily: COND, fontSize: 8, fontWeight: 800, letterSpacing: '.14em', color: C.inkTextDim, marginBottom: 3 }}>PICKUP</div>
              <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pickup}</div>
            </div>
          )}
          {pickup && dropoff && <div style={{ height: 1, background: 'rgba(34,197,94,.1)', margin: '2px 0 10px' }}/>}
          {dropoff && (
            <div>
              <div style={{ fontFamily: COND, fontSize: 8, fontWeight: 800, letterSpacing: '.14em', color: C.inkTextDim, marginBottom: 3 }}>DROP-OFF</div>
              <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.5)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dropoff}</div>
            </div>
          )}
        </div>
      )}

      {onRate && (
        <button onClick={() => onRate(ride)}
          style={{
            padding: '11px 28px', borderRadius: 12,
            border: 'none', background: 'linear-gradient(135deg,#22C55E,#16A34A)',
            color: '#fff', cursor: 'pointer',
            fontFamily: COND, fontSize: 12, fontWeight: 800, letterSpacing: '.16em',
            textTransform: 'uppercase',
            boxShadow: '0 8px 26px rgba(34,197,94,.35)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
          <Icon name="star" size={14}/> Rate Your Driver
        </button>
      )}
    </div>
  );
}

// ─── Misc bottom chips (rider-facing reorg) ──────────────────────────────────
function FleetChip({ online, total }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 99,
      background: 'rgba(5,10,6,.55)', backdropFilter: 'blur(8px)',
      border: '1px solid rgba(34,197,94,.12)',
    }}>
      <div style={{
        width: 7, height: 7, borderRadius: '50%', background: C.green,
        boxShadow: `0 0 6px ${C.green}`,
        animation: online > 0 ? 'uaBlink 1.8s ease-in-out infinite' : 'none',
      }}/>
      <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: C.greenBright }}>{online}</span>
      <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,.22)' }}>/</span>
      <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.4)' }}>{total}</span>
      <span style={{ fontFamily: COND, fontSize: 9, fontWeight: 800, letterSpacing: '.13em', color: 'rgba(74,222,128,.5)', textTransform: 'uppercase' }}>fleet</span>
    </div>
  );
}

function CityChip() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7,
      padding: '4px 14px', borderRadius: 99,
      background: 'rgba(5,10,6,.55)', backdropFilter: 'blur(8px)',
      border: '1px solid rgba(34,197,94,.12)',
    }}>
      <Icon name="pin" size={10} color={C.greenBright}/>
      <span style={{ fontFamily: COND, fontSize: 10, fontWeight: 800,
        letterSpacing: '.18em', color: 'rgba(255,255,255,.35)' }}>
        ORLANDO · FL
      </span>
    </div>
  );
}

function NearestDriverChip({ mi }) {
  if (mi == null || !isFinite(mi)) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 11px', borderRadius: 99,
      background: 'rgba(103,232,249,.10)', backdropFilter: 'blur(8px)',
      border: '1px solid rgba(103,232,249,.32)',
    }}>
      <Icon name="car" size={11} color={C.cyan}/>
      <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: C.cyan }}>
        {mi.toFixed(1)}
      </span>
      <span style={{ fontFamily: COND, fontSize: 9, fontWeight: 800, letterSpacing: '.13em', color: 'rgba(103,232,249,.7)', textTransform: 'uppercase' }}>mi away</span>
    </div>
  );
}

// ─── New-ping alert toast ────────────────────────────────────────────────────
function PingAlert({ alert }) {
  if (!alert) return null;
  const distStr = (alert.dist !== null && alert.dist !== undefined && isFinite(alert.dist))
    ? `${alert.dist.toFixed(1)} mi` : null;
  return (
    <div style={{
      position: 'absolute', top: 36, left: '50%', transform: 'translateX(-50%)',
      zIndex: 36, pointerEvents: 'none',
      animation: 'uaSlideDown .35s cubic-bezier(.34,1.4,.64,1) both',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '7px 14px 7px 9px', borderRadius: 99,
        background: 'linear-gradient(180deg, rgba(8,20,12,.94), rgba(5,12,7,.96))',
        border: '1px solid rgba(103,232,249,.5)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 30px rgba(0,0,0,.55), 0 0 22px rgba(103,232,249,.25)',
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(103,232,249,.2)', color: C.cyan,
          boxShadow: '0 0 12px rgba(103,232,249,.6)',
          animation: 'uaBlink 1s ease-in-out infinite',
        }}>
          <Icon name="car" size={12} color={C.cyan}/>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
          <span style={{
            fontFamily: COND, fontSize: 9, fontWeight: 800, letterSpacing: '.16em',
            textTransform: 'uppercase', color: 'rgba(103,232,249,.7)',
          }}>
            {alert.title || 'Driver nearby'}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 800, color: '#fff' }}>
            {distStr || 'incoming'}{alert.dir ? ` · ${alert.dir}` : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Legend (idle radar mode) ────────────────────────────────────────────────
function LegendKey() {
  const rows = [
    { c: C.cyan,        label: 'Driver' },
    { c: C.greenBright, label: 'Rider' },
    { c: C.violet,      label: 'Scheduled' },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 130, left: 16, zIndex: 18, pointerEvents: 'none',
      display: 'flex', flexDirection: 'column', gap: 5,
      padding: '7px 10px', borderRadius: 11,
      background: 'rgba(5,10,6,.55)', backdropFilter: 'blur(8px)',
      border: '1px solid rgba(34,197,94,.12)',
      animation: 'uaFadeIn .6s ease both',
    }}>
      <span style={{ fontFamily: COND, fontSize: 7.5, fontWeight: 800,
        letterSpacing: '.16em', color: C.inkTextDim, marginBottom: 1 }}>
        CONTACTS
      </span>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%', background: r.c,
            boxShadow: `0 0 6px ${r.c}99`,
          }}/>
          <span style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 600, color: 'rgba(255,255,255,.45)' }}>
            {r.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════
const ROUTE_SOURCE = 'ua-route';
const ROUTE_LAYERS = ['ua-route-glow', 'ua-route-main', 'ua-route-dash'];
const TRIP_SOURCE  = 'ua-trip-route';
const TRIP_LAYERS  = ['ua-trip-glow', 'ua-trip-main'];
const TRAIL_SOURCE = 'ua-trail';
const TRAIL_LAYERS = ['ua-trail-glow', 'ua-trail-line'];

export default function UaTob({
  uid,
  rides           = [],
  searches        = [],
  scheduledRides  = [],
  drivers         = [],
  trips           = [],
  account         = null,
  createTrip,
  activeRide:     activeRideProp,
  onOpenSupport,
  onCancelRide,
  onContactDriver,
  onRateRide,
  supportUnread   = 0,
}) {
  // ── refs ────────────────────────────────────────────────────────────────
  const mapContainerRef     = useRef(null);
  const mapRef              = useRef(null);
  const sweepRef            = useRef(0);
  const rafRef              = useRef(null);
  const svgRef              = useRef(null);
  const pulseLayersRef      = useRef(false);
  const bootTimersRef       = useRef([]);

  const searchMarkersRef    = useRef(new Map());   // search id → mapbox Marker
  const driverMarkersRef    = useRef(new Map());   // driver id → mapbox Marker
  const riderMarkerRef      = useRef(null);        // self marker
  const pickupMarkerRef     = useRef(null);        // active ride pickup
  const dropoffMarkerRef    = useRef(null);        // active ride dropoff
  const activeDriverMarkerRef = useRef(null);      // active ride driver marker

  // follow engine
  const followRafRef        = useRef(0);
  const targetCenterRef     = useRef(null);   // [lng,lat] latest live fix
  const renderedCenterRef   = useRef(null);   // [lng,lat] currently rendered
  const trailRef            = useRef([]);
  const trailReadyRef       = useRef(false);

  // route caching
  const routeAbortRef       = useRef(null);
  const lastRouteAtRef      = useRef(0);
  const lastRouteFromRef    = useRef(null);   // [lng,lat] last fetch origin

  // account write throttle
  const lastAccountWriteRef = useRef(0);

  // active ride tracking
  const activeRideRef       = useRef(null);
  const lastCompletedIdRef  = useRef(null);

  // ── state ───────────────────────────────────────────────────────────────
  const [mapReady,      setMapReady]      = useState(false);
  const [bootStep,      setBootStep]      = useState(0);
  const [bootDone,      setBootDone]      = useState(false);
  const [now,           setNow]           = useState(Date.now());
  const [mapBearing,    setMapBearing]    = useState(-20);
  const [mapZoom,       setMapZoom]       = useState(12);
  const [face,          setFace]          = useState(FACE_BOOK);
  const [driverCounts,  setDriverCounts]  = useState({ online: 0, total: 0 });
  const [onlineDrivers, setOnlineDrivers] = useState([]);
  const [routeSummary,  setRouteSummary]  = useState(null); // { coords, distance, duration }
  const [showCompleted, setShowCompleted] = useState(false);
  const [completedRide, setCompletedRide] = useState(null);
  const [alert, setAlert]                 = useState(null);
  const prevSearchCountRef                = useRef(0);
  const alertTimerRef                     = useRef(null);

  // ── live rider position (geolocation watch + heading derivation) ────────
  const handleRiderMove = useCallback((fix) => {
    // Throttled persistence to Accounts/{uid}. We don't write every tick — the
    // dispatcher just needs a recent-ish fix for pickup proximity.
    if (!uid) return;
    const tNow = Date.now();
    if (tNow - lastAccountWriteRef.current < ACCOUNT_WRITE_THROTTLE) return;
    lastAccountWriteRef.current = tNow;
    updateDoc(doc(db, 'Accounts', uid), {
      lat: fix.lat,
      lng: fix.lng,
      heading: fix.heading ?? null,
      locationUpdatedAt: serverTimestamp(),
    }).catch(() => {});
  }, [uid]);

  const { rider, fix: liveFix, live: gpsLive } = useLiveRiderPosition(account, handleRiderMove);
  const riderLat = rider?.lat;
  const riderLng = rider?.lng;

  // ── pick / track the active ride + its assigned driver ──────────────────
  const activeRide = useActiveRide(rides, activeRideProp);
  useEffect(() => { activeRideRef.current = activeRide; }, [activeRide]);

  const assignedDriverUid = activeRide?.driverInfo?.uid || activeRide?.driverUid || null;
  const assignedDriver    = useAssignedDriverLive(assignedDriverUid);

  // The driver shown on screen during a ride: prefer the live subscription,
  // fall back to whatever the ride doc snapshotted at dispatch time.
  const effectiveDriver = useMemo(() => {
    if (assignedDriver?.lat && assignedDriver?.lng) return assignedDriver;
    const d = activeRide?.driverInfo;
    if (d?.lat && d?.lng) return d;
    return null;
  }, [assignedDriver, activeRide?.driverInfo]);

  // ── derived ─────────────────────────────────────────────────────────────
  const nearestDriverMi = useMemo(() => {
    if (typeof riderLat !== 'number' || typeof riderLng !== 'number') return null;
    if (!onlineDrivers.length) return null;
    let best = Infinity;
    for (const d of onlineDrivers) {
      if (typeof d.lat !== 'number' || typeof d.lng !== 'number') continue;
      const dist = haversineMiles(riderLat, riderLng, d.lat, d.lng);
      if (dist < best) best = dist;
    }
    return isFinite(best) ? best : null;
  }, [riderLat, riderLng, onlineDrivers]);

  const contacts = useMemo(
    () => gatherRadarContacts(rider, searches, onlineDrivers, scheduledRides),
    // eslint-disable-next-line
    [riderLat, riderLng, searches, onlineDrivers, scheduledRides]
  );

  // Ribbon mode label
  const { ribbonMode, ribbonColor } = useMemo(() => {
    if (!activeRide) return { ribbonMode: null, ribbonColor: null };
    const d = STATUS_DISPLAY[activeRide.status];
    if (!d) return { ribbonMode: 'ON TRIP', ribbonColor: C.amberBright };
    return { ribbonMode: d.label, ribbonColor: d.color };
  }, [activeRide]);

  const speedStr = fmtSpeed(liveFix?.speed);
  const accStr   = fmtAccuracy(liveFix?.accuracy);

  // ── 1 Hz clock ──────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Driver fleet snapshot ───────────────────────────────────────────────
  useEffect(() => {
    const q     = query(collection(db, 'Drivers'), where('status', '==', 'online'));
    const unsub = onSnapshot(q, snap => {
      const positions = [];
      snap.forEach(d => {
        const data = d.data();
        if (typeof data.lat === 'number' && typeof data.lng === 'number') {
          positions.push({ id: d.id, lat: data.lat, lng: data.lng, heading: data.heading ?? null });
        }
      });
      setOnlineDrivers(positions);
    });
    // Total fleet count (any status) — separate listener to avoid composite index
    const unsubTotal = onSnapshot(collection(db, 'Drivers'), snap => {
      let online = 0;
      snap.forEach(d => {
        const s = (d.data()?.status ?? '').toLowerCase();
        if (s === 'online') online++;
      });
      setDriverCounts({ online, total: snap.size });
    });
    return () => { unsub(); unsubTotal(); };
  }, []);

  // ── Boot sequence ───────────────────────────────────────────────────────
  useEffect(() => {
    bootTimersRef.current.forEach(clearTimeout);
    bootTimersRef.current = [];
    setBootStep(0);
    setBootDone(false);
    const stepDelay = 220;
    for (let i = 1; i <= BOOT_LINES.length; i++) {
      const t = setTimeout(() => setBootStep(i), i * stepDelay);
      bootTimersRef.current.push(t);
    }
    const done = setTimeout(
      () => setBootDone(true),
      BOOT_LINES.length * stepDelay + 420
    );
    bootTimersRef.current.push(done);
    return () => { bootTimersRef.current.forEach(clearTimeout); bootTimersRef.current = []; };
  }, []);

  // ── Push a point onto the live trail (radar only) ───────────────────────
  const pushTrail = useCallback((pt) => {
    if (!SHOW_MOVEMENT_TRAIL || !pt) return;
    const arr  = trailRef.current;
    const last = arr[arr.length - 1];
    if (last) {
      const d = haversineMiles(last[1], last[0], pt[1], pt[0]);
      if (d < TRAIL_MIN_MOVE_MI) return;
    }
    arr.push([pt[0], pt[1]]);
    if (arr.length > TRAIL_MAX_POINTS) arr.shift();
    const map = mapRef.current;
    if (!map || !trailReadyRef.current) return;
    const src = map.getSource(TRAIL_SOURCE);
    if (!src) return;
    const coords = arr.length > 1 ? arr : [arr[0] || pt, pt];
    try { src.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: coords } }); } catch (e) {}
  }, []);

  // ── Init Mapbox ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return;

    const link   = document.createElement('link');
    link.rel     = 'stylesheet';
    link.href    = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css';
    const script = document.createElement('script');
    script.src   = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js';
    script.async = true;
    document.head.appendChild(link);
    document.head.appendChild(script);

    script.onload = () => {
      if (!mapContainerRef.current) return;
      const mapboxgl       = window.mapboxgl;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      const centerLng = riderLng ?? account?.lng ?? ORL_LNG;
      const centerLat = riderLat ?? account?.lat ?? ORL_LAT;

      const map = new mapboxgl.Map({
        container:          mapContainerRef.current,
        style:              MAP_STYLE,
        center:             [centerLng, centerLat],
        zoom:               12,
        pitch:              45,
        bearing:            -20,
        interactive:        false,
        attributionControl: false,
      });

      map.on('load', () => {
        mapRef.current = map;

        // seed follow engine
        renderedCenterRef.current = [centerLng, centerLat];
        if (!targetCenterRef.current) targetCenterRef.current = [centerLng, centerLat];

        // ── trail (below other geometry) ─────────────────────────────
        map.addSource(TRAIL_SOURCE, { type: 'geojson', lineMetrics: true, data: EMPTY_LINE });
        map.addLayer({
          id: 'ua-trail-glow', type: 'line', source: TRAIL_SOURCE,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint:  { 'line-color': '#4ADE80', 'line-width': 7, 'line-opacity': 0.12, 'line-blur': 4 },
        });
        map.addLayer({
          id: 'ua-trail-line', type: 'line', source: TRAIL_SOURCE,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-width': 3,
            'line-gradient': [
              'interpolate', ['linear'], ['line-progress'],
              0,   'rgba(74,222,128,0)',
              0.6, 'rgba(74,222,128,0.25)',
              1,   'rgba(74,222,128,0.7)',
            ],
          },
        });
        trailReadyRef.current = true;

        // ── search heatmap + dots ────────────────────────────────────
        map.addSource('ua-searches',  { type: 'geojson', data: buildSearchGeoJSON(searches) });
        map.addSource('ua-scheduled', { type: 'geojson', data: buildScheduledGeoJSON(scheduledRides) });

        map.addLayer({
          id: 'ua-demand', type: 'heatmap', source: 'ua-searches',
          paint: {
            'heatmap-weight':    ['interpolate', ['linear'], ['get', 'age'], 0, 0.2, 1, 1],
            'heatmap-intensity': 0.6,
            'heatmap-radius':    38,
            'heatmap-opacity':   0.28,
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0,   'rgba(0,0,0,0)',
              0.2, 'rgba(16,80,45,0.25)',
              0.5, 'rgba(34,197,94,0.35)',
              0.8, 'rgba(251,191,36,0.4)',
              1,   'rgba(251,146,60,0.55)',
            ],
          },
        });
        map.addLayer({ id: 'ua-search-halo', type: 'circle', source: 'ua-searches', paint: {
          'circle-radius':       12,
          'circle-color':        'rgba(52,211,153,0)',
          'circle-stroke-color': 'rgba(52,211,153,0.4)',
          'circle-stroke-width': 1.5,
          'circle-opacity':      ['*', ['get', 'age'], 0.55],
        }});
        map.addLayer({ id: 'ua-search-dot', type: 'circle', source: 'ua-searches', paint: {
          'circle-radius':       5,
          'circle-color':        ['case', ['get', 'guest'], 'rgba(251,146,60,0.95)', 'rgba(52,211,153,0.95)'],
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1.5,
          'circle-blur':         0.1,
          'circle-opacity':      ['*', ['get', 'age'], 0.9],
        }});
        map.addLayer({ id: 'ua-sched-dot', type: 'circle', source: 'ua-scheduled', paint: {
          'circle-radius':       7,
          'circle-color':        'rgba(192,132,252,0.9)',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1.8,
        }});

        pulseLayersRef.current = true;

        // rider marker
        try {
          riderMarkerRef.current = new mapboxgl.Marker({ element: makeRiderEl(), anchor: 'center' })
            .setLngLat([centerLng, centerLat])
            .addTo(map);
        } catch (e) {}

        // slow bearing drift while idle
        let bearing = -20;
        const drift = setInterval(() => {
          if (activeRideRef.current) return; // hand camera off during trip
          bearing += 0.03;
          map.setBearing(bearing);
        }, 120);
        map.on('remove', () => clearInterval(drift));

        // telemetry tick
        const telemetry = setInterval(() => {
          if (!mapRef.current) return;
          try {
            setMapBearing(mapRef.current.getBearing());
            setMapZoom(mapRef.current.getZoom());
          } catch (e) {}
        }, 220);
        map.on('remove', () => clearInterval(telemetry));

        // halo pulse animation
        let t = 0;
        const pulse = setInterval(() => {
          if (!map.isStyleLoaded()) return;
          t += 0.06;
          const r = 9 + 9 * ((Math.sin(t) + 1) / 2);
          try {
            map.setPaintProperty('ua-search-halo', 'circle-radius', r);
            map.setPaintProperty('ua-search-halo', 'circle-stroke-width', 1 + 1.2 * ((Math.sin(t) + 1) / 2));
          } catch (e) {}
        }, 40);
        map.on('remove', () => clearInterval(pulse));

        setMapReady(true);
      });
    };

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current        = null;
        pulseLayersRef.current = false;
        trailReadyRef.current  = false;
        trailRef.current       = [];
        renderedCenterRef.current = null;
        riderMarkerRef.current = null;
        pickupMarkerRef.current = null;
        dropoffMarkerRef.current = null;
        activeDriverMarkerRef.current = null;
        setMapReady(false);
      }
    };
  }, []); // eslint-disable-line

  // ── Feed live position into follow target + rider marker ────────────────
  useEffect(() => {
    if (typeof riderLat !== 'number' || typeof riderLng !== 'number') return;
    targetCenterRef.current = [riderLng, riderLat];
    if (!renderedCenterRef.current) renderedCenterRef.current = [riderLng, riderLat];
    if (riderMarkerRef.current) {
      try { riderMarkerRef.current.setLngLat([riderLng, riderLat]); } catch (e) {}
    }
  }, [riderLat, riderLng]);

  // ── Master follow loop ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) { cancelAnimationFrame(followRafRef.current); return; }
    let alive = true;
    let frame = 0;

    const loop = () => {
      if (!alive) return;
      followRafRef.current = requestAnimationFrame(loop);
      const map = mapRef.current;
      if (!map) return;
      const target = targetCenterRef.current;
      if (!target) return;
      if (!renderedCenterRef.current) renderedCenterRef.current = [target[0], target[1]];
      const r = renderedCenterRef.current;
      r[0] = lerp(r[0], target[0], FOLLOW_SMOOTH);
      r[1] = lerp(r[1], target[1], FOLLOW_SMOOTH);

      // Only own the camera in radar mode; during an active ride fitBounds rules
      if (!activeRideRef.current) {
        try { map.setCenter(r); } catch (e) {}
        frame++;
        if (frame % TRAIL_PUSH_EVERY === 0) pushTrail(target);
      }
    };
    followRafRef.current = requestAnimationFrame(loop);
    return () => { alive = false; cancelAnimationFrame(followRafRef.current); };
  }, [mapReady, pushTrail]);

  // ── Toggle / clear trail around active rides ────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !trailReadyRef.current) return;
    const vis = (!activeRide && SHOW_MOVEMENT_TRAIL) ? 'visible' : 'none';
    TRAIL_LAYERS.forEach(id => {
      try { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis); } catch (e) {}
    });
    if (activeRide) {
      trailRef.current = [];
      try { map.getSource(TRAIL_SOURCE)?.setData(EMPTY_LINE); } catch (e) {}
    }
  }, [activeRide, mapReady]);

  // ── Update GeoJSON on data change ───────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const apply = () => {
      try {
        map.getSource('ua-searches') ?.setData(buildSearchGeoJSON(searches));
        map.getSource('ua-scheduled')?.setData(buildScheduledGeoJSON(scheduledRides));
      } catch (e) {}
    };
    if (map.isStyleLoaded()) apply(); else map.once('styledata', apply);
  }, [searches, scheduledRides, mapReady]);

  // ── Search ring markers ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.mapboxgl) return;
    const store = searchMarkersRef.current;
    const seen  = new Set();

    searches.filter(hasCoords).forEach(s => {
      seen.add(s.id);
      if (!store.has(s.id)) {
        const isGuest = !s.uid || s.uid === 'null';
        const el      = makeSearchRingEl(isGuest);
        const marker  = new window.mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([s.pickupLng, s.pickupLat])
          .addTo(mapRef.current);
        store.set(s.id, marker);
      }
    });

    store.forEach((marker, id) => {
      if (!seen.has(id)) {
        try { marker.remove(); } catch (e) {}
        store.delete(id);
      }
    });
  }, [searches, mapReady]);

  useEffect(() => {
    if (mapReady) return;
    searchMarkersRef.current.forEach(m => { try { m.remove(); } catch (e) {} });
    searchMarkersRef.current.clear();
  }, [mapReady]);

  // ── Online driver dot markers (idle radar mode) ─────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.mapboxgl) return;
    const store = driverMarkersRef.current;
    const seen  = new Set();

    // Hide all driver dots during active ride (the dedicated marker shows the
    // assigned driver instead).
    if (activeRide) {
      store.forEach(m => { try { m.remove(); } catch (e) {} });
      store.clear();
      return;
    }

    onlineDrivers.forEach(({ id, lat, lng }) => {
      seen.add(id);
      if (store.has(id)) {
        try { store.get(id).setLngLat([lng, lat]); } catch (e) {}
      } else {
        const marker = new window.mapboxgl.Marker({ element: makeDriverDotEl(), anchor: 'center' })
          .setLngLat([lng, lat])
          .addTo(mapRef.current);
        store.set(id, marker);
      }
    });

    store.forEach((marker, id) => {
      if (!seen.has(id)) {
        try { marker.remove(); } catch (e) {}
        store.delete(id);
      }
    });
  }, [onlineDrivers, mapReady, activeRide]);

  useEffect(() => {
    if (mapReady) return;
    driverMarkersRef.current.forEach(m => { try { m.remove(); } catch (e) {} });
    driverMarkersRef.current.clear();
  }, [mapReady]);

  // ── Active ride: pickup + dropoff markers ───────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.mapboxgl) return;
    const map      = mapRef.current;
    const mapboxgl = window.mapboxgl;

    // Tear down any existing markers when ride goes away or changes id
    const cleanup = () => {
      if (pickupMarkerRef.current)  { try { pickupMarkerRef.current.remove(); }  catch (e) {} pickupMarkerRef.current  = null; }
      if (dropoffMarkerRef.current) { try { dropoffMarkerRef.current.remove(); } catch (e) {} dropoffMarkerRef.current = null; }
    };

    if (!activeRide) { cleanup(); return; }

    // Pickup pin — always shown during active ride
    if (typeof activeRide.pickupLat === 'number' && typeof activeRide.pickupLng === 'number') {
      if (!pickupMarkerRef.current) {
        pickupMarkerRef.current = new mapboxgl.Marker({ element: makePickupEl(), anchor: 'center' })
          .setLngLat([activeRide.pickupLng, activeRide.pickupLat])
          .addTo(map);
      } else {
        try { pickupMarkerRef.current.setLngLat([activeRide.pickupLng, activeRide.pickupLat]); } catch (e) {}
      }
    }

    // Dropoff pin — only useful once trip is in progress
    if (activeRide.status === 'in_progress'
        && typeof activeRide.dropoffLat === 'number' && typeof activeRide.dropoffLng === 'number') {
      if (!dropoffMarkerRef.current) {
        dropoffMarkerRef.current = new mapboxgl.Marker({ element: makeDropoffEl(), anchor: 'center' })
          .setLngLat([activeRide.dropoffLng, activeRide.dropoffLat])
          .addTo(map);
      } else {
        try { dropoffMarkerRef.current.setLngLat([activeRide.dropoffLng, activeRide.dropoffLat]); } catch (e) {}
      }
    } else if (dropoffMarkerRef.current) {
      try { dropoffMarkerRef.current.remove(); } catch (e) {}
      dropoffMarkerRef.current = null;
    }

    return cleanup;
  // eslint-disable-next-line
  }, [activeRide?.id, activeRide?.status, mapReady]);

  // ── Active ride: assigned-driver marker ─────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.mapboxgl) return;
    const map      = mapRef.current;
    const mapboxgl = window.mapboxgl;

    // No active ride or no driver position → tear down
    if (!activeRide || !effectiveDriver?.lat || !effectiveDriver?.lng) {
      if (activeDriverMarkerRef.current) {
        try { activeDriverMarkerRef.current.marker.remove(); } catch (e) {}
        activeDriverMarkerRef.current = null;
      }
      return;
    }

    if (!activeDriverMarkerRef.current) {
      const { el, refs } = makeActiveDriverEl(effectiveDriver.heading || 0);
      const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat([effectiveDriver.lng, effectiveDriver.lat])
        .addTo(map);
      activeDriverMarkerRef.current = { marker, refs };
    } else {
      try { activeDriverMarkerRef.current.marker.setLngLat([effectiveDriver.lng, effectiveDriver.lat]); } catch (e) {}
      // rotate inner car icon to match heading
      const car = activeDriverMarkerRef.current.refs?.car?.querySelector('svg');
      if (car && typeof effectiveDriver.heading === 'number') {
        car.style.transform = `rotate(${effectiveDriver.heading}deg)`;
      }
    }
  }, [effectiveDriver?.lat, effectiveDriver?.lng, effectiveDriver?.heading, activeRide?.id, mapReady]);

  // ── Active ride: route line (driver→pickup, then pickup→dropoff) ────────
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;

    // Clean up if no active ride
    if (!activeRide) {
      [...ROUTE_LAYERS, ...TRIP_LAYERS].forEach(id => {
        try { if (map.getLayer(id)) map.removeLayer(id); } catch (e) {}
      });
      try { if (map.getSource(ROUTE_SOURCE)) map.removeSource(ROUTE_SOURCE); } catch (e) {}
      try { if (map.getSource(TRIP_SOURCE))  map.removeSource(TRIP_SOURCE);  } catch (e) {}
      setRouteSummary(null);
      lastRouteAtRef.current = 0;
      lastRouteFromRef.current = null;
      return;
    }

    // Decide endpoints based on ride status
    let from = null, to = null, sourceId = ROUTE_SOURCE;
    if (activeRide.status === 'in_progress') {
      // pickup→dropoff route is fixed; we draw it on the trip source so it
      // doesn't get clobbered when the driver→pickup route source is removed.
      if (effectiveDriver?.lat && effectiveDriver?.lng
          && activeRide.dropoffLat && activeRide.dropoffLng) {
        from = [effectiveDriver.lng, effectiveDriver.lat];
        to   = [activeRide.dropoffLng, activeRide.dropoffLat];
        sourceId = TRIP_SOURCE;
      }
    } else if (activeRide.status === 'driver_assigned' || activeRide.status === 'arrived') {
      if (effectiveDriver?.lat && effectiveDriver?.lng
          && activeRide.pickupLat && activeRide.pickupLng) {
        from = [effectiveDriver.lng, effectiveDriver.lat];
        to   = [activeRide.pickupLng, activeRide.pickupLat];
      }
    }
    if (!from || !to) return;

    // Throttle refetch: time-based AND distance-based.
    const tNow      = Date.now();
    const lastFrom  = lastRouteFromRef.current;
    const movedFar  = lastFrom ? haversineMiles(lastFrom[1], lastFrom[0], from[1], from[0]) >= ROUTE_REFETCH_MIN_MOVE_MI : true;
    const timeAged  = tNow - lastRouteAtRef.current >= ROUTE_REFETCH_MS;
    if (!movedFar && !timeAged && map.getSource(sourceId)) return;

    // Cancel any in-flight request before firing a new one
    try { routeAbortRef.current?.abort(); } catch (e) {}
    const ctrl = new AbortController();
    routeAbortRef.current = ctrl;

    fetchRoute(from[0], from[1], to[0], to[1], ctrl.signal).then(route => {
      if (!route || !mapRef.current) return;
      const m   = mapRef.current;
      const geo = { type: 'Feature', geometry: { type: 'LineString', coordinates: route.coords } };

      const apply = () => {
        if (!mapRef.current?.isStyleLoaded()) { setTimeout(apply, 80); return; }
        const mm = mapRef.current;

        if (sourceId === ROUTE_SOURCE) {
          if (mm.getSource(ROUTE_SOURCE)) {
            mm.getSource(ROUTE_SOURCE).setData(geo);
          } else {
            mm.addSource(ROUTE_SOURCE, { type: 'geojson', data: geo });
            mm.addLayer({
              id: 'ua-route-glow', type: 'line', source: ROUTE_SOURCE,
              layout: { 'line-cap': 'round', 'line-join': 'round' },
              paint:  { 'line-color': '#67E8F9', 'line-width': 10, 'line-opacity': 0.14, 'line-blur': 5 },
            });
            mm.addLayer({
              id: 'ua-route-main', type: 'line', source: ROUTE_SOURCE,
              layout: { 'line-cap': 'round', 'line-join': 'round' },
              paint:  { 'line-color': '#67E8F9', 'line-width': 3.5, 'line-opacity': 1 },
            });
            mm.addLayer({
              id: 'ua-route-dash', type: 'line', source: ROUTE_SOURCE,
              layout: { 'line-cap': 'round', 'line-join': 'round' },
              paint:  { 'line-color': '#fff', 'line-width': 1.5, 'line-opacity': 0.35, 'line-dasharray': [0, 5] },
            });
          }
        } else {
          if (mm.getSource(TRIP_SOURCE)) {
            mm.getSource(TRIP_SOURCE).setData(geo);
          } else {
            mm.addSource(TRIP_SOURCE, { type: 'geojson', data: geo });
            mm.addLayer({
              id: 'ua-trip-glow', type: 'line', source: TRIP_SOURCE,
              layout: { 'line-cap': 'round', 'line-join': 'round' },
              paint:  { 'line-color': '#22C55E', 'line-width': 10, 'line-opacity': 0.14, 'line-blur': 5 },
            });
            mm.addLayer({
              id: 'ua-trip-main', type: 'line', source: TRIP_SOURCE,
              layout: { 'line-cap': 'round', 'line-join': 'round' },
              paint:  { 'line-color': '#22C55E', 'line-width': 3.5, 'line-opacity': 1 },
            });
          }
        }

        // Fit camera around all relevant points so both endpoints are visible
        const pts = [from, to, ...route.coords];
        if (riderLat && riderLng) pts.push([riderLng, riderLat]);
        const minLng = Math.min(...pts.map(p => p[0]));
        const maxLng = Math.max(...pts.map(p => p[0]));
        const minLat = Math.min(...pts.map(p => p[1]));
        const maxLat = Math.max(...pts.map(p => p[1]));
        try {
          mm.fitBounds([[minLng, minLat], [maxLng, maxLat]], {
            padding: { top: 80, right: 60, bottom: 220, left: 60 },
            maxZoom: 15.5, duration: 900,
          });
        } catch (e) {}
      };
      apply();

      lastRouteAtRef.current   = tNow;
      lastRouteFromRef.current = from;
      setRouteSummary(route);
    });

    return () => { try { ctrl.abort(); } catch (e) {} };
  // eslint-disable-next-line
  }, [
    activeRide?.id, activeRide?.status,
    effectiveDriver?.lat, effectiveDriver?.lng,
    mapReady,
  ]);

  // ── Radar sweep RAF (hidden while on a ride) ────────────────────────────
  useEffect(() => {
    if (!mapReady || activeRide) { cancelAnimationFrame(rafRef.current); return; }
    const animate = () => {
      sweepRef.current = (sweepRef.current + 1.1) % 360;
      if (svgRef.current) {
        const angle = sweepRef.current;
        const toRad = d => d * Math.PI / 180;
        const R = 55;
        const leadA   = (angle + 80) % 360;
        const trailX  = 50 + R * Math.cos(toRad(angle));
        const trailY  = 50 + R * Math.sin(toRad(angle));
        const leadX   = 50 + R * Math.cos(toRad(leadA));
        const leadY   = 50 + R * Math.sin(toRad(leadA));
        const tipX    = 50 + 52 * Math.cos(toRad(leadA));
        const tipY    = 50 + 52 * Math.sin(toRad(leadA));
        const cAngle  = (360 - angle * 0.6) % 360;
        const cLead   = (cAngle + 60) % 360;
        const cTrailX = 50 + R * Math.cos(toRad(cAngle));
        const cTrailY = 50 + R * Math.sin(toRad(cAngle));
        const cLeadX  = 50 + R * Math.cos(toRad(cLead));
        const cLeadY  = 50 + R * Math.sin(toRad(cLead));
        const q = svgRef.current.querySelector.bind(svgRef.current);
        q('#ua-sweep') ?.setAttribute('d', `M 50 50 L ${trailX} ${trailY} A ${R} ${R} 0 0 1 ${leadX} ${leadY} Z`);
        q('#ua-sweep2')?.setAttribute('d', `M 50 50 L ${cTrailX} ${cTrailY} A ${R} ${R} 0 0 1 ${cLeadX} ${cLeadY} Z`);
        q('#ua-arm')   ?.setAttribute('x2', leadX);
        q('#ua-arm')   ?.setAttribute('y2', leadY);
        q('#ua-tip')   ?.setAttribute('cx', tipX);
        q('#ua-tip')   ?.setAttribute('cy', tipY);
        q('#ua-tipglow')?.setAttribute('cx', tipX);
        q('#ua-tipglow')?.setAttribute('cy', tipY);
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [mapReady, activeRide]);

  // ── New-search ping alert (idle mode only) ──────────────────────────────
  useEffect(() => {
    if (activeRide) { prevSearchCountRef.current = searches.length; return; }
    if (searches.length > prevSearchCountRef.current) {
      const nearest = contacts.find(c => c.kind === 'search' || c.kind === 'guest');
      setAlert({
        title: 'New ride nearby',
        dist:  nearest ? nearest.dist : null,
        dir:   nearest ? compassLabel(nearest.bearing) : null,
        ts:    Date.now(),
    