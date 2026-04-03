// src/App/UaTobApp.jsx
import React, { useState, useEffect } from 'react';
import { Route } from 'lucide-react';


import { THEME as T } from '@/App/UaTob/pricing.js';
import CSS from '@/App/UaTob/styles.js';
import { useRideTracking } from '@/App/UaTob/useRideTracking.js';
import { UaTobWordmark } from '@/App/UaTob/Brand.jsx';
import MapView from '@/App/UaTob/MapView.jsx';
import BookingPanel from '@/App/UaTob/BookingPanel.jsx';
import LiveTrackingPanel from '@/App/UaTob/LiveTrackingPanel.jsx';
import AuthModal from '@/App/UaTob/AuthModal.jsx';
import PaymentModal from '@/App/UaTob/PaymentModal.jsx';
import ConfirmationModal from '@/App/UaTob/ConfirmationModal.jsx';
import { useAuthContext } from '@/context/AuthContext';
import signIn from '@/firebase/auth/signin';
import signUp from '@/firebase/auth/signup';
import { useUserRides } from '@/App/UaTob/useUserRides';

// ── localStorage helpers ───────────────────────────────
const LS_KEY = 'uatob_session';

function saveSession(data)  { try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch (_) {} }
function loadSession()      { try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : null; } catch (_) { return null; } }
function clearSession()     { try { localStorage.removeItem(LS_KEY); } catch (_) {} }

export default function UaTobApp({ uid }) {

  console.log(uid);
  const { uid: authUid } = useAuthContext();
  const { rides, loading: ridesLoading } = useUserRides(authUid ?? uid);

  // ── Restore session from localStorage ─────────────────
  const saved = loadSession();

  // ── Booking ────────────────────────────────────────────
  const [bookingPayload,  setBookingPayload]  = useState(saved?.bookingPayload  ?? null);
  const [pickupCoords,    setPickupCoords]    = useState(saved?.pickupCoords    ?? null);
  const [dropoffCoords,   setDropoffCoords]   = useState(saved?.dropoffCoords   ?? null);

  // ── Auth ───────────────────────────────────────────────
  const [showAuth,        setShowAuth]        = useState(false);
  const [authMode,        setAuthMode]        = useState('login');
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [name,            setName]            = useState('');
  const [authLoading,     setAuthLoading]     = useState(false);
  const [authError,       setAuthError]       = useState('');

  // ── Payment ────────────────────────────────────────────
  const [showPayment,     setShowPayment]     = useState(saved?.showPayment     ?? false);
  const [selectedPayment, setSelectedPayment] = useState(saved?.selectedPayment ?? 'card');

  // ── Confirmation ───────────────────────────────────────
  const [showConfirm,     setShowConfirm]     = useState(saved?.showConfirm     ?? false);
  const [confirmedRideId, setConfirmedRideId] = useState(saved?.confirmedRideId ?? null);

  // ── Mount animation ────────────────────────────────────
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ── Persist session whenever key state changes ─────────
  useEffect(() => {
    if (bookingPayload) {
      saveSession({ bookingPayload, pickupCoords, dropoffCoords, showPayment, selectedPayment, showConfirm, confirmedRideId });
    } else {
      clearSession();
    }
  }, [bookingPayload, pickupCoords, dropoffCoords, showPayment, selectedPayment, showConfirm, confirmedRideId]);

  // ── Ride tracking ──────────────────────────────────────
  const tracking = useRideTracking({
    pickupCoords,
    dropoffCoords,
    selectedRide: bookingPayload?.rideType ?? 'standard',
    fareData: bookingPayload
      ? { total: bookingPayload.fareEstimate, breakdown: bookingPayload.breakdown || {}, surgeMultiplier: bookingPayload.surgeMultiplier || 1, allQuotes: bookingPayload.allQuotes || {}, rideType: bookingPayload.rideType }
      : null,
    tripData: bookingPayload
      ? { miles: bookingPayload.tripDistanceMiles, durationMin: bookingPayload.tripDurationMin, pickup: bookingPayload.pickup, dropoff: bookingPayload.dropoff }
      : null,
    onComplete: () => {
      setBookingPayload(null);
      setPickupCoords(null);
      setDropoffCoords(null);
      setShowPayment(false);
      setShowConfirm(false);
      setConfirmedRideId(null);
      clearSession();
    },
  });

  // ── Reopen ConfirmationModal for unfinished rides ──────
  useEffect(() => {
    if (ridesLoading || rides.length === 0) return;
    if (showConfirm || showPayment || tracking.isTracking) return;

    const pending = rides.find(
      (r) => r.paymentStatus === 'succeeded' && r.status !== 'completed' && r.status !== 'cancelled'
    );

    if (pending) {
      setConfirmedRideId(pending.id);
      setShowConfirm(true);

      if (!bookingPayload) {
        setBookingPayload({
          pickup:            pending.pickup,
          dropoff:           pending.dropoff,
          fareEstimate:      pending.fareTotal,
          breakdown:         pending.fareBreakdown   || {},
          surgeMultiplier:   pending.surgeMultiplier || 1,
          rideType:          pending.rideType,
          rideLabel:         pending.rideLabel,
          tripDistanceMiles: pending.tripDistanceMiles,
          tripDurationMin:   pending.tripDurationMin,
          allQuotes:         {},
        });
      }
    }
  }, [ridesLoading, rides]);

  // ── Auth submit ────────────────────────────────────────
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const authResult = authMode === 'login'
        ? await signIn(email, password)
        : await signUp(email, password);

      if (authResult.error) throw new Error(authResult.error.message || 'Authentication failed');
      setShowAuth(false);
      setShowPayment(true);
    } catch (err) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  // ── Book Now ───────────────────────────────────────────
  const handleBookNow = (payload) => {
    if (!payload) return;
    setBookingPayload(payload);
    setPickupCoords({ x: -81.37, y: 28.53 });
    setDropoffCoords({ x: -81.30, y: 28.45 });

    if (authUid) {
      setShowPayment(true);
    } else {
      setShowAuth(true);
      setAuthMode('login');
      setEmail('');
      setPassword('');
      setName('');
      setAuthError('');
    }

    if (pickupCoords) {
      return {
        x: safeCoord(pickupCoords.x),
        y: safeCoord(pickupCoords.y),
      };
    }

    return { x: 50, y: 50 };
  }, [isHeadingToDropoff, dropoffCoords, pickupCoords]);

  return (
    <div
      style={{
        background: 'linear-gradient(160deg,#FCFCFD 0%,#F7F8FA 45%,#F3F4F6 100%)',
        borderRadius: '30px',
        overflow: 'hidden',
        position: 'relative',
        border: '1px solid rgba(255,255,255,.65)',
        height: isTracking ? '320px' : 'clamp(220px,36vh,280px)',
        boxShadow:
          '0 20px 60px rgba(0,0,0,.08), inset 0 1px 0 rgba(255,255,255,.75)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Ambient depth */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 20% 15%, rgba(22,163,74,.06) 0%, transparent 30%), radial-gradient(circle at 85% 80%, rgba(37,99,235,.05) 0%, transparent 28%)',
          pointerEvents: 'none',
        }}
      />

      {/* Street grid */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0.08,
        }}
      >
        <defs>
          <pattern id="road-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path d="M48 0 L0 0 0 48" fill="none" stroke="#111827" strokeWidth="1" />
          </pattern>
          <pattern id="mini-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M24 0 L0 0 0 24" fill="none" stroke="#9CA3AF" strokeWidth=".5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#mini-grid)" />
        <rect width="100%" height="100%" fill="url(#road-grid)" />
      </svg>

      {/* Fake roads */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0.18,
          pointerEvents: 'none',
        }}
      >
        <path
          d="M 0 75 C 20 70, 35 82, 55 76 S 90 62, 120 72 S 170 92, 220 82 S 290 52, 360 68"
          fill="none"
          stroke="#D1D5DB"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M 40 0 C 52 30, 65 60, 58 95 S 50 160, 72 220 S 120 290, 140 360"
          fill="none"
          stroke="#E5E7EB"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M 250 0 C 240 40, 230 90, 245 130 S 285 210, 270 320"
          fill="none"
          stroke="#E5E7EB"
          strokeWidth="10"
          strokeLinecap="round"
        />
      </svg>

      {/* Static route line */}
      {pickupCoords && dropoffCoords && !isTracking && (
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        >
          <defs>
            <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#111827" stopOpacity=".55" />
              <stop offset="100%" stopColor="#16A34A" stopOpacity=".95" />
            </linearGradient>
          </defs>

          <line
            x1={`${safeCoord(pickupCoords.x)}%`}
            y1={`${safeCoord(pickupCoords.y)}%`}
            x2={`${safeCoord(dropoffCoords.x)}%`}
            y2={`${safeCoord(dropoffCoords.y)}%`}
            stroke="url(#routeGrad)"
            strokeWidth="4"
            strokeDasharray="10 8"
            strokeLinecap="round"
            opacity=".85"
          />
        </svg>
      )}

      {/* Tracking route */}
      {isTracking && driverPos && assignedDriver && (
        <>
          <svg
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
          >
            <defs>
              <linearGradient id="driverRouteGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={driverColor} stopOpacity=".95" />
                <stop offset="100%" stopColor={driverColor} stopOpacity=".35" />
              </linearGradient>
            </defs>

            <line
              x1={`${safeCoord(driverPos.x)}%`}
              y1={`${safeCoord(driverPos.y)}%`}
              x2={`${routeTarget.x}%`}
              y2={`${routeTarget.y}%`}
              stroke="url(#driverRouteGrad)"
              strokeWidth="4"
              strokeDasharray="10 8"
              strokeLinecap="round"
            />
          </svg>

          {/* Pickup pin */}
          {pickupCoords && (
            <div
              style={{
                position: 'absolute',
                left: `${safeCoord(pickupCoords.x)}%`,
                top: `${safeCoord(pickupCoords.y)}%`,
                transform: 'translate(-50%,-50%)',
                zIndex: 3,
              }}
            >
              {isWaitingForPickup && (
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%,-50%)',
                    width: '74px',
                    height: '74px',
                    borderRadius: '999px',
                    background: 'rgba(17,24,39,.10)',
                    animation: 'ripple 2s ease-out infinite',
                  }}
                />
              )}

              <div
                style={{
                  width: '42px',
                  height: '42px',
                  background: 'linear-gradient(145deg,#111827,#374151)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '3px solid #fff',
                  boxShadow: '0 10px 28px rgba(0,0,0,.22)',
                }}
              >
                <MapPin size={17} color="#16A34A" />
              </div>
            </div>
          )}

          {/* Dropoff pin */}
          {dropoffCoords && (
            <div
              style={{
                position: 'absolute',
                left: `${safeCoord(dropoffCoords.x)}%`,
                top: `${safeCoord(dropoffCoords.y)}%`,
                transform: 'translate(-50%,-50%)',
                zIndex: 3,
              }}
            >
              {isOnTrip && (
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%,-50%)',
                    width: '70px',
                    height: '70px',
                    borderRadius: '999px',
                    background: 'rgba(22,163,74,.16)',
                    animation: 'ripple 2s ease-out infinite',
                  }}
                />
              )}

              <div
                style={{
                  width: '38px',
                  height: '38px',
                  background: 'linear-gradient(145deg,#16A34A,#22C55E)',
                  borderRadius: '50% 50% 50% 6px',
                  transform: 'rotate(-45deg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '3px solid #fff',
                  boxShadow: '0 10px 28px rgba(22,163,74,.32)',
                }}
              >
                <Navigation size={14} color="#fff" style={{ transform: 'rotate(45deg)' }} />
              </div>
            </div>
          )}

          {/* Driver vehicle */}
          <div
            style={{
              position: 'absolute',
              left: `${safeCoord(driverPos.x)}%`,
              top: `${safeCoord(driverPos.y)}%`,
              transform: 'translate(-50%,-50%)',
              transition: 'all 5s linear',
              zIndex: 5,
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: '-10px',
                borderRadius: '999px',
                background: `${driverColor}22`,
                filter: 'blur(10px)',
              }}
            />

            <div
              style={{
                width: '50px',
                height: '50px',
                background: `linear-gradient(145deg, ${driverColor}, ${driverColor}dd)`,
                borderRadius: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '3px solid #fff',
                boxShadow: `0 14px 30px ${driverColor}40`,
                animation: 'pulse 2s ease-in-out infinite',
                position: 'relative',
              }}
            >
              <Car size={22} color="#fff" />
            </div>
          </div>

          {/* Bottom live status */}
          <div
            style={{
              position: 'absolute',
              bottom: '16px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(255,255,255,.92)',
              backdropFilter: 'blur(18px)',
              border: '1px solid rgba(229,231,235,.9)',
              borderRadius: '999px',
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              whiteSpace: 'nowrap',
              boxShadow: '0 12px 30px rgba(0,0,0,.10)',
              maxWidth: '92%',
              overflow: 'hidden',
              zIndex: 6,
            }}
          >
            <div
              style={{
                width: '9px',
                height: '9px',
                background: driverColor,
                borderRadius: '999px',
                animation: 'pulse 1.6s ease-in-out infinite',
                flexShrink: 0,
              }}
            />

            <span
              style={{
                fontSize: '14px',
                fontWeight: 800,
                color: '#111827',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {getStatusMsg()}
            </span>

            {isWaitingForPickup && (
              <span
                style={{
                  background: driverColor,
                  color: '#fff',
                  borderRadius: '999px',
                  padding: '5px 12px',
                  fontSize: '12px',
                  fontWeight: 800,
                  fontFamily: '"JetBrains Mono",monospace',
                  flexShrink: 0,
                  boxShadow: `0 6px 16px ${driverColor}35`,
                }}
              >
                {safeNum(etaMinutes) === 0 ? 'Now' : `${safeNum(etaMinutes)}m`}
              </span>
            )}

            {isOnTrip && (
              <span
                style={{
                  background: '#16A34A',
                  color: '#fff',
                  borderRadius: '999px',
                  padding: '5px 12px',
                  fontSize: '12px',
                  fontWeight: 800,
                  fontFamily: '"JetBrains Mono",monospace',
                  flexShrink: 0,
                  boxShadow: '0 6px 16px rgba(22,163,74,.35)',
                }}
              >
                {safeNum(distToDropoff).toFixed(1)} mi
              </span>
            )}
          </div>
        </>
      )}

      {/* Static pickup */}
      {!isTracking && pickupCoords && (
        <div
          style={{
            position: 'absolute',
            left: `${safeCoord(pickupCoords.x)}%`,
            top: `${safeCoord(pickupCoords.y)}%`,
            transform: 'translate(-50%,-50%)',
            zIndex: 3,
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              background: 'linear-gradient(145deg,#111827,#374151)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '3px solid #fff',
              boxShadow: '0 10px 24px rgba(0,0,0,.18)',
            }}
          >
            <MapPin size={16} color="#16A34A" />
          </div>
        </div>
      )}

      {/* Static dropoff */}
      {!isTracking && dropoffCoords && (
        <div
          style={{
            position: 'absolute',
            left: `${safeCoord(dropoffCoords.x)}%`,
            top: `${safeCoord(dropoffCoords.y)}%`,
            transform: 'translate(-50%,-50%)',
            zIndex: 3,
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              background: 'linear-gradient(145deg,#16A34A,#22C55E)',
              borderRadius: '50% 50% 50% 6px',
              transform: 'rotate(-45deg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '3px solid #fff',
              boxShadow: '0 10px 24px rgba(22,163,74,.28)',
            }}
          >
            <Navigation size={14} color="#fff" style={{ transform: 'rotate(45deg)' }} />
          </div>
        </div>
      )}

      {/* Idle nearby drivers */}
      {!isTracking &&
        safeDrivers.map((d, index) => (
          <div
            key={d.id || index}
            style={{
              position: 'absolute',
              left: `${safeCoord(d.x)}%`,
              top: `${safeCoord(d.y)}%`,
              transform: 'translate(-50%,-50%)',
              animation: 'pulse 2.4s ease-in-out infinite',
              animationDelay: `${index * 0.2}s`,
              opacity: 0.92,
            }}
          >
            <div
              style={{
                width: '20px',
                height: '20px',
                background: getDriverColor(d.type),
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #fff',
                boxShadow: `0 6px 14px ${getDriverColor(d.type)}35`,
              }}
            >
              <Car size={10} color="#fff" />
            </div>
          </div>
        ))}

      {/* Top trip summary */}
      {pickupCoords && dropoffCoords && !isTracking && tripData && (
        <div
          style={{
            position: 'absolute',
            top: '14px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(255,255,255,.92)',
            backdropFilter: 'blur(18px)',
            border: '1px solid rgba(229,231,235,.9)',
            borderRadius: '18px',
            padding: '11px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            whiteSpace: 'nowrap',
            boxShadow: '0 12px 28px rgba(0,0,0,.08)',
            animation: 'scaleIn .28s ease-out',
            maxWidth: '92%',
            overflow: 'hidden',
            zIndex: 6,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                fontSize: '13px',
                fontWeight: 800,
                color: '#111827',
                fontFamily: '"JetBrains Mono",monospace',
              }}
            >
              {miles.toFixed(1)} mi
            </span>
            <span style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 700 }}>
              ({km} km)
            </span>
          </div>

          <div style={{ width: '1px', height: '16px', background: '#E5E7EB' }} />

          <span style={{ fontSize: '12px', fontWeight: 800, color: '#111827' }}>
            {durationMin} min
          </span>

          {fareData?.total != null && (
            <>
              <div style={{ width: '1px', height: '16px', background: '#E5E7EB' }} />
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 900,
                  color: '#16A34A',
                  fontFamily: '"JetBrains Mono",monospace',
                }}
              >
                ${safeNum(fareData.total).toFixed(2)}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}