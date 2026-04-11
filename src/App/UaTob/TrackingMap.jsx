// src/App/UaTob/TrackingMap.jsx
import React, { useMemo } from 'react';
import { MapPin, Navigation, Car, Circle } from 'lucide-react';
import { DRIVERS } from '@/App/UaTob/locations.js';

// ── Helpers ────────────────────────────────────────────────
function safeCoord(coord, fallback = 50) {
  const n = Number(coord);
  return Number.isFinite(n) ? n : fallback;
}

function safeNum(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function getDriverColor(type) {
  switch (type) {
    case 'premium': return '#7C3AED';
    case 'xl':      return '#F59E0B';
    default:        return '#16A34A';
  }
}

// Deterministic but well-spread coords from address string
function addressToCoords(address, defaultX = 30, defaultY = 50) {
  if (!address) return { x: defaultX, y: defaultY };
  let h1 = 0, h2 = 0;
  for (let i = 0; i < address.length; i++) {
    h1 = ((h1 << 5) - h1 + address.charCodeAt(i)) | 0;
    h2 = ((h2 << 3) - h2 + address.charCodeAt(address.length - 1 - i)) | 0;
  }
  const x = 18 + (Math.abs(h1 % 1000) / 1000) * 64;
  const y = 22 + (Math.abs(h2 % 1000) / 1000) * 56;
  return { x: +x.toFixed(1), y: +y.toFixed(1) };
}

// ── Sub-components ─────────────────────────────────────────

function PinPickup({ active }) {
  return (
    <div style={{
      width: '40px',
      height: '40px',
      background: '#111827',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: '3px solid #fff',
      boxShadow: active
        ? '0 0 0 6px rgba(17,24,39,.12), 0 8px 20px rgba(0,0,0,.22)'
        : '0 4px 12px rgba(0,0,0,.18)',
      position: 'relative',
    }}>
      {active && (
        <div style={{
          position: 'absolute',
          inset: '-10px',
          borderRadius: '50%',
          border: '2px solid rgba(17,24,39,.18)',
          animation: 'mapRipple 2s ease-out infinite',
        }} />
      )}
      <MapPin size={16} color="#16A34A" />
    </div>
  );
}

function PinDropoff({ active }) {
  return (
    <div style={{
      width: '38px',
      height: '38px',
      background: '#16A34A',
      borderRadius: '50% 50% 50% 6px',
      transform: 'rotate(-45deg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: '3px solid #fff',
      boxShadow: active
        ? '0 0 0 6px rgba(22,163,74,.16), 0 8px 20px rgba(22,163,74,.32)'
        : '0 4px 12px rgba(22,163,74,.22)',
      position: 'relative',
    }}>
      {active && (
        <div style={{
          position: 'absolute',
          inset: '-10px',
          borderRadius: '50%',
          border: '2px solid rgba(22,163,74,.22)',
          animation: 'mapRipple 2s ease-out infinite',
          transform: 'rotate(45deg)',
        }} />
      )}
      <Navigation size={13} color="#fff" style={{ transform: 'rotate(45deg)' }} />
    </div>
  );
}

function DriverPin({ color }) {
  return (
    <div style={{
      width: '46px',
      height: '46px',
      background: color,
      borderRadius: '16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: '3px solid #fff',
      boxShadow: `0 0 0 5px ${color}22, 0 10px 24px ${color}40`,
      animation: 'driverPulse 2.2s ease-in-out infinite',
      position: 'relative',
      zIndex: 5,
    }}>
      <Car size={20} color="#fff" />
    </div>
  );
}

// ── SVG route line between two percentage points ───────────
function RouteLine({ x1, y1, x2, y2, color, active, dashed = true }) {
  return (
    <line
      x1={`${x1}%`} y1={`${y1}%`}
      x2={`${x2}%`} y2={`${y2}%`}
      stroke={color}
      strokeWidth={active ? 4 : 2.5}
      strokeDasharray={dashed ? '10 7' : undefined}
      strokeLinecap="round"
      opacity={active ? 0.9 : 0.35}
    />
  );
}

// ── Map tile background (clean, no clutter) ────────────────
function MapTile() {
  return (
    <>
      {/* Base surface */}
      <div style={{
        position: 'absolute', inset: 0,
        background: '#F8F9FA',
      }} />

      {/* Subtle block pattern for urban feel */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.06 }}>
        <defs>
          <pattern id="blocks" width="60" height="60" patternUnits="userSpaceOnUse">
            <rect x="4"  y="4"  width="24" height="24" fill="#111827" rx="2" />
            <rect x="32" y="4"  width="24" height="24" fill="#111827" rx="2" />
            <rect x="4"  y="32" width="24" height="24" fill="#111827" rx="2" />
            <rect x="32" y="32" width="24" height="24" fill="#111827" rx="2" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#blocks)" />
      </svg>

      {/* Road network — horizontal arteries */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.22, pointerEvents: 'none' }}>
        {/* Main roads */}
        <line x1="0" y1="35%" x2="100%" y2="32%" stroke="#D1D5DB" strokeWidth="14" strokeLinecap="round" />
        <line x1="0" y1="68%" x2="100%" y2="72%" stroke="#E5E7EB" strokeWidth="10" strokeLinecap="round" />
        {/* Cross streets */}
        <line x1="28%" y1="0" x2="26%" y2="100%" stroke="#E5E7EB" strokeWidth="10" strokeLinecap="round" />
        <line x1="62%" y1="0" x2="65%" y2="100%" stroke="#D1D5DB" strokeWidth="14" strokeLinecap="round" />
        {/* Minor roads */}
        <line x1="0"   y1="52%" x2="100%" y2="49%" stroke="#F3F4F6" strokeWidth="6" strokeLinecap="round" />
        <line x1="44%" y1="0"   x2="46%" y2="100%" stroke="#F3F4F6" strokeWidth="6" strokeLinecap="round" />
      </svg>

      {/* Road center-line markers */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.12, pointerEvents: 'none' }}>
        <line x1="0" y1="35%" x2="100%" y2="32%" stroke="#fff" strokeWidth="2" strokeDasharray="16 12" strokeLinecap="round" />
        <line x1="28%" y1="0" x2="26%" y2="100%" stroke="#fff" strokeWidth="2" strokeDasharray="16 12" strokeLinecap="round" />
        <line x1="62%" y1="0" x2="65%" y2="100%" stroke="#fff" strokeWidth="2" strokeDasharray="16 12" strokeLinecap="round" />
      </svg>

      {/* Vignette edges */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,.06) 100%)',
      }} />
    </>
  );
}

// ── Main component ─────────────────────────────────────────
export default function TrackingMap({
  bookingPayload,
  rideStatus,
  assignedDriver,
  driverPos,
  isTracking,
  etaMinutes,
  distToDropoff,
}) {
  const miles       = safeNum(bookingPayload?.miles ?? bookingPayload?.tripDistanceMiles, 0);
  const durationMin = safeNum(bookingPayload?.durationMin ?? bookingPayload?.tripDurationMin, 0);

  const safeDrivers = Array.isArray(DRIVERS) ? DRIVERS : [];
  const driverType  = assignedDriver?.type || bookingPayload?.rideType || 'standard';
  const driverColor = getDriverColor(driverType);

  const pickupCoords  = useMemo(() => addressToCoords(bookingPayload?.pickup,  24, 44), [bookingPayload?.pickup]);
  const dropoffCoords = useMemo(() => addressToCoords(bookingPayload?.dropoff, 72, 56), [bookingPayload?.dropoff]);

  const headingToPickup  = ['driver_assigned', 'driver_arriving'].includes(rideStatus);
  const headingToDropoff = ['arrived', 'in_progress'].includes(rideStatus);
  const isCompleted      = rideStatus === 'completed';

  // Where the driver line should point
  const driverTarget = headingToDropoff ? dropoffCoords : pickupCoords;

  const mapHeight = isTracking ? '300px' : 'clamp(200px,32vh,260px)';

  return (
    <div style={{
      position: 'relative',
      height: mapHeight,
      borderRadius: '20px',
      overflow: 'hidden',
      border: '1px solid rgba(0,0,0,.08)',
    }}>
      <style>{`
        @keyframes mapRipple {
          0%   { transform: scale(.8); opacity: .7; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes driverPulse {
          0%,100% { transform: scale(1); }
          50%      { transform: scale(1.07); }
        }
      `}</style>

      {/* Map background */}
      <MapTile />

      {/* ── SVG overlay: route lines ── */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }}>

        {/* Leg 2: pickup → dropoff (always shown, dims when driver not yet there) */}
        {bookingPayload?.pickup && bookingPayload?.dropoff && (
          <RouteLine
            x1={safeCoord(pickupCoords.x)}  y1={safeCoord(pickupCoords.y)}
            x2={safeCoord(dropoffCoords.x)} y2={safeCoord(dropoffCoords.y)}
            color="#16A34A"
            active={headingToDropoff || isCompleted}
            dashed={true}
          />
        )}

        {/* Leg 1: driver → pickup (only while heading to pickup) */}
        {isTracking && driverPos && headingToPickup && (
          <RouteLine
            x1={safeCoord(driverPos.x)} y1={safeCoord(driverPos.y)}
            x2={safeCoord(pickupCoords.x)} y2={safeCoord(pickupCoords.y)}
            color={driverColor}
            active={true}
            dashed={true}
          />
        )}

        {/* Leg 1 while heading to dropoff: driver → dropoff */}
        {isTracking && driverPos && headingToDropoff && (
          <RouteLine
            x1={safeCoord(driverPos.x)}  y1={safeCoord(driverPos.y)}
            x2={safeCoord(dropoffCoords.x)} y2={safeCoord(dropoffCoords.y)}
            color={driverColor}
            active={true}
            dashed={true}
          />
        )}
      </svg>

      {/* ── Pins ── */}

      {/* Pickup pin */}
      {bookingPayload?.pickup && (
        <div style={{
          position: 'absolute',
          left: `${safeCoord(pickupCoords.x)}%`,
          top:  `${safeCoord(pickupCoords.y)}%`,
          transform: 'translate(-50%,-50%)',
          zIndex: 3,
        }}>
          <PinPickup active={headingToPickup} />
        </div>
      )}

      {/* Dropoff pin */}
      {bookingPayload?.dropoff && (
        <div style={{
          position: 'absolute',
          left: `${safeCoord(dropoffCoords.x)}%`,
          top:  `${safeCoord(dropoffCoords.y)}%`,
          transform: 'translate(-50%,-50%)',
          zIndex: 3,
        }}>
          <PinDropoff active={headingToDropoff} />
        </div>
      )}

      {/* Driver pin (tracking only) */}
      {isTracking && driverPos && (
        <div style={{
          position: 'absolute',
          left: `${safeCoord(driverPos.x)}%`,
          top:  `${safeCoord(driverPos.y)}%`,
          transform: 'translate(-50%,-50%)',
          transition: 'left 5s linear, top 5s linear',
          zIndex: 5,
        }}>
          <DriverPin color={driverColor} />
        </div>
      )}

      {/* Idle nearby drivers (pre-booking) */}
      {!isTracking && safeDrivers.map((d, i) => (
        <div
          key={d.id ?? i}
          style={{
            position: 'absolute',
            left: `${safeCoord(d.x)}%`,
            top:  `${safeCoord(d.y)}%`,
            transform: 'translate(-50%,-50%)',
            animation: `driverPulse 2.4s ease-in-out infinite`,
            animationDelay: `${i * 0.3}s`,
            zIndex: 2,
          }}
        >
          <div style={{
            width: '22px', height: '22px',
            background: getDriverColor(d.type),
            borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #fff',
            boxShadow: `0 4px 10px ${getDriverColor(d.type)}40`,
          }}>
            <Car size={11} color="#fff" />
          </div>
        </div>
      ))}

      {/* ── Bottom status bar ── */}
      {isTracking && (
        <div style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          background: 'rgba(255,255,255,.96)',
          borderTop: '1px solid rgba(0,0,0,.07)',
          padding: '11px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 6,
        }}>
          {/* Left: live indicator + status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '8px', height: '8px',
              background: isCompleted ? '#9CA3AF' : driverColor,
              borderRadius: '50%',
              animation: isCompleted ? 'none' : 'driverPulse 1.6s ease-in-out infinite',
              flexShrink: 0,
            }} />
            <span style={{
              fontSize: '13px',
              fontWeight: 700,
              color: '#111827',
            }}>
              {isCompleted
                ? 'Ride complete'
                : headingToPickup
                ? `${assignedDriver?.firstName ?? 'Driver'} is on the way`
                : headingToDropoff
                ? 'Heading to dropoff'
                : 'Driver arrived'}
            </span>
          </div>

          {/* Right: ETA or distance badge */}
          {!isCompleted && (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {headingToPickup && safeNum(etaMinutes) > 0 && (
                <span style={{
                  background: driverColor,
                  color: '#fff',
                  borderRadius: '8px',
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: 800,
                  fontFamily: '"JetBrains Mono", monospace',
                  letterSpacing: '0.3px',
                }}>
                  {safeNum(etaMinutes)} min
                </span>
              )}
              {headingToDropoff && distToDropoff != null && (
                <span style={{
                  background: '#16A34A',
                  color: '#fff',
                  borderRadius: '8px',
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: 800,
                  fontFamily: '"JetBrains Mono", monospace',
                  letterSpacing: '0.3px',
                }}>
                  {safeNum(distToDropoff).toFixed(1)} mi
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Top trip summary (pre-booking only) ── */}
      {!isTracking && bookingPayload?.pickup && bookingPayload?.dropoff && (
        <div style={{
          position: 'absolute',
          top: '12px', left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(255,255,255,.94)',
          border: '1px solid rgba(0,0,0,.08)',
          borderRadius: '12px',
          padding: '9px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          whiteSpace: 'nowrap',
          zIndex: 6,
          fontSize: '12px',
          fontWeight: 700,
          color: '#111827',
          maxWidth: '90%',
          overflow: 'hidden',
        }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>
            {miles.toFixed(1)} mi
          </span>
          <div style={{ width: '1px', height: '14px', background: '#E5E7EB' }} />
          <span>{durationMin} min</span>
        </div>
      )}
    </div>
  );
}