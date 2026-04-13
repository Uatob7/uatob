import React, { useState, useEffect } from 'react';
import { Route, User, LogIn, X, Eye, EyeOff, Loader2 } from 'lucide-react';

import { THEME as T } from '@/App/UaTob/pricing.js';
import CSS from '@/App/UaTob/styles.js';
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
import signIn from '@/firebase/auth/signin';
import signUp from '@/firebase/auth/signup';
import { useUserRides } from '@/App/UaTob/useUserRides';
import { useActiveRides } from '@/App/UaTob/useActiveRides';
import { useUserAccount } from '@/App/UaTob/useUserAccount';
import { useCompletedRides } from '@/App/UaTob/useCompletedRides';

// ── Status buckets ─────────────────────────────────────────────────────
const SEARCHING_STATUSES = ['searching_driver'];
const TRACKING_STATUSES  = ['driver_assigned', 'driver_arriving', 'arrived', 'in_progress'];
const DONE_STATUSES      = ['completed', 'cancelled'];

// ── localStorage helpers ───────────────────────────────────────────────
const LS_KEY          = 'uatob_session';
const LS_REVIEWED_KEY = 'uatob_reviewed';

function saveSession(data)  { try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch (_) {} }
function loadSession()      { try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : null; } catch (_) { return null; } }
function clearSession()     { try { localStorage.removeItem(LS_KEY); } catch (_) {} }
function loadReviewed()     { try { return JSON.parse(localStorage.getItem(LS_REVIEWED_KEY) || '[]'); } catch { return []; } }
function saveReviewed(ids)  { try { localStorage.setItem(LS_REVIEWED_KEY, JSON.stringify(ids)); } catch (_) {} }

// ── Inline CSS ─────────────────────────────────────────────────────────
const EXTRA_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');

  @keyframes fadeIn    { from{opacity:0}                                        to{opacity:1} }
  @keyframes slideUp   { from{opacity:0;transform:translateY(14px)}             to{opacity:1;transform:translateY(0)} }
  @keyframes modalIn   { from{opacity:0;transform:translateY(22px) scale(.97)}  to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes overlayIn { from{opacity:0}                                        to{opacity:1} }
  @keyframes spinAnim  { to{transform:rotate(360deg)} }

  .login-badge {
    display:inline-flex; align-items:center; gap:7px;
    background:#111827;
    border:none; border-radius:100px;
    padding:7px 15px 7px 12px;
    font-family:'Outfit',system-ui,sans-serif;
    font-size:12px; font-weight:800;
    color:#fff; letter-spacing:.3px;
    cursor:pointer;
    box-shadow:0 3px 12px rgba(17,24,39,.18);
    transition:opacity .15s, transform .15s;
  }
  .login-badge:active { opacity:.85; transform:scale(.97); }

  .account-btn {
    width:36px; height:36px; border-radius:50%;
    background:linear-gradient(135deg,#16A34A,#15803D);
    border:none; cursor:pointer;
    display:flex; align-items:center; justify-content:center;
    box-shadow:0 3px 12px rgba(22,163,74,.3);
    transition:opacity .15s, transform .15s;
    flex-shrink:0;
  }
  .account-btn:active { opacity:.85; transform:scale(.95); }

  .auth-overlay {
    position:fixed; inset:0; z-index:500;
    background:rgba(0,0,0,.45);
    backdrop-filter:blur(5px);
    display:flex; align-items:flex-end; justify-content:center;
    animation:overlayIn .2s ease;
    padding:0;
  }
  @media(min-height:600px) {
    .auth-overlay { align-items:center; padding:24px; }
  }

  .auth-sheet {
    background:#fff;
    border-radius:24px 24px 0 0;
    width:100%; max-width:420px;
    padding:28px 24px 40px;
    box-shadow:0 -8px 48px rgba(0,0,0,.14);
    animation:modalIn .32s cubic-bezier(.34,1.2,.64,1);
    position:relative;
    max-height:90vh;
    overflow-y:auto;
  }
  @media(min-height:600px) {
    .auth-sheet { border-radius:24px; max-height:none; }
  }

  .auth-input-wrap { position:relative; margin-bottom:12px; }

  .auth-input {
    width:100%; padding:13px 16px;
    background:#F9FAFB; border:1.5px solid #E5E7EB;
    border-radius:13px; outline:none;
    font-family:'Outfit',system-ui,sans-serif;
    font-size:14px; font-weight:500; color:#111827;
    transition:border-color .15s, box-shadow .15s;
    box-sizing:border-box;
  }
  .auth-input:focus {
    border-color:#16A34A;
    box-shadow:0 0 0 3px rgba(22,163,74,.12);
    background:#fff;
  }
  .auth-input::placeholder { color:#9CA3AF; }
  .auth-input.has-toggle   { padding-right:46px; }

  .auth-eye-btn {
    position:absolute; right:14px; top:50%;
    transform:translateY(-50%);
    background:none; border:none; cursor:pointer;
    color:#9CA3AF; display:flex; padding:0;
    transition:color .15s;
  }
  .auth-eye-btn:hover { color:#6B7280; }

  .auth-submit {
    width:100%; padding:14px;
    background:linear-gradient(135deg,#22C55E,#16A34A 55%,#15803D);
    color:#fff; border:none; border-radius:14px;
    font-family:'Outfit',system-ui,sans-serif;
    font-size:15px; font-weight:800;
    cursor:pointer; margin-top:6px;
    box-shadow:0 4px 16px rgba(22,163,74,.28);
    display:flex; align-items:center; justify-content:center; gap:8px;
    transition:opacity .15s;
  }
  .auth-submit:active   { opacity:.85; }
  .auth-submit:disabled { opacity:.6; cursor:not-allowed; }

  .auth-toggle-link {
    background:none; border:none; cursor:pointer;
    color:#16A34A; font-weight:700;
    font-family:'Outfit',system-ui,sans-serif;
    font-size:13px; padding:0;
    text-decoration:underline;
    text-underline-offset:2px;
  }

  .auth-error {
    background:rgba(220,38,38,.07);
    border:1px solid rgba(220,38,38,.2);
    border-radius:10px; padding:10px 14px;
    color:#DC2626; font-size:13px; font-weight:600;
    margin-bottom:12px; line-height:1.5;
  }

  .mode-pill-row {
    display:flex; gap:6px;
    background:#F3F4F6; border-radius:12px;
    padding:4px; margin-bottom:22px;
  }
  .mode-pill {
    flex:1; padding:9px 0;
    border:none; border-radius:9px;
    font-family:'Outfit',system-ui,sans-serif;
    font-size:13px; font-weight:700; cursor:pointer;
    transition:background .15s, color .15s, box-shadow .15s;
    background:transparent; color:#6B7280;
  }
  .mode-pill.active {
    background:#fff;
    color:#111827;
    box-shadow:0 1px 6px rgba(0,0,0,.1);
  }

  /* ── Terms line ── */
  .auth-terms {
    text-align:center;
    font-size:11px;
    color:#9CA3AF;
    font-family:'Outfit',system-ui,sans-serif;
    line-height:1.6;
    margin-top:14px;
    margin-bottom:4px;
  }
  .auth-terms a {
    color:#6B7280;
    font-weight:600;
    text-decoration:underline;
    text-underline-offset:2px;
    transition:color .15s;
  }
  .auth-terms a:hover { color:#16A34A; }

  .uatob-footer {
    border-top:1px solid #E5E7EB;
    margin-top:64px;
    padding:44px 20px 36px;
    max-width:680px;
    margin-left:auto;
    margin-right:auto;
    position:relative;
    z-index:1;
  }

  .footer-grid {
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:32px 20px;
    margin-bottom:36px;
  }
  @media(min-width:480px){
    .footer-grid { grid-template-columns:1.7fr 1fr 1fr; }
  }

  .footer-brand-col { grid-column:1 / -1; }
  @media(min-width:480px){
    .footer-brand-col { grid-column:auto; }
  }

  .footer-brand-blurb {
    font-size:13px; color:#6B7280; font-weight:500;
    line-height:1.7; margin-top:12px; margin-bottom:0;
  }

  .footer-driver-cta {
    display:inline-flex; align-items:center; gap:7px;
    background:#111827; color:#fff; border:none;
    border-radius:100px; padding:8px 16px 8px 13px;
    font-family:'Outfit',system-ui,sans-serif;
    font-size:12px; font-weight:800; cursor:pointer;
    transition:opacity .15s, transform .15s, box-shadow .15s;
    letter-spacing:.3px; margin-top:16px;
    text-decoration:none;
    box-shadow:0 3px 12px rgba(17,24,39,.16);
  }
  .footer-driver-cta:hover {
    opacity:.88; transform:translateY(-2px);
    box-shadow:0 6px 18px rgba(17,24,39,.22);
  }

  .footer-col-heading {
    font-size:10px; font-weight:800; letter-spacing:1.4px;
    text-transform:uppercase; color:#9CA3AF; margin-bottom:14px;
  }

  .footer-link {
    display:block; font-size:13px; font-weight:600;
    color:#374151; text-decoration:none; margin-bottom:10px;
    transition:color .15s, transform .12s; cursor:pointer;
    background:none; border:none; padding:0;
    font-family:'Outfit',system-ui,sans-serif; text-align:left;
  }
  .footer-link:hover { color:#16A34A; transform:translateX(2px); }

  .footer-divider {
    height:1px;
    background:linear-gradient(to right, #E5E7EB, transparent);
    margin-bottom:20px;
  }

  .footer-bottom {
    display:flex; align-items:center;
    justify-content:space-between; flex-wrap:wrap; gap:14px;
  }

  .footer-legal { font-size:11px; color:#9CA3AF; font-weight:500; line-height:1.6; }

  .footer-legal-links { display:flex; gap:14px; margin-top:4px; }

  .footer-legal-link {
    font-size:11px; color:#9CA3AF; font-weight:600;
    text-decoration:none; cursor:pointer;
    background:none; border:none; padding:0;
    font-family:'Outfit',system-ui,sans-serif; transition:color .15s;
  }
  .footer-legal-link:hover { color:#374151; }

  .footer-socials { display:flex; gap:8px; }

  .footer-social-btn {
    width:34px; height:34px; border-radius:50%;
    background:#F3F4F6; border:none; cursor:pointer;
    display:flex; align-items:center; justify-content:center;
    color:#6B7280;
    transition:background .15s, color .15s, transform .15s, box-shadow .15s;
    text-decoration:none;
  }
  .footer-social-btn:hover {
    background:#111827; color:#fff;
    transform:translateY(-3px);
    box-shadow:0 4px 12px rgba(17,24,39,.2);
  }

  .footer-orlando-badge {
    display:inline-flex; align-items:center; gap:5px;
    background:#F0FDF4; border:1px solid #BBF7D0;
    border-radius:100px; padding:4px 10px;
    font-size:10px; font-weight:800; color:#16A34A;
    letter-spacing:.8px; text-transform:uppercase; margin-top:10px;
  }
`;

// ── Shared terms line ──────────────────────────────────────────────────
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

// ── Inline Auth Modal ──────────────────────────────────────────────────
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
        await fetch('https://createaccount-ady2s2xhhq-uc.a.run.app', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ uid: user.uid, email: user.email, name }),
        });
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

        {/* ── Terms ── */}
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

// ── Footer ─────────────────────────────────────────────────────────────
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

// ── MAIN APP ───────────────────────────────────────────────────────────
export default function UaTobApp({ uid }) {
  const { uid: authUid } = useAuthContext();
  const resolvedUid = authUid ?? uid;

  // ── Data hooks ─────────────────────────────────────────────────────
  const { completedRides }               = useCompletedRides(resolvedUid);
  const { rides, loading: ridesLoading } = useUserRides(resolvedUid);
  const { active }                       = useActiveRides(resolvedUid);
  const { account }                      = useUserAccount(resolvedUid);

  const saved = loadSession();

  // ── Booking state ──────────────────────────────────────────────────
  const [bookingPayload,  setBookingPayload]  = useState(saved?.bookingPayload  ?? null);
  const [pickupCoords,    setPickupCoords]    = useState(saved?.pickupCoords    ?? null);
  const [dropoffCoords,   setDropoffCoords]   = useState(saved?.dropoffCoords   ?? null);

  // ── UI state ───────────────────────────────────────────────────────
  const [showPayment,     setShowPayment]     = useState(saved?.showPayment     ?? false);
  const [selectedPayment, setSelectedPayment] = useState(saved?.selectedPayment ?? 'card');
  const [mounted,         setMounted]         = useState(false);
  const [showDashboard,   setShowDashboard]   = useState(false);

  // ── Auth state ─────────────────────────────────────────────────────
  const [showAuthModal,   setShowAuthModal]   = useState(false);
  const [showBookingAuth, setShowBookingAuth] = useState(false);
  const [authMode,        setAuthMode]        = useState('login');
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [name,            setName]            = useState('');
  const [authLoading,     setAuthLoading]     = useState(false);
  const [authError,       setAuthError]       = useState('');

  // ── Review state ───────────────────────────────────────────────────
  const [reviewedIds,   setReviewedIds]   = useState(() => loadReviewed());
  const [reviewingRide, setReviewingRide] = useState(null);

  useEffect(() => setMounted(true), []);

  // ── Persist session ────────────────────────────────────────────────
  useEffect(() => {
    if (bookingPayload) {
      saveSession({ bookingPayload, pickupCoords, dropoffCoords, showPayment, selectedPayment });
    } else {
      clearSession();
    }
  }, [bookingPayload, pickupCoords, dropoffCoords, showPayment, selectedPayment]);

  // ── Derive active ride ─────────────────────────────────────────────
  const activeRide = active?.find(
    r => r.paymentStatus === 'succeeded' && !DONE_STATUSES.includes(r.status)
  ) ?? null;

  const isSearching = !!activeRide && SEARCHING_STATUSES.includes(activeRide.status);
  const isTracking  = !!activeRide && TRACKING_STATUSES.includes(activeRide.status);

  useEffect(() => {
    if (activeRide) setShowPayment(false);
  }, [activeRide]);

  // ── Auto-prompt review for most recent unreviewed completed ride ───
  useEffect(() => {
    if (!completedRides.length || reviewingRide || isTracking || isSearching) return;
    const unreviewed = completedRides.find(r => !reviewedIds.includes(r.id));
    if (unreviewed) setReviewingRide(unreviewed);
  }, [completedRides, isTracking, isSearching]);

  // ── Booking-flow auth submit ───────────────────────────────────────
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
        await fetch('https://createaccount-ady2s2xhhq-uc.a.run.app', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ uid: user.uid, email: user.email, name }),
        });
      }

      setShowBookingAuth(false);
      setShowPayment(true);
    } catch (err) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setAuthLoading(false);
    }
  };

  // ── Handlers ───────────────────────────────────────────────────────
  const handlePayloadChange = (payload) => {
    if (!payload) return;
    setBookingPayload(prev => ({ ...prev, ...payload }));
  };

  const handleBookNow = (payload) => {
    if (!payload) return;
    const finalPayload = { ...bookingPayload, ...payload };
    setBookingPayload(finalPayload);
    setPickupCoords({ x: -81.37, y: 28.53 });
    setDropoffCoords({ x: -81.30, y: 28.45 });

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

  // ── Derived view flags ─────────────────────────────────────────────
  const isCompact = !!bookingPayload && !isTracking;

  // ── Header right ───────────────────────────────────────────────────
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

  // ── Render ─────────────────────────────────────────────────────────
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

      {/* ── Confirmation modal ── */}
      {isSearching && (
        <ConfirmationModal
          rides={rides}
          ridesLoading={ridesLoading}
          onClose={() => {}}
          onPaymentCancelled={resetRide}
          onRetry={resetRide}
        />
      )}

      {/* ── Review modal ── */}
      {reviewingRide && !isTracking && !isSearching && (
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