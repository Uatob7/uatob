// src/App/UaTob/ConfirmationModal.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Clock, Car, CheckCircle, RotateCcw, Loader2, Bell,
  AlertCircle, MapPin, Navigation, Phone, Check, X,
  ChevronDown, Zap, Shield, Radio, Wifi, WifiOff,
} from 'lucide-react';
import { THEME as T } from '@/App/UaTob/pricing.js';
import { doc, deleteDoc, onSnapshot, getFirestore } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getMessaging, getToken } from 'firebase/messaging';
import { firebase_app } from '@/firebase/config';

const db        = getFirestore(firebase_app);
const functions = getFunctions(firebase_app, "us-east1");
const callableExtendRideSearch  = httpsCallable(functions, "extendRideSearch");
const callableSaveRiderToken    = httpsCallable(functions, "saveRiderFcmToken");
const callableCancelRide        = httpsCallable(functions, "cancelRide");
const callableUpdateRiderPhone  = httpsCallable(functions, "updateRiderPhone");

const VAPID_KEY       = "BJ_sRHZonSGCKk2mB2i9ofTRS8ouFVMV-I15FX4sqdUXHyVb1lo6H-N4GMPrlcIIshRlykQicaxkxxFxcYcI4JQ";
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

// ─── Candidate Driver Pings ────────────────────────────────────────────────
function DriverPingRow({ candidates = [], currentIndex = 0 }) {
  const total = candidates.length;
  if (!total) return null;

  return (
    <div style={{
      background: "rgba(255,255,255,0.025)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 12,
      padding: "11px 14px",
      marginBottom: 10,
    }}>
      <div style={{
        fontSize: 9, fontWeight: 800, letterSpacing: ".18em",
        textTransform: "uppercase", color: "rgba(255,255,255,.2)",
        marginBottom: 9, fontFamily: "monospace",
      }}>
        Contacting drivers nearby
      </div>
      <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
        {candidates.map((c, i) => {
          const isPinged = i < currentIndex;
          const isActive = i === currentIndex;
          const isPending = i > currentIndex;
          const dist = typeof c.distance === "number" ? c.distance.toFixed(1) : "?";
          return (
            <div key={c.uid ?? i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: isPinged
                  ? "rgba(100,116,139,0.2)"
                  : isActive
                    ? "rgba(34,197,94,0.18)"
                    : "rgba(255,255,255,0.04)",
                border: isPinged
                  ? "1.5px solid rgba(100,116,139,0.3)"
                  : isActive
                    ? "1.5px solid rgba(34,197,94,0.5)"
                    : "1.5px solid rgba(255,255,255,0.06)",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all .4s ease",
                position: "relative",
                boxShadow: isActive ? "0 0 10px rgba(34,197,94,0.3)" : "none",
              }}>
                {isPinged
                  ? <X size={10} color="rgba(100,116,139,0.6)" strokeWidth={2.5}/>
                  : isActive
                    ? <div style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: "#22C55E",
                        animation: "activeDriverPulse 1s ease-in-out infinite",
                      }}/>
                    : <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.1)" }}/>
                }
                {isActive && (
                  <div style={{
                    position: "absolute", inset: -3,
                    borderRadius: "50%",
                    border: "1px solid rgba(34,197,94,0.3)",
                    animation: "pingRing 1.2s ease-out infinite",
                  }}/>
                )}
              </div>
              <div style={{
                fontSize: 8, fontWeight: 700, fontFamily: "monospace",
                color: isPinged
                  ? "rgba(100,116,139,0.4)"
                  : isActive
                    ? "rgba(134,239,172,.7)"
                    : "rgba(255,255,255,.15)",
              }}>
                {dist}mi
              </div>
            </div>
          );
        })}
      </div>
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
    setSaving(true); setError("");
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
      marginBottom: 10,
      background: "rgba(34,197,94,0.08)",
      border: "1px solid rgba(34,197,94,0.2)",
      borderRadius: 12, padding: "11px 13px",
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: "50%",
        background: "linear-gradient(135deg,#22C55E,#15803D)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 2px 8px rgba(34,197,94,.35)",
      }}>
        <Check size={12} color="#fff" strokeWidth={3}/>
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#86EFAC" }}>Phone saved</div>
        <div style={{ fontSize: 10, color: "rgba(134,239,172,.5)", marginTop: 1 }}>Driver can reach you on arrival</div>
      </div>
    </div>
  );

  return (
    <div style={{
      marginBottom: 10,
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 12, padding: "11px 12px",
      position: "relative",
    }}>
      <button onClick={onSkip} style={{
        position: "absolute", top: 8, right: 8,
        width: 20, height: 20, borderRadius: "50%",
        border: "none", background: "rgba(255,255,255,0.06)",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: 0,
      }}>
        <X size={10} strokeWidth={2.5}/>
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9, paddingRight: 22 }}>
        <Phone size={12} color="rgba(96,165,250,.8)" strokeWidth={2.2}/>
        <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.6)" }}>
          Add phone so driver can reach you
        </div>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          type="tel" inputMode="tel" autoComplete="tel"
          placeholder="(555) 123-4567"
          value={value} onChange={handleChange} onKeyDown={handleKeyDown}
          disabled={saving}
          style={{
            flex: 1, padding: "8px 11px", borderRadius: 9,
            border: `1.5px solid ${error ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.09)"}`,
            background: "rgba(255,255,255,0.04)",
            fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.85)",
            fontFamily: "inherit", outline: "none",
          }}
        />
        <button onClick={handleSubmit} disabled={!canSubmit} style={{
          padding: "0 13px", minWidth: 56, borderRadius: 9, border: "none",
          background: canSubmit ? "linear-gradient(135deg,#22C55E,#15803D)" : "rgba(255,255,255,0.05)",
          color: canSubmit ? "#fff" : "rgba(255,255,255,0.2)",
          fontSize: 11, fontWeight: 800,
          cursor: canSubmit ? "pointer" : "not-allowed",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all .15s", flexShrink: 0,
        }}>
          {saving ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }}/> : "Save"}
        </button>
      </div>
      {error && (
        <div style={{ marginTop: 6, fontSize: 10, fontWeight: 600, color: "#FCA5A5", display: "flex", alignItems: "center", gap: 4 }}>
          <AlertCircle size={9} strokeWidth={2.5}/> {error}
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
        @keyframes notifCardIn{from{opacity:0;transform:translateY(24px) scale(.96)}to{opacity:1;transform:none}}
        @keyframes bellSwing{0%,100%{transform:rotate(0deg)}15%{transform:rotate(-18deg)}30%{transform:rotate(12deg)}45%{transform:rotate(-7deg)}60%{transform:rotate(4deg)}75%{transform:rotate(-2deg)}}
        @keyframes ringExpand{0%{transform:scale(.55);opacity:.5}100%{transform:scale(2.4);opacity:0}}
        @keyframes dotPulse{0%,80%,100%{transform:scale(0);opacity:.3}40%{transform:scale(1);opacity:1}}
      `}</style>
      <div onClick={e => e.target === e.currentTarget && onSkip()} style={{
        position: "fixed", inset: 0, zIndex: 1060,
        background: "rgba(0,0,0,.7)", backdropFilter: "blur(12px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        animation: "notifBackdropIn .2s ease both",
      }}>
        <div style={{
          width: "100%", maxWidth: 320,
          background: "#080E14",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 22, overflow: "hidden",
          boxShadow: "0 40px 100px rgba(0,0,0,.6)",
          animation: "notifCardIn .3s cubic-bezier(.34,1.4,.64,1) both",
        }}>
          <div style={{
            padding: "30px 22px 24px",
            background: hasError
              ? "linear-gradient(160deg,rgba(239,68,68,0.12),rgba(185,28,28,0.06))"
              : "linear-gradient(160deg,rgba(34,197,94,0.1),rgba(21,128,61,0.04))",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            display: "flex", flexDirection: "column", alignItems: "center",
            position: "relative", overflow: "hidden",
          }}>
            {!notifLoading && !hasError && [0,1].map(i => (
              <div key={i} style={{
                position: "absolute", top: "50%", left: "50%",
                width: 56, height: 56, borderRadius: "50%",
                border: "1px solid rgba(34,197,94,0.2)",
                transform: "translate(-50%,-50%)",
                animation: `ringExpand 2.2s ease-out ${i * .9}s infinite`,
              }}/>
            ))}
            <div style={{
              position: "relative", zIndex: 1,
              width: 56, height: 56, borderRadius: "50%",
              background: hasError
                ? "linear-gradient(135deg,#EF4444,#B91C1C)"
                : "linear-gradient(135deg,#22C55E,#15803D)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: hasError
                ? "0 6px 24px rgba(239,68,68,.35)"
                : "0 6px 24px rgba(34,197,94,.35)",
            }}>
              {notifLoading
                ? <Loader2 size={22} color="#fff" style={{ animation: "spin .85s linear infinite" }}/>
                : hasError
                  ? <AlertCircle size={22} color="#fff" strokeWidth={2.2}/>
                  : <Bell size={22} color="#fff" strokeWidth={2.2}
                      style={{ animation: "bellSwing 2.6s ease-in-out 1s infinite", transformOrigin: "top center" }}
                    />
              }
            </div>
            <div style={{ position: "relative", zIndex: 1, marginTop: 14, fontSize: 17, fontWeight: 900, color: "rgba(255,255,255,.92)", letterSpacing: "-0.3px", textAlign: "center" }}>
              {notifLoading ? "Connecting…" : hasError ? "Permission denied" : "Stay in the loop"}
            </div>
            <div style={{ position: "relative", zIndex: 1, marginTop: 5, fontSize: 12, color: "rgba(255,255,255,.35)", textAlign: "center", lineHeight: 1.5, maxWidth: 220 }}>
              {notifLoading ? "Registering your device…"
                : hasError ? notifError || "We couldn't get permission."
                : "Get an instant ping when a driver accepts."}
            </div>
          </div>
          <div style={{ padding: "16px 18px 20px" }}>
            {notifLoading && (
              <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 16 }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{
                    width: 6, height: 6, borderRadius: "50%", background: "#22C55E",
                    animation: `dotPulse 1.2s ease-in-out ${i * .2}s infinite`,
                  }}/>
                ))}
              </div>
            )}
            {!notifLoading && (
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <button onClick={onAllow} style={{
                  width: "100%", padding: "12px 0", borderRadius: 11, border: "none",
                  background: hasError
                    ? "linear-gradient(135deg,#EF4444,#B91C1C)"
                    : "linear-gradient(135deg,#22C55E,#15803D)",
                  color: "#fff", fontSize: 13, fontWeight: 800, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  boxShadow: hasError ? "0 4px 14px rgba(239,68,68,.25)" : "0 4px 14px rgba(34,197,94,.25)",
                }}>
                  {hasError ? <><RotateCcw size={13}/> Try again</> : <><Bell size={13}/> Enable notifications</>}
                </button>
                <button onClick={onSkip} style={{
                  width: "100%", padding: "11px 0", borderRadius: 11,
                  border: "1px solid rgba(255,255,255,0.07)",
                  background: "transparent",
                  color: "rgba(255,255,255,.3)", fontSize: 12, fontWeight: 600, cursor: "pointer",
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

// ─── Animated signal bars (searching state hero) ────────────────────────────
function SignalBars({ isUrgent }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 18 }}>
      {[4, 8, 12, 16, 20].map((h, i) => (
        <div key={i} style={{
          width: 3, height: h, borderRadius: 1.5,
          background: isUrgent ? "#EF4444" : "#22C55E",
          opacity: isUrgent ? 1 : 0.9,
          animation: `barBounce 1.2s ease-in-out ${i * .12}s infinite`,
          boxShadow: isUrgent ? "0 0 4px rgba(239,68,68,0.6)" : "0 0 4px rgba(34,197,94,0.6)",
        }}/>
      ))}
    </div>
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
  const [tick, setTick]                     = useState(0);

  const timerRef        = useRef(null);
  const closeTimeoutRef = useRef(null);
  const mountedRef      = useRef(true);
  const lastRideIdRef   = useRef(null);
  const unsubRef        = useRef(null);
  const accountUnsubRef = useRef(null);
  const notifRequestedRef = useRef(false);
  const didTimeoutRef   = useRef(false);
  const mapContainerRef = useRef(null);
  const mapRef          = useRef(null);

  const seedRide = useMemo(() => {
    if (!rides?.length) return null;
    return rides.find(r => r.paymentStatus === 'succeeded' && r.status !== 'completed' && r.status !== 'cancelled')
      ?? rides.find(r => r.status === 'pending_payment')
      ?? null;
  }, [rides]);

  const currentRide = liveRide ?? seedRide;
  const rideId      = currentRide?.id ?? null;
  const riderUid    = currentRide?.uid ?? null;

  // Candidate drivers from live ride doc
  const candidateDrivers = useMemo(() => {
    if (!Array.isArray(currentRide?.candidateDrivers)) return [];
    return [...currentRide.candidateDrivers].sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
  }, [currentRide?.candidateDrivers]);
  const currentDriverIndex = currentRide?.currentDriverIndex ?? 0;

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
      setTick(t => t + 1);
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
    const t = setTimeout(() => { if (mountedRef.current) handleClose(); }, 2000);
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
        zoom: 13.5,
        pitch: 45,
        bearing: -15,
        interactive: false,
        attributionControl: false,
      });
      map.on('load', () => {
        mapRef.current = map;
        setMapReady(true);
        let bearing = -15;
        const drift = setInterval(() => { bearing += 0.03; map.setBearing(bearing); }, 100);
        map.on('remove', () => clearInterval(drift));
      });
    };
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; setMapReady(false); } };
  }, [visible]);

  const total  = useMemo(() => { const v = Number(currentRide?.fareTotal ?? 0); return Number.isFinite(v) ? v.toFixed(2) : '0.00'; }, [currentRide]);
  const miles  = useMemo(() => { const v = Number(currentRide?.tripDistanceMiles ?? 0); return Number.isFinite(v) ? v.toFixed(1) : '0.0'; }, [currentRide]);
  const duration = currentRide?.tripDurationMin ?? null;

  const progress = useMemo(() => {
    if (!currentRide?.createdAt) return 0;
    const ms = currentRide.createdAt instanceof Date
      ? currentRide.createdAt.getTime()
      : currentRide.createdAt?.toDate?.()?.getTime?.() ?? new Date(currentRide.createdAt).getTime();
    if (isNaN(ms)) return 0;
    return (Math.min(SEARCH_LIMIT_SEC, Math.floor((Date.now() - ms) / 1000)) / SEARCH_LIMIT_SEC) * 100;
  }, [currentRide?.createdAt, tick]);

  const minutes  = Math.floor(secondsLeft / 60);
  const seconds  = secondsLeft % 60;
  const isUrgent = secondsLeft > 0 && secondsLeft < 60;
  const pickup   = currentRide?.pickup  ?? '—';
  const dropoff  = currentRide?.dropoff ?? '—';
  const rideLabel = currentRide?.rideLabel ?? currentRide?.rideType ?? 'Ride';
  const paymentMethod = currentRide?.paymentMethod ?? null;

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

  // Arc arc for SVG countdown ring
  const RING_R = 36;
  const RING_CIRC = 2 * Math.PI * RING_R;
  const ringProgress = secondsLeft > 0 ? (secondsLeft / SEARCH_LIMIT_SEC) : 0;
  const ringOffset = RING_CIRC * (1 - ringProgress);

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
        @keyframes fadeIn  { from { opacity:0; } to { opacity:1; } }
        @keyframes assignedPop { 0%{transform:scale(.75);opacity:0} 60%{transform:scale(1.06)} 100%{transform:scale(1);opacity:1} }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes activeDriverPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(.85)} }
        @keyframes pingRing { 0%{transform:scale(1);opacity:.6} 100%{transform:scale(2.2);opacity:0} }
        @keyframes barBounce { 0%,100%{transform:scaleY(1)} 50%{transform:scaleY(.45)} }
        @keyframes scanLine { 0%{transform:translateY(-100%)} 100%{transform:translateY(400%)} }
        @keyframes urgentFlash { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes checkIn { 0%{stroke-dashoffset:100} 100%{stroke-dashoffset:0} }
        @keyframes ringRotate { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{
        position: "fixed", inset: 0, zIndex: 999,
        transition: "opacity .28s ease",
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? "auto" : "none",
      }}>
        {/* Live Mapbox BG */}
        <div ref={mapContainerRef} style={{ position: "absolute", inset: 0 }}/>

        {/* Gradient scrim */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to bottom, rgba(0,0,0,.3) 0%, rgba(0,0,0,.05) 30%, rgba(0,0,0,.75) 80%, rgba(0,0,0,.9) 100%)",
          pointerEvents: "none",
        }}/>

        {showNotifPopup && (
          <NotificationPopup
            notifLoading={notifLoading}
            notifError={notifError}
            onAllow={handleEnableNotifications}
            onSkip={() => { setShowNotifPopup(false); setNotifError(""); }}
          />
        )}

        {/* ── Bottom Sheet ── */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          display: "flex", justifyContent: "center", alignItems: "flex-end",
        }}>
          <div style={{
            width: "100%", maxWidth: 460,
            background: "rgba(6,10,16,0.97)",
            backdropFilter: "blur(28px)",
            borderRadius: "22px 22px 0 0",
            border: "1px solid rgba(255,255,255,0.06)",
            borderBottom: "none",
            boxShadow: "0 -20px 60px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,0.06)",
            overflow: "hidden",
            transform: visible ? "translateY(0)" : "translateY(100%)",
            transition: "transform .38s cubic-bezier(.32,1.1,.64,1)",
          }}>

            {/* Drag handle */}
            <div style={{ display: "flex", justifyContent: "center", paddingTop: 10, paddingBottom: 2 }}>
              <div style={{ width: 32, height: 3.5, borderRadius: 2, background: "rgba(255,255,255,0.12)" }}/>
            </div>

            {/* ══ CHECKING PAYMENT ══════════════════════════════════════ */}
            {status === 'checking_payment' && (
              <div style={{ padding: "22px 22px 30px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
                  <div style={{
                    width: 46, height: 46, borderRadius: 14,
                    background: "rgba(96,165,250,0.1)",
                    border: "1px solid rgba(96,165,250,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <Loader2 size={22} color="#60A5FA" style={{ animation: "spin 1s linear infinite" }}/>
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "rgba(255,255,255,.92)", letterSpacing: "-0.3px" }}>
                      Verifying payment
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,.35)", marginTop: 2 }}>
                      Confirming your booking…
                    </div>
                  </div>
                </div>
                {/* Skeleton loader lines */}
                <div style={{ marginBottom: 20 }}>
                  {[80, 60, 40].map((w, i) => (
                    <div key={i} style={{
                      height: 10, borderRadius: 6, marginBottom: 10,
                      width: `${w}%`,
                      background: "linear-gradient(90deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.08) 50%,rgba(255,255,255,0.04) 100%)",
                      backgroundSize: "200% 100%",
                      animation: `shimmer 1.8s linear ${i * .2}s infinite`,
                    }}/>
                  ))}
                </div>
                <button onClick={handleClose} style={{
                  width: "100%", padding: "12px 0", borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "transparent",
                  fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,.35)", cursor: "pointer",
                }}>
                  Cancel
                </button>
              </div>
            )}

            {/* ══ SEARCHING ════════════════════════════════════════════ */}
            {status === 'searching' && (
              <div>
                {/* Thin progress rail */}
                <div style={{ height: 2, background: "rgba(255,255,255,0.04)" }}>
                  <div style={{
                    height: "100%",
                    width: `${100 - progress}%`,
                    background: isUrgent ? "#EF4444" : "#22C55E",
                    transition: "width 1s linear, background .5s",
                    boxShadow: isUrgent ? "0 0 6px rgba(239,68,68,.6)" : "0 0 6px rgba(34,197,94,.5)",
                  }}/>
                </div>

                <div style={{ padding: "18px 20px 26px" }}>

                  {/* ── Hero: Ring timer + Status ── */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 16,
                    background: isUrgent
                      ? "linear-gradient(135deg,rgba(239,68,68,0.09),rgba(185,28,28,0.05))"
                      : "linear-gradient(135deg,rgba(34,197,94,0.08),rgba(21,128,61,0.04))",
                    border: `1px solid ${isUrgent ? "rgba(239,68,68,0.18)" : "rgba(34,197,94,0.15)"}`,
                    borderRadius: 16,
                    padding: "16px 18px",
                    marginBottom: 12,
                    position: "relative", overflow: "hidden",
                  }}>
                    {/* Scan line effect */}
                    <div style={{
                      position: "absolute", left: 0, right: 0, height: "50%",
                      background: `linear-gradient(to bottom, transparent, ${isUrgent ? "rgba(239,68,68,0.04)" : "rgba(34,197,94,0.04)"}, transparent)`,
                      animation: "scanLine 3s linear infinite",
                      pointerEvents: "none",
                    }}/>

                    {/* SVG countdown ring */}
                    <div style={{ position: "relative", flexShrink: 0, width: 88, height: 88 }}>
                      <svg width="88" height="88" viewBox="0 0 88 88" style={{ transform: "rotate(-90deg)" }}>
                        <circle cx="44" cy="44" r={RING_R} fill="none"
                          stroke="rgba(255,255,255,0.05)" strokeWidth="4"/>
                        <circle cx="44" cy="44" r={RING_R} fill="none"
                          stroke={isUrgent ? "#EF4444" : "#22C55E"} strokeWidth="4"
                          strokeLinecap="round"
                          strokeDasharray={RING_CIRC}
                          strokeDashoffset={ringOffset}
                          style={{
                            transition: "stroke-dashoffset 1s linear, stroke .5s",
                            filter: isUrgent ? "drop-shadow(0 0 4px #EF4444)" : "drop-shadow(0 0 4px #22C55E)",
                          }}
                        />
                      </svg>
                      {/* Inner text */}
                      <div style={{
                        position: "absolute", inset: 0,
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                        animation: isUrgent ? "urgentFlash 1s ease-in-out infinite" : "none",
                      }}>
                        <div style={{
                          fontFamily: '"JetBrains Mono", "Courier New", monospace',
                          fontSize: 20, fontWeight: 700, lineHeight: 1,
                          color: isUrgent ? "#EF4444" : "#22C55E",
                          letterSpacing: "-1.5px",
                        }}>
                          {String(minutes).padStart(2,'0')}:{String(seconds).padStart(2,'0')}
                        </div>
                        <div style={{
                          fontSize: 9, fontWeight: 700, letterSpacing: ".1em",
                          textTransform: "uppercase", marginTop: 3,
                          color: isUrgent ? "rgba(252,165,165,.5)" : "rgba(134,239,172,.5)",
                        }}>
                          left
                        </div>
                      </div>
                    </div>

                    {/* Status text + signal bars */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <SignalBars isUrgent={isUrgent}/>
                        <div style={{
                          fontSize: 9, fontWeight: 800, letterSpacing: ".16em",
                          textTransform: "uppercase", fontFamily: "monospace",
                          color: isUrgent ? "rgba(252,165,165,.6)" : "rgba(134,239,172,.6)",
                        }}>
                          {isUrgent ? "Low coverage" : "Live"}
                        </div>
                      </div>
                      <div style={{
                        fontSize: 15, fontWeight: 900, color: "rgba(255,255,255,.9)",
                        letterSpacing: "-0.3px", lineHeight: 1.2, marginBottom: 4,
                      }}>
                        {isUrgent ? "Almost out of time" : "Searching for a driver"}
                      </div>
                      <div style={{
                        fontSize: 11, color: "rgba(255,255,255,.35)", lineHeight: 1.4,
                      }}>
                        {candidateDrivers.length > 0
                          ? `${candidateDrivers.length} driver${candidateDrivers.length !== 1 ? 's' : ''} in range`
                          : "Scanning nearby drivers"}
                      </div>
                    </div>
                  </div>

                  {/* ── Candidate driver dots ── */}
                  {candidateDrivers.length > 0 && (
                    <DriverPingRow candidates={candidateDrivers} currentIndex={currentDriverIndex}/>
                  )}

                  {/* ── Phone capture ── */}
                  {shouldShowPhoneCapture && (
                    <PhoneCaptureCard
                      uid={riderUid}
                      onSkip={handleSkipPhone}
                      onSaved={(p) => setAccountPhone(p)}
                    />
                  )}

                  {/* ── Route + Fare row ── */}
                  <div style={{
                    display: "grid", gridTemplateColumns: "1fr auto",
                    background: "rgba(255,255,255,0.025)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 13,
                    overflow: "hidden",
                    marginBottom: 10,
                  }}>
                    {/* Route */}
                    <div style={{ padding: "12px 14px", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ display: "flex", gap: 9, alignItems: "stretch" }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 2, flexShrink: 0 }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#60A5FA", boxShadow: "0 0 5px rgba(96,165,250,0.5)" }}/>
                          <div style={{ width: 1, flex: 1, minHeight: 10, background: "linear-gradient(to bottom,rgba(96,165,250,0.3),rgba(34,197,94,0.3))", margin: "3px 0" }}/>
                          <div style={{ width: 6, height: 6, borderRadius: 1.5, background: "#22C55E", transform: "rotate(45deg)", boxShadow: "0 0 5px rgba(34,197,94,0.5)" }}/>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.75)", marginBottom: 7, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pickup}</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dropoff}</div>
                        </div>
                      </div>
                    </div>
                    {/* Fare */}
                    <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", alignItems: "flex-end", justifyContent: "center", gap: 3 }}>
                      <div style={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: 18, fontWeight: 700, color: "#22C55E",
                        lineHeight: 1,
                      }}>
                        ${total}
                      </div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,.2)", letterSpacing: ".05em" }}>
                        {miles}mi · {duration ? `${duration}min` : rideLabel}
                      </div>
                      {paymentMethod && (
                        <div style={{
                          fontSize: 8, fontWeight: 800, letterSpacing: ".1em",
                          textTransform: "uppercase", color: "rgba(134,239,172,.4)",
                          fontFamily: "monospace",
                        }}>
                          {paymentMethod}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Cancel ── */}
                  <button onClick={handleCancelRide} disabled={cancelLoading} style={{
                    width: "100%", padding: "10px 0",
                    borderRadius: 11, border: "1px solid rgba(255,255,255,0.05)",
                    background: "transparent",
                    color: "rgba(255,255,255,.25)", fontSize: 12, fontWeight: 600,
                    cursor: cancelLoading ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    transition: "color .15s",
                  }}>
                    {cancelLoading
                      ? <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }}/> Cancelling…</>
                      : "Cancel ride"
                    }
                  </button>
                  {cancelError && (
                    <div style={{ marginTop: 6, fontSize: 10, color: "#FCA5A5", textAlign: "center" }}>{cancelError}</div>
                  )}
                </div>
              </div>
            )}

            {/* ══ ASSIGNED ═════════════════════════════════════════════ */}
            {status === 'assigned' && (
              <div style={{ padding: "20px 20px 30px" }}>

                {/* Split hero: green left panel + driver right */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                  marginBottom: 12,
                }}>
                  {/* Confirmed badge */}
                  <div style={{
                    background: "linear-gradient(145deg,rgba(34,197,94,0.14),rgba(21,128,61,0.07))",
                    border: "1px solid rgba(34,197,94,0.22)",
                    borderRadius: 15,
                    padding: "18px 16px",
                    display: "flex", flexDirection: "column", justifyContent: "space-between",
                    animation: "fadeIn .35s ease both",
                  }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: "50%",
                      background: "rgba(34,197,94,0.15)",
                      border: "1.5px solid rgba(34,197,94,0.3)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 0 24px rgba(34,197,94,0.2)",
                      animation: "assignedPop .5s cubic-bezier(.34,1.56,.64,1) both",
                      marginBottom: 10,
                    }}>
                      <svg width="22" height="22" viewBox="0 0 22 22" fill="none"
                        style={{ overflow: "visible" }}>
                        <polyline points="4,12 9,17 18,6"
                          stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                          fill="none"
                          strokeDasharray="30" strokeDashoffset="0"
                          style={{ animation: "checkIn .4s ease .2s both" }}
                        />
                      </svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: "#22C55E", letterSpacing: "-0.3px", lineHeight: 1.1 }}>
                        Matched!
                      </div>
                      <div style={{ fontSize: 10, color: "rgba(134,239,172,.5)", marginTop: 3 }}>
                        On the way
                      </div>
                    </div>
                  </div>

                  {/* Fare summary */}
                  <div style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 15,
                    padding: "18px 16px",
                    display: "flex", flexDirection: "column", justifyContent: "space-between",
                    animation: "slideUp .4s cubic-bezier(.34,1.2,.64,1) .08s both",
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: ".14em", textTransform: "uppercase", color: "rgba(255,255,255,.2)", fontFamily: "monospace" }}>
                      Confirmed fare
                    </div>
                    <div>
                      <div style={{
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: 26, fontWeight: 700, color: "#22C55E", lineHeight: 1, letterSpacing: "-1px",
                        marginBottom: 4,
                      }}>
                        ${total}
                      </div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,.3)" }}>
                        {rideLabel} · {miles}mi
                      </div>
                    </div>
                  </div>
                </div>

                {/* Driver card */}
                {driver && (
                  <div style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 14, padding: "13px 14px",
                    display: "flex", alignItems: "center", gap: 12,
                    marginBottom: 12,
                    animation: "slideUp .4s cubic-bezier(.34,1.2,.64,1) .16s both",
                  }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
                      background: "linear-gradient(135deg,#22C55E,#15803D)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 16, fontWeight: 900, color: "#fff",
                      boxShadow: "0 3px 10px rgba(34,197,94,.3)",
                    }}>
                      {driver.name?.[0] ?? '?'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "rgba(255,255,255,.9)" }}>{driver.name || 'Driver'}</div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,.35)", marginTop: 2 }}>
                        {driver.vehicle || 'Vehicle'} · {driver.plate || '—'}
                      </div>
                    </div>
                    {driver.rating && (
                      <div style={{
                        background: "rgba(251,146,60,0.12)",
                        border: "1px solid rgba(251,146,60,0.25)",
                        borderRadius: 8, padding: "4px 9px",
                        fontSize: 12, fontWeight: 800, color: "#FED7AA",
                        flexShrink: 0,
                      }}>
                        ★ {driver.rating}
                      </div>
                    )}
                  </div>
                )}

                <button onClick={handleClose} style={{
                  width: "100%", padding: "14px 0", borderRadius: 13, border: "none",
                  background: "linear-gradient(135deg,#22C55E,#15803D)",
                  color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer",
                  boxShadow: "0 4px 18px rgba(34,197,94,.3)",
                  animation: "slideUp .4s cubic-bezier(.34,1.2,.64,1) .24s both",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                }}>
                  <Navigation size={14} strokeWidth={2.5}/> Track My Ride
                </button>
              </div>
            )}

            {/* ══ TIMEOUT ══════════════════════════════════════════════ */}
            {status === 'timeout' && (
              <div style={{ padding: "20px 20px 30px" }}>

                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12,
                }}>
                  {/* No driver found */}
                  <div style={{
                    background: "linear-gradient(145deg,rgba(239,68,68,0.1),rgba(185,28,28,0.05))",
                    border: "1px solid rgba(239,68,68,0.18)",
                    borderRadius: 15, padding: "18px 16px",
                    display: "flex", flexDirection: "column", justifyContent: "space-between",
                    animation: "fadeIn .35s ease both",
                  }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: "50%",
                      background: "rgba(239,68,68,0.12)",
                      border: "1.5px solid rgba(239,68,68,0.25)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: "0 0 20px rgba(239,68,68,0.15)",
                      marginBottom: 10,
                    }}>
                      <WifiOff size={18} color="#EF4444" strokeWidth={2}/>
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 900, color: "#EF4444", letterSpacing: "-0.2px", lineHeight: 1.2 }}>
                        No drivers<br/>found
                      </div>
                      <div style={{ fontSize: 10, color: "rgba(252,165,165,.4)", marginTop: 3 }}>
                        Area searched
                      </div>
                    </div>
                  </div>

                  {/* Route + fare */}
                  <div style={{
                    background: "rgba(255,255,255,0.025)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: 15, padding: "14px",
                    display: "flex", flexDirection: "column", justifyContent: "space-between",
                    animation: "slideUp .35s ease .05s both",
                  }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "stretch", marginBottom: 8 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 2, flexShrink: 0 }}>
                        <div style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(96,165,250,0.6)" }}/>
                        <div style={{ width: 1, flex: 1, minHeight: 8, background: "rgba(255,255,255,0.08)", margin: "2px 0" }}/>
                        <div style={{ width: 5, height: 5, borderRadius: 1, background: "rgba(34,197,94,0.6)", transform: "rotate(45deg)" }}/>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.55)", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pickup}</div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,.3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dropoff}</div>
                      </div>
                    </div>
                    <div style={{
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: 20, fontWeight: 700, color: "#22C55E",
                    }}>
                      ${total}
                    </div>
                  </div>
                </div>

                <div style={{
                  fontSize: 9, fontWeight: 800, letterSpacing: ".16em",
                  textTransform: "uppercase", color: "rgba(255,255,255,.18)",
                  marginBottom: 8, fontFamily: "monospace",
                }}>
                  What would you like to do?
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button
                    onClick={handleWaitMore}
                    disabled={actionLoading || cancelLoading}
                    style={{
                      width: "100%", padding: "14px 0", borderRadius: 12, border: "none",
                      background: actionLoading || cancelLoading
                        ? "rgba(34,197,94,0.15)"
                        : "linear-gradient(135deg,#22C55E,#15803D)",
                      color: "#fff", fontSize: 14, fontWeight: 800,
                      cursor: actionLoading || cancelLoading ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                      boxShadow: actionLoading || cancelLoading ? "none" : "0 4px 14px rgba(34,197,94,.28)",
                      opacity: actionLoading || cancelLoading ? 0.6 : 1,
                      transition: "all .15s",
                    }}
                  >
                    {actionLoading
                      ? <><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }}/> Extending…</>
                      : <><RotateCcw size={14} strokeWidth={2.5}/> Keep searching</>
                    }
                  </button>

                  <button
                    onClick={handleCancelRide}
                    disabled={actionLoading || cancelLoading}
                    style={{
                      width: "100%", padding: "12px 0", borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.07)",
                      background: "transparent",
                      color: "rgba(255,255,255,.35)", fontSize: 13, fontWeight: 600,
                      cursor: actionLoading || cancelLoading ? "not-allowed" : "pointer",
                      opacity: actionLoading || cancelLoading ? 0.5 : 1,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    }}
                  >
                    {cancelLoading
                      ? <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }}/> Cancelling…</>
                      : "Cancel this ride"
                    }
                  </button>
                </div>
                {cancelError && (
                  <div style={{ marginTop: 8, fontSize: 10, color: "#FCA5A5", textAlign: "center" }}>{cancelError}</div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
