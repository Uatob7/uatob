import { useMemo, useState, useEffect, useRef } from 'react';

const C = {
  bg:       '#050A06',
  bgCard:   'rgba(255,255,255,.035)',
  border:   'rgba(129,140,248,.20)',
  borderDim:'rgba(129,140,248,.09)',
  indigo:   '#818CF8',
  indigoBright: '#A5B4FC',
  violet:   '#C084FC',
  green:    '#4ADE80',
  greenDim: 'rgba(74,222,128,.09)',
  greenBorder:'rgba(74,222,128,.22)',
  red:      '#F87171',
  redDim:   'rgba(248,113,113,.09)',
  amber:    '#FCD34D',
  white:    '#fff',
  dim:      'rgba(255,255,255,.32)',
  fade:     'rgba(255,255,255,.14)',
};
const MONO = "'JetBrains Mono','SFMono-Regular',monospace";
const COND = "'Barlow Condensed','Barlow',sans-serif";

function tsToMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  return 0;
}

function stripAddr(a) {
  if (!a) return '—';
  return a
    .replace(/,\s*(Orlando|Tampa|Kissimmee|Sanford|FL|USA).*$/i, '')
    .trim() || a;
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

function pmColor(method) {
  if (!method) return C.dim;
  if (method === 'cash')    return C.amber;
  if (method === 'cashapp') return '#00D632';
  return C.indigoBright; // card
}
function pmLabel(method) {
  if (!method) return '—';
  if (method === 'cash')    return 'Cash';
  if (method === 'cashapp') return 'Cash App';
  return 'Card';
}

function RideTypeChip({ type, label }) {
  const colors = {
    economy:  { bg: 'rgba(74,222,128,.08)',  border: 'rgba(74,222,128,.22)',  text: '#4ADE80'  },
    standard: { bg: 'rgba(129,140,248,.08)', border: 'rgba(129,140,248,.22)', text: '#A5B4FC'  },
    premium:  { bg: 'rgba(234,179,8,.08)',   border: 'rgba(234,179,8,.22)',   text: '#FCD34D'  },
    xl:       { bg: 'rgba(192,132,252,.08)', border: 'rgba(192,132,252,.22)', text: '#C084FC'  },
  };
  const s = colors[type] || colors.standard;
  return (
    <span style={{
      fontFamily: COND, fontSize: 8.5, fontWeight: 800, letterSpacing: '.1em',
      textTransform: 'uppercase', padding: '2px 7px', borderRadius: 6,
      background: s.bg, border: `1px solid ${s.border}`, color: s.text,
    }}>
      {label || type}
    </span>
  );
}

export default function ScheduledRidesCard({ scheduledRides = [] }) {
  const feed = useMemo(() =>
    [...scheduledRides]
      .filter(r => r.pickup && r.dropoff && r.isScheduled)
      .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
      .slice(0, 8),
    [scheduledRides]
  );

  const [idx,  setIdx]  = useState(0);
  const [exit, setExit] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    setIdx(0);
  }, [feed.length]);

  useEffect(() => {
    if (feed.length < 2) return;
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      setExit(true);
      setTimeout(() => { setIdx(x => (x + 1) % feed.length); setExit(false); }, 280);
    }, 4200);
    return () => clearInterval(timer.current);
  }, [feed.length]);

  const cur = feed[idx];

  return (
    <>
      <style>{`
        @keyframes srIn  { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
        @keyframes srOut { to{opacity:0;transform:translateY(-4px)} }
        @keyframes srDot { 0%,100%{opacity:1} 50%{opacity:.25} }
        @keyframes srBar { from{width:0} to{width:100%} }
      `}</style>

      <div style={{ padding: '12px 13px 13px', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 5, height: 5, borderRadius: '50%',
              background: C.indigo, boxShadow: `0 0 6px ${C.indigo}`,
              animation: 'srDot 2s ease-in-out infinite',
            }}/>
            <span style={{
              fontFamily: COND, fontSize: 9.5, fontWeight: 800,
              letterSpacing: '.16em', textTransform: 'uppercase', color: C.indigoBright,
            }}>
              Scheduled Rides
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {feed.length > 0 && (
              <span style={{
                fontFamily: MONO, fontSize: 8.5, fontWeight: 700,
                color: 'rgba(165,180,252,.35)',
              }}>
                {idx + 1} / {feed.length}
              </span>
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

        {/* ── Divider ── */}
        <div style={{ height: 1, background: 'rgba(129,140,248,.08)' }}/>

        {/* ── Empty ── */}
        {!cur ? (
          <div style={{
            minHeight: 72, display: 'flex', alignItems: 'center', gap: 8,
            fontFamily: MONO, fontSize: 10, color: C.dim,
          }}>
            No scheduled rides
          </div>
        ) : (
          <div
            key={idx}
            style={{
              display: 'flex', flexDirection: 'column', gap: 9, minHeight: 72,
              animation: exit ? 'srOut .28s ease both' : 'srIn .32s cubic-bezier(.34,1.2,.64,1) both',
            }}
          >
            {/* Route row */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {[
                { dot: C.green,  glow: true,  val: stripAddr(cur.pickup)  },
                { dot: C.indigo, glow: false, val: stripAddr(cur.dropoff) },
              ].map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: r.dot,
                    boxShadow: r.glow ? `0 0 5px ${r.dot}88` : 'none',
                  }}/>
                  <span style={{
                    fontFamily: i === 0 ? COND : MONO,
                    fontSize: i === 0 ? 14 : 10,
                    fontWeight: i === 0 ? 900 : 500,
                    color: i === 0 ? C.white : C.dim,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    letterSpacing: i === 0 ? '.02em' : 0,
                  }}>
                    {r.val}
                  </span>
                </div>
              ))}
            </div>

            {/* When row */}
            {cur.scheduledAt && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 9px', borderRadius: 8,
                background: 'rgba(129,140,248,.07)',
                border: '1px solid rgba(129,140,248,.14)',
              }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                  stroke={C.indigoBright} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <span style={{
                  fontFamily: MONO, fontSize: 9.5, fontWeight: 600, color: C.indigoBright,
                }}>
                  {formatScheduled(cur.scheduledAt)}
                </span>
              </div>
            )}

            {/* Meta pills row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <RideTypeChip type={cur.rideType} label={cur.rideLabel}/>

              <span style={{
                fontFamily: MONO, fontSize: 8.5, fontWeight: 700,
                color: pmColor(cur.paymentMethod),
                background: 'rgba(255,255,255,.04)',
                border: '1px solid rgba(255,255,255,.08)',
                borderRadius: 6, padding: '2px 7px',
              }}>
                {pmLabel(cur.paymentMethod)}
              </span>

              {cur.fareTotal != null && (
                <span style={{
                  marginLeft: 'auto',
                  fontFamily: MONO, fontSize: 13, fontWeight: 800,
                  color: C.green, letterSpacing: '-0.5px',
                }}>
                  ${Number(cur.fareTotal).toFixed(2)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Progress bar ── */}
        {feed.length > 1 && (
          <div style={{
            height: 2, borderRadius: 2,
            background: 'rgba(129,140,248,.08)', overflow: 'hidden',
          }}>
            <div key={`b${idx}`} style={{
              height: '100%', borderRadius: 2,
              background: 'linear-gradient(90deg,#818CF8,#C084FC)',
              animation: 'srBar 4.2s linear forwards',
            }}/>
          </div>
        )}

      </div>
    </>
  );
}