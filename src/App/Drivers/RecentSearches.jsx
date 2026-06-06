import { useMemo, useState, useEffect } from 'react';
import { Users, UserX } from 'lucide-react';

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
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(tsToMillis(ts)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

// ✅ hides street numbers
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

// ── Card ───────────────────────────────────────────────────────────────────
function SearchCard({ doc }) {
  const guest = isGuest(doc);

  return (
    <div style={{
      padding: 14,
      borderRadius: 16,
      background: 'rgba(255,255,255,.05)',
      border: '1px solid rgba(255,255,255,.08)',
    }}>
      <div style={{ fontWeight: 800, fontSize: 14, color: '#fff' }}>
        {strip(doc.pickup)}
      </div>

      <div style={{ fontSize: 12, opacity: 0.5, marginTop: 4 }}>
        {strip(doc.dropoff)}
      </div>

      <div style={{ marginTop: 10, fontSize: 11, opacity: 0.7 }}>
        {guest ? 'Guest' : 'Rider'} • {fmtRelative(doc.createdAt)}
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function RecentSearches({ searches = [], loading = false, limit = 12 }) {
  const feed = useMemo(() =>
    [...searches]
      .filter(s => s.pickup && s.dropoff)
      .sort((a, b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt))
      .slice(0, limit),
    [searches, limit]
  );

  const [index, setIndex] = useState(0);
  const [flip, setFlip] = useState(false);

  // auto flip
  useEffect(() => {
    if (!feed.length) return;

    const interval = setInterval(() => {
      setFlip(true);

      // wait for flip animation then change card
      setTimeout(() => {
        setIndex(i => (i + 1) % feed.length);
        setFlip(false);
      }, 350);
    }, 3500);

    return () => clearInterval(interval);
  }, [feed.length]);

  const current = feed[index];

  return (
    <div style={{
      perspective: 1000,
      padding: 18,
      borderRadius: 20,
      background: 'linear-gradient(160deg,#08101E,#0D1829)',
      color: '#fff',
    }}>

      {/* Header */}
      <div style={{ fontWeight: 900, marginBottom: 12 }}>
        Recent Searches
      </div>

      {/* Flip container */}
      <div style={{
        transformStyle: 'preserve-3d',
        transition: 'transform 0.6s ease',
        transform: flip ? 'rotateY(90deg)' : 'rotateY(0deg)',
      }}>
        {loading ? (
          <div>Loading...</div>
        ) : current ? (
          <SearchCard doc={current} />
        ) : (
          <div style={{ opacity: 0.5 }}>No data</div>
        )}
      </div>

      {/* optional subtle indicator */}
      {feed.length > 1 && (
        <div style={{
          marginTop: 10,
          fontSize: 11,
          opacity: 0.4,
          textAlign: 'center'
        }}>
          Auto-updating live feed
        </div>
      )}
    </div>
  );
}