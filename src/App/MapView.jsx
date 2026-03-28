import React from 'react';
import { MapPin, Navigation, Car } from 'lucide-react';
import { PRICING } from '@/App/pricing.js';
import { DRIVERS } from '@/App/locations.js';

function getDriverColor(type) {
  return PRICING[type]?.color || '#16A34A';
}

export default function MapView({
  pickupCoords, dropoffCoords, tripData = {}, fareData,
  isTracking, driverPos, rideStatus, assignedDriver,
  etaMinutes = 0, distToDropoff = 0, getStatusMsg = () => ''
}) {
  // Safe traffic defaults
  const traffic = tripData?.traffic || { color: '#16A34A', label: 'Normal' };

  return (
    <div style={{
      background: 'linear-gradient(140deg,#F9FAFB 0%,#F3F4F6 40%,#FAFAFA 100%)',
      borderRadius: '24px', overflow: 'hidden', position: 'relative',
      border: '1.5px solid #E5E7EB',
      height: isTracking ? '300px' : 'clamp(200px,34vh,260px)',
      boxShadow: '0 4px 22px rgba(0,0,0,.05)',
    }}>
      {/* Grid background */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: .05 }}>
        <defs>
          <pattern id="mapgrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#111827" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#mapgrid)"/>
      </svg>

      {/* Route line */}
      {pickupCoords && dropoffCoords && !isTracking && (
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          <line
            x1={`${pickupCoords.x}%`} y1={`${pickupCoords.y}%`}
            x2={`${dropoffCoords.x}%`} y2={`${dropoffCoords.y}%`}
            stroke="#16A34A" strokeWidth="2.5" strokeDasharray="10 6" opacity=".5"
          />
        </svg>
      )}

      {/* Tracking view */}
      {isTracking && driverPos && assignedDriver && (
        <>
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            <line
              x1={`${driverPos.x}%`} y1={`${driverPos.y}%`}
              x2={`${['picked_up','heading_to_dropoff','arrived_at_dropoff'].includes(rideStatus) ? dropoffCoords?.x : pickupCoords?.x || 0}%`}
              y2={`${['picked_up','heading_to_dropoff','arrived_at_dropoff'].includes(rideStatus) ? dropoffCoords?.y : pickupCoords?.y || 0}%`}
              stroke={getDriverColor(assignedDriver.type)} strokeWidth="2.5" strokeDasharray="10 6" opacity=".5"
            />
          </svg>

          {/* Pickup pin */}
          {pickupCoords && (
            <div style={{ position: 'absolute', left: `${pickupCoords.x}%`, top: `${pickupCoords.y}%`, transform: 'translate(-50%,-50%)', zIndex: 3 }}>
              {['waiting','arriving','arrived'].includes(rideStatus) && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(22,163,74,.15)', animation: 'ripple 2s ease-out infinite' }}/>
              )}
              <div style={{ width: '40px', height: '40px', background: 'linear-gradient(135deg,#111827,#374151)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #fff', boxShadow: '0 4px 16px rgba(0,0,0,.2)' }}>
                <MapPin size={16} color="#16A34A"/>
              </div>
            </div>
          )}

          {/* Dropoff pin */}
          {dropoffCoords && (
            <div style={{ position: 'absolute', left: `${dropoffCoords.x}%`, top: `${dropoffCoords.y}%`, transform: 'translate(-50%,-50%)', zIndex: 3 }}>
              {['heading_to_dropoff','arrived_at_dropoff'].includes(rideStatus) && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(22,163,74,.18)', animation: 'ripple 2s ease-out infinite' }}/>
              )}
              <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg,#16A34A,#22C55E)', borderRadius: '50% 50% 50% 4px', transform: 'rotate(-45deg)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #fff', boxShadow: '0 4px 16px rgba(22,163,74,.4)' }}>
                <Navigation size={14} color="#fff" style={{ transform: 'rotate(45deg)' }}/>
              </div>
            </div>
          )}

          {/* Driver car */}
          <div style={{ position: 'absolute', left: `${driverPos.x}%`, top: `${driverPos.y}%`, transform: 'translate(-50%,-50%)', transition: 'all 5s linear', zIndex: 4 }}>
            <div style={{ width: '46px', height: '46px', background: getDriverColor(assignedDriver.type), borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #fff', boxShadow: `0 4px 16px ${getDriverColor(assignedDriver.type)}55`, animation: 'pulse 2s ease-in-out infinite' }}>
              <Car size={22} color="#fff"/>
            </div>
          </div>

          {/* Status bar */}
          <div style={{ position: 'absolute', bottom: '14px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,255,255,.97)', backdropFilter: 'blur(20px)', border: '1px solid #E5E7EB', borderRadius: '100px', padding: '11px 22px', display: 'flex', alignItems: 'center', gap: '11px', whiteSpace: 'nowrap', boxShadow: '0 4px 20px rgba(0,0,0,.08)' }}>
            <div style={{ width: '8px', height: '8px', background: getDriverColor(assignedDriver.type), borderRadius: '50%', animation: 'pulse 1.5s ease-in-out infinite' }}/>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{getStatusMsg()}</span>
            {['waiting','arriving'].includes(rideStatus) && (
              <span style={{ background: getDriverColor(assignedDriver.type), color: '#fff', borderRadius: '100px', padding: '3px 12px', fontSize: '13px', fontWeight: 800, fontFamily: '"JetBrains Mono",monospace' }}>
                {etaMinutes === 0 ? 'Now' : `${etaMinutes}m`}
              </span>
            )}
            {['heading_to_dropoff','arrived_at_dropoff'].includes(rideStatus) && (
              <span style={{ background: '#16A34A', color: '#fff', borderRadius: '100px', padding: '3px 12px', fontSize: '13px', fontWeight: 800, fontFamily: '"JetBrains Mono",monospace' }}>
                {distToDropoff} mi
              </span>
            )}
          </div>
        </>
      )}

      {/* Static pins when not tracking */}
      {!isTracking && pickupCoords && (
        <div style={{ position: 'absolute', left: `${pickupCoords.x}%`, top: `${pickupCoords.y}%`, transform: 'translate(-50%,-50%)', zIndex: 3 }}>
          <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg,#111827,#374151)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #fff', boxShadow: '0 4px 14px rgba(0,0,0,.2)' }}>
            <MapPin size={15} color="#16A34A"/>
          </div>
        </div>
      )}
      {!isTracking && dropoffCoords && (
        <div style={{ position: 'absolute', left: `${dropoffCoords.x}%`, top: `${dropoffCoords.y}%`, transform: 'translate(-50%,-50%)', zIndex: 3 }}>
          <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg,#16A34A,#22C55E)', borderRadius: '50% 50% 50% 4px', transform: 'rotate(-45deg)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #fff', boxShadow: '0 4px 14px rgba(22,163,74,.4)' }}>
            <Navigation size={13} color="#fff" style={{ transform: 'rotate(45deg)' }}/>
          </div>
        </div>
      )}

      {/* Idle drivers */}
      {!isTracking && DRIVERS.map(d => (
        <div key={d.id} style={{ position: 'absolute', left: `${d.x}%`, top: `${d.y}%`, transform: 'translate(-50%,-50%)', animation: 'pulse 2s ease-in-out infinite', animationDelay: `${d.id * 0.18}s` }}>
          <div style={{ width: '22px', height: '22px', background: getDriverColor(d.type), borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff', boxShadow: `0 2px 8px ${getDriverColor(d.type)}45` }}>
            <Car size={11} color="#fff"/>
          </div>
        </div>
      ))}

      {/* Trip summary chip */}
      {pickupCoords && dropoffCoords && !isTracking && fareData && tripData && (
        <div style={{ position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,255,255,.97)', backdropFilter: 'blur(12px)', border: '1px solid #E5E7EB', borderRadius: '14px', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '14px', whiteSpace: 'nowrap', boxShadow: '0 4px 16px rgba(0,0,0,.07)', animation: 'scaleIn .3s ease-out' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827', fontFamily: '"JetBrains Mono",monospace' }}>{tripData.actualMiles || 0} mi</span>
            <span style={{ fontSize: '11px', color: '#9CA3AF' }}>({tripData.actualKm || 0} km)</span>
          </div>
          <div style={{ width: '1px', height: '16px', background: '#E5E7EB' }}/>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>{tripData.totalMin || 0} min</span>
          <div style={{ width: '1px', height: '16px', background: '#E5E7EB' }}/>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: traffic.color }}/>
            <span style={{ fontSize: '12px', fontWeight: 700, color: traffic.color }}>{traffic.label}</span>
          </div>
        </div>
      )}
    </div>
  );
}