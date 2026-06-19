/**
 * UaTobApp.jsx — Rider-facing full-screen Mapbox HUD  (realtime edition)
 *
 * Props:
 *   uid            string
 *   rides          array   — rider's rides (includes active / in-flight)
 *   searches       array   — live search pool (ambient heatmap)
 *   scheduledRides array   — rider's own scheduled rides
 *   trips          array   — completed trip history (falls back to rides)
 *   drivers        array   — reserved (online fleet)
 *   account        object  — rider account doc
 *   createTrip     fn      — books a ride (payload => Promise)
 *   activeRide     object  — optional explicit active ride (searching_driver/driver_assigned/arrived/in_progress)
 *   onCancelRide   fn      — (ride) => void
 *   onContactDriver fn     — (driver) => void   default: tel:
 *   onRateRide     fn      — (ride) => void
 *   onOpenSupport  fn      — () => void
 */



import {
  useState, useEffect, useRef, useCallback, useMemo, useReducer,
} from 'react';
import {
  collection, doc, onSnapshot, query, where,
  updateDoc, serverTimestamp, getFirestore, increment,
} from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';


import {
  FACE_BOOK, FACE_SEARCHES, FACE_SCHEDULED,
  FACE_NOTIFS, FACE_ACCOUNT, FACE_TRIPS, FACE_COUNT,
} from '@/App/UaTob/Statuscardtokens';
import { useDriverCounts } from '@/App/UaTob/useDriverCounts';
import StatusCard from '@/App/UaTob/StatusCard';
import RiderSupportOverlay from '@/App/UaTob/RiderSupportOverlay';
import { useRiderSupportUnread } from '@/App/UaTob/useRiderSupportUnread';
import CompanyOverlay from '@/App/UaTob/CompanyOverlay';

const db = getFirestore(firebase_app);

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:           '#050A06',
  bgDeep:       '#030604',
  bgCard:       'rgba(5,12,7,0.82)',
  green:        '#22C55E',
  greenBright:  '#4ADE80',
  greenSoft:    '#34D399',
  cyan:         '#22D3EE',
  amber:        '#FBBF24',
  red:          '#F87171',
  purple:       '#C084FC',
  inkDim:       'rgba(255,255,255,.22)',
  inkFade:      'rgba(255,255,255,.10)',
  inkMid:       'rgba(255,255,255,.45)',
  inkBright:    'rgba(255,255,255,.88)',
  border:       'rgba(34,197,94,.15)',
  borderBright: 'rgba(74,222,128,.35)',
};

const MONO = "'JetBrains Mono','SFMono-Regular',monospace";
const COND = "'Barlow Condensed','Barlow',sans-serif";
const BODY = "'Syne','Inter',sans-serif";

const MAPBOX_TOKEN  = 'pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA';
const MAP_STYLE     = 'mapbox://styles/mapbox/dark-v11';
const ORL_LNG       = -81.3792;
const ORL_LAT       =  28.5383;

// Follow / motion constants
const FOLLOW_SMOOTH         = 0.14;          // exponential ease per RAF frame
const STALE_FIX_MS          = 30_000;        // fall back to account.lat/lng after 30 s
const GEO_WRITE_THROTTLE_MS = 8_000;         // min ms between Firestore writes
const TRAIL_MAX_PTS         = 60;
const TRAIL_MIN_DIST_MI     = 0.004;         // ~21 ft minimum spacing
const ROUTE_SOURCE          = 'ua-route';    // driver→pickup (or driver→dropoff)
const TRIP_SOURCE           = 'ua-trip';     // pickup→dropoff during ride
const ROUTE_REFETCH_MS      = 12_000;
const ROUTE_REFETCH_MIN_MOVE_MI = 0.05;

// Active ride statuses
const ACTIVE_STATUSES = new Set([
  'searching_driver', 'driver_assigned', 'arrived', 'in_progress', 'timeout',
]);

// ─── Keyframes ────────────────────────────────────────────────────────────────
const KEYFRAMES = `
  @keyframes uaSpin       { to { transform:rotate(360deg) } }
  @keyframes uaSlideUp    { from{opacity:0;transform:translateY(14px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes uaSlideDown  { from{opacity:0;transform:translateY(-10px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes uaFadeIn     { from{opacity:0} to{opacity:1} }
  @keyframes uaBlink      { 0%,100%{opacity:1} 50%{opacity:.22} }
  @keyframes uaRingPulse  { 0%,100%{transform:scale(1);opacity:.18} 50%{transform:scale(1.48);opacity:0} }
  @keyframes uaScan       { from{top:-80px} to{top:100%} }
  @keyframes uaBarPulse   { 0%,100%{transform:scaleY(.5);opacity:.45} 50%{transform:scaleY(1);opacity:1} }
  @keyframes uaGlowPulse  { 0%,100%{box-shadow:0 0 18px rgba(74,222,128,.25)} 50%{box-shadow:0 0 38px rgba(74,222,128,.55)} }
  @keyframes ua-driver-pulse { 0%{transform:translate(-50%,-50%) scale(.4);opacity:.7} 100%{transform:translate(-50%,-50%) scale(2.2);opacity:0} }
  @keyframes ua-ring-out  { 0%{transform:translate(-50%,-50%) scale(.2);opacity:.9} 100%{transform:translate(-50%,-50%) scale(2.8);opacity:0} }
  @keyframes uaPopIn      { 0%{opacity:0;transform:scale(.9) translateY(12px)} 80%{transform:scale(1.02) translateY(-2px)} 100%{opacity:1;transform:scale(1) translateY(0)} }
  @keyframes uaShimmer    { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
  @keyframes uaCarPulse   { 0%{transform:translate(-50%,-50%) scale(.5);opacity:.8} 100%{transform:translate(-50%,-50%) scale(2.6);opacity:0} }
  @keyframes uaTermLine   { from{opacity:0;transform:translateX(-4px)} to{opacity:1;transform:translateX(0)} }
  @keyframes uaCursor     { 0%,100%{opacity:1} 50%{opacity:0} }
`;

// ─── Utilities ────────────────────────────────────────────────────────────────
function tsToMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') { const p = Date.parse(ts); return isNaN(p) ? 0 : p; }
  return 0;
}
function fmtSpeed(mps) {
  if (mps == null || !isFinite(mps) || mps < 0) return null;
  const mph = mps * 2.236936;
  return mph < 1 ? null : String(Math.round(mph));
}
function fmtClock(ms) {
  const d = new Date(ms);
  const p = n => String(n).padStart(2, '0');
  const h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${p(d.getMinutes())}:${p(d.getSeconds())} ${ap}`;
}
function hasCoords(o) {
  return typeof o?.pickupLat === 'number' && typeof o?.pickupLng === 'number';
}
function toRad(deg) { return deg * Math.PI / 180; }
function haverMi(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
          + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function bearing(lat1, lng1, lat2, lng2) {
  const y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2))
          - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
function lerpAngle(a, b, t) {
  let diff = ((b - a + 540) % 360) - 180;
  return a + diff * t;
}
function lerp(a, b, t) { return a + (b - a) * t; }
function fmtDist(mi) {
  if (mi < 0.1) return `${Math.round(mi * 5280)} ft`;
  return `${mi.toFixed(1)} mi`;
}
function fmtEta(secs) {
  if (!secs || secs <= 0) return '—';
  const m = Math.ceil(secs / 60);
  return m <= 1 ? '< 1 min' : `${m} min`;
}
function fmtElapsed(startMs) {
  const s = Math.floor((Date.now() - startMs) / 1000);
  const m = Math.floor(s / 60); const ss = s % 60;
  return `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
}
function fmtTimeAgo(ms, now) {
  if (!ms) return null;
  const diff = now - ms;
  if (diff < 0) return null;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}
function normalizeHeading(b) { return ((b % 360) + 360) % 360; }
function compassLabel(b) {
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(normalizeHeading(b) / 45) % 8];
}
function fmtUptime(onlineSinceMs, now) {
  if (!onlineSinceMs) return null;
  const s = Math.floor(Math.max(0, now - onlineSinceMs) / 1000);
  const m = Math.floor(s / 60); const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2,'0')}`;
  return `${m}:${String(s % 60).padStart(2,'0')}`;
}

// Project [lat,lng] to screen xy, return null if off-screen
function projectToScreen(map, lat, lng) {
  if (!map || !window.mapboxgl) return null;
  try {
    const pt = map.project([lng, lat]);
    const { width, height } = map.getContainer().getBoundingClientRect();
    if (pt.x < 0 || pt.x > width || pt.y < 0 || pt.y > height) return null;
    return { x: pt.x, y: pt.y };
  } catch { return null; }
}
function offScreenBearing(map, lat, lng) {
  if (!map) return null;
  try {
    const c = map.getCenter();
    return bearing(c.lat, c.lng, lat, lng);
  } catch { return null; }
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** Live GPS position + heading + throttled Firestore write */
function useLiveRiderPosition(uid, account) {
  const [rider, setRider] = useState(null);   // { lat, lng, heading, accuracy }
  const [fix,   setFix]   = useState(null);   // last fix timestamp ms
  const lastWriteRef      = useRef(0);
  const prevRef           = useRef(null);

  useEffect(() => {
    if (!navigator?.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      pos => {
        const { latitude: lat, longitude: lng, accuracy, speed: mps, heading } = pos.coords;
        const now = Date.now();
        setFix(now);

        // derive heading from movement if device doesn't provide one
        let h = (heading != null && isFinite(heading)) ? heading : null;
        if (h == null && prevRef.current) {
          const { lat: pLat, lng: pLng } = prevRef.current;
          if (haverMi(pLat, pLng, lat, lng) > 0.001) {
            h = bearing(pLat, pLng, lat, lng);
          }
        }
        prevRef.current = { lat, lng };
        setRider({ lat, lng, accuracy, speed: fmtSpeed(mps), heading: h });

        // throttled Accounts write
        if (uid && now - lastWriteRef.current >= GEO_WRITE_THROTTLE_MS) {
          lastWriteRef.current = now;
          updateDoc(doc(db, 'Accounts', uid), {
            lat, lng, locationUpdatedAt: serverTimestamp(),
          }).catch(() => {});
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [uid]);

  // fallback to account coords if fix is stale
  const live = useMemo(() => {
    if (rider && fix && Date.now() - fix < STALE_FIX_MS) return rider;
    if (account?.lat != null && account?.lng != null) {
      return { lat: account.lat, lng: account.lng, heading: null, speed: null };
    }
    return null;
  }, [rider, fix, account]);

  return { rider, fix, live };
}

/** Pick the most relevant active ride from the rides array */
function useActiveRide(rides, explicitActiveRide) {
  return useMemo(() => {
    if (explicitActiveRide && ACTIVE_STATUSES.has(explicitActiveRide.status)) {
      return explicitActiveRide;
    }
    const active = rides
      .filter(r => ACTIVE_STATUSES.has(r.status))
      .sort((a, b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt));
    return active[0] ?? null;
  }, [rides, explicitActiveRide]);
}

/** Live Firestore snapshot of the assigned driver doc */
function useAssignedDriverLive(driverUid) {
  const [driverDoc, setDriverDoc] = useState(null);
  useEffect(() => {
    if (!driverUid) { setDriverDoc(null); return; }
    const unsub = onSnapshot(doc(db, 'Drivers', driverUid), snap => {
      setDriverDoc(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });
    return () => unsub();
  }, [driverUid]);
  return driverDoc;
}

/** Fleet — online drivers with positions */
function useOnlineDrivers() {
  const [drivers, setDrivers]     = useState([]);
  const [counts,  setCounts]      = useState({ online: 0, total: 0 });

  useEffect(() => {
    // Total count from full collection
    const unsubAll = onSnapshot(collection(db, 'Drivers'), snap => {
      setCounts(c => ({ ...c, total: snap.size }));
    });
    // Online positions
    const q = query(collection(db, 'Drivers'), where('status', '==', 'online'));
    const unsubOnline = onSnapshot(q, snap => {
      const positions = [];
      snap.forEach(d => {
        const data = d.data();
        if (typeof data.lat === 'number' && typeof data.lng === 'number') {
          positions.push({ id: d.id, lat: data.lat, lng: data.lng, heading: data.heading ?? null });
        }
      });
      setCounts(c => ({ ...c, online: snap.size }));
      setDrivers(positions);
    });
    return () => { unsubAll(); unsubOnline(); };
  }, []);

  return { drivers, counts };
}

/** Mapbox Directions fetch — returns decoded coordinates array */
async function fetchRoute(originLng, originLat, destLng, destLat, signal) {
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving`
    + `/${originLng},${originLat};${destLng},${destLat}`
    + `?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
  const res = await fetch(url, { signal });
  const data = await res.json();
  const route = data.routes?.[0];
  if (!route) return null;
  return {
    coords:    route.geometry.coordinates,  // [[lng,lat],...]
    distanceMi: route.distance / 1609.344,
    durationSecs: route.duration,
  };
}

// ─── GeoJSON builders ─────────────────────────────────────────────────────────
function buildSearchGeoJSON(searches = []) {
  return {
    type: 'FeatureCollection',
    features: searches.filter(hasCoords).map(s => ({
      type: 'Feature',
      properties: {
        guest: !s.uid || s.uid === 'null',
        age:   Math.min(1, Math.max(0, 1 - (Date.now() - tsToMillis(s.createdAt)) / (3 * 3_600_000))),
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
function lineGeoJSON(coords = []) {
  return {
    type: 'FeatureCollection',
    features: coords.length >= 2 ? [{
      type: 'Feature', properties: {},
      geometry: { type: 'LineString', coordinates: coords },
    }] : [],
  };
}
function emptyGeoJSON() {
  return { type: 'FeatureCollection', features: [] };
}

// ─── Marker factories ─────────────────────────────────────────────────────────
function makeSearchRingEl(isGuest) {
  const col    = isGuest ? '#FB923C' : '#4ADE80';
  const colDim = isGuest ? 'rgba(251,146,60,' : 'rgba(74,222,128,';
  const wrap   = document.createElement('div');
  wrap.style.cssText = 'position:relative;width:0;height:0;pointer-events:none;';
  [0, 0.7, 1.4].forEach(delay => {
    const ring = document.createElement('div');
    ring.style.cssText = [
      'position:absolute','left:0','top:0','width:26px','height:26px','border-radius:50%',
      `border:1.5px solid ${colDim}.55)`,
      'transform:translate(-50%,-50%) scale(.2)',
      `animation:ua-ring-out 2.4s ease-out ${delay}s infinite`,
    ].join(';');
    wrap.appendChild(ring);
  });
  const dot = document.createElement('div');
  dot.style.cssText = [
    'position:absolute','left:0','top:0','width:8px','height:8px','border-radius:50%',
    `background:${col}`,'border:1.5px solid #fff',`box-shadow:0 0 10px ${col}`,
    'transform:translate(-50%,-50%)',
  ].join(';');
  wrap.appendChild(dot);
  return wrap;
}

function makeDriverDotEl() {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;width:0;height:0;pointer-events:none;';
  [0, 0.9].forEach(delay => {
    const ring = document.createElement('div');
    ring.style.cssText = [
      'position:absolute','left:0','top:0','width:22px','height:22px','border-radius:50%',
      'border:1.5px solid rgba(96,165,250,.55)',
      'transform:translate(-50%,-50%) scale(.4)','opacity:0',
      `animation:ua-driver-pulse 2s ease-out ${delay}s infinite`,
    ].join(';');
    wrap.appendChild(ring);
  });
  const dot = document.createElement('div');
  dot.style.cssText = [
    'position:absolute','left:0','top:0','width:10px','height:10px','border-radius:50%',
    'background:#60A5FA','border:2px solid #fff','box-shadow:0 0 10px rgba(96,165,250,.9)',
    'transform:translate(-50%,-50%)',
  ].join(';');
  wrap.appendChild(dot);
  return wrap;
}

function makeCarMarkerEl(heading) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;width:0;height:0;pointer-events:none;';
  const pulse = document.createElement('div');
  pulse.style.cssText = [
    'position:absolute','left:0','top:0','width:32px','height:32px','border-radius:50%',
    'border:2px solid rgba(34,197,94,.5)',
    'transform:translate(-50%,-50%) scale(.5)','opacity:0',
    'animation:uaCarPulse 1.8s ease-out infinite',
  ].join(';');
  const car = document.createElement('div');
  car.style.cssText = [
    'position:absolute','left:0','top:0','width:24px','height:24px',
    'border-radius:50%','background:rgba(5,10,6,.9)',
    'border:2.5px solid #22C55E','box-shadow:0 0 14px rgba(34,197,94,.9)',
    'transform:translate(-50%,-50%)',
    'display:flex','align-items:center','justify-content:center',
    'font-size:13px',
  ].join(';');
  car.textContent = '🚗';
  wrap.appendChild(pulse);
  wrap.appendChild(car);
  wrap._car = car;
  wrap._setHeading = (h) => {
    if (h != null) car.style.transform = `translate(-50%,-50%) rotate(${h}deg)`;
  };
  if (heading != null) wrap._setHeading(heading);
  return wrap;
}

function makeRiderMarkerEl() {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;width:0;height:0;pointer-events:none;';
  const pulse = document.createElement('div');
  pulse.style.cssText = [
    'position:absolute','left:0','top:0','width:20px','height:20px','border-radius:50%',
    'border:1.5px solid rgba(74,222,128,.55)',
    'transform:translate(-50%,-50%) scale(.3)','opacity:0',
    'animation:ua-driver-pulse 2.2s ease-out .4s infinite',
  ].join(';');
  const dot = document.createElement('div');
  dot.style.cssText = [
    'position:absolute','left:0','top:0','width:13px','height:13px','border-radius:50%',
    'background:#4ADE80','border:2.5px solid #fff',
    'box-shadow:0 0 12px rgba(74,222,128,.9)',
    'transform:translate(-50%,-50%)',
  ].join(';');
  wrap.appendChild(pulse);
  wrap.appendChild(dot);
  return wrap;
}

function makePickupMarkerEl() {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;width:0;height:0;pointer-events:none;';
  const pin = document.createElement('div');
  pin.style.cssText = [
    'position:absolute','left:0','top:0','width:28px','height:28px','border-radius:50%',
    'background:rgba(5,10,6,.9)','border:2.5px solid #22D3EE',
    'box-shadow:0 0 14px rgba(34,211,238,.7)',
    'transform:translate(-50%,-50%)',
    'display:flex','align-items:center','justify-content:center','font-size:14px',
  ].join(';');
  pin.textContent = '📍';
  wrap.appendChild(pin);
  return wrap;
}

function makeDropoffMarkerEl() {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;width:0;height:0;pointer-events:none;';
  const pin = document.createElement('div');
  pin.style.cssText = [
    'position:absolute','left:0','top:0','width:28px','height:28px','border-radius:50%',
    'background:rgba(5,10,6,.9)','border:2.5px solid #4ADE80',
    'box-shadow:0 0 14px rgba(74,222,128,.7)',
    'transform:translate(-50%,-50%)',
    'display:flex','align-items:center','justify-content:center','font-size:14px',
  ].join(';');
  pin.textContent = '🏁';
  wrap.appendChild(pin);
  return wrap;
}

// ─── Icon ─────────────────────────────────────────────────────────────────────
function Icon({ name, size = 16, color = 'currentColor', stroke = 1.8 }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'chat':   return <svg {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
    case 'pin':    return <svg {...p}><path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>;
    case 'sat':    return <svg {...p}><path d="M4 13a8 8 0 0 1 7 7M4 17a4 4 0 0 1 3 3"/><circle cx="6" cy="19" r="1"/><path d="M12 3l4 4-3 3-4-4 3-3ZM15 9l4 4-3 3"/></svg>;
    case 'phone':  return <svg {...p}><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 3.09 5.18 2 2 0 0 1 5.07 3h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L9.09 10.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 17.92z"/></svg>;
    case 'star':   return <svg {...p} fill={color}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
    case 'x':      return <svg {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
    case 'check':  return <svg {...p}><polyline points="20 6 9 17 4 12"/></svg>;
    case 'car':    return <svg {...p}><path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h13l4 4v4a2 2 0 0 1-2 2h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>;
    case 'clock':  return <svg {...p}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
    case 'nav':    return <svg {...p}><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>;
    case 'alert':  return <svg {...p}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
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

// ─── Ribbon mode label ────────────────────────────────────────────────────────
const RIDE_MODE_LABELS = {
  searching_driver: { label: 'FINDING YOUR DRIVER', color: C.amber },
  driver_assigned:  { label: 'DRIVER EN ROUTE',     color: C.greenBright },
  arrived:          { label: 'DRIVER ARRIVED',       color: C.cyan },
  in_progress:      { label: 'TRIP IN PROGRESS',     color: C.green },
};

function TopRibbon({ now, mapReady, speed, activeRide }) {
  const mode = activeRide ? RIDE_MODE_LABELS[activeRide.status] : null;
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
        <span style={{ fontFamily: MONO, fontSize: 9, color: C.inkFade }}>·</span>
        {mode ? (
          <span style={{ fontFamily: COND, fontSize: 9.5, fontWeight: 800,
            letterSpacing: '.14em', color: mode.color,
            textShadow: `0 0 8px ${mode.color}88`,
            animation: 'uaBlink 2.4s ease-in-out infinite',
          }}>{mode.label}</span>
        ) : (
          <span style={{ fontFamily: COND, fontSize: 9.5, fontWeight: 700,
            letterSpacing: '.16em', color: C.inkDim }}>RIDER</span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%', background: C.greenBright,
            boxShadow: `0 0 7px ${C.greenBright}`,
            animation: 'uaBlink 1.6s ease-in-out infinite',
          }}/>
          <span style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 800,
            letterSpacing: '.08em', color: C.greenBright }}>
            {mapReady ? 'LIVE' : 'SYNC'}
          </span>
        </div>
        {speed != null && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
            <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: C.greenSoft }}>
              {speed}
            </span>
            <span style={{ fontFamily: COND, fontSize: 7.5, fontWeight: 800,
              letterSpacing: '.1em', color: C.inkDim }}>MPH</span>
          </div>
        )}
        <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700,
          color: 'rgba(255,255,255,.4)' }}>{fmtClock(now)}</span>
        <Icon name="sat" size={11} color={C.greenSoft}/>
        <SignalBars active />
      </div>
    </div>
  );
}

// ─── Radar SVG overlay ────────────────────────────────────────────────────────
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
        <linearGradient id="ua-trailGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="rgba(74,222,128,0)"/>
          <stop offset="100%" stopColor="rgba(74,222,128,0.6)"/>
        </linearGradient>
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
function AtmosphereOverlay() {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 6, pointerEvents: 'none',
      background: 'radial-gradient(ellipse at 50% 42%, transparent 35%, rgba(3,6,4,.5) 80%, rgba(3,6,4,.82) 100%)',
    }}/>
  );
}
function CornerBrackets() {
  const off = 12, sz = 24, th = 1.5, col = 'rgba(34,197,94,.35)';
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 12, pointerEvents: 'none' }}>
      {[
        { top: off,    left:  off,  bt: 1, bl: 1 },
        { top: off,    right: off,  bt: 1, br: 1 },
        { bottom: off, left:  off,  bb: 1, bl: 1 },
        { bottom: off, right: off,  bb: 1, br: 1 },
      ].map((c, i) => (
        <div key={i} style={{
          position: 'absolute', width: sz, height: sz,
          top: c.top, left: c.left, right: c.right, bottom: c.bottom,
          borderTop:    c.bt ? `${th}px solid ${col}` : 'none',
          borderBottom: c.bb ? `${th}px solid ${col}` : 'none',
          borderLeft:   c.bl ? `${th}px solid ${col}` : 'none',
          borderRight:  c.br ? `${th}px solid ${col}` : 'none',
          animation: 'uaBlink 4s ease-in-out infinite',
        }}/>
      ))}
    </div>
  );
}
function SupportFab({ onOpen, unread = 0 }) {
  return (
    <button onClick={onOpen} style={{
      position: 'absolute', bottom: 100, right: 16, zIndex: 26,
      width: 44, height: 44, borderRadius: 14, cursor: 'pointer',
      background: 'rgba(5,10,6,.78)', backdropFilter: 'blur(10px)',
      border: `1.5px solid ${unread > 0 ? 'rgba(239,68,68,.55)' : 'rgba(34,197,94,.3)'}`,
      boxShadow: `0 6px 20px rgba(0,0,0,.5), 0 0 14px ${unread > 0 ? 'rgba(239,68,68,.2)' : 'rgba(34,197,94,.15)'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'uaSlideUp .4s ease both',
    }} aria-label="Support">
      <Icon name="chat" size={18} color={unread > 0 ? '#F87171' : C.greenBright}/>
      {unread > 0 && (
        <div style={{
          position: 'absolute', top: -5, right: -5,
          minWidth: 18, height: 18, borderRadius: 9,
          background: '#DC2626', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 800, padding: '0 5px',
          boxShadow: '0 2px 6px rgba(220,38,38,.5)', border: '2px solid rgba(5,10,6,.9)',
        }}>
          {unread > 9 ? '9+' : unread}
        </div>
      )}
    </button>
  );
}

// ─── Rider compass ───────────────────────────────────────────────────────────
function RiderCompass({ bearing, onlineSinceMs, lastSearchAt, now }) {
  const hdg = normalizeHeading(bearing);
  const uptime = fmtUptime(onlineSinceMs, now);
  const searchAgo = fmtTimeAgo(lastSearchAt, now);
  return (
    <div style={{
      position: 'absolute', top: '50%', right: 12, transform: 'translateY(-50%)',
      zIndex: 14, pointerEvents: 'none', textAlign: 'center',
      animation: 'uaFadeIn .6s ease both',
    }}>
      <div style={{ position: 'relative', width: 62, height: 62 }}>
        <svg viewBox="0 0 100 100" width={62} height={62}
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
          <span style={{
            fontFamily: MONO, fontSize: uptime ? 9 : 12, fontWeight: 800,
            color: C.greenBright, lineHeight: 1,
            textShadow: uptime ? `0 0 8px ${C.greenBright}88` : 'none',
          }}>
            {uptime ?? String(Math.round(hdg)).padStart(3, '0')}
          </span>
          <span style={{
            fontFamily: COND, fontSize: 7, fontWeight: 800,
            letterSpacing: '.14em', color: C.inkDim,
          }}>
            {uptime ? 'ONLINE' : 'DEG'}
          </span>
        </div>
      </div>
      <div style={{ marginTop: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        <span style={{
          fontFamily: MONO, fontSize: 10, fontWeight: 800,
          color: searchAgo ? C.greenBright : C.inkDim,
          textShadow: searchAgo ? `0 0 8px ${C.greenBright}88` : 'none',
        }}>
          {searchAgo ?? '—'}
        </span>
        <span style={{
          fontFamily: COND, fontSize: 7.5, fontWeight: 800,
          letterSpacing: '.14em', color: C.inkDim, textTransform: 'uppercase',
        }}>
          last search
        </span>
      </div>
    </div>
  );
}

// ─── Edge contact chip (off-screen driver/search indicators) ─────────────────
function EdgeContact({ angle, label, color, icon }) {
  const MARGIN = 24;
  const rad = toRad(angle - 90);
  const rx = Math.cos(rad), ry = Math.sin(rad);
  const abx = Math.abs(rx), aby = Math.abs(ry);
  const scale = Math.min(
    (50 - MARGIN) / (abx * 100 + 0.001),
    (50 - MARGIN) / (aby * 100 + 0.001),
  );
  const x = 50 + rx * 100 * scale;
  const y = 50 + ry * 100 * scale;
  return (
    <div style={{
      position: 'absolute', left: `${x}%`, top: `${y}%`,
      transform: 'translate(-50%,-50%)',
      zIndex: 22, pointerEvents: 'none',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    }}>
      <div style={{
        padding: '2px 7px', borderRadius: 99,
        background: 'rgba(5,10,6,.8)', backdropFilter: 'blur(6px)',
        border: `1px solid ${color}55`,
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        <span style={{ fontSize: 9 }}>{icon}</span>
        <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 800, color }}>{label}</span>
      </div>
      <div style={{
        width: 1, height: 8,
        background: `linear-gradient(180deg, ${color}44, transparent)`,
        transform: `rotate(${angle}deg)`,
      }}/>
    </div>
  );
}

// ─── Fleet chip (flips: nearest driver ↔ online/total fleet) ─────────────────
function FleetChip({ riderLat, riderLng, onlineDrivers, driverCounts }) {
  const [face, setFace] = useState(0);

  const nearest = useMemo(() => {
    if (!riderLat || !riderLng || !onlineDrivers.length) return null;
    let best = Infinity, bestD = null;
    for (const d of onlineDrivers) {
      const mi = haverMi(riderLat, riderLng, d.lat, d.lng);
      if (mi < best) { best = mi; bestD = d; }
    }
    return bestD ? { driver: bestD, mi: best } : null;
  }, [riderLat, riderLng, onlineDrivers]);

  useEffect(() => {
    const id = setInterval(() => setFace(f => (f + 1) % 2), 3500);
    return () => clearInterval(id);
  }, []);

  const faceStyle = (idx) => ({
    position: 'absolute', inset: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
    padding: '0 10px',
    opacity: face === idx ? 1 : 0,
    transform: face === idx ? 'translateY(0)' : `translateY(${idx === 0 ? -8 : 8}px)`,
    transition: 'opacity .32s ease, transform .32s ease',
    whiteSpace: 'nowrap',
  });

  return (
    <div style={{
      position: 'absolute', bottom: 48, right: 16, zIndex: 18,
      animation: 'uaFadeIn .8s ease .4s both',
      pointerEvents: 'none',
    }}>
      <div style={{
        position: 'relative', height: 26, minWidth: 110,
        borderRadius: 99, overflow: 'hidden',
        background: 'rgba(5,10,6,.55)', backdropFilter: 'blur(8px)',
        border: `1px solid ${C.border}`,
      }}>
        {/* Face 0: nearest driver */}
        <div style={faceStyle(0)}>
          <span style={{ fontSize: 11 }}>🚗</span>
          <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: C.greenBright }}>
            {nearest ? fmtDist(nearest.mi) : '—'}
          </span>
          <span style={{ fontFamily: COND, fontSize: 9, fontWeight: 800, letterSpacing: '.13em',
            color: 'rgba(74,222,128,.5)', textTransform: 'uppercase' }}>
            away
          </span>
        </div>
        {/* Face 1: online / total fleet */}
        <div style={faceStyle(1)}>
          <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: C.greenBright }}>
            {driverCounts.online}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,.22)' }}>/</span>
          <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.4)' }}>
            {driverCounts.total}
          </span>
          <span style={{ fontFamily: COND, fontSize: 9, fontWeight: 800, letterSpacing: '.13em',
            color: 'rgba(74,222,128,.5)', textTransform: 'uppercase' }}>
            fleet
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Timeout HUD ─────────────────────────────────────────────────────────────
function TimeoutHud({ ride, onCancel, onWait }) {
  const [waiting, setWaiting] = useState(false);
  const [canceling, setCanceling] = useState(false);

  const handleWait = async () => {
    setWaiting(true);
    await onWait(ride);
    setWaiting(false);
  };

  const handleCancel = async () => {
    setCanceling(true);
    await onCancel(ride);
    setCanceling(false);
  };

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 32,
      padding: '0 12px 28px',
      animation: 'uaSlideUp .5s cubic-bezier(.34,1.2,.64,1) both',
    }}>
      <div style={{
        background: 'rgba(5,10,6,.95)', backdropFilter: 'blur(20px)',
        border: '1.5px solid rgba(251,191,36,.3)',
        borderRadius: 20, padding: '20px 18px',
        boxShadow: '0 -6px 40px rgba(0,0,0,.7), 0 0 30px rgba(251,191,36,.1)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>⏱</div>
        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 18, fontWeight: 800, letterSpacing: '.06em', color: '#FBBF24', marginBottom: 6 }}>
          No driver found yet
        </div>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'rgba(255,255,255,.42)', marginBottom: 20, lineHeight: 1.55 }}>
          We couldn't match a driver in time.{'\n'}Keep waiting or cancel your ride.
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleCancel}
            disabled={canceling || waiting}
            style={{
              flex: 1, padding: '13px 0', borderRadius: 13, cursor: canceling ? 'not-allowed' : 'pointer',
              background: 'rgba(248,113,113,.1)', border: '1.5px solid rgba(248,113,113,.35)',
              fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 800,
              letterSpacing: '.08em', color: '#F87171', opacity: canceling ? .5 : 1, transition: 'opacity .15s',
            }}
          >
            {canceling ? 'Canceling…' : 'Cancel Ride'}
          </button>
          <button
            onClick={handleWait}
            disabled={waiting || canceling}
            style={{
              flex: 1, padding: '13px 0', borderRadius: 13, cursor: waiting ? 'not-allowed' : 'pointer',
              background: 'rgba(251,191,36,.15)', border: '1.5px solid rgba(251,191,36,.45)',
              fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 800,
              letterSpacing: '.08em', color: '#FBBF24', opacity: waiting ? .5 : 1, transition: 'opacity .15s',
            }}
          >
            {waiting ? 'Extending…' : 'Keep Waiting'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Active ride HUD bottom card ──────────────────────────────────────────────
function ActiveRideHud({ ride, driverDoc, routeInfo, now, onCancel, onContact, onRate }) {
  const status = ride.status;
  const startMs = tsToMillis(ride.startedAt ?? ride.updatedAt ?? ride.createdAt);
  const driverInfo = driverDoc ?? ride.driverInfo ?? {};
  const rating = driverInfo.rating ?? driverInfo.averageRating ?? null;

  const statusConfig = {
    searching_driver: { icon: '🔍', label: 'Finding your driver',    color: C.amber  },
    driver_assigned:  { icon: '🚗', label: 'Driver on the way',      color: C.green  },
    arrived:          { icon: '📍', label: 'Driver has arrived',      color: C.cyan   },
    in_progress:      { icon: '🛣️', label: 'Ride in progress',       color: C.greenBright },
  };
  const sc = statusConfig[status] ?? statusConfig.driver_assigned;

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 32,
      padding: '0 12px 28px',
      animation: 'uaSlideUp .5s cubic-bezier(.34,1.2,.64,1) both',
    }}>
      <div style={{
        background: 'rgba(5,10,6,.92)', backdropFilter: 'blur(18px)',
        border: `1.5px solid ${C.borderBright}`,
        borderRadius: 20, padding: '14px 16px',
        boxShadow: '0 -6px 40px rgba(0,0,0,.6), 0 0 30px rgba(34,197,94,.1)',
      }}>

        {/* Status row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `${sc.color}18`, border: `1.5px solid ${sc.color}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
          }}>{sc.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: BODY, fontSize: 13, fontWeight: 700, color: C.inkBright }}>
              {sc.label}
            </div>
            {status === 'in_progress' && (
              <div style={{ fontFamily: MONO, fontSize: 10, color: sc.color, marginTop: 2 }}>
                {fmtElapsed(startMs)} elapsed
              </div>
            )}
            {status === 'arrived' && (
              <div style={{ fontFamily: MONO, fontSize: 10, color: C.cyan, marginTop: 2 }}>
                Head to your pickup point
              </div>
            )}
          </div>
          {(() => {
            const distMi      = routeInfo?.distanceMi    ?? (Number(ride.tripDistanceMiles ?? ride.miles) || null);
            const durationSecs = routeInfo?.durationSecs ?? ((Number(ride.tripDurationMin  ?? ride.durationMin) || null) * 60);
            if (!distMi && !durationSecs) return null;
            return (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, color: C.greenBright }}>
                  {fmtEta(durationSecs)}
                </div>
                <div style={{ fontFamily: COND, fontSize: 9, color: C.inkDim, letterSpacing: '.1em' }}>
                  {fmtDist(distMi)}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Driver card */}
        {(status === 'driver_assigned' || status === 'arrived' || status === 'in_progress') && driverInfo.name && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 12, marginBottom: 10,
            background: 'rgba(34,197,94,.06)', border: `1px solid ${C.border}`,
          }}>
            {/* Avatar */}
            <div style={{
              width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(34,197,94,.12)', border: `2px solid ${C.green}`,
              overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
            }}>
              {driverInfo.photoURL
                ? <img src={driverInfo.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                : '👤'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: BODY, fontSize: 13, fontWeight: 700, color: C.inkBright }}>
                {driverInfo.name ?? driverInfo.displayName ?? 'Your Driver'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                {rating != null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <Icon name="star" size={11} color={C.amber}/>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: C.amber }}>
                      {Number(rating).toFixed(1)}
                    </span>
                  </div>
                )}
                {driverInfo.vehicle && (
                  <span style={{ fontFamily: COND, fontSize: 10, color: C.inkDim, letterSpacing: '.05em' }}>
                    {driverInfo.vehicle}
                  </span>
                )}
                {driverInfo.licensePlate && (
                  <span style={{
                    fontFamily: MONO, fontSize: 9, color: C.inkDim,
                    padding: '1px 5px', borderRadius: 4,
                    background: 'rgba(255,255,255,.06)',
                    border: '1px solid rgba(255,255,255,.1)',
                  }}>
                    {driverInfo.licensePlate}
                  </span>
                )}
              </div>
            </div>
            {/* Call button */}
            {driverInfo.phone && (
              <button onClick={() => onContact(driverInfo)} style={{
                width: 38, height: 38, borderRadius: 10, cursor: 'pointer',
                background: 'rgba(34,197,94,.12)', border: `1.5px solid ${C.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name="phone" size={16} color={C.green}/>
              </button>
            )}
          </div>
        )}

        {/* Route summary */}
        {(ride.pickupAddress || ride.dropoffAddress) && (
          <div style={{
            padding: '8px 12px', borderRadius: 10, marginBottom: 10,
            background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)',
          }}>
            {ride.pickupAddress && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.cyan,
                  marginTop: 3, flexShrink: 0, boxShadow: `0 0 6px ${C.cyan}` }}/>
                <span style={{ fontFamily: BODY, fontSize: 11, color: C.inkMid, lineHeight: 1.4 }}>
                  {ride.pickupAddress}
                </span>
              </div>
            )}
            {ride.dropoffAddress && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.green,
                  marginTop: 3, flexShrink: 0, boxShadow: `0 0 6px ${C.green}` }}/>
                <span style={{ fontFamily: BODY, fontSize: 11, color: C.inkMid, lineHeight: 1.4 }}>
                  {ride.dropoffAddress}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Fare + action row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {ride.fare != null && (
            <div style={{ flex: 1 }}>
              <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 800, color: C.greenBright }}>
                ${Number(ride.fare).toFixed(2)}
              </span>
              <span style={{ fontFamily: COND, fontSize: 9, color: C.inkDim,
                letterSpacing: '.1em', marginLeft: 5 }}>FARE</span>
            </div>
          )}
          {status === 'in_progress' && (
            <div style={{ fontFamily: MONO, fontSize: 11, color: C.green, flex: ride.fare == null ? 1 : 0 }}>
              {routeInfo ? fmtDist(routeInfo.distanceMi) + ' to dropoff' : 'En route'}
            </div>
          )}
          {status === 'searching_driver' && (
            <button onClick={() => onCancel(ride)} style={{
              padding: '8px 16px', borderRadius: 10, cursor: 'pointer',
              background: 'rgba(248,113,113,.1)', border: '1.5px solid rgba(248,113,113,.35)',
              fontFamily: BODY, fontSize: 12, fontWeight: 700, color: C.red,
            }}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Completed ride popup ─────────────────────────────────────────────────────
function CompletedRidePopup({ ride, onRate, onDismiss }) {
  const fare = ride.fare != null ? `$${Number(ride.fare).toFixed(2)}` : null;
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(3,6,4,.88)', backdropFilter: 'blur(14px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      animation: 'uaFadeIn .35s ease both',
    }}>
      <div style={{
        width: '100%', maxWidth: 340,
        background: 'rgba(5,12,7,.95)', border: `1.5px solid ${C.borderBright}`,
        borderRadius: 24, padding: '28px 24px',
        boxShadow: '0 20px 60px rgba(0,0,0,.7), 0 0 40px rgba(74,222,128,.1)',
        animation: 'uaPopIn .5s cubic-bezier(.34,1.2,.64,1) both',
      }}>
        {/* Check ring */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'rgba(34,197,94,.12)', border: `2px solid ${C.green}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 30px rgba(34,197,94,.3)`,
            animation: 'uaGlowPulse 2s ease-in-out infinite',
          }}>
            <Icon name="check" size={28} color={C.greenBright}/>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontFamily: BODY, fontSize: 20, fontWeight: 800, color: C.inkBright,
            marginBottom: 4 }}>Trip Complete</div>
          {fare && (
            <div style={{ fontFamily: MONO, fontSize: 26, fontWeight: 800, color: C.greenBright }}>
              {fare}
            </div>
          )}
          {ride.dropoffAddress && (
            <div style={{ fontFamily: BODY, fontSize: 11, color: C.inkMid, marginTop: 6 }}>
              Arrived at {ride.dropoffAddress}
            </div>
          )}
        </div>
        <button onClick={() => onRate(ride)} style={{
          width: '100%', padding: '13px', borderRadius: 12, cursor: 'pointer',
          background: C.green, border: 'none',
          fontFamily: BODY, fontSize: 14, fontWeight: 800, color: '#030604',
          marginBottom: 10, letterSpacing: '.02em',
        }}>
          Rate Your Driver
        </button>
        <button onClick={onDismiss} style={{
          width: '100%', padding: '11px', borderRadius: 12, cursor: 'pointer',
          background: 'transparent', border: `1.5px solid ${C.border}`,
          fontFamily: BODY, fontSize: 13, fontWeight: 600, color: C.inkMid,
        }}>
          Close
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function UaTob({
  uid,
  rides           = [],
  searches        = [],
  createTrip,
  trips           = [],
  scheduledRides  = [],
  drivers         = [],
  account         = null,
  activeRide:     explicitActiveRide = null,
  onCancelRide    = () => {},
  onContactDriver = (d) => { if (d?.phone) window.open(`tel:${d.phone}`); },
  onRateRide      = () => {},
  onOpenSupport   = () => {},
}) {
  // ── Refs ──────────────────────────────────────────────────────────────────
  const mapContainerRef  = useRef(null);
  const mapRef           = useRef(null);
  const svgRef           = useRef(null);
  const sweepRef         = useRef(0);
  const rafRef           = useRef(null);
  const followRafRef     = useRef(null);
  const searchMarkersRef = useRef(new Map());
  const driverMarkersRef = useRef(new Map());
  const carMarkerRef     = useRef(null);
  const riderMarkerRef   = useRef(null);
  const pickupMarkerRef  = useRef(null);
  const dropoffMarkerRef = useRef(null);
  const trailRef         = useRef([]);
  const renderedCenterRef= useRef(null);
  const routeAbortRef    = useRef(null);
  const lastRouteFetchRef= useRef({ time: 0, lat: 0, lng: 0 });
  const lastCompletedIdRef = useRef(null);
  const mapBearingRef    = useRef(-20);
  const onlineSinceRef   = useRef(null);

  // ── State ─────────────────────────────────────────────────────────────────
  const [mapReady,       setMapReady]       = useState(false);
  const [now,            setNow]            = useState(Date.now());
  const [face,           setFace]           = useState(FACE_BOOK);
  const [mapBearing,     setMapBearing]     = useState(-20);
  const [routeInfo,      setRouteInfo]      = useState(null);   // { distanceMi, durationSecs }
  const [completedRide,  setCompletedRide]  = useState(null);   // popup trigger
  const [showSupport,    setShowSupport]    = useState(false);
  const [showCompany,    setShowCompany]    = useState(false);

  // ── Support unread ────────────────────────────────────────────────────────
  const supportUnread = useRiderSupportUnread(uid);

  // ── Derived ───────────────────────────────────────────────────────────────
  const { rider, fix, live } = useLiveRiderPosition(uid, account);
  const activeRide            = useActiveRide(rides, explicitActiveRide);
  const assignedDriverUid     = activeRide?.driverInfo?.uid ?? activeRide?.driverUid ?? null;
  const driverDoc             = useAssignedDriverLive(assignedDriverUid);
  const { drivers: onlineDrivers } = useOnlineDrivers();
  const driverCounts               = useDriverCounts();

  const lastSearchAt = useMemo(() => {
    const mine = searches.filter(s => s.uid === uid);
    if (!mine.length) return null;
    return Math.max(...mine.map(s => tsToMillis(s.createdAt)));
  }, [searches, uid]);

  // ── 1 Hz clock ───────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Online timer — starts at mount (resets to 0 on every page load) ────────
  useEffect(() => {
    onlineSinceRef.current = Date.now();
  }, []);

  // ── Map bearing poll (250 ms) ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    const id = setInterval(() => {
      if (!mapRef.current) return;
      try { setMapBearing(mapRef.current.getBearing()); } catch {}
    }, 250);
    return () => clearInterval(id);
  }, [mapReady]);

  // ── Persist onlineTime to Accounts/{uid} every 5 s ───────────────────────
  useEffect(() => {
    if (!uid) return;
    const write = () => {
      const seconds = Math.floor((Date.now() - onlineSinceRef.current) / 1000);
      updateDoc(doc(db, 'Accounts', uid), { onlineTime: seconds }).catch(() => {});
    };
    write(); // write immediately on mount
    const id = setInterval(write, 5_000);
    return () => clearInterval(id);
  }, [uid]);

  // ── Completed ride popup watch ────────────────────────────────────────────
  useEffect(() => {
    const recent = rides.find(r =>
      r.status === 'completed' &&
      tsToMillis(r.completedAt ?? r.updatedAt) > Date.now() - 30_000 &&
      r.id !== lastCompletedIdRef.current,
    );
    if (recent) {
      lastCompletedIdRef.current = recent.id;
      setCompletedRide(recent);
    }
  }, [rides]);

  // ── Init Mapbox ───────────────────────────────────────────────────────────
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

      const map = new mapboxgl.Map({
        container:          mapContainerRef.current,
        style:              MAP_STYLE,
        center:             [live?.lng ?? account?.lng ?? ORL_LNG,
                             live?.lat ?? account?.lat ?? ORL_LAT],
        zoom:               13,
        pitch:              52,
        bearing:            -20,
        interactive:        false,
        attributionControl: false,
        antialias:          true,
        fadeDuration:       400,
      });

      map.on('load', () => {
        mapRef.current = map;

        // ── Sources ──
        map.addSource('ua-searches',  { type: 'geojson', data: buildSearchGeoJSON(searches) });
        map.addSource('ua-scheduled', { type: 'geojson', data: buildScheduledGeoJSON(scheduledRides) });
        map.addSource('ua-trail',     { type: 'geojson', data: emptyGeoJSON() });
        map.addSource(ROUTE_SOURCE,   { type: 'geojson', data: emptyGeoJSON() });
        map.addSource(TRIP_SOURCE,    { type: 'geojson', data: emptyGeoJSON() });

        // ── Demand heatmap ──
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

        // ── Movement trail ──
        map.addLayer({ id: 'ua-trail', type: 'line', source: 'ua-trail',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color':   C.greenSoft,
            'line-width':   2,
            'line-opacity': 0.45,
            'line-gradient': ['interpolate', ['linear'], ['line-progress'],
              0, 'rgba(52,211,153,0)',
              1, 'rgba(52,211,153,0.6)',
            ],
          },
        });

        // ── Route lines ──
        map.addLayer({ id: 'ua-route-bg', type: 'line', source: ROUTE_SOURCE,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': C.cyan, 'line-width': 3, 'line-opacity': 0.55, 'line-dasharray': [2, 2] },
        });
        map.addLayer({ id: 'ua-trip-bg', type: 'line', source: TRIP_SOURCE,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': C.green, 'line-width': 3.5, 'line-opacity': 0.7 },
        });

        // ── Ambient pulse ──
        let t = 0;
        const pulse = setInterval(() => {
          if (!map.isStyleLoaded()) return;
          t += 0.06;
          const r = 9 + 9 * ((Math.sin(t) + 1) / 2);
          try {
            map.setPaintProperty('ua-search-halo', 'circle-radius', r);
            map.setPaintProperty('ua-search-halo', 'circle-stroke-width', 1 + 1.2 * ((Math.sin(t) + 1) / 2));
          } catch {}
        }, 40);
        map.on('remove', () => clearInterval(pulse));

        setMapReady(true);
      });
    };

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setMapReady(false);
      }
    };
  }, []); // eslint-disable-line

  // ── Follow loop (smooth camera) ───────────────────────────────────────────
  useEffect(() => {
    cancelAnimationFrame(followRafRef.current);
    if (!mapReady || !mapRef.current) return;

    let lastTs = 0;
    const tick = (ts) => {
      const map = mapRef.current;
      if (!map) return;

      // Time-based delta so smoothness is frame-rate independent
      const dt  = lastTs ? Math.min(ts - lastTs, 50) : 16.667;
      lastTs = ts;

      if (!activeRide && live) {
        if (!renderedCenterRef.current) {
          renderedCenterRef.current = { lat: live.lat, lng: live.lng };
        }
        const rc = renderedCenterRef.current;
        // Exponential ease: equivalent to FOLLOW_SMOOTH=0.14 at 60 fps
        const k = 1 - Math.exp(-8 * dt / 1000);
        rc.lat = lerp(rc.lat, live.lat, k);
        rc.lng = lerp(rc.lng, live.lng, k);
        // Normalize bearing drift to 60 fps
        mapBearingRef.current += 0.03 * (dt / 16.667);
        try {
          map.jumpTo({ center: [rc.lng, rc.lat], bearing: mapBearingRef.current });
        } catch {}
      }

      followRafRef.current = requestAnimationFrame(tick);
    };

    followRafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(followRafRef.current);
  }, [mapReady, live, activeRide]);

  // ── Update movement trail ─────────────────────────────────────────────────
  useEffect(() => {
    if (!live || activeRide) {
      // Clear trail during active ride
      trailRef.current = [];
      if (mapReady && mapRef.current?.getSource?.('ua-trail')) {
        try { mapRef.current.getSource('ua-trail').setData(emptyGeoJSON()); } catch {}
      }
      return;
    }
    const last = trailRef.current[trailRef.current.length - 1];
    if (last && haverMi(last[1], last[0], live.lat, live.lng) < TRAIL_MIN_DIST_MI) return;
    const pts = [...trailRef.current, [live.lng, live.lat]].slice(-TRAIL_MAX_PTS);
    trailRef.current = pts;
    if (!mapReady || !mapRef.current) return;
    if (pts.length < 2) return;
    const src = mapRef.current.getSource?.('ua-trail');
    try {
      src?.setData({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', properties: { 'line-progress': 1 },
          geometry: { type: 'LineString', coordinates: pts } }],
      });
    } catch {}
  }, [live, mapReady, activeRide]);

  // ── Update GeoJSON sources ────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const apply = () => {
      map.getSource('ua-searches') ?.setData(buildSearchGeoJSON(searches));
      map.getSource('ua-scheduled')?.setData(buildScheduledGeoJSON(scheduledRides));
    };
    if (map.isStyleLoaded()) apply(); else map.once('styledata', apply);
  }, [searches, scheduledRides, mapReady]);

  // ── Active ride map handling ──────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.mapboxgl) return;
    const map = mapRef.current;

    if (!activeRide) {
      // Tear down ride markers + routes
      [carMarkerRef, pickupMarkerRef, dropoffMarkerRef].forEach(r => {
        if (r.current) { try { r.current.remove(); } catch {} r.current = null; }
      });
      try { map.getSource(ROUTE_SOURCE)?.setData(emptyGeoJSON()); } catch {}
      try { map.getSource(TRIP_SOURCE) ?.setData(emptyGeoJSON()); } catch {}
      return;
    }

    const MB = window.mapboxgl;
    const { pickupLat, pickupLng, dropoffLat, dropoffLng } = activeRide;

    // Pickup marker
    if (!pickupMarkerRef.current && pickupLat != null && pickupLng != null) {
      pickupMarkerRef.current = new MB.Marker({ element: makePickupMarkerEl(), anchor: 'center' })
        .setLngLat([pickupLng, pickupLat]).addTo(map);
    }
    // Dropoff marker
    if (!dropoffMarkerRef.current && dropoffLat != null && dropoffLng != null) {
      dropoffMarkerRef.current = new MB.Marker({ element: makeDropoffMarkerEl(), anchor: 'center' })
        .setLngLat([dropoffLng, dropoffLat]).addTo(map);
    }
  }, [activeRide, mapReady]);

  // ── Driver car marker (live) ──────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.mapboxgl) return;
    const MB = window.mapboxgl;

    if (!driverDoc || !driverDoc.lat || !driverDoc.lng || !activeRide) {
      if (carMarkerRef.current) {
        try { carMarkerRef.current.remove(); } catch {}
        carMarkerRef.current = null;
      }
      return;
    }
    const { lat, lng, heading } = driverDoc;
    if (!carMarkerRef.current) {
      const el = makeCarMarkerEl(heading);
      carMarkerRef.current = new MB.Marker({ element: el, anchor: 'center' })
        .setLngLat([lng, lat]).addTo(mapRef.current);
      carMarkerRef.current._el = el;
    } else {
      try { carMarkerRef.current.setLngLat([lng, lat]); } catch {}
      carMarkerRef.current._el?._setHeading?.(heading);
    }
  }, [driverDoc, mapReady, activeRide]);

  // ── Rider self-marker ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.mapboxgl || !live) return;
    const MB = window.mapboxgl;
    if (!riderMarkerRef.current) {
      riderMarkerRef.current = new MB.Marker({ element: makeRiderMarkerEl(), anchor: 'center' })
        .setLngLat([live.lng, live.lat]).addTo(mapRef.current);
    } else {
      try { riderMarkerRef.current.setLngLat([live.lng, live.lat]); } catch {}
    }
  }, [live, mapReady]);

  // ── Cancel ride ──────────────────────────────────────────────────────────
  const handleCancelRide = useCallback(async (ride) => {
    const rideId = ride?.id;
    if (!rideId || !uid) return;
    try {
      await updateDoc(doc(db, 'Rides', rideId), {
        status:     'canceled',
        canceledAt: serverTimestamp(),
        canceledBy: uid,
        updatedAt:  serverTimestamp(),
      });
    } catch (err) {
      console.error('[UaTob] cancel ride failed:', err);
    }
    onCancelRide(ride);
  }, [uid, onCancelRide]);

  // ── Extend search (Wait) ──────────────────────────────────────────────────
  const handleWaitRide = useCallback(async (ride) => {
    const rideId = ride?.id;
    if (!rideId || !uid) return;
    const now = new Date();
    const newExpiresAt = new Date(now.getTime() + 7 * 60 * 1000);
    try {
      await updateDoc(doc(db, 'Rides', rideId), {
        status:         'searching_driver',
        timedOutAt:     null,
        searchExtended: increment(1),
        updatedAt:      serverTimestamp(),
        expiresAt:      newExpiresAt,
      });
    } catch (err) {
      console.error('[UaTob] extend ride search failed:', err);
    }
  }, [uid]);

  // ── Route fetch for active ride ───────────────────────────────────────────
  useEffect(() => {
    if (!activeRide || !driverDoc) return;
    const { lat: dLat, lng: dLng } = driverDoc;
    if (!dLat || !dLng) return;

    const { pickupLat, pickupLng, dropoffLat, dropoffLng } = activeRide;
    const status = activeRide.status;

    // Throttle: time and min-move
    const now2 = Date.now();
    const last = lastRouteFetchRef.current;
    const moveDist = haverMi(last.lat, last.lng, dLat, dLng);
    if (now2 - last.time < ROUTE_REFETCH_MS && moveDist < ROUTE_REFETCH_MIN_MOVE_MI) return;
    lastRouteFetchRef.current = { time: now2, lat: dLat, lng: dLng };

    // Cancel in-flight
    routeAbortRef.current?.abort();
    const ctrl = new AbortController();
    routeAbortRef.current = ctrl;

    const destLat = status === 'in_progress' ? dropoffLat : pickupLat;
    const destLng = status === 'in_progress' ? dropoffLng : pickupLng;

    if (destLat == null || destLng == null) return;

    fetchRoute(dLng, dLat, destLng, destLat, ctrl.signal).then(route => {
      if (!route || ctrl.signal.aborted) return;
      setRouteInfo({ distanceMi: route.distanceMi, durationSecs: route.durationSecs });
      if (!mapRef.current) return;
      const srcId = status === 'in_progress' ? TRIP_SOURCE : ROUTE_SOURCE;
      try {
        mapRef.current.getSource(srcId)?.setData(lineGeoJSON(route.coords));
        if (status !== 'in_progress') mapRef.current.getSource(TRIP_SOURCE)?.setData(emptyGeoJSON());
        else mapRef.current.getSource(ROUTE_SOURCE)?.setData(emptyGeoJSON());
      } catch {}
    }).catch(() => {});
    return () => ctrl.abort();
  }, [driverDoc?.lat, driverDoc?.lng, activeRide?.status]); // eslint-disable-line

  // ── fitBounds for active ride ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !activeRide) return;
    const map = mapRef.current;
    const pts = [];
    if (driverDoc?.lat && driverDoc?.lng)           pts.push([driverDoc.lng, driverDoc.lat]);
    if (activeRide.pickupLat != null)               pts.push([activeRide.pickupLng, activeRide.pickupLat]);
    if (activeRide.status === 'in_progress'
        && activeRide.dropoffLat != null)           pts.push([activeRide.dropoffLng, activeRide.dropoffLat]);
    if (live)                                       pts.push([live.lng, live.lat]);
    if (pts.length < 2) return;
    const lngs = pts.map(p => p[0]), lats = pts.map(p => p[1]);
    const sw = [Math.min(...lngs), Math.min(...lats)];
    const ne = [Math.max(...lngs), Math.max(...lats)];
    try {
      map.fitBounds([sw, ne], {
        padding:  { top: 90, bottom: 220, left: 40, right: 40 },
        duration: 2400,
        easing:   t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
        maxZoom:  16,
      });
    } catch {}
  }, [
    activeRide?.status,
    driverDoc?.lat, driverDoc?.lng,
    mapReady,
  ]); // eslint-disable-line

  // ── Ambient driver dot markers (hide during active ride) ──────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.mapboxgl) return;
    const store = driverMarkersRef.current;
    const seen  = new Set();
    if (!activeRide) {
      onlineDrivers.forEach(({ id, lat, lng }) => {
        seen.add(id);
        if (assignedDriverUid && id === assignedDriverUid) return;
        if (store.has(id)) {
          try { store.get(id).setLngLat([lng, lat]); } catch {}
        } else {
          const marker = new window.mapboxgl.Marker({ element: makeDriverDotEl(), anchor: 'center' })
            .setLngLat([lng, lat]).addTo(mapRef.current);
          store.set(id, marker);
        }
      });
    }
    store.forEach((m, id) => {
      if (!seen.has(id) || !!activeRide) {
        try { m.remove(); } catch {}
        store.delete(id);
      }
    });
  }, [onlineDrivers, mapReady, activeRide, assignedDriverUid]);

  // ── Search ring markers ───────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.mapboxgl) return;
    const store = searchMarkersRef.current;
    const seen  = new Set();
    searches.filter(s => typeof s.pickupLat === 'number').forEach(s => {
      seen.add(s.id);
      if (!store.has(s.id)) {
        const el = makeSearchRingEl(!s.uid || s.uid === 'null');
        const m  = new window.mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([s.pickupLng, s.pickupLat]).addTo(mapRef.current);
        store.set(s.id, m);
      }
    });
    store.forEach((m, id) => {
      if (!seen.has(id)) { try { m.remove(); } catch {} store.delete(id); }
    });
  }, [searches, mapReady]);

  useEffect(() => {
    if (mapReady) return;
    searchMarkersRef.current.forEach(m => { try { m.remove(); } catch {} });
    searchMarkersRef.current.clear();
    driverMarkersRef.current.forEach(m => { try { m.remove(); } catch {} });
    driverMarkersRef.current.clear();
  }, [mapReady]);

  // ── Radar sweep RAF ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) { cancelAnimationFrame(rafRef.current); return; }
    const animate = () => {
      sweepRef.current = (sweepRef.current + 1.1) % 360;
      if (svgRef.current) {
        const angle = sweepRef.current;
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
  }, [mapReady]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleBook = useCallback((payload) => {
    createTrip?.(payload);
  }, [createTrip]);

  // ── Edge contacts — off-screen indicators ─────────────────────────────────
  const edgeContacts = useMemo(() => {
    if (!mapReady || !mapRef.current || !live) return [];
    const contacts = [];
    if (activeRide && driverDoc?.lat) {
      const { lat, lng } = driverDoc;
      const pt = projectToScreen(mapRef.current, lat, lng);
      if (!pt) {
        const ang = offScreenBearing(mapRef.current, lat, lng);
        if (ang != null) contacts.push({ angle: ang, label: 'DRIVER', color: C.green, icon: '🚗' });
      }
    }
    return contacts;
  }, [now, mapReady, activeRide, driverDoc, live]); // `now` keeps it ticking

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{KEYFRAMES}</style>

      <div style={{ position: 'fixed', inset: 0, background: C.bg, overflow: 'hidden' }}>

        {/* Mapbox */}
        <div ref={mapContainerRef} style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          opacity: mapReady ? 1 : 0, transition: 'opacity .7s ease',
        }}/>

        {/* Layers */}
        <AtmosphereOverlay/>
        <RadarOverlay svgRef={svgRef}/>
        <ScanlineOverlay/>
        <CornerBrackets/>

        {/* Edge contacts */}
        {edgeContacts.map((ec, i) => <EdgeContact key={i} {...ec}/>)}

        {/* Top ribbon */}
        <TopRibbon now={now} mapReady={mapReady} speed={rider?.speed} activeRide={activeRide}/>

        {/* Rider compass — heading + uptime */}
        {mapReady && !activeRide && (
          <RiderCompass
            bearing={mapBearing}
            onlineSinceMs={onlineSinceRef.current}
            lastSearchAt={lastSearchAt}
            now={now}
          />
        )}

        {/* StatusCard */}
        <div style={{
          position: 'absolute', top: 36, left: 0, right: 0, zIndex: 30,
          display: 'flex', justifyContent: 'center', padding: '0 16px',
          pointerEvents: activeRide?.status === 'in_progress' || activeRide?.status === 'searching_driver' ? 'none' : 'auto',
          opacity: activeRide?.status === 'in_progress' ? 0.3 : activeRide?.status === 'searching_driver' ? 0.65 : 1,
          transition: 'opacity .4s ease',
        }}>
          <div style={{
            width: '100%', maxWidth: 340, pointerEvents: 'auto',
            animation: 'uaSlideDown .5s cubic-bezier(.34,1.2,.64,1) both',
            filter: 'drop-shadow(0 10px 32px rgba(0,0,0,.55))',
          }}>
            <StatusCard
              face={face}
              onFaceChange={setFace}
              uid={uid}
              account={account}
              createTrip={createTrip}
              rides={rides}
              trips={trips}
              searches={searches}
              scheduledRides={scheduledRides}
              drivers={drivers}
              now={now}
              onBook={handleBook}
            />
          </div>
        </div>

        {/* Support FAB */}
        <SupportFab
          onOpen={() => { setShowSupport(true); onOpenSupport(); }}
          unread={supportUnread}
        />

        {/* Rider support overlay */}
        {showSupport && (
          <RiderSupportOverlay
            account={account}
            onClose={() => setShowSupport(false)}
          />
        )}

        {/* Bottom HUD — active ride or idle counters */}
        {activeRide ? (
          activeRide.status === 'timeout' ? (
            <TimeoutHud
              ride={activeRide}
              onCancel={handleCancelRide}
              onWait={handleWaitRide}
            />
          ) : (
            <ActiveRideHud
              ride={activeRide}
              driverDoc={driverDoc}
              routeInfo={routeInfo}
              now={now}
              onCancel={handleCancelRide}
              onContact={onContactDriver}
              onRate={onRateRide}
            />
          )
        ) : (
          <>
            {/* Search count */}
            <div style={{
              position: 'absolute', bottom: 48, left: 16, zIndex: 18,
              pointerEvents: 'none', animation: 'uaFadeIn .8s ease .4s both',
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 99,
              background: 'rgba(5,10,6,.55)', backdropFilter: 'blur(8px)',
              border: `1px solid ${C.border}`,
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%', background: C.greenBright,
                boxShadow: `0 0 6px ${C.greenBright}`,
                animation: searches.length > 0 ? 'uaBlink 1.8s ease-in-out infinite' : 'none',
              }}/>
              <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: C.greenBright }}>
                {searches.length}
              </span>
              <span style={{ fontFamily: COND, fontSize: 9, fontWeight: 800, letterSpacing: '.13em',
                color: 'rgba(74,222,128,.5)', textTransform: 'uppercase' }}>searches</span>
            </div>

            {/* Fleet chip — flips between nearest driver and fleet count */}
            <FleetChip
              riderLat={live?.lat}
              riderLng={live?.lng}
              onlineDrivers={onlineDrivers}
              driverCounts={driverCounts}
            />

            {/* Company button center */}
            <div style={{
              position: 'absolute', bottom: 48, left: 0, right: 0,
              display: 'flex', justifyContent: 'center', zIndex: 18,
              animation: 'uaFadeIn .8s ease .4s both',
            }}>
              <button
                onClick={() => setShowCompany(true)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 34, height: 34, borderRadius: '50%',
                  background: 'rgba(5,10,6,.55)', backdropFilter: 'blur(8px)',
                  border: `1px solid ${C.borderBright}`,
                  cursor: 'pointer',
                  fontFamily: MONO, fontSize: 16, fontWeight: 800,
                  color: C.greenBright,
                  boxShadow: `0 0 12px rgba(74,222,128,.18)`,
                  animation: 'uaGlowPulse 3s ease-in-out infinite',
                }}
                aria-label="About UaTob"
              >
                ?
              </button>
            </div>
          </>
        )}


        {/* Completed ride popup */}
        {completedRide && (
          <CompletedRidePopup
            ride={completedRide}
            onRate={r => { onRateRide(r); setCompletedRide(null); }}
            onDismiss={() => setCompletedRide(null)}
          />
        )}

        {/* Company overlay */}
        {showCompany && (
          <CompanyOverlay onClose={() => setShowCompany(false)}/>
        )}



      </div>
    </>
  );
}


