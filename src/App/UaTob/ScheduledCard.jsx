// ScheduledRidesCard.jsx — Upcoming scheduled rides panel for the StatusCard.
//
// What changed from v1:
//   • Live countdown clock per ride (1Hz tick) — the headline becomes time-
//     until-pickup, with color shifts as it gets closer (violet → indigo →
//     amber → red) and a "BOARDING SOON" status when under 15 min.
//   • Dot-tap pagination — viewers can scrub between rides instead of being
//     held hostage by the auto-cycle. Auto-cycle pauses on hover/focus.
//   • Real "what's next" framing — the current ride's slot in the upcoming
//     list is reflected in a horizontal stack of micro-pills above the card.
//   • Route line is now a proper rail with green pickup dot, vertical link,
//     diamond dropoff — matches the radar HUD/ActiveTrip visual language.
//   • Footer strip — payment method icon, distance/duration, fare.
//   • Mini calendar tile on the left of the When row makes the next ride
//     instantly identifiable at a glance ("FRI 12").

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';

// ─── Tokens ──────────────────────────────────────────────────────────────────
const C = {
  bg:            '#050A06',
  bgCard:        'rgba(255,255,255,.035)',
  border:        'rgba(129,140:248,.20)',
  borderDim:     'rgba(129,140,248,.09)',
  borderFaint:   'rgba(255,255,255,.07)',
  indigo:        '#818CF8',
  indigoBright:  '#A5B4FC',
  indigoDim:     'rgba(129,140,248,.10)',
  indigoBorder:  'rgba(129,140,248,.28)',
  violet:        '#C084FC',
  violetSoft:    '#DDD6FE',
  green:         '#4ADE80',
  greenSoft:     '#34D399',
  greenDim:      'rgba(74,222,128,.09)',
  greenBorder:   'rgba(74,222,128,.22)',
  red:           '#F87171',
  redDim:        'rgba(248,113,113,.09)',
  redBorder:     'rgba(248,113,113,.3)',
  amber:         '#FCD34D',
  amberSoft:     '#FBBF24',
  amberDim:      'rgba(252,211,77,.09)',
  amberBorder:   'rgba(252,211,77,.28)',
  white:         '#fff',
  dim:           'rgba(255,255,255,.32)',
  fade:          'rgba(255,255,255,.14)',
  faint:         'rgba(255,255,255,.06)',
};
// (typo guard for token above)
C.border = 'rgba(129,140,248,.20)';

const MONO = "'JetBrains Mono','SFMono-Regular',monospace";
const COND = "'Barlow Condensed','Barlow',sans-serif";

// ─── Tunables ────────────────────────────────────────────────────────────────
const AUTO_CYCLE_MS    = 5_200;     // ms per card in carousel
const BOARDING_SOON_MS = 15 * 60_000;  // <15 min → "BOARDING SOON" status
const APPROACHING_MS   = 60 * 60_000;  // <1 hr   → amber accent
const MAX_FEED         = 8;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function tsToMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') { const p = Date.parse(ts); return Number.isNaN(p) ? 0 : p; }
  return 0;
}

function stripAddr(a) {
  if (!a) return '—';
  return a
    .replace(/^\d+[-–]?\d*\s+/, '')
    .replace(/,\s*(Orlando|Tampa|Kissimmee|Sanford|FL|USA).*$/i, '')
    .trim() || a;
}

function scheduledMs(ride) {
  return tsToMillis(ride?.scheduledAt);
}

function formatScheduled(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  return d.toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function formatDayChunk(ms) {
  if (!ms) return { dow: '—', day: '—' };
  const d = new Date(ms);
  if (isNaN(d)) return { dow: '—', day: '—' };
  const dow = d.toLocaleString('en-US', { weekday: 'short' }).toUpperCase();
  const day = String(d.getDate()).padStart(2, '0');
  return { dow, day };
}

function formatTimeOnly(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  if (isNaN(d)) return '—';
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}

// Live countdown — returns { text, color, urgent, status }
function formatCountdown(targetMs, now) {
  const diff = (targetMs ?? 0) - now;
  if (!targetMs) return { text: '—', color: C.dim, urgent: false, status: null };

  if (diff <= 0) {
    return { text: 'DUE NOW', color: C.red, urgent: true, status: 'DUE' };
  }
  const sec = Math.floor(diff / 1000);
  const m   = Math.floor(sec / 60);
  const h   = Math.floor(m / 60);
  const d   = Math.floor(h / 24);

  let text;
  if (d > 0)       text = `${d}d ${h % 24}h`;
  else if (h > 0)  text = m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
  else if (m > 0)  text = `${m}m ${sec % 60}s`;
  else             text = `${sec}s`;

  if (diff <= BOARDING_SOON_MS) return { text, color: C.red,    urgent: true,  status: 'BOARDING SOON' };
  if (diff <= APPROACHING_MS)   return { text, color: C.amber,  urgent: true,  status: 'APPROACHING'   };
  if (d === 0 && h < 6)         return { text, color: C.indigoBright, urgent: false, status: 'TODAY'   };
  if (d === 0)                  return { text, color: C.indigoBright, urgent: false, status: 'TODAY'   };
  if (d === 1)                  return { text, color: C.violet, urgent: false, status: 'TOMORROW'      };
  return                              { text, color: C.violet, urgent: false, status: 'UPCOMING'      };
}

function pmColor(method) {
  if (!method) return C.dim;
  if (method === 'cash')    return C.amber;
  if (method === 'cashapp') return '#00D632';
  return C.indigoBright;
}
function pmLabel(method) {
  if (!method) return '—';
  if (method === 'cash')    return 'Cash';
  if (method === 'cashapp') return 'Cash App';
  return 'Card';
}

// ─── Icons ───────────────────────────────────────────────────────────────────
function Ico({ n, size = 12, color = 'currentColor', sw = 1.9, style: sx }) {
  const p = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round', style: sx,
  };
  switch (n) {
    case 'cal':    return <svg {...p}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
    case 'clock':  return <svg {...p}><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>;
    case 'card':   return <svg {...p}><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>;
    case 'cash':   return <svg {...p}><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></svg>;
    case 'phone':  return <svg {...p}><path d="M22 16.9v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13 1 .37 1.97.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.84.33 1.81.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
    case 'route':  return <svg {...p}><circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H14a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h5.5"/></svg>;
    case 'mi':     return <svg {...p}><path d="M3 11a9 9 0 0 1 18 0v0a9 9 0 0 1-18 0z"/><path d="M3 11h18M12 2v9"/></svg>;
    case 'fwd':    return <svg {...p}><polyline points="9 18 15 12 9 6"/></svg>;
    case 'back':   return <svg {...p}><polyline points="15 18 9 12 15 6"/></svg>;
    case 'pause':  return <svg {...p}><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>;
    case 'play':   return <svg {...p}><polygon points="6 4 20 12 6 20 6 4"/></svg>;
    default:       return null;
  }
}

// ─── Ride type chip (kept compatible with v1 palette) ────────────────────────
const TYPE_COLORS = {
  economy:  { bg: 'rgba(74,222,128,.08)',  border: 'rgba(74,222,128,.22)',  text: '#4ADE80'  },
  standard: { bg: 'rgba(129,140,248,.08)', border: 'rgba(129,140,248,.22)', text: '#A5B4FC'  },
  premium:  { bg: 'rgba(234,179,8,.08)',   border: 'rgba(234,179,8,.22)',   text: '#FCD34D'  },
  xl:       { bg: 'rgba(192,132,252,.08)', border: 'rgba(192,132,252,.22)', text: '#C084FC'  },
};

function RideTypeChip({ type, label }) {
  const s = TYPE_COLORS[type] || TYPE_COLORS.standard;
  return (
    <span style={{
      fontFamily: COND, fontSize: 8.5, fontWeight: 800, letterSpacing: '.1em',
      textTransform: 'uppercase', padding: '2px 7px', borderRadius: 6,
      background: s.bg, border: `1px solid ${s.border}`, color: s.text,
    }}>
      {label || type || 'Standard'}
    </span>
  );
}

// ─── Mini calendar tile — "FRI / 12" block ───────────────────────────────────
function DayTile({ ms, accent }) {
  const { dow, day } = formatDayChunk(ms);
  return (
    <div style={{
      width: 38, minHeight: 42, flexShrink: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      borderRadius: 9, overflow: 'hidden',
      border: `1px solid ${accent}55`,
      background: 'rgba(0,0,0,.18)',
    }}>
      <div style={{
        width: '100%', textAlign: 'center', padding: '2px 0 1px',
        background: `linear-gradient(180deg, ${accent}33, ${accent}1a)`,
        fontFamily: COND, fontSize: 8.5, fontWeight: 800, letterSpacing: '.14em',
        color: accent, textTransform: 'uppercase',
        borderBottom: `1px solid ${accent}40`,
      }}>
        {dow}
      </div>
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: MONO, fontSize: 16, fontWeight: 800, color: '#fff',
        lineHeight: 1, padding: '4px 0 5px',
      }}>
        {day}
      </div>
    </div>
  );
}

// ─── Upcoming queue strip — micro-pills above the card ───────────────────────
// Shows up to ~8 upcoming rides as small day-tagged chips. The current card's
// index gets highlighted. Tap a chip to jump.
function QueueStrip({ feed, idx, now, onPick }) {
  if (feed.length < 2) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      overflowX: 'auto', overflowY: 'hidden',
      paddingBottom: 2, marginBottom: 1,
      msOverflowStyle: 'none', scrollbarWidth: 'none',
    }}>
      {feed.map((r, i) => {
        const ms     = scheduledMs(r);
        const active = i === idx;
        const cd     = formatCountdown(ms, now);
        const chunk  = formatDayChunk(ms);
        return (
          <button
            key={r.id || `${i}-${ms}`}
            type="button"
            onClick={() => onPick(i)}
            aria-label={`Show ride ${i + 1} of ${feed.length}`}
            style={{
              flexShrink: 0, padding: '3px 7px', borderRadius: 7,
              background: active ? `${cd.color}1f` : 'rgba(255,255,255,.03)',
              border: `1px solid ${active ? cd.color + '55' : 'rgba(255,255,255,.06)'}`,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
              transition: 'background .15s, border-color .15s',
            }}>
            <span style={{
              fontFamily: COND, fontSize: 8, fontWeight: 800, letterSpacing: '.1em',
              color: active ? cd.color : 'rgba(255,255,255,.38)',
              textTransform: 'uppercase',
            }}>
              {chunk.dow} {chunk.day}
            </span>
            <span style={{
              fontFamily: MONO, fontSize: 8, fontWeight: 700,
              color: active ? '#fff' : 'rgba(255,255,255,.48)',
            }}>
              {cd.text}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Route rail — green dot → vertical link → diamond ────────────────────────
function RouteRail({ pickup, dropoff }) {
  return (
    <div style={{ display: 'flex', gap: 9, alignItems: 'stretch', minWidth: 0 }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: 5, flexShrink: 0,
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%', background: C.green,
          boxShadow: `0 0 6px ${C.green}88`,
        }}/>
        <div style={{
          width: 1.5, flex: 1, minHeight: 18,
          background: `linear-gradient(to bottom, ${C.green}55, rgba(129,140,248,.4))`,
          margin: '3px 0', borderRadius: 2,
        }}/>
        <div style={{
          width: 8, height: 8, background: C.indigo,
          transform: 'rotate(45deg)', flexShrink: 0,
          boxShadow: `0 0 5px ${C.indigo}88`,
        }}/>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div>
          <div style={{
            fontFamily: COND, fontSize: 8, fontWeight: 800, letterSpacing: '.14em',
            color: C.dim, textTransform: 'uppercase', marginBottom: 2,
          }}>Pickup</div>
          <div style={{
            fontFamily: COND, fontSize: 14, fontWeight: 800, color: '#fff', lineHeight: 1.15,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            letterSpacing: '.02em',
          }}>
            {stripAddr(pickup)}
          </div>
        </div>
        <div>
          <div style={{
            fontFamily: COND, fontSize: 8, fontWeight: 800, letterSpacing: '.14em',
            color: C.dim, textTransform: 'uppercase', marginBottom: 2,
          }}>Drop-off</div>
          <div style={{
            fontFamily: MONO, fontSize: 10.5, fontWeight: 600, color: 'rgba(255,255,255,.55)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {stripAddr(dropoff)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Footer pills strip ──────────────────────────────────────────────────────
function FooterMeta({ ride }) {
  const pmCol = pmColor(ride.paymentMethod);
  const pmIco = ride.paymentMethod === 'cash' ? 'cash' : ride.paymentMethod === 'cashapp' ? 'phone' : 'card';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <RideTypeChip type={ride.rideType} label={ride.rideLabel}/>

      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontFamily: MONO, fontSize: 8.5, fontWeight: 700,
        color: pmCol,
        background: 'rgba(255,255,255,.04)',
        border: '1px solid rgba(255,255,255,.08)',
        borderRadius: 6, padding: '2px 7px',
      }}>
        <Ico n={pmIco} size={10} color={pmCol}/>
        {pmLabel(ride.paymentMethod)}
      </span>

      {typeof ride.tripDistanceMiles === 'number' && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontFamily: MONO, fontSize: 8.5, fontWeight: 700,
          color: 'rgba(255,255,255,.55)',
          background: 'rgba(255,255,255,.04)',
          border: '1px solid rgba(255,255,255,.08)',
          borderRadius: 6, padding: '2px 7px',
        }}>
          <Ico n="route" size={10} color="rgba(255,255,255,.55)"/>
          {ride.tripDistanceMiles.toFixed(1)} mi
        </span>
      )}

      {typeof ride.tripDurationMin === 'number' && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontFamily: MONO, fontSize: 8.5, fontWeight: 700,
          color: 'rgba(255,255,255,.55)',
          background: 'rgba(255,255,255,.04)',
          border: '1px solid rgba(255,255,255,.08)',
          borderRadius: 6, padding: '2px 7px',
        }}>
          <Ico n="clock" size={10} color="rgba(255,255,255,.55)"/>
          {ride.tripDurationMin} min
        </span>
      )}

      {ride.fareTotal != null && (
        <span style={{
          marginLeft: 'auto',
          fontFamily: MONO, fontSize: 15, fontWeight: 800,
          color: C.green, letterSpacing: '-0.5px',
          textShadow: '0 0 12px rgba(74,222,128,.25)',
        }}>
          ${Number(ride.fareTotal).toFixed(2)}
        </span>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// ScheduledRidesCard
// ═════════════════════════════════════════════════════════════════════════════
export default function ScheduledRidesCard({ scheduledRides = [] }) {
  // ── Feed: only future, properly-marked scheduled rides, soonest first ───
  const feed = useMemo(() => {
    const nowMs = Date.now();
    return [...scheduledRides]
      .filter(r => r?.pickup && r?.dropoff && r?.isScheduled)
      .map(r => ({ ...r, _ms: scheduledMs(r) }))
      .filter(r => r._ms > nowMs - BOARDING_SOON_MS)  // keep "due now" visible briefly
      .sort((a, b) => a._ms - b._ms)
      .slice(0, MAX_FEED);
  }, [scheduledRides]);

  const [idx,    setIdx]    = useState(0);
  const [exit,   setExit]   = useState(false);
  const [paused, setPaused] = useState(false);
  const [now,    setNow]    = useState(() => Date.now());
  const timer = useRef(null);

  // Reset to top when feed identity changes
  useEffect(() => { setIdx(0); }, [feed.length]);

  // 1Hz tick for live countdowns
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-cycle, paused on hover/focus
  useEffect(() => {
    if (feed.length < 2 || paused) return;
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      setExit(true);
      setTimeout(() => {
        setIdx(x => (x + 1) % feed.length);
        setExit(false);
      }, 260);
    }, AUTO_CYCLE_MS);
    return () => clearInterval(timer.current);
  }, [feed.length, paused]);

  // Manual advance
  const jumpTo = useCallback((target) => {
    if (target === idx) return;
    setExit(true);
    setTimeout(() => {
      setIdx(((target % feed.length) + feed.length) % feed.length);
      setExit(false);
    }, 200);
  }, [idx, feed.length]);
  const next = useCallback(() => jumpTo(idx + 1), [idx, jumpTo]);
  const prev = useCallback(() => jumpTo(idx - 1), [idx, jumpTo]);

  const cur   = feed[idx];
  const curMs = cur ? scheduledMs(cur) : 0;
  const cd    = formatCountdown(curMs, now);

  // Empty state
  if (!cur) {
    return (
      <>
        <style>{`
          @keyframes srEmptyPulse { 0%,100%{opacity:.4} 50%{opacity:.8} }
        `}</style>
        <div style={{ padding: '14px 14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Ico n="cal" size={12} color={C.indigo}/>
            <span style={{
              fontFamily: COND, fontSize: 9.5, fontWeight: 800,
              letterSpacing: '.16em', textTransform: 'uppercase', color: C.indigoBright,
            }}>
              Scheduled Rides
            </span>
          </div>
          <div style={{
            minHeight: 78, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 8,
            border: '1px dashed rgba(129,140,248,.18)', borderRadius: 11,
            padding: '14px 12px',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'rgba(129,140,248,.07)',
              border: '1px solid rgba(129,140,248,.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'srEmptyPulse 2.4s ease-in-out infinite',
            }}>
              <Ico n="cal" size={14} color={C.indigoBright}/>
            </div>
            <div style={{ textAlign: 'center', lineHeight: 1.35 }}>
              <div style={{
                fontFamily: COND, fontSize: 12, fontWeight: 800,
                letterSpacing: '.06em', color: '#fff',
              }}>
                Nothing scheduled
              </div>
              <div style={{
                fontFamily: MONO, fontSize: 9, color: C.dim, marginTop: 2,
              }}>
                Schedule a ride from the Book screen — pick a date up to 7 days out.
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  const accent = cd.color;
  const onMouseEnter = () => setPaused(true);
  const onMouseLeave = () => setPaused(false);

  return (
    <>
      <style>{`
        @keyframes srIn     { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes srOut    { to{opacity:0;transform:translateY(-4px)} }
        @keyframes srDot    { 0%,100%{opacity:1} 50%{opacity:.25} }
        @keyframes srBar    { from{transform:scaleX(0)} to{transform:scaleX(1)} }
        @keyframes srGlowUrg{ 0%,100%{box-shadow:0 0 0 0 rgba(248,113,113,0)} 50%{box-shadow:0 0 0 4px rgba(248,113,113,.18)} }
        @keyframes srPulseR { 0%,100%{opacity:.65} 50%{opacity:1} }
        .sr-scroll::-webkit-scrollbar { display:none; }
      `}</style>

      <div
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onFocus={onMouseEnter}
        onBlur={onMouseLeave}
        style={{ padding: '11px 13px 12px', display: 'flex', flexDirection: 'column', gap: 9 }}
      >

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
            <div style={{
              width: 5, height: 5, borderRadius: '50%',
              background: cd.urgent ? C.red : C.indigo,
              boxShadow: `0 0 6px ${cd.urgent ? C.red : C.indigo}`,
              animation: 'srDot 1.6s ease-in-out infinite',
              flexShrink: 0,
            }}/>
            <span style={{
              fontFamily: COND, fontSize: 9.5, fontWeight: 800,
              letterSpacing: '.16em', textTransform: 'uppercase',
              color: cd.urgent ? C.red : C.indigoBright,
            }}>
              Scheduled
            </span>
            {cd.status && (
              <span style={{
                fontFamily: COND, fontSize: 8, fontWeight: 800,
                letterSpacing: '.14em', textTransform: 'uppercase',
                color: accent,
                background: `${accent}1a`,
                border: `1px solid ${accent}40`,
                borderRadius: 5, padding: '1px 6px',
                animation: cd.urgent ? 'srGlowUrg 2s ease-in-out infinite' : 'none',
              }}>
                {cd.status}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {feed.length > 1 && (
              <>
                <button type="button" onClick={prev} aria-label="Previous ride"
                  style={{
                    width: 18, height: 18, borderRadius: 5, padding: 0, cursor: 'pointer',
                    background: 'rgba(129,140,248,.06)', border: '1px solid rgba(129,140,248,.18)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                  <Ico n="back" size={10} color={C.indigoBright} sw={2.4}/>
                </button>
                <span style={{
                  fontFamily: MONO, fontSize: 8.5, fontWeight: 700,
                  color: 'rgba(165,180,252,.55)', minWidth: 32, textAlign: 'center',
                }}>
                  {idx + 1}/{feed.length}
                </span>
                <button type="button" onClick={next} aria-label="Next ride"
                  style={{
                    width: 18, height: 18, borderRadius: 5, padding: 0, cursor: 'pointer',
                    background: 'rgba(129,140,248,.06)', border: '1px solid rgba(129,140,248,.18)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                  <Ico n="fwd" size={10} color={C.indigoBright} sw={2.4}/>
                </button>
              </>
            )}
            <span style={{
              fontFamily: MONO, fontSize: 9, fontWeight: 700,
              color: C.indigoBright, background: 'rgba(129,140,248,.12)',
              border: '1px solid rgba(129,140,248,.22)', borderRadius: 6,
              padding: '1px 7px',
            }}>
              {feed.length}
            </span>
          </div>
        </div>

        {/* ── Queue strip — micro-pills for everything upcoming ─────── */}
        <div className="sr-scroll">
          <QueueStrip feed={feed} idx={idx} now={now} onPick={jumpTo}/>
        </div>

        {/* ── Card body ─────────────────────────────────────────────── */}
        <div
          key={`card-${idx}`}
          style={{
            display: 'flex', flexDirection: 'column', gap: 11,
            padding: '10px 11px 11px',
            background: `linear-gradient(180deg, ${accent}0d, rgba(0,0,0,.18))`,
            border: `1px solid ${accent}33`,
            borderRadius: 12,
            animation: exit ? 'srOut .26s ease both' : 'srIn .32s cubic-bezier(.34,1.2,.64,1) both',
            position: 'relative', overflow: 'hidden',
          }}
        >
          {/* top accent rail */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 2,
            background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
            opacity: 0.7,
          }}/>

          {/* When row — day tile + time + countdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <DayTile ms={curMs} accent={accent}/>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{
                fontFamily: COND, fontSize: 7.5, fontWeight: 800,
                letterSpacing: '.14em', color: C.dim, textTransform: 'uppercase',
              }}>
                Departs
              </div>
              <div style={{
                display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap',
              }}>
                <span style={{
                  fontFamily: MONO, fontSize: 14, fontWeight: 800, color: '#fff',
                  letterSpacing: '-0.5px',
                }}>
                  {formatTimeOnly(curMs)}
                </span>
                <span style={{
                  fontFamily: MONO, fontSize: 9.5, fontWeight: 600, color: 'rgba(255,255,255,.42)',
                }}>
                  · {(formatScheduled(cur.scheduledAt) ?? '').split(',').slice(0, 1).join('')}
                </span>
              </div>
            </div>
            <div style={{
              flexShrink: 0, textAlign: 'right',
              display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.05,
            }}>
              <div style={{
                fontFamily: MONO, fontSize: 16, fontWeight: 800,
                color: accent, letterSpacing: '-0.5px',
                textShadow: `0 0 12px ${accent}55`,
                animation: cd.urgent ? 'srPulseR 1.4s ease-in-out infinite' : 'none',
              }}>
                {cd.text}
              </div>
              <div style={{
                fontFamily: COND, fontSize: 7.5, fontWeight: 800,
                letterSpacing: '.14em', color: C.dim, textTransform: 'uppercase', marginTop: 2,
              }}>
                until pickup
              </div>
            </div>
          </div>

          {/* Route rail */}
          <div style={{ height: 1, background: 'rgba(255,255,255,.05)' }}/>
          <RouteRail pickup={cur.pickup} dropoff={cur.dropoff}/>

          {/* Footer meta */}
          <div style={{ height: 1, background: 'rgba(255,255,255,.05)' }}/>
          <FooterMeta ride={cur}/>
        </div>

        {/* ── Progress bar + pause indicator ────────────────────────── */}
        {feed.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              flex: 1, height: 2, borderRadius: 2,
              background: 'rgba(129,140,248,.08)', overflow: 'hidden',
            }}>
              <div key={`b${idx}-${paused ? 'p' : 'r'}`} style={{
                height: '100%', borderRadius: 2, transformOrigin: 'left',
                background: `linear-gradient(90deg, ${accent}, ${C.violet})`,
                animation: paused ? 'none' : `srBar ${AUTO_CYCLE_MS}ms linear forwards`,
                transform: paused ? 'scaleX(1)' : undefined,
                opacity: paused ? 0.3 : 1,
              }}/>
            </div>
            <Ico n={paused ? 'pause' : 'play'} size={9}
              color={paused ? 'rgba(165,180,252,.6)' : 'rgba(165,180,252,.35)'} sw={2}/>
          </div>
        )}

      </div>
    </>
  );
}
