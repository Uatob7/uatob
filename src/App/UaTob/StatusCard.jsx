/**
 * StatusCard.jsx — Rider HUD card shell
 *
 * Faces:
 *   0 = Book a Ride   (pauses auto-cycle; 60s inactivity timeout resumes it)
 *   1 = Searches
 *   2 = Scheduled
 *   3 = Notifications
 *   4 = Account
 *   5 = Trips
 *
 * Auto-cycle behaviour:
 *   - Cycles through all faces except FACE_BOOK
 *   - When rider taps "Book a Ride" tab → cycle freezes, 60s countdown starts
 *   - If rider types a pickup address → countdown cancels, stays frozen until
 *     onBookingComplete fires (success screen auto-resets) or rider navigates away
 *   - If 60s elapses with no input → flip back to next face, resume cycle
 *   - After any non-book tab tap → 12s pause, then resume
 *   - After booking completes → 6s grace, then resume
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  C,
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

export { FACE_BOOK, FACE_SEARCHES, FACE_SCHEDULED, FACE_NOTIFS, FACE_ACCOUNT, FACE_TRIPS, FACE_COUNT };

// ── timing constants ─────────────────────────────────────────────────────────
const AUTO_CYCLE_MS    = 3800;   // how long each non-book face shows
const BOOK_TIMEOUT_MS  = 60_000; // inactivity on book face before flip-away
const POST_BOOKING_MS  = 6_000;  // grace after success before resuming
const POST_INTERACT_MS = 12_000; // pause after tapping a non-book tab

// ── design tokens (local, mirrors HUD system) ────────────────────────────────
const MONO = "'JetBrains Mono','SFMono-Regular',monospace";
const COND = "'Barlow Condensed','Barlow',sans-serif";

const TAB_ICONS = {
  [0]: BookIco,
  [1]: SearchIco,
  [2]: CalIco,
  [3]: BellIco,
  [4]: UserIco,
  [5]: CarIco,
};

// ── tiny inline SVG icons for tab bar ────────────────────────────────────────
function TabSvg({ children, size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
function BookIco()   { return <TabSvg><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v4h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></TabSvg>; }
function SearchIco() { return <TabSvg><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></TabSvg>; }
function CalIco()    { return <TabSvg><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></TabSvg>; }
function BellIco()   { return <TabSvg><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></TabSvg>; }
function UserIco()   { return <TabSvg><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></TabSvg>; }
function CarIco()    { return <TabSvg><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v4h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></TabSvg>; }

const TAB_LABELS = ['Book', 'Near', 'Sched', 'Alerts', 'Account', 'Trips'];
const TAB_COMPONENTS = [BookIco, SearchIco, CalIco, BellIco, UserIco, CarIco];

// ── countdown ring (shown on book tab while timeout ticks) ───────────────────
function CountdownRing({ ms, totalMs }) {
  const pct     = Math.max(0, ms / totalMs);
  const r       = 7;
  const circ    = 2 * Math.PI * r;
  const dash    = circ * pct;
  const color   = pct > 0.4 ? 'rgba(34,197,94,.7)' : pct > 0.15 ? 'rgba(251,191,36,.8)' : 'rgba(239,68,68,.8)';

  return (
    <svg width={18} height={18} viewBox="0 0 18 18" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="9" cy="9" r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={1.5}/>
      <circle cx="9" cy="9" r={r} fill="none" stroke={color} strokeWidth={1.5}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray .25s linear, stroke .5s ease' }}/>
    </svg>
  );
}

// ════════════════════════════════════════════════════════════════════════════
export default function StatusCard({
  face,
  onFaceChange,
  rides         = [],
  searches      = [],
  scheduledRides = [],
  now,
  callSaveFcmToken,
  onBook,
  account       = null,
}) {
  // autoCycle: whether the carousel should be running
  const [autoCycle,    setAutoCycle]    = useState(true);
  // bookTimeoutMs: remaining ms before book face flips away (null = not running)
  const [bookTimeoutMs, setBookTimeoutMs] = useState(null);
  // bookActive: true once rider has started entering an address (cancels timeout)
  const [bookActive,   setBookActive]   = useState(false);

  const cycleTimerRef   = useRef(null);
  const bookTimerRef    = useRef(null);
  const bookTickRef     = useRef(null);

  // ── helpers ────────────────────────────────────────────────────────────────
  const clearAll = useCallback(() => {
    clearTimeout(cycleTimerRef.current);
    clearTimeout(bookTimerRef.current);
    clearInterval(bookTickRef.current);
  }, []);

  const advanceFace = useCallback(() => {
    onFaceChange(prev => {
      // skip FACE_BOOK during auto-cycle
      const next = (prev + 1) % FACE_COUNT;
      return next === FACE_BOOK ? (next + 1) % FACE_COUNT : next;
    });
  }, [onFaceChange]);

  const resumeCycle = useCallback((delayMs = 0) => {
    clearAll();
    setBookTimeoutMs(null);
    setBookActive(false);
    if (delayMs > 0) {
      cycleTimerRef.current = setTimeout(() => setAutoCycle(true), delayMs);
    } else {
      setAutoCycle(true);
    }
  }, [clearAll]);

  // Start the 60s book-face inactivity countdown
  const startBookTimeout = useCallback(() => {
    clearAll();
    setAutoCycle(false);
    setBookTimeoutMs(BOOK_TIMEOUT_MS);
    setBookActive(false);

    // Tick every 250ms for smooth ring
    let remaining = BOOK_TIMEOUT_MS;
    bookTickRef.current = setInterval(() => {
      remaining -= 250;
      setBookTimeoutMs(Math.max(0, remaining));
      if (remaining <= 0) {
        clearInterval(bookTickRef.current);
      }
    }, 250);

    // Flip away after full timeout
    bookTimerRef.current = setTimeout(() => {
      clearInterval(bookTickRef.current);
      setBookTimeoutMs(null);
      setBookActive(false);
      advanceFace();
      // resume cycle after flipping away
      cycleTimerRef.current = setTimeout(() => setAutoCycle(true), 800);
    }, BOOK_TIMEOUT_MS);
  }, [clearAll, advanceFace]);

  // Rider started typing — cancel the timeout, stay on book face
  const handleBookEngaged = useCallback(() => {
    if (bookActive) return;
    setBookActive(true);
    clearTimeout(bookTimerRef.current);
    clearInterval(bookTickRef.current);
    setBookTimeoutMs(null);
  }, [bookActive]);

  // ── auto-cycle effect ──────────────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(cycleTimerRef.current);
    if (!autoCycle || face === FACE_BOOK) return;

    cycleTimerRef.current = setTimeout(advanceFace, AUTO_CYCLE_MS);
    return () => clearTimeout(cycleTimerRef.current);
  }, [face, autoCycle, advanceFace]);

  // ── tab click ──────────────────────────────────────────────────────────────
  const handleTabClick = useCallback((i) => {
    clearAll();
    setAutoCycle(false);
    setBookActive(false);

    if (i === FACE_BOOK) {
      onFaceChange(i);
      startBookTimeout();
    } else {
      setBookTimeoutMs(null);
      onFaceChange(i);
      cycleTimerRef.current = setTimeout(() => setAutoCycle(true), POST_INTERACT_MS);
    }
  }, [clearAll, onFaceChange, startBookTimeout]);

  // ── booking complete (success screen reset) ────────────────────────────────
  const handleBookingComplete = useCallback(() => {
    resumeCycle(POST_BOOKING_MS);
  }, [resumeCycle]);

  // ── cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => () => clearAll(), [clearAll]);

  // ── tab bar ────────────────────────────────────────────────────────────────
  const renderTabs = () => (
    <div style={{
      display: 'flex',
      borderTop: '1px solid rgba(34,197,94,.09)',
      background: 'rgba(3,8,5,.6)',
    }}>
      {TAB_COMPONENTS.map((IcoComp, i) => {
        const active  = face === i;
        const isBook  = i === FACE_BOOK;
        const showRing = isBook && bookTimeoutMs !== null && !bookActive;

        return (
          <button
            key={i}
            onClick={() => handleTabClick(i)}
            style={{
              flex: 1,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 3, padding: '7px 2px 6px',
              background: 'none', border: 'none', cursor: 'pointer',
              position: 'relative',
              color: active
                ? (isBook && bookTimeoutMs !== null && !bookActive
                    ? bookTimeoutMs < 15_000 ? 'rgba(239,68,68,.85)' : 'rgba(251,191,36,.9)'
                    : '#4ADE80')
                : 'rgba(255,255,255,.22)',
              transition: 'color .18s',
            }}
          >
            {/* countdown ring behind the book icon */}
            {showRing && (
              <div style={{
                position: 'absolute',
                top: '50%', left: '50%',
                transform: 'translate(-50%, -58%)',
                pointerEvents: 'none',
              }}>
                <CountdownRing ms={bookTimeoutMs} totalMs={BOOK_TIMEOUT_MS}/>
              </div>
            )}

            <IcoComp/>

            <span style={{
              fontFamily: COND, fontSize: 7, fontWeight: 800,
              letterSpacing: '.1em', textTransform: 'uppercase',
              lineHeight: 1,
            }}>
              {TAB_LABELS[i]}
            </span>

            {/* active underline pip */}
            {active && (
              <div style={{
                position: 'absolute', bottom: 0, left: '25%', right: '25%',
                height: 2, borderRadius: 1,
                background: isBook && bookTimeoutMs !== null && !bookActive
                  ? (bookTimeoutMs < 15_000 ? 'rgba(239,68,68,.85)' : 'rgba(251,191,36,.9)')
                  : '#4ADE80',
                boxShadow: '0 0 6px rgba(74,222,128,.5)',
              }}/>
            )}
          </button>
        );
      })}
    </div>
  );

  // ── face content ───────────────────────────────────────────────────────────
  const renderFace = () => {
    switch (face) {
      case FACE_BOOK:
        return (
          <BookRideCard
            bare
            onBook={onBook}
            onEngaged={handleBookEngaged}
            onBookingComplete={handleBookingComplete}
          />
        );
      case FACE_SEARCHES:
        return (
          <SearchesCard
            searches={searches}
            scheduledRides={scheduledRides}
          />
        );
      case FACE_SCHEDULED:
        return (
          <ScheduledCard
            scheduledRides={scheduledRides}
            now={now}
          />
        );
      case FACE_NOTIFS:
        return (
          <NotificationsCard
            rides={rides}
            callSaveFcmToken={callSaveFcmToken}
          />
        );
      case FACE_ACCOUNT:
        return (
          <AccountCard
            account={account}
            rides={rides}
          />
        );
      case FACE_TRIPS:
        return (
          <TripsCard
            rides={rides}
            now={now}
          />
        );
      default:
        return null;
    }
  };

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
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* face content */}
      <div key={face} style={{ flex: 1, animation: 'uaCardFlip .28s ease both' }}>
        {renderFace()}
      </div>

      {/* tab bar */}
      {renderTabs()}
    </div>
  );
}
