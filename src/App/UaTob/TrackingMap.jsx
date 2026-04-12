// src/App/UaTob/TrackingMap.jsx
import React, { useMemo, useEffect, useRef, useCallback } from 'react';

// ── Helpers ────────────────────────────────────────────────────────────────
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

// Orlando bounding box — clamps to 8–92% so pins never hug the edge
const LAT_MIN = 28.40, LAT_MAX = 28.68;
const LNG_MIN = -81.58, LNG_MAX = -81.25;

function project(lat, lng, W, H) {
  if (!lat || !lng || !W || !H) return null;
  let x = ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * W;
  let y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * H;
  x = Math.max(W * 0.08, Math.min(W * 0.92, x));
  y = Math.max(H * 0.06, Math.min(H * 0.86, y));
  return { x, y };
}

// ── Keyframes injected once ─────────────────────────────────────────────────
const KEYFRAMES = `
  @keyframes tmRipple {
    0%   { transform: translate(-50%,-50%) scale(0.6); opacity: 0.7; }
    100% { transform: translate(-50%,-50%) scale(2.5); opacity: 0; }
  }
  @keyframes tmDriverBob {
    0%, 100% { transform: translate(-50%,-50%) scale(1); }
    50%       { transform: translate(-50%,-50%) scale(1.07); }
  }
  @keyframes tmLiveDot {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.4; }
  }
`;

let _stylesInjected = false;
function injectStyles() {
  if (_stylesInjected) return;
  const el = document.createElement('style');
  el.textContent = KEYFRAMES;
  document.head.appendChild(el);
  _stylesInjected = true;
}

// ── Sub-components (pure, no re-render cost) ────────────────────────────────

function PickupPin({ active }) {
  return (
    <div style={{
      position: 'absolute',
      width: 40, height: 40,
      background: '#fff',
      borderRadius: '50%',
      border: '2.5px solid #111827',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transform: 'translate(-50%, -50%)',
      boxShadow: '0 3px 10px rgba(0,0,0,0.18)',
      zIndex: 10,
    }}>
      {active && (
        <div style={{
          position: 'absolute', width: 40, height: 40, borderRadius: '50%',
          border: '2px solid rgba(17,24,39,0.25)',
          top: '50%', left: '50%',
          animation: 'tmRipple 2.1s ease-out infinite',
        }} />
      )}
      {/* Location pin icon */}
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
              fill="#111827" />
        <circle cx="12" cy="9" r="2.5" fill="#fff" />
      </svg>
    </div>
  );
}

function DropoffPin({ active }) {
  return (
    <div style={{
      position: 'absolute',
      width: 40, height: 40,
      background: '#16A34A',
      borderRadius: '50%',
      border: '3px solid #fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transform: 'translate(-50%, -50%)',
      boxShadow: '0 4px 14px rgba(22,163,74,0.4)',
      zIndex: 10,
    }}>
      {active && <>
        <div style={{
          position: 'absolute', width: 40, height: 40, borderRadius: '50%',
          border: '2px solid rgba(22,163,74,0.45)',
          top: '50%', left: '50%',
          animation: 'tmRipple 2.1s ease-out infinite',
        }} />
        <div style={{
          position: 'absolute', width: 40, height: 40, borderRadius: '50%',
          border: '2px solid rgba(22,163,74,0.3)',
          top: '50%', left: '50%',
          animation: 'tmRipple 2.1s ease-out 0.7s infinite',
        }} />
      </>}
      {/* Star / destination icon */}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              fill="#fff" />
      </svg>
    </div>
  );
}

function DriverPin({ color }) {
  return (
    <div style={{
      position: 'absolute',
      width: 48, height: 48,
      background: color,
      borderRadius: 16,
      border: '3px solid #fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transform: 'translate(-50%, -50%)',
      boxShadow: `0 4px 18px ${color}55, 0 0 0 6px ${color}18`,
      animation: 'tmDriverBob 2s ease-in-out infinite',
      zIndex: 15,
    }}>
      {/* Car icon */}
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="8" width="18" height="9" rx="2.5" fill="#fff" />
        <path d="M6 8 L7.5 4 L16.5 4 L18 8Z" fill="#4ADE80" />
        <rect x="6.5" y="4.5" width="3" height="2.5" rx="0.6" fill="#fff" opacity="0.9" />
        <rect x="10.5" y="4.5" width="3" height="2.5" rx="0.6" fill="#fff" opacity="0.9" />
        <circle cx="7.5" cy="17" r="2" fill={color === '#111827' ? '#1f2937' : color} />
        <circle cx="7.5" cy="17" r="0.9" fill="#4ADE80" />
        <circle cx="16.5" cy="17" r="2" fill={color === '#111827' ? '#1f2937' : color} />
        <circle cx="16.5" cy="17" r="0.9" fill="#4ADE80" />
        <rect x="19" y="9.5" width="2" height="1.4" rx="0.4" fill="#FCD34D" />
      </svg>
    </div>
  );
}

function MapTile({ W, H }) {
  if (!W || !H) return null;
  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: H, pointerEvents: 'none', zIndex: 1 }}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
    >
      {/* Major roads */}
      <line x1={0} y1={H * 0.38} x2={W} y2={H * 0.35} stroke="#D0D8E2" strokeWidth={20} strokeLinecap="round" />
      <line x1={0} y1={H * 0.65} x2={W} y2={H * 0.7}  stroke="#DAE2EA" strokeWidth={13} strokeLinecap="round" />
      <line x1={W * 0.27} y1={0} x2={W * 0.25} y2={H} stroke="#DAE2EA" strokeWidth={14} strokeLinecap="round" />
      <line x1={W * 0.64} y1={0} x2={W * 0.67} y2={H} stroke="#D0D8E2" strokeWidth={18} strokeLinecap="round" />
      <line x1={W * 0.44} y1={0} x2={W * 0.42} y2={H} stroke="#DDE5EC" strokeWidth={10} strokeLinecap="round" />
      {/* Road center dashes */}
      <line x1={0} y1={H * 0.38} x2={W} y2={H * 0.35} stroke="#fff" strokeWidth={1.5} strokeDasharray="20 12" opacity={0.8} />
      <line x1={W * 0.64} y1={0} x2={W * 0.67} y2={H} stroke="#fff" strokeWidth={1.5} strokeDasharray="20 12" opacity={0.6} />
      {/* City blocks */}
      <rect x={W * 0.07} y={H * 0.12} width={W * 0.08} height={H * 0.12} rx={3} fill="#C8D3DC" opacity={0.55} />
      <rect x={W * 0.18} y={H * 0.08} width={W * 0.06} height={H * 0.09} rx={3} fill="#C8D3DC" opacity={0.45} />
      <rect x={W * 0.72} y={H * 0.14} width={W * 0.07} height={H * 0.1}  rx={3} fill="#C8D3DC" opacity={0.5} />
      <rect x={W * 0.82} y={H * 0.22} width={W * 0.1}  height={H * 0.08} rx={3} fill="#C8D3DC" opacity={0.4} />
      <rect x={W * 0.35} y={H * 0.55} width={W * 0.07} height={H * 0.1}  rx={3} fill="#C8D3DC" opacity={0.45} />
      <rect x={W * 0.08} y={H * 0.55} width={W * 0.09} height={H * 0.07} rx={3} fill="#C8D3DC" opacity={0.4} />
    </svg>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
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
  const [dims, setDims] = React.useState({ W: 0, H: 0 });

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

  const payload = bookingPayload || {};
  const status  = rideStatus || payload.status || '';
  const driverColor = getDriverColor(payload.rideType);

  // Status flags
  const headingToPickup  = ['driver_assigned', 'driver_arriving'].includes(status);
  const headingToDropoff = ['arrived', 'in_progress'].includes(status);
  const isCompleted      = status === 'completed';

  // Map canvas height = total height minus status bar
  const STATUS_BAR_H = 100;
  const mapH = Math.max(0, dims.H - STATUS_BAR_H);

  // Project all coordinates once
  const pickup  = useMemo(() => project(payload.pickupLat,  payload.pickupLng,  dims.W, mapH), [payload.pickupLat,  payload.pickupLng,  dims.W, mapH]);
  const dropoff = useMemo(() => project(payload.dropoffLat, payload.dropoffLng, dims.W, mapH), [payload.dropoffLat, payload.dropoffLng, dims.W, mapH]);
  const driver  = useMemo(() => {
    if (driverPos) return driverPos;
    return project(payload.driverLat, payload.driverLng, dims.W, mapH);
  }, [driverPos, payload.driverLat, payload.driverLng, dims.W, mapH]);

  // Display values
  const displayDist = headingToPickup
    ? safeNum(driverDistanceMiles   ?? payload.driverDistanceMiles)
    : safeNum(dropoffDistanceMiles  ?? distanceMiles ?? payload.dropoffDistanceMiles ?? payload.tripDistanceMiles);

  const displayEta = safeNum(etaMin ?? (headingToPickup ? payload.driverEtaMin : payload.dropoffEtaMin));

  const statusLabel = isCompleted
    ? 'Ride completed'
    : headingToPickup
      ? 'Driver on the way'
      : headingToDropoff
        ? 'Heading to dropoff'
        : 'Locating driver…';

  // Bezier curve command between two points
  function bezier(p1, p2) {
    if (!p1 || !p2) return '';
    const cx = p1.x + (p2.x - p1.x) * 0.5;
    return `M ${p1.x} ${p1.y} C ${cx} ${p1.y}, ${cx} ${p2.y}, ${p2.x} ${p2.y}`;
  }

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        height: 340,
        borderRadius: 22,
        overflow: 'hidden',
        border: '1px solid rgba(0,0,0,0.09)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
        background: '#E8EDF2',
      }}
    >
      {/* ── Map tile ── */}
      <MapTile W={dims.W} H={mapH} />

      {/* ── SVG route overlay ── */}
      {dims.W > 0 && pickup && dropoff && (
        <svg
          style={{ position: 'absolute', inset: 0, width: '100%', height: mapH, pointerEvents: 'none', zIndex: 3 }}
          viewBox={`0 0 ${dims.W} ${mapH}`}
        >
          <defs>
            <marker id="arrDark" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto">
              <path d="M0,0 L0,7 L7,3.5z" fill={driverColor} opacity="0.85" />
            </marker>
          </defs>

          {/* Pickup → Dropoff: faint ghost path */}
          <path
            d={bezier(pickup, dropoff)}
            fill="none"
            stroke="#16A34A"
            strokeWidth={3}
            strokeDasharray="10 7"
            strokeLinecap="round"
            opacity={headingToDropoff || isCompleted ? 0.85 : 0.25}
          />

          {/* Active green route when in-progress */}
          {(headingToDropoff || isCompleted) && (
            <path
              d={bezier(pickup, dropoff)}
              fill="none"
              stroke="#16A34A"
              strokeWidth={5}
              strokeLinecap="round"
              opacity={0.9}
            />
          )}

          {/* Driver → current target */}
          {driver && !isCompleted && (
            <line
              x1={driver.x} y1={driver.y}
              x2={headingToDropoff ? dropoff.x : pickup.x}
              y2={headingToDropoff ? dropoff.y : pickup.y}
              stroke={driverColor}
              strokeWidth={3.5}
              strokeLinecap="round"
              opacity={0.8}
              markerEnd="url(#arrDark)"
            />
          )}

          {/* Soft halos behind pins */}
          <circle cx={pickup.x}  cy={pickup.y}  r={26} fill="#111827" opacity={0.06} />
          <circle cx={dropoff.x} cy={dropoff.y} r={26} fill="#16A34A" opacity={0.09} />
        </svg>
      )}

      {/* ── Pickup pin ── */}
      {pickup && (
        <div style={{ position: 'absolute', left: pickup.x, top: pickup.y, zIndex: 10 }}>
          <PickupPin active={headingToPickup} />
        </div>
      )}

      {/* ── Dropoff pin ── */}
      {dropoff && (
        <div style={{ position: 'absolute', left: dropoff.x, top: dropoff.y, zIndex: 10 }}>
          <DropoffPin active={headingToDropoff} />
        </div>
      )}

      {/* ── Driver pin ── */}
      {driver && (
        <div style={{
          position: 'absolute',
          left: driver.x,
          top: driver.y,
          zIndex: 15,
          transition: 'left 2.8s ease-out, top 2.8s ease-out',
        }}>
          <DriverPin color={driverColor} />
        </div>
      )}

      {/* ── Status bar ── */}
      {isTracking && (
        <div style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          borderTop: '1px solid rgba(0,0,0,0.08)',
          padding: '12px 16px 14px',
          zIndex: 20,
          boxShadow: '0 -4px 16px rgba(0,0,0,0.07)',
        }}>
          {/* Top row: status + eta */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 8, height: 8,
                background: isCompleted ? '#94A3B8' : '#16A34A',
                borderRadius: '50%',
                animation: isCompleted ? 'none' : 'tmLiveDot 1.5s ease-in-out infinite',
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.1px' }}>
                {statusLabel}
              </span>
            </div>
            {!isCompleted && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#64748B' }}>
                  {displayDist.toFixed(2)} mi
                </span>
                <span style={{
                  background: '#111827',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: 100,
                  letterSpacing: '0.2px',
                }}>
                  {displayEta} min
                </span>
              </div>
            )}
          </div>

          {/* Bottom row: pickup/dropoff labels */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{
              background: '#F1F5F9',
              borderRadius: 10,
              padding: '7px 11px',
            }}>
              <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 2, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                Pickup
              </div>
              <div style={{
                fontSize: 12, fontWeight: 600, color: '#0F172A',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {payload.pickup ? payload.pickup.split(',')[0] : '—'}
              </div>
            </div>
            <div style={{
              background: '#F0FDF4',
              borderRadius: 10,
              padding: '7px 11px',
            }}>
              <div style={{ fontSize: 10, color: '#86EFAC', marginBottom: 2, letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                Dropoff
              </div>
              <div style={{
                fontSize: 12, fontWeight: 600, color: '#14532D',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {payload.dropoff ? payload.dropoff.split(',')[0] : '—'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}