/**
 * TripsCard.jsx — Ride history face for the StatusCard HUD
 *
 * Props:
 *   uid  string — rider's uid
 *   now  number — Date.now() tick from parent (for live relative times)
 */

import { useState, useMemo } from 'react';
import { useTrips } from '@/App/UaTob/useTrips';

// ── tokens ───────────────────────────────────────────────────────────────────
const C = {
  bg:          '#050A06',
  panel:       'rgba(255,255,255,.035)',
  border:      'rgba(34,197,94,.18)',
  borderDim:   'rgba(34,197,94,.09)',
  green:       '#22C55E',
  greenBright: '#4ADE80',
  greenSoft:   '#34D399',
  amber:       'rgba(251,191,36,.9)',
  amberDim:    'rgba(251,191,36,.6)',
  white:       '#fff',
  dim:         'rgba(255,255,255,.22)',
  fade:        'rgba(255,255,255,.10)',
  faint:       'rgba(255,255,255,.06)',
};
const MONO = "'JetBrains Mono','SFMono-Regular',monospace";
const COND = "'Barlow Condensed','Barlow',sans-serif";

// ── status config ────────────────────────────────────────────────────────────
const STATUS = {
  scheduled:       { label: 'Scheduled',   color: 'rgba(251,191,36,.9)',  bg: 'rgba(251,191,36,.12)' },
  pending:         { label: 'Pending',     color: 'rgba(251,191,36,.9)',  bg: 'rgba(251,191,36,.12)' },
  driver_assigned: { label: 'On the way',  color: C.greenBright,          bg: 'rgba(74,222,128,.12)' },
  arrived:         { label: 'Arrived',     color: C.greenBright,          bg: 'rgba(74,222,128,.12)' },
  in_progress:     { label: 'In ride',     color: C.greenSoft,            bg: 'rgba(52,211,153,.12)' },
  completed:       { label: 'Completed',   color: 'rgba(255,255,255,.35)', bg: 'rgba(255,255,255,.06)' },
  cancelled:       { label: 'Cancelled',   color: 'rgba(239,68,68,.7)',   bg: 'rgba(239,68,68,.08)'  },
};

const ACTIVE_STATUSES = new Set(['scheduled', 'pending', 'driver_assigned', 'arrived', 'in_progress']);

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

function fmtDollars(amount) {
  if (amount == null) return '';
  return `$${Number(amount).toFixed(2)}`;
}

function fmtTime(ts) {
  const ms = tsToMillis(ts);
  if (!ms) return '—';
  return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
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
    case 'car':      return <svg {...p}><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v4h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>;
    case 'pin':      return <svg {...p}><path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>;
    case 'clock':    return <svg {...p}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
    case 'card':     return <svg {...p}><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>;
    case 'cash':     return <svg {...p}><rect x="2" y="6" width="20" height="12" rx="1"/><circle cx="12" cy="12" r="3"/></svg>;
    case 'user':     return <svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
    case 'repeat':   return <svg {...p}><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>;
    case 'empty':    return <svg {...p}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
    case 'dot':      return <svg width={size} height={size} viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" fill={color}/></svg>;
    case 'calendar': return <svg {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
    case 'nav':      return <svg {...p}><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>;
    default:         return null;
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

// ── live context strip shown in collapsed active rides ────────────────────────
function LiveStrip({ ride }) {
  const s = ride.status;

  if (s === 'scheduled') {
    const count = ride.match?.length;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
        <Ico n="calendar" size={9} color={C.amberDim}/>
        <span style={{ fontFamily: MONO, fontSize: 8, color: C.amberDim }}>
          {fmtTime(ride.scheduledAt)}{count ? ` · ${count} drivers nearby` : ''}
        </span>
      </div>
    );
  }

  if (s === 'driver_assigned') {
    const eta = ride.livePickup != null ? Math.round(ride.livePickup) : ride.driverEtaMin;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
        <Ico n="nav" size={9} color={`${C.greenBright}99`}/>
        <span style={{ fontFamily: MONO, fontSize: 8, color: `${C.greenBright}bb` }}>
          {eta != null ? `~${eta} min away` : '—'}
          {ride.liveArrival ? ` · Arrives ${ride.liveArrival}` : ''}
        </span>
      </div>
    );
  }

  if (s === 'arrived') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
        <div style={{
          width: 5, height: 5, borderRadius: '50%', background: C.greenBright,
          boxShadow: `0 0 6px ${C.greenBright}`, animation: 'uaBlink 1s ease-in-out infinite',
        }}/>
        <span style={{ fontFamily: MONO, fontSize: 8, color: C.greenBright }}>Driver is here</span>
      </div>
    );
  }

  if (s === 'in_progress') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
        <Ico n="car" size={9} color={`${C.greenSoft}99`}/>
        <span style={{ fontFamily: MONO, fontSize: 8, color: `${C.greenSoft}bb` }}>
          En route{ride.tripDurationMin ? ` · ${ride.tripDurationMin} min` : ''}
        </span>
      </div>
    );
  }

  return null;
}

// ── stat cell for live panel ──────────────────────────────────────────────────
function Stat({ label, value, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{
        fontFamily: COND, fontSize: 7, fontWeight: 800, letterSpacing: '.14em',
        color: 'rgba(255,255,255,.3)', textTransform: 'uppercase',
      }}>{label}</span>
      <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

// ── expanded live data panel ──────────────────────────────────────────────────
function LivePanel({ ride }) {
  const s = ride.status;

  if (s === 'driver_assigned') {
    const dist = ride.liveDistance ?? ride.driverDistanceMi;
    const eta  = ride.livePickup != null ? Math.round(ride.livePickup) : ride.driverEtaMin;
    if (dist == null && eta == null) return null;
    return (
      <div style={{
        padding: '7px 9px', borderRadius: 7,
        background: 'rgba(74,222,128,.05)', border: '1px solid rgba(74,222,128,.14)',
        display: 'flex', flexWrap: 'wrap', gap: '5px 16px',
      }}>
        {dist    != null && <Stat label="DISTANCE" value={`${Number(dist).toFixed(1)} mi`}     color={C.greenBright}/>}
        {ride.liveMph != null && <Stat label="SPEED"    value={`${Number(ride.liveMph).toFixed(1)} mph`} color={C.greenSoft}/>}
        {eta    != null && <Stat label="ETA"      value={`~${eta} min`}                    color={C.greenBright}/>}
        {ride.liveArrival  && <Stat label="ARRIVES"  value={ride.liveArrival}                   color={C.greenBright}/>}
      </div>
    );
  }

  if (s === 'scheduled') {
    const best = ride.match?.[0];
    return (
      <div style={{
        padding: '7px 9px', borderRadius: 7,
        background: 'rgba(251,191,36,.05)', border: '1px solid rgba(251,191,36,.14)',
        display: 'flex', flexWrap: 'wrap', gap: '5px 16px',
      }}>
        <Stat label="SCHED FOR" value={fmtTime(ride.scheduledAt)}                              color={C.amber}/>
        {ride.match?.length > 0 && <Stat label="MATCHED"   value={`${ride.match.length} drivers`}              color={C.amberDim}/>}
        {best && <Stat label="CLOSEST"   value={`${best.etaMin} min · ${best.miles.toFixed(1)} mi`} color={C.amberDim}/>}
      </div>
    );
  }

  return null;
}

// ── single trip card ──────────────────────────────────────────────────────────
function TripRow({ ride, now, isActive }) {
  const [expanded, setExpanded] = useState(false);
  const ms    = tsToMillis(ride.createdAt);
  const fare  = fmtDollars(ride.fareTotal);
  const label = ride.rideLabel || ride.rideType || 'Economy';

  const isScheduled = ride.status === 'scheduled';
  const accentColor = isActive ? (isScheduled ? C.amber : C.greenBright) : null;
  const borderColor = isActive
    ? (isScheduled ? 'rgba(251,191,36,.25)' : C.border)
    : C.borderDim;
  const bgColor = isActive
    ? (isScheduled ? 'rgba(251,191,36,.05)' : 'rgba(34,197,94,.06)')
    : C.faint;

  return (
    <div
      onClick={() => setExpanded(e => !e)}
      style={{
        borderRadius: 10, overflow: 'hidden',
        background: bgColor,
        border: `1px solid ${borderColor}`,
        cursor: 'pointer', transition: 'border-color .15s',
      }}
    >
      {/* collapsed row */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 9, padding: '9px 10px',
      }}>
        {/* icon */}
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0, marginTop: 1,
          background: isActive
            ? (isScheduled ? 'rgba(251,191,36,.1)' : 'rgba(34,197,94,.1)')
            : 'rgba(255,255,255,.04)',
          border: `1px solid ${borderColor}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Ico
            n={isScheduled ? 'calendar' : 'car'}
            size={14}
            color={accentColor || C.dim}
          />
        </div>

        {/* info */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <span style={{
              fontFamily: COND, fontSize: 11, fontWeight: 800, letterSpacing: '.06em',
              color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{label}</span>
            {fare && (
              <span style={{
                fontFamily: MONO, fontSize: 10, fontWeight: 700, flexShrink: 0,
                color: accentColor || 'rgba(255,255,255,.6)',
              }}>{fare}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <StatusBadge status={ride.status}/>
            <span style={{ fontFamily: MONO, fontSize: 8, color: C.dim, flexShrink: 0 }}>
              {relTime(ms, now)}
            </span>
          </div>
          {isActive && <LiveStrip ride={ride}/>}
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

          <LivePanel ride={ride}/>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {ride.paymentMethod && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <PayIco method={ride.paymentMethod}/>
                <span style={{ fontFamily: MONO, fontSize: 8.5, color: C.dim }}>
                  {ride.paymentMethod === 'cashapp' ? 'Cash App'
                    : ride.paymentMethod === 'cash' ? 'Cash' : 'Card'}
                </span>
              </div>
            )}
            {ride.id && (
              <span style={{
                fontFamily: MONO, fontSize: 7.5, color: C.fade, letterSpacing: '.06em',
              }}>REF {ride.id.slice(-8).toUpperCase()}</span>
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
      gap: 8, padding: '24px 0', animation: 'uaFadeIn .3s ease both',
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

export default function TripsCard({ uid, now = Date.now() }) {
  const { trips, loading } = useTrips(uid);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all'); // 'all' | 'active' | 'completed'

  const sorted = useMemo(() => (
    [...trips].sort((a, b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt))
  ), [trips]);

  const filtered = useMemo(() => {
    if (filter === 'active')    return sorted.filter(r => ACTIVE_STATUSES.has(r.status));
    if (filter === 'completed') return sorted.filter(r => r.status === 'completed');
    return sorted;
  }, [sorted, filter]);

  const visible     = filtered.slice(0, page * PAGE_SIZE);
  const hasMore     = visible.length < filtered.length;
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
        {loading ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 7, padding: '20px 0', animation: 'uaFadeIn .2s ease both',
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%', background: C.greenBright,
              animation: 'uaBlink 1s ease-in-out infinite',
            }}/>
            <span style={{ fontFamily: MONO, fontSize: 9, color: C.dim }}>Loading trips…</span>
          </div>
        ) : visible.length === 0 ? (
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
