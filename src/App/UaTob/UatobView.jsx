import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Activity } from 'lucide-react';
import { useAllDrivers } from "@/App/UaTob/useAllDrivers";

// ─────────────────────────────────────────────────────────────────────────────
// Geo helpers
// ─────────────────────────────────────────────────────────────────────────────
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

function statusInfo(status) {
  const s = (status || '').toLowerCase();
  if (s === 'online' || s === 'available') return { label: 'Online', color: '#22D3A5' };
  if (s === 'offline')                      return { label: 'Offline', color: '#475569' };
  return { label: 'Busy', color: '#60A5FA' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Trip / fare helpers
// ─────────────────────────────────────────────────────────────────────────────
function tripDotColor(status) {
  const s = (status || '').toLowerCase();
  if (s === 'completed')                                              return '#22D3A5';
  if (s === 'cancelled')                                              return '#475569';
  if (s === 'in_progress' || s === 'driver_assigned' || s === 'driver_arriving') return '#60A5FA';
  return '#94A3B8';
}

function timeAgo(ts) {
  if (!ts) return '';
  const d = ts?.toDate?.() ?? (ts instanceof Date ? ts : new Date(ts));
  if (!d || isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function shortPay(method) {
  if (!method) return null;
  const m = method.toLowerCase();
  if (m === 'card')       return 'Card';
  if (m === 'cashapp')    return 'Cash App';
  if (m === 'apple_pay')  return 'Apple Pay';
  if (m === 'google_pay') return 'GPay';
  return method;
}

// ─────────────────────────────────────────────────────────────────────────────
// UATOB dot-matrix letter slots
// ─────────────────────────────────────────────────────────────────────────────
const LETTER_SLOTS = (() => {
  const letters = {
    U: [[1,0,1],[1,0,1],[1,0,1],[1,0,1],[0,1,0]],
    A: [[0,1,0],[1,0,1],[1,1,1],[1,0,1],[1,0,1]],
    T: [[1,1,1],[0,1,0],[0,1,0],[0,1,0],[0,1,0]],
    O: [[0,1,0],[1,0,1],[1,0,1],[1,0,1],[0,1,0]],
    B: [[1,1,0],[1,0,1],[1,1,0],[1,0,1],[1,1,0]],
  };
  const slots = [];
  ['U','A','T','O','B'].forEach((key, li) => {
    const lx = 8 + li * 19;
    letters[key].forEach((row, ri) => {
      row.forEach((filled, ci) => {
        if (filled) slots.push({ x: lx + ci * 6, y: 18 + ri * 12 });
      });
    });
  });
  return slots;
})();

function buildConstellationLines(onlineCount) {
  if (onlineCount < 2) return [];
  const slots = LETTER_SLOTS.slice(0, Math.min(onlineCount, LETTER_SLOTS.length));
  return slots.slice(0, -1).map((s, i) => ({
    x1: s.x, y1: s.y, x2: slots[i + 1].x, y2: slots[i + 1].y,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const CARD_H   = 112; // px — shared height for both flip faces
const FLIP_MS  = 8000; // auto-flip interval

// ─────────────────────────────────────────────────────────────────────────────
// Global styles
// ─────────────────────────────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap');

  @keyframes pinBreathe {
    0%, 100% { transform: translate(-50%,-50%) scale(1);    filter: brightness(1); }
    50%       { transform: translate(-50%,-50%) scale(1.12); filter: brightness(1.3); }
  }
  @keyframes haloRipple {
    0%   { transform: translate(-50%,-50%) scale(0.6); opacity: 0.7; }
    80%  { transform: translate(-50%,-50%) scale(2.2); opacity: 0;   }
    100% { transform: translate(-50%,-50%) scale(2.2); opacity: 0;   }
  }
  @keyframes pinDrop {
    0%   { transform: translate(-50%,-50%) scale(0);    opacity: 0; }
    60%  { transform: translate(-50%,-50%) scale(1.18); opacity: 1; }
    100% { transform: translate(-50%,-50%) scale(1);    opacity: 1; }
  }
  @keyframes radarSweep {
    0%   { transform: translateX(-100%); opacity: 0;   }
    8%   { opacity: 0.55; }
    50%  { opacity: 0.55; }
    100% { transform: translateX(100%);  opacity: 0;   }
  }
  @keyframes liveDot {
    0%, 100% { opacity: 1; transform: scale(1);    }
    50%       { opacity: 0.4; transform: scale(.85); }
  }
  @keyframes constellationDraw {
    0%   { stroke-dashoffset: 100; opacity: 0;   }
    50%  { opacity: .4;                          }
    100% { stroke-dashoffset: 0;   opacity: .4; }
  }
  @keyframes bgFloat {
    0%, 100% { transform: translate(0, 0)        scale(1);    }
    50%       { transform: translate(20px, -15px) scale(1.08); }
  }
  @keyframes badgePulse {
    0%, 100% { box-shadow: 0 0 0 0    rgba(34,211,165,0);   }
    50%       { box-shadow: 0 0 0 10px rgba(34,211,165,.18); }
  }
  @keyframes fareReveal {
    0%   { opacity: 0; transform: translateY(-3px) scale(.88); }
    100% { opacity: 1; transform: none; }
  }
  @keyframes tripRowIn {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: none; }
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// DriversPanel  (front face)
// ─────────────────────────────────────────────────────────────────────────────
function DriversPanel({ counts }) {
  const onlinePct = counts.total > 0
    ? Math.round((counts.online / counts.total) * 100)
    : 0;

  return (
    <div style={{
      position: 'absolute', inset: 0,
      backfaceVisibility: 'hidden',
      WebkitBackfaceVisibility: 'hidden',
      background: 'rgba(255,255,255,.06)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,.1)',
      borderRadius: 16,
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
    }}>

      {/* ── Top row: fleet total + online ratio chip ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <div style={{
            fontSize: 9, fontWeight: 800, letterSpacing: '.12em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,.35)',
            marginBottom: 2,
          }}>
            Fleet
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
            <span style={{
              fontSize: 28, fontWeight: 900, color: '#fff',
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-.03em', lineHeight: 1,
            }}>
              {counts.total}
            </span>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,.35)' }}>
              drivers
            </span>
          </div>
        </div>

        {/* Online % chip */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '5px 10px', borderRadius: 99,
          background: counts.online > 0
            ? 'rgba(34,211,165,.12)'
            : 'rgba(255,255,255,.05)',
          border: `1px solid ${counts.online > 0
            ? 'rgba(34,211,165,.3)'
            : 'rgba(255,255,255,.08)'}`,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: counts.online > 0 ? '#22D3A5' : '#475569',
            boxShadow: counts.online > 0 ? '0 0 6px #22D3A5' : 'none',
            animation: counts.online > 0
              ? 'liveDot 1.6s ease-in-out infinite'
              : 'none',
          }}/>
          <span style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 11, fontWeight: 700,
            color: counts.online > 0 ? '#5EEAD4' : 'rgba(255,255,255,.3)',
          }}>
            {onlinePct}% live
          </span>
        </div>
      </div>

      {/* ── Bottom row: status pills ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <DarkPill color="#22D3A5" label="Online"  value={counts.online}  glow />
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,.1)' }}/>
        <DarkPill color="#A78BFA" label="Trips"   value={counts.trips}   />
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,.1)' }}/>
        <DarkPill color="#94A3B8" label="Offline" value={counts.offline} dim />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TripsPanel  (back face — rotateY(180deg))
// ─────────────────────────────────────────────────────────────────────────────
function TripsPanel({ trips, revealedFares, onToggleFare }) {
  const isEmpty = !trips || trips.length === 0;

  return (
    <div style={{
      position: 'absolute', inset: 0,
      backfaceVisibility: 'hidden',
      WebkitBackfaceVisibility: 'hidden',
      transform: 'rotateY(180deg)',
      background: 'rgba(255,255,255,.06)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,.1)',
      borderRadius: 16,
      padding: '10px 14px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 9, fontWeight: 800, letterSpacing: '.12em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,.4)',
          }}>
            Recent Trips
          </span>
          {trips.length > 0 && (
            <span style={{
              fontSize: 8, fontWeight: 800,
              color: 'rgba(167,139,250,.7)',
              background: 'rgba(167,139,250,.1)',
              border: '1px solid rgba(167,139,250,.2)',
              borderRadius: 4, padding: '1px 5px',
              fontFamily: '"JetBrains Mono", monospace',
            }}>
              {trips.length}
            </span>
          )}
        </div>
        <span style={{
          fontSize: 8, fontWeight: 600,
          color: 'rgba(255,255,255,.2)',
          letterSpacing: '.04em',
        }}>
          tap •••• to reveal
        </span>
      </div>

      {/* ── Trip rows ── */}
      {isEmpty ? (
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'rgba(255,255,255,.2)', fontSize: 11, fontWeight: 600,
        }}>
          No trips yet
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {trips.map((trip, i) => {
            const revealed    = revealedFares.has(trip.id);
            const isRefunded  = trip.paymentStatus === 'refunded'
                             || trip.autoRefundStatus === 'succeeded';
            const isCancelled = trip.status === 'cancelled';
            const dotColor    = tripDotColor(trip.status);
            const fare        = Number(trip.fareTotal ?? 0).toFixed(2);
            const pay         = shortPay(trip.paymentMethod);
            const ago         = timeAgo(trip.createdAt);
            const from        = trip.pickupCity
                             ?? trip.pickup?.split(',')[0]
                             ?? '—';
            const to          = trip.dropoffCity
                             ?? trip.dropoff?.split(',')[0]
                             ?? '—';

            return (
              <div
                key={trip.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  animation: `tripRowIn .3s ease ${i * 0.07}s both`,
                }}
              >
                {/* Status dot */}
                <div style={{
                  width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                  background: dotColor,
                  opacity: isCancelled ? 0.45 : 1,
                  boxShadow: isCancelled ? 'none' : `0 0 6px ${dotColor}bb`,
                }}/>

                {/* Route + meta */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    overflow: 'hidden',
                  }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, lineHeight: 1.2,
                      color: isCancelled ? 'rgba(255,255,255,.42)' : 'rgba(255,255,255,.82)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      maxWidth: 90,
                    }}>
                      {from}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,.2)', fontSize: 9, flexShrink: 0 }}>→</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, lineHeight: 1.2,
                      color: isCancelled ? 'rgba(255,255,255,.42)' : 'rgba(255,255,255,.82)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      maxWidth: 90,
                    }}>
                      {to}
                    </span>
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 4, marginTop: 2,
                  }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '.05em', color: 'rgba(255,255,255,.28)',
                    }}>
                      {trip.rideLabel ?? trip.rideType ?? 'Ride'}
                    </span>
                    {pay && (
                      <>
                        <span style={{ fontSize: 8, color: 'rgba(255,255,255,.14)' }}>·</span>
                        <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,.28)' }}>
                          {pay}
                        </span>
                      </>
                    )}
                    <span style={{ fontSize: 8, color: 'rgba(255,255,255,.14)' }}>·</span>
                    <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,.22)' }}>
                      {ago}
                    </span>
                  </div>
                </div>

                {/* Fare + badges */}
                <div style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'flex-end', gap: 3, flexShrink: 0,
                }}>
                  {/* Fare — dots until tapped */}
                  <button
                    onClick={e => { e.stopPropagation(); onToggleFare(trip.id); }}
                    title={revealed ? 'Hide fare' : 'Reveal fare'}
                    style={{
                      background: 'none', border: 'none',
                      padding: '1px 0', cursor: 'pointer',
                      fontFamily: revealed
                        ? '"JetBrains Mono", monospace'
                        : 'inherit',
                      fontSize:      revealed ? 12 : 13,
                      fontWeight:    800,
                      letterSpacing: revealed ? '-.02em' : '.18em',
                      lineHeight:    1,
                      color: revealed
                        ? '#5EEAD4'
                        : 'rgba(255,255,255,.28)',
                      animation: revealed ? 'fareReveal .2s ease both' : 'none',
                      transition: 'color .15s, letter-spacing .15s',
                    }}
                  >
                    {revealed ? `$${fare}` : '••••'}
                  </button>

                  {/* Fully Refunded badge */}
                  {isRefunded && (
                    <div style={{
                      fontSize: 7, fontWeight: 900,
                      letterSpacing: '.08em', textTransform: 'uppercase',
                      color: '#93C5FD',
                      background: 'rgba(96,165,250,.1)',
                      border: '1px solid rgba(96,165,250,.22)',
                      borderRadius: 4, padding: '2px 5px',
                      lineHeight: 1.4,
                      whiteSpace: 'nowrap',
                    }}>
                      Fully Refunded
                    </div>
                  )}

                  {/* Completed badge (non-refunded, non-cancelled) */}
                  {!isRefunded && !isCancelled && trip.status === 'completed' && (
                    <div style={{
                      fontSize: 7, fontWeight: 900,
                      letterSpacing: '.08em', textTransform: 'uppercase',
                      color: '#6EE7B7',
                      background: 'rgba(34,211,165,.08)',
                      border: '1px solid rgba(34,211,165,.18)',
                      borderRadius: 4, padding: '2px 5px',
                      lineHeight: 1.4,
                    }}>
                      Completed
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DarkPill
// ─────────────────────────────────────────────────────────────────────────────
function DarkPill({ color, label, value, glow, dim }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{
        width: 7, height: 7, borderRadius: '50%',
        background: color, flexShrink: 0,
        opacity: dim ? .6 : 1,
        boxShadow: glow ? `0 0 6px ${color}` : 'none',
      }}/>
      <span style={{
        fontSize: 14, fontWeight: 800,
        color: dim ? 'rgba(255,255,255,.55)' : '#fff',
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-.02em', lineHeight: 1,
      }}>
        {value}
      </span>
      <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,.55)' }}>
        {label}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function UatobView({ trips }) {
  const { drivers, loading } = useAllDrivers();

  // ── Flip state ──
  const [flipped, setFlipped]             = useState(false);
  const [revealedFares, setRevealedFares] = useState(new Set());
  const flipTimerRef = useRef(null);

  const resetFlipTimer = useCallback(() => {
    clearInterval(flipTimerRef.current);
    flipTimerRef.current = setInterval(
      () => setFlipped(f => !f),
      FLIP_MS,
    );
  }, []);

  useEffect(() => {
    resetFlipTimer();
    return () => clearInterval(flipTimerRef.current);
  }, [resetFlipTimer]);

  const handleFlip = useCallback(() => {
    setFlipped(f => !f);
    resetFlipTimer();
  }, [resetFlipTimer]);

  const goFace = useCallback((face) => {
    setFlipped(face);
    resetFlipTimer();
  }, [resetFlipTimer]);

  const toggleFare = useCallback((id) => {
    setRevealedFares(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // ── Driver pins ──
  const driverPins = useMemo(() => drivers.map(d => {
    const hasGps = Number.isFinite(Number(d.lat)) && Number.isFinite(Number(d.lng));
    const pos    = hasGps
      ? latLngToPct(Number(d.lat), Number(d.lng))
      : addressToCoords(d.city || d.email || d.id);
    const info   = statusInfo(d.status);
    return {
      id:     d.id,
      name:   d.firstName ? `${d.firstName} ${d.lastName}` : 'Driver',
      status: d.status || 'offline',
      pos,
      color:  info.color,
      label:  info.label,
    };
  }), [drivers]);

  const onlinePins  = useMemo(() => driverPins.filter(d => d.label === 'Online'), [driverPins]);
  const offlinePins = useMemo(() => driverPins.filter(d => d.label !== 'Online'), [driverPins]);

  const counts = useMemo(() => {
    const online    = onlinePins.length;
    const offline   = driverPins.filter(d => d.label === 'Offline').length;
    const tripCount = Array.isArray(trips) ? trips.length : 0;
    return { total: driverPins.length, online, offline, trips: tripCount };
  }, [driverPins, onlinePins, trips]);

  const constellationLines = useMemo(
    () => buildConstellationLines(onlinePins.length),
    [onlinePins.length],
  );

  // ── Recent trips (sorted newest-first, max 3) ──
  const recentTrips = useMemo(() => {
    if (!Array.isArray(trips)) return [];
    return [...trips]
      .sort((a, b) => {
        const ta = a.createdAt?.toDate?.()?.getTime?.() ?? 0;
        const tb = b.createdAt?.toDate?.()?.getTime?.() ?? 0;
        return tb - ta;
      })
      .slice(0, 3);
  }, [trips]);

  const hasOnline = counts.online > 0;

  // ── Face accent colors ──
  const faceColor = flipped ? '#A78BFA' : '#22D3A5';

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{STYLES}</style>

      <div style={{
        position:     'relative',
        height:       'clamp(260px, 40vh, 320px)',
        borderRadius: '24px',
        overflow:     'hidden',
        background:   'linear-gradient(155deg, #0A1628 0%, #0E2540 35%, #103848 75%, #0F4C45 100%)',
        boxShadow:    '0 16px 48px rgba(10,22,40,.22), 0 2px 6px rgba(10,22,40,.08)',
        fontFamily:   'Outfit, system-ui, sans-serif',
      }}>

        {/* ── Ambient blobs ── */}
        <div style={{
          position: 'absolute', top: -80, right: -80,
          width: 280, height: 280, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(34,211,165,.32) 0%, transparent 70%)',
          filter: 'blur(40px)',
          animation: 'bgFloat 8s ease-in-out infinite',
          pointerEvents: 'none', zIndex: 1,
        }}/>
        <div style={{
          position: 'absolute', bottom: -60, left: -60,
          width: 240, height: 240, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(96,165,250,.22) 0%, transparent 70%)',
          filter: 'blur(36px)',
          animation: 'bgFloat 10s ease-in-out infinite reverse',
          pointerEvents: 'none', zIndex: 1,
        }}/>

        {/* ── Dot grid ── */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2, opacity: .15 }}>
          <defs>
            <pattern id="mv-dotgrid" width="36" height="36" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r=".8" fill="rgba(255,255,255,.5)"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#mv-dotgrid)"/>
        </svg>

        {/* ── Constellation lines ── */}
        {constellationLines.length > 0 && (
          <svg style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            zIndex: 3, pointerEvents: 'none',
          }}>
            {constellationLines.map((ln, i) => (
              <line
                key={i}
                x1={`${ln.x1}%`} y1={`${ln.y1}%`}
                x2={`${ln.x2}%`} y2={`${ln.y2}%`}
                stroke="rgba(34,211,165,.5)"
                strokeWidth="1"
                strokeDasharray="3 4"
                style={{
                  strokeDashoffset: 100,
                  animation: `constellationDraw 1.6s ease-out ${0.4 + i * 0.06}s forwards`,
                }}
              />
            ))}
          </svg>
        )}

        {/* ── Radar sweep ── */}
        <div style={{
          position: 'absolute', inset: 0,
          zIndex: 4, pointerEvents: 'none', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: 0, bottom: 0, width: '40%',
            background: 'linear-gradient(90deg, transparent 0%, rgba(34,211,165,.16) 50%, transparent 100%)',
            animation: 'radarSweep 6s ease-in-out infinite',
            animationDelay: '1.5s',
          }}/>
        </div>

        {/* ── Top-left trust badge ── */}
        {!loading && (
          <div style={{
            position: 'absolute', top: 14, left: 14, zIndex: 20,
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '7px 12px',
            background: hasOnline ? 'rgba(34,211,165,.14)' : 'rgba(148,163,184,.14)',
            border: `1px solid ${hasOnline ? 'rgba(34,211,165,.4)' : 'rgba(148,163,184,.3)'}`,
            borderRadius: 99,
            backdropFilter: 'blur(12px)',
            animation: hasOnline ? 'badgePulse 2.4s ease-in-out infinite' : 'none',
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: hasOnline ? '#22D3A5' : '#94A3B8',
              boxShadow: hasOnline ? '0 0 8px #22D3A5' : 'none',
              animation: hasOnline ? 'liveDot 1.6s ease-in-out infinite' : 'none',
            }}/>
            <span style={{
              fontSize: 11, fontWeight: 800, letterSpacing: '.06em',
              color: hasOnline ? '#5EEAD4' : '#CBD5E1',
              textTransform: 'uppercase',
            }}>
              {hasOnline ? `${counts.online} nearby` : 'Drivers offline'}
            </span>
          </div>
        )}

        {/* ── Top-right LIVE badge ── */}
        <div style={{
          position: 'absolute', top: 14, right: 14, zIndex: 20,
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 10px',
          background: 'rgba(255,255,255,.06)',
          border: '1px solid rgba(255,255,255,.1)',
          borderRadius: 10,
          backdropFilter: 'blur(12px)',
        }}>
          <Activity size={11} color="#5EEAD4"/>
          <span style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 10, fontWeight: 700,
            color: 'rgba(255,255,255,.7)',
            letterSpacing: '.05em',
          }}>LIVE</span>
        </div>

        {/* ── Loading overlay ── */}
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 30,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(10,22,40,.6)', backdropFilter: 'blur(8px)',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 18px', borderRadius: 99,
              background: 'rgba(255,255,255,.08)',
              border: '1px solid rgba(255,255,255,.14)',
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: '#22D3A5',
                animation: 'liveDot 1.2s ease-in-out infinite',
              }}/>
              <span style={{
                fontSize: 11, fontWeight: 800, color: '#fff',
                letterSpacing: '.1em', textTransform: 'uppercase',
              }}>
                Scanning your area…
              </span>
            </div>
          </div>
        )}

        {/* ── Offline / busy pins ── */}
        {offlinePins.map(d => (
          <div
            key={d.id}
            title={`${d.name} · ${d.label}`}
            style={{
              position: 'absolute',
              left: `${d.pos.x}%`, top: `${d.pos.y}%`,
              transform: 'translate(-50%,-50%)',
              zIndex: 5,
              opacity: d.label === 'Busy' ? 0.7 : 0.28,
            }}
          >
            <div style={{
              width: '11px', height: '11px',
              background: d.color, borderRadius: '50%',
              border: '1.5px solid rgba(255,255,255,.5)',
              boxShadow: d.label === 'Busy' ? `0 0 8px ${d.color}aa` : 'none',
            }}/>
          </div>
        ))}

        {/* ── Online pins — letter slots ── */}
        {onlinePins.map((d, i) => {
          const slot = LETTER_SLOTS[i % LETTER_SLOTS.length];
          return (
            <React.Fragment key={d.id}>
              <div style={{
                position: 'absolute',
                left: `${slot.x}%`, top: `${slot.y}%`,
                width: 24, height: 24,
                borderRadius: '50%',
                border: '1.5px solid rgba(94,234,212,.5)',
                pointerEvents: 'none', zIndex: 6,
                animation: `haloRipple 2.4s ease-out ${i * 0.15}s infinite`,
              }}/>
              <div
                title={`${d.name} · Online`}
                style={{
                  position: 'absolute',
                  left: `${slot.x}%`, top: `${slot.y}%`,
                  zIndex: 7,
                  animation: `pinDrop .55s cubic-bezier(.34,1.56,.64,1) ${i * 0.06}s both,
                               pinBreathe 3.2s ease-in-out ${0.6 + i * 0.12}s infinite`,
                }}
              >
                <div style={{
                  width: 14, height: 14,
                  background: 'radial-gradient(circle, #5EEAD4 0%, #14B8A6 100%)',
                  borderRadius: '50%',
                  border: '2px solid #ECFDF5',
                  boxShadow: '0 0 16px rgba(94,234,212,.65), 0 2px 6px rgba(0,0,0,.3)',
                }}/>
              </div>
            </React.Fragment>
          );
        })}

        {/* ══════════════════════════════════════════
            Bottom flip card section
        ══════════════════════════════════════════ */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          zIndex: 15,
          background: 'linear-gradient(180deg, transparent 0%, rgba(10,22,40,.88) 30%, rgba(10,22,40,.97) 100%)',
          padding: '28px 14px 14px',
        }}>

          {/* ── Face indicator dots + flip label ── */}
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}>
            {/* Dots */}
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              {[false, true].map((face, i) => (
                <button
                  key={i}
                  onClick={() => goFace(face)}
                  style={{
                    width: flipped === face ? 18 : 6,
                    height: 6, borderRadius: 3,
                    background: flipped === face
                      ? faceColor
                      : 'rgba(255,255,255,.18)',
                    border: 'none', padding: 0,
                    cursor: 'pointer',
                    transition: 'all .3s ease',
                    flexShrink: 0,
                  }}
                />
              ))}
            </div>

            {/* Flip label button */}
            <button
              onClick={handleFlip}
              style={{
                fontSize: 9, fontWeight: 800, letterSpacing: '.1em',
                textTransform: 'uppercase',
                color: flipped
                  ? 'rgba(167,139,250,.65)'
                  : 'rgba(34,211,165,.65)',
                background: 'none', border: 'none',
                cursor: 'pointer', padding: '2px 4px',
                display: 'flex', alignItems: 'center', gap: 4,
                transition: 'color .3s',
              }}
            >
              {flipped ? '← Drivers' : 'Trips →'}
            </button>
          </div>

          {/* ── 3D flip card ── */}
          <div
            style={{ perspective: '900px', cursor: 'pointer' }}
            onClick={handleFlip}
          >
            <div style={{
              position: 'relative',
              height: CARD_H,
              transformStyle: 'preserve-3d',
              WebkitTransformStyle: 'preserve-3d',
              transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              transition: 'transform 0.65s cubic-bezier(0.4, 0, 0.2, 1)',
            }}>
              <DriversPanel counts={counts} />
              <TripsPanel
                trips={recentTrips}
                revealedFares={revealedFares}
                onToggleFare={toggleFare}
              />
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
