// SearchesCard.jsx — Live search activity panel for the rider StatusCard.
//
// Shows the pulse of riders booking right now across Orlando. Same radar /
// scanline / mono aesthetic as the rest of UaTob, but a cyan accent so it
// reads as "ambient signal" rather than the green "your ride" channel.
//
// Layout, top → bottom:
//   1. Header row — radar icon, "Live Searches" eyebrow, live pip, count badge
//   2. Sparkline rail — 12 vertical bars (last 60 min, 5-min buckets) showing
//      booking velocity, with a soft trailing gradient
//   3. Activity ticker — most recent searches as compact rows with relative
//      time + truncated pickup label
//   4. Footer metric strip — three stats: surge, avg ETA, busiest direction
//
// Data assumptions (graceful fallbacks for all):
//   - search.pickupLat / pickupLng   (number)
//   - search.pickup                  (string label)
//   - search.createdAt               (Firestore Timestamp, Date, or millis)
//   - search.uid                     ('null' / falsy → guest)
//   - search.rideType                (string, optional)

import { useMemo, useEffect, useState } from 'react';
import { C, MONO, COND } from '@/App/UaTob/Statuscardtokens';

// ─── helpers ────────────────────────────────────────────────────────────────
const hasCoords = (item) => typeof item?.pickupLat === 'number' && typeof item?.pickupLng === 'number';

function tsToMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') { const p = Date.parse(ts); return Number.isNaN(p) ? 0 : p; }
  return 0;
}

function fmtAgo(ms, now) {
  if (!ms) return '—';
  const d = Math.max(0, now - ms);
  const s = Math.floor(d / 1000);
  if (s < 10)   return 'now';
  if (s < 60)   return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60)   return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
function stripStreetNumber(s) {
  if (!s) return s;
  return s.replace(/^\d+[-–]?\d*\s+/, '');
}

// Compass label for a bearing in degrees
function compassFromBearing(b) {
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(((Number(b) || 0) % 360 + 360) % 360 / 45) % 8];
}

// Bearing from Orlando city center → a point (used to find busiest cardinal)
const ORL_LAT = 28.5383, ORL_LNG = -81.3792;
function bearingFromOrlando(lat, lng) {
  const φ1 = ORL_LAT * Math.PI / 180;
  const φ2 = lat     * Math.PI / 180;
  const Δλ = (lng - ORL_LNG) * Math.PI / 180;
  const y  = Math.sin(Δλ) * Math.cos(φ2);
  const x  = Math.cos(φ1) * Math.sin(φ2)
           - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

// ─── icons ──────────────────────────────────────────────────────────────────
function Ico({ n, size = 14, color = 'currentColor', sw = 1.7, style: sx }) {
  const p = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round', style: sx,
  };
  switch (n) {
    case 'radar':  return <svg {...p}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/><line x1="12" y1="2" x2="12" y2="4"/></svg>;
    case 'pin':    return <svg {...p}><path d="M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg>;
    case 'user':   return <svg {...p}><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/></svg>;
    case 'guest':  return <svg {...p}><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/><line x1="2" y1="2" x2="22" y2="22" opacity=".5"/></svg>;
    case 'trend':  return <svg {...p}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>;
    case 'flame':  return <svg {...p}><path d="M8.5 14.5c0-2 1.5-3 1.5-5s-1.5-2.5-1.5-4.5C12 6 16 8 16 13.5a4 4 0 0 1-7.5 1z"/><path d="M8.5 14.5C7 16 6 17 6 18.5a6 6 0 0 0 12 0c0-2-1.5-3-1.5-5"/></svg>;
    case 'arrow':  return <svg {...p}><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>;
    case 'clock':  return <svg {...p}><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>;
    case 'wave':   return <svg {...p}><path d="M2 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0 2 4 2 4"/></svg>;
    default:       return null;
  }
}

// ─── design constants ───────────────────────────────────────────────────────
const CYAN        = '#06B6D4';
const CYAN_BRIGHT = '#22D3EE';
const CYAN_SOFT   = '#67E8F9';
const CYAN_DIM    = 'rgba(6,182,212,';
const AMBER       = '#FBBF24';

// Sparkline config
const BUCKET_COUNT  = 12;
const BUCKET_MIN    = 5;
const WINDOW_MS     = BUCKET_COUNT * BUCKET_MIN * 60_000;   // 60 min

// Ticker config
const TICKER_LIMIT  = 4;

// ─── sparkline ──────────────────────────────────────────────────────────────
// Buckets the searches into 5-minute windows over the last hour, then renders
// vertical bars normalized to the busiest bucket. The most recent bar gets a
// glow + label callout so the eye lands on "right now".
function Sparkline({ searches, now }) {
  const { buckets, peak, total } = useMemo(() => {
    const arr = new Array(BUCKET_COUNT).fill(0);
    const startMs = now - WINDOW_MS;
    let pk = 0;
    let tot = 0;
    for (const s of searches) {
      const ts = tsToMillis(s.createdAt);
      if (!ts || ts < startMs || ts > now) continue;
      const idx = Math.min(BUCKET_COUNT - 1, Math.floor((ts - startMs) / (BUCKET_MIN * 60_000)));
      arr[idx]++;
      tot++;
      if (arr[idx] > pk) pk = arr[idx];
    }
    return { buckets: arr, peak: pk, total: tot };
  }, [searches, now]);

  if (peak === 0) {
    // empty state — flat baseline with a "no signal" caption
    return (
      <div style={{
        height: 44, display: 'flex', alignItems: 'flex-end', gap: 3,
        padding: '0 2px', position: 'relative',
      }}>
        {Array.from({ length: BUCKET_COUNT }).map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 1.5,
            background: 'rgba(255,255,255,.04)',
          }}/>
        ))}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,.22)',
          letterSpacing: '.08em',
        }}>
          no signal in last hour
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', height: 44, padding: '0 2px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: '100%' }}>
        {buckets.map((v, i) => {
          const isLast = i === BUCKET_COUNT - 1;
          const isPeak = v === peak && peak > 0;
          // Height: 3px min for "had at least one", scale by peak
          const h = v === 0 ? 3 : Math.max(5, Math.round((v / peak) * 38));
          return (
            <div key={i} style={{
              flex: 1, height: h, borderRadius: 2,
              background: v === 0
                ? 'rgba(255,255,255,.05)'
                : isLast
                  ? `linear-gradient(to top, ${CYAN}, ${CYAN_BRIGHT})`
                  : `linear-gradient(to top, ${CYAN_DIM}.35), ${CYAN_DIM}.65))`,
              boxShadow: isLast && v > 0 ? `0 0 8px ${CYAN_DIM}.55)` : isPeak ? `0 0 4px ${CYAN_DIM}.4)` : 'none',
              transition: 'height .35s ease',
            }}/>
          );
        })}
      </div>
      <div style={{
        position: 'absolute', top: -2, right: 0,
        display: 'flex', alignItems: 'baseline', gap: 4,
      }}>
        <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: CYAN_BRIGHT }}>
          {buckets[BUCKET_COUNT - 1]}
        </span>
        <span style={{
          fontFamily: COND, fontSize: 7, fontWeight: 800,
          letterSpacing: '.12em', color: 'rgba(255,255,255,.28)',
          textTransform: 'uppercase',
        }}>
          this 5m
        </span>
      </div>
      <div style={{
        position: 'absolute', bottom: -14, left: 0, right: 0,
        display: 'flex', justifyContent: 'space-between',
        fontFamily: MONO, fontSize: 7.5, color: 'rgba(255,255,255,.22)',
        letterSpacing: '.06em',
      }}>
        <span>−60m</span>
        <span style={{ fontWeight: 700, color: 'rgba(255,255,255,.36)' }}>{total} total</span>
        <span>now</span>
      </div>
    </div>
  );
}

// ─── ticker row ─────────────────────────────────────────────────────────────
function TickerRow({ search, now, index }) {
  const ts      = tsToMillis(search.createdAt);
  const isGuest = !search.uid || search.uid === 'null';
  const label   = stripStreetNumber(search.pickup) || (hasCoords(search)
    ? `${search.pickupLat.toFixed(3)}, ${search.pickupLng.toFixed(3)}`
    : 'Pickup');

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '5px 8px', borderRadius: 7,
      background: index === 0 ? 'rgba(6,182,212,.06)' : 'transparent',
      borderLeft: index === 0 ? `2px solid ${CYAN}` : '2px solid transparent',
      animation: 'scFadeIn .3s ease both',
      animationDelay: `${index * 40}ms`,
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
        background: isGuest ? 'rgba(251,191,36,.14)' : 'rgba(6,182,212,.14)',
        border: `1px solid ${isGuest ? 'rgba(251,191,36,.3)' : 'rgba(6,182,212,.3)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Ico n={isGuest ? 'guest' : 'user'} size={9} color={isGuest ? AMBER : CYAN_BRIGHT} sw={1.8}/>
      </div>
      <span style={{
        flex: 1, minWidth: 0,
        fontFamily: MONO, fontSize: 9.5, fontWeight: 500,
        color: 'rgba(255,255,255,.62)',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {truncate(label, 32)}
      </span>
      {search.rideType && (
        <span style={{
          fontFamily: COND, fontSize: 7.5, fontWeight: 800,
          letterSpacing: '.1em', color: 'rgba(255,255,255,.38)',
          textTransform: 'uppercase',
          padding: '1px 6px', borderRadius: 4,
          background: 'rgba(255,255,255,.04)',
        }}>
          {search.rideType}
        </span>
      )}
      <span style={{
        fontFamily: MONO, fontSize: 9, fontWeight: 700, color: CYAN_SOFT,
        minWidth: 30, textAlign: 'right',
      }}>
        {fmtAgo(ts, now)}
      </span>
    </div>
  );
}

// ─── footer metrics ─────────────────────────────────────────────────────────
function MetricCell({ label, value, hint, accent }) {
  return (
    <div style={{
      flex: 1, padding: '8px 10px',
      display: 'flex', flexDirection: 'column', gap: 2, lineHeight: 1.1,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{
          fontFamily: MONO, fontSize: 13, fontWeight: 800,
          color: accent || '#fff',
        }}>
          {value}
        </span>
        {hint && (
          <span style={{
            fontFamily: MONO, fontSize: 8, fontWeight: 700,
            color: 'rgba(255,255,255,.28)',
          }}>
            {hint}
          </span>
        )}
      </div>
      <span style={{
        fontFamily: COND, fontSize: 7.5, fontWeight: 800,
        letterSpacing: '.14em', color: 'rgba(255,255,255,.32)',
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SearchesCard
// ═════════════════════════════════════════════════════════════════════════════
export default function SearchesCard({ searches = [] }) {
  // Re-render every 15s so timestamps tick and the sparkline window slides
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  // ── derived ────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const all = (searches || []).filter(Boolean);

    // Live searches with coords (matches your original definition)
    const live = all.filter(hasCoords);

    // Recent activity buckets
    const last5  = all.filter(s => now - tsToMillis(s.createdAt) <= 5  * 60_000).length;
    const last15 = all.filter(s => now - tsToMillis(s.createdAt) <= 15 * 60_000).length;
    const last60 = all.filter(s => now - tsToMillis(s.createdAt) <= 60 * 60_000).length;
    const prevHour = all.filter(s => {
      const d = now - tsToMillis(s.createdAt);
      return d > 60 * 60_000 && d <= 120 * 60_000;
    }).length;

    // Trend vs previous hour → percentage change, capped at ±999
    let trend = null;
    if (prevHour > 0) {
      const pct = Math.round(((last60 - prevHour) / prevHour) * 100);
      trend = Math.max(-999, Math.min(999, pct));
    } else if (last60 > 0) {
      trend = 100;
    }

    // Surge intensity — derived from rolling rate (searches per 5 min)
    // Quiet < 3, Steady 3-6, Busy 7-12, Surge 13+
    const surgeLabel =
      last5 >= 13 ? 'SURGE' :
      last5 >= 7  ? 'BUSY'  :
      last5 >= 3  ? 'STEADY':
                    'QUIET';
    const surgeColor =
      surgeLabel === 'SURGE'  ? '#F87171' :
      surgeLabel === 'BUSY'   ? AMBER     :
      surgeLabel === 'STEADY' ? CYAN_BRIGHT :
                                'rgba(255,255,255,.42)';

    // Busiest direction from city center
    const dirCounts = { N:0, NE:0, E:0, SE:0, S:0, SW:0, W:0, NW:0 };
    for (const s of live) {
      const b = bearingFromOrlando(s.pickupLat, s.pickupLng);
      dirCounts[compassFromBearing(b)]++;
    }
    let topDir = null, topDirCount = 0;
    for (const k of Object.keys(dirCounts)) {
      if (dirCounts[k] > topDirCount) { topDir = k; topDirCount = dirCounts[k]; }
    }

    // Guest share
    const guestCount = all.filter(s => !s.uid || s.uid === 'null').length;
    const guestPct   = all.length > 0 ? Math.round((guestCount / all.length) * 100) : 0;

    // Most recent + ticker
    const sorted = [...all].sort((a, b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt));
    const ticker = sorted.slice(0, TICKER_LIMIT);
    const newest = sorted[0] || null;
    const newestAgoMs = newest ? now - tsToMillis(newest.createdAt) : null;

    return {
      live, last5, last15, last60, prevHour, trend,
      surgeLabel, surgeColor, topDir, topDirCount, guestCount, guestPct,
      ticker, newest, newestAgoMs,
    };
  }, [searches, now]);

  const { live, last5, last15, trend, surgeLabel, surgeColor,
          topDir, topDirCount, guestPct, ticker, newest, newestAgoMs } = stats;

  const liveCount = live.length;
  const isHot     = surgeLabel === 'SURGE' || surgeLabel === 'BUSY';

  // Trend display
  let trendVal  = '—';
  let trendDir  = null;   // 'up' | 'down' | null
  let trendCol  = 'rgba(255,255,255,.42)';
  if (trend !== null) {
    if (trend > 0)      { trendVal = `+${trend}%`; trendDir = 'up';   trendCol = CYAN_BRIGHT; }
    else if (trend < 0) { trendVal = `${trend}%`;  trendDir = 'down'; trendCol = 'rgba(255,255,255,.42)'; }
    else                { trendVal = '±0%';        trendDir = null;   trendCol = 'rgba(255,255,255,.42)'; }
  }

  return (
    <>
      <style>{`
        @keyframes scBlink   { 0%,100%{opacity:1} 50%{opacity:.22} }
        @keyframes scGlow    { 0%,100%{box-shadow:0 0 18px rgba(6,182,212,.18)} 50%{box-shadow:0 0 30px rgba(6,182,212,.45)} }
        @keyframes scGlowHot { 0%,100%{box-shadow:0 0 22px rgba(251,191,36,.30)} 50%{box-shadow:0 0 38px rgba(251,191,36,.55)} }
        @keyframes scSweep   { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
        @keyframes scFadeIn  { from{opacity:0;transform:translateY(2px)} to{opacity:1;transform:translateY(0)} }
        @keyframes scPing    { 0%{transform:scale(1);opacity:.6} 80%{transform:scale(2.6);opacity:0} 100%{opacity:0} }
        @keyframes scRotate  { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{
        background: `linear-gradient(180deg, rgba(6,182,212,.05), rgba(6,182,212,.02))`,
        border: `1px solid ${isHot ? 'rgba(251,191,36,.28)' : 'rgba(6,182,212,.20)'}`,
        borderRadius: 14, padding: 0,
        boxShadow: `0 0 0 1px rgba(6,182,212,.04), 0 6px 22px rgba(0,0,0,.32)`,
        overflow: 'hidden', position: 'relative',
      }}>

        {/* top accent rail — a faint shimmer to imply ambient live activity */}
        <div style={{
          height: 1.5, position: 'relative', overflow: 'hidden',
          background: `linear-gradient(90deg, transparent, ${isHot ? 'rgba(251,191,36,.55)' : 'rgba(6,182,212,.55)'}, transparent)`,
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: `linear-gradient(90deg, transparent 30%, rgba(255,255,255,.6) 50%, transparent 70%)`,
            animation: 'scSweep 3.6s ease-in-out infinite',
            mixBlendMode: 'overlay',
          }}/>
        </div>

        {/* ── Header row ─────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 14px 10px',
        }}>
          {/* Animated radar icon */}
          <div style={{
            width: 42, height: 42, borderRadius: 12, flexShrink: 0,
            background: isHot ? 'rgba(251,191,36,.12)' : 'rgba(6,182,212,.10)',
            border: `1px solid ${isHot ? 'rgba(251,191,36,.32)' : 'rgba(6,182,212,.28)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: `${isHot ? 'scGlowHot' : 'scGlow'} 2.8s ease-in-out infinite`,
            position: 'relative',
          }}>
            {/* faint outer ping */}
            <div style={{
              position: 'absolute', inset: -4, borderRadius: '50%',
              border: `1px solid ${isHot ? 'rgba(251,191,36,.4)' : 'rgba(6,182,212,.4)'}`,
              animation: 'scPing 2.4s ease-out infinite',
              pointerEvents: 'none',
            }}/>
            {/* slowly rotating radar glyph */}
            <div style={{ animation: 'scRotate 9s linear infinite', display: 'flex' }}>
              <Ico n="radar" size={20} color={isHot ? AMBER : CYAN_BRIGHT}/>
            </div>
          </div>

          {/* Label stack */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
              <span style={{
                fontFamily: COND, fontSize: 9, fontWeight: 800,
                letterSpacing: '.18em', color: isHot ? AMBER : CYAN_SOFT,
                textTransform: 'uppercase',
              }}>
                Live Demand
              </span>
              <span style={{
                fontFamily: MONO, fontSize: 7.5, fontWeight: 700,
                color: 'rgba(255,255,255,.28)', letterSpacing: '.06em',
              }}>
                · Orlando metro
              </span>
            </div>
            <div style={{
              fontFamily: COND, fontSize: 22, fontWeight: 900,
              letterSpacing: '.02em', color: '#fff', lineHeight: 1.02,
              marginTop: 2,
            }}>
              {liveCount} <span style={{ color: 'rgba(255,255,255,.5)', fontWeight: 700 }}>searching</span>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, marginTop: 4,
              flexWrap: 'wrap',
            }}>
              <div style={{
                width: 5, height: 5, borderRadius: '50%', background: isHot ? AMBER : CYAN_BRIGHT,
                boxShadow: `0 0 5px ${isHot ? AMBER : CYAN_BRIGHT}`,
                animation: 'scBlink 1.6s ease-in-out infinite',
                flexShrink: 0,
              }}/>
              <span style={{ fontFamily: MONO, fontSize: 8.5, color: 'rgba(255,255,255,.35)' }}>
                {newest && newestAgoMs != null && newestAgoMs < 60_000
                  ? `last ping ${fmtAgo(tsToMillis(newest.createdAt), now)} ago`
                  : `${last5} in last 5m · ${last15} in last 15m`}
              </span>
            </div>
          </div>

          {/* Badge: live count + trend arrow */}
          <div style={{
            flexShrink: 0, background: 'rgba(6,182,212,.10)',
            border: `1px solid ${isHot ? 'rgba(251,191,36,.32)' : 'rgba(6,182,212,.28)'}`,
            borderRadius: 11, padding: '7px 12px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
            minWidth: 60,
          }}>
            <span style={{
              fontFamily: MONO, fontSize: 19, fontWeight: 800,
              color: isHot ? AMBER : CYAN_BRIGHT, lineHeight: 1,
              textShadow: `0 0 14px ${isHot ? 'rgba(251,191,36,.55)' : 'rgba(6,182,212,.55)'}`,
            }}>
              {liveCount}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 1 }}>
              {trendDir === 'up' && (
                <Ico n="arrow" size={8} color={trendCol} sw={2.4}
                  style={{ transform: 'rotate(-45deg)' }}/>
              )}
              {trendDir === 'down' && (
                <Ico n="arrow" size={8} color={trendCol} sw={2.4}
                  style={{ transform: 'rotate(45deg)' }}/>
              )}
              <span style={{
                fontFamily: MONO, fontSize: 8.5, fontWeight: 800,
                color: trendCol, letterSpacing: '.04em',
              }}>
                {trendVal}
              </span>
            </div>
          </div>
        </div>

        {/* ── Sparkline rail ─────────────────────────────────────────── */}
        <div style={{
          padding: '6px 14px 22px',
          borderTop: '1px solid rgba(255,255,255,.04)',
          borderBottom: '1px solid rgba(255,255,255,.04)',
          background: 'rgba(0,0,0,.18)',
          position: 'relative',
        }}>
          <Sparkline searches={searches} now={now}/>
        </div>

        {/* ── Ticker ────────────────────────────────────────────────── */}
        {ticker.length > 0 ? (
          <div style={{ padding: '8px 8px 4px', display: 'flex', flexDirection: 'column', gap: 1 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0 8px 4px',
            }}>
              <span style={{
                fontFamily: COND, fontSize: 8, fontWeight: 800,
                letterSpacing: '.18em', color: 'rgba(255,255,255,.42)',
                textTransform: 'uppercase',
              }}>
                Recent pings
              </span>
              <span style={{
                fontFamily: MONO, fontSize: 7.5, fontWeight: 700,
                color: 'rgba(255,255,255,.24)',
              }}>
                {ticker.length} of {searches.length}
              </span>
            </div>
            {ticker.map((s, i) => (
              <TickerRow key={s.id || `${i}-${tsToMillis(s.createdAt)}`}
                search={s} now={now} index={i}/>
            ))}
          </div>
        ) : (
          <div style={{
            padding: '14px 14px 12px', textAlign: 'center',
            fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,.22)',
            letterSpacing: '.06em',
          }}>
            no recent pings — the radar is quiet
          </div>
        )}

        {/* ── Footer metric strip ───────────────────────────────────── */}
        <div style={{
          display: 'flex',
          borderTop: '1px solid rgba(255,255,255,.05)',
          background: 'linear-gradient(180deg, rgba(0,0,0,.18), rgba(0,0,0,.32))',
        }}>
          <MetricCell
            label="Pulse"
            value={surgeLabel}
            accent={surgeColor}
          />
          <div style={{ width: 1, background: 'rgba(255,255,255,.05)' }}/>
          <MetricCell
            label="Direction"
            value={topDir || '—'}
            hint={topDir ? `×${topDirCount}` : undefined}
            accent={topDir ? CYAN_BRIGHT : 'rgba(255,255,255,.42)'}
          />
          <div style={{ width: 1, background: 'rgba(255,255,255,.05)' }}/>
          <MetricCell
            label="Guests"
            value={`${guestPct}%`}
            accent={guestPct > 0 ? AMBER : 'rgba(255,255,255,.42)'}
          />
        </div>
      </div>
    </>
  );
}
