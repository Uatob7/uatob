import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  Car, Activity, MapPin, CreditCard, Banknote, Smartphone,
  CheckCircle2, ShieldCheck, RotateCcw, Clock, ArrowRight,
  Wallet,
} from 'lucide-react';
import { useAllDrivers } from "@/App/UaTob/useAllDrivers";

// ─── BOUNDS / coords ──────────────────────────────────────────────────
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

// UATOB letter dot-matrix positions (unchanged)
const LETTER_SLOTS = (() => {
  const letters = {
    U: [[1,0,1],[1,0,1],[1,0,1],[1,0,1],[0,1,0]],
    A: [[0,1,0],[1,0,1],[1,1,1],[1,0,1],[1,0,1]],
    T: [[1,1,1],[0,1,0],[0,1,0],[0,1,0],[0,1,0]],
    O: [[0,1,0],[1,0,1],[1,0,1],[1,0,1],[0,1,0]],
    B: [[1,1,0],[1,0,1],[1,1,0],[1,0,1],[1,1,0]],
  };
  const slots = [];
  const keys = ['U','A','T','O','B'];
  const startX = 8, colStep = 6, letterW = 19, startY = 18, rowStep = 12;
  keys.forEach((key, li) => {
    letters[key].forEach((row, ri) => {
      row.forEach((filled, ci) => {
        if (filled) slots.push({ x: startX + li * letterW + ci * colStep, y: startY + ri * rowStep });
      });
    });
  });
  return slots;
})();

function buildConstellationLines(onlineCount) {
  if (onlineCount < 2) return [];
  const slots = LETTER_SLOTS.slice(0, Math.min(onlineCount, LETTER_SLOTS.length));
  const lines = [];
  for (let i = 0; i < slots.length - 1; i++) {
    lines.push({ x1: slots[i].x, y1: slots[i].y, x2: slots[i + 1].x, y2: slots[i + 1].y });
  }
  return lines;
}

// ─── TRIP HELPERS ─────────────────────────────────────────────────────
function tsToMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts.seconds) return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  return 0;
}

function fmtRelative(ms) {
  if (!ms) return '—';
  const diff = Math.floor((Date.now() - ms) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function shortAddr(addr) {
  if (!addr) return '—';
  return addr.split(',')[0].trim();
}

// Returns { label, color, bg, Icon } based on payment method
function paymentInfo(method) {
  const m = (method || '').toLowerCase();
  if (m === 'card')      return { label: 'Card',      color: '#60A5FA', bg: 'rgba(96,165,250,.14)',  border: 'rgba(96,165,250,.32)', Icon: CreditCard };
  if (m === 'cashapp')   return { label: 'Cash App',  color: '#86EFAC', bg: 'rgba(134,239,172,.14)', border: 'rgba(134,239,172,.32)', Icon: Smartphone };
  if (m === 'cash')      return { label: 'Cash',      color: '#FCD34D', bg: 'rgba(252,211,77,.14)',  border: 'rgba(252,211,77,.32)',  Icon: Banknote };
  if (m === 'apple_pay') return { label: 'Apple Pay', color: '#E5E7EB', bg: 'rgba(229,231,235,.14)', border: 'rgba(229,231,235,.32)', Icon: Wallet };
  if (m === 'google_pay')return { label: 'Google Pay',color: '#F87171', bg: 'rgba(248,113,113,.14)', border: 'rgba(248,113,113,.32)', Icon: Wallet };
  return { label: 'Payment', color: '#94A3B8', bg: 'rgba(148,163,184,.14)', border: 'rgba(148,163,184,.3)', Icon: Wallet };
}

// Returns { label, copy, accent, Icon } describing the trip's outcome
function tripOutcome(trip) {
  const status = (trip?.status || '').toLowerCase();
  const ps     = (trip?.paymentStatus || '').toLowerCase();
  const cancelReason = trip?.cancelReason || '';

  if (status === 'completed') {
    return {
      label:  'Completed',
      copy:   'Paid in full',
      accent: '#22D3A5',
      bg:     'rgba(34,211,165,.10)',
      border: 'rgba(34,211,165,.28)',
      Icon:   CheckCircle2,
    };
  }
  if (status === 'cancelled' && ps === 'refunded') {
    return {
      label:  'Fully refunded',
      copy:   cancelReason === 'timeout_auto_cancel'
              ? "No match — we refunded automatically"
              : 'Refunded in full to your card',
      accent: '#5EEAD4',
      bg:     'rgba(94,234,212,.10)',
      border: 'rgba(94,234,212,.28)',
      Icon:   ShieldCheck,
    };
  }
  if (status === 'cancelled') {
    return {
      label:  'Cancelled',
      copy:   'Ride did not proceed',
      accent: '#CBD5E1',
      bg:     'rgba(203,213,225,.08)',
      border: 'rgba(203,213,225,.22)',
      Icon:   RotateCcw,
    };
  }
  if (status === 'pending_payment') {
    return {
      label:  'Awaiting payment',
      copy:   'Payment in progress',
      accent: '#FBBF24',
      bg:     'rgba(251,191,36,.10)',
      border: 'rgba(251,191,36,.28)',
      Icon:   Clock,
    };
  }
  if (status === 'searching_driver' || status === 'searching') {
    return {
      label:  'Searching',
      copy:   'Looking for a driver',
      accent: '#60A5FA',
      bg:     'rgba(96,165,250,.10)',
      border: 'rgba(96,165,250,.28)',
      Icon:   Activity,
    };
  }
  return {
    label:  status || 'In progress',
    copy:   'In progress',
    accent: '#94A3B8',
    bg:     'rgba(148,163,184,.10)',
    border: 'rgba(148,163,184,.24)',
    Icon:   Car,
  };
}

// Render a number as horizontal dots — hides the actual digits while
// communicating magnitude. 5 dots max; min 1 dot when value > 0.
function MagnitudeDots({ value, max = 5, color = '#5EEAD4' }) {
  const n = Math.max(0, Math.min(max, Math.ceil(Number(value) || 0)));
  return (
    <div style={{ display: 'inline-flex', gap: 3 }}>
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} style={{
          width: 5, height: 5, borderRadius: '50%',
          background: i < n ? color : 'rgba(255,255,255,.12)',
          boxShadow: i < n ? `0 0 4px ${color}88` : 'none',
        }}/>
      ))}
    </div>
  );
}

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap');

  @keyframes pinBreathe { 0%,100% { transform: translate(-50%,-50%) scale(1); filter: brightness(1); } 50% { transform: translate(-50%,-50%) scale(1.12); filter: brightness(1.3); } }
  @keyframes haloRipple { 0% { transform: translate(-50%,-50%) scale(0.6); opacity: 0.7; } 80% { transform: translate(-50%,-50%) scale(2.2); opacity: 0; } 100% { transform: translate(-50%,-50%) scale(2.2); opacity: 0; } }
  @keyframes pinDrop    { 0% { transform: translate(-50%,-50%) scale(0); opacity: 0; } 60% { transform: translate(-50%,-50%) scale(1.18); opacity: 1; } 100% { transform: translate(-50%,-50%) scale(1); opacity: 1; } }
  @keyframes radarSweep { 0% { transform: translateX(-100%); opacity: 0; } 8% { opacity: 0.55; } 50% { opacity: 0.55; } 100% { transform: translateX(100%); opacity: 0; } }
  @keyframes liveDot    { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(.85); } }
  @keyframes constellationDraw { 0% { stroke-dashoffset: 100; opacity: 0; } 50% { opacity: .4; } 100% { stroke-dashoffset: 0; opacity: .4; } }
  @keyframes bgFloat    { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(20px,-15px) scale(1.08); } }
  @keyframes badgePulse { 0%,100% { box-shadow: 0 0 0 0 rgba(34,211,165,0); } 50% { box-shadow: 0 0 0 10px rgba(34,211,165,.18); } }
  @keyframes slideIn    { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes tickIn     { 0% { transform: scale(0); opacity: 0; } 60% { transform: scale(1.18); } 100% { transform: scale(1); opacity: 1; } }
`;

// ═══════════════════════════════════════════════════════════════════════
// FRONT FACE — Driver constellation map (preserves your existing design)
// ═══════════════════════════════════════════════════════════════════════
function DriverFace({ driverPins, onlinePins, offlinePins, counts, constellationLines, loading, hasOnline, tripsCount }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      borderRadius: 24, overflow: 'hidden',
      background: 'linear-gradient(155deg, #0A1628 0%, #0E2540 35%, #103848 75%, #0F4C45 100%)',
    }}>
      {/* Ambient blobs */}
      <div style={{ position: 'absolute', top: -80, right: -80, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,211,165,.32) 0%, transparent 70%)', filter: 'blur(40px)', animation: 'bgFloat 8s ease-in-out infinite', pointerEvents: 'none', zIndex: 1 }}/>
      <div style={{ position: 'absolute', bottom: -60, left: -60, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, rgba(96,165,250,.22) 0%, transparent 70%)', filter: 'blur(36px)', animation: 'bgFloat 10s ease-in-out infinite reverse', pointerEvents: 'none', zIndex: 1 }}/>

      {/* Dot grid */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2, opacity: .15 }}>
        <defs>
          <pattern id="mv-dotgrid" width="36" height="36" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r=".8" fill="rgba(255,255,255,.5)"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#mv-dotgrid)"/>
      </svg>

      {/* Constellation */}
      {constellationLines.length > 0 && (
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 3, pointerEvents: 'none' }}>
          {constellationLines.map((ln, i) => (
            <line key={i}
              x1={`${ln.x1}%`} y1={`${ln.y1}%`} x2={`${ln.x2}%`} y2={`${ln.y2}%`}
              stroke="rgba(34,211,165,.5)" strokeWidth="1" strokeDasharray="3 4"
              style={{ strokeDashoffset: 100, animation: `constellationDraw 1.6s ease-out ${0.4 + i * 0.06}s forwards` }}
            />
          ))}
        </svg>
      )}

      {/* Radar sweep */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, width: '40%', background: 'linear-gradient(90deg, transparent 0%, rgba(34,211,165,.16) 50%, transparent 100%)', animation: 'radarSweep 6s ease-in-out infinite', animationDelay: '1.5s' }}/>
      </div>

      {/* Top-left badge */}
      {!loading && (
        <div style={{ position: 'absolute', top: 14, left: 14, zIndex: 20, display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px', background: hasOnline ? 'rgba(34,211,165,.14)' : 'rgba(148,163,184,.14)', border: `1px solid ${hasOnline ? 'rgba(34,211,165,.4)' : 'rgba(148,163,184,.3)'}`, borderRadius: 99, backdropFilter: 'blur(12px)', animation: hasOnline ? 'badgePulse 2.4s ease-in-out infinite' : 'none' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: hasOnline ? '#22D3A5' : '#94A3B8', boxShadow: hasOnline ? '0 0 8px #22D3A5' : 'none', animation: hasOnline ? 'liveDot 1.6s ease-in-out infinite' : 'none' }}/>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em', color: hasOnline ? '#5EEAD4' : '#CBD5E1', textTransform: 'uppercase' }}>
            {hasOnline ? `${counts.online} nearby` : 'Drivers offline'}
          </span>
        </div>
      )}

      {/* Top-right LIVE */}
      <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 20, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, backdropFilter: 'blur(12px)' }}>
        <Activity size={11} color="#5EEAD4" />
        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.7)', letterSpacing: '.05em' }}>LIVE</span>
      </div>

      {/* Loading overlay */}
      {loading && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,22,40,.6)', backdropFilter: 'blur(8px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderRadius: 99, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.14)' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22D3A5', animation: 'liveDot 1.2s ease-in-out infinite' }}/>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: '.1em', textTransform: 'uppercase' }}>Scanning your area…</span>
          </div>
        </div>
      )}

      {/* Offline pins */}
      {offlinePins.map(d => (
        <div key={d.id} title={`${d.name} · ${d.label}`}
          style={{ position: 'absolute', left: `${d.pos.x}%`, top: `${d.pos.y}%`, transform: 'translate(-50%,-50%)', zIndex: 5, opacity: d.label === 'Busy' ? 0.7 : 0.28 }}>
          <div style={{ width: '11px', height: '11px', background: d.color, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,.5)', boxShadow: d.label === 'Busy' ? `0 0 8px ${d.color}aa` : 'none' }}/>
        </div>
      ))}

      {/* Online pins (constellation) */}
      {onlinePins.map((d, i) => {
        const slot = LETTER_SLOTS[i % LETTER_SLOTS.length];
        return (
          <React.Fragment key={d.id}>
            <div style={{ position: 'absolute', left: `${slot.x}%`, top: `${slot.y}%`, width: 24, height: 24, borderRadius: '50%', border: '1.5px solid rgba(94,234,212,.5)', pointerEvents: 'none', zIndex: 6, animation: `haloRipple 2.4s ease-out ${i * 0.15}s infinite` }}/>
            <div title={`${d.name} · Online`}
              style={{ position: 'absolute', left: `${slot.x}%`, top: `${slot.y}%`, zIndex: 7, animation: `pinDrop .55s cubic-bezier(.34,1.56,.64,1) ${i * 0.06}s both, pinBreathe 3.2s ease-in-out ${0.6 + i * 0.12}s infinite` }}>
              <div style={{ width: 14, height: 14, background: 'radial-gradient(circle, #5EEAD4 0%, #14B8A6 100%)', borderRadius: '50%', border: '2px solid #ECFDF5', boxShadow: '0 0 16px rgba(94,234,212,.65), 0 2px 6px rgba(0,0,0,.3)' }}/>
            </div>
          </React.Fragment>
        );
      })}

      {/* Bottom strip */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 15, background: 'linear-gradient(180deg, rgba(10,22,40,.0) 0%, rgba(10,22,40,.85) 35%, rgba(10,22,40,.95) 100%)', padding: '24px 16px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,.06)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 16, padding: '11px 14px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.1em', color: 'rgba(255,255,255,.45)', textTransform: 'uppercase' }}>Drivers</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em', lineHeight: 1 }}>{counts.total}</span>
          </div>
          <div style={{ width: 1, height: 26, background: 'rgba(255,255,255,.1)' }}/>
          <DarkPill color="#22D3A5" label="Online"  value={counts.online}  glow />
          <DarkPill color="#A78BFA" label="Trips"   value={tripsCount}     />
          <DarkPill color="#94A3B8" label="Offline" value={counts.offline} dim />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// BACK FACE — Recent trips deck
// ═══════════════════════════════════════════════════════════════════════
function TripFace({ trips, counts, tripsCount }) {
  // Sort trips newest first
  const sortedTrips = useMemo(() => {
    return [...(trips || [])].sort((a, b) =>
      tsToMillis(b.createdAt) - tsToMillis(a.createdAt)
    );
  }, [trips]);

  const completedCount = sortedTrips.filter(t => (t.status || '').toLowerCase() === 'completed').length;
  const refundedCount  = sortedTrips.filter(t =>
    (t.status || '').toLowerCase() === 'cancelled' &&
    (t.paymentStatus || '').toLowerCase() === 'refunded'
  ).length;

  return (
    <div style={{
      position: 'absolute', inset: 0,
      borderRadius: 24, overflow: 'hidden',
      background: 'linear-gradient(155deg, #0F0A1E 0%, #160F2C 35%, #1A1338 75%, #221547 100%)',
    }}>
      {/* Ambient blobs — purple/pink, distinct from front face */}
      <div style={{ position: 'absolute', top: -80, left: -80, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(167,139,250,.28) 0%, transparent 70%)', filter: 'blur(40px)', animation: 'bgFloat 9s ease-in-out infinite', pointerEvents: 'none', zIndex: 1 }}/>
      <div style={{ position: 'absolute', bottom: -60, right: -60, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, rgba(244,114,182,.20) 0%, transparent 70%)', filter: 'blur(36px)', animation: 'bgFloat 11s ease-in-out infinite reverse', pointerEvents: 'none', zIndex: 1 }}/>

      {/* Dot grid */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 2, opacity: .12 }}>
        <defs>
          <pattern id="tf-dotgrid" width="36" height="36" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r=".8" fill="rgba(255,255,255,.5)"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#tf-dotgrid)"/>
      </svg>

      {/* Top-left label */}
      <div style={{ position: 'absolute', top: 14, left: 14, zIndex: 20, display: 'flex', alignItems: 'center', gap: 7, padding: '7px 12px', background: 'rgba(167,139,250,.14)', border: '1px solid rgba(167,139,250,.32)', borderRadius: 99, backdropFilter: 'blur(12px)' }}>
        <Activity size={11} color="#C4B5FD" />
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.06em', color: '#DDD6FE', textTransform: 'uppercase' }}>
          Recent rides
        </span>
      </div>

      {/* Top-right brand */}
      <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 20, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, backdropFilter: 'blur(12px)' }}>
        <Car size={11} color="#C4B5FD"/>
        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.7)', letterSpacing: '.05em' }}>HISTORY</span>
      </div>

      {/* Empty state */}
      {sortedTrips.length === 0 ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 5 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(167,139,250,.1)', border: '1px solid rgba(167,139,250,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Car size={20} color="#C4B5FD"/>
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'rgba(255,255,255,.9)', marginBottom: 4 }}>No rides yet</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', textAlign: 'center', maxWidth: 240 }}>
            Your trip history will appear here after your first ride.
          </div>
        </div>
      ) : (
        <>
          {/* Scrollable trip cards */}
          <div style={{
            position: 'absolute', top: 56, left: 12, right: 12, bottom: 78,
            zIndex: 5, overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: 8,
            scrollbarWidth: 'none',
          }}>
            <style>{`.tf-scroll::-webkit-scrollbar { display: none; }`}</style>
            {sortedTrips.slice(0, 6).map((trip, i) => (
              <TripCard key={trip.id || i} trip={trip} index={i}/>
            ))}
          </div>

          {/* Bottom strip — trip stats */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 15, background: 'linear-gradient(180deg, rgba(15,10,30,.0) 0%, rgba(15,10,30,.85) 35%, rgba(15,10,30,.95) 100%)', padding: '24px 16px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,.06)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 16, padding: '11px 14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.1em', color: 'rgba(255,255,255,.45)', textTransform: 'uppercase' }}>Activity</span>
                <MagnitudeDots value={tripsCount} max={5} color="#C4B5FD"/>
              </div>
              <div style={{ width: 1, height: 26, background: 'rgba(255,255,255,.1)' }}/>
              <DarkPill color="#22D3A5" label="Completed" value={completedCount} glow={completedCount > 0} />
              <DarkPill color="#5EEAD4" label="Refunded"  value={refundedCount}  />
              <DarkPill color="#C4B5FD" label="Total"     value={tripsCount}     />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Single trip card ────────────────────────────────────────────────
function TripCard({ trip, index }) {
  const outcome = tripOutcome(trip);
  const pay     = paymentInfo(trip.paymentMethod);
  const OutIcon = outcome.Icon;
  const PayIcon = pay.Icon;

  return (
    <div style={{
      background: 'rgba(255,255,255,.04)',
      border: '1px solid rgba(255,255,255,.08)',
      borderRadius: 14, padding: '11px 12px',
      animation: `slideIn .35s ease ${index * .06}s both`,
      backdropFilter: 'blur(8px)',
    }}>
      {/* Top row: status + payment + time */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '3px 8px', borderRadius: 99,
          background: outcome.bg,
          border: `1px solid ${outcome.border}`,
        }}>
          <OutIcon size={10} color={outcome.accent} strokeWidth={2.4}/>
          <span style={{ fontSize: 10, fontWeight: 800, color: outcome.accent, letterSpacing: '.03em' }}>
            {outcome.label}
          </span>
        </div>

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '3px 8px', borderRadius: 99,
          background: pay.bg,
          border: `1px solid ${pay.border}`,
        }}>
          <PayIcon size={9} color={pay.color} strokeWidth={2.4}/>
          <span style={{ fontSize: 10, fontWeight: 700, color: pay.color, letterSpacing: '.02em' }}>
            {pay.label}
          </span>
        </div>

        <div style={{ marginLeft: 'auto', fontFamily: '"JetBrains Mono", monospace', fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,.35)' }}>
          {fmtRelative(tsToMillis(trip.createdAt))}
        </div>
      </div>

      {/* Middle: route */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4, flexShrink: 0 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#5EEAD4' }}/>
          <div style={{ width: 1, flex: 1, minHeight: 14, background: 'linear-gradient(to bottom, rgba(94,234,212,.4), rgba(167,139,250,.4))', margin: '2px 0' }}/>
          <div style={{ width: 6, height: 6, borderRadius: 1.5, background: '#C4B5FD', transform: 'rotate(45deg)' }}/>
        </div>
        <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.88)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4, lineHeight: 1.3 }}>
            {shortAddr(trip.pickup)}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
            {shortAddr(trip.dropoff)}
          </div>
        </div>
      </div>

      {/* Bottom: outcome copy + magnitude dots (hides the actual dollar value) */}
      <div style={{
        marginTop: 10, paddingTop: 9,
        borderTop: '1px solid rgba(255,255,255,.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
      }}>
        <div style={{ fontSize: 11, color: outcome.accent, fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {outcome.copy}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.08em', color: 'rgba(255,255,255,.32)', textTransform: 'uppercase' }}>
            Fare
          </span>
          <MagnitudeDots
            value={Math.min(5, Math.ceil((trip.fareTotal ?? 0) / 10))}
            color={outcome.accent}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Bottom pill helper ──────────────────────────────────────────────
function DarkPill({ color, label, value, glow, dim }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div style={{
        width: 7, height: 7, borderRadius: '50%', background: color,
        boxShadow: glow ? `0 0 6px ${color}` : 'none',
        opacity: dim ? .6 : 1, flexShrink: 0,
      }}/>
      <span style={{
        fontSize: 14, fontWeight: 800,
        color: dim ? 'rgba(255,255,255,.55)' : '#fff',
        fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em', lineHeight: 1,
      }}>
        {value}
      </span>
      <span style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,.55)' }}>
        {label}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN — flip card container
// ═══════════════════════════════════════════════════════════════════════
export default function UatobView({ trips }) {
  const { drivers, loading } = useAllDrivers();
  const [face, setFace] = useState('drivers'); // 'drivers' | 'trips'
  const flipTimerRef = useRef(null);

  const driverPins = useMemo(() => drivers.map(d => {
    const hasGps = Number.isFinite(Number(d.lat)) && Number.isFinite(Number(d.lng));
    const pos = hasGps
      ? latLngToPct(Number(d.lat), Number(d.lng))
      : addressToCoords(d.city || d.email || d.id);
    const info = statusInfo(d.status);
    return {
      id: d.id,
      name: d.firstName ? `${d.firstName} ${d.lastName}` : 'Driver',
      status: d.status || 'offline',
      pos, color: info.color, label: info.label,
    };
  }), [drivers]);

  const onlinePins  = useMemo(() => driverPins.filter(d => d.label === 'Online'), [driverPins]);
  const offlinePins = useMemo(() => driverPins.filter(d => d.label !== 'Online'), [driverPins]);

  const counts = useMemo(() => ({
    total:   driverPins.length,
    online:  onlinePins.length,
    offline: driverPins.filter(d => d.label === 'Offline').length,
  }), [driverPins, onlinePins]);

  const constellationLines = useMemo(
    () => buildConstellationLines(onlinePins.length),
    [onlinePins.length]
  );

  const hasOnline   = counts.online > 0;
  const tripsCount  = Array.isArray(trips) ? trips.length : 0;
  const hasTrips    = tripsCount > 0;

  // Auto-flip every 8s if there's something to show on both sides
  useEffect(() => {
    if (!hasTrips) return; // don't flip if there's nothing on the back
    clearInterval(flipTimerRef.current);
    flipTimerRef.current = setInterval(() => {
      setFace(f => f === 'drivers' ? 'trips' : 'drivers');
    }, 8000);
    return () => clearInterval(flipTimerRef.current);
  }, [hasTrips]);

  // Tap to flip manually (resets the auto timer)
  const handleFlip = () => {
    setFace(f => f === 'drivers' ? 'trips' : 'drivers');
    if (hasTrips) {
      clearInterval(flipTimerRef.current);
      flipTimerRef.current = setInterval(() => {
        setFace(f => f === 'drivers' ? 'trips' : 'drivers');
      }, 8000);
    }
  };

  return (
    <>
      <style>{STYLES}</style>
      <div
        onClick={handleFlip}
        style={{
          position: 'relative',
          height: 'clamp(280px, 42vh, 340px)',
          borderRadius: 24,
          fontFamily: 'Outfit, system-ui, sans-serif',
          perspective: 1400,
          cursor: hasTrips ? 'pointer' : 'default',
        }}
      >
        <div style={{
          position: 'relative', width: '100%', height: '100%',
          transformStyle: 'preserve-3d',
          transition: 'transform .85s cubic-bezier(.34,1.2,.64,1)',
          transform: face === 'drivers' ? 'rotateY(0deg)' : 'rotateY(180deg)',
        }}>
          {/* FRONT */}
          <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', boxShadow: '0 16px 48px rgba(10,22,40,.22), 0 2px 6px rgba(10,22,40,.08)', borderRadius: 24 }}>
            <DriverFace
              driverPins={driverPins}
              onlinePins={onlinePins}
              offlinePins={offlinePins}
              counts={counts}
              constellationLines={constellationLines}
              loading={loading}
              hasOnline={hasOnline}
              tripsCount={tripsCount}
            />
          </div>

          {/* BACK */}
          <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)', boxShadow: '0 16px 48px rgba(15,10,30,.32), 0 2px 6px rgba(15,10,30,.12)', borderRadius: 24 }}>
            <TripFace trips={trips} counts={counts} tripsCount={tripsCount}/>
          </div>
        </div>

        {/* Flip indicator dots (only if both sides have content) */}
        {hasTrips && (
          <div style={{
            position: 'absolute', bottom: -16, left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex', gap: 6,
            zIndex: 30, pointerEvents: 'none',
          }}>
            <div style={{
              width: face === 'drivers' ? 18 : 6, height: 6,
              borderRadius: 3,
              background: face === 'drivers' ? '#22D3A5' : 'rgba(255,255,255,.25)',
              transition: 'all .35s ease',
              boxShadow: face === 'drivers' ? '0 0 8px rgba(34,211,165,.6)' : 'none',
            }}/>
            <div style={{
              width: face === 'trips' ? 18 : 6, height: 6,
              borderRadius: 3,
              background: face === 'trips' ? '#C4B5FD' : 'rgba(255,255,255,.25)',
              transition: 'all .35s ease',
              boxShadow: face === 'trips' ? '0 0 8px rgba(196,181,253,.6)' : 'none',
            }}/>
          </div>
        )}
      </div>
    </>
  );
}
