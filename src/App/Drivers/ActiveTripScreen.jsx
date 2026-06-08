/**
 * ActiveTripScreen.jsx
 * ════════════════════════════════════════════════════════════════════════════
 * Full-screen, navigation-grade trip view rendered whenever the driver has an
 * assigned ride. Replaces the radar HomeTab UI for the duration of the trip.
 *
 * What changed vs. the previous build (the "Uber feel"):
 * ──────────────────────────────────────────────────────
 *   • Realtime self-positioning. The driver dot is driven by the device GPS
 *     (`navigator.geolocation.watchPosition`) instead of waiting on a server
 *     round-trip, so the puck moves the instant the phone moves.
 *   • Buttery puck motion. A single master rAF loop exponentially smooths the
 *     rendered position toward the latest fix — no teleporting between updates,
 *     no fixed-duration tweens that stutter when fixes arrive quickly.
 *   • Heading-aware car. The marker rotates to face travel direction using GPS
 *     heading when present, otherwise a movement-derived bearing, interpolated
 *     along the shortest arc so it never spins the long way around.
 *   • Live route trimming. The traveled portion of the route is consumed behind
 *     the car in realtime (projected onto the line, monotonic forward search),
 *     leaving a bright "road ahead" — exactly like turn-by-turn nav.
 *   • Flowing route. The remaining route carries an animated marching-dash
 *     overlay so the path always reads as "live."
 *   • Chase camera. Optional follow-cam keeps the puck centered and rotates the
 *     map to travel heading; a recenter FAB re-engages it after the user pans.
 *   • Live ETA + distance. Recomputed every tick from remaining route length
 *     and the route's own duration estimate, with a real arrival clock time.
 *   • Slide-to-confirm. Stage actions (arrive / start / complete) use a
 *     slide-to-act control to prevent fat-finger mistakes at speed.
 *   • Self-healing realtime. An internal Firestore onSnapshot on the ride doc
 *     merges live backend changes (status, payout, location) over the prop, so
 *     the screen stays correct even if the parent listener lags.
 *
 * Props
 * ─────
 *   driver            { uid, lat, lng, firstName }
 *   activeTrip        Firestore ride doc (driver_assigned | arrived | in_progress | completed)
 *   onTripComplete    () => void   — called after status reaches "completed"
 *   useDeviceLocation boolean      — default true; set false to render from prop coords only
 */

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { getFunctions, httpsCallable }       from 'firebase/functions';
import { getFirestore, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { firebase_app }                       from '@/firebase/config';

const db = getFirestore(firebase_app);

const _functions     = getFunctions(firebase_app, 'us-east1');
const callUpdateTrip = httpsCallable(_functions, 'updateTripStatus');
const callGetRoute   = httpsCallable(_functions, 'getDriverToPickup'); // reused as a generic A→B route

// ─── tokens ──────────────────────────────────────────────────────────────────
const MAPBOX_TOKEN = 'pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA';
const MAP_STYLE    = 'mapbox://styles/mapbox/dark-v11';
const MB_VERSION   = 'v3.3.0';

// ─── palette (matches HomeTab) ────────────────────────────────────────────────
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
const SMOOTH_POS        = 0.16;   // exponential follow factor for the puck (0..1 per frame)
const SMOOTH_BEARING    = 0.18;   // exponential follow factor for heading
const TRIM_EVERY_FRAMES = 2;      // recompute route trim every N frames
const FOLLOW_THROTTLE_MS = 220;   // min interval between chase-cam easeTo calls
const FALLBACK_SPEED_MPH = 24;    // city-speed assumption when route duration is unknown
const MIN_MOVE_FOR_BEARING_M = 4; // ignore GPS jitter below this when deriving heading
const STALE_FIX_MS      = 30000;  // a fix older than this is treated as unknown

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

/** great-circle distance in miles */
function haversineMi(lat1, lng1, lat2, lng2) {
  const dLat = (lat2 - lat1) * DEG;
  const dLng = (lng2 - lng1) * DEG;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(dLng / 2) ** 2;
  return EARTH_MI * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** initial bearing (deg, 0=N, clockwise) from A→B */
function bearingDeg(lat1, lng1, lat2, lng2) {
  const φ1 = lat1 * DEG, φ2 = lat2 * DEG;
  const Δλ = (lng2 - lng1) * DEG;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

/** interpolate an angle along the shortest arc */
function lerpAngle(a, b, t) {
  let d = ((b - a + 540) % 360) - 180;
  return (a + d * t + 360) % 360;
}

/** linear interpolation */
const lerp = (a, b, t) => a + (b - a) * t;

/** Google encoded polyline → [[lat,lng], ...] */
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

/**
 * Project point p onto segment a→b in a locally-flat frame (lng scaled by
 * cos(lat) so distances stay roughly isotropic). Returns the clamped param t,
 * the squared planar distance, and the snapped point. Coordinates are [lng,lat].
 */
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

/**
 * Snap point p onto the route (array of [lng,lat]). Searches forward from a
 * remembered index (with a tiny look-back window) so progress stays monotonic
 * and the car never appears to jump backward on overlapping geometry.
 */
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

/** remaining route from a projection: [snapPoint, ...coords after idx] */
function remainingFrom(coords, proj) {
  const out = [proj.point];
  for (let i = proj.idx + 1; i < coords.length; i++) out.push(coords[i]);
  if (out.length === 1) out.push(coords[coords.length - 1]);
  return out;
}

/** traveled route up to a projection: [...coords up to idx, snapPoint] */
function traveledTo(coords, proj) {
  const out = [];
  for (let i = 0; i <= proj.idx; i++) out.push(coords[i]);
  out.push(proj.point);
  return out;
}

/** total length of a [lng,lat] path in miles */
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

/** add `min` minutes to now → "9:41 PM" */
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

// ═══════════════════════════════════════════════════════════════════════════════
// SMALL PRESENTATIONAL PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════════════

/** pulsing dot */
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

/** route rail: green circle → dashed line → diamond */
function RouteRail({ status }) {
  const bottomColor = status === 'in_progress' ? C.amberBright : C.white;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', flexShrink: 0, paddingTop: 3, gap: 0,
    }}>
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

/** single address row with optional "open in maps" deep link */
function AddrRow({ label, text, dimmed, mapUrl }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: COND, fontSize: 8, fontWeight: 800, letterSpacing: '.14em',
          color: C.inkDim, textTransform: 'uppercase', marginBottom: 2,
        }}>
          {label}
        </div>
        <div style={{
          fontFamily: MONO, fontSize: 12, fontWeight: dimmed ? 600 : 700,
          color: dimmed ? 'rgba(255,255,255,.45)' : C.white,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {text || '—'}
        </div>
      </div>
      {mapUrl && (
        <a
          href={mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            flexShrink: 0, width: 30, height: 30, borderRadius: 9,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(103,232,249,.10)',
            border: '1px solid rgba(103,232,249,.28)',
            color: C.cyan, textDecoration: 'none',
          }}
          aria-label={`Open ${label} in maps`}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11Z"/>
            <circle cx="12" cy="10" r="2.5"/>
          </svg>
        </a>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOP HUD — status ribbon + live progress bar
// ═══════════════════════════════════════════════════════════════════════════════
function TopBar({ statusLabel, statusColor, rideId, paymentMethod, progress, gpsLive }) {
  const pm = (paymentMethod || '').toLowerCase();
  const pmColor  = pm === 'cash' ? C.amberBright : pm === 'card' ? C.cyan : C.ink;
  const pmBg     = pm === 'cash' ? 'rgba(251,191,36,.15)' : pm === 'card' ? 'rgba(103,232,249,.15)' : 'rgba(255,255,255,.07)';
  const pmBorder = pm === 'cash' ? 'rgba(251,191,36,.35)' : pm === 'card' ? 'rgba(103,232,249,.35)' : 'rgba(255,255,255,.12)';
  const pmLabel  = pm === 'cash' ? '$ CASH' : pm === 'card' ? '▣ CARD' : pm.toUpperCase();
  const pct = Math.max(0, Math.min(1, progress ?? 0));

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30,
      background: 'linear-gradient(180deg, rgba(3,6,4,.94) 55%, transparent)',
      paddingTop: 'max(8px, env(safe-area-inset-top))',
      pointerEvents: 'none',
    }}>
      <div style={{
        height: 44, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 16px',
      }}>
        {/* brand + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{
            fontFamily: COND, fontSize: 11, fontWeight: 800, letterSpacing: '.22em',
            color: 'rgba(255,255,255,.45)',
          }}>
            UATOB
          </span>
          <span style={{ color: C.inkFaint, fontFamily: MONO, fontSize: 9 }}>·</span>
          <Dot color={statusColor} size={7}/>
          <span style={{
            fontFamily: COND, fontSize: 10, fontWeight: 800, letterSpacing: '.14em',
            color: statusColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {statusLabel}
          </span>
        </div>

        {/* right: GPS health + payment + ride id */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontFamily: MONO, fontSize: 8, fontWeight: 800, letterSpacing: '.1em',
            color: gpsLive ? C.greenBright : C.inkDim,
          }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%',
              background: gpsLive ? C.greenBright : C.inkDim,
              boxShadow: gpsLive ? `0 0 6px ${C.greenBright}` : 'none',
              animation: gpsLive ? 'ats-blink 1.4s ease-in-out infinite' : 'none',
            }}/>
            {gpsLive ? 'LIVE GPS' : 'GPS…'}
          </span>
          {pm && (
            <span style={{
              fontFamily: MONO, fontSize: 9, fontWeight: 800, letterSpacing: '.08em',
              color: pmColor, background: pmBg, border: `1px solid ${pmBorder}`,
              borderRadius: 6, padding: '2px 7px',
            }}>
              {pmLabel}
            </span>
          )}
          <span style={{
            fontFamily: MONO, fontSize: 9, fontWeight: 700,
            color: C.inkDim, letterSpacing: '.06em',
          }}>
            #{(rideId || '').slice(-6).toUpperCase()}
          </span>
        </div>
      </div>

      {/* live progress bar */}
      <div style={{ height: 2.5, margin: '0 16px 0', background: 'rgba(255,255,255,.07)', borderRadius: 2 }}>
        <div style={{
          height: '100%', width: `${pct * 100}%`,
          background: `linear-gradient(90deg, ${statusColor}, ${statusColor}dd)`,
          borderRadius: 2,
          boxShadow: `0 0 10px ${statusColor}aa`,
          transition: 'width .6s cubic-bezier(.4,0,.2,1)',
        }}/>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LIVE ETA CARD — minutes, distance, arrival clock
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
      {/* ETA minutes */}
      <div style={{ flex: 1, textAlign: 'center', padding: '0 12px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 3 }}>
          <span style={{
            fontFamily: MONO, fontSize: 26, fontWeight: 800, lineHeight: 1, color: accent,
            textShadow: `0 0 18px ${accent}55`,
          }}>
            {fmtEtaMin(etaMin)}
          </span>
          <span style={{ fontFamily: COND, fontSize: 11, fontWeight: 800, color: accent, letterSpacing: '.08em' }}>
            MIN
          </span>
        </div>
        <div style={{ fontFamily: COND, fontSize: 8, fontWeight: 800, letterSpacing: '.16em', color: C.inkDim, marginTop: 2 }}>
          TO {targetWord}
        </div>
      </div>

      <div style={{ width: 1, background: 'rgba(255,255,255,.08)', margin: '2px 0' }}/>

      {/* distance */}
      <div style={{ flex: 1, textAlign: 'center', padding: '0 10px' }}>
        <div style={{ fontFamily: MONO, fontSize: 17, fontWeight: 800, color: C.white, lineHeight: 1.2 }}>
          {fmtMi(distMi)}
        </div>
        <div style={{ fontFamily: COND, fontSize: 8, fontWeight: 800, letterSpacing: '.16em', color: C.inkDim, marginTop: 3 }}>
          DISTANCE
        </div>
      </div>

      <div style={{ width: 1, background: 'rgba(255,255,255,.08)', margin: '2px 0' }}/>

      {/* arrival clock */}
      <div style={{ flex: 1, textAlign: 'center', padding: '0 10px' }}>
        <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 800, color: C.greenSoft, lineHeight: 1.3 }}>
          {arrivalClock}
        </div>
        <div style={{ fontFamily: COND, fontSize: 8, fontWeight: 800, letterSpacing: '.16em', color: C.inkDim, marginTop: 3 }}>
          ARRIVAL
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RIDER CARD — avatar, name, rating, payment
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
        <div style={{
          fontFamily: COND, fontSize: 13, fontWeight: 800, letterSpacing: '.04em',
          color: C.white, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          lineHeight: 1.1,
        }}>
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
          <span style={{ fontFamily: COND, fontSize: 8, fontWeight: 700, letterSpacing: '.1em', color: C.inkDim }}>
            RIDER
          </span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECENTER FAB — re-engage chase camera
// ═══════════════════════════════════════════════════════════════════════════════
function RecenterFab({ visible, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label="Recenter on my location"
      style={{
        position: 'absolute',
        right: 14, bottom: 'calc(258px + env(safe-area-inset-bottom))',
        zIndex: 33,
        width: 46, height: 46, borderRadius: 14, border: 'none', cursor: 'pointer',
        background: C.panelDeep, backdropFilter: 'blur(12px)',
        boxShadow: '0 6px 22px rgba(0,0,0,.6), inset 0 0 0 1px rgba(34,197,94,.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: C.greenBright,
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1)' : 'scale(.7)',
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity .25s ease, transform .25s cubic-bezier(.34,1.5,.64,1)',
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3.2"/>
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
      </svg>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLIDE-TO-CONFIRM CONTROL
// ═══════════════════════════════════════════════════════════════════════════════
function SlideAction({ label, color, onConfirm, pending }) {
  const trackRef    = useRef(null);
  const maxRef      = useRef(0);
  const draggingRef = useRef(false);
  const offsetRef   = useRef(0);     // live thumb offset (px) — always current
  const [x, setX]   = useState(0);   // mirror for render
  const [done, setDone] = useState(false);

  const THUMB = 50;
  const PAD   = 4;

  const measure = useCallback(() => {
    if (!trackRef.current) return 0;
    maxRef.current = Math.max(0, trackRef.current.clientWidth - THUMB - PAD * 2);
    return maxRef.current;
  }, []);

  useEffect(() => { measure(); }, [measure]);

  const clientX = (e) => (e.touches?.[0]?.clientX ?? e.clientX ?? 0);

  const setOffset = (px) => { offsetRef.current = px; setX(px); };

  const onDown = (e) => {
    if (pending || done) return;
    draggingRef.current = true;
    measure();
    const startX = clientX(e);
    const startOffset = offsetRef.current;

    const move = (ev) => {
      if (!draggingRef.current) return;
      let nx = startOffset + (clientX(ev) - startX);
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

      // confirm when the thumb is slid ≥ 88% of the track (reads live offset)
      if (offsetRef.current >= maxRef.current * 0.88) {
        setOffset(maxRef.current);
        setDone(true);
        onConfirm?.();
      } else {
        setOffset(0); // spring back
      }
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', up);
  };

  const progress = maxRef.current ? x / maxRef.current : 0;

  return (
    <div
      ref={trackRef}
      style={{
        position: 'relative', width: '100%', height: 58, borderRadius: 18,
        background: 'rgba(255,255,255,.05)',
        border: `1px solid ${color}33`,
        overflow: 'hidden', userSelect: 'none', touchAction: 'none',
        boxShadow: `inset 0 0 0 1px rgba(255,255,255,.02)`,
      }}
    >
      {/* fill behind thumb */}
      <div style={{
        position: 'absolute', inset: 0,
        width: `${PAD + THUMB + x}px`,
        background: `linear-gradient(135deg, ${color}33, ${color}11)`,
        transition: draggingRef.current ? 'none' : 'width .28s cubic-bezier(.34,1.1,.64,1)',
      }}/>

      {/* label */}
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: COND, fontSize: 15, fontWeight: 900, letterSpacing: '.12em',
        textTransform: 'uppercase',
        color: done || pending ? '#000' : color,
        opacity: pending ? 0 : 1 - progress * 0.9,
        transition: 'opacity .15s ease',
        paddingLeft: 30,
        pointerEvents: 'none',
      }}>
        {label}
      </div>

      {/* chevrons hint */}
      {!pending && !done && (
        <div style={{
          position: 'absolute', right: 18, top: 0, bottom: 0,
          display: 'flex', alignItems: 'center', gap: 1,
          opacity: 0.5 - progress * 0.5, pointerEvents: 'none',
        }}>
          {[0, 1, 2].map(i => (
            <svg key={i} width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
              style={{ animation: `ats-chev 1.3s ${i * 0.16}s ease-in-out infinite` }}>
              <polyline points="9 6 15 12 9 18"/>
            </svg>
          ))}
        </div>
      )}

      {/* draggable thumb */}
      <div
        onPointerDown={onDown}
        onTouchStart={onDown}
        style={{
          position: 'absolute', top: PAD, left: PAD + x,
          width: THUMB, height: 58 - PAD * 2, borderRadius: 14,
          background: pending ? 'rgba(255,255,255,.1)' : `linear-gradient(135deg, ${color}, ${color}cc)`,
          boxShadow: pending ? 'none' : `0 4px 16px ${color}66, inset 0 1px 0 rgba(255,255,255,.3)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: pending || done ? 'default' : 'grab',
          transition: draggingRef.current ? 'none' : 'left .28s cubic-bezier(.34,1.1,.64,1)',
          touchAction: 'none',
        }}
      >
        {pending ? (
          <div style={{
            width: 20, height: 20, borderRadius: '50%',
            border: '2px solid rgba(0,0,0,.25)', borderTop: '2px solid #000',
            animation: 'ats-spin .7s linear infinite',
          }}/>
        ) : done ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
            stroke="#000" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
            stroke="#000" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 6 15 12 9 18"/>
          </svg>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// BOTTOM ACTION SHEET
// ═══════════════════════════════════════════════════════════════════════════════
function ActionSheet({ trip, stage, distToTarget, onAction, pending, error, onDismissError }) {
  const cfg = STAGES[stage] || STAGES.driver_assigned;
  if (stage === 'completed') return <CompletedSheet trip={trip}/>;

  const pickup  = trip?.pickup  || trip?.pickupLabel  || trip?.pickupAddress  || '—';
  const dropoff = trip?.dropoff || trip?.dropoffLabel || trip?.dropoffAddress || '—';
  const distStr = distToTarget !== null ? fmtMi(distToTarget) : null;

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 32,
      animation: 'ats-slideup .45s cubic-bezier(.34,1.1,.64,1) both',
    }}>
      {/* error toast */}
      {error && (
        <div
          onClick={onDismissError}
          style={{
            margin: '0 12px 8px', padding: '10px 14px',
            background: 'rgba(239,68,68,.18)', border: '1px solid rgba(239,68,68,.45)',
            borderRadius: 14, backdropFilter: 'blur(12px)', cursor: 'pointer',
            animation: 'ats-slidedown .3s ease both',
          }}
        >
          <span style={{
            fontFamily: MONO, fontSize: 11, fontWeight: 700, color: C.red,
            lineHeight: 1.5, display: 'block',
          }}>
            ⚠ {error}
          </span>
          <span style={{ fontFamily: COND, fontSize: 9, letterSpacing: '.1em', color: 'rgba(248,113,113,.55)' }}>
            TAP TO DISMISS
          </span>
        </div>
      )}

      <div style={{
        background: C.panelDeep,
        borderTop: `1px solid ${cfg.statusColor}28`,
        borderRadius: '24px 24px 0 0',
        backdropFilter: 'blur(18px)',
        boxShadow: `0 -12px 48px rgba(0,0,0,.65), 0 0 40px ${cfg.statusColor}12`,
        paddingTop: 12, paddingLeft: 16, paddingRight: 16,
        paddingBottom: 'max(20px, calc(env(safe-area-inset-bottom) + 12px))',
      }}>
        {/* drag handle */}
        <div style={{ width: 36, height: 3.5, borderRadius: 2, background: 'rgba(255,255,255,.12)', margin: '0 auto 10px' }}/>

        {/* route summary */}
        <div style={{
          display: 'flex', gap: 12, alignItems: 'stretch', marginBottom: 10,
          background: 'rgba(255,255,255,.03)', borderRadius: 12,
          border: '1px solid rgba(255,255,255,.06)', padding: '9px 12px',
        }}>
          <RouteRail status={stage}/>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
            <AddrRow
              label="Pickup"
              text={pickup}
              dimmed={false}
              mapUrl={
                (trip?.pickupLat && trip?.pickupLng)
                  ? `https://www.google.com/maps/dir/?api=1&destination=${trip.pickupLat},${trip.pickupLng}`
                  : (pickup && pickup !== '—')
                    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pickup)}`
                    : null
              }
            />
            <AddrRow
              label="Drop-off"
              text={dropoff}
              dimmed={stage !== 'in_progress'}
              mapUrl={
                (trip?.dropoffLat && trip?.dropoffLng)
                  ? `https://www.google.com/maps/dir/?api=1&destination=${trip.dropoffLat},${trip.dropoffLng}`
                  : (dropoff && dropoff !== '—')
                    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dropoff)}`
                    : null
              }
            />
          </div>
        </div>

        {/* hint */}
        <div style={{
          fontFamily: COND, fontSize: 11, fontWeight: 600, letterSpacing: '.06em',
          color: C.ink, marginBottom: 10, lineHeight: 1.5,
          display: 'flex', alignItems: 'flex-start', gap: 7,
        }}>
          <span style={{ color: cfg.statusColor, fontSize: 12, marginTop: 1 }}>›</span>
          {cfg.hint}
          {distStr && (
            <span style={{
              marginLeft: 'auto', flexShrink: 0,
              fontFamily: MONO, fontSize: 11, fontWeight: 800, color: cfg.statusColor,
            }}>
              {distStr}
            </span>
          )}
        </div>

        {/* slide-to-confirm */}
        <SlideAction
          key={stage}                 /* reset thumb when the stage advances */
          label={pending ? 'WORKING…' : cfg.btnLabel}
          color={cfg.btnColor}
          pending={pending}
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
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 32,
      animation: 'ats-slideup .5s cubic-bezier(.34,1.2,.64,1) both',
    }}>
      <div style={{
        background: C.panelDeep,
        borderTop: `1px solid ${C.greenBright}33`,
        borderRadius: '24px 24px 0 0',
        backdropFilter: 'blur(18px)',
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
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
            stroke={C.greenBright} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>

        <div style={{
          fontFamily: COND, fontSize: 22, fontWeight: 900, letterSpacing: '.16em',
          color: C.greenBright, textTransform: 'uppercase', marginBottom: 4,
        }}>
          Trip Complete
        </div>

        {typeof payout === 'number' && (
          <div style={{
            fontFamily: MONO, fontSize: 30, fontWeight: 800, color: C.amberBright,
            textShadow: `0 0 24px ${C.amberBright}66`, marginBottom: 2,
          }}>
            +${payout.toFixed(2)}
          </div>
        )}
        <div style={{ fontFamily: COND, fontSize: 11, color: C.inkDim, letterSpacing: '.1em', marginBottom: 14 }}>
          PAYOUT CREDITED
        </div>

        {/* trip stat chips */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          {typeof miles === 'number' && miles > 0 && (
            <StatChip label="DISTANCE" value={`${miles.toFixed(1)} mi`}/>
          )}
          {typeof mins === 'number' && mins > 0 && (
            <StatChip label="DURATION" value={`${mins} min`}/>
          )}
        </div>
      </div>
    </div>
  );
}

function StatChip({ label, value }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)',
      borderRadius: 12, padding: '8px 16px', minWidth: 88,
    }}>
      <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 800, color: C.white }}>{value}</div>
      <div style={{ fontFamily: COND, fontSize: 8, fontWeight: 800, letterSpacing: '.14em', color: C.inkDim, marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAP MARKER FACTORIES (imperative DOM, attached to mapbox Markers)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Driver puck. Returns { el, rotate(deg) } so the master loop can spin only the
 * inner body (keeping the glow/ring steady). The car nose points "up" at 0°.
 */
function makeDriverPuck() {
  const outer = document.createElement('div');
  outer.style.cssText = 'position:relative;width:50px;height:50px;display:flex;align-items:center;justify-content:center;pointer-events:none;';

  const glow = document.createElement('div');
  glow.style.cssText = [
    'position:absolute', 'inset:-8px', 'border-radius:50%',
    'background:radial-gradient(circle,rgba(34,197,94,.4) 0%,transparent 70%)',
  ].join(';');

  const ring = document.createElement('div');
  ring.style.cssText = [
    'position:absolute', 'inset:1px', 'border-radius:50%',
    'border:2px solid rgba(74,222,128,.5)',
    'animation:ats-blink 1.8s ease-in-out infinite',
  ].join(';');

  // sweeping accuracy cone behind the heading
  const cone = document.createElement('div');
  cone.style.cssText = [
    'position:absolute', 'inset:0', 'border-radius:50%',
    'background:conic-gradient(from -20deg,transparent 0deg,rgba(74,222,128,.28) 20deg,transparent 40deg)',
    'transform:rotate(0deg)', 'transition:transform .12s linear',
  ].join(';');

  // rotating body holds the car glyph
  const rot = document.createElement('div');
  rot.style.cssText = [
    'position:absolute', 'inset:0', 'display:flex', 'align-items:center', 'justify-content:center',
    'transform:rotate(0deg)', 'transition:transform .12s linear', 'will-change:transform',
  ].join(';');

  const body = document.createElement('div');
  body.style.cssText = [
    'width:40px', 'height:40px', 'border-radius:50%',
    'background:linear-gradient(145deg,#4ADE80 0%,#16A34A 100%)',
    'border:3px solid #fff',
    'box-shadow:0 4px 18px rgba(34,197,94,.75),0 2px 6px rgba(0,0,0,.5)',
    'display:flex', 'align-items:center', 'justify-content:center',
  ].join(';');
  body.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 2 5 21l7-4 7 4z"/>
  </svg>`; // navigation arrow glyph (points up)

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

/** pin marker for pickup / dropoff */
function makePinEl(color, symbol) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;pointer-events:none;';

  const bubble = document.createElement('div');
  bubble.style.cssText = [
    'padding:4px 8px', 'border-radius:8px', 'white-space:nowrap',
    'background:rgba(3,6,4,.9)', `border:1.5px solid ${color}88`,
    `box-shadow:0 4px 14px rgba(0,0,0,.5),0 0 12px ${color}33`,
    `color:${color}`, "font-family:'JetBrains Mono','SFMono-Regular',monospace",
    'font-size:10px', 'font-weight:800',
  ].join(';');
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
const SRC_REMAIN = 'ats-route-remain';
const SRC_TRAVEL = 'ats-route-travel';
const LYR_REMAIN_GLOW = 'ats-remain-glow';
const LYR_REMAIN_MAIN = 'ats-remain-main';
const LYR_REMAIN_DASH = 'ats-remain-dash';
const LYR_TRAVEL_MAIN = 'ats-travel-main';

// animated marching-dash frames for the remaining route
const DASH_FRAMES = [
  [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5],
  [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0], [0, 0.5, 3, 3.5],
  [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5],
  [0, 3, 3, 1], [0, 3.5, 3, 0.5],
];

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function ActiveTripScreen({
  driver,
  activeTrip,
  onTripComplete,
  useDeviceLocation = true,
}) {
  // ── refs: map + markers ──────────────────────────────────────────────────
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const puckRef      = useRef(null);       // { el, rotate }
  const driverMkrRef = useRef(null);
  const pickupMkrRef = useRef(null);
  const dropoffMkrRef = useRef(null);

  // ── refs: animation state ────────────────────────────────────────────────
  const renderedRef  = useRef(null);       // [lng,lat] currently drawn
  const targetRef    = useRef(null);       // [lng,lat] latest fix
  const bearingRef   = useRef(0);          // currently drawn heading
  const targetBearingRef = useRef(0);      // desired heading
  const rafRef       = useRef(0);
  const frameNoRef   = useRef(0);
  const dashStepRef  = useRef(0);
  const lastFollowRef = useRef(0);
  const lastFixForBearingRef = useRef(null);

  // ── refs: route ──────────────────────────────────────────────────────────
  const routeCoordsRef = useRef([]);       // full [lng,lat] route for current phase
  const routeLenMiRef  = useRef(0);        // total length
  const routeDurSecRef = useRef(0);        // duration estimate from the route fetch
  const projIdxRef     = useRef(0);        // last matched segment index (monotonic)
  const routeReadyRef  = useRef(false);
  const fetchedPhaseRef = useRef(null);    // 'toPickup' | 'toDropoff'

  // ── refs: misc ─────────────────────────────────────────────────────────────
  const watchIdRef     = useRef(null);
  const completeTimerRef = useRef(null);
  const mountedRef     = useRef(true);

  // ── react state ────────────────────────────────────────────────────────────
  const [mapReady, setMapReady]       = useState(false);
  const [pending, setPending]         = useState(false);
  const [error, setError]             = useState(null);
  const [localStatus, setLocalStatus] = useState(null);
  const [rider, setRider]             = useState(null);
  const [liveTrip, setLiveTrip]       = useState(null);
  const [selfPos, setSelfPos]         = useState(null);   // {lat,lng,heading,ts}
  const [gpsLive, setGpsLive]         = useState(false);
  const [followMode, setFollowMode]   = useState(true);
  const [showRecenter, setShowRecenter] = useState(false);
  const [liveMetrics, setLiveMetrics] = useState({ etaMin: null, distMi: null, progress: 0 });

  // ── merge live Firestore doc over the prop ──────────────────────────────────
  const trip = useMemo(() => ({ ...(activeTrip || {}), ...(liveTrip || {}) }), [activeTrip, liveTrip]);

  // effective status: optimistic local > live doc > prop
  const status = localStatus || trip?.status || 'driver_assigned';
  const stage  = STAGES[status] || STAGES.driver_assigned;
  const phase  = stage.phase;

  // effective driver position: device GPS (fresh) > selfPos > prop
  const fresh = selfPos && (Date.now() - selfPos.ts) < STALE_FIX_MS;
  const dLat = fresh ? selfPos.lat : driver?.lat;
  const dLng = fresh ? selfPos.lng : driver?.lng;

  // target for the current phase
  const targetLat = phase === 'toDropoff' ? trip?.dropoffLat : trip?.pickupLat;
  const targetLng = phase === 'toDropoff' ? trip?.dropoffLng : trip?.pickupLng;

  // straight-line distance fallback (used before route metrics exist)
  const crowDistMi = (dLat && dLng && targetLat && targetLng)
    ? haversineMi(dLat, dLng, targetLat, targetLng) : null;

  // ── self-healing live ride listener ─────────────────────────────────────────
  useEffect(() => {
    const id = activeTrip?.id;
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'Rides', id), snap => {
      if (snap.exists() && mountedRef.current) setLiveTrip({ id: snap.id, ...snap.data() });
    }, () => {});
    return () => unsub();
  }, [activeTrip?.id]);

  // ── rider account lookup ─────────────────────────────────────────────────────
  useEffect(() => {
    const uid = trip?.uid;
    if (!uid) return;
    getDoc(doc(db, 'Accounts', uid))
      .then(snap => { if (snap.exists() && mountedRef.current) setRider(snap.data()); })
      .catch(() => {});
  }, [trip?.uid]);

  // ── device geolocation watch (the realtime heartbeat) ───────────────────────
  useEffect(() => {
    if (!useDeviceLocation || typeof navigator === 'undefined' || !navigator.geolocation) return;
    let firstFix = false;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (!mountedRef.current) return;
        const { latitude, longitude, heading } = pos.coords;
        setSelfPos({
          lat: latitude,
          lng: longitude,
          heading: (typeof heading === 'number' && !isNaN(heading)) ? heading : null,
          ts: Date.now(),
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

  // ── lifecycle flag ───────────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── load mapbox + init map ───────────────────────────────────────────────────
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
        container: containerRef.current,
        style:     MAP_STYLE,
        center:    [cLng, cLat],
        zoom:      15.5,
        pitch:     58,
        bearing:   0,
        interactive: true,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
      });

      // user pans → drop follow mode, surface recenter
      const onUserMove = (e) => {
        if (e && e.originalEvent) { // human-initiated
          setFollowMode(false);
          setShowRecenter(true);
        }
      };
      map.on('dragstart', onUserMove);
      map.on('zoomstart', onUserMove);

      map.on('load', () => {
        mapRef.current = map;

        // seed rendered/target with whatever we know
        const seed = (fresh && selfPos) ? [selfPos.lng, selfPos.lat]
                   : (typeof driver?.lng === 'number') ? [driver.lng, driver.lat]
                   : [cLng, cLat];
        renderedRef.current = seed.slice();
        targetRef.current   = seed.slice();

        // puck
        puckRef.current = makeDriverPuck();
        driverMkrRef.current = new mbgl.Marker({ element: puckRef.current.el, anchor: 'center' })
          .setLngLat(seed)
          .addTo(map);

        setMapReady(true);
      });
    }

    return () => {
      if (mapRef.current) {
        try { mapRef.current.remove(); } catch (e) {}
        mapRef.current = null;
      }
      driverMkrRef.current = null;
      pickupMkrRef.current = null;
      dropoffMkrRef.current = null;
      puckRef.current = null;
      routeReadyRef.current = false;
      setMapReady(false);
    };
  // eslint-disable-next-line
  }, []);

  // ── feed latest fix into the animation target + derive heading ──────────────
  useEffect(() => {
    if (typeof dLat !== 'number' || typeof dLng !== 'number') return;
    targetRef.current = [dLng, dLat];

    // prefer GPS heading; else derive from movement
    if (fresh && selfPos?.heading != null) {
      targetBearingRef.current = selfPos.heading;
    } else {
      const prev = lastFixForBearingRef.current;
      if (prev) {
        const moved = haversineMi(prev[1], prev[0], dLat, dLng) * 1609.34; // meters
        if (moved >= MIN_MOVE_FOR_BEARING_M) {
          targetBearingRef.current = bearingDeg(prev[1], prev[0], dLat, dLng);
        }
      }
    }
    lastFixForBearingRef.current = [dLng, dLat];
  }, [dLat, dLng, fresh, selfPos]);

  // ── route fetch + draw (per phase) ──────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    if (typeof dLat !== 'number' || typeof dLng !== 'number') return;
    if (!targetLat || !targetLng) return;
    if (fetchedPhaseRef.current === phase && routeReadyRef.current) return;

    const phaseAtCall = phase;
    fetchedPhaseRef.current = phase;

    // For the in-progress leg, prefer the ride's stored pickup→dropoff polyline.
    const stored = phase === 'toDropoff' ? decodePolyline(trip?.polyline) : [];
    if (stored.length >= 2) {
      const coords = stored.map(p => [p[1], p[0]]);
      installRoute(coords, /*durSec*/ (trip?.tripDurationMin || 0) * 60);
      return;
    }

    callGetRoute({
      driverLat: dLat, driverLng: dLng,
      pickupLat: targetLat, pickupLng: targetLng,
    }).then(({ data }) => {
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
  }, [mapReady, phase, dLat, dLng, targetLat, targetLng]);

  /** install a fresh route for the current phase and draw it */
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

  /** (re)draw both route layers */
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

    // traveled (behind the car): dim grey, sits underneath
    map.addLayer({
      id: LYR_TRAVEL_MAIN, type: 'line', source: SRC_TRAVEL,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': 'rgba(255,255,255,.85)', 'line-width': 5, 'line-opacity': .14 },
    });

    // remaining (road ahead): glow + bright core + flowing dash
    map.addLayer({
      id: LYR_REMAIN_GLOW, type: 'line', source: SRC_REMAIN,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': C.greenBright, 'line-width': 13, 'line-opacity': .12, 'line-blur': 8 },
    });
    map.addLayer({
      id: LYR_REMAIN_MAIN, type: 'line', source: SRC_REMAIN,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': C.green, 'line-width': 5, 'line-opacity': 1 },
    });
    map.addLayer({
      id: LYR_REMAIN_DASH, type: 'line', source: SRC_REMAIN,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#EAFFF2', 'line-width': 2, 'line-opacity': .55, 'line-dasharray': [0, 4, 3] },
    });

    routeReadyRef.current = true;
  }

  /** place pickup / dropoff pins */
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

  /** fit the whole route (overview) */
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

  /** chase-cam: center on the puck, rotate to heading */
  function snapCamera(immediate = false) {
    const map = mapRef.current;
    if (!map || !renderedRef.current) return;
    const now = performance.now();
    if (!immediate && now - lastFollowRef.current < FOLLOW_THROTTLE_MS) return;
    lastFollowRef.current = now;
    map.easeTo({
      center: renderedRef.current,
      bearing: bearingRef.current,
      pitch: 58,
      zoom: Math.max(map.getZoom(), 15.5),
      duration: immediate ? 600 : FOLLOW_THROTTLE_MS + 60,
      easing: t => t,
    });
  }

  // ── master animation loop ────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;
    let alive = true;

    const tick = () => {
      if (!alive) return;
      rafRef.current = requestAnimationFrame(tick);
      const map = mapRef.current;
      if (!map || !renderedRef.current || !targetRef.current) return;
      frameNoRef.current++;

      // 1) smooth position toward latest fix (exponential follow)
      const r = renderedRef.current, t = targetRef.current;
      r[0] = lerp(r[0], t[0], SMOOTH_POS);
      r[1] = lerp(r[1], t[1], SMOOTH_POS);

      // 2) smooth heading (shortest arc)
      bearingRef.current = lerpAngle(bearingRef.current, targetBearingRef.current, SMOOTH_BEARING);

      // 3) move + rotate the puck
      if (driverMkrRef.current) driverMkrRef.current.setLngLat(r);
      if (puckRef.current) {
        // car glyph should face heading relative to current map bearing
        const screenHeading = followMode ? 0 : bearingRef.current - map.getBearing();
        puckRef.current.rotate(followMode ? 0 : screenHeading);
      }

      // 4) trim route behind the car (throttled)
      if (routeReadyRef.current && routeCoordsRef.current.length >= 2 &&
          frameNoRef.current % TRIM_EVERY_FRAMES === 0) {
        const coords = routeCoordsRef.current;
        const proj = projectOntoRoute(coords, r, projIdxRef.current);
        if (proj.idx >= projIdxRef.current) projIdxRef.current = proj.idx;

        const remain = remainingFrom(coords, { ...proj, idx: projIdxRef.current });
        const travel = traveledTo(coords, { ...proj, idx: projIdxRef.current });

        map.getSource(SRC_REMAIN)?.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: remain } });
        map.getSource(SRC_TRAVEL)?.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: travel } });

        // 5) live metrics from remaining geometry
        const remainMi = pathLengthMi(remain);
        const total = routeLenMiRef.current || remainMi || 1;
        const progress = Math.max(0, Math.min(1, 1 - remainMi / total));
        let etaMin;
        if (routeDurSecRef.current > 0) {
          etaMin = (routeDurSecRef.current / 60) * (remainMi / total);
        } else {
          etaMin = (remainMi / FALLBACK_SPEED_MPH) * 60;
        }
        // cheap state throttle: update ~3x/sec
        if (frameNoRef.current % 18 === 0) {
          setLiveMetrics({ etaMin, distMi: remainMi, progress });
        }
      }

      // 6) flowing dash
      if (routeReadyRef.current && frameNoRef.current % 3 === 0) {
        const step = (dashStepRef.current + 1) % DASH_FRAMES.length;
        dashStepRef.current = step;
        try { map.setPaintProperty(LYR_REMAIN_DASH, 'line-dasharray', DASH_FRAMES[step]); } catch (e) {}
      }

      // 7) chase camera
      if (followMode) snapCamera(false);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(rafRef.current); };
  // eslint-disable-next-line
  }, [mapReady, followMode]);

  // ── recenter handler ─────────────────────────────────────────────────────────
  const handleRecenter = useCallback(() => {
    setFollowMode(true);
    setShowRecenter(false);
    snapCamera(true);
  // eslint-disable-next-line
  }, []);

  // ── action handler ───────────────────────────────────────────────────────────
  const handleAction = useCallback(async (action, rideId) => {
    if (!action || !rideId) return;
    setPending(true);
    setError(null);
    try {
      const res = await callUpdateTrip({ rideId, action });
      const newStatus = res.data?.status;
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
  }, [onTripComplete]);

  // ── cleanup timers/markers on unmount ────────────────────────────────────────
  useEffect(() => () => {
    if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
    [pickupMkrRef, dropoffMkrRef, driverMkrRef].forEach(r => {
      if (r.current) { try { r.current.remove(); } catch (e) {} }
    });
  }, []);

  // ── derived display metrics (route-aware, with crow-flies fallback) ──────────
  const displayDist = liveMetrics.distMi != null ? liveMetrics.distMi : crowDistMi;
  const displayEta  = liveMetrics.etaMin != null
    ? liveMetrics.etaMin
    : (crowDistMi != null ? (crowDistMi / FALLBACK_SPEED_MPH) * 60 : null);
  const displayProgress = liveMetrics.progress || 0;
  const arrivalClock = displayEta != null ? fmtArrivalClock(displayEta) : '—';

  // ─── render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes ats-spin       { to { transform:rotate(360deg); } }
        @keyframes ats-blink      { 0%,100%{opacity:1} 50%{opacity:.25} }
        @keyframes ats-slidedown  { from{opacity:0;transform:translate(-50%,-10px)} to{opacity:1;transform:translate(-50%,0)} }
        @keyframes ats-slidein-right { from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:translateX(0)} }
        @keyframes ats-slideup    { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ats-popin      { from{opacity:0;transform:scale(.55)} to{opacity:1;transform:scale(1)} }
        @keyframes ats-chev       { 0%,100%{opacity:.3;transform:translateX(0)} 50%{opacity:1;transform:translateX(2px)} }
        .mapboxgl-ctrl-logo { display:none !important; }
      `}</style>

      <div style={{ position: 'fixed', inset: 0, background: C.bg, overflow: 'hidden' }}>
        {/* full-screen mapbox canvas */}
        <div ref={containerRef} style={{ position: 'absolute', inset: 0 }}/>

        {/* loading state */}
        {!mapReady && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 12, background: C.bg,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              border: '2px solid rgba(34,197,94,.15)', borderTop: `2px solid ${C.green}`,
              animation: 'ats-spin .85s linear infinite',
            }}/>
            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: '.1em', color: C.inkDim }}>
              ACQUIRING MAP…
            </span>
          </div>
        )}

        {/* vignette for depth */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 50% 44%, transparent 38%, rgba(3,6,4,.28) 78%, rgba(3,6,4,.62) 100%)',
        }}/>

        {/* top HUD */}
        <TopBar
          statusLabel={stage.statusLabel}
          statusColor={stage.statusColor}
          rideId={trip?.id}
          paymentMethod={trip?.paymentMethod}
          progress={displayProgress}
          gpsLive={gpsLive}
        />

        {/* live ETA card */}
        {mapReady && status !== 'completed' && (
          <EtaCard
            etaMin={status === 'arrived' ? 0 : displayEta}
            distMi={status === 'arrived' ? 0 : displayDist}
            status={status}
            arrivalClock={status === 'arrived' ? 'NOW' : arrivalClock}
          />
        )}

        {/* rider card */}
        {mapReady && status !== 'completed' && <RiderCard rider={rider}/>}

        {/* recenter */}
        {mapReady && status !== 'completed' && (
          <RecenterFab visible={showRecenter} onClick={handleRecenter}/>
        )}

        {/* bottom action sheet */}
        <ActionSheet
          trip={trip}
          stage={status}
          distToTarget={displayDist}
          onAction={handleAction}
          pending={pending}
          error={error}
          onDismissError={() => setError(null)}
        />
      </div>
    </>
  );
}