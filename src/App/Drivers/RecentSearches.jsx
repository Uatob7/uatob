import { useMemo, useState, useEffect } from 'react';
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
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(tsToMillis(ts)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ✅ UPDATED: hides street numbers
function strip(addr) {
  if (!addr) return '—';

  return addr
    // remove leading house/building numbers
    .replace(/^\s*\d+\s+[A-Za-z0-9.-]+\s+/, '')
    // optional: remove city/state noise
    .replace(/,\s*(Orlando|Tampa|Kissimmee|Winter Haven|Winter Park|Ocoee|Lakeland|FL|USA).*$/i, '')
    .trim();
}

function isGuest(s) {
  return !s.uid || s.uid === 'null' || s.uid === null;
}

function routeHue(id = '') {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffff;
  return h % 360;
}

const TIER_COLOR = {
  economy: '#34D399',
  standard: '#60A5FA',
  premium: '#C084FC',
  xl: '#FB923C',
};

// ── Route Line ────────────────────────────────────────────────────────────────
function RouteLine({ color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 14 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
      <div style={{ width: 2, flex: 1, minHeight: 18, background: color, opacity: 0.3 }} />
      <div style={{ width: 7, height: 7, transform: 'rotate(45deg)', background: color, opacity: 0.5 }} />
    </div>
  );
}

// ── Chips ─────────────────────────────────────────────────────────────────────
function MiniChip({ icon, label, color }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 3,
      padding: '2px 7px',
      borderRadius: 99,
      background: color ? `${color}14` : 'rgba(255,255,255,.06)',
      border: color ? `1px solid ${color}30` : '1px solid rgba(255,255,255,.09)',
      fontSize: 10.5,
      fontWeight: 700,
      color: color ?? 'rgba(255,255,255,.4)',
    }}>
      {icon}{label}
    </span>
  );
}

// ── Single Row ────────────────────────────────────────────────────────────────
function SearchRow({ doc }) {
  const guest = isGuest(doc);
  const hue = routeHue(doc.id);
  const color = `hsl(${hue},70%,65%)`;

  const cheapestFare = useMemo(() => {
    if (!doc.rides) return null;
    const keys = ['economy', 'standard', 'premium', 'xl'].filter(k => doc.rides[k]);
    if (!keys.length) return null;
    return keys.reduce((min, k) => {
      const t = parseFloat(doc.rides[k]?.total ?? Infinity);
      return t < parseFloat(doc.rides[min]?.total ?? Infinity) ? k : min;
    });
  }, [doc.rides]);

  const fareTotal = cheapestFare ? doc.rides[cheapestFare]?.total : null;
  const tierColor = cheapestFare ? TIER_COLOR[cheapestFare] : color;

  return (
    <div style={{
      display: 'flex',
      gap: 12,
      padding: '12px 14px',
      borderRadius: 14,
      background: 'rgba(255,255,255,.04)',
      border: '1px solid rgba(255,255,255,.07)',
    }}>
      <RouteLine color={color} />

      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 800, color: '#fff' }}>
          {strip(doc.pickup)}
        </div>

        <div style={{ fontSize: 12, opacity: 0.5 }}>
          {strip(doc.dropoff)}
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
          {doc.miles != null && <MiniChip label={`${doc.miles.toFixed(1)} mi`} />}
          {doc.minutes != null && <MiniChip label={`${doc.minutes} min`} />}
          {fareTotal != null && <MiniChip label={`$${fareTotal}`} color={tierColor} />}
          <MiniChip
            label={guest ? 'Guest' : 'Rider'}
            color={guest ? '#FB923C' : '#34D399'}
            icon={guest ? <UserX size={8} /> : <Users size={8} />}
          />
        </div>
      </div>

      <div style={{ fontSize: 10, opacity: 0.4 }}>
        {fmtRelative(doc.createdAt)}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function RecentSearches({ searches = [], loading = false, limit = 12 }) {
  const feed = useMemo(() =>
    [...searches]
      .filter(s => s.pickup && s.dropoff)
      .sort((a, b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt))
      .slice(0, limit),
    [searches, limit]
  );

  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!feed.length) return;
    const t = setInterval(() => {
      setIndex(i => (i + 1) % feed.length);
    }, 3500);
    return () => clearInterval(t);
  }, [feed.length]);

  const current = feed[index];

  return (
    <div style={{
      padding: 18,
      borderRadius: 20,
      background: 'linear-gradient(160deg,#08101E,#0D1829)',
      color: '#fff',
    }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontWeight: 900 }}>Recent Searches</div>
        <div style={{ fontSize: 12, opacity: 0.6 }}>
          {feed.length ? `${index + 1} / ${feed.length}` : null}
        </div>
      </div>

      {/* Single item */}
      {loading ? (
        <div>Loading...</div>
      ) : current ? (
        <SearchRow doc={current} />
      ) : (
        <div style={{ opacity: 0.5 }}>No data</div>
      )}

      {/* Controls */}
      {feed.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
          <button onClick={() => setIndex(i => (i - 1 + feed.length) % feed.length)}>
            Prev
          </button>
          <button onClick={() => setIndex(i => (i + 1) % feed.length)}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}