import { useState, useEffect } from 'react';
import { Share2, Edit3, X, CreditCard, Clock, ChevronLeft } from 'lucide-react';
import {
  collection, query, where, orderBy,
  onSnapshot, Timestamp, getFirestore,
} from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';
import { loadStripe } from '@stripe/stripe-js';
import { getFunctions, httpsCallable } from 'firebase/functions';

const db           = getFirestore(firebase_app);
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

const functions                    = getFunctions(firebase_app, 'us-east1');
const callCardFeedPayment          = httpsCallable(functions, 'createNotificationPaymentCard');
const callCashAppFeedPayment       = httpsCallable(functions, 'createNotificationPaymentCashApp');

// ── Steps ──────────────────────────────────────────────
// 0=feed  1=compose  2=pay-method  3=card-processing  4=cashapp-instructions  5=success

export default function NotificationFace({ online, driver }) {

  console.log(driver);
  const [step,          setStep]          = useState(0);
  const [message,       setMessage]       = useState('');
  const [notifications, setNotifications] = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState('');
  const [displayIdx,    setDisplayIdx]    = useState(0);

  // ── Live feed from Firestore ───────────────────────
  useEffect(() => {
    const now = Timestamp.now();
    const q = query(
      collection(db, 'Feed'),
      where('status',    '==', 'active'),
      where('expiresAt', '>',  now),
      orderBy('expiresAt', 'desc'),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(q, snap => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setDisplayIdx(0);
    });
    return unsub;
  }, []);

  // ── Rotate every 4s when multiple posts ───────────
  useEffect(() => {
    if (notifications.length < 2) return;
    const id = setInterval(() => {
      setDisplayIdx(i => (i + 1) % notifications.length);
    }, 4000);
    return () => clearInterval(id);
  }, [notifications.length]);

  const current = notifications[displayIdx] ?? null;

  function timeAgo(ts) {
    if (!ts) return '';
    const ms  = typeof ts.toMillis === 'function' ? ts.toMillis() : ts.seconds * 1000;
    const min = Math.floor((Date.now() - ms) / 60000);
    if (min < 1)  return 'just now';
    if (min < 60) return `${min}m ago`;
    return `${Math.floor(min / 60)}h ago`;
  }

  function expiresIn(ts) {
    if (!ts) return '';
    const ms   = typeof ts.toMillis === 'function' ? ts.toMillis() : ts.seconds * 1000;
    const left = ms - Date.now();
    if (left <= 0) return 'expired';
    const h = Math.floor(left / 3600000);
    const m = Math.floor((left % 3600000) / 60000);
    return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
  }

  function reset() {
    setStep(0);
    setMessage('');
    setError('');
    setLoading(false);
  }

  // ── CARD payment ───────────────────────────────────
  // 1. Call Cloud Function → get clientSecret
  // 2. stripe.confirmCardPayment(clientSecret) — Stripe handles 3DS etc.
  // 3. On success the notification is already active (function wrote it optimistically)
  async function handleCardPay() {
    setLoading(true);
    setError('');
    try {
      const uid = driver?.uid;
      if (!uid) throw new Error('Driver UID missing.');

      // Step 1 — create PaymentIntent + notification doc on server
      const { data } = await callCardFeedPayment({
        uid,
        message: message.trim(),
      });

      if (!data?.clientSecret) throw new Error('No client secret returned.');

      // Step 2 — confirm card payment client-side
      const stripe = await stripePromise;
      const { error: stripeErr } = await stripe.confirmCardPayment(data.clientSecret);
      if (stripeErr) throw new Error(stripeErr.message);

      // Step 3 — done, notification is already active on the server
      setStep(5);
    } catch (e) {
      setError(e.message || 'Payment failed. Try again.');
      setStep(2); // send back to method selector on error
    } finally {
      setLoading(false);
    }
  }

  // ── CASH APP payment ───────────────────────────────
  // 1. Call Cloud Function → get clientSecret (notification written as 'pending')
  // 2. stripe.confirmCashappPayment(clientSecret) — opens Cash App
  // 3. Stripe webhook activates the notification on payment_intent.succeeded
  async function handleCashAppPay() {
    setLoading(true);
    setError('');
    try {
      const uid = driver?.uid;
      if (!uid) throw new Error('Driver UID missing.');

      // Step 1 — create PaymentIntent + pending notification doc on server
      const { data } = await callCashAppFeedPayment({
        uid,
        message: message.trim(),
      });

      if (!data?.clientSecret) throw new Error('No client secret returned.');

      // Step 2 — redirect to Cash App via Stripe
      const stripe = await stripePromise;
      const { error: stripeErr } = await stripe.confirmCashappPayment(
        data.clientSecret,
        {
          payment_method: { cashapp: {} },
          return_url: `${window.location.origin}`,
        }
      );

      // If we reach here without redirect it means it failed synchronously
      if (stripeErr) throw new Error(stripeErr.message);

      // On successful redirect Stripe returns the user to return_url.
      // The notification activates via webhook. Show pending success state.
      setStep(5);
    } catch (e) {
      setError(e.message || 'Cash App payment failed. Try again.');
      setStep(2);
    } finally {
      setLoading(false);
    }
  }

  // ─────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────

  // ── STEP 0: Live feed ────────────────────────────────
  if (step === 0) return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>

      {/* Icon */}
      <div style={{
        width:44, height:44, borderRadius:13, flexShrink:0,
        background:'linear-gradient(135deg,#34D399,#10B981)',
        display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow:'0 6px 18px rgba(16,185,129,.4)',
      }}>
        <Share2 size={18} color="#fff" strokeWidth={2.2}/>
      </div>

      {/* Content */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>

          {/* Live badge */}
          <div style={{
            display:'inline-flex', alignItems:'center', gap:5,
            padding:'3px 9px', borderRadius:100,
            background:'rgba(52,211,153,.12)', border:'1px solid rgba(52,211,153,.25)',
          }}>
            <div style={{
              width:5, height:5, borderRadius:'50%',
              background:'#34D399', boxShadow:'0 0 7px rgba(52,211,153,.8)',
              animation:'scLiveDot 1.6s ease-in-out infinite',
            }}/>
            <span className="mono" style={{ fontSize:9, fontWeight:800, letterSpacing:'.12em', textTransform:'uppercase', color:'#6EE7B7' }}>
              Driver Feed
            </span>
          </div>

          {/* Post button */}
          <button onClick={() => setStep(1)} style={{
            display:'inline-flex', alignItems:'center', gap:4,
            padding:'3px 9px', borderRadius:100, cursor:'pointer',
            background:'rgba(96,165,250,.12)', border:'1px solid rgba(96,165,250,.28)',
          }}>
            <Edit3 size={9} color="#93C5FD"/>
            <span className="mono" style={{ fontSize:9, fontWeight:800, letterSpacing:'.10em', textTransform:'uppercase', color:'#93C5FD' }}>
              Post · $1
            </span>
          </button>
        </div>

        {/* Notification or fallback */}
        {current ? (
          <>
            <div style={{ fontSize:12, fontWeight:600, color:'rgba(255,255,255,.85)', lineHeight:1.5, marginBottom:5 }}>
              <span style={{ color:'#6EE7B7', fontWeight:700 }}>{current.driverName}: </span>
              {current.message}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                <Clock size={9} color="#6EE7B7"/>
                <span style={{ fontSize:9, color:'rgba(110,231,183,.6)', fontWeight:600 }}>{timeAgo(current.createdAt)}</span>
              </div>
              <span style={{ fontSize:9, color:'rgba(255,255,255,.2)' }}>·</span>
              <span style={{ fontSize:9, color:'rgba(110,231,183,.45)', fontWeight:600 }}>{expiresIn(current.expiresAt)}</span>
              {notifications.length > 1 && (
                <>
                  <span style={{ fontSize:9, color:'rgba(255,255,255,.2)' }}>·</span>
                  <span style={{ fontSize:9, color:'rgba(255,255,255,.3)', fontWeight:600 }}>{displayIdx+1}/{notifications.length}</span>
                </>
              )}
            </div>
          </>
        ) : (
          <div style={{ fontSize:12, fontWeight:600, color:'rgba(255,255,255,.45)', lineHeight:1.5 }}>
            {online
              ? <>No driver posts yet — be the <span style={{ color:'#6EE7B7' }}>first to post</span> for $1.</>
              : <>Go online and post a message to the <span style={{ color:'#6EE7B7' }}>driver feed</span>.</>
            }
          </div>
        )}
      </div>
    </div>
  );

  // ── STEP 1: Compose ──────────────────────────────────
  if (step === 1) return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <span style={{ fontSize:11, fontWeight:800, color:'#6EE7B7', letterSpacing:'.06em', textTransform:'uppercase' }}>
          Your Message
        </span>
        <button onClick={reset} style={{ background:'none', border:'none', cursor:'pointer', padding:2 }}>
          <X size={14} color="rgba(255,255,255,.4)"/>
        </button>
      </div>

      <textarea
        value={message}
        onChange={e => setMessage(e.target.value.slice(0, 120))}
        placeholder="Write something for all drivers to see…"
        rows={3}
        style={{
          width:'100%', boxSizing:'border-box',
          background:'rgba(255,255,255,.05)', border:'1px solid rgba(52,211,153,.25)',
          borderRadius:10, padding:'9px 11px', resize:'none',
          fontSize:12, color:'rgba(255,255,255,.85)', lineHeight:1.5,
          outline:'none', fontFamily:'inherit',
        }}
      />

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:6 }}>
        <span style={{ fontSize:9, color:'rgba(255,255,255,.3)' }}>{message.length}/120</span>
        <button
          onClick={() => { if (message.trim()) setStep(2); }}
          disabled={!message.trim()}
          style={{
            padding:'6px 16px', borderRadius:100, border:'none',
            cursor: message.trim() ? 'pointer' : 'not-allowed',
            background: message.trim() ? 'linear-gradient(135deg,#34D399,#10B981)' : 'rgba(255,255,255,.08)',
            fontSize:11, fontWeight:800,
            color: message.trim() ? '#fff' : 'rgba(255,255,255,.3)',
            letterSpacing:'.06em', transition:'all .2s',
          }}
        >
          Pay Now →
        </button>
      </div>
    </div>
  );

  // ── STEP 2: Choose payment method ────────────────────
  if (step === 2) return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
        <button onClick={() => setStep(1)} style={{ background:'none', border:'none', cursor:'pointer', padding:2 }}>
          <ChevronLeft size={14} color="rgba(255,255,255,.4)"/>
        </button>
        <span style={{ fontSize:11, fontWeight:800, color:'#6EE7B7', letterSpacing:'.06em', textTransform:'uppercase' }}>
          Pay $1.00
        </span>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>

        {/* Card */}
        <button
          onClick={() => { setStep(3); handleCardPay(); }}
          style={{
            display:'flex', alignItems:'center', gap:10,
            padding:'10px 14px', borderRadius:12, cursor:'pointer',
            background:'rgba(59,130,246,.10)', border:'1px solid rgba(59,130,246,.30)',
            textAlign:'left',
          }}
        >
          <div style={{
            width:32, height:32, borderRadius:9, flexShrink:0,
            background:'linear-gradient(135deg,#3B82F6,#2563EB)',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <CreditCard size={15} color="#fff" strokeWidth={2.2}/>
          </div>
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,.88)' }}>Pay with Card</div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,.4)', marginTop:1 }}>Debit or credit · instant</div>
          </div>
        </button>

        {/* Cash App */}
        <button
          onClick={() => { setStep(3); handleCashAppPay(); }}
          style={{
            display:'flex', alignItems:'center', gap:10,
            padding:'10px 14px', borderRadius:12, cursor:'pointer',
            background:'rgba(0,212,100,.08)', border:'1px solid rgba(0,212,100,.28)',
            textAlign:'left',
          }}
        >
          <div style={{
            width:32, height:32, borderRadius:9, flexShrink:0,
            background:'linear-gradient(135deg,#00D464,#00A050)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontWeight:900, fontSize:14, color:'#fff',
          }}>
            $
          </div>
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,.88)' }}>Pay with Cash App</div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,.4)', marginTop:1 }}>Opens Cash App · live after confirmation</div>
          </div>
        </button>
      </div>

      {error && (
        <div style={{ marginTop:8, fontSize:10, color:'#F87171', textAlign:'center' }}>{error}</div>
      )}
    </div>
  );

  // ── STEP 3: Processing (card OR cashapp redirect in flight) ──
  if (step === 3) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:78, gap:10 }}>
      {loading ? (
        <>
          <div style={{
            width:32, height:32, borderRadius:'50%',
            border:'2.5px solid rgba(59,130,246,.2)',
            borderTop:'2.5px solid #60A5FA',
            animation:'spin 0.8s linear infinite',
          }}/>
          <span style={{ fontSize:11, color:'rgba(255,255,255,.5)', fontWeight:600 }}>Processing payment…</span>
        </>
      ) : error ? (
        <>
          <span style={{ fontSize:11, color:'#F87171', fontWeight:600, textAlign:'center' }}>{error}</span>
          <button onClick={() => setStep(2)} style={{
            padding:'5px 14px', borderRadius:100, border:'none', cursor:'pointer',
            background:'rgba(248,113,113,.15)', fontSize:10, color:'#F87171', fontWeight:700,
          }}>
            Try Again
          </button>
        </>
      ) : null}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // ── STEP 5: Success ──────────────────────────────────
  if (step === 5) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:78, gap:8 }}>
      <div style={{
        width:38, height:38, borderRadius:'50%',
        background:'linear-gradient(135deg,#34D399,#10B981)',
        display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow:'0 0 20px rgba(52,211,153,.4)',
        fontSize:18,
      }}>✓</div>
      <div style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,.85)', textAlign:'center' }}>
        Notification posted!
      </div>
      <div style={{ fontSize:10, color:'rgba(255,255,255,.4)', textAlign:'center', lineHeight:1.5 }}>
        Your message is live for <span style={{ color:'#6EE7B7' }}>24 hours</span>
      </div>
      <button onClick={reset} style={{
        marginTop:4, padding:'5px 16px', borderRadius:100, border:'none', cursor:'pointer',
        background:'rgba(52,211,153,.12)', fontSize:10, fontWeight:700, color:'#6EE7B7',
      }}>
        Done
      </button>
    </div>
  );

  return null;
}