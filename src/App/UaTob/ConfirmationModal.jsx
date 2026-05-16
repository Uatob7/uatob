// src/App/UaTob/ConfirmationModal.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Clock, Car, CheckCircle, RotateCcw, Loader2, Bell,
  AlertCircle, MapPin, Navigation, Phone, Check, X,
  ChevronDown, Zap, Shield,
} from 'lucide-react';
import { THEME as T } from '@/App/UaTob/pricing.js';
import {
  doc, deleteDoc, onSnapshot, updateDoc,
  serverTimestamp, getFirestore,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getMessaging, getToken } from 'firebase/messaging';
import { firebase_app } from '@/firebase/config';

const db        = getFirestore(firebase_app);
const functions = getFunctions(firebase_app, "us-east1");
const callableExtendRideSearch  = httpsCallable(functions, "extendRideSearch");
const callableSaveRiderToken    = httpsCallable(functions, "saveRiderFcmToken");
const callableCancelRide        = httpsCallable(functions, "cancelRide");
const callableUpdateRiderPhone  = httpsCallable(functions, "updateRiderPhone");

const VAPID_KEY        = "BJ_sRHZonSGCKk2mB2i9ofTRS8ouFVMV-I15FX4sqdUXHyVb1lo6H-N4GMPrlcIIshRlykQicaxkxxFxcYcI4JQ";
const SEARCH_LIMIT_SEC = 7 * 60;
const PHONE_SKIP_KEY   = (rideId) => `uatob_phone_skipped_${rideId}`;

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

function digitsOnly(s) { return String(s ?? "").replace(/\D/g, ""); }

// ─── RIDE SEARCH RADAR (overlay version) ──────────────────────────────────
// Floats on top of the Mapbox background, centered above the sheet.
// Center  = rider's pickup (visually anchored on the map)
// Sweep   = rotating beam (~4s/revolution)
// Drivers = candidateDrivers, positioned by REAL bearing+distance from pickup
// Live    = new drivers fade-in; sweep lights each as the beam crosses
// Time    = elapsed since requestSentAt
function RideSearchRadarOverlay({
  isUrgent,
  pickupLat,
  pickupLng,
  candidateDrivers = [],
  requestSentAt,
}) {
  const [sweepAngle, setSweepAngle] = useState(0);
  const [now, setNow]               = useState(() => Date.now());
  const seenUidsRef                 = useRef(new Set());

  useEffect(() => {
    let raf;
    let last = performance.now();
    let angle = 0;
    const tick = (t) => {
      const dt = t - last;
      last = t;
      angle = (angle + dt * 0.09) % 360;
      setSweepAngle(angle);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const accent  = isUrgent ? "#EF4444" : "#22C55E";
  const accent2 = isUrgent ? "#F59E0B" : "#4ADE80";
  const ringRGB = isUrgent ? "239,68,68" : "34,197,94";

  const elapsedSec = useMemo(() => {
    const ms = requestSentAt?.toMillis?.()
      ?? (requestSentAt?.seconds ? requestSentAt.seconds * 1000 : null)
      ?? (requestSentAt instanceof Date ? requestSentAt.getTime() : null);
    if (!ms) return null;
    return Math.max(0, Math.floor((now - ms) / 1000));
  }, [requestSentAt, now]);

  const elapsedLabel = elapsedSec != null
    ? `${Math.floor(elapsedSec / 60)}:${String(elapsedSec % 60).padStart(2, '0')}`
    : null;

  const drivers = useMemo(() => {
    if (!Array.isArray(candidateDrivers) || candidateDrivers.length === 0) return [];

    const maxRangeMiles = Math.max(
      1,
      ...candidateDrivers
        .map(d => Number(d?.distance ?? 0))
        .filter(n => Number.isFinite(n))
    );

    const hasPickup = Number.isFinite(pickupLat) && Number.isFinite(pickupLng);

    return candidateDrivers
      .filter(d => d && typeof d.uid === "string")
      .map((d, idx) => {
        const dist = Number.isFinite(Number(d.distance)) ? Math.max(0, Number(d.distance)) : 0;

        let angleDeg;
        if (hasPickup && Number.isFinite(d.lat) && Number.isFinite(d.lng)) {
          const dy = d.lat - pickupLat;
          const dx = d.lng - pickupLng;
          angleDeg = (Math.atan2(-dy, dx) * 180 / Math.PI + 360) % 360;
        } else {
          let h = 0;
          for (let i = 0; i < d.uid.length; i++) {
            h = ((h << 5) - h + d.uid.charCodeAt(i)) | 0;
          }
          angleDeg = Math.abs(h) % 360;
        }

        const innerPct = 0.12;
        const t = dist / maxRangeMiles;
        const rPct = innerPct + t * (1 - innerPct - 0.08);

        return { uid: d.uid, distance: dist, angleDeg, rPct, index: idx };
      });
  }, [candidateDrivers, pickupLat, pickupLng]);

  const newUids = useMemo(() => {
    const fresh = new Set();
    drivers.forEach(d => {
      if (!seenUidsRef.current.has(d.uid)) {
        fresh.add(d.uid);
        seenUidsRef.current.add(d.uid);
      }
    });
    return fresh;
  }, [drivers]);

  const toRad = (deg) => (deg * Math.PI) / 180;
  const cx = 100, cy = 100;
  const discR = 92;
  const trailAng = sweepAngle;
  const leadAng  = (sweepAngle + 60) % 360;
  const trailX = cx + discR * Math.cos(toRad(trailAng));
  const trailY = cy + discR * Math.sin(toRad(trailAng));
  const leadX  = cx + discR * Math.cos(toRad(leadAng));
  const leadY  = cy + discR * Math.sin(toRad(leadAng));
  const tipX   = cx + (discR - 4) * Math.cos(toRad(leadAng));
  const tipY   = cy + (discR - 4) * Math.sin(toRad(leadAng));

  const sweepCoversAngle = (angDeg) => {
    if (trailAng <= leadAng) return angDeg >= trailAng && angDeg <= leadAng;
    return angDeg >= trailAng || angDeg <= leadAng;
  };

  return (
    <div style={{
      position: 'absolute',
      top: '32%',                       // sits above the sheet, on the map
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: 240, height: 240,
      pointerEvents: 'none',            // doesn't block map drag (if ever)
      zIndex: 5,
    }}>
      <style>{`
        @keyframes radarExpand {
          0%   { transform: scale(.5);  opacity: .85; }
          100% { transform: scale(2.2); opacity: 0;   }
        }
        @keyframes radarCenterPulse {
          0%, 100% { transform: translate(-50%,-50%) scale(1);    box-shadow: 0 0 0 0 rgba(${ringRGB},.5); }
          50%      { transform: translate(-50%,-50%) scale(1.06); box-shadow: 0 0 0 12px rgba(${ringRGB},0); }
        }
        @keyframes radarChipPulse {
          0%, 100% { opacity: .7; }
          50%      { opacity: 1; }
        }
        @keyframes radarDriverAppear {
          0%   { transform: scale(0);   opacity: 0; }
          60%  { transform: scale(1.6); opacity: 1; }
          100% { transform: scale(1);   opacity: 1; }
        }
      `}</style>

      {/* Expanding pulse rings */}
      {[0, 1, 2].map((i) => (
        <div key={i} style={{
          position: 'absolute', inset: 0,
          borderRadius: '50%',
          border: `1.5px solid rgba(${ringRGB},.45)`,
          animation: `radarExpand 3s ease-out ${i * 1}s infinite`,
          pointerEvents: 'none',
          boxShadow: `0 0 30px rgba(${ringRGB},.15)`,
        }}/>
      ))}

      {/* SVG radar canvas */}
      <svg
        viewBox="0 0 200 200"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      >
        <defs>
          <radialGradient id="radarSweep" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={accent}  stopOpacity="0"/>
            <stop offset="40%"  stopColor={accent}  stopOpacity=".22"/>
            <stop offset="100%" stopColor={accent2} stopOpacity=".8"/>
          </radialGradient>
          <radialGradient id="radarDisc" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={accent} stopOpacity=".15"/>
            <stop offset="60%"  stopColor={accent} stopOpacity=".05"/>
            <stop offset="100%" stopColor={accent} stopOpacity="0"/>
          </radialGradient>
        </defs>

        {/* Disc — transparent so map shows through */}
        <circle cx={cx} cy={cy} r={discR} fill="url(#radarDisc)" />

        {/* Concentric grid rings — brighter so they pop over the map */}
        {[30, 55, 80].map((r) => (
          <circle key={r}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={`rgba(${ringRGB},.35)`}
            strokeWidth="0.7"
            strokeDasharray="2 3"
          />
        ))}

        {/* Compass labels */}
        <text x={cx}  y="11"     textAnchor="middle" fontSize="7" fill={`rgba(${ringRGB},.75)`} fontWeight="800" fontFamily="monospace" style={{textShadow:'0 0 4px rgba(0,0,0,.8)'}}>N</text>
        <text x="192" y={cy + 2} textAnchor="middle" fontSize="7" fill={`rgba(${ringRGB},.75)`} fontWeight="800" fontFamily="monospace" style={{textShadow:'0 0 4px rgba(0,0,0,.8)'}}>E</text>
        <text x={cx}  y="196"    textAnchor="middle" fontSize="7" fill={`rgba(${ringRGB},.75)`} fontWeight="800" fontFamily="monospace" style={{textShadow:'0 0 4px rgba(0,0,0,.8)'}}>S</text>
        <text x="8"   y={cy + 2} textAnchor="middle" fontSize="7" fill={`rgba(${ringRGB},.75)`} fontWeight="800" fontFamily="monospace" style={{textShadow:'0 0 4px rgba(0,0,0,.8)'}}>W</text>

        {/* Crosshairs */}
        <line x1={cx} y1="14" x2={cx} y2="186" stroke={`rgba(${ringRGB},.25)`} strokeWidth="0.5"/>
        <line x1="14" y1={cy} x2="186" y2={cy} stroke={`rgba(${ringRGB},.25)`} strokeWidth="0.5"/>

        {/* Sweep wedge */}
        <path
          d={`M ${cx} ${cy} L ${trailX} ${trailY} A ${discR} ${discR} 0 0 1 ${leadX} ${leadY} Z`}
          fill="url(#radarSweep)"
          opacity="0.9"
        />

        {/* Leading beam line */}
        <line x1={cx} y1={cy} x2={leadX} y2={leadY}
          stroke={accent2} strokeWidth="1.4" strokeLinecap="round" opacity="1"/>

        {/* Tip flare */}
        <circle cx={tipX} cy={tipY} r="3" fill={accent2}/>
        <circle cx={tipX} cy={tipY} r="6" fill={accent} opacity="0.25"/>

        {/* Outer border ring */}
        <circle cx={cx} cy={cy} r={discR} fill="none" stroke={`rgba(${ringRGB},.7)`} strokeWidth="1.8"/>

        {/* Candidate driver dots */}
        {drivers.map((d) => {
          const r  = d.rPct * discR;
          const px = cx + r * Math.cos(toRad(d.angleDeg));
          const py = cy + r * Math.sin(toRad(d.angleDeg));
          const lit = sweepCoversAngle(d.angleDeg);
          const isNew = newUids.has(d.uid);

          return (
            <g
              key={d.uid}
              style={isNew ? {
                transformOrigin: `${px}px ${py}px`,
                animation: 'radarDriverAppear 0.7s cubic-bezier(.34,1.56,.64,1) both',
              } : undefined}
            >
              {lit && (
                <circle cx={px} cy={py} r="12" fill={accent2} opacity="0.35">
                  <animate attributeName="r" values="10;15;10" dur="0.6s" repeatCount="indefinite"/>
                </circle>
              )}
              <circle cx={px} cy={py} r="7"
                fill={accent}
                opacity={lit ? 0.6 : 0.25}/>
              <circle cx={px} cy={py} r="3.6"
                fill={lit ? "#fff" : accent}
                stroke="#fff"
                strokeWidth={lit ? 2 : 1}>
                {!lit && (
                  <animate attributeName="opacity"
                    values="0.7;1;0.7"
                    dur="2.4s"
                    repeatCount="indefinite"/>
                )}
              </circle>
              {d.index === 0 && !lit && (
                <text x={px + 7} y={py + 2}
                  fontSize="6"
                  fill="#fff"
                  fontWeight="800"
                  fontFamily="monospace"
                  style={{textShadow:'0 0 4px rgba(0,0,0,.9)'}}>
                  {d.distance < 0.1 ? '<0.1mi' : `${d.distance.toFixed(1)}mi`}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Center pickup pin */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        width: 52, height: 52,
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${accent2}, ${accent})`,
        border: '3px solid #fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 6px 22px rgba(${ringRGB},.6), 0 0 0 5px rgba(${ringRGB},.15)`,
        animation: 'radarCenterPulse 2s ease-in-out infinite',
        zIndex: 3,
      }}>
        <MapPin size={22} color="#fff" strokeWidth={2.5} style={{ marginTop: -1 }}/>
      </div>

      {/* Top-left: elapsed time chip */}
      {elapsedLabel && (
        <div style={{
          position: 'absolute',
          top: 0, left: 0,
          background: 'rgba(10,14,20,0.85)',
          backdropFilter: 'blur(10px)',
          border: `1px solid rgba(${ringRGB},.5)`,
          borderRadius: 99,
          padding: '4px 11px',
          fontSize: 11,
          fontWeight: 800,
          color: accent2,
          fontFamily: '"JetBrains Mono", monospace',
          letterSpacing: '.04em',
          display: 'flex', alignItems: 'center', gap: 5,
          boxShadow: `0 4px 12px rgba(0,0,0,.4)`,
          zIndex: 4,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: accent2,
            boxShadow: `0 0 8px ${accent2}`,
            animation: 'radarChipPulse 1.4s ease-in-out infinite',
          }}/>
          {elapsedLabel}
        </div>
      )}

      {/* Bottom-right: driver count */}
      {drivers.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: 0, right: 0,
          background: 'rgba(10,14,20,0.85)',
          backdropFilter: 'blur(10px)',
          border: `1px solid rgba(${ringRGB},.5)`,
          borderRadius: 99,
          padding: '4px 11px',
          fontSize: 11,
          fontWeight: 800,
          color: accent2,
          fontFamily: '"JetBrains Mono", monospace',
          letterSpacing: '.04em',
          display: 'flex', alignItems: 'center', gap: 5,
          boxShadow: `0 4px 12px rgba(0,0,0,.4)`,
          zIndex: 4,
        }}>
          <Car size={11} strokeWidth={2.5}/>
          {drivers.length} nearby
        </div>
      )}
    </div>
  );
}

// ─── Phone Capture Card ────────────────────────────────────────────────────
function PhoneCaptureCard({ uid, onSkip, onSaved }) {
  const [value, setValue]     = useState("");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState(false);

  const digits    = digitsOnly(value);
  const isValidUs = digits.length === 10 || (digits.length === 11 && digits[0] === "1");
  const canSubmit = isValidUs && !saving && !success;

  const handleChange  = (e) => { setValue(formatUsPhone(e.target.value)); if (error) setError(""); };
  const handleKeyDown = (e) => { if (e.key === "Enter" && canSubmit) { e.preventDefault(); handleSubmit(); } };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    setError("");
    try {
      const { data } = await callableUpdateRiderPhone({ uid, phone: digits });
      if (data?.success) { setSuccess(true); setTimeout(() => onSaved?.(data.phone), 900); }
      else throw new Error("Update failed");
    } catch (err) {
      setError(err?.message || "Couldn't save. Try again.");
    } finally { setSaving(false); }
  };

  if (success) return (
    <div style={{
      marginTop: 12,
      background: "rgba(34,197,94,0.1)",
      border: "1px solid rgba(34,197,94,0.3)",
      borderRadius: 14, padding: "13px 15px",
      display: "flex", alignItems: "center", gap: 10,
      animation: "slideUp .3s cubic-bezier(.34,1.56,.64,1) both",
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: "50%",
        background: "linear-gradient(135deg,#22C55E,#15803D)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 2px 8px rgba(34,197,94,.4)",
      }}>
        <Check size={14} color="#fff" strokeWidth={3}/>
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#86EFAC" }}>Phone saved</div>
        <div style={{ fontSize: 11, color: "rgba(134,239,172,.65)", marginTop: 1 }}>
          Your driver can reach you on arrival
        </div>
      </div>
    </div>
  );

  return (
    <div style={{
      marginTop: 12,
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 14, padding: "13px 14px",
      animation: "slideUp .35s cubic-bezier(.34,1.56,.64,1) both",
      position: "relative",
    }}>
      <button onClick={onSkip} style={{
        position: "absolute", top: 8, right: 8,
        width: 22, height: 22, borderRadius: "50%",
        border: "none", background: "rgba(255,255,255,0.07)",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", color: "rgba(255,255,255,0.4)",
        padding: 0,
      }}>
        <X size={11} strokeWidth={2.5}/>
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10, paddingRight: 20 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9,
          background: "linear-gradient(135deg,#3B82F6,#2563EB)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, boxShadow: "0 2px 8px rgba(37,99,235,.35)",
        }}>
          <Phone size={13} color="#fff" strokeWidth={2.4}/>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,.9)" }}>Add your phone</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", marginTop: 1 }}>So your driver can reach you</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 7 }}>
        <input
          type="tel" inputMode="tel" autoComplete="tel"
          placeholder="(555) 123-4567"
          value={value} onChange={handleChange} onKeyDown={handleKeyDown}
          disabled={saving}
          style={{
            flex: 1, padding: "9px 12px", borderRadius: 10,
            border: `1.5px solid ${error ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.12)"}`,
            background: "rgba(255,255,255,0.05)",
            fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,.9)",
            fontFamily: "inherit", outline: "none",
            transition: "border-color .15s",
          }}
        />
        <button onClick={handleSubmit} disabled={!canSubmit} style={{
          padding: "0 14px", minWidth: 64, borderRadius: 10, border: "none",
          background: canSubmit ? "linear-gradient(135deg,#22C55E,#15803D)" : "rgba(255,255,255,0.07)",
          color: canSubmit ? "#fff" : "rgba(255,255,255,0.25)",
          fontSize: 12, fontWeight: 800,
          cursor: canSubmit ? "pointer" : "not-allowed",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
          boxShadow: canSubmit ? "0 2px 8px rgba(34,197,94,.3)" : "none",
          transition: "all .15s", flexShrink: 0,
        }}>
          {saving ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }}/> : "Save"}
        </button>
      </div>
      {error && (
        <div style={{
          marginTop: 7, display: "flex", alignItems: "center", gap: 5,
          fontSize: 11, fontWeight: 600, color: "#FCA5A5",
        }}>
          <AlertCircle size={10} strokeWidth={2.5}/> {error}
        </div>
      )}
    </div>
  );
}

// ─── Notification Popup ────────────────────────────────────────────────────
function NotificationPopup({ notifLoading, notifError, onAllow, onSkip }) {
  const hasError = !!notifError;
  return (
    <>
      <style>{`
        @keyframes notifBackdropIn{from{opacity:0}to{opacity:1}}
        @keyframes notifCardIn{from{opacity:0;transform:translateY(30px) scale(.95)}to{opacity:1;transform:none}}
        @keyframes bellSwing{0%,100%{transform:rotate(0deg)}15%{transform:rotate(-20deg)}30%{transform:rotate(14deg)}45%{transform:rotate(-8deg)}60%{transform:rotate(5deg)}75%{transform:rotate(-3deg)}}
        @keyframes ringExpand{0%{transform:scale(.55);opacity:.6}100%{transform:scale(2.2);opacity:0}}
        @keyframes notifSpin{to{transform:rotate(360deg)}}
        @keyframes dotPulse{0%,80%,100%{transform:scale(0);opacity:.3}40%{transform:scale(1);opacity:1}}
      `}</style>
      <div onClick={e => e.target === e.currentTarget && onSkip()} style={{
        position: "fixed", inset: 0, zIndex: 1060,
        background: "rgba(0,0,0,.65)", backdropFilter: "blur(10px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        animation: "notifBackdropIn .2s ease both",
      }}>
        <div style={{
          width: "100%", maxWidth: 340,
          background: "#0D1B2A",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 24, overflow: "hidden",
          boxShadow: "0 32px 80px rgba(0,0,0,.5)",
          animation: "notifCardIn .3s cubic-bezier(.34,1.46,.64,1) both",
        }}>
          <div style={{
            padding: "32px 24px 28px",
            background: hasError
              ? "linear-gradient(145deg,rgba(239,68,68,0.15),rgba(185,28,28,0.1))"
              : "linear-gradient(145deg,rgba(37,99,235,0.2),rgba(29,78,216,0.1))",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex", flexDirection: "column", alignItems: "center",
            position: "relative", overflow: "hidden",
          }}>
            {!notifLoading && !hasError && [0,1,2].map(i => (
              <div key={i} style={{
                position: "absolute", top: "50%", left: "50%",
                width: 64, height: 64, borderRadius: "50%",
                border: "1px solid rgba(96,165,250,0.3)",
                transform: "translate(-50%,-50%)",
                animation: `ringExpand 2.4s ease-out ${i * .8}s infinite`,
              }}/>
            ))}

            <div style={{
              position: "relative", zIndex: 1,
              width: 64, height: 64, borderRadius: "50%",
              background: hasError
                ? "linear-gradient(135deg,#EF4444,#B91C1C)"
                : "linear-gradient(135deg,#3B82F6,#1D4ED8)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: hasError
                ? "0 8px 28px rgba(239,68,68,.4), 0 0 0 6px rgba(239,68,68,.1)"
                : "0 8px 28px rgba(37,99,235,.4), 0 0 0 6px rgba(37,99,235,.1)",
            }}>
              {notifLoading
                ? <svg width="26" height="26" viewBox="0 0 26 26" fill="none" style={{ animation: "notifSpin .85s linear infinite" }}>
                    <circle cx="13" cy="13" r="10" stroke="rgba(255,255,255,.2)" strokeWidth="2.5"/>
                    <path d="M13 3 A10 10 0 0 1 23 13" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
                  </svg>
                : hasError
                  ? <AlertCircle size={26} color="#fff" strokeWidth={2.2}/>
                  : <Bell size={26} color="#fff" strokeWidth={2.2}
                      style={{ animation: "bellSwing 2.8s ease-in-out 1.2s infinite", transformOrigin: "top center" }}
                    />
              }
            </div>

            <div style={{
              position: "relative", zIndex: 1, marginTop: 16,
              fontSize: 20, fontWeight: 900, color: "rgba(255,255,255,.95)",
              letterSpacing: "-0.4px", textAlign: "center",
            }}>
              {notifLoading ? "Connecting…" : hasError ? "Permission failed" : "Get notified instantly"}
            </div>
            <div style={{
              position: "relative", zIndex: 1, marginTop: 6,
              fontSize: 13, color: "rgba(255,255,255,.45)", textAlign: "center",
              lineHeight: 1.5, maxWidth: 240,
            }}>
              {notifLoading
                ? "Registering your device…"
                : hasError
                  ? notifError || "We couldn't get permission. Try again."
                  : "Know the second a driver accepts your ride."}
            </div>
          </div>

          <div style={{ padding: "18px 20px 22px" }}>
            {notifLoading && (
              <div style={{ display: "flex", justifyContent: "center", gap: 7, marginBottom: 18 }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{
                    width: 7, height: 7, borderRadius: "50%", background: "#3B82F6",
                    animation: `dotPulse 1.2s ease-in-out ${i * .2}s infinite`,
                  }}/>
                ))}
              </div>
            )}
            {!notifLoading && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button onClick={onAllow} style={{
                  width: "100%", padding: "13px 0", borderRadius: 12, border: "none",
                  background: hasError
                    ? "linear-gradient(135deg,#EF4444,#B91C1C)"
                    : "linear-gradient(135deg,#3B82F6,#1D4ED8)",
                  color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  boxShadow: hasError ? "0 4px 16px rgba(239,68,68,.3)" : "0 4px 16px rgba(37,99,235,.3)",
                  transition: "filter .15s, transform .15s",
                }}>
                  {hasError ? <><RotateCcw size={14}/> Try again</> : <><Bell size={14}/> Allow notifications</>}
                </button>
                <button onClick={onSkip} style={{
                  width: "100%", padding: "12px 0", borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.04)",
                  color: "rgba(255,255,255,.4)", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  transition: "all .12s",
                }}>
                  {hasError ? "Dismiss" : "Not now"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main Modal ────────────────────────────────────────────────────────────
export default function ConfirmationModal({ onClose, onPaymentCancelled, onRetry, onCancel, rides }) {
  const [status, setStatus]           = useState('checking_payment');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [driver, setDriver]           = useState(null);
  const [visible, setVisible]         = useState(false);
  const [liveRide, setLiveRide]       = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError]     = useState('');
  const [showNotifPopup, setShowNotifPopup] = useState(false);
  const [notifLoading, setNotifLoading]     = useState(false);
  const [notifError, setNotifError]         = useState("");
  const [accountPhone, setAccountPhone]     = useState(null);
  const [phoneSkipped, setPhoneSkipped]     = useState(false);
  const [mapReady, setMapReady]             = useState(false);
  const [swapKey, setSwapKey]               = useState(0);

  const timerRef          = useRef(null);
  const closeTimeoutRef   = useRef(null);
  const mountedRef        = useRef(true);
  const lastRideIdRef     = useRef(null);
  const unsubRef          = useRef(null);
  const accountUnsubRef   = useRef(null);
  const notifRequestedRef = useRef(false);
  const didTimeoutRef     = useRef(false);
  const mapContainerRef   = useRef(null);
  const mapRef            = useRef(null);

  const seedRide = useMemo(() => {
    if (!rides?.length) return null;
    return rides.find(r => r.paymentStatus === 'succeeded' && r.status !== 'completed' && r.status !== 'cancelled')
      ?? rides.find(r => r.status === 'pending_payment')
      ?? null;
  }, [rides]);

  const currentRide = liveRide ?? seedRide;
  const rideId      = currentRide?.id ?? null;
  const riderUid    = currentRide?.uid ?? null;

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
    if (!rideId || rideId === lastRideIdRef.current) return;
    lastRideIdRef.current = rideId;
    try { unsubRef.current?.(); } catch {}
    unsubRef.current = onSnapshot(doc(db, 'Rides', rideId), (snap) => {
      if (!snap.exists() || !mountedRef.current) return;
      setLiveRide({ id: snap.id, ...snap.data() });
    }, err => console.warn('[ConfirmationModal] snapshot error:', err));
  }, [rideId]);

  useEffect(() => {
    if (!riderUid) return;
    try { accountUnsubRef.current?.(); } catch {}
    try {
      accountUnsubRef.current = onSnapshot(doc(db, "Accounts", riderUid), (snap) => {
        if (!mountedRef.current) return;
        setAccountPhone(snap.exists() ? (snap.data()?.phone ?? "") : "");
      }, err => { console.warn(err); setAccountPhone(""); });
    } catch { setAccountPhone(""); }
    return () => { try { accountUnsubRef.current?.(); } catch {} };
  }, [riderUid]);

  useEffect(() => {
    if (!rideId) { setPhoneSkipped(false); return; }
    try { setPhoneSkipped(sessionStorage.getItem(PHONE_SKIP_KEY(rideId)) === "1"); }
    catch { setPhoneSkipped(false); }
  }, [rideId]);

  useEffect(() => {
    if (!currentRide) return;
    const s = currentRide.status;
    if (s === 'pending_payment') { setStatus('checking_payment'); }
    else if (s === 'searching_driver' || s === 'searching') {
      if (status === 'timeout') { didTimeoutRef.current = false; setStatus('searching'); setDriver(null); }
      else if (!didTimeoutRef.current) { setStatus('searching'); setDriver(null); }
    } else if (s === 'driver_assigned') {
      clearInterval(timerRef.current); timerRef.current = null;
      if (currentRide.driver) setDriver(currentRide.driver);
      setStatus('assigned');
    } else if (s === 'timeout' || s === 'cancelled') {
      clearInterval(timerRef.current); timerRef.current = null;
      setStatus('timeout');
    }
  }, [currentRide]);

  useEffect(() => {
    if (status !== 'searching') { clearInterval(timerRef.current); timerRef.current = null; return; }
    const update = () => {
      if (!currentRide?.expiresAt) { setSecondsLeft(0); return; }
      const remaining = getSecondsRemaining(currentRide.expiresAt);
      setSecondsLeft(remaining);
      if (remaining <= 0 && !didTimeoutRef.current) {
        didTimeoutRef.current = true;
        clearInterval(timerRef.current); timerRef.current = null;
        setStatus('timeout');
      }
    };
    update(); clearInterval(timerRef.current);
    timerRef.current = setInterval(update, 1000);
    return () => { clearInterval(timerRef.current); timerRef.current = null; };
  }, [status, currentRide?.expiresAt]);

  useEffect(() => {
    if (status !== 'assigned') return;
    const t = setTimeout(() => { if (mountedRef.current) handleClose(); }, 1800);
    return () => clearTimeout(t);
  }, [status]);

  useEffect(() => {
    if (status !== 'searching' || notifRequestedRef.current || !("Notification" in window)) return;
    if (window.Notification.permission === "default") {
      setShowNotifPopup(true); notifRequestedRef.current = true;
    } else if (window.Notification.permission === "granted" && rideId && riderUid && !currentRide?.riderFcmToken) {
      registerRiderFcmToken(rideId, riderUid).catch(err => console.warn("[Rider] Auto token failed:", err.message));
    }
  }, [status, rideId, riderUid, currentRide?.riderFcmToken]);

  // Init Mapbox background
  useEffect(() => {
    if (!visible || mapRef.current) return;
    const MAPBOX_TOKEN = "pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA";

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
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [currentRide?.pickupLng ?? -81.3792, currentRide?.pickupLat ?? 28.5383],
        zoom: 15,
        pitch: 50,
        bearing: -20,
        interactive: false,
        attributionControl: false,
      });
      map.on('load', () => {
        mapRef.current = map;
        setMapReady(true);
        let bearing = -20;
        const drift = setInterval(() => { bearing += 0.04; map.setBearing(bearing); }, 100);
        map.on('remove', () => clearInterval(drift));
      });
    };

    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; setMapReady(false); } };
  }, [visible]);

  // Recenter map when pickup coords arrive
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const lng = currentRide?.pickupLng;
    const lat = currentRide?.pickupLat;
    if (Number.isFinite(lng) && Number.isFinite(lat)) {
      mapRef.current.easeTo({ center: [lng, lat], duration: 800 });
    }
  }, [mapReady, currentRide?.pickupLat, currentRide?.pickupLng]);

  const total  = useMemo(() => { const v = Number(currentRide?.fareTotal ?? 0); return Number.isFinite(v) ? v.toFixed(2) : '0.00'; }, [currentRide]);
  const miles  = useMemo(() => { const v = Number(currentRide?.tripDistanceMiles ?? 0); return Number.isFinite(v) ? v.toFixed(1) : '0.0'; }, [currentRide]);

  const progress = useMemo(() => {
    if (!currentRide?.createdAt) return 0;
    const ms = currentRide.createdAt instanceof Date
      ? currentRide.createdAt.getTime()
      : currentRide.createdAt?.toDate?.()?.getTime?.() ?? new Date(currentRide.createdAt).getTime();
    if (isNaN(ms)) return 0;
    return (Math.min(SEARCH_LIMIT_SEC, Math.floor((Date.now() - ms) / 1000)) / SEARCH_LIMIT_SEC) * 100;
  }, [currentRide?.createdAt, secondsLeft]);

  const activeDriver = useMemo(() => {
    const list = currentRide?.candidateDrivers ?? [];
    const i = currentRide?.currentDriverIndex ?? 0;
    return list[i] ?? null;
  }, [currentRide?.candidateDrivers, currentRide?.currentDriverIndex]);

  const minutes   = Math.floor(secondsLeft / 60);
  const seconds   = secondsLeft % 60;
  const isUrgent  = secondsLeft < 60;
  const pickup    = currentRide?.pickup  ?? '—';
  const dropoff   = currentRide?.dropoff ?? '—';
  const rideLabel = currentRide?.rideLabel ?? currentRide?.rideType ?? 'Ride';

  const shouldShowPhoneCapture =
    status === 'searching' && accountPhone !== null && !accountPhone && !phoneSkipped && !!riderUid;

  const handleSkipPhone = () => {
    setPhoneSkipped(true);
    if (rideId) { try { sessionStorage.setItem(PHONE_SKIP_KEY(rideId), "1"); } catch {} }
  };

  const handleClose = async () => {
    if (status === 'checking_payment' && rideId) {
      deleteDoc(doc(db, 'Rides', rideId)).catch(err => console.warn(err));
      setVisible(false); closeTimeoutRef.current = setTimeout(() => onPaymentCancelled?.(), 260); return;
    }
    setVisible(false); closeTimeoutRef.current = setTimeout(() => onClose?.(), 260);
  };

  const handleWaitMore = async () => {
    if (!rideId || !riderUid) return;
    setActionLoading(true); didTimeoutRef.current = false;
    try { await callableExtendRideSearch({ rideId, uid: riderUid }); }
    catch (err) { console.error('Extend error:', err); didTimeoutRef.current = true; }
    finally { setActionLoading(false); }
  };

  const handleCancelRide = async () => {
    if (!rideId || !riderUid) return;
    setCancelLoading(true); setCancelError('');
    try {
      await callableCancelRide({ rideId, uid: riderUid });
      onCancel?.({ rideId, uid: riderUid });
      setVisible(false); closeTimeoutRef.current = setTimeout(() => onClose?.(), 260);
    } catch (err) {
      setCancelError(err?.message || 'Could not cancel. Please try again.');
    } finally { setCancelLoading(false); }
  };

  const handleEnableNotifications = async () => {
    if (!rideId || !riderUid) { setNotifError("Ride info missing"); return; }
    setNotifLoading(true); setNotifError("");
    try { await registerRiderFcmToken(rideId, riderUid); setShowNotifPopup(false); }
    catch (err) { setNotifError(err.message || "Failed"); }
    finally { setNotifLoading(false); }
  };

  const handleNextDriver = async () => {
    if (!rideId || !riderUid) return;
    const nextIndex = (currentRide?.currentDriverIndex ?? 0) + 1;
    try {
      await updateDoc(doc(db, "Rides", rideId), {
        currentDriverIndex: nextIndex,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Swap driver error:", err);
    }
  };

  useEffect(() => {
    setSwapKey(prev => prev + 1);
  }, [currentRide?.currentDriverIndex]);

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:none; } }
        @keyframes fadeIn  { from { opacity:0; } to { opacity:1; } }
        @keyframes assignedPop { 0%{transform:scale(.8);opacity:0} 60%{transform:scale(1.08)} 100%{transform:scale(1);opacity:1} }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes timerBeat { 0%,100%{transform:scale(1)} 50%{transform:scale(1.025)} }
        @keyframes swapIn { from { opacity:0; transform:translateY(-8px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } }
      `}</style>

      <div style={{
        position: "fixed", inset: 0, zIndex: 999,
        transition: "opacity .28s ease",
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
      }}>

        {/* ━━━ Mapbox BG ━━━ */}
        <div ref={mapContainerRef} style={{ position: "absolute", inset: 0 }}/>

        {/* Dark scrim — softer so the radar reads against it */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, rgba(0,0,0,.15) 0%, rgba(0,0,0,.05) 30%, rgba(0,0,0,.5) 75%, rgba(0,0,0,.85) 100%)",
          pointerEvents: "none",
        }}/>

        {/* ━━━ RADAR — overlaid on the Mapbox background, only during searching ━━━ */}
        {status === 'searching' && (
          <RideSearchRadarOverlay
            isUrgent={isUrgent}
            pickupLat={currentRide?.pickupLat}
            pickupLng={currentRide?.pickupLng}
            candidateDrivers={currentRide?.candidateDrivers ?? []}
            requestSentAt={currentRide?.requestSentAt}
          />
        )}

        {/* Headline above the sheet during searching */}
        {status === 'searching' && (
          <div style={{
            position: "absolute",
            top: 'calc(32% + 140px)',  // just below the radar
            left: 0, right: 0,
            textAlign: "center",
            pointerEvents: "none",
            zIndex: 6,
            padding: "0 24px",
          }}>
            <div style={{
              fontSize: 20, fontWeight: 900,
              color: "#fff",
              letterSpacing: "-0.4px",
              marginBottom: 4,
              textShadow: "0 2px 16px rgba(0,0,0,.7)",
            }}>
              {isUrgent ? "Almost out of time…" : "Finding your driver"}
            </div>
            <div style={{
              fontSize: 13, color: "rgba(255,255,255,.7)",
              fontWeight: 500,
              textShadow: "0 1px 8px rgba(0,0,0,.7)",
            }}>
              {isUrgent
                ? "Searching nearby areas. Hang tight."
                : `Pinging ${currentRide?.candidateDrivers?.length ?? 0} ${(currentRide?.candidateDrivers?.length ?? 0) === 1 ? "driver" : "drivers"} near you`
              }
            </div>
          </div>
        )}

        {showNotifPopup && (
          <NotificationPopup
            notifLoading={notifLoading}
            notifError={notifError}
            onAllow={handleEnableNotifications}
            onSkip={() => { setShowNotifPopup(false); setNotifError(""); }}
          />
        )}

        {/* ━━━ Sheet container ━━━ */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          display: "flex", justifyContent: "center", alignItems: "flex-end",
        }}>
          <div style={{
            width: "100%", maxWidth: 440,
            background: "rgba(10,14,20,0.96)",
            backdropFilter: "blur(24px)",
            borderRadius: "24px 24px 0 0",
            border: "1px solid rgba(255,255,255,0.07)",
            borderBottom: "none",
            boxShadow: "0 -24px 80px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,0.08)",
            overflow: "hidden",
            transform: visible ? "translateY(0)" : "translateY(100%)",
            transition: "transform .35s cubic-bezier(.34,1.2,.64,1)",
          }}>

            {/* Drag handle */}
            <div style={{
              display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 4,
            }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.15)" }}/>
            </div>

            {/* ══ CHECKING PAYMENT ══════════════════════════════════════ */}
            {status === 'checking_payment' && (
              <div style={{ padding: "20px 24px 32px", textAlign: "center" }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: "rgba(96,165,250,0.12)",
                  border: "1.5px solid rgba(96,165,250,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 16px",
                }}>
                  <Loader2 size={26} color="#60A5FA" style={{ animation: "spin 1s linear infinite" }}/>
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "rgba(255,255,255,.92)", marginBottom: 6, letterSpacing: "-0.4px" }}>
                  Verifying payment…
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,.4)", marginBottom: 28, lineHeight: 1.5 }}>
                  This only takes a moment.
                </div>
                <button onClick={handleClose} style={{
                  width: "100%", padding: "13px 0", borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "rgba(255,255,255,0.05)",
                  fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,.5)", cursor: "pointer",
                }}>
                  Cancel
                </button>
              </div>
            )}

            {/* ══ SEARCHING — sheet content (no radar here anymore) ════════ */}
            {status === 'searching' && (
              <div>
                {/* Urgency progress bar at top of sheet */}
                <div style={{ height: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${100 - progress}%`,
                    background: isUrgent
                      ? "linear-gradient(90deg,#F59E0B,#EF4444)"
                      : "linear-gradient(90deg,#22C55E,#16A34A)",
                    transition: "width 1s linear, background .5s ease",
                    boxShadow: isUrgent ? "0 0 8px rgba(239,68,68,.5)" : "0 0 8px rgba(34,197,94,.4)",
                  }}/>
                </div>

                <div style={{ padding: "20px 22px 28px" }}>

                  {/* Timer */}
                  <div style={{
                    background: isUrgent
                      ? "linear-gradient(135deg,rgba(239,68,68,0.12),rgba(185,28,28,0.08))"
                      : "linear-gradient(135deg,rgba(34,197,94,0.1),rgba(21,128,61,0.06))",
                    border: `1px solid ${isUrgent ? "rgba(239,68,68,0.25)" : "rgba(34,197,94,0.2)"}`,
                    borderRadius: 18, padding: "18px 20px",
                    marginBottom: 16, position: "relative", overflow: "hidden",
                    animation: isUrgent ? "timerBeat 1s ease-in-out infinite" : "none",
                  }}>
                    <div style={{
                      position: "absolute", inset: 0,
                      background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.025) 50%, transparent 60%)",
                      backgroundSize: "200% 100%",
                      animation: "shimmer 3s linear infinite",
                      pointerEvents: "none",
                    }}/>

                    <div style={{ position: "relative" }}>
                      <div style={{
                        fontSize: 10, fontWeight: 800, letterSpacing: ".16em",
                        textTransform: "uppercase",
                        color: isUrgent ? "rgba(252,165,165,.7)" : "rgba(134,239,172,.7)",
                        marginBottom: 6,
                        fontFamily: "monospace",
                      }}>
                        {isUrgent ? "⚡ Almost out of time" : "Time remaining"}
                      </div>

                      <div style={{
                        fontFamily: '"JetBrains Mono", "Courier New", monospace',
                        fontSize: 52, fontWeight: 700, lineHeight: 1,
                        letterSpacing: "-4px",
                        color: isUrgent ? "#EF4444" : "#22C55E",
                        marginBottom: 12,
                      }}>
                        {String(minutes).padStart(2, '0')}
                        <span style={{ opacity: 0.5, animation: "timerBeat .5s ease-in-out infinite" }}>:</span>
                        {String(seconds).padStart(2, '0')}
                      </div>

                      <div style={{ height: 4, borderRadius: 100, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                        <div style={{
                          height: "100%", width: `${progress}%`,
                          background: isUrgent
                            ? "linear-gradient(90deg,#F59E0B,#EF4444)"
                            : "linear-gradient(90deg,#22C55E,#16A34A)",
                          borderRadius: 100, transition: "width 1s linear",
                          boxShadow: isUrgent ? "0 0 6px rgba(239,68,68,.5)" : "0 0 6px rgba(34,197,94,.4)",
                        }}/>
                      </div>
                    </div>
                  </div>

                  {/* Route card */}
                  <div style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 14, padding: "13px 14px",
                    marginBottom: 12,
                  }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 3, flexShrink: 0 }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: "50%",
                          background: "#60A5FA",
                          boxShadow: "0 0 6px rgba(96,165,250,0.6)",
                        }}/>
                        <div style={{
                          width: 1, flex: 1, minHeight: 14,
                          background: "linear-gradient(to bottom, rgba(96,165,250,0.4), rgba(34,197,94,0.4))",
                          margin: "3px 0",
                        }}/>
                        <div style={{
                          width: 8, height: 8, borderRadius: 2,
                          background: "#22C55E",
                          transform: "rotate(45deg)",
                          boxShadow: "0 0 6px rgba(34,197,94,0.6)",
                        }}/>
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 12, fontWeight: 700,
                          color: "rgba(255,255,255,.85)", marginBottom: 8,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {pickup}
                        </div>
                        <div style={{
                          fontSize: 12, fontWeight: 700,
                          color: "rgba(255,255,255,.6)",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {dropoff}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Fare row */}
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 12, padding: "10px 14px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: "rgba(34,197,94,0.12)",
                        border: "1px solid rgba(34,197,94,0.2)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Shield size={12} color="#22C55E" strokeWidth={2.2}/>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.7)" }}>
                          {rideLabel}
                        </div>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,.3)" }}>
                          {miles} mi · fare locked
                        </div>
                      </div>
                    </div>
                    <div style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 16, fontWeight: 700, color: "#22C55E",
                    }}>
                      ${total}
                    </div>
                  </div>

                  {shouldShowPhoneCapture && (
                    <PhoneCaptureCard
                      uid={riderUid}
                      onSkip={handleSkipPhone}
                      onSaved={(p) => setAccountPhone(p)}
                    />
                  )}

                  <button onClick={handleCancelRide} disabled={cancelLoading} style={{
                    width: "100%", marginTop: 12, padding: "11px 0",
                    borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)",
                    background: "transparent",
                    color: "rgba(255,255,255,.3)", fontSize: 13, fontWeight: 600,
                    cursor: cancelLoading ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    transition: "color .15s",
                  }}>
                    {cancelLoading
                      ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }}/> Cancelling…</>
                      : "Cancel ride"
                    }
                  </button>
                  {cancelError && (
                    <div style={{ marginTop: 8, fontSize: 11, color: "#FCA5A5", textAlign: "center" }}>
                      {cancelError}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ══ ASSIGNED ═════════════════════════════════════════════ */}
            {status === 'assigned' && (
              <div style={{ padding: "20px 22px 32px" }}>

                <div style={{
                  background: "linear-gradient(135deg,rgba(34,197,94,0.14),rgba(21,128,61,0.08))",
                  border: "1px solid rgba(34,197,94,0.25)",
                  borderRadius: 18, padding: "22px 20px",
                  textAlign: "center", marginBottom: 16,
                  animation: "fadeIn .35s ease both",
                }}>
                  <div style={{
                    width: 60, height: 60, borderRadius: "50%",
                    background: "rgba(34,197,94,0.15)",
                    border: "2px solid rgba(34,197,94,0.4)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 14px",
                    animation: "assignedPop .5s cubic-bezier(.34,1.56,.64,1) both",
                    boxShadow: "0 0 40px rgba(34,197,94,0.25)",
                  }}>
                    <CheckCircle size={30} color="#22C55E" strokeWidth={2}/>
                  </div>
                  <div style={{
                    fontSize: 22, fontWeight: 900, color: "#22C55E",
                    letterSpacing: "-0.5px", marginBottom: 5,
                  }}>
                    Driver matched!
                  </div>
                  <div style={{ fontSize: 13, color: "rgba(134,239,172,.65)", fontWeight: 500 }}>
                    Your ride is confirmed and on the way
                  </div>
                </div>

                {activeDriver && (
                  <div
                    key={swapKey}
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 14, padding: "13px 14px",
                      display: "flex", alignItems: "center", gap: 12,
                      marginBottom: 12,
                      animation: "swapIn .3s cubic-bezier(.34,1.2,.64,1) both",
                    }}
                  >
                    <div style={{
                      width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                      background: "linear-gradient(135deg,#22C55E,#15803D)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 17, fontWeight: 900, color: "#fff",
                      boxShadow: "0 4px 12px rgba(34,197,94,.35)",
                    }}>
                      {activeDriver.uid?.[0] ?? '?'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "rgba(255,255,255,.9)" }}>
                        Driver
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", marginTop: 2 }}>
                        {activeDriver.distance?.toFixed(1) || '—'} mi away
                      </div>
                    </div>
                  </div>
                )}

                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "rgba(34,197,94,0.07)",
                  border: "1px solid rgba(34,197,94,0.18)",
                  borderRadius: 12, padding: "11px 14px", marginBottom: 16,
                  animation: "slideUp .4s cubic-bezier(.34,1.2,.64,1) .22s both",
                }}>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "rgba(134,239,172,.6)", letterSpacing: ".1em", textTransform: "uppercase" }}>
                      Confirmed fare
                    </div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", marginTop: 2 }}>
                      {rideLabel} · {miles} mi
                    </div>
                  </div>
                  <div style={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: 22, fontWeight: 700, color: "#22C55E",
                  }}>
                    ${total}
                  </div>
                </div>

                <button onClick={handleClose} style={{
                  width: "100%", padding: "14px 0", borderRadius: 14, border: "none",
                  background: "linear-gradient(135deg,#22C55E,#15803D)",
                  color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer",
                  boxShadow: "0 4px 20px rgba(34,197,94,.35)",
                  animation: "slideUp .4s cubic-bezier(.34,1.2,.64,1) .3s both",
                  transition: "filter .15s",
                }}>
                  Track My Ride
                </button>
              </div>
            )}

            {/* ══ TIMEOUT ══════════════════════════════════════════════ */}
            {status === 'timeout' && (
              <div style={{ padding: "20px 22px 32px" }}>

                <div style={{
                  background: "linear-gradient(135deg,rgba(239,68,68,0.12),rgba(185,28,28,0.08))",
                  border: "1px solid rgba(239,68,68,0.2)",
                  borderRadius: 18, padding: "22px 20px",
                  textAlign: "center", marginBottom: 16,
                  animation: "fadeIn .35s ease both",
                }}>
                  <div style={{
                    width: 60, height: 60, borderRadius: "50%",
                    background: "rgba(239,68,68,0.15)",
                    border: "2px solid rgba(239,68,68,0.35)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 14px",
                    animation: "assignedPop .5s cubic-bezier(.34,1.56,.64,1) both",
                    boxShadow: "0 0 40px rgba(239,68,68,0.2)",
                  }}>
                    <Clock size={30} color="#EF4444" strokeWidth={2}/>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "#EF4444", letterSpacing: "-0.5px", marginBottom: 5 }}>
                    No drivers found
                  </div>
                  <div style={{ fontSize: 13, color: "rgba(252,165,165,.55)", fontWeight: 500 }}>
                    We searched your area but couldn't find a nearby driver.
                  </div>
                </div>

                <div style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 14, padding: "13px 14px", marginBottom: 16,
                }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 3, flexShrink: 0 }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#64748B" }}/>
                      <div style={{ width: 1, flex: 1, minHeight: 12, background: "rgba(255,255,255,.1)", margin: "3px 0" }}/>
                      <div style={{ width: 7, height: 7, borderRadius: 2, background: "#22C55E", transform: "rotate(45deg)" }}/>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.7)", marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {pickup}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {dropoff}
                      </div>
                    </div>
                    <div style={{
                      flexShrink: 0, alignSelf: "center",
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 13, fontWeight: 700, color: "#22C55E",
                      background: "rgba(34,197,94,0.1)",
                      border: "1px solid rgba(34,197,94,0.2)",
                      borderRadius: 8, padding: "4px 9px",
                    }}>
                      ${total}
                    </div>
                  </div>
                </div>

                <div style={{
                  fontSize: 10, fontWeight: 800, letterSpacing: ".14em",
                  textTransform: "uppercase", color: "rgba(255,255,255,.25)",
                  marginBottom: 10,
                }}>
                  What would you like to do?
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button
                    onClick={handleWaitMore}
                    disabled={actionLoading || cancelLoading}
                    style={{
                      width: "100%", padding: "14px 0", borderRadius: 13, border: "none",
                      background: actionLoading || cancelLoading
                        ? "rgba(34,197,94,0.2)"
                        : "linear-gradient(135deg,#22C55E,#15803D)",
                      color: "#fff", fontSize: 14, fontWeight: 800,
                      cursor: actionLoading || cancelLoading ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                      boxShadow: actionLoading || cancelLoading ? "none" : "0 4px 16px rgba(34,197,94,.3)",
                      opacity: actionLoading || cancelLoading ? 0.65 : 1,
                      transition: "all .15s",
                    }}
                  >
                    {actionLoading
                      ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }}/> Extending search…</>
                      : <><RotateCcw size={15} strokeWidth={2.5}/> Keep searching</>
                    }
                  </button>

                  <button
                    onClick={handleCancelRide}
                    disabled={actionLoading || cancelLoading}
                    style={{
                      width: "100%", padding: "13px 0", borderRadius: 13,
                      border: "1px solid rgba(255,255,255,0.09)",
                      background: "rgba(255,255,255,0.04)",
                      color: "rgba(255,255,255,.4)", fontSize: 13, fontWeight: 600,
                      cursor: actionLoading || cancelLoading ? "not-allowed" : "pointer",
                      opacity: actionLoading || cancelLoading ? 0.5 : 1,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      transition: "all .12s",
                    }}
                  >
                    {cancelLoading
                      ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }}/> Cancelling…</>
                      : "Cancel this ride"
                    }
                  </button>
                </div>
                {cancelError && (
                  <div style={{ marginTop: 10, fontSize: 11, color: "#FCA5A5", textAlign: "center" }}>
                    {cancelError}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}