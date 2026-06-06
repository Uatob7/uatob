import { useMemo } from 'react';
import { MapPin, Clock, Ruler, Users, UserX, ArrowRight, Activity, Banknote } from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────
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
  return addr.replace(/, (Orlando|Tampa|Kissimmee|Winter Haven|Winter Park|Ocoee|Lakeland|FL|USA),?.*$/i, '').trim();
}

function isGuest(s) {
  return !s.uid || s.uid === 'null' || s.uid === null;
}

// Stable color per route based on id hash
function routeHue(id = '') {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffff;
  return h % 360;
}

const TIER_COLOR = {
  economy:  '#34D399',
  standard: '#60A5FA',
  premium:  '#C084FC',
  xl:       '#FB923C',
};

// ── Route Pill ─────────────────────────────────────────────────────────────────
// The animated A → ... → B connector
function RouteLine({ color, animated }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, width: 14, flexShrink: 0 }}>
      {/* A dot */}
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: color,
        boxShadow: animated ? `0 0 8px ${color}99` : 'none',
        flexShrink: 0,
      }} />
      {/* Dashed line with moving dot */}
      <div style={{ position: 'relative', width: 2, flex: 1, minHeight: 18, background: `linear-gradient(to bottom, ${color}80, ${color}20)`, borderRadius: 99, overflow: 'hidden', margin: '3px 0' }}>
        {animated && (
          <div style={{
            position: 'absolute', left: 0, right: 0, height: 6,
            background: `linear-gradient(to bottom, transparent, ${color}, transparent)`,
            borderRadius: 99,
            animation: 'rsTravel 1.6s ease-in-out infinite',
          }} />
        )}
      </div>
      {/* B diamond */}
      <div style={{
        width: 7, height: 7, borderRadius: 1.5,
        background: color, opacity: 0.55,
        transform: 'rotate(45deg)',
        flexShrink: 0,
      }} />
    </div>
  );
}

// ── Single search row ──────────────────────────────────────────────────────────
function SearchRow({ doc, idx }) {
  const guest = isGuest(doc);
  const hue   = routeHue(doc.id);
  const color = `hsl(${hue},70%,65%)`;

  // Pick cheapest tier fare to show
  const cheapestFare = useMemo(() => {
    if (!doc.rides) return null;
    const keys = ['economy', 'standard', 'premium', 'xl'].filter(k => doc.rides[k]);
    if (!keys.length) return null;
    return keys.reduce((min, k) => {
      const t = parseFloat(doc.rides[k]?.total ?? Infinity);
      return t < parseFloat(doc.rides[min]?.total ?? Infinity) ? k : min;
    });
  }, [doc.rides]);

  const fareTotal  = cheapestFare ? doc.rides[cheapestFare]?.total : null;
  const tierColor  = cheapestFare ? TIER_COLOR[cheapestFare] : color;

  return (
    <div style={{
      display: 'flex', gap: 12, alignItems: 'stretch',
      padding: '11px 14px',
      borderRadius: 14,
      background: 'rgba(255,255,255,.04)',
      border: '1px solid rgba(255,255,255,.07)',
      animation: `rsFadeUp .32s ease ${idx * 45}ms both`,
      position: 'relative', overflow: 'hidden',
      transition: 'background .15s',
    }}
    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.07)'}
    onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.04)'}
    >
      {/* Subtle left glow bar */}
      <div style={{
        position: 'absolute', left: 0, top: 6, bottom: 6, width: 2.5,
        borderRadius: 99, background: color,
        boxShadow: `0 0 8px ${color}60`,
        opacity: 0.6,
      }} />

      {/* A→B line */}
      <div style={{ paddingLeft: 6 }}>
        <RouteLine color={color} animated={false} />
      </div>

      {/* Main content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Pickup */}
        <div style={{
          fontFamily: "'Barlow',sans-serif", fontSize: 13, fontWeight: 700,
          color: '#fff', letterSpacing: '-.2px',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          marginBottom: 4,
        }}>
          {strip(doc.pickup) || '—'}
        </div>

        {/* Dropoff */}
        <div style={{
          fontFamily: "'Barlow',sans-serif", fontSize: 12.5, fontWeight: 600,
          color: 'rgba(255,255,255,.45)', letterSpacing: '-.1px',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          marginBottom: 7,
        }}>
          {strip(doc.dropoff) || '—'}
        </div>

        {/* Chips row */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
          {doc.miles   != null && (
            <MiniChip icon={<Ruler size={8} />} label={`${Number(doc.miles).toFixed(1)} mi`} />
          )}
          {doc.minutes != null && (
            <MiniChip icon={<Clock size={8} />} label={`${doc.minutes} min`} />
          )}
          {fareTotal != null && (
            <MiniChip icon={<Banknote size={8} />} label={`from $${fareTotal}`} color={tierColor} />
          )}
          <MiniChip
            icon={guest ? <UserX size={8} /> : <Users size={8} />}
            label={guest ? 'Guest' : 'Rider'}
            color={guest ? '#FB923C' : '#34D399'}
          />
        </div>
      </div>

      {/* Right: time */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'flex-start', paddingTop: 2 }}>
        <span style={{
          fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 700,
          color: 'rgba(255,255,255,.28)',
          background: 'rgba(255,255,255,.05)',
          border: '1px solid rgba(255,255,255,.08)',
          padding: '2px 7px', borderRadius: 6,
          whiteSpace: 'nowrap',
        }}>
          {fmtRelative(doc.createdAt)}
        </span>
      </div>
    </div>
  );
}

function MiniChip({ icon, label, color }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '2px 7px', borderRadius: 99,
      background: color ? `${color}14` : 'rgba(255,255,255,.06)',
      border: color ? `1px solid ${color}30` : '1px solid rgba(255,255,255,.09)',
      fontFamily: "'Barlow',sans-serif", fontSize: 10.5, fontWeight: 700,
      color: color ?? 'rgba(255,255,255,.4)',
    }}>
      {icon}{label}
    </span>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────
function SkeletonRow({ delay }) {
  return (
    <div style={{
      display: 'flex', gap: 12, padding: '11px 14px',
      borderRadius: 14, background: 'rgba(255,255,255,.04)',
      border: '1px solid rgba(255,255,255,.07)',
      animation: `rsFadeUp .3s ease ${delay}ms both`,
    }}>
      <div style={{ width: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingLeft: 6 }}>
        <Shimmer w={8} h={8} r="50%" />
        <Shimmer w={2} h={20} r={2} />
        <Shimmer w={7} h={7} r={1} />
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Shimmer w="75%" h={13} r={4} />
        <Shimmer w="55%" h={12} r={4} />
        <div style={{ display: 'flex', gap: 5 }}>
          <Shimmer w={48} h={18} r={99} />
          <Shimmer w={40} h={18} r={99} />
          <Shimmer w={52} h={18} r={99} />
        </div>
      </div>
      <Shimmer w={46} h={18} r={6} />
    </div>
  );
}

function Shimmer({ w, h, r }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r, flexShrink: 0,
      background: 'linear-gradient(90deg,rgba(255,255,255,.04) 0%,rgba(255,255,255,.09) 50%,rgba(255,255,255,.04) 100%)',
      backgroundSize: '200% 100%',
      animation: 'rsScan 1.6s ease-in-out infinite',
    }} />
  );
}

// ── Main export ────────────────────────────────────────────────────────────────
/**
 * RecentSearches — shows the latest rider searches as a compact A→B feed.
 *
 * Props:
 *   searches  — array of search docs from Firestore (the 171-doc array)
 *   loading   — boolean
 *   limit     — how many to show (default 12)
 */
export default function RecentSearches({ searches = [], loading = false, limit = 12 }) {
  const feed = useMemo(() =>
    [...searches]
      .filter(s => s.pickup && s.dropoff)
      .sort((a, b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt))
      .slice(0, limit),
    [searches, limit]
  );

  const guestCount  = feed.filter(isGuest).length;
  const riderCount  = feed.length - guestCount;
  const withFare    = feed.filter(s => s.rides?.economy || s.rides?.standard || s.rides?.premium || s.rides?.xl).length;

  return (
    <>
      <style>{`
        @keyframes rsScan {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes rsFadeUp {
          from { opacity:0; transform:translateY(7px); }
          to   { opacity:1; transform:translateY(0);   }
        }
        @keyframes rsTravel {
          0%   { top: -6px; }
          100% { top: 100%; }
        }
        @keyframes rsHeaderIn {
          from { opacity:0; transform:translateY(-5px); }
          to   { opacity:1; transform:translateY(0);    }
        }
      `}</style>

      <div style={{
        background: 'linear-gradient(160deg, #08101E 0%, #0D1829 55%, #080F1B 100%)',
        border: '1.5px solid rgba(96,165,250,.18)',
        borderRadius: 22,
        padding: '18px 18px 16px',
        position: 'relative', overflow: 'hidden',
        boxShadow: '0 12px 40px rgba(0,0,0,.32), 0 0 0 1px rgba(96,165,250,.06)',
      }}>

        {/* Decorative blobs */}
        <div style={{ position:'absolute', top:-50, right:-50, width:180, height:180, borderRadius:'50%', background:'radial-gradient(circle,rgba(96,165,250,.14) 0%,transparent 70%)', filter:'blur(28px)', pointerEvents:'none' }}/>
        <div style={{ position:'absolute', bottom:-40, left:-30, width:140, height:140, borderRadius:'50%', background:'radial-gradient(circle,rgba(192,132,252,.10) 0%,transparent 70%)', filter:'blur(22px)', pointerEvents:'none' }}/>
        {/* Grid */}
        <div style={{ position:'absolute', inset:0, opacity:.03, backgroundImage:'linear-gradient(rgba(255,255,255,.6) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.6) 1px,transparent 1px)', backgroundSize:'32px 32px', pointerEvents:'none' }}/>
        {/* Scan line */}
        <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,transparent,rgba(96,165,250,.55),transparent)', animation:'rsScan 3.6s linear infinite', pointerEvents:'none' }}/>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 14, animation: 'rsHeaderIn .4s ease both',
          position: 'relative',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 12,
              background: 'rgba(96,165,250,.12)', border: '1.5px solid rgba(96,165,250,.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Activity size={17} color="#60A5FA" strokeWidth={2.2} />
            </div>
            <div>
              <div style={{ fontFamily: "'Barlow',sans-serif", fontSize: 15, fontWeight: 900, color: '#fff', letterSpacing: '-.3px', marginBottom: 2 }}>
                Recent Searches
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#60A5FA', boxShadow: '0 0 7px rgba(96,165,250,.8)', animation: 'rsLiveDot 1.8s ease-in-out infinite' }} />
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(96,165,250,.7)' }}>
                  Live rider demand
                </span>
              </div>
            </div>
          </div>

          {/* Count badge */}
          {!loading && feed.length > 0 && (
            <span style={{
              fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 800,
              color: '#60A5FA', background: 'rgba(96,165,250,.12)',
              border: '1px solid rgba(96,165,250,.28)', padding: '3px 10px', borderRadius: 99,
            }}>
              {feed.length}
            </span>
          )}
        </div>

        {/* ── Stats row ── */}
        {!loading && feed.length > 0 && (
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14,
            animation: 'rsFadeUp .35s ease 60ms both',
          }}>
            <StatCell label="Searches" value={feed.length}   color="#60A5FA" />
            <StatCell label="Riders"   value={riderCount}    color="#34D399" />
            <StatCell label="w/ Fare"  value={withFare}      color="#C084FC" />
          </div>
        )}

        {/* ── Feed ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {loading ? (
            [0,1,2,3].map(i => <SkeletonRow key={i} delay={i * 60} />)
          ) : feed.length === 0 ? (
            <EmptyState />
          ) : (
            feed.map((doc, i) => <SearchRow key={doc.id} doc={doc} idx={i} />)
          )}
        </div>

      </div>

      <style>{`
        @keyframes rsLiveDot {
          0%,100% { opacity:1; transform:scale(1);    }
          50%     { opacity:.5; transform:scale(.85); }
        }
      `}</style>
    </>
  );
}

function StatCell({ label, value, color }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)',
      borderRadius: 12, padding: '9px 11px',
    }}>
      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,.3)', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontFamily: "'Barlow',sans-serif", fontSize: 20, fontWeight: 900, color, letterSpacing: '-.3px', lineHeight: 1 }}>
        {value}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '28px 0 10px' }}>
      <div style={{ width: 48, height: 48, borderRadius: 14, margin: '0 auto 12px', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.09)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <MapPin size={20} color="rgba(255,255,255,.25)" strokeWidth={1.8} />
      </div>
      <div style={{ fontFamily: "'Barlow',sans-serif", fontSize: 14, fontWeight: 800, color: 'rgba(255,255,255,.5)', marginBottom: 4 }}>No recent searches</div>
      <div style={{ fontFamily: "'Barlow',sans-serif", fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,.25)' }}>Rider activity will appear here</div>
    </div>
  );
}
