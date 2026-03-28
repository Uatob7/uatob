import React, { useState, useEffect } from 'react';
import { Route } from 'lucide-react';

// Constants
import { THEME as T } from '@/App/pricing.js';
import CSS from '@/App/styles.js';

// Hooks
import { useRideTracking } from '@/App/useRideTracking.js';

// Components
import { UaTobWordmark } from '@/App/Brand.jsx';
import MapView from '@/App/MapView.jsx';
import BookingPanel from '@/App/BookingPanel.jsx';
import LiveTrackingPanel from '@/App/LiveTrackingPanel.jsx';
import AuthModal from '@/App/AuthModal.jsx';
import PaymentModal from '@/App/PaymentModal.jsx';
import ConfirmationModal from '@/App/ConfirmationModal.jsx';

export default function UaTobApp(uid) {
  console.log(uid)
  // ── Trip / Booking state ───────────────────────────────
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [pickupCoords, setPickupCoords] = useState(null);
  const [dropoffCoords, setDropoffCoords] = useState(null);

  const [selectedRide, setSelectedRide] = useState('standard');
  const [fareData, setFareData] = useState(null);
  const [tripData, setTripData] = useState(null);
  const [surgeMultiplier, setSurgeMultiplier] = useState(1);
  const [showBreakdown, setShowBreakdown] = useState(false);

  // ── Auth ───────────────────────────────────────────────
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  // ── Payment ────────────────────────────────────────────
  const [showPayment, setShowPayment] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState('card');

  // ── Mount animation ────────────────────────────────────
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // ── Ride tracking ──────────────────────────────────────
  const tracking = useRideTracking({
    pickupCoords,
    dropoffCoords,
    selectedRide,
    fareData,
    onComplete: () => {
      setPickup('');
      setDropoff('');
      setPickupCoords(null);
      setDropoffCoords(null);
      setFareData(null);
      setTripData(null);
      setShowPayment(false);
      setShowBreakdown(false);
    },
  });

  // ── Auth ───────────────────────────────────────────────
  const handleAuth = (e) => {
    e.preventDefault();
    const ok =
      authMode === 'login'
        ? (email && password)
        : (name && email && password);

    if (ok) {
      setIsLoggedIn(true);
      setShowAuth(false);
      setShowPayment(true);
    }
  };

  // ── Book Now ───────────────────────────────────────────
  const handleBookNow = (bookingPayload) => {
    if (!bookingPayload) return;

    // Sync app-level state from BookingPanel
    setPickup(bookingPayload.pickup);
    setDropoff(bookingPayload.dropoff);
    setFareData({
      total: bookingPayload.fareEstimate,
    });
    setTripData({
      actualMiles: bookingPayload.tripDistanceMiles,
      totalMin: bookingPayload.tripDurationMin,
    });
    setSurgeMultiplier(bookingPayload.surgeMultiplier || 1);

    if (isLoggedIn) {
      setShowPayment(true);
    } else {
      setShowAuth(true);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: T.bg,
        fontFamily: '"Outfit",system-ui,sans-serif',
        position: 'relative',
        overflow: 'hidden',
        color: T.text,
      }}
    >
      <style>{CSS}</style>

      {/* Ambient blobs */}
      <div
        style={{
          position: 'fixed',
          top: '-15%',
          right: '-8%',
          width: '550px',
          height: '550px',
          background: 'radial-gradient(circle,rgba(22,163,74,.05) 0%,transparent 65%)',
          borderRadius: '50%',
          animation: 'float 14s ease-in-out infinite',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: 'fixed',
          bottom: '-20%',
          left: '-12%',
          width: '700px',
          height: '700px',
          background: 'radial-gradient(circle,rgba(17,24,39,.03) 0%,transparent 65%)',
          borderRadius: '50%',
          animation: 'float 18s ease-in-out infinite reverse',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <div
        style={{
          maxWidth: '680px',
          margin: '0 auto',
          padding: '28px 20px 60px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '40px',
            animation: mounted ? 'slideUp .55s ease-out forwards' : 'none',
            opacity: 0,
          }}
        >
          <UaTobWordmark iconSize={42} />
          <div className="live-badge">
            <div
              style={{
                width: '6px',
                height: '6px',
                background: '#16A34A',
                borderRadius: '50%',
              }}
            />
            Live
          </div>
        </div>

        {/* Hero */}
        {!tracking.isTracking && !pickup && (
          <div
            style={{
              marginBottom: '32px',
              animation: mounted ? 'slideUp .65s ease-out .08s forwards' : 'none',
              opacity: 0,
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: T.accentLight,
                border: `1px solid ${T.accentBorder}`,
                borderRadius: '100px',
                padding: '5px 14px',
                fontSize: '11px',
                fontWeight: 700,
                color: T.accent,
                letterSpacing: '1px',
                textTransform: 'uppercase',
                marginBottom: '18px',
              }}
            >
              <Route size={12} />
              Distance-Based Pricing
            </div>

            <h1
              style={{
                fontSize: 'clamp(30px,6vw,52px)',
                fontWeight: 900,
                lineHeight: 1.02,
                letterSpacing: '-2px',
                marginBottom: '14px',
                color: T.text,
              }}
            >
              Your destination,
              <br />
              <span
                style={{
                  background: 'linear-gradient(135deg,#111827 0%,#16A34A 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                always waiting.
              </span>
            </h1>

            <p
              style={{
                fontSize: '15px',
                color: T.textMuted,
                fontWeight: 500,
                lineHeight: 1.65,
              }}
            >
              Fare is calculated live based on the actual
              <br />
              distance from A to B — no surprises.
            </p>
          </div>
        )}

        {/* Map */}
        <div
          style={{
            marginBottom: '14px',
            animation: mounted ? 'slideUp .65s ease-out .12s forwards' : 'none',
            opacity: 0,
          }}
        >
          <MapView
            pickup={pickup}
            dropoff={dropoff}
            pickupCoords={pickupCoords}
            dropoffCoords={dropoffCoords}
            tripData={tripData}
            fareData={fareData}
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
        <div
          style={{
            animation: mounted ? 'slideUp .65s ease-out .18s forwards' : 'none',
            opacity: 0,
          }}
        >
          {tracking.isTracking ? (
            <LiveTrackingPanel
              pickup={pickup}
              dropoff={dropoff}
              fareData={fareData}
              tripData={tripData}
              assignedDriver={tracking.assignedDriver}
              rideStatus={tracking.rideStatus}
              etaMinutes={tracking.etaMinutes}
              distToDropoff={tracking.distToDropoff}
              getProgress={tracking.getProgress}
            />
          ) : (
            <BookingPanel
              onBookNow={handleBookNow}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      {showAuth && (
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
        />
      )}

      {showPayment && (
        <PaymentModal
          fareData={fareData}
          tripData={tripData}
          selectedRide={selectedRide}
          selectedPayment={selectedPayment}
          setSelectedPayment={setSelectedPayment}
          onConfirm={tracking.initiateRide}
          onClose={() => setShowPayment(false)}
        />
      )}

      {tracking.showConfirm && (
        <ConfirmationModal
          assignedDriver={tracking.assignedDriver}
          etaMinutes={tracking.etaMinutes}
          fareData={fareData}
          tripData={tripData}
        />
      )}
    </div>
  );
}