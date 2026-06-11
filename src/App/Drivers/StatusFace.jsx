import { useState, useEffect } from 'react';
import { Power, Radar, Zap, ArrowRight } from 'lucide-react';
import { C } from '@/App/Drivers/constants.js';

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function timeAgo(ts) {
  if (!ts) return null;
  const ms  = ts?.toMillis?.() ?? (ts?.seconds * 1000) ?? (typeof ts === 'number' ? ts : 0);
  const sec = Math.floor((Date.now() - ms) / 1000);
  if (sec < 60)  return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60)  return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

export default function StatusFace({ mode, online, activeTrip, tripStage, sinceMs, onlineLabel, nearbyCount, onToggle, driver, searches }) {
  const [showGreeting, setShowGreeting] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (mode !== 'waiting') { setShowGreeting(false); return; }
    setShowGreeting(true);
    const t = setTimeout(() => setShowGreeting(false), 2800);
    return () => clearTimeout(t);
  }, [mode, driver?.firstName]);

  // tick every 5s to keep "Xs ago" fresh
  useEffect(() => {
    if (mode !== 'waiting') return;
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, [mode]);

  // ── Latest search ──────────────────────────────────
  const latestSearch = searches?.length > 0
    ? [...searches].sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() ?? (a.createdAt?.seconds * 1000) ?? 0;
        const tb = b.createdAt?.toMillis?.() ?? (b.createdAt?.seconds * 1000) ?? 0;
        return tb - ta;
      })[0]
    : null;

  const isLiveSearch   = !!latestSearch?.pickupCity;
  const pickupCity     = latestSearch?.pickupCity  ?? latestSearch?.pickup?.split(',')[1]?.trim()  ?? null;
  const dropoffCity    = latestSearch?.dropoffCity ?? latestSearch?.dropoff?.split(',')[1]?.trim() ?? null;
  const searchMiles    = latestSearch?.miles    ?? null;
  const searchMinutes  = latestSearch?.minutes  ?? null;
  const searchAge      = latestSearch?.createdAt ? timeAgo(latestSearch.createdAt) : null;

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:14 }}>
      <div style={{ flex:1, minWidth:0 }}>

        {/* ── Status pill ── */}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
          <div style={{
            display:'inline-flex', alignItems:'center', gap:6,
            padding:'4px 10px', borderRadius:100,
            background: mode==='trip' ? 'rgba(34,197,94,.18)' : mode==='waiting' ? 'rgba(22,163,74,.12)' : C.surfaceAlt,
            border: mode==='trip' ? '1px solid rgba(34,197,94,.45)' : mode==='waiting' ? '1px solid rgba(22,163,74,.20)' : `1px solid ${C.border}`,
          }}>
            <div style={{
              width:6, height:6, borderRadius:'50%',
              background: mode==='offline' ? C.textDim : '#22C55E',
              boxShadow: mode!=='offline' ? '0 0 8px rgba(34,197,94,0.7)' : 'none',
              animation: mode!=='offline' ? 'scLiveDot 1.6s ease-in-out infinite' : 'none',
            }}/>
            <span className="mono" style={{ fontSize:10, fontWeight:800, letterSpacing:'.12em', textTransform:'uppercase', color: mode==='trip' ? '#4ADE80' : mode==='waiting' ? C.onlineGreen : C.textDim }}>
              {mode==='trip' ? 'On trip' : mode==='waiting' ? 'Online · ready' : 'Offline'}
            </span>
          </div>
        </div>

        {/* ── Flipping headline ── */}
        <div className="condensed" style={{ fontSize:26, fontWeight:900, color: mode==='trip' ? '#fff' : C.text, letterSpacing:'-0.5px', lineHeight:1.1, marginBottom:4, opacity: mode==='offline' ? 0.65 : 1 }}>
          {mode==='offline' && "You're offline"}
          {mode==='trip'    && `Active trip · ${(tripStage ?? '').replace('_', ' ')}`}
          {mode==='waiting' && (showGreeting
            ? `${getGreeting()}, ${driver?.firstName || '...'} 👋`
            : isLiveSearch && pickupCity
              ? `Rider near ${pickupCity}`
              : 'Looking for rides'
          )}
        </div>

        {/* ── Subtext badge ── */}
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          {mode==='offline' && (
            <span style={{ fontSize:12, fontWeight:600, color:C.textDim }}>Tap "Go online" to start earning</span>
          )}

          {mode==='waiting' && (
            <div style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:100, background:'rgba(22,163,74,.10)', border:'1px solid rgba(22,163,74,.20)', fontSize:11, fontWeight:600, color:'#15803D', flexWrap:'nowrap', maxWidth:'100%', overflow:'hidden' }}>
              <Radar size={11} strokeWidth={2.2} style={{ flexShrink:0 }}/>

              {isLiveSearch && pickupCity && dropoffCity ? (
                <>
                  <span style={{ whiteSpace:'nowrap' }}>{pickupCity}</span>
                  <ArrowRight size={9} strokeWidth={2.5} style={{ flexShrink:0, opacity:.6 }}/>
                  <span style={{ whiteSpace:'nowrap' }}>{dropoffCity}</span>
                  {searchMiles && (
                    <>
                      <span style={{ width:2, height:2, borderRadius:'50%', background:'rgba(22,163,74,.5)', flexShrink:0 }}/>
                      <span style={{ whiteSpace:'nowrap' }}>{searchMiles} mi</span>
                    </>
                  )}
                  {searchMinutes && (
                    <>
                      <span style={{ width:2, height:2, borderRadius:'50%', background:'rgba(22,163,74,.5)', flexShrink:0 }}/>
                      <span style={{ whiteSpace:'nowrap' }}>{searchMinutes} min</span>
                    </>
                  )}
                  {searchAge && (
                    <>
                      <span style={{ width:2, height:2, borderRadius:'50%', background:'rgba(22,163,74,.5)', flexShrink:0 }}/>
                      <span style={{ whiteSpace:'nowrap', opacity:.7 }}>{searchAge}</span>
                    </>
                  )}
                </>
              ) : (
                <span>Scanning area</span>
              )}

              {sinceMs && (
                <>
                  <span style={{ width:2, height:2, borderRadius:'50%', background:'rgba(22,163,74,.5)', flexShrink:0 }}/>
                  <span style={{ whiteSpace:'nowrap' }}>{onlineLabel}</span>
                </>
              )}
            </div>
          )}

          {mode==='trip' && (
            <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12, fontWeight:600, color:'rgba(74,222,128,.80)' }}>
              <Zap size={12} fill="#22C55E" strokeWidth={0}/> Earning · stay focused
            </span>
          )}
        </div>

      </div>

      {/* ── Toggle button ── */}
      {!activeTrip && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:8, flexShrink:0 }}>
          <button
            onClick={e => { e.stopPropagation(); onToggle(); }}
            style={{
              background: online ? 'linear-gradient(135deg,#22C55E 0%,#16A34A 55%,#15803D 100%)' : 'linear-gradient(135deg,#0F172A,#1F2937 55%,#0F172A)',
              border:'none', borderRadius:100,
              padding: online ? '13px 18px' : '13px 22px',
              color:'#fff', fontFamily:"'Barlow',sans-serif",
              fontWeight:800, fontSize:14, letterSpacing:'.3px',
              cursor:'pointer', display:'flex', alignItems:'center', gap:7,
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
        </div>
      )}

      {/* ── Active trip icon ── */}
      {activeTrip && (
        <div style={{ flexShrink:0, width:48, height:48, borderRadius:14, background:'rgba(34,197,94,0.15)', border:'1.5px solid rgba(34,197,94,0.35)', display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
          <Zap size={20} color="#4ADE80" fill="#4ADE80" strokeWidth={2}/>
          <div style={{ position:'absolute', inset:-6, borderRadius:18, border:'2px solid rgba(34,197,94,0.4)', animation:'scRadar 2s ease-out infinite', pointerEvents:'none' }}/>
        </div>
      )}
    </div>
  );
}