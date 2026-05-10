import React, { useMemo } from 'react';
import { Car } from 'lucide-react';
import { useAllDrivers } from "@/App/UaTob/useAllDrivers";

const BOUNDS = { minLat: 28.30, maxLat: 28.78, minLng: -81.62, maxLng: -81.10 };

function latLngToPct(lat, lng) {
  const x = ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * 100;
  const y = ((BOUNDS.maxLat - lat) / (BOUNDS.maxLat - BOUNDS.minLat)) * 100;
  return {
    x: Math.max(3, Math.min(97, +x.toFixed(1))),
    y: Math.max(3, Math.min(97, +y.toFixed(1))),
  };
}

function addressToCoords(address) {
  if (!address) return { x: 30, y: 50 };
  let hash = 0;
  for (let i = 0; i < address.length; i++) hash = address.charCodeAt(i) + ((hash << 5) - hash);
  return {
    x: +(15 + (Math.abs(hash % 1000) / 1000) * 70).toFixed(1),
    y: +(20 + (Math.abs((hash >> 4) % 1000) / 1000) * 60).toFixed(1),
  };
}

function statusColor(status) {
  if (!status) return '#9CA3AF';
  const s = status.toLowerCase();
  if (s === 'online' || s === 'available') return '#22C55E';
  if (s === 'offline') return '#6B7280';
  return '#3B82F6';
}

function statusLabel(status) {
  if (!status) return 'Offline';
  const s = status.toLowerCase();
  if (s === 'online' || s === 'available') return 'Online';
  if (s === 'offline') return 'Offline';
  return 'Busy';
}

const STYLES = `
  @keyframes pinPulse {
    0%, 100% { transform: translate(-50%,-50%) scale(1); opacity: 1; }
    50%       { transform: translate(-50%,-50%) scale(1.2); opacity: 0.75; }
  }
  @keyframes dot {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.3; }
  }
`;

export default function MapView() {
  const { drivers, loading } = useAllDrivers();

  const driverPins = useMemo(() => drivers.map(d => {
    const hasGps = Number.isFinite(Number(d.lat)) && Number.isFinite(Number(d.lng));
    const pos = hasGps
      ? latLngToPct(Number(d.lat), Number(d.lng))
      : addressToCoords(d.city || d.email || d.id);
    return {
      id:     d.id,
      name:   d.firstName ? `${d.firstName} ${d.lastName}` : 'Driver',
      status: d.status || 'offline',
      pos,
      color:  statusColor(d.status),
      label:  statusLabel(d.status),
    };
  }), [drivers]);

  const counts = useMemo(() => {
    const online  = driverPins.filter(d => d.label === 'Online').length;
    const offline = driverPins.filter(d => d.label === 'Offline').length;
    const busy    = driverPins.length - online - offline;
    return { total: driverPins.length, online, offline, busy };
  }, [driverPins]);

  return (
    <>
      <style>{STYLES}</style>
      <div style={{
        position:     'relative',
        height:       'clamp(240px, 38vh, 300px)',
        borderRadius: '20px',
        overflow:     'hidden',
        background:   '#F4F4F5',
        border:       '1px solid #E4E4E7',
      }}>

        {/* Grid */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 }}>
          <defs>
            <pattern id="g1" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M40 0H0V40" fill="none" stroke="#D1D5DB" strokeWidth="0.5"/>
            </pattern>
            <pattern id="g2" width="120" height="120" patternUnits="userSpaceOnUse">
              <path d="M120 0H0V120" fill="none" stroke="#C4C4CC" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#g1)"/>
          <rect width="100%" height="100%" fill="url(#g2)"/>
        </svg>

        {/* Roads */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2, pointerEvents: 'none' }}>
          <path d="M0,55 Q80,48 160,60 T340,52 T520,58"         fill="none" stroke="#E2E2E8" strokeWidth="14" strokeLinecap="round"/>
          <path d="M0,55 Q80,48 160,60 T340,52 T520,58"         fill="none" stroke="#CACAD4" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="18 10"/>
          <path d="M60,0 Q70,60 64,120 T80,240 T100,360"        fill="none" stroke="#E2E2E8" strokeWidth="10" strokeLinecap="round"/>
          <path d="M60,0 Q70,60 64,120 T80,240 T100,360"        fill="none" stroke="#CACAD4" strokeWidth="1"   strokeLinecap="round" strokeDasharray="14 8"/>
          <path d="M280,0 Q275,80 290,160 T310,300"             fill="none" stroke="#E2E2E8" strokeWidth="8"  strokeLinecap="round"/>
          <path d="M120,180 Q200,172 300,178 T500,170"          fill="none" stroke="#DDDDE4" strokeWidth="6"  strokeLinecap="round"/>
        </svg>

        {/* Loading */}
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(244,244,245,0.75)', backdropFilter: 'blur(4px)',
          }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Loading drivers…
            </span>
          </div>
        )}

        {/* Driver pins */}
        {driverPins.map((d, i) => (
          <div
            key={d.id}
            title={`${d.name} · ${d.label}`}
            style={{
              position:       'absolute',
              left:           `${d.pos.x}%`,
              top:            `${d.pos.y}%`,
              transform:      'translate(-50%,-50%)',
              zIndex:         5,
              animation:      d.label === 'Online' ? `pinPulse 2.6s ease-in-out ${i * 0.2}s infinite` : 'none',
            }}
          >
            {d.label === 'Online' && (
              <div style={{
                position: 'absolute', inset: '-5px', borderRadius: '50%',
                border:   `1.5px solid ${d.color}`,
                opacity:  0.4,
              }}/>
            )}
            <div style={{
              width:          '18px',
              height:         '18px',
              background:     d.color,
              borderRadius:   '50%',
              border:         '2px solid #fff',
              boxShadow:      '0 2px 8px rgba(0,0,0,0.18)',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
            }}>
              <Car size={9} color="#fff" strokeWidth={2.5}/>
            </div>
          </div>
        ))}

        {/* Bottom bar */}
        <div style={{
          position:       'absolute',
          bottom: 0, left: 0, right: 0,
          zIndex:         10,
          background:     'rgba(255,255,255,0.82)',
          backdropFilter: 'blur(12px)',
          borderTop:      '1px solid rgba(0,0,0,0.07)',
          padding:        '9px 16px',
          display:        'flex',
          alignItems:     'center',
          gap:            '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Car size={12} color="#52525B" strokeWidth={2}/>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#18181B', fontVariantNumeric: 'tabular-nums' }}>
              {counts.total}
            </span>
            <span style={{ fontSize: '11px', color: '#71717A', fontWeight: 500 }}>drivers</span>
          </div>

          <div style={{ width: '1px', height: 16, background: '#E4E4E7' }}/>
          <Pill color="#22C55E" label="Online"  value={counts.online}  />
          <div style={{ width: '1px', height: 16, background: '#E4E4E7' }}/>
          <Pill color="#3B82F6" label="Busy"    value={counts.busy}    />
          <div style={{ width: '1px', height: 16, background: '#E4E4E7' }}/>
          <Pill color="#9CA3AF" label="Offline" value={counts.offline} />

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{
              width: 5, height: 5, borderRadius: '50%',
              background: '#22C55E',
              animation: 'dot 1.6s ease-in-out infinite',
            }}/>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#52525B', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Live
            </span>
          </div>
        </div>

      </div>
    </>
  );
}

function Pill({ color, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }}/>
      <span style={{ fontSize: '13px', fontWeight: 700, color: '#18181B', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      <span style={{ fontSize: '11px', color: '#71717A', fontWeight: 500 }}>{label}</span>
    </div>
  );
}