/**
 * StatusCard.jsx — Rider HUD bottom card carousel (shell)
 *
 * Faces:
 *   0  BookRideCard
 *   1  SearchesCard
 *   2  ScheduledCard
 *   3  NotificationsCard
 *
 * Props:
 *   face              number
 *   onFaceChange      fn(index)
 *   rides             array
 *   searches          array
 *   scheduledRides    array
 *   now               number   (Date.now())
 *   callSaveFcmToken  fn
 *   onBook            fn
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { C, FACES, FACE_BOOK, FACE_SEARCHES, FACE_SCHEDULED, FACE_NOTIFS, FACE_COUNT } from '@/App/UaTob/Statuscardtokens';
import BookRideCard from "@/App/UaTob/BookRideCard";
import SearchesCard from "@/App/UaTob/SearchesCard";
import ScheduledCard from "@/App/UaTob/ScheduledCar";
import NotificationsCard from "@/App/UaTob/NotificationsCard";

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

  // Auto-advance
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
    // Resume auto-cycle after 12 s of inactivity
    timerRef.current = setTimeout(() => setAutoCycle(true), 12_000);
  }, [onFaceChange]);

  const accentColor = FACES[face].color;

  return (
    <div style={{
      width: '100%', maxWidth: 340,
      background: 'linear-gradient(180deg, rgba(6,14,8,.94), rgba(3,8,5,.97))',
      border: `1px solid ${accentColor}30`,
      borderRadius: 16, overflow: 'hidden',
      boxShadow: `0 10px 36px rgba(0,0,0,.6), 0 0 24px ${accentColor}18`,
      backdropFilter: 'blur(16px)',
      transition: 'border-color .35s ease, box-shadow .35s ease',
    }}>

      {/* Top accent stripe */}
      <div style={{
        height: 2,
        background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
        transition: 'background .35s ease',
      }}/>

      {/* Tab bar */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '7px 10px 0',
        borderBottom: '1px solid rgba(34,197,94,.1)',
      }}>
        {FACES.map((f, i) => {
          const active = i === face;
          return (
            <button key={i} onClick={() => handleTabClick(i)} style={{
              flex: 1, padding: '4px 2px 7px', cursor: 'pointer',
              background: 'none', border: 'none',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              position: 'relative',
            }}>
              <span style={{
                fontFamily: "'Barlow Condensed','Barlow',sans-serif",
                fontSize: 8, fontWeight: 800, letterSpacing: '.1em',
                color: active ? f.color : 'rgba(255,255,255,.22)',
                textTransform: 'uppercase',
                transition: 'color .25s ease',
              }}>{f.label}</span>
              {active && (
                <div style={{
                  position: 'absolute', bottom: 0, left: '20%', right: '20%', height: 2,
                  borderRadius: '2px 2px 0 0',
                  background: f.color,
                  boxShadow: `0 0 8px ${f.color}`,
                  animation: 'uaFadeIn .2s ease both',
                }}/>
              )}
            </button>
          );
        })}
      </div>

      {/* Active face */}
      <div key={face} style={{ animation: 'uaCardFlip .28s ease both' }}>
        {face === FACE_BOOK      && <BookRideCard onBook={onBook}/>}
        {face === FACE_SEARCHES  && <SearchesCard searches={searches} scheduledRides={scheduledRides}/>}
        {face === FACE_SCHEDULED && <ScheduledCard scheduledRides={scheduledRides} now={now}/>}
        {face === FACE_NOTIFS    && <NotificationsCard rides={rides} callSaveFcmToken={callSaveFcmToken}/>}
      </div>

      {/* Progress dots */}
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5,
        padding: '2px 0 12px',
      }}>
        {FACES.map((f, i) => (
          <div key={i} onClick={() => handleTabClick(i)} style={{
            width: i === face ? 16 : 5, height: 5, borderRadius: 3,
            background: i === face ? accentColor : 'rgba(255,255,255,.15)',
            cursor: 'pointer',
            transition: 'width .3s ease, background .3s ease',
            boxShadow: i === face ? `0 0 8px ${accentColor}` : 'none',
          }}/>
        ))}
      </div>
    </div>
  );
}