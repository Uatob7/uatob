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

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useDriverCounts } from '@/App/UaTob/useDriverCounts';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:           '#050A06',
  green:        '#22C55E',
  greenBright:  '#4ADE80',
  greenSoft:    '#34D399',
  cyan:         '#22D3EE',
  amber:        '#FBBF24',
  red:          '#F87171',
  blue:         '#60A5FA',
  purple:       '#C084FC',
  inkDim:       'rgba(255,255,255,.22)',
  inkMid:       'rgba(255,255,255,.45)',
  inkBright:    'rgba(255,255,255,.88)',
  border:       'rgba(34,197,94,.15)',
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
  @keyframes uaScan      { from{top:-80px} to{top:100%} }
  @keyframes ua-driver-pulse { 0%{transform:translate(-50%,-50%) scale(.4);opacity:.7} 100%{transform:translate(-50%,-50%) scale(2.2);opacity:0} }
  @keyframes ua-ring-out { 0%{transform:translate(-50%,-50%) scale(.2);opacity:.9} 100%{transform:translate(-50%,-50%) scale(2.8);opacity:0} }
  @keyframes adScan { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
  @keyframes adFaceIn { 0%{opacity:0;transform:translateY(6px) scale(.98)} 100%{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes adRadar { 0%{transform:scale(.6);opacity:.7} 100%{transform:scale(2.6);opacity:0} }
  @keyframes adBracket { 0%,100%{opacity:.35} 50%{opacity:.7} }
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

// ─── Admin Status Card ────────────────────────────────────────────────────────
const FACES    = ['drivers', 'riders', 'scheduled', 'searches', 'views'];
const FACE_MS  = 4500;

const FACE_CFG = {
  drivers:   { label: 'DRIVERS',   color: '#60A5FA', scan: 'rgba(96,165,250,.6)'  },
  riders:    { label: 'RIDERS',    color: '#FBBF24', scan: 'rgba(251,191,36,.55)' },
  scheduled: { label: 'SCHEDULED', color: '#C084FC', scan: 'rgba(192,132,252,.55)'},
  searches:  { label: 'SEARCHES',  color: '#4ADE80', scan: 'rgba(74,222,128,.55)' },
  views:     { label: 'VIEWS',     color: '#22D3EE', scan: 'rgba(34,211,238,.55)' },
};

function FaceDrivers({ onlineCount, total }) {
  const offline = total - onlineCount;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '3px 10px', borderRadius: 99, alignSelf: 'flex-start',
        background: 'rgba(96,165,250,.12)', border: '1px solid rgba(96,165,250,.25)' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#60A5FA',
          boxShadow: '0 0 6px #60A5FA', animation: 'uaBlink 1.8s ease-in-out infinite' }}/>
        <span style={{ fontFamily: COND, fontSize: 10, fontWeight: 800,
          letterSpacing: '.14em', color: '#60A5FA' }}>DRIVERS</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 44, fontWeight: 800,
            color: '#60A5FA', lineHeight: 1,
            textShadow: '0 0 30px rgba(96,165,250,.45)' }}>
            {onlineCount}
          </div>
          <div style={{ fontFamily: COND, fontSize: 11, fontWeight: 700,
            letterSpacing: '.18em', color: 'rgba(96,165,250,.6)', marginTop: 3 }}>
            ONLINE
          </div>
        </div>
        <div style={{ paddingBottom: 8 }}>
          <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700,
            color: 'rgba(255,255,255,.38)', lineHeight: 1 }}>
            {total}
          </div>
          <div style={{ fontFamily: COND, fontSize: 9.5, fontWeight: 700,
            letterSpacing: '.14em', color: C.inkDim }}>
            TOTAL
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%',
          background: 'rgba(255,255,255,.22)', flexShrink: 0 }}/>
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.inkMid }}>
          {offline} offline
        </span>
      </div>
    </div>
  );
}

function FaceRiders({ ridersOnMap, total }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '3px 10px', borderRadius: 99, alignSelf: 'flex-start',
        background: 'rgba(251,191,36,.12)', border: '1px solid rgba(251,191,36,.25)' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#FBBF24',
          boxShadow: '0 0 6px #FBBF24', animation: 'uaBlink 1.8s ease-in-out infinite' }}/>
        <span style={{ fontFamily: COND, fontSize: 10, fontWeight: 800,
          letterSpacing: '.14em', color: '#FBBF24' }}>RIDERS</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 44, fontWeight: 800,
            color: '#FBBF24', lineHeight: 1,
            textShadow: '0 0 30px rgba(251,191,36,.45)' }}>
            {ridersOnMap}
          </div>
          <div style={{ fontFamily: COND, fontSize: 11, fontWeight: 700,
            letterSpacing: '.18em', color: 'rgba(251,191,36,.6)', marginTop: 3 }}>
            ON MAP
          </div>
        </div>
        <div style={{ paddingBottom: 8 }}>
          <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700,
            color: 'rgba(255,255,255,.38)', lineHeight: 1 }}>
            {total}
          </div>
          <div style={{ fontFamily: COND, fontSize: 9.5, fontWeight: 700,
            letterSpacing: '.14em', color: C.inkDim }}>
            ACCOUNTS
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%',
          background: '#FBBF24', boxShadow: '0 0 5px rgba(251,191,36,.6)', flexShrink: 0 }}/>
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.inkMid }}>
          {total - ridersOnMap} without location
        </span>
      </div>
    </div>
  );
}

function FaceScheduled({ count }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '3px 10px', borderRadius: 99, alignSelf: 'flex-start',
        background: 'rgba(192,132,252,.12)', border: '1px solid rgba(192,132,252,.25)' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#C084FC',
          boxShadow: '0 0 6px #C084FC', animation: 'uaBlink 1.8s ease-in-out infinite' }}/>
        <span style={{ fontFamily: COND, fontSize: 10, fontWeight: 800,
          letterSpacing: '.14em', color: '#C084FC' }}>SCHEDULED</span>
      </div>
      <div>
        <div style={{ fontFamily: MONO, fontSize: 44, fontWeight: 800,
          color: '#C084FC', lineHeight: 1,
          textShadow: '0 0 30px rgba(192,132,252,.45)' }}>
          {count}
        </div>
        <div style={{ fontFamily: COND, fontSize: 11, fontWeight: 700,
          letterSpacing: '.18em', color: 'rgba(192,132,252,.6)', marginTop: 3 }}>
          UPCOMING {count === 1 ? 'RIDE' : 'RIDES'}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%',
          background: '#C084FC', boxShadow: '0 0 5px rgba(192,132,252,.6)', flexShrink: 0,
          animation: count > 0 ? 'uaBlink 2s ease-in-out infinite' : 'none' }}/>
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.inkMid }}>
          {count > 0 ? 'pending dispatch' : 'queue clear'}
        </span>
      </div>
    </div>
  );
}

function FaceSearches({ count, guestCount }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '3px 10px', borderRadius: 99, alignSelf: 'flex-start',
        background: 'rgba(74,222,128,.12)', border: '1px solid rgba(74,222,128,.25)' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ADE80',
          boxShadow: '0 0 6px #4ADE80', animation: 'uaBlink 1.8s ease-in-out infinite' }}/>
        <span style={{ fontFamily: COND, fontSize: 10, fontWeight: 800,
          letterSpacing: '.14em', color: '#4ADE80' }}>SEARCHES</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 44, fontWeight: 800,
            color: '#4ADE80', lineHeight: 1,
            textShadow: '0 0 30px rgba(74,222,128,.45)' }}>
            {count}
          </div>
          <div style={{ fontFamily: COND, fontSize: 11, fontWeight: 700,
            letterSpacing: '.18em', color: 'rgba(74,222,128,.6)', marginTop: 3 }}>
            ACTIVE
          </div>
        </div>
        {guestCount > 0 && (
          <div style={{ paddingBottom: 8 }}>
            <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700,
              color: 'rgba(251,146,60,.7)', lineHeight: 1 }}>
              {guestCount}
            </div>
            <div style={{ fontFamily: COND, fontSize: 9.5, fontWeight: 700,
              letterSpacing: '.14em', color: 'rgba(251,146,60,.5)' }}>
              GUEST
            </div>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%',
          background: '#4ADE80', boxShadow: '0 0 5px rgba(74,222,128,.6)', flexShrink: 0,
          animation: count > 0 ? 'uaBlink 1.4s ease-in-out infinite' : 'none' }}/>
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.inkMid }}>
          {count > 0 ? 'live demand' : 'no active searches'}
        </span>
      </div>
    </div>
  );
}

function fmtSec(sec) {
  if (!sec || sec < 1) return '—';
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function deviceIcon(view) {
  const w = view?.screen?.w;
  if (!w) return '?';
  return w < 768 ? '📱' : '🖥';
}

function FaceViews({ views }) {
  const total  = views.length;
  const live   = views.filter(v => !v.exited).length;
  const recent = views.slice(0, 3);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '3px 10px', borderRadius: 99, alignSelf: 'flex-start',
        background: 'rgba(34,211,238,.12)', border: '1px solid rgba(34,211,238,.25)' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22D3EE',
          boxShadow: '0 0 6px #22D3EE', animation: 'uaBlink 1.8s ease-in-out infinite' }}/>
        <span style={{ fontFamily: COND, fontSize: 10, fontWeight: 800,
          letterSpacing: '.14em', color: '#22D3EE' }}>VIEWS</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 44, fontWeight: 800,
            color: '#22D3EE', lineHeight: 1,
            textShadow: '0 0 30px rgba(34,211,238,.45)' }}>
            {total}
          </div>
          <div style={{ fontFamily: COND, fontSize: 11, fontWeight: 700,
            letterSpacing: '.18em', color: 'rgba(34,211,238,.6)', marginTop: 3 }}>
            SESSIONS
          </div>
        </div>
        {live > 0 && (
          <div style={{ paddingBottom: 8 }}>
            <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700,
              color: '#4ADE80', lineHeight: 1 }}>
              {live}
            </div>
            <div style={{ fontFamily: COND, fontSize: 9.5, fontWeight: 700,
              letterSpacing: '.14em', color: 'rgba(74,222,128,.5)' }}>
              LIVE
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {recent.map((v, i) => (
          <div key={v.id || i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, lineHeight: 1 }}>{deviceIcon(v)}</span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,.55)',
              flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {v.path || '/'}
            </span>
            <span style={{ fontFamily: MONO, fontSize: 9, color: C.inkDim, flexShrink: 0 }}>
              {fmtSec(v.timeOnPageSec)}
            </span>
            <div style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
              background: !v.exited ? '#4ADE80' : 'rgba(255,255,255,.18)',
              boxShadow: !v.exited ? '0 0 5px rgba(74,222,128,.7)' : 'none' }}/>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminStatusCard({ driverCounts, onlineCount, accounts, searches, scheduledRides, views }) {
  const [faceIdx, setFaceIdx] = useState(0);
  const cycleRef    = useRef(null);
  const resumeRef   = useRef(null);
  const pausedRef   = useRef(false);
  const startRef    = useRef(null);

  const ridersOnMap  = useMemo(() => accounts.filter(a => typeof a.lat === 'number').length, [accounts]);
  const guestCount   = useMemo(() => searches.filter(s => !s.uid || s.uid === 'null').length, [searches]);

  const startCycle = useCallback(() => {
    clearInterval(cycleRef.current);
    if (pausedRef.current) return;
    cycleRef.current = setInterval(() => {
      setFaceIdx(i => (i + 1) % FACES.length);
    }, FACE_MS);
  }, []);

  useEffect(() => { startRef.current = startCycle; }, [startCycle]);

  useEffect(() => {
    startCycle();
    return () => { clearInterval(cycleRef.current); clearTimeout(resumeRef.current); };
  }, [startCycle]);

  const goFace = useCallback((i) => {
    clearInterval(cycleRef.current);
    clearTimeout(resumeRef.current);
    pausedRef.current = true;
    setFaceIdx(i);
    resumeRef.current = setTimeout(() => {
      pausedRef.current = false;
      startRef.current?.();
    }, 7000);
  }, []);

  const face = FACES[faceIdx];
  const cfg  = FACE_CFG[face];

  return (
    <div style={{
      position: 'absolute', top: 36, left: 0, right: 0, zIndex: 30,
      display: 'flex', justifyContent: 'center', padding: '0 16px',
      pointerEvents: 'none',
    }}>
      <div style={{
        width: '100%', maxWidth: 340, pointerEvents: 'auto',
        filter: 'drop-shadow(0 10px 32px rgba(0,0,0,.55))',
      }}>
        <div style={{ borderRadius: 22 }}>
          <div style={{
            background:           'rgba(3,7,4,.96)',
            backdropFilter:       'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border:               '1.5px solid rgba(34,197,94,.18)',
            borderRadius:         22,
            padding:              '18px 20px 14px',
            position:             'relative',
            overflow:             'hidden',
            boxShadow:            '0 20px 56px rgba(0,0,0,.55), 0 4px 14px rgba(0,0,0,.3)',
          }}>

            {/* Scan line — color identifies face */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 2,
              background: `linear-gradient(90deg,transparent,${cfg.scan},transparent)`,
              animation: 'adScan 3s linear infinite',
              pointerEvents: 'none',
            }}/>

            {/* Radar rings — searches face only */}
            {face === 'searches' && searches.length > 0 && (
              <>
                <div style={{ position: 'absolute', top: '50%', right: 60, width: 52, height: 52,
                  borderRadius: '50%', background: 'rgba(74,222,128,.1)',
                  transform: 'translateY(-50%)', animation: 'adRadar 2.4s ease-out infinite',
                  pointerEvents: 'none' }}/>
                <div style={{ position: 'absolute', top: '50%', right: 60, width: 52, height: 52,
                  borderRadius: '50%', background: 'rgba(74,222,128,.07)',
                  transform: 'translateY(-50%)', animation: 'adRadar 2.4s ease-out .8s infinite',
                  pointerEvents: 'none' }}/>
              </>
            )}

            {/* Face content */}
            <div
              key={face}
              className="ad-face"
              onClick={(e) => {
                if (e.target.closest('button,input,a')) return;
                goFace((faceIdx + 1) % FACES.length);
              }}
              style={{
                minHeight: 130, display: 'flex', flexDirection: 'column',
                justifyContent: 'center', cursor: 'pointer',
                animation: 'adFaceIn .38s cubic-bezier(.34,1.2,.64,1) both',
              }}
            >
              {face === 'drivers'   && <FaceDrivers   onlineCount={onlineCount} total={driverCounts.total}/>}
              {face === 'riders'    && <FaceRiders    ridersOnMap={ridersOnMap} total={accounts.length}/>}
              {face === 'scheduled' && <FaceScheduled count={scheduledRides.length}/>}
              {face === 'searches'  && <FaceSearches  count={searches.length} guestCount={guestCount}/>}
              {face === 'views'     && <FaceViews     views={views}/>}
            </div>

            {/* Dot pagination */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 14 }}>
              {FACES.map((f, i) => (
                <button key={f} onClick={() => goFace(i)} style={{
                  width: i === faceIdx ? 20 : 6, height: 6, borderRadius: 3,
                  border: 'none', padding: 0, cursor: 'pointer',
                  background: i === faceIdx ? FACE_CFG[f].color : 'rgba(255,255,255,.18)',
                  boxShadow: i === faceIdx ? `0 0 8px ${FACE_CFG[f].color}80` : 'none',
                  transition: 'all .28s ease', flexShrink: 0,
                }}/>
              ))}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Map legend ───────────────────────────────────────────────────────────────
function AdminLegend() {
  return (
    <div style={{
      position: 'absolute', bottom: 20, left: 16, zIndex: 18,
      display: 'flex', flexDirection: 'column', gap: 6,
      padding: '10px 14px', borderRadius: 12,
      background: 'rgba(5,10,6,.72)', backdropFilter: 'blur(10px)',
      border: `1px solid ${C.border}`, pointerEvents: 'none',
      animation: 'uaFadeIn .8s ease both',
    }}>
      {[
        { color: '#60A5FA',              label: 'Driver — online',  glow: true  },
        { color: 'rgba(255,255,255,.3)', label: 'Driver — offline', glow: false },
        { color: '#FBBF24',              label: 'Rider',            glow: true  },
        { color: '#4ADE80',              label: 'Search',           glow: true  },
        { color: '#C084FC',              label: 'Scheduled ride',   glow: true  },
      ].map(({ color, label, glow }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
            background: color, boxShadow: glow ? `0 0 6px ${color}` : 'none' }}/>
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
  views          = [],
}) {
  const mapContainerRef  = useRef(null);
  const mapRef           = useRef(null);
  const searchMarkersRef  = useRef(new Map());
  const driverMarkersRef  = useRef(new Map());
  const driverStatusRef   = useRef(new Map());
  const accountMarkersRef = useRef(new Map());

  const [mapReady, setMapReady] = useState(false);

  const onlineCount  = useMemo(() => drivers.filter(d => d.status === 'online').length, [drivers]);
  const driverCounts = useDriverCounts();

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
          driverCounts={driverCounts}
          onlineCount={onlineCount}
          accounts={accounts}
          searches={searches}
          scheduledRides={scheduledRides}
          views={views}
        />

        {/* Map legend */}
        {mapReady && <AdminLegend/>}

      </div>
    </>
  );
}
