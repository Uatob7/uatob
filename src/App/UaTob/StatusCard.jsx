import { useEffect, useRef, useState, useCallback } from 'react';
import {
  FACE_BOOK, FACE_SEARCHES, FACE_SCHEDULED, FACE_NOTIFS, FACE_ACCOUNT, FACE_TRIPS,
  FACE_ORDER, FACE_CYCLE_MS, FACE_META,
} from '@/App/UaTob/Statuscardtokens';

import BookRideCard      from '@/App/UaTob/BookRideCard';
import SearchesCard      from '@/App/UaTob/SearchesCard';
import ScheduledCard     from '@/App/UaTob/ScheduledCard';
import NotificationsCard from '@/App/UaTob/NotificationsCard';
import AccountCard       from '@/App/UaTob/AccountCard';
import TripsCard         from '@/App/UaTob/TripsCard';

const SHELL = {
  borderRadius: 22,
  background: 'linear-gradient(180deg, rgba(6,14,9,.94), rgba(4,9,6,.97))',
  border: '1px solid rgba(34,197,94,.22)',
  boxShadow: '0 18px 60px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.04)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  overflow: 'hidden',
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
  // Booking flow takes over the card; while active, the auto-cycle is paused.
  const [bookingActive, setBookingActive] = useState(false);
  const cycleRef = useRef(null);

  const startCycle = useCallback(() => {
    clearInterval(cycleRef.current);
    if (bookingActive) return;
    cycleRef.current = setInterval(() => {
      const idx  = FACE_ORDER.indexOf(face);
      const next = FACE_ORDER[(idx + 1) % FACE_ORDER.length];
      onFaceChange?.(next);
    }, FACE_CYCLE_MS);
  }, [face, bookingActive, onFaceChange]);

  useEffect(() => {
    startCycle();
    return () => clearInterval(cycleRef.current);
  }, [startCycle]);

  const goFace = (f) => {
    onFaceChange?.(f);
    startCycle(); // reset timer on manual tap
  };

  const meta = FACE_META[face] ?? FACE_META[FACE_BOOK];

  return (
    <div style={SHELL}>
      <style>{`
        @keyframes scFaceIn { from{opacity:0;transform:translateY(8px) scale(.985)} to{opacity:1;transform:translateY(0) scale(1)} }
        .sc-face { animation: scFaceIn .42s cubic-bezier(.34,1.2,.64,1) both; }
      `}</style>

      {/* Top accent line — tints to the active face color */}
      <div style={{
        height: 2,
        background: `linear-gradient(90deg, transparent, ${meta.color}, transparent)`,
        transition: 'background .5s ease',
      }}/>

      {/* Face body */}
      <div className="sc-face" key={face} style={{ position: 'relative', padding: '16px 18px 12px' }}>
        {face === FACE_BOOK && (
          <BookRideCard
            uid={uid}
            account={account}
            createTrip={createTrip}
            searches={searches}
            onActiveChange={setBookingActive}
            onBook={onBook}
          />
        )}
        {face === FACE_SEARCHES  && <SearchesCard searches={searches} now={now} />}
        {face === FACE_SCHEDULED && <ScheduledCard scheduledRides={scheduledRides} now={now} />}
        {face === FACE_NOTIFS    && <NotificationsCard uid={uid} account={account} callSaveFcmToken={callSaveFcmToken} />}
        {face === FACE_ACCOUNT   && <AccountCard account={account} rides={rides} />}
        {face === FACE_TRIPS     && <TripsCard rides={rides} trips={trips} now={now} />}
      </div>

      {/* Dot pagination — hidden while a booking flow owns the card */}
      {!bookingActive && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '0 0 14px' }}>
          {FACE_ORDER.map((f) => {
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