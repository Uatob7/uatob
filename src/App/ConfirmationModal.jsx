// src/App/ConfirmationModal.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Clock, Car, X, CheckCircle, RotateCcw } from 'lucide-react';
import { THEME as T } from '@/App/pricing.js';
import { db } from '@/App/firebase.js';
import { doc, onSnapshot } from 'firebase/firestore';

const SEARCH_LIMIT_SEC = 7 * 60;

export default function ConfirmationModal({ rideId, fareData, onClose, onRetry }) {
  const [status,      setStatus]      = useState('searching'); // 'searching' | 'assigned' | 'timeout'
  const [secondsLeft, setSecondsLeft] = useState(SEARCH_LIMIT_SEC);
  const [driver,      setDriver]      = useState(null);
  const [visible,     setVisible]     = useState(false);

  const unsubRef = useRef(null);
  const timerRef = useRef(null);

  // Mount animation
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  // ── Firestore realtime listener ──────────────────────
  useEffect(() => {
    if (!rideId || status !== 'searching') return;

    try {
      unsubRef.current = onSnapshot(
        doc(db, 'Rides', rideId),
        (snap) => {
          if (!snap.exists()) return;
          const data = snap.data();
          if (data.status === 'driver_assigned') {
            if (data.driver) setDriver(data.driver);
            setStatus('assigned');
          }
        },
        (err) => console.warn('[ConfirmationModal] Firestore error:', err)
      );
    } catch (err) {
      console.warn('[ConfirmationModal] onSnapshot setup error:', err);
    }

    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, [rideId, status]);

  // Unsub when no longer searching
  useEffect(() => {
    if (status !== 'searching') {
      unsubRef.current?.();
      unsubRef.current = null;
    }
  }, [status]);

  // ── Countdown ────────────────────────────────────────
  useEffect(() => {
    if (status !== 'searching') {
      clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(timerRef.current);
          setStatus('timeout');
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [status]);

  // ── Derived ──────────────────────────────────────────
  const minutes  = Math.floor(secondsLeft / 60);
  const seconds  = secondsLeft % 60;
  const progress = ((SEARCH_LIMIT_SEC - secondsLeft) / SEARCH_LIMIT_SEC) * 100;
  const isUrgent = secondsLeft < 60;

  const total   = Number(fareData?.fareEstimate ?? fareData?.total ?? 0).toFixed(2);
  const miles   = fareData?.tripDistanceMiles ?? 0;
  const pickup  = fareData?.pickup  ?? '—';
  const dropoff = fareData?.dropoff ?? '—';

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onClose?.(), 260);
  };

  const handleRetry = () => {
    setVisible(false);
    setTimeout(() => onRetry?.(), 260);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,.55)',
      backdropFilter: 'blur(10px)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      zIndex: 999, padding: '20px',
      transition: 'opacity .25s ease',
      opacity: visible ? 1 : 0,
    }}>
      <div style={{
        maxWidth: '420px', width: '100%',
        background: '#fff',
        borderRadius: '28px',
        overflow: 'hidden',
        boxShadow: '0 32px 100px rgba(0,0,0,.22)',
        border: '1px solid rgba(229,231,235,.8)',
        position: 'relative',
        transition: 'transform .28s cubic-bezier(.34,1.56,.64,1), opacity .25s ease',
        transform: visible ? 'scale(1) translateY(0)' : 'scale(.94) translateY(16px)',
      }}>

        {/* ════════════════════════════════════════════ */}
        {/* SEARCHING                                    */}
        {/* ════════════════════════════════════════════ */}
        {status === 'searching' && (
          <>
            {/* Top progress bar */}
            <div style={{ height: '4px', background: '#F3F4F6', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${100 - progress}%`,
                background: isUrgent
                  ? 'linear-gradient(90deg,#F59E0B,#EF4444)'
                  : 'linear-gradient(90deg,#22C55E,#16A34A)',
                transition: 'width 1s linear, background .5s ease',
              }} />
            </div>

            <div style={{ padding: '28px 24px 24px', textAlign: 'center' }}>

              {/* Radar */}
              <div style={{ position: 'relative', width: '96px', height: '96px', margin: '0 auto 20px' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    position: 'absolute', inset: 0,
                    borderRadius: '50%',
                    border: `2px solid ${isUrgent ? 'rgba(239,68,68,.3)' : 'rgba(22,163,74,.28)'}`,
                    animation: `radarRing 2.2s ease-out ${i * 0.72}s infinite`,
                  }} />
                ))}
                <div style={{
                  position: 'absolute', inset: '14px',
                  background: isUrgent
                    ? 'linear-gradient(135deg,#F59E0B,#EF4444)'
                    : 'linear-gradient(135deg,#22C55E,#15803D)',
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: isUrgent ? '0 8px 28px rgba(239,68,68,.4)' : '0 8px 28px rgba(22,163,74,.4)',
                  transition: 'all .5s ease',
                }}>
                  <Car size={24} color="#fff" />
                </div>
              </div>

              <h3 style={{ fontSize: '22px', fontWeight: 900, color: T.text, letterSpacing: '-0.5px', marginBottom: '6px' }}>
                {isUrgent ? 'Almost out of time…' : 'Finding your driver'}
              </h3>
              <p style={{ fontSize: '13px', color: T.textMuted, fontWeight: 500, marginBottom: '20px', lineHeight: 1.6 }}>
                {isUrgent
                  ? 'Searching nearby areas. Hang tight.'
                  : 'Matching you with the nearest available driver.'}
              </p>

              {/* Countdown block */}
              <div style={{
                background: isUrgent ? '#FFF7ED' : '#F9FAFB',
                border: `1.5px solid ${isUrgent ? '#FED7AA' : T.border}`,
                borderRadius: '18px', padding: '18px 20px', marginBottom: '14px',
                transition: 'all .5s ease',
              }}>
                <div style={{ fontSize: '10px', fontWeight: 800, letterSpacing: '1.2px', textTransform: 'uppercase', color: isUrgent ? '#D97706' : T.textMuted, marginBottom: '8px' }}>
                  Time remaining
                </div>
                <div style={{
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: '48px', fontWeight: 700, lineHeight: 1, letterSpacing: '-3px',
                  color: isUrgent ? '#EF4444' : T.accent,
                  transition: 'color .5s ease',
                }}>
                  {String(minutes).padStart(2, '0')}
                  <span style={{ fontSize: '24px', opacity: .35, margin: '0 1px' }}>:</span>
                  {String(seconds).padStart(2, '0')}
                </div>
                <div style={{ height: '4px', background: T.border, borderRadius: '100px', marginTop: '14px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${progress}%`,
                    background: isUrgent ? 'linear-gradient(90deg,#F59E0B,#EF4444)' : 'linear-gradient(90deg,#22C55E,#16A34A)',
                    borderRadius: '100px',
                    transition: 'width 1s linear, background .5s ease',
                  }} />
                </div>
              </div>

              {/* Route */}
              <div style={{ background: '#FAFAFA', border: `1px solid ${T.border}`, borderRadius: '14px', padding: '12px 14px', marginBottom: '10px', textAlign: 'left' }}>
                <div style={{ display: 'flex', gap: '11px', alignItems: 'stretch' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '3px' }}>
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: T.ink, flexShrink: 0 }} />
                    <div style={{ width: '1px', flex: 1, background: T.border, minHeight: '14px', margin: '3px 0' }} />
                    <div style={{ width: '7px', height: '7px', borderRadius: '2px', background: T.accent, transform: 'rotate(45deg)', flexShrink: 0 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: T.text, marginBottom: '7px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pickup}</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dropoff}</div>
                  </div>
                </div>
              </div>

              {/* Fare */}
              <div style={{ background: '#F0FDF4', border: `1px solid ${T.accentBorder}`, borderRadius: '12px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: T.textMuted }}>
                  {fareData?.rideType ? `${fareData.rideType.charAt(0).toUpperCase() + fareData.rideType.slice(1)} · ` : ''}{miles} mi
                </span>
                <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: '15px', fontWeight: 700, color: T.accent }}>${total}</span>
              </div>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════ */}
        {/* ASSIGNED — celebration                      */}
        {/* ════════════════════════════════════════════ */}
        {status === 'assigned' && (
          <>
            <div style={{
              background: 'linear-gradient(135deg,#22C55E 0%,#15803D 100%)',
              padding: '36px 24px 28px',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(45deg,rgba(255,255,255,.03) 0px,rgba(255,255,255,.03) 1px,transparent 1px,transparent 20px)' }} />
              {[0, 1].map(i => (
                <div key={i} style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%,-50%)',
                  width: `${130 + i * 70}px`, height: `${130 + i * 70}px`,
                  borderRadius: '50%',
                  border: '1.5px solid rgba(255,255,255,.14)',
                  animation: `burstRing 2s ease-out ${i * 0.35}s infinite`,
                }} />
              ))}
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{
                  width: '76px', height: '76px', margin: '0 auto 14px',
                  background: 'rgba(255,255,255,.18)',
                  borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid rgba(255,255,255,.35)',
                  animation: 'popIn .4s cubic-bezier(.34,1.56,.64,1) forwards',
                }}>
                  <CheckCircle size={38} color="#fff" strokeWidth={2} />
                </div>
                <h3 style={{ fontSize: '26px', fontWeight: 900, color: '#fff', letterSpacing: '-0.6px', marginBottom: '4px' }}>Driver matched!</h3>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,.8)', fontWeight: 500 }}>Your ride is confirmed and on the way</p>
              </div>
            </div>

            <div style={{ padding: '20px 22px 22px' }}>
              {driver ? (
                <div style={{ background: '#F9FAFB', border: `1px solid ${T.border}`, borderRadius: '16px', padding: '14px', display: 'flex', alignItems: 'center', gap: '13px', marginBottom: '14px' }}>
                  <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: 'linear-gradient(135deg,#22C55E,#15803D)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '18px', fontWeight: 900, color: '#fff' }}>
                    {driver.name?.[0] ?? '?'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: T.text }}>{driver.name}</div>
                    <div style={{ fontSize: '11.5px', color: T.textMuted, marginTop: '2px' }}>{driver.vehicle} · {driver.plate}</div>
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
                  <div style={{ fontSize: '12px', color: T.textMuted }}>{fareData?.rideLabel ?? fareData?.rideType ?? 'Ride'} · {miles} mi</div>
                </div>
                <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: '22px', fontWeight: 700, color: T.accent }}>${total}</div>
              </div>

              <button className="cta-btn" onClick={handleClose} style={{ width: '100%' }}>
                Track My Ride
              </button>
            </div>
          </>
        )}

        {/* ════════════════════════════════════════════ */}
        {/* TIMEOUT                                      */}
        {/* ════════════════════════════════════════════ */}
        {status === 'timeout' && (
          <div style={{ padding: '36px 24px 26px', textAlign: 'center' }}>
            <div style={{ width: '76px', height: '76px', margin: '0 auto 18px', background: '#FEF2F2', border: '2px solid #FECACA', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={32} color="#EF4444" />
            </div>
            <h3 style={{ fontSize: '22px', fontWeight: 900, color: T.text, marginBottom: '8px', letterSpacing: '-0.4px' }}>No drivers found</h3>
            <p style={{ fontSize: '13.5px', color: T.textMuted, fontWeight: 500, marginBottom: '26px', lineHeight: 1.65 }}>
              We couldn't find a driver in your area within 7 minutes.
              <br />Your ride has not been charged.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {onRetry && (
                <button className="cta-btn" onClick={handleRetry} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <RotateCcw size={15} /> Try Again
                </button>
              )}
              <button onClick={handleClose} style={{ width: '100%', padding: '13px', borderRadius: '14px', border: `1.5px solid ${T.border}`, background: '#fff', fontSize: '14px', fontWeight: 700, color: T.textMuted, cursor: 'pointer' }}>
                Cancel
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
          @keyframes popIn {
            0%   { transform: scale(0.4); opacity: 0; }
            100% { transform: scale(1);   opacity: 1; }
          }
        `}</style>
      </div>
    </div>
  );
}
