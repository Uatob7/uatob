import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, Star, LocateFixed, Loader2, X, AlertCircle, CheckCircle2, Info } from "lucide-react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

import CSS              from '@/App/Drivers/styles.js';
import { C }            from '@/App/Drivers/constants.js';
import UaTobIcon        from '@/App/Drivers/Icon.jsx';
import TripRequestModal from '@/App/Drivers/TripRequestModal.jsx';
import BottomTabBar     from '@/App/Drivers/BottomTabBar.jsx';
import HomeTab          from '@/App/Drivers/HomeTab.jsx';
import EarningsTab      from '@/App/Drivers/EarningsTab.jsx';
import TripsTab         from '@/App/Drivers/TripsTab.jsx';
import ProfileTab       from '@/App/Drivers/ProfileTab.jsx';
import DriverReviewModal from '@/App/Drivers/DriverReviewModal.jsx';
import { useDriverAccount }   from "@/App/Drivers/useDriverAccount";
import { useDriverRides }     from '@/App/Drivers/useDriverRides';
import { useActiveRides }     from "@/App/Drivers/useActiveRides";
import { useDriverEarnings }  from "@/App/Drivers/useDriverEarnings";
import { useCompletedRides }  from "@/App/Drivers/useCompletedRides";
import { useIncomingRequest } from "@/App/Drivers/useIncomingRequest";
import { useDriverReviews }   from "@/App/Drivers/useDriverReviews";
import { firebase_app }       from "@/firebase/config";

// ── Callables ─────────────────────────────────────────────────────────
const functions          = getFunctions(firebase_app, "us-east1");
const callDriverStatus   = httpsCallable(functions, "DriverStatus");
const callAcceptRide     = httpsCallable(functions, "acceptRide");
const callDeclineRide    = httpsCallable(functions, "declineRide");
const callUpdateTrip     = httpsCallable(functions, "updateTripStatus");
const callSaveFcmToken   = httpsCallable(functions, "saveDriverFcmToken");

// ── Trip button labels ────────────────────────────────────────────────
const TRIP_BUTTON_LABELS = {
  driver_assigned: "Arrived at Pickup",
  arrived:         "Start Trip",
  in_progress:     "Complete Trip",
};

// ── localStorage helpers for seen review IDs ──────────────────────────
const LS_SEEN_REVIEWS_KEY = 'uatob_driver_seen_reviews';
function loadSeenReviews()    { try { return new Set(JSON.parse(localStorage.getItem(LS_SEEN_REVIEWS_KEY) || '[]')); } catch { return new Set(); } }
function saveSeenReviews(set) { try { localStorage.setItem(LS_SEEN_REVIEWS_KEY, JSON.stringify([...set])); } catch (_) {} }

// ── FCM Push Registration ─────────────────────────────────────────────
// Called AFTER the driver taps "Enable" on the styled NotificationPopup.
// At that point we're still inside the user-gesture call stack

// ── FCM Push Registration ─────────────────────────────────────────────
async function registerFcmToken(uid) {
  try {
    if (!("Notification" in window)) {
      console.warn("[UaTob] Push not supported in this browser");
      return;
    }
    const permission = await window.Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("[UaTob] Push permission denied by driver");
      return;
    }
    const messaging = getMessaging(firebase_app);
    const token = await getToken(messaging, {
      vapidKey: "BJ_sRHZonSGCKk2mB2i9ofTRS8ouFVMV-I15FX4sqdUXHyVb1lo6H-N4GMPrlcIIshRlykQicaxkxxFxcYcI4JQ",
    });
    if (!token) {
      console.warn("[UaTob] FCM returned empty token — check that firebase-messaging-sw.js exists at /");
      return;
    }
    await callSaveFcmToken({ driverId: uid, token });
    console.log("[UaTob] FCM token registered successfully");
  } catch (err) {
    console.warn("[UaTob] Push registration failed:", err.message);
  }
}

// ── Trip request chime ────────────────────────────────────────────────
function playRequestChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const master = ctx.createGain();
    master.gain.value = 0.18;
    master.connect(ctx.destination);
    const playTone = ({ freq, type = "sine", start, duration, volume = 0.25 }) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      osc.connect(gain);
      gain.connect(master);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.start(start);
      osc.stop(start + duration);
    };
    const now     = ctx.currentTime + 0.02;
    const pattern = [
      { t: 0.00, f1: 740,  f2: 1110, d: 0.18 },
      { t: 0.24, f1: 880,  f2: 1320, d: 0.18 },
      { t: 0.48, f1: 1047, f2: 1568, d: 0.26 },
      { t: 0.95, f1: 740,  f2: 1110, d: 0.18 },
      { t: 1.19, f1: 880,  f2: 1320, d: 0.18 },
      { t: 1.43, f1: 1047, f2: 1568, d: 0.30 },
    ];
    pattern.forEach(({ t, f1, f2, d }) => {
      playTone({ freq: f1, type: "sine",     start: now + t, duration: d, volume: 0.22 });
      playTone({ freq: f2, type: "triangle", start: now + t, duration: d, volume: 0.12 });
    });
    const noise     = ctx.createBufferSource();
    const buffer    = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
    const data      = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / 1800);
    noise.buffer    = buffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.03;
    noise.connect(noiseGain);
    noiseGain.connect(master);
    noise.start(now + 0.01);
    noise.stop(now + 0.08);
    setTimeout(() => ctx.close().catch(() => {}), 3000);
  } catch (err) { console.warn("Audio playback failed:", err); }
}

function playAcceptSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
    const playTone = ({ freq, type = "sine", start, duration, volume }) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      osc.connect(gain);
      gain.connect(master);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.start(start);
      osc.stop(start + duration);
    };
    const now = ctx.currentTime + 0.02;
    playTone({ freq: 784,  type: "sine",     start: now,        duration: 0.14, volume: 0.28 });
    playTone({ freq: 1568, type: "triangle", start: now,        duration: 0.14, volume: 0.10 });
    playTone({ freq: 1047, type: "sine",     start: now + 0.13, duration: 0.22, volume: 0.32 });
    playTone({ freq: 2093, type: "triangle", start: now + 0.13, duration: 0.22, volume: 0.08 });
    const bodyOsc  = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    bodyOsc.type = "sine";
    bodyOsc.frequency.setValueAtTime(180, now);
    bodyOsc.frequency.exponentialRampToValueAtTime(60, now + 0.12);
    bodyGain.gain.setValueAtTime(0.0001, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    bodyOsc.connect(bodyGain);
    bodyGain.connect(master);
    bodyOsc.start(now);
    bodyOsc.stop(now + 0.12);
    setTimeout(() => ctx.close().catch(() => {}), 2000);
  } catch (err) { console.warn("Accept sound failed:", err); }
}

function playDeclineSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const master = ctx.createGain();
    master.gain.value = 0.20;
    master.connect(ctx.destination);
    const playTone = ({ freq, type = "sine", start, duration, volume }) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      osc.connect(gain);
      gain.connect(master);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.start(start);
      osc.stop(start + duration);
    };
    const now = ctx.currentTime + 0.02;
    playTone({ freq: 330, type: "sine",   start: now,        duration: 0.16, volume: 0.22 });
    playTone({ freq: 660, type: "square", start: now,        duration: 0.10, volume: 0.04 });
    playTone({ freq: 247, type: "sine",   start: now + 0.13, duration: 0.20, volume: 0.18 });
    playTone({ freq: 494, type: "square", start: now + 0.13, duration: 0.14, volume: 0.03 });
    const thudOsc  = ctx.createOscillator();
    const thudGain = ctx.createGain();
    thudOsc.type = "sine";
    thudOsc.frequency.setValueAtTime(100, now);
    thudOsc.frequency.exponentialRampToValueAtTime(40, now + 0.14);
    thudGain.gain.setValueAtTime(0.0001, now);
    thudGain.gain.exponentialRampToValueAtTime(0.15, now + 0.01);
    thudGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    thudOsc.connect(thudGain);
    thudGain.connect(master);
    thudOsc.start(now);
    thudOsc.stop(now + 0.14);
    setTimeout(() => ctx.close().catch(() => {}), 2000);
  } catch (err) { console.warn("Decline sound failed:", err); }
}

// ── APP NOTIFICATION (replaces AppNotification import) ───────────────
// Matches LocationPopup card aesthetic: rounded pill toast, top-center,
// Barlow typography, green / red / blue accent ring, smooth slide-down.
const NOTIF_STYLES = `
  @keyframes notifSlideDown {
    from { opacity: 0; transform: translateY(-20px) scale(0.96); }
    to   { opacity: 1; transform: translateY(0)     scale(1);    }
  }
  @keyframes notifSlideUp {
    from { opacity: 1; transform: translateY(0)     scale(1);    }
    to   { opacity: 0; transform: translateY(-16px) scale(0.97); }
  }
  @keyframes notifProgress {
    from { width: 100%; }
    to   { width: 0%;   }
  }
`;

function getNotifTheme(title) {
  const t = (title || "").toLowerCase();
  if (t.includes("accept") || t.includes("online") || t.includes("complete") || t.includes("trip"))
    return { color: "#16A34A", bg: "rgba(22,163,74,.10)", border: "rgba(22,163,74,.30)", ring: "rgba(22,163,74,.06)", Icon: CheckCircle2 };
  if (t.includes("offline") || t.includes("declin") || t.includes("error") || t.includes("fail") || t.includes("expired"))
    return { color: "#DC2626", bg: "rgba(220,38,38,.08)", border: "rgba(220,38,38,.25)", ring: "rgba(220,38,38,.05)", Icon: AlertCircle };
  return { color: "#2563EB", bg: "rgba(37,99,235,.08)", border: "rgba(37,99,235,.25)", ring: "rgba(37,99,235,.05)", Icon: Info };
}

function AppNotification({ activeTrip, notificationOverride }) {
  // notificationOverride = { title, msg } passed in from parent state
  const notif = notificationOverride;
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const hideTimer = useRef(null);

  useEffect(() => {
    if (!notif) { setVisible(false); setLeaving(false); return; }
    setLeaving(false);
    setVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setLeaving(true);
      setTimeout(() => setVisible(false), 280);
    }, 2800);
    return () => clearTimeout(hideTimer.current);
  }, [notif?.title, notif?.msg]);

  if (!visible || !notif) return null;

  const theme = getNotifTheme(notif.title);
  const { Icon } = theme;

  return (
    <>
      <style>{NOTIF_STYLES}</style>
      <div
        style={{
          position:       "fixed",
          top:            "16px",
          left:           "50%",
          transform:      "translateX(-50%)",
          zIndex:         1200,
          width:          "calc(100% - 32px)",
          maxWidth:       "400px",
          animation:      leaving
            ? "notifSlideUp .28s cubic-bezier(.4,0,.6,1) forwards"
            : "notifSlideDown .32s cubic-bezier(.34,1.56,.64,1) forwards",
        }}
      >
        <div
          style={{
            background:   "#fff",
            borderRadius: "20px",
            padding:      "14px 16px 14px 14px",
            boxShadow:    "0 8px 32px rgba(0,0,0,.13), 0 2px 8px rgba(0,0,0,.07)",
            border:       `1.5px solid ${theme.border}`,
            display:      "flex",
            alignItems:   "center",
            gap:          "12px",
            overflow:     "hidden",
            position:     "relative",
          }}
        >
          {/* Icon bubble */}
          <div
            style={{
              flexShrink:   0,
              width:        "42px",
              height:       "42px",
              borderRadius: "50%",
              background:   theme.bg,
              border:       `1.5px solid ${theme.border}`,
              boxShadow:    `0 0 0 6px ${theme.ring}`,
              display:      "flex",
              alignItems:   "center",
              justifyContent: "center",
            }}
          >
            <Icon size={18} color={theme.color} strokeWidth={2.2} />
          </div>

          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily:   "'Barlow Condensed', sans-serif",
                fontSize:     "15px",
                fontWeight:   "900",
                color:        "#111827",
                letterSpacing: "-0.2px",
                lineHeight:   1.2,
                marginBottom: "2px",
                whiteSpace:   "nowrap",
                overflow:     "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {notif.title}
            </div>
            <div
              style={{
                fontSize:   "13px",
                color:      "#6B7280",
                fontWeight: "500",
                fontFamily: "'Barlow', sans-serif",
                whiteSpace: "nowrap",
                overflow:   "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {notif.msg}
            </div>
          </div>

          {/* Progress bar */}
          <div
            style={{
              position:     "absolute",
              bottom:       0,
              left:         0,
              height:       "3px",
              borderRadius: "0 0 20px 20px",
              background:   theme.color,
              opacity:      0.35,
              animation:    "notifProgress 3s linear forwards",
            }}
          />
        </div>
      </div>
    </>
  );
}

// ── NOTIFICATION PERMISSION POPUP ────────────────────────────────────
function NotificationPopup({ onEnable, onSkip, loading }) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onSkip(); }}
      style={{ position: "fixed", inset: 0, zIndex: 1050, background: "rgba(0,0,0,.45)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", animation: "locFadeIn .2s ease" }}
    >
      <style>{`
        @keyframes locFadeIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes locSlideUp { from { opacity:0; transform:translateY(18px) } to { opacity:1; transform:translateY(0) } }
        @keyframes locSpin    { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
        .notif-enable-btn:active { transform: scale(0.97); }
      `}</style>
      <div style={{ background: "#fff", borderRadius: "24px", padding: "28px 24px 24px", width: "100%", maxWidth: "360px", boxShadow: "0 24px 60px rgba(0,0,0,.18)", animation: "locSlideUp .28s cubic-bezier(.34,1.56,.64,1)" }}>

        {/* Icon bubble */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
          <div style={{ width: "68px", height: "68px", borderRadius: "50%", background: "rgba(37,99,235,.09)", border: "2px solid rgba(37,99,235,.25)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 8px rgba(37,99,235,.05)" }}>
            {loading
              ? <Loader2 size={28} color="#2563EB" style={{ animation: "locSpin 1s linear infinite" }} />
              : <Bell size={28} color="#2563EB" />
            }
          </div>
        </div>

        {/* Text */}
        <div style={{ textAlign: "center", marginBottom: "8px" }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "22px", fontWeight: "900", color: "#111827", letterSpacing: "-0.3px", marginBottom: "6px" }}>
            Stay in the loop
          </div>
          <div style={{ fontSize: "13.5px", color: "#6B7280", fontWeight: "500", lineHeight: "1.6" }}>
            Enable push notifications so you never miss a ride request — even when the app is in the background.
          </div>
        </div>

        {/* Bullet points */}
        {!loading && (
          <div style={{ margin: "16px 0 22px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              { icon: "🔔", text: "Instant ride request alerts" },
              { icon: "📍", text: "Trip status updates" },
              { icon: "💰", text: "Earning confirmations" },
            ].map(({ icon, text }) => (
              <div key={text} style={{ display: "flex", alignItems: "center", gap: "10px", background: "rgba(37,99,235,.04)", borderRadius: "10px", padding: "9px 12px", border: "1px solid rgba(37,99,235,.10)" }}>
                <span style={{ fontSize: "16px", lineHeight: 1 }}>{icon}</span>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#374151", fontFamily: "'Barlow', sans-serif" }}>{text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Buttons */}
        {!loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <button
              className="notif-enable-btn"
              onClick={onEnable}
              style={{ width: "100%", padding: "15px", borderRadius: "14px", border: "none", background: "linear-gradient(135deg,#3B82F6,#2563EB 55%,#1D4ED8)", color: "#fff", fontSize: "15px", fontWeight: "800", fontFamily: "'Barlow', sans-serif", cursor: "pointer", boxShadow: "0 4px 14px rgba(37,99,235,.35)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", transition: "transform .1s" }}
            >
              <Bell size={16} />
              Enable notifications
            </button>
            <button
              onClick={onSkip}
              style={{ width: "100%", padding: "14px", borderRadius: "14px", border: "1.5px solid #E5E7EB", background: "#fff", color: "#6B7280", fontSize: "14px", fontWeight: "700", fontFamily: "'Barlow', sans-serif", cursor: "pointer" }}
            >
              Not now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ACCOUNT SUSPENDED MODAL ───────────────────────────────────────────
function SuspendedModal() {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", animation: "locFadeIn .2s ease" }}>
      <style>{`
        @keyframes locFadeIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes locSlideUp { from { opacity:0; transform:translateY(18px) } to { opacity:1; transform:translateY(0) } }
      `}</style>
      <div style={{ background: "#fff", borderRadius: "24px", padding: "32px 24px 28px", width: "100%", maxWidth: "380px", boxShadow: "0 24px 60px rgba(0,0,0,.2)", animation: "locSlideUp .28s cubic-bezier(.34,1.56,.64,1)", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
          <div style={{ width: "72px", height: "72px", borderRadius: "50%", background: "rgba(220,38,38,.08)", border: "2px solid rgba(220,38,38,.25)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 8px rgba(220,38,38,.05)" }}>
            <AlertCircle size={32} color="#DC2626" />
          </div>
        </div>
        <div style={{ marginBottom: "12px" }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "26px", fontWeight: "900", color: "#111827", letterSpacing: "-0.3px", marginBottom: "8px" }}>Account Suspended</div>
          <div style={{ fontSize: "14px", color: "#6B7280", fontWeight: "500", lineHeight: "1.6" }}>Your account has been suspended. For more information, please contact support.</div>
        </div>
        <div style={{ marginTop: "24px" }}>
          <a href="mailto:support@uatob.com" style={{ display: "inline-block", width: "100%", padding: "14px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg,#DC2626,#991B1B)", color: "#fff", fontSize: "15px", fontWeight: "800", fontFamily: "'Barlow', sans-serif", cursor: "pointer", boxShadow: "0 4px 14px rgba(220,38,38,.3)", textDecoration: "none" }}>Contact Support</a>
        </div>
      </div>
    </div>
  );
}

// ── LOCATION POPUP ────────────────────────────────────────────────────
function LocationPopup({ onAllow, onDeny, loading, error }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onDeny(); }} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.45)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", animation: "locFadeIn .2s ease" }}>
      <style>{`
        @keyframes locFadeIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes locSlideUp { from { opacity:0; transform:translateY(18px) } to { opacity:1; transform:translateY(0) } }
        @keyframes locSpin    { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
      `}</style>
      <div style={{ background: "#fff", borderRadius: "24px", padding: "28px 24px 24px", width: "100%", maxWidth: "360px", boxShadow: "0 24px 60px rgba(0,0,0,.18)", animation: "locSlideUp .28s cubic-bezier(.34,1.56,.64,1)" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
          <div style={{ width: "68px", height: "68px", borderRadius: "50%", background: error ? "rgba(220,38,38,.08)" : "rgba(22,163,74,.1)", border: `2px solid ${error ? "rgba(220,38,38,.25)" : "rgba(22,163,74,.3)"}`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: error ? "0 0 0 8px rgba(220,38,38,.05)" : "0 0 0 8px rgba(22,163,74,.06)" }}>
            {loading ? <Loader2 size={28} color="#16A34A" style={{ animation: "locSpin 1s linear infinite" }} /> : error ? <AlertCircle size={28} color="#DC2626" /> : <LocateFixed size={28} color="#16A34A" />}
          </div>
        </div>
        <div style={{ textAlign: "center", marginBottom: "8px" }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "22px", fontWeight: "900", color: "#111827", letterSpacing: "-0.3px", marginBottom: "6px" }}>
            {loading ? "Getting your location…" : error ? "Location required" : "UaTob needs your location"}
          </div>
          <div style={{ fontSize: "13.5px", color: "#6B7280", fontWeight: "500", lineHeight: "1.6" }}>
            {loading ? "Please allow location access in your browser." : error ? error : "To go online and receive ride requests, we need your current location."}
          </div>
        </div>
        {!loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "22px" }}>
            <button onClick={onAllow} style={{ width: "100%", padding: "15px", borderRadius: "14px", border: "none", background: error ? "#DC2626" : "linear-gradient(135deg,#22C55E,#16A34A 55%,#15803D)", color: "#fff", fontSize: "15px", fontWeight: "800", fontFamily: "'Barlow', sans-serif", cursor: "pointer", boxShadow: error ? "0 4px 14px rgba(220,38,38,.3)" : "0 4px 14px rgba(22,163,74,.35)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
              <LocateFixed size={16} />
              {error ? "Try again" : "Allow location"}
            </button>
            <button onClick={onDeny} style={{ width: "100%", padding: "14px", borderRadius: "14px", border: "1.5px solid #E5E7EB", background: "#fff", color: "#6B7280", fontSize: "14px", fontWeight: "700", fontFamily: "'Barlow', sans-serif", cursor: "pointer" }}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────
export default function UaTobDriverApp({ uid }) {
  console.log("Rendering Driver App with UID:", uid);

  const { driver }                        = useDriverAccount(uid);
  const { earnings, refetch }             = useDriverEarnings(uid);
  const { rides, loading: ridesLoading }  = useDriverRides(uid);
  const { requests, loading: reqLoading } = useIncomingRequest(uid);
  const { activeRides }                   = useActiveRides(uid);
  const { completedRides }                = useCompletedRides(uid);
  const { reviews }                       = useDriverReviews(uid);

  const driverOnTrip  = driver?.trip === true;
  const sourceLoading = driverOnTrip ? reqLoading  : ridesLoading;
  const sourceRides   = driverOnTrip ? requests    : rides;

  // ── Local state ───────────────────────────────────────────────────
  const [mounted,           setMounted]           = useState(false);
  const [activeTab,         setActiveTab]         = useState("home");
  const [online,            setOnline]            = useState(false);
  const [activeTrip,        setActiveTrip]        = useState(null);
  const [requestTimer,      setRequestTimer]      = useState(15);
  const [notification,      setNotification]      = useState(null);
  const [tripBtnLabel,      setTripBtnLabel]      = useState("");
  const [dismissedRequests, setDismissedRequests] = useState(() => new Set());
  const [acceptedRequestId, setAcceptedRequestId] = useState(null);
  const [actionPending,     setActionPending]     = useState(false);
  const [advancePending,    setAdvancePending]    = useState(false);
  const [showLocationPopup, setShowLocationPopup] = useState(false);
  const [locationLoading,   setLocationLoading]   = useState(false);
  const [locationError,     setLocationError]     = useState("");
  const [showNotifPopup,    setShowNotifPopup]    = useState(false);
  const [notifLoading,      setNotifLoading]      = useState(false);
  const [seenReviewIds,     setSeenReviewIds]     = useState(() => loadSeenReviews());
  const [pendingReview,     setPendingReview]     = useState(null);

  // ── Refs ──────────────────────────────────────────────────────────
  const timerRef          = useRef(null);
  const prevRequestId     = useRef(null);
  const locationPingRef   = useRef(null);
  const onlineInitialized = useRef(false);

  // ── Sync online state from Firestore on first load ────────────────
  useEffect(() => {
    if (!driver || onlineInitialized.current) return;
    onlineInitialized.current = true;
    setOnline(driver.status === "online");
  }, [driver]);

  // ── Foreground push handler (tab is open) ─────────────────────────
  useEffect(() => {
  if (!uid) return;
  let unsub = () => {};
  try {
    const messaging = getMessaging(firebase_app);
    unsub = onMessage(messaging, (payload) => {
      const title = payload.notification?.title ?? "New Ride";
      const body  = payload.notification?.body  ?? "";

      // ── In-app toast ──────────────────────────────────────────
      showNotif(title, body);

      // ── Native browser notification (foreground) ──────────────
      if ("Notification" in window && window.Notification.permission === "granted") {
        new window.Notification(title, {
          body,
          icon: "/icons/icon-192x192.png", // adjust path to your PWA icon
          badge: "/icons/badge-72x72.png", // optional monochrome badge icon
          tag: payload.data?.rideId ?? "uatob-driver", // collapses duplicate notifs
          renotify: true,
        });
      }
    });
  } catch (err) {
    console.warn("[UaTob] onMessage setup failed:", err.message);
  }
  return unsub;
}, [uid]);


  // ── Derived: active trip request ──────────────────────────────────
  const tripRequest = online && !sourceLoading
    ? (sourceRides.find(r =>
        r.status === "searching_driver" &&
        !dismissedRequests.has(r.id) &&
        r.id !== acceptedRequestId
      ) ?? null)
    : null;

  // ── Chime on new request ──────────────────────────────────────────
  useEffect(() => {
    const newId = tripRequest?.id ?? null;
    if (newId && newId !== prevRequestId.current) playRequestChime();
    prevRequestId.current = newId;
  }, [tripRequest?.id]);

  useEffect(() => { setMounted(true); }, []);

  // ── Sync active trip from Firestore ──────────────────────────────
  useEffect(() => {
    const active = activeRides.find(r =>
      r.driverUid === uid &&
      ["driver_assigned", "arrived", "in_progress"].includes(r.status)
    );
    setActiveTrip(active || null);
  }, [activeRides, uid]);

  useEffect(() => {
    if (activeTrip?.id) setAcceptedRequestId(null);
  }, [activeTrip?.id]);

  // ── Auto-popup unseen rider reviews ──────────────────────────────
  useEffect(() => {
    if (!reviews.length || pendingReview || activeTrip || tripRequest) return;
    const unseen = reviews.find(r => !seenReviewIds.has(r.id));
    if (unseen) setPendingReview(unseen);
  }, [reviews, activeTrip, tripRequest]);

  const handleDismissReview = () => {
    if (!pendingReview) return;
    const updated = new Set(seenReviewIds);
    updated.add(pendingReview.id);
    setSeenReviewIds(updated);
    saveSeenReviews(updated);
    setPendingReview(null);
  };

  useEffect(() => {
    setTripBtnLabel(TRIP_BUTTON_LABELS[activeTrip?.status] ?? "");
  }, [activeTrip?.status]);

  // ── Request timer ─────────────────────────────────────────────────
  useEffect(() => {
    if (!tripRequest) { clearInterval(timerRef.current); setRequestTimer(15); return; }
    setRequestTimer(15);
    timerRef.current = setInterval(() => {
      setRequestTimer(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          setDismissedRequests(prev => { const next = new Set(prev); if (tripRequest?.id) next.add(tripRequest.id); return next; });
          showNotif("Request expired", "Looking for next...");
          return 15;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [tripRequest?.id]);

  // ── 60-second location ping ───────────────────────────────────────
  useEffect(() => {
    clearInterval(locationPingRef.current);
    if (!online) return;
    locationPingRef.current = setInterval(async () => {
      try {
        const position = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true, timeout: 8000, maximumAge: 30000,
          })
        );
        const { latitude: lat, longitude: lng } = position.coords;
        await callDriverStatus({ uid, status: "location_ping", lat, lng });
        console.log(`📍 Location ping — lat:${lat.toFixed(5)} lng:${lng.toFixed(5)}`);
      } catch (err) {
        console.warn("📍 Location ping failed:", err?.message ?? err);
      }
    }, 60_000);
    return () => clearInterval(locationPingRef.current);
  }, [online, uid]);

  // ── Helpers ───────────────────────────────────────────────────────
  const showNotif = (title, msg) => {
    setNotification({ title, msg });
    setTimeout(() => setNotification(null), 3200);
  };

  // ── callDriverStatus wrapper ──────────────────────────────────────
  const callDriverStatusFn = useCallback(async (status, lat = null, lng = null) => {
    const payload = { uid, status };
    if (lat !== null && lng !== null) { payload.lat = lat; payload.lng = lng; }
    const { data } = await callDriverStatus(payload);
    if (data?.error) throw new Error(data.error);
    return data;
  }, [uid]);

  // ── Go online ─────────────────────────────────────────────────────
  const requestLocationAndGoOnline = useCallback(async () => {
    setLocationError("");
    setLocationLoading(true);
    try {
      const position = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, timeout: 10000, maximumAge: 0,
        })
      );
      const { latitude: lat, longitude: lng } = position.coords;
      await callDriverStatusFn("online", lat, lng);
      setOnline(true);
      setShowLocationPopup(false);
      setLocationError("");
      showNotif("Online", "Ready for rides");

      // Show our styled notification permission popup only if not already granted
      if ("Notification" in window && window.Notification.permission === "default") {
        setShowNotifPopup(true);
      } else if ("Notification" in window && window.Notification.permission === "granted") {
        // Already granted — silently register token in background
        registerFcmToken(uid);
      }
    } catch (err) {
      if      (err.code === 1) setLocationError("Location access was denied. Allow location in your browser settings to go online.");
      else if (err.code === 2) setLocationError("Could not detect your location. Check your device's location settings.");
      else if (err.code === 3) setLocationError("Location request timed out. Please try again.");
      else                     setLocationError(err.message || "Could not get your location. Please try again.");
    } finally {
      setLocationLoading(false);
    }
  }, [callDriverStatusFn, uid]);

  // ── Handle notification popup Enable ─────────────────────────────
  const handleEnableNotifications = useCallback(async () => {
    setNotifLoading(true);
    await registerFcmToken(uid);   // triggers browser prompt inside gesture
    setNotifLoading(false);
    setShowNotifPopup(false);
  }, [uid]);

  const handleSkipNotifications = useCallback(() => {
    setShowNotifPopup(false);
  }, []);

  // ── Online / offline toggle ───────────────────────────────────────
  const handleToggleOnline = useCallback(async () => {
    if (online) {
      try { await callDriverStatusFn("offline"); }
      catch (err) { console.error("Failed to go offline:", err); }
      setOnline(false);
      setActiveTrip(null);
      setDismissedRequests(new Set());
      setAcceptedRequestId(null);
      showNotif("Offline", "See you next time");
    } else {
      setLocationError("");
      setShowLocationPopup(true);
    }
  }, [online, callDriverStatusFn]);

  const handleLocationDeny = useCallback(() => {
    if (locationLoading) return;
    setShowLocationPopup(false);
    setLocationError("");
    setLocationLoading(false);
  }, [locationLoading]);

  // ── Accept ────────────────────────────────────────────────────────
  const handleAcceptTrip = async () => {
    if (!tripRequest || actionPending) return;
    setActionPending(true);
    try {
      const { data } = await callAcceptRide({ rideId: tripRequest.id, uid });
      if (data?.error) throw new Error(data.error);
      playAcceptSound();
      clearInterval(timerRef.current);
      setAcceptedRequestId(tripRequest.id);
      setDismissedRequests(prev => { const next = new Set(prev); next.add(tripRequest.id); return next; });
      showNotif("Accepted", "Drive to pickup");
    } catch (err) {
      console.error("handleAcceptTrip failed:", err);
      showNotif("Error", "Accept failed");
    } finally {
      setActionPending(false);
    }
  };

  // ── Decline ───────────────────────────────────────────────────────
  const handleDeclineTrip = async () => {
    if (!tripRequest || actionPending) return;
    setActionPending(true);
    try {
      const { data } = await callDeclineRide({ rideId: tripRequest.id, uid });
      if (data?.error) throw new Error(data.error);
      playDeclineSound();
      clearInterval(timerRef.current);
      setDismissedRequests(prev => { const next = new Set(prev); next.add(tripRequest.id); return next; });
      showNotif("Declined", "Searching for next ride");
    } catch (err) {
      console.error("handleDeclineTrip failed:", err);
      showNotif("Error", "Decline failed");
    } finally {
      setActionPending(false);
    }
  };

  // ── Advance trip ──────────────────────────────────────────────────
  const handleAdvanceTrip = async () => {
    if (!activeTrip || advancePending) return;
    const actionMap = { driver_assigned: "arrive", arrived: "start", in_progress: "complete" };
    const action = actionMap[activeTrip.status];
    if (!action) return;
    setAdvancePending(true);
    try {
      const { data } = await callUpdateTrip({ rideId: activeTrip.id, driverUid: uid, action });
      if (data?.error) throw new Error(data.error);
      if (action === "complete") {
        await refetch();
        showNotif("Trip complete", `+$${activeTrip.fareTotal || 0}`);
      } else {
        showNotif("Updating trip…", "Please wait");
      }
    } catch (err) {
      console.error("handleAdvanceTrip failed:", err);
      showNotif("Error", "Update failed");
    } finally {
      setAdvancePending(false);
    }
  };

  // ── Derived state ─────────────────────────────────────────────────
  const tripStage = activeTrip?.status;
  const tripStageColor = { driver_assigned: C.blue, arrived: C.onlineGreen, in_progress: C.green }[tripStage] || C.green;

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: '"Barlow", system-ui, sans-serif', color: C.text, position: "relative" }}>
      <style>{CSS}</style>

      {driver?.status === "suspended" && <SuspendedModal />}

      {showLocationPopup && (
        <LocationPopup
          loading={locationLoading}
          error={locationError}
          onAllow={requestLocationAndGoOnline}
          onDeny={handleLocationDeny}
        />
      )}

      {showNotifPopup && (
        <NotificationPopup
          loading={notifLoading}
          onEnable={handleEnableNotifications}
          onSkip={handleSkipNotifications}
        />
      )}

      {/* Styled in-app notification — replaces the old AppNotification import */}
      <AppNotification activeTrip={activeTrip} notificationOverride={notification} />

      <TripRequestModal
        tripRequest={tripRequest}
        driver={driver}
        requestTimer={requestTimer}
        onAccept={handleAcceptTrip}
        onDecline={handleDeclineTrip}
        actionPending={actionPending}
      />

      {pendingReview && !activeTrip && !tripRequest && (
        <DriverReviewModal review={pendingReview} onClose={handleDismissReview} />
      )}

      <div style={{ maxWidth: 680, margin: "0 auto", paddingBottom: 90 }}>
        <div style={{ padding: "20px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center", animation: mounted ? "slideUp .5s ease-out forwards" : "none", opacity: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <UaTobIcon size={40} online={online} />
            <div>
              <div className="condensed lbl">Driver Console</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{driver?.firstName ?? ""}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, background: C.surface, borderRadius: 100, padding: "6px 12px" }}>
              <Star size={11} fill="#F59E0B" color="#F59E0B" />
              <span>{driver?.averageRating != null ? driver.averageRating.toFixed(2) : "—"}</span>
            </div>
            <button><Bell size={15} /></button>
          </div>
        </div>


        {activeTab === "home"     && <HomeTab driver={driver} online={online} rides={rides} activeTrip={activeTrip} tripStage={tripStage} tripStageColor={tripStageColor} tripBtnLabel={tripBtnLabel} earnings={earnings} onToggleOnline={handleToggleOnline} onAdvanceTrip={handleAdvanceTrip} advancePending={advancePending} />}
        {activeTab === "earnings" && <EarningsTab earnings={earnings} driver={driver} online={online} />}
        {activeTab === "trips"    && <TripsTab    completedRides={completedRides} online={online} />}
        {activeTab === "profile"  && <ProfileTab  driver={driver} online={online} />}
      </div>

      <BottomTabBar activeTab={activeTab} setActiveTab={setActiveTab} online={online} activeTrip={activeTrip} />
    </div>
  );
}