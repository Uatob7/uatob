import React, { useMemo } from 'react';
import { Car } from 'lucide-react';
import { useAllDrivers } from "@/App/UaTob/useAllDrivers";

// ─── Orlando bounding box ───────────────────────────────────────────────────
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
  if (!status) return '#6B7280';
  const s = status.toLowerCase();
  if (s === 'online' || s === 'available') return '#16A34A';
  if (s === 'offline') return '#111827';
  return '#2563EB'; // busy / in_trip
}

function statusLabel(status) {
  if (!status) return 'Offline';
  const s = status.toLowerCase();
  if (s === 'online' || s === 'available') return 'Online';
  if (s === 'offline') return 'Offline';
  return 'Busy';
}

// ─── COMPONENT ──────────────────────────────────────────────────────────────
export default function MapView() {
  const { drivers, loading } = useAllDrivers();

  const driverPins = useMemo(() => drivers.map(d => {
    const hasGps = Number.isFinite(Number(d.currentLat)) && Number.isFinite(Number(d.currentLng));
    const pos = hasGps
      ? latLngToPct(Number(d.currentLat), Number(d.currentLng))
      : addressToCoords(d.city || d.email || d.id);
    return {
      id: d.id,
      name: d.name || 'Driver',
      status: d.status || 'offline',
      pos,
      color: statusColor(d.status),
    };
  }), [drivers]);

  const counts = useMemo(() => {
    const online  = driverPins.filter(d => statusLabel(d.status) === 'Online').length;
    const offline = driverPins.filter(d => statusLabel(d.status) === 'Offline').length;
    const busy    = driverPins.length - online - offline;
    return { total: driverPins.length, online, offline, busy };
  }, [driverPins]);

  return (
    <>
      {/* Keyframes */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: .7; transform: scale(1.15); }
        }
        @keyframes ripple {
          0%   { transform: translate(-50%,-50%) scale(0.6); opacity: .5; }
          100% { transform: translate(-50%,-50%) scale(1.4); opacity: 0; }
        }
      `}</style>

      <div style={{
        background:     'linear-gradient(160deg,#FCFCFD 0%,#F7F8FA 45%,#F3F4F6 100%)',
        borderRadius:   '30px',
        overflow:       'hidden',
        position:       'relative',
        border:         '1px solid rgba(255,255,255,.65)',
        height:         'clamp(220px,36vh,280px)',
        boxShadow:      '0 20px 60px rgba(0,0,0,.08), inset 0 1px 0 rgba(255,255,255,.75)',
        backdropFilter: 'blur(12px)',
      }}>

        {/* Ambient depth */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(circle at 20% 15%, rgba(22,163,74,.06) 0%, transparent 30%), radial-gradient(circle at 85% 80%, rgba(37,99,235,.05) 0%, transparent 28%)' }}/>

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
          <path d="M 0 75 C 20 70, 35 82, 55 76 S 90 62, 120 72 S 170 92, 220 82 S 290 52, 360 68" fill="none" stroke="#D1D5DB" strokeWidth="10" strokeLinecap="round"/>
          <path d="M 40 0 C 52 30, 65 60, 58 95 S 50 160, 72 220 S 120 290, 140 360" fill="none" stroke="#E5E7EB" strokeWidth="12" strokeLinecap="round"/>
          <path d="M 250 0 C 240 40, 230 90, 245 130 S 285 210, 270 320" fill="none" stroke="#E5E7EB" strokeWidth="10" strokeLinecap="round"/>
        </svg>

        {/* Loading overlay */}
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20, background: 'rgba(255,255,255,.5)', backdropFilter: 'blur(4px)' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#6B7280' }}>Loading drivers…</span>
          </div>
        )}

        {/* Driver pins */}
        {driverPins.map((d, i) => (
          <div
            key={d.id}
            title={`${d.name} · ${statusLabel(d.status)}`}
            style={{
              position:       'absolute',
              left:           `${d.pos.x}%`,
              top:            `${d.pos.y}%`,
              transform:      'translate(-50%,-50%)',
              zIndex:         4,
              animation:      statusLabel(d.status) === 'Online' ? 'pulse 2.4s ease-in-out infinite' : 'none',
              animationDelay: `${i * 0.18}s`,
            }}
          >
            {statusLabel(d.status) === 'Online' && (
              <div style={{ position: 'absolute', inset: '-8px', borderRadius: '999px', background: `${d.color}22`, filter: 'blur(8px)', pointerEvents: 'none' }}/>
            )}
            <div style={{
              width:          '22px',
              height:         '22px',
              background:     d.color,
              borderRadius:   '8px',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              border:         '2px solid #fff',
              boxShadow:      `0 4px 12px ${d.color}50`,
              position:       'relative',
            }}>
              <Car size={11} color="#fff"/>
            </div>
          </div>
        ))}

        {/* Driver count bar */}
        <div style={{
          position:       'absolute',
          bottom: 0, left: 0, right: 0,
          zIndex:         10,
          background:     'rgba(255,255,255,.88)',
          backdropFilter: 'blur(16px)',
          borderTop:      '1px solid rgba(0,0,0,.06)',
          padding:        '8px 14px',
          display:        'flex',
          alignItems:     'center',
          gap:            '10px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginRight: 4 }}>
            <Car size={13} color="#374151"/>
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#111827', fontFamily: '"JetBrains Mono",monospace' }}>
              {counts.total}
            </span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280' }}>drivers</span>
          </div>

          <div style={{ width: 1, height: 18, background: 'rgba(0,0,0,.10)', flexShrink: 0 }}/>
          <Stat color="#16A34A" label="Online"  value={counts.online}  />
          <div style={{ width: 1, height: 18, background: 'rgba(0,0,0,.10)', flexShrink: 0 }}/>
          <Stat color="#2563EB" label="Busy"    value={counts.busy}    />
          <div style={{ width: 1, height: 18, background: 'rgba(0,0,0,.10)', flexShrink: 0 }}/>
          <Stat color="#111827" label="Offline" value={counts.offline} />

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A', animation: 'pulse 1.8s ease-in-out infinite' }}/>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#16A34A', textTransform: 'uppercase', letterSpacing: '.06em' }}>Live</span>
          </div>
        </div>

      </div>
    </>
  );
}

function Stat({ color, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{ width: 8, height: 8, borderRadius: '3px', background: color, flexShrink: 0 }}/>
      <span style={{ fontSize: '13px', fontWeight: 800, color: '#111827', fontFamily: '"JetBrains Mono",monospace' }}>{value}</span>
      <span style={{ fontSize: '11px', fontWeight: 600, color: '#6B7280' }}>{label}</span>
    </div>
  );
}