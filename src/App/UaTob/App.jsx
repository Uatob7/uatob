// src/App/UaTob/UaTobApp.jsx
import React, { useState, useEffect } from 'react';
import { Route, User, LogIn, X, Eye, EyeOff, Loader2 } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';


import { THEME as T } from '@/App/UaTob/pricing.js';
import CSS from '@/App/UaTob/styles.js';
import { EXTRA_CSS } from '@/App/UaTob/UaTobApp.css.js';
import { UaTobWordmark } from '@/App/UaTob/Brand.jsx';
import UatobView from '@/App/UaTob/UatobView.jsx';
import MapView from '@/App/UaTob/MapView.jsx';
import BookingPanel from '@/App/UaTob/BookingPanel.jsx';
import LiveTrackingPanel from '@/App/UaTob/LiveTrackingPanel.jsx';
import AuthModal from '@/App/UaTob/AuthModal.jsx';
import PaymentModal from '@/App/UaTob/PaymentModal.jsx';
import ConfirmationModal from '@/App/UaTob/ConfirmationModal.jsx';
import RiderDashboard from '@/App/UaTob/RiderDashboard.jsx';
import ReviewModal from '@/App/UaTob/ReviewModal.jsx';
import { useAuthContext } from '@/context/AuthContext';
import { firebase_app } from '@/firebase/config';
import signIn from '@/firebase/auth/signin';
import signUp from '@/firebase/auth/signup';
import { useUserRides } from '@/App/UaTob/useUserRides';
import { useActiveRides } from '@/App/UaTob/useActiveRides';
import { useUserAccount } from '@/App/UaTob/useUserAccount';
import { useCompletedRides } from '@/App/UaTob/useCompletedRides';

// ── Callable ──────────────────────────────────────────────────────────
const functions         = getFunctions(firebase_app, 'us-east1');
const callCreateAccount = httpsCallable(functions, 'createAccount');

// ── Status buckets ────────────────────────────────────────────────────
const SEARCHING_STATUSES = ['searching_driver'];
const TRACKING_STATUSES  = ['driver_assigned', 'driver_arriving', 'arrived', 'in_progress'];
const DONE_STATUSES      = ['completed', 'cancelled'];

// ── localStorage helpers ──────────────────────────────────────────────
const LS_KEY          = 'uatob_session';
const LS_REVIEWED_KEY = 'uatob_reviewed';

function saveSession(data)  { try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch (_) {} }
function loadSession()      { try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : null; } catch (_) { return null; } }
function clearSession()     { try { localStorage.removeItem(LS_KEY); } catch (_) {} }
function loadReviewed()     { try { return JSON.parse(localStorage.getItem(LS_REVIEWED_KEY) || '[]'); } catch { return []; } }
function saveReviewed(ids)  { try { localStorage.setItem(LS_REVIEWED_KEY, JSON.stringify(ids)); } catch (_) {} }

// ── Shared terms line ─────────────────────────────────────────────────
function AuthTerms() {
  return (
    <p className="auth-terms">
      By continuing, you agree to our{' '}
      <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>
      {' '}and{' '}
      <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
    </p>
  );
}

// ── Inline Auth Modal ─────────────────────────────────────────────────
function InlineAuthModal({ onClose, onAuthSuccess }) {
  const [mode,     setMode]     = useState('login');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [name,     setName]     = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = mode === 'login'
        ? await signIn(email, password)
        : await signUp(email, password);

      if (result.error) throw new Error(result.error.message || 'Authentication failed');

      if (mode === 'signup') {
        const user = result.result?.user ?? result.user;
        if (!user?.uid) throw new Error('Sign-up succeeded but UID is missing.');
        await callCreateAccount({ uid: user.uid, email: user.email, name });
      }

      onAuthSuccess();
    } catch (err) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="auth-sheet">

        <button onClick={onClose} style={{
          position:'absolute', top:16, right:16,
          width:32, height:32, borderRadius:'50%',
          background:'#F3F4F6', border:'none', cursor:'pointer',
          display:'flex', alignItems:'center', justifyContent:'center',
          color:'#6B7280',
        }}>
          <X size={16} />
        </button>

        <div style={{ marginBottom:22 }}>
          <div style={{ fontSize:22, fontWeight:900, letterSpacing:'-0.5px', color:'#111827', marginBottom:4 }}>
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </div>
          <div style={{ fontSize:13, color:'#6B7280', fontWeight:500 }}>
            {mode === 'login'
              ? 'Sign in to book a ride with UaTob.'
              : 'Join UaTob and get your first ride.'}
          </div>
        </div>

        <div className="mode-pill-row">
          <button className={`mode-pill ${mode === 'login'  ? 'active' : ''}`} onClick={() => { setMode('login');  setError(''); }}>Sign In</button>
          <button className={`mode-pill ${mode === 'signup' ? 'active' : ''}`} onClick={() => { setMode('signup'); setError(''); }}>Sign Up</button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div className="auth-input-wrap">
              <input className="auth-input" type="text" placeholder="Full name"
                value={name} onChange={e => setName(e.target.value)} required autoComplete="name" />
            </div>
          )}

          <div className="auth-input-wrap">
            <input className="auth-input" type="email" placeholder="Email address"
              value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
          </div>

          <div className="auth-input-wrap">
            <input
              className="auth-input has-toggle"
              type={showPw ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            <button type="button" className="auth-eye-btn" onClick={() => setShowPw(p => !p)}>
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading
              ? <Loader2 size={16} style={{ animation:'spinAnim 1s linear infinite' }} />
              : mode === 'login' ? 'Sign In' : 'Create Account'
            }
          </button>
        </form>

        <AuthTerms />

        <div style={{ textAlign:'center', marginTop:10, fontSize:13, color:'#6B7280' }}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button className="auth-toggle-link"
            onClick={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setError(''); }}>
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </div>

      </div>
    </div>
  );
}

// ── Footer ────────────────────────────────────────────────────────────
function UaTobFooter({ onBookRideClick }) {
  return (
    <footer className="uatob-footer">
      <div className="footer-grid">

        <div className="footer-brand-col">
          <UaTobWordmark iconSize={34} />
          <p className="footer-brand-blurb">
            Distance-based ride pricing built for Orlando.
            <br />Fair fares for riders, better earnings for drivers.
          </p>
          <div className="footer-orlando-badge">
            <svg width="9" height="11" viewBox="0 0 10 13" fill="none">
              <path d="M5 0C2.239 0 0 2.239 0 5c0 3.75 5 8 5 8s5-4.25 5-8c0-2.761-2.239-5-5-5zm0 7a2 2 0 110-4 2 2 0 010 4z" fill="#16A34A"/>
            </svg>
            Orlando, FL
          </div>
          <div style={{ marginTop:14 }}>
            <a className="footer-driver-cta" href="https://uatob.com/driver/signup" target="_blank" rel="noopener noreferrer">
              <Route size={12} />
              Drive with UaTob
            </a>
          </div>
        </div>

        <div>
          <div className="footer-col-heading">Ride</div>
          <button className="footer-link" onClick={onBookRideClick}>Book a Ride</button>
          <a className="footer-link" href="/pricing">Pricing</a>
          <a className="footer-link" href="/safety">Safety</a>
          <a className="footer-link" href="/faq">FAQ</a>
        </div>

        <div>
          <div className="footer-col-heading">Company</div>
          <a className="footer-link" href="/about">About</a>
          <a className="footer-link" href="/blog">Blog</a>
          <a className="footer-link" href="/careers">Careers</a>
          <a className="footer-link" href="mailto:support@uatob.com">Support</a>
        </div>

      </div>

      <div className="footer-divider" />

      <div className="footer-bottom">
        <div>
          <div className="footer-legal">
            © {new Date().getFullYear()} UaTob · All rights reserved
          </div>
          <div className="footer-legal-links">
            <a className="footer-legal-link" href="/privacy">Privacy Policy</a>
            <a className="footer-legal-link" href="/terms">Terms of Service</a>
            <a className="footer-legal-link" href="/accessibility">Accessibility</a>
          </div>
        </div>

        <div className="footer-socials">
          <a className="footer-social-btn" href="https://instagram.com/uatob" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
              <circle cx="12" cy="12" r="4"/>
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
            </svg>
          </a>
          <a className="footer-social-btn" href="https://twitter.com/uatob" target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
            </svg>
          </a>
          <a className="footer-social-btn" href="https://facebook.com/uatob" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
            <svg width="13" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.413c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.97h-1.513c-1.491 0-1.956.93-1.956 1.883v2.269h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
            </svg>
          </a>
          <a className="footer-social-btn" href="https://tiktok.com/@uatob" target="_blank" rel="noopener noreferrer" aria-label="TikTok">
            <svg width="13" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.3 6.3 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.19 8.19 0 004.79 1.53V6.75a4.85 4.85 0 01-1.02-.06z"/>
            </svg>
          </a>
        </div>
      </div>
    </footer>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────
export default function UaTobApp({ uid }) {
  const { uid: authUid } = useAuthContext();
  const resolvedUid = authUid ?? uid;

  // ── Data hooks ────────────────────────────────────────────────────
  const { completedRides }               = useCompletedRides(resolvedUid);
  const { rides, loading: ridesLoading } = useUserRides(resolvedUid);
  const { active }                       = useActiveRides(resolvedUid);
  const { account }                      = useUserAccount(resolvedUid);

  const saved = loadSession();

  // ── Booking state ─────────────────────────────────────────────────
  const [bookingPayload,  setBookingPayload]  = useState(saved?.bookingPayload  ?? null);


  const [pickupCoords,    setPickupCoords]    = useState(saved?.pickupCoords    ?? null);
  const [dropoffCoords,   setDropoffCoords]   = useState(saved?.dropoffCoords   ?? null);

  // ── UI state ──────────────────────────────────────────────────────
  const [showPayment,     setShowPayment]     = useState(saved?.showPayment     ?? false);
  const [selectedPayment, setSelectedPayment] = useState(saved?.selectedPayment ?? 'card');
  const [mounted,         setMounted]         = useState(false);
  const [showDashboard,   setShowDashboard]   = useState(false);
  const [compactMode,     setCompactMode]     = useState(saved?.compactMode     ?? false);

  // ── Auth state ────────────────────────────────────────────────────
  const [showAuthModal,   setShowAuthModal]   = useState(false);
  const [showBookingAuth, setShowBookingAuth] = useState(false);
  const [authMode,        setAuthMode]        = useState('login');
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [name,            setName]            = useState('');
  const [authLoading,     setAuthLoading]     = useState(false);
  const [authError,       setAuthError]       = useState('');

  // ── Review state ──────────────────────────────────────────────────
  const [reviewedIds,   setReviewedIds]   = useState(() => loadReviewed());
  const [reviewingRide, setReviewingRide] = useState(null);

  useEffect(() => setMounted(true), []);

  // ── Persist session ───────────────────────────────────────────────
  useEffect(() => {
    if (bookingPayload) {
      saveSession({ bookingPayload, pickupCoords, dropoffCoords, showPayment, selectedPayment, compactMode });
    } else {
      clearSession();
    }
  }, [bookingPayload, pickupCoords, dropoffCoords, showPayment, selectedPayment, compactMode]);

  // ── Derive active ride ────────────────────────────────────────────
  const activeRide = active?.find(
    r => r.paymentStatus === 'succeeded' && !DONE_STATUSES.includes(r.status)
  ) ?? null;

  const isSearching = !!activeRide && SEARCHING_STATUSES.includes(activeRide.status);
  const isTracking  = !!activeRide && TRACKING_STATUSES.includes(activeRide.status);
  const isTimeout   = !!activeRide && activeRide.status === 'timeout';

  const isCompact = compactMode && !isTracking;

  useEffect(() => {
    if (activeRide) setShowPayment(false);
  }, [activeRide]);

  // ── Auto-prompt review ────────────────────────────────────────────
  useEffect(() => {
    if (!completedRides.length || reviewingRide || isTracking || isSearching) return;
    const unreviewed = completedRides.find(r => !reviewedIds.includes(r.id));
    if (unreviewed) setReviewingRide(unreviewed);
  }, [completedRides, isTracking, isSearching]);

  const handlePriceReady = () => setCompactMode(true);

  // ── Booking-flow auth submit ──────────────────────────────────────
  const handleBookingAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const result = authMode === 'login'
        ? await signIn(email, password)
        : await signUp(email, password);

      if (result.error) throw new Error(result.error.message || 'Authentication failed');

      if (authMode === 'signup') {
        const user = result.result?.user ?? result.user;
        if (!user?.uid) throw new Error('Sign-up succeeded but UID is missing.');
        await callCreateAccount({ uid: user.uid, email: user.email, name });
      }

      setShowBookingAuth(false);
      setShowPayment(true);
    } catch (err) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  // ── Handlers ──────────────────────────────────────────────────────
  const handlePayloadChange = (payload) => {
    if (!payload) return;
    setBookingPayload(payload);
  };

  const handleBookNow = (payload) => {
    if (!payload) return;
    setBookingPayload(payload);
    setPickupCoords(
      payload.pickupLng != null && payload.pickupLat != null
        ? { x: payload.pickupLng, y: payload.pickupLat }
        : null
    );
    setDropoffCoords(
      payload.dropoffLng != null && payload.dropoffLat != null
        ? { x: payload.dropoffLng, y: payload.dropoffLat }
        : null
    );

    if (resolvedUid) {
      setShowPayment(true);
    } else {
      setShowBookingAuth(true);
      setAuthMode('login');
      setEmail(''); setPassword(''); setName(''); setAuthError('');
    }
  };

  const handlePaymentSuccess = () => setShowPayment(false);

  const resetRide = () => {
    clearSession();
    setBookingPayload(null);
    setPickupCoords(null);
    setDropoffCoords(null);
    setShowPayment(false);
    setShowBookingAuth(false);
    setCompactMode(false);
  };

  const handleReviewSubmitted = (rideId) => {
    const updated = [...reviewedIds, rideId];
    setReviewedIds(updated);
    saveReviewed(updated);
    setReviewingRide(null);
  };

  const handleReviewSkip = () => {
    if (!reviewingRide) return;
    const updated = [...reviewedIds, reviewingRide.id];
    setReviewedIds(updated);
    saveReviewed(updated);
    setReviewingRide(null);
  };

  // ── Header right ──────────────────────────────────────────────────
  const HeaderRight = () => (
    <div style={{ display:'flex', alignItems:'center' }}>
      {!resolvedUid ? (
        <button
          className="login-badge"
          onClick={() => setShowAuthModal(true)}
          aria-label="Sign in"
        >
          <LogIn size={13} />
          Login
        </button>
      ) : (
        <button
          className="account-btn"
          onClick={() => setShowDashboard(true)}
          aria-label="My account"
        >
          <User size={16} color="#fff" />
        </button>
      )}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight:'100vh', background:T.bg,
      fontFamily:'"Outfit",system-ui,sans-serif',
      position:'relative', overflow:'hidden', color:T.text,
    }}>
      <style>{CSS}</style>
      <style>{EXTRA_CSS}</style>

      {/* Ambient blobs */}
      <div style={{ position:'fixed', top:'-15%', right:'-8%', width:'550px', height:'550px', background:'radial-gradient(circle,rgba(22,163,74,.05) 0%,transparent 65%)', borderRadius:'50%', animation:'float 14s ease-in-out infinite', pointerEvents:'none', zIndex:0 }}/>
      <div style={{ position:'fixed', bottom:'-20%', left:'-12%', width:'700px', height:'700px', background:'radial-gradient(circle,rgba(17,24,39,.03) 0%,transparent 65%)', borderRadius:'50%', animation:'float 18s ease-in-out infinite reverse', pointerEvents:'none', zIndex:0 }}/>

      <div style={{ maxWidth:'680px', margin:'0 auto', padding:'28px 20px 0', position:'relative', zIndex:1 }}>

        {/* ── Header ── */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          marginBottom: isCompact ? '24px' : '40px',
          animation: mounted ? 'slideUp .55s ease-out forwards' : 'none',
          opacity:0,
        }}>
          <UaTobWordmark iconSize={42} />
          <HeaderRight />
        </div>

        {/* ── INITIAL STATE: Hero + UatobView ── */}
        {!isCompact && !isTracking && (
          <>
            {!activeRide && (
              <div style={{ marginBottom:'32px', animation: mounted ? 'slideUp .65s ease-out .08s forwards' : 'none', opacity:0 }}>
                <div style={{
                  display:'inline-flex', alignItems:'center', gap:'6px',
                  background:T.accentLight, border:`1px solid ${T.accentBorder}`,
                  borderRadius:'100px', padding:'5px 14px',
                  fontSize:'11px', fontWeight:700, color:T.accent,
                  letterSpacing:'1px', textTransform:'uppercase', marginBottom:'18px',
                }}>
                  <Route size={12} />
                  Distance-Based Pricing
                </div>
                <h1 style={{ fontSize:'clamp(30px,6vw,52px)', fontWeight:900, lineHeight:1.02, letterSpacing:'-2px', marginBottom:'14px', color:T.text }}>
                  Your destination,
                  <br />
                  <span style={{ background:'linear-gradient(135deg,#111827 0%,#16A34A 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
                    always waiting.
                  </span>
                </h1>
                <p style={{ fontSize:'15px', color:T.textMuted, fontWeight:500, lineHeight:1.65 }}>
                  Fare is calculated live based on the actual
                  <br />distance from A to B — no surprises.
                </p>
              </div>
            )}

            <div style={{ marginBottom:'36px' }}>
              <UatobView bookingPayload={null} />
            </div>
          </>
        )}

        {/* ── COMPACT STATE: MapView ── */}
        {isCompact && (
          <div style={{
            marginBottom:'16px',
            animation: mounted ? 'slideUp .45s ease-out forwards' : 'none',
            opacity:0,
          }}>
            <MapView bookingPayload={bookingPayload} />
          </div>
        )}

        {/* ── Main panel ── */}
        <div style={{ animation: mounted ? 'slideUp .65s ease-out .18s forwards' : 'none', opacity:0 }}>
          {isTracking ? (
            <LiveTrackingPanel active={active} onRideDone={resetRide} />
          ) : (
            <BookingPanel
              onBookNow={handleBookNow}
              onPayloadChange={handlePayloadChange}
              onCancel={resetRide}
              onPriceReady={handlePriceReady}
            />
          )}
        </div>

      </div>

      {/* ── Footer ── */}
      {!isCompact && !isTracking && (
        <UaTobFooter
          onBookRideClick={() => {
            if (!resolvedUid) {
              setShowAuthModal(true);
            } else {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
          }}
        />
      )}

      {/* ── Inline header auth modal ── */}
      {showAuthModal && !resolvedUid && (
        <InlineAuthModal
          onClose={() => setShowAuthModal(false)}
          onAuthSuccess={() => setShowAuthModal(false)}
        />
      )}

      {/* ── Booking-flow auth modal ── */}
      {showBookingAuth && !resolvedUid && (
        <AuthModal
          authMode={authMode}
          setAuthMode={setAuthMode}
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          name={name}
          setName={setName}
          onSubmit={handleBookingAuth}
          onClose={() => setShowBookingAuth(false)}
          loading={authLoading}
          error={authError}
        />
      )}

      {/* ── Payment modal ── */}
      {showPayment && bookingPayload && (
        <PaymentModal
          uid={resolvedUid}
          bookingPayload={bookingPayload}
          selectedPayment={selectedPayment}
          setSelectedPayment={setSelectedPayment}
          onSuccess={handlePaymentSuccess}
          onClose={resetRide}
        />
      )}

      {/* ── Confirmation modal (searching + timeout) ── */}
      {(isSearching || isTimeout) && (
        <ConfirmationModal
          rides={rides}
          ridesLoading={ridesLoading}
          onClose={resetRide}
          onPaymentCancelled={resetRide}
          onRetry={resetRide}
        />
      )}

      {/* ── Review modal ── */}
      {reviewingRide && !isTracking && !isSearching && !isTimeout && (
        <ReviewModal
          ride={reviewingRide}
          uid={resolvedUid}
          onClose={handleReviewSkip}
          onSubmitted={handleReviewSubmitted}
        />
      )}

      {/* ── Rider dashboard overlay ── */}
      {showDashboard && resolvedUid && (
        <div style={{
          position:'fixed', inset:0, zIndex:400,
          background:T.bg,
          animation:'fadeIn .22s ease',
          overflowY:'auto',
        }}>
          <div style={{
            position:'sticky', top:0, zIndex:10,
            display:'flex', justifyContent:'flex-end',
            padding:'14px 18px',
            background:'rgba(242,245,242,.94)',
            backdropFilter:'blur(12px)',
            borderBottom:'1px solid #DDE5DD',
          }}>
            <button
              onClick={() => setShowDashboard(false)}
              style={{
                display:'flex', alignItems:'center', gap:6,
                background:'#111827', color:'#fff',
                border:'none', borderRadius:100,
                padding:'7px 14px',
                fontSize:12, fontWeight:800,
                cursor:'pointer',
                fontFamily:'"Outfit",system-ui,sans-serif',
              }}
            >
              <X size={13} /> Close
            </button>
          </div>

          <RiderDashboard
            account={account}
            active={active}
            uid={resolvedUid}
            onBookRide={() => setShowDashboard(false)}
            onSignOut={() => setShowDashboard(false)}
          />
        </div>
      )}

    </div>
  );
}