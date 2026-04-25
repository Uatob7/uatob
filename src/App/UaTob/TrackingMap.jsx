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

// ── Google encoded polyline decoder ───────────────────────────────────
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

// ── Project lat/lng points into SVG space ─────────────────────────────
function projectPoints(pts, W, H, pad = 48) {
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

function projectSingle(lat, lng, pts, W, H, pad = 48) {
  if (!pts.length || !W || !H) return null;
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
  return {
    x: offX + (lng - minLng) * scale,
    y: H - (offY + (lat - minLat) * scale),
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

// ── Snap to nearest point on polyline ────────────────────────────────
function closestPointOnPolyline(svgPts, px, py) {
  if (!svgPts.length) return { x: px, y: py };
  let best = svgPts[0], bestDist = Infinity;
  for (const pt of svgPts) {
    const d = Math.hypot(pt.x - px, pt.y - py);
    if (d < bestDist) { bestDist = d; best = pt; }
  }
  return best;
}

// ── Compute heading angle between two SVG points ──────────────────────
function computeHeading(from, to) {
  if (!from || !to) return 0;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  // SVG Y-axis is inverted, so negate dy for real-world angle
  return Math.atan2(dx, -dy) * (180 / Math.PI);
}

// ── Determine GPS source for in_progress rides ────────────────────────
function resolveGpsSource(payload, status) {
  const isInProgress = status === 'in_progress';

  const driverLat = safeNum(payload.driverLat);
  const driverLng = safeNum(payload.driverLng);
  const riderLat  = safeNum(payload.riderLat);
  const riderLng  = safeNum(payload.riderLng);

  const hasDriver = driverLat !== 0 && driverLng !== 0;
  const hasRider  = riderLat !== 0 && riderLng !== 0;

  const driverEta = safeNum(payload.driverEtaMin ?? payload.dropoffEtaMin ?? 999);
  const riderEta  = safeNum(payload.riderDropoffEtaMin ?? 999);

  if (!isInProgress) {
    if (hasDriver) return { source: 'driver', lat: driverLat, lng: driverLng, etaMin: driverEta };
    if (hasRider)  return { source: 'rider',  lat: riderLat,  lng: riderLng,  etaMin: riderEta  };
    return {
      source: 'static',
      lat: safeNum(payload.dropoffLat),
      lng: safeNum(payload.dropoffLng),
      etaMin: safeNum(payload.dropoffEtaMin),
    };
  }

  const driverIsOnline = hasDriver && (
    Math.abs(driverLat - riderLat) > 0.00005 ||
    Math.abs(driverLng - riderLng) > 0.00005
  );

  if (driverIsOnline) return { source: 'driver', lat: driverLat, lng: driverLng, etaMin: driverEta };
  if (hasRider)       return { source: 'rider',  lat: riderLat,  lng: riderLng,  etaMin: riderEta  };
  return {
    source: 'static',
    lat: safeNum(payload.dropoffLat),
    lng: safeNum(payload.dropoffLng),
    etaMin: safeNum(payload.dropoffEtaMin),
  };
}

// ── Keyframes ─────────────────────────────────────────────────────────
const KEYFRAMES = `
  @keyframes tmRipple {
    0%   { transform: translate(-50%,-50%) scale(0.6); opacity: 0.7; }
    100% { transform: translate(-50%,-50%) scale(2.8); opacity: 0; }
  }
  @keyframes tmDriverBob {
    0%, 100% { transform: translate(-50%,-50%) scale(1); }
    50%       { transform: translate(-50%,-50%) scale(1.06); }
  }
  @keyframes tmLiveDot {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.35; }
  }
  @keyframes tmRouteDraw {
    from { stroke-dashoffset: var(--route-len, 2000); }
    to   { stroke-dashoffset: 0; }
  }
  @keyframes tmDashFlow {
    to { stroke-dashoffset: -40; }
  }
  @keyframes tmFadeUp {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes tmPulsePin {
    0%, 100% { box-shadow: 0 4px 18px rgba(22,163,74,0.4), 0 0 0 0 rgba(22,163,74,0.3); }
    50%       { box-shadow: 0 4px 18px rgba(22,163,74,0.4), 0 0 0 10px rgba(22,163,74,0); }
  }
  @keyframes tmBadgePop {
    0%   { transform: scale(0.6); opacity: 0; }
    70%  { transform: scale(1.15); }
    100% { transform: scale(1); opacity: 1; }
  }
`;

let _injected = false;
function injectStyles() {
  if (_injected || typeof document === 'undefined') return;
  const el = document.createElement('style');
  el.textContent = KEYFRAMES;
  document.head.appendChild(el);
  _injected = true;
}

// ── Map background tile ───────────────────────────────────────────────
function MapBackground({ W, H }) {
  if (!W || !H) return null;
  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: H, pointerEvents: 'none', zIndex: 1 }}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
    >
      <defs>
        <pattern id="tm-grid" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M28 0L0 0 0 28" fill="none" stroke="rgba(0,0,0,.045)" strokeWidth=".7"/>
        </pattern>
      </defs>
      <rect width={W} height={H} fill="#EEF2F0"/>
      <rect width={W} height={H} fill="url(#tm-grid)"/>
      <line x1={0}        y1={H * 0.37} x2={W}        y2={H * 0.34} stroke="#D4DBD7" strokeWidth={18} strokeLinecap="round"/>
      <line x1={0}        y1={H * 0.64} x2={W}        y2={H * 0.69} stroke="#DAE2DE" strokeWidth={12} strokeLinecap="round"/>
      <line x1={W * 0.26} y1={0}        x2={W * 0.24} y2={H}        stroke="#DAE2DE" strokeWidth={13} strokeLinecap="round"/>
      <line x1={W * 0.63} y1={0}        x2={W * 0.66} y2={H}        stroke="#D4DBD7" strokeWidth={17} strokeLinecap="round"/>
      <line x1={W * 0.43} y1={0}        x2={W * 0.41} y2={H}        stroke="#DDE5E2" strokeWidth={9}  strokeLinecap="round"/>
      <line x1={0} y1={H * 0.37} x2={W} y2={H * 0.34} stroke="#fff" strokeWidth={1.5} strokeDasharray="18 10" opacity={0.7}/>
      <line x1={W * 0.63} y1={0} x2={W * 0.66} y2={H} stroke="#fff" strokeWidth={1.5} strokeDasharray="18 10" opacity={0.6}/>
      {[
        [0.07, 0.10, 0.09, 0.13],
        [0.19, 0.07, 0.07, 0.10],
        [0.72, 0.13, 0.08, 0.11],
        [0.82, 0.21, 0.11, 0.09],
        [0.35, 0.54, 0.08, 0.11],
        [0.08, 0.54, 0.10, 0.08],
        [0.52, 0.20, 0.06, 0.14],
        [0.14, 0.30, 0.07, 0.09],
      ].map(([rx, ry, rw, rh], i) => (
        <rect key={i} x={W*rx} y={H*ry} width={W*rw} height={H*rh} rx={3} fill="#C5CEC9" opacity={0.45}/>
      ))}
    </svg>
  );
}

// ── GPS source badge on car ───────────────────────────────────────────
function GpsBadge({ source }) {
  const isRider = source === 'rider';
  const bg      = isRider ? '#3B82F6' : '#16A34A';
  const label   = isRider ? 'R' : 'D';
  const title   = isRider ? 'Rider GPS' : 'Driver GPS';

  return (
    <div
      title={title}
      style={{
        position: 'absolute',
        top: -6, right: -6,
        width: 16, height: 16,
        borderRadius: '50%',
        background: bg,
        border: '2px solid #fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 8, fontWeight: 900, color: '#fff',
        letterSpacing: 0,
        zIndex: 2,
        boxShadow: `0 2px 6px ${bg}88`,
        animation: 'tmBadgePop .35s cubic-bezier(.34,1.4,.64,1) both',
      }}
    >
      {label}
    </div>
  );
}

// ── Animated Car Icon ─────────────────────────────────────────────────
// Uses a ref-tracked position + CSS transition so every driverLat/driverLng
// change triggers a smooth glide along the polyline.
function AnimatedCar({ carSvg, driverColor, isInProgress, gpsSource, isCompleted, svgPolyPts }) {
  // Track the *previous* snapped position so we can compute heading
  const prevPosRef  = useRef(null);
  const [heading, setHeading] = useState(0);

  // Whenever carSvg changes (new GPS fix), update heading then store prev
  useEffect(() => {
    if (!carSvg) return;
    if (prevPosRef.current) {
      const angle = computeHeading(prevPosRef.current, carSvg);
      // Only update heading if the car actually moved (avoid jitter)
      if (Math.hypot(carSvg.x - prevPosRef.current.x, carSvg.y - prevPosRef.current.y) > 2) {
        setHeading(angle);
      }
    }
    prevPosRef.current = carSvg;
  }, [carSvg]);

  if (!carSvg || isCompleted) return null;

  return (
    <div
      style={{
        position: 'absolute',
        // Use left/top + CSS transition for smooth interpolation on every GPS update
        left: carSvg.x,
        top:  carSvg.y,
        zIndex: 20,
        // Smooth glide: 2.5s matches typical GPS polling interval.
        // Use will-change to hint GPU compositing for the transition.
        transition: 'left 2.5s cubic-bezier(.4,0,.2,1), top 2.5s cubic-bezier(.4,0,.2,1)',
        willChange: 'left, top',
        animation: 'tmFadeUp .4s ease-out both',
      }}
    >
      {/* GPS source badge */}
      {isInProgress && gpsSource && (
        <div style={{ position: 'absolute', top: 0, right: 0, transform: 'translate(-50%,-50%)', zIndex: 30 }}>
          <GpsBadge source={gpsSource.source} />
        </div>
      )}

      <div
        style={{
          width: 50, height: 50,
          background: driverColor,
          borderRadius: 18,
          border: '3px solid #fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          // Center the icon on its coordinate point, then rotate to heading
          transform: `translate(-50%, -50%) rotate(${heading}deg)`,
          // Heading rotation also transitions smoothly
          transition: 'transform 2.5s cubic-bezier(.4,0,.2,1)',
          boxShadow: `0 6px 22px ${driverColor}60, 0 0 0 6px ${driverColor}18`,
          // Bob animation applied via a wrapper to avoid conflicting with rotation
          position: 'relative',
        }}
      >
        {/* Bob wrapper (separate from rotation so they don't conflict) */}
        <div style={{ animation: 'tmDriverBob 2.2s ease-in-out infinite', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="8"  width="18" height="9"  rx="2.5" fill="#fff"/>
            <path d="M6 8 L7.5 4 L16.5 4 L18 8Z" fill="#4ADE80"/>
            <rect x="6.5"  y="4.5" width="3" height="2.5" rx=".6" fill="#fff" opacity=".9"/>
            <rect x="10.5" y="4.5" width="3" height="2.5" rx=".6" fill="#fff" opacity=".9"/>
            <circle cx="7.5"  cy="17" r="2"   fill={driverColor === '#111827' ? '#1f2937' : driverColor}/>
            <circle cx="7.5"  cy="17" r=".85" fill="#4ADE80"/>
            <circle cx="16.5" cy="17" r="2"   fill={driverColor === '#111827' ? '#1f2937' : driverColor}/>
            <circle cx="16.5" cy="17" r=".85" fill="#4ADE80"/>
            <rect x="19" y="9.5" width="2" height="1.4" rx=".4" fill="#FCD34D"/>
          </svg>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────
export default function TrackingMap({
  active,
}) {

  console.log(active);

  const containerRef = useRef(null);
  const [dims, setDims] = useState({ W: 0, H: 0 });

  useEffect(() => { injectStyles(); }, []);

  const updateDims = useCallback(() => {
    if (!containerRef.current) return;
    const { offsetWidth, offsetHeight } = containerRef.current;
    setDims({ W: offsetWidth, H: offsetHeight });
  }, []);

  useEffect(() => {
    updateDims();
    const ro = new ResizeObserver(updateDims);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [updateDims]);

  const payload     = bookingPayload || {};
  const status      = rideStatus || payload.status || '';
  const driverColor = getDriverColor(payload.rideType);

  const STATUS_BAR_H = 108;
  const mapH = Math.max(0, dims.H - STATUS_BAR_H);

  // ── Status flags ──────────────────────────────────────────────────
  const headingToPickup  = ['driver_assigned', 'driver_arriving'].includes(status);
  const headingToDropoff = ['arrived', 'in_progress'].includes(status);
  const isInProgress     = status === 'in_progress';
  const isCompleted      = status === 'completed';
  const isArrived        = status === 'arrived';

  // ── Resolve GPS source ────────────────────────────────────────────
  // Explicitly depend on the raw lat/lng primitives — not the payload object —
  // so any change to driverLat / driverLng triggers a new memo evaluation and
  // a re-render that updates carSvg → moves the car.
  const driverLat = safeNum(payload.driverLat);
  const driverLng = safeNum(payload.driverLng);
  const riderLat  = safeNum(payload.riderLat);
  const riderLng  = safeNum(payload.riderLng);

  const gpsSource = useMemo(
    () => resolveGpsSource(payload, status),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, driverLat, driverLng, riderLat, riderLng, payload.driverEtaMin, payload.riderDropoffEtaMin]
  );

  // ── Decode polyline ───────────────────────────────────────────────
  const rawPolyline = payload.polyline ?? null;
  const decodedPts  = useMemo(() => decodePolyline(rawPolyline), [rawPolyline]);

  // ── Build unified bounding box ────────────────────────────────────
  // Always include pickup + dropoff + active GPS so the car is never clipped.
  const allGeoPoints = useMemo(() => {
    const pts = [...decodedPts];
    if (gpsSource) pts.push([gpsSource.lat, gpsSource.lng]);
    if (payload.pickupLat  && payload.pickupLng)
      pts.push([safeNum(payload.pickupLat),  safeNum(payload.pickupLng)]);
    if (payload.dropoffLat && payload.dropoffLng)
      pts.push([safeNum(payload.dropoffLat), safeNum(payload.dropoffLng)]);
    return pts;
  }, [decodedPts, gpsSource, payload.pickupLat, payload.pickupLng, payload.dropoffLat, payload.dropoffLng]);

  // ── Project polyline path ─────────────────────────────────────────
  const svgPolyPts = useMemo(
    () => projectPoints(decodedPts, dims.W, mapH),
    [decodedPts, dims.W, mapH]
  );

  // ── Project pins ──────────────────────────────────────────────────
  const pickupSvg = useMemo(
    () => isInProgress
      ? null
      : projectSingle(safeNum(payload.pickupLat), safeNum(payload.pickupLng), allGeoPoints, dims.W, mapH),
    [isInProgress, payload.pickupLat, payload.pickupLng, allGeoPoints, dims.W, mapH]
  );
  const dropoffSvg = useMemo(
    () => projectSingle(safeNum(payload.dropoffLat), safeNum(payload.dropoffLng), allGeoPoints, dims.W, mapH),
    [payload.dropoffLat, payload.dropoffLng, allGeoPoints, dims.W, mapH]
  );

  // ── Project car position → snap to polyline ───────────────────────
  // This memo re-runs on EVERY driverLat/driverLng change (via gpsSource),
  // producing a new snapped SVG coordinate that triggers AnimatedCar's transition.
  const carSvgRaw = useMemo(() => {
    if (driverPos) return driverPos; // externally provided projected pos
    if (!gpsSource) return null;
    return projectSingle(gpsSource.lat, gpsSource.lng, allGeoPoints, dims.W, mapH);
  }, [
    driverPos,
    // Explicit primitive deps so changing driverLat/driverLng is always caught:
    gpsSource?.lat, gpsSource?.lng, gpsSource?.source,
    allGeoPoints, dims.W, mapH,
  ]);

  const carSvg = useMemo(() => {
    if (!carSvgRaw || !svgPolyPts.length) return carSvgRaw;
    return closestPointOnPolyline(svgPolyPts, carSvgRaw.x, carSvgRaw.y);
  }, [carSvgRaw, svgPolyPts]);

  const polylinePath = toSVGPath(svgPolyPts);
  const routeLen     = svgPolyPts.length > 1 ? approxPathLen(svgPolyPts) : 1200;

  // ── Display values ────────────────────────────────────────────────
  const displayEta = isInProgress && gpsSource
    ? gpsSource.etaMin
    : safeNum(etaMin ?? (headingToPickup ? payload.driverEtaMin : payload.dropoffEtaMin));

  const displayDist = headingToPickup
    ? safeNum(driverDistanceMiles ?? payload.driverDistanceMiles)
    : safeNum(dropoffDistanceMiles ?? distanceMiles ?? payload.dropoffDistanceMiles ?? payload.tripDistanceMiles);

  // ── Status label ──────────────────────────────────────────────────
  const statusLabel = isCompleted
    ? 'Ride complete'
    : isArrived
      ? 'Driver has arrived'
      : isInProgress
        ? 'Heading to dropoff'
        : headingToPickup
          ? 'Driver on the way'
          : 'Locating driver…';

  const statusColor = isCompleted ? '#64748B' : isArrived ? '#F59E0B' : '#16A34A';

  const gpsLabel = isInProgress && gpsSource
    ? gpsSource.source === 'rider'
      ? { text: 'Rider GPS', color: '#3B82F6' }
      : { text: 'Driver GPS', color: '#16A34A' }
    : null;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        height: 360,
        borderRadius: 24,
        overflow: 'hidden',
        border: '1.5px solid rgba(0,0,0,0.08)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        background: '#EEF2F0',
        fontFamily: "'Outfit', system-ui, sans-serif",
      }}
    >
      {/* ── Map background ── */}
      <MapBackground W={dims.W} H={mapH} />

      {/* ── SVG route overlay ── */}
      {dims.W > 0 && svgPolyPts.length > 1 && (
        <svg
          style={{ position: 'absolute', inset: 0, width: '100%', height: mapH, pointerEvents: 'none', zIndex: 3 }}
          viewBox={`0 0 ${dims.W} ${mapH}`}
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

          <path d={polylinePath} fill="none" stroke="#fff" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" opacity={0.7}/>
          <path d={polylinePath} fill="none" stroke={headingToDropoff ? '#BBF7D0' : '#BFDBFE'} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" opacity={0.9}/>
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
            stroke="rgba(255,255,255,.55)"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeDasharray="7 18"
            style={{ animation: 'tmDashFlow 1.4s linear infinite' }}
          />

          {pickupSvg  && <circle cx={pickupSvg.x}  cy={pickupSvg.y}  r={28} fill="#111827" opacity={0.07}/>}
          {dropoffSvg && <circle cx={dropoffSvg.x} cy={dropoffSvg.y} r={28} fill="#16A34A" opacity={0.10}/>}
        </svg>
      )}

      {/* ── Pickup pin (hidden during in_progress) ── */}
      {pickupSvg && (
        <div style={{
          position: 'absolute',
          left: pickupSvg.x, top: pickupSvg.y,
          zIndex: 10,
          transform: 'translate(-50%, -50%)',
          animation: 'tmFadeUp .5s ease-out .2s both',
        }}>
          <div style={{
            width: 42, height: 42,
            background: '#fff',
            borderRadius: '50%',
            border: '2.5px solid #111827',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
            position: 'relative',
          }}>
            {headingToPickup && (
              <>
                <div style={{ position:'absolute', width:42, height:42, borderRadius:'50%', border:'2px solid rgba(17,24,39,.22)', top:'50%', left:'50%', animation:'tmRipple 2s ease-out infinite' }}/>
                <div style={{ position:'absolute', width:42, height:42, borderRadius:'50%', border:'2px solid rgba(17,24,39,.12)', top:'50%', left:'50%', animation:'tmRipple 2s ease-out .7s infinite' }}/>
              </>
            )}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#111827"/>
              <circle cx="12" cy="9" r="2.5" fill="#fff"/>
            </svg>
          </div>
          <div style={{
            position:'absolute', top:'110%', left:'50%', transform:'translateX(-50%)',
            background:'#111827', color:'#fff', fontSize:9, fontWeight:700,
            padding:'3px 8px', borderRadius:100, whiteSpace:'nowrap',
            letterSpacing:'.3px', boxShadow:'0 2px 8px rgba(0,0,0,.2)', marginTop:4,
          }}>
            Pickup
          </div>
        </div>
      )}

      {/* ── Dropoff pin ── */}
      {dropoffSvg && (
        <div style={{
          position: 'absolute',
          left: dropoffSvg.x, top: dropoffSvg.y,
          zIndex: 10,
          transform: 'translate(-50%, -50%)',
          animation: 'tmFadeUp .5s ease-out .4s both',
        }}>
          <div style={{
            width: 42, height: 42,
            background: '#16A34A',
            borderRadius: '50%',
            border: '3px solid #fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 18px rgba(22,163,74,0.45)',
            animation: headingToDropoff ? 'tmPulsePin 2s ease-in-out infinite' : 'none',
            position: 'relative',
          }}>
            {headingToDropoff && (
              <>
                <div style={{ position:'absolute', width:42, height:42, borderRadius:'50%', border:'2px solid rgba(22,163,74,.4)', top:'50%', left:'50%', animation:'tmRipple 2.2s ease-out infinite' }}/>
                <div style={{ position:'absolute', width:42, height:42, borderRadius:'50%', border:'2px solid rgba(22,163,74,.25)', top:'50%', left:'50%', animation:'tmRipple 2.2s ease-out .8s infinite' }}/>
              </>
            )}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#fff"/>
            </svg>
          </div>
          <div style={{
            position:'absolute', top:'110%', left:'50%', transform:'translateX(-50%)',
            background:'#16A34A', color:'#fff', fontSize:9, fontWeight:700,
            padding:'3px 8px', borderRadius:100, whiteSpace:'nowrap',
            letterSpacing:'.3px', boxShadow:'0 2px 8px rgba(22,163,74,.3)', marginTop:4,
          }}>
            Dropoff
          </div>
        </div>
      )}

      {/* ── Car icon (animated) ── */}
      <AnimatedCar
        carSvg={carSvg}
        driverColor={driverColor}
        isInProgress={isInProgress}
        gpsSource={gpsSource}
        isCompleted={isCompleted}
        svgPolyPts={svgPolyPts}
      />

      {/* ── Status bar ── */}
      {isTracking && (
        <div style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(0,0,0,0.07)',
          padding: '14px 16px 16px',
          zIndex: 20,
          boxShadow: '0 -6px 20px rgba(0,0,0,0.07)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: gpsLabel ? 8 : 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 8, height: 8,
                background: statusColor,
                borderRadius: '50%',
                flexShrink: 0,
                animation: isCompleted ? 'none' : 'tmLiveDot 1.5s ease-in-out infinite',
              }}/>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.2px' }}>
                {statusLabel}
              </span>
            </div>

            {!isCompleted && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>
                  {displayDist.toFixed(2)} mi
                </span>
                <div style={{
                  background: statusColor,
                  color: '#fff',
                  fontSize: 12, fontWeight: 800,
                  padding: '4px 12px',
                  borderRadius: 100,
                  letterSpacing: '0.2px',
                  boxShadow: `0 2px 8px ${statusColor}44`,
                }}>
                  {displayEta} min
                </div>
              </div>
            )}
          </div>

          {gpsLabel && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: gpsLabel.color, flexShrink: 0,
              }}/>
              <span style={{ fontSize: 11, color: gpsLabel.color, fontWeight: 700, letterSpacing: '.2px' }}>
                {gpsLabel.text}
              </span>
              <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>
                · live position
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

use the data from the [{…}]

1. 0: 
   1. acceptedAt: Timestamp {seconds: 1777153501, nanoseconds: 484000000}
   2. adminNotified: true
   3. candidateDriverUids: ['fR1aGa2AHod1aVuyaiEA95RqDYp1']
   4. candidateDrivers: [{…}]
   5. createdAt: Sat Apr 25 2026 17:41:05 GMT-0400 (Eastern Daylight Time) {}
   6. currentDriverIndex: 0
   7. driverDistanceMiles: 0
   8. driverEtaMin: 1
   9. driverInfo: {nearestMiles: 0.07, etaMin: 1, driverCount: 1, etaLabel: '1–3 min', stale: false}
   10. driverLat: 28.5729799
   11. driverLng: -81.4695497
   12. driverPayout: 3.74
   13. driverUid: "fR1aGa2AHod1aVuyaiEA95RqDYp1"
   14. dropoff: "3024 North Powers Drive, Orlando, FL, USA"
   15. dropoffCity: "Orlando"
   16. dropoffLat: 28.5819909
   17. dropoffLng: -81.4694363
   18. dropoffZip: "32818"
   19. emailDispatchAt: Timestamp {seconds: 1777153442, nanoseconds: 266000000}
   20. emailDispatchStarted: true
   21. emailSentToDrivers: {}
   22. expiresAt: Timestamp {seconds: 1777153325, nanoseconds: 886000000}
   23. fareBreakdown: {}
   24. fareTotal: 4.99
   25. id: "qseior2UgFNMImHECXMB"
   26. paymentIntentId: "pi_3TQDwjJhpOy6wtDq1wkAGuoJ"
   27. paymentMethod: "cashapp"
   28. paymentStatus: "succeeded"
   29. payoutStatus: "pending"
   30. pickup: "2382 Locke Avenue, Orlando, FL, USA"
   31. pickupCity: "Orlando"
   32. pickupLat: 28.5730545
   33. pickupLng: -81.4696329
   34. pickupZip: "32818"
   35. platformFee: 1.25
   36. polyline: "wtkmDp~fpNxACLI?a@GeF@s@{\\F_C?{@?qXHBjBFJIdEBTDNRT"
   37. pushDispatchAt: Timestamp {seconds: 1777153444, nanoseconds: 114000000}
   38. pushDispatchStarted: true
   39. pushSentToDrivers: {}
   40. receiptEmailSent: true
   41. requestSentAt: Timestamp {seconds: 1777153451, nanoseconds: 311000000}
   42. rideLabel: "Economy"
   43. rideType: "economy"
   44. riderDropoffDistanceMiles: 0.8
   45. riderDropoffEtaMin: 4
   46. riderLat: 28.572697500000004
   47. riderLng: -81.46776974999999
   48. riderLocationAt: Timestamp {seconds: 1777154707, nanoseconds: 569000000}
   49. status: "driver_assigned"
   50. timedOutAt: Timestamp {seconds: 1777153451, nanoseconds: 116000000}
   51. timeoutMinutes: 1
   52. tripDistanceMiles: 0.93
   53. tripDurationMin: 5
   54. tripProgress: 0.13978494623655913
   55. uid: "PU5NFVybcpe78cBgNxmGXmSDYV52"
   56. updatedAt: Sat Apr 25 2026 18:05:07 GMT-0400 (Eastern Daylight Time) {}
   57. [[Prototype]]: Object
2. length: 1
3. [[Prototype]]: Array(0) active to build the live tracking