/**
 * ActiveTripScreen.jsx
 * ════════════════════════════════════════════════════════════════════════════
 * Full-screen, navigation-grade trip view rendered whenever the driver has an
 * assigned ride. Replaces the radar HomeTab UI for the duration of the trip.
 */

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { getFirestore, doc, getDoc, onSnapshot, collection, addDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { firebase_app }     from '@/firebase/config';
import { useUpdateTrip }    from '@/App/Drivers/useUpdateTrip';
import { useGetRoute }      from '@/App/Drivers/useGetRoute';

const db = getFirestore(firebase_app);

// ─── tokens ──────────────────────────────────────────────────────────────────
const MAPBOX_TOKEN = 'pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA';
const MAP_STYLE    = 'mapbox://styles/mapbox/dark-v11';
const MB_VERSION   = 'v3.3.0';

// ─── palette ─────────────────────────────────────────────────────────────────
const C = {
  bg:          '#050A06',
  panel:       'rgba(5,10,6,.82)',
  panelDeep:   'rgba(2,5,3,.94)',
  green:       '#22C55E',
  greenBright: '#4ADE80',
  greenSoft:   '#34D399',
  amber:       '#FB923C',
  amberBright: '#FBBF24',
  violet:      '#C084FC',
  cyan:        '#67E8F9',
  red:         '#F87171',
  redDeep:     '#EF4444',
  white:       'rgba(255,255,255,.88)',
  ink:         'rgba(255,255,255,.42)',
  inkDim:      'rgba(255,255,255,.22)',
  inkFaint:    'rgba(255,255,255,.10)',
  line:        'rgba(34,197,94,.22)',
};

const MONO = "'JetBrains Mono','SFMono-Regular',monospace";
const COND = "'Barlow Condensed','Barlow',sans-serif";

// ─── tunables ─────────────────────────────────────────────────────────────────
const SMOOTH_POS             = 0.16;
const SMOOTH_BEARING         = 0.18;
const SMOOTH_SPEED           = 0.22;
const TRIM_EVERY_FRAMES      = 2;
const FOLLOW_THROTTLE_MS     = 220;
const FALLBACK_SPEED_MPH     = 24;
const MIN_MOVE_FOR_BEARING_M = 4;
const STALE_FIX_MS           = 30000;
const ARRIVE_MAX_MILES       = 1.0;
const SPEED_GAUGE_MAX_MPH    = 80;
const SPEED_FLOOR_FOR_ETA    = 6;
const SPEED_DERIVE_MIN_DT_S  = 0.4;
const MPS_TO_MPH             = 2.2369362921;

// ─── trip state machine ───────────────────────────────────────────────────────
const STAGES = {
  driver_assigned: {
    action:      'arrive',
    btnLabel:    "SLIDE — I'VE ARRIVED",
    btnColor:    C.cyan,
    statusLabel: 'EN ROUTE TO PICKUP',
    statusShort: 'TO PICKUP',
    statusColor: C.cyan,
    phase:       'toPickup',
    hint:        'Drive to the pickup location, then slide when you arrive.',
  },
  arrived: {
    action:      'start',
    btnLabel:    'SLIDE — START TRIP',
    btnColor:    C.greenBright,
    statusLabel: 'ARRIVED · AWAITING RIDER',
    statusShort: 'WAITING',
    statusColor: C.greenBright,
    phase:       'toPickup',
    hint:        'Rider notified. Slide to start once they board.',
  },
  in_progress: {
    action:      'complete',
    btnLabel:    'SLIDE — COMPLETE TRIP',
    btnColor:    C.amberBright,
    statusLabel: 'TRIP IN PROGRESS',
    statusShort: 'IN PROGRESS',
    statusColor: C.amberBright,
    phase:       'toDropoff',
    hint:        'Drive to the drop-off, then slide to complete.',
  },
  completed: {
    action:      null,
    btnLabel:    null,
    statusLabel: 'TRIP COMPLETED',
    statusShort: 'DONE',
    statusColor: C.greenBright,
    phase:       'toDropoff',
    hint:        'Trip complete. Great job!',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// GEO HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const DEG = Math.PI / 180;
const EARTH_MI = 3958.8;

function haversineMi(lat1, lng1, lat2, lng2) {
  const dLat = (lat2 - lat1) * DEG;
  const dLng = (lng2 - lng1) * DEG;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(dLng / 2) ** 2;
  return EARTH_MI * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingDeg(lat1, lng1, lat2, lng2) {
  const φ1 = lat1 * DEG, φ2 = lat2 * DEG;
  const Δλ = (lng2 - lng1) * DEG;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function lerpAngle(a, b, t) {
  let d = ((b - a + 540) % 360) - 180;
  return (a + d * t + 360) % 360;
}

const lerp = (a, b, t) => a + (b - a) * t;

function decodePolyline(encoded) {
  if (!encoded) return [];
  const pts = [];
  let i = 0, lat = 0, lng = 0;
  while (i < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    pts.push([lat / 1e5, lng / 1e5]);
  }
  return pts;
}

function projectOnSegment(p, a, b) {
  const latRef = ((a[1] + b[1]) / 2) * DEG;
  const kx = Math.cos(latRef) || 1e-6;
  const ax = a[0] * kx, ay = a[1];
  const bx = b[0] * kx, by = b[1];
  const px = p[0] * kx, py = p[1];
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  if (t < 0) t = 0; else if (t > 1) t = 1;
  const cx = ax + dx * t, cy = ay + dy * t;
  const ddx = px - cx, ddy = py - cy;
  return { t, dist2: ddx * ddx + ddy * ddy, point: [cx / kx, cy] };
}

function projectOntoRoute(coords, p, fromIdx = 0) {
  if (!coords || coords.length < 2) {
    return { idx: 0, t: 0, point: coords?.[0] || p, dist2: 0 };
  }
  let best = { idx: fromIdx, t: 0, point: coords[fromIdx] || coords[0], dist2: Infinity };
  const start = Math.max(0, fromIdx - 2);
  for (let i = start; i < coords.length - 1; i++) {
    const r = projectOnSegment(p, coords[i], coords[i + 1]);
    if (r.dist2 < best.dist2) best = { idx: i, t: r.t, point: r.point, dist2: r.dist2 };
  }
  return best;
}

function remainingFrom(coords, proj) {
  const out = [proj.point];
  for (let i = proj.idx + 1; i < coords.length; i++) out.push(coords[i]);
  if (out.length === 1) out.push(coords[coords.length - 1]);
  return out;
}

function traveledTo(coords, proj) {
  const out = [];
  for (let i = 0; i <= proj.idx; i++) out.push(coords[i]);
  out.push(proj.point);
  return out;
}

function pathLengthMi(coords) {
  let s = 0;
  for (let i = 1; i < coords.length; i++) {
    s += haversineMi(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
  }
  return s;
}

// ─── formatting ────────────────────────────────────────────────────────────────
function fmtMi(mi) {
  if (mi === null || mi === undefined || !isFinite(mi)) return '—';
  if (mi < 0.1) return `${Math.round(mi * 5280)} ft`;
  if (mi < 10)  return `${mi.toFixed(1)} mi`;
  return `${Math.round(mi)} mi`;
}

function fmtEtaMin(min) {
  if (min === null || min === undefined || !isFinite(min)) return '—';
  if (min < 1) return '<1';
  return `${Math.round(min)}`;
}

function fmtArrivalClock(min) {
  if (min === null || !isFinite(min)) return '—';
  const d = new Date(Date.now() + min * 60000);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${m} ${ap}`;
}

function getInitials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function firstName(name) {
  if (!name) return '—';
  return name.trim().split(/\s+/)[0];
}

// ─── Google Maps deep-link ───────────────────────────────────────────────────
function navUrl(lat, lng, fallbackText) {
  const base = 'https://www.google.com/maps/dir/?api=1&travelmode=driving&dir_action=navigate&destination=';
  if (typeof lat === 'number' && typeof lng === 'number' && isFinite(lat) && isFinite(lng)) {
    return `${base}${lat},${lng}`;
  }
  if (fallbackText && fallbackText !== '—') {
    return `${base}${encodeURIComponent(fallbackText)}`;
  }
  return null;
}

function openNav(url) {
  if (!url) return;
  try {
    const w = window.open(url, '_blank', 'noopener,noreferrer');
    if (!w) window.location.href = url;
  } catch (e) {
    window.location.href = url;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR TOAST
// ═══════════════════════════════════════════════════════════════════════════════
function ErrorToast({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div
      onClick={onDismiss}
      style={{
        position: 'fixed',
        top: 'max(64px, calc(env(safe-area-inset-top) + 56px))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        width: 'min(360px, calc(100vw - 32px))',
        padding: '13px 18px',
        background: 'rgba(239,68,68,.18)',
        border: '1px solid rgba(239,68,68,.5)',
        borderRadius: 18,
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        boxShadow: '0 10px 40px rgba(0,0,0,.6), 0 0 0 1px rgba(239,68,68,.15)',
        cursor: 'pointer',
        animation: 'ats-slidedown .32s cubic-bezier(.34,1.1,.64,1) both',
        textAlign: 'center',
        pointerEvents: 'auto',
      }}
    >
      <div style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: C.red, lineHeight: 1.55, marginBottom: 4 }}>
        ⚠ {message}
      </div>
      <div style={{ fontFamily: COND, fontSize: 9, fontWeight: 800, letterSpacing: '.14em', color: 'rgba(248,113,113,.5)', textTransform: 'uppercase' }}>
        Tap to dismiss
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SMALL PRESENTATIONAL PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════════════

function Dot({ color, size = 8, pulse = true }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: color, flexShrink: 0,
      boxShadow: `0 0 ${size}px ${color}99`,
      animation: pulse ? 'ats-blink 1.6s ease-in-out infinite' : 'none',
    }}/>
  );
}

function RouteRail({ status }) {
  const bottomColor = status === 'in_progress' ? C.amberBright : C.white;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: 3, gap: 0 }}>
      <div style={{
        width: 10, height: 10, borderRadius: '50%',
        background: C.greenBright, border: '2px solid rgba(255,255,255,.7)',
        boxShadow: `0 0 10px ${C.greenBright}`,
      }}/>
      <div style={{
        width: 1.5, height: 28,
        background: `linear-gradient(to bottom, ${C.greenBright}55, rgba(255,255,255,.12))`,
        margin: '4px 0', borderRadius: 2,
      }}/>
      <div style={{
        width: 10, height: 10,
        background: bottomColor,
        transform: 'rotate(45deg)',
        boxShadow: `0 0 8px ${bottomColor}88`,
      }}/>
    </div>
  );
}

function AddrRow({ label, text, dimmed, mapUrl, active }) {
  const tappable = !!mapUrl;
  const handle = (e) => { e.preventDefault(); e.stopPropagation(); openNav(mapUrl); };
  return (
    <div
      onClick={tappable ? handle : undefined}
      role={tappable ? 'button' : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        cursor: tappable ? 'pointer' : 'default',
        borderRadius: 10, padding: tappable ? '2px 2px' : 0,
        transition: 'background .15s ease',
        background: active ? 'rgba(103,232,249,.06)' : 'transparent',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: COND, fontSize: 8, fontWeight: 800, letterSpacing: '.14em',
          color: active ? C.cyan : C.inkDim, textTransform: 'uppercase', marginBottom: 2,
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          {label}
          {active && (
            <span style={{
              fontFamily: COND, fontSize: 7.5, fontWeight: 900, letterSpacing: '.12em',
              color: C.cyan, background: 'rgba(103,232,249,.14)', borderRadius: 4, padding: '0 4px',
            }}>
              NAVIGATING
            </span>
          )}
        </div>
        <div style={{
          fontFamily: MONO, fontSize: 12, fontWeight: dimmed ? 600 : 700,
          color: dimmed ? 'rgba(255,255,255,.45)' : C.white,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {text || '—'}
        </div>
      </div>
      {tappable && (
        <div style={{
          flexShrink: 0, width: 32, height: 32, borderRadius: 9,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: active ? 'rgba(103,232,249,.16)' : 'rgba(103,232,249,.10)',
          border: `1px solid ${active ? 'rgba(103,232,249,.5)' : 'rgba(103,232,249,.28)'}`,
          color: C.cyan,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="3 11 22 2 13 21 11 13 3 11"/>
          </svg>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOP HUD
// ═══════════════════════════════════════════════════════════════════════════════
function TopBar({ statusLabel, statusColor, rideId, paymentMethod, progress, gpsLive, mph }) {
  const pm = (paymentMethod || '').toLowerCase();
  const pmColor  = pm === 'cash' ? C.amberBright : pm === 'card' ? C.cyan : C.ink;
  const pmBg     = pm === 'cash' ? 'rgba(251,191,36,.15)' : pm === 'card' ? 'rgba(103,232,249,.15)' : 'rgba(255,255,255,.07)';
  const pmBorder = pm === 'cash' ? 'rgba(251,191,36,.35)' : pm === 'card' ? 'rgba(103,232,249,.35)' : 'rgba(255,255,255,.12)';
  const pmLabel  = pm === 'cash' ? '$ CASH' : pm === 'card' ? '▣ CARD' : pm.toUpperCase();
  const pct = Math.max(0, Math.min(1, progress ?? 0));
  const showMph = gpsLive && mph != null && isFinite(mph);

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30,
      background: 'linear-gradient(180deg, rgba(3,6,4,.94) 55%, transparent)',
      paddingTop: 'max(8px, env(safe-area-inset-top))',
      pointerEvents: 'none',
    }}>
      <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ fontFamily: COND, fontSize: 11, fontWeight: 800, letterSpacing: '.22em', color: 'rgba(255,255,255,.45)' }}>
            UATOB
          </span>
          <span style={{ color: C.inkFaint, fontFamily: MONO, fontSize: 9 }}>·</span>
          <Dot color={statusColor} size={7}/>
          <span style={{ fontFamily: COND, fontSize: 10, fontWeight: 800, letterSpacing: '.14em', color: statusColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {statusLabel}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {showMph && (
            <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 3 }}>
              <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, color: C.greenBright }}>{Math.round(mph)}</span>
              <span style={{ fontFamily: COND, fontSize: 7.5, fontWeight: 800, letterSpacing: '.1em', color: C.inkDim }}>MPH</span>
            </span>
          )}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: MONO, fontSize: 8, fontWeight: 800, letterSpacing: '.1em', color: gpsLive ? C.greenBright : C.inkDim }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: gpsLive ? C.greenBright : C.inkDim, boxShadow: gpsLive ? `0 0 6px ${C.greenBright}` : 'none', animation: gpsLive ? 'ats-blink 1.4s ease-in-out infinite' : 'none' }}/>
            {gpsLive ? 'LIVE GPS' : 'GPS…'}
          </span>
          {pm && (
            <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 800, letterSpacing: '.08em', color: pmColor, background: pmBg, border: `1px solid ${pmBorder}`, borderRadius: 6, padding: '2px 7px' }}>
              {pmLabel}
            </span>
          )}
          <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: C.inkDim, letterSpacing: '.06em' }}>
            #{(rideId || '').slice(-6).toUpperCase()}
          </span>
        </div>
      </div>
      <div style={{ height: 2.5, margin: '0 16px 0', background: 'rgba(255,255,255,.07)', borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${pct * 100}%`, background: `linear-gradient(90deg, ${statusColor}, ${statusColor}dd)`, borderRadius: 2, boxShadow: `0 0 10px ${statusColor}aa`, transition: 'width .6s cubic-bezier(.4,0,.2,1)' }}/>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ETA CARD
// ═══════════════════════════════════════════════════════════════════════════════
function EtaCard({ etaMin, distMi, status, arrivalClock }) {
  const accent = status === 'driver_assigned' ? C.cyan
               : status === 'arrived'          ? C.greenBright
               : status === 'in_progress'      ? C.amberBright
               :                                 C.greenBright;
  const targetWord = status === 'in_progress' ? 'DROP-OFF' : 'PICKUP';

  return (
    <div style={{
      position: 'absolute',
      top: 'calc(54px + env(safe-area-inset-top))',
      left: '50%', transform: 'translateX(-50%)',
      zIndex: 28, pointerEvents: 'none',
      display: 'flex', alignItems: 'stretch', gap: 0,
      background: C.panelDeep, backdropFilter: 'blur(16px)',
      border: `1px solid ${accent}33`,
      borderRadius: 16, padding: '8px 4px',
      boxShadow: `0 8px 28px rgba(0,0,0,.6), 0 0 26px ${accent}1a`,
      animation: 'ats-slidedown .45s cubic-bezier(.34,1.2,.64,1) both',
      minWidth: 244,
    }}>
      <div style={{ flex: 1, textAlign: 'center', padding: '0 12px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 3 }}>
          <span style={{ fontFamily: MONO, fontSize: 26, fontWeight: 800, lineHeight: 1, color: accent, textShadow: `0 0 18px ${accent}55` }}>
            {fmtEtaMin(etaMin)}
          </span>
          <span style={{ fontFamily: COND, fontSize: 11, fontWeight: 800, color: accent, letterSpacing: '.08em' }}>MIN</span>
        </div>
        <div style={{ fontFamily: COND, fontSize: 8, fontWeight: 800, letterSpacing: '.16em', color: C.inkDim, marginTop: 2 }}>
          TO {targetWord}
        </div>
      </div>
      <div style={{ width: 1, background: 'rgba(255,255,255,.08)', margin: '2px 0' }}/>
      <div style={{ flex: 1, textAlign: 'center', padding: '0 10px' }}>
        <div style={{ fontFamily: MONO, fontSize: 17, fontWeight: 800, color: C.white, lineHeight: 1.2 }}>{fmtMi(distMi)}</div>
        <div style={{ fontFamily: COND, fontSize: 8, fontWeight: 800, letterSpacing: '.16em', color: C.inkDim, marginTop: 3 }}>DISTANCE</div>
      </div>
      <div style={{ width: 1, background: 'rgba(255,255,255,.08)', margin: '2px 0' }}/>
      <div style={{ flex: 1, textAlign: 'center', padding: '0 10px' }}>
        <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 800, color: C.greenSoft, lineHeight: 1.3 }}>{arrivalClock}</div>
        <div style={{ fontFamily: COND, fontSize: 8, fontWeight: 800, letterSpacing: '.16em', color: C.inkDim, marginTop: 3 }}>ARRIVAL</div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPEEDOMETER
// ═══════════════════════════════════════════════════════════════════════════════
function Speedometer({ mph, gpsLive }) {
  const has   = gpsLive && mph != null && isFinite(mph) && mph >= 0;
  const val   = has ? Math.max(0, Math.min(SPEED_GAUGE_MAX_MPH, mph)) : 0;
  const frac  = val / SPEED_GAUGE_MAX_MPH;
  const R     = 30;
  const CIRC  = 2 * Math.PI * R;
  const ARC   = 0.75;
  const track = `${ARC * CIRC} ${CIRC}`;
  const value = `${frac * ARC * CIRC} ${CIRC}`;
  const accent = !has ? C.inkDim : mph >= 72 ? C.redDeep : mph >= 55 ? C.amberBright : C.greenBright;

  return (
    <div style={{
      position: 'absolute', left: 12, top: '46%', transform: 'translateY(-50%)',
      zIndex: 27, pointerEvents: 'none', width: 84, height: 84,
      animation: 'ats-slidein-left .45s cubic-bezier(.34,1.2,.64,1) both',
    }}>
      <div style={{
        position: 'relative', width: 84, height: 84, borderRadius: '50%',
        background: 'radial-gradient(circle at 50% 42%, rgba(8,16,10,.78), rgba(2,5,3,.92))',
        border: `1px solid ${accent}33`,
        boxShadow: `0 8px 26px rgba(0,0,0,.6), 0 0 22px ${accent}14`,
        backdropFilter: 'blur(10px)',
      }}>
        <svg width="84" height="84" viewBox="0 0 80 80" style={{ position: 'absolute', inset: 0 }}>
          <circle cx="40" cy="40" r={R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="5" strokeLinecap="round" strokeDasharray={track} transform="rotate(135 40 40)"/>
          <circle cx="40" cy="40" r={R} fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round" strokeDasharray={value} transform="rotate(135 40 40)" style={{ transition: 'stroke-dasharray .25s linear, stroke .3s ease', filter: `drop-shadow(0 0 5px ${accent}aa)` }}/>
          {Array.from({ length: 9 }).map((_, i) => {
            const ang = (135 + 270 * (i / 8)) * Math.PI / 180;
            const x1 = 40 + 23.5 * Math.cos(ang), y1 = 40 + 23.5 * Math.sin(ang);
            const x2 = 40 + 27.5 * Math.cos(ang), y2 = 40 + 27.5 * Math.sin(ang);
            const lit = has && (i / 8) <= frac + 0.001;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={lit ? accent : 'rgba(255,255,255,.16)'} strokeWidth="1.4" strokeLinecap="round" style={{ transition: 'stroke .3s ease' }}/>;
          })}
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontFamily: MONO, fontSize: 22, fontWeight: 800, lineHeight: .95, color: has ? C.white : C.inkDim, textShadow: has ? `0 0 14px ${accent}66` : 'none' }}>
            {has ? Math.round(val) : '—'}
          </span>
          <span style={{ fontFamily: COND, fontSize: 8, fontWeight: 800, letterSpacing: '.18em', color: accent, marginTop: 1 }}>MPH</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RIDER CARD
// ═══════════════════════════════════════════════════════════════════════════════
function RiderCard({ rider }) {
  if (!rider) return null;
  const rating = typeof rider.rating === 'number' ? rider.rating.toFixed(1) : null;
  return (
    <div style={{
      position: 'absolute',
      top: 'calc(108px + env(safe-area-inset-top))',
      right: 12, zIndex: 29,
      display: 'flex', alignItems: 'center', gap: 8,
      background: 'rgba(2,4,3,.8)', backdropFilter: 'blur(10px)',
      border: '1px solid rgba(139,92,246,.28)',
      borderRadius: 14, padding: '6px 10px 6px 6px',
      boxShadow: '0 6px 22px rgba(0,0,0,.5)',
      animation: 'ats-slidein-right .45s cubic-bezier(.34,1.2,.64,1) both',
      pointerEvents: 'none', maxWidth: 168,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
        background: 'linear-gradient(135deg, #8B5CF6 0%, #4C1D95 100%)',
        border: '2px solid rgba(255,255,255,.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: MONO, fontSize: 12, fontWeight: 800, color: '#fff',
        boxShadow: '0 3px 14px rgba(139,92,246,.6)',
      }}>
        {getInitials(rider.name)}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: COND, fontSize: 13, fontWeight: 800, letterSpacing: '.04em', color: C.white, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.1 }}>
          {firstName(rider.name)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
          {rating && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill={C.amberBright}>
                <polygon points="12 2 15 9 22 9 16.5 13.5 18.5 21 12 16.5 5.5 21 7.5 13.5 2 9 9 9"/>
              </svg>
              <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: C.amberBright }}>{rating}</span>
            </span>
          )}
          <span style={{ fontFamily: COND, fontSize: 8, fontWeight: 700, letterSpacing: '.1em', color: C.inkDim }}>RIDER</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECENTER FAB
// ═══════════════════════════════════════════════════════════════════════════════
function RecenterFab({ visible, onClick }) {
  return (
    <button onClick={onClick} aria-label="Recenter on my location" style={{
      position: 'absolute', right: 14, bottom: 'calc(258px + env(safe-area-inset-bottom))', zIndex: 33,
      width: 46, height: 46, borderRadius: 14, border: 'none', cursor: 'pointer',
      background: C.panelDeep, backdropFilter: 'blur(12px)',
      boxShadow: '0 6px 22px rgba(0,0,0,.6), inset 0 0 0 1px rgba(34,197,94,.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.greenBright,
      opacity: visible ? 1 : 0, transform: visible ? 'scale(1)' : 'scale(.7)',
      pointerEvents: visible ? 'auto' : 'none',
      transition: 'opacity .25s ease, transform .25s cubic-bezier(.34,1.5,.64,1)',
    }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3.2"/>
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
      </svg>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLIDE-TO-CONFIRM
// ═══════════════════════════════════════════════════════════════════════════════
function SlideAction({ label, color, onConfirm, pending, failed }) {
  const trackRef    = useRef(null);
  const maxRef      = useRef(0);
  const draggingRef = useRef(false);
  const offsetRef   = useRef(0);
  const [x, setX]             = useState(0);
  const [committed, setCommitted] = useState(false);

  useEffect(() => {
    setCommitted(false);
    offsetRef.current = 0;
    setX(0);
  }, [failed]);

  const measure = useCallback(() => {
    if (!trackRef.current) return 0;
    maxRef.current = Math.max(0, trackRef.current.clientWidth - 50 - 4 * 2);
    return maxRef.current;
  }, []);

  useEffect(() => { measure(); }, [measure]);

  const clientX = (e) => (e.touches?.[0]?.clientX ?? e.clientX ?? 0);
  const setOffset = (px) => { offsetRef.current = px; setX(px); };

  const onDown = (e) => {
    if (pending || committed) return;
    draggingRef.current = true;
    measure();
    const startX   = clientX(e);
    const startOff = offsetRef.current;

    const move = (ev) => {
      if (!draggingRef.current) return;
      let nx = startOff + (clientX(ev) - startX);
      if (nx < 0) nx = 0;
      else if (nx > maxRef.current) nx = maxRef.current;
      setOffset(nx);
      if (ev.cancelable) ev.preventDefault();
    };

    const up = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
      if (offsetRef.current >= maxRef.current * 0.88) {
        setOffset(maxRef.current);
        setCommitted(true);
        onConfirm?.();
      } else {
        setOffset(0);
      }
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', up);
  };

  const THUMB    = 50;
  const PAD      = 4;
  const progress = maxRef.current ? x / maxRef.current : 0;
  const showDone = committed && !failed && !pending;

  return (
    <div ref={trackRef} style={{
      position: 'relative', width: '100%', height: 58, borderRadius: 18,
      background: 'rgba(255,255,255,.05)', border: `1px solid ${color}33`,
      overflow: 'hidden', userSelect: 'none', touchAction: 'none',
      boxShadow: `inset 0 0 0 1px rgba(255,255,255,.02)`,
    }}>
      <div style={{
        position: 'absolute', inset: 0, width: `${PAD + THUMB + x}px`,
        background: `linear-gradient(135deg, ${color}33, ${color}11)`,
        transition: draggingRef.current ? 'none' : 'width .28s cubic-bezier(.34,1.1,.64,1)',
      }}/>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: COND, fontSize: 15, fontWeight: 900, letterSpacing: '.12em', textTransform: 'uppercase',
        color: color, opacity: pending || showDone ? 0 : 1 - progress * 0.9,
        transition: 'opacity .15s ease', paddingLeft: 30, pointerEvents: 'none',
      }}>
        {label}
      </div>
      {!pending && !showDone && (
        <div style={{ position: 'absolute', right: 18, top: 0, bottom: 0, display: 'flex', alignItems: 'center', gap: 1, opacity: 0.5 - progress * 0.5, pointerEvents: 'none' }}>
          {[0, 1, 2].map(i => (
            <svg key={i} width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
              style={{ animation: `ats-chev 1.3s ${i * 0.16}s ease-in-out infinite` }}>
              <polyline points="9 6 15 12 9 18"/>
            </svg>
          ))}
        </div>
      )}
      <div
        onPointerDown={onDown}
        onTouchStart={onDown}
        style={{
          position: 'absolute', top: PAD, left: PAD + x,
          width: THUMB, height: 58 - PAD * 2, borderRadius: 14,
          background: pending ? 'rgba(255,255,255,.1)' : `linear-gradient(135deg, ${color}, ${color}cc)`,
          boxShadow: pending ? 'none' : `0 4px 16px ${color}66, inset 0 1px 0 rgba(255,255,255,.3)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: pending || showDone ? 'default' : 'grab',
          transition: draggingRef.current ? 'none' : 'left .28s cubic-bezier(.34,1.1,.64,1)',
          touchAction: 'none',
        }}
      >
        {pending ? (
          <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(0,0,0,.25)', borderTop: '2px solid #000', animation: 'ats-spin .7s linear infinite' }}/>
        ) : showDone ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 6 15 12 9 18"/>
          </svg>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NAVIGATE BUTTON
// ═══════════════════════════════════════════════════════════════════════════════
function NavigateButton({ targetWord, url, accent }) {
  if (!url) return null;
  return (
    <button onClick={() => openNav(url)} style={{
      width: '100%', marginBottom: 10, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
      background: `linear-gradient(135deg, ${accent}1f, ${accent}0d)`,
      border: `1px solid ${accent}44`, borderRadius: 14, padding: '11px 14px',
      fontFamily: COND, fontSize: 13, fontWeight: 900, letterSpacing: '.12em',
      textTransform: 'uppercase', color: accent,
      WebkitTapHighlightColor: 'transparent',
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="3 11 22 2 13 21 11 13 3 11"/>
      </svg>
      Navigate to {targetWord} · Google Maps
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BOTTOM ACTION SHEET
// ═══════════════════════════════════════════════════════════════════════════════
function ActionSheet({ trip, stage, distToTarget, onAction, pending, error }) {
  const cfg = STAGES[stage] || STAGES.driver_assigned;
  if (stage === 'completed') return <CompletedSheet trip={trip}/>;

  const phase   = cfg.phase;
  const pickup  = trip?.pickup  || trip?.pickupLabel  || trip?.pickupAddress  || '—';
  const dropoff = trip?.dropoff || trip?.dropoffLabel || trip?.dropoffAddress || '—';
  const distStr = distToTarget !== null ? fmtMi(distToTarget) : null;

  const pickupUrl  = navUrl(trip?.pickupLat,  trip?.pickupLng,  pickup);
  const dropoffUrl = navUrl(trip?.dropoffLat, trip?.dropoffLng, dropoff);
  const targetWord = phase === 'toDropoff' ? 'DROP-OFF' : 'PICKUP';
  const targetUrl  = phase === 'toDropoff' ? dropoffUrl : pickupUrl;

  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 32, animation: 'ats-slideup .45s cubic-bezier(.34,1.1,.64,1) both' }}>
      <div style={{
        background: C.panelDeep,
        borderTop: `1px solid ${cfg.statusColor}28`,
        borderRadius: '24px 24px 0 0',
        backdropFilter: 'blur(18px)',
        boxShadow: `0 -12px 48px rgba(0,0,0,.65), 0 0 40px ${cfg.statusColor}12`,
        paddingTop: 12, paddingLeft: 16, paddingRight: 16,
        paddingBottom: 'max(20px, calc(env(safe-area-inset-bottom) + 12px))',
      }}>
        <div style={{ width: 36, height: 3.5, borderRadius: 2, background: 'rgba(255,255,255,.12)', margin: '0 auto 10px' }}/>

        <div style={{
          display: 'flex', gap: 12, alignItems: 'stretch', marginBottom: 10,
          background: 'rgba(255,255,255,.03)', borderRadius: 12,
          border: '1px solid rgba(255,255,255,.06)', padding: '9px 12px',
        }}>
          <RouteRail status={stage}/>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
            <AddrRow label="Pickup"   text={pickup}  dimmed={phase === 'toDropoff'} active={phase === 'toPickup'}  mapUrl={pickupUrl}/>
            <AddrRow label="Drop-off" text={dropoff} dimmed={phase !== 'toDropoff'} active={phase === 'toDropoff'} mapUrl={dropoffUrl}/>
          </div>
        </div>

        <NavigateButton targetWord={targetWord} url={targetUrl} accent={cfg.statusColor}/>

        {(() => {
          const note = trip?.riderNote || trip?.note || trip?.notes;
          if (!note) return null;
          return (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: 'rgba(192,132,252,.08)', border: '1px solid rgba(192,132,252,.26)', borderRadius: 12, padding: '9px 12px', marginBottom: 10 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 1 }} stroke={C.violet} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>
              </svg>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: COND, fontSize: 8, fontWeight: 800, letterSpacing: '.14em', color: 'rgba(192,132,252,.7)', textTransform: 'uppercase', marginBottom: 2 }}>Rider note</div>
                <div style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: C.white, lineHeight: 1.45 }}>{note}</div>
              </div>
            </div>
          );
        })()}

        <div style={{ fontFamily: COND, fontSize: 11, fontWeight: 600, letterSpacing: '.06em', color: C.ink, marginBottom: 10, lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 7 }}>
          <span style={{ color: cfg.statusColor, fontSize: 12, marginTop: 1 }}>›</span>
          {cfg.hint}
          {distStr && (
            <span style={{ marginLeft: 'auto', flexShrink: 0, fontFamily: MONO, fontSize: 11, fontWeight: 800, color: cfg.statusColor }}>
              {distStr}
            </span>
          )}
        </div>

        <SlideAction
          key={stage}
          label={pending ? 'WORKING…' : cfg.btnLabel}
          color={cfg.btnColor}
          pending={pending}
          failed={!!error}
          onConfirm={() => onAction(cfg.action, trip.id)}
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPLETED SHEET
// ═══════════════════════════════════════════════════════════════════════════════
function CompletedSheet({ trip }) {
  const payout = trip?.driverPayout;
  const miles  = trip?.tripDistanceMiles;
  const mins   = trip?.tripDurationMin;
  const avgMph = (typeof miles === 'number' && miles > 0 && typeof mins === 'number' && mins > 0)
    ? miles / (mins / 60) : null;
  const recap = (typeof miles === 'number' && miles > 0 && typeof mins === 'number' && mins > 0)
    ? `${miles.toFixed(1)} mi in ${mins} min${avgMph ? ` · avg ${Math.round(avgMph)} mph` : ''}`
    : null;

  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 32, animation: 'ats-slideup .5s cubic-bezier(.34,1.2,.64,1) both' }}>
      <div style={{
        background: C.panelDeep, borderTop: `1px solid ${C.greenBright}33`,
        borderRadius: '24px 24px 0 0', backdropFilter: 'blur(18px)',
        boxShadow: `0 -12px 48px rgba(0,0,0,.7), 0 0 50px ${C.greenBright}18`,
        padding: '14px 20px max(40px, calc(env(safe-area-inset-bottom) + 24px))',
        textAlign: 'center',
      }}>
        <div style={{ width: 36, height: 3.5, borderRadius: 2, background: 'rgba(255,255,255,.12)', margin: '0 auto 18px' }}/>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', margin: '0 auto 14px',
          background: 'rgba(34,197,94,.18)', border: `2px solid ${C.greenBright}66`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 32px ${C.greenBright}44`,
          animation: 'ats-popin .5s cubic-bezier(.34,1.8,.64,1) both',
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.greenBright} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div style={{ fontFamily: COND, fontSize: 22, fontWeight: 900, letterSpacing: '.16em', color: C.greenBright, textTransform: 'uppercase', marginBottom: 4 }}>
          Trip Complete
        </div>
        {typeof payout === 'number' && (
          <div style={{ fontFamily: MONO, fontSize: 30, fontWeight: 800, color: C.amberBright, textShadow: `0 0 24px ${C.amberBright}66`, marginBottom: 2 }}>
            +${payout.toFixed(2)}
          </div>
        )}
        <div style={{ fontFamily: COND, fontSize: 11, color: C.inkDim, letterSpacing: '.1em', marginBottom: 14 }}>PAYOUT CREDITED</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          {typeof miles === 'number' && miles > 0 && <StatChip label="DISTANCE" value={`${miles.toFixed(1)} mi`}/>}
          {typeof mins  === 'number' && mins > 0  && <StatChip label="DURATION" value={`${mins} min`}/>}
          {avgMph != null                           && <StatChip label="AVG SPEED" value={`${Math.round(avgMph)} mph`}/>}
        </div>
        {recap && (
          <div style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '.04em', color: C.inkDim, marginTop: 12 }}>
            {recap}
          </div>
        )}
      </div>
    </div>
  );
}

function StatChip({ label, value }) {
  return (
    <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 12, padding: '8px 16px', minWidth: 88 }}>
      <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 800, color: C.white }}>{value}</div>
      <div style={{ fontFamily: COND, fontSize: 8, fontWeight: 800, letterSpacing: '.14em', color: C.inkDim, marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAP MARKER FACTORIES
// ═══════════════════════════════════════════════════════════════════════════════

function makeDriverPuck() {
  const outer = document.createElement('div');
  outer.style.cssText = 'position:relative;width:50px;height:50px;display:flex;align-items:center;justify-content:center;pointer-events:none;';

  const glow = document.createElement('div');
  glow.style.cssText = 'position:absolute;inset:-8px;border-radius:50%;background:radial-gradient(circle,rgba(34,197,94,.4) 0%,transparent 70%);';

  const ring = document.createElement('div');
  ring.style.cssText = 'position:absolute;inset:1px;border-radius:50%;border:2px solid rgba(74,222,128,.5);animation:ats-blink 1.8s ease-in-out infinite;';

  const cone = document.createElement('div');
  cone.style.cssText = 'position:absolute;inset:0;border-radius:50%;background:conic-gradient(from -20deg,transparent 0deg,rgba(74,222,128,.28) 20deg,transparent 40deg);transform:rotate(0deg);transition:transform .12s linear;';

  const rot = document.createElement('div');
  rot.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;transform:rotate(0deg);transition:transform .12s linear;will-change:transform;';

  const body = document.createElement('div');
  body.style.cssText = 'width:40px;height:40px;border-radius:50%;background:linear-gradient(145deg,#4ADE80 0%,#16A34A 100%);border:3px solid #fff;box-shadow:0 4px 18px rgba(34,197,94,.75),0 2px 6px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;';
  body.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 5 21l7-4 7 4z"/></svg>`;

  rot.appendChild(body);
  outer.appendChild(glow);
  outer.appendChild(cone);
  outer.appendChild(ring);
  outer.appendChild(rot);

  return {
    el: outer,
    rotate(deg) {
      rot.style.transform = `rotate(${deg}deg)`;
      cone.style.transform = `rotate(${deg}deg)`;
    },
  };
}

function makePinEl(color, symbol) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;pointer-events:none;';
  const bubble = document.createElement('div');
  bubble.style.cssText = `padding:4px 8px;border-radius:8px;white-space:nowrap;background:rgba(3,6,4,.9);border:1.5px solid ${color}88;box-shadow:0 4px 14px rgba(0,0,0,.5),0 0 12px ${color}33;color:${color};font-family:'JetBrains Mono','SFMono-Regular',monospace;font-size:10px;font-weight:800;`;
  bubble.textContent = symbol;
  const stem = document.createElement('div');
  stem.style.cssText = `width:2px;height:10px;background:${color}88;margin-top:-1px;`;
  const dot = document.createElement('div');
  dot.style.cssText = `width:6px;height:6px;border-radius:50%;background:${color};box-shadow:0 0 8px ${color};`;
  wrap.appendChild(bubble);
  wrap.appendChild(stem);
  wrap.appendChild(dot);
  return wrap;
}

// ─── map source / layer ids ────────────────────────────────────────────────────
const SRC_REMAIN      = 'ats-route-remain';
const SRC_TRAVEL      = 'ats-route-travel';
const LYR_REMAIN_GLOW = 'ats-remain-glow';
const LYR_REMAIN_MAIN = 'ats-remain-main';
const LYR_REMAIN_DASH = 'ats-remain-dash';
const LYR_TRAVEL_MAIN = 'ats-travel-main';

const DASH_FRAMES = [
  [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5],
  [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0], [0, 0.5, 3, 3.5],
  [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5],
  [0, 3, 3, 1], [0, 3.5, 3, 0.5],
];

// ═══════════════════════════════════════════════════════════════════════════════
// CHAT FAB
// ═══════════════════════════════════════════════════════════════════════════════
function ChatFab({ unread, onClick }) {
  return (
    <div style={{ position: 'absolute', left: 14, bottom: 'calc(258px + env(safe-area-inset-bottom))', zIndex: 33 }}>
      <button onClick={onClick} aria-label="Open rider chat" style={{
        position: 'relative', width: 46, height: 46, borderRadius: 14, border: 'none', cursor: 'pointer',
        background: C.panelDeep, backdropFilter: 'blur(12px)',
        boxShadow: `0 6px 22px rgba(0,0,0,.6), inset 0 0 0 1px rgba(103,232,249,.3)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: C.cyan, overflow: 'visible',
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        {unread > 0 && (
          <div style={{
            position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9,
            background: C.red, color: '#fff', fontFamily: MONO, fontSize: 9, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
            boxShadow: `0 2px 8px ${C.red}88`, animation: 'ats-blink 1.4s ease-in-out infinite',
          }}>
            {unread > 9 ? '9+' : unread}
          </div>
        )}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DRIVER CHAT PANEL
// ═══════════════════════════════════════════════════════════════════════════════
const DRIVER_QUICK_REPLIES = ['On my way', "I've arrived", 'Be there in 2 min', 'Look for my car'];

function DriverChatPanel({ messages, input, setInput, onSend, onClose, sending }) {
  const listRef   = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  function formatTime(ts) {
    if (!ts?.seconds) return '';
    return new Date(ts.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 40, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(2px)' }}/>
      <div style={{
        position: 'relative', zIndex: 1, background: C.panelDeep,
        borderTop: `1px solid ${C.cyan}28`, borderRadius: '24px 24px 0 0',
        backdropFilter: 'blur(20px)', boxShadow: '0 -12px 48px rgba(0,0,0,.7)',
        display: 'flex', flexDirection: 'column', maxHeight: '75vh',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        animation: 'ats-slideup .35s cubic-bezier(.34,1.1,.64,1) both',
      }}>
        <div style={{ width: 36, height: 3.5, borderRadius: 2, background: 'rgba(255,255,255,.12)', margin: '12px auto 0' }}/>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 10px', borderBottom: `1px solid ${C.inkFaint}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.cyan} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span style={{ fontFamily: COND, fontSize: 13, fontWeight: 800, letterSpacing: '.08em', color: C.white }}>RIDER CHAT</span>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.07)', border: 'none', cursor: 'pointer', borderRadius: 8, padding: '5px 10px', fontFamily: COND, fontSize: 10, fontWeight: 800, letterSpacing: '.1em', color: C.ink, display: 'flex', alignItems: 'center', gap: 4 }}>
            ✕ CLOSE
          </button>
        </div>
        <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, overscrollBehavior: 'contain' }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: C.ink, fontFamily: COND, fontSize: 12, fontWeight: 600, letterSpacing: '.06em', marginTop: 20 }}>
              No messages yet.
            </div>
          )}
          {messages.map(msg => {
            const isDriver = msg.senderRole === 'driver';
            return (
              <div key={msg.id} style={{ display: 'flex', justifyContent: isDriver ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '78%', padding: '9px 13px',
                  borderRadius: isDriver ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: isDriver ? C.cyan : 'rgba(255,255,255,.08)',
                  border: isDriver ? 'none' : `1px solid ${C.inkFaint}`,
                }}>
                  {!isDriver && <div style={{ fontFamily: COND, fontSize: 9, fontWeight: 800, letterSpacing: '.1em', color: C.inkDim, textTransform: 'uppercase', marginBottom: 3 }}>RIDER</div>}
                  <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 500, color: isDriver ? '#000' : C.white, lineHeight: 1.4 }}>{msg.text}</div>
                  <div style={{ fontFamily: MONO, fontSize: 9, color: isDriver ? 'rgba(0,0,0,.5)' : C.inkDim, marginTop: 4, textAlign: isDriver ? 'right' : 'left' }}>{formatTime(msg.createdAt)}</div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} style={{ height: 1 }}/>
        </div>
        <div style={{ display: 'flex', gap: 6, padding: '8px 16px', flexWrap: 'wrap', borderTop: `1px solid ${C.inkFaint}` }}>
          {DRIVER_QUICK_REPLIES.map(qr => (
            <button key={qr} onClick={() => onSend(qr)} style={{
              background: 'none', border: `1px solid ${C.inkFaint}`, borderRadius: 99, padding: '4px 10px',
              fontFamily: COND, fontSize: 10, fontWeight: 700, letterSpacing: '.06em',
              color: C.ink, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all .15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.cyan; e.currentTarget.style.color = C.cyan; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.inkFaint; e.currentTarget.style.color = C.ink; }}
            >
              {qr}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '8px 16px', alignItems: 'flex-end' }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
            placeholder="Message rider…"
            rows={1}
            style={{
              flex: 1, resize: 'none', background: 'rgba(255,255,255,.07)',
              border: `1.5px solid ${C.inkFaint}`, borderRadius: 12, padding: '10px 13px',
              fontFamily: MONO, fontSize: 12, color: C.white, outline: 'none', lineHeight: 1.4,
              transition: 'border-color .2s', maxHeight: 80, overflowY: 'auto',
            }}
            onFocus={e => (e.target.style.borderColor = C.cyan)}
            onBlur={e  => (e.target.style.borderColor = C.inkFaint)}
          />
          <button onClick={() => onSend()} disabled={!input.trim() || sending} style={{
            width: 40, height: 40, borderRadius: 12, border: 'none',
            background: !input.trim() || sending ? 'rgba(255,255,255,.08)' : C.cyan,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: !input.trim() || sending ? 'not-allowed' : 'pointer',
            flexShrink: 0, transition: 'all .2s',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke={!input.trim() || sending ? C.inkDim : '#000'}
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ARRIVAL BANNER
// ═══════════════════════════════════════════════════════════════════════════════
function ArrivalBanner({ visible, targetWord, distMi, accent }) {
  if (!visible) return null;
  return (
    <div style={{
      position: 'absolute', top: 'calc(120px + env(safe-area-inset-top))', left: '50%', transform: 'translateX(-50%)',
      zIndex: 27, pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: 9,
      background: 'rgba(2,5,3,.92)', backdropFilter: 'blur(14px)',
      border: `1px solid ${accent}55`, borderRadius: 999, padding: '7px 15px 7px 12px',
      boxShadow: `0 8px 26px rgba(0,0,0,.55), 0 0 24px ${accent}26`,
      animation: 'ats-banner-pop .4s cubic-bezier(.34,1.4,.64,1) both', whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: accent, boxShadow: `0 0 10px ${accent}`, animation: 'ats-pulse-ring 1.1s ease-in-out infinite' }}/>
      <span style={{ fontFamily: COND, fontSize: 12, fontWeight: 900, letterSpacing: '.12em', color: accent, textTransform: 'uppercase' }}>
        Arriving — {targetWord} ahead
      </span>
      <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, color: C.white }}>{fmtMi(distMi)}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// REROUTE CHIP
// ═══════════════════════════════════════════════════════════════════════════════
function RerouteChip({ visible, onOpenNav }) {
  if (!visible) return null;
  return (
    <button onClick={onOpenNav} style={{
      position: 'absolute', bottom: 'calc(316px + env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)',
      zIndex: 31, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
      background: 'rgba(2,5,3,.92)', backdropFilter: 'blur(14px)',
      border: `1px solid ${C.amber}55`, borderRadius: 999, padding: '7px 14px',
      boxShadow: `0 8px 26px rgba(0,0,0,.55), 0 0 22px ${C.amber}22`,
      animation: 'ats-banner-pop .35s cubic-bezier(.34,1.3,.64,1) both',
      WebkitTapHighlightColor: 'transparent',
    }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.amber} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'ats-spin 2.4s linear infinite' }}>
        <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
        <path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
      </svg>
      <span style={{ fontFamily: COND, fontSize: 11, fontWeight: 900, letterSpacing: '.12em', color: C.amber, textTransform: 'uppercase' }}>
        Off route · tap to re-open maps
      </span>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRIP STATS STRIP
// ═══════════════════════════════════════════════════════════════════════════════
function TripStatsStrip({ visible, etaMin, distMi, mph, gpsLive }) {
  if (!visible) return null;
  const mphStr = (gpsLive && mph != null && isFinite(mph)) ? `${Math.round(mph)}` : '—';
  return (
    <div style={{
      position: 'absolute', bottom: 'calc(258px + env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)',
      zIndex: 31, pointerEvents: 'none', display: 'flex', alignItems: 'stretch',
      background: 'rgba(2,5,3,.9)', backdropFilter: 'blur(14px)',
      border: `1px solid ${C.amberBright}2e`, borderRadius: 14, padding: '7px 4px',
      boxShadow: `0 8px 26px rgba(0,0,0,.55), 0 0 22px ${C.amberBright}14`,
      animation: 'ats-slideup .4s cubic-bezier(.34,1.2,.64,1) both',
    }}>
      <StripCell value={fmtEtaMin(etaMin)} unit="MIN" label="TO DROP-OFF" accent={C.amberBright}/>
      <div style={{ width: 1, background: 'rgba(255,255,255,.08)', margin: '2px 0' }}/>
      <StripCell value={fmtMi(distMi)} unit="" label="REMAINING" accent={C.white}/>
      <div style={{ width: 1, background: 'rgba(255,255,255,.08)', margin: '2px 0' }}/>
      <StripCell value={mphStr} unit="MPH" label="CURRENT" accent={C.greenBright}/>
    </div>
  );
}

function StripCell({ value, unit, label, accent }) {
  return (
    <div style={{ textAlign: 'center', padding: '0 13px', minWidth: 58 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 2 }}>
        <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 800, color: accent, lineHeight: 1 }}>{value}</span>
        {unit && <span style={{ fontFamily: COND, fontSize: 8.5, fontWeight: 800, color: accent, letterSpacing: '.06em' }}>{unit}</span>}
      </div>
      <div style={{ fontFamily: COND, fontSize: 7.5, fontWeight: 800, letterSpacing: '.14em', color: C.inkDim, marginTop: 3 }}>{label}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function ActiveTripScreen({
  driver,
  activeTrip,
  onTripComplete,
  useDeviceLocation = true,
}) {
  // ── callable hooks ───────────────────────────────────────────────────────
  const { call: callUpdateTrip } = useUpdateTrip();
  const { call: callGetRoute   } = useGetRoute();

  // ── refs: map + markers ──────────────────────────────────────────────────
  const containerRef   = useRef(null);
  const mapRef         = useRef(null);
  const puckRef        = useRef(null);
  const driverMkrRef   = useRef(null);
  const pickupMkrRef   = useRef(null);
  const dropoffMkrRef  = useRef(null);

  // ── refs: animation ──────────────────────────────────────────────────────
  const renderedRef            = useRef(null);
  const targetRef              = useRef(null);
  const bearingRef             = useRef(0);
  const targetBearingRef       = useRef(0);
  const rafRef                 = useRef(0);
  const frameNoRef             = useRef(0);
  const dashStepRef            = useRef(0);
  const lastFollowRef          = useRef(0);
  const lastFixForBearingRef   = useRef(null);

  // ── refs: live speed ─────────────────────────────────────────────────────
  const targetSpeedRef    = useRef(0);
  const renderedSpeedRef  = useRef(0);
  const lastSpeedFixRef   = useRef(null);

  // ── refs: route ──────────────────────────────────────────────────────────
  const routeCoordsRef       = useRef([]);
  const routeLenMiRef        = useRef(0);
  const routeDurSecRef       = useRef(0);
  const projIdxRef           = useRef(0);
  const routeReadyRef        = useRef(false);
  const fetchedPhaseRef      = useRef(null);
  const lastInstalledPolyRef = useRef(null);
  const offRouteFramesRef    = useRef(0);

  // ── refs: misc ───────────────────────────────────────────────────────────
  const watchIdRef       = useRef(null);
  const completeTimerRef = useRef(null);
  const mountedRef       = useRef(true);

  // ── state ────────────────────────────────────────────────────────────────
  const [mapReady,      setMapReady]      = useState(false);
  const [pending,       setPending]       = useState(false);
  const [error,         setError]         = useState(null);
  const [localStatus,   setLocalStatus]   = useState(null);
  const [rider,         setRider]         = useState(null);
  const [liveTrip,      setLiveTrip]      = useState(null);
  const [selfPos,       setSelfPos]       = useState(null);
  const [gpsLive,       setGpsLive]       = useState(false);
  const [followMode,    setFollowMode]    = useState(true);
  const [showRecenter,  setShowRecenter]  = useState(false);
  const [liveMetrics,   setLiveMetrics]   = useState({ etaMin: null, distMi: null, progress: 0 });
  const [liveSpeedMph,  setLiveSpeedMph]  = useState(null);
  const [offRoute,      setOffRoute]      = useState(false);
  const [showChat,      setShowChat]      = useState(false);
  const [chatMessages,  setChatMessages]  = useState([]);
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [chatInput,     setChatInput]     = useState('');
  const [chatSending,   setChatSending]   = useState(false);

  // ── merge live doc over prop ─────────────────────────────────────────────
  const trip   = useMemo(() => ({ ...(activeTrip || {}), ...(liveTrip || {}) }), [activeTrip, liveTrip]);
  const status = localStatus || trip?.status || 'driver_assigned';
  const stage  = STAGES[status] || STAGES.driver_assigned;
  const phase  = stage.phase;

  const fresh  = selfPos && (Date.now() - selfPos.ts) < STALE_FIX_MS;
  const dLat   = fresh ? selfPos.lat : driver?.lat;
  const dLng   = fresh ? selfPos.lng : driver?.lng;

  const targetLat = phase === 'toDropoff' ? trip?.dropoffLat : trip?.pickupLat;
  const targetLng = phase === 'toDropoff' ? trip?.dropoffLng : trip?.pickupLng;

  const crowDistMi = (dLat && dLng && targetLat && targetLng)
    ? haversineMi(dLat, dLng, targetLat, targetLng) : null;

  // ── live ride listener ───────────────────────────────────────────────────
  useEffect(() => {
    const id = activeTrip?.id;
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'Rides', id), snap => {
      if (snap.exists() && mountedRef.current) setLiveTrip({ id: snap.id, ...snap.data() });
    }, () => {});
    return () => unsub();
  }, [activeTrip?.id]);

  // ── rider lookup ─────────────────────────────────────────────────────────
  useEffect(() => {
    const uid = trip?.uid;
    if (!uid) return;
    getDoc(doc(db, 'Accounts', uid))
      .then(snap => { if (snap.exists() && mountedRef.current) setRider(snap.data()); })
      .catch(() => {});
  }, [trip?.uid]);

  // ── messages subscription ────────────────────────────────────────────────
  useEffect(() => {
    const id = trip?.id;
    if (!id) return;
    const unsub = onSnapshot(collection(db, 'Rides', id, 'Messages'), snap => {
      if (!mountedRef.current) return;
      const msgs = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0));
      setChatMessages(msgs);
      setUnreadCount(msgs.filter(m => m.senderRole === 'rider' && !m.readByDriver).length);
    }, () => {});
    return () => unsub();
  }, [trip?.id]);

  // mark as read when chat opens
  useEffect(() => {
    if (!showChat || !trip?.id) return;
    chatMessages
      .filter(m => m.senderRole === 'rider' && !m.readByDriver)
      .forEach(m =>
        updateDoc(doc(db, 'Rides', trip.id, 'Messages', m.id), { readByDriver: true }).catch(() => {})
      );
  // eslint-disable-next-line
  }, [showChat, chatMessages]);

  // ── GPS watch ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!useDeviceLocation || typeof navigator === 'undefined' || !navigator.geolocation) return;
    let firstFix = false;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (!mountedRef.current) return;
        const { latitude, longitude, heading, speed } = pos.coords;
        const tnow = Date.now();

        let mps = (typeof speed === 'number' && speed >= 0 && isFinite(speed)) ? speed : null;
        const prev = lastSpeedFixRef.current;
        if (mps == null && prev) {
          const meters = haversineMi(prev.lat, prev.lng, latitude, longitude) * 1609.34;
          const dt = (tnow - prev.ts) / 1000;
          if (dt >= SPEED_DERIVE_MIN_DT_S) mps = meters / dt;
        }
        lastSpeedFixRef.current = { lat: latitude, lng: longitude, ts: tnow };

        setSelfPos({
          lat: latitude, lng: longitude,
          heading: (typeof heading === 'number' && !isNaN(heading)) ? heading : null,
          speed: mps, ts: tnow,
        });
        if (!firstFix) { firstFix = true; setGpsLive(true); }
      },
      () => { setGpsLive(false); },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 12000 },
    );
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    };
  }, [useDeviceLocation]);

  // ── lifecycle flag ───────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── init mapbox ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return;

    if (!document.getElementById('mb-script')) {
      const link = document.createElement('link');
      link.rel  = 'stylesheet';
      link.href = `https://api.mapbox.com/mapbox-gl-js/${MB_VERSION}/mapbox-gl.css`;
      document.head.appendChild(link);

      const script = document.createElement('script');
      script.id     = 'mb-script';
      script.src    = `https://api.mapbox.com/mapbox-gl-js/${MB_VERSION}/mapbox-gl.js`;
      script.async  = true;
      script.onload = () => initMap();
      document.head.appendChild(script);
    } else if (window.mapboxgl) {
      initMap();
    } else {
      document.getElementById('mb-script').addEventListener('load', initMap, { once: true });
    }

    function initMap() {
      if (!containerRef.current || mapRef.current) return;
      const mbgl = window.mapboxgl;
      mbgl.accessToken = MAPBOX_TOKEN;

      const cLat = (fresh ? selfPos.lat : driver?.lat) ?? trip?.pickupLat ?? 28.5383;
      const cLng = (fresh ? selfPos.lng : driver?.lng) ?? trip?.pickupLng ?? -81.3792;

      const map = new mbgl.Map({
        container: containerRef.current, style: MAP_STYLE,
        center: [cLng, cLat], zoom: 15.5, pitch: 58, bearing: 0,
        interactive: true, attributionControl: false, dragRotate: false, pitchWithRotate: false,
      });

      const onUserMove = (e) => { if (e && e.originalEvent) { setFollowMode(false); setShowRecenter(true); } };
      map.on('dragstart', onUserMove);
      map.on('zoomstart', onUserMove);

      map.on('load', () => {
        mapRef.current = map;
        const seed = (fresh && selfPos) ? [selfPos.lng, selfPos.lat]
                   : (typeof driver?.lng === 'number') ? [driver.lng, driver.lat]
                   : [cLng, cLat];
        renderedRef.current = seed.slice();
        targetRef.current   = seed.slice();

        puckRef.current = makeDriverPuck();
        driverMkrRef.current = new mbgl.Marker({ element: puckRef.current.el, anchor: 'center' })
          .setLngLat(seed).addTo(map);

        setMapReady(true);
      });
    }

    return () => {
      if (mapRef.current) { try { mapRef.current.remove(); } catch (e) {} mapRef.current = null; }
      driverMkrRef.current = null; pickupMkrRef.current = null;
      dropoffMkrRef.current = null; puckRef.current = null;
      routeReadyRef.current = false; setMapReady(false);
    };
  // eslint-disable-next-line
  }, []);

  // ── feed fix into animation target ───────────────────────────────────────
  useEffect(() => {
    if (typeof dLat !== 'number' || typeof dLng !== 'number') return;
    targetRef.current = [dLng, dLat];

    if (fresh && selfPos?.heading != null) {
      targetBearingRef.current = selfPos.heading;
    } else {
      const prev = lastFixForBearingRef.current;
      if (prev) {
        const moved = haversineMi(prev[1], prev[0], dLat, dLng) * 1609.34;
        if (moved >= MIN_MOVE_FOR_BEARING_M) {
          targetBearingRef.current = bearingDeg(prev[1], prev[0], dLat, dLng);
        }
      }
    }
    lastFixForBearingRef.current = [dLng, dLat];

    if (fresh && selfPos?.speed != null && isFinite(selfPos.speed)) {
      const mph = selfPos.speed * MPS_TO_MPH;
      targetSpeedRef.current = Math.max(0, Math.min(120, mph));
    } else if (!fresh) {
      targetSpeedRef.current = 0;
    }
  }, [dLat, dLng, fresh, selfPos]);

  // ── clear stale metrics on leg change ────────────────────────────────────
  useEffect(() => {
    setLiveMetrics({ etaMin: null, distMi: null, progress: 0 });
    projIdxRef.current = 0;
    offRouteFramesRef.current = 0;
    setOffRoute(false);
  }, [phase]);

  // ── route fetch + draw ───────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    if (typeof dLat !== 'number' || typeof dLng !== 'number') return;
    if (!targetLat || !targetLng) return;

    const storedPoly   = phase === 'toPickup' ? (trip?.driverEtaPolyline ?? null) : (trip?.polyline ?? null);
    const storedDurSec = phase === 'toPickup' ? (trip?.driverEtaMin || 0) * 60 : (trip?.tripDurationMin || 0) * 60;

    if (storedPoly && storedPoly !== lastInstalledPolyRef.current) {
      const decoded = decodePolyline(storedPoly);
      if (decoded.length >= 2) {
        lastInstalledPolyRef.current = storedPoly;
        fetchedPhaseRef.current = phase;
        installRoute(decoded.map(p => [p[1], p[0]]), storedDurSec);
        return;
      }
    }

    if (storedPoly || (fetchedPhaseRef.current === phase && routeReadyRef.current)) return;

    const phaseAtCall = phase;
    fetchedPhaseRef.current = phase;

    callGetRoute({
      driverLat: dLat, driverLng: dLng,
      pickupLat: targetLat, pickupLng: targetLng,
    }).then((data) => {
      if (!mapRef.current || phaseAtCall !== fetchedPhaseRef.current) return;
      const decoded = decodePolyline(data?.polyline);
      const coords = decoded.length >= 2
        ? decoded.map(p => [p[1], p[0]])
        : [[dLng, dLat], [targetLng, targetLat]];
      installRoute(coords, data?.duration || 0);
    }).catch(err => {
      console.warn('[ActiveTripScreen] route fetch failed:', err);
      if (!mapRef.current || phaseAtCall !== fetchedPhaseRef.current) return;
      installRoute([[dLng, dLat], [targetLng, targetLat]], 0);
    });
  // eslint-disable-next-line
  }, [mapReady, phase, dLat, dLng, targetLat, targetLng, trip?.driverEtaPolyline, trip?.polyline]);

  function installRoute(coords, durSec) {
    routeCoordsRef.current = coords;
    routeLenMiRef.current  = pathLengthMi(coords);
    routeDurSecRef.current = durSec || 0;
    projIdxRef.current     = 0;
    drawRoute(coords);
    placeMarkers();
    if (followMode) snapCamera(true);
    else fitWholeRoute(coords);
  }

  function drawRoute(coords) {
    const map = mapRef.current;
    if (!map) return;

    const remainGeo = { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } };
    const travelGeo = { type: 'Feature', geometry: { type: 'LineString', coordinates: [coords[0], coords[0]] } };

    if (routeReadyRef.current) {
      map.getSource(SRC_REMAIN)?.setData(remainGeo);
      map.getSource(SRC_TRAVEL)?.setData(travelGeo);
      return;
    }

    map.addSource(SRC_TRAVEL, { type: 'geojson', data: travelGeo });
    map.addSource(SRC_REMAIN, { type: 'geojson', data: remainGeo });
    map.addLayer({ id: LYR_TRAVEL_MAIN, type: 'line', source: SRC_TRAVEL, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': 'rgba(255,255,255,.85)', 'line-width': 5, 'line-opacity': .14 } });
    map.addLayer({ id: LYR_REMAIN_GLOW, type: 'line', source: SRC_REMAIN, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': C.greenBright, 'line-width': 13, 'line-opacity': .12, 'line-blur': 8 } });
    map.addLayer({ id: LYR_REMAIN_MAIN, type: 'line', source: SRC_REMAIN, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': C.green, 'line-width': 5, 'line-opacity': 1 } });
    map.addLayer({ id: LYR_REMAIN_DASH, type: 'line', source: SRC_REMAIN, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#EAFFF2', 'line-width': 2, 'line-opacity': .55, 'line-dasharray': [0, 4, 3] } });

    routeReadyRef.current = true;
  }

  function placeMarkers() {
    const map = mapRef.current;
    if (!map || !window.mapboxgl) return;

    [pickupMkrRef, dropoffMkrRef].forEach(r => {
      if (r.current) { try { r.current.remove(); } catch (e) {} r.current = null; }
    });

    if (trip?.pickupLat && trip?.pickupLng) {
      pickupMkrRef.current = new window.mapboxgl.Marker({ element: makePinEl(C.greenBright, '● PICKUP'), anchor: 'bottom' })
        .setLngLat([trip.pickupLng, trip.pickupLat]).addTo(map);
    }
    if (trip?.dropoffLat && trip?.dropoffLng) {
      dropoffMkrRef.current = new window.mapboxgl.Marker({ element: makePinEl(C.amberBright, '◆ DROP-OFF'), anchor: 'bottom' })
        .setLngLat([trip.dropoffLng, trip.dropoffLat]).addTo(map);
    }
  }

  function fitWholeRoute(coords) {
    const map = mapRef.current;
    if (!map || !coords?.length) return;
    const pts = [...coords];
    if (renderedRef.current) pts.push(renderedRef.current);
    const lngs = pts.map(p => p[0]), lats = pts.map(p => p[1]);
    map.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: { top: 150, bottom: 280, left: 56, right: 56 }, maxZoom: 16, pitch: 0, duration: 900 },
    );
  }

  function snapCamera(immediate = false) {
    const map = mapRef.current;
    if (!map || !renderedRef.current) return;
    const now = performance.now();
    if (!immediate && now - lastFollowRef.current < FOLLOW_THROTTLE_MS) return;
    lastFollowRef.current = now;
    map.easeTo({
      center: renderedRef.current, bearing: bearingRef.current,
      pitch: 58, zoom: Math.max(map.getZoom(), 15.5),
      duration: immediate ? 600 : FOLLOW_THROTTLE_MS + 60,
      easing: t => t,
    });
  }

  // ── master rAF loop ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    let alive = true;

    const tick = () => {
      if (!alive) return;
      rafRef.current = requestAnimationFrame(tick);
      const map = mapRef.current;
      if (!map || !renderedRef.current || !targetRef.current) return;
      frameNoRef.current++;

      const r = renderedRef.current, t = targetRef.current;
      r[0] = lerp(r[0], t[0], SMOOTH_POS);
      r[1] = lerp(r[1], t[1], SMOOTH_POS);

      bearingRef.current = lerpAngle(bearingRef.current, targetBearingRef.current, SMOOTH_BEARING);

      renderedSpeedRef.current = lerp(renderedSpeedRef.current, targetSpeedRef.current, SMOOTH_SPEED);
      if (frameNoRef.current % 10 === 0) setLiveSpeedMph(renderedSpeedRef.current);

      if (driverMkrRef.current) driverMkrRef.current.setLngLat(r);
      if (puckRef.current) {
        const screenHeading = followMode ? 0 : bearingRef.current - map.getBearing();
        puckRef.current.rotate(followMode ? 0 : screenHeading);
      }

      if (routeReadyRef.current && routeCoordsRef.current.length >= 2 && frameNoRef.current % TRIM_EVERY_FRAMES === 0) {
        const coords = routeCoordsRef.current;
        const proj = projectOntoRoute(coords, r, projIdxRef.current);
        if (proj.idx >= projIdxRef.current) projIdxRef.current = proj.idx;

        const offMi = Math.sqrt(proj.dist2) * 69;
        if (offMi > 0.04) {
          offRouteFramesRef.current++;
          if (offRouteFramesRef.current === 20) setOffRoute(true);
        } else {
          if (offRouteFramesRef.current >= 20) setOffRoute(false);
          offRouteFramesRef.current = 0;
        }

        const remain = remainingFrom(coords, { ...proj, idx: projIdxRef.current });
        const travel = traveledTo(coords, { ...proj, idx: projIdxRef.current });

        map.getSource(SRC_REMAIN)?.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: remain } });
        map.getSource(SRC_TRAVEL)?.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: travel } });

        const remainMi = pathLengthMi(remain);
        const total    = routeLenMiRef.current || remainMi || 1;
        const progress = Math.max(0, Math.min(1, 1 - remainMi / total));

        const liveMph = renderedSpeedRef.current;
        let etaMin;
        if (liveMph > SPEED_FLOOR_FOR_ETA) {
          etaMin = (remainMi / liveMph) * 60;
        } else if (routeDurSecRef.current > 0) {
          etaMin = (routeDurSecRef.current / 60) * (remainMi / total);
        } else {
          etaMin = (remainMi / FALLBACK_SPEED_MPH) * 60;
        }

        if (frameNoRef.current % 18 === 0) setLiveMetrics({ etaMin, distMi: remainMi, progress });
      }

      if (routeReadyRef.current && frameNoRef.current % 3 === 0) {
        const step = (dashStepRef.current + 1) % DASH_FRAMES.length;
        dashStepRef.current = step;
        try { map.setPaintProperty(LYR_REMAIN_DASH, 'line-dasharray', DASH_FRAMES[step]); } catch (e) {}
      }

      if (followMode) snapCamera(false);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(rafRef.current); };
  // eslint-disable-next-line
  }, [mapReady, followMode]);

  // ── recenter ─────────────────────────────────────────────────────────────
  const handleRecenter = useCallback(() => {
    setFollowMode(true);
    setShowRecenter(false);
    snapCamera(true);
  // eslint-disable-next-line
  }, []);

  // ── chat send ────────────────────────────────────────────────────────────
  const handleSendChat = useCallback(async (text) => {
    const trimmed = (text ?? chatInput).trim();
    const id = trip?.id;
    if (!trimmed || !id) return;
    setChatSending(true);
    try {
      await addDoc(collection(db, 'Rides', id, 'Messages'), {
        text: trimmed, senderUid: driver?.uid, senderRole: 'driver',
        createdAt: serverTimestamp(), readByDriver: true, readByRider: false,
      });
      setChatInput('');
    } catch (err) {
      console.error('[ActiveTripScreen] send message:', err);
    } finally {
      if (mountedRef.current) setChatSending(false);
    }
  }, [trip?.id, chatInput, driver?.uid]);

  // ── action handler ────────────────────────────────────────────────────────
  const handleAction = useCallback(async (action, rideId) => {
    if (!action || !rideId) return;

    if (action === 'arrive') {
      const pLat = trip?.pickupLat;
      const pLng = trip?.pickupLng;
      if (
        typeof dLat === 'number' && typeof dLng === 'number' &&
        typeof pLat === 'number' && typeof pLng === 'number'
      ) {
        const dist = haversineMi(dLat, dLng, pLat, pLng);
        if (dist > ARRIVE_MAX_MILES) {
          setError(`You're ${fmtMi(dist)} away — get within 1 mile of the pickup to mark arrived.`);
          return;
        }
      }
    }

    setPending(true);
    setError(null);
    try {
      const data = await callUpdateTrip({ rideId, driverUid: driver?.uid, action });
      const newStatus = data?.status;
      if (!mountedRef.current) return;
      setLocalStatus(newStatus);
      if (newStatus === 'completed') {
        completeTimerRef.current = setTimeout(() => { onTripComplete?.(); }, 2800);
      }
    } catch (err) {
      console.error('[ActiveTripScreen] updateTripStatus:', err);
      if (mountedRef.current) setError(err?.message || 'Something went wrong. Try again.');
    } finally {
      if (mountedRef.current) setPending(false);
    }
  }, [onTripComplete, trip?.pickupLat, trip?.pickupLng, dLat, dLng, driver?.uid, callUpdateTrip]);

  // ── cleanup ──────────────────────────────────────────────────────────────
  useEffect(() => () => {
    if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
    [pickupMkrRef, dropoffMkrRef, driverMkrRef].forEach(r => {
      if (r.current) { try { r.current.remove(); } catch (e) {} }
    });
    cancelAnimationFrame(rafRef.current);
  }, []);

  // ── derived metrics ──────────────────────────────────────────────────────
  const displayDist    = liveMetrics.distMi != null ? liveMetrics.distMi : crowDistMi;
  const displayEta     = liveMetrics.etaMin != null
    ? liveMetrics.etaMin
    : (crowDistMi != null
        ? (crowDistMi / (renderedSpeedRef.current > SPEED_FLOOR_FOR_ETA ? renderedSpeedRef.current : FALLBACK_SPEED_MPH)) * 60
        : null);
  const displayProgress = liveMetrics.progress || 0;
  const arrivalClock   = displayEta != null ? fmtArrivalClock(displayEta) : '—';

  const targetWord   = phase === 'toDropoff' ? 'DROP-OFF' : 'PICKUP';
  const activeNavUrl = phase === 'toDropoff'
    ? navUrl(trip?.dropoffLat, trip?.dropoffLng, trip?.dropoff || trip?.dropoffLabel || trip?.dropoffAddress)
    : navUrl(trip?.pickupLat,  trip?.pickupLng,  trip?.pickup  || trip?.pickupLabel  || trip?.pickupAddress);

  const nearTarget     = displayDist != null && displayDist < 0.06 && status !== 'arrived' && status !== 'completed';
  const showStatsStrip = status === 'in_progress' && !showChat;

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes ats-spin           { to { transform:rotate(360deg); } }
        @keyframes ats-blink          { 0%,100%{opacity:1} 50%{opacity:.25} }
        @keyframes ats-slidedown      { from{opacity:0;transform:translate(-50%,-12px)} to{opacity:1;transform:translate(-50%,0)} }
        @keyframes ats-slidein-right  { from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:translateX(0)} }
        @keyframes ats-slidein-left   { from{opacity:0;transform:translate(-16px,-50%)} to{opacity:1;transform:translate(0,-50%)} }
        @keyframes ats-slideup        { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ats-popin          { from{opacity:0;transform:scale(.55)} to{opacity:1;transform:scale(1)} }
        @keyframes ats-chev           { 0%,100%{opacity:.3;transform:translateX(0)} 50%{opacity:1;transform:translateX(2px)} }
        @keyframes ats-banner-pop     { from{opacity:0;transform:translate(-50%,-8px) scale(.92)} to{opacity:1;transform:translate(-50%,0) scale(1)} }
        @keyframes ats-pulse-ring     { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.5);opacity:.45} }
        .mapboxgl-ctrl-logo { display:none !important; }
      `}</style>

      <div style={{ position: 'fixed', inset: 0, background: C.bg, overflow: 'hidden' }}>
        <div ref={containerRef} style={{ position: 'absolute', inset: 0 }}/>

        {!mapReady && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, background: C.bg }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid rgba(34,197,94,.15)', borderTop: `2px solid ${C.green}`, animation: 'ats-spin .85s linear infinite' }}/>
            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '.1em', color: C.inkDim }}>ACQUIRING MAP…</span>
          </div>
        )}

        <div style={{ position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none', background: 'radial-gradient(ellipse at 50% 44%, transparent 38%, rgba(3,6,4,.28) 78%, rgba(3,6,4,.62) 100%)' }}/>

        <ErrorToast message={error} onDismiss={() => setError(null)}/>

        <TopBar
          statusLabel={stage.statusLabel} statusColor={stage.statusColor}
          rideId={trip?.id} paymentMethod={trip?.paymentMethod}
          progress={displayProgress} gpsLive={gpsLive} mph={liveSpeedMph}
        />

        {mapReady && status !== 'completed' && (
          <EtaCard
            etaMin={status === 'arrived' ? 0 : displayEta}
            distMi={status === 'arrived' ? 0 : displayDist}
            status={status}
            arrivalClock={status === 'arrived' ? 'NOW' : arrivalClock}
          />
        )}

        {mapReady && status !== 'completed' && <Speedometer mph={liveSpeedMph} gpsLive={gpsLive}/>}
        {mapReady && status !== 'completed' && <RiderCard rider={rider}/>}

        {mapReady && (
          <ArrivalBanner visible={nearTarget} targetWord={targetWord} distMi={displayDist} accent={stage.statusColor}/>
        )}

        {mapReady && (
          <TripStatsStrip visible={showStatsStrip} etaMin={displayEta} distMi={displayDist} mph={liveSpeedMph} gpsLive={gpsLive}/>
        )}

        {mapReady && status !== 'completed' && (
          <RerouteChip visible={offRoute} onOpenNav={() => openNav(activeNavUrl)}/>
        )}

        {mapReady && status !== 'completed' && <RecenterFab visible={showRecenter} onClick={handleRecenter}/>}
        {mapReady && status !== 'completed' && <ChatFab unread={unreadCount} onClick={() => setShowChat(true)}/>}

        {showChat && (
          <DriverChatPanel
            messages={chatMessages} input={chatInput} setInput={setChatInput}
            onSend={handleSendChat} onClose={() => setShowChat(false)} sending={chatSending}
          />
        )}

        <ActionSheet
          trip={trip} stage={status} distToTarget={displayDist}
          onAction={handleAction} pending={pending} error={error}
        />
      </div>
    </>
  );
}