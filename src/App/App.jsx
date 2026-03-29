// src/App/UaTobApp.jsx
import React, { useState, useEffect } from 'react';
import { Route } from 'lucide-react';


import { THEME as T } from '@/App/pricing.js';
import CSS from '@/App/styles.js';
import { useRideTracking } from '@/App/useRideTracking.js';
import { UaTobWordmark } from '@/App/Brand.jsx';
import MapView from '@/App/MapView.jsx';
import BookingPanel from '@/App/BookingPanel.jsx';
import LiveTrackingPanel from '@/App/LiveTrackingPanel.jsx';
import AuthModal from '@/App/AuthModal.jsx';
import PaymentModal from '@/App/PaymentModal.jsx';
import ConfirmationModal from '@/App/ConfirmationModal.jsx';
import { useAuthContext } from '@/context/AuthContext';
import signIn from '@/firebase/auth/signin';
import signUp from '@/firebase/auth/signup';

export default function UaTobApp({ uid }) {
  console.log(uid)
  // ── Booking ────────────────────────────────────────────
  const [bookingPayload,  setBookingPayload]  = useState(null);
  const [pickupCoords,    setPickupCoords]    = useState(null);
  const [dropoffCoords,   setDropoffCoords]   = useState(null);
  const { uid: authUid } = useAuthContext();

  // ── Auth ───────────────────────────────────────────────
  const [showAuth,        setShowAuth]        = useState(false);
  const [authMode,        setAuthMode]        = useState('login');
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [name,            setName]            = useState('');
  const [authLoading,     setAuthLoading]     = useState(false);
  const [authError,       setAuthError]       = useState('');

  // ── Payment ────────────────────────────────────────────
  const [showPayment,     setShowPayment]     = useState(false);
  const [selectedPayment, setSelectedPayment] = useState('card');

  // ── Confirmation ───────────────────────────────────────
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [confirmedRideId, setConfirmedRideId] = useState(null);

  // ── Mount animation ────────────────────────────────────
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ── Ride tracking ──────────────────────────────────────
  const tracking = useRideTracking({
    pickupCoords,
    dropoffCoords,
    selectedRide: bookingPayload?.rideType ?? 'standard',
    fareData: bookingPayload
      ? {
          total:           bookingPayload.fareEstimate,
          breakdown:       bookingPayload.breakdown       || {},
          surgeMultiplier: bookingPayload.surgeMultiplier || 1,
          allQuotes:       bookingPayload.allQuotes       || {},
          rideType:        bookingPayload.rideType,
        }
      : null,
    tripData: bookingPayload
      ? {
          miles:       bookingPayload.tripDistanceMiles,
          durationMin: bookingPayload.tripDurationMin,
          pickup:      bookingPayload.pickup,
          dropoff:     bookingPayload.dropoff,
        }
      : null,
    onComplete: () => {
      setBookingPayload(null);
      setPickupCoords(null);
      setDropoffCoords(null);
      setShowPayment(false);
      setShowConfirm(false);
      setConfirmedRideId(null);
    },
  });

  // ── Auth submit ────────────────────────────────────────
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    try {
      let authResult;
      
      if (authMode === 'login') {
        authResult = await signIn(email, password);
      } else {
        authResult = await signUp(email, password);
      }

      if (authResult.error) {
        throw new Error(authResult.error.message || 'Authentication failed');
      }

      // Auth successful, close modal and proceed to booking
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

    // Check if user is authenticated
    if (authUid) {
      // User logged in, go directly to payment
      setShowPayment(true);
    } else {
      // User not logged in, show auth modal first
      setShowAuth(true);
      setAuthMode('login');
      setEmail('');
      setPassword('');
      setName('');
      setAuthError('');
    }
  };

  // ── Payment success ────────────────────────────────────
  const handlePaymentSuccess = (result) => {
    console.log('[UaTobApp] Payment success:', result);
    setShowPayment(false);
    setConfirmedRideId(result.rideId);
    setShowConfirm(true);
  };

  // ── Confirmation closed → start tracking ──────────────
  const handleConfirmClose = () => {
    setShowConfirm(false);
    setConfirmedRideId(null);
    if (pickupCoords && dropoffCoords) {
      tracking.initiateRide();
    }
  };

  // ── Retry → reset back to BookingPanel ────────────────
  const handleRetry = () => {
    setShowConfirm(false);
    setConfirmedRideId(null);
    setBookingPayload(null);
    setPickupCoords(null);
    setDropoffCoords(null);
  };

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: '"Outfit",system-ui,sans-serif', position: 'relative', overflow: 'hidden', color: T.text }}>
      <style>{CSS}</style>

      {/* Ambient blobs */}
      <div style={{ position: 'fixed', top: '-15%', right: '-8%', width: '550px', height: '550px', background: 'radial-gradient(circle,rgba(22,163,74,.05) 0%,transparent 65%)', borderRadius: '50%', animation: 'float 14s ease-in-out infinite', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: '-20%', left: '-12%', width: '700px', height: '700px', background: 'radial-gradient(circle,rgba(17,24,39,.03) 0%,transparent 65%)', borderRadius: '50%', animation: 'float 18s ease-in-out infinite reverse', pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '28px 20px 60px', position: 'relative', zIndex: 1 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '40px', animation: mounted ? 'slideUp .55s ease-out forwards' : 'none', opacity: 0 }}>
          <UaTobWordmark iconSize={42} />
          <div className="live-badge">
            <div style={{ width: '6px', height: '6px', background: '#16A34A', borderRadius: '50%' }} />
            Live
          </div>
        </div>

        {/* Hero */}
        {!tracking.isTracking && !bookingPayload && (
          <div style={{ marginBottom: '32px', animation: mounted ? 'slideUp .65s ease-out .08s forwards' : 'none', opacity: 0 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: T.accentLight, border: `1px solid ${T.accentBorder}`, borderRadius: '100px', padding: '5px 14px', fontSize: '11px', fontWeight: 700, color: T.accent, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '18px' }}>
              <Route size={12} />
              Distance-Based Pricing
            </div>
            <h1 style={{ fontSize: 'clamp(30px,6vw,52px)', fontWeight: 900, lineHeight: 1.02, letterSpacing: '-2px', marginBottom: '14px', color: T.text }}>
              Your destination,
              <br />
              <span style={{ background: 'linear-gradient(135deg,#111827 0%,#16A34A 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                always waiting.
              </span>
            </h1>
            <p style={{ fontSize: '15px', color: T.textMuted, fontWeight: 500, lineHeight: 1.65 }}>
              Fare is calculated live based on the actual
              <br />distance from A to B — no surprises.
            </p>
          </div>
        )}

        {/* Map */}
        <div style={{ marginBottom: '14px', animation: mounted ? 'slideUp .65s ease-out .12s forwards' : 'none', opacity: 0 }}>
          <MapView
            pickup={bookingPayload?.pickup ?? ''}
            dropoff={bookingPayload?.dropoff ?? ''}
            pickupCoords={pickupCoords}
            dropoffCoords={dropoffCoords}
            tripData={bookingPayload ? { miles: bookingPayload.tripDistanceMiles, durationMin: bookingPayload.tripDurationMin } : null}
            fareData={bookingPayload ? { total: bookingPayload.fareEstimate, surgeMultiplier: bookingPayload.surgeMultiplier || 1 } : null}
            isTracking={tracking.isTracking}
            driverPos={tracking.driverPos}
            rideStatus={tracking.rideStatus}
            assignedDriver={tracking.assignedDriver}
            etaMinutes={tracking.etaMinutes}
            distToDropoff={tracking.distToDropoff}
            getStatusMsg={tracking.getStatusMsg}
          />
        </div>

        {/* Main panel */}
        <div style={{ animation: mounted ? 'slideUp .65s ease-out .18s forwards' : 'none', opacity: 0 }}>
          {tracking.isTracking ? (
            <LiveTrackingPanel
              pickup={bookingPayload?.pickup ?? ''}
              dropoff={bookingPayload?.dropoff ?? ''}
              fareData={bookingPayload ? { total: bookingPayload.fareEstimate, breakdown: bookingPayload.breakdown || {}, surgeMultiplier: bookingPayload.surgeMultiplier || 1 } : null}
              tripData={bookingPayload ? { miles: bookingPayload.tripDistanceMiles, durationMin: bookingPayload.tripDurationMin } : null}
              assignedDriver={tracking.assignedDriver}
              rideStatus={tracking.rideStatus}
              etaMinutes={tracking.etaMinutes}
              distToDropoff={tracking.distToDropoff}
              getProgress={tracking.getProgress}
            />
          ) : (
            <BookingPanel onBookNow={handleBookNow} />
          )}
        </div>
      </div>

      {/* ── Auth Modal ───────────────────────────────────── */}
      {showAuth && !authUid && (
        <AuthModal
          authMode={authMode}
          setAuthMode={setAuthMode}
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          name={name}
          setName={setName}
          onSubmit={handleAuth}
          onClose={() => setShowAuth(false)}
          loading={authLoading}
          error={authError}
        />
      )}

      {/* ── Payment Modal ────────────────────────────────── */}
      {showPayment && bookingPayload && (
        <PaymentModal
          bookingPayload={bookingPayload}
          selectedPayment={selectedPayment}
          setSelectedPayment={setSelectedPayment}
          onSuccess={handlePaymentSuccess}
          onClose={() => setShowPayment(false)}
        />
      )}

      {/* ── Confirmation Modal ───────────────────────────── */}
      {showConfirm && (
        <ConfirmationModal
          rideId={confirmedRideId}
          fareData={bookingPayload}
          onClose={handleConfirmClose}
          onRetry={handleRetry}
        />
      )}
    </div>
  );
}
