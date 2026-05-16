// src/App/UaTob/ConfirmationModal.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Clock, Car, CheckCircle, RotateCcw, Loader2, Bell, AlertCircle, MapPin, Navigation, Phone, Check, X } from 'lucide-react';
import { THEME as T } from '@/App/UaTob/pricing.js';
import { doc, deleteDoc, onSnapshot, getFirestore } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getMessaging, getToken } from 'firebase/messaging';
import { firebase_app } from '@/firebase/config';
import SearchingMap from '@/App/UaTob/SearchingMap';

const db = getFirestore(firebase_app);
const functions = getFunctions(firebase_app, "us-east1");
const callableExtendRideSearch = httpsCallable(functions, "extendRideSearch");
const callableSaveRiderToken = httpsCallable(functions, "saveRiderFcmToken");
const callableCancelRide = httpsCallable(functions, "cancelRide");
const callableUpdateRiderPhone = httpsCallable(functions, "updateRiderPhone");

const VAPID_KEY = "BJ_sRHZonSGCKk2mB2i9ofTRS8ouFVMV-I15FX4sqdUXHyVb1lo6H-N4GMPrlcIIshRlykQicaxkxxFxcYcI4JQ";
const SEARCH_LIMIT_SEC = 7 * 60;

const PHONE_SKIP_KEY = (rideId) => `uatob_phone_skipped_${rideId}`;

function getSecondsRemaining(expiresAt) {
  if (!expiresAt) return 0;
  const expiryMs = expiresAt instanceof Date
    ? expiresAt.getTime()
    : expiresAt?.toDate?.()?.getTime?.() ?? new Date(expiresAt).getTime();
  if (!expiryMs || isNaN(expiryMs)) return 0;
  return Math.max(0, Math.floor((expiryMs - Date.now()) / 1000));
}

async function registerRiderFcmToken(rideId, uid) {
  if (!("Notification" in window)) throw new Error("Push not supported");
  const permission = await window.Notification.requestPermission();
  if (permission !== "granted") throw new Error("Permission denied");
  const messaging = getMessaging(firebase_app);
  const token = await getToken(messaging, { vapidKey: VAPID_KEY });
  if (!token) throw new Error("Empty token");
  await callableSaveRiderToken({ rideId, uid, token });
}

function formatUsPhone(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function digitsOnly(s) {
  return String(s ?? "").replace(/\D/g, "");
}

// ─── Phone Capture Card (inline, shows during searching) ────────────────────
function PhoneCaptureCard({ uid, onSkip, onSaved }) {
  const [value, setValue]     = useState("");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState(false);

  const digits = digitsOnly(value);
  const isValidUs = digits.length === 10 || (digits.length === 11 && digits[0] === "1");
  const canSubmit = isValidUs && !saving && !success;

  const handleChange = (e) => {
    setValue(formatUsPhone(e.target.value));
    if (error) setError("");
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError("");
    try {
      const { data } = await callableUpdateRiderPhone({ uid, phone: digits });
      if (data?.success) {
        setSuccess(true);
        setTimeout(() => onSaved?.(data.phone), 900);
      } else {
        throw new Error("Update failed");
      }
    } catch (err) {
      console.error("[updateRiderPhone] failed:", err);
      setError(err?.message || "Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && canSubmit) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (success) {
    return (
      <div style={{
        marginTop: 10,
        background: "linear-gradient(135deg, #ECFDF5, #D1FAE5)",
        border: `1px solid ${T.accentBorder}`,
        borderRadius: 14,
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 11,
        animation: "phoneSlideIn .3s cubic-bezier(.34,1.56,.64,1) both",
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: "linear-gradient(135deg,#22C55E,#15803D)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
          boxShadow: "0 2px 8px rgba(22,163,74,.35)",
        }}>
          <Check size={15} color="#fff" strokeWidth={3} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#065F46", marginBottom: 1 }}>
            Phone saved
          </div>
          <div style={{ fontSize: 11.5, color: "#047857", fontWeight: 500 }}>
            Your driver can text you when they arrive
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes phoneSlideIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        @keyframes phoneIconBob {
          0%, 100% { transform: rotate(-8deg); }
          50%      { transform: rotate(8deg);  }
        }
        .phone-input:focus { border-color: ${T.accent} !important; box-shadow: 0 0 0 3px rgba(34,197,94,.12); }
        .phone-save-btn:hover:not(:disabled) { filter: brightness(1.07); transform: translateY(-1px); }
        .phone-save-btn:active:not(:disabled) { transform: translateY(0); filter: brightness(.96); }
        .phone-skip-btn:hover { color: ${T.text} !important; }
      `}</style>

      <div style={{
        marginTop: 10,
        background: "linear-gradient(135deg, #FAFBFF, #F0F9FF)",
        border: "1px solid #DBEAFE",
        borderRadius: 14,
        padding: "13px 14px 14px",
        animation: "phoneSlideIn .35s cubic-bezier(.34,1.56,.64,1) both",
        position: "relative",
      }}>
        <button
          className="phone-skip-btn"
          onClick={onSkip}
          aria-label="Skip phone number"
          style={{
            position: "absolute", top: 8, right: 8,
            width: 22, height: 22, borderRadius: "50%",
            border: "none", background: "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "#9CA3AF",
            transition: "color .12s",
            padding: 0,
          }}
        >
          <X size={13} strokeWidth={2.5} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, paddingRight: 22 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: "linear-gradient(135deg, #3B82F6, #2563EB)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
            boxShadow: "0 2px 8px rgba(37,99,235,.3)",
          }}>
            <Phone size={14} color="#fff" strokeWidth={2.4} style={{ animation: "phoneIconBob 2.2s ease-in-out infinite" }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#1E3A8A", letterSpacing: "-0.1px" }}>
              Add your phone number
            </div>
            <div style={{ fontSize: 11.5, color: "#3B82F6", fontWeight: 500, marginTop: 1 }}>
              So your driver can reach you on pickup
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 7 }}>
          <input
            className="phone-input"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(555) 123-4567"
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={saving}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 10,
              border: `1.5px solid ${error ? "#FCA5A5" : "#DBEAFE"}`,
              background: "#fff",
              fontSize: 14,
              fontWeight: 600,
              color: T.text,
              fontFamily: "inherit",
              letterSpacing: ".01em",
              outline: "none",
              transition: "border-color .15s, box-shadow .15s",
              minWidth: 0,
            }}
          />
          <button
            className="phone-save-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              padding: "0 14px",
              minWidth: 70,
              borderRadius: 10,
              border: "none",
              background: canSubmit
                ? "linear-gradient(135deg,#22C55E,#15803D)"
                : "#E5E7EB",
              color: canSubmit ? "#fff" : "#9CA3AF",
              fontSize: 13,
              fontWeight: 800,
              cursor: canSubmit ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              boxShadow: canSubmit ? "0 2px 8px rgba(22,163,74,.32)" : "none",
              transition: "filter .15s, transform .15s, background .15s, color .15s, box-shadow .15s",
              flexShrink: 0,
            }}
          >
            {saving
              ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
              : "Save"
            }
          </button>
        </div>

        {error && (
          <div style={{
            marginTop: 8,
            display: "flex", alignItems: "center", gap: 5,
            fontSize: 11.5, fontWeight: 600, color: "#DC2626",
          }}>
            <AlertCircle size={11} strokeWidth={2.5} />
            {error}
          </div>
        )}

        {!error && (
          <div style={{
            marginTop: 8,
            fontSize: 10.5,
            color: "#6B7280",
            fontWeight: 500,
            lineHeight: 1.4,
          }}>
            Used only for ride coordination. Never shared.
          </div>
        )}
      </div>
    </>
  );
}

// ─── Notification Popup ────────────────────────────────────────────────────
function NotificationPopup({ notifLoading, notifError, onAllow, onSkip }) {
  const hasError = !!notifError;
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        @keyframes notifBackdropIn { from{opacity:0} to{opacity:1} }
        @keyframes notifCardIn { from{opacity:0;transform:scale(.92) translateY(20px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes bellSwing { 0%,100%{transform:rotate(0deg)} 15%{transform:rotate(-22deg)} 30%{transform:rotate(16deg)} 45%{transform:rotate(-10deg)} 60%{transform:rotate(6deg)} 75%{transform:rotate(-3deg)} }
        @keyframes ringExpand { 0%{transform:scale(.55);opacity:.7} 100%{transform:scale(2.1);opacity:0} }
        @keyframes errorShake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-7px)} 40%{transform:translateX(7px)} 60%{transform:translateX(-4px)} 80%{transform:translateX(4px)} }
        @keyframes notifSpin { to{transform:rotate(360deg)} }
        @keyframes dotPulse { 0%,80%,100%{transform:scale(0);opacity:.4} 40%{transform:scale(1);opacity:1} }
        .notif-allow-btn:hover{filter:brightness(1.08);transform:translateY(-1px)}
        .notif-allow-btn:active{filter:brightness(.96);transform:translateY(0)}
        .notif-skip-btn:hover{background:#F3F4F6!important}
        .notif-skip-btn:active{background:#E5E7EB!important}
      `}</style>
      <div
        onClick={e => e.target === e.currentTarget && onSkip()}
        style={{
          position:'fixed',inset:0,zIndex:1060,
          background:'rgba(10,10,20,.52)',backdropFilter:'blur(8px)',
          display:'flex',alignItems:'center',justifyContent:'center',padding:'24px',
          animation:'notifBackdropIn .22s ease both',
        }}
      >
        <div style={{
          width:'100%',maxWidth:'352px',background:'#FAFAF8',borderRadius:'28px',overflow:'hidden',
          boxShadow:'0 32px 80px rgba(0,0,0,.22),0 0 0 1px rgba(0,0,0,.06)',
          animation:`notifCardIn .32s cubic-bezier(.34,1.46,.64,1) both${hasError?', errorShake .4s ease':''}`,
          fontFamily:"'DM Sans', sans-serif",
        }}>
          <div style={{
            background:hasError?'linear-gradient(145deg,#FFF1F1 0%,#FFE4E4 100%)':'linear-gradient(145deg,#EFF6FF 0%,#DBEAFE 100%)',
            padding:'36px 24px 28px',display:'flex',flexDirection:'column',alignItems:'center',
            position:'relative',overflow:'hidden',
          }}>
            <div style={{
              position:'absolute',inset:0,opacity:.18,
              backgroundImage:`repeating-linear-gradient(0deg,transparent,transparent 22px,${hasError?'#FCA5A5':'#93C5FD'} 22px,${hasError?'#FCA5A5':'#93C5FD'} 23px),repeating-linear-gradient(90deg,transparent,transparent 22px,${hasError?'#FCA5A5':'#93C5FD'} 22px,${hasError?'#FCA5A5':'#93C5FD'} 23px)`,
            }}/>
            {!notifLoading && !hasError && (
              <>
                {[0,1,2].map(i=>(
                  <div key={i} style={{
                    position:'absolute',top:'50%',left:'50%',width:'68px',height:'68px',borderRadius:'50%',
                    border:'1.5px solid rgba(59,130,246,.35)',transform:'translate(-50%,-50%)',
                    animation:`ringExpand 2.6s ease-out ${i*.85}s infinite`,
                  }}/>
                ))}
              </>
            )}
            <div style={{
              position:'relative',zIndex:1,width:'72px',height:'72px',borderRadius:'50%',
              background:hasError?'linear-gradient(135deg,#FCA5A5,#EF4444)':'linear-gradient(135deg,#60A5FA,#2563EB)',
              boxShadow:hasError?'0 8px 28px rgba(239,68,68,.38),0 0 0 6px rgba(239,68,68,.12)':'0 8px 28px rgba(37,99,235,.38),0 0 0 6px rgba(37,99,235,.12)',
              display:'flex',alignItems:'center',justifyContent:'center',
            }}>
              {notifLoading?(
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{animation:'notifSpin .85s linear infinite'}}>
                  <circle cx="14" cy="14" r="11" stroke="rgba(255,255,255,.25)" strokeWidth="2.5"/>
                  <path d="M14 3 A11 11 0 0 1 25 14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              ):hasError?(
                <AlertCircle size={28} color="#fff" strokeWidth={2.2}/>
              ):(
                <Bell size={28} color="#fff" strokeWidth={2.2} style={{animation:'bellSwing 2.8s ease-in-out 1.2s infinite',transformOrigin:'top center'}}/>
              )}
            </div>
            <div style={{position:'relative',zIndex:1,marginTop:'18px',fontSize:'23px',fontFamily:"'DM Serif Display', serif",fontWeight:400,color:hasError?'#7F1D1D':'#1E3A5F',textAlign:'center',lineHeight:1.2}}>
              {notifLoading?'Connecting…':hasError?'Permission failed':'Stay in the loop'}
            </div>
            <div style={{position:'relative',zIndex:1,marginTop:'7px',fontSize:'13px',fontWeight:500,color:hasError?'#B91C1C':'#3B5E8A',textAlign:'center',lineHeight:1.55,maxWidth:'260px'}}>
              {notifLoading?"Registering your device — just a moment":hasError?(notifError||"We couldn't get permission. Tap below to try again."):"Get an instant alert the moment a driver accepts your ride."}
            </div>
          </div>
          <div style={{padding:'20px 20px 22px',background:'#fff'}}>
            {!notifLoading && !hasError && (
              <div style={{display:'flex',alignItems:'center',gap:'10px',background:'#EFF6FF',border:'1px solid #BFDBFE',borderRadius:'12px',padding:'11px 14px',marginBottom:'16px'}}>
                <div style={{width:'32px',height:'32px',borderRadius:'8px',flexShrink:0,background:'linear-gradient(135deg,#3B82F6,#2563EB)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <Bell size={15} color="#fff" strokeWidth={2.2}/>
                </div>
                <div>
                  <div style={{fontSize:'12.5px',fontWeight:700,color:'#1E40AF'}}>Driver found? You'll hear it first.</div>
                  <div style={{fontSize:'11.5px',color:'#3B82F6',marginTop:'2px'}}>No need to keep this tab open</div>
                </div>
              </div>
            )}
            {notifLoading && (
              <div style={{display:'flex',justifyContent:'center',gap:'7px',marginBottom:'18px',paddingTop:'4px'}}>
                {[0,1,2].map(i=>(
                  <div key={i} style={{width:'8px',height:'8px',borderRadius:'50%',background:'#3B82F6',animation:`dotPulse 1.2s ease-in-out ${i*.2}s infinite`}}/>
                ))}
              </div>
            )}
            {!notifLoading && (
              <div style={{display:'flex',flexDirection:'column',gap:'9px'}}>
                <button className="notif-allow-btn" onClick={onAllow} style={{
                  width:'100%',padding:'14px 0',borderRadius:'14px',border:'none',
                  background:hasError?'linear-gradient(135deg,#EF4444,#B91C1C)':'linear-gradient(135deg,#3B82F6,#1D4ED8)',
                  color:'#fff',fontSize:'15px',fontWeight:700,cursor:'pointer',
                  display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',
                  transition:'filter .15s, transform .15s',
                  boxShadow:hasError?'0 4px 16px rgba(239,68,68,.32)':'0 4px 16px rgba(37,99,235,.32)',
                }}>
                  {hasError?<><RotateCcw size={15} strokeWidth={2.5}/> Try again</>:<><Bell size={15} strokeWidth={2.5}/> Allow notifications</>}
                </button>
                <button className="notif-skip-btn" onClick={onSkip} style={{
                  width:'100%',padding:'13px 0',borderRadius:'14px',border:'1.5px solid #E5E7EB',
                  background:'#fff',color:'#6B7280',fontSize:'14px',fontWeight:600,cursor:'pointer',transition:'background .12s',
                }}>
                  {hasError?'Dismiss':'Not now'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default function ConfirmationModal({
  onClose,
  onPaymentCancelled,
  onRetry,
  onCancel,
  rides,
}) {
  const [status, setStatus] = useState('checking_payment');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [driver, setDriver] = useState(null);
  const [visible, setVisible] = useState(false);
  const [liveRide, setLiveRide] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [showNotifPopup, setShowNotifPopup] = useState(false);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState("");
  const [sweepAngle, setSweepAngle] = useState(0);

  const [accountPhone, setAccountPhone] = useState(null);
  const [phoneSkipped, setPhoneSkipped] = useState(false);

  const timerRef = useRef(null);
  const closeTimeoutRef = useRef(null);
  const mountedRef = useRef(true);
  const lastRideIdRef = useRef(null);
  const unsubRef = useRef(null);
  const accountUnsubRef = useRef(null);
  const notifRequestedRef = useRef(false);
  const didTimeoutRef = useRef(false);

  const seedRide = useMemo(() => {
    if (!rides?.length) return null;
    return rides.find(r => r.paymentStatus === 'succeeded' && r.status !== 'completed' && r.status !== 'cancelled')
      ?? rides.find(r => r.status === 'pending_payment')
      ?? null;
  }, [rides]);

  const currentRide = liveRide ?? seedRide;
  const rideId = currentRide?.id ?? null;
  const riderUid = currentRide?.uid ?? null;

  useEffect(() => {
    mountedRef.current = true;
    const t = setTimeout(() => { if (mountedRef.current) setVisible(true); }, 30);
    return () => {
      mountedRef.current = false;
      clearTimeout(t);
      clearTimeout(closeTimeoutRef.current);
      clearInterval(timerRef.current);
      try { unsubRef.current?.(); } catch {}
      try { accountUnsubRef.current?.(); } catch {}
    };
  }, []);

  // ── Radar sweep animation during searching ────────────────────────────────
  useEffect(() => {
    if (status !== 'searching') return;
    let angle = 0;
    const id = setInterval(() => {
      angle = (angle + 2) % 360;
      setSweepAngle(angle);
    }, 30);
    return () => clearInterval(id);
  }, [status]);

  useEffect(() => {
    if (!rideId) return;
    if (rideId === lastRideIdRef.current) return;
    lastRideIdRef.current = rideId;
    try { unsubRef.current?.(); } catch {}
    unsubRef.current = onSnapshot(
      doc(db, 'Rides', rideId),
      (snap) => {
        if (!snap.exists() || !mountedRef.current) return;
        setLiveRide({ id: snap.id, ...snap.data() });
      },
      (err) => console.warn('[ConfirmationModal] snapshot error:', err)
    );
  }, [rideId]);

  useEffect(() => {
    if (!riderUid) return;
    try { accountUnsubRef.current?.(); } catch {}
    try {
      accountUnsubRef.current = onSnapshot(
        doc(db, "Accounts", riderUid),
        (snap) => {
          if (!mountedRef.current) return;
          const data = snap.exists() ? snap.data() : null;
          setAccountPhone(data?.phone ?? "");
        },
        (err) => {
          console.warn("[ConfirmationModal] account snapshot error:", err);
          setAccountPhone("");
        }
      );
    } catch (err) {
      console.warn("[ConfirmationModal] account subscribe threw:", err);
      setAccountPhone("");
    }
    return () => {
      try { accountUnsubRef.current?.(); } catch {}
    };
  }, [riderUid]);

  useEffect(() => {
    if (!rideId) { setPhoneSkipped(false); return; }
    try {
      const flag = sessionStorage.getItem(PHONE_SKIP_KEY(rideId));
      setPhoneSkipped(flag === "1");
    } catch {
      setPhoneSkipped(false);
    }
  }, [rideId]);

  useEffect(() => {
    if (!currentRide) return;
    const s = currentRide.status;
    switch (s) {
      case 'pending_payment':
        setStatus('checking_payment');
        break;
      case 'searching_driver':
      case 'searching':
        if (status === 'timeout') {
          didTimeoutRef.current = false;
          setStatus('searching');
          setDriver(null);
        } else if (!didTimeoutRef.current) {
          setStatus('searching');
          setDriver(null);
        }
        break;
      case 'driver_assigned':
        clearInterval(timerRef.current);
        timerRef.current = null;
        if (currentRide.driver) setDriver(currentRide.driver);
        setStatus('assigned');
        break;
      case 'timeout':
      case 'cancelled':
        clearInterval(timerRef.current);
        timerRef.current = null;
        setStatus('timeout');
        break;
      default:
        break;
    }
  }, [currentRide]);

  useEffect(() => {
    if (status !== 'searching') {
      clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }
    const updateTimer = () => {
      if (!currentRide?.expiresAt) { setSecondsLeft(0); return; }
      const remaining = getSecondsRemaining(currentRide.expiresAt);
      setSecondsLeft(remaining);
      if (remaining <= 0 && !didTimeoutRef.current) {
        didTimeoutRef.current = true;
        clearInterval(timerRef.current);
        timerRef.current = null;
        setStatus('timeout');
      }
    };
    updateTimer();
    clearInterval(timerRef.current);
    timerRef.current = setInterval(updateTimer, 1000);
    return () => { clearInterval(timerRef.current); timerRef.current = null; };
  }, [status, currentRide?.expiresAt]);

  useEffect(() => {
    if (status !== 'assigned') return;
    const t = setTimeout(() => { if (mountedRef.current) handleClose(); }, 1500);
    return () => clearTimeout(t);
  }, [status]);

  useEffect(() => {
    if (status !== 'searching') return;
    if (notifRequestedRef.current) return;
    if (!("Notification" in window)) return;
    if (window.Notification.permission === "default") {
      setShowNotifPopup(true);
      notifRequestedRef.current = true;
    } else if (window.Notification.permission === "granted" && rideId && riderUid && !currentRide?.riderFcmToken) {
      registerRiderFcmToken(rideId, riderUid).catch(err =>
        console.warn("[Rider] Auto token failed:", err.message)
      );
    }
  }, [status, rideId, riderUid, currentRide?.riderFcmToken]);

  const total = useMemo(() => {
    const val = Number(currentRide?.fareTotal ?? 0);
    return Number.isFinite(val) ? val.toFixed(2) : '0.00';
  }, [currentRide]);

  const miles = useMemo(() => {
    const val = Number(currentRide?.tripDistanceMiles ?? 0);
    return Number.isFinite(val) ? val.toFixed(1) : '0.0';
  }, [currentRide]);

  const createdAtLabel = useMemo(() => {
    const raw = currentRide?.createdAt;
    if (!raw) return null;
    const date = raw instanceof Date ? raw : raw?.toDate?.() ?? new Date(raw);
    return isNaN(date.getTime()) ? null : date.toLocaleString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  }, [currentRide?.createdAt]);

  const progress = useMemo(() => {
    if (!currentRide?.createdAt) return 0;
    const createdMs = currentRide.createdAt instanceof Date
      ? currentRide.createdAt.getTime()
      : currentRide.createdAt?.toDate?.()?.getTime?.() ?? new Date(currentRide.createdAt).getTime();
    if (isNaN(createdMs)) return 0;
    const elapsedSec = Math.min(SEARCH_LIMIT_SEC, Math.floor((Date.now() - createdMs) / 1000));
    return (elapsedSec / SEARCH_LIMIT_SEC) * 100;
  }, [currentRide?.createdAt, secondsLeft]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const isUrgent = secondsLeft < 60;

  const pickup  = currentRide?.pickup  ?? '—';
  const dropoff = currentRide?.dropoff ?? '—';
  const rideLabel = currentRide?.rideLabel ?? currentRide?.rideType ?? 'Ride';

  const shouldShowPhoneCapture =
    status === 'searching' &&
    accountPhone !== null &&
    !accountPhone &&
    !phoneSkipped &&
    !!riderUid;

  const handleSkipPhone = () => {
    setPhoneSkipped(true);
    if (rideId) {
      try { sessionStorage.setItem(PHONE_SKIP_KEY(rideId), "1"); } catch {}
    }
  };

  const handlePhoneSaved = (savedPhone) => {
    setAccountPhone(savedPhone);
  };

  const handleClose = async () => {
    if (status === 'checking_payment' && rideId) {
      deleteDoc(doc(db, 'Rides', rideId)).catch(err => console.warn(err));
      setVisible(false);
      closeTimeoutRef.current = setTimeout(() => onPaymentCancelled?.(), 260);
      return;
    }
    setVisible(false);
    closeTimeoutRef.current = setTimeout(() => onClose?.(), 260);
  };

  const handleWaitMore = async () => {
    if (!rideId || !riderUid) return;
    setActionLoading(true);
    didTimeoutRef.current = false;
    try {
      await callableExtendRideSearch({ rideId, uid: riderUid });
    } catch (err) {
      console.error('Extend error:', err);
      didTimeoutRef.current = true;
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelRide = async () => {
    if (!rideId || !riderUid) return;
    setCancelLoading(true);
    setCancelError('');
    try {
      await callableCancelRide({ rideId, uid: riderUid });
      onCancel?.({ rideId, uid: riderUid });
      setVisible(false);
      closeTimeoutRef.current = setTimeout(() => onClose?.(), 260);
    } catch (err) {
      console.error('[ConfirmationModal] cancelRide error:', err);
      setCancelError(err?.message || 'Could not cancel. Please try again.');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleEnableNotifications = async () => {
    if (!rideId || !riderUid) { setNotifError("Ride info missing"); return; }
    setNotifLoading(true);
    setNotifError("");
    try {
      await registerRiderFcmToken(rideId, riderUid);
      setShowNotifPopup(false);
    } catch (err) {
      setNotifError(err.message || "Failed to enable notifications");
    } finally {
      setNotifLoading(false);
    }
  };

  const handleSkipNotifications = () => {
    setShowNotifPopup(false);
    setNotifError("");
  };

  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  // ── Init Mapbox ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible || mapRef.current) return;

    const MAPBOX_TOKEN = "pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA";
    const MAP_STYLE = "mapbox://styles/mapbox/dark-v11";

    const script = document.createElement('script');
    script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js';
    script.async = true;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css';

    document.head.appendChild(link);
    document.head.appendChild(script);

    script.onload = () => {
      if (!mapContainerRef.current) return;
      const mapboxgl = window.mapboxgl;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      const centerLat = currentRide?.pickupLat ?? 28.5383;
      const centerLng = currentRide?.pickupLng ?? -81.3792;

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: MAP_STYLE,
        center: [centerLng, centerLat],
        zoom: 14,
        pitch: 35,
        bearing: -25,
        interactive: false,
        attributionControl: false,
      });

      map.on('load', () => {
        mapRef.current = map;
        let bearing = -25;
        const drift = setInterval(() => {
          bearing += 0.05;
          map.setBearing(bearing);
        }, 100);
        map.on('remove', () => clearInterval(drift));
      });
    };

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [visible, currentRide?.pickupLat, currentRide?.pickupLng]);

  return (
    <div style={{
      position:'fixed',inset:0,zIndex:999,
      transition:'opacity .25s ease',opacity:visible?1:0,
    }}>
      {/* Mapbox background */}
      <div ref={mapContainerRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      {/* Backdrop overlay */}
      <div style={{
        position:'absolute',inset:0,background:'rgba(0,0,0,.15)',backdropFilter:'blur(3px)',
        pointerEvents:status==='searching'?'none':'auto',
      }}/>

      {showNotifPopup && (
        <NotificationPopup
          notifLoading={notifLoading}
          notifError={notifError}
          onAllow={handleEnableNotifications}
          onSkip={handleSkipNotifications}
        />
      )}

      {/* Immersive floating card container */}
      <div style={{
        position:'absolute',bottom:0,left:0,right:0,
        display:'flex',justifyContent:'center',alignItems:'flex-end',
        padding:'20px',pointerEvents:'auto',
      }}>
        <div style={{
          width:'100%',maxWidth:'420px',
          background:'rgba(15,23,42,.92)',backdropFilter:'blur(12px)',
          borderRadius:'24px 24px 0 0',
          overflow:'hidden',border:'1px solid rgba(255,255,255,.08)',
          boxShadow:'0 20px 80px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.1)',
          transition:'transform .28s cubic-bezier(.34,1.56,.64,1), opacity .25s ease',
          transform:visible?'translateY(0)':'translateY(400px)',
        }}>

          {/* ── CHECKING PAYMENT ── */}
          {status === 'checking_payment' && (
            <div style={{padding:'32px 24px',textAlign:'center'}}>
              <Loader2 size={36} color="#60A5FA" style={{animation:'spin 1s linear infinite',marginBottom:'16px'}}/>
              <h3 style={{fontSize:'20px',fontWeight:900,color:'#E2E8F0',marginBottom:'6px'}}>Checking payment...</h3>
              <p style={{fontSize:'13px',color:'#94A3B8',marginBottom:'20px'}}>
                Verifying your payment — this only takes a moment.
              </p>
              <button onClick={handleClose} style={{
                width:'100%',padding:'12px',borderRadius:'12px',border:'1.5px solid rgba(255,255,255,.1)',
                background:'rgba(255,255,255,.05)',fontSize:'14px',fontWeight:700,color:'#94A3B8',cursor:'pointer',
                transition:'all .15s',
              }}>
                Cancel
              </button>
            </div>
          )}

          {/* ── SEARCHING ── */}
          {status === 'searching' && (
            <div style={{padding:'0'}}>
              {progress > 0 && (
                <div style={{height:'3px',background:'rgba(255,255,255,.1)',overflow:'hidden'}}>
                  <div style={{
                    height:'100%',width:`${100-progress}%`,
                    background:isUrgent?'linear-gradient(90deg,#F59E0B,#EF4444)':'linear-gradient(90deg,#22C55E,#16A34A)',
                    transition:'width 1s linear',
                  }}/>
                </div>
              )}
              <div style={{padding:'24px'}}>
                <SearchingMap
                  isUrgent={isUrgent}
                  pickupLat={currentRide?.pickupLat}
                  pickupLng={currentRide?.pickupLng}
                  sweepAngle={sweepAngle}
                />

                <h3 style={{fontSize:'20px',fontWeight:900,color:'#E2E8F0',marginBottom:'4px'}}>
                  {isUrgent?'Almost out of time…':'Finding your driver'}
                </h3>
                <p style={{fontSize:'12px',color:'#94A3B8',marginBottom:'18px'}}>
                  {isUrgent?'Searching nearby areas. Hang tight.':'Matching you with the nearest available driver.'}
                </p>

                <div style={{
                  background:isUrgent?'rgba(239,68,68,.1)':'rgba(34,197,74,.1)',
                  border:`1.5px solid ${isUrgent?'rgba(239,68,68,.3)':'rgba(34,197,74,.3)'}`,
                  borderRadius:'16px',padding:'16px 18px',marginBottom:'12px',
                }}>
                  <div style={{fontSize:'10px',fontWeight:800,letterSpacing:'1.2px',textTransform:'uppercase',color:isUrgent?'#FCA5A5':'#86EFAC',marginBottom:'6px'}}>
                    Time remaining
                  </div>
                  <div style={{fontFamily:'"JetBrains Mono",monospace',fontSize:'44px',fontWeight:700,lineHeight:1,letterSpacing:'-3px',color:isUrgent?'#EF4444':'#22C55E'}}>
                    {String(minutes).padStart(2,'0')}:{String(seconds).padStart(2,'0')}
                  </div>
                  {progress > 0 && (
                    <div style={{height:'3px',background:'rgba(255,255,255,.1)',borderRadius:'100px',marginTop:'12px',overflow:'hidden'}}>
                      <div style={{
                        height:'100%',width:`${progress}%`,
                        background:isUrgent?'linear-gradient(90deg,#F59E0B,#EF4444)':'linear-gradient(90deg,#22C55E,#16A34A)',
                        borderRadius:'100px',transition:'width 1s linear',
                      }}/>
                    </div>
                  )}
                  {createdAtLabel && (
                    <div style={{marginTop:'10px',fontSize:'11px',color:'#64748B'}}>
                      Booked {createdAtLabel}
                    </div>
                  )}
                </div>

                <div style={{background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',borderRadius:'12px',padding:'11px 13px',marginBottom:'10px',textAlign:'left'}}>
                  <div style={{display:'flex',gap:'10px'}}>
                    <div style={{display:'flex',flexDirection:'column',alignItems:'center',paddingTop:'2px'}}>
                      <div style={{width:'6px',height:'6px',borderRadius:'50%',background:'#60A5FA'}}/>
                      <div style={{width:'1px',flex:1,background:'rgba(255,255,255,.1)',minHeight:'12px',margin:'2px 0'}}/>
                      <div style={{width:'6px',height:'6px',borderRadius:'2px',background:'#22C55E',transform:'rotate(45deg)'}}/>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:'12px',fontWeight:700,color:'#E2E8F0',marginBottom:'6px'}}>{pickup}</div>
                      <div style={{fontSize:'12px',fontWeight:700,color:'#E2E8F0'}}>{dropoff}</div>
                    </div>
                  </div>
                </div>

                <div style={{background:isUrgent?'rgba(239,68,68,.08)':'rgba(34,197,74,.08)',border:`1px solid ${isUrgent?'rgba(239,68,68,.2)':'rgba(34,197,74,.2)'}`,borderRadius:'10px',padding:'9px 12px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:'12px',fontWeight:600,color:'#94A3B8'}}>{rideLabel} · {miles} mi</span>
                  <span style={{fontFamily:'"JetBrains Mono",monospace',fontSize:'14px',fontWeight:700,color:'#22C55E'}}>${total}</span>
                </div>

                {shouldShowPhoneCapture && (
                  <PhoneCaptureCard
                    uid={riderUid}
                    onSkip={handleSkipPhone}
                    onSaved={handlePhoneSaved}
                  />
                )}
              </div>
            </div>
          )}

          {/* ── ASSIGNED ── */}
          {status === 'assigned' && (
            <div style={{padding:'20px'}}>
              <div style={{background:'linear-gradient(135deg,rgba(34,197,74,.15),rgba(21,128,61,.15))',border:'1px solid rgba(34,197,74,.3)',borderRadius:'16px',padding:'20px',textAlign:'center',marginBottom:'14px'}}>
                <div style={{width:'60px',height:'60px',margin:'0 auto 12px',background:'rgba(34,197,74,.2)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',border:'2px solid rgba(34,197,74,.4)'}}>
                  <CheckCircle size={32} color="#22C55E" strokeWidth={2}/>
                </div>
                <h3 style={{fontSize:'22px',fontWeight:900,color:'#22C55E',marginBottom:'4px'}}>Driver matched!</h3>
                <p style={{fontSize:'12px',color:'#86EFAC',fontWeight:500}}>Your ride is confirmed and on the way</p>
              </div>

              {driver ? (
                <div style={{background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',borderRadius:'14px',padding:'12px',display:'flex',alignItems:'center',gap:'12px',marginBottom:'12px'}}>
                  <div style={{width:'42px',height:'42px',borderRadius:'50%',background:'linear-gradient(135deg,#22C55E,#15803D)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px',fontWeight:900,color:'#fff',flexShrink:0}}>
                    {driver.name?.[0]??'?'}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:'13px',fontWeight:800,color:'#E2E8F0'}}>{driver.name||'Driver'}</div>
                    <div style={{fontSize:'11px',color:'#94A3B8',marginTop:'1px'}}>{driver.vehicle||'Vehicle'} · {driver.plate||'Plate pending'}</div>
                  </div>
                  {driver.rating && (
                    <div style={{background:'rgba(251,146,60,.2)',border:'1px solid rgba(251,146,60,.4)',borderRadius:'6px',padding:'3px 8px',fontSize:'11px',fontWeight:800,color:'#FCA5A5',flexShrink:0}}>
                      ★ {driver.rating}
                    </div>
                  )}
                </div>
              ) : null}

              <div style={{background:'rgba(34,197,74,.1)',border:'1px solid rgba(34,197,74,.3)',borderRadius:'12px',padding:'11px 13px',display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
                <div>
                  <div style={{fontSize:'9px',fontWeight:800,color:'#86EFAC',letterSpacing:'1px',textTransform:'uppercase',marginBottom:'2px'}}>Confirmed fare</div>
                  <div style={{fontSize:'11px',color:'#94A3B8'}}>{rideLabel} · {miles} mi</div>
                </div>
                <div style={{fontFamily:'"JetBrains Mono",monospace',fontSize:'20px',fontWeight:700,color:'#22C55E'}}>${total}</div>
              </div>

              <button onClick={handleClose} style={{width:'100%',padding:'12px',background:'linear-gradient(135deg,#22C55E,#15803D)',border:'none',borderRadius:'12px',color:'#fff',fontWeight:800,fontSize:'14px',cursor:'pointer',transition:'filter .15s'}}>
                Track My Ride
              </button>
            </div>
          )}

          {/* ── TIMEOUT ── */}
          {status === 'timeout' && (
            <div style={{padding:'20px'}}>
              <div style={{background:'linear-gradient(135deg,rgba(239,68,68,.15),rgba(185,28,28,.15))',border:'1px solid rgba(239,68,68,.3)',borderRadius:'16px',padding:'20px',textAlign:'center',marginBottom:'14px'}}>
                <div style={{width:'60px',height:'60px',margin:'0 auto 12px',background:'rgba(239,68,68,.2)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',border:'2px solid rgba(239,68,68,.4)'}}>
                  <Clock size={32} color="#EF4444" strokeWidth={2}/>
                </div>
                <h3 style={{fontSize:'22px',fontWeight:900,color:'#EF4444',marginBottom:'4px'}}>No drivers available</h3>
                <p style={{fontSize:'12px',color:'#FCA5A5',fontWeight:500}}>We searched your area but couldn't find a nearby driver.</p>
              </div>

              <div style={{background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',borderRadius:'14px',padding:'12px',marginBottom:'12px'}}>
                <div style={{display:'flex',gap:'11px',alignItems:'flex-start'}}>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',paddingTop:'2px',flexShrink:0}}>
                    <div style={{width:'6px',height:'6px',borderRadius:'50%',background:'#64748B'}}/>
                    <div style={{width:'1px',flex:1,background:'rgba(255,255,255,.1)',minHeight:'12px',margin:'2px 0'}}/>
                    <div style={{width:'6px',height:'6px',borderRadius:'2px',background:'#22C55E',transform:'rotate(45deg)'}}/>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:'11px',fontWeight:700,color:'#E2E8F0',marginBottom:'6px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {pickup}
                    </div>
                    <div style={{fontSize:'11px',fontWeight:700,color:'#E2E8F0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {dropoff}
                    </div>
                  </div>
                  <div style={{flexShrink:0,background:'rgba(34,197,74,.15)',border:'1px solid rgba(34,197,74,.3)',borderRadius:'6px',padding:'2px 7px',fontFamily:'"JetBrains Mono",monospace',fontSize:'11px',fontWeight:700,color:'#22C55E'}}>
                    ${total}
                  </div>
                </div>
              </div>

              <div style={{fontSize:'9px',fontWeight:800,letterSpacing:'1.1px',textTransform:'uppercase',color:'#64748B',marginBottom:'10px'}}>
                What would you like to do?
              </div>

              <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                <button
                  onClick={handleWaitMore}
                  disabled={actionLoading || cancelLoading}
                  style={{
                    width:'100%',padding:'12px 0',borderRadius:'12px',border:'none',
                    background:(actionLoading || cancelLoading)?'rgba(34,197,74,.2)':'linear-gradient(135deg,#22C55E,#15803D)',
                    color:'#fff',fontSize:'14px',fontWeight:800,cursor:(actionLoading || cancelLoading)?'not-allowed':'pointer',
                    display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',
                    transition:'filter .15s',opacity:(actionLoading || cancelLoading)?0.6:1,
                  }}
                >
                  {actionLoading
                    ? <><Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/> Extending…</>
                    : <><RotateCcw size={14} strokeWidth={2.5}/> Keep searching</>
                  }
                </button>

                <button
                  onClick={handleCancelRide}
                  disabled={actionLoading || cancelLoading}
                  style={{
                    width:'100%',padding:'11px 0',borderRadius:'12px',
                    border:'1.5px solid rgba(255,255,255,.1)',
                    background:'rgba(255,255,255,.05)',
                    color:'#94A3B8',fontSize:'13px',fontWeight:700,cursor:(actionLoading || cancelLoading)?'not-allowed':'pointer',
                    opacity:(actionLoading || cancelLoading)?0.5:1,
                    display:'flex',alignItems:'center',justifyContent:'center',gap:'7px',
                    transition:'all .12s',
                  }}
                >
                  {cancelLoading
                    ? <><Loader2 size={13} style={{animation:'spin 1s linear infinite'}}/> Cancelling…</>
                    : 'Cancel this ride'
                  }
                </button>
              </div>
            </div>
          )}

          <style>{`
            @keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
          `}</style>
        </div>
      </div>
    </div>
  );
}
