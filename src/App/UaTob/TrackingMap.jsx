// src/App/UaTob/TrackingMap.jsx
import React, { useMemo } from 'react';
import { MapPin, Navigation, Car } from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────
function safeNum(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function getDriverColor(type = 'standard') {
  switch (type?.toLowerCase()) {
    case 'premium': return '#7C3AED';
    case 'xl':      return '#F59E0B';
    default:        return '#16A34A';
  }
}

// ── Real lat/lng → map percentage (tuned for Orlando area) ──
function latLngToMapPercent(lat, lng) {
  if (!lat || !lng) return null;

  // Orlando bounding box approximation
  const latMin = 28.40;
  const latMax = 28.68;
  const lngMin = -81.58;
  const lngMax = -81.25;

  let x = ((lng - lngMin) / (lngMax - lngMin)) * 100;
  let y = ((latMax - lat) / (latMax - latMin)) * 100; // Y inverted (north = top)

  x = Math.max(8, Math.min(92, x));
  y = Math.max(8, Math.min(92, y));

  return { x: +x.toFixed(2), y: +y.toFixed(2) };
}

// ── Sub Components ─────────────────────────────────────────
function PinPickup({ active }) {
  return (
    <div style={{
      width: '42px', height: '42px', background: '#111827', borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: '3.5px solid #fff',
      boxShadow: active
        ? '0 0 0 7px rgba(17,24,39,.15), 0 10px 24px rgba(0,0,0,.25)'
        : '0 6px 16px rgba(0,0,0,.2)',
      position: 'relative',
      zIndex: 4,
    }}>
      {active && (
        <div style={{
          position: 'absolute', inset: '-12px', borderRadius: '50%',
          border: '2.5px solid rgba(17,24,39,.2)', animation: 'mapRipple 2.2s ease-out infinite',
        }} />
      )}
      <MapPin size={18} color="#16A34A" strokeWidth={2.5} />
    </div>
  );
}

function PinDropoff({ active }) {
  return (
    <div style={{
      width: '40px', height: '40px', background: '#16A34A', borderRadius: '50% 50% 50% 8px',
      transform: 'rotate(-45deg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: '3.5px solid #fff',
      boxShadow: active
        ? '0 0 0 7px rgba(22,163,74,.18), 0 10px 26px rgba(22,163,74,.35)'
        : '0 6px 16px rgba(22,163,74,.25)',
      position: 'relative',
      zIndex: 4,
    }}>
      {active && (
        <div style={{
          position: 'absolute', inset: '-12px', borderRadius: '50%',
          border: '2.5px solid rgba(22,163,74,.25)', animation: 'mapRipple 2.2s ease-out infinite',
          transform: 'rotate(45deg)',
        }} />
      )}
      <Navigation size={15} color="#fff" style={{ transform: 'rotate(45deg)' }} strokeWidth={2.8} />
    </div>
  );
}

function DriverPin({ color }) {
  return (
    <div style={{
      width: '48px', height: '48px', background: color, borderRadius: '18px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: '3.5px solid #fff',
      boxShadow: `0 0 0 6px ${color}25, 0 12px 28px ${color}45`,
      animation: 'driverPulse 2.1s ease-in-out infinite',
      position: 'relative',
      zIndex: 15,
    }}>
      <Car size={22} color="#fff" strokeWidth={2.5} />
    </div>
  );
}

function RouteLine({ x1, y1, x2, y2, color, active = false, dashed = false }) {
  return (
    <line
      x1={`${x1}%`} y1={`${y1}%`}
      x2={`${x2}%`} y2={`${y2}%`}
      stroke={color}
      strokeWidth={active ? 5.5 : 3}
      strokeDasharray={dashed ? '9 6' : undefined}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={active ? 0.95 : 0.45}
    />
  );
}

function MapTile() {
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: '#F1F3F5' }} />

      {/* Subtle urban blocks */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.07 }}>
        <defs>
          <pattern id="blocks" width="58" height="58" patternUnits="userSpaceOnUse">
            <rect x="6" y="6" width="22" height="22" fill="#1F2937" rx="1.5" />
            <rect x="34" y="6" width="22" height="22" fill="#1F2937" rx="1.5" />
            <rect x="6" y="34" width="22" height="22" fill="#1F2937" rx="1.5" />
            <rect x="34" y="34" width="22" height="22" fill="#1F2937" rx="1.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#blocks)" />
      </svg>

      {/* Road network */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.25, pointerEvents: 'none' }}>
        <line x1="0%" y1="34%" x2="100%" y2="31%" stroke="#CBD5E1" strokeWidth="16" strokeLinecap="round" />
        <line x1="0%" y1="67%" x2="100%" y2="71%" stroke="#E2E8F0" strokeWidth="11" strokeLinecap="round" />
        <line x1="27%" y1="0%" x2="25%" y2="100%" stroke="#E2E8F0" strokeWidth="12" strokeLinecap="round" />
        <line x1="64%" y1="0%" x2="67%" y2="100%" stroke="#CBD5E1" strokeWidth="15" strokeLinecap="round" />
      </svg>

      {/* Road center lines */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.15, pointerEvents: 'none' }}>
        <line x1="0%" y1="34%" x2="100%" y2="31%" stroke="#fff" strokeWidth="2.5" strokeDasharray="18 10" />
      </svg>
    </>
  );
}

// ── Main TrackingMap Component ─────────────────────────────────
export default function TrackingMap({
  bookingPayload,
  rideStatus,
  driverPos,               // pre-projected position from LiveTrackingPanel (preferred)
  isTracking = true,
  driverDistanceMiles,     // explicit prop for heading to pickup
  dropoffDistanceMiles,    // explicit prop for heading to dropoff
  distanceMiles,           // legacy fallback
  etaMin,
}) {
  const payload = bookingPayload || {};
  const status = rideStatus || payload.status || '';

  const rideType = payload.rideType || 'standard';
  const driverColor = getDriverColor(rideType);

  // Real coordinates from payload
  const pickupLat = payload.pickupLat;
  const pickupLng = payload.pickupLng;
  const dropoffLat = payload.dropoffLat;
  const dropoffLng = payload.dropoffLng;
  const driverLat = payload.driverLat;
  const driverLng = payload.driverLng;

  // Convert to map percentages
  const pickupCoords = useMemo(() => 
    latLngToMapPercent(pickupLat, pickupLng) || { x: 26, y: 38 }, 
    [pickupLat, pickupLng]
  );

  const dropoffCoords = useMemo(() => 
    latLngToMapPercent(dropoffLat, dropoffLng) || { x: 71, y: 59 }, 
    [dropoffLat, dropoffLng]
  );

  // Driver position (prefer passed driverPos, fallback to real lat/lng)
  const driverRealPos = useMemo(() => {
    if (driverPos) return driverPos;
    if (driverLat && driverLng) return latLngToMapPercent(driverLat, driverLng);
    return null;
  }, [driverPos, driverLat, driverLng]);

  // Status flags
  const isCompleted = status === 'completed';
  const headingToPickup = ['driver_assigned', 'driver_arriving'].includes(status);
  const headingToDropoff = ['arrived', 'in_progress'].includes(status);

  // Distance to display
  const displayDistance = headingToPickup
    ? safeNum(driverDistanceMiles ?? payload.driverDistanceMiles)
    : safeNum(dropoffDistanceMiles ?? distanceMiles ?? payload.dropoffDistanceMiles ?? payload.tripDistanceMiles);

  return (
    <div style={{
      position: 'relative',
      height: '310px',
      borderRadius: '22px',
      overflow: 'hidden',
      border: '1px solid rgba(0,0,0,.09)',
      boxShadow: '0 10px 30px rgba(0,0,0,.08)',
    }}>
      <style>{`
        @keyframes mapRipple {
          0%   { transform: scale(0.75); opacity: 0.75; }
          100% { transform: scale(1.95); opacity: 0; }
        }
        @keyframes driverPulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.08); }
        }
      `}</style>

      <MapTile />

      {/* SVG Route Lines - using real data */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }}>
        {/* Main route: Pickup → Dropoff */}
        <RouteLine
          x1={pickupCoords.x} y1={pickupCoords.y}
          x2={dropoffCoords.x} y2={dropoffCoords.y}
          color="#16A34A"
          active={headingToDropoff || isCompleted}
          dashed={!headingToDropoff}
        />

        {/* Live driver route to current target */}
        {driverRealPos && (
          <RouteLine
            x1={driverRealPos.x} y1={driverRealPos.y}
            x2={headingToDropoff ? dropoffCoords.x : pickupCoords.x}
            y2={headingToDropoff ? dropoffCoords.y : pickupCoords.y}
            color={driverColor}
            active={true}
            dashed={false}
          />
        )}
      </svg>

      {/* Pickup Pin */}
      <div style={{
        position: 'absolute',
        left: `${pickupCoords.x}%`,
        top: `${pickupCoords.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: 5,
      }}>
        <PinPickup active={headingToPickup} />
      </div>

      {/* Dropoff Pin */}
      <div style={{
        position: 'absolute',
        left: `${dropoffCoords.x}%`,
        top: `${dropoffCoords.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: 5,
      }}>
        <PinDropoff active={headingToDropoff} />
      </div>

      {/* Live Driver Pin */}
      {driverRealPos && (
        <div style={{
          position: 'absolute',
          left: `${driverRealPos.x}%`,
          top: `${driverRealPos.y}%`,
          transform: 'translate(-50%, -50%)',
          transition: 'left 2.8s ease-out, top 2.8s ease-out',
          zIndex: 15,
        }}>
          <DriverPin color={driverColor} />
        </div>
      )}

      {/* Bottom Status Bar - Fixed distance logic */}
      {isTracking && (
        <div style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          background: 'rgba(255,255,255,0.97)',
          borderTop: '1px solid rgba(0,0,0,.08)',
          padding: '13px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 20,
          boxShadow: '0 -4px 12px rgba(0,0,0,.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <div style={{
              width: '9px', height: '9px',
              background: isCompleted ? '#94A3B8' : driverColor,
              borderRadius: '50%',
              animation: isCompleted ? 'none' : 'driverPulse 1.5s ease-in-out infinite',
            }} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
              {isCompleted 
                ? 'Ride completed' 
                : headingToPickup 
                  ? 'Driver heading to pickup' 
                  : 'Heading to dropoff'}
            </span>
          </div>

          
        </div>
      )}
    </div>
  );
}