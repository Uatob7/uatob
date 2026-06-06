import { useMemo, useState, useEffect, useRef } from 'react';
import { Search, MapPin, Navigation, Clock, User, Ghost, ArrowRight } from 'lucide-react';

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

  useEffect(() => {
    if (!feed.length) return;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setExiting(true);
      setTimeout(() => { setIndex(i => (i + 1) % feed.length); setExiting(false); }, 280);
    }, 3800);
    return () => clearInterval(timerRef.current);
  }, [feed.length]);

  const current = feed[index];
  const guest   = current ? isGuest(current) : false;

  return (
    <>
      <style>{`
        @keyframes rs-in  { from { opacity:0; transform:translateY(4px) } to { opacity:1; transform:translateY(0) } }
        @keyframes rs-out { from { opacity:1; transform:translateY(0) } to { opacity:0; transform:translateY(-4px) } }
        @keyframes rs-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.7)} }
        @keyframes rs-bar { from{width:0%} to{width:100%} }
      `}</style>

      {/* ── Header row ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
        <div style={{
          display:'inline-flex', alignItems:'center', gap:5,
          padding:'3px 9px', borderRadius:100,
          background:'rgba(96,165,250,.12)', border:'1px solid rgba(96,165,250,.22)',
        }}>
          <div style={{
            width:5, height:5, borderRadius:'50%', background:'#60A5FA',
            boxShadow:'0 0 7px rgba(96,165,250,.9)',
            animation:'rs-dot 1.8s ease-in-out infinite',
          }}/>
          <span style={{
            fontFamily:"'Barlow Condensed','Barlow',sans-serif",
            fontSize:9.5, fontWeight:800, letterSpacing:'.12em',
            textTransform:'uppercase', color:'#93C5FD',
          }}>Live searches</span>
        </div>

        {feed.length > 0 && (
          <span style={{
            fontFamily:"'Barlow',monospace", fontSize:10, fontWeight:700,
            color:'rgba(96,165,250,.35)',
          }}>
            {index + 1}/{feed.length}
          </span>
        )}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          <div style={{ height:9, borderRadius:5, width:'75%', background:'rgba(255,255,255,.08)' }}/>
          <div style={{ height:9, borderRadius:5, width:'50%', background:'rgba(255,255,255,.06)' }}/>
        </div>

      ) : !current ? (
        <div style={{ display:'flex', alignItems:'center', gap:6, color:'rgba(147,197,253,.3)', fontSize:11, fontWeight:600 }}>
          <Search size={11} strokeWidth={2.2}/> No searches yet
        </div>

      ) : (
        <div
          key={index}
          style={{ animation: exiting ? 'rs-out .28s ease both' : 'rs-in .32s cubic-bezier(.34,1.2,.64,1) both' }}
        >
          {/* ── Route line (single row) ── */}
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
            {/* Pickup */}
            <div style={{ display:'flex', alignItems:'center', gap:4, flex:1, minWidth:0 }}>
              <div style={{
                width:16, height:16, borderRadius:5, flexShrink:0,
                background:'rgba(96,165,250,.16)', border:'1px solid rgba(96,165,250,.28)',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                <Navigation size={8} color="#60A5FA" strokeWidth={2.5}/>
              </div>
              <span style={{
                fontFamily:"'Barlow Condensed','Barlow',sans-serif",
                fontSize:15, fontWeight:900, letterSpacing:'-0.2px', lineHeight:1,
                color:'#fff',
                whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
              }}>
                {strip(current.pickup)}
              </span>
            </div>

            {/* Arrow */}
            <ArrowRight size={11} color="rgba(96,165,250,.35)" strokeWidth={2.5} style={{ flexShrink:0 }}/>

            {/* Dropoff */}
            <div style={{ display:'flex', alignItems:'center', gap:4, flex:1, minWidth:0 }}>
              <div style={{
                width:16, height:16, borderRadius:5, flexShrink:0,
                background:'rgba(192,132,252,.12)', border:'1px solid rgba(192,132,252,.22)',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                <MapPin size={8} color="#C084FC" strokeWidth={2.5}/>
              </div>
              <span style={{
                fontFamily:"'Barlow',sans-serif",
                fontSize:12, fontWeight:600, lineHeight:1,
                color:'rgba(192,132,252,.7)',
                whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
              }}>
                {strip(current.dropoff)}
              </span>
            </div>
          </div>

          {/* ── Meta row ── */}
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <div style={{
              display:'inline-flex', alignItems:'center', gap:4,
              padding:'2px 7px', borderRadius:99,
              background: guest ? 'rgba(251,191,36,.10)' : 'rgba(96,165,250,.10)',
              border:`1px solid ${guest ? 'rgba(251,191,36,.20)' : 'rgba(96,165,250,.20)'}`,
            }}>
              {guest
                ? <Ghost size={8} color="#FCD34D" strokeWidth={2.4}/>
                : <User  size={8} color="#60A5FA" strokeWidth={2.4}/>
              }
              <span style={{
                fontFamily:"'Barlow',sans-serif",
                fontSize:9, fontWeight:800, letterSpacing:'.06em',
                color: guest ? '#FCD34D' : '#93C5FD',
                textTransform:'uppercase',
              }}>
                {guest ? 'Guest' : 'Rider'}
              </span>
            </div>

            <div style={{ display:'flex', alignItems:'center', gap:3 }}>
              <Clock size={9} color="rgba(147,197,253,.4)" strokeWidth={2.2}/>
              <span style={{
                fontFamily:"'Barlow',sans-serif", fontSize:10, fontWeight:600,
                color:'rgba(147,197,253,.45)',
              }}>
                {fmtRelative(current.createdAt)}
              </span>
            </div>

            {current.miles != null && (
              <span style={{
                fontFamily:"'Barlow',monospace", fontSize:10, fontWeight:700,
                color:'rgba(96,165,250,.35)',
                marginLeft:'auto',
              }}>
                {current.miles.toFixed(1)} mi
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Progress bar ── */}
      {feed.length > 1 && (
        <div style={{
          marginTop:10, height:2, borderRadius:2,
          background:'rgba(96,165,250,.10)', overflow:'hidden',
        }}>
          <div
            key={`bar-${index}`}
            style={{
              height:'100%', borderRadius:2,
              background:'linear-gradient(90deg,#60A5FA,#A78BFA)',
              boxShadow:'0 0 5px rgba(96,165,250,.45)',
              animation:`rs-bar 3.8s linear forwards`,
            }}
          />
        </div>
      )}
    </>
  );
}
