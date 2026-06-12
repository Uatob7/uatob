import { useEffect, useRef, useState, useCallback, useMemo, Component } from 'react';
import {
  FACE_BOOK, FACE_SEARCHES, FACE_SCHEDULED, FACE_NOTIFS, FACE_ACCOUNT, FACE_TRIPS,
  FACE_META, MONO,
} from '@/App/UaTob/Statuscardtokens';

import BookRideCard      from '@/App/UaTob/BookRideCard';
import SearchesCard      from '@/App/UaTob/SearchesCard';
import ScheduledCard     from '@/App/UaTob/ScheduledCard';
import NotificationsCard from '@/App/UaTob/NotificationsCard';
import AccountCard       from '@/App/UaTob/AccountCard';
import TripsCard         from '@/App/UaTob/TripsCard';

class FaceBoundary extends Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (this.state.err) {
      return (
        <div style={{ padding: '14px', fontFamily: "'JetBrains Mono',monospace", fontSize: 9,
          color: 'rgba(248,113,113,.7)', background: 'rgba(248,113,113,.06)',
          border: '1px solid rgba(248,113,113,.18)', borderRadius: 11 }}>
          Component error — check the console.
        </div>
      );
    }
    return this.props.children;
  }
}

function tsToMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts?.seconds) return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  return 0;
}

// Per-face scan line accent
const SCAN_COLOR = {
  [FACE_BOOK]:      'rgba(34,197,94,.55)',
  [FACE_SEARCHES]:  'rgba(6,182,212,.55)',
  [FACE_SCHEDULED]: 'rgba(129,140,248,.55)',
  [FACE_NOTIFS]:    'rgba(52,211,153,.52)',
  [FACE_ACCOUNT]:   'rgba(251,191,36,.50)',
  [FACE_TRIPS]:     'rgba(244,114,182,.50)',
};

export default function StatusCard({
  face,
  onFaceChange,
  rides = [],
  searches = [],
  scheduledRides = [],
  trips = [],
  account = null,
  drivers = [],
  now,
  uid,
  createTrip,
  callSaveFcmToken,
  onBook,
}) {
  const [bookingActive, setBookingActive] = useState(false);
  const cycleRef      = useRef(null);
  const resumeRef     = useRef(null);
  const startCycleRef = useRef(null);
  const userPausedRef = useRef(false);
  const prevSchedRef  = useRef(scheduledRides.length);

  // ── Smart face order — skip faces with nothing to show ───────────────────
  const activeOrder = useMemo(() => {
    const now2 = Date.now();
    const hasUpcoming = scheduledRides.some(r =>
      tsToMillis(r.scheduledAt ?? r.createdAt) > now2
    );
    const recent5min  = searches.filter(s => tsToMillis(s.createdAt) > now2 - 5 * 60_000).length;
    const isDemandHot = recent5min >= 7;
    const hasHistory  = trips.length > 0 || rides.some(r => r.status === 'completed');

    const order = [FACE_BOOK];
    if (isDemandHot)  order.push(FACE_SEARCHES);
    if (hasUpcoming)  order.push(FACE_SCHEDULED);
    if (!isDemandHot) order.push(FACE_SEARCHES);
    order.push(FACE_NOTIFS);
    if (hasHistory)   order.push(FACE_TRIPS);
    order.push(FACE_ACCOUNT);
    return order;
  }, [scheduledRides, searches, trips, rides]);

  // ── Per-face duration ────────────────────────────────────────────────────
  const faceDuration = useMemo(() => {
    const r5 = searches.filter(s => tsToMillis(s.createdAt) > Date.now() - 5 * 60_000).length;
    return {
      [FACE_BOOK]:      7500,
      [FACE_SEARCHES]:  r5 >= 7 ? 7000 : 5500,
      [FACE_SCHEDULED]: 6000,
      [FACE_NOTIFS]:    5000,
      [FACE_TRIPS]:     4500,
      [FACE_ACCOUNT]:   4500,
    };
  }, [searches]);

  const authActive  = face === FACE_ACCOUNT && !uid;
  const flowBlocked = bookingActive || authActive;

  // ── Timeout-based cycle — each face owns its own duration ────────────────
  const startCycle = useCallback(() => {
    clearTimeout(cycleRef.current);
    if (flowBlocked || userPausedRef.current) return;
    const ms = faceDuration[face] ?? 5500;
    cycleRef.current = setTimeout(() => {
      const idx  = activeOrder.indexOf(face);
      const next = activeOrder[(idx + 1) % activeOrder.length];
      onFaceChange?.(next);
    }, ms);
  }, [face, flowBlocked, faceDuration, activeOrder, onFaceChange]);

  useEffect(() => { startCycleRef.current = startCycle; }, [startCycle]);

  useEffect(() => {
    startCycle();
    return () => { clearTimeout(cycleRef.current); clearTimeout(resumeRef.current); };
  }, [startCycle]);

  // ── Snap off removed face ────────────────────────────────────────────────
  useEffect(() => {
    if (!activeOrder.includes(face)) onFaceChange?.(FACE_BOOK);
  }, [activeOrder, face, onFaceChange]);

  // ── Priority jump — surface new scheduled ride immediately ───────────────
  useEffect(() => {
    const prev = prevSchedRef.current;
    prevSchedRef.current = scheduledRides.length;
    if (scheduledRides.length > prev && !bookingActive && face !== FACE_SCHEDULED) {
      clearTimeout(cycleRef.current);
      clearTimeout(resumeRef.current);
      userPausedRef.current = true;
      onFaceChange?.(FACE_SCHEDULED);
      resumeRef.current = setTimeout(() => {
        userPausedRef.current = false;
        startCycleRef.current?.();
      }, 8000);
    }
  }, [scheduledRides.length, bookingActive, face, onFaceChange]);

  // ── Tap to flip — 7s smart auto-resume ──────────────────────────────────
  const goFace = useCallback((f) => {
    clearTimeout(cycleRef.current);
    clearTimeout(resumeRef.current);
    userPausedRef.current = true;
    onFaceChange?.(f);
    if (f !== FACE_ACCOUNT) {
      resumeRef.current = setTimeout(() => {
        userPausedRef.current = false;
        startCycleRef.current?.();
      }, 7000);
    }
  }, [onFaceChange]);

  // ── Ambient signal bar ───────────────────────────────────────────────────
  const signal = useMemo(() => {
    const now2 = Date.now();
    const r5   = searches.filter(s => tsToMillis(s.createdAt) > now2 - 5 * 60_000).length;
    const up   = scheduledRides.filter(r => tsToMillis(r.scheduledAt ?? r.createdAt) > now2).length;
    const surge = r5 >= 13 ? 'SURGE' : r5 >= 7 ? 'BUSY' : r5 >= 3 ? 'STEADY' : null;
    return { live: searches.length, upcoming: up, surge };
  }, [searches, scheduledRides]);

  const signalDotColor = signal.surge === 'SURGE' ? '#F87171'
    : signal.surge === 'BUSY'   ? '#FBBF24'
    : '#22D3EE';

  const scanColor = SCAN_COLOR[face] ?? 'rgba(34,197,94,.55)';
  const showSignal = (signal.live > 0 || signal.upcoming > 0 || signal.surge) && !bookingActive;

  return (
    <div>
      <style>{`
        @keyframes scFaceIn   { from{opacity:0;transform:translateY(8px) scale(.985)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes scSigPulse { 0%,100%{opacity:1} 50%{opacity:.2} }
        @keyframes scScan     { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
        .sc-face { animation: scFaceIn .42s cubic-bezier(.34,1.2,.64,1) both; }
      `}</style>

      {/* ── Outer card ───────────────────────────────────────────────────── */}
      <div style={{
        background:           'rgba(3,7,4,.96)',
        backdropFilter:       'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        border:               '1.5px solid rgba(34,197,94,.13)',
        borderRadius:         22,
        overflow:             'hidden',
        boxShadow:            '0 22px 60px rgba(0,0,0,.65), 0 4px 16px rgba(0,0,0,.4)',
        position:             'relative',
      }}>

        {/* Per-face scan line */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2, zIndex: 2,
          background: `linear-gradient(90deg, transparent, ${scanColor}, transparent)`,
          animation: 'scScan 3s linear infinite',
          pointerEvents: 'none',
        }}/>

        {/* ── Ambient signal bar ─────────────────────────────────────────── */}
        {showSignal && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 7, padding: '10px 14px 4px', flexWrap: 'wrap', position: 'relative', zIndex: 1,
          }}>
            {signal.live > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: 4, height: 4, borderRadius: '50%',
                  background: signalDotColor,
                  animation: 'scSigPulse 1.8s ease-in-out infinite',
                }}/>
                <span style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 700, color: 'rgba(255,255,255,.38)' }}>
                  {signal.live} searching
                </span>
              </div>
            )}
            {signal.surge && (
              <>
                <span style={{ color: 'rgba(255,255,255,.14)', fontSize: 8 }}>·</span>
                <span style={{
                  fontFamily: MONO, fontSize: 8, fontWeight: 800, letterSpacing: '.08em',
                  color: signal.surge === 'SURGE' ? '#F87171' : signal.surge === 'BUSY' ? '#FBBF24' : 'rgba(255,255,255,.32)',
                }}>
                  {signal.surge}
                </span>
              </>
            )}
            {signal.upcoming > 0 && (
              <>
                <span style={{ color: 'rgba(255,255,255,.14)', fontSize: 8 }}>·</span>
                <span style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 700, color: 'rgba(192,132,252,.6)' }}>
                  {signal.upcoming} upcoming
                </span>
              </>
            )}
          </div>
        )}

        {/* ── Face body — tap anywhere outside interactive elements to flip ─ */}
        <div
          className="sc-face"
          key={face}
          style={{ cursor: !flowBlocked ? 'pointer' : 'default', position: 'relative', zIndex: 1 }}
          onClick={(e) => {
            if (flowBlocked) return;
            if (e.target.closest('button, input, a, textarea, select')) return;
            const idx = activeOrder.indexOf(face);
            goFace(activeOrder[(idx + 1) % activeOrder.length]);
          }}
        >
          {face === FACE_BOOK && (
            <BookRideCard
              uid={uid}
              account={account}
              createTrip={createTrip}
              searches={searches}
              onActiveChange={setBookingActive}
              onBook={onBook}
              onShowAccount={() => goFace(FACE_ACCOUNT)}
            />
          )}
          {face === FACE_SEARCHES  && <SearchesCard searches={searches} now={now} />}
          {face === FACE_SCHEDULED && <FaceBoundary><ScheduledCard scheduledRides={scheduledRides} now={now} /></FaceBoundary>}
          {face === FACE_NOTIFS    && <NotificationsCard uid={uid} account={account} callSaveFcmToken={callSaveFcmToken} onActiveChange={setBookingActive} />}
          {face === FACE_ACCOUNT   && <AccountCard account={account} rides={rides} uid={uid} />}
          {face === FACE_TRIPS     && <TripsCard uid={uid} now={now} />}
        </div>

        {/* ── Dot pagination — smart order, active label ─────────────────── */}
        {!bookingActive && (
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 6,
            padding: '8px 14px 14px', alignItems: 'flex-end',
            position: 'relative', zIndex: 1,
          }}>
            {activeOrder.map((f) => {
              const m = FACE_META[f];
              const isActive = f === face;
              return (
                <div key={f} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <button
                    onClick={() => goFace(f)}
                    aria-label={m.label}
                    style={{
                      width: isActive ? 22 : 6, height: 6, borderRadius: 3,
                      border: 'none', padding: 0, cursor: 'pointer',
                      background: isActive ? m.color : 'rgba(255,255,255,.16)',
                      boxShadow: isActive ? `0 0 8px ${m.color}88` : 'none',
                      transition: 'all .3s cubic-bezier(.34,1.2,.64,1)', flexShrink: 0,
                    }}
                  />
                  {isActive && (
                    <span style={{
                      fontFamily: MONO, fontSize: 6.5, fontWeight: 800,
                      letterSpacing: '.08em', textTransform: 'uppercase',
                      color: m.color, opacity: 0.6, lineHeight: 1, whiteSpace: 'nowrap',
                    }}>
                      {m.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
