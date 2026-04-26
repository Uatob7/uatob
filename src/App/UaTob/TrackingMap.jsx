import React, { useMemo, useEffect, useRef, useCallback, useState } from 'react';

// ── Helpers ────────────────────────────────────────────────────────────
function safeNum(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function getDriverColor(type = 'standard') {
  switch (type?.toLowerCase()) {
    case 'premium': return '#7C3AED';
    case 'xl':      return '#F59E0B';
    default:        return '#111827';
  }
}

function getRideTierBg(type = 'standard') {
  switch (type?.toLowerCase()) {
    case 'premium': return { bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' };
    case 'xl':      return { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' };
    default:        return { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' };
  }
}

// ── Polyline decoder ──────────────────────────────────────────────────
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

// ── Projection ────────────────────────────────────────────────────────
function projectPoints(pts, W, H, pad = 56) {
  if (!pts.length || !W || !H) return [];
  const lats = pts.map(p => p[0]);
  const lngs = pts.map(p => p[1]);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const dLat = maxLat - minLat || 0.002;
  const dLng = maxLng - minLng || 0.002;
  const scaleX = (W - pad * 2) / dLng;
  const scaleY = (H - pad * 2) / dLat;
  const scale  = Math.min(scaleX, scaleY);
  const offX   = (W - dLng * scale) / 2;
  const offY   = (H - dLat * scale) / 2;
  return pts.map(([la, ln]) => ({
    x: offX + (ln - minLng) * scale,
    y: H - (offY + (la - minLat) * scale),
  }));
}

// Project a single lat/lng using a SHARED bounding box
function projectSingleWithBounds(lat, lng, boundsObj, W, H, pad = 56) {
  if (!boundsObj || !W || !H) return null;
  const { minLat, maxLat, minLng, maxLng } = boundsObj;
  const dLat = maxLat - minLat || 0.002;
  const dLng = maxLng - minLng || 0.002;
  const scaleX = (W - pad * 2) / dLng;
  const scaleY = (H - pad * 2) / dLat;
  const scale  = Math.min(scaleX, scaleY);
  const offX   = (W - dLng * scale) / 2;
  const offY   = (H - dLat * scale) / 2;
  return {
    x: offX + (lng - minLng) * scale,
    y: H - (offY + (lat - minLat) * scale),
  };
}

function computeBounds(pts) {
  if (!pts.length) return null;
  const lats = pts.map(p => p[0]);
  const lngs = pts.map(p => p[1]);
  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
  };
}

function toSVGPath(svgPts) {
  if (!svgPts.length) return '';
  return svgPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

function approxPathLen(svgPts) {
  let len = 0;
  for (let i = 1; i < svgPts.length; i++) {
    const dx = svgPts[i].x - svgPts[i-1].x;
    const dy = svgPts[i].y - svgPts[i-1].y;
    len += Math.sqrt(dx*dx + dy*dy);
  }
  return Math.ceil(len) + 40;
}

function closestPointOnPolyline(svgPts, px, py) {
  if (!svgPts.length) return { x: px, y: py };
  if (svgPts.length === 1) return svgPts[0];
  let best = svgPts[0], bestDist = Infinity, bestIdx = 0, bestT = 0;
  for (let i = 0; i < svgPts.length - 1; i++) {
    const a = svgPts[i];
    const b = svgPts[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) continue;
    let t = ((px - a.x) * dx + (py - a.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const x = a.x + t * dx;
    const y = a.y + t * dy;
    const d = Math.hypot(x - px, y - py);
    if (d < bestDist) { bestDist = d; best = { x, y }; bestIdx = i; bestT = t; }
  }
  return { ...best, segIdx: bestIdx, segT: bestT };
}

// Find closest segment on the GEO polyline (for trimming during in_progress)
function closestSegmentOnGeoPolyline(geoPts, lat, lng) {
  if (geoPts.length < 2) return { idx: 0, t: 0 };
  let best = { idx: 0, t: 0 }, bestDist = Infinity;
  for (let i = 0; i < geoPts.length - 1; i++) {
    const a = geoPts[i];
    const b = geoPts[i + 1];
    const dLat = b[0] - a[0];
    const dLng = b[1] - a[1];
    const lenSq = dLat * dLat + dLng * dLng;
    if (lenSq === 0) continue;
    let t = ((lat - a[0]) * dLat + (lng - a[1]) * dLng) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const px = a[0] + t * dLat;
    const py = a[1] + t * dLng;
    const d = Math.hypot(px - lat, py - lng);
    if (d < bestDist) { bestDist = d; best = { idx: i, t }; }
  }
  return best;
}

// Trim the polyline to only include the part from the car onward
function trimPolylineFromCar(geoPts, carLat, carLng) {
  if (geoPts.length < 2 || !carLat || !carLng) return geoPts;
  const { idx, t } = closestSegmentOnGeoPolyline(geoPts, carLat, carLng);

  // Interpolated point on the segment
  const a = geoPts[idx];
  const b = geoPts[idx + 1];
  const interp = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];

  // Remaining path = interpolated start point + all vertices after segment idx
  return [interp, ...geoPts.slice(idx + 1)];
}

function computeHeading(from, to) {
  if (!from || !to) return 0;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.atan2(dx, -dy) * (180 / Math.PI);
}

function tsToMs(ts) {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (ts.seconds != null) return ts.seconds * 1000 + Math.floor((ts.nanoseconds ?? 0) / 1e6);
  if (ts.toMillis) return ts.toMillis();
  if (ts instanceof Date) return ts.getTime();
  return 0;
}

function geoDistMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
          + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── GPS source resolution ─────────────────────────────────────────────
function resolveGpsSource(payload, status) {
  const isInProgress = status === 'in_progress';
  const driverLat = safeNum(payload.driverLat);
  const driverLng = safeNum(payload.driverLng);
  const riderLat  = safeNum(payload.riderLat);
  const riderLng  = safeNum(payload.riderLng);
  const hasDriver = driverLat !== 0 && driverLng !== 0;
  const hasRider  = riderLat !== 0 && riderLng !== 0;
  const driverEta = safeNum(payload.driverEtaMin ?? payload.dropoffEtaMin ?? 999);
  const riderEta  = safeNum(payload.riderDropoffEtaMin ?? payload.dropoffEtaMin ?? 999);

  const driverTs = tsToMs(payload.driverLocationAt);
  const riderTs  = tsToMs(payload.riderLocationAt);
  const now      = Date.now();
  const STALE_MS = 45_000;
  const VERY_STALE_MS = 5 * 60_000; // 5 min — both stale = warn user
  const driverAge = driverTs ? now - driverTs : Infinity;
  const riderAge  = riderTs  ? now - riderTs  : Infinity;
  const driverStale     = driverAge > STALE_MS;
  const riderStale      = riderAge  > STALE_MS;
  const bothVeryStale   = driverAge > VERY_STALE_MS && riderAge > VERY_STALE_MS;

  if (!isInProgress) {
    if (hasDriver) return { source: 'driver', lat: driverLat, lng: driverLng, etaMin: driverEta, stale: driverStale, ageMs: driverAge };
    if (hasRider)  return { source: 'rider',  lat: riderLat,  lng: riderLng,  etaMin: riderEta,  stale: riderStale,  ageMs: riderAge };
    return { source: 'static', lat: safeNum(payload.dropoffLat), lng: safeNum(payload.dropoffLng), etaMin: safeNum(payload.dropoffEtaMin) };
  }

  if (!hasDriver && !hasRider) {
    return { source: 'static', lat: safeNum(payload.dropoffLat), lng: safeNum(payload.dropoffLng), etaMin: safeNum(payload.dropoffEtaMin) };
  }
  if (!hasDriver) return { source: 'rider',  lat: riderLat,  lng: riderLng,  etaMin: riderEta,  stale: riderStale,  ageMs: riderAge };
  if (!hasRider)  return { source: 'driver', lat: driverLat, lng: driverLng, etaMin: driverEta, stale: driverStale, ageMs: driverAge };

  const distMeters = geoDistMeters(driverLat, driverLng, riderLat, riderLng);

  // Blend more aggressively — within 25m means same vehicle
  if (distMeters <= 25 && !driverStale && !riderStale) {
    return {
      source: 'driver',
      lat: (driverLat + riderLat) / 2,
      lng: (driverLng + riderLng) / 2,
      etaMin: Math.min(driverEta, riderEta),
      blended: true,
      stale: false,
      ageMs: Math.min(driverAge, riderAge),
    };
  }

  // Stale handling — prefer fresh over stale
  if (driverStale && !riderStale) return { source: 'rider', lat: riderLat, lng: riderLng, etaMin: riderEta, stale: false, ageMs: riderAge, otherStale: true };
  if (riderStale && !driverStale) return { source: 'driver', lat: driverLat, lng: driverLng, etaMin: driverEta, stale: false, ageMs: driverAge, otherStale: true };

  // Both fresh, but coords disagree → take newest
  if (driverTs && riderTs) {
    const useDriver = driverTs >= riderTs;
    return useDriver
      ? { source: 'driver', lat: driverLat, lng: driverLng, etaMin: driverEta, stale: driverStale, ageMs: driverAge }
      : { source: 'rider',  lat: riderLat,  lng: riderLng,  etaMin: riderEta,  stale: riderStale,  ageMs: riderAge };
  }

  return { source: 'driver', lat: driverLat, lng: driverLng, etaMin: driverEta, stale: driverStale, ageMs: driverAge, bothVeryStale };
}

function shortAddr(full = '') { return full.split(',')[0].trim(); }

const STATUS_META = {
  searching_driver: { label: 'Finding driver',     dot: '#F59E0B' },
  driver_assigned:  { label: 'Driver assigned',    dot: '#3B82F6' },
  driver_arriving:  { label: 'Driver on the way',  dot: '#4ADE80' },
  arrived:          { label: 'Driver has arrived', dot: '#4ADE80' },
  in_progress:      { label: 'Heading to dropoff', dot: '#4ADE80' },
  completed:        { label: 'Ride complete',      dot: '#94A3B8' },
};

function prettyAge(ageMs) {
  if (ageMs == null || ageMs === Infinity) return 'unknown';
  const s = Math.round(ageMs / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}

// ── Keyframes ─────────────────────────────────────────────────────────
const KEYFRAMES = `
  @keyframes tmDriverBob { 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }
  @keyframes tmLiveDot   { 0%,100%{opacity:1} 50%{opacity:.35} }
  @keyframes tmRouteDraw { from{stroke-dashoffset:var(--route-len,2000)} to{stroke-dashoffset:0} }
  @keyframes tmDashFlow  { to{stroke-dashoffset:-40} }
  @keyframes tmFadeUp    { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
  @keyframes tmBadgePop  { 0%{transform:scale(.6);opacity:0} 70%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
  @keyframes tmPinPulse  { 0%,100%{r:13;opacity:.22} 50%{r:19;opacity:.07} }
  @keyframes tmPinDrop   {
    0%   { transform:translateY(-10px) scale(.85); opacity:0 }
    65%  { transform:translateY(2px)   scale(1.06); opacity:1 }
    100% { transform:translateY(0)     scale(1);    opacity:1 }
  }
  .tm-pin-pulse { animation: tmPinPulse 2.2s ease-in-out infinite; }
  .tm-pin-drop  { animation: tmPinDrop  .55s cubic-bezier(.34,1.2,.64,1) both; }
`;
let _injected = false;
function injectStyles() {
  if (_injected || typeof document === 'undefined') return;
  const el = document.createElement('style');
  el.textContent = KEYFRAMES;
  document.head.appendChild(el);
  _injected = true;
}

// ── Mapbox loader ─────────────────────────────────────────────────────
const MAPBOX_TOKEN = 'pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA';
let _mbLoaded = false;
let _mbCallbacks = [];
function loadMapbox(cb) {
  if (_mbLoaded && window.mapboxgl) { cb(); return; }
  _mbCallbacks.push(cb);
  if (document.getElementById('mapbox-css')) return;
  const link = document.createElement('link');
  link.id   = 'mapbox-css';
  link.rel  = 'stylesheet';
  link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css';
  document.head.appendChild(link);
  const script = document.createElement('script');
  script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js';
  script.onload = () => { _mbLoaded = true; _mbCallbacks.forEach(fn => fn()); _mbCallbacks = []; };
  document.head.appendChild(script);
}

// ── GPS source badge ──────────────────────────────────────────────────
function GpsBadge({ source, blended }) {
  if (blended) {
    return (
      <div title="Driver + Rider GPS agree" style={{
        position: 'absolute', top: -6, right: -6,
        width: 16, height: 16, borderRadius: '50%',
        background: '#16A34A', border: '2px solid #fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 2, boxShadow: '0 2px 6px rgba(22,163,74,0.55)',
        animation: 'tmBadgePop .35s cubic-bezier(.34,1.4,.64,1) both',
      }}>
        <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    );
  }
  const isRider = source === 'rider';
  const bg      = isRider ? '#3B82F6' : '#16A34A';
  const label   = isRider ? 'R' : 'D';
  return (
    <div title={isRider ? 'Rider GPS' : 'Driver GPS'} style={{
      position: 'absolute', top: -6, right: -6,
      width: 16, height: 16, borderRadius: '50%',
      background: bg, border: '2px solid #fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 8, fontWeight: 900, color: '#fff', zIndex: 2,
      boxShadow: `0 2px 6px ${bg}88`,
      animation: 'tmBadgePop .35s cubic-bezier(.34,1.4,.64,1) both',
    }}>
      {label}
    </div>
  );
}

// ── Animated car ──────────────────────────────────────────────────────
function AnimatedCar({ carSvg, driverColor, isInProgress, gpsSource, isCompleted }) {
  const prevPosRef = useRef(null);
  const [heading, setHeading] = useState(0);

  useEffect(() => {
    if (!carSvg) return;
    if (prevPosRef.current) {
      const moved = Math.hypot(carSvg.x - prevPosRef.current.x, carSvg.y - prevPosRef.current.y);
      if (moved > 2) setHeading(computeHeading(prevPosRef.current, carSvg));
    }
    prevPosRef.current = carSvg;
  }, [carSvg]);

  if (!carSvg || isCompleted) return null;

  return (
    <div style={{
      position: 'absolute',
      left: carSvg.x, top: carSvg.y,
      zIndex: 20,
      transform: 'translate(-50%, -50%)',
      transition: 'left 2.5s cubic-bezier(.4,0,.2,1), top 2.5s cubic-bezier(.4,0,.2,1)',
      willChange: 'left, top',
      animation: 'tmFadeUp .4s ease-out both',
    }}>
      {isInProgress && gpsSource && (
        <GpsBadge source={gpsSource.source} blended={gpsSource.blended} />
      )}
      <div style={{
        transform: `rotate(${heading}deg)`,
        transition: 'transform 2.5s cubic-bezier(.4,0,.2,1)',
        animation: 'tmDriverBob 2.2s ease-in-out infinite',
        filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.35))',
        lineHeight: 0,
      }}>
        <svg width="40" height="56" viewBox="0 0 40 56" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 12 Q8 4 20 4 Q32 4 32 12 L32 46 Q32 52 26 52 L14 52 Q8 52 8 46 Z" fill={driverColor} stroke="#fff" strokeWidth="2"/>
          <path d="M11 14 Q11 9 20 9 Q29 9 29 14 L28 22 L12 22 Z" fill="#7DD3FC" opacity="0.85"/>
          <path d="M12 38 L28 38 L28 46 Q28 48 26 48 L14 48 Q12 48 12 46 Z" fill="#7DD3FC" opacity="0.7"/>
          <rect x="12" y="24" width="16" height="12" rx="1" fill={driverColor} opacity="0.7"/>
          <rect x="5" y="14" width="3" height="3" rx="1" fill={driverColor}/>
          <rect x="32" y="14" width="3" height="3" rx="1" fill={driverColor}/>
          <circle cx="13" cy="7" r="1.5" fill="#FCD34D"/>
          <circle cx="27" cy="7" r="1.5" fill="#FCD34D"/>
          <rect x="11" y="49" width="4" height="2" rx="0.5" fill="#EF4444"/>
          <rect x="25" y="49" width="4" height="2" rx="0.5" fill="#EF4444"/>
        </svg>
      </div>
    </div>
  );
}

// ── Mapbox Background ─────────────────────────────────────────────────
// Now fits bounds to (car position + remaining route) so the active part
// of the trip stays centered & visible.
function MapboxBackground({ boundsGeo }) {
  const mapContainerRef = useRef(null);
  const mapRef          = useRef(null);
  const initializedRef  = useRef(false);

  const initCenter = useMemo(() => {
    if (boundsGeo) {
      return [
        (boundsGeo.minLng + boundsGeo.maxLng) / 2,
        (boundsGeo.minLat + boundsGeo.maxLat) / 2,
      ];
    }
    return [-81.3792, 28.5383];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || initializedRef.current) return;

    loadMapbox(() => {
      if (!mapContainerRef.current || initializedRef.current) return;
      initializedRef.current = true;

      window.mapboxgl.accessToken = MAPBOX_TOKEN;

      mapRef.current = new window.mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: initCenter,
        zoom: 14,
        attributionControl: false,
        interactive: false,
      });

      mapRef.current.addControl(
        new window.mapboxgl.AttributionControl({ compact: true }),
        'bottom-right'
      );
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        initializedRef.current = false;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fit bounds when boundsGeo changes (new GPS, status flip, etc.)
  useEffect(() => {
    if (!mapRef.current || !boundsGeo) return;
    const fit = () => {
      mapRef.current.fitBounds(
        [[boundsGeo.minLng, boundsGeo.minLat], [boundsGeo.maxLng, boundsGeo.maxLat]],
        { padding: 56, duration: 1200, maxZoom: 16 }
      );
    };
    if (mapRef.current.loaded()) fit();
    else mapRef.current.once('load', fit);
  }, [boundsGeo?.minLat, boundsGeo?.maxLat, boundsGeo?.minLng, boundsGeo?.maxLng]);

  return (
    <div
      ref={mapContainerRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 }}
    />
  );
}

// ── Main component ────────────────────────────────────────────────────
export default function TrackingMap({
  active = [],
  bookingPayload: bookingPayloadProp,
  rideStatus: rideStatusProp,
  isTracking = true,
  etaMin,
  driverDistanceMiles,
  dropoffDistanceMiles,
  distanceMiles,
  driverPos,
}) {
  const containerRef = useRef(null);
  const [mapDims, setMapDims] = useState({ W: 0, H: 0 });

  useEffect(() => { injectStyles(); }, []);

  const updateDims = useCallback(() => {
    if (!containerRef.current) return;
    const { offsetWidth, offsetHeight } = containerRef.current;
    setMapDims({ W: offsetWidth, H: offsetHeight });
  }, []);

  useEffect(() => {
    updateDims();
    const ro = new ResizeObserver(updateDims);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [updateDims]);

  const payload     = bookingPayloadProp || active?.[0] || {};
  const status      = rideStatusProp || payload.status || '';
  const driverColor = getDriverColor(payload.rideType);
  const tierStyle   = getRideTierBg(payload.rideType);

  const headingToPickup  = ['driver_assigned', 'driver_arriving'].includes(status);
  const headingToDropoff = ['arrived', 'in_progress'].includes(status);
  const isInProgress     = status === 'in_progress';
  const isCompleted      = status === 'completed';
  const isArrived        = status === 'arrived';

  const driverLat = safeNum(payload.driverLat);
  const driverLng = safeNum(payload.driverLng);
  const riderLat  = safeNum(payload.riderLat);
  const riderLng  = safeNum(payload.riderLng);

  const driverLocMs = tsToMs(payload.driverLocationAt);
  const riderLocMs  = tsToMs(payload.riderLocationAt);
  const updatedAtMs = tsToMs(payload.updatedAt);

  const gpsSource = useMemo(
    () => resolveGpsSource(payload, status),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, driverLat, driverLng, riderLat, riderLng,
     driverLocMs, riderLocMs, updatedAtMs,
     payload.driverEtaMin, payload.riderDropoffEtaMin]
  );

  const rawPolyline = payload.polyline ?? null;
  const fullDecodedPts = useMemo(() => decodePolyline(rawPolyline), [rawPolyline]);

  // ── Trim polyline during in_progress ─────────────────────────────────
  // Show only the path from car forward to dropoff. Drops the already-
  // travelled portion, which makes the active route easier to read.
  const visiblePolyPts = useMemo(() => {
    if (!isInProgress) return fullDecodedPts;
    if (!gpsSource || !fullDecodedPts.length) return fullDecodedPts;
    return trimPolylineFromCar(fullDecodedPts, gpsSource.lat, gpsSource.lng);
  }, [fullDecodedPts, isInProgress, gpsSource?.lat, gpsSource?.lng]);

  // ── Build a single bounding box for ALL projections ──────────────────
  // Includes: visible polyline + car position + dropoff
  // (pickup excluded during in_progress — they've left it)
  const sharedBounds = useMemo(() => {
    const all = [...visiblePolyPts];
    if (gpsSource && gpsSource.lat && gpsSource.lng) all.push([gpsSource.lat, gpsSource.lng]);
    if (!isInProgress && payload.pickupLat && payload.pickupLng) {
      all.push([safeNum(payload.pickupLat), safeNum(payload.pickupLng)]);
    }
    if (payload.dropoffLat && payload.dropoffLng) {
      all.push([safeNum(payload.dropoffLat), safeNum(payload.dropoffLng)]);
    }
    return computeBounds(all);
  }, [visiblePolyPts, gpsSource?.lat, gpsSource?.lng, isInProgress,
      payload.pickupLat, payload.pickupLng, payload.dropoffLat, payload.dropoffLng]);

  // Project the visible polyline using the shared bounds
  const svgPolyPts = useMemo(() => {
    if (!sharedBounds || !visiblePolyPts.length) return [];
    return visiblePolyPts.map(([la, ln]) =>
      projectSingleWithBounds(la, ln, sharedBounds, mapDims.W, mapDims.H)
    ).filter(Boolean);
  }, [visiblePolyPts, sharedBounds, mapDims.W, mapDims.H]);

  const pickupSvg = useMemo(() => {
    if (isInProgress) return null;
    if (svgPolyPts.length > 0) return svgPolyPts[0];
    if (!sharedBounds) return null;
    const lat = safeNum(payload.pickupLat);
    const lng = safeNum(payload.pickupLng);
    if (!lat || !lng) return null;
    return projectSingleWithBounds(lat, lng, sharedBounds, mapDims.W, mapDims.H);
  }, [isInProgress, svgPolyPts, sharedBounds, payload.pickupLat, payload.pickupLng, mapDims.W, mapDims.H]);

  const dropoffSvg = useMemo(() => {
    // During in_progress, dropoff is the end of the FULL polyline, not the visible (trimmed) one
    if (isInProgress && fullDecodedPts.length) {
      const last = fullDecodedPts[fullDecodedPts.length - 1];
      return projectSingleWithBounds(last[0], last[1], sharedBounds, mapDims.W, mapDims.H);
    }
    if (svgPolyPts.length > 0) return svgPolyPts[svgPolyPts.length - 1];
    if (!sharedBounds) return null;
    const lat = safeNum(payload.dropoffLat);
    const lng = safeNum(payload.dropoffLng);
    if (!lat || !lng) return null;
    return projectSingleWithBounds(lat, lng, sharedBounds, mapDims.W, mapDims.H);
  }, [isInProgress, fullDecodedPts, svgPolyPts, sharedBounds,
      payload.dropoffLat, payload.dropoffLng, mapDims.W, mapDims.H]);

  // Car position
  const carSvgRaw = useMemo(() => {
    if (driverPos) return driverPos;
    if (!gpsSource || !sharedBounds) return null;
    return projectSingleWithBounds(gpsSource.lat, gpsSource.lng, sharedBounds, mapDims.W, mapDims.H);
  }, [driverPos, gpsSource?.lat, gpsSource?.lng, sharedBounds, mapDims.W, mapDims.H]);

  const carSvg = useMemo(() => {
    if (!carSvgRaw) return carSvgRaw;
    // Snap to pickup/dropoff if very close (avoid car floating off-pin at endpoints)
    if (pickupSvg && gpsSource) {
      const distToPickup = geoDistMeters(gpsSource.lat, gpsSource.lng, safeNum(payload.pickupLat), safeNum(payload.pickupLng));
      if (distToPickup <= 30) return pickupSvg;
    }
    if (dropoffSvg && gpsSource) {
      const distToDropoff = geoDistMeters(gpsSource.lat, gpsSource.lng, safeNum(payload.dropoffLat), safeNum(payload.dropoffLng));
      if (distToDropoff <= 30) return dropoffSvg;
    }
    if (!svgPolyPts.length) return carSvgRaw;
    const snapped = closestPointOnPolyline(svgPolyPts, carSvgRaw.x, carSvgRaw.y);
    return { x: snapped.x, y: snapped.y };
  }, [carSvgRaw, svgPolyPts, pickupSvg, dropoffSvg, gpsSource?.lat, gpsSource?.lng,
      payload.pickupLat, payload.pickupLng, payload.dropoffLat, payload.dropoffLng]);

  const polylinePath = toSVGPath(svgPolyPts);
  const routeLen     = svgPolyPts.length > 1 ? approxPathLen(svgPolyPts) : 1200;

  const fabEta = useMemo(() => {
    if (isCompleted) return null;
    if (isInProgress || isArrived) return safeNum(payload.dropoffEtaMin ?? payload.riderDropoffEtaMin ?? etaMin);
    if (headingToPickup) return safeNum(payload.driverEtaMin ?? etaMin);
    return safeNum(etaMin);
  }, [isCompleted, isInProgress, isArrived, headingToPickup,
      payload.dropoffEtaMin, payload.riderDropoffEtaMin, payload.driverEtaMin, etaMin]);

  const fabEtaLabel = (isInProgress || isArrived) ? 'min to dropoff' : 'min away';

  const statusMeta = STATUS_META[status] ?? STATUS_META.driver_assigned;

  const gpsLabel = isInProgress && gpsSource
    ? gpsSource.bothVeryStale
      ? { text: 'GPS offline', color: '#DC2626', stale: true }
      : gpsSource.blended
        ? { text: 'GPS synced', color: '#16A34A' }
        : gpsSource.source === 'rider'
          ? { text: 'Rider GPS', color: '#3B82F6', subtle: gpsSource.otherStale ? 'driver offline' : null }
          : { text: 'Driver GPS', color: '#16A34A', subtle: gpsSource.otherStale ? 'rider offline' : null }
    : null;

  return (
    <div style={{
      borderRadius: 22,
      overflow: 'hidden',
      border: '1px solid rgba(0,0,0,0.07)',
      boxShadow: '0 12px 40px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.05)',
      background: '#fff',
      fontFamily: "'Outfit', system-ui, sans-serif",
    }}>
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          height: 260,
          overflow: 'hidden',
        }}
      >
        <MapboxBackground boundsGeo={sharedBounds} />

        {/* SVG overlay: polyline + pins */}
        {mapDims.W > 0 && svgPolyPts.length > 1 && (
          <svg
            style={{ position: 'absolute', inset: 0, width: '100%', height: mapDims.H, pointerEvents: 'none', zIndex: 3 }}
            viewBox={`0 0 ${mapDims.W} ${mapDims.H}`}
          >
            <defs>
              <linearGradient id="tm-routeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor={headingToDropoff ? '#16A34A' : '#3B82F6'}/>
                <stop offset="100%" stopColor={headingToDropoff ? '#22C55E' : '#111827'}/>
              </linearGradient>
              <filter id="tm-glow">
                <feGaussianBlur stdDeviation="2.5" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>

            <path d={polylinePath} fill="none" stroke="#fff" strokeWidth={9}
                  strokeLinecap="round" strokeLinejoin="round" opacity={0.85}/>
            <path d={polylinePath} fill="none"
                  stroke={headingToDropoff ? '#BBF7D0' : '#BFDBFE'}
                  strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" opacity={0.9}/>
            <path
              d={polylinePath}
              fill="none"
              stroke="url(#tm-routeGrad)"
              strokeWidth={4.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#tm-glow)"
              style={{
                strokeDasharray: routeLen,
                strokeDashoffset: routeLen,
                animation: `tmRouteDraw 1.2s cubic-bezier(.4,0,.2,1) forwards`,
                '--route-len': routeLen,
              }}
            />
            <path
              d={polylinePath}
              fill="none"
              stroke="rgba(255,255,255,.6)"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeDasharray="7 18"
              style={{ animation: 'tmDashFlow 1.4s linear infinite' }}
            />

            {pickupSvg && (
              <g className="tm-pin-drop" style={{ transformOrigin: `${pickupSvg.x}px ${pickupSvg.y}px`, animationDelay: '.1s' }}>
                {headingToPickup && <circle className="tm-pin-pulse" cx={pickupSvg.x} cy={pickupSvg.y} fill="#22C55E"/>}
                <circle cx={pickupSvg.x} cy={pickupSvg.y} r={13}  fill="#fff" stroke="#22C55E" strokeWidth="2.5"/>
                <circle cx={pickupSvg.x} cy={pickupSvg.y} r={6.5} fill="#22C55E"/>
                <circle cx={pickupSvg.x} cy={pickupSvg.y} r={2.5} fill="#fff"/>
              </g>
            )}

            {dropoffSvg && (
              <g className="tm-pin-drop" style={{ transformOrigin: `${dropoffSvg.x}px ${dropoffSvg.y}px`, animationDelay: '.3s' }}>
                <ellipse cx={dropoffSvg.x} cy={dropoffSvg.y + 26} rx={7} ry={3} fill="rgba(17,24,39,.15)"/>
                <path
                  d={`M${dropoffSvg.x},${dropoffSvg.y + 26}
                      C${dropoffSvg.x},${dropoffSvg.y + 26} ${dropoffSvg.x - 14},${dropoffSvg.y + 10}
                      ${dropoffSvg.x - 14},${dropoffSvg.y - 4}
                      A14,14 0 1,1 ${dropoffSvg.x + 14},${dropoffSvg.y - 4}
                      C${dropoffSvg.x + 14},${dropoffSvg.y + 10} ${dropoffSvg.x},${dropoffSvg.y + 26} Z`}
                  fill="#111827"
                />
                <circle cx={dropoffSvg.x} cy={dropoffSvg.y - 5} r={6}   fill="#fff"/>
                <circle cx={dropoffSvg.x} cy={dropoffSvg.y - 5} r={2.5} fill="#111827"/>
              </g>
            )}
          </svg>
        )}

        {/* No-polyline edge case */}
        {svgPolyPts.length <= 1 && (pickupSvg || dropoffSvg) && (
          <svg
            style={{ position: 'absolute', inset: 0, width: '100%', height: mapDims.H, pointerEvents: 'none', zIndex: 3 }}
            viewBox={`0 0 ${mapDims.W} ${mapDims.H}`}
          >
            {pickupSvg && (
              <g className="tm-pin-drop" style={{ transformOrigin: `${pickupSvg.x}px ${pickupSvg.y}px`, animationDelay: '.1s' }}>
                {headingToPickup && <circle className="tm-pin-pulse" cx={pickupSvg.x} cy={pickupSvg.y} fill="#22C55E"/>}
                <circle cx={pickupSvg.x} cy={pickupSvg.y} r={13}  fill="#fff" stroke="#22C55E" strokeWidth="2.5"/>
                <circle cx={pickupSvg.x} cy={pickupSvg.y} r={6.5} fill="#22C55E"/>
                <circle cx={pickupSvg.x} cy={pickupSvg.y} r={2.5} fill="#fff"/>
              </g>
            )}
            {dropoffSvg && (
              <g className="tm-pin-drop" style={{ transformOrigin: `${dropoffSvg.x}px ${dropoffSvg.y}px`, animationDelay: '.3s' }}>
                <ellipse cx={dropoffSvg.x} cy={dropoffSvg.y + 26} rx={7} ry={3} fill="rgba(17,24,39,.15)"/>
                <path
                  d={`M${dropoffSvg.x},${dropoffSvg.y + 26}
                      C${dropoffSvg.x},${dropoffSvg.y + 26} ${dropoffSvg.x - 14},${dropoffSvg.y + 10}
                      ${dropoffSvg.x - 14},${dropoffSvg.y - 4}
                      A14,14 0 1,1 ${dropoffSvg.x + 14},${dropoffSvg.y - 4}
                      C${dropoffSvg.x + 14},${dropoffSvg.y + 10} ${dropoffSvg.x},${dropoffSvg.y + 26} Z`}
                  fill="#111827"
                />
                <circle cx={dropoffSvg.x} cy={dropoffSvg.y - 5} r={6}   fill="#fff"/>
                <circle cx={dropoffSvg.x} cy={dropoffSvg.y - 5} r={2.5} fill="#111827"/>
              </g>
            )}
          </svg>
        )}

        <AnimatedCar
          carSvg={carSvg}
          driverColor={driverColor}
          isInProgress={isInProgress}
          gpsSource={gpsSource}
          isCompleted={isCompleted}
        />

        {/* Status pill (top-left) */}
        <div style={{
          position: 'absolute', top: 12, left: 12, zIndex: 25,
          display: 'inline-flex', alignItems: 'center', gap: 7,
          background: '#111827', color: '#fff',
          borderRadius: 100, padding: '7px 12px 7px 9px',
          fontSize: 11, fontWeight: 700, letterSpacing: '.3px',
          boxShadow: '0 6px 18px rgba(17,24,39,0.20)',
          whiteSpace: 'nowrap',
          animation: 'tmFadeUp .4s ease-out both',
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: statusMeta.dot,
            boxShadow: `0 0 0 3px ${statusMeta.dot}30`,
            animation: isCompleted ? 'none' : 'tmLiveDot 1.4s ease-in-out infinite',
          }}/>
          {statusMeta.label}
        </div>

        {/* Ride tier badge (top-right) */}
        {payload.rideLabel && (
          <div style={{
            position: 'absolute', top: 12, right: 12, zIndex: 25,
            background: tierStyle.bg,
            border: `1px solid ${tierStyle.border}`,
            borderRadius: 10, padding: '6px 11px',
            fontSize: 10, fontWeight: 800,
            color: tierStyle.text,
            letterSpacing: '0.6px', textTransform: 'uppercase',
            animation: 'tmFadeUp .4s ease-out .1s both',
          }}>
            {payload.rideLabel}
          </div>
        )}

        {/* ETA FAB (bottom-right) */}
        {fabEta != null && fabEta > 0 && fabEta < 999 && !isCompleted && (
          <div style={{
            position: 'absolute', bottom: 14, right: 14, zIndex: 25,
            background: '#fff', borderRadius: 14, padding: '9px 14px',
            textAlign: 'center',
            border: '1px solid rgba(0,0,0,0.06)',
            boxShadow: '0 8px 24px rgba(17,24,39,0.14)',
            minWidth: 78,
            animation: 'tmFadeUp .4s ease-out .2s both',
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', lineHeight: 1, letterSpacing: '-0.5px' }}>
              {fabEta}
            </div>
            <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 3, fontWeight: 600, letterSpacing: '.3px' }}>
              {fabEtaLabel}
            </div>
          </div>
        )}

        {/* GPS source label (bottom-left) */}
        {gpsLabel && (
          <div style={{
            position: 'absolute', bottom: 14, left: 14, zIndex: 25,
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(8px)',
            border: `1px solid ${gpsLabel.stale ? 'rgba(220,38,38,0.25)' : 'rgba(0,0,0,0.06)'}`,
            borderRadius: 10, padding: '6px 10px',
            boxShadow: '0 4px 14px rgba(17,24,39,0.10)',
            animation: 'tmFadeUp .4s ease-out .3s both',
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: gpsLabel.color,
              animation: 'tmLiveDot 1.4s ease-in-out infinite',
            }}/>
            <span style={{ fontSize: 11, fontWeight: 700, color: gpsLabel.color, letterSpacing: '.2px' }}>
              {gpsLabel.text}
            </span>
            {gpsLabel.subtle && (
              <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 500, marginLeft: 2 }}>
                · {gpsLabel.subtle}
              </span>
            )}
            {gpsSource?.ageMs > 0 && gpsSource?.ageMs !== Infinity && gpsLabel.stale && (
              <span style={{ fontSize: 10, color: '#DC2626', fontWeight: 600, marginLeft: 2 }}>
                · {prettyAge(gpsSource.ageMs)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}