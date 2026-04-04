import React, { useState, useEffect } from 'react';
import { Route } from 'lucide-react';


import { THEME as T } from '@/App/UaTob/pricing.js';
import CSS from '@/App/UaTob/styles.js';
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
import { useActiveRides } from '@/App/UaTob/useActiveRides';

// ── Status buckets ─────────────────────────────────────────
const SEARCHING_STATUSES = ['searching_driver'];
const TRACKING_STATUSES  = ['driver_assigned', 'driver_arriving', 'arrived', 'in_progress'];
const DONE_STATUSES      = ['completed', 'cancelled'];

// ── localStorage helpers ───────────────────────────────────
const LS_KEY = 'uatob_session';

function saveSession(data) { try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch (_) {} }
function loadSession()     { try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : null; } catch (_) { return null; } }
function clearSession()    { try { localStorage.removeItem(LS_KEY); } catch (_) {} }

export default function UaTobApp({ uid }) {

  const { uid: authUid } = useAuthContext();

  const resolvedUid = authUid ?? uid;
  const { rides, loading: ridesLoading } = useUserRides(resolvedUid);
  const { active, loading } = useActiveRides(resolvedUid);

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

  // ── Mount animation ────────────────────────────────────
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ── Persist session ────────────────────────────────────
  useEffect(() => {
    if (bookingPayload) {
      saveSession({ bookingPayload, pickupCoords, dropoffCoords, showPayment, selectedPayment });
    } else {
      clearSession();
    }
  }, [bookingPayload, pickupCoords, dropoffCoords, showPayment, selectedPayment]);

  // ── Derive ride state ──────────────────────────────────
  // isSearching / isTracking → from active (real-time listener hook)
  const activeRide  = active?.find(
    (r) => r.paymentStatus === 'succeeded' && !DONE_STATUSES.includes(r.status)
  ) ?? null;

  const activeTrackingRide = activeRide;

  const isSearching = !!activeRide && SEARCHING_STATUSES.includes(activeRide.status);
  const isTracking  = !!activeTrackingRide && TRACKING_STATUSES.includes(activeTrackingRide.status);

  // ── Close payment modal once ride appears in Firestore ─
  useEffect(() => {
    if (activeRide) setShowPayment(false);
  }, [activeRide]);

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

      if (authMode === 'signup') {
        const user = authResult.result?.user ?? authResult.user;
        if (!user?.uid) throw new Error('Sign-up succeeded but UID is missing — cannot create account.');
        await fetch('https://createaccount-ady2s2xhhq-uc.a.run.app', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: user.uid, email: user.email, name }),
        });
      }

      setShowAuth(false);
      setShowPayment(true);
    } catch (err) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  // ── Live payload sync ──────────────────────────────────
  const handlePayloadChange = (payload) => {
    if (!payload) return;
    setBookingPayload(prev => ({ ...prev, ...payload }));
  };

  // ── Book Now ───────────────────────────────────────────
  const handleBookNow = (payload) => {
    if (!payload) return;
    const finalPayload = { ...bookingPayload, ...payload };
    setBookingPayload(finalPayload);
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
  };

  // ── Payment success ────────────────────────────────────
  const handlePaymentSuccess = () => {
    setShowPayment(false);
  };

  // ── Reset helpers ──────────────────────────────────────
  const resetRide = () => {
    setBookingPayload(null);
    setPickupCoords(null);
    setDropoffCoords(null);
    clearSession();
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

        {/* Hero — only when fully idle */}
        {!activeRide && !bookingPayload && (
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

        {/* Map — hidden when LiveTrackingPanel is showing (it has its own) */}
        {!isTracking && (
          <div style={{ marginBottom: '14px', animation: mounted ? 'slideUp .65s ease-out .12s forwards' : 'none', opacity: 0 }}>
            <MapView bookingPayload={bookingPayload} />
          </div>
        )}

        {/* Main panel */}
        <div style={{ animation: mounted ? 'slideUp .65s ease-out .18s forwards' : 'none', opacity: 0 }}>
          {isTracking ? (
            <LiveTrackingPanel
              active={active}
              onRideDone={resetRide}
            />
          ) : (
            <BookingPanel
              onBookNow={handleBookNow}
              onPayloadChange={handlePayloadChange}
            />
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
          uid={authUid}
          bookingPayload={bookingPayload}
          selectedPayment={selectedPayment}
          setSelectedPayment={setSelectedPayment}
          onSuccess={handlePaymentSuccess}
          onClose={() => setShowPayment(false)}
        />
      )}

      {/* ── Confirmation Modal — fires when status = searching_driver ── */}
      {isSearching && (
        <ConfirmationModal
          rides={rides}
          ridesLoading={ridesLoading}
          onClose={() => {}}
          onPaymentCancelled={resetRide}
          onRetry={resetRide}
        />
      )}
    </div>
  );
}