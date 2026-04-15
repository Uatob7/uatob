// src/App/UaTob/LiveTrackingPanel.jsx
import React, { useMemo, useEffect, useState, useRef } from 'react';
import { Car, Star, Check, Phone, MapPin, Navigation, MessageCircle, Send, X, ChevronDown } from 'lucide-react';
import { THEME as T } from '@/App/UaTob/pricing.js';
import {
  getFirestore,
  doc,
  onSnapshot,
  addDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import TrackingMap from '@/App/UaTob/TrackingMap.jsx';

// ── Cloud Function URLs ────────────────────────────────────────────────
const RIDER_LOCATION_URL = "https://riderlocation-ady2s2xhhq-ue.a.run.app";

// ── Status → progress steps ────────────────────────────────
const STEPS = [
  { key: 'driver_assigned', label: 'Assigned' },
  { key: 'driver_arriving', label: 'En Route' },
  { key: 'arrived',         label: 'Arrived'  },
  { key: 'in_progress',     label: 'Riding'   },
  { key: 'completed',       label: 'Done'     },
];

const STATUS_ORDER = [
  'searching_driver',
  'driver_assigned',
  'driver_arriving',
  'arrived',
  'in_progress',
  'completed',
];

const RIDE_COLORS = {
  economy:  '#16A34A',
  standard: '#16A34A',
  premium:  '#7C3AED',
  xl:       '#F59E0B',
};

function getDriverColor(type) {
  return RIDE_COLORS[type] ?? '#16A34A';
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
    arrived:          `${name} has arrived!`,
    in_progress:      'On the way to your destination',
    completed:        'Ride complete 🎉',
  }[status] ?? '';
}

// ── Initials avatar ────────────────────────────────────────
function DriverAvatar({ firstName, lastName, size = 52, color }) {
  const initials = [firstName?.[0], lastName?.[0]]
    .filter(Boolean)
    .join('')
    .toUpperCase() || '?';

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '14px',
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: size * 0.32,
        fontWeight: 700,
        color: '#fff',
        letterSpacing: '1px',
      }}
    >
      {initials}
    </div>
  );
}

// ── Small pill badge ───────────────────────────────────────
function Pill({ children, color = T.accent }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        background: `${color}18`,
        border: `1px solid ${color}30`,
        borderRadius: '99px',
        padding: '2px 9px',
        fontSize: '11px',
        fontWeight: 700,
        color,
        letterSpacing: '0.3px',
      }}
    >
      {children}
    </span>
  );
}

// ── Message Panel ─────────────────────────────────────────
function MessagePanel({ rideId, driverUid, driverName, driverColor, onClose }) {
  const [messages, setMessages]   = useState([]);
  const [input, setInput]         = useState('');
  const [sending, setSending]     = useState(false);
  const [sent, setSent]           = useState(false);
  const listRef                   = useRef(null);
  const bottomRef                 = useRef(null);
  const isAtBottomRef             = useRef(true);
  const justSentRef               = useRef(false);
  const auth                      = getAuth();
  const db                        = getFirestore();
  const riderUid                  = auth.currentUser?.uid ?? null;

  const QUICK_REPLIES = [
    "I'm outside 👋",
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
        text:         trimmed,
        senderUid:    riderUid,
        senderRole:   'rider',
        createdAt:    serverTimestamp(),
        readByDriver: false,
        readByRider:  true,
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
    return new Date(ts.seconds * 1000).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div
      style={{
        background: T.surfaceAlt,
        border: `1.5px solid ${driverColor}30`,
        borderRadius: '18px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: `1px solid ${T.border}`,
          background: `${driverColor}08`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MessageCircle size={15} color={driverColor} />
          <span style={{ fontSize: '13px', fontWeight: 700, color: T.text }}>
            Message {driverName || 'Driver'}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
            fontWeight: 700,
            color: T.textMuted,
            padding: '4px 8px',
            borderRadius: '8px',
          }}
        >
          <ChevronDown size={14} />
          Hide
        </button>
      </div>

      {/* ── Message list ── */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        style={{
          minHeight: '160px',
          maxHeight: '240px',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: '14px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          overscrollBehavior: 'contain',
        }}
      >
        {messages.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              color: T.textMuted,
              fontSize: '12px',
              fontWeight: 500,
              marginTop: '20px',
            }}
          >
            No messages yet. Say hi to your driver!
          </div>
        )}
        {(() => {
          const lastRiderIdx = messages.reduce(
            (acc, m, i) => (m.senderRole === 'rider' ? i : acc), -1
          );
          return messages.map((msg, idx) => {
            const isRider    = msg.senderRole === 'rider';
            const isLastSent = isRider && idx === lastRiderIdx;
            const seen       = isLastSent && msg.readByDriver === true;

            return (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  justifyContent: isRider ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    maxWidth: '78%',
                    padding: '9px 13px',
                    borderRadius: isRider ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    background: isRider
                      ? `linear-gradient(135deg,${driverColor},${driverColor}cc)`
                      : T.surface ?? '#F9FAFB',
                    border: isRider ? 'none' : `1px solid ${T.border}`,
                    boxShadow: isRider ? `0 2px 10px ${driverColor}30` : 'none',
                  }}
                >
                  {!isRider && (
                    <div style={{
                      fontSize: '9px', fontWeight: 700, color: T.textMuted,
                      letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '3px',
                    }}>
                      Driver
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 500,
                      color: isRider ? '#fff' : T.text,
                      lineHeight: 1.4,
                    }}
                  >
                    {msg.text}
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isRider ? 'flex-end' : 'flex-start',
                    gap: '3px',
                    marginTop: '4px',
                  }}>
                    <span style={{
                      fontSize: '10px',
                      color: isRider ? 'rgba(255,255,255,0.65)' : T.textMuted,
                    }}>
                      {formatTime(msg.createdAt)}
                    </span>

                    {isLastSent && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center',
                        position: 'relative', width: '18px', height: '11px',
                        flexShrink: 0,
                      }}>
                        <svg
                          width="11" height="8" viewBox="0 0 11 8" fill="none"
                          style={{
                            position: 'absolute',
                            left: seen ? '0px' : '3px',
                            transition: 'left .2s ease',
                          }}
                        >
                          <path
                            d="M1 4L3.5 6.5L9.5 1"
                            stroke={seen ? driverColor : 'rgba(255,255,255,.55)'}
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <svg
                          width="11" height="8" viewBox="0 0 11 8" fill="none"
                          style={{
                            position: 'absolute',
                            right: '0px',
                            opacity: seen ? 1 : 0,
                            transition: 'opacity .25s ease',
                          }}
                        >
                          <path
                            d="M1 4L3.5 6.5L9.5 1"
                            stroke={driverColor}
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
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

      {/* ── Quick replies ── */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          padding: '0 16px 10px',
          flexWrap: 'wrap',
        }}
      >
        {QUICK_REPLIES.map((qr) => (
          <button
            key={qr}
            onClick={() => sendMessage(qr)}
            style={{
              background: 'none',
              border: `1px solid ${T.border}`,
              borderRadius: '99px',
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 600,
              color: T.textMuted,
              cursor: 'pointer',
              transition: 'all .15s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = driverColor;
              e.currentTarget.style.color = driverColor;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = T.border;
              e.currentTarget.style.color = T.textMuted;
            }}
          >
            {qr}
          </button>
        ))}
      </div>

      {/* ── Input row ── */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          padding: '10px 16px 14px',
          borderTop: `1px solid ${T.border}`,
          alignItems: 'flex-end',
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Type a message…"
          rows={1}
          style={{
            flex: 1,
            resize: 'none',
            background: T.surface ?? '#F9FAFB',
            border: `1.5px solid ${T.border}`,
            borderRadius: '12px',
            padding: '10px 13px',
            fontSize: '13px',
            color: T.text,
            fontFamily: 'inherit',
            outline: 'none',
            lineHeight: 1.4,
            transition: 'border-color .2s',
            maxHeight: '80px',
            overflowY: 'auto',
          }}
          onFocus={(e) => (e.target.style.borderColor = driverColor)}
          onBlur={(e)  => (e.target.style.borderColor = T.border)}
        />
        <button
          onClick={() => sendMessage()}
          disabled={!input.trim() || sending}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            border: 'none',
            background: !input.trim() || sending
              ? T.border
              : `linear-gradient(135deg,${driverColor},${driverColor}cc)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: !input.trim() || sending ? 'not-allowed' : 'pointer',
            flexShrink: 0,
            transition: 'all .2s',
            boxShadow: input.trim() ? `0 2px 10px ${driverColor}35` : 'none',
          }}
        >
          {sent ? (
            <Check size={16} color="#fff" strokeWidth={3} />
          ) : (
            <Send size={15} color={!input.trim() || sending ? T.textMuted : '#fff'} />
          )}
        </button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────
export default function LiveTrackingPanel({ active, onRideDone }) {

  console.log('LiveTrackingPanel render', { active });
  const [driverDoc, setDriverDoc]       = useState(null);
  const [showMessage, setShowMessage]   = useState(false);

  const currentRide = useMemo(() => {
    if (!active?.length) return null;
    return (
      active.find(
        (r) =>
          r.paymentStatus === 'succeeded' &&
          r.status !== 'completed' &&
          r.status !== 'cancelled'
      ) ?? null
    );
  }, [active]);

  const driverUid = currentRide?.driverUid;

  // ── Live driver doc ────────────────────────────────────
  useEffect(() => {
    if (!driverUid) { setDriverDoc(null); return; }
    const db    = getFirestore();
    const ref   = doc(db, 'Drivers', driverUid);
    const unsub = onSnapshot(ref, (snap) => {
      setDriverDoc(snap.exists() ? snap.data() : null);
    });
    return () => unsub();
  }, [driverUid]);

  // ── Ride completion callback ───────────────────────────
  useEffect(() => {
    if (currentRide?.status === 'completed') {
      const t = setTimeout(() => onRideDone?.(), 3000);
      return () => clearTimeout(t);
    }
  }, [currentRide?.status]);

  // ── Rider location ping ────────────────────────────────
  // Fires immediately when a ride becomes active, then every 60 seconds.
  // Sends riderLat/riderLng to the Rides doc via the riderLocation CF
  // so the backend can compute rider-to-dropoff distance and ETA.
  // Stops automatically when the ride is completed or cancelled.
  useEffect(() => {
    const rideId = currentRide?.id;
    const liveStatus = currentRide?.status;

    if (!rideId) return;
    if (liveStatus === 'completed' || liveStatus === 'cancelled') return;

    const ping = async () => {
      try {
        const position = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 30000,
          })
        );
        const { latitude: lat, longitude: lng } = position.coords;
        await fetch(RIDER_LOCATION_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rideId, lat, lng }),
        });
        console.log(`📍 Rider location ping — lat:${lat.toFixed(5)} lng:${lng.toFixed(5)}`);
      } catch (err) {
        console.warn('📍 Rider location ping failed:', err?.message ?? err);
      }
    };

    ping(); // fire immediately on mount / status change
    const interval = setInterval(ping, 60_000);
    return () => clearInterval(interval);
  }, [currentRide?.id, currentRide?.status]);

  // ── Derived values ─────────────────────────────────────
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

  // ── Driver info ────────────────────────────────────────
  const driverFirstName  = driverDoc?.firstName ?? '';
  const driverLastName   = driverDoc?.lastName  ?? '';
  const driverName = driverFirstName || driverLastName
    ? `${driverFirstName} ${driverLastName}`.trim()
    : null;

  const vehicle      = driverDoc?.vehicle ?? null;
  const driverPhone  = driverDoc?.contact?.phone ?? null;
  const driverRating = driverDoc?.averageRating ?? null;

  // ── Live driver position ───────────────────────────────
  const driverLat = currentRide?.driverLat ?? null;
  const driverLng = currentRide?.driverLng ?? null;
  const hasLiveLocation = driverLat !== null && driverLng !== null;

  const driverPos = useMemo(() => {
    if (!hasLiveLocation) return null;
    const x = ((driverLng + 180) / 360) * 100;
    const y = ((90 - driverLat) / 180) * 100;
    return { x: +x.toFixed(1), y: +y.toFixed(1) };
  }, [driverLat, driverLng, hasLiveLocation]);

  // ── Live rider position (from Rides doc) ───────────────
  const riderLat = currentRide?.riderLat ?? null;
  const riderLng = currentRide?.riderLng ?? null;
  const hasRiderLocation = riderLat !== null && riderLng !== null;

  // ── ETA / distance ─────────────────────────────────────
  const headingToPickup  = ['driver_assigned', 'driver_arriving'].includes(liveStatus);
  const headingToDropoff = ['arrived', 'in_progress'].includes(liveStatus);

  const driverDistanceMiles  = currentRide?.driverDistanceMiles  ?? null;
  const driverEtaMin         = currentRide?.driverEtaMin         ?? null;
  const dropoffDistanceMiles = currentRide?.dropoffDistanceMiles ?? null;
  const dropoffEtaMin        = currentRide?.dropoffEtaMin        ?? null;

  // ── Rider-to-dropoff distance (computed by backend from riderLat/riderLng) ──
  const riderDropoffDistanceMiles = currentRide?.riderDropoffDistanceMiles ?? null;
  const riderDropoffEtaMin        = currentRide?.riderDropoffEtaMin        ?? null;

  const distanceMiles = headingToPickup ? driverDistanceMiles : dropoffDistanceMiles;
  const etaMin        = headingToPickup ? driverEtaMin        : dropoffEtaMin;

  // ── Empty state ────────────────────────────────────────
  if (!currentRide) {
    return (
      <div
        className="glass"
        style={{
          padding: '26px',
          textAlign: 'center',
          color: T.textMuted,
          fontSize: '14px',
          fontWeight: 600,
        }}
      >
        No active ride found.
      </div>
    );
  }

  // ── Vehicle label ──────────────────────────────────────
  const vehicleLabel = vehicle
    ? `${vehicle.year} ${vehicle.make} ${vehicle.model}`.trim()
    : null;

  const vehicleColor = vehicle?.color
    ? vehicle.color.charAt(0).toUpperCase() + vehicle.color.slice(1)
    : null;

  return (
    <div className="glass" style={{ padding: '26px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* ── Map ── */}
      <TrackingMap
        bookingPayload={currentRide}
        rideStatus={liveStatus}
        driverPos={driverPos}
        isTracking={true}
        driverDistanceMiles={driverDistanceMiles}
        dropoffDistanceMiles={dropoffDistanceMiles}
        distanceMiles={distanceMiles}
        etaMin={etaMin}
      />

      {/* ── Header row ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.4px', color: T.text, margin: 0 }}>
            Live Tracking
          </h2>
          {liveStatus && (
            <div style={{ fontSize: '13px', fontWeight: 600, color: T.textMuted, marginTop: '4px' }}>
              {getStatusLabel(liveStatus, driverName)}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          {liveStatus === 'completed' && (
            <Pill color="#16A34A">Complete ✓</Pill>
          )}
          {hasLiveLocation && liveStatus !== 'completed' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div
                style={{
                  width: '7px',
                  height: '7px',
                  background: '#16A34A',
                  borderRadius: '50%',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}
              />
              <span style={{ fontSize: '10px', fontWeight: 700, color: T.textMuted, letterSpacing: '0.8px' }}>
                LIVE GPS
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Progress stepper ── */}
      <div style={{ display: 'flex', position: 'relative' }}>
        {progress.map((step, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative',
            }}
          >
            {i < progress.length - 1 && (
              <div
                style={{
                  position: 'absolute',
                  top: '15px',
                  left: '50%',
                  width: '100%',
                  height: '2px',
                  background:
                    step.status === 'completed'
                      ? 'linear-gradient(90deg,#16A34A,#22C55E)'
                      : T.border,
                  zIndex: 0,
                  transition: 'all .5s',
                }}
              />
            )}
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                position: 'relative',
                zIndex: 1,
                background:
                  step.status === 'completed'
                    ? 'linear-gradient(135deg,#16A34A,#15803D)'
                    : step.status === 'current'
                    ? 'linear-gradient(135deg,#111827,#374151)'
                    : '#F3F4F6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow:
                  step.status !== 'pending'
                    ? `0 4px 14px ${step.status === 'completed' ? 'rgba(22,163,74,.28)' : 'rgba(17,24,39,.2)'}`
                    : 'none',
                transition: 'all .4s',
              }}
            >
              {step.status === 'completed' ? (
                <Check size={15} color="#fff" strokeWidth={3} />
              ) : step.status === 'current' ? (
                <div
                  style={{
                    width: '7px',
                    height: '7px',
                    background: '#fff',
                    borderRadius: '50%',
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }}
                />
              ) : (
                <div style={{ width: '6px', height: '6px', background: '#D1D5DB', borderRadius: '50%' }} />
              )}
            </div>
            <div
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: step.status === 'pending' ? '#D1D5DB' : T.textMid,
                marginTop: '8px',
                textAlign: 'center',
              }}
            >
              {step.label}
            </div>
          </div>
        ))}
      </div>

      {/* ── Route Timeline + Route Card + Message Panel — mutually exclusive ── */}
      {showMessage ? (
        <MessagePanel
          rideId={currentRide?.id ?? currentRide?.rideId}
          driverUid={driverUid}
          driverName={driverName}
          driverColor={driverColor}
          onClose={() => setShowMessage(false)}
        />
      ) : (
        <>
          {/* ── Route Timeline ── */}
          {(driverDistanceMiles !== null || dropoffDistanceMiles !== null) && (
            <div
              style={{
                background: T.surfaceAlt,
                border: `1.5px solid ${T.border}`,
                borderRadius: '16px',
                padding: '18px 20px',
              }}
            >
              {/* Spine row */}
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: headingToPickup ? driverColor : T.border,
                      boxShadow: headingToPickup ? `0 0 0 3px ${driverColor}22` : 'none',
                      transition: 'all .4s',
                    }}
                  />
                </div>
                <div
                  style={{
                    flex: 1,
                    height: '2px',
                    background: headingToPickup
                      ? `linear-gradient(90deg,${driverColor},${driverColor}88)`
                      : T.border,
                    transition: 'all .4s',
                  }}
                />
                <div
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: T.ink,
                    border: `2px solid ${headingToPickup ? T.border : T.ink}`,
                    flexShrink: 0,
                    transition: 'all .4s',
                  }}
                />
                <div
                  style={{
                    flex: 1,
                    height: '2px',
                    background: headingToDropoff
                      ? `linear-gradient(90deg,${T.accent},${T.accent}88)`
                      : T.border,
                    transition: 'all .4s',
                  }}
                />
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    background: headingToDropoff ? T.accent : T.border,
                    borderRadius: '2px',
                    transform: 'rotate(45deg)',
                    flexShrink: 0,
                    transition: 'all .4s',
                  }}
                />
              </div>

              {/* Labels row */}
              <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                <div style={{ flexShrink: 0, maxWidth: '80px' }}>
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: headingToPickup ? driverColor : T.textMuted,
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase',
                      marginBottom: '3px',
                      transition: 'color .4s',
                    }}
                  >
                    Driver
                  </div>
                  {driverDistanceMiles !== null ? (
                    <>
                      <div
                        style={{
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: headingToPickup ? '22px' : '15px',
                          fontWeight: 700,
                          color: headingToPickup ? driverColor : T.textMuted,
                          lineHeight: 1,
                          transition: 'all .4s',
                        }}
                      >
                        {driverDistanceMiles}
                        <span style={{ fontSize: '11px', fontWeight: 400, marginLeft: '2px' }}>mi</span>
                      </div>
                      {driverEtaMin !== null && (
                        <div style={{ fontSize: '11px', color: headingToPickup ? driverColor : T.textMuted, marginTop: '2px', transition: 'color .4s' }}>
                          {driverEtaMin} min away
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ fontSize: '11px', color: T.textMuted }}>—</div>
                  )}
                </div>

                <div style={{ flex: 1, textAlign: 'center', padding: '0 8px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: T.textMuted, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '3px' }}>
                    Pickup
                  </div>
                  <div style={{ fontSize: '11px', color: T.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {pickup.split(',')[0]}
                  </div>
                </div>

                <div style={{ flexShrink: 0, maxWidth: '80px', textAlign: 'right' }}>
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: headingToDropoff ? T.accent : T.textMuted,
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase',
                      marginBottom: '3px',
                      transition: 'color .4s',
                    }}
                  >
                    Dropoff
                  </div>
                  {dropoffDistanceMiles !== null ? (
                    <>
                      <div
                        style={{
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: headingToDropoff ? '22px' : '15px',
                          fontWeight: 700,
                          color: headingToDropoff ? T.accent : T.textMuted,
                          lineHeight: 1,
                          transition: 'all .4s',
                        }}
                      >
                        {dropoffDistanceMiles}
                        <span style={{ fontSize: '11px', fontWeight: 400, marginLeft: '2px' }}>mi</span>
                      </div>
                      {dropoffEtaMin !== null && (
                        <div style={{ fontSize: '11px', color: headingToDropoff ? T.accent : T.textMuted, marginTop: '2px', transition: 'color .4s' }}>
                          {dropoffEtaMin} min away
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ fontSize: '11px', color: T.textMuted }}>—</div>
                  )}
                </div>
              </div>

              {/* ── Rider-to-dropoff distance row (shows during in_progress) ── */}
              {liveStatus === 'in_progress' && riderDropoffDistanceMiles !== null && (
                <div
                  style={{
                    marginTop: '14px',
                    paddingTop: '14px',
                    borderTop: `1px solid ${T.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {hasRiderLocation && (
                      <div
                        style={{
                          width: '6px',
                          height: '6px',
                          background: T.accent,
                          borderRadius: '50%',
                          animation: 'pulse 1.5s ease-in-out infinite',
                        }}
                      />
                    )}
                    <span style={{ fontSize: '11px', fontWeight: 700, color: T.textMuted, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                      You → Dropoff
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                    <span
                      style={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: '18px',
                        fontWeight: 700,
                        color: T.accent,
                      }}
                    >
                      {riderDropoffDistanceMiles}
                      <span style={{ fontSize: '11px', fontWeight: 400, marginLeft: '2px' }}>mi</span>
                    </span>
                    {riderDropoffEtaMin !== null && (
                      <span style={{ fontSize: '11px', color: T.accent }}>
                        {riderDropoffEtaMin} min
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Route card ── */}
          <div
            style={{
              background: T.surfaceAlt,
              border: `1px solid ${T.border}`,
              borderRadius: '16px',
              padding: '18px',
            }}
          >
            <div style={{ display: 'flex', gap: '14px', alignItems: 'stretch' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '10px', height: '10px', background: T.ink, borderRadius: '50%' }} />
                <div style={{ width: '1.5px', flex: 1, background: T.border }} />
                <div
                  style={{
                    width: '10px',
                    height: '10px',
                    background: T.accent,
                    borderRadius: '2px',
                    transform: 'rotate(45deg)',
                  }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ marginBottom: '14px' }}>
                  <div className="lbl">From</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {pickup}
                  </div>
                </div>
                <div>
                  <div className="lbl">To</div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {dropoff}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div className="lbl">Trip</div>
                <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '22px', fontWeight: 700, color: T.accent }}>
                  ${total}
                </div>
                <div style={{ fontSize: '11px', color: T.textMuted, marginTop: '2px' }}>{miles} mi</div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Driver card ── */}
      <div
        style={{
          background: T.surfaceAlt,
          border: `1.5px solid ${driverColor}25`,
          borderRadius: '16px',
          padding: '16px',
        }}
      >
        {/* Top row: avatar + name + rating */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: vehicleLabel ? '14px' : 0 }}>
          <DriverAvatar firstName={driverFirstName} lastName={driverLastName} size={52} color={driverColor} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '16px', fontWeight: 800, color: T.text }}>
                {driverName || 'Finding driver…'}
              </span>
              {driverRating && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '12px', fontWeight: 700, color: '#F59E0B' }}>
                  <Star size={11} fill="#F59E0B" />
                  {driverRating}
                  {driverDoc?.totalReviews && (
                    <span style={{ fontSize: '11px', fontWeight: 500, color: T.textMuted }}>
                      ({driverDoc.totalReviews})
                    </span>
                  )}
                </span>
              )}
              {currentRide?.rideLabel && (
                <Pill color={driverColor}>{currentRide.rideLabel}</Pill>
              )}
            </div>

            {vehicleLabel && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: T.textMuted, marginBottom: '3px' }}>
                <Car size={12} />
                <span>{vehicleColor ? `${vehicleColor} ` : ''}{vehicleLabel}</span>
              </div>
            )}

            {vehicle?.plate && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span
                  style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '2px',
                    background: T.border,
                    border: `1px solid ${T.border}`,
                    borderRadius: '6px',
                    padding: '2px 8px',
                    color: T.text,
                  }}
                >
                  {vehicle.plate.toUpperCase()}
                </span>
                {vehicle?.year && (
                  <span style={{ fontSize: '11px', color: T.textMuted }}>{vehicle.year}</span>
                )}
              </div>
            )}
          </div>

          {/* Call + Message CTAs */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
            {driverPhone && (
              <a
                href={`tel:${driverPhone}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: `${driverColor}12`,
                  border: `1.5px solid ${driverColor}30`,
                  borderRadius: '10px',
                  padding: '7px 12px',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: driverColor,
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                <Phone size={12} />
                Call
              </a>
            )}

            <button
              onClick={() => setShowMessage((v) => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: showMessage ? `${driverColor}18` : 'none',
                border: `1.5px solid ${showMessage ? driverColor : T.border}`,
                borderRadius: '10px',
                padding: '7px 12px',
                fontSize: '12px',
                fontWeight: 700,
                color: showMessage ? driverColor : T.textMuted,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all .2s',
              }}
            >
              <MessageCircle size={12} />
              {showMessage ? 'Hide' : 'Message'}
            </button>

            {hasLiveLocation && liveStatus !== 'completed' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div
                  style={{
                    width: '7px',
                    height: '7px',
                    background: '#16A34A',
                    borderRadius: '50%',
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }}
                />
                <span style={{ fontSize: '9px', fontWeight: 700, color: T.textMuted, letterSpacing: '0.6px' }}>
                  LIVE
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Bottom row: driver location */}
        {driverDoc && (
          <div
            style={{
              borderTop: `1px solid ${T.border}`,
              paddingTop: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: T.textMuted,
            }}
          >
            <MapPin size={12} />
            <span>
              {[driverDoc.city, driverDoc.zip].filter(Boolean).join(', ') || 'Orlando, FL'}
            </span>
            {hasLiveLocation && (
              <>
                <span style={{ color: T.border }}>·</span>
                <Navigation size={11} />
                <span>{driverLat?.toFixed(4)}, {driverLng?.toFixed(4)}</span>
              </>
            )}
          </div>
        )}
      </div>

    </div>
  );
}