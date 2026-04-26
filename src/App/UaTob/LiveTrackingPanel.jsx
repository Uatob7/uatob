// src/App/UaTob/LiveTrackingPanel.jsx
import React, { useMemo, useEffect, useState, useRef } from 'react';
import {
  Car, Star, Check, Phone, MapPin, Navigation, MessageCircle,
  Send, ChevronDown, Shield,
} from 'lucide-react';
import { THEME as T } from '@/App/UaTob/pricing.js';
import {
  getFirestore, doc, onSnapshot, addDoc, collection, serverTimestamp,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebase_app } from '@/firebase/config';
import TrackingMap from '@/App/UaTob/TrackingMap.jsx';

// ── Callables ──────────────────────────────────────────────────────
const functions         = getFunctions(firebase_app, 'us-east1');
const callRiderLocation = httpsCallable(functions, 'riderLocation');

// ── Status order & step config ─────────────────────────────────────
const STEPS = [
  { key: 'driver_assigned', label: 'Assigned' },
  { key: 'driver_arriving', label: 'En Route' },
  { key: 'arrived',         label: 'Arrived'  },
  { key: 'in_progress',     label: 'Riding'   },
  { key: 'completed',       label: 'Done'     },
];

const STATUS_ORDER = [
  'searching_driver', 'driver_assigned', 'driver_arriving',
  'arrived', 'in_progress', 'completed',
];

const RIDE_COLORS = {
  economy:  '#16A34A',
  standard: '#16A34A',
  premium:  '#7C3AED',
  xl:       '#F59E0B',
};

const ACCENT = '#16A34A';

function getDriverColor(type) {
  return RIDE_COLORS[type] ?? ACCENT;
}

function buildProgress(liveStatus) {
  const currentIndex = STATUS_ORDER.indexOf(liveStatus);
  return STEPS.map((step) => {
    const stepIndex = STATUS_ORDER.indexOf(step.key);
    if (currentIndex === -1)        return { ...step, status: 'pending'   };
    if (stepIndex < currentIndex)   return { ...step, status: 'completed' };
    if (stepIndex === currentIndex) return { ...step, status: 'current'   };
    return { ...step, status: 'pending' };
  });
}

function getStatusLabel(status, driverName) {
  const name = driverName || 'Your driver';
  return {
    searching_driver: 'Finding you a driver…',
    driver_assigned:  `${name} has been assigned`,
    driver_arriving:  `${name} is on the way`,
    arrived:          `${name} has arrived`,
    in_progress:      'On the way to your destination',
    completed:        'Ride complete',
  }[status] ?? '';
}

// ── Inject keyframes once ──────────────────────────────────────────
const PANEL_KEYFRAMES = `
  @keyframes ltpBlink { 0%,100%{opacity:1} 50%{opacity:0.35} }
  @keyframes ltpFadeUp { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
`;
let _panelInjected = false;
function injectPanelStyles() {
  if (_panelInjected || typeof document === 'undefined') return;
  const el = document.createElement('style');
  el.textContent = PANEL_KEYFRAMES;
  document.head.appendChild(el);
  _panelInjected = true;
}

// ── Initials avatar ────────────────────────────────────────────────
function DriverAvatar({ firstName, lastName, size = 52, color }) {
  const initials = [firstName?.[0], lastName?.[0]]
    .filter(Boolean)
    .join('')
    .toUpperCase() || '?';

  return (
    <div style={{
      width: size, height: size, borderRadius: 14,
      background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: size * 0.32, fontWeight: 700, color: '#fff',
      letterSpacing: '1px',
      boxShadow: `0 4px 14px ${color}30`,
    }}>
      {initials}
    </div>
  );
}

// ── Message Panel (unchanged in logic, light visual refresh) ───────
function MessagePanel({ rideId, driverUid, driverName, driverColor, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [sending, setSending]   = useState(false);
  const [sent, setSent]         = useState(false);
  const listRef                 = useRef(null);
  const bottomRef               = useRef(null);
  const isAtBottomRef           = useRef(true);
  const justSentRef             = useRef(false);
  const auth                    = getAuth();
  const db                      = getFirestore();
  const riderUid                = auth.currentUser?.uid ?? null;

  const QUICK_REPLIES = [
    "I'm outside",
    'On my way down',
    'Give me 2 min',
    'At the main entrance',
  ];

  function handleScroll() {
    const el = listRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }

  useEffect(() => {
    if (!rideId) return;
    const ref   = collection(db, 'Rides', rideId, 'Messages');
    const unsub = onSnapshot(ref, (snap) => {
      const msgs = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0));
      setMessages(msgs);
    });
    return () => unsub();
  }, [rideId]);

  useEffect(() => {
    if (!bottomRef.current) return;
    if (isAtBottomRef.current || justSentRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
      justSentRef.current = false;
    }
  }, [messages]);

  async function sendMessage(text) {
    const trimmed = (text ?? input).trim();
    if (!trimmed || !rideId || !riderUid) return;
    setSending(true);
    justSentRef.current = true;
    try {
      await addDoc(collection(db, 'Rides', rideId, 'Messages'), {
        text: trimmed, senderUid: riderUid, senderRole: 'rider',
        createdAt: serverTimestamp(), readByDriver: false, readByRider: true,
      });
      setInput('');
      setSent(true);
      setTimeout(() => setSent(false), 2000);
    } catch (err) {
      console.error('Message send failed:', err);
      justSentRef.current = false;
    } finally {
      setSending(false);
    }
  }

  function formatTime(ts) {
    if (!ts?.seconds) return '';
    return new Date(ts.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div style={{
      background: '#fff',
      border: `1px solid ${T.border}`,
      borderRadius: 16,
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px',
        borderBottom: `1px solid ${T.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MessageCircle size={15} color={driverColor} />
          <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
            Message {driverName || 'Driver'}
          </span>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 11, fontWeight: 700, color: T.textMuted,
          padding: '4px 8px', borderRadius: 8,
        }}>
          <ChevronDown size={14} />
          Hide
        </button>
      </div>

      <div
        ref={listRef}
        onScroll={handleScroll}
        style={{
          minHeight: 160, maxHeight: 240, overflowY: 'auto',
          WebkitOverflowScrolling: 'touch', padding: '14px 16px',
          display: 'flex', flexDirection: 'column', gap: 8,
          overscrollBehavior: 'contain',
          background: '#FAFBFA',
        }}
      >
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: T.textMuted, fontSize: 12, fontWeight: 500, marginTop: 20 }}>
            No messages yet. Say hi to your driver.
          </div>
        )}
        {(() => {
          const lastRiderIdx = messages.reduce((acc, m, i) => (m.senderRole === 'rider' ? i : acc), -1);
          return messages.map((msg, idx) => {
            const isRider    = msg.senderRole === 'rider';
            const isLastSent = isRider && idx === lastRiderIdx;
            const seen       = isLastSent && msg.readByDriver === true;
            return (
              <div key={msg.id} style={{ display: 'flex', justifyContent: isRider ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '78%', padding: '9px 13px',
                  borderRadius: isRider ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: isRider ? driverColor : '#fff',
                  border: isRider ? 'none' : `1px solid ${T.border}`,
                }}>
                  {!isRider && (
                    <div style={{ fontSize: 9, fontWeight: 700, color: T.textMuted, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 3 }}>
                      Driver
                    </div>
                  )}
                  <div style={{ fontSize: 13, fontWeight: 500, color: isRider ? '#fff' : T.text, lineHeight: 1.4 }}>
                    {msg.text}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: isRider ? 'flex-end' : 'flex-start', gap: 3, marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: isRider ? 'rgba(255,255,255,0.7)' : T.textMuted }}>
                      {formatTime(msg.createdAt)}
                    </span>
                    {isLastSent && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', position: 'relative', width: 18, height: 11, flexShrink: 0 }}>
                        <svg width="11" height="8" viewBox="0 0 11 8" fill="none" style={{ position: 'absolute', left: seen ? 0 : 3, transition: 'left .2s ease' }}>
                          <path d="M1 4L3.5 6.5L9.5 1" stroke={seen ? '#fff' : 'rgba(255,255,255,.55)'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <svg width="11" height="8" viewBox="0 0 11 8" fill="none" style={{ position: 'absolute', right: 0, opacity: seen ? 1 : 0, transition: 'opacity .25s ease' }}>
                          <path d="M1 4L3.5 6.5L9.5 1" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          });
        })()}
        <div ref={bottomRef} style={{ height: 1 }} />
      </div>

      <div style={{ display: 'flex', gap: 6, padding: '10px 16px', flexWrap: 'wrap', borderTop: `1px solid ${T.border}` }}>
        {QUICK_REPLIES.map((qr) => (
          <button key={qr} onClick={() => sendMessage(qr)} style={{
            background: 'none', border: `1px solid ${T.border}`, borderRadius: 99,
            padding: '4px 10px', fontSize: 11, fontWeight: 600,
            color: T.textMuted, cursor: 'pointer', transition: 'all .15s', whiteSpace: 'nowrap',
          }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = driverColor; e.currentTarget.style.color = driverColor; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMuted; }}
          >
            {qr}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '10px 16px 14px', alignItems: 'flex-end' }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder="Type a message…"
          rows={1}
          style={{
            flex: 1, resize: 'none', background: '#FAFBFA',
            border: `1.5px solid ${T.border}`, borderRadius: 12,
            padding: '10px 13px', fontSize: 13, color: T.text,
            fontFamily: 'inherit', outline: 'none', lineHeight: 1.4,
            transition: 'border-color .2s', maxHeight: 80, overflowY: 'auto',
          }}
          onFocus={(e) => (e.target.style.borderColor = driverColor)}
          onBlur={(e)  => (e.target.style.borderColor = T.border)}
        />
        <button
          onClick={() => sendMessage()}
          disabled={!input.trim() || sending}
          style={{
            width: 40, height: 40, borderRadius: 12, border: 'none',
            background: !input.trim() || sending ? T.border : driverColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: !input.trim() || sending ? 'not-allowed' : 'pointer',
            flexShrink: 0, transition: 'all .2s',
          }}
        >
          {sent
            ? <Check size={16} color="#fff" strokeWidth={3} />
            : <Send size={15} color={!input.trim() || sending ? T.textMuted : '#fff'} />
          }
        </button>
      </div>
    </div>
  );
}

// ── Compact step row ───────────────────────────────────────────────
function StepperRow({ progress, accentColor }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start' }}>
      {progress.map((step, i) => {
        const isLast      = i === progress.length - 1;
        const isCompleted = step.status === 'completed';
        const isCurrent   = step.status === 'current';
        return (
          <div key={step.key} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
            position: 'relative',
          }}>
            {!isLast && (
              <div style={{
                position: 'absolute', top: 11, left: '50%',
                width: '100%', height: 1.5,
                background: isCompleted ? accentColor : T.border,
                zIndex: 0, transition: 'background .4s',
              }}/>
            )}
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              position: 'relative', zIndex: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isCompleted ? accentColor : isCurrent ? '#111' : '#F1EFE8',
              border: isCurrent ? `2px solid ${accentColor}` : 'none',
              transition: 'all .35s',
            }}>
              {isCompleted && (
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              {isCurrent && (
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: accentColor,
                  animation: 'ltpBlink 1.4s ease-in-out infinite',
                }}/>
              )}
            </div>
            <div style={{
              fontSize: 10, fontWeight: 500,
              color: step.status === 'pending' ? T.textMuted : T.text,
              marginTop: 6, textAlign: 'center', letterSpacing: '0.2px',
            }}>
              {step.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────
export default function LiveTrackingPanel({ active, onRideDone }) {
  const auth     = getAuth();
  const riderUid = auth.currentUser?.uid ?? null;

  const [driverDoc,   setDriverDoc]   = useState(null);
  const [showMessage, setShowMessage] = useState(false);

  useEffect(() => { injectPanelStyles(); }, []);

  const currentRide = useMemo(() => {
    if (!active?.length) return null;
    return (
      active.find(
        (r) => r.paymentStatus === 'succeeded' && r.status !== 'completed' && r.status !== 'cancelled'
      ) ?? null
    );
  }, [active]);

  const driverUid = currentRide?.driverUid;

  // Live driver doc
  useEffect(() => {
    if (!driverUid) { setDriverDoc(null); return; }
    const db    = getFirestore();
    const ref   = doc(db, 'Drivers', driverUid);
    const unsub = onSnapshot(ref, (snap) => {
      setDriverDoc(snap.exists() ? snap.data() : null);
    });
    return () => unsub();
  }, [driverUid]);

  // Ride completion callback
  useEffect(() => {
    if (currentRide?.status === 'completed') {
      const t = setTimeout(() => onRideDone?.(), 3000);
      return () => clearTimeout(t);
    }
  }, [currentRide?.status]);

  // Rider location ping
  useEffect(() => {
    const rideId     = currentRide?.id;
    const liveStatus = currentRide?.status;

    if (!rideId) return;
    if (liveStatus === 'completed' || liveStatus === 'cancelled') return;

    const ping = async () => {
      try {
        const position = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true, timeout: 8000, maximumAge: 30000,
          })
        );
        const { latitude: lat, longitude: lng } = position.coords;
        await callRiderLocation({ rideId, lat, lng });
      } catch (err) {
        console.warn('📍 Rider location ping failed:', err?.message ?? err);
      }
    };

    ping();
    const interval = setInterval(ping, 60_000);
    return () => clearInterval(interval);
  }, [currentRide?.id, currentRide?.status]);

  // Derived values
  const liveStatus  = currentRide?.status ?? '';
  const pickup      = currentRide?.pickup  ?? 'Pickup location';
  const dropoff     = currentRide?.dropoff ?? 'Drop-off location';
  const driverColor = getDriverColor(currentRide?.rideType);
  const progress    = buildProgress(liveStatus);

  const total = useMemo(() => {
    const v = Number(currentRide?.fareTotal ?? 0);
    return Number.isFinite(v) ? v.toFixed(2) : '--';
  }, [currentRide]);

  const miles = useMemo(() => {
    const v = Number(currentRide?.tripDistanceMiles ?? 0);
    return Number.isFinite(v) ? v.toFixed(1) : '0.0';
  }, [currentRide]);

  const driverFirstName = driverDoc?.firstName ?? '';
  const driverLastName  = driverDoc?.lastName  ?? '';
  const driverName = driverFirstName || driverLastName
    ? `${driverFirstName} ${driverLastName}`.trim()
    : null;

  const vehicle      = driverDoc?.vehicle ?? null;
  const driverPhone  = driverDoc?.contact?.phone ?? null;
  const driverRating = driverDoc?.averageRating ?? null;
  const driverReviews = driverDoc?.totalReviews ?? null;

  const driverLat = currentRide?.driverLat ?? null;
  const driverLng = currentRide?.driverLng ?? null;
  const hasLiveLocation = driverLat !== null && driverLng !== null;

  const headingToPickup  = ['driver_assigned', 'driver_arriving'].includes(liveStatus);
  const headingToDropoff = ['arrived', 'in_progress'].includes(liveStatus);
  const isCompleted      = liveStatus === 'completed';

  const driverDistanceMiles  = currentRide?.driverDistanceMiles  ?? null;
  const driverEtaMin         = currentRide?.driverEtaMin         ?? null;
  const dropoffDistanceMiles = currentRide?.dropoffDistanceMiles ?? null;
  const dropoffEtaMin        = currentRide?.dropoffEtaMin        ?? null;

  if (!currentRide) {
    return (
      <div className="glass" style={{
        padding: 26, textAlign: 'center', color: T.textMuted,
        fontSize: 14, fontWeight: 600,
      }}>
        No active ride found.
      </div>
    );
  }

  const vehicleLabel = vehicle ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`.trim() : null;
  const vehicleColor = vehicle?.color ? vehicle.color.charAt(0).toUpperCase() + vehicle.color.slice(1) : null;
  const seatCount    = vehicle?.seats ?? 4;

  const rideId = currentRide?.id ?? currentRide?.rideId;

  return (
    <div className="glass" style={{
      padding: 16,
      display: 'flex', flexDirection: 'column', gap: 12,
      animation: 'ltpFadeUp .35s ease-out',
    }}>

      {/* ── Map (your existing TrackingMap) ── */}
      <TrackingMap active={active} isTracking={!isCompleted} />

      {/* ── Step row card ── */}
      <div style={{
        background: '#fff',
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        padding: '14px 18px',
      }}>
        <StepperRow progress={progress} accentColor={driverColor} />
      </div>

      {/* ── Distance / ETA card ── */}
      {(driverDistanceMiles !== null || dropoffDistanceMiles !== null) && (
        <div style={{
          background: T.surfaceAlt ?? '#F8FAF9',
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          padding: '16px 18px',
        }}>
          {/* Track */}
          <div style={{
            display: 'flex', alignItems: 'center', marginBottom: 12,
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: headingToPickup ? driverColor : T.text,
              flexShrink: 0,
              boxShadow: headingToPickup ? `0 0 0 3px ${driverColor}22` : 'none',
              transition: 'all .35s',
            }}/>
            <div style={{
              flex: 1, height: 2,
              background: headingToPickup
                ? `linear-gradient(90deg, ${driverColor}, ${driverColor}55)`
                : T.border,
              transition: 'all .35s',
            }}/>
            <div style={{
              width: 11, height: 11, borderRadius: '50%',
              background: T.text,
              border: `2px solid ${headingToDropoff ? driverColor : T.border}`,
              flexShrink: 0,
              transition: 'all .35s',
            }}/>
            <div style={{
              flex: 1, height: 2,
              background: headingToDropoff
                ? `linear-gradient(90deg, ${ACCENT}, ${ACCENT}55)`
                : T.border,
              transition: 'all .35s',
            }}/>
            <div style={{
              width: 10, height: 10,
              background: headingToDropoff ? ACCENT : T.border,
              borderRadius: 2, transform: 'rotate(45deg)',
              flexShrink: 0,
              transition: 'all .35s',
            }}/>
          </div>

          {/* Values */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            alignItems: 'flex-start',
          }}>
            {/* Driver */}
            <div>
              <div style={{
                fontSize: 10, fontWeight: 700,
                color: headingToPickup ? driverColor : T.textMuted,
                letterSpacing: '0.5px', textTransform: 'uppercase',
                marginBottom: 4,
              }}>
                Driver
              </div>
              {driverDistanceMiles !== null ? (
                <>
                  <div style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: headingToPickup ? 22 : 16,
                    fontWeight: 700,
                    color: headingToPickup ? driverColor : T.text,
                    lineHeight: 1,
                    transition: 'all .35s',
                  }}>
                    {driverDistanceMiles}
                    <span style={{ fontSize: 11, fontWeight: 500, marginLeft: 2, color: T.textMuted, fontFamily: 'inherit' }}>
                      mi
                    </span>
                  </div>
                  {driverEtaMin !== null && (
                    <div style={{
                      fontSize: 11, fontWeight: 500,
                      color: headingToPickup ? driverColor : T.textMuted,
                      marginTop: 3,
                    }}>
                      {driverEtaMin} min away
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 11, color: T.textMuted }}>—</div>
              )}
            </div>

            {/* Pickup midpoint label */}
            <div style={{ textAlign: 'center', paddingTop: 2 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: T.textMuted,
                letterSpacing: '0.5px', textTransform: 'uppercase',
                marginBottom: 4,
              }}>
                Pickup
              </div>
              <div style={{
                fontSize: 12, color: T.text, fontWeight: 500,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                padding: '0 4px',
              }}>
                {pickup.split(',')[0]}
              </div>
            </div>

            {/* Dropoff */}
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontSize: 10, fontWeight: 700,
                color: headingToDropoff ? ACCENT : T.textMuted,
                letterSpacing: '0.5px', textTransform: 'uppercase',
                marginBottom: 4,
              }}>
                Dropoff
              </div>
              {dropoffDistanceMiles !== null ? (
                <>
                  <div style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: headingToDropoff ? 22 : 16,
                    fontWeight: 700,
                    color: headingToDropoff ? ACCENT : T.text,
                    lineHeight: 1,
                    transition: 'all .35s',
                  }}>
                    {dropoffDistanceMiles}
                    <span style={{ fontSize: 11, fontWeight: 500, marginLeft: 2, color: T.textMuted, fontFamily: 'inherit' }}>
                      mi
                    </span>
                  </div>
                  {dropoffEtaMin !== null && (
                    <div style={{
                      fontSize: 11, fontWeight: 500,
                      color: headingToDropoff ? ACCENT : T.textMuted,
                      marginTop: 3,
                    }}>
                      {dropoffEtaMin} min away
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 11, color: T.textMuted }}>—</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Driver card OR Message panel ── */}
      {showMessage ? (
        <MessagePanel
          rideId={rideId}
          driverUid={driverUid}
          driverName={driverName}
          driverColor={driverColor}
          onClose={() => setShowMessage(false)}
        />
      ) : (
        <div style={{
          background: '#fff',
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          padding: 16,
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          {/* Top row: avatar + info + actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <DriverAvatar
              firstName={driverFirstName}
              lastName={driverLastName}
              size={52}
              color={driverColor}
            />

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 16, fontWeight: 800, color: T.text,
                letterSpacing: '-0.2px',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {driverName || 'Finding driver…'}
              </div>

              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                marginTop: 3, flexWrap: 'wrap',
              }}>
                {driverRating && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 3,
                    fontSize: 12, fontWeight: 600, color: '#B45309',
                  }}>
                    <Star size={11} fill="#F59E0B" stroke="#F59E0B" />
                    {driverRating}
                    {driverReviews && (
                      <span style={{ fontSize: 11, fontWeight: 500, color: T.textMuted }}>
                        ({driverReviews})
                      </span>
                    )}
                  </div>
                )}
                {currentRide?.rideLabel && (
                  <>
                    <span style={{ color: T.border, fontSize: 11 }}>·</span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: T.textMuted }}>
                      {currentRide.rideLabel}
                    </span>
                  </>
                )}
                {hasLiveLocation && !isCompleted && (
                  <>
                    <span style={{ color: T.border, fontSize: 11 }}>·</span>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 11, fontWeight: 700, color: ACCENT,
                      letterSpacing: '0.3px',
                    }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: ACCENT,
                        animation: 'ltpBlink 1.4s ease-in-out infinite',
                      }}/>
                      LIVE
                    </span>
                  </>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              {driverPhone && (
                <a
                  href={`tel:${driverPhone}`}
                  style={{
                    height: 36, padding: '0 12px',
                    border: `1px solid ${T.border}`,
                    borderRadius: 10,
                    background: '#fff',
                    fontSize: 12, fontWeight: 700, color: T.text,
                    display: 'flex', alignItems: 'center', gap: 5,
                    textDecoration: 'none', whiteSpace: 'nowrap',
                    transition: 'all .15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = driverColor; e.currentTarget.style.color = driverColor; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.text; }}
                >
                  <Phone size={12} />
                  Call
                </a>
              )}
              <button
                onClick={() => setShowMessage(true)}
                style={{
                  height: 36, padding: '0 14px', border: 'none',
                  borderRadius: 10,
                  background: T.text ?? '#111',
                  fontSize: 12, fontWeight: 700, color: '#fff',
                  display: 'flex', alignItems: 'center', gap: 5,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                  transition: 'all .15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = driverColor; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = T.text ?? '#111'; }}
              >
                <MessageCircle size={12} />
                Chat
              </button>
            </div>
          </div>

          {/* Vehicle details row */}
          {(vehicleLabel || vehicle?.plate) && (
            <>
              <div style={{ height: 1, background: T.border }} />
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                flexWrap: 'wrap',
              }}>
                <Car size={13} color={T.textMuted} />
                {vehicleLabel && (
                  <span style={{ fontSize: 12, fontWeight: 500, color: T.text }}>
                    {vehicleColor ? `${vehicleColor} ` : ''}{vehicleLabel}
                  </span>
                )}
                {vehicle?.plate && (
                  <span style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: 11, fontWeight: 700,
                    background: '#F1EFE8',
                    border: `1px solid ${T.border}`,
                    borderRadius: 5,
                    padding: '2px 8px',
                    color: T.text,
                    letterSpacing: '1.5px',
                  }}>
                    {vehicle.plate.toUpperCase()}
                  </span>
                )}
                <span style={{ flex: 1 }} />
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 11, color: T.textMuted, fontWeight: 500,
                }}>
                  <Shield size={11} />
                  {seatCount} seats
                </span>
              </div>
            </>
          )}

          {/* Live coords (collapsed/subtle) */}
          {hasLiveLocation && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 11, color: T.textMuted,
              fontFamily: '"JetBrains Mono", monospace',
              borderTop: `1px solid ${T.border}`,
              paddingTop: 10, marginTop: -4,
            }}>
              <Navigation size={11} />
              <span>{driverLat?.toFixed(4)}, {driverLng?.toFixed(4)}</span>
              {driverDoc?.city && (
                <>
                  <span style={{ color: T.border }}>·</span>
                  <span style={{ fontFamily: 'inherit' }}>
                    {[driverDoc.city, driverDoc.zip].filter(Boolean).join(', ')}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Route card ── */}
      <div style={{
        background: '#fff',
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        padding: 16,
        display: 'flex', gap: 14, alignItems: 'stretch',
      }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 4, paddingTop: 4, flexShrink: 0,
        }}>
          <div style={{
            width: 9, height: 9, borderRadius: '50%',
            background: T.text,
          }}/>
          <div style={{ width: 1.5, flex: 1, background: T.border }}/>
          <div style={{
            width: 9, height: 9, borderRadius: 2,
            background: ACCENT, transform: 'rotate(45deg)',
          }}/>
        </div>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{
              fontSize: 10, fontWeight: 700, color: T.textMuted,
              letterSpacing: '0.4px', textTransform: 'uppercase',
              marginBottom: 2,
            }}>
              From
            </div>
            <div style={{
              fontSize: 14, fontWeight: 600, color: T.text,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {pickup}
            </div>
          </div>
          <div>
            <div style={{
              fontSize: 10, fontWeight: 700, color: T.textMuted,
              letterSpacing: '0.4px', textTransform: 'uppercase',
              marginBottom: 2,
            }}>
              To
            </div>
            <div style={{
              fontSize: 14, fontWeight: 600, color: T.text,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {dropoff}
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: T.textMuted,
            letterSpacing: '0.4px', textTransform: 'uppercase',
            marginBottom: 2,
          }}>
            Trip
          </div>
          <div style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 22, fontWeight: 700, color: ACCENT,
            lineHeight: 1,
          }}>
            ${total}
          </div>
          <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>
            {miles} mi
          </div>
        </div>
      </div>

    </div>
  );
}