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
 *   - When rider taps "Book" tab → cycle freezes, 60s countdown starts
 *   - If rider types a pickup address (onEngaged fires) → countdown cancels,
 *     stays frozen until onBookingComplete fires or rider navigates away
 *   - If 60s elapses with no input → flip to next face, resume cycle
 *   - After any non-book tab tap → 12s pause, then resume
 *   - After booking completes → 6s grace, then resume
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
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

// ── timing ───────────────────────────────────────────────────────────────────
const AUTO_CYCLE_MS    = 3800;
const BOOK_TIMEOUT_MS  = 60_000;
const POST_BOOKING_MS  = 6_000;
const POST_INTERACT_MS = 12_000;

// ── design tokens ─────────────────────────────────────────────────────────────
const COND = "'Barlow Condensed','Barlow',sans-serif";

// ── tab bar icons ─────────────────────────────────────────────────────────────
function Svg({ children, size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
function IcoBook()   { return <Svg><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 5v4h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></Svg>; }
function IcoSearch() { return <Svg><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></Svg>; }
function IcoCal()    { return <Svg><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></Svg>; }
function IcoBell()   { return <Svg><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></Svg>; }
function IcoUser()   { return <Svg><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></Svg>; }
function IcoCar()    { return <Svg><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v5a2 2 0 0 1-2 2h-2"/><circle cx="9" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></Svg>; }

const TABS = [
  { label: 'Book',   Ico: IcoBook   },
  { label: 'Near',   Ico: IcoSearch },
  { label: 'Sched',  Ico: IcoCal    },
  { label: 'Alerts', Ico: IcoBell   },
  { label: 'Acct',   Ico: IcoUser   },
  { label: 'Trips',  Ico: IcoCar    },
];

// ── countdown ring ────────────────────────────────────────────────────────────
function CountdownRing({ ms, totalMs }) {
  const pct   = Math.max(0, ms / totalMs);
  const r     = 8;
  const circ  = 2 * Math.PI * r;
  const dash  = circ * pct;
  const color = pct > 0.4
    ? 'rgba(74,222,128,.75)'
    : pct > 0.15
      ? 'rgba(251,191,36,.85)'
      : 'rgba(239,68,68,.85)';

  return (
    <svg width={20} height={20} viewBox="0 0 20 20"
      style={{ position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%) rotate(-90deg)', pointerEvents: 'none' }}>
      <circle cx="10" cy="10" r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth={1.6}/>
      <circle cx="10" cy="10" r={r} fill="none" stroke={color} strokeWidth={1.6}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray .25s linear, stroke .4s ease' }}/>
    </svg>
  );
}

// ════════════════════════════════════════════════════════════════════════════
export default function StatusCard({
  face,
  onFaceChange,
  rides          = [],
  searches       = [],
  scheduledRides = [],
  now,
  callSaveFcmToken,
  onBook,
  account        = null,
}) {
  const [autoCycle,     setAutoCycle]     = useState(true);
  const [bookTimeoutMs, setBookTimeoutMs] = useState(null); // null = not counting
  const [bookEngaged,   setBookEngaged]   = useState(false); // rider typed something

  const cycleTimerRef = useRef(null);
  const bookTimerRef  = useRef(null);
  const bookTickRef   = useRef(null);

  // ── clear everything ───────────────────────────────────────────────────────
  const clearAll = useCallback(() => {
    clearTimeout(cycleTimerRef.current);
    clearTimeout(bookTimerRef.current);
    clearInterval(bookTickRef.current);
  }, []);

  // ── advance to next non-book face ─────────────────────────────────────────
  const advanceFace = useCallback(() => {
    onFaceChange(prev => {
      const next = (prev + 1) % FACE_COUNT;
      return next === FACE_BOOK ? (next + 1) % FACE_COUNT : next;
    });
  }, [onFaceChange]);

  // ── resume auto-cycle after delay ─────────────────────────────────────────
  const resumeCycle = useCallback((delayMs = 0) => {
    clearAll();
    setBookTimeoutMs(null);
    setBookEngaged(false);
    cycleTimerRef.current = setTimeout(() => setAutoCycle(true), delayMs);
  }, [clearAll]);

  // ── start the 60s book-face inactivity countdown ──────────────────────────
  const startBookTimeout = useCallback(() => {
    clearAll();
    setAutoCycle(false);
    setBookEngaged(false);

    let remaining = BOOK_TIMEOUT_MS;
    setBookTimeoutMs(remaining);

    bookTickRef.current = setInterval(() => {
      remaining -= 250;
      setBookTimeoutMs(Math.max(0, remaining));
      if (remaining <= 0) clearInterval(bookTickRef.current);
    }, 250);

    bookTimerRef.current = setTimeout(() => {
      clearInterval(bookTickRef.current);
      setBookTimeoutMs(null);
      setBookEngaged(false);
      // flip away from book face
      advanceFace();
      cycleTimerRef.current = setTimeout(() => setAutoCycle(true), 800);
    }, BOOK_TIMEOUT_MS);
  }, [clearAll, advanceFace]);

  // ── rider started typing an address → cancel countdown ───────────────────
  const handleBookEngaged = useCallback(() => {
    if (bookEngaged) return;
    setBookEngaged(true);
    clearTimeout(bookTimerRef.current);
    clearInterval(bookTickRef.current);
    setBookTimeoutMs(null);
    // stay on book face indefinitely until complete or manual nav away
  }, [bookEngaged]);

  // ── auto-cycle tick ────────────────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(cycleTimerRef.current);
    // never auto-advance while on the book face
    if (!autoCycle || face === FACE_BOOK) return;
    cycleTimerRef.current = setTimeout(advanceFace, AUTO_CYCLE_MS);
    return () => clearTimeout(cycleTimerRef.current);
  }, [face, autoCycle, advanceFace]);

  // ── tab click ──────────────────────────────────────────────────────────────
  const handleTabClick = useCallback((i) => {
    clearAll();
    setAutoCycle(false);
    setBookEngaged(false);
    setBookTimeoutMs(null);
    onFaceChange(i);

    if (i === FACE_BOOK) {
      startBookTimeout();
    } else {
      cycleTimerRef.current = setTimeout(() => setAutoCycle(true), POST_INTERACT_MS);
    }
  }, [clearAll, onFaceChange, startBookTimeout]);

  // ── booking complete ───────────────────────────────────────────────────────
  const handleBookingComplete = useCallback(() => {
    resumeCycle(POST_BOOKING_MS);
  }, [resumeCycle]);

  // ── click anywhere on the face content to flip ────────────────────────────
  // Blocked when: on the book face (rider is interacting), or a button/input
  // inside the face stops propagation so normal controls still work.
  const handleCardClick = useCallback((e) => {
    // If the click reached an interactive element, don't flip
    const tag = e.target.tagName;
    if (['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'A'].includes(tag)) return;

    // Don't flip while rider is actively booking
    if (face === FACE_BOOK) return;

    clearAll();
    setAutoCycle(false);
    setBookTimeoutMs(null);
    setBookEngaged(false);

    advanceFace();
    // pause cycle briefly after a manual flip
    cycleTimerRef.current = setTimeout(() => setAutoCycle(true), POST_INTERACT_MS);
  }, [face, clearAll, advanceFace]);

  // ── unmount cleanup ────────────────────────────────────────────────────────
  useEffect(() => () => clearAll(), [clearAll]);

  // ── tab bar ────────────────────────────────────────────────────────────────
  const renderTabs = () => (
    <div style={{
      display: 'flex',
      borderTop: '1px solid rgba(34,197,94,.09)',
      background: 'rgba(3,6,4,.7)',
    }}>
      {TABS.map(({ label, Ico }, i) => {
        const active      = face === i;
        const isBook      = i === FACE_BOOK;
        const showRing    = isBook && bookTimeoutMs !== null && !bookEngaged;
        const urgency     = bookTimeoutMs !== null && bookTimeoutMs < 15_000;
        const warning     = bookTimeoutMs !== null && bookTimeoutMs < 30_000;
        const activeColor = isBook && showRing
          ? (urgency ? 'rgba(239,68,68,.9)' : warning ? 'rgba(251,191,36,.9)' : '#4ADE80')
          : '#4ADE80';

        return (
          <button
            key={i}
            onClick={() => handleTabClick(i)}
            style={{
              flex: 1, position: 'relative',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: 3, padding: '8px 2px 7px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: active ? activeColor : 'rgba(255,255,255,.22)',
              transition: 'color .18s',
            }}
          >
            {showRing && (
              <CountdownRing ms={bookTimeoutMs} totalMs={BOOK_TIMEOUT_MS}/>
            )}

            <Ico/>

            <span style={{
              fontFamily: COND, fontSize: 6.5, fontWeight: 800,
              letterSpacing: '.1em', textTransform: 'uppercase', lineHeight: 1,
            }}>
              {label}
            </span>

            {/* active pip */}
            {active && (
              <div style={{
                position: 'absolute', bottom: 0, left: '28%', right: '28%',
                height: 2, borderRadius: 1,
                background: activeColor,
                boxShadow: `0 0 6px ${activeColor}88`,
                transition: 'background .3s',
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
      <div
        key={face}
        onClick={handleCardClick}
        style={{
          flex: 1,
          animation: 'uaCardFlip .28s ease both',
          cursor: face === FACE_BOOK ? 'default' : 'pointer',
        }}
      >
        {renderFace()}
      </div>
      {renderTabs()}
    </div>
  );
}
