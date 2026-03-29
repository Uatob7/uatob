// src/App/MapView.jsx
import React, { useMemo, useRef, useEffect, useState } from 'react';
import { MapPin, Navigation, Car } from 'lucide-react';
import { DRIVERS } from '@/App/locations.js';

// ── DRIVER COLOR ─────────────────────────────────────────
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

// ── SMOOTH DRIVER POSITION ───────────────────────────────
// Interpolates between old and new position using requestAnimationFrame
// so the car glides smoothly instead of jumping every 5s
function useSmoothPos(target, durationMs = 4800) {
  const [pos, setPos]       = useState(target);
  const animRef             = useRef(null);
  const startRef            = useRef(null);
  const fromRef             = useRef(target);
  const toRef               = useRef(target);

  useEffect(() => {
    if (!target) return;

    // If first render, snap immediately
    if (!fromRef.current) {
      fromRef.current = target;
      toRef.current   = target;
      setPos(target);
      return;
    }

    fromRef.current = pos;
    toRef.current   = target;
    startRef.current = null;

    if (animRef.current) cancelAnimationFrame(animRef.current);

    function easeInOut(t) {
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    function step(timestamp) {
      if (!startRef.current) startRef.current = timestamp;
      const elapsed  = timestamp - startRef.current;
      const progress = Math.min(elapsed / durationMs, 1);
      const ease     = easeInOut(progress);

      setPos({
        x: fromRef.current.x + (toRef.current.x - fromRef.current.x) * ease,
        y: fromRef.current.y + (toRef.current.y - fromRef.current.y) * ease,
      });

      if (progress < 1) {
        animRef.current = requestAnimationFrame(step);
      }
    }

    animRef.current = requestAnimationFrame(step);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [target?.x, target?.y]);

  return pos;
}

// ── HEADING ANGLE ────────────────────────────────────────
function getHeading(from, to) {
  if (!from || !to) return 0;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.atan2(dy, dx) * (180 / Math.PI) + 90;
}

export default function MapView({
  pickupCoords   = null,
  dropoffCoords  = null,
  tripData       = null,
  fareData       = null,
  isTracking     = false,
  driverPos      = null,
  rideStatus     = '',
  assignedDriver = null,
  etaMinutes     = 0,
  distToDropoff  = 0,
  getStatusMsg   = () => '',
}) {
  const miles       = safeNum(tripData?.miles, 0);
  const durationMin = safeNum(tripData?.durationMin, 0);
  const km          = miles ? (miles * 1.60934).toFixed(1) : '0.0';

  const safeDrivers  = Array.isArray(DRIVERS) ? DRIVERS : [];
  const driverType   = assignedDriver?.type || 'standard';
  const driverColor  = getDriverColor(driverType);

  const isHeadingToDropoff = ['picked_up', 'heading_to_dropoff', 'arrived_at_dropoff'].includes(rideStatus);
  const isWaitingForPickup = ['waiting', 'arriving', 'arrived'].includes(rideStatus);
  const isOnTrip           = ['heading_to_dropoff', 'arrived_at_dropoff'].includes(rideStatus);

  // Smooth interpolated driver position
  const smoothPos = useSmoothPos(driverPos);

  // Previous pos ref for heading calculation
  const prevPosRef = useRef(driverPos);
  const heading    = getHeading(prevPosRef.current, driverPos);
  useEffect(() => { if (driverPos) prevPosRef.current = driverPos; }, [driverPos?.x, driverPos?.y]);

  const routeTarget = useMemo(() => {
    if (isHeadingToDropoff && dropoffCoords) {
      return { x: safeCoord(dropoffCoords.x), y: safeCoord(dropoffCoords.y) };
    }
    if (pickupCoords) {
      return { x: safeCoord(pickupCoords.x), y: safeCoord(pickupCoords.y) };
    }
    return { x: 50, y: 50 };
  }, [isHeadingToDropoff, dropoffCoords, pickupCoords]);

  return (
    <>
      <style>{`
        @keyframes ripple {
          0%   { transform: translate(-50%,-50%) scale(0.6); opacity: .7; }
          100% { transform: translate(-50%,-50%) scale(2.4); opacity: 0; }
        }
        @keyframes ripple2 {
          0%   { transform: translate(-50%,-50%) scale(0.6); opacity: .5; }
          100% { transform: translate(-50%,-50%) scale(2.0); opacity: 0; }
        }
        @keyframes pinDrop {
          0%   { transform: translate(-50%,-100%) scale(0.5); opacity: 0; }
          65%  { transform: translate(-50%,-50%) scale(1.12); opacity: 1; }
          80%  { transform: translate(-50%,-50%) scale(0.94); }
          100% { transform: translate(-50%,-50%) scale(1); }
        }
        @keyframes carPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(22,163,74,.4); }
          50%     { box-shadow: 0 0 0 10px rgba(22,163,74,0); }
        }
        @keyframes chipSlide {
          from { opacity: 0; transform: translateX(-50%) translateY(-6px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes idleBob {
          0%,100% { transform: translate(-50%,-50%) scale(1); }
          50%     { transform: translate(-50%,-58%) scale(1.08); }
        }
        .driver-car {
          transition: left 0.1s linear, top 0.1s linear;
        }
        .idle-driver {
          animation: idleBob 2.4s ease-in-out infinite;
        }
      `}</style>

      <div
        style={{
          background:   'linear-gradient(140deg,#F0F4F8 0%,#E8EDF2 40%,#F2F5F8 100%)',
          borderRadius: '24px',
          overflow:     'hidden',
          position:     'relative',
          border:       '1.5px solid #D1D9E0',
          height:       isTracking ? '320px' : 'clamp(210px,36vh,270px)',
          boxShadow:    '0 6px 28px rgba(0,0,0,.07)',
        }}
      >
        {/* Map grid — slightly more visible */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.07 }}>
          <defs>
            <pattern id="mapgrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1E293B" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#mapgrid)" />
        </svg>

        {/* Subtle road lines for depth */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.06, pointerEvents: 'none' }}>
          <line x1="0" y1="38%" x2="100%" y2="42%" stroke="#1E293B" strokeWidth="8" />
          <line x1="22%" y1="0" x2="18%" y2="100%" stroke="#1E293B" strokeWidth="6" />
          <line x1="65%" y1="0" x2="70%" y2="100%" stroke="#1E293B" strokeWidth="5" />
          <line x1="0" y1="70%" x2="100%" y2="66%" stroke="#1E293B" strokeWidth="4" />
        </svg>

        {/* ── STATIC ROUTE LINE ─────────────────────────── */}
        {pickupCoords && dropoffCoords && !isTracking && (
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            {/* Shadow line */}
            <line
              x1={`${safeCoord(pickupCoords.x)}%`}   y1={`${safeCoord(pickupCoords.y)}%`}
              x2={`${safeCoord(dropoffCoords.x)}%`}   y2={`${safeCoord(dropoffCoords.y)}%`}
              stroke="#000" strokeWidth="5" opacity=".06"
            />
            {/* Main dashed line */}
            <line
              x1={`${safeCoord(pickupCoords.x)}%`}   y1={`${safeCoord(pickupCoords.y)}%`}
              x2={`${safeCoord(dropoffCoords.x)}%`}   y2={`${safeCoord(dropoffCoords.y)}%`}
              stroke="#16A34A" strokeWidth="2.5" strokeDasharray="10 6" opacity=".6"
            />
          </svg>
        )}

        {/* ── TRACKING VIEW ──────────────────────────────── */}
        {isTracking && smoothPos && assignedDriver && (
          <>
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              {/* Shadow */}
              <line
                x1={`${safeCoord(smoothPos.x)}%`} y1={`${safeCoord(smoothPos.y)}%`}
                x2={`${routeTarget.x}%`}           y2={`${routeTarget.y}%`}
                stroke="#000" strokeWidth="5" opacity=".06"
              />
              {/* Route line */}
              <line
                x1={`${safeCoord(smoothPos.x)}%`} y1={`${safeCoord(smoothPos.y)}%`}
                x2={`${routeTarget.x}%`}           y2={`${routeTarget.y}%`}
                stroke={driverColor} strokeWidth="2.5" strokeDasharray="10 6" opacity=".55"
              />
            </svg>

            {/* Pickup pin */}
            {pickupCoords && (
              <div style={{ position: 'absolute', left: `${safeCoord(pickupCoords.x)}%`, top: `${safeCoord(pickupCoords.y)}%`, zIndex: 3, animation: 'pinDrop .55s cubic-bezier(.34,1.56,.64,1) forwards' }}>
                {isWaitingForPickup && (
                  <>
                    <div style={{ position: 'absolute', top: '50%', left: '50%', width: '70px', height: '70px', borderRadius: '50%', background: 'rgba(22,163,74,.18)', animation: 'ripple 2s ease-out infinite' }} />
                    <div style={{ position: 'absolute', top: '50%', left: '50%', width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(22,163,74,.12)', animation: 'ripple2 2s ease-out infinite .4s' }} />
                  </>
                )}
                <div style={{ transform: 'translate(-50%,-50%)', width: '42px', height: '42px', background: 'linear-gradient(135deg,#111827,#374151)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #fff', boxShadow: '0 4px 18px rgba(0,0,0,.25)' }}>
                  <MapPin size={17} color="#16A34A" />
                </div>
              </div>
            )}

            {/* Dropoff pin */}
            {dropoffCoords && (
              <div style={{ position: 'absolute', left: `${safeCoord(dropoffCoords.x)}%`, top: `${safeCoord(dropoffCoords.y)}%`, zIndex: 3, animation: 'pinDrop .55s cubic-bezier(.34,1.56,.64,1) .1s forwards' }}>
                {isOnTrip && (
                  <>
                    <div style={{ position: 'absolute', top: '50%', left: '50%', width: '65px', height: '65px', borderRadius: '50%', background: 'rgba(22,163,74,.2)', animation: 'ripple 2s ease-out infinite' }} />
                    <div style={{ position: 'absolute', top: '50%', left: '50%', width: '45px', height: '45px', borderRadius: '50%', background: 'rgba(22,163,74,.12)', animation: 'ripple2 2s ease-out infinite .5s' }} />
                  </>
                )}
                <div style={{ transform: 'translate(-50%,-50%) rotate(-45deg)', width: '38px', height: '38px', background: 'linear-gradient(135deg,#16A34A,#22C55E)', borderRadius: '50% 50% 50% 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #fff', boxShadow: '0 4px 18px rgba(22,163,74,.45)' }}>
                  <Navigation size={15} color="#fff" style={{ transform: 'rotate(45deg)' }} />
                </div>
              </div>
            )}

            {/* Driver car — smoothly interpolated */}
            <div
              className="driver-car"
              style={{
                position:  'absolute',
                left:      `${safeCoord(smoothPos.x)}%`,
                top:       `${safeCoord(smoothPos.y)}%`,
                transform: `translate(-50%,-50%) rotate(${heading}deg)`,
                zIndex:    4,
              }}
            >
              {/* Outer glow ring */}
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '66px', height: '66px', borderRadius: '50%', background: `${driverColor}22`, animation: 'carPulse 2s ease-in-out infinite' }} />
              <div style={{ width: '48px', height: '48px', background: `linear-gradient(135deg, ${driverColor}, ${driverColor}cc)`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #fff', boxShadow: `0 6px 20px ${driverColor}55`, transform: 'rotate(0deg)' /* counter-rotate icon */ }}>
                <Car size={22} color="#fff" style={{ transform: `rotate(-${heading}deg)` }} />
              </div>
            </div>

            {/* Status bar */}
            <div
              style={{
                position:       'absolute',
                bottom:         '14px',
                left:           '50%',
                transform:      'translateX(-50%)',
                background:     'rgba(255,255,255,.97)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border:         '1px solid rgba(229,231,235,.8)',
                borderRadius:   '100px',
                padding:        '10px 20px',
                display:        'flex',
                alignItems:     'center',
                gap:            '10px',
                whiteSpace:     'nowrap',
                boxShadow:      '0 6px 24px rgba(0,0,0,.10)',
                maxWidth:       '92%',
                overflow:       'hidden',
                animation:      'chipSlide .3s ease-out forwards',
              }}
            >
              {/* Animated dot */}
              <div style={{ width: '8px', height: '8px', background: driverColor, borderRadius: '50%', flexShrink: 0, boxShadow: `0 0 0 3px ${driverColor}33`, animation: 'carPulse 1.5s ease-in-out infinite' }} />

              <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {getStatusMsg()}
              </span>

              {isWaitingForPickup && (
                <span style={{ background: driverColor, color: '#fff', borderRadius: '100px', padding: '3px 13px', fontSize: '12px', fontWeight: 800, fontFamily: '"JetBrains Mono",monospace', flexShrink: 0, boxShadow: `0 2px 8px ${driverColor}55` }}>
                  {safeNum(etaMinutes) === 0 ? 'Now' : `${safeNum(etaMinutes)} min`}
                </span>
              )}

              {isOnTrip && (
                <span style={{ background: '#16A34A', color: '#fff', borderRadius: '100px', padding: '3px 13px', fontSize: '12px', fontWeight: 800, fontFamily: '"JetBrains Mono",monospace', flexShrink: 0, boxShadow: '0 2px 8px rgba(22,163,74,.45)' }}>
                  {safeNum(distToDropoff).toFixed(1)} mi
                </span>
              )}
            </div>
          </>
        )}

        {/* ── STATIC PINS ────────────────────────────────── */}
        {!isTracking && pickupCoords && (
          <div style={{ position: 'absolute', left: `${safeCoord(pickupCoords.x)}%`, top: `${safeCoord(pickupCoords.y)}%`, zIndex: 3, animation: 'pinDrop .5s cubic-bezier(.34,1.56,.64,1) forwards' }}>
            <div style={{ transform: 'translate(-50%,-50%)', width: '38px', height: '38px', background: 'linear-gradient(135deg,#111827,#374151)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #fff', boxShadow: '0 4px 16px rgba(0,0,0,.22)' }}>
              <MapPin size={16} color="#16A34A" />
            </div>
          </div>
        )}

        {!isTracking && dropoffCoords && (
          <div style={{ position: 'absolute', left: `${safeCoord(dropoffCoords.x)}%`, top: `${safeCoord(dropoffCoords.y)}%`, zIndex: 3, animation: 'pinDrop .5s cubic-bezier(.34,1.56,.64,1) .08s forwards' }}>
            <div style={{ transform: 'translate(-50%,-50%) rotate(-45deg)', width: '38px', height: '38px', background: 'linear-gradient(135deg,#16A34A,#22C55E)', borderRadius: '50% 50% 50% 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #fff', boxShadow: '0 4px 16px rgba(22,163,74,.42)' }}>
              <Navigation size={14} color="#fff" style={{ transform: 'rotate(45deg)' }} />
            </div>
          </div>
        )}

        {/* ── IDLE DRIVERS ───────────────────────────────── */}
        {!isTracking &&
          safeDrivers.map((d, index) => {
            const color = getDriverColor(d.type);
            return (
              <div
                key={d.id || index}
                className="idle-driver"
                style={{
                  position:       'absolute',
                  left:           `${safeCoord(d.x)}%`,
                  top:            `${safeCoord(d.y)}%`,
                  animationDelay: `${index * 0.22}s`,
                  zIndex:         2,
                }}
              >
                {/* Soft glow underneath */}
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '32px', height: '32px', borderRadius: '50%', background: `${color}22` }} />
                <div style={{ transform: 'translate(-50%,-50%)', width: '24px', height: '24px', background: `linear-gradient(135deg,${color},${color}bb)`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2.5px solid #fff', boxShadow: `0 3px 10px ${color}50` }}>
                  <Car size={12} color="#fff" />
                </div>
              </div>
            );
          })}

        {/* ── TRIP SUMMARY CHIP ──────────────────────────── */}
        {pickupCoords && dropoffCoords && !isTracking && tripData && (
          <div
            style={{
              position:       'absolute',
              top:            '14px',
              left:           '50%',
              transform:      'translateX(-50%)',
              background:     'rgba(255,255,255,.97)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border:         '1px solid rgba(229,231,235,.9)',
              borderRadius:   '16px',
              padding:        '10px 18px',
              display:        'flex',
              alignItems:     'center',
              gap:            '14px',
              whiteSpace:     'nowrap',
              boxShadow:      '0 6px 20px rgba(0,0,0,.08)',
              animation:      'chipSlide .35s ease-out forwards',
              maxWidth:       '92%',
              overflow:       'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#111827', fontFamily: '"JetBrains Mono",monospace' }}>
                {miles.toFixed(1)} mi
              </span>
              <span style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 500 }}>({km} km)</span>
            </div>

            <div style={{ width: '1px', height: '16px', background: '#E5E7EB' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>{durationMin} min</span>
            </div>

            {fareData?.total != null && (
              <>
                <div style={{ width: '1px', height: '16px', background: '#E5E7EB' }} />
                <span style={{ fontSize: '13px', fontWeight: 800, color: '#16A34A', fontFamily: '"JetBrains Mono",monospace', background: '#ECFDF5', padding: '2px 10px', borderRadius: '100px', border: '1px solid #BBF7D0' }}>
                  ${safeNum(fareData.total).toFixed(2)}
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
