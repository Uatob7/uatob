// src/App/UaTob/ConfirmationModal.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Clock, Car, CheckCircle, RotateCcw, Loader2, Bell, AlertCircle, MapPin, Navigation, Phone, Check, X } from 'lucide-react';
import { THEME as T } from '@/App/UaTob/pricing.js';
import { doc, deleteDoc, onSnapshot, getFirestore } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getMessaging, getToken } from 'firebase/messaging';
import { firebase_app } from '@/firebase/config';

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

// ─── NEW: Ride Search Radar ─────────────────────────────────────────────
// A live "scanning for drivers" radar with sweeping beam, concentric grid,
// and floating driver silhouettes that fade in/out at the perimeter.
function RideSearchRadar({ isUrgent }) {
  const [sweepAngle, setSweepAngle] = useState(0);

  useEffect(() => {
    let raf;
    let last = performance.now();
    let angle = 0;
    const tick = (now) => {
      const dt = now - last;
      last = now;
      // ~360° per 4 seconds → 90°/sec, scaled by dt
      angle = (angle + (dt * 0.09)) % 360;
      setSweepAngle(angle);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const accent  = isUrgent ? "#EF4444" : "#16A34A";
  const accent2 = isUrgent ? "#F59E0B" : "#22C55E";
  const ringRGB = isUrgent ? "239,68,68" : "22,163,74";

  // Sweep geometry (SVG viewBox 0 0 200 200, center 100,100)
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 92;
  const trailAng = sweepAngle;
  const leadAng  = (sweepAngle + 60) % 360;
  const trailX = 100 + R * Math.cos(toRad(trailAng));
  const trailY = 100 + R * Math.sin(toRad(trailAng));
  const leadX  = 100 + R * Math.cos(toRad(leadAng));
  const leadY  = 100 + R * Math.sin(toRad(leadAng));
  const tipX   = 100 + 88 * Math.cos(toRad(leadAng));
  const tipY   = 100 + 88 * Math.sin(toRad(leadAng));

  // Driver silhouettes around perimeter — each pulses on its own phase
  const driverPositions = [
    { angle: 25,  r: 70, delay: 0.0 },
    { angle: 115, r: 76, delay: 0.6 },
    { angle: 200, r: 68, delay: 1.1 },
    { angle: 295, r: 78, delay: 1.6 },
  ];

  return (
    <div style={{
      position: 'relative',
      width: 152, height: 152,
      margin: '0 auto 18px',
    }}>
      <style>{`
        @keyframes radarExpand {
          0%   { transform: scale(.5);  opacity: .85; }
          100% { transform: scale(2.2); opacity: 0;   }
        }
        @keyframes radarDriverPulse {
          0%, 100% { opacity: .25; transform: scale(.85); }
          50%      { opacity: 1;    transform: scale(1.1); }
        }
        @keyframes radarCenterPulse {
          0%, 100% { transform: scale(1);    box-shadow: 0 0 0 0 rgba(${ringRGB},.5); }
          50%      { transform: scale(1.06); box-shadow: 0 0 0 10px rgba(${ringRGB},0); }
        }
      `}</style>

      {/* Expanding pulse rings (behind everything) */}
      {[0, 1, 2].map((i) => (
        <div key={i} style={{
          position: 'absolute', inset: 0,
          borderRadius: '50%',
          border: `1.5px solid rgba(${ringRGB},.35)`,
          animation: `radarExpand 3s ease-out ${i * 1}s infinite`,
          pointerEvents: 'none',
        }}/>
      ))}

      {/* SVG radar canvas */}
      <svg
        viewBox="0 0 200 200"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      >
        <defs>
          {/* Sweep beam gradient */}
          <radialGradient id="radarSweep" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={accent}  stopOpacity="0"/>
            <stop offset="40%"  stopColor={accent}  stopOpacity=".25"/>
            <stop offset="100%" stopColor={accent2} stopOpacity=".75"/>
          </radialGradient>

          {/* Disc background */}
          <radialGradient id="radarDisc" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={accent} stopOpacity=".10"/>
            <stop offset="60%"  stopColor={accent} stopOpacity=".04"/>
            <stop offset="100%" stopColor={accent} stopOpacity="0"/>
          </radialGradient>

          {/* Subtle disc tint */}
          <linearGradient id="radarTint" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor="#FAFAFA"/>
            <stop offset="100%" stopColor="#F3F4F6"/>
          </linearGradient>
        </defs>

        {/* Disc background */}
        <circle cx="100" cy="100" r="94" fill="url(#radarTint)" />
        <circle cx="100" cy="100" r="94" fill="url(#radarDisc)" />

        {/* Concentric grid rings */}
        {[30, 55, 80].map((r) => (
          <circle
            key={r}
            cx="100" cy="100" r={r}
            fill="none"
            stroke={`rgba(${ringRGB},.18)`}
            strokeWidth="0.6"
            strokeDasharray="2 3"
          />
        ))}

        {/* Cross hairs */}
        <line x1="100" y1="6"  x2="100" y2="194" stroke={`rgba(${ringRGB},.12)`} strokeWidth="0.5"/>
        <line x1="6"   y1="100" x2="194" y2="100" stroke={`rgba(${ringRGB},.12)`} strokeWidth="0.5"/>

        {/* Sweep wedge */}
        <path
          d={`M 100 100 L ${trailX} ${trailY} A ${R} ${R} 0 0 1 ${leadX} ${leadY} Z`}
          fill="url(#radarSweep)"
          opacity="0.85"
        />

        {/* Leading beam line */}
        <line
          x1="100" y1="100" x2={leadX} y2={leadY}
          stroke={accent}
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity="0.95"
        />

        {/* Tip flare */}
        <circle cx={tipX} cy={tipY} r="2.6" fill={accent2} opacity="0.95"/>
        <circle cx={tipX} cy={tipY} r="5"   fill={accent}  opacity="0.20"/>

        {/* Outer border ring */}
        <circle cx="100" cy="100" r="94" fill="none" stroke={`rgba(${ringRGB},.5)`} strokeWidth="1.5"/>
      </svg>

      {/* Driver silhouettes drifting at the perimeter */}
      {driverPositions.map((p, i) => {
        const px = 76 + p.r * Math.cos(toRad(p.angle)) * (152 / 200) - 12;
        const py = 76 + p.r * Math.sin(toRad(p.angle)) * (152 / 200) - 12;
        return (
          <div key={i} style={{
            position: 'absolute',
            left: px, top: py,
            width: 24, height: 24,
            borderRadius: '50%',
            background: '#fff',
            border: `1.5px solid rgba(${ringRGB},.4)`,
            boxShadow: `0 2px 6px rgba(${ringRGB},.15)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: `radarDriverPulse 2.4s ease-in-out ${p.delay}s infinite`,
            zIndex: 2,
          }}>
            <Car size={11} color={accent} strokeWidth={2.2}/>
          </div>
        );
      })}

      {/* Center "you are here" pin */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 44, height: 44,
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${accent2}, ${accent})`,
        border: '3px solid #fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 4px 14px rgba(${ringRGB},.45)`,
        animation: 'radarCenterPulse 2s ease-in-out infinite',
        zIndex: 3,
      }}>
        <Navigation size={18} color="#fff" strokeWidth={2.4} style={{ marginTop: -1 }}/>
      </div>
    </div>
  );
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

  return (
    <div style={{
      position:'fixed',inset:0,background:'rgba(0,0,0,.55)',
      backdropFilter:'blur(10px)',display:'flex',justifyContent:'center',
      alignItems:'center',zIndex:999,padding:'20px',
      transition:'opacity .25s ease',opacity:visible?1:0,
    }}>
      {showNotifPopup && (
        <NotificationPopup
          notifLoading={notifLoading}
          notifError={notifError}
          onAllow={handleEnableNotifications}
          onSkip={handleSkipNotifications}
        />
      )}

      <div style={{
        maxWidth:'420px',width:'100%',background:'#fff',borderRadius:'28px',
        overflow:'hidden',boxShadow:'0 32px 100px rgba(0,0,0,.22)',
        border:'1px solid rgba(229,231,235,.8)',
        transition:'transform .28s cubic-bezier(.34,1.56,.64,1), opacity .25s ease',
        transform:visible?'scale(1) translateY(0)':'scale(.94) translateY(16px)',
      }}>

        {/* ── CHECKING PAYMENT ── */}
        {status === 'checking_payment' && (
          <div style={{padding:'40px',textAlign:'center'}}>
            <Loader2 size={40} color={T.accent} style={{animation:'spin 1s linear infinite',marginBottom:'20px'}}/>
            <h3 style={{fontSize:'22px',fontWeight:900,color:T.text,marginBottom:'8px'}}>Checking payment...</h3>
            <p style={{fontSize:'13px',color:T.textMuted,marginBottom:'24px'}}>
              Verifying your payment — this only takes a moment.
            </p>
            <button onClick={handleClose} style={{
              width:'100%',padding:'13px',borderRadius:'14px',border:`1.5px solid ${T.border}`,
              background:'#fff',fontSize:'14px',fontWeight:700,color:T.textMuted,cursor:'pointer',
            }}>
              Cancel
            </button>
          </div>
        )}

        {/* ── SEARCHING ── */}
        {status === 'searching' && (
          <>
            {progress > 0 && (
              <div style={{height:'4px',background:'#F3F4F6',overflow:'hidden'}}>
                <div style={{
                  height:'100%',width:`${100-progress}%`,
                  background:isUrgent?'linear-gradient(90deg,#F59E0B,#EF4444)':'linear-gradient(90deg,#22C55E,#16A34A)',
                  transition:'width 1s linear',
                }}/>
              </div>
            )}
            <div style={{padding:'28px 24px 24px',textAlign:'center'}}>

              {/* ── NEW RADAR ── */}
              <RideSearchRadar isUrgent={isUrgent} />

              <h3 style={{fontSize:'22px',fontWeight:900,color:T.text,marginBottom:'6px'}}>
                {isUrgent?'Almost out of time…':'Finding your driver'}
              </h3>
              <p style={{fontSize:'13px',color:T.textMuted,marginBottom:'20px'}}>
                {isUrgent?'Searching nearby areas. Hang tight.':'Matching you with the nearest available driver.'}
              </p>
              <div style={{
                background:isUrgent?'#FFF7ED':'#F9FAFB',
                border:`1.5px solid ${isUrgent?'#FED7AA':T.border}`,
                borderRadius:'18px',padding:'18px 20px',marginBottom:'14px',
              }}>
                <div style={{fontSize:'10px',fontWeight:800,letterSpacing:'1.2px',textTransform:'uppercase',color:isUrgent?'#D97706':T.textMuted,marginBottom:'8px'}}>
                  Time remaining
                </div>
                <div style={{fontFamily:'"JetBrains Mono",monospace',fontSize:'48px',fontWeight:700,lineHeight:1,letterSpacing:'-3px',color:isUrgent?'#EF4444':T.accent}}>
                  {String(minutes).padStart(2,'0')}
                  <span style={{fontSize:'24px',opacity:0.35,margin:'0 1px'}}>:</span>
                  {String(seconds).padStart(2,'0')}
                </div>
                {progress > 0 && (
                  <div style={{height:'4px',background:T.border,borderRadius:'100px',marginTop:'14px',overflow:'hidden'}}>
                    <div style={{
                      height:'100%',width:`${progress}%`,
                      background:isUrgent?'linear-gradient(90deg,#F59E0B,#EF4444)':'linear-gradient(90deg,#22C55E,#16A34A)',
                      borderRadius:'100px',transition:'width 1s linear',
                    }}/>
                  </div>
                )}
                {createdAtLabel && (
                  <div style={{marginTop:'10px',fontSize:'11px',color:T.textMuted}}>
                    Booked {createdAtLabel}
                  </div>
                )}
              </div>
              <div style={{background:'#FAFAFA',border:`1px solid ${T.border}`,borderRadius:'14px',padding:'12px 14px',marginBottom:'10px',textAlign:'left'}}>
                <div style={{display:'flex',gap:'11px'}}>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',paddingTop:'3px'}}>
                    <div style={{width:'7px',height:'7px',borderRadius:'50%',background:T.ink}}/>
                    <div style={{width:'1px',flex:1,background:T.border,minHeight:'14px',margin:'3px 0'}}/>
                    <div style={{width:'7px',height:'7px',borderRadius:'2px',background:T.accent,transform:'rotate(45deg)'}}/>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:'12px',fontWeight:700,color:T.text,marginBottom:'7px'}}>{pickup}</div>
                    <div style={{fontSize:'12px',fontWeight:700,color:T.text}}>{dropoff}</div>
                  </div>
                </div>
              </div>

              <div style={{background:'#F0FDF4',border:`1px solid ${T.accentBorder}`,borderRadius:'12px',padding:'10px 14px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:'12px',fontWeight:600,color:T.textMuted}}>{rideLabel} · {miles} mi</span>
                <span style={{fontFamily:'"JetBrains Mono",monospace',fontSize:'15px',fontWeight:700,color:T.accent}}>${total}</span>
              </div>

              {shouldShowPhoneCapture && (
                <PhoneCaptureCard
                  uid={riderUid}
                  onSkip={handleSkipPhone}
                  onSaved={handlePhoneSaved}
                />
              )}
            </div>
          </>
        )}

        {/* ── ASSIGNED ── */}
        {status === 'assigned' && (
          <>
            <div style={{background:'linear-gradient(135deg,#22C55E 0%,#15803D 100%)',padding:'36px 24px 28px',textAlign:'center',position:'relative',overflow:'hidden'}}>
              <div style={{position:'absolute',inset:0,background:'repeating-linear-gradient(45deg,rgba(255,255,255,.03) 0px,rgba(255,255,255,.03) 1px,transparent 1px,transparent 20px)'}}/>
              {[0,1].map(i=>(
                <div key={i} style={{
                  position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',
                  width:`${130+i*70}px`,height:`${130+i*70}px`,borderRadius:'50%',
                  border:'1.5px solid rgba(255,255,255,.14)',animation:`burstRing 2s ease-out ${i*0.35}s infinite`,
                }}/>
              ))}
              <div style={{position:'relative',zIndex:1}}>
                <div style={{width:'76px',height:'76px',margin:'0 auto 14px',background:'rgba(255,255,255,.18)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',border:'2px solid rgba(255,255,255,.35)'}}>
                  <CheckCircle size={38} color="#fff" strokeWidth={2}/>
                </div>
                <h3 style={{fontSize:'26px',fontWeight:900,color:'#fff',marginBottom:'4px'}}>Driver matched!</h3>
                <p style={{fontSize:'13px',color:'rgba(255,255,255,.8)',fontWeight:500}}>Your ride is confirmed and on the way</p>
              </div>
            </div>
            <div style={{padding:'20px 22px 22px'}}>
              {driver ? (
                <div style={{background:'#F9FAFB',border:`1px solid ${T.border}`,borderRadius:'16px',padding:'14px',display:'flex',alignItems:'center',gap:'13px',marginBottom:'14px'}}>
                  <div style={{width:'46px',height:'46px',borderRadius:'50%',background:'linear-gradient(135deg,#22C55E,#15803D)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',fontWeight:900,color:'#fff'}}>
                    {driver.name?.[0]??'?'}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:'14px',fontWeight:800,color:T.text}}>{driver.name||'Driver'}</div>
                    <div style={{fontSize:'11.5px',color:T.textMuted,marginTop:'2px'}}>{driver.vehicle||'Vehicle'} · {driver.plate||'Plate pending'}</div>
                  </div>
                  {driver.rating && (
                    <div style={{background:'#FEF9C3',border:'1px solid #FEF08A',borderRadius:'8px',padding:'4px 10px',fontSize:'12px',fontWeight:800,color:'#854D0E'}}>
                      ★ {driver.rating}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{background:'#F0FDF4',border:`1px solid ${T.accentBorder}`,borderRadius:'14px',padding:'13px 15px',display:'flex',alignItems:'center',gap:'10px',marginBottom:'14px'}}>
                  <Car size={18} color={T.accent}/>
                  <span style={{fontSize:'13px',fontWeight:700,color:T.accent}}>Driver is heading to your pickup</span>
                </div>
              )}
              <div style={{background:'#F9FAFB',border:`1px solid ${T.border}`,borderRadius:'13px',padding:'12px 14px',display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'14px'}}>
                <div>
                  <div style={{fontSize:'10px',fontWeight:800,color:T.textMuted,letterSpacing:'1px',textTransform:'uppercase',marginBottom:'3px'}}>Confirmed fare</div>
                  <div style={{fontSize:'12px',color:T.textMuted}}>{rideLabel} · {miles} mi</div>
                </div>
                <div style={{fontFamily:'"JetBrains Mono",monospace',fontSize:'22px',fontWeight:700,color:T.accent}}>${total}</div>
              </div>
              <button onClick={handleClose} style={{width:'100%',padding:'14px',background:T.accent,border:'none',borderRadius:'14px',color:'#fff',fontWeight:800,fontSize:'15px',cursor:'pointer'}}>
                Track My Ride
              </button>
            </div>
          </>
        )}

        {/* ── TIMEOUT ── */}
        {status === 'timeout' && (
          <>
            <style>{`
              @keyframes timeoutPulse {
                0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,.25); }
                50%      { box-shadow: 0 0 0 14px rgba(239,68,68,0); }
              }
              @keyframes floatDot {
                0%,100% { transform: translateY(0px); opacity: .5; }
                50%      { transform: translateY(-6px); opacity: .9; }
              }
              @keyframes slideUpIn {
                from { opacity: 0; transform: translateY(12px); }
                to   { opacity: 1; transform: translateY(0);    }
              }
              .timeout-retry-btn:hover  { filter: brightness(1.07); transform: translateY(-1px); box-shadow: 0 8px 24px rgba(22,163,74,.36) !important; }
              .timeout-retry-btn:active { filter: brightness(.96);  transform: translateY(0); }
              .timeout-cancel-btn:hover  { background: #FEF2F2 !important; border-color: #FECACA !important; color: #DC2626 !important; }
              .timeout-cancel-btn:active { background: #FEE2E2 !important; }
            `}</style>

            <div style={{
              background: 'linear-gradient(160deg, #FFF8F0 0%, #FFF1F2 50%, #FEF2F2 100%)',
              padding: '34px 24px 26px',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', inset: 0, opacity: .55,
                backgroundImage: 'radial-gradient(circle, #FCA5A5 1px, transparent 1px)',
                backgroundSize: '18px 18px',
              }}/>
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -60%)',
                width: '220px', height: '220px', borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(251,146,60,.15) 0%, transparent 70%)',
                pointerEvents: 'none',
              }}/>
              {[
                { top: '20px',  left: '20px',  delay: '0s',    size: 6  },
                { top: '28px',  right: '32px', delay: '.4s',   size: 5  },
                { top: '52px',  left: '44px',  delay: '.8s',   size: 4  },
                { bottom: '26px', right: '18px', delay: '.2s', size: 7  },
                { bottom: '18px', left: '28px',  delay: '.6s', size: 5  },
              ].map((d, i) => (
                <div key={i} style={{
                  position: 'absolute', ...d,
                  width: d.size, height: d.size,
                  borderRadius: '50%',
                  background: '#FCA5A5',
                  animation: `floatDot 2.8s ease-in-out ${d.delay} infinite`,
                }}/>
              ))}

              <div style={{
                position: 'relative', zIndex: 1,
                width: '104px', height: '104px',
                margin: '0 auto 20px',
              }}>
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  border: '1.5px dashed rgba(239,68,68,.22)',
                }}/>
                <div style={{
                  position: 'absolute', inset: '12px', borderRadius: '50%',
                  border: '1px solid rgba(239,68,68,.14)',
                  background: 'rgba(254,242,242,.6)',
                }}/>
                <div style={{
                  position: 'absolute', inset: '24px', borderRadius: '50%',
                  background: 'linear-gradient(145deg, #F87171, #DC2626)',
                  boxShadow: '0 6px 24px rgba(220,38,38,.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  animation: 'timeoutPulse 2.6s ease-in-out infinite',
                }}>
                  <Clock size={20} color="#fff" strokeWidth={2.5}/>
                </div>
                {[0, 1, 2].map(i => {
                  const angle = (i * 120 - 90) * (Math.PI / 180);
                  const r = 42;
                  const x = 52 + r * Math.cos(angle) - 9;
                  const y = 52 + r * Math.sin(angle) - 9;
                  return (
                    <div key={i} style={{
                      position: 'absolute',
                      top: y, left: x,
                      width: '18px', height: '18px',
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,.9)',
                      border: '1.5px solid rgba(239,68,68,.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 2px 6px rgba(0,0,0,.08)',
                    }}>
                      <Car size={9} color="#F87171" strokeWidth={2}/>
                    </div>
                  );
                })}
              </div>

              <div style={{
                position: 'relative', zIndex: 1,
                fontSize: '22px', fontWeight: 900,
                color: '#1C0A00', letterSpacing: '-0.4px',
                lineHeight: 1.2, marginBottom: '7px',
              }}>
                No drivers available
              </div>
              <div style={{
                position: 'relative', zIndex: 1,
                fontSize: '13px', fontWeight: 500,
                color: '#9A3412', lineHeight: 1.65,
                maxWidth: '270px', margin: '0 auto',
              }}>
                We searched your area but couldn't find a nearby driver.
              </div>
            </div>

            <div style={{ padding: '18px 20px 22px' }}>

              <div style={{
                background: '#FAFAFA', border: '1px solid #E5E7EB',
                borderRadius: '16px', padding: '13px 15px',
                marginBottom: '14px',
                animation: 'slideUpIn .3s ease both',
              }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '2px', flexShrink: 0 }}>
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#374151' }}/>
                    <div style={{ width: '1.5px', flex: 1, background: '#E5E7EB', minHeight: '14px', margin: '3px 0' }}/>
                    <div style={{ width: '7px', height: '7px', borderRadius: '2px', background: T.accent, transform: 'rotate(45deg)' }}/>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '7px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {pickup}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {dropoff}
                    </div>
                  </div>
                  <div style={{
                    flexShrink: 0, background: '#F0FDF4',
                    border: `1px solid ${T.accentBorder}`,
                    borderRadius: '8px', padding: '4px 9px',
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: '13px', fontWeight: 700, color: T.accent,
                  }}>
                    ${total}
                  </div>
                </div>
              </div>

              <div style={{
                fontSize: '10px', fontWeight: 800, letterSpacing: '1.1px',
                textTransform: 'uppercase', color: '#9CA3AF',
                marginBottom: '10px',
                animation: 'slideUpIn .38s ease .08s both',
              }}>
                What would you like to do?
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', animation: 'slideUpIn .4s ease .1s both' }}>
                <button
                  className="timeout-retry-btn"
                  onClick={handleWaitMore}
                  disabled={actionLoading || cancelLoading}
                  style={{
                    width: '100%', padding: '15px 0',
                    borderRadius: '16px', border: 'none',
                    background: (actionLoading || cancelLoading)
                      ? '#D1FAE5'
                      : 'linear-gradient(135deg, #22C55E, #15803D)',
                    color: '#fff',
                    fontSize: '15px', fontWeight: 800,
                    cursor: (actionLoading || cancelLoading) ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    transition: 'filter .15s, transform .15s, box-shadow .15s',
                    boxShadow: (actionLoading || cancelLoading) ? 'none' : '0 4px 18px rgba(22,163,74,.28)',
                  }}
                >
                  {actionLoading
                    ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }}/> Extending search…</>
                    : <><RotateCcw size={16} strokeWidth={2.5}/> Keep searching</>
                  }
                </button>

                <button
                  className="timeout-cancel-btn"
                  onClick={handleCancelRide}
                  disabled={actionLoading || cancelLoading}
                  style={{
                    width: '100%', padding: '14px 0',
                    borderRadius: '16px',
                    border: '1.5px solid #E5E7EB',
                    background: '#fff',
                    color: '#6B7280',
                    fontSize: '14px', fontWeight: 700,
                    cursor: (actionLoading || cancelLoading) ? 'not-allowed' : 'pointer',
                    opacity: (actionLoading || cancelLoading) ? 0.5 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                    transition: 'background .12s, border-color .12s, color .12s',
                  }}
                >
                  {cancelLoading
                    ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }}/> Cancelling…</>
                    : 'Cancel this ride'
                  }
                </button>
              </div>
            </div>
          </>
        )}

        <style>{`
          @keyframes radarRing  { 0%{transform:scale(0.55);opacity:.8} 100%{transform:scale(1.75);opacity:0} }
          @keyframes burstRing  { 0%{transform:translate(-50%,-50%) scale(0.5);opacity:.5} 100%{transform:translate(-50%,-50%) scale(1.5);opacity:0} }
          @keyframes spin       { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        `}</style>
      </div>
    </div>
  );
}
