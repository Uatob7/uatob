import { useState, useEffect } from 'react';
import {
  Share2, Edit3, X, CreditCard, Clock,
  ChevronLeft, Lock, Loader2, AlertCircle,
} from 'lucide-react';
import {
  collection, query, where, orderBy,
  onSnapshot, Timestamp, getFirestore,
} from 'firebase/firestore';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement } from '@stripe/react-stripe-js';
import { firebase_app } from '@/firebase/config';
import { useNotificationCardPayment }    from '@/App/Drivers/useNotificationCardPayment';
import { useNotificationCashAppPayment } from '@/App/Drivers/useNotificationCashAppPayment';

const db            = getFirestore(firebase_app);
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

// Steps: 0=feed  1=compose  2=pay-method  3=card-form  4=cashapp-processing  5=success

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      color: 'rgba(255,255,255,.88)',
      fontFamily: 'monospace',
      fontSize: '13px',
      '::placeholder': { color: 'rgba(255,255,255,.25)' },
    },
    invalid: { color: '#F87171' },
  },
  hidePostalCode: true,
};

function RoleBadge({ role }) {
  const isDriver = role === 'driver';
  return (
    <span style={{
      display:'inline-flex', alignItems:'center',
      padding:'1px 5px', borderRadius:4, marginRight:4,
      background: isDriver ? 'rgba(52,211,153,.15)' : 'rgba(96,165,250,.15)',
      border: `1px solid ${isDriver ? 'rgba(52,211,153,.3)' : 'rgba(96,165,250,.3)'}`,
      fontSize:8, fontWeight:800, letterSpacing:'.08em', textTransform:'uppercase',
      color: isDriver ? '#6EE7B7' : '#93C5FD',
      verticalAlign:'middle',
    }}>
      {isDriver ? 'Driver' : 'Rider'}
    </span>
  );
}

function RiderFeedFaceInner({ uid, account, onBusy }) {
  const [step,          setStep]          = useState(0);
  const [message,       setMessage]       = useState('');
  const [notifications, setNotifications] = useState([]);
  const [cashError,     setCashError]     = useState('');
  const [displayIdx,    setDisplayIdx]    = useState(0);

  const firstName  = account?.firstName ?? null;
  const lastName   = account?.lastName  ?? null;
  const riderName  = account?.displayName
    ?? account?.name
    ?? (firstName || lastName ? `${firstName ?? ''} ${lastName ?? ''}`.trim() : null);

  useEffect(() => { onBusy?.(step > 0); return () => onBusy?.(false); }, [step, onBusy]);

  const {
    loading:     cardLoading,
    error:       cardError,
    complete:    cardComplete,
    focused:     cardFocused,
    setComplete: setCardComplete,
    setError:    setCardError,
    setFocused:  setCardFocused,
    handleSubmit,
  } = useNotificationCardPayment({
    uid,
    message,
    driverName: riderName,
    firstName,
    lastName,
    role:      'rider',
    onSuccess: () => setStep(5),
    onError:   () => setStep(3),
  });

  const { loading: cashAppLoading, handleCashAppPay } = useNotificationCashAppPayment({
    uid,
    message,
    driverName: riderName,
    firstName,
    lastName,
    role:      'rider',
    onSuccess: () => setStep(5),
    onError:   (msg) => { setCashError(msg); setStep(2); },
  });

  // Live feed — all active posts (drivers + riders)
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

  // Rotate every 4s when multiple posts
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
    setCashError('');
    setCardError('');
  }

  const nameColor = current?.role === 'driver' ? '#6EE7B7' : '#93C5FD';

  // ── STEP 0: Live feed ────────────────────────────────
  if (step === 0) return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>

      {/* Icon */}
      <div style={{
        width:44, height:44, borderRadius:13, flexShrink:0,
        background:'linear-gradient(135deg,#60A5FA,#3B82F6)',
        display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow:'0 6px 18px rgba(59,130,246,.35)',
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
            background:'rgba(96,165,250,.12)', border:'1px solid rgba(96,165,250,.25)',
          }}>
            <div style={{
              width:5, height:5, borderRadius:'50%',
              background:'#60A5FA', boxShadow:'0 0 7px rgba(96,165,250,.8)',
              animation:'scLiveDot 1.6s ease-in-out infinite',
            }}/>
            <span className="mono" style={{ fontSize:9, fontWeight:800, letterSpacing:'.12em', textTransform:'uppercase', color:'#93C5FD' }}>
              Live Feed
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

        {current ? (
          <>
            <div style={{ fontSize:12, fontWeight:600, color:'rgba(255,255,255,.85)', lineHeight:1.5, marginBottom:5 }}>
              <RoleBadge role={current.role}/>
              <span style={{ color: nameColor, fontWeight:700 }}>{current.driverName}:</span>{' '}
              {current.message}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                <Clock size={9} color="#93C5FD"/>
                <span style={{ fontSize:9, color:'rgba(147,197,253,.6)', fontWeight:600 }}>{timeAgo(current.createdAt)}</span>
              </div>
              <span style={{ fontSize:9, color:'rgba(255,255,255,.2)' }}>·</span>
              <span style={{ fontSize:9, color:'rgba(147,197,253,.45)', fontWeight:600 }}>{expiresIn(current.expiresAt)}</span>
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
            No posts yet — be the <span style={{ color:'#93C5FD' }}>first to post</span> for $1.
          </div>
        )}
      </div>
    </div>
  );

  // ── STEP 1: Compose ──────────────────────────────────
  if (step === 1) return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <span style={{ fontSize:11, fontWeight:800, color:'#93C5FD', letterSpacing:'.06em', textTransform:'uppercase' }}>
          Your Message
        </span>
        <button onClick={reset} style={{ background:'none', border:'none', cursor:'pointer', padding:2 }}>
          <X size={14} color="rgba(255,255,255,.4)"/>
        </button>
      </div>

      <textarea
        value={message}
        onChange={e => setMessage(e.target.value.slice(0, 120))}
        placeholder="Write something for everyone to see…"
        rows={3}
        style={{
          width:'100%', boxSizing:'border-box',
          background:'rgba(255,255,255,.05)', border:'1px solid rgba(96,165,250,.25)',
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
            background: message.trim() ? 'linear-gradient(135deg,#60A5FA,#3B82F6)' : 'rgba(255,255,255,.08)',
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
        <span style={{ fontSize:11, fontWeight:800, color:'#93C5FD', letterSpacing:'.06em', textTransform:'uppercase' }}>
          Pay $1.00
        </span>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>

        {/* Card */}
        <button
          onClick={() => setStep(3)}
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
          onClick={() => { setStep(4); handleCashAppPay(); }}
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

      {cashError && (
        <div style={{ marginTop:8, fontSize:10, color:'#F87171', textAlign:'center' }}>{cashError}</div>
      )}
    </div>
  );

  // ── STEP 3: Card form ────────────────────────────────
  if (step === 3) return (
    <form onSubmit={handleSubmit}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
        <button type="button" onClick={() => setStep(2)} style={{ background:'none', border:'none', cursor:'pointer', padding:2 }}>
          <ChevronLeft size={14} color="rgba(255,255,255,.4)"/>
        </button>
        <span style={{ fontSize:11, fontWeight:800, color:'#93C5FD', letterSpacing:'.06em', textTransform:'uppercase' }}>
          Card Details
        </span>
      </div>

      <div style={{
        border: `1.5px solid ${cardError ? '#F87171' : cardFocused ? '#60A5FA' : 'rgba(255,255,255,.12)'}`,
        borderRadius:10, padding:'10px 12px',
        background:'rgba(255,255,255,.04)', marginBottom:8,
        transition:'border-color .2s',
      }}>
        <CardElement
          options={CARD_ELEMENT_OPTIONS}
          onFocus={() => setCardFocused(true)}
          onBlur={() => setCardFocused(false)}
          onChange={e => { setCardComplete(e.complete); setCardError(e.error?.message || ''); }}
        />
      </div>

      {cardError && (
        <div style={{
          marginBottom:8, display:'flex', alignItems:'center', gap:5,
          fontSize:11, color:'#F87171', fontFamily:'inherit',
        }}>
          <AlertCircle size={11} strokeWidth={2.4}/>{cardError}
        </div>
      )}

      <button
        type="submit"
        disabled={!cardComplete || cardLoading}
        style={{
          width:'100%', padding:'10px', borderRadius:10, border:'none',
          background: !cardComplete || cardLoading ? 'rgba(255,255,255,.08)' : 'linear-gradient(135deg,#60A5FA,#3B82F6)',
          color: !cardComplete || cardLoading ? 'rgba(255,255,255,.3)' : '#fff',
          fontSize:12, fontWeight:800, cursor: !cardComplete || cardLoading ? 'not-allowed' : 'pointer',
          display:'flex', alignItems:'center', justifyContent:'center', gap:6,
          transition:'all .2s',
        }}
      >
        {cardLoading
          ? <><Loader2 size={13} style={{ animation:'spin .8s linear infinite' }}/>Processing…</>
          : <><Lock size={12} strokeWidth={2.4}/>Pay $1.00</>
        }
      </button>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </form>
  );

  // ── STEP 4: Cash App processing ──────────────────────
  if (step === 4) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:78, gap:10 }}>
      <div style={{
        width:32, height:32, borderRadius:'50%',
        border:'2.5px solid rgba(0,212,100,.2)',
        borderTop:'2.5px solid #00D464',
        animation:'spin 0.8s linear infinite',
      }}/>
      <span style={{ fontSize:11, color:'rgba(255,255,255,.5)', fontWeight:600 }}>Opening Cash App…</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // ── STEP 5: Success ──────────────────────────────────
  if (step === 5) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:78, gap:8 }}>
      <div style={{
        width:38, height:38, borderRadius:'50%',
        background:'linear-gradient(135deg,#60A5FA,#3B82F6)',
        display:'flex', alignItems:'center', justifyContent:'center',
        boxShadow:'0 0 20px rgba(96,165,250,.4)',
        fontSize:18,
      }}>✓</div>
      <div style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,.85)', textAlign:'center' }}>
        Message posted!
      </div>
      <div style={{ fontSize:10, color:'rgba(255,255,255,.4)', textAlign:'center', lineHeight:1.5 }}>
        Your message is live for <span style={{ color:'#93C5FD' }}>24 hours</span>
      </div>
      <button onClick={reset} style={{
        marginTop:4, padding:'5px 16px', borderRadius:100, border:'none', cursor:'pointer',
        background:'rgba(96,165,250,.12)', fontSize:10, fontWeight:700, color:'#93C5FD',
      }}>
        Done
      </button>
    </div>
  );

  return null;
}

export default function RiderFeedFace(props) {
  return (
    <Elements stripe={stripePromise}>
      <RiderFeedFaceInner {...props}/>
    </Elements>
  );
}
