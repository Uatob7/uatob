import { useState, useEffect, useRef } from 'react';
import { Power, Radar, ArrowRight } from 'lucide-react';
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

// ── Flip headline ──────────────────────────────────────────
function FlipHeadline({ front, back, showFront, heartbeat }) {
  return (
    <div style={{ position: 'relative', height: 28, overflow: 'hidden' }}>
      {/* front — greeting */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center',
        transition: 'transform .45s cubic-bezier(.4,0,.2,1), opacity .45s',
        transform: showFront ? 'translateY(0)' : 'translateY(-110%)',
        opacity: showFront ? 1 : 0,
        pointerEvents: 'none',
      }}>
        <span className="condensed" style={{
          fontSize: 22, fontWeight: 900, letterSpacing: '-0.4px',
          color: C.text, whiteSpace: 'nowrap',
        }}>
          {front}
        </span>
      </div>

      {/* back — searching */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', gap: 7,
        transition: 'transform .45s cubic-bezier(.4,0,.2,1), opacity .45s',
        transform: showFront ? 'translateY(110%)' : 'translateY(0)',
        opacity: showFront ? 0 : 1,
        pointerEvents: 'none',
      }}>
        {/* heartbeat dot */}
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: '#22C55E',
          flexShrink: 0,
          boxShadow: '0 0 0 0 rgba(34,197,94,.6)',
          animation: heartbeat ? 'scHeartbeat 1.4s ease-in-out infinite' : 'none',
        }}/>
        <span className="condensed" style={{
          fontSize: 22, fontWeight: 900, letterSpacing: '-0.4px',
          color: C.text, whiteSpace: 'nowrap',
        }}>
          {back}
        </span>
      </div>
    </div>
  );
}

// ── Route badge ─────────────────────────────────────────────
function RouteBadge({ pickup, dropoff, miles, minutes, searchAge, sinceLabel, sinceMs, scanning }) {
  const hasRoute = pickup && dropoff;

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '4px 10px', borderRadius: 100,
      background: 'rgba(22,163,74,.10)',
      border: '1px solid rgba(22,163,74,.22)',
      fontSize: 11, fontWeight: 600, color: '#15803D',
      maxWidth: '100%', overflow: 'hidden',
      flexWrap: 'nowrap',
    }}>
      <Radar size={11} strokeWidth={2.2} style={{ flexShrink: 0 }}/>

      {hasRoute ? (
        <>
          <span style={{ whiteSpace: 'nowrap' }}>{pickup}</span>
          <ArrowRight size={9} strokeWidth={2.5} style={{ flexShrink: 0, opacity: .55 }}/>
          <span style={{ whiteSpace: 'nowrap' }}>{dropoff}</span>

          {miles && (
            <>
              <Dot/>
              <span style={{ whiteSpace: 'nowrap' }}>{miles} mi</span>
            </>
          )}
          {minutes && (
            <>
              <Dot/>
              <span style={{ whiteSpace: 'nowrap' }}>{minutes} min</span>
            </>
          )}
          {searchAge && (
            <>
              <Dot/>
              <span style={{ whiteSpace: 'nowrap', opacity: .65 }}>{searchAge}</span>
            </>
          )}
        </>
      ) : (
        <span style={{ whiteSpace: 'nowrap' }}>
          {scanning ? 'Scanning area' : 'No activity'}
        </span>
      )}

      {sinceMs && sinceLabel && (
        <>
          <Dot/>
          <span style={{ whiteSpace: 'nowrap', opacity: .75 }}>{sinceLabel}</span>
        </>
      )}
    </div>
  );
}

function Dot() {
  return (
    <span style={{ width: 2, height: 2, borderRadius: '50%', background: 'rgba(22,163,74,.55)', flexShrink: 0 }}/>
  );
}

// ── Main component ───────────────────────────────────────────
export default function StatusFace({
  mode, online, activeTrip, tripStage,
  sinceMs, onlineLabel, onToggle, driver, searches,
}) {
  const [showGreeting, setShowGreeting] = useState(true);
  const [, setNow] = useState(Date.now());

  // flip back after 2.8s
  useEffect(() => {
    if (mode !== 'waiting') { setShowGreeting(false); return; }
    setShowGreeting(true);
    const t = setTimeout(() => setShowGreeting(false), 2800);
    return () => clearTimeout(t);
  }, [mode, driver?.firstName]);

  // tick for "Xs ago"
  useEffect(() => {
    if (mode !== 'waiting') return;
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, [mode]);

  // ── Latest search ─────────────────────────────────────────
  const latestSearch = searches?.length > 0
    ? [...searches].sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() ?? (a.createdAt?.seconds * 1000) ?? 0;
        const tb = b.createdAt?.toMillis?.() ?? (b.createdAt?.seconds * 1000) ?? 0;
        return tb - ta;
      })[0]
    : null;

  const pickupCity   = latestSearch?.pickupCity  ?? latestSearch?.pickup?.split(',')[1]?.trim()  ?? null;
  const dropoffCity  = latestSearch?.dropoffCity ?? latestSearch?.dropoff?.split(',')[1]?.trim() ?? null;
  const searchMiles  = latestSearch?.miles   ?? null;
  const searchMins   = latestSearch?.minutes ?? null;
  const searchAge    = latestSearch?.createdAt ? timeAgo(latestSearch.createdAt) : null;
  const isLiveSearch = !!pickupCity;

  // ── Derived headline text ─────────────────────────────────
  const greetingText = `${driver?.firstName ? `Hey, ${driver.firstName} 👋` : 'Hey there 👋'}`;
  const backText = mode === 'trip'
    ? `On trip · ${(tripStage ?? '').replace('_', ' ')}`
    : isLiveSearch && pickupCity
      ? `Rider near ${pickupCity}`
      : 'Looking for riders';

  return (
    <>
      {/* inject heartbeat keyframe once */}
      <style>{`
        @keyframes scHeartbeat {
          0%,100% { transform:scale(1);   box-shadow:0 0 0 0   rgba(34,197,94,.6); }
          14%      { transform:scale(1.35); box-shadow:0 0 0 0   rgba(34,197,94,.4); }
          28%      { transform:scale(1);   box-shadow:0 0 0 6px rgba(34,197,94,0);  }
          42%      { transform:scale(1.2); box-shadow:0 0 0 0   rgba(34,197,94,.3); }
          70%      { transform:scale(1);   box-shadow:0 0 0 8px rgba(34,197,94,0);  }
        }
        @keyframes scOnlinePulse {
          0%,100% { box-shadow:0 8px 20px rgba(22,163,74,.35); }
          50%     { box-shadow:0 8px 28px rgba(22,163,74,.55); }
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* ── Row 1: flip headline + toggle button ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>

          <FlipHeadline
            front={greetingText}
            back={backText}
            showFront={showGreeting}
            heartbeat={mode === 'waiting' && !showGreeting}
          />

          {/* Toggle — hidden while on active trip */}
          {!activeTrip && (
            <button
              onClick={e => { e.stopPropagation(); onToggle(); }}
              style={{
                flexShrink: 0,
                background: online
                  ? 'linear-gradient(135deg,#22C55E 0%,#16A34A 55%,#15803D 100%)'
                  : 'linear-gradient(135deg,#0F172A,#1F2937 55%,#0F172A)',
                border: 'none', borderRadius: 100,
                padding: '9px 16px',
                color: '#fff',
                fontFamily: "'Barlow',sans-serif",
                fontWeight: 800, fontSize: 13, letterSpacing: '.3px',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                transition: 'filter .15s, transform .1s',
                boxShadow: online
                  ? '0 6px 16px rgba(22,163,74,.35)'
                  : '0 6px 16px rgba(0,0,0,.18)',
                animation: online ? 'scOnlinePulse 2.4s ease-in-out infinite' : 'none',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.08)'}
              onMouseLeave={e => e.currentTarget.style.filter = ''}
              onMouseDown={e  => e.currentTarget.style.transform = 'scale(.96)'}
              onMouseUp={e    => e.currentTarget.style.transform = ''}
            >
              <Power size={13} strokeWidth={2.6} fill={online ? '#fff' : 'transparent'}/>
              {online ? 'Online' : 'Go online'}
            </button>
          )}
        </div>

        {/* ── Row 2: route / status badge ── */}
        {mode === 'waiting' && (
          <RouteBadge
            pickup={pickupCity}
            dropoff={dropoffCity}
            miles={searchMiles}
            minutes={searchMins}
            searchAge={searchAge}
            sinceMs={sinceMs}
            sinceLabel={onlineLabel}
            scanning={online}
          />
        )}

        {mode === 'offline' && (
          <span style={{ fontSize: 11, fontWeight: 600, color: C.textDim }}>
            Tap "Go online" to start earning
          </span>
        )}

        {mode === 'trip' && (
          <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(74,222,128,.75)' }}>
            ⚡ Earning · stay focused
          </span>
        )}

      </div>
    </>
  );
}
