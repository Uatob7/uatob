// src/App/UaTob/ConfirmationModal.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Clock, Car, CheckCircle, RotateCcw, Loader2, Bell, AlertCircle } from 'lucide-react';
import { THEME as T } from '@/App/UaTob/pricing.js';
import { doc, deleteDoc, onSnapshot, getFirestore } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getMessaging, getToken } from 'firebase/messaging';
import { firebase_app } from '@/firebase/config';

const db = getFirestore(firebase_app);
const functions = getFunctions(firebase_app, "us-east1");
const callableCancelRide = httpsCallable(functions, "cancelRide");
const callableExtendRideSearch = httpsCallable(functions, "extendRideSearch");
const callableSaveRiderToken = httpsCallable(functions, "saveRiderFcmToken");

const VAPID_KEY = "BJ_sRHZonSGCKk2mB2i9ofTRS8ouFVMV-I15FX4sqdUXHyVb1lo6H-N4GMPrlcIIshRlykQicaxkxxFxcYcI4JQ";
const SEARCH_LIMIT_SEC = 7 * 60; // used for progress bar only

// Helper: seconds remaining until expiresAt (Firestore Timestamp or Date)
function getSecondsRemaining(expiresAt) {
  if (!expiresAt) return 0;
  const expiryMs = expiresAt instanceof Date
    ? expiresAt.getTime()
    : expiresAt?.toDate?.()?.getTime?.() ?? new Date(expiresAt).getTime();
  if (!expiryMs || isNaN(expiryMs)) return 0;
  return Math.max(0, Math.floor((expiryMs - Date.now()) / 1000));
}

async function registerRiderFcmToken(rideId, uid) {
  if (!("Notification" in window)) throw new Error("Push not supported");
  const permission = await window.Notification.requestPermission();
  if (permission !== "granted") throw new Error("Permission denied");
  const messaging = getMessaging(firebase_app);
  const token = await getToken(messaging, { vapidKey: VAPID_KEY });
  if (!token) throw new Error("Empty token");
  await callableSaveRiderToken({ rideId, uid, token });
}

export default function ConfirmationModal({
  onClose,
  onPaymentCancelled,
  onRetry,
  rides,
}) {
  const [status, setStatus] = useState('checking_payment');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [driver, setDriver] = useState(null);
  const [visible, setVisible] = useState(false);
  const [liveRide, setLiveRide] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showNotifPopup, setShowNotifPopup] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState("");

  const timerRef = useRef(null);
  const closeTimeoutRef = useRef(null);
  const mountedRef = useRef(true);
  const lastRideIdRef = useRef(null);
  const unsubRef = useRef(null);
  const notifRequestedRef = useRef(false);
  const didTimeoutRef = useRef(false); // local flag to prevent multiple triggers

  const seedRide = useMemo(() => {
    if (!rides?.length) return null;
    return rides.find(r => r.paymentStatus === 'succeeded' && r.status !== 'completed' && r.status !== 'cancelled')
      ?? rides.find(r => r.status === 'pending_payment')
      ?? null;
  }, [rides]);

  const currentRide = liveRide ?? seedRide;
  const rideId = currentRide?.id ?? null;
  const riderUid = currentRide?.uid ?? null;

  // Mount / unmount
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

  // Firestore subscription – single source of truth
  useEffect(() => {
    if (!rideId) return;
    if (rideId === lastRideIdRef.current) return;
    lastRideIdRef.current = rideId;

    unsubRef.current?.();
    unsubRef.current = onSnapshot(
      doc(db, 'Rides', rideId),
      (snap) => {
        if (!snap.exists() || !mountedRef.current) return;
        setLiveRide({ id: snap.id, ...snap.data() });
      },
      (err) => console.warn('[ConfirmationModal] snapshot error:', err)
    );
  }, [rideId]);

  // UI state derived from Firestore status + local countdown
  useEffect(() => {
    if (!currentRide) return;

    const s = currentRide.status;

    switch (s) {
      case 'pending_payment':
        setStatus('checking_payment');
        break;
      case 'searching_driver':
      case 'searching':
        // Only reset if we are not already in timeout and status is searching
        if (!didTimeoutRef.current && status !== 'timeout') {
          setStatus('searching');
          setDriver(null);
          // Countdown will start via the timer effect
        }
        break;
      case 'driver_assigned':
        clearInterval(timerRef.current);
        timerRef.current = null;
        if (currentRide.driver) setDriver(currentRide.driver);
        setStatus('assigned');
        break;
      case 'timeout':
      case 'cancelled':
        clearInterval(timerRef.current);
        timerRef.current = null;
        setStatus('timeout');
        break;
      default:
        break;
    }
  }, [currentRide]);

  // Countdown timer based on expiresAt (purely visual, no backend write)
  useEffect(() => {
    if (status !== 'searching') {
      clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }

    // Start countdown only if we have expiresAt
    const updateTimer = () => {
      if (!currentRide?.expiresAt) {
        setSecondsLeft(0);
        return;
      }
      const remaining = getSecondsRemaining(currentRide.expiresAt);
      setSecondsLeft(remaining);
      if (remaining <= 0 && !didTimeoutRef.current) {
        didTimeoutRef.current = true;
        clearInterval(timerRef.current);
        timerRef.current = null;
        setStatus('timeout'); // local UI timeout – backend will also write it, but we show early
      }
    };

    updateTimer();
    clearInterval(timerRef.current);
    timerRef.current = setInterval(updateTimer, 1000);

    return () => {
      clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [status, currentRide?.expiresAt]);

  // Auto‑close after assignment
  useEffect(() => {
    if (status !== 'assigned') return;
    const t = setTimeout(() => {
      if (mountedRef.current) handleClose();
    }, 1500);
    return () => clearTimeout(t);
  }, [status]);

  // Notification popup (only once, when searching)
  useEffect(() => {
    if (status !== 'searching') return;
    if (notifRequestedRef.current) return;
    if (!("Notification" in window)) return;
    if (window.Notification.permission === "default") {
      setShowNotifPopup(true);
      notifRequestedRef.current = true;
    } else if (window.Notification.permission === "granted" && rideId && riderUid && !currentRide?.riderFcmToken) {
      registerRiderFcmToken(rideId, riderUid).catch(err =>
        console.warn("[Rider] Auto token failed:", err.message)
      );
    }
  }, [status, rideId, riderUid, currentRide?.riderFcmToken]);

  // Derived display values
  const total = useMemo(() => {
    const val = Number(currentRide?.fareTotal ?? 0);
    return Number.isFinite(val) ? val.toFixed(2) : '0.00';
  }, [currentRide]);

  const miles = useMemo(() => {
    const val = Number(currentRide?.tripDistanceMiles ?? 0);
    return Number.isFinite(val) ? val.toFixed(1) : '0.0';
  }, [currentRide]);

  const createdAtLabel = useMemo(() => {
    const raw = currentRide?.createdAt;
    if (!raw) return null;
    const date = raw instanceof Date ? raw : raw?.toDate?.() ?? new Date(raw);
    return isNaN(date.getTime()) ? null : date.toLocaleString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  }, [currentRide?.createdAt]);

  // Progress bar: percentage of time elapsed based on createdAt (or fallback)
  const progress = useMemo(() => {
    if (!currentRide?.createdAt) return 0;
    const createdMs = currentRide.createdAt instanceof Date
      ? currentRide.createdAt.getTime()
      : currentRide.createdAt?.toDate?.()?.getTime?.() ?? new Date(currentRide.createdAt).getTime();
    if (isNaN(createdMs)) return 0;
    const elapsedSec = Math.min(SEARCH_LIMIT_SEC, Math.floor((Date.now() - createdMs) / 1000));
    return (elapsedSec / SEARCH_LIMIT_SEC) * 100;
  }, [currentRide?.createdAt, secondsLeft]); // re-run when secondsLeft changes

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const isUrgent = secondsLeft < 60;

  const pickup = currentRide?.pickup ?? '—';
  const dropoff = currentRide?.dropoff ?? '—';
  const rideLabel = currentRide?.rideLabel ?? currentRide?.rideType ?? 'Ride';

  // Handlers
  const handleClose = async () => {
    if (status === 'checking_payment' && rideId) {
      deleteDoc(doc(db, 'Rides', rideId)).catch(err => console.warn(err));
      setVisible(false);
      closeTimeoutRef.current = setTimeout(() => onPaymentCancelled?.(), 260);
      return;
    }
    if (status === 'timeout' && rideId && riderUid) {
      setActionLoading(true);
      try {
        await callableCancelRide({ rideId, uid: riderUid });
      } catch (err) {
        console.error('Cancel error:', err);
      } finally {
        setActionLoading(false);
      }
    }
    setVisible(false);
    closeTimeoutRef.current = setTimeout(() => onClose?.(), 260);
  };

  const handleWaitMore = async () => {
    if (!rideId || !riderUid) return;
    setActionLoading(true);
    try {
      await callableExtendRideSearch({ rideId, uid: riderUid });
      // After extension, Firestore will update expiresAt; our timer will automatically restart
      didTimeoutRef.current = false;
    } catch (err) {
      console.error('Extend error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEnableNotifications = async () => {
    if (!rideId || !riderUid) {
      setNotifError("Ride info missing");
      return;
    }
    setNotifLoading(true);
    setNotifError("");
    try {
      await registerRiderFcmToken(rideId, riderUid);
      setShowNotifPopup(false);
    } catch (err) {
      setNotifError(err.message || "Failed to enable notifications");
    } finally {
      setNotifLoading(false);
    }
  };

  const handleSkipNotifications = () => {
    setShowNotifPopup(false);
    setNotifError("");
  };

  // Notification popup component (unchanged)
  const NotificationPopup = () => (
    <div onClick={e => e.target === e.currentTarget && handleSkipNotifications()} style={{
      position: 'fixed', inset: 0, zIndex: 1060,
      background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
    }}>
      <div style={{
        background: '#fff', borderRadius: '24px', padding: '28px 24px 24px',
        width: '100%', maxWidth: '340px', boxShadow: '0 24px 60px rgba(0,0,0,.18)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <div style={{
            width: '68px', height: '68px', borderRadius: '50%',
            background: notifError ? 'rgba(220,38,38,.08)' : 'rgba(37,99,235,.09)',
            border: `2px solid ${notifError ? 'rgba(220,38,38,.25)' : 'rgba(37,99,235,.25)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {notifLoading
              ? <Loader2 size={28} color="#2563EB" style={{ animation: 'spin 1s linear infinite' }} />
              : notifError
                ? <AlertCircle size={28} color="#DC2626" />
                : <Bell size={28} color="#2563EB" />
            }
          </div>
        </div>
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '22px', fontWeight: 900, color: '#111827', marginBottom: '6px' }}>
            {notifError ? "Permission failed" : "Get ride updates"}
          </div>
          <div style={{ fontSize: '13px', color: '#6B7280', lineHeight: 1.5 }}>
            {notifError || "Allow notifications to receive driver assignment alerts."}
          </div>
        </div>
        {!notifLoading && !notifError && (
          <div style={{ margin: '16px 0 22px', background: '#F3F4F6', borderRadius: '14px', padding: '12px', fontSize: '13px', fontWeight: 500, color: '#374151' }}>
            🔔 You'll know as soon as a driver accepts your ride
          </div>
        )}
        {!notifLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: notifError ? '16px' : 0 }}>
            <button onClick={handleEnableNotifications} style={{
              width: '100%', padding: '14px', borderRadius: '14px', border: 'none',
              background: notifError ? 'linear-gradient(135deg,#DC2626,#991B1B)' : 'linear-gradient(135deg,#3B82F6,#2563EB)',
              color: '#fff', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
            }}>
              {notifError ? "Try again" : "Allow notifications"}
            </button>
            <button onClick={handleSkipNotifications} style={{
              width: '100%', padding: '12px', borderRadius: '14px',
              border: '1.5px solid #E5E7EB', background: '#fff',
              color: '#6B7280', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
            }}>
              Not now
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // Main render
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)',
      backdropFilter: 'blur(10px)', display: 'flex', justifyContent: 'center',
      alignItems: 'center', zIndex: 999, padding: '20px',
      transition: 'opacity .25s ease', opacity: visible ? 1 : 0,
    }}>
      {showNotifPopup && <NotificationPopup />}

      <div style={{
        maxWidth: '420px', width: '100%', background: '#fff', borderRadius: '28px',
        overflow: 'hidden', boxShadow: '0 32px 100px rgba(0,0,0,.22)',
        border: '1px solid rgba(229,231,235,.8)',
        transition: 'transform .28s cubic-bezier(.34,1.56,.64,1), opacity .25s ease',
        transform: visible ? 'scale(1) translateY(0)' : 'scale(.94) translateY(16px)',
      }}>
        {/* CHECKING PAYMENT */}
        {status === 'checking_payment' && (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <Loader2 size={40} color={T.accent} style={{ animation: 'spin 1s linear infinite', marginBottom: '20px' }} />
            <h3 style={{ fontSize: '22px', fontWeight: 900, color: T.text, marginBottom: '8px' }}>Checking payment...</h3>
            <p style={{ fontSize: '13px', color: T.textMuted, marginBottom: '24px' }}>
              Verifying your payment — this only takes a moment.
            </p>
            <button onClick={handleClose} style={{
              width: '100%', padding: '13px', borderRadius: '14px', border: `1.5px solid ${T.border}`,
              background: '#fff', fontSize: '14px', fontWeight: 700, color: T.textMuted, cursor: 'pointer',
            }}>
              Cancel
            </button>
          </div>
        )}

        {/* SEARCHING – with countdown timer */}
        {status === 'searching' && (
          <>
            {progress > 0 && (
              <div style={{ height: '4px', background: '#F3F4F6', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${100 - progress}%`,
                  background: isUrgent ? 'linear-gradient(90deg,#F59E0B,#EF4444)' : 'linear-gradient(90deg,#22C55E,#16A34A)',
                  transition: 'width 1s linear',
                }} />
              </div>
            )}
            <div style={{ padding: '28px 24px 24px', textAlign: 'center' }}>
              <div style={{ position: 'relative', width: '96px', height: '96px', margin: '0 auto 20px' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    border: `2px solid ${isUrgent ? 'rgba(239,68,68,.3)' : 'rgba(22,163,74,.28)'}`,
                    animation: `radarRing 2.2s ease-out ${i * 0.72}s infinite`,
                  }} />
                ))}
                <div style={{
                  position: 'absolute', inset: '14px',
                  background: isUrgent ? 'linear-gradient(135deg,#F59E0B,#EF4444)' : 'linear-gradient(135deg,#22C55E,#15803D)',
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Car size={24} color="#fff" />
                </div>
              </div>
              <h3 style={{ fontSize: '22px', fontWeight: 900, color: T.text, marginBottom: '6px' }}>
                {isUrgent ? 'Almost out of time…' : 'Finding your driver'}
              </h3>
              <p style={{ fontSize: '13px', color: T.textMuted, marginBottom: '20px' }}>
                {isUrgent ? 'Searching nearby areas. Hang tight.' : 'Matching you with the nearest available driver.'}
              </p>
              <div style={{
                background: isUrgent ? '#FFF7ED' : '#F9FAFB',
                border: `1.5px solid ${isUrgent ? '#FED7AA' : T.border}`,
                borderRadius: '18px', padding: '18px 20px', marginBottom: '14px',
              }}>
                <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '1.2px', textTransform: 'uppercase', color: isUrgent ? '#D97706' : T.textMuted, marginBottom: '8px' }}>
                  Time remaining
                </div>
                <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: '48px', fontWeight: 700, lineHeight: 1, letterSpacing: '-3px', color: isUrgent ? '#EF4444' : T.accent }}>
                  {String(minutes).padStart(2, '0')}
                  <span style={{ fontSize: '24px', opacity: 0.35, margin: '0 1px' }}>:</span>
                  {String(seconds).padStart(2, '0')}
                </div>
                {progress > 0 && (
                  <div style={{ height: '4px', background: T.border, borderRadius: '100px', marginTop: '14px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${progress}%`,
                      background: isUrgent ? 'linear-gradient(90deg,#F59E0B,#EF4444)' : 'linear-gradient(90deg,#22C55E,#16A34A)',
                      borderRadius: '100px', transition: 'width 1s linear',
                    }} />
                  </div>
                )}
                {createdAtLabel && (
                  <div style={{ marginTop: '10px', fontSize: '11px', color: T.textMuted }}>
                    Booked {createdAtLabel}
                  </div>
                )}
              </div>
              <div style={{ background: '#FAFAFA', border: `1px solid ${T.border}`, borderRadius: '14px', padding: '12px 14px', marginBottom: '10px', textAlign: 'left' }}>
                <div style={{ display: 'flex', gap: '11px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '3px' }}>
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: T.ink }} />
                    <div style={{ width: '1px', flex: 1, background: T.border, minHeight: '14px', margin: '3px 0' }} />
                    <div style={{ width: '7px', height: '7px', borderRadius: '2px', background: T.accent, transform: 'rotate(45deg)' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: T.text, marginBottom: '7px' }}>{pickup}</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: T.text }}>{dropoff}</div>
                  </div>
                </div>
              </div>
              <div style={{ background: '#F0FDF4', border: `1px solid ${T.accentBorder}`, borderRadius: '12px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: T.textMuted }}>{rideLabel} · {miles} mi</span>
                <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: '15px', fontWeight: 700, color: T.accent }}>${total}</span>
              </div>
            </div>
          </>
        )}

        {/* ASSIGNED (unchanged) */}
        {status === 'assigned' && (
          <>
            <div style={{ background: 'linear-gradient(135deg,#22C55E 0%,#15803D 100%)', padding: '36px 24px 28px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(45deg,rgba(255,255,255,.03) 0px,rgba(255,255,255,.03) 1px,transparent 1px,transparent 20px)' }} />
              {[0, 1].map(i => (
                <div key={i} style={{
                  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                  width: `${130 + i * 70}px`, height: `${130 + i * 70}px`, borderRadius: '50%',
                  border: '1.5px solid rgba(255,255,255,.14)', animation: `burstRing 2s ease-out ${i * 0.35}s infinite`,
                }} />
              ))}
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ width: '76px', height: '76px', margin: '0 auto 14px', background: 'rgba(255,255,255,.18)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,.35)' }}>
                  <CheckCircle size={38} color="#fff" strokeWidth={2} />
                </div>
                <h3 style={{ fontSize: '26px', fontWeight: 900, color: '#fff', marginBottom: '4px' }}>Driver matched!</h3>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,.8)', fontWeight: 500 }}>Your ride is confirmed and on the way</p>
              </div>
            </div>
            <div style={{ padding: '20px 22px 22px' }}>
              {driver ? (
                <div style={{ background: '#F9FAFB', border: `1px solid ${T.border}`, borderRadius: '16px', padding: '14px', display: 'flex', alignItems: 'center', gap: '13px', marginBottom: '14px' }}>
                  <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: 'linear-gradient(135deg,#22C55E,#15803D)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 900, color: '#fff' }}>
                    {driver.name?.[0] ?? '?'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: T.text }}>{driver.name || 'Driver'}</div>
                    <div style={{ fontSize: '11.5px', color: T.textMuted, marginTop: '2px' }}>{driver.vehicle || 'Vehicle'} · {driver.plate || 'Plate pending'}</div>
                  </div>
                  {driver.rating && (
                    <div style={{ background: '#FEF9C3', border: '1px solid #FEF08A', borderRadius: '8px', padding: '4px 10px', fontSize: '12px', fontWeight: 800, color: '#854D0E' }}>
                      ★ {driver.rating}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ background: '#F0FDF4', border: `1px solid ${T.accentBorder}`, borderRadius: '14px', padding: '13px 15px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                  <Car size={18} color={T.accent} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: T.accent }}>Driver is heading to your pickup</span>
                </div>
              )}
              <div style={{ background: '#F9FAFB', border: `1px solid ${T.border}`, borderRadius: '13px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: 800, color: T.textMuted, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '3px' }}>Confirmed fare</div>
                  <div style={{ fontSize: '12px', color: T.textMuted }}>{rideLabel} · {miles} mi</div>
                </div>
                <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: '22px', fontWeight: 700, color: T.accent }}>${total}</div>
              </div>
              <button onClick={handleClose} style={{ width: '100%', padding: '14px', background: T.accent, border: 'none', borderRadius: '14px', color: '#fff', fontWeight: 800, fontSize: '15px', cursor: 'pointer' }}>Track My Ride</button>
            </div>
          </>
        )}

        {/* TIMEOUT – shown only when backend writes status: "timeout" OR when local countdown hits zero */}
        {status === 'timeout' && (
          <div style={{ padding: '36px 24px 28px', textAlign: 'center' }}>
            <div style={{ width: '76px', height: '76px', margin: '0 auto 18px', background: '#FEF2F2', border: '2px solid #FECACA', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={32} color="#EF4444" />
            </div>
            <h3 style={{ fontSize: '22px', fontWeight: 900, color: T.text, marginBottom: '8px' }}>We couldn't match you with a driver</h3>
            <p style={{ fontSize: '13.5px', color: T.textMuted, marginBottom: '10px', lineHeight: 1.65 }}>
              No drivers were available in your area within the time limit.<br />
              Would you like to wait another 7 minutes or cancel your ride?
            </p>
            <div style={{ background: '#FFF7ED', border: '1.5px solid #FED7AA', borderRadius: '12px', padding: '11px 14px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#92400E' }}>💳 You have not been charged</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button onClick={handleWaitMore} disabled={actionLoading} style={{
                width: '100%', padding: '14px', borderRadius: '14px', border: 'none', background: T.accent,
                color: '#fff', fontWeight: 800, fontSize: '15px', cursor: actionLoading ? 'not-allowed' : 'pointer',
                opacity: actionLoading ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}>
                {actionLoading ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <RotateCcw size={15} />}
                Wait 7 More Minutes
              </button>
              <button onClick={handleClose} disabled={actionLoading} style={{
                width: '100%', padding: '13px', borderRadius: '14px', border: `1.5px solid ${T.border}`,
                background: '#fff', fontSize: '14px', fontWeight: 700, color: T.textMuted,
                cursor: actionLoading ? 'not-allowed' : 'pointer', opacity: actionLoading ? 0.6 : 1,
              }}>
                Cancel Ride
              </button>
            </div>
          </div>
        )}

        <style>{`
          @keyframes radarRing { 0% { transform: scale(0.55); opacity: .8; } 100% { transform: scale(1.75); opacity: 0; } }
          @keyframes burstRing { 0% { transform: translate(-50%,-50%) scale(0.5); opacity: .5; } 100% { transform: translate(-50%,-50%) scale(1.5); opacity: 0; } }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  );
}