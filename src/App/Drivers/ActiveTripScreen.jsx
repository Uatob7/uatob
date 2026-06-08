/**
 * ActiveTripScreen.jsx
 *
 * Full-screen trip view rendered whenever the driver has an assigned ride.
 * Replaces the radar HomeTab UI for the duration of the trip.
 *
 * Props
 * ─────
 *   driver          { uid, lat, lng, firstName }
 *   activeTrip      Firestore ride doc (driver_assigned | arrived | in_progress | completed)
 *   onTripComplete  () => void  — called after status reaches "completed"
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { getFunctions, httpsCallable }               from 'firebase/functions';
import { getFirestore, doc, getDoc }                 from 'firebase/firestore';
import { firebase_app }                              from '@/firebase/config';

const db = getFirestore(firebase_app);

const _functions        = getFunctions(firebase_app, 'us-east1');
const callUpdateTrip    = httpsCallable(_functions, 'updateTripStatus');
const callGetRoute      = httpsCallable(_functions, 'getDriverToPickup');  // reuse existing

// ─── tokens ──────────────────────────────────────────────────────────────────
const MAPBOX_TOKEN = 'pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA';
const MAP_STYLE    = 'mapbox://styles/mapbox/dark-v11';

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

// ─── trip state machine ───────────────────────────────────────────────────────
const STAGES = {
  driver_assigned: {
    action:      'arrive',
    btnLabel:    "I'VE ARRIVED",
    btnColor:    C.cyan,
    statusLabel: 'EN ROUTE TO PICKUP',
    statusColor: C.cyan,
    nextStatus:  'arrived',
    hint:        'Drive to the pickup location, then tap when you arrive.',
  },
  arrived: {
    action:      'start',
    btnLabel:    'START TRIP',
    btnColor:    C.greenBright,
    statusLabel: 'ARRIVED · AWAITING RIDER',
    statusColor: C.greenBright,
    nextStatus:  'in_progress',
    hint:        'Rider notified. Tap Start Trip once they board.',
  },
  in_progress: {
    action:      'complete',
    btnLabel:    'COMPLETE TRIP',
    btnColor:    C.amberBright,
    statusLabel: 'TRIP IN PROGRESS',
    statusColor: C.amberBright,
    nextStatus:  'completed',
    hint:        'Drive to the drop-off, then tap Complete Trip.',
  },
  completed: {
    action:      null,
    btnLabel:    null,
    statusLabel: 'TRIP COMPLETED',
    statusColor: C.greenBright,
    hint:        'Trip complete. Great job!',
  },
};

// ─── helpers ──────────────────────────────────────────────────────────────────
function haversineMi(lat1, lng1, lat2, lng2) {
  const R    = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2
             + Math.cos(lat1 * Math.PI / 180)
             * Math.cos(lat2 * Math.PI / 180)
             * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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

function fmtMi(mi) {
  if (mi === null || !isFinite(mi)) return '—';
  return mi < 0.1 ? `${Math.round(mi * 5280)} ft` : `${mi.toFixed(1)} mi`;
}

// ─── sub-components ───────────────────────────────────────────────────────────

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

/** route rail: green circle → dashed line → white diamond */
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

/** single address row */
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

/** top HUD ribbon */
function TopBar({ statusLabel, statusColor, rideId, paymentMethod }) {
  const pm = (paymentMethod || '').toLowerCase();
  const pmColor  = pm === 'cash' ? C.amberBright : pm === 'card' ? C.cyan : C.ink;
  const pmBg     = pm === 'cash' ? 'rgba(251,191,36,.15)' : pm === 'card' ? 'rgba(103,232,249,.15)' : 'rgba(255,255,255,.07)';
  const pmBorder = pm === 'cash' ? 'rgba(251,191,36,.35)' : pm === 'card' ? 'rgba(103,232,249,.35)' : 'rgba(255,255,255,.12)';
  const pmLabel  = pm === 'cash' ? '$ CASH' : pm === 'card' ? '▣ CARD' : pm.toUpperCase();

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30,
      height: 48,
      background: 'linear-gradient(180deg, rgba(3,6,4,.92) 60%, transparent)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 16px',
      pointerEvents: 'none',
    }}>
      {/* brand + status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
          color: statusColor,
        }}>
          {statusLabel}
        </span>
      </div>

      {/* right: payment method + ride id */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {pm && (
          <span style={{
            fontFamily: MONO, fontSize: 9, fontWeight: 800, letterSpacing: '.08em',
            color: pmColor,
            background: pmBg,
            border: `1px solid ${pmBorder}`,
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
  );
}

/** distance + payout floating pill */
function InfoPill({ distMi, payout, status }) {
  const distColor = status === 'driver_assigned' ? C.cyan
                  : status === 'arrived'          ? C.greenBright
                  :                                 C.amberBright;
  return (
    <div style={{
      position: 'absolute', top: 56, left: '50%', transform: 'translateX(-50%)',
      zIndex: 28, pointerEvents: 'none',
      display: 'flex', alignItems: 'center', gap: 10,
      background: C.panelDeep, backdropFilter: 'blur(14px)',
      border: `1px solid ${distColor}33`,
      borderRadius: 99, padding: '5px 16px',
      boxShadow: `0 4px 20px rgba(0,0,0,.55), 0 0 20px ${distColor}18`,
      animation: 'ats-slidedown .4s cubic-bezier(.34,1.2,.64,1) both',
    }}>
      <Dot color={distColor} size={6}/>
      <span style={{
        fontFamily: MONO, fontSize: 13, fontWeight: 800, color: distColor,
        minWidth: 52, textAlign: 'center',
      }}>
        {distMi}
      </span>
      {typeof payout === 'number' && (
        <>
          <div style={{ width: 1, height: 14, background: C.line }}/>
          <span style={{
            fontFamily: MONO, fontSize: 13, fontWeight: 800,
            color: C.amberBright,
            textShadow: `0 0 14px ${C.amberBright}55`,
          }}>
            ${payout.toFixed(2)}
          </span>
        </>
      )}
    </div>
  );
}

/** bottom action sheet */
function ActionSheet({
  trip,
  stage,
  distToTarget,
  onAction,
  pending,
  error,
  onDismissError,
}) {
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
            borderRadius: 14, backdropFilter: 'blur(12px)',
            cursor: 'pointer',
            animation: 'ats-slidedown .3s ease both',
          }}
        >
          <span style={{
            fontFamily: MONO, fontSize: 11, fontWeight: 700, color: C.red,
            lineHeight: 1.5, display: 'block',
          }}>
            ⚠ {error}
          </span>
          <span style={{
            fontFamily: COND, fontSize: 9, letterSpacing: '.1em', color: 'rgba(248,113,113,.55)',
          }}>
            TAP TO DISMISS
          </span>
        </div>
      )}

      <div style={{
        margin: '0 0', background: C.panelDeep,
        borderTop: `1px solid ${cfg.statusColor}28`,
        borderRadius: '24px 24px 0 0',
        backdropFilter: 'blur(18px)',
        boxShadow: `0 -12px 48px rgba(0,0,0,.65), 0 0 40px ${cfg.statusColor}12`,
        paddingTop: 12, paddingLeft: 16, paddingRight: 16,
        paddingBottom: 'max(24px, calc(env(safe-area-inset-bottom) + 12px))',
      }}>
        {/* drag handle */}
        <div style={{
          width: 36, height: 3.5, borderRadius: 2,
          background: 'rgba(255,255,255,.12)',
          margin: '0 auto 10px',
        }}/>

        {/* route summary */}
        <div style={{
          display: 'flex', gap: 12, alignItems: 'stretch',
          marginBottom: 10,
          background: 'rgba(255,255,255,.03)', borderRadius: 12,
          border: '1px solid rgba(255,255,255,.06)',
          padding: '9px 12px',
        }}>
          <RouteRail status={stage}/>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
            <AddrRow
              label="Pickup"
              text={pickup}
              dimmed={false}
              mapUrl={trip?.pickupLat && trip?.pickupLng
                ? `https://www.google.com/maps/dir/?api=1&destination=${trip.pickupLat},${trip.pickupLng}`
                : null}
            />
            <AddrRow
              label="Drop-off"
              text={dropoff}
              dimmed={stage !== 'in_progress'}
              mapUrl={trip?.dropoffLat && trip?.dropoffLng
                ? `https://www.google.com/maps/dir/?api=1&destination=${trip.dropoffLat},${trip.dropoffLng}`
                : null}
            />
          </div>
        </div>

        {/* hint */}
        <div style={{
          fontFamily: COND, fontSize: 11, fontWeight: 600, letterSpacing: '.06em',
          color: C.ink, marginBottom: 8, lineHeight: 1.5,
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

        {/* CTA button */}
        <button
          onClick={() => !pending && onAction(cfg.action, trip.id)}
          disabled={pending}
          style={{
            width: '100%', height: 56, borderRadius: 18, border: 'none',
            cursor: pending ? 'not-allowed' : 'pointer',
            background: pending
              ? 'rgba(255,255,255,.06)'
              : `linear-gradient(135deg, ${cfg.btnColor}ee, ${cfg.btnColor}bb)`,
            color: pending ? C.inkDim : '#000',
            fontFamily: COND, fontSize: 16, fontWeight: 900, letterSpacing: '.12em',
            textTransform: 'uppercase',
            boxShadow: pending ? 'none' : `0 6px 28px ${cfg.btnColor}55, inset 0 1px 0 rgba(255,255,255,.25)`,
            transition: 'all .2s ease',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            position: 'relative', overflow: 'hidden',
          }}
        >
          {pending ? (
            <>
              <div style={{
                width: 18, height: 18, borderRadius: '50%',
                border: `2px solid ${C.inkDim}`,
                borderTop: `2px solid ${C.ink}`,
                animation: 'ats-spin .7s linear infinite',
              }}/>
              <span>VERIFYING LOCATION…</span>
            </>
          ) : (
            <>
              {/* shimmer */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,.18) 50%, transparent 65%)',
                animation: 'ats-shimmer 2.4s ease-in-out infinite',
              }}/>
              {cfg.btnLabel}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/** completed state sheet */
function CompletedSheet({ trip }) {
  const payout = trip?.driverPayout;
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 32,
      animation: 'ats-slideup .5s cubic-bezier(.34,1.2,.64,1) both',
    }}>
      <div style={{
        margin: '0 0', background: C.panelDeep,
        borderTop: `1px solid ${C.greenBright}33`,
        borderRadius: '24px 24px 0 0',
        backdropFilter: 'blur(18px)',
        boxShadow: `0 -12px 48px rgba(0,0,0,.7), 0 0 50px ${C.greenBright}18`,
        padding: '14px 20px 44px',
        textAlign: 'center',
      }}>
        <div style={{ width: 36, height: 3.5, borderRadius: 2, background: 'rgba(255,255,255,.12)', margin: '0 auto 20px' }}/>

        {/* checkmark */}
        <div style={{
          width: 56, height: 56, borderRadius: '50%', margin: '0 auto 14px',
          background: 'rgba(34,197,94,.18)',
          border: `2px solid ${C.greenBright}66`,
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
            fontFamily: MONO, fontSize: 28, fontWeight: 800,
            color: C.amberBright,
            textShadow: `0 0 24px ${C.amberBright}66`,
            marginBottom: 4,
          }}>
            +${payout.toFixed(2)}
          </div>
        )}
        <div style={{ fontFamily: COND, fontSize: 11, color: C.inkDim, letterSpacing: '.1em' }}>
          PAYOUT CREDITED
        </div>
      </div>
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────
function getInitials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

// ─── driver marker HTML element ──────────────────────────────────────────────
function makeDriverMarkerEl() {
  const outer = document.createElement('div');
  outer.style.cssText = 'position:relative;width:46px;height:46px;display:flex;align-items:center;justify-content:center;';

  const glow = document.createElement('div');
  glow.style.cssText = [
    'position:absolute', 'inset:-6px', 'border-radius:50%',
    'background:radial-gradient(circle,rgba(34,197,94,.35) 0%,transparent 70%)',
    'pointer-events:none',
  ].join(';');

  const ring = document.createElement('div');
  ring.style.cssText = [
    'position:absolute', 'inset:0', 'border-radius:50%',
    'border:2px solid rgba(74,222,128,.55)',
    'animation:ats-blink 1.8s ease-in-out infinite',
    'pointer-events:none',
  ].join(';');

  const body = document.createElement('div');
  body.style.cssText = [
    'width:42px', 'height:42px', 'border-radius:50%',
    'background:linear-gradient(145deg,#4ADE80 0%,#16A34A 100%)',
    'border:3px solid #fff',
    'box-shadow:0 4px 18px rgba(34,197,94,.75),0 2px 6px rgba(0,0,0,.5)',
    'display:flex', 'align-items:center', 'justify-content:center',
    'position:relative',
  ].join(';');

  body.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l2-4h12l2 4h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/>
    <circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>
  </svg>`;

  outer.appendChild(glow);
  outer.appendChild(ring);
  outer.appendChild(body);
  return outer;
}

// ─── map source/layer constants ───────────────────────────────────────────────
const SRC_ROUTE   = 'ats-route';
const LYR_GLOW    = 'ats-route-glow';
const LYR_MAIN    = 'ats-route-main';
const LYR_DASH    = 'ats-route-dash';

// ─── main component ───────────────────────────────────────────────────────────
export default function ActiveTripScreen({ driver, activeTrip, onTripComplete }) {
  const containerRef  = useRef(null);
  const mapRef        = useRef(null);
  const driverSrcRef  = useRef(false);
  const routeSrcRef   = useRef(false);
  const pickupMkrRef  = useRef(null);
  const dropoffMkrRef = useRef(null);
  const driverMkrRef  = useRef(null);
  const prevTripIdRef = useRef(null);

  const [mapReady, setMapReady]       = useState(false);
  const [pending,  setPending]        = useState(false);
  const [error,    setError]          = useState(null);
  const [localStatus, setLocalStatus] = useState(null);
  const [riderAccount, setRiderAccount] = useState(null);

  useEffect(() => {
    const uid = activeTrip?.uid;
    if (!uid) return;
    getDoc(doc(db, 'Accounts', uid))
      .then(snap => { if (snap.exists()) setRiderAccount(snap.data()); })
      .catch(() => {});
  }, [activeTrip?.uid]);

  // effective status: prefer local optimistic state
  const status = localStatus || activeTrip?.status || 'driver_assigned';
  const stage  = STAGES[status] || STAGES.driver_assigned;

  // distance to relevant target
  const dLat = driver?.lat, dLng = driver?.lng;
  const targetLat = status === 'in_progress' ? activeTrip?.dropoffLat : activeTrip?.pickupLat;
  const targetLng = status === 'in_progress' ? activeTrip?.dropoffLng : activeTrip?.pickupLng;
  const distToTarget = (dLat && dLng && targetLat && targetLng)
    ? haversineMi(dLat, dLng, targetLat, targetLng)
    : null;

  // ── load mapbox ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current) return;

    // inject script + css once
    if (!document.getElementById('mb-script')) {
      const link = document.createElement('link');
      link.rel   = 'stylesheet';
      link.href  = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css';
      document.head.appendChild(link);

      const script    = document.createElement('script');
      script.id       = 'mb-script';
      script.src      = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js';
      script.async    = true;
      document.head.appendChild(script);
      script.onload   = () => initMap();
    } else if (window.mapboxgl) {
      initMap();
    } else {
      // script already injected but not loaded yet — wait
      document.getElementById('mb-script').addEventListener('load', initMap, { once: true });
    }

    function initMap() {
      if (!containerRef.current || mapRef.current) return;
      const mbgl        = window.mapboxgl;
      mbgl.accessToken  = MAPBOX_TOKEN;

      const cLat = activeTrip?.pickupLat ?? driver?.lat ?? 28.5383;
      const cLng = activeTrip?.pickupLng ?? driver?.lng ?? -81.3792;

      const map = new mbgl.Map({
        container:          containerRef.current,
        style:              MAP_STYLE,
        center:             [cLng, cLat],
        zoom:               13,
        pitch:              50,
        bearing:            -10,
        interactive:        false,
        attributionControl: false,
      });

      map.on('load', () => {
        mapRef.current = map;

        // driver marker (custom HTML)
        if (window.mapboxgl && typeof driver?.lat === 'number') {
          driverMkrRef.current = new window.mapboxgl.Marker({
            element: makeDriverMarkerEl(),
            anchor: 'center',
          })
            .setLngLat([driver.lng, driver.lat])
            .addTo(map);
        }
        driverSrcRef.current = true;

        setMapReady(true);
      });
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current     = null;
        driverSrcRef.current  = false;
        routeSrcRef.current   = false;
        pickupMkrRef.current  = null;
        dropoffMkrRef.current = null;
        driverMkrRef.current  = null;
        setMapReady(false);
      }
    };
  }, []); // eslint-disable-line

  // ── update driver dot + gentle re-center ────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !driverSrcRef.current) return;
    if (typeof dLat !== 'number' || typeof dLng !== 'number') return;
    try {
      // Slide the car marker to the new position
      if (driverMkrRef.current) {
        driverMkrRef.current.setLngLat([dLng, dLat]);
      } else if (window.mapboxgl && mapRef.current) {
        driverMkrRef.current = new window.mapboxgl.Marker({
          element: makeDriverMarkerEl(),
          anchor: 'center',
        })
          .setLngLat([dLng, dLat])
          .addTo(mapRef.current);
      }
      // Only re-center when no route is drawn; otherwise fitBounds owns the camera
      if (!routeSrcRef.current) {
        mapRef.current.easeTo({ center: [dLng, dLat], duration: 1400 });
      }
    } catch (e) { /* map gone */ }
  }, [dLat, dLng, mapReady]);

  // ── fetch + draw route when trip arrives or driver coords become known ──
  useEffect(() => {
    if (!mapReady || !mapRef.current || !activeTrip?.id) return;
    // Wait until driver position is available before locking in the trip id
    if (!dLat || !dLng || !activeTrip.pickupLat || !activeTrip.pickupLng) return;
    if (activeTrip.id === prevTripIdRef.current) return;
    prevTripIdRef.current = activeTrip.id;

    callGetRoute({
      driverLat: dLat, driverLng: dLng,
      pickupLat: activeTrip.pickupLat, pickupLng: activeTrip.pickupLng,
    }).then(({ data }) => {
      if (!data?.polyline || !mapRef.current) return;
      const coords = decodePolyline(data.polyline).map(p => [p[1], p[0]]);
      drawRoute(coords);
      placeMarkers();
      fitMap(coords);
    }).catch(err => {
      console.warn('[ActiveTripScreen] route fetch failed:', err);
      // straight-line fallback so a line is always visible
      drawRoute([[dLng, dLat], [activeTrip.pickupLng, activeTrip.pickupLat]]);
      placeMarkers();
      fitMapFallback();
    });
  }, [activeTrip?.id, mapReady, dLat, dLng]); // eslint-disable-line


  function drawRoute(coords) {
    const map = mapRef.current;
    if (!map) return;
    const geo = { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } };

    if (routeSrcRef.current) {
      map.getSource(SRC_ROUTE)?.setData(geo);
    } else {
      map.addSource(SRC_ROUTE, { type: 'geojson', data: geo });
      map.addLayer({
        id: LYR_GLOW, type: 'line', source: SRC_ROUTE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint:  { 'line-color': '#fff', 'line-width': 12, 'line-opacity': .08, 'line-blur': 6 },
      });
      map.addLayer({
        id: LYR_MAIN, type: 'line', source: SRC_ROUTE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint:  { 'line-color': '#22C55E', 'line-width': 4, 'line-opacity': 1 },
      });
      map.addLayer({
        id: LYR_DASH, type: 'line', source: SRC_ROUTE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint:  { 'line-color': '#fff', 'line-width': 1.8, 'line-opacity': .3, 'line-dasharray': [0, 5] },
      });
      routeSrcRef.current = true;
    }
  }

  function placeMarkers() {
    const map = mapRef.current;
    if (!map || !window.mapboxgl) return;

    // remove stale
    [pickupMkrRef, dropoffMkrRef].forEach(r => {
      if (r.current) { try { r.current.remove(); } catch (e) {} r.current = null; }
    });

    // pickup pin
    if (activeTrip.pickupLat && activeTrip.pickupLng) {
      const el = makePinEl(C.greenBright, '●');
      pickupMkrRef.current = new window.mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([activeTrip.pickupLng, activeTrip.pickupLat])
        .addTo(map);
    }

    // dropoff pin
    if (activeTrip.dropoffLat && activeTrip.dropoffLng) {
      const el = makePinEl(C.amberBright, '◆');
      dropoffMkrRef.current = new window.mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([activeTrip.dropoffLng, activeTrip.dropoffLat])
        .addTo(map);
    }
  }

  function makePinEl(color, symbol) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;pointer-events:none;';

    const bubble = document.createElement('div');
    bubble.style.cssText = [
      'padding:4px 8px', 'border-radius:8px', 'white-space:nowrap',
      `background:rgba(3,6,4,.9)`, `border:1.5px solid ${color}88`,
      `box-shadow:0 4px 14px rgba(0,0,0,.5),0 0 12px ${color}33`,
      `color:${color}`, `font-family:${MONO.split(',')[0].replace(/'/g,'')},'SFMono-Regular',monospace`,
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

  function fitMap(coords) {
    const map = mapRef.current;
    if (!map) return;
    const allPts = [
      ...(dLat && dLng ? [[dLng, dLat]] : []),
      [activeTrip.pickupLng, activeTrip.pickupLat],
      ...(activeTrip.dropoffLng ? [[activeTrip.dropoffLng, activeTrip.dropoffLat]] : []),
      ...coords,
    ];
    if (!allPts.length) return;
    const minLng = Math.min(...allPts.map(p => p[0]));
    const maxLng = Math.max(...allPts.map(p => p[0]));
    const minLat = Math.min(...allPts.map(p => p[1]));
    const maxLat = Math.max(...allPts.map(p => p[1]));
    map.fitBounds([[minLng, minLat], [maxLng, maxLat]], {
      padding: { top: 110, bottom: 230, left: 60, right: 60 },
      maxZoom: 14, duration: 1200,
    });
  }

  function fitMapFallback() {
    const map = mapRef.current;
    if (!map) return;
    const pts = [];
    if (dLat && dLng) pts.push([dLng, dLat]);
    if (activeTrip?.pickupLat) pts.push([activeTrip.pickupLng, activeTrip.pickupLat]);
    if (!pts.length) return;
    if (pts.length === 1) { map.flyTo({ center: pts[0], zoom: 14, duration: 900 }); return; }
    const minLng = Math.min(...pts.map(p => p[0]));
    const maxLng = Math.max(...pts.map(p => p[0]));
    const minLat = Math.min(...pts.map(p => p[1]));
    const maxLat = Math.max(...pts.map(p => p[1]));
    map.fitBounds([[minLng, minLat], [maxLng, maxLat]], {
      padding: { top: 110, bottom: 230, left: 60, right: 60 },
      maxZoom: 14, duration: 1000,
    });
  }

  // ── cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => () => {
    [pickupMkrRef, dropoffMkrRef, driverMkrRef].forEach(r => {
      if (r.current) { try { r.current.remove(); } catch (e) {} }
    });
  }, []);

  // ── action handler ───────────────────────────────────────────────────────
  const handleAction = useCallback(async (action, rideId) => {
    if (!action || !rideId) return;
    setPending(true);
    setError(null);
    try {
      const res = await callUpdateTrip({ rideId, action });
      const newStatus = res.data?.status;
      setLocalStatus(newStatus);
      if (newStatus === 'completed') {
        setTimeout(() => onTripComplete?.(), 2800);
      }
    } catch (err) {
      console.error('[ActiveTripScreen] updateTripStatus:', err);
      const msg = err?.message || 'Something went wrong. Try again.';
      setError(msg);
    } finally {
      setPending(false);
    }
  }, [onTripComplete]);

  // ─── render ──────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes ats-spin      { to { transform:rotate(360deg); } }
        @keyframes ats-blink     { 0%,100%{opacity:1} 50%{opacity:.2} }
        @keyframes ats-slidedown { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ats-slideup   { from{opacity:0;transform:translateY(20px)}  to{opacity:1;transform:translateY(0)} }
        @keyframes ats-popin     { from{opacity:0;transform:scale(.55)} to{opacity:1;transform:scale(1)} }
        @keyframes ats-shimmer   {
          0%   { transform:translateX(-120%); }
          60%  { transform:translateX(120%);  }
          100% { transform:translateX(120%);  }
        }
      `}</style>

      <div style={{
        position: 'fixed', inset: 0,
        background: C.bg, overflow: 'hidden',
      }}>
        {/* ── full-screen mapbox canvas ── */}
        <div
          ref={containerRef}
          style={{ position: 'absolute', inset: 0 }}
        />

        {/* map loading spinner */}
        {!mapReady && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 12,
            background: C.bg,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              border: '2px solid rgba(34,197,94,.15)',
              borderTop: `2px solid ${C.green}`,
              animation: 'ats-spin .85s linear infinite',
            }}/>
            <span style={{
              fontFamily: MONO, fontSize: 11, fontWeight: 700,
              letterSpacing: '.1em', color: C.inkDim,
            }}>
              ACQUIRING MAP…
            </span>
          </div>
        )}

        {/* vignette */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 50% 42%, transparent 40%, rgba(3,6,4,.25) 80%, rgba(3,6,4,.6) 100%)',
        }}/>

        {/* top bar */}
        <TopBar
          statusLabel={stage.statusLabel}
          statusColor={stage.statusColor}
          rideId={activeTrip?.id}
          paymentMethod={activeTrip?.paymentMethod}
        />

        {riderAccount && (
          <div style={{
            position: 'absolute', top: 56, right: 14, zIndex: 29,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            animation: 'ats-slidedown .4s cubic-bezier(.34,1.2,.64,1) both',
            pointerEvents: 'none',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'linear-gradient(135deg, #8B5CF6 0%, #4C1D95 100%)',
              border: '2.5px solid rgba(255,255,255,.65)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: MONO, fontSize: 13, fontWeight: 800, color: '#fff',
              boxShadow: '0 4px 18px rgba(139,92,246,.65), 0 2px 6px rgba(0,0,0,.45)',
            }}>
              {getInitials(riderAccount.name)}
            </div>
            <div style={{
              fontFamily: COND, fontSize: 10, fontWeight: 800, letterSpacing: '.1em',
              color: 'rgba(255,255,255,.8)',
              background: 'rgba(2,4,3,.75)', backdropFilter: 'blur(8px)',
              borderRadius: 6, padding: '2px 6px',
              border: '1px solid rgba(139,92,246,.25)',
              maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              textAlign: 'center',
            }}>
              {riderAccount.name?.split(' ')[0] || '—'}
            </div>
          </div>
        )}

        {/* distance + payout pill */}
        {mapReady && (
          <InfoPill
            distMi={distToTarget !== null ? fmtMi(distToTarget) : '…'}
            payout={activeTrip?.driverPayout}
            status={status}
          />
        )}

        {/* bottom action sheet */}
        <ActionSheet
          trip={activeTrip}
          stage={status}
          distToTarget={distToTarget}
          onAction={handleAction}
          pending={pending}
          error={error}
          onDismissError={() => setError(null)}
        />
      </div>
    </>
  );
}
