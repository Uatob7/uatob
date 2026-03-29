import React, { useMemo } from 'react';
import { MapPin, Navigation, Car } from 'lucide-react';
import { DRIVERS } from '@/App/locations.js';

// ── DRIVER COLOR ─────────────────────────────────────────
function getDriverColor(type) {
  switch (type) {
    case 'premium':
      return '#F59E0B'; // amber
    case 'xl':
      return '#2563EB'; // blue
    case 'standard':
    default:
      return '#16A34A'; // green
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

export default function MapView({
  pickupCoords = null,
  dropoffCoords = null,
  tripData = null,
  fareData = null,
  isTracking = false,
  driverPos = null,
  rideStatus = '',
  assignedDriver = null,
  etaMinutes = 0,
  distToDropoff = 0,
  getStatusMsg = () => '',
}) {
  const miles = safeNum(tripData?.miles, 0);
  const durationMin = safeNum(tripData?.durationMin, 0);
  const km = miles ? (miles * 1.60934).toFixed(1) : '0.0';

  const safeDrivers = Array.isArray(DRIVERS) ? DRIVERS : [];
  const driverType = assignedDriver?.type || 'standard';
  const driverColor = getDriverColor(driverType);

  const isHeadingToDropoff = ['picked_up', 'heading_to_dropoff', 'arrived_at_dropoff'].includes(rideStatus);
  const isWaitingForPickup = ['waiting', 'arriving', 'arrived'].includes(rideStatus);
  const isOnTrip = ['heading_to_dropoff', 'arrived_at_dropoff'].includes(rideStatus);

  const routeTarget = useMemo(() => {
    if (isHeadingToDropoff && dropoffCoords) {
      return {
        x: safeCoord(dropoffCoords.x),
        y: safeCoord(dropoffCoords.y),
      };
    }

    if (pickupCoords) {
      return {
        x: safeCoord(pickupCoords.x),
        y: safeCoord(pickupCoords.y),
      };
    }

    return { x: 50, y: 50 };
  }, [isHeadingToDropoff, dropoffCoords, pickupCoords]);

  return (
    <div
      style={{
        background: 'linear-gradient(140deg,#F9FAFB 0%,#F3F4F6 40%,#FAFAFA 100%)',
        borderRadius: '24px',
        overflow: 'hidden',
        position: 'relative',
        border: '1.5px solid #E5E7EB',
        height: isTracking ? '300px' : 'clamp(200px,34vh,260px)',
        boxShadow: '0 4px 22px rgba(0,0,0,.05)',
      }}
    >
      {/* Grid background */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0.05,
        }}
      >
        <defs>
          <pattern id="mapgrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#111827" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#mapgrid)" />
      </svg>

      {/* Static route line */}
      {pickupCoords && dropoffCoords && !isTracking && (
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        >
          <line
            x1={`${safeCoord(pickupCoords.x)}%`}
            y1={`${safeCoord(pickupCoords.y)}%`}
            x2={`${safeCoord(dropoffCoords.x)}%`}
            y2={`${safeCoord(dropoffCoords.y)}%`}
            stroke="#16A34A"
            strokeWidth="2.5"
            strokeDasharray="10 6"
            opacity=".5"
          />
        </svg>
      )}

      {/* Tracking view */}
      {isTracking && driverPos && assignedDriver && (
        <>
          <svg
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
          >
            <line
              x1={`${safeCoord(driverPos.x)}%`}
              y1={`${safeCoord(driverPos.y)}%`}
              x2={`${routeTarget.x}%`}
              y2={`${routeTarget.y}%`}
              stroke={driverColor}
              strokeWidth="2.5"
              strokeDasharray="10 6"
              opacity=".5"
            />
          </svg>

          {/* Pickup pin */}
          {pickupCoords && (
            <div
              style={{
                position: 'absolute',
                left: `${safeCoord(pickupCoords.x)}%`,
                top: `${safeCoord(pickupCoords.y)}%`,
                transform: 'translate(-50%,-50%)',
                zIndex: 3,
              }}
            >
              {isWaitingForPickup && (
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%,-50%)',
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'rgba(22,163,74,.15)',
                    animation: 'ripple 2s ease-out infinite',
                  }}
                />
              )}

              <div
                style={{
                  width: '40px',
                  height: '40px',
                  background: 'linear-gradient(135deg,#111827,#374151)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '3px solid #fff',
                  boxShadow: '0 4px 16px rgba(0,0,0,.2)',
                }}
              >
                <MapPin size={16} color="#16A34A" />
              </div>
            </div>
          )}

          {/* Dropoff pin */}
          {dropoffCoords && (
            <div
              style={{
                position: 'absolute',
                left: `${safeCoord(dropoffCoords.x)}%`,
                top: `${safeCoord(dropoffCoords.y)}%`,
                transform: 'translate(-50%,-50%)',
                zIndex: 3,
              }}
            >
              {isOnTrip && (
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%,-50%)',
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: 'rgba(22,163,74,.18)',
                    animation: 'ripple 2s ease-out infinite',
                  }}
                />
              )}

              <div
                style={{
                  width: '36px',
                  height: '36px',
                  background: 'linear-gradient(135deg,#16A34A,#22C55E)',
                  borderRadius: '50% 50% 50% 4px',
                  transform: 'rotate(-45deg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '3px solid #fff',
                  boxShadow: '0 4px 16px rgba(22,163,74,.4)',
                }}
              >
                <Navigation size={14} color="#fff" style={{ transform: 'rotate(45deg)' }} />
              </div>
            </div>
          )}

          {/* Driver car */}
          <div
            style={{
              position: 'absolute',
              left: `${safeCoord(driverPos.x)}%`,
              top: `${safeCoord(driverPos.y)}%`,
              transform: 'translate(-50%,-50%)',
              transition: 'all 5s linear',
              zIndex: 4,
            }}
          >
            <div
              style={{
                width: '46px',
                height: '46px',
                background: driverColor,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '3px solid #fff',
                boxShadow: `0 4px 16px ${driverColor}55`,
                animation: 'pulse 2s ease-in-out infinite',
              }}
            >
              <Car size={22} color="#fff" />
            </div>
          </div>

          {/* Status bar */}
          <div
            style={{
              position: 'absolute',
              bottom: '14px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(255,255,255,.97)',
              backdropFilter: 'blur(20px)',
              border: '1px solid #E5E7EB',
              borderRadius: '100px',
              padding: '11px 22px',
              display: 'flex',
              alignItems: 'center',
              gap: '11px',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 20px rgba(0,0,0,.08)',
              maxWidth: '92%',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: '8px',
                height: '8px',
                background: driverColor,
                borderRadius: '50%',
                animation: 'pulse 1.5s ease-in-out infinite',
                flexShrink: 0,
              }}
            />

            <span
              style={{
                fontSize: '14px',
                fontWeight: 700,
                color: '#111827',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {getStatusMsg()}
            </span>

            {isWaitingForPickup && (
              <span
                style={{
                  background: driverColor,
                  color: '#fff',
                  borderRadius: '100px',
                  padding: '3px 12px',
                  fontSize: '13px',
                  fontWeight: 800,
                  fontFamily: '"JetBrains Mono",monospace',
                  flexShrink: 0,
                }}
              >
                {safeNum(etaMinutes) === 0 ? 'Now' : `${safeNum(etaMinutes)}m`}
              </span>
            )}

            {isOnTrip && (
              <span
                style={{
                  background: '#16A34A',
                  color: '#fff',
                  borderRadius: '100px',
                  padding: '3px 12px',
                  fontSize: '13px',
                  fontWeight: 800,
                  fontFamily: '"JetBrains Mono",monospace',
                  flexShrink: 0,
                }}
              >
                {safeNum(distToDropoff).toFixed(1)} mi
              </span>
            )}
          </div>
        </>
      )}

      {/* Static pickup pin */}
      {!isTracking && pickupCoords && (
        <div
          style={{
            position: 'absolute',
            left: `${safeCoord(pickupCoords.x)}%`,
            top: `${safeCoord(pickupCoords.y)}%`,
            transform: 'translate(-50%,-50%)',
            zIndex: 3,
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              background: 'linear-gradient(135deg,#111827,#374151)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '3px solid #fff',
              boxShadow: '0 4px 14px rgba(0,0,0,.2)',
            }}
          >
            <MapPin size={15} color="#16A34A" />
          </div>
        </div>
      )}

      {/* Static dropoff pin */}
      {!isTracking && dropoffCoords && (
        <div
          style={{
            position: 'absolute',
            left: `${safeCoord(dropoffCoords.x)}%`,
            top: `${safeCoord(dropoffCoords.y)}%`,
            transform: 'translate(-50%,-50%)',
            zIndex: 3,
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              background: 'linear-gradient(135deg,#16A34A,#22C55E)',
              borderRadius: '50% 50% 50% 4px',
              transform: 'rotate(-45deg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '3px solid #fff',
              boxShadow: '0 4px 14px rgba(22,163,74,.4)',
            }}
          >
            <Navigation size={13} color="#fff" style={{ transform: 'rotate(45deg)' }} />
          </div>
        </div>
      )}

      {/* Idle drivers */}
      {!isTracking &&
        safeDrivers.map((d, index) => (
          <div
            key={d.id || index}
            style={{
              position: 'absolute',
              left: `${safeCoord(d.x)}%`,
              top: `${safeCoord(d.y)}%`,
              transform: 'translate(-50%,-50%)',
              animation: 'pulse 2s ease-in-out infinite',
              animationDelay: `${index * 0.18}s`,
            }}
          >
            <div
              style={{
                width: '22px',
                height: '22px',
                background: getDriverColor(d.type),
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #fff',
                boxShadow: `0 2px 8px ${getDriverColor(d.type)}45`,
              }}
            >
              <Car size={11} color="#fff" />
            </div>
          </div>
        ))}

      {/* Trip summary chip */}
      {pickupCoords && dropoffCoords && !isTracking && tripData && (
        <div
          style={{
            position: 'absolute',
            top: '12px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(255,255,255,.97)',
            backdropFilter: 'blur(12px)',
            border: '1px solid #E5E7EB',
            borderRadius: '14px',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 16px rgba(0,0,0,.07)',
            animation: 'scaleIn .3s ease-out',
            maxWidth: '92%',
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: '#111827',
                fontFamily: '"JetBrains Mono",monospace',
              }}
            >
              {miles.toFixed(1)} mi
            </span>
            <span style={{ fontSize: '11px', color: '#9CA3AF' }}>({km} km)</span>
          </div>

          <div style={{ width: '1px', height: '16px', background: '#E5E7EB' }} />

          <span style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>
            {durationMin} min
          </span>

          {fareData?.total != null && (
            <>
              <div style={{ width: '1px', height: '16px', background: '#E5E7EB' }} />
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: '#16A34A',
                  fontFamily: '"JetBrains Mono",monospace',
                }}
              >
                ${safeNum(fareData.total).toFixed(2)}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}