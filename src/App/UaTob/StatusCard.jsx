/**
 * StatusCard.jsx — Rider HUD card shell (no heading, no tabs, no dots)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { C, FACES, FACE_BOOK, FACE_SEARCHES, FACE_SCHEDULED, FACE_NOTIFS, FACE_COUNT } from '@/App/UaTob/Statuscardtokens';
import BookRideCard    from '@/App/UaTob/BookRideCard';
import SearchesCard    from '@/App/UaTob/SearchesCard';
import ScheduledCard   from '@/App/UaTob/ScheduledCar';
import NotificationsCard from '@/App/UaTob/NotificationsCard';

export { FACE_BOOK, FACE_SEARCHES, FACE_SCHEDULED, FACE_NOTIFS, FACE_COUNT };

const AUTO_CYCLE_MS = 3800;

export default function StatusCard({
  face,
  onFaceChange,
  rides,
  searches,
  scheduledRides,
  now,
  callSaveFcmToken,
  onBook,
}) {
  const [autoCycle, setAutoCycle] = useState(true);
  const timerRef = useRef(null);

  // Auto-advance faces
  useEffect(() => {
    if (!autoCycle) return;
    timerRef.current = setTimeout(() => {
      onFaceChange((face + 1) % FACE_COUNT);
    }, AUTO_CYCLE_MS);
    return () => clearTimeout(timerRef.current);
  }, [face, autoCycle, onFaceChange]);

  const handleTabClick = useCallback((i) => {
    setAutoCycle(false);
    onFaceChange(i);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setAutoCycle(true), 12_000);
  }, [onFaceChange]);

  return (
    <div style={{
      width: '100%',
      maxWidth: 340,
      background: 'linear-gradient(180deg, rgba(6,14,8,.94), rgba(3,8,5,.97))',
      border: '1px solid rgba(34,197,94,.18)',
      borderRadius: 16,
      overflow: 'hidden',
      boxShadow: '0 10px 36px rgba(0,0,0,.6), 0 0 24px rgba(34,197,94,.1)',
      backdropFilter: 'blur(16px)',
    }}>
      <div key={face} style={{ animation: 'uaCardFlip .28s ease both' }}>
        {face === FACE_BOOK      && <BookRideCard onBook={onBook}/>}
        {face === FACE_SEARCHES  && <SearchesCard searches={searches} scheduledRides={scheduledRides}/>}
        {face === FACE_SCHEDULED && <ScheduledCard scheduledRides={scheduledRides} now={now}/>}
        {face === FACE_NOTIFS    && <NotificationsCard rides={rides} callSaveFcmToken={callSaveFcmToken}/>}
      </div>
    </div>
  );
}
