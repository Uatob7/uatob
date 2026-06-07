import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  collection,
  onSnapshot,
  getFirestore,
} from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

import StatusCard from '@/App/Drivers/StatusCard.jsx';

const MAPBOX_TOKEN = 'pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA';
const MAP_STYLE    = 'mapbox://styles/mapbox/dark-v11';

const C = {
  bg:          '#050A06',
  bgDeep:      '#030604',
  panel:       'rgba(5,10,6,.72)',
  panelSolid:  '#070D08',
  green:       '#22C55E',
  greenBright: '#4ADE80',
  greenSoft:   '#34D399',
  greenInk:    'rgba(34,197,94,',
  amber:       '#FB923C',
  amberBright: '#FBBF24',
  violet:      '#C084FC',
  cyan:        '#67E8F9',
  red:         '#F87171',
  line:        'rgba(34,197,94,.25)',
  lineSoft:    'rgba(34,197,94,.14)',
  lineFaint:   'rgba(34,197,94,.09)',
  inkText:     'rgba(255,255,255,.42)',
  inkTextDim:  'rgba(255,255,255,.22)',
  inkTextFade: 'rgba(255,255,255,.12)',
};

const MONO = "'JetBrains Mono','SFMono-Regular',monospace";
const COND = "'Barlow Condensed','Barlow',sans-serif";

const ON_RADAR_RANGE_MI = 4.2;
const MAX_EDGE_CONTACTS = 7;
const RADAR_RINGS_MI    = [1, 2, 4, 6];
const POOL_LEAD_MS      = 10 * 60 * 1000; // 10 min before scheduled time = enters pool

const BOOT_LINES = [
  'uatob dispatch terminal · v3.3',
  'establishing secure uplink .......... ok',
  'acquiring gps lock .................. ok',
  'calibrating radar array ............. ok',
  'syncing live ride queue ............. ok',
  'linking payout channel .............. ok',
  'driver node online. standing by.',
];

// ── Helpers ─────────────────────────────────────────────────────────────────
function tsToMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') {
    const p = Date.parse(ts);
    return Number.isNaN(p) ? 0 : p;
  }
  return 0;
}

function haversineMiles(lat1, lng1, lat2, lng2) {
  const R    = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2
             + Math.cos(lat1 * Math.PI / 180)
             * Math.cos(lat2 * Math.PI / 180)
             * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingBetween(lat1, lng1, lat2, lng2) {
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const y  = Math.sin(Δλ) * Math.cos(φ2);
  const x  = Math.cos(φ1) * Math.sin(φ2)
           - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ  = Math.atan2(y, x) * 180 / Math.PI;
  return (θ + 360) % 360;
}

function hasCoords(o) {
  return typeof o?.pickupLat === 'number' && typeof o?.pickupLng === 'number';
}

function normalizeHeading(b) {
  return ((Number(b) || 0) % 360 + 360) % 360;
}

function compassLabel(b) {
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(normalizeHeading(b) / 45) % 8];
}

function fmtMi(mi) {
  return mi !== null && mi !== undefined && isFinite(mi) ? `${mi.toFixed(1)} mi` : null;
}

function fmtClock(ms) {
  const d = new Date(ms);
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function fmtCoord(v, axis) {
  if (typeof v !== 'number') return '——.————';
  const hemi = axis === 'lat' ? (v >= 0 ? 'N' : 'S') : (v >= 0 ? 'E' : 'W');
  return `${Math.abs(v).toFixed(4)}°${hemi}`;
}

function fmtMoney(v) {
  let n = null;
  if (typeof v === 'number') n = v;
  else if (v && typeof v === 'object') n = v.today ?? v.total ?? v.amount ?? v.value ?? null;
  if (n === null || !isFinite(n)) return null;
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDuration(ms) {
  if (!ms || ms < 0) ms = 0;
  const s   = Math.floor(ms / 1000);
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2,'0')}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2,'0')}s`;
  return `${sec}s`;
}

function formatCountdown(ms) {
  if (ms <= 0) return 'DUE';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${sec}s`;
}

function fmtSchedTime(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}

function pickupLabelOf(r) {
  return r?.pickupLabel || r?.pickupAddress || r?.pickupName ||
    (hasCoords(r) ? `${r.pickupLat.toFixed(3)}, ${r.pickupLng.toFixed(3)}` : 'Pickup');
}

// How long until this scheduled ride enters the driver pool
// Pool opens POOL_LEAD_MS (10 min) before the scheduled ride time
function fmtPoolCountdown(whenMs, now) {
  const poolAt = whenMs - POOL_LEAD_MS;
  const diff   = poolAt - now;
  if (diff <= 0) return { label: 'IN POOL', color: C.greenBright, urgent: true };
  const s = Math.floor(diff / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const d = Math.floor(h / 24);
  if (d > 0)  return { label: `${d}d ${h % 24}h`,  color: C.violet,      urgent: false };
  if (h > 0)  return { label: `${h}h ${m}m`,        color: C.violet,      urgent: false };
  if (m >= 5) return { label: `${m}m`,             color: C.violet,      urgent: false };
  if (m > 0)  return { label: `${m}m ${s % 60}s`, color: C.amberBright, urgent: true  };
  return            { label: `${s}s`,              color: C.red,         urgent: true  };
}

// Format uptime as H:MM:SS or MM:SS
function fmtUptime(onlineSinceMs, now) {
  if (!onlineSinceMs) return null;
  const elapsed = Math.max(0, now - onlineSinceMs);
  const s  = Math.floor(elapsed / 1000);
  const h  = Math.floor(s / 3600);
  const m  = Math.floor((s % 3600) / 60);
  const sc = s % 60;
  const p  = n => String(n).padStart(2, '0');
  if (h > 0) return `${h}:${p(m)}:${p(sc)}`;
  return `${p(m)}:${p(sc)}`;
}

// ── GeoJSON builders ─────────────────────────────────────────────────────────
function buildPickupGeoJSON(searches = []) {
  const features = searches
    .filter(hasCoords)
    .map(s => ({
      type: 'Feature',
      properties: {
        id:    s.id,
        age:   Math.min(1, Math.max(0, 1 - (Date.now() - tsToMillis(s.createdAt)) / (3 * 3600_000))),
        guest: !s.uid || s.uid === 'null' || s.uid === null,
      },
      geometry: { type: 'Point', coordinates: [s.pickupLng, s.pickupLat] },
    }));
  return { type: 'FeatureCollection', features };
}

function buildScheduledGeoJSON(scheduledRides = []) {
  const features = scheduledRides
    .filter(hasCoords)
    .map(r => ({
      type: 'Feature',
      properties: {
        id:   r.id,
        when: tsToMillis(r.scheduledAt),
      },
      geometry: { type: 'Point', coordinates: [r.pickupLng, r.pickupLat] },
    }));
  return { type: 'FeatureCollection', features };
}

function nearestMi(driverLat, driverLng, items = []) {
  if (!driverLat || !driverLng) return null;
  const valid = items.filter(hasCoords);
  if (!valid.length) return null;
  const min = valid.reduce(
    (m, s) => Math.min(m, haversineMiles(driverLat, driverLng, s.pickupLat, s.pickupLng)),
    Infinity
  );
  return isFinite(min) ? min : null;
}

function gatherContacts(driver, searches, scheduledRides) {
  const dLat = driver?.lat, dLng = driver?.lng;
  if (typeof dLat !== 'number' || typeof dLng !== 'number') return [];
  const out = [];
  searches.filter(hasCoords).forEach(s => {
    out.push({
      id:      `s_${s.id}`,
      kind:    s.guest || !s.uid || s.uid === 'null' ? 'guest' : 'search',
      dist:    haversineMiles(dLat, dLng, s.pickupLat, s.pickupLng),
      bearing: bearingBetween(dLat, dLng, s.pickupLat, s.pickupLng),
    });
  });
  scheduledRides.filter(hasCoords).forEach(r => {
    out.push({
      id:      `r_${r.id}`,
      kind:    'sched',
      dist:    haversineMiles(dLat, dLng, r.pickupLat, r.pickupLng),
      bearing: bearingBetween(dLat, dLng, r.pickupLat, r.pickupLng),
    });
  });
  return out.sort((a, b) => a.dist - b.dist);
}

const KIND_COLOR = {
  search: C.greenBright,
  guest:  C.amber,
  sched:  C.violet,
};

// ── Small presentational pieces ──────────────────────────────────────────────
function SignalBars({ active = true, color = C.greenBright }) {
  const heights = [5, 8, 11, 14];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 14 }}>
      {heights.map((h, i) => (
        <div key={i} style={{
          width: 2.5, height: h, borderRadius: 1,
          background: active ? color : 'rgba(255,255,255,.14)',
          boxShadow: active ? `0 0 4px ${color}88` : 'none',
          animation: active ? `htBarPulse 1.5s ease-in-out ${i * 0.16}s infinite` : 'none',
        }}/>
      ))}
    </div>
  );
}

function Glyph({ name, size = 12, color = 'currentColor', stroke = 1.8 }) {
  const common = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round',
  };
  switch (name) {
    case 'pin':
      return (<svg {...common}><path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>);
    case 'user':
      return (<svg {...common}><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/></svg>);
    case 'clock':
      return (<svg {...common}><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>);
    case 'cash':
      return (<svg {...common}><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg>);
    case 'bolt':
      return (<svg {...common}><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/></svg>);
    case 'sat':
      return (<svg {...common}><path d="M4 13a8 8 0 0 1 7 7M4 17a4 4 0 0 1 3 3"/><circle cx="6" cy="19" r="1"/><path d="M12 3l4 4-3 3-4-4 3-3ZM15 9l4 4-3 3"/></svg>);
    case 'chev':
      return (<svg {...common}><path d="m6 9 6 6 6-6"/></svg>);
    case 'route':
      return (<svg {...common}><circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H14a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h5.5"/></svg>);
    default:
      return null;
  }
}

function CornerBrackets() {
  const off = 12, sz = 26, th = 1.5, col = 'rgba(34,197,94,.4)';
  const corners = [
    { top: off,    left: off,    bt: 1, bl: 1 },
    { top: off,    right: off,   bt: 1, br: 1 },
    { bottom: off, left: off,    bb: 1, bl: 1 },
    { bottom: off, right: off,   bb: 1, br: 1 },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 12, pointerEvents: 'none' }}>
      {corners.map((c, i) => (
        <div key={i} style={{
          position: 'absolute', width: sz, height: sz,
          top: c.top, left: c.left, right: c.right, bottom: c.bottom,
          borderTop:    c.bt ? `${th}px solid ${col}` : 'none',
          borderBottom: c.bb ? `${th}px solid ${col}` : 'none',
          borderLeft:   c.bl ? `${th}px solid ${col}` : 'none',
          borderRight:  c.br ? `${th}px solid ${col}` : 'none',
          animation: 'htBracketGlow 4s ease-in-out infinite',
        }}/>
      ))}
    </div>
  );
}

function ScanlineOverlay() {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 8, pointerEvents: 'none',
      mixBlendMode: 'screen', opacity: .5,
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'repeating-linear-gradient(0deg, rgba(34,197,94,.035) 0px, rgba(34,197,94,.035) 1px, transparent 2px, transparent 4px)',
      }}/>
      <div style={{
        position: 'absolute', left: 0, right: 0, height: 80,
        background: 'linear-gradient(180deg, transparent, rgba(74,222,128,.05), transparent)',
        animation: 'htScan 6s linear infinite',
      }}/>
    </div>
  );
}

function AtmosphereOverlay() {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 6, pointerEvents: 'none',
      background: 'radial-gradient(ellipse at 50% 42%, transparent 38%, rgba(3,6,4,.45) 78%, rgba(3,6,4,.78) 100%)',
    }}/>
  );
}

// ── CompassRose — bottom shows live uptime counter ───────────────────────────
function CompassRose({ bearing, onlineSinceMs, now }) {
  const hdg = normalizeHeading(bearing);
  const uptimeLabel = fmtUptime(onlineSinceMs, now);

  return (
    <div style={{
      position: 'absolute', top: '50%', right: 12, transform: 'translateY(-50%)',
      zIndex: 14, pointerEvents: 'none', textAlign: 'center',
      animation: 'htFadeIn .6s ease both',
    }}>
      <div style={{ position: 'relative', width: 62, height: 62 }}>
        <svg viewBox="0 0 100 100" width={62} height={62}
          style={{ transform: `rotate(${-hdg}deg)`, transition: 'transform .22s linear' }}>
          <circle cx="50" cy="50" r="46" fill="rgba(5,10,6,.55)"
            stroke="rgba(34,197,94,.22)" strokeWidth="1"/>
          {Array.from({ length: 24 }).map((_, i) => {
            const a = (i * 15) * Math.PI / 180;
            const major = i % 6 === 0;
            const r1 = major ? 38 : 42;
            const x1 = 50 + r1 * Math.sin(a), y1 = 50 - r1 * Math.cos(a);
            const x2 = 50 + 46 * Math.sin(a), y2 = 50 - 46 * Math.cos(a);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={major ? 'rgba(74,222,128,.55)' : 'rgba(34,197,94,.2)'}
              strokeWidth={major ? 1.1 : 0.6}/>;
          })}
          <polygon points="50,9 46,20 54,20" fill={C.red}/>
          <text x="50" y="33" textAnchor="middle" fontSize="9" fontWeight="800"
            fill="rgba(255,255,255,.5)" fontFamily="monospace">S</text>
          <text x="50" y="71" textAnchor="middle" fontSize="9" fontWeight="800"
            fill={C.red} fontFamily="monospace" transform="rotate(180 50 67)">N</text>
        </svg>

        {/* Center: heading degrees */}
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            fontFamily: MONO, fontSize: 12, fontWeight: 800,
            color: C.greenBright, lineHeight: 1,
          }}>
            {String(Math.round(hdg)).padStart(3, '0')}
          </span>
          <span style={{
            fontFamily: COND, fontSize: 7, fontWeight: 800,
            letterSpacing: '.14em', color: C.inkTextDim,
          }}>
            DEG
          </span>
        </div>
      </div>

      {/* Uptime counter — ticks up every second while online */}
      {uptimeLabel ? (
        <div style={{
          marginTop: 5,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
        }}>
          <span style={{
            fontFamily: MONO, fontSize: 10, fontWeight: 800,
            color: C.greenBright,
            textShadow: `0 0 8px ${C.greenBright}88`,
          }}>
            {uptimeLabel}
          </span>
          <span style={{
            fontFamily: COND, fontSize: 7.5, fontWeight: 800,
            letterSpacing: '.14em', color: C.inkTextDim, textTransform: 'uppercase',
          }}>
            online
          </span>
        </div>
      ) : (
        <div style={{
          marginTop: 4, fontFamily: MONO, fontSize: 9,
          fontWeight: 700, color: C.inkText,
        }}>
          {compassLabel(hdg)}
        </div>
      )}
    </div>
  );
}

function RangeRuler({ zoom }) {
  return (
    <div style={{
      position: 'absolute', top: '50%', left: 12, transform: 'translateY(-50%)',
      zIndex: 14, pointerEvents: 'none',
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 9,
      animation: 'htFadeIn .6s ease both',
    }}>
      <div style={{
        fontFamily: COND, fontSize: 8, fontWeight: 800, letterSpacing: '.16em',
        color: C.inkTextDim, marginBottom: 1,
      }}>
        RANGE
      </div>
      {RADAR_RINGS_MI.map((mi, i) => (
        <div key={mi} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: i === 0 ? 14 : 9, height: 1,
            background: 'rgba(34,197,94,.4)',
          }}/>
          <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: C.inkText }}>
            {mi}
          </span>
        </div>
      ))}
      <div style={{
        marginTop: 2, fontFamily: MONO, fontSize: 8, fontWeight: 700,
        color: C.inkTextDim,
      }}>
        z{(zoom ?? 12).toFixed(1)}
      </div>
    </div>
  );
}

function EdgeContacts({ contacts, mapBearing }) {
  const edge = contacts.filter(c => c.dist > ON_RADAR_RANGE_MI).slice(0, MAX_EDGE_CONTACTS);
  if (!edge.length) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 14, pointerEvents: 'none' }}>
      {edge.map((c) => {
        const screen = (c.bearing - mapBearing) * Math.PI / 180;
        const rx = 43, ry = 41;
        const left = 50 + rx * Math.sin(screen);
        const top  = 50 - ry * Math.cos(screen);
        const col  = KIND_COLOR[c.kind] || C.greenBright;
        const deg  = (c.bearing - mapBearing);
        return (
          <div key={c.id} style={{
            position: 'absolute', left: `${left}%`, top: `${top}%`,
            transform: 'translate(-50%, -50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          }}>
            <div style={{
              width: 0, height: 0,
              borderLeft: '4px solid transparent',
              borderRight: '4px solid transparent',
              borderBottom: `7px solid ${col}`,
              transform: `rotate(${deg}deg)`,
              filter: `drop-shadow(0 0 4px ${col})`,
              opacity: .9,
            }}/>
            <span style={{
              fontFamily: MONO, fontSize: 8, fontWeight: 700,
              color: col, textShadow: '0 1px 3px rgba(0,0,0,.8)',
            }}>
              {c.dist.toFixed(1)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function TopRibbon({ now, online, mapReady, activeTrip, tripStage, tripStageColor, heading, lat, lng }) {
  const liveColor = activeTrip ? (tripStageColor || C.cyan)
                  : online      ? C.greenBright
                  :               C.inkTextDim;
  const liveLabel = activeTrip ? (tripStage || 'ON TRIP')
                  : online      ? (mapReady ? 'LIVE' : 'SYNC')
                  :               'STANDBY';
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: 26, zIndex: 24,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 14px', pointerEvents: 'none',
      background: 'linear-gradient(180deg, rgba(3,6,4,.85), rgba(3,6,4,0))',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontFamily: COND, fontSize: 11, fontWeight: 800, letterSpacing: '.22em',
          color: 'rgba(255,255,255,.55)',
        }}>
          UATOB
        </span>
        <span style={{ fontFamily: MONO, fontSize: 9, color: C.inkTextFade }}>·</span>
        <span style={{
          fontFamily: COND, fontSize: 9.5, fontWeight: 700, letterSpacing: '.16em',
          color: C.inkTextDim,
        }}>
          DISPATCH
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%', background: liveColor,
            boxShadow: `0 0 7px ${liveColor}`,
            animation: (online || activeTrip) ? 'htBlink 1.6s ease-in-out infinite' : 'none',
          }}/>
          <span style={{
            fontFamily: MONO, fontSize: 9.5, fontWeight: 800, letterSpacing: '.08em',
            color: liveColor,
          }}>
            {liveLabel}
          </span>
        </div>
        <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.45)' }}>
          {fmtClock(now)}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: C.greenSoft }}>
          <Glyph name="sat" size={11} color={online ? C.greenSoft : C.inkTextDim}/>
          <span style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 700, color: C.inkTextDim }}>
            {typeof lat === 'number' ? 'LOCK' : 'NO FIX'}
          </span>
        </div>
        <SignalBars active={online} color={C.greenBright}/>
      </div>
    </div>
  );
}

function BootSequence({ step }) {
  const lines = BOOT_LINES.slice(0, step);
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 40,
      background: 'radial-gradient(ellipse at 50% 45%, #07140A 0%, #030604 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      animation: 'htFadeIn .3s ease both',
    }}>
      {[60, 110, 160, 210].map((r, i) => (
        <div key={i} style={{
          position: 'absolute', width: r * 2, height: r * 2, borderRadius: '50%',
          border: '1px solid rgba(34,197,94,.09)',
          animation: `htRingPulse ${2.4 + i * 0.5}s ease-in-out ${i * 0.3}s infinite`,
        }}/>
      ))}
      <div style={{
        width: 'min(86vw, 360px)',
        background: 'rgba(5,12,7,.7)',
        border: '1px solid rgba(34,197,94,.2)',
        borderRadius: 12, padding: '16px 18px',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 18px 60px rgba(0,0,0,.6)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12,
          paddingBottom: 10, borderBottom: '1px solid rgba(34,197,94,.12)',
        }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {[C.red, C.amberBright, C.greenBright].map((c, i) => (
              <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: c, opacity: .8 }}/>
            ))}
          </div>
          <span style={{
            fontFamily: COND, fontSize: 10, fontWeight: 800, letterSpacing: '.2em',
            color: C.inkTextDim,
          }}>
            DISPATCH BOOT
          </span>
        </div>
        {lines.map((l, i) => {
          const isLast    = i === lines.length - 1;
          const isWelcome = l === BOOT_LINES[BOOT_LINES.length - 1] && step >= BOOT_LINES.length;
          return (
            <div key={i} style={{
              fontFamily: MONO, fontSize: 11, lineHeight: 1.7,
              color: isWelcome ? C.greenBright : 'rgba(120,200,150,.75)',
              fontWeight: isWelcome ? 700 : 500,
              animation: 'htFadeIn .25s ease both',
            }}>
              <span style={{ color: 'rgba(74,222,128,.4)', marginRight: 6 }}>›</span>
              {l}
              {isLast && step < BOOT_LINES.length && (
                <span style={{
                  display: 'inline-block', width: 7, height: 12, marginLeft: 4,
                  background: C.greenBright, verticalAlign: 'middle',
                  animation: 'htBootBlink .8s steps(1) infinite',
                }}/>
              )}
            </div>
          );
        })}
      </div>
      <div style={{
        marginTop: 16, fontFamily: COND, fontSize: 10, fontWeight: 700,
        letterSpacing: '.2em', color: C.inkTextFade,
      }}>
        ORLANDO · FL
      </div>
    </div>
  );
}

function OfflineStandby({ driver }) {
  const name = driver?.firstName || driver?.name?.split?.(' ')?.[0] || null;
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 5,
      background: 'radial-gradient(ellipse at 50% 58%, #0D1A0F 0%, #050A06 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {[60, 110, 160, 210].map((r, i) => (
        <div key={i} style={{
          position: 'absolute', width: r * 2, height: r * 2, borderRadius: '50%',
          border: '1px solid rgba(34,197,94,.06)',
          animation: `htRingPulse ${2.8 + i * 0.6}s ease-in-out ${i * 0.4}s infinite`,
        }}/>
      ))}
      <div style={{ textAlign: 'center', position: 'relative', padding: 24 }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          border: '1.5px solid rgba(255,255,255,.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', position: 'relative',
        }}>
          <div style={{
            position: 'absolute', inset: -8, borderRadius: '50%',
            border: '1px solid rgba(34,197,94,.08)',
            animation: 'htRingPulse 3s ease-in-out infinite',
          }}/>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
            stroke="rgba(255,255,255,.22)" strokeWidth="1.7" strokeLinecap="round">
            <circle cx="12" cy="12" r="1"/>
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
          </svg>
        </div>
        <div style={{
          fontFamily: COND, fontSize: 12, fontWeight: 800, letterSpacing: '.22em',
          textTransform: 'uppercase', color: 'rgba(255,255,255,.32)', marginBottom: 6,
        }}>
          Radar Offline
        </div>
        {name && (
          <div style={{
            fontFamily: MONO, fontSize: 12, fontWeight: 600,
            color: 'rgba(255,255,255,.4)', marginBottom: 4,
          }}>
            Standing by, {name}.
          </div>
        )}
        <div style={{
          fontFamily: MONO, fontSize: 10.5, color: 'rgba(255,255,255,.2)',
          maxWidth: 240, margin: '0 auto', lineHeight: 1.6,
        }}>
          Flip your status to go live and start receiving ride requests across Orlando.
        </div>
      </div>
    </div>
  );
}

function StatPill({ glyph, label, value, color = C.greenBright, sub }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
      borderRight: '1px solid rgba(34,197,94,.1)',
    }}>
      <div style={{
        width: 22, height: 22, borderRadius: 7, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${color}1a`, color,
      }}>
        <Glyph name={glyph} size={12} color={color}/>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15 }}>
        <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 800, color: '#fff' }}>
          {value}
        </span>
        <span style={{
          fontFamily: COND, fontSize: 8.5, fontWeight: 700, letterSpacing: '.12em',
          textTransform: 'uppercase', color: C.inkTextDim,
        }}>
          {sub || label}
        </span>
      </div>
    </div>
  );
}

function OnlineDriverChip({ online, total }) {
  return (
    <div style={{
      position: 'absolute', bottom: 110, right: 16, zIndex: 20,
      animation: 'htSlideDown .4s ease both',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: C.panel, backdropFilter: 'blur(10px)',
        border: '1px solid rgba(34,197,94,.25)', borderRadius: 99, padding: '5px 11px',
        boxShadow: '0 6px 20px rgba(0,0,0,.4)',
      }}>
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          background: C.green, boxShadow: '0 0 8px rgba(34,197,94,.9)',
          animation: 'htBlink 1.8s ease-in-out infinite', flexShrink: 0,
        }}/>
        <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 800, color: C.greenBright }}>
          {online}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,.22)' }}>/</span>
        <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.42)' }}>
          {total}
        </span>
        <span style={{
          fontFamily: COND, fontSize: 9.5, fontWeight: 800, letterSpacing: '.11em',
          textTransform: 'uppercase', color: 'rgba(74,222,128,.6)',
        }}>
          fleet
        </span>
      </div>
    </div>
  );
}

function ContactAlert({ alert }) {
  if (!alert) return null;
  const distStr = (alert.dist !== null && alert.dist !== undefined && isFinite(alert.dist))
    ? `${alert.dist.toFixed(1)} mi` : null;
  return (
    <div style={{
      position: 'absolute', top: 32, left: '50%', transform: 'translateX(-50%)',
      zIndex: 36, pointerEvents: 'none',
      animation: 'htSlideDown .35s cubic-bezier(.34,1.4,.64,1) both',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '7px 14px 7px 9px', borderRadius: 99,
        background: 'linear-gradient(180deg, rgba(8,20,12,.94), rgba(5,12,7,.96))',
        border: '1px solid rgba(74,222,128,.5)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 30px rgba(0,0,0,.55), 0 0 22px rgba(34,197,94,.25)',
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(34,197,94,.2)', color: C.greenBright,
          boxShadow: '0 0 12px rgba(34,197,94,.6)',
          animation: 'htBlink 1s ease-in-out infinite',
        }}>
          <Glyph name="bolt" size={12} color={C.greenBright}/>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
          <span style={{
            fontFamily: COND, fontSize: 9, fontWeight: 800, letterSpacing: '.16em',
            textTransform: 'uppercase', color: 'rgba(74,222,128,.7)',
          }}>
            New Request
          </span>
          <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 800, color: '#fff' }}>
            {distStr || 'incoming'}{alert.dir ? ` · ${alert.dir}` : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

function LegendKey() {
  const rows = [
    { c: C.greenBright, label: 'Rider' },
    { c: C.amber,       label: 'Guest' },
    { c: C.violet,      label: 'Scheduled' },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 152, left: 16, zIndex: 18, pointerEvents: 'none',
      display: 'flex', flexDirection: 'column', gap: 5,
      padding: '7px 10px', borderRadius: 11,
      background: 'rgba(5,10,6,.55)', backdropFilter: 'blur(8px)',
      border: '1px solid rgba(34,197,94,.12)',
      animation: 'htFadeIn .6s ease both',
    }}>
      <span style={{
        fontFamily: COND, fontSize: 7.5, fontWeight: 800, letterSpacing: '.16em',
        color: C.inkTextDim, marginBottom: 1,
      }}>
        CONTACTS
      </span>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%', background: r.c,
            boxShadow: `0 0 6px ${r.c}99`,
          }}/>
          <span style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 600, color: 'rgba(255,255,255,.45)' }}>
            {r.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function RotatingBadge({
  dotCount, accounts, scheduledCount,
  scheduledNearestMi, searchNearestMi, earnings, fmtMi,
}) {
  const [active, setActive] = useState(0);
  const moneyStr = fmtMoney(earnings);

  const badges = [
    {
      color: C.greenSoft, glyph: 'pin',
      label: `${dotCount} ${dotCount === 1 ? 'Search' : 'Searches'}`,
      sub:   fmtMi(searchNearestMi),
    },
    {
      color: C.cyan, glyph: 'user',
      label: `${accounts.length} ${accounts.length === 1 ? 'Rider' : 'Riders'}`,
      sub:   null,
    },
    {
      color: C.violet, glyph: 'clock',
      label: `${scheduledCount} Scheduled`,
      sub:   fmtMi(scheduledNearestMi),
    },
    moneyStr ? {
      color: C.amberBright, glyph: 'cash',
      label: moneyStr,
      sub:   'today',
    } : null,
  ].filter(Boolean);

  useEffect(() => {
    if (badges.length < 2) return;
    const id = setInterval(() => setActive(i => (i + 1) % badges.length), 2800);
    return () => clearInterval(id);
  }, [badges.length]);

  const b = badges[active % badges.length];
  if (!b) return null;

  return (
    <div style={{
      position: 'absolute', bottom: 110, left: 16, zIndex: 20,
      animation: 'htSlideDown .4s ease both',
    }}>
      <div key={active} style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: C.panel, backdropFilter: 'blur(10px)',
        border: `1px solid ${b.color}40`, borderRadius: 99, padding: '5px 12px 5px 7px',
        animation: 'htFadeIn .35s ease both',
        boxShadow: '0 6px 20px rgba(0,0,0,.4)',
      }}>
        <div style={{
          width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: `${b.color}1f`, color: b.color,
          boxShadow: `0 0 8px ${b.color}66`,
          animation: 'htBlink 2.4s ease-in-out infinite',
        }}>
          <Glyph name={b.glyph} size={11} color={b.color}/>
        </div>
        <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, color: b.color }}>
          {b.label}
        </span>
        {b.sub && (
          <>
            <span style={{ fontFamily: MONO, fontSize: 10, color: `${b.color}55` }}>·</span>
            <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, color: `${b.color}aa` }}>
              {b.sub}
            </span>
          </>
        )}
        {badges.length > 1 && (
          <div style={{ display: 'flex', gap: 3, marginLeft: 3 }}>
            {badges.map((_, i) => (
              <div key={i} style={{
                width: i === active ? 9 : 3, height: 3, borderRadius: 2,
                background: i === active ? b.color : 'rgba(255,255,255,.18)',
                transition: 'width .3s ease, background .3s ease',
              }}/>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── ScheduledDrawer — with pool countdown arrow badge ────────────────────────
function ScheduledDrawer({ open, onToggle, scheduledRides, driver, now }) {
  const rides = useMemo(() => {
    return [...scheduledRides]
      .map(r => ({ ...r, _when: tsToMillis(r.scheduledAt) }))
      .sort((a, b) => a._when - b._when);
  }, [scheduledRides]);

  if (!rides.length) return null;

  const next          = rides[0];
  const nextCountdown = next?._when ? formatCountdown(next._when - now) : '—';

  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 28,
      pointerEvents: 'none',
    }}>
      <div style={{
        margin: '0 auto', width: '100%', maxWidth: 480, pointerEvents: 'auto',
      }}>
        {/* Handle */}
        <div
          onClick={onToggle}
          role="button"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            margin: '0 12px', padding: '9px 14px', cursor: 'pointer',
            background: 'linear-gradient(180deg, rgba(20,12,32,.92), rgba(12,8,20,.96))',
            border: '1px solid rgba(192,132,252,.3)',
            borderBottom: open ? 'none' : '1px solid rgba(192,132,252,.3)',
            borderRadius: open ? '14px 14px 0 0' : 14,
            backdropFilter: 'blur(12px)',
            boxShadow: '0 -8px 30px rgba(0,0,0,.5)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{
              width: 24, height: 24, borderRadius: 8, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(192,132,252,.16)', color: C.violet,
            }}>
              <Glyph name="clock" size={13} color={C.violet}/>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
              <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 800, color: '#E9D5FF' }}>
                {rides.length} Scheduled
              </span>
              <span style={{
                fontFamily: COND, fontSize: 9, fontWeight: 700, letterSpacing: '.1em',
                color: 'rgba(192,132,252,.6)', textTransform: 'uppercase',
              }}>
                next in {nextCountdown}
              </span>
            </div>
          </div>
          <div style={{
            transform: open ? 'rotate(0deg)' : 'rotate(180deg)',
            transition: 'transform .3s ease', color: C.violet, opacity: .7,
          }}>
            <Glyph name="chev" size={16} color={C.violet}/>
          </div>
        </div>

        {/* Body */}
        <div style={{
          margin: '0 12px',
          maxHeight: open ? '42vh' : 0,
          overflow: open ? 'auto' : 'hidden',
          opacity: open ? 1 : 0,
          transition: 'max-height .35s cubic-bezier(.4,0,.2,1), opacity .25s ease',
          background: 'linear-gradient(180deg, rgba(12,8,20,.96), rgba(8,5,14,.98))',
          border: open ? '1px solid rgba(192,132,252,.3)' : 'none',
          borderTop: 'none',
          borderRadius: '0 0 14px 14px',
          backdropFilter: 'blur(12px)',
          WebkitOverflowScrolling: 'touch',
        }}>
          <div style={{ padding: open ? '6px 10px 14px' : 0 }}>
            {rides.map((r, i) => {
              const dist = (typeof driver?.lat === 'number' && hasCoords(r))
                ? haversineMiles(driver.lat, driver.lng, r.pickupLat, r.pickupLng)
                : null;
              const cd      = r._when ? r._when - now : null;
              const due     = cd !== null && cd <= 0;
              const urgent  = cd !== null && cd > 0 && cd < 15 * 60 * 1000;
              const warning = cd !== null && cd >= 15 * 60 * 1000 && cd < 30 * 60 * 1000;
              const dotColor = due || urgent ? C.red : warning ? C.amberBright : C.violet;
              const pool = r._when ? fmtPoolCountdown(r._when, now) : null;

              return (
                <div key={r.id || i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 10px',
                  borderBottom: i < rides.length - 1 ? '1px solid rgba(192,132,252,.1)' : 'none',
                  animation: `htFadeIn .3s ease ${i * 0.04}s both`,
                }}>
                  {/* Status dot */}
                  <div style={{
                    width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
                    background: dotColor,
                    boxShadow: `0 0 8px ${dotColor}`,
                    animation: (due || urgent || warning) ? 'htBlink 1.2s ease-in-out infinite' : 'none',
                  }}/>

                  {/* Pickup + meta */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: MONO, fontSize: 12, fontWeight: 700, color: '#F3E8FF',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {pickupLabelOf(r)}
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8, marginTop: 3,
                      fontFamily: MONO, fontSize: 9.5, color: 'rgba(192,132,252,.6)',
                    }}>
                      <span>{fmtSchedTime(r._when)}</span>
                      {dist !== null && (
                        <>
                          <span style={{ opacity: .5 }}>·</span>
                          <span>{dist.toFixed(1)} mi</span>
                        </>
                      )}
                      {r.dropoffLabel && (
                        <>
                          <span style={{ opacity: .5 }}>→</span>
                          <span style={{
                            maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {r.dropoffLabel}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right: ride countdown + pool entry badge stacked */}
                  <div style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'flex-end', gap: 4, flexShrink: 0,
                  }}>
                    {/* Ride time countdown */}
                    <div style={{
                      fontFamily: MONO, fontSize: 11, fontWeight: 800,
                      color: due || urgent ? C.red : warning ? C.amberBright : '#E9D5FF',
                      padding: '3px 9px', borderRadius: 8,
                      background: due || urgent ? 'rgba(248,113,113,.14)'
                                : warning       ? 'rgba(251,191,36,.14)'
                                :                 'rgba(192,132,252,.12)',
                    }}>
                      {cd !== null ? formatCountdown(cd) : '—'}
                    </div>

                    {/* Pool entry arrow badge */}
                    {pool && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '2px 7px', borderRadius: 6,
                        background: `${pool.color}18`,
                        border: `1px solid ${pool.color}44`,
                        animation: pool.urgent ? 'htBlink 1.2s ease-in-out infinite' : 'none',
                      }}>
                        <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5h6M6 2l3 3-3 3"
                            stroke={pool.color} strokeWidth="1.6"
                            strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span style={{
                          fontFamily: MONO, fontSize: 8.5, fontWeight: 800,
                          color: pool.color, letterSpacing: '.04em',
                        }}>
                          {pool.label}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function RadarOverlay({ svgRef }) {
  return (
    <svg ref={svgRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}
      viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <radialGradient id="ht-sweepGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="rgba(34,197,94,0.50)"/>
          <stop offset="45%"  stopColor="rgba(34,197,94,0.14)"/>
          <stop offset="100%" stopColor="rgba(34,197,94,0)"/>
        </radialGradient>
        <radialGradient id="ht-sweepGrad2" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="rgba(74,222,128,0.18)"/>
          <stop offset="60%"  stopColor="rgba(74,222,128,0.05)"/>
          <stop offset="100%" stopColor="rgba(74,222,128,0)"/>
        </radialGradient>
        <radialGradient id="ht-vig" cx="50%" cy="50%" r="60%">
          <stop offset="30%"  stopColor="transparent"/>
          <stop offset="100%" stopColor="rgba(0,0,0,0.55)"/>
        </radialGradient>
      </defs>
      <rect width="100" height="100" fill="url(#ht-vig)"/>
      {[14, 25, 36, 47].map((r, i) => (
        <circle key={i} cx="50" cy="50" r={r} fill="none"
          stroke="rgba(34,197,94,0.1)" strokeWidth="0.25" strokeDasharray="1.2 2.4"/>
      ))}
      {Array.from({ length: 24 }).map((_, i) => {
        const a     = i * 15 * Math.PI / 180;
        const major = i % 6 === 0;
        const r1    = major ? 45 : 46.4;
        const x1 = 50 + r1 * Math.sin(a),      y1 = 50 - r1 * Math.cos(a);
        const x2 = 50 + 47.5 * Math.sin(a),    y2 = 50 - 47.5 * Math.cos(a);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={major ? 'rgba(74,222,128,0.35)' : 'rgba(34,197,94,0.16)'}
          strokeWidth={major ? 0.4 : 0.22}/>;
      })}
      <line x1="46.5" y1="50" x2="53.5" y2="50" stroke="rgba(34,197,94,0.3)" strokeWidth="0.22"/>
      <line x1="50" y1="46.5" x2="50" y2="53.5" stroke="rgba(34,197,94,0.3)" strokeWidth="0.22"/>
      <circle cx="50" cy="50" r="0.75" fill="rgba(74,222,128,0.7)"/>
      <path id="ht-sweep2" d="M 50 50 L 50 0 A 55 55 0 0 1 50 0 Z" fill="url(#ht-sweepGrad2)" opacity="0.5"/>
      <path id="ht-sweep"  d="M 50 50 L 50 0 A 55 55 0 0 1 50 0 Z" fill="url(#ht-sweepGrad)"  opacity="0.75"/>
      <line id="ht-arm"    x1="50" y1="50" x2="50" y2="0" stroke="#4ADE80" strokeWidth="0.45" strokeLinecap="round" opacity="0.9"/>
      <circle id="ht-tipglow" cx="50" cy="0" r="2.2" fill="rgba(74,222,128,0.22)"/>
      <circle id="ht-tip"     cx="50" cy="0" r="1.1" fill="#4ADE80" opacity="0.95"/>
    </svg>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function HomeTab({
  driver,
  online,
  accounts = [],
  searches = [],
  scheduledRides = [],
  activeTrip,
  tripStage,
  tripStageColor,
  tripBtnLabel,
  earnings,
  onToggleOnline,
  onAdvanceTrip,
  advancePending,
  onUnreadChange,
}) {

  console.log(scheduledRides);
  const mapContainerRef = useRef(null);
  const mapRef          = useRef(null);
  const sweepRef        = useRef(0);
  const rafRef          = useRef(null);
  const svgRef          = useRef(null);
  const pulseLayersRef  = useRef(false);
  const onlineSinceRef  = useRef(null);  // tracks when this session went online
  const bootTimersRef   = useRef([]);

  const [mapReady, setMapReady]         = useState(false);
  const [driverCounts, setDriverCounts] = useState({ online: 0, offline: 0, approved: 0 });
  const [now, setNow]                   = useState(Date.now());
  const [mapBearing, setMapBearing]     = useState(-20);
  const [mapZoom, setMapZoom]           = useState(12);
  const [bootStep, setBootStep]         = useState(0);
  const [bootDone, setBootDone]         = useState(false);
  const [drawerOpen, setDrawerOpen]     = useState(false);
  const [alert, setAlert]               = useState(null);
  const prevDotRef    = useRef(0);
  const alertTimerRef = useRef(null);

  // ── Live 1Hz clock ─────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Track online session start ─────────────────────────────────────────
  useEffect(() => {
    if (online && !onlineSinceRef.current) onlineSinceRef.current = Date.now();
    if (!online) onlineSinceRef.current = null;
  }, [online]);

  // ── Boot sequence ──────────────────────────────────────────────────────
  useEffect(() => {
    bootTimersRef.current.forEach(clearTimeout);
    bootTimersRef.current = [];
    if (!online) { setBootStep(0); setBootDone(false); return; }
    setBootDone(false);
    setBootStep(0);
    const stepDelay = 240;
    for (let i = 1; i <= BOOT_LINES.length; i++) {
      const t = setTimeout(() => setBootStep(i), i * stepDelay);
      bootTimersRef.current.push(t);
    }
    const done = setTimeout(
      () => setBootDone(true),
      BOOT_LINES.length * stepDelay + 480
    );
    bootTimersRef.current.push(done);
    return () => { bootTimersRef.current.forEach(clearTimeout); bootTimersRef.current = []; };
  }, [online]);

  // ── Driver counts ──────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'Drivers'), snapshot => {
      let onlineN = 0, offlineN = 0, approvedN = 0;
      snapshot.forEach(doc => {
        const status = (doc.data().status ?? '').toLowerCase();
        if (status === 'online')   onlineN++;
        if (status === 'offline')  offlineN++;
        if (status === 'approved') approvedN++;
      });
      setDriverCounts({ online: onlineN, offline: offlineN, approved: approvedN });
    });
    return () => unsub();
  }, []);

  // ── Init / destroy Mapbox ──────────────────────────────────────────────
  useEffect(() => {
    if (!online) {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current         = null;
        pulseLayersRef.current = false;
        setMapReady(false);
      }
      return;
    }
    if (mapRef.current) return;

    const script  = document.createElement('script');
    script.src    = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js';
    script.async  = true;
    const link    = document.createElement('link');
    link.rel      = 'stylesheet';
    link.href     = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css';
    document.head.appendChild(link);
    document.head.appendChild(script);

    script.onload = () => {
      if (!mapContainerRef.current) return;
      const mapboxgl       = window.mapboxgl;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      const centerLng = driver?.lng ?? scheduledRides[0]?.pickupLng ?? -81.3792;
      const centerLat = driver?.lat ?? scheduledRides[0]?.pickupLat ?? 28.5383;

      const map = new mapboxgl.Map({
        container:          mapContainerRef.current,
        style:              MAP_STYLE,
        center:             [centerLng, centerLat],
        zoom:               12,
        pitch:              45,
        bearing:            -20,
        interactive:        false,
        attributionControl: false,
      });

      map.on('load', () => {
        mapRef.current = map;

        map.addSource('ht-searches',  { type: 'geojson', data: buildPickupGeoJSON(searches)          });
        map.addSource('ht-scheduled', { type: 'geojson', data: buildScheduledGeoJSON(scheduledRides) });

        map.addLayer({
          id: 'ht-demand', type: 'heatmap', source: 'ht-searches',
          paint: {
            'heatmap-weight':    ['interpolate', ['linear'], ['get', 'age'], 0, 0.2, 1, 1],
            'heatmap-intensity': 0.7,
            'heatmap-radius':    38,
            'heatmap-opacity':   0.32,
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0,   'rgba(0,0,0,0)',
              0.2, 'rgba(16,80,45,0.25)',
              0.5, 'rgba(34,197,94,0.35)',
              0.8, 'rgba(251,191,36,0.45)',
              1,   'rgba(251,146,60,0.6)',
            ],
          },
        });

        map.addLayer({ id: 'ht-search-halo', type: 'circle', source: 'ht-searches', paint: {
          'circle-radius':       14,
          'circle-color':        'rgba(52,211,153,0)',
          'circle-stroke-color': 'rgba(52,211,153,0.45)',
          'circle-stroke-width': 1.5,
          'circle-opacity':      ['*', ['get', 'age'], 0.6],
        }});
        map.addLayer({ id: 'ht-search-dot', type: 'circle', source: 'ht-searches', paint: {
          'circle-radius':       5,
          'circle-color':        ['case', ['get', 'guest'], 'rgba(251,146,60,0.95)', 'rgba(52,211,153,0.95)'],
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1.5,
          'circle-blur':         0.1,
          'circle-opacity':      ['*', ['get', 'age'], 0.9],
        }});

        map.addLayer({ id: 'ht-sched-halo', type: 'circle', source: 'ht-scheduled', paint: {
          'circle-radius':       22,
          'circle-color':        'rgba(0,0,0,0)',
          'circle-stroke-color': 'rgba(192,132,252,0.55)',
          'circle-stroke-width': 2.5,
          'circle-opacity':      1,
        }});
        map.addLayer({ id: 'ht-sched-dot', type: 'circle', source: 'ht-scheduled', paint: {
          'circle-radius':       8,
          'circle-color':        'rgba(192,132,252,0.95)',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 2,
        }});

        pulseLayersRef.current = true;

        let bearing = -20;
        const drift = setInterval(() => { bearing += 0.04; map.setBearing(bearing); }, 100);
        map.on('remove', () => clearInterval(drift));

        const telemetry = setInterval(() => {
          if (!mapRef.current) return;
          try {
            setMapBearing(mapRef.current.getBearing());
            setMapZoom(mapRef.current.getZoom());
          } catch (e) { /* torn down */ }
        }, 220);
        map.on('remove', () => clearInterval(telemetry));

        setMapReady(true);
      });
    };

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current         = null;
        pulseLayersRef.current = false;
        setMapReady(false);
      }
    };
  }, [online]); // eslint-disable-line

  // ── Re-center map on driver location update ────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !driver?.lat || !driver?.lng) return;
    mapRef.current.easeTo({
      center:   [driver.lng, driver.lat],
      duration: 1200,
      easing:   t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    });
  }, [driver?.lat, driver?.lng, mapReady]);

  // ── Update GeoJSON on data change ──────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !pulseLayersRef.current) return;
    const map   = mapRef.current;
    const apply = () => {
      map.getSource('ht-searches') ?.setData(buildPickupGeoJSON(searches));
      map.getSource('ht-scheduled')?.setData(buildScheduledGeoJSON(scheduledRides));
    };
    if (map.isStyleLoaded()) apply();
    else map.once('styledata', apply);
  }, [searches, scheduledRides, mapReady]);

  // ── Pulse halo animation ───────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !pulseLayersRef.current) return;
    const map = mapRef.current;
    let t = 0;
    const id = setInterval(() => {
      if (!map || !map.isStyleLoaded()) return;
      t += 0.06;
      const r  = 10 + 10 * ((Math.sin(t) + 1) / 2);
      const rs = 16 + 12 * ((Math.sin(t + 1) + 1) / 2);
      try {
        map.setPaintProperty('ht-search-halo', 'circle-radius', r);
        map.setPaintProperty('ht-search-halo', 'circle-stroke-width', 1 + 1.5 * ((Math.sin(t) + 1) / 2));
        map.setPaintProperty('ht-sched-halo',  'circle-radius', rs);
        map.setPaintProperty('ht-sched-halo',  'circle-stroke-width', 1.5 + 2 * ((Math.sin(t + 1) + 1) / 2));
      } catch (e) { /* layers gone */ }
    }, 40);
    return () => clearInterval(id);
  }, [mapReady]);

  // ── Radar sweep RAF ────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !online) { cancelAnimationFrame(rafRef.current); return; }
    const animate = () => {
      sweepRef.current = (sweepRef.current + 1.2) % 360;
      if (svgRef.current) {
        const angle = sweepRef.current;
        const toRad = d => (d * Math.PI) / 180;
        const R     = 55;
        const leadA = (angle + 80) % 360;
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
        q('#ht-sweep') ?.setAttribute('d', `M 50 50 L ${trailX} ${trailY} A ${R} ${R} 0 0 1 ${leadX} ${leadY} Z`);
        q('#ht-sweep2')?.setAttribute('d', `M 50 50 L ${cTrailX} ${cTrailY} A ${R} ${R} 0 0 1 ${cLeadX} ${cLeadY} Z`);
        q('#ht-arm')   ?.setAttribute('x2', leadX);
        q('#ht-arm')   ?.setAttribute('y2', leadY);
        q('#ht-tip')   ?.setAttribute('cx', tipX);
        q('#ht-tip')   ?.setAttribute('cy', tipY);
        q('#ht-tipglow')?.setAttribute('cx', tipX);
        q('#ht-tipglow')?.setAttribute('cy', tipY);
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [mapReady, online]);

  // ── Derived values ─────────────────────────────────────────────────────
  const dotCount       = useMemo(() => searches.filter(hasCoords).length, [searches]);
  const scheduledCount = useMemo(() => scheduledRides.filter(hasCoords).length, [scheduledRides]);
  const driverTotal    = driverCounts.online + driverCounts.offline + driverCounts.approved;

  const scheduledNearestMi = useMemo(
    () => nearestMi(driver?.lat, driver?.lng, scheduledRides),
    [driver?.lat, driver?.lng, scheduledRides]
  );
  const searchNearestMi = useMemo(
    () => nearestMi(driver?.lat, driver?.lng, searches),
    [driver?.lat, driver?.lng, searches]
  );
  const contacts = useMemo(
    () => gatherContacts(driver, searches, scheduledRides),
    [driver?.lat, driver?.lng, searches, scheduledRides]
  );

  const showRadar       = online && mapReady && bootDone;
  const showBoot        = online && !bootDone;
  const showLegend      = showRadar;
  const showOnlineCount = showRadar;

  // ── New search alert ───────────────────────────────────────────────────
  useEffect(() => {
    if (!showRadar) { prevDotRef.current = dotCount; return; }
    if (dotCount > prevDotRef.current) {
      const nearest = contacts.find(c => c.kind === 'search' || c.kind === 'guest');
      setAlert({
        dist: nearest ? nearest.dist : searchNearestMi,
        dir:  nearest ? compassLabel(nearest.bearing) : null,
        ts:   Date.now(),
      });
      clearTimeout(alertTimerRef.current);
      alertTimerRef.current = setTimeout(() => setAlert(null), 4200);
    }
    prevDotRef.current = dotCount;
  }, [dotCount, showRadar]); // eslint-disable-line

  useEffect(() => () => clearTimeout(alertTimerRef.current), []);

  const moneyStr   = fmtMoney(earnings);
  const toggleDrawer = useCallback(() => setDrawerOpen(o => !o), []);

  return (
    <>
      <style>{`
        @keyframes htSpin       { to { transform: rotate(360deg); } }
        @keyframes htSlideDown  { from{opacity:0;transform:translateY(-12px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes htRingPulse  { 0%,100%{transform:scale(1);opacity:.18} 50%{transform:scale(1.45);opacity:0} }
        @keyframes htBlink      { 0%,100%{opacity:1} 50%{opacity:.25} }
        @keyframes htFadeIn     { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes htScan       { from{top:-80px} to{top:100%} }
        @keyframes htBarPulse   { 0%,100%{transform:scaleY(.55);opacity:.5} 50%{transform:scaleY(1);opacity:1} }
        @keyframes htBootBlink  { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes htBracketGlow{ 0%,100%{opacity:.5} 50%{opacity:1} }
      `}</style>

      <div style={{ position: 'fixed', inset: 0, background: C.bg, overflow: 'hidden' }}>

        {/* Mapbox canvas */}
        <div ref={mapContainerRef} style={{
          position: 'absolute', inset: 0,
          opacity: online ? 1 : 0, transition: 'opacity .6s ease', pointerEvents: 'none',
        }}/>

        {/* Offline standby */}
        {!online && <OfflineStandby driver={driver}/>}

        {/* Atmosphere + radar + scanlines */}
        {showRadar && (
          <>
            <AtmosphereOverlay/>
            <RadarOverlay svgRef={svgRef}/>
            <ScanlineOverlay/>
            <CornerBrackets/>
            <CompassRose
              bearing={mapBearing}
              onlineSinceMs={onlineSinceRef.current}
              now={now}
            />
            <RangeRuler zoom={mapZoom}/>
            <EdgeContacts contacts={contacts} mapBearing={mapBearing}/>
            <LegendKey/>
          </>
        )}

        {/* Boot terminal */}
        {showBoot && <BootSequence step={bootStep}/>}

        {/* Map warming up spinner */}
        {online && bootDone && !mapReady && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', flexDirection: 'column', gap: 12, zIndex: 9,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              border: '2px solid rgba(34,197,94,.15)', borderTop: '2px solid #22C55E',
              animation: 'htSpin .9s linear infinite',
            }}/>
            <span style={{
              fontFamily: MONO, fontSize: 11, fontWeight: 700,
              letterSpacing: '.1em', color: 'rgba(255,255,255,.35)',
            }}>
              acquiring map…
            </span>
          </div>
        )}

        {/* Top ribbon */}
        {!showBoot && (
          <TopRibbon
            now={now}
            online={online}
            mapReady={mapReady}
            activeTrip={activeTrip}
            tripStage={tripStage}
            tripStageColor={tripStageColor}
            heading={mapBearing}
            lat={driver?.lat}
            lng={driver?.lng}
          />
        )}

        {/* Rotating badge */}
        {showLegend && (
          <RotatingBadge
            dotCount={dotCount}
            accounts={accounts}
            scheduledCount={scheduledCount}
            scheduledNearestMi={scheduledNearestMi}
            searchNearestMi={searchNearestMi}
            earnings={earnings}
            fmtMi={fmtMi}
          />
        )}

        {/* Fleet count chip */}
        {showOnlineCount && (
          <OnlineDriverChip online={driverCounts.online} total={driverTotal}/>
        )}

        {/* Bottom stat strip */}
        {showRadar && (
          <div style={{
            position: 'absolute', bottom: 56, left: '50%', transform: 'translateX(-50%)',
            zIndex: 19, pointerEvents: 'none',
            display: 'flex', alignItems: 'center',
            background: C.panel, backdropFilter: 'blur(12px)',
            border: '1px solid rgba(34,197,94,.16)', borderRadius: 14,
            boxShadow: '0 8px 28px rgba(0,0,0,.45)',
            overflow: 'hidden', maxWidth: 'calc(100vw - 40px)',
            animation: 'htSlideDown .5s ease both',
          }}>
            {moneyStr && <StatPill glyph="cash" value={moneyStr} sub="today" color={C.amberBright}/>}
          </div>
        )}

        {/* New request alert toast */}
        {showRadar && <ContactAlert alert={alert}/>}

        {/* Scheduled rides drawer */}
        {showRadar && scheduledRides.length > 0 && (
          <ScheduledDrawer
            open={drawerOpen}
            onToggle={toggleDrawer}
            scheduledRides={scheduledRides}
            driver={driver}
            now={now}
          />
        )}

        {/* StatusCard HUD */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          display: 'flex', justifyContent: 'center',
          padding: '46px 16px 0', zIndex: 30, pointerEvents: 'none',
          animation: 'htSlideDown .5s cubic-bezier(.34,1.2,.64,1) both',
        }}>
          <div style={{
            width: '100%', maxWidth: 420, pointerEvents: 'auto',
            filter: 'drop-shadow(0 8px 32px rgba(0,0,0,0.55))',
          }}>
            <StatusCard
              online={online}
              searches={searches}
              activeTrip={activeTrip}
              tripStage={tripStage}
              onToggle={onToggleOnline}
              scheduledRides={scheduledRides}
              driver={driver}
            />
          </div>
        </div>

      </div>
    </>
  );
}

