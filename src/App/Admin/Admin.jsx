/**
 * Admin.jsx — Full-screen admin map HUD
 *
 * Props:
 *   uid            string
 *   drivers        array   — all driver docs (status, lat, lng, …)
 *   accounts       array   — all account docs (lat, lng, …)
 *   searches       array   — live search pool
 *   scheduledRides array   — scheduled rides
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { useDriverCounts } from '@/App/UaTob/useDriverCounts';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:           '#050A06',
  bgCard:       'rgba(5,12,7,0.82)',
  green:        '#22C55E',
  greenBright:  '#4ADE80',
  greenSoft:    '#34D399',
  cyan:         '#22D3EE',
  amber:        '#FBBF24',
  red:          '#F87171',
  purple:       '#C084FC',
  inkDim:       'rgba(255,255,255,.22)',
  inkFade:      'rgba(255,255,255,.10)',
  inkMid:       'rgba(255,255,255,.45)',
  inkBright:    'rgba(255,255,255,.88)',
  border:       'rgba(34,197,94,.15)',
  borderBright: 'rgba(74,222,128,.35)',
};

const MONO = "'JetBrains Mono','SFMono-Regular',monospace";
const COND = "'Barlow Condensed','Barlow',sans-serif";

const MAPBOX_TOKEN = 'pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA';
const MAP_STYLE    = 'mapbox://styles/mapbox/dark-v11';
const ORL_LNG      = -81.3792;
const ORL_LAT      =  28.5383;

// ─── Keyframes ────────────────────────────────────────────────────────────────
const KEYFRAMES = `
  @keyframes uaBlink     { 0%,100%{opacity:1} 50%{opacity:.22} }
  @keyframes uaFadeIn    { from{opacity:0} to{opacity:1} }
  @keyframes uaRingPulse { 0%,100%{transform:scale(1);opacity:.18} 50%{transform:scale(1.48);opacity:0} }
  @keyframes uaScan      { from{top:-80px} to{top:100%} }
  @keyframes ua-driver-pulse { 0%{transform:translate(-50%,-50%) scale(.4);opacity:.7} 100%{transform:translate(-50%,-50%) scale(2.2);opacity:0} }
  @keyframes ua-ring-out { 0%{transform:translate(-50%,-50%) scale(.2);opacity:.9} 100%{transform:translate(-50%,-50%) scale(2.8);opacity:0} }
`;

// ─── Utilities ────────────────────────────────────────────────────────────────
function tsToMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') { const p = Date.parse(ts); return isNaN(p) ? 0 : p; }
  return 0;
}
function fmtClock(ms) {
  const d = new Date(ms);
  const p = n => String(n).padStart(2, '0');
  const h = d.getHours(); const ap = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${p(d.getMinutes())}:${p(d.getSeconds())} ${ap}`;
}
function hasCoords(o) {
  return typeof o?.pickupLat === 'number' && typeof o?.pickupLng === 'number';
}
function toRad(deg) { return deg * Math.PI / 180; }

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
function emptyGeoJSON() {
  return { type: 'FeatureCollection', features: [] };
}

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
  wrap.style.cssText = 'position:relative;width:0;height:0;pointer-events:none;';
  [0, 0.9].forEach(delay => {
    const ring = document.createElement('div');
    ring.style.cssText = [
      'position:absolute','left:0','top:0','width:22px','height:22px','border-radius:50%',
      'border:1.5px solid rgba(96,165,250,.55)',
      'transform:translate(-50%,-50%) scale(.4)','opacity:0',
      `animation:ua-driver-pulse 2s ease-out ${delay}s infinite`,
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
  return wrap;
}

function makeOfflineDriverDotEl() {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;width:0;height:0;pointer-events:none;';
  const dot = document.createElement('div');
  dot.style.cssText = [
    'position:absolute','left:0','top:0','width:8px','height:8px','border-radius:50%',
    'background:rgba(255,255,255,.18)','border:1.5px solid rgba(255,255,255,.32)',
    'transform:translate(-50%,-50%)',
  ].join(';');
  wrap.appendChild(dot);
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
function RadarOverlay({ svgRef }) {
  return (
    <svg ref={svgRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 10 }}
      viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <radialGradient id="ua-sweepGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="rgba(34,197,94,0.45)"/>
          <stop offset="45%"  stopColor="rgba(34,197,94,0.12)"/>
          <stop offset="100%" stopColor="rgba(34,197,94,0)"/>
        </radialGradient>
        <radialGradient id="ua-sweepGrad2" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="rgba(74,222,128,0.16)"/>
          <stop offset="60%"  stopColor="rgba(74,222,128,0.04)"/>
          <stop offset="100%" stopColor="rgba(74,222,128,0)"/>
        </radialGradient>
        <radialGradient id="ua-vig" cx="50%" cy="50%" r="60%">
          <stop offset="30%" stopColor="transparent"/>
          <stop offset="100%" stopColor="rgba(0,0,0,0.6)"/>
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill="url(#ua-vig)"/>
      {[14, 25, 36, 47].map((r, i) => (
        <circle key={i} cx="50" cy="50" r={r} fill="none"
          stroke="rgba(34,197,94,0.09)" strokeWidth="0.25" strokeDasharray="1.2 2.4"/>
      ))}
      {Array.from({ length: 24 }).map((_, i) => {
        const a = i * 15 * Math.PI / 180; const major = i % 6 === 0;
        const r1 = major ? 45 : 46.4;
        const x1 = 50 + r1 * Math.sin(a), y1 = 50 - r1 * Math.cos(a);
        const x2 = 50 + 47.5 * Math.sin(a), y2 = 50 - 47.5 * Math.cos(a);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={major ? 'rgba(74,222,128,0.32)' : 'rgba(34,197,94,0.14)'}
          strokeWidth={major ? 0.4 : 0.22}/>;
      })}
      <line x1="46.5" y1="50" x2="53.5" y2="50" stroke="rgba(34,197,94,0.28)" strokeWidth="0.22"/>
      <line x1="50" y1="46.5" x2="50" y2="53.5" stroke="rgba(34,197,94,0.28)" strokeWidth="0.22"/>
      <circle cx="50" cy="50" r="0.75" fill="rgba(74,222,128,0.65)"/>
      <path id="ua-sweep2" d="M 50 50 L 50 0 A 55 55 0 0 1 50 0 Z" fill="url(#ua-sweepGrad2)" opacity="0.5"/>
      <path id="ua-sweep"  d="M 50 50 L 50 0 A 55 55 0 0 1 50 0 Z" fill="url(#ua-sweepGrad)"  opacity="0.75"/>
      <line id="ua-arm"    x1="50" y1="50" x2="50" y2="0" stroke="#4ADE80" strokeWidth="0.45" strokeLinecap="round" opacity="0.9"/>
      <circle id="ua-tipglow" cx="50" cy="0" r="2.2" fill="rgba(74,222,128,0.22)"/>
      <circle id="ua-tip"     cx="50" cy="0" r="1.1" fill="#4ADE80" opacity="0.95"/>
    </svg>
  );
}

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
          animation: 'uaBlink 4s ease-in-out infinite',
        }}/>
      ))}
    </div>
  );
}

// ─── Admin header ─────────────────────────────────────────────────────────────
function StatPill({ value, label, color, blink }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{
        width: 6, height: 6, borderRadius: '50%',
        background: color, boxShadow: `0 0 6px ${color}`,
        animation: blink ? 'uaBlink 1.8s ease-in-out infinite' : 'none',
      }}/>
      <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 800, color }}>{value}</span>
      <span style={{ fontFamily: COND, fontSize: 9.5, fontWeight: 700,
        letterSpacing: '.14em', color: C.inkDim }}>{label}</span>
    </div>
  );
}

function AdminHeader({ now, mapReady, driverCounts, onlineCount, searches, accounts }) {
  const ridersOnMap = accounts.filter(a => typeof a.lat === 'number').length;
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 24,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 16px', height: 46,
      background: 'linear-gradient(180deg, rgba(3,6,4,.94) 70%, transparent)',
      pointerEvents: 'none',
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: COND, fontSize: 15, fontWeight: 900,
          letterSpacing: '.22em', color: C.greenBright }}>UATOB</span>
        <span style={{
          fontFamily: COND, fontSize: 9.5, fontWeight: 700, letterSpacing: '.18em',
          color: C.inkMid, borderLeft: `1px solid ${C.border}`, paddingLeft: 8,
        }}>ADMIN</span>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <StatPill value={onlineCount}       label="ONLINE"    color={C.cyan}        blink={onlineCount > 0}/>
        <StatPill value={driverCounts.total} label="DRIVERS"   color={C.inkMid}      blink={false}/>
        <StatPill value={ridersOnMap}        label="RIDERS"    color={C.amber}       blink={ridersOnMap > 0}/>
        <StatPill value={searches.length}    label="SEARCHES"  color={C.greenBright} blink={searches.length > 0}/>
      </div>

      {/* Clock + live */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%', background: C.greenBright,
            boxShadow: `0 0 7px ${C.greenBright}`,
            animation: 'uaBlink 1.6s ease-in-out infinite',
          }}/>
          <span style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 800,
            letterSpacing: '.08em', color: C.greenBright }}>
            {mapReady ? 'LIVE' : 'SYNC'}
          </span>
        </div>
        <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700,
          color: 'rgba(255,255,255,.4)' }}>{fmtClock(now)}</span>
      </div>
    </div>
  );
}

// ─── Map legend ───────────────────────────────────────────────────────────────
function AdminLegend() {
  const items = [
    { color: '#60A5FA',              label: 'Driver — online',  glow: true },
    { color: 'rgba(255,255,255,.3)', label: 'Driver — offline', glow: false },
    { color: '#FBBF24',              label: 'Rider',            glow: true },
    { color: '#4ADE80',              label: 'Search',           glow: true },
    { color: '#C084FC',              label: 'Scheduled ride',   glow: true },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 20, left: 16, zIndex: 18,
      display: 'flex', flexDirection: 'column', gap: 6,
      padding: '10px 14px', borderRadius: 12,
      background: 'rgba(5,10,6,.72)', backdropFilter: 'blur(10px)',
      border: `1px solid ${C.border}`, pointerEvents: 'none',
      animation: 'uaFadeIn .8s ease both',
    }}>
      {items.map(({ color, label, glow }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
            background: color,
            boxShadow: glow ? `0 0 6px ${color}` : 'none',
          }}/>
          <span style={{ fontFamily: COND, fontSize: 10.5, fontWeight: 600,
            letterSpacing: '.06em', color: C.inkMid }}>{label}</span>
        </div>
      ))}
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
}) {
  const mapContainerRef  = useRef(null);
  const mapRef           = useRef(null);
  const svgRef           = useRef(null);
  const sweepRef         = useRef(0);
  const rafRef           = useRef(null);
  const searchMarkersRef  = useRef(new Map());
  const driverMarkersRef  = useRef(new Map());
  const driverStatusRef   = useRef(new Map());
  const accountMarkersRef = useRef(new Map());

  const [mapReady, setMapReady] = useState(false);
  const [now,      setNow]      = useState(Date.now());

  const onlineCount  = useMemo(() => drivers.filter(d => d.status === 'online').length, [drivers]);
  const driverCounts = useDriverCounts();

  // 1 Hz clock
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

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

        // Demand heatmap
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
          'circle-blur':         0.1,
          'circle-opacity':      ['*', ['get', 'age'], 0.9],
        }});
        map.addLayer({ id: 'ua-sched-dot', type: 'circle', source: 'ua-scheduled', paint: {
          'circle-radius':       7,
          'circle-color':        'rgba(192,132,252,0.9)',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1.8,
        }});

        // Ambient search pulse
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

  // ── Driver markers — online (blue pulse) + offline (dim dot) ────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.mapboxgl) return;
    const store     = driverMarkersRef.current;
    const statusMap = driverStatusRef.current;
    const seen      = new Set();
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
        const marker = new window.mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([lng, lat]).addTo(mapRef.current);
        store.set(id, marker); statusMap.set(id, isOnline);
      }
    });
    store.forEach((m, id) => {
      if (!seen.has(id)) { try { m.remove(); } catch {} store.delete(id); statusMap.delete(id); }
    });
  }, [drivers, mapReady]);

  // ── Account (rider) markers ─────────────────────────────────────────────────
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

  // ── Cleanup markers when map unloads ────────────────────────────────────────
  useEffect(() => {
    if (mapReady) return;
    [searchMarkersRef, driverMarkersRef, accountMarkersRef].forEach(ref => {
      ref.current.forEach(m => { try { m.remove(); } catch {} });
      ref.current.clear();
    });
    driverStatusRef.current.clear();
  }, [mapReady]);

  // ── Radar sweep RAF ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) { cancelAnimationFrame(rafRef.current); return; }
    const animate = () => {
      sweepRef.current = (sweepRef.current + 1.1) % 360;
      if (svgRef.current) {
        const angle  = sweepRef.current;
        const R      = 55;
        const leadA  = (angle + 80) % 360;
        const trailX = 50 + R * Math.cos(toRad(angle));
        const trailY = 50 + R * Math.sin(toRad(angle));
        const leadX  = 50 + R * Math.cos(toRad(leadA));
        const leadY  = 50 + R * Math.sin(toRad(leadA));
        const tipX   = 50 + 52 * Math.cos(toRad(leadA));
        const tipY   = 50 + 52 * Math.sin(toRad(leadA));
        const cAngle  = (360 - angle * 0.6) % 360;
        const cLead   = (cAngle + 60) % 360;
        const cTrailX = 50 + R * Math.cos(toRad(cAngle));
        const cTrailY = 50 + R * Math.sin(toRad(cAngle));
        const cLeadX  = 50 + R * Math.cos(toRad(cLead));
        const cLeadY  = 50 + R * Math.sin(toRad(cLead));
        const q = svgRef.current.querySelector.bind(svgRef.current);
        q('#ua-sweep') ?.setAttribute('d', `M 50 50 L ${trailX} ${trailY} A ${R} ${R} 0 0 1 ${leadX} ${leadY} Z`);
        q('#ua-sweep2')?.setAttribute('d', `M 50 50 L ${cTrailX} ${cTrailY} A ${R} ${R} 0 0 1 ${cLeadX} ${cLeadY} Z`);
        q('#ua-arm')   ?.setAttribute('x2', leadX);
        q('#ua-arm')   ?.setAttribute('y2', leadY);
        q('#ua-tip')   ?.setAttribute('cx', tipX);
        q('#ua-tip')   ?.setAttribute('cy', tipY);
        q('#ua-tipglow')?.setAttribute('cx', tipX);
        q('#ua-tipglow')?.setAttribute('cy', tipY);
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
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
        <RadarOverlay svgRef={svgRef}/>
        <ScanlineOverlay/>
        <CornerBrackets/>

        {/* Admin header */}
        <AdminHeader
          now={now}
          mapReady={mapReady}
          driverCounts={driverCounts}
          onlineCount={onlineCount}
          searches={searches}
          accounts={accounts}
        />

        {/* Map legend */}
        {mapReady && <AdminLegend/>}

      </div>
    </>
  );
}
