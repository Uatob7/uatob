// src/App/UaTob/TrackingMap.jsx
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

// Project a single lat/lng using the same bounds as the polyline points
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

// ── Find closest point on polyline to driver ──────────────────────────
function closestPointOnPolyline(svgPts, px, py) {
  if (!svgPts.length) return { x: px, y: py };
  let best = svgPts[0], bestDist = Infinity;
  for (const pt of svgPts) {
    const d = Math.hypot(pt.x - px, pt.y - py);
    if (d < bestDist) { bestDist = d; best = pt; }
  }
  return best;
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
      {/* Road layer */}
      <line x1={0}        y1={H * 0.37} x2={W}        y2={H * 0.34} stroke="#D4DBD7" strokeWidth={18} strokeLinecap="round"/>
      <line x1={0}        y1={H * 0.64} x2={W}        y2={H * 0.69} stroke="#DAE2DE" strokeWidth={12} strokeLinecap="round"/>
      <line x1={W * 0.26} y1={0}        x2={W * 0.24} y2={H}        stroke="#DAE2DE" strokeWidth={13} strokeLinecap="round"/>
      <line x1={W * 0.63} y1={0}        x2={W * 0.66} y2={H}        stroke="#D4DBD7" strokeWidth={17} strokeLinecap="round"/>
      <line x1={W * 0.43} y1={0}        x2={W * 0.41} y2={H}        stroke="#DDE5E2" strokeWidth={9}  strokeLinecap="round"/>
      {/* Road center lines */}
      <line x1={0} y1={H * 0.37} x2={W} y2={H * 0.34} stroke="#fff" strokeWidth={1.5} strokeDasharray="18 10" opacity={0.7}/>
      <line x1={W * 0.63} y1={0} x2={W * 0.66} y2={H} stroke="#fff" strokeWidth={1.5} strokeDasharray="18 10" opacity={0.6}/>
      {/* City blocks */}
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

// ── Main component ────────────────────────────────────────────────────
export default function TrackingMap({
  bookingPayload,
  rideStatus,
  driverPos,
  isTracking = true,
  driverDistanceMiles,
  dropoffDistanceMiles,
  distanceMiles,
  etaMin,
}) {
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

  // Status flags
  const headingToPickup  = ['driver_assigned', 'driver_arriving'].includes(status);
  const headingToDropoff = ['arrived', 'in_progress'].includes(status);
  const isCompleted      = status === 'completed';
  const isArrived        = status === 'arrived';

  // ── Decode polyline ───────────────────────────────────────────────
  // Use trip polyline (pickup→dropoff) or driver polyline (driver→pickup)
  const rawPolyline = payload.polyline ?? null;

  const decodedPts = useMemo(() => decodePolyline(rawPolyline), [rawPolyline]);

  // ── SVG projected points ──────────────────────────────────────────
  // We project the full set of relevant points together so the scale is consistent.
  // Include driver lat/lng so it's within the bounding box.
  const allGeoPoints = useMemo(() => {
    const pts = [...decodedPts];
    if (payload.driverLat && payload.driverLng)
      pts.push([safeNum(payload.driverLat), safeNum(payload.driverLng)]);
    if (payload.pickupLat && payload.pickupLng)
      pts.push([safeNum(payload.pickupLat), safeNum(payload.pickupLng)]);
    if (payload.dropoffLat && payload.dropoffLng)
      pts.push([safeNum(payload.dropoffLat), safeNum(payload.dropoffLng)]);
    return pts;
  }, [decodedPts, payload.driverLat, payload.driverLng, payload.pickupLat, payload.pickupLng, payload.dropoffLat, payload.dropoffLng]);

  // Project polyline path
  const svgPolyPts = useMemo(
    () => projectPoints(decodedPts, dims.W, mapH),
    [decodedPts, dims.W, mapH]
  );

  // Project individual pins using the same unified bounding box
  const pickupSvg  = useMemo(
    () => projectSingle(safeNum(payload.pickupLat),  safeNum(payload.pickupLng),  allGeoPoints, dims.W, mapH),
    [payload.pickupLat, payload.pickupLng, allGeoPoints, dims.W, mapH]
  );
  const dropoffSvg = useMemo(
    () => projectSingle(safeNum(payload.dropoffLat), safeNum(payload.dropoffLng), allGeoPoints, dims.W, mapH),
    [payload.dropoffLat, payload.dropoffLng, allGeoPoints, dims.W, mapH]
  );

  // Driver position: use driverPos (already projected) if provided,
  // otherwise project from lat/lng and snap to polyline
  const driverSvgRaw = useMemo(() => {
    if (driverPos) return driverPos;
    if (!payload.driverLat || !payload.driverLng) return null;
    return projectSingle(safeNum(payload.driverLat), safeNum(payload.driverLng), allGeoPoints, dims.W, mapH);
  }, [driverPos, payload.driverLat, payload.driverLng, allGeoPoints, dims.W, mapH]);

  // Snap driver to closest polyline point for cleaner positioning
  const driverSvg = useMemo(() => {
    if (!driverSvgRaw || !svgPolyPts.length) return driverSvgRaw;
    return closestPointOnPolyline(svgPolyPts, driverSvgRaw.x, driverSvgRaw.y);
  }, [driverSvgRaw, svgPolyPts]);

  const polylinePath = toSVGPath(svgPolyPts);
  const routeLen     = svgPolyPts.length > 1 ? approxPathLen(svgPolyPts) : 1200;

  // Display values
  const displayDist = headingToPickup
    ? safeNum(driverDistanceMiles ?? payload.driverDistanceMiles)
    : safeNum(dropoffDistanceMiles ?? distanceMiles ?? payload.dropoffDistanceMiles ?? payload.tripDistanceMiles);

  const displayEta = safeNum(etaMin ?? (headingToPickup ? payload.driverEtaMin : payload.dropoffEtaMin));

  const statusLabel = isCompleted
    ? 'Ride complete'
    : isArrived
      ? 'Driver has arrived'
      : headingToPickup
        ? 'Driver on the way'
        : headingToDropoff
          ? 'Heading to dropoff'
          : 'Locating driver…';

  const statusColor = isCompleted
    ? '#64748B'
    : isArrived
      ? '#F59E0B'
      : '#16A34A';

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
            {/* Clip mask: travelled portion (driver → end) */}
            {driverSvg && (
              <clipPath id="tm-travelled">
                <rect x={driverSvg.x} y={0} width={dims.W} height={mapH}/>
              </clipPath>
            )}
          </defs>

          {/* White halo behind route */}
          <path
            d={polylinePath}
            fill="none"
            stroke="#fff"
            strokeWidth={9}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.7}
          />

          {/* Faded "remaining" route */}
          <path
            d={polylinePath}
            fill="none"
            stroke={headingToDropoff ? '#BBF7D0' : '#BFDBFE'}
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.9}
          />

          {/* Active animated route — draw-on effect */}
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

          {/* Flowing dash overlay */}
          <path
            d={polylinePath}
            fill="none"
            stroke="rgba(255,255,255,.55)"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeDasharray="7 18"
            style={{ animation: 'tmDashFlow 1.4s linear infinite' }}
          />

          {/* Pin halos */}
          {pickupSvg  && <circle cx={pickupSvg.x}  cy={pickupSvg.y}  r={28} fill="#111827" opacity={0.07}/>}
          {dropoffSvg && <circle cx={dropoffSvg.x} cy={dropoffSvg.y} r={28} fill="#16A34A" opacity={0.10}/>}
        </svg>
      )}

      {/* ── Pickup pin ── */}
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
                <div style={{
                  position: 'absolute', width: 42, height: 42, borderRadius: '50%',
                  border: '2px solid rgba(17,24,39,.22)',
                  top: '50%', left: '50%',
                  animation: 'tmRipple 2s ease-out infinite',
                }}/>
                <div style={{
                  position: 'absolute', width: 42, height: 42, borderRadius: '50%',
                  border: '2px solid rgba(17,24,39,.12)',
                  top: '50%', left: '50%',
                  animation: 'tmRipple 2s ease-out .7s infinite',
                }}/>
              </>
            )}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#111827"/>
              <circle cx="12" cy="9" r="2.5" fill="#fff"/>
            </svg>
          </div>
          {/* Pickup label */}
          <div style={{
            position: 'absolute', top: '110%', left: '50%',
            transform: 'translateX(-50%)',
            background: '#111827', color: '#fff',
            fontSize: 9, fontWeight: 700,
            padding: '3px 8px', borderRadius: 100,
            whiteSpace: 'nowrap', letterSpacing: '.3px',
            boxShadow: '0 2px 8px rgba(0,0,0,.2)',
            marginTop: 4,
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
                <div style={{
                  position: 'absolute', width: 42, height: 42, borderRadius: '50%',
                  border: '2px solid rgba(22,163,74,.4)',
                  top: '50%', left: '50%',
                  animation: 'tmRipple 2.2s ease-out infinite',
                }}/>
                <div style={{
                  position: 'absolute', width: 42, height: 42, borderRadius: '50%',
                  border: '2px solid rgba(22,163,74,.25)',
                  top: '50%', left: '50%',
                  animation: 'tmRipple 2.2s ease-out .8s infinite',
                }}/>
              </>
            )}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="#fff"/>
            </svg>
          </div>
          <div style={{
            position: 'absolute', top: '110%', left: '50%',
            transform: 'translateX(-50%)',
            background: '#16A34A', color: '#fff',
            fontSize: 9, fontWeight: 700,
            padding: '3px 8px', borderRadius: 100,
            whiteSpace: 'nowrap', letterSpacing: '.3px',
            boxShadow: '0 2px 8px rgba(22,163,74,.3)',
            marginTop: 4,
          }}>
            Dropoff
          </div>
        </div>
      )}

      {/* ── Driver pin ── */}
      {driverSvg && !isCompleted && (
        <div style={{
          position: 'absolute',
          left: driverSvg.x,
          top:  driverSvg.y,
          zIndex: 20,
          transition: 'left 2.5s cubic-bezier(.4,0,.2,1), top 2.5s cubic-bezier(.4,0,.2,1)',
          animation: 'tmFadeUp .4s ease-out both',
        }}>
          <div style={{
            width: 50, height: 50,
            background: driverColor,
            borderRadius: 18,
            border: '3px solid #fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transform: 'translate(-50%, -50%)',
            boxShadow: `0 6px 22px ${driverColor}60, 0 0 0 6px ${driverColor}18`,
            animation: 'tmDriverBob 2.2s ease-in-out infinite',
          }}>
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
      )}

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

          {/* Top row */}
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 8, height: 8,
                background: statusColor,
                borderRadius: '50%',
                flexShrink: 0,
                animation: isCompleted ? 'none' : 'tmLiveDot 1.5s ease-in-out infinite',
              }}/>
              <span style={{
                fontSize: 14, fontWeight: 800, color: '#0F172A',
                letterSpacing: '-0.2px',
              }}>
                {statusLabel}
              </span>
            </div>

            {!isCompleted && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontSize: 11, color: '#94A3B8', fontWeight: 600,
                }}>
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

          {/* Address row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{
              background: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: 12,
              padding: '8px 12px',
            }}>
              <div style={{
                fontSize: 9, color: '#94A3B8', fontWeight: 800,
                letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 3,
              }}>
                Pickup
              </div>
              <div style={{
                fontSize: 12, fontWeight: 700, color: '#0F172A',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {payload.pickup?.split(',')[0] ?? '—'}
              </div>
            </div>

            <div style={{
              background: '#F0FDF4',
              border: '1px solid #BBF7D0',
              borderRadius: 12,
              padding: '8px 12px',
            }}>
              <div style={{
                fontSize: 9, color: '#86EFAC', fontWeight: 800,
                letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 3,
              }}>
                Dropoff
              </div>
              <div style={{
                fontSize: 12, fontWeight: 700, color: '#14532D',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {payload.dropoff?.split(',')[0] ?? '—'}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}