// src/App/UaTob/ConfirmationModal.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Clock, Car, CheckCircle, RotateCcw, Loader2, MapPin, Navigation } from 'lucide-react';
import { THEME as T } from '@/App/UaTob/pricing.js';
import { doc, onSnapshot, getFirestore } from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

const db = getFirestore(firebase_app);

const CANCEL_RIDE_URL    = 'https://cancelride-ady2s2xhhq-uc.a.run.app';
const EXTEND_RIDE_SEARCH_URL = 'https://extendridesearch-ady2s2xhhq-uc.a.run.app';

// ── Seconds remaining from expiresAt (Firestore Timestamp | Date | string) ──
function getSecondsRemaining(expiresAt) {
  if (!expiresAt) return 0;
  let ms;
  if (expiresAt instanceof Date)              ms = expiresAt.getTime();
  else if (typeof expiresAt.toDate === 'function') ms = expiresAt.toDate().getTime();
  else                                         ms = new Date(expiresAt).getTime();
  if (!ms || isNaN(ms)) return 0;
  return Math.max(0, Math.floor((ms - Date.now()) / 1000));
}

// ── Format a Firestore Timestamp | Date | string → readable time ──
function fmtTime(ts) {
  if (!ts) return null;
  const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
  if (isNaN(d)) return null;
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function ConfirmationModal({
  onClose,
  onPaymentCancelled,
  onRetry,
  rides,
  ridesLoading,
}) {
  const [status,        setStatus]        = useState('checking_payment');
  const [secondsLeft,   setSecondsLeft]   = useState(0);
  const [driver,        setDriver]        = useState(null);
  const [visible,       setVisible]       = useState(false);
  const [liveRide,      setLiveRide]      = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const timerRef       = useRef(null);
  const closeTimeoutRef = useRef(null);
  const mountedRef     = useRef(true);
  const didTimeoutRef  = useRef(false);
  const lastRideIdRef  = useRef(null);
  const unsubRef       = useRef(null);

  // ── Derive the active ride from rides prop ──
  const seedRide = useMemo(() => {
    if (!rides?.length) return null;
    return (
      rides.find(
        (r) =>
          r.paymentStatus === 'succeeded' &&
          r.status !== 'completed' &&
          r.status !== 'cancelled'
      ) ??
      rides.find((r) => r.status === 'pending_payment') ??
      null
    );
  }, [rides]);

  const currentRide = liveRide ?? seedRide;
  const rideId      = currentRide?.id   ?? null;
  const riderUid    = currentRide?.uid  ?? null;

  // ── Mount / unmount cleanup ──
  useEffect(() => {
    mountedRef.current = true;
    const t = setTimeout(() => { if (mountedRef.current) setVisible(true); }, 30);
    return () => {
      mountedRef.current = false;
      clearTimeout(t);
      clearTimeout(closeTimeoutRef.current);
      clearInterval(timerRef.current);
      unsubRef.current?.();
    };
  }, []);

  // ── Subscribe to live ride document ──
  useEffect(() => {
    if (!rideId || rideId === lastRideIdRef.current) return;
    lastRideIdRef.current = rideId;
    unsubRef.current?.();
    unsubRef.current = onSnapshot(
      doc(db, 'Rides', rideId),
      (snap) => {
        if (!snap.exists() || !mountedRef.current) return;
        setLiveRide({ id: snap.id, ...snap.data() });
      },
      (err) => console.warn('[ConfirmationModal] onSnapshot error:', err)
    );
  }, [rideId]);

  // ── Update UI status from ride data ──
  useEffect(() => {
    if (!currentRide) return;
    const s = currentRide.status;

    if (s === 'pending_payment') {
      setStatus('checking_payment');
      return;
    }

    if (s === 'searching_driver' || s === 'searching') {
      if (didTimeoutRef.current) return;
      const remaining = getSecondsRemaining(currentRide.expiresAt);
      if (remaining <= 0) { setStatus('timeout'); return; }
      setSecondsLeft(remaining);
      setDriver(null);
      setStatus('searching');
      return;
    }

    if (s === 'driver_assigned') {
      clearInterval(timerRef.current);
      timerRef.current = null;
      if (currentRide.driver) setDriver(currentRide.driver);
      setStatus('assigned');
      return;
    }

    if (s === 'timeout' || s === 'cancelled') {
      clearInterval(timerRef.current);
      timerRef.current = null;
      setStatus('timeout');
    }
  }, [currentRide]);

  // ── Live countdown timer ──
  useEffect(() => {
    if (status !== 'searching') {
      clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const remaining = getSecondsRemaining(currentRide?.expiresAt);
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        if (!didTimeoutRef.current) {
          didTimeoutRef.current = true;
          setStatus('timeout');
        }
      }
    }, 1000);
    return () => { clearInterval(timerRef.current); timerRef.current = null; };
  }, [status, currentRide?.expiresAt]);

  // ── Auto-close after driver assigned ──
  useEffect(() => {
    if (status !== 'assigned') return;
    const t = setTimeout(() => { if (mountedRef.current) handleClose(); }, 1800);
    return () => clearTimeout(t);
  }, [status]);

  // ── Derived display values from ride data ──
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  const timeoutMinutes = currentRide?.timeoutMinutes ?? 25;
  const totalSeconds   = timeoutMinutes * 60;
  const progress       = totalSeconds > 0 ? (secondsLeft / totalSeconds) * 100 : 0;
  const isUrgent       = secondsLeft < 60;

  const total = useMemo(() => {
    const v = Number(currentRide?.fareTotal ?? 0);
    return Number.isFinite(v) ? v.toFixed(2) : '0.00';
  }, [currentRide]);

  const miles = useMemo(() => {
    const v = Number(currentRide?.tripDistanceMiles ?? 0);
    return Number.isFinite(v) ? v.toFixed(1) : '0.0';
  }, [currentRide]);

  const durationMin     = currentRide?.tripDurationMinutes  ?? currentRide?.estimatedDuration ?? null;
  const pickup          = currentRide?.pickup               ?? '—';
  const dropoff         = currentRide?.dropoff              ?? '—';
  const rideLabel       = currentRide?.rideLabel            ?? currentRide?.rideType ?? 'Ride';
  const etaMin          = currentRide?.etaMin               ?? currentRide?.driverEta ?? 10;
  const scheduledTime   = fmtTime(currentRide?.scheduledAt  ?? currentRide?.pickupTime);
  const paymentLast4    = currentRide?.paymentLast4         ?? currentRide?.cardLast4 ?? null;
  const paymentBrand    = currentRide?.paymentBrand         ?? currentRide?.cardBrand ?? null;
  const surgeMultiplier = currentRide?.surgeMultiplier      ?? null;
  const stops           = currentRide?.stops                ?? [];          // array of stop strings
  const notes           = currentRide?.notes                ?? currentRide?.driverNotes ?? null;
  const rideCategory    = currentRide?.rideCategory         ?? null;        // e.g. 'economy','xl','premium'

  // ── Handlers ──
  const handleClose = () => {
    setVisible(false);
    closeTimeoutRef.current = setTimeout(() => onClose?.(), 260);
  };

  const handlePaymentCancel = () => {
    setVisible(false);
    closeTimeoutRef.current = setTimeout(() => onPaymentCancelled?.(), 260);
  };

  const handleCancelRide = async () => {
    if (!rideId || !riderUid) return;
    setActionLoading(true);
    try {
      const res  = await fetch(CANCEL_RIDE_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ rideId, uid: riderUid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Cancel failed');
    } catch (err) {
      console.error('[ConfirmationModal] cancelRide error:', err);
    } finally {
      setActionLoading(false);
      handleClose();
    }
  };

  const handleWaitMore = async () => {
    if (!rideId || !riderUid) return;
    setActionLoading(true);
    try {
      const res  = await fetch(EXTEND_RIDE_SEARCH_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ rideId, uid: riderUid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Extend failed');
      didTimeoutRef.current = false;
    } catch (err) {
      console.error('[ConfirmationModal] extendRideSearch error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Shared card style ──
  const card = (extra = {}) => ({
    background:   '#F9FAFB',
    border:       `1px solid ${T.border}`,
    borderRadius: '14px',
    padding:      '12px 14px',
    ...extra,
  });

  return (
    <div
      style={{
        position:       'fixed',
        inset:          0,
        background:     'rgba(0,0,0,.55)',
        backdropFilter: 'blur(10px)',
        display:        'flex',
        justifyContent: 'center',
        alignItems:     'center',
        zIndex:         999,
        padding:        '20px',
        transition:     'opacity .25s ease',
        opacity:        visible ? 1 : 0,
      }}
    >
      <div
        style={{
          maxWidth:   '420px',
          width:      '100%',
          background: '#fff',
          borderRadius: '28px',
          overflow:   'hidden',
          boxShadow:  '0 32px 100px rgba(0,0,0,.22)',
          border:     '1px solid rgba(229,231,235,.8)',
          position:   'relative',
          transition: 'transform .28s cubic-bezier(.34,1.56,.64,1), opacity .25s ease',
          transform:  visible ? 'scale(1) translateY(0)' : 'scale(.94) translateY(16px)',
        }}
      >

        {/* ══════════════════════════════════════════
            CHECKING PAYMENT
        ══════════════════════════════════════════ */}
        {status === 'checking_payment' && (
          <div style={{ padding: '40px 28px', textAlign: 'center' }}>
            <Loader2
              size={40}
              color={T.accent}
              style={{ animation: 'spin 1s linear infinite', marginBottom: '20px' }}
            />
            <h3 style={{ fontSize: '22px', fontWeight: 900, color: T.text, marginBottom: '8px' }}>
              Checking payment…
            </h3>
            <p style={{ fontSize: '13px', color: T.textMuted, lineHeight: 1.6, marginBottom: '24px' }}>
              Verifying your payment — this only takes a moment.
            </p>

            {/* Ride summary while waiting */}
            {currentRide && (
              <div style={{ ...card(), marginBottom: '20px', textAlign: 'left' }}>
                <LocationRow pickup={pickup} dropoff={dropoff} stops={stops} T={T} />
                <RideMeta rideLabel={rideLabel} miles={miles} total={total} durationMin={durationMin} T={T} />
              </div>
            )}

            <button
              onClick={handlePaymentCancel}
              style={{
                width:        '100%',
                padding:      '13px',
                borderRadius: '14px',
                border:       `1.5px solid ${T.border}`,
                background:   '#fff',
                fontSize:     '14px',
                fontWeight:   700,
                color:        T.textMuted,
                cursor:       'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════════
            SEARCHING FOR DRIVER
        ══════════════════════════════════════════ */}
        {status === 'searching' && (
          <>
            {/* Top progress bar */}
            <div style={{ height: '4px', background: '#F3F4F6', overflow: 'hidden' }}>
              <div
                style={{
                  height:     '100%',
                  width:      `${progress}%`,
                  background: isUrgent
                    ? 'linear-gradient(90deg,#F59E0B,#EF4444)'
                    : 'linear-gradient(90deg,#22C55E,#16A34A)',
                  transition: 'width 1s linear, background .5s ease',
                }}
              />
            </div>

            <div style={{ padding: '28px 24px 24px', textAlign: 'center' }}>

              {/* Radar animation */}
              <div style={{ position: 'relative', width: '96px', height: '96px', margin: '0 auto 20px' }}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      position:     'absolute',
                      inset:        0,
                      borderRadius: '50%',
                      border:       `2px solid ${isUrgent ? 'rgba(239,68,68,.3)' : 'rgba(22,163,74,.28)'}`,
                      animation:    `radarRing 2.2s ease-out ${i * 0.72}s infinite`,
                    }}
                  />
                ))}
                <div
                  style={{
                    position:       'absolute',
                    inset:          '14px',
                    background:     isUrgent
                      ? 'linear-gradient(135deg,#F59E0B,#EF4444)'
                      : 'linear-gradient(135deg,#22C55E,#15803D)',
                    borderRadius:   '50%',
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    boxShadow:      isUrgent
                      ? '0 8px 28px rgba(239,68,68,.4)'
                      : '0 8px 28px rgba(22,163,74,.4)',
                  }}
                >
                  <Car size={24} color="#fff" />
                </div>
              </div>

              <h3 style={{ fontSize: '22px', fontWeight: 900, color: T.text, letterSpacing: '-0.5px', marginBottom: '6px' }}>
                {isUrgent ? 'Almost out of time…' : `Finding a driver (~${etaMin} min away)`}
              </h3>
              <p style={{ fontSize: '13px', color: T.textMuted, fontWeight: 500, marginBottom: '20px', lineHeight: 1.6 }}>
                {isUrgent
                  ? 'Searching nearby areas. Hang tight.'
                  : 'Matching you with the nearest available driver.'}
              </p>

              {/* Countdown */}
              <div
                style={{
                  background:    isUrgent ? '#FFF7ED' : '#F9FAFB',
                  border:        `1.5px solid ${isUrgent ? '#FED7AA' : T.border}`,
                  borderRadius:  '18px',
                  padding:       '18px 20px',
                  marginBottom:  '14px',
                }}
              >
                <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '1.2px', textTransform: 'uppercase', color: isUrgent ? '#D97706' : T.textMuted, marginBottom: '8px' }}>
                  Time remaining
                </div>
                <div
                  style={{
                    fontFamily:    '"JetBrains Mono",monospace',
                    fontSize:      '48px',
                    fontWeight:    700,
                    lineHeight:    1,
                    letterSpacing: '-3px',
                    color:         isUrgent ? '#EF4444' : T.accent,
                  }}
                >
                  {String(minutes).padStart(2, '0')}
                  <span style={{ fontSize: '24px', opacity: 0.35, margin: '0 1px' }}>:</span>
                  {String(seconds).padStart(2, '0')}
                </div>
                <div style={{ height: '4px', background: T.border, borderRadius: '100px', marginTop: '14px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height:     '100%',
                      width:      `${progress}%`,
                      background: isUrgent
                        ? 'linear-gradient(90deg,#F59E0B,#EF4444)'
                        : 'linear-gradient(90deg,#22C55E,#16A34A)',
                      transition: 'width 1s linear',
                    }}
                  />
                </div>
              </div>

              {/* Locations */}
              <div style={{ ...card({ borderRadius: '14px', marginBottom: '10px', textAlign: 'left' }) }}>
                <LocationRow pickup={pickup} dropoff={dropoff} stops={stops} T={T} />
              </div>

              {/* Ride summary row */}
              <div
                style={{
                  background:     '#F0FDF4',
                  border:         `1px solid ${T.accentBorder}`,
                  borderRadius:   '12px',
                  padding:        '10px 14px',
                  display:        'flex',
                  justifyContent: 'space-between',
                  alignItems:     'center',
                  marginBottom:   scheduledTime || surgeMultiplier || paymentLast4 ? '10px' : 0,
                }}
              >
                <span style={{ fontSize: '12px', fontWeight: 600, color: T.textMuted }}>
                  {rideLabel}{rideCategory ? ` · ${rideCategory}` : ''} · {miles} mi
                  {durationMin ? ` · ~${durationMin} min` : ''}
                </span>
                <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: '15px', fontWeight: 700, color: T.accent }}>
                  ${total}
                </span>
              </div>

              {/* Extra ride metadata */}
              <ExtraMeta
                scheduledTime={scheduledTime}
                surgeMultiplier={surgeMultiplier}
                paymentLast4={paymentLast4}
                paymentBrand={paymentBrand}
                notes={notes}
                T={T}
              />
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════
            DRIVER ASSIGNED
        ══════════════════════════════════════════ */}
        {status === 'assigned' && (
          <>
            {/* Green header */}
            <div
              style={{
                background: 'linear-gradient(135deg,#22C55E 0%,#15803D 100%)',
                padding:    '36px 24px 28px',
                textAlign:  'center',
                position:   'relative',
                overflow:   'hidden',
              }}
            >
              <div
                style={{
                  position:   'absolute',
                  inset:      0,
                  background: 'repeating-linear-gradient(45deg,rgba(255,255,255,.03) 0px,rgba(255,255,255,.03) 1px,transparent 1px,transparent 20px)',
                }}
              />
              {[0, 1].map((i) => (
                <div
                  key={i}
                  style={{
                    position:     'absolute',
                    top:          '50%',
                    left:         '50%',
                    transform:    'translate(-50%,-50%)',
                    width:        `${130 + i * 70}px`,
                    height:       `${130 + i * 70}px`,
                    borderRadius: '50%',
                    border:       '1.5px solid rgba(255,255,255,.14)',
                    animation:    `burstRing 2s ease-out ${i * 0.35}s infinite`,
                  }}
                />
              ))}
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div
                  style={{
                    width:          '76px',
                    height:         '76px',
                    margin:         '0 auto 14px',
                    background:     'rgba(255,255,255,.18)',
                    borderRadius:   '50%',
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    border:         '2px solid rgba(255,255,255,.35)',
                  }}
                >
                  <CheckCircle size={38} color="#fff" strokeWidth={2} />
                </div>
                <h3 style={{ fontSize: '26px', fontWeight: 900, color: '#fff', letterSpacing: '-0.6px', marginBottom: '4px' }}>
                  Driver matched!
                </h3>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,.8)', fontWeight: 500 }}>
                  Your ride is confirmed and on the way
                </p>
              </div>
            </div>

            <div style={{ padding: '20px 22px 22px' }}>

              {/* Driver card */}
              {driver ? (
                <div style={{ ...card({ borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '13px', marginBottom: '12px' }) }}>
                  <div
                    style={{
                      width:          '46px',
                      height:         '46px',
                      borderRadius:   '50%',
                      background:     'linear-gradient(135deg,#22C55E,#15803D)',
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'center',
                      fontSize:       '18px',
                      fontWeight:     900,
                      color:          '#fff',
                      flexShrink:     0,
                    }}
                  >
                    {driver.name?.[0] ?? '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: T.text }}>{driver.name || 'Driver'}</div>
                    <div style={{ fontSize: '11.5px', color: T.textMuted, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {[driver.vehicle, driver.vehicleColor, driver.plate].filter(Boolean).join(' · ') || 'Vehicle details pending'}
                    </div>
                    {driver.phone && (
                      <div style={{ fontSize: '11px', color: T.textMuted, marginTop: '2px' }}>{driver.phone}</div>
                    )}
                  </div>
                  {driver.rating && (
                    <div
                      style={{
                        background:   '#FEF9C3',
                        border:       '1px solid #FEF08A',
                        borderRadius: '8px',
                        padding:      '4px 10px',
                        fontSize:     '12px',
                        fontWeight:   800,
                        color:        '#854D0E',
                        flexShrink:   0,
                      }}
                    >
                      ★ {driver.rating}
                    </div>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    background:   '#F0FDF4',
                    border:       `1px solid ${T.accentBorder}`,
                    borderRadius: '14px',
                    padding:      '13px 15px',
                    display:      'flex',
                    alignItems:   'center',
                    gap:          '10px',
                    marginBottom: '12px',
                  }}
                >
                  <Car size={18} color={T.accent} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: T.accent }}>
                    Driver is heading to your pickup
                  </span>
                </div>
              )}

              {/* Driver ETA chip */}
              {etaMin && (
                <div
                  style={{
                    background:     '#EFF6FF',
                    border:         '1px solid #BFDBFE',
                    borderRadius:   '10px',
                    padding:        '8px 13px',
                    display:        'flex',
                    alignItems:     'center',
                    gap:            '7px',
                    marginBottom:   '12px',
                  }}
                >
                  <Navigation size={13} color="#2563EB" />
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#1D4ED8' }}>
                    Arriving in ~{etaMin} min
                  </span>
                </div>
              )}

              {/* Locations */}
              <div style={{ ...card({ marginBottom: '12px' }) }}>
                <LocationRow pickup={pickup} dropoff={dropoff} stops={stops} T={T} />
              </div>

              {/* Fare card */}
              <div
                style={{
                  ...card({
                    display:        'flex',
                    justifyContent: 'space-between',
                    alignItems:     'center',
                    marginBottom:   '14px',
                  }),
                }}
              >
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: T.textMuted, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '3px' }}>
                    Confirmed fare
                  </div>
                  <div style={{ fontSize: '12px', color: T.textMuted }}>
                    {rideLabel}{rideCategory ? ` · ${rideCategory}` : ''} · {miles} mi
                    {durationMin ? ` · ~${durationMin} min` : ''}
                  </div>
                  {paymentLast4 && (
                    <div style={{ fontSize: '11px', color: T.textMuted, marginTop: '3px' }}>
                      {paymentBrand ? `${paymentBrand} ` : ''}····{paymentLast4}
                    </div>
                  )}
                </div>
                <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: '22px', fontWeight: 700, color: T.accent }}>
                  ${total}
                </div>
              </div>

              {/* Extra metadata */}
              <ExtraMeta
                scheduledTime={scheduledTime}
                surgeMultiplier={surgeMultiplier}
                notes={notes}
                T={T}
              />

              <button className="cta-btn" onClick={handleClose} style={{ width: '100%' }}>
                Track My Ride
              </button>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════
            TIMEOUT
        ══════════════════════════════════════════ */}
        {status === 'timeout' && (
          <div style={{ padding: '36px 24px 28px', textAlign: 'center' }}>
            <div
              style={{
                width:          '76px',
                height:         '76px',
                margin:         '0 auto 18px',
                background:     '#FEF2F2',
                border:         '2px solid #FECACA',
                borderRadius:   '50%',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
              }}
            >
              <Clock size={32} color="#EF4444" />
            </div>
            <h3 style={{ fontSize: '22px', fontWeight: 900, color: T.text, marginBottom: '8px', letterSpacing: '-0.4px' }}>
              We couldn't match you with a driver
            </h3>
            <p style={{ fontSize: '13.5px', color: T.textMuted, fontWeight: 500, marginBottom: '10px', lineHeight: 1.65 }}>
              No drivers were available in your area within {timeoutMinutes} minutes.
              <br />
              Would you like to wait another {timeoutMinutes} minutes or cancel your ride?
            </p>

            {/* Not charged notice */}
            <div
              style={{
                background:     '#FFF7ED',
                border:         '1.5px solid #FED7AA',
                borderRadius:   '12px',
                padding:        '11px 14px',
                marginBottom:   '14px',
                display:        'flex',
                alignItems:     'center',
                gap:            '8px',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#92400E' }}>
                💳 You have not been charged
              </span>
            </div>

            {/* Ride summary at timeout */}
            <div style={{ ...card({ marginBottom: '20px', textAlign: 'left' }) }}>
              <LocationRow pickup={pickup} dropoff={dropoff} stops={stops} T={T} />
              <RideMeta rideLabel={rideLabel} miles={miles} total={total} durationMin={durationMin} T={T} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                className="cta-btn"
                onClick={handleWaitMore}
                disabled={actionLoading}
                style={{
                  width:          '100%',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  gap:            '8px',
                  opacity:        actionLoading ? 0.6 : 1,
                }}
              >
                {actionLoading
                  ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                  : <RotateCcw size={15} />}
                Wait {timeoutMinutes} More Minutes
              </button>

              <button
                onClick={handleCancelRide}
                disabled={actionLoading}
                style={{
                  width:        '100%',
                  padding:      '13px',
                  borderRadius: '14px',
                  border:       `1.5px solid ${T.border}`,
                  background:   '#fff',
                  fontSize:     '14px',
                  fontWeight:   700,
                  color:        T.textMuted,
                  cursor:       actionLoading ? 'not-allowed' : 'pointer',
                  opacity:      actionLoading ? 0.6 : 1,
                  transition:   'background .15s, border-color .15s, color .15s',
                }}
                onMouseEnter={(e) => {
                  if (!actionLoading) {
                    e.currentTarget.style.background    = '#FEF2F2';
                    e.currentTarget.style.borderColor   = '#FECACA';
                    e.currentTarget.style.color         = '#EF4444';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background    = '#fff';
                  e.currentTarget.style.borderColor   = T.border;
                  e.currentTarget.style.color         = T.textMuted;
                }}
              >
                Cancel Ride
              </button>
            </div>
          </div>
        )}

        <style>{`
          @keyframes radarRing {
            0%   { transform: scale(0.55); opacity: .8; }
            100% { transform: scale(1.75); opacity: 0;  }
          }
          @keyframes burstRing {
            0%   { transform: translate(-50%,-50%) scale(0.5); opacity: .5; }
            100% { transform: translate(-50%,-50%) scale(1.5); opacity: 0;  }
          }
          @keyframes spin {
            0%   { transform: rotate(0deg);   }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}

// ── Sub-component: pickup → stops → dropoff vertical route ──
function LocationRow({ pickup, dropoff, stops = [], T }) {
  const allStops = [pickup, ...stops, dropoff];

  return (
    <div style={{ display: 'flex', gap: '11px', alignItems: 'stretch' }}>
      {/* Icon column */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '3px', flexShrink: 0 }}>
        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: T.ink ?? '#111', flexShrink: 0 }} />
        {allStops.slice(1, -1).map((_, i) => (
          <React.Fragment key={i}>
            <div style={{ width: '1px', flex: 1, background: T.border, minHeight: '10px', margin: '3px 0' }} />
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
          </React.Fragment>
        ))}
        <div style={{ width: '1px', flex: 1, background: T.border, minHeight: '14px', margin: '3px 0' }} />
        <div style={{ width: '7px', height: '7px', borderRadius: '2px', background: T.accent, transform: 'rotate(45deg)', flexShrink: 0 }} />
      </div>
      {/* Text column */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {allStops.map((label, i) => (
          <div
            key={i}
            style={{
              fontSize:     '12px',
              fontWeight:   700,
              color:        T.text,
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
              marginBottom: i < allStops.length - 1 ? '7px' : 0,
            }}
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Sub-component: ride meta chips (label / miles / duration / fare) ──
function RideMeta({ rideLabel, miles, total, durationMin, T }) {
  return (
    <div
      style={{
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'center',
        marginTop:      '10px',
        paddingTop:     '10px',
        borderTop:      `1px solid ${T.border}`,
      }}
    >
      <span style={{ fontSize: '12px', fontWeight: 600, color: T.textMuted }}>
        {rideLabel} · {miles} mi{durationMin ? ` · ~${durationMin} min` : ''}
      </span>
      <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: '15px', fontWeight: 700, color: T.accent }}>
        ${total}
      </span>
    </div>
  );
}

// ── Sub-component: scheduled time / surge / payment / notes extras ──
function ExtraMeta({ scheduledTime, surgeMultiplier, paymentLast4, paymentBrand, notes, T }) {
  const hasAny = scheduledTime || surgeMultiplier || paymentLast4 || notes;
  if (!hasAny) return null;

  const chipStyle = (bg, border, color) => ({
    background:   bg,
    border:       `1px solid ${border}`,
    borderRadius: '9px',
    padding:      '6px 11px',
    fontSize:     '11.5px',
    fontWeight:   700,
    color,
    display:      'flex',
    alignItems:   'center',
    gap:          '5px',
  });

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginBottom: '12px' }}>
      {scheduledTime && (
        <div style={chipStyle('#EFF6FF', '#BFDBFE', '#1D4ED8')}>
          🕐 {scheduledTime}
        </div>
      )}
      {surgeMultiplier && surgeMultiplier > 1 && (
        <div style={chipStyle('#FFF7ED', '#FED7AA', '#92400E')}>
          ⚡ {surgeMultiplier}× surge
        </div>
      )}
      {paymentLast4 && (
        <div style={chipStyle('#F9FAFB', T.border, T.textMuted)}>
          💳 {paymentBrand ? `${paymentBrand} ` : ''}····{paymentLast4}
        </div>
      )}
      {notes && (
        <div style={{ ...chipStyle('#FAFAFA', T.border, T.textMuted), width: '100%' }}>
          📝 {notes}
        </div>
      )}
    </div>
  );
}
