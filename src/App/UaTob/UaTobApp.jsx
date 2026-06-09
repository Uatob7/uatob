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

import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── Design tokens (mirrors driver app) ────────────────────────────────────
const C = {
  bg:          '#050A06',
  bgDeep:      '#030604',
  panel:       'rgba(5,10,6,.78)',
  panelSolid:  '#070D08',
  green:       '#22C55E',
  greenBright: '#4ADE80',
  greenSoft:   '#34D399',
  amber:       '#FB923C',
  amberBright: '#FBBF24',
  violet:      '#C084FC',
  cyan:        '#67E8F9',
  red:         '#F87171',
  line:        'rgba(34,197,94,.25)',
  lineSoft:    'rgba(34,197,94,.14)',
  inkText:     'rgba(255,255,255,.42)',
  inkTextDim:  'rgba(255,255,255,.22)',
  inkTextFade: 'rgba(255,255,255,.10)',
};

const MONO = "'JetBrains Mono','SFMono-Regular',monospace";
const COND = "'Barlow Condensed','Barlow',sans-serif";

const MAPBOX_TOKEN = 'pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA';
const MAP_STYLE    = 'mapbox://styles/mapbox/dark-v11';

// Orlando hardcoded center
const ORL_LNG = -81.3792;
const ORL_LAT =  28.5383;

// Card face indices
const FACE_BOOK      = 0;
const FACE_SEARCHES  = 1;
const FACE_SCHEDULED = 2;
const FACE_NOTIFS    = 3;

const FACE_COUNT = 4;
const AUTO_CYCLE_MS = 3800;

// ─── Helpers ───────────────────────────────────────────────────────────────
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

function formatCountdown(ms) {
  if (!ms || ms <= 0) return 'DUE';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = s % 60;
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${sec}s`;
}

function fmtSchedTime(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  let h = d.getHours(); const m = String(d.getMinutes()).padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}

function hasCoords(o) {
  return typeof o?.pickupLat === 'number' && typeof o?.pickupLng === 'number';
}

// ─── Keyframe CSS ──────────────────────────────────────────────────────────
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
  @keyframes uaSweepRotate{ from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
`;

// ─── Tiny icon components (inline SVG, same idiom as driver app) ───────────
function Icon({ name, size = 16, color = 'currentColor', stroke = 1.8 }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'car':     return <svg {...p}><path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l2-4h12l2 4h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>;
    case 'search':  return <svg {...p}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg>;
    case 'clock':   return <svg {...p}><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>;
    case 'bell':    return <svg {...p}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>;
    case 'map':     return <svg {...p}><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>;
    case 'chat':    return <svg {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>;
    case 'pin':     return <svg {...p}><path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>;
    case 'star':    return <svg {...p}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
    case 'arrow':   return <svg {...p}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>;
    case 'check':   return <svg {...p}><polyline points="20 6 9 17 4 12"/></svg>;
    case 'sat':     return <svg {...p}><path d="M4 13a8 8 0 0 1 7 7M4 17a4 4 0 0 1 3 3"/><circle cx="6" cy="19" r="1"/><path d="M12 3l4 4-3 3-4-4 3-3ZM15 9l4 4-3 3"/></svg>;
    case 'x':       return <svg {...p}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
    default:        return null;
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

// ─── Top Ribbon ────────────────────────────────────────────────────────────
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Icon name="sat" size={11} color={C.greenSoft}/>
        </div>
        <SignalBars active={true}/>
      </div>
    </div>
  );
}

// ─── Radar SVG overlay ─────────────────────────────────────────────────────
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

// ─── Support FAB (bottom-right) ────────────────────────────────────────────
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

// ─── Card: Book a Ride ─────────────────────────────────────────────────────
function BookRideCard({ onBook }) {
  return (
    <div style={{ padding: '18px 18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 11, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(74,222,128,.14)',
          boxShadow: '0 0 16px rgba(74,222,128,.22)',
        }}>
          <Icon name="car" size={17} color={C.greenBright}/>
        </div>
        <div>
          <div style={{
            fontFamily: COND, fontSize: 11, fontWeight: 800, letterSpacing: '.18em',
            color: C.greenBright, textTransform: 'uppercase',
          }}>Book a Ride</div>
          <div style={{
            fontFamily: MONO, fontSize: 9, color: C.inkTextDim, marginTop: 1,
          }}>Orlando, FL · drivers online</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%', background: C.greenBright,
            boxShadow: `0 0 8px ${C.greenBright}`,
            animation: 'uaBlink 1.6s ease-in-out infinite',
          }}/>
          <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: C.greenBright }}>
            LIVE
          </span>
        </div>
      </div>

      {/* Pickup / Dropoff inputs (cosmetic — real booking handled elsewhere) */}
      <div style={{
        borderRadius: 12, overflow: 'hidden',
        border: '1px solid rgba(34,197,94,.18)',
        background: 'rgba(255,255,255,.03)',
      }}>
        {[
          { icon: 'pin',   label: 'Pickup',   placeholder: 'Where are you?',    dot: C.greenBright },
          { icon: 'map',   label: 'Drop-off', placeholder: 'Where to?',         dot: 'rgba(255,255,255,.55)' },
        ].map((row, i) => (
          <div key={i}>
            {i > 0 && <div style={{ height: 1, background: 'rgba(34,197,94,.1)', margin: '0 12px' }}/>}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
            }}>
              <div style={{
                width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
                background: row.dot, boxShadow: i === 0 ? `0 0 6px ${C.greenBright}88` : 'none',
              }}/>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontFamily: COND, fontSize: 8, fontWeight: 800, letterSpacing: '.12em',
                  color: C.inkTextDim, textTransform: 'uppercase', marginBottom: 1,
                }}>{row.label}</div>
                <div style={{
                  fontFamily: MONO, fontSize: 11, fontWeight: 600,
                  color: 'rgba(255,255,255,.35)',
                }}>{row.placeholder}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <button onClick={onBook} style={{
        width: '100%', padding: '12px 0', borderRadius: 12,
        background: 'linear-gradient(135deg, #22C55E, #16A34A)',
        border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        boxShadow: '0 4px 20px rgba(34,197,94,.35)',
        animation: 'uaGlowPulse 2.8s ease-in-out infinite',
      }}>
        <Icon name="car" size={15} color="#fff"/>
        <span style={{
          fontFamily: COND, fontSize: 13, fontWeight: 800, letterSpacing: '.14em',
          color: '#fff', textTransform: 'uppercase',
        }}>Request Ride</span>
        <Icon name="arrow" size={13} color="rgba(255,255,255,.7)"/>
      </button>
    </div>
  );
}

// ─── Card: Live Searches ───────────────────────────────────────────────────
function SearchesCard({ searches, scheduledRides }) {
  const liveCount  = searches.filter(hasCoords).length;
  const schedCount = scheduledRides.filter(hasCoords).length;

  return (
    <div style={{ padding: '18px 18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 11, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(103,232,249,.12)',
        }}>
          <Icon name="search" size={16} color={C.cyan}/>
        </div>
        <div>
          <div style={{
            fontFamily: COND, fontSize: 11, fontWeight: 800, letterSpacing: '.18em',
            color: C.cyan, textTransform: 'uppercase',
          }}>Live Activity</div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: C.inkTextDim, marginTop: 1 }}>
            Orlando metro · now
          </div>
        </div>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
      }}>
        {[
          { value: liveCount,  label: 'Ride Searches',    color: C.cyan,        icon: 'search' },
          { value: schedCount, label: 'Scheduled',        color: C.violet,      icon: 'clock'  },
        ].map((tile, i) => (
          <div key={i} style={{
            borderRadius: 12, padding: '12px 14px',
            background: 'rgba(255,255,255,.04)',
            border: `1px solid ${tile.color}22`,
          }}>
            <div style={{
              fontFamily: MONO, fontSize: 26, fontWeight: 800, color: tile.color, lineHeight: 1,
              textShadow: `0 0 20px ${tile.color}55`,
            }}>{tile.value}</div>
            <div style={{
              fontFamily: COND, fontSize: 8.5, fontWeight: 800, letterSpacing: '.12em',
              color: C.inkTextDim, textTransform: 'uppercase', marginTop: 4,
            }}>{tile.label}</div>
          </div>
        ))}
      </div>

      {/* Live blip legend */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '8px 12px', borderRadius: 10,
        background: 'rgba(255,255,255,.03)', border: '1px solid rgba(34,197,94,.1)',
      }}>
        {[
          { c: C.greenBright, label: 'Rider' },
          { c: C.amber,       label: 'Guest' },
          { c: C.violet,      label: 'Scheduled' },
        ].map((row, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%', background: row.c,
              boxShadow: `0 0 5px ${row.c}88`,
            }}/>
            <span style={{
              fontFamily: MONO, fontSize: 9, fontWeight: 600,
              color: 'rgba(255,255,255,.38)',
            }}>{row.label}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%', background: C.green,
            animation: 'uaBlink 1.4s ease-in-out infinite',
          }}/>
          <span style={{ fontFamily: MONO, fontSize: 9, color: C.greenBright }}>LIVE</span>
        </div>
      </div>
    </div>
  );
}

// ─── Card: Scheduled Rides ─────────────────────────────────────────────────
function ScheduledCard({ scheduledRides, now }) {
  const sorted = useMemo(() => {
    return [...scheduledRides]
      .map(r => ({ ...r, _when: tsToMillis(r.scheduledAt) }))
      .sort((a, b) => a._when - b._when)
      .slice(0, 4);
  }, [scheduledRides]);

  return (
    <div style={{ padding: '18px 18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 11, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(192,132,252,.14)',
        }}>
          <Icon name="clock" size={16} color={C.violet}/>
        </div>
        <div>
          <div style={{
            fontFamily: COND, fontSize: 11, fontWeight: 800, letterSpacing: '.18em',
            color: C.violet, textTransform: 'uppercase',
          }}>Scheduled Rides</div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: C.inkTextDim, marginTop: 1 }}>
            {sorted.length} upcoming
          </div>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '18px 0',
          fontFamily: MONO, fontSize: 11, color: C.inkTextDim, lineHeight: 1.6,
        }}>
          No scheduled rides.<br/>
          <span style={{ color: C.violet, opacity: .7 }}>Book one below ↓</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {sorted.map((r, i) => {
            const cd = r._when ? r._when - now : null;
            const due = cd !== null && cd <= 0;
            const urgent = cd !== null && cd > 0 && cd < 15 * 60 * 1000;
            const dotColor = due || urgent ? C.red : C.violet;
            return (
              <div key={r.id || i} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                borderRadius: 10, background: 'rgba(192,132,252,.06)',
                border: '1px solid rgba(192,132,252,.14)',
                animation: `uaCardFlip .3s ease ${i * 0.05}s both`,
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: dotColor, boxShadow: `0 0 7px ${dotColor}`,
                  animation: (due || urgent) ? 'uaBlink 1.2s ease-in-out infinite' : 'none',
                }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: MONO, fontSize: 11, fontWeight: 700, color: '#F3E8FF',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {r.pickupLabel || r.pickupAddress || 'Pickup'}
                  </div>
                  <div style={{
                    fontFamily: MONO, fontSize: 9, color: 'rgba(192,132,252,.6)', marginTop: 2,
                  }}>
                    {fmtSchedTime(r._when)}
                    {typeof r.driverPayout === 'number' && (
                      <span style={{ color: C.amberBright, marginLeft: 8 }}>
                        ${r.driverPayout.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{
                  fontFamily: MONO, fontSize: 10, fontWeight: 800, flexShrink: 0,
                  color: due || urgent ? C.red : '#E9D5FF',
                  background: due || urgent ? 'rgba(248,113,113,.14)' : 'rgba(192,132,252,.12)',
                  padding: '3px 8px', borderRadius: 7,
                }}>
                  {cd !== null ? formatCountdown(cd) : '—'}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Card: Notifications ───────────────────────────────────────────────────
function NotificationsCard({ rides, callSaveFcmToken }) {
  const [permState, setPermState] = useState('default'); // default | granted | denied
  const [enabling,  setEnabling]  = useState(false);

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setPermState(Notification.permission);
    }
  }, []);

  const handleEnable = useCallback(async () => {
    setEnabling(true);
    try {
      const perm = await Notification.requestPermission();
      setPermState(perm);
      if (perm === 'granted' && callSaveFcmToken) {
        await callSaveFcmToken();
      }
    } catch (e) { /* silently skip */ }
    setEnabling(false);
  }, [callSaveFcmToken]);

  // Show last 3 ride notifications
  const recentRides = useMemo(() => {
    return [...(rides || [])]
      .sort((a, b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt))
      .slice(0, 3);
  }, [rides]);

  return (
    <div style={{ padding: '18px 18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 11, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(251,191,36,.12)',
        }}>
          <Icon name="bell" size={16} color={C.amberBright}/>
        </div>
        <div>
          <div style={{
            fontFamily: COND, fontSize: 11, fontWeight: 800, letterSpacing: '.18em',
            color: C.amberBright, textTransform: 'uppercase',
          }}>Notifications</div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: C.inkTextDim, marginTop: 1 }}>
            {permState === 'granted' ? 'Push enabled' : 'Push off'}
          </div>
        </div>
        {permState !== 'granted' && (
          <button onClick={handleEnable} disabled={enabling || permState === 'denied'} style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 11px', borderRadius: 8, cursor: permState === 'denied' ? 'default' : 'pointer',
            background: permState === 'denied' ? 'rgba(248,113,113,.12)' : 'rgba(251,191,36,.14)',
            border: `1px solid ${permState === 'denied' ? C.red : C.amberBright}44`,
            fontFamily: MONO, fontSize: 10, fontWeight: 700,
            color: permState === 'denied' ? C.red : C.amberBright,
          }}>
            {enabling
              ? <><span style={{ animation: 'uaSpin .8s linear infinite', display: 'inline-block', width: 10, height: 10, border: `1.5px solid ${C.amberBright}`, borderTopColor: 'transparent', borderRadius: '50%' }}/> Enabling</>
              : permState === 'denied' ? 'Blocked' : 'Enable'
            }
          </button>
        )}
        {permState === 'granted' && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Icon name="check" size={13} color={C.greenBright}/>
            <span style={{ fontFamily: MONO, fontSize: 9, color: C.greenBright }}>ON</span>
          </div>
        )}
      </div>

      {/* Recent rides */}
      {recentRides.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {recentRides.map((ride, i) => {
            const status = ride.status || 'unknown';
            const statusColor = {
              completed:       C.greenBright,
              in_progress:     C.amberBright,
              driver_assigned: C.cyan,
              cancelled:       C.red,
            }[status] || C.inkText;
            return (
              <div key={ride.id || i} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                borderRadius: 10, background: 'rgba(255,255,255,.03)',
                border: `1px solid ${statusColor}1a`,
                animation: `uaCardFlip .3s ease ${i * 0.06}s both`,
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: statusColor, boxShadow: `0 0 6px ${statusColor}77`,
                }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: MONO, fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.82)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {ride.pickupLabel || ride.pickupAddress || 'Pickup'}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: C.inkTextDim, marginTop: 1 }}>
                    {ride.dropoffLabel || ride.dropoffAddress || 'Drop-off'}
                  </div>
                </div>
                <span style={{
                  fontFamily: COND, fontSize: 9, fontWeight: 800, letterSpacing: '.1em',
                  color: statusColor, textTransform: 'uppercase',
                  background: `${statusColor}18`, padding: '2px 7px', borderRadius: 6,
                }}>
                  {status.replace(/_/g, ' ')}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{
          textAlign: 'center', padding: '14px 0',
          fontFamily: MONO, fontSize: 11, color: C.inkTextDim, lineHeight: 1.7,
        }}>
          No recent rides.<br/>
          <span style={{ color: C.amberBright, opacity: .65 }}>Request your first ride ↑</span>
        </div>
      )}
    </div>
  );
}

// ─── Main status card carousel ─────────────────────────────────────────────
function StatusCard({ face, onFaceChange, rides, searches, scheduledRides, now, callSaveFcmToken, onBook }) {
  // Stop auto-cycling when user manually taps a dot
  const [autoCycle, setAutoCycle] = useState(true);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!autoCycle) return;
    timerRef.current = setTimeout(() => {
      onFaceChange((face + 1) % FACE_COUNT);
    }, AUTO_CYCLE_MS);
    return () => clearTimeout(timerRef.current);
  }, [face, autoCycle, onFaceChange]);

  const handleDotClick = useCallback((i) => {
    setAutoCycle(false);
    onFaceChange(i);
    // resume auto-cycle after 12 s of inactivity
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setAutoCycle(true), 12000);
  }, [onFaceChange]);

  const FACES = [
    { label: 'Book',      color: C.greenBright, icon: 'car'    },
    { label: 'Searches',  color: C.cyan,        icon: 'search' },
    { label: 'Scheduled', color: C.violet,      icon: 'clock'  },
    { label: 'Alerts',    color: C.amberBright, icon: 'bell'   },
  ];

  const accentColor = FACES[face].color;

  return (
    <div style={{
      width: '100%', maxWidth: 420,
      background: 'linear-gradient(180deg, rgba(6,14,8,.94), rgba(3,8,5,.97))',
      border: `1px solid ${accentColor}30`,
      borderRadius: 20, overflow: 'hidden',
      boxShadow: `0 12px 48px rgba(0,0,0,.65), 0 0 30px ${accentColor}18`,
      backdropFilter: 'blur(16px)',
      transition: 'border-color .35s ease, box-shadow .35s ease',
    }}>
      {/* Top accent stripe */}
      <div style={{
        height: 2,
        background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
        transition: 'background .35s ease',
      }}/>

      {/* Tab bar */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '10px 14px 0',
        borderBottom: '1px solid rgba(34,197,94,.1)',
      }}>
        {FACES.map((f, i) => {
          const active = i === face;
          return (
            <button key={i} onClick={() => handleDotClick(i)} style={{
              flex: 1, padding: '6px 2px 10px', cursor: 'pointer',
              background: 'none', border: 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              position: 'relative',
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: 9,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: active ? `${f.color}22` : 'transparent',
                transition: 'background .25s ease',
              }}>
                <Icon name={f.icon} size={14} color={active ? f.color : 'rgba(255,255,255,.28)'}/>
              </div>
              <span style={{
                fontFamily: COND, fontSize: 8.5, fontWeight: 800, letterSpacing: '.1em',
                color: active ? f.color : 'rgba(255,255,255,.22)',
                textTransform: 'uppercase',
                transition: 'color .25s ease',
              }}>{f.label}</span>
              {active && (
                <div style={{
                  position: 'absolute', bottom: 0, left: '20%', right: '20%', height: 2,
                  borderRadius: '2px 2px 0 0',
                  background: f.color,
                  boxShadow: `0 0 8px ${f.color}`,
                  animation: 'uaFadeIn .2s ease both',
                }}/>
              )}
            </button>
          );
        })}
      </div>

      {/* Card body */}
      <div key={face} style={{ animation: 'uaCardFlip .28s ease both' }}>
        {face === FACE_BOOK      && <BookRideCard onBook={onBook}/>}
        {face === FACE_SEARCHES  && <SearchesCard searches={searches} scheduledRides={scheduledRides}/>}
        {face === FACE_SCHEDULED && <ScheduledCard scheduledRides={scheduledRides} now={now}/>}
        {face === FACE_NOTIFS    && <NotificationsCard rides={rides} callSaveFcmToken={callSaveFcmToken}/>}
      </div>

      {/* Progress dots */}
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5,
        padding: '2px 0 12px',
      }}>
        {FACES.map((f, i) => (
          <div key={i} onClick={() => handleDotClick(i)} style={{
            width: i === face ? 16 : 5, height: 5, borderRadius: 3,
            background: i === face ? accentColor : 'rgba(255,255,255,.15)',
            cursor: 'pointer',
            transition: 'width .3s ease, background .3s ease',
            boxShadow: i === face ? `0 0 8px ${accentColor}` : 'none',
          }}/>
        ))}
      </div>
    </div>
  );
}

// ─── GeoJSON helpers ───────────────────────────────────────────────────────
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
  const mapContainerRef = useRef(null);
  const mapRef          = useRef(null);
  const sweepRef        = useRef(0);
  const rafRef          = useRef(null);
  const svgRef          = useRef(null);
  const pulseRef        = useRef(false);

  const [mapReady,  setMapReady]  = useState(false);
  const [now,       setNow]       = useState(Date.now());
  const [face,      setFace]      = useState(FACE_BOOK);

  // 1Hz clock
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Init Mapbox ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return;

    const link    = document.createElement('link');
    link.rel      = 'stylesheet';
    link.href     = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css';
    const script  = document.createElement('script');
    script.src    = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js';
    script.async  = true;
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

        // Heatmap layer
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

        // Slow ambient drift — same as driver HUD
        let bearing = -20;
        const drift = setInterval(() => { bearing += 0.03; map.setBearing(bearing); }, 120);
        map.on('remove', () => clearInterval(drift));

        // Pulse halo
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
        mapRef.current  = null;
        pulseRef.current = false;
        setMapReady(false);
      }
    };
  }, []); // eslint-disable-line

  // ── Update GeoJSON on data change ────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const apply = () => {
      map.getSource('ua-searches') ?.setData(buildSearchGeoJSON(searches));
      map.getSource('ua-scheduled')?.setData(buildScheduledGeoJSON(scheduledRides));
    };
    if (map.isStyleLoaded()) apply(); else map.once('styledata', apply);
  }, [searches, scheduledRides, mapReady]);

  // ── Radar sweep RAF ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) { cancelAnimationFrame(rafRef.current); return; }
    const animate = () => {
      sweepRef.current = (sweepRef.current + 1.1) % 360;
      if (svgRef.current) {
        const angle = sweepRef.current;
        const toRad = d => d * Math.PI / 180;
        const R = 55;
        const leadA  = (angle + 80) % 360;
        const trailX = 50 + R * Math.cos(toRad(angle));
        const trailY = 50 + R * Math.sin(toRad(angle));
        const leadX  = 50 + R * Math.cos(toRad(leadA));
        const leadY  = 50 + R * Math.sin(toRad(leadA));
        const tipX   = 50 + 52 * Math.cos(toRad(leadA));
        const tipY   = 50 + 52 * Math.sin(toRad(leadA));
        const cAngle = (360 - angle * 0.6) % 360;
        const cLead  = (cAngle + 60) % 360;
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
    // hook point — parent or future BookingModal takes over here
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

        {/* Center-mounted status card */}
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 'calc(100% - 32px)',
          maxWidth: 420,
          zIndex: 30,
          pointerEvents: 'auto',
          animation: 'uaSlideUp .5s cubic-bezier(.34,1.2,.64,1) both',
          filter: 'drop-shadow(0 12px 40px rgba(0,0,0,.6))',
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
