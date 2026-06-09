/**
 * StatusCard.jsx — Rider HUD card shell
 *
 * Fix: auto-cycle is fully frozen while face === FACE_BOOK.
 * It only resumes after onBookingComplete fires (with a 6s grace delay).
 */

import { useState, useEffect, useRef, useCallback } from 'react';

import {
  C,
  FACES,
  FACE_BOOK,
  FACE_SEARCHES,
  FACE_SCHEDULED,
  FACE_NOTIFS,
  FACE_ACCOUNT,
  FACE_TRIPS,
  FACE_COUNT,
} from '@/App/UaTob/Statuscardtokens';

import BookRideCard      from '@/App/UaTob/BookRideCard';
import SearchesCard      from '@/App/UaTob/SearchesCard';
import ScheduledCard     from '@/App/UaTob/ScheduledCar';
import NotificationsCard from '@/App/UaTob/NotificationsCard';
import AccountCard       from '@/App/UaTob/AccountCard';
import TripsCard         from '@/App/UaTob/TripsCard';

const AUTO_CYCLE_MS    = 3800;
const POST_BOOKING_MS  = 6000;
const POST_INTERACT_MS = 12000;

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

  // ── Auto-cycle ─────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(timerRef.current);

    if (!autoCycle || face === FACE_BOOK) return;

    timerRef.current = setTimeout(() => {
      const next = (face + 1) % FACE_COUNT;

      // skip booking face during auto-cycle
      onFaceChange(next === FACE_BOOK ? (next + 1) % FACE_COUNT : next);
    }, AUTO_CYCLE_MS);

    return () => clearTimeout(timerRef.current);
  }, [face, autoCycle, onFaceChange]);

  // ── Tab / face selection ───────────────────────────────────
  const handleTabClick = useCallback(
    (i) => {
      clearTimeout(timerRef.current);

      if (i === FACE_BOOK) {
        // hard freeze until booking completes
        setAutoCycle(false);
      } else {
        setAutoCycle(false);
        timerRef.current = setTimeout(() => setAutoCycle(true), POST_INTERACT_MS);
      }

      onFaceChange(i);
    },
    [onFaceChange]
  );

  // ── Booking complete ───────────────────────────────────────
  const handleBookingComplete = useCallback(() => {
    clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      setAutoCycle(true);
    }, POST_BOOKING_MS);
  }, []);

  // ── Cleanup ────────────────────────────────────────────────
  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 340,
        background: 'linear-gradient(180deg, rgba(6,14,8,.94), rgba(3,8,5,.97))',
        border: '1px solid rgba(34,197,94,.18)',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 10px 36px rgba(0,0,0,.6), 0 0 24px rgba(34,197,94,.1)',
        backdropFilter: 'blur(16px)',
      }}
    >
      <div key={face} style={{ animation: 'uaCardFlip .28s ease both' }}>
        {face === FACE_BOOK && (
          <BookRideCard
            bare
            onBook={onBook}
            onBookingComplete={handleBookingComplete}
          />
        )}

        {face === FACE_SEARCHES && (
          <SearchesCard
            searches={searches}
            scheduledRides={scheduledRides}
          />
        )}

        {face === FACE_SCHEDULED && (
          <ScheduledCard
            scheduledRides={scheduledRides}
            now={now}
          />
        )}

        {face === FACE_NOTIFS && (
          <NotificationsCard
            rides={rides}
            callSaveFcmToken={callSaveFcmToken}
          />
        )}

        {face === FACE_ACCOUNT && <AccountCard />}

        {face === FACE_TRIPS && <TripsCard />}
      </div>
    </div>
  );
}