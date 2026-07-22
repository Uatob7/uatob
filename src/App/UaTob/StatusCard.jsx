import { useEffect, useRef, useState, useCallback, Component } from 'react';
import {
  FACE_BOOK, FACE_SEARCHES, FACE_SCHEDULED, FACE_NOTIFS, FACE_ACCOUNT, FACE_TRIPS, FACE_DOWNLOAD,
  FACE_ORDER, FACE_CYCLE_MS, FACE_META,
} from '@/App/UaTob/Statuscardtokens';

import BookRideCard      from '@/App/UaTob/BookRideCard';
import SearchesCard      from '@/App/UaTob/SearchesCard';
import ScheduledCard     from '@/App/UaTob/ScheduledCard';
import NotificationsCard from '@/App/UaTob/NotificationsCard';
import AccountCard       from '@/App/UaTob/AccountCard';
import TripsCard         from '@/App/UaTob/TripsCard';
import DownloadAppCard   from '@/App/UaTob/DownloadAppCard';

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


export default function StatusCard({
  face,
  onFaceChange,
  rides = [],
  searches = [],
  scheduledRides = [],
  trips = [],
  account = null,
  now,
  uid,
  createTrip,
  callSaveFcmToken,
  onBook,
  onRequestLocation,
}) {
  const [bookingActive, setBookingActive] = useState(false);
  const [cyclePaused,   setCyclePaused]   = useState(false);
  const [pressing,      setPressing]      = useState(false);
  const [flipPhase,     setFlipPhase]     = useState(null); // null | 'out' | 'in'
  const cycleRef = useRef(null);
  const flipRef  = useRef(null);

  const authActive  = face === FACE_ACCOUNT && !uid;
  const flowBlocked = bookingActive || authActive || cyclePaused;

  const activeOrder = account?.pwaDownloaded
    ? FACE_ORDER.filter(f => f !== FACE_DOWNLOAD)
    : FACE_ORDER;

  const startCycle = useCallback(() => {
    clearInterval(cycleRef.current);
    if (flowBlocked) return;
    cycleRef.current = setInterval(() => {
      const idx  = activeOrder.indexOf(face);
      const next = activeOrder[(idx + 1) % activeOrder.length];
      onFaceChange?.(next);
    }, FACE_CYCLE_MS);
  }, [face, flowBlocked, onFaceChange, activeOrder]);

  useEffect(() => {
    startCycle();
    return () => clearInterval(cycleRef.current);
  }, [startCycle]);

  const goFace = (f) => {
    onFaceChange?.(f);
    if (f === FACE_ACCOUNT) {
      setCyclePaused(true);
      clearInterval(cycleRef.current);
    } else {
      setCyclePaused(false);
    }
  };

  const isClickable = !bookingActive && !cyclePaused;

  const handleCardClick = (e) => {
    if (!isClickable) return;
    if (face === FACE_DOWNLOAD) return;
    if (e.target.closest('button, input, a, textarea, select')) return;

    // No uid → always open account; otherwise cycle normally
    const nextFace = !uid
      ? FACE_ACCOUNT
      : activeOrder[(activeOrder.indexOf(face) + 1) % activeOrder.length];

    if (nextFace === face) return;

    clearTimeout(flipRef.current);
    setFlipPhase('out');
    flipRef.current = setTimeout(() => {
      goFace(nextFace);
      setFlipPhase('in');
      flipRef.current = setTimeout(() => setFlipPhase(null), 240);
    }, 200);
  };

  const flipAnim = flipPhase === 'out'
    ? 'scFlipOut .2s ease-in both'
    : flipPhase === 'in'
    ? 'scFlipIn .24s ease-out both'
    : undefined;

  return (
    <div>
      <style>{`
        @keyframes scFaceIn  { from{opacity:0;transform:translateY(8px) scale(.985)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes scFlipOut { from{transform:perspective(700px) rotateY(0deg)}   to{transform:perspective(700px) rotateY(90deg)}  }
        @keyframes scFlipIn  { from{transform:perspective(700px) rotateY(-90deg)} to{transform:perspective(700px) rotateY(0deg)}   }
        .sc-face { animation: scFaceIn .42s cubic-bezier(.34,1.2,.64,1) both; }
      `}</style>

      {/* Face body */}
      <div
        className={flipPhase ? undefined : 'sc-face'}
        key={face}
        style={{
          cursor: isClickable ? 'pointer' : 'default',
          animation: flipAnim,
          filter: pressing && isClickable ? 'brightness(0.75)' : undefined,
          transition: !pressing ? 'filter .12s' : undefined,
        }}
        onMouseDown={() => isClickable && setPressing(true)}
        onMouseUp={() => setPressing(false)}
        onMouseLeave={() => setPressing(false)}
        onTouchStart={() => isClickable && setPressing(true)}
        onTouchEnd={() => setPressing(false)}
        onClick={handleCardClick}
      >
        {face === FACE_BOOK && (
          <BookRideCard
            uid={uid}
            account={account}
            createTrip={createTrip}
            searches={searches}
            onActiveChange={setBookingActive}
            onBook={onBook}
            onRequestLocation={onRequestLocation}
          />
        )}
        {face === FACE_SEARCHES  && <SearchesCard searches={searches} now={now}  />}
        {face === FACE_SCHEDULED && <FaceBoundary><ScheduledCard scheduledRides={scheduledRides} now={now} /></FaceBoundary>}
        {face === FACE_NOTIFS    && <NotificationsCard uid={uid} account={account} callSaveFcmToken={callSaveFcmToken} onActiveChange={setBookingActive} />}
        {face === FACE_ACCOUNT   && <AccountCard account={account} rides={rides} uid={uid} />}
        {face === FACE_TRIPS     && <TripsCard  uid={uid} now={now} />}
        {face === FACE_DOWNLOAD  && <DownloadAppCard uid={uid} />}
      </div>

      {/* Dot pagination — hidden while a booking flow owns the card */}
      {!bookingActive && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '0 0 14px' }}>
          {activeOrder.map((f) => {
            const m = FACE_META[f];
            const isActive = f === face;
            return (
              <button
                key={f}
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
            );
          })}
        </div>
      )}
    </div>
  );
}