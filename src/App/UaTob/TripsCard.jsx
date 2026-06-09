/**
 * TripsCard.jsx — Ride history face for the StatusCard HUD
 *
 * Props:
 *   rides   array  — rider's ride history, newest-first preferred
 *                    each ride: { id, status, pickup, dropoff, rideType,
 *                                 fareCents, payment, createdAt, driverName }
 *   now     number — Date.now() tick from parent (for live relative times)
 */

import { useState, useMemo } from 'react';

// ── tokens ───────────────────────────────────────────────────────────────────
const C = {
  bg:          '#050A06',
  panel:       'rgba(255,255,255,.035)',
  border:      'rgba(34,197,94,.18)',
  borderDim:   'rgba(34,197,94,.09)',
  green:       '#22C55E',
  greenBright: '#4ADE80',
  greenSoft:   '#34D399',
  white:       '#fff',
  dim:         'rgba(255,255,255,.22)',
  fade:        'rgba(255,255,255,.10)',
  faint:       'rgba(255,255,255,.06)',
};
const MONO = "'JetBrains Mono','SFMono-Regular',monospace";
const COND = "'Barlow Condensed','Barlow',sans-serif";

// ── status config ────────────────────────────────────────────────────────────
const STATUS = {
  pending:         { label: 'Pending',    color: 'rgba(251,191,36,.9)',  bg: 'rgba(251,191,36,.12)' },
  driver_assigned: { label: 'On the way', color: C.greenBright,          bg: 'rgba(74,222,128,.12)' },
  arrived:         { label: 'Arrived',    color: C.greenBright,          bg: 'rgba(74,222,128,.12)' },
  in_progress:     { label: 'In ride',    color: C.greenSoft,            bg: 'rgba(52,211,153,.12)' },
  completed:       { label: 'Completed',  color: 'rgba(255,255,255,.35)', bg: 'rgba(255,255,255,.06)' },
  cancelled:       { label: 'Cancelled',  color: 'rgba(239,68,68,.7)',   bg: 'rgba(239,68,68,.08)'  },
};

const ACTIVE_STATUSES = new Set(['pending', 'driver_assigned', 'arrived', 'in_progress']);

// ── helpers ───────────────────────────────────────────────────────────────────
function tsToMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') { const p = Date.parse(ts); return isNaN(p) ? 0 : p; }
  return 0;
}

function relTime(ms, now) {
  if (!ms) return '—';
  const diff = now - ms;
  if (diff < 60_000)       return 'just now';
  if (diff < 3_600_000)    return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000)   return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000)  return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtMoney(cents) {
  if (!cents && cents !== 0) return '';
  return `$${(cents / 100).toFixed(2)}`;
}

function truncate(str, n) {
  if (!str) return '—';
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
}

// ── icons ─────────────────────────────────────────────────────────────────────
function Ico({ n, size = 14, color = 'currentColor', sw = 1.7 }) {
  const p = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round',
  };
  switch (n) {
    case 'car':    return <svg {...p}><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v4h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>;
    case 'pin':    return <svg {...p}><path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>;
    case 'clock':  return <svg {...p}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
    case 'card':   return <svg {...p}><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>;
    case 'cash':   return <svg {...p}><rect x="2" y="6" width="20" height="12" rx="1"/><circle cx="12" cy="12" r="3"/></svg>;
    case 'user':   return <svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
    case 'repeat': return <svg {...p}><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>;
    case 'empty':  return <svg {...p}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
    case 'dot':    return <svg width={size} height={size} viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" fill={color}/></svg>;
    default:       return null;
  }
}

// ── payment icon ──────────────────────────────────────────────────────────────
function PayIco({ method, size = 11 }) {
  const map = { card: 'card', cash: 'cash', cashapp: 'cash' };
  return <Ico n={map[method] || 'card'} size={size} color={C.dim}/>;
}

// ── status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS[status] || STATUS.pending;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 7px', borderRadius: 20,
      background: cfg.bg, border: `1px solid ${cfg.color}33`,
    }}>
      {ACTIVE_STATUSES.has(status) && (
        <div style={{
          width: 5, height: 5, borderRadius: '50%', background: cfg.color,
          boxShadow: `0 0 5px ${cfg.color}`,
          animation: 'uaBlink 1.4s ease-in-out infinite',
        }}/>
      )}
      <span style={{
        fontFamily: COND, fontSize: 8, fontWeight: 800, letterSpacing: '.12em',
        color: cfg.color, textTransform: 'uppercase',
      }}>{cfg.label}</span>
    </div>
  );
}

// ── route mini-row ────────────────────────────────────────────────────────────
function RouteRow({ pickup, dropoff }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {[
        { dot: C.greenBright, glow: true,  val: truncate(pickup,  32) },
        { dot: 'rgba(255,255,255,.35)', glow: false, val: truncate(dropoff, 32) },
      ].map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            background: r.dot,
            boxShadow: r.glow ? `0 0 5px ${C.greenBright}88` : 'none',
          }}/>
          <span style={{
            fontFamily: MONO, fontSize: 8.5, color: 'rgba(255,255,255,.55)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{r.val}</span>
        </div>
      ))}
    </div>
  );
}

// ── single trip card ──────────────────────────────────────────────────────────
function TripRow({ ride, now, isActive }) {
  const [expanded, setExpanded] = useState(false);
  const ms    = tsToMillis(ride.createdAt);
  const fare  = fmtMoney(ride.fareCents);

  return (
    <div
      onClick={() => setExpanded(e => !e)}
      style={{
        borderRadius: 10, overflow: 'hidden',
        background: isActive ? 'rgba(34,197,94,.06)' : C.faint,
        border: `1px solid ${isActive ? C.border : C.borderDim}`,
        cursor: 'pointer', transition: 'border-color .15s',
      }}
    >
      {/* collapsed row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 9, padding: '9px 10px',
      }}>
        {/* ride type icon */}
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: isActive ? 'rgba(34,197,94,.1)' : 'rgba(255,255,255,.04)',
          border: `1px solid ${isActive ? C.border : C.borderDim}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Ico n="car" size={14} color={isActive ? C.greenBright : C.dim}/>
        </div>

        {/* main info */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <span style={{
              fontFamily: COND, fontSize: 11, fontWeight: 800, letterSpacing: '.06em',
              color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{ride.rideType || 'Economy'}</span>
            {fare && (
              <span style={{
                fontFamily: MONO, fontSize: 10, fontWeight: 700,
                color: isActive ? C.greenBright : 'rgba(255,255,255,.6)',
                flexShrink: 0,
              }}>{fare}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <StatusBadge status={ride.status}/>
            <span style={{
              fontFamily: MONO, fontSize: 8, color: C.dim, flexShrink: 0,
            }}>{relTime(ms, now)}</span>
          </div>
        </div>
      </div>

      {/* expanded detail */}
      {expanded && (
        <div style={{
          padding: '0 10px 10px',
          display: 'flex', flexDirection: 'column', gap: 8,
          animation: 'uaFadeIn .2s ease both',
          borderTop: `1px solid ${C.borderDim}`,
        }}>
          <div style={{ height: 0 }}/>

          <RouteRow pickup={ride.pickup} dropoff={ride.dropoff}/>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {ride.driverName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Ico n="user" size={10} color={C.dim}/>
                <span style={{ fontFamily: MONO, fontSize: 8.5, color: 'rgba(255,255,255,.5)' }}>
                  {ride.driverName}
                </span>
              </div>
            )}
            {ride.payment && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <PayIco method={ride.payment}/>
                <span style={{ fontFamily: MONO, fontSize: 8.5, color: C.dim }}>
                  {ride.payment === 'cashapp' ? 'Cash App' : ride.payment === 'cash' ? 'Cash' : 'Card'}
                </span>
              </div>
            )}
            {ride.id && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{
                  fontFamily: MONO, fontSize: 7.5, color: C.fade,
                  letterSpacing: '.06em',
                }}>REF {ride.id.slice(-8).toUpperCase()}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── empty state ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 8, padding: '24px 0',
      animation: 'uaFadeIn .3s ease both',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 14,
        background: C.faint, border: `1px solid ${C.borderDim}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Ico n="car" size={20} color={C.dim}/>
      </div>
      <span style={{ fontFamily: COND, fontSize: 11, fontWeight: 700,
        letterSpacing: '.08em', color: C.dim }}>No trips yet</span>
      <span style={{ fontFamily: MONO, fontSize: 8.5, color: C.fade, textAlign: 'center',
        lineHeight: 1.6, maxWidth: 200 }}>
        Your ride history will appear here.
      </span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
const PAGE_SIZE = 4;

export default function TripsCard({ rides = [], now = Date.now() }) {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all'); // 'all' | 'active' | 'completed'

  // sort newest first
  const sorted = useMemo(() => (
    [...rides].sort((a, b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt))
  ), [rides]);

  const filtered = useMemo(() => {
    if (filter === 'active')    return sorted.filter(r => ACTIVE_STATUSES.has(r.status));
    if (filter === 'completed') return sorted.filter(r => r.status === 'completed');
    return sorted;
  }, [sorted, filter]);

  const visible    = filtered.slice(0, page * PAGE_SIZE);
  const hasMore    = visible.length < filtered.length;
  const activeCount = sorted.filter(r => ACTIVE_STATUSES.has(r.status)).length;

  const FILTERS = [
    { id: 'all',       label: 'All' },
    { id: 'active',    label: 'Active', badge: activeCount || null },
    { id: 'completed', label: 'Done'  },
  ];

  return (
    <div style={{
      padding: '12px 12px 14px',
      display: 'flex', flexDirection: 'column', gap: 10,
      userSelect: 'none',
      animation: 'uaCardFlip .28s ease both',
    }}>

      {/* ── header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{
            fontFamily: COND, fontSize: 10, fontWeight: 800, letterSpacing: '.16em',
            color: C.greenBright, textTransform: 'uppercase',
          }}>My Trips</div>
          <div style={{ fontFamily: MONO, fontSize: 8, color: C.dim, marginTop: 1 }}>Orlando, FL</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{
            width: 5, height: 5, borderRadius: '50%', background: C.greenBright,
            boxShadow: `0 0 6px ${C.greenBright}`,
            animation: 'uaBlink 1.6s ease-in-out infinite',
          }}/>
          <span style={{ fontFamily: MONO, fontSize: 7.5, fontWeight: 700, color: C.greenBright }}>LIVE</span>
        </div>
      </div>

      <div style={{ height: 1, background: C.borderDim }}/>

      {/* ── filter tabs ── */}
      <div style={{ display: 'flex', gap: 5 }}>
        {FILTERS.map(f => {
          const active = filter === f.id;
          return (
            <button key={f.id} onClick={() => { setFilter(f.id); setPage(1); }} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              padding: '5px 4px', borderRadius: 8, cursor: 'pointer',
              background: active ? 'rgba(34,197,94,.12)' : C.faint,
              border: `1px solid ${active ? C.border : C.borderDim}`,
              transition: 'all .15s',
            }}>
              <span style={{
                fontFamily: COND, fontSize: 9, fontWeight: 800, letterSpacing: '.1em',
                color: active ? C.greenBright : C.dim, textTransform: 'uppercase',
              }}>{f.label}</span>
              {f.badge > 0 && (
                <div style={{
                  minWidth: 14, height: 14, borderRadius: 7, padding: '0 3px',
                  background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontFamily: MONO, fontSize: 7.5, fontWeight: 800, color: '#fff' }}>
                    {f.badge}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* ── trip list ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {visible.length === 0 ? (
          <EmptyState/>
        ) : (
          visible.map(ride => (
            <TripRow
              key={ride.id}
              ride={ride}
              now={now}
              isActive={ACTIVE_STATUSES.has(ride.status)}
            />
          ))
        )}
      </div>

      {/* ── load more ── */}
      {hasMore && (
        <button onClick={() => setPage(p => p + 1)} style={{
          width: '100%', padding: '7px 0', borderRadius: 9, cursor: 'pointer',
          background: C.faint, border: `1px solid ${C.borderDim}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          transition: 'opacity .15s',
        }}>
          <Ico n="repeat" size={11} color={C.dim}/>
          <span style={{
            fontFamily: COND, fontSize: 9, fontWeight: 800, letterSpacing: '.12em',
            color: C.dim, textTransform: 'uppercase',
          }}>Load more</span>
        </button>
      )}

    </div>
  );
}
