import { useEffect, useState, useRef, useMemo } from 'react';
import { Trophy, TrendingUp } from 'lucide-react';
import StatTiles        from '@/App/Drivers/StatTiles.jsx';
import Achievements     from '@/App/Drivers/Achievements.jsx';
import RecentSearches   from '@/App/Drivers/RecentSearches.jsx';
import ScheduledFace    from '@/App/Drivers/ScheduledFace.jsx';
import StatusFace       from '@/App/Drivers/StatusFace.jsx';
import NotificationFace from '@/App/Drivers/NotificationFace.jsx';

// ── Helpers ────────────────────────────────────────────
function tsToMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  return 0;
}

// Face order: 0=status, 1=scheduled, 2=stats, 3=achievements, 4=notification, 5=searches
const FACES   = ['status', 'scheduled', 'stats', 'achievements', 'notification', 'searches'];
const FACE_MS = 5500;

export default function StatusCard({
  online,
  scheduledRides = [],
  searches,
  activeTrip,
  tripStage,
  onToggle,
  onlineSince,
  nearbyCount,
  earnings,
  driver,
}) {
  const [now,      setNow]      = useState(Date.now());
  const [faceIdx,  setFaceIdx]  = useState(0);
  const [rideIdx,  setRideIdx]  = useState(0);
  const [badgeIdx, setBadgeIdx] = useState(0);
  const onlineSinceRef          = useRef(null);
  const cycleRef                = useRef(null);
  const userPausedRef           = useRef(false); // ← tracks manual dot tap

  // ── Online duration ────────────────────────────────
  useEffect(() => {
    if (online && !onlineSinceRef.current) onlineSinceRef.current = Date.now();
    if (!online) onlineSinceRef.current = null;
  }, [online]);

  useEffect(() => {
    if (!online) return;
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [online]);

  const sinceMs = onlineSince
    ? (typeof onlineSince === 'number' ? onlineSince : onlineSince?.toMillis?.() ?? new Date(onlineSince).getTime())
    : onlineSinceRef.current;

  const onlineMin   = sinceMs ? Math.max(0, Math.floor((now - sinceMs) / 60_000)) : 0;
  const onlineLabel = onlineMin < 1 ? 'just now'
    : onlineMin < 60 ? `${onlineMin} min`
    : `${Math.floor(onlineMin / 60)}h ${onlineMin % 60}m`;

  // ── Scheduled rides ────────────────────────────────
  const upcomingRides = useMemo(() =>
    [...(scheduledRides || [])]
      .filter(r => {
        const st = r.scheduledAt || r.createdAt;
        if (!st) return false;
        return tsToMillis(st) > Date.now() - 3600000;
      })
      .sort((a, b) => tsToMillis(a.scheduledAt || a.createdAt) - tsToMillis(b.scheduledAt || b.createdAt)),
    [scheduledRides]
  );

  const hasScheduled = upcomingRides.length > 0;
  const currentRide  = upcomingRides[rideIdx] ?? null;

  const activeFaces = FACES;

  // ── Auto-cycle ─────────────────────────────────────
  const startCycle = () => {
    clearInterval(cycleRef.current);
    if (activeTrip) return;
    if (userPausedRef.current) return; // ← don't restart if user manually navigated
    cycleRef.current = setInterval(() => {
      setFaceIdx(i => {
        const next = (i + 1) % activeFaces.length;
        if (activeFaces[next] === 'scheduled') {
          setRideIdx(Math.floor(Math.random() * Math.max(1, upcomingRides.length)));
        }
        if (activeFaces[next] === 'achievements') {
          setBadgeIdx(bi => bi + 1);
        }
        return next;
      });
    }, FACE_MS);
  };

  useEffect(() => {
    startCycle();
    return () => clearInterval(cycleRef.current);
  }, [activeTrip, upcomingRides.length]); // eslint-disable-line

  // ── Manual dot tap — stops auto-cycle permanently until trip state changes ──
  const goFace = (i) => {
    userPausedRef.current = true;    // ← user took control, kill auto-cycle
    clearInterval(cycleRef.current);
    setFaceIdx(i);
    if (activeFaces[i] === 'scheduled') setRideIdx(Math.floor(Math.random() * Math.max(1, upcomingRides.length)));
    if (activeFaces[i] === 'achievements') setBadgeIdx(bi => bi + 1);
  };

  const face = activeFaces[faceIdx];
  const mode = !online ? 'offline' : activeTrip ? 'trip' : 'waiting';

  const dotColors = {
    status:       mode === 'waiting' ? '#22C55E' : mode === 'trip' ? '#22C55E' : '#64748B',
    scheduled:    '#818CF8',
    stats:        '#60A5FA',
    achievements: '#FB923C',
    notification: '#34D399',
    searches:     '#60A5FA',
  };

  // Scan-line accent — only color that changes per face
  const scanColor = {
    status:       mode === 'offline' ? 'rgba(100,116,139,.4)' : 'rgba(34,197,94,.55)',
    scheduled:    'rgba(129,140,248,.55)',
    stats:        'rgba(59,130,246,.50)',
    achievements: 'rgba(251,146,60,.52)',
    notification: 'rgba(52,211,153,.52)',
    searches:     'rgba(96,165,250,.48)',
  }[face];

  return (
    <>
      <style>{`
        @keyframes scRadar {
          0%   { transform: scale(0.6); opacity: 0.7; }
          100% { transform: scale(2.6); opacity: 0; }
        }
        @keyframes scLiveDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.5; transform: scale(0.85); }
        }
        @keyframes scScan {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes scOnlinePulse {
          0%, 100% { box-shadow: 0 8px 20px rgba(22,163,74,.35), 0 0 0 0 rgba(22,163,74,.4); }
          50%      { box-shadow: 0 8px 20px rgba(22,163,74,.35), 0 0 0 12px rgba(22,163,74,0); }
        }
        @keyframes scFaceIn {
          0%   { opacity: 0; transform: translateY(6px) scale(.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes scCountGlow {
          0%,100% { text-shadow: 0 0 8px rgba(129,140,248,.3); }
          50%     { text-shadow: 0 0 28px rgba(129,140,248,.9), 0 0 50px rgba(129,140,248,.4); }
        }
        @keyframes rsTravel {
          0%   { top: -6px; }
          100% { top: 100%; }
        }
        .sc-face { animation: scFaceIn .38s cubic-bezier(.34,1.2,.64,1) both; }
      `}</style>

      <div style={{ borderRadius: 22 }}>
        <div style={{
          background:          'rgba(5,10,7,.88)',
          backdropFilter:      'blur(24px)',
          WebkitBackdropFilter:'blur(24px)',
          border:              '1.5px solid rgba(34,197,94,.18)',
          borderRadius:        22,
          padding:             '18px 20px 14px',
          position:            'relative',
          overflow:            'hidden',
          boxShadow:           '0 20px 56px rgba(0,0,0,.55), 0 4px 14px rgba(0,0,0,.3)',
        }}>

          {/* ── Scan line — only decoration, color identifies the face ── */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 2,
            background: `linear-gradient(90deg,transparent,${scanColor},transparent)`,
            animation: 'scScan 3s linear infinite',
            pointerEvents: 'none',
          }}/>

          {/* ── Radar rings — status/waiting only ── */}
          {face === 'status' && mode === 'waiting' && (
            <>
              <div style={{ position:'absolute', top:'50%', right:72, width:52, height:52, borderRadius:'50%', background:'rgba(34,197,94,.12)', transform:'translateY(-50%)', animation:'scRadar 2.4s ease-out infinite', pointerEvents:'none' }}/>
              <div style={{ position:'absolute', top:'50%', right:72, width:52, height:52, borderRadius:'50%', background:'rgba(34,197,94,.09)', transform:'translateY(-50%)', animation:'scRadar 2.4s ease-out .8s infinite', pointerEvents:'none' }}/>
            </>
          )}

          {/* ── Face content — fixed height so the card never resizes between faces ── */}
          <div className="sc-face" key={face + rideIdx + badgeIdx} style={{
            position: 'relative',
            minHeight: 168,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}>

            {/* ════ FACE: STATUS ════ */}
            {face === 'status' && (
              <StatusFace
                mode={mode}
                online={online}
                activeTrip={activeTrip}
                tripStage={tripStage}
                sinceMs={sinceMs}
                onlineLabel={onlineLabel}
                nearbyCount={nearbyCount}
                onToggle={onToggle}
                driver={driver}
                searches={searches}
              />
            )}

            {/* ════ FACE: SCHEDULED ════ */}
            {face === 'scheduled' && (
              <ScheduledFace
                hasScheduled={hasScheduled}
                upcomingRides={upcomingRides}
                currentRide={currentRide}
                rideIdx={rideIdx}
              />
            )}

            {/* ════ FACE: STATS ════ */}
            {face === 'stats' && (
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
                  <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:100, background:'rgba(59,130,246,.12)', border:'1px solid rgba(59,130,246,.25)' }}>
                    <TrendingUp size={10} color="#93C5FD" strokeWidth={2.4}/>
                    <span className="mono" style={{ fontSize:10, fontWeight:800, letterSpacing:'.12em', textTransform:'uppercase', color:'#93C5FD' }}>Earnings</span>
                  </div>
                </div>
                <StatTiles earnings={earnings} online={online} driver={driver} />
              </div>
            )}

            {/* ════ FACE: ACHIEVEMENTS ════ */}
            {face === 'achievements' && (
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
                  <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 10px', borderRadius:100, background:'rgba(251,146,60,.12)', border:'1px solid rgba(251,146,60,.25)' }}>
                    <Trophy size={10} color="#FCD34D" strokeWidth={2.4}/>
                    <span className="mono" style={{ fontSize:10, fontWeight:800, letterSpacing:'.12em', textTransform:'uppercase', color:'#FCD34D' }}>Achievements</span>
                  </div>
                </div>
                <Achievements driver={driver} badgeIdx={badgeIdx} />
              </div>
            )}

            {/* ════ FACE: NOTIFICATION ════ */}
            {face === 'notification' && (
              <NotificationFace online={online} driver={driver} />
            )}

            {/* ════ FACE: SEARCHES ════ */}
            {face === 'searches' && (
              <RecentSearches
                searches={searches ?? []}
                loading={false}
                limit={5}
              />
            )}

          </div>

          {/* ── Dot pagination ── */}
          <div style={{ display:'flex', justifyContent:'center', gap:6, marginTop:14, position:'relative' }}>
            {activeFaces.map((f, i) => (
              <button
                key={f}
                onClick={() => goFace(i)}
                style={{
                  width:  i === faceIdx ? 20 : 6,
                  height: 6,
                  borderRadius: 3,
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  background: i === faceIdx ? dotColors[f] : 'rgba(255,255,255,.18)',
                  boxShadow: i === faceIdx ? `0 0 8px ${dotColors[f]}80` : 'none',
                  transition: 'all .28s ease',
                  flexShrink: 0,
                }}
              />
            ))}
          </div>

        </div>
      </div>
    </>
  );
}