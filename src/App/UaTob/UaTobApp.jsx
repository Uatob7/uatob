/**
 * UaTobApp.jsx  — Rider-facing full-screen Mapbox HUD
 *
 * Props:
 *   uid               string
 *   rides             array   — rider's ride history / active rides
 *   searches          array   — live search pool (for ambient heatmap)
 *   scheduledRides    array   — rider's own scheduled rides
 *   callSaveFcmToken  fn      — saves FCM push token to Firestore
 */

import { useState, useEffect, useRef, useCallback } from "react";
import StatusCard, { FACE_BOOK, FACE_COUNT } from '@/App/UaTob/StatusCard';
// ─── Design tokens ──────────────────────────────────────────────────────────
const C = {
  bg:          '#050A06',
  bgDeep:      '#030604',
  green:       '#22C55E',
  greenBright: '#4ADE80',
  greenSoft:   '#34D399',
  inkTextDim:  'rgba(255,255,255,.22)',
  inkTextFade: 'rgba(255,255,255,.10)',
};

const MONO = "'JetBrains Mono','SFMono-Regular',monospace";
const COND = "'Barlow Condensed','Barlow',sans-serif";

const MAPBOX_TOKEN = 'pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA';
const MAP_STYLE    = 'mapbox://styles/mapbox/dark-v11';

const ORL_LNG = -81.3792;
const ORL_LAT =  28.5383;

// ─── Helpers ────────────────────────────────────────────────────────────────
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

// ─── Keyframe CSS ────────────────────────────────────────────────────────────
const KEYFRAMES = `
  @keyframes uaSpin       { to { transform: rotate(360deg); } }
  @keyframes uaSlideUp    { from{opacity:0;transform:translateY(14px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes uaSlideDown  { from{opacity:0;transform:translateY(-10px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes uaFadeIn     { from{opacity:0} to{opacity:1} }
  @keyframes uaBlink      { 0%,100%{opacity:1} 50%{opacity:.22} }
  @keyframes uaRingPulse  { 0%,100%{transform:scale(1);opacity:.18} 50%{transform:scale(1.48);opacity:0} }
  @keyframes uaScan       { from{top:-80px} to{top:100%} }
  @keyframes uaBarPulse   { 0%,100%{transform:scaleY(.5);opacity:.45} 50%{transform:scaleY(1);opacity:1} }
  @keyframes uaCardFlip   { 0%{opacity:0;transform:translateY(8px) scale(.98)} 100%{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes uaGlowPulse  { 0%,100%{box-shadow:0 0 18px rgba(74,222,128,.25)} 50%{box-shadow:0 0 38px rgba(74,222,128,.55)} }
`;

// ─── HUD-only icons (not used by StatusCard) ─────────────────────────────────
function Icon({ name, size = 16, color = 'currentColor', stroke = 1.8 }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'chat': return <svg {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
    case 'pin':  return <svg {...p}><path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>;
    case 'sat':  return <svg {...p}><path d="M4 13a8 8 0 0 1 7 7M4 17a4 4 0 0 1 3 3"/><circle cx="6" cy="19" r="1"/><path d="M12 3l4 4-3 3-4-4 3-3ZM15 9l4 4-3 3"/></svg>;
    default:     return null;
  }
}

function SignalBars({ active = true, color = C.greenBright }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 13 }}>
      {[5, 8, 11, 14].map((h, i) => (
        <div key={i} style={{
          width: 2.5, height: h, borderRadius: 1,
          background: active ? color : 'rgba(255,255,255,.13)',
          boxShadow: active ? `0 0 4px ${color}88` : 'none',
          animation: active ? `uaBarPulse 1.6s ease-in-out ${i * 0.18}s infinite` : 'none',
        }}/>
      ))}
    </div>
  );
}

// ─── Top Ribbon ──────────────────────────────────────────────────────────────
function TopRibbon({ now, mapReady }) {
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: 28, zIndex: 24,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 14px', pointerEvents: 'none',
      background: 'linear-gradient(180deg, rgba(3,6,4,.88), rgba(3,6,4,0))',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{
          fontFamily: COND, fontSize: 11, fontWeight: 800, letterSpacing: '.22em',
          color: 'rgba(255,255,255,.52)',
        }}>UATOB</span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: C.inkTextFade }}>·</span>
        <span style={{
          fontFamily: COND, fontSize: 9.5, fontWeight: 700, letterSpacing: '.16em',
          color: C.inkTextDim,
        }}>RIDER</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%', background: C.greenBright,
            boxShadow: `0 0 7px ${C.greenBright}`,
            animation: 'uaBlink 1.6s ease-in-out infinite',
          }}/>
          <span style={{
            fontFamily: MONO, fontSize: 9.5, fontWeight: 800,
            letterSpacing: '.08em', color: C.greenBright,
          }}>{mapReady ? 'LIVE' : 'SYNC'}</span>
        </div>
        <span style={{
          fontFamily: MONO, fontSize: 10, fontWeight: 700,
          color: 'rgba(255,255,255,.4)',
        }}>{fmtClock(now)}</span>
        <Icon name="sat" size={11} color={C.greenSoft}/>
        <SignalBars active={true}/>
      </div>
    </div>
  );
}

// ─── Radar SVG overlay ───────────────────────────────────────────────────────
function RadarOverlay({ svgRef }) {
  return (
    <svg ref={svgRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}
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
    <div style={{
      position: 'absolute', inset: 0, zIndex: 8, pointerEvents: 'none',
      mixBlendMode: 'screen', opacity: .45,
    }}>
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
        { top: off, left: off,    bt: 1, bl: 1 },
        { top: off, right: off,   bt: 1, br: 1 },
        { bottom: off, left: off, bb: 1, bl: 1 },
        { bottom: off, right: off,bb: 1, br: 1 },
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

// ─── Support FAB ─────────────────────────────────────────────────────────────
function SupportFab({ onOpen }) {
  return (
    <button onClick={onOpen} style={{
      position: 'absolute', bottom: 100, right: 16, zIndex: 26,
      width: 44, height: 44, borderRadius: 14, cursor: 'pointer',
      background: 'rgba(5,10,6,.78)', backdropFilter: 'blur(10px)',
      border: '1.5px solid rgba(34,197,94,.3)',
      boxShadow: '0 6px 20px rgba(0,0,0,.5), 0 0 14px rgba(34,197,94,.15)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'uaSlideUp .4s ease both',
    }} aria-label="Support">
      <Icon name="chat" size={18} color={C.greenBright}/>
    </button>
  );
}

// ─── GeoJSON helpers ─────────────────────────────────────────────────────────
function buildSearchGeoJSON(searches = []) {
  return {
    type: 'FeatureCollection',
    features: searches.filter(hasCoords).map(s => ({
      type: 'Feature',
      properties: {
        guest: !s.uid || s.uid === 'null',
        age:   Math.min(1, Math.max(0, 1 - (Date.now() - tsToMillis(s.createdAt)) / (3 * 3600_000))),
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

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function UaTob({ uid, rides = [], searches = [], scheduledRides = [], callSaveFcmToken }) {

  console.log('[UaTob] Rendering with props:', { uid, rides, searches, scheduledRides });
  const mapContainerRef = useRef(null);
  const mapRef          = useRef(null);
  const sweepRef        = useRef(0);
  const rafRef          = useRef(null);
  const svgRef          = useRef(null);
  const pulseRef        = useRef(false);

  const [mapReady, setMapReady] = useState(false);
  const [now,      setNow]      = useState(Date.now());
  const [face,     setFace]     = useState(FACE_BOOK);

  // 1 Hz clock
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Init Mapbox ────────────────────────────────────────────────────────────
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
        zoom:               12,
        pitch:              45,
        bearing:            -20,
        interactive:        false,
        attributionControl: false,
      });

      map.on('load', () => {
        mapRef.current = map;

        map.addSource('ua-searches',  { type: 'geojson', data: buildSearchGeoJSON(searches) });
        map.addSource('ua-scheduled', { type: 'geojson', data: buildScheduledGeoJSON(scheduledRides) });

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

        pulseRef.current = true;

        let bearing = -20;
        const drift = setInterval(() => { bearing += 0.03; map.setBearing(bearing); }, 120);
        map.on('remove', () => clearInterval(drift));

        let t = 0;
        const pulse = setInterval(() => {
          if (!map.isStyleLoaded()) return;
          t += 0.06;
          const r = 9 + 9 * ((Math.sin(t) + 1) / 2);
          try {
            map.setPaintProperty('ua-search-halo', 'circle-radius', r);
            map.setPaintProperty('ua-search-halo', 'circle-stroke-width', 1 + 1.2 * ((Math.sin(t) + 1) / 2));
          } catch (e) {}
        }, 40);
        map.on('remove', () => clearInterval(pulse));

        setMapReady(true);
      });
    };

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current   = null;
        pulseRef.current = false;
        setMapReady(false);
      }
    };
  }, []); // eslint-disable-line

  // ── Update GeoJSON on data change ──────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const apply = () => {
      map.getSource('ua-searches') ?.setData(buildSearchGeoJSON(searches));
      map.getSource('ua-scheduled')?.setData(buildScheduledGeoJSON(scheduledRides));
    };
    if (map.isStyleLoaded()) apply(); else map.once('styledata', apply);
  }, [searches, scheduledRides, mapReady]);

  // ── Radar sweep RAF ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) { cancelAnimationFrame(rafRef.current); return; }
    const animate = () => {
      sweepRef.current = (sweepRef.current + 1.1) % 360;
      if (svgRef.current) {
        const angle = sweepRef.current;
        const toRad = d => d * Math.PI / 180;
        const R = 55;
        const leadA   = (angle + 80) % 360;
        const trailX  = 50 + R * Math.cos(toRad(angle));
        const trailY  = 50 + R * Math.sin(toRad(angle));
        const leadX   = 50 + R * Math.cos(toRad(leadA));
        const leadY   = 50 + R * Math.sin(toRad(leadA));
        const tipX    = 50 + 52 * Math.cos(toRad(leadA));
        const tipY    = 50 + 52 * Math.sin(toRad(leadA));
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

  const handleBook = useCallback(() => {
    console.log('[UaTob] Book ride tapped');
  }, []);

  const handleOpenSupport = useCallback(() => {
    console.log('[UaTob] Support tapped');
  }, []);

  return (
    <>
      <style>{KEYFRAMES}</style>

      <div style={{ position: 'fixed', inset: 0, background: C.bg, overflow: 'hidden' }}>

        {/* Mapbox canvas */}
        <div ref={mapContainerRef} style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          opacity: mapReady ? 1 : 0, transition: 'opacity .7s ease',
        }}/>

        {/* Map loading spinner */}
        {!mapReady && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 9,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
          }}>
            {[60, 110, 160].map((r, i) => (
              <div key={i} style={{
                position: 'absolute', width: r * 2, height: r * 2, borderRadius: '50%',
                border: '1px solid rgba(34,197,94,.07)',
                animation: `uaRingPulse ${2.6 + i * 0.5}s ease-in-out ${i * 0.35}s infinite`,
              }}/>
            ))}
            <div style={{
              width: 38, height: 38, borderRadius: '50%',
              border: '2px solid rgba(34,197,94,.15)', borderTop: `2px solid ${C.green}`,
              animation: 'uaSpin .9s linear infinite', position: 'relative', zIndex: 1,
            }}/>
            <span style={{
              fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '.1em',
              color: 'rgba(255,255,255,.3)', position: 'relative', zIndex: 1,
            }}>acquiring map…</span>
          </div>
        )}

        {/* Atmospheric layers */}
        <AtmosphereOverlay/>
        <RadarOverlay svgRef={svgRef}/>
        <ScanlineOverlay/>
        <CornerBrackets/>

        {/* Top ribbon */}
        <TopRibbon now={now} mapReady={mapReady}/>

        {/* Status card */}
        <div style={{
          position: 'absolute',
          top: 36, left: 0, right: 0,
          zIndex: 30,
          display: 'flex',
          justifyContent: 'center',
          padding: '0 16px',
          pointerEvents: 'none',
        }}>
          <div style={{
            width: '100%',
            maxWidth: 340,
            pointerEvents: 'auto',
            animation: 'uaSlideDown .5s cubic-bezier(.34,1.2,.64,1) both',
            filter: 'drop-shadow(0 10px 32px rgba(0,0,0,.55))',
          }}>
            <StatusCard
              face={face}
              onFaceChange={setFace}
              rides={rides}
              searches={searches}
              scheduledRides={scheduledRides}
              now={now}
              callSaveFcmToken={callSaveFcmToken}
              onBook={handleBook}
            />
          </div>
        </div>

        {/* Support FAB */}
        <SupportFab onOpen={handleOpenSupport}/>

        {/* Bottom city label */}
        <div style={{
          position: 'absolute', bottom: 48, left: 0, right: 0,
          display: 'flex', justifyContent: 'center', zIndex: 18,
          pointerEvents: 'none',
          animation: 'uaFadeIn .8s ease .4s both',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '4px 14px', borderRadius: 99,
            background: 'rgba(5,10,6,.55)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(34,197,94,.12)',
          }}>
            <Icon name="pin" size={10} color={C.greenBright}/>
            <span style={{
              fontFamily: COND, fontSize: 10, fontWeight: 800, letterSpacing: '.18em',
              color: 'rgba(255,255,255,.35)',
            }}>ORLANDO · FL</span>
          </div>
        </div>

      </div>
    </>
  );
}
