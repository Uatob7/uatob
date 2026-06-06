import { useEffect, useState, useRef, useMemo } from 'react';
import { Power, Radar, Zap, MapPin, Calendar, Clock, ChevronRight, Navigation } from 'lucide-react';
import { C } from '@/App/Drivers/constants.js';

/**
 * Online/offline status card with toggle button.
 * Flips to show scheduled rides when scheduledRides.length > 0.
 *
 * Props:
 *   online         — bool
 *   scheduledRides — array of scheduled ride objects
 *   activeTrip     — current trip object or null
 *   tripStage      — "idle" | "enroute" | "arrived" | "in_progress" | "completed"
 *   onToggle       — called when the toggle button is pressed
 *   onlineSince    — (optional) Date or timestamp when driver went online
 *   nearbyCount    — (optional) number of riders nearby
 */

// ── Helpers ────────────────────────────────────────────
function tsToMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  return 0;
}

function fmtScheduled(ts) {
  if (!ts) return null;
  const ms = tsToMillis(ts);
  if (!ms) return null;
  const d = new Date(ms);
  const diffMs = ms - Date.now();
  const diffH = diffMs / 1000 / 3600;
  if (diffH < 0) return null;
  if (diffH < 24) {
    return d.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  return d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
}

function parseCity(ride) {
  return ride.pickupCity
    || (ride.pickup ? ride.pickup.split(',').slice(-2, -1)[0]?.trim() : null)
    || 'Orlando';
}

function fmtCountdown(ts) {
  if (!ts) return null;
  const ms = tsToMillis(ts);
  const diff = ms - Date.now();
  if (diff <= 0) return 'Now';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `in ${h}h ${m}m`;
  if (m > 0) return `in ${m}m`;
  return 'Soon';
}

export default function StatusCard({
  online,
  scheduledRides = [],
  activeTrip,
  tripStage,
  onToggle,
  onlineSince,
  nearbyCount,
}) {
  const [now,       setNow]       = useState(Date.now());
  const [face,      setFace]      = useState('status'); // 'status' | 'scheduled'
  const [rideIdx,   setRideIdx]   = useState(0);
  const onlineSinceRef            = useRef(null);
  const flipTimerRef              = useRef(null);

  console.log(scheduledRides);

  // ── Online duration tracking ───────────────────────
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

  const onlineMin = sinceMs ? Math.max(0, Math.floor((now - sinceMs) / 60_000)) : 0;
  const onlineLabel = onlineMin < 1 ? 'just now'
    : onlineMin < 60 ? `${onlineMin} min`
    : `${Math.floor(onlineMin / 60)}h ${onlineMin % 60}m`;

  // ── Scheduled rides — filter to upcoming only ──────
  const upcomingRides = useMemo(() =>
    [...(scheduledRides || [])]
      .filter(r => {
        const st = r.scheduledAt || r.createdAt;
        if (!st) return false;
        const ms = tsToMillis(st);
        return ms > Date.now() - 60 * 60 * 1000;
      })
      .sort((a, b) => tsToMillis(a.scheduledAt || a.createdAt) - tsToMillis(b.scheduledAt || b.createdAt)),
    [scheduledRides]
  );

  const hasScheduled = upcomingRides.length > 0;
  const currentRide  = upcomingRides[rideIdx] ?? upcomingRides[0] ?? null;

  // ── Auto-flip between status ↔ scheduled ──────────
  useEffect(() => {
    clearInterval(flipTimerRef.current);
    if (!hasScheduled || activeTrip) return;

    flipTimerRef.current = setInterval(() => {
      setFace(prev => {
        if (prev === 'status') return 'scheduled';
        setRideIdx(i => (i + 1) % upcomingRides.length);
        return 'status';
      });
    }, 6000);

    return () => clearInterval(flipTimerRef.current);
  }, [hasScheduled, upcomingRides.length, activeTrip]);

  const handleFlip = () => {
    if (!hasScheduled || activeTrip) return;
    clearInterval(flipTimerRef.current);
    setFace(prev => {
      if (prev === 'status') return 'scheduled';
      setRideIdx(i => (i + 1) % upcomingRides.length);
      return 'status';
    });
    flipTimerRef.current = setInterval(() => {
      setFace(prev => {
        if (prev === 'status') return 'scheduled';
        setRideIdx(i => (i + 1) % upcomingRides.length);
        return 'status';
      });
    }, 6000);
  };

  // ── Mode ───────────────────────────────────────────
  const mode = !online ? 'offline' : activeTrip ? 'trip' : 'waiting';

  const statusStyles = {
    offline: {
      bg:     C.surface,
      border: `1px solid ${C.border}`,
      shadow: `0 2px 12px ${C.shadow}`,
    },
    waiting: {
      bg:     'linear-gradient(135deg,#F0FDF4 0%,#DCFCE7 50%,#F0FDF4 100%)',
      border: '1.5px solid rgba(22,163,74,.30)',
      shadow: '0 8px 28px rgba(22,163,74,.14), 0 1px 3px rgba(22,163,74,.10)',
    },
    trip: {
      bg:     'linear-gradient(135deg,#0F172A 0%,#1E293B 50%,#0F172A 100%)',
      border: '1.5px solid rgba(34,197,94,.35)',
      shadow: '0 12px 40px rgba(0,0,0,.25), 0 2px 6px rgba(0,0,0,.10)',
    },
  }[mode];

  const schedStyles = {
    bg:     'linear-gradient(135deg,#0F0A1E 0%,#160F2C 50%,#1A1338 100%)',
    border: '1.5px solid rgba(129,140,248,.35)',
    shadow: '0 12px 40px rgba(0,0,0,.30), 0 2px 6px rgba(0,0,0,.12)',
  };

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
        @keyframes scSchedulePulse {
          0%, 100% { box-shadow: 0 8px 20px rgba(129,140,248,.35), 0 0 0 0 rgba(129,140,248,.4); }
          50%      { box-shadow: 0 8px 20px rgba(129,140,248,.35), 0 0 0 12px rgba(129,140,248,0); }
        }
        @keyframes scFaceIn {
          0%   { opacity: 0; transform: translateY(8px) scale(.97); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes scCountGlow {
          0%,100% { text-shadow: 0 0 8px rgba(129,140,248,.3); }
          50%      { text-shadow: 0 0 28px rgba(129,140,248,.9), 0 0 50px rgba(129,140,248,.4); }
        }
        .sc-face { animation: scFaceIn .42s cubic-bezier(.34,1.2,.64,1) both; }
      `}</style>

      {/* ── 3-D flip wrapper ── */}
      <div
        onClick={handleFlip}
        style={{
          perspective: 1200,
          cursor: hasScheduled && !activeTrip ? 'pointer' : 'default',
          borderRadius: 22,
        }}
      >
        <div style={{
          position: 'relative',
          transformStyle: 'preserve-3d',
          transition: 'transform .75s cubic-bezier(.34,1.2,.64,1)',
          transform: face === 'status' ? 'rotateY(0deg)' : 'rotateY(180deg)',
          borderRadius: 22,
        }}>

          {/* ════════════ FRONT — Status ════════════ */}
          <div style={{
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            borderRadius: 22,
          }}>
            <div style={{
              background: statusStyles.bg,
              border: statusStyles.border,
              borderRadius: 22,
              padding: '22px',
              position: 'relative',
              overflow: 'hidden',
              transition: 'all .4s cubic-bezier(.34,1.2,.64,1)',
              boxShadow: statusStyles.shadow,
            }}>

              {/* Waiting decorations */}
              {mode === 'waiting' && (
                <>
                  <div style={{ position:'absolute', top:'50%', right:80, width:60, height:60, borderRadius:'50%', background:'rgba(22,163,74,.20)', transform:'translateY(-50%)', animation:'scRadar 2.4s ease-out infinite', pointerEvents:'none' }}/>
                  <div style={{ position:'absolute', top:'50%', right:80, width:60, height:60, borderRadius:'50%', background:'rgba(22,163,74,.15)', transform:'translateY(-50%)', animation:'scRadar 2.4s ease-out 0.8s infinite', pointerEvents:'none' }}/>
                  <div style={{ position:'absolute', inset:0, backgroundImage:'repeating-linear-gradient(45deg,transparent,transparent 60px,rgba(22,163,74,.04) 60px,rgba(22,163,74,.04) 61px)', pointerEvents:'none' }}/>
                </>
              )}

              {/* Trip decorations */}
              {mode === 'trip' && (
                <>
                  <div style={{ position:'absolute', inset:0, opacity:.06, backgroundImage:'linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)', backgroundSize:'32px 32px', pointerEvents:'none' }}/>
                  <div style={{ position:'absolute', top:-60, right:-60, width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle,rgba(34,197,94,0.30) 0%,transparent 70%)', pointerEvents:'none' }}/>
                  <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,transparent,rgba(34,197,94,0.7),transparent)', animation:'scScan 2.5s linear infinite', pointerEvents:'none' }}/>
                </>
              )}

              <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'space-between', gap:14 }}>
                <div style={{ flex:1, minWidth:0 }}>

                  {/* ── Status pill row ── */}
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>

                    {/* Status pill */}
                    <div style={{
                      display:'inline-flex', alignItems:'center', gap:6,
                      padding:'4px 10px', borderRadius:100,
                      background: mode==='trip' ? 'rgba(255,255,255,0.10)' : mode==='waiting' ? 'rgba(22,163,74,.12)' : C.surfaceAlt,
                      border: mode==='trip' ? '1px solid rgba(255,255,255,0.15)' : mode==='waiting' ? '1px solid rgba(22,163,74,.20)' : `1px solid ${C.border}`,
                    }}>
                      <div style={{
                        width:6, height:6, borderRadius:'50%',
                        background: mode==='offline' ? C.textDim : '#22C55E',
                        boxShadow: mode!=='offline' ? '0 0 8px rgba(34,197,94,0.7)' : 'none',
                        animation: mode!=='offline' ? 'scLiveDot 1.6s ease-in-out infinite' : 'none',
                      }}/>
                      <span className="mono" style={{
                        fontSize:10, fontWeight:800, letterSpacing:'.12em', textTransform:'uppercase',
                        color: mode==='trip' ? 'rgba(255,255,255,0.85)' : mode==='waiting' ? C.onlineGreen : C.textDim,
                      }}>
                        {mode==='trip' && 'On trip'}
                        {mode==='waiting' && 'Online · ready'}
                        {mode==='offline' && 'Offline'}
                      </span>
                    </div>

                    {/* ── Scheduled count badge ── */}
                    {scheduledRides.length > 0 && (
                      <div style={{
                        display:'inline-flex', alignItems:'center', gap:4,
                        padding:'4px 9px', borderRadius:100,
                        background:'rgba(129,140,248,.13)',
                        border:'1px solid rgba(129,140,248,.30)',
                      }}>
                        <Calendar size={10} color='#818CF8' strokeWidth={2.2}/>
                        <span className="mono" style={{
                          fontSize:10, fontWeight:800, letterSpacing:'.10em',
                          textTransform:'uppercase', color:'#818CF8',
                        }}>
                          {scheduledRides.length} sched
                        </span>
                      </div>
                    )}

                  </div>

                  {/* Title */}
                  <div className="condensed" style={{
                    fontSize:26, fontWeight:900,
                    color: mode==='trip' ? '#fff' : C.text,
                    letterSpacing:'-0.5px', lineHeight:1.1, marginBottom:4,
                    opacity: mode==='offline' ? 0.65 : 1,
                  }}>
                    {mode==='offline' && "You're offline"}
                    {mode==='waiting' && 'Looking for rides'}
                    {mode==='trip'    && `Active trip · ${(tripStage ?? '').replace('_', ' ')}`}
                  </div>

                  {/* Sub-meta */}
                  <div style={{
                    display:'flex', alignItems:'center', gap:10,
                    fontSize:12, fontWeight:600,
                    color: mode==='trip' ? 'rgba(255,255,255,0.55)' : mode==='waiting' ? '#15803D' : C.textDim,
                    flexWrap:'wrap',
                  }}>
                    {mode==='offline' && <span>Tap "Go online" to start earning</span>}
                    {mode==='waiting' && (
                      <>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
                          <Radar size={12} strokeWidth={2.2}/> Scanning area
                        </span>
                        {sinceMs && (
                          <>
                            <span style={{ width:3, height:3, borderRadius:'50%', background:'rgba(22,163,74,.35)' }}/>
                            <span>Online {onlineLabel}</span>
                          </>
                        )}
                        {nearbyCount > 0 && (
                          <>
                            <span style={{ width:3, height:3, borderRadius:'50%', background:'rgba(22,163,74,.35)' }}/>
                            <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
                              <MapPin size={11} strokeWidth={2.2}/>{nearbyCount} nearby
                            </span>
                          </>
                        )}
                      </>
                    )}
                    {mode==='trip' && (
                      <span style={{ display:'inline-flex', alignItems:'center', gap:5 }}>
                        <Zap size={12} fill="#22C55E" strokeWidth={0}/> Earning · stay focused
                      </span>
                    )}
                  </div>
                </div>

                {/* Toggle button */}
                {!activeTrip && (
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8, flexShrink:0 }}>
                    <button
                      onClick={e => { e.stopPropagation(); onToggle(); }}
                      style={{
                        background: online
                          ? 'linear-gradient(135deg,#22C55E 0%,#16A34A 55%,#15803D 100%)'
                          : 'linear-gradient(135deg,#0F172A,#1F2937 55%,#0F172A)',
                        border:'none', borderRadius:100,
                        padding: online ? '13px 18px' : '13px 22px',
                        color:'#fff',
                        fontFamily:"'Barlow',sans-serif",
                        fontWeight:800, fontSize:14, letterSpacing:'.3px',
                        cursor:'pointer',
                        display:'flex', alignItems:'center', gap:7,
                        transition:'filter .15s, transform .1s',
                        boxShadow: online ? '0 8px 20px rgba(22,163,74,.35)' : '0 8px 20px rgba(0,0,0,.18)',
                        animation: online ? 'scOnlinePulse 2.4s ease-in-out infinite' : 'none',
                      }}
                      onMouseEnter={e => e.currentTarget.style.filter='brightness(1.08)'}
                      onMouseLeave={e => e.currentTarget.style.filter=''}
                      onMouseDown={e  => e.currentTarget.style.transform='scale(.97)'}
                      onMouseUp={e    => e.currentTarget.style.transform=''}
                    >
                      <Power size={15} strokeWidth={2.6} fill={online ? '#fff' : 'transparent'}/>
                      {online ? 'Online' : 'Go online'}
                    </button>

                    {/* Scheduled badge — tap hint */}
                    {hasScheduled && (
                      <div style={{
                        display:'inline-flex', alignItems:'center', gap:5,
                        padding:'5px 10px', borderRadius:99,
                        background:'rgba(129,140,248,.12)',
                        border:'1px solid rgba(129,140,248,.30)',
                        cursor:'pointer',
                      }}>
                        <Calendar size={11} color='#818CF8' strokeWidth={2.2}/>
                        <span style={{ fontSize:10.5, fontWeight:800, color:'#818CF8', letterSpacing:'.04em' }}>
                          {upcomingRides.length} scheduled
                        </span>
                        <ChevronRight size={10} color='rgba(129,140,248,.6)'/>
                      </div>
                    )}
                  </div>
                )}

                {/* On-trip mini indicator */}
                {activeTrip && (
                  <div style={{
                    flexShrink:0, width:48, height:48, borderRadius:14,
                    background:'rgba(34,197,94,0.15)', border:'1.5px solid rgba(34,197,94,0.35)',
                    display:'flex', alignItems:'center', justifyContent:'center', position:'relative',
                  }}>
                    <Zap size={20} color="#4ADE80" fill="#4ADE80" strokeWidth={2}/>
                    <div style={{ position:'absolute', inset:-6, borderRadius:18, border:'2px solid rgba(34,197,94,0.4)', animation:'scRadar 2s ease-out infinite', pointerEvents:'none' }}/>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ════════════ BACK — Scheduled Rides ════════════ */}
          <div style={{
            position:'absolute', inset:0,
            backfaceVisibility:'hidden',
            WebkitBackfaceVisibility:'hidden',
            transform:'rotateY(180deg)',
            borderRadius:22,
          }}>
            <div style={{
              background: schedStyles.bg,
              border: schedStyles.border,
              borderRadius: 22,
              padding: '22px',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: schedStyles.shadow,
              height: '100%',
              boxSizing: 'border-box',
            }}>
              {/* Indigo glow blobs */}
              <div style={{ position:'absolute', top:-60, right:-60, width:200, height:200, borderRadius:'50%', background:'radial-gradient(circle,rgba(129,140,248,.28) 0%,transparent 70%)', filter:'blur(30px)', pointerEvents:'none' }}/>
              <div style={{ position:'absolute', bottom:-40, left:-40, width:160, height:160, borderRadius:'50%', background:'radial-gradient(circle,rgba(244,114,182,.18) 0%,transparent 70%)', filter:'blur(24px)', pointerEvents:'none' }}/>

              {/* Grid */}
              <div style={{ position:'absolute', inset:0, opacity:.06, backgroundImage:'linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)', backgroundSize:'32px 32px', pointerEvents:'none' }}/>

              {/* Scan line */}
              <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,transparent,rgba(129,140,248,0.7),transparent)', animation:'scScan 3s linear infinite', pointerEvents:'none' }}/>

              <div
                className="sc-face"
                key={rideIdx}
                style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'space-between', gap:14 }}
              >
                <div style={{ flex:1, minWidth:0 }}>

                  {/* Pill */}
                  <div style={{
                    display:'inline-flex', alignItems:'center', gap:6,
                    padding:'4px 10px', borderRadius:100,
                    background:'rgba(129,140,248,.14)',
                    border:'1px solid rgba(129,140,248,.28)',
                    marginBottom:8,
                  }}>
                    <div style={{
                      width:6, height:6, borderRadius:'50%', background:'#818CF8',
                      boxShadow:'0 0 8px rgba(129,140,248,0.8)',
                      animation:'scLiveDot 1.6s ease-in-out infinite',
                    }}/>
                    <span className="mono" style={{ fontSize:10, fontWeight:800, letterSpacing:'.12em', textTransform:'uppercase', color:'#A5B4FC' }}>
                      {upcomingRides.length > 1
                        ? `Ride ${rideIdx + 1} of ${upcomingRides.length}`
                        : 'Scheduled ride'}
                    </span>
                  </div>

                  {/* Count headline */}
                  <div className="condensed" style={{
                    fontSize:26, fontWeight:900, color:'#fff',
                    letterSpacing:'-0.5px', lineHeight:1.1, marginBottom:4,
                    animation:'scCountGlow 3s ease-in-out infinite',
                  }}>
                    {upcomingRides.length === 1
                      ? '1 ride scheduled'
                      : `${upcomingRides.length} rides scheduled`}
                  </div>

                  {/* Ride detail */}
                  {currentRide && (
                    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                      {/* Time */}
                      {(currentRide.scheduledAt || currentRide.createdAt) && (
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <Clock size={11} color='rgba(165,180,252,.7)' strokeWidth={2.2}/>
                          <span style={{ fontSize:12, fontWeight:700, color:'rgba(165,180,252,.9)' }}>
                            {fmtScheduled(currentRide.scheduledAt || currentRide.createdAt) ?? '—'}
                          </span>
                          <span style={{
                            fontSize:10.5, fontWeight:700,
                            color:'#818CF8',
                            background:'rgba(129,140,248,.14)',
                            border:'1px solid rgba(129,140,248,.25)',
                            padding:'1px 7px', borderRadius:99,
                          }}>
                            {fmtCountdown(currentRide.scheduledAt || currentRide.createdAt)}
                          </span>
                        </div>
                      )}
                      {/* Location */}
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <MapPin size={11} color='rgba(165,180,252,.7)' strokeWidth={2.2}/>
                        <span style={{ fontSize:12, fontWeight:600, color:'rgba(255,255,255,.55)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                          {parseCity(currentRide)}
                        </span>
                        {currentRide.fareBreakdown?.fareTotal && (
                          <>
                            <span style={{ color:'rgba(255,255,255,.2)', fontSize:11 }}>·</span>
                            <span style={{ fontFamily:'"JetBrains Mono",monospace', fontSize:12, fontWeight:700, color:'#A5B4FC' }}>
                              ${Number(currentRide.fareBreakdown.fareTotal).toFixed(2)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right side */}
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8, flexShrink:0 }}>

                  {/* Got it button */}
                  <button
                    onClick={e => { e.stopPropagation(); handleFlip(); }}
                    style={{
                      background:'linear-gradient(135deg,#818CF8 0%,#6366F1 55%,#4F46E5 100%)',
                      border:'none', borderRadius:100,
                      padding:'13px 18px',
                      color:'#fff',
                      fontFamily:"'Barlow',sans-serif",
                      fontWeight:800, fontSize:14, letterSpacing:'.3px',
                      cursor:'pointer',
                      display:'flex', alignItems:'center', gap:7,
                      transition:'filter .15s, transform .1s',
                      animation:'scSchedulePulse 2.4s ease-in-out infinite',
                    }}
                    onMouseEnter={e => e.currentTarget.style.filter='brightness(1.08)'}
                    onMouseLeave={e => e.currentTarget.style.filter=''}
                    onMouseDown={e  => e.currentTarget.style.transform='scale(.97)'}
                    onMouseUp={e    => e.currentTarget.style.transform=''}
                  >
                    <Navigation size={15} strokeWidth={2.6}/>
                    Got it
                  </button>

                  {/* Dot indicators for multiple rides */}
                  {upcomingRides.length > 1 && (
                    <div style={{ display:'flex', gap:4 }}>
                      {upcomingRides.slice(0, Math.min(5, upcomingRides.length)).map((_,i) => (
                        <div key={i} style={{
                          width: i===rideIdx ? 14 : 5,
                          height:5, borderRadius:3,
                          background: i===rideIdx ? '#818CF8' : 'rgba(255,255,255,.2)',
                          boxShadow: i===rideIdx ? '0 0 8px rgba(129,140,248,.7)' : 'none',
                          transition:'all .3s ease',
                        }}/>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}