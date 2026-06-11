import { useMemo, useState, useEffect, useRef } from 'react';
import { Search, Clock, User, Ghost, Car } from 'lucide-react';

function tsToMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  return 0;
}

function fmtRelative(ts) {
  if (!ts) return '—';
  const diff = Math.floor((Date.now() - tsToMillis(ts)) / 1000);
  if (diff < 5)     return 'just now';
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(tsToMillis(ts)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isGuest(s) {
  return !s.uid || s.uid === 'null' || s.uid === null;
}

function LiveTimestamp({ ts }) {
  const [label, setLabel] = useState(() => fmtRelative(ts));
  useEffect(() => {
    setLabel(fmtRelative(ts));
    const id = setInterval(() => setLabel(fmtRelative(ts)), 5000);
    return () => clearInterval(id);
  }, [ts]);
  return (
    <span style={{
      fontFamily: "'JetBrains Mono',monospace",
      fontSize: 9, fontWeight: 700,
      color: 'rgba(96,165,250,.38)', flexShrink: 0,
    }}>
      {label}
    </span>
  );
}

const RIDE_COLOR = {
  economy:  { text: '#22D3EE', bg: 'rgba(6,182,212,.15)',   border: 'rgba(6,182,212,.3)'   },
  standard: { text: '#A78BFA', bg: 'rgba(167,139,250,.15)', border: 'rgba(167,139,250,.3)' },
  premium:  { text: '#FBBF24', bg: 'rgba(251,191,36,.15)',  border: 'rgba(251,191,36,.3)'  },
  xl:       { text: '#34D399', bg: 'rgba(52,211,153,.15)',   border: 'rgba(52,211,153,.3)'  },
};

export default function RecentSearches({ searches = [], loading = false, limit = 5 }) {
  const feed = useMemo(() =>
    [...searches]
      .filter(s => s.pickup && s.dropoff)
      .sort((a, b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt))
      .slice(0, limit),
    [searches, limit]
  );

  const [index,   setIndex]   = useState(0);
  const [exiting, setExiting] = useState(false);
  const timerRef              = useRef(null);

  useEffect(() => { setIndex(0); setExiting(false); }, [feed.length]);

  useEffect(() => {
    if (!feed.length) return;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setExiting(true);
      setTimeout(() => { setIndex(i => (i + 1) % feed.length); setExiting(false); }, 280);
    }, 3800);
    return () => clearInterval(timerRef.current);
  }, [feed.length]);

  const current     = feed[index];
  const guest       = current ? isGuest(current) : false;
  const driverCount = current?.driverCount
    ?? (Array.isArray(current?.match) ? current.match.length : 0);
  const hasDrivers  = driverCount > 0;
  const nearestEta  = current?.nearestEta ?? null;
  const etaLabel    = nearestEta != null ? `~${nearestEta} min` : null;
  const miles       = typeof current?.miles   === 'number' ? current.miles   : null;
  const minutes     = typeof current?.minutes === 'number' ? current.minutes : null;
  const selected    = current?.selectedRide ?? null;
  const rideStyle   = selected ? (RIDE_COLOR[selected] || RIDE_COLOR.economy) : null;
  const fromCity    = current?.pickupCity  || '—';
  const toCity      = current?.dropoffCity || '—';

  return (
    <>
      <style>{`
        @keyframes rs-in  { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
        @keyframes rs-out { from{opacity:1;transform:translateY(0)} to{opacity:0;transform:translateY(-5px)} }
        @keyframes rs-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.35;transform:scale(.65)} }
        @keyframes rs-bar { from{width:0%} to{width:100%} }
        @keyframes rs-car { 0%,100%{transform:translateX(0)} 50%{transform:translateX(2px)} }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '3px 9px', borderRadius: 100,
          background: 'rgba(96,165,250,.12)', border: '1px solid rgba(96,165,250,.22)',
        }}>
          <div style={{
            width: 5, height: 5, borderRadius: '50%', background: '#60A5FA',
            boxShadow: '0 0 7px rgba(96,165,250,.9)',
            animation: 'rs-dot 1.8s ease-in-out infinite',
          }}/>
          <span style={{
            fontFamily: "'Barlow Condensed','Barlow',sans-serif",
            fontSize: 9.5, fontWeight: 800, letterSpacing: '.12em',
            textTransform: 'uppercase', color: '#93C5FD',
          }}>
            Live searches
          </span>
        </div>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ height: 18, borderRadius: 5, width: '70%', background: 'rgba(255,255,255,.08)' }}/>
          <div style={{ height: 10, borderRadius: 5, width: '45%', background: 'rgba(255,255,255,.05)' }}/>
          <div style={{ height: 9,  borderRadius: 5, width: '60%', background: 'rgba(255,255,255,.04)' }}/>
        </div>

      ) : !current ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(147,197,253,.3)', fontSize: 11, fontWeight: 600 }}>
          <Search size={11} strokeWidth={2.2}/> No searches yet
        </div>

      ) : (
        <div
          key={index}
          style={{ animation: exiting ? 'rs-out .28s ease both' : 'rs-in .32s cubic-bezier(.34,1.2,.64,1) both' }}
        >
          {/* ── Route: pickupCity → dropoffCity ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <div style={{
              width: 15, height: 15, borderRadius: 5, flexShrink: 0,
              background: 'rgba(96,165,250,.16)', border: '1px solid rgba(96,165,250,.28)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3 11 22 2 13 21 11 13 3 11"/>
              </svg>
            </div>
            <span style={{
              fontFamily: "'Barlow Condensed','Barlow',sans-serif",
              fontSize: 16, fontWeight: 900, letterSpacing: '-0.2px', lineHeight: 1,
              color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              flex: 1, minWidth: 0,
            }}>
              {fromCity}
            </span>

            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(96,165,250,.3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>

            <div style={{
              width: 15, height: 15, borderRadius: 5, flexShrink: 0,
              background: 'rgba(192,132,252,.12)', border: '1px solid rgba(192,132,252,.22)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#C084FC" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/>
              </svg>
            </div>
            <span style={{
              fontFamily: "'Barlow',sans-serif",
              fontSize: 13, fontWeight: 700, lineHeight: 1,
              color: 'rgba(192,132,252,.75)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              flex: 1, minWidth: 0,
            }}>
              {toCity}
            </span>
          </div>

          {/* ── Trip stats: miles · minutes + selectedRide chip ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            {miles !== null && (
              <span style={{
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.38)',
              }}>
                {miles % 1 === 0 ? miles : miles.toFixed(1)} mi
              </span>
            )}
            {miles !== null && minutes !== null && (
              <span style={{ fontFamily: 'monospace', fontSize: 8, color: 'rgba(255,255,255,.18)' }}>·</span>
            )}
            {minutes !== null && (
              <span style={{
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.38)',
              }}>
                {minutes} min
              </span>
            )}
            <div style={{ flex: 1 }}/>
            {selected && rideStyle && (
              <span style={{
                fontFamily: "'Barlow Condensed','Barlow',sans-serif",
                fontSize: 8, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase',
                color: rideStyle.text,
                padding: '2px 7px', borderRadius: 5,
                background: rideStyle.bg, border: `1px solid ${rideStyle.border}`,
              }}>
                {selected}
              </span>
            )}
          </div>

          {/* ── Meta row ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>

            {/* Guest/Rider pill */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '2px 7px', borderRadius: 99,
              background: guest ? 'rgba(251,191,36,.10)' : 'rgba(96,165,250,.10)',
              border: `1px solid ${guest ? 'rgba(251,191,36,.20)' : 'rgba(96,165,250,.20)'}`,
              flexShrink: 0,
            }}>
              {guest
                ? <Ghost size={8} color="#FCD34D" strokeWidth={2.4}/>
                : <User  size={8} color="#60A5FA" strokeWidth={2.4}/>
              }
              <span style={{
                fontFamily: "'Barlow',sans-serif", fontSize: 9, fontWeight: 800,
                letterSpacing: '.06em', textTransform: 'uppercase',
                color: guest ? '#FCD34D' : '#93C5FD',
              }}>
                {guest ? 'Guest' : 'Rider'}
              </span>
            </div>

            {/* Driver count pill */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '2px 7px', borderRadius: 99,
              background: hasDrivers ? 'rgba(34,197,94,.10)' : 'rgba(239,68,68,.09)',
              border: `1px solid ${hasDrivers ? 'rgba(34,197,94,.22)' : 'rgba(239,68,68,.20)'}`,
              flexShrink: 0,
            }}>
              <Car
                size={8}
                color={hasDrivers ? '#4ADE80' : '#F87171'}
                strokeWidth={2.4}
                style={{ animation: hasDrivers ? 'rs-car 1.6s ease-in-out infinite' : 'none' }}
              />
              <span style={{
                fontFamily: "'Barlow',sans-serif", fontSize: 9, fontWeight: 800,
                letterSpacing: '.04em',
                color: hasDrivers ? '#4ADE80' : '#F87171',
              }}>
                {hasDrivers ? `${driverCount} driver${driverCount > 1 ? 's' : ''}` : 'No drivers'}
              </span>
            </div>

            {/* ETA */}
            {hasDrivers && etaLabel && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                <Clock size={8} color="rgba(74,222,128,.45)" strokeWidth={2.2}/>
                <span style={{
                  fontFamily: "'JetBrains Mono',monospace", fontSize: 9.5, fontWeight: 700,
                  color: 'rgba(74,222,128,.55)',
                }}>
                  {etaLabel}
                </span>
              </div>
            )}

            {/* Timestamp */}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
              <Clock size={8} color="rgba(96,165,250,.28)" strokeWidth={2.2}/>
              <LiveTimestamp ts={current.createdAt}/>
            </div>
          </div>
        </div>
      )}

      {/* ── Progress bar ── */}
      {feed.length > 1 && (
        <div style={{
          marginTop: 10, height: 2, borderRadius: 2,
          background: 'rgba(96,165,250,.10)', overflow: 'hidden',
        }}>
          <div
            key={`bar-${index}`}
            style={{
              height: '100%', borderRadius: 2,
              background: 'linear-gradient(90deg,#60A5FA,#A78BFA)',
              boxShadow: '0 0 5px rgba(96,165,250,.4)',
              animation: 'rs-bar 3.8s linear forwards',
            }}
          />
        </div>
      )}
    </>
  );
}
