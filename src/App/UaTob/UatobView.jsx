import React, { useMemo } from 'react';
import { MapPin, Navigation, Car } from 'lucide-react';
import { DRIVERS } from '@/App/UaTob/locations.js';

function getDriverColor(type) {
  switch (type) {
    case 'premium': return '#F59E0B';
    case 'xl':      return '#2563EB';
    default:        return '#16A34A';
  }
}

function safeCoord(coord, fallback = 50) {
  const n = Number(coord);
  return Number.isFinite(n) ? n : fallback;
}

function safeNum(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function truncate(str, max = 22) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max).trimEnd() + '…' : str;
}

// Strip city/state/zip suffix — keep just the street part
function streetOnly(address) {
  if (!address) return '';
  const parts = address.split(',');
  return parts[0]?.trim() ?? address;
}

function addressToCoords(address, defaultX = 30, defaultY = 50) {
  if (!address) return { x: defaultX, y: defaultY };
  let hash = 0;
  for (let i = 0; i < address.length; i++) hash = address.charCodeAt(i) + ((hash << 5) - hash);
  const x = 15 + (Math.abs(hash % 1000) / 1000) * 70;
  const y = 20 + (Math.abs((hash >> 4) % 1000) / 1000) * 60;
  return { x: +x.toFixed(1), y: +y.toFixed(1) };
}

function getRideIcon(rideType) {
  switch (rideType) {
    case 'premium': return '⭐';
    case 'xl':      return '🚐';
    case 'economy': return '💚';
    default:        return '🚗';
  }
}

export default function MapView({
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
  const km          = miles ? (miles * 1.60934).toFixed(1) : '0.0';
  const fareTotal   = safeNum(bookingPayload?.fareEstimate, 0);
  const rideLabel   = bookingPayload?.rideLabel ?? 'Standard';
  const rideType    = bookingPayload?.rideType  ?? 'standard';
  const pickup      = bookingPayload?.pickup;
  const dropoff     = bookingPayload?.dropoff;

  const safeDrivers  = Array.isArray(DRIVERS) ? DRIVERS : [];
  const driverType   = assignedDriver?.type || rideType;
  const driverColor  = getDriverColor(driverType);

  const pickupCoords  = useMemo(() => addressToCoords(pickup,  25, 45), [pickup]);
  const dropoffCoords = useMemo(() => addressToCoords(dropoff, 72, 58), [dropoff]);

  const isHeadingToDropoff = ['in_progress'].includes(rideStatus);
  const isWaitingForPickup = ['driver_assigned', 'arrived'].includes(rideStatus);
  const isOnTrip           = ['in_progress'].includes(rideStatus);

  const routeTarget = useMemo(() => {
    if (isHeadingToDropoff && dropoffCoords) return { x: safeCoord(dropoffCoords.x), y: safeCoord(dropoffCoords.y) };
    if (pickupCoords) return { x: safeCoord(pickupCoords.x), y: safeCoord(pickupCoords.y) };
    return { x: 50, y: 50 };
  }, [isHeadingToDropoff, dropoffCoords, pickupCoords]);

  function getStatusMsg() {
    switch (rideStatus) {
      case 'driver_assigned': return `${assignedDriver?.name ?? 'Driver'} is on the way`;
      case 'arrived':         return 'Driver has arrived';
      case 'in_progress':     return 'Heading to dropoff';
      case 'completed':       return 'Trip complete';
      default:                return 'Finding your driver…';
    }
  }

  const showRoute   = pickup && dropoff;
  const showSummary = showRoute && !isTracking;

  return (
    <div style={{
      background:    'linear-gradient(160deg,#FCFCFD 0%,#F7F8FA 45%,#F3F4F6 100%)',
      borderRadius:  '30px',
      overflow:      'hidden',
      position:      'relative',
      border:        '1px solid rgba(255,255,255,.65)',
      height:        isTracking ? '320px' : 'clamp(220px,36vh,280px)',
      boxShadow:     '0 20px 60px rgba(0,0,0,.08), inset 0 1px 0 rgba(255,255,255,.75)',
      backdropFilter:'blur(12px)',
    }}>

      {/* Ambient depth */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(circle at 20% 15%, rgba(22,163,74,.06) 0%, transparent 30%), radial-gradient(circle at 85% 80%, rgba(37,99,235,.05) 0%, transparent 28%)',
      }}/>

      {/* Street grid */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.08 }}>
        <defs>
          <pattern id="road-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M48 0 L0 0 0 48" fill="none" stroke="#111827" strokeWidth="1"/>
          </pattern>
          <pattern id="mini-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M24 0 L0 0 0 24" fill="none" stroke="#9CA3AF" strokeWidth=".5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#mini-grid)"/>
        <rect width="100%" height="100%" fill="url(#road-grid)"/>
      </svg>

      {/* Fake roads */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.18, pointerEvents: 'none' }}>
        <path d="M 0 75 C 20 70, 35 82, 55 76 S 90 62, 120 72 S 170 92, 220 82 S 290 52, 360 68"
          fill="none" stroke="#D1D5DB" strokeWidth="10" strokeLinecap="round"/>
        <path d="M 40 0 C 52 30, 65 60, 58 95 S 50 160, 72 220 S 120 290, 140 360"
          fill="none" stroke="#E5E7EB" strokeWidth="12" strokeLinecap="round"/>
        <path d="M 250 0 C 240 40, 230 90, 245 130 S 285 210, 270 320"
          fill="none" stroke="#E5E7EB" strokeWidth="10" strokeLinecap="round"/>
      </svg>

      {/* Static route line */}
      {showRoute && !isTracking && (
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          <defs>
            <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="#111827" stopOpacity=".55"/>
              <stop offset="100%" stopColor="#16A34A" stopOpacity=".95"/>
            </linearGradient>
          </defs>
          <line
            x1={`${safeCoord(pickupCoords.x)}%`}  y1={`${safeCoord(pickupCoords.y)}%`}
            x2={`${safeCoord(dropoffCoords.x)}%`} y2={`${safeCoord(dropoffCoords.y)}%`}
            stroke="url(#routeGrad)" strokeWidth="4" strokeDasharray="10 8" strokeLinecap="round" opacity=".85"
          />
        </svg>
      )}

      {/* Tracking mode */}
      {isTracking && driverPos && assignedDriver && (
        <>
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            <defs>
              <linearGradient id="driverRouteGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor={driverColor} stopOpacity=".95"/>
                <stop offset="100%" stopColor={driverColor} stopOpacity=".35"/>
              </linearGradient>
            </defs>
            <line
              x1={`${safeCoord(driverPos.x)}%`} y1={`${safeCoord(driverPos.y)}%`}
              x2={`${routeTarget.x}%`}           y2={`${routeTarget.y}%`}
              stroke="url(#driverRouteGrad)" strokeWidth="4" strokeDasharray="10 8" strokeLinecap="round"
            />
          </svg>

          {/* Pickup pin */}
          {pickupCoords && (
            <div style={{ position: 'absolute', left: `${safeCoord(pickupCoords.x)}%`, top: `${safeCoord(pickupCoords.y)}%`, transform: 'translate(-50%,-50%)', zIndex: 3 }}>
              {isWaitingForPickup && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '74px', height: '74px', borderRadius: '999px', background: 'rgba(17,24,39,.10)', animation: 'ripple 2s ease-out infinite' }}/>
              )}
              <div style={{ width: '42px', height: '42px', background: 'linear-gradient(145deg,#111827,#374151)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #fff', boxShadow: '0 10px 28px rgba(0,0,0,.22)' }}>
                <MapPin size={17} color="#16A34A"/>
              </div>
            </div>
          )}

          {/* Dropoff pin */}
          {dropoffCoords && (
            <div style={{ position: 'absolute', left: `${safeCoord(dropoffCoords.x)}%`, top: `${safeCoord(dropoffCoords.y)}%`, transform: 'translate(-50%,-50%)', zIndex: 3 }}>
              {isOnTrip && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '70px', height: '70px', borderRadius: '999px', background: 'rgba(22,163,74,.16)', animation: 'ripple 2s ease-out infinite' }}/>
              )}
              <div style={{ width: '38px', height: '38px', background: 'linear-gradient(145deg,#16A34A,#22C55E)', borderRadius: '50% 50% 50% 6px', transform: 'rotate(-45deg)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #fff', boxShadow: '0 10px 28px rgba(22,163,74,.32)' }}>
                <Navigation size={14} color="#fff" style={{ transform: 'rotate(45deg)' }}/>
              </div>
            </div>
          )}

          {/* Driver pin */}
          <div style={{ position: 'absolute', left: `${safeCoord(driverPos.x)}%`, top: `${safeCoord(driverPos.y)}%`, transform: 'translate(-50%,-50%)', transition: 'all 5s linear', zIndex: 5 }}>
            <div style={{ position: 'absolute', inset: '-10px', borderRadius: '999px', background: `${driverColor}22`, filter: 'blur(10px)' }}/>
            <div style={{ width: '50px', height: '50px', background: `linear-gradient(145deg,${driverColor},${driverColor}dd)`, borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #fff', boxShadow: `0 14px 30px ${driverColor}40`, animation: 'pulse 2s ease-in-out infinite', position: 'relative' }}>
              <Car size={22} color="#fff"/>
            </div>
          </div>

          {/* Live status chip */}
          <div style={{ position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(18px)', border: '1px solid rgba(229,231,235,.9)', borderRadius: '999px', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '10px', whiteSpace: 'nowrap', boxShadow: '0 12px 30px rgba(0,0,0,.10)', maxWidth: '92%', overflow: 'hidden', zIndex: 6 }}>
            <div style={{ width: '9px', height: '9px', background: driverColor, borderRadius: '999px', animation: 'pulse 1.6s ease-in-out infinite', flexShrink: 0 }}/>
            <span style={{ fontSize: '14px', fontWeight: 800, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {getStatusMsg()}
            </span>
            {isWaitingForPickup && (
              <span style={{ background: driverColor, color: '#fff', borderRadius: '999px', padding: '5px 12px', fontSize: '12px', fontWeight: 800, fontFamily: '"JetBrains Mono",monospace', flexShrink: 0, boxShadow: `0 6px 16px ${driverColor}35` }}>
                {safeNum(etaMinutes) === 0 ? 'Now' : `${safeNum(etaMinutes)}m`}
              </span>
            )}
            {isOnTrip && (
              <span style={{ background: '#16A34A', color: '#fff', borderRadius: '999px', padding: '5px 12px', fontSize: '12px', fontWeight: 800, fontFamily: '"JetBrains Mono",monospace', flexShrink: 0, boxShadow: '0 6px 16px rgba(22,163,74,.35)' }}>
                {safeNum(distToDropoff).toFixed(1)} mi
              </span>
            )}
          </div>
        </>
      )}

      {/* Static pickup pin */}
      {!isTracking && pickupCoords && showRoute && (
        <div style={{ position: 'absolute', left: `${safeCoord(pickupCoords.x)}%`, top: `${safeCoord(pickupCoords.y)}%`, transform: 'translate(-50%,-50%)', zIndex: 3 }}>
          <div style={{ width: '40px', height: '40px', background: 'linear-gradient(145deg,#111827,#374151)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #fff', boxShadow: '0 10px 24px rgba(0,0,0,.18)' }}>
            <MapPin size={16} color="#16A34A"/>
          </div>
        </div>
      )}

      {/* Static dropoff pin */}
      {!isTracking && dropoffCoords && showRoute && (
        <div style={{ position: 'absolute', left: `${safeCoord(dropoffCoords.x)}%`, top: `${safeCoord(dropoffCoords.y)}%`, transform: 'translate(-50%,-50%)', zIndex: 3 }}>
          <div style={{ width: '40px', height: '40px', background: 'linear-gradient(145deg,#16A34A,#22C55E)', borderRadius: '50% 50% 50% 6px', transform: 'rotate(-45deg)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #fff', boxShadow: '0 10px 24px rgba(22,163,74,.28)' }}>
            <Navigation size={14} color="#fff" style={{ transform: 'rotate(45deg)' }}/>
          </div>
        </div>
      )}

      {/* Idle nearby drivers */}
      {!isTracking && safeDrivers.map((d, index) => (
        <div
          key={d.id || index}
          style={{ position: 'absolute', left: `${safeCoord(d.x)}%`, top: `${safeCoord(d.y)}%`, transform: 'translate(-50%,-50%)', animation: 'pulse 2.4s ease-in-out infinite', animationDelay: `${index * 0.2}s`, opacity: showRoute ? 0.3 : 0.92 }}
        >
          <div style={{ width: '20px', height: '20px', background: getDriverColor(d.type), borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff', boxShadow: `0 6px 14px ${getDriverColor(d.type)}35` }}>
            <Car size={10} color="#fff"/>
          </div>
        </div>
      ))}

     

    </div>
  );
}