import { useState, useEffect, useRef, useMemo } from 'react';
import AdminStatusCard from '@/App/Admin/Card';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:     '#050A06',
  inkMid: 'rgba(255,255,255,.45)',
  border: 'rgba(34,197,94,.15)',
};
const COND = "'Barlow Condensed','Barlow',sans-serif";
const MONO = "'JetBrains Mono','SFMono-Regular',monospace";

const MAPBOX_TOKEN = 'pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA';
const MAP_STYLE    = 'mapbox://styles/mapbox/dark-v11';
const ORL_LNG      = -81.3792;
const ORL_LAT      =  28.5383;

// ─── Keyframes ────────────────────────────────────────────────────────────────
const KEYFRAMES = `
  @keyframes uaBlink     { 0%,100%{opacity:1} 50%{opacity:.22} }
  @keyframes uaFadeIn    { from{opacity:0} to{opacity:1} }
  @keyframes uaScan      { from{top:-80px} to{top:100%} }
  @keyframes ua-driver-pulse { 0%{transform:translate(-50%,-50%) scale(.4);opacity:.7} 100%{transform:translate(-50%,-50%) scale(2.2);opacity:0} }
  @keyframes ua-ring-out { 0%{transform:translate(-50%,-50%) scale(.2);opacity:.9} 100%{transform:translate(-50%,-50%) scale(2.8);opacity:0} }
  @keyframes adScan   { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
  @keyframes adFaceIn { 0%{opacity:0;transform:translateY(6px) scale(.98)} 100%{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes adRadar  { 0%{transform:scale(.6);opacity:.7} 100%{transform:scale(2.6);opacity:0} }
  @keyframes adBracket{ 0%,100%{opacity:.35} 50%{opacity:.7} }
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function hasCoords(o) {
  return typeof o?.pickupLat === 'number' && typeof o?.pickupLng === 'number';
}

function tsToMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') { const p = Date.parse(ts); return isNaN(p) ? 0 : p; }
  return 0;
}

// ─── GeoJSON builders ─────────────────────────────────────────────────────────
function buildSearchGeoJSON(searches = []) {
  return {
    type: 'FeatureCollection',
    features: searches.filter(hasCoords).map(s => ({
      type: 'Feature',
      properties: {
        guest: !s.uid || s.uid === 'null',
        age:   Math.min(1, Math.max(0, 1 - (Date.now() - tsToMillis(s.createdAt)) / (3 * 3_600_000))),
      },
      geometry: { type: 'Point', coordinates: [s.pickupLng, s.pickupLat] },
    })),
  };
}

function buildScheduledGeoJSON(scheduledRides = []) {
  return {
    type: 'FeatureCollection',
    features: scheduledRides.filter(hasCoords).map(r => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: [r.pickupLng, r.pickupLat] },
    })),
  };
}

function emptyGeoJSON() { return { type: 'FeatureCollection', features: [] }; }

// ─── Marker factories ─────────────────────────────────────────────────────────
function makeSearchRingEl(isGuest) {
  const col    = isGuest ? '#FB923C' : '#4ADE80';
  const colDim = isGuest ? 'rgba(251,146,60,' : 'rgba(74,222,128,';
  const wrap   = document.createElement('div');
  wrap.style.cssText = 'position:relative;width:0;height:0;pointer-events:none;';
  [0, 0.7, 1.4].forEach(delay => {
    const ring = document.createElement('div');
    ring.style.cssText = [
      'position:absolute','left:0','top:0','width:26px','height:26px','border-radius:50%',
      `border:1.5px solid ${colDim}.55)`,
      'transform:translate(-50%,-50%) scale(.2)',
      `animation:ua-ring-out 2.4s ease-out ${delay}s infinite`,
    ].join(';');
    wrap.appendChild(ring);
  });
  const dot = document.createElement('div');
  dot.style.cssText = [
    'position:absolute','left:0','top:0','width:8px','height:8px','border-radius:50%',
    `background:${col}`,'border:1.5px solid #fff',`box-shadow:0 0 10px ${col}`,
    'transform:translate(-50%,-50%)',
  ].join(';');
  wrap.appendChild(dot);
  return wrap;
}

function makeDriverDotEl() {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;width:0;height:0;pointer-events:auto;cursor:pointer;';
  [0, 0.9].forEach(delay => {
    const ring = document.createElement('div');
    ring.style.cssText = [
      'position:absolute','left:0','top:0','width:22px','height:22px','border-radius:50%',
      'border:1.5px solid rgba(96,165,250,.55)',
      'transform:translate(-50%,-50%) scale(.4)','opacity:0',
      `animation:ua-driver-pulse 2s ease-out ${delay}s infinite`,
      'pointer-events:none',
    ].join(';');
    wrap.appendChild(ring);
  });
  const dot = document.createElement('div');
  dot.style.cssText = [
    'position:absolute','left:0','top:0','width:10px','height:10px','border-radius:50%',
    'background:#60A5FA','border:2px solid #fff','box-shadow:0 0 10px rgba(96,165,250,.9)',
    'transform:translate(-50%,-50%)',
  ].join(';');
  wrap.appendChild(dot);
  // larger transparent hit zone for easier tap
  const hit = document.createElement('div');
  hit.style.cssText = 'position:absolute;left:0;top:0;width:24px;height:24px;border-radius:50%;transform:translate(-50%,-50%);';
  wrap.appendChild(hit);
  return wrap;
}

function makeOfflineDriverDotEl() {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;width:0;height:0;pointer-events:auto;cursor:pointer;';
  const dot = document.createElement('div');
  dot.style.cssText = [
    'position:absolute','left:0','top:0','width:8px','height:8px','border-radius:50%',
    'background:rgba(255,255,255,.18)','border:1.5px solid rgba(255,255,255,.32)',
    'transform:translate(-50%,-50%)',
  ].join(';');
  wrap.appendChild(dot);
  const hit = document.createElement('div');
  hit.style.cssText = 'position:absolute;left:0;top:0;width:20px;height:20px;border-radius:50%;transform:translate(-50%,-50%);';
  wrap.appendChild(hit);
  return wrap;
}

function makeAccountDotEl() {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;width:0;height:0;pointer-events:none;';
  const ring = document.createElement('div');
  ring.style.cssText = [
    'position:absolute','left:0','top:0','width:18px','height:18px','border-radius:50%',
    'border:1.5px solid rgba(251,191,36,.5)',
    'transform:translate(-50%,-50%) scale(.3)','opacity:0',
    'animation:ua-driver-pulse 2.6s ease-out .3s infinite',
  ].join(';');
  const dot = document.createElement('div');
  dot.style.cssText = [
    'position:absolute','left:0','top:0','width:8px','height:8px','border-radius:50%',
    'background:#FBBF24','border:1.5px solid #fff','box-shadow:0 0 8px rgba(251,191,36,.8)',
    'transform:translate(-50%,-50%)',
  ].join(';');
  wrap.appendChild(ring);
  wrap.appendChild(dot);
  return wrap;
}

// ─── Overlay layers ───────────────────────────────────────────────────────────
function ScanlineOverlay() {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 8,
      pointerEvents: 'none', mixBlendMode: 'screen', opacity: .45 }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'repeating-linear-gradient(0deg, rgba(34,197,94,.03) 0px, rgba(34,197,94,.03) 1px, transparent 2px, transparent 4px)',
      }}/>
      <div style={{
        position: 'absolute', left: 0, right: 0, height: 80,
        background: 'linear-gradient(180deg, transparent, rgba(74,222,128,.04), transparent)',
        animation: 'uaScan 7s linear infinite',
      }}/>
    </div>
  );
}

function AtmosphereOverlay() {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 6, pointerEvents: 'none',
      background: 'radial-gradient(ellipse at 50% 42%, transparent 35%, rgba(3,6,4,.5) 80%, rgba(3,6,4,.82) 100%)',
    }}/>
  );
}

function CornerBrackets() {
  const off = 12, sz = 24, th = 1.5, col = 'rgba(34,197,94,.35)';
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 12, pointerEvents: 'none' }}>
      {[
        { top: off,    left:  off,  bt: 1, bl: 1 },
        { top: off,    right: off,  bt: 1, br: 1 },
        { bottom: off, left:  off,  bb: 1, bl: 1 },
        { bottom: off, right: off,  bb: 1, br: 1 },
      ].map((c, i) => (
        <div key={i} style={{
          position: 'absolute', width: sz, height: sz,
          top: c.top, left: c.left, right: c.right, bottom: c.bottom,
          borderTop:    c.bt ? `${th}px solid ${col}` : 'none',
          borderBottom: c.bb ? `${th}px solid ${col}` : 'none',
          borderLeft:   c.bl ? `${th}px solid ${col}` : 'none',
          borderRight:  c.br ? `${th}px solid ${col}` : 'none',
          animation: 'adBracket 4s ease-in-out infinite',
        }}/>
      ))}
    </div>
  );
}

// ─── Rotating status chips ────────────────────────────────────────────────────
const CHIPS = [
  { color: '#60A5FA', sub: 'ONLINE',     pulse: true  },
  { color: 'rgba(255,255,255,.45)', sub: 'FLEET',  pulse: false },
  { color: '#4ADE80', sub: 'SEARCHES',   pulse: true  },
  { color: '#C084FC', sub: 'SCHEDULED',  pulse: true  },
];

function AdminBadge({ onlineCount, totalFleet, searchCount, scheduledCount }) {
  const [active, setActive] = useState(0);
  const values = [onlineCount, totalFleet, searchCount, scheduledCount];

  useEffect(() => {
    const id = setInterval(() => setActive(i => (i + 1) % CHIPS.length), 2800);
    return () => clearInterval(id);
  }, []);

  const chip = CHIPS[active];

  return (
    <div style={{
      position: 'absolute', bottom: 20, left: 16, zIndex: 18,
      animation: 'uaFadeIn .8s ease both',
    }}>
      <div
        key={active}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(5,10,6,.72)', backdropFilter: 'blur(10px)',
          border: `1px solid ${chip.color}44`,
          borderRadius: 99, padding: '6px 14px 6px 10px',
          boxShadow: '0 6px 20px rgba(0,0,0,.4)',
          animation: 'adFaceIn .3s ease both',
        }}
      >
        <div style={{
          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
          background: chip.color, boxShadow: `0 0 6px ${chip.color}`,
          animation: chip.pulse && values[active] > 0 ? 'uaBlink 1.8s ease-in-out infinite' : 'none',
        }}/>
        <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 800,
          color: chip.color, lineHeight: 1 }}>
          {values[active]}
        </span>
        <span style={{ fontFamily: COND, fontSize: 10, fontWeight: 700,
          letterSpacing: '.14em', color: 'rgba(255,255,255,.32)' }}>
          {chip.sub}
        </span>
        <div style={{ display: 'flex', gap: 3, marginLeft: 2 }}>
          {CHIPS.map((c, i) => (
            <div key={i} style={{
              width: i === active ? 10 : 3, height: 3, borderRadius: 2,
              background: i === active ? chip.color : 'rgba(255,255,255,.18)',
              transition: 'width .3s ease, background .3s ease',
            }}/>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Driver detail modal ──────────────────────────────────────────────────────
function DriverModal({ driver, onClose }) {
  if (!driver) return null;

  const name = [driver.firstName, driver.lastName].filter(Boolean).join(' ')
    || driver.name
    || driver.email?.split('@')[0]
    || `Driver ${(driver.id || '').slice(0, 6)}`;

  const phone    = driver.phone || driver.phoneNumber;
  const isOnline = driver.status === 'online';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,.52)', backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'rgba(3,7,4,.97)',
          backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          border: '1.5px solid rgba(34,197,94,.18)', borderRadius: 22,
          padding: '20px', width: 264, position: 'relative',
          boxShadow: '0 24px 64px rgba(0,0,0,.7)',
          animation: 'adFaceIn .3s cubic-bezier(.34,1.2,.64,1) both',
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 12, right: 12, width: 28, height: 28,
            borderRadius: 9, border: '1px solid rgba(255,255,255,.1)',
            background: 'rgba(255,255,255,.06)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
            stroke="rgba(255,255,255,.5)" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {/* Avatar + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, paddingRight: 34 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 13, flexShrink: 0,
            background: isOnline ? 'rgba(96,165,250,.14)' : 'rgba(255,255,255,.05)',
            border: `1px solid ${isOnline ? 'rgba(96,165,250,.28)' : 'rgba(255,255,255,.1)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
              stroke={isOnline ? '#60A5FA' : 'rgba(255,255,255,.3)'}
              strokeWidth="1.8" strokeLinecap="round">
              <circle cx="12" cy="8" r="3.5"/>
              <path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/>
            </svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 800,
              color: 'rgba(255,255,255,.9)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
              <div style={{
                width: 5, height: 5, borderRadius: '50%',
                background: isOnline ? '#60A5FA' : 'rgba(255,255,255,.25)',
                boxShadow: isOnline ? '0 0 5px rgba(96,165,250,.7)' : 'none',
              }}/>
              <span style={{ fontFamily: COND, fontSize: 9.5, fontWeight: 800,
                letterSpacing: '.12em',
                color: isOnline ? 'rgba(96,165,250,.7)' : 'rgba(255,255,255,.28)' }}>
                {isOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
          </div>
        </div>

        {/* GPS coords */}
        {typeof driver.lat === 'number' && (
          <div style={{
            fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,.28)',
            padding: '6px 10px', borderRadius: 8, marginBottom: 14,
            background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)',
          }}>
            {driver.lat.toFixed(5)}, {driver.lng.toFixed(5)}
          </div>
        )}

        <div style={{ height: 1, background: 'rgba(34,197,94,.1)', marginBottom: 14 }}/>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <a
            href={phone ? `tel:${phone}` : undefined}
            onClick={!phone ? e => e.preventDefault() : undefined}
            style={{
              flex: 1, padding: '12px 0', borderRadius: 13, textDecoration: 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
              background: phone ? 'rgba(74,222,128,.1)' : 'rgba(255,255,255,.04)',
              border: `1px solid ${phone ? 'rgba(74,222,128,.28)' : 'rgba(255,255,255,.08)'}`,
              cursor: phone ? 'pointer' : 'default',
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
              stroke={phone ? '#4ADE80' : 'rgba(255,255,255,.2)'}
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 10.34 19.79 19.79 0 0 1 1.61 1.72 2 2 0 0 1 3.58 0h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 7.91a16 16 0 0 0 6.06 6.06l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z"/>
            </svg>
            <span style={{ fontFamily: COND, fontSize: 9.5, fontWeight: 800,
              letterSpacing: '.12em', color: phone ? '#4ADE80' : 'rgba(255,255,255,.2)' }}>
              {phone ? 'CALL' : 'NO PHONE'}
            </span>
          </a>

          <button
            style={{
              flex: 1, padding: '12px 0', borderRadius: 13,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
              background: 'rgba(96,165,250,.1)', border: '1px solid rgba(96,165,250,.28)',
              cursor: 'pointer',
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
              stroke="#60A5FA" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="12" cy="8" r="4"/>
              <path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
            </svg>
            <span style={{ fontFamily: COND, fontSize: 9.5, fontWeight: 800,
              letterSpacing: '.12em', color: '#60A5FA' }}>
              PROFILE
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function Admin({
  drivers        = [],
  accounts       = [],
  searches       = [],
  scheduledRides = [],
  views          = [],
}) {
  const mapContainerRef   = useRef(null);
  const mapRef            = useRef(null);
  const searchMarkersRef  = useRef(new Map());
  const driverMarkersRef  = useRef(new Map());
  const driverStatusRef   = useRef(new Map());
  const accountMarkersRef = useRef(new Map());
  const driverDataRef     = useRef(new Map()); // id → full driver object for modal

  const [mapReady,       setMapReady]       = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);

  const onlineCount = useMemo(() => drivers.filter(d => d.status === 'online').length, [drivers]);

  // ── Init Mapbox ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return;

    const link   = document.createElement('link');
    link.rel     = 'stylesheet';
    link.href    = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css';
    const script = document.createElement('script');
    script.src   = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js';
    script.async = true;
    document.head.appendChild(link);
    document.head.appendChild(script);

    script.onload = () => {
      if (!mapContainerRef.current) return;
      const mapboxgl       = window.mapboxgl;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container:          mapContainerRef.current,
        style:              MAP_STYLE,
        center:             [ORL_LNG, ORL_LAT],
        zoom:               11,
        pitch:              40,
        bearing:            -20,
        interactive:        true,
        attributionControl: false,
        antialias:          true,
        fadeDuration:       400,
      });

      map.on('load', () => {
        mapRef.current = map;

        map.addSource('ua-searches',  { type: 'geojson', data: emptyGeoJSON() });
        map.addSource('ua-scheduled', { type: 'geojson', data: emptyGeoJSON() });

        map.addLayer({
          id: 'ua-demand', type: 'heatmap', source: 'ua-searches',
          paint: {
            'heatmap-weight':    ['interpolate', ['linear'], ['get', 'age'], 0, 0.2, 1, 1],
            'heatmap-intensity': 0.6,
            'heatmap-radius':    38,
            'heatmap-opacity':   0.28,
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0,   'rgba(0,0,0,0)',
              0.2, 'rgba(16,80,45,0.25)',
              0.5, 'rgba(34,197,94,0.35)',
              0.8, 'rgba(251,191,36,0.4)',
              1,   'rgba(251,146,60,0.55)',
            ],
          },
        });
        map.addLayer({ id: 'ua-search-halo', type: 'circle', source: 'ua-searches', paint: {
          'circle-radius':       12,
          'circle-color':        'rgba(52,211,153,0)',
          'circle-stroke-color': 'rgba(52,211,153,0.4)',
          'circle-stroke-width': 1.5,
          'circle-opacity':      ['*', ['get', 'age'], 0.55],
        }});
        map.addLayer({ id: 'ua-search-dot', type: 'circle', source: 'ua-searches', paint: {
          'circle-radius':       5,
          'circle-color':        ['case', ['get', 'guest'], 'rgba(251,146,60,0.95)', 'rgba(52,211,153,0.95)'],
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1.5,
          'circle-opacity':      ['*', ['get', 'age'], 0.9],
        }});
        map.addLayer({ id: 'ua-sched-dot', type: 'circle', source: 'ua-scheduled', paint: {
          'circle-radius':       7,
          'circle-color':        'rgba(192,132,252,0.9)',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1.8,
        }});

        let t = 0;
        const pulse = setInterval(() => {
          if (!map.isStyleLoaded()) return;
          t += 0.06;
          const r = 9 + 9 * ((Math.sin(t) + 1) / 2);
          try {
            map.setPaintProperty('ua-search-halo', 'circle-radius', r);
            map.setPaintProperty('ua-search-halo', 'circle-stroke-width', 1 + 1.2 * ((Math.sin(t) + 1) / 2));
          } catch {}
        }, 40);
        map.on('remove', () => clearInterval(pulse));

        setMapReady(true);
      });
    };

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; setMapReady(false); }
    };
  }, []); // eslint-disable-line

  // ── Update GeoJSON sources ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const apply = () => {
      map.getSource('ua-searches') ?.setData(buildSearchGeoJSON(searches));
      map.getSource('ua-scheduled')?.setData(buildScheduledGeoJSON(scheduledRides));
    };
    if (map.isStyleLoaded()) apply(); else map.once('styledata', apply);
  }, [searches, scheduledRides, mapReady]);

  // ── Driver markers ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.mapboxgl) return;
    const store     = driverMarkersRef.current;
    const statusMap = driverStatusRef.current;
    const dataMap   = driverDataRef.current;
    const seen      = new Set();

    // keep data map current for click handlers
    drivers.forEach(d => { if (d.id) dataMap.set(d.id, d); });

    drivers.forEach(({ id, lat, lng, status: dStatus }) => {
      if (typeof lat !== 'number' || typeof lng !== 'number') return;
      seen.add(id);
      const isOnline = dStatus === 'online';
      if (store.has(id) && statusMap.get(id) !== isOnline) {
        try { store.get(id).remove(); } catch {}
        store.delete(id); statusMap.delete(id);
      }
      if (store.has(id)) {
        try { store.get(id).setLngLat([lng, lat]); } catch {}
      } else {
        const el = isOnline ? makeDriverDotEl() : makeOfflineDriverDotEl();
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelectedDriver(dataMap.get(id) ?? null);
        });
        const marker = new window.mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([lng, lat]).addTo(mapRef.current);
        store.set(id, marker); statusMap.set(id, isOnline);
      }
    });
    store.forEach((m, id) => {
      if (!seen.has(id)) { try { m.remove(); } catch {} store.delete(id); statusMap.delete(id); }
    });
  }, [drivers, mapReady]);

  // ── Account markers ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.mapboxgl) return;
    const store = accountMarkersRef.current;
    const seen  = new Set();
    accounts.forEach(({ uid: aUid, lat, lng }) => {
      if (typeof lat !== 'number' || typeof lng !== 'number') return;
      seen.add(aUid);
      if (store.has(aUid)) {
        try { store.get(aUid).setLngLat([lng, lat]); } catch {}
      } else {
        const marker = new window.mapboxgl.Marker({ element: makeAccountDotEl(), anchor: 'center' })
          .setLngLat([lng, lat]).addTo(mapRef.current);
        store.set(aUid, marker);
      }
    });
    store.forEach((m, id) => {
      if (!seen.has(id)) { try { m.remove(); } catch {} store.delete(id); }
    });
  }, [accounts, mapReady]);

  // ── Search ring markers ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.mapboxgl) return;
    const store = searchMarkersRef.current;
    const seen  = new Set();
    searches.filter(s => typeof s.pickupLat === 'number').forEach(s => {
      seen.add(s.id);
      if (!store.has(s.id)) {
        const el = makeSearchRingEl(!s.uid || s.uid === 'null');
        const m  = new window.mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([s.pickupLng, s.pickupLat]).addTo(mapRef.current);
        store.set(s.id, m);
      }
    });
    store.forEach((m, id) => {
      if (!seen.has(id)) { try { m.remove(); } catch {} store.delete(id); }
    });
  }, [searches, mapReady]);

  // ── Cleanup on map unload ───────────────────────────────────────────────────
  useEffect(() => {
    if (mapReady) return;
    [searchMarkersRef, driverMarkersRef, accountMarkersRef].forEach(ref => {
      ref.current.forEach(m => { try { m.remove(); } catch {} });
      ref.current.clear();
    });
    driverStatusRef.current.clear();
  }, [mapReady]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{KEYFRAMES}</style>
      <div style={{ position: 'fixed', inset: 0, background: C.bg, overflow: 'hidden' }}>

        {/* Mapbox */}
        <div ref={mapContainerRef} style={{
          position: 'absolute', inset: 0,
          opacity: mapReady ? 1 : 0, transition: 'opacity .7s ease',
        }}/>

        {/* Layers */}
        <AtmosphereOverlay/>
        <ScanlineOverlay/>
        <CornerBrackets/>

        {/* Admin status card */}
        <AdminStatusCard
          onlineCount={onlineCount}
          accounts={accounts}
          searches={searches}
          scheduledRides={scheduledRides}
          views={views}
        />

        {/* Rotating status chips */}
        {mapReady && (
          <AdminBadge
            onlineCount={onlineCount}
            totalFleet={drivers.length}
            searchCount={searches.length}
            scheduledCount={scheduledRides.length}
          />
        )}

        {/* Driver detail modal */}
        {selectedDriver && (
          <DriverModal
            driver={selectedDriver}
            onClose={() => setSelectedDriver(null)}
          />
        )}

      </div>
    </>
  );
}
