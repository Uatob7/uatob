// src/App/ConfirmationModal.jsx
import React, { useState, useEffect } from 'react';
import { Clock, MapPin, Navigation, Car, X } from 'lucide-react';
import { THEME as T } from '@/App/pricing.js';

export default function ConfirmationModal({ rideId, fareData, tripData, onClose }) {
  const SEARCH_LIMIT_SEC = 7 * 60; // 7 minutes

  const [secondsLeft, setSecondsLeft] = useState(SEARCH_LIMIT_SEC);
  const [status,      setStatus]      = useState('searching'); // 'searching' | 'timeout'

  // ── Countdown timer ──────────────────────────────────
  useEffect(() => {
    if (status !== 'searching') return;

    const interval = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(interval);
          setStatus('timeout');
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  // ── Poll Firestore for driver assignment ─────────────
  // When a driver is assigned, status field on the Ride doc
  // will change from 'searching_driver' → 'driver_assigned'.
  // This polls every 4s and closes the modal when matched.
  useEffect(() => {
    if (!rideId || status !== 'searching') return;

    const interval = setInterval(async () => {
      try {
        // Dynamic import so this file doesn't require firebase config at module level
        const { getFirestore, doc, getDoc } = await import('firebase/firestore');
        const db   = getFirestore();
        const snap = await getDoc(doc(db, 'Rides', rideId));

        if (snap.exists() && snap.data().status === 'driver_assigned') {
          clearInterval(interval);
          setStatus('assigned');
        }
      } catch (err) {
        console.warn('[ConfirmationModal] Poll error:', err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [rideId, status]);

  // ── Derived display ───────────────────────────────────
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const progress = ((SEARCH_LIMIT_SEC - secondsLeft) / SEARCH_LIMIT_SEC) * 100;

  const total = Number(fareData?.total ?? fareData?.fareEstimate ?? 0).toFixed(2);
  const miles = fareData?.tripDistanceMiles ?? tripData?.actualMiles ?? 0;
  const pickup  = fareData?.pickup  ?? '—';
  const dropoff = fareData?.dropoff ?? '—';

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,.5)',
        backdropFilter: 'blur(8px)',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        zIndex: 999, padding: '20px',
      }}
    >
      <div
        style={{
          maxWidth: '400px', width: '100%',
          background: 'linear-gradient(180deg,#fff 0%,#FAFAFA 100%)',
          borderRadius: '28px',
          padding: '32px 28px 28px',
          boxShadow: '0 24px 80px rgba(0,0,0,.18)',
          border: '1px solid rgba(229,231,235,.9)',
          position: 'relative',
          textAlign: 'center',
        }}
      >
        {/* Close */}
        {onClose && (
          <button
            onClick={onClose}
            style={{ position: 'absolute', top: '18px', right: '18px', width: '36px', height: '36px', borderRadius: '10px', border: 'none', background: '#F3F4F6', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={16} color={T.textMuted} />
          </button>
        )}

        {/* ── SEARCHING STATE ────────────────────────── */}
        {status === 'searching' && (
          <>
            {/* Animated radar */}
            <div style={{ position: 'relative', width: '88px', height: '88px', margin: '0 auto 24px' }}>
              {/* Pulse rings */}
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  style={{
                    position: 'absolute', inset: 0,
                    borderRadius: '50%',
                    border: '2px solid rgba(22,163,74,.3)',
                    animation: `radarRing 2s ease-out ${i * 0.65}s infinite`,
                  }}
                />
              ))}
              {/* Center icon */}
              <div style={{
                position: 'absolute', inset: '16px',
                background: 'linear-gradient(135deg,#22C55E,#15803D)',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(22,163,74,.35)',
              }}>
                <Car size={22} color="#fff" />
              </div>
            </div>

            <h3 style={{ fontSize: '24px', fontWeight: 900, color: T.text, letterSpacing: '-0.6px', marginBottom: '8px' }}>
              Searching for driver
            </h3>
            <p style={{ fontSize: '13.5px', color: T.textMuted, fontWeight: 500, marginBottom: '28px', lineHeight: 1.6 }}>
              Finding the nearest driver for your ride.
              <br />We'll match you within 7 minutes.
            </p>

            {/* Countdown */}
            <div style={{ background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: '20px', padding: '20px', marginBottom: '16px' }}>
              <div className="lbl" style={{ marginBottom: '10px' }}>Time remaining</div>
              <div style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: '52px', fontWeight: 700, color: T.accent, letterSpacing: '-3px', lineHeight: 1 }}>
                {String(minutes).padStart(2,'0')}
                <span style={{ fontSize: '28px', opacity: .5 }}>:</span>
                {String(seconds).padStart(2,'0')}
              </div>

              {/* Progress bar */}
              <div style={{ height: '6px', background: T.border, borderRadius: '100px', marginTop: '16px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: progress > 80
                    ? 'linear-gradient(90deg,#F59E0B,#DC2626)'
                    : 'linear-gradient(90deg,#22C55E,#16A34A)',
                  borderRadius: '100px',
                  transition: 'width 1s linear, background .5s ease',
                }} />
              </div>
            </div>

            {/* Route summary */}
            <div style={{ background: '#fff', border: `1px solid ${T.border}`, borderRadius: '16px', padding: '14px 16px', marginBottom: '14px', textAlign: 'left' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', paddingTop: '3px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: T.ink, flexShrink: 0 }} />
                  <div style={{ width: '1px', flex: 1, background: T.border, minHeight: '18px' }} />
                  <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: T.accent, transform: 'rotate(45deg)', flexShrink: 0 }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: T.text, marginBottom: '10px' }}>{pickup}</div>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: T.text }}>{dropoff}</div>
                </div>
              </div>
            </div>

            {/* Fare chip */}
            <div style={{ background: '#F0FDF4', border: `1px solid ${T.accentBorder}`, borderRadius: '12px', padding: '11px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: T.textMid }}>
                Fare · {miles} mi
              </span>
              <span style={{ fontFamily: '"JetBrains Mono",monospace', fontSize: '16px', fontWeight: 700, color: T.accent }}>
                ${total}
              </span>
            </div>
          </>
        )}

        {/* ── TIMEOUT STATE ──────────────────────────── */}
        {status === 'timeout' && (
          <>
            <div style={{ width: '72px', height: '72px', margin: '0 auto 20px', background: '#FEF2F2', border: '2px solid #FECACA', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={32} color="#DC2626" />
            </div>
            <h3 style={{ fontSize: '22px', fontWeight: 900, color: T.text, marginBottom: '8px' }}>No drivers nearby</h3>
            <p style={{ fontSize: '13.5px', color: T.textMuted, fontWeight: 500, marginBottom: '24px', lineHeight: 1.6 }}>
              We couldn't find a driver within 7 minutes.
              <br />Please try again in a moment.
            </p>
            <button
              className="cta-btn"
              onClick={onClose}
              style={{ width: '100%' }}
            >
              Try Again
            </button>
          </>
        )}

        {/* ── ASSIGNED STATE (Firestore confirmed) ───── */}
        {status === 'assigned' && (
          <>
            <div style={{ width: '72px', height: '72px', margin: '0 auto 20px', background: 'linear-gradient(135deg,#22C55E,#15803D)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 36px rgba(22,163,74,.35)' }}>
              <Car size={32} color="#fff" />
            </div>
            <h3 style={{ fontSize: '24px', fontWeight: 900, color: T.text, marginBottom: '8px' }}>Driver assigned!</h3>
            <p style={{ fontSize: '13.5px', color: T.textMuted, marginBottom: '20px' }}>Your driver is on the way.</p>
            <button className="cta-btn" onClick={onClose} style={{ width: '100%' }}>
              Track My Ride
            </button>
          </>
        )}

        {/* Radar ring keyframes */}
        <style>{`
          @keyframes radarRing {
            0%   { transform: scale(0.6); opacity: .7; }
            100% { transform: scale(1.6); opacity: 0; }
          }
        `}</style>
      </div>
    </div>
  );
}