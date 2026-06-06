import { useMemo, useState, useEffect, useRef } from 'react';
import { Search, MapPin, Navigation, Clock, User, Ghost } from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────────
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
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(tsToMillis(ts)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function strip(addr) {
  if (!addr) return '—';
  return addr
    .replace(/^\s*\d+\s+[A-Za-z0-9.-]+\s+/, '')
    .replace(/,\s*(Orlando|Tampa|Kissimmee|Winter Haven|Winter Park|Ocoee|Lakeland|FL|USA).*$/i, '')
    .trim();
}

function isGuest(s) {
  return !s.uid || s.uid === 'null' || s.uid === null;
}

// ── Main ───────────────────────────────────────────────────────────────────
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

  const cycle = () => {
    if (!feed.length) return;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setExiting(true);
      setTimeout(() => {
        setIndex(i => (i + 1) % feed.length);
        setExiting(false);
      }, 320);
    }, 3800);
  };

  useEffect(() => {
    cycle();
    return () => clearInterval(timerRef.current);
  }, [feed.length]); // eslint-disable-line

  const current = feed[index];
  const guest   = current ? isGuest(current) : false;

  return (
    <>
      <style>{`
        @keyframes rs-in {
          0%   { opacity: 0; transform: translateY(5px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes rs-out {
          0%   { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-5px); }
        }
        @keyframes rs-dot {
          0%,100% { opacity:1; transform:scale(1); }
          50%     { opacity:.4; transform:scale(.75); }
        }
        @keyframes rs-bar {
          0%   { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>

      {/* ── Header pill ── */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 10px', borderRadius: 100,
        background: 'rgba(96,165,250,.12)',
        border: '1px solid rgba(96,165,250,.25)',
        marginBottom: 10,
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: '#60A5FA',
          boxShadow: '0 0 8px rgba(96,165,250,0.9)',
          animation: 'rs-dot 1.8s ease-in-out infinite',
        }}/>
        <span style={{
          fontFamily: "'Barlow Condensed', 'Barlow', sans-serif",
          fontSize: 10, fontWeight: 800, letterSpacing: '.12em',
          textTransform: 'uppercase', color: '#93C5FD',
        }}>
          Live searches
        </span>
        {feed.length > 0 && (
          <span style={{
            fontFamily: "'Barlow Condensed', 'Barlow', sans-serif",
            fontSize: 10, fontWeight: 700,
            color: 'rgba(147,197,253,.55)',
          }}>
            · {feed.length}
          </span>
        )}
      </div>

      {/* ── Content ── */}
      {loading ? (
        /* skeleton */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[80, 55].map((w, i) => (
            <div key={i} style={{
              height: 10, borderRadius: 6, width: `${w}%`,
              background: 'rgba(255,255,255,.08)',
            }}/>
          ))}
        </div>

      ) : !current ? (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          color: 'rgba(147,197,253,.35)', fontSize: 12, fontWeight: 600,
        }}>
          <Search size={13} strokeWidth={2.2}/>
          No searches yet
        </div>

      ) : (
        /* ── Single live card ── */
        <div
          key={index}
          style={{
            animation: exiting
              ? 'rs-out .32s cubic-bezier(.4,0,1,1) both'
              : 'rs-in  .38s cubic-bezier(.34,1.2,.64,1) both',
          }}
        >
          {/* Route row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>

            {/* Icon column */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 2, gap: 0, flexShrink: 0 }}>
              <div style={{
                width: 22, height: 22, borderRadius: 7,
                background: 'rgba(96,165,250,.18)',
                border: '1px solid rgba(96,165,250,.30)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Navigation size={11} color="#60A5FA" strokeWidth={2.4}/>
              </div>
              <div style={{ width: 1, height: 14, background: 'rgba(96,165,250,.20)', margin: '2px 0' }}/>
              <div style={{
                width: 22, height: 22, borderRadius: 7,
                background: 'rgba(192,132,252,.14)',
                border: '1px solid rgba(192,132,252,.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <MapPin size={11} color="#C084FC" strokeWidth={2.4}/>
              </div>
            </div>

            {/* Text column */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Pickup */}
              <div style={{
                fontFamily: "'Barlow Condensed', 'Barlow', sans-serif",
                fontSize: 18, fontWeight: 900, letterSpacing: '-0.3px', lineHeight: 1.1,
                color: '#fff',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                marginBottom: 2,
              }}>
                {strip(current.pickup)}
              </div>
              {/* Dropoff */}
              <div style={{
                fontFamily: "'Barlow', sans-serif",
                fontSize: 12, fontWeight: 600, lineHeight: 1.2,
                color: 'rgba(192,132,252,.75)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                marginBottom: 8,
              }}>
                {strip(current.dropoff)}
              </div>

              {/* Meta row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {/* Rider type pill */}
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '2px 8px', borderRadius: 99,
                  background: guest ? 'rgba(251,191,36,.10)' : 'rgba(96,165,250,.10)',
                  border: `1px solid ${guest ? 'rgba(251,191,36,.22)' : 'rgba(96,165,250,.22)'}`,
                }}>
                  {guest
                    ? <Ghost size={9} color="#FCD34D" strokeWidth={2.4}/>
                    : <User  size={9} color="#60A5FA" strokeWidth={2.4}/>
                  }
                  <span style={{
                    fontFamily: "'Barlow', sans-serif",
                    fontSize: 10, fontWeight: 800, letterSpacing: '.06em',
                    color: guest ? '#FCD34D' : '#93C5FD',
                    textTransform: 'uppercase',
                  }}>
                    {guest ? 'Guest' : 'Rider'}
                  </span>
                </div>

                {/* Time */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={10} color="rgba(147,197,253,.45)" strokeWidth={2.2}/>
                  <span style={{
                    fontFamily: "'Barlow', sans-serif",
                    fontSize: 11, fontWeight: 600,
                    color: 'rgba(147,197,253,.5)',
                  }}>
                    {fmtRelative(current.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Progress bar + counter ── */}
      {feed.length > 1 && (
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Progress bar */}
          <div style={{
            flex: 1, height: 2, borderRadius: 2,
            background: 'rgba(96,165,250,.12)',
            overflow: 'hidden',
          }}>
            <div
              key={`bar-${index}`}
              style={{
                height: '100%', borderRadius: 2,
                background: 'linear-gradient(90deg,#60A5FA,#A78BFA)',
                boxShadow: '0 0 6px rgba(96,165,250,.5)',
                animation: `rs-bar ${3.8}s linear forwards`,
              }}
            />
          </div>
          {/* n/total */}
          <span style={{
            fontFamily: "'Barlow', monospace",
            fontSize: 10, fontWeight: 700,
            color: 'rgba(96,165,250,.4)',
            flexShrink: 0,
          }}>
            {index + 1}/{feed.length}
          </span>
        </div>
      )}
    </>
  );
}
