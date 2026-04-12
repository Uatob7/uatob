import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, Star, LocateFixed, Loader2, X, AlertCircle } from "lucide-react";

import CSS              from '@/App/Drivers/styles.js';
import { C }            from '@/App/Drivers/constants.js';
import UaTobIcon        from '@/App/Drivers/Icon.jsx';
import Notification     from '@/App/Drivers/Notification.jsx';
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

// ── Cloud Function URLs ───────────────────────────────────────────────
const DRIVER_STATUS_URL = "https://setdriverstatus-ady2s2xhhq-uc.a.run.app";

// ── localStorage helpers for seen review IDs ──────────────────────────
const LS_SEEN_REVIEWS_KEY = 'uatob_driver_seen_reviews';
function loadSeenReviews()     { try { return new Set(JSON.parse(localStorage.getItem(LS_SEEN_REVIEWS_KEY) || '[]')); } catch { return new Set(); } }
function saveSeenReviews(set)  { try { localStorage.setItem(LS_SEEN_REVIEWS_KEY, JSON.stringify([...set])); } catch (_) {} }

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
  } catch (err) {
    console.warn("Audio playback failed:", err);
  }
}

// ── Accept sound ──────────────────────────────────────────────────────
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
  } catch (err) {
    console.warn("Accept sound failed:", err);
  }
}

// ── Decline sound ─────────────────────────────────────────────────────
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
  } catch (err) {
    console.warn("Decline sound failed:", err);
  }
}

// ── ACCOUNT SUSPENDED MODAL ───────────────────────────────────────────
function SuspendedModal() {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1100,
      background: "rgba(0,0,0,.5)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px", animation: "locFadeIn .2s ease",
    }}>
      <style>{`
        @keyframes locFadeIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes locSlideUp { from { opacity:0; transform:translateY(18px) } to { opacity:1; transform:translateY(0) } }
      `}</style>
      <div style={{
        background: "#fff", borderRadius: "24px", padding: "32px 24px 28px",
        width: "100%", maxWidth: "380px", boxShadow: "0 24px 60px rgba(0,0,0,.2)",
        animation: "locSlideUp .28s cubic-bezier(.34,1.56,.64,1)", textAlign: "center",
      }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
          <div style={{
            width: "72px", height: "72px", borderRadius: "50%",
            background: "rgba(220,38,38,.08)", border: "2px solid rgba(220,38,38,.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 0 8px rgba(220,38,38,.05)",
          }}>
            <AlertCircle size={32} color="#DC2626" />
          </div>
        </div>
        <div style={{ marginBottom: "12px" }}>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: "26px",
            fontWeight: "900", color: "#111827", letterSpacing: "-0.3px", marginBottom: "8px",
          }}>Account Suspended</div>
          <div style={{ fontSize: "14px", color: "#6B7280", fontWeight: "500", lineHeight: "1.6" }}>
            Your account has been suspended. For more information, please contact support.
          </div>
        </div>
        <div style={{ marginTop: "24px" }}>
          <a href="mailto:support@uatob.com" style={{
            display: "inline-block", width: "100%", padding: "14px",
            borderRadius: "12px", border: "none",
            background: "linear-gradient(135deg,#DC2626,#991B1B)",
            color: "#fff", fontSize: "15px", fontWeight: "800",
            fontFamily: "'Barlow', sans-serif", cursor: "pointer",
            boxShadow: "0 4px 14px rgba(220,38,38,.3)", textDecoration: "none",
          }}>Contact Support</a>
        </div>
      </div>
    </div>
  );
}

// ── LOCATION POPUP ────────────────────────────────────────────────────
function LocationPopup({ onAllow, onDeny, loading, error }) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onDeny(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,.45)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px", animation: "locFadeIn .2s ease",
      }}
    >
      <style>{`
        @keyframes locFadeIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes locSlideUp { from { opacity:0; transform:translateY(18px) } to { opacity:1; transform:translateY(0) } }
        @keyframes locSpin    { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
      `}</style>
      <div style={{
        background: "#fff", borderRadius: "24px", padding: "28px 24px 24px",
        width: "100%", maxWidth: "360px", boxShadow: "0 24px 60px rgba(0,0,0,.18)",
        animation: "locSlideUp .28s cubic-bezier(.34,1.56,.64,1)",
      }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
          <div style={{
            width: "68px", height: "68px", borderRadius: "50%",
            background:  error ? "rgba(220,38,38,.08)" : "rgba(22,163,74,.1)",
            border:      `2px solid ${error ? "rgba(220,38,38,.25)" : "rgba(22,163,74,.3)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: error ? "0 0 0 8px rgba(220,38,38,.05)" : "0 0 0 8px rgba(22,163,74,.06)",
          }}>
            {loading
              ? <Loader2 size={28} color="#16A34A" style={{ animation: "locSpin 1s linear infinite" }} />
              : error
                ? <AlertCircle size={28} color="#DC2626" />
                : <LocateFixed size={28} color="#16A34A" />
            }
          </div>
        </div>
        <div style={{ textAlign: "center", marginBottom: "8px" }}>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif", fontSize: "22px",
            fontWeight: "900", color: "#111827", letterSpacing: "-0.3px", marginBottom: "6px",
          }}>
            {loading ? "Getting your location…" : error ? "Location required" : "UaTob needs your location"}
          </div>
          <div style={{ fontSize: "13.5px", color: "#6B7280", fontWeight: "500", lineHeight: "1.6" }}>
            {loading
              ? "Please allow location access in your browser."
              : error
                ? error
                : "To go online and receive ride requests, we need your current location."}
          </div>
        </div>
        {!loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "22px" }}>
            <button
              onClick={onAllow}
              style={{
                width: "100%", padding: "15px", borderRadius: "14px", border: "none",
                background: error ? "#DC2626" : "linear-gradient(135deg,#22C55E,#16A34A 55%,#15803D)",
                color: "#fff", fontSize: "15px", fontWeight: "800",
                fontFamily: "'Barlow', sans-serif", cursor: "pointer",
                boxShadow: error ? "0 4px 14px rgba(220,38,38,.3)" : "0 4px 14px rgba(22,163,74,.35)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
              }}
            >
              <LocateFixed size={16} />
              {error ? "Try again" : "Allow location"}
            </button>
            <button
              onClick={onDeny}
              style={{
                width: "100%", padding: "14px", borderRadius: "14px",
                border: "1.5px solid #E5E7EB", background: "#fff",
                color: "#6B7280", fontSize: "14px", fontWeight: "700",
                fontFamily: "'Barlow', sans-serif", cursor: "pointer",
              }}
            >Cancel</button>
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

  // ── Reviews from riders ───────────────────────────────────────────
  const { reviews } = useDriverReviews(uid);

  console.log('completedRides:', completedRides);

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

  // ── Location popup state ──────────────────────────────────────────
  const [showLocationPopup, setShowLocationPopup] = useState(false);
  const [locationLoading,   setLocationLoading]   = useState(false);
  const [locationError,     setLocationError]     = useState("");

  // ── Review popup state ────────────────────────────────────────────
  const [seenReviewIds,  setSeenReviewIds]  = useState(() => loadSeenReviews());
  const [pendingReview,  setPendingReview]  = useState(null);

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

  // ── Mount animation ───────────────────────────────────────────────
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
  // Shows the most recent review the driver hasn't dismissed yet.
  // Suppressed while a trip is active or a trip request is showing.
  useEffect(() => {
    if (!reviews.length) return;
    if (pendingReview)   return;   // already showing one
    if (activeTrip)      return;   // mid-trip, don't interrupt
    if (tripRequest)     return;   // incoming request takes priority

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

  // ── Fetch trip button label ───────────────────────────────────────
  useEffect(() => {
    async function fetchTripBtnLabel(status) {
      if (!status) return;
      try {
        const res  = await fetch("https://gettripbuttonlabel-ady2s2xhhq-uc.a.run.app", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        const data = await res.json();
        setTripBtnLabel(data.success ? data.label : "Unknown Action");
      } catch (err) {
        console.error("Error fetching trip label:", err);
        setTripBtnLabel("Error");
      }
    }
    if (activeTrip?.status) fetchTripBtnLabel(activeTrip.status);
  }, [activeTrip?.status]);

  // ── Request timer ─────────────────────────────────────────────────
  useEffect(() => {
    if (!tripRequest) {
      clearInterval(timerRef.current);
      setRequestTimer(15);
      return;
    }
    setRequestTimer(15);
    timerRef.current = setInterval(() => {
      setRequestTimer(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          setDismissedRequests(prev => {
            const next = new Set(prev);
            if (tripRequest?.id) next.add(tripRequest.id);
            return next;
          });
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
        await fetch(DRIVER_STATUS_URL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uid, status: "location_ping", lat, lng }),
        });
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
    setTimeout(() => setNotification(null), 3000);
  };

  const callDriverStatusAPI = useCallback(async (status, lat = null, lng = null) => {
    const body = { uid, status };
    if (lat !== null && lng !== null) { body.lat = lat; body.lng = lng; }
    const res = await fetch(DRIVER_STATUS_URL, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Status update failed (${res.status})`);
    }
    return res.json();
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
      await callDriverStatusAPI("online", lat, lng);
      setOnline(true);
      setShowLocationPopup(false);
      setLocationError("");
      showNotif("Online", "Ready for rides");
    } catch (err) {
      if      (err.code === 1) setLocationError("Location access was denied. Allow location in your browser settings to go online.");
      else if (err.code === 2) setLocationError("Could not detect your location. Check your device's location settings.");
      else if (err.code === 3) setLocationError("Location request timed out. Please try again.");
      else                     setLocationError(err.message || "Could not get your location. Please try again.");
    } finally {
      setLocationLoading(false);
    }
  }, [callDriverStatusAPI]);

  // ── Online / offline toggle ───────────────────────────────────────
  const handleToggleOnline = useCallback(async () => {
    if (online) {
      try { await callDriverStatusAPI("offline"); }
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
  }, [online, callDriverStatusAPI]);

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
      const res = await fetch("https://acceptride-ady2s2xhhq-uc.a.run.app", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rideId: tripRequest.id, uid }),
      });
      if (!res.ok) throw new Error("Accept failed");

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
      const res = await fetch("https://declineride-ady2s2xhhq-uc.a.run.app", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rideId: tripRequest.id, uid }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Decline failed");
      }

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
      const res = await fetch("https://updatetripstatus-ady2s2xhhq-uc.a.run.app", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rideId: activeTrip.id, driverUid: uid, action }),
      });
      if (!res.ok) throw new Error("Update failed");

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
  const tripStageColor = {
    driver_assigned: C.blue,
    arrived:         C.onlineGreen,
    in_progress:     C.green,
  }[tripStage] || C.green;

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh", background: C.bg,
      fontFamily: '"Barlow", system-ui, sans-serif',
      color: C.text, position: "relative",
    }}>
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

      <Notification notification={notification} />

      <TripRequestModal
        tripRequest={tripRequest}
        driver={driver}
        requestTimer={requestTimer}
        onAccept={handleAcceptTrip}
        onDecline={handleDeclineTrip}
        actionPending={actionPending}
      />

      {/* ── Driver review popup ── */}
      {pendingReview && !activeTrip && !tripRequest && (
        <DriverReviewModal
          review={pendingReview}
          onClose={handleDismissReview}
        />
      )}

      <div style={{ maxWidth: 680, margin: "0 auto", paddingBottom: 90 }}>

        {/* Header */}
        <div style={{
          padding: "20px 20px 0", display: "flex",
          justifyContent: "space-between", alignItems: "center",
          animation: mounted ? "slideUp .5s ease-out forwards" : "none", opacity: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <UaTobIcon size={40} online={online} />
            <div>
              <div className="condensed lbl">Driver Console</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>
                {driver?.firstName ?? ""}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, background: C.surface, borderRadius: 100, padding: "6px 12px" }}>
              <Star size={11} fill="#F59E0B" color="#F59E0B" />
              <span>4.93</span>
            </div>
            <button><Bell size={15} /></button>
          </div>
        </div>

        {/* Tabs */}
        {activeTab === "home" && (
          <HomeTab
            online={online}
            rides={rides}
            activeTrip={activeTrip}
            tripStage={tripStage}
            tripStageColor={tripStageColor}
            tripBtnLabel={tripBtnLabel}
            earnings={earnings}
            onToggleOnline={handleToggleOnline}
            onAdvanceTrip={handleAdvanceTrip}
            advancePending={advancePending}
          />
        )}
        {activeTab === "earnings" && <EarningsTab earnings={earnings} driver={driver} online={online} />}
        {activeTab === "trips"    && <TripsTab    completedRides={completedRides} online={online} />}
        {activeTab === "profile"  && <ProfileTab  driver={driver} online={online} />}
      </div>

      <BottomTabBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        online={online}
        activeTrip={activeTrip}
      />
    </div>
  );
}