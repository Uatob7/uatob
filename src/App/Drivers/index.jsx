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
import { useDriverAccount } from "@/App/Drivers/useDriverAccount";
import { useDriverRides } from '@/App/Drivers/useDriverRides';
import { useActiveRides } from "@/App/Drivers/useActiveRides";
import { useDriverEarnings } from "@/App/Drivers/useDriverEarnings";
import { useCompletedRides } from "@/App/Drivers/useCompletedRides";


// ── Cloud Function URLs ───────────────────────────────────────────────
const DRIVER_STATUS_URL = "https://setdriverstatus-ady2s2xhhq-uc.a.run.app";

// ── Trip request chime (Web Audio API — no audio file needed) ────────
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

    const noise  = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
    const data   = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / 1800);
    noise.buffer = buffer;
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

// ── LOCATION PERMISSION POPUP ─────────────────────────────────────────
function LocationPopup({ onAllow, onDeny, loading, error }) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onDeny(); }}
      style={{
        position:        "fixed",
        inset:           0,
        zIndex:          1000,
        background:      "rgba(0,0,0,.45)",
        backdropFilter:  "blur(4px)",
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        padding:         "24px",
        animation:       "locFadeIn .2s ease",
      }}
    >
      <style>{`
        @keyframes locFadeIn  { from { opacity:0 }               to { opacity:1 } }
        @keyframes locSlideUp { from { opacity:0; transform:translateY(18px) } to { opacity:1; transform:translateY(0) } }
        @keyframes locSpin    { from { transform:rotate(0deg) }  to { transform:rotate(360deg) } }
      `}</style>

      {/* Card */}
      <div
        style={{
          background:   "#fff",
          borderRadius: "24px",
          padding:      "28px 24px 24px",
          width:        "100%",
          maxWidth:     "360px",
          boxShadow:    "0 24px 60px rgba(0,0,0,.18)",
          animation:    "locSlideUp .28s cubic-bezier(.34,1.56,.64,1)",
        }}
      >
        {/* Icon ring */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
          <div style={{
            width:          "68px",
            height:         "68px",
            borderRadius:   "50%",
            background:     error ? "rgba(220,38,38,.08)" : "rgba(22,163,74,.1)",
            border:         `2px solid ${error ? "rgba(220,38,38,.25)" : "rgba(22,163,74,.3)"}`,
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            boxShadow:      error ? "0 0 0 8px rgba(220,38,38,.05)" : "0 0 0 8px rgba(22,163,74,.06)",
          }}>
            {loading
              ? <Loader2 size={28} color="#16A34A" style={{ animation: "locSpin 1s linear infinite" }} />
              : error
                ? <AlertCircle size={28} color="#DC2626" />
                : <LocateFixed size={28} color="#16A34A" />
            }
          </div>
        </div>

        {/* Heading */}
        <div style={{ textAlign: "center", marginBottom: "8px" }}>
          <div style={{
            fontFamily:    "'Barlow Condensed', sans-serif",
            fontSize:      "22px",
            fontWeight:    "900",
            color:         "#111827",
            letterSpacing: "-0.3px",
            marginBottom:  "6px",
          }}>
            {loading ? "Getting your location…" : error ? "Location required" : "UaTob needs your location"}
          </div>
          <div style={{ fontSize: "13.5px", color: "#6B7280", fontWeight: "500", lineHeight: "1.6" }}>
            {loading
              ? "Please allow location access in your browser."
              : error
                ? error
                : "To go online and receive ride requests, we need your current location. Your position updates while you drive."}
          </div>
        </div>

        {/* Buttons */}
        {!loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "22px" }}>
            <button
              onClick={onAllow}
              style={{
                width:          "100%",
                padding:        "15px",
                borderRadius:   "14px",
                border:         "none",
                background:     error ? "#DC2626" : "linear-gradient(135deg,#22C55E,#16A34A 55%,#15803D)",
                color:          "#fff",
                fontSize:       "15px",
                fontWeight:     "800",
                fontFamily:     "'Barlow', sans-serif",
                cursor:         "pointer",
                boxShadow:      error ? "0 4px 14px rgba(220,38,38,.3)" : "0 4px 14px rgba(22,163,74,.35)",
                display:        "flex",
                alignItems:     "center",
                justifyContent: "center",
                gap:            "8px",
              }}
            >
              <LocateFixed size={16} />
              {error ? "Try again" : "Allow location"}
            </button>

            <button
              onClick={onDeny}
              style={{
                width:        "100%",
                padding:      "14px",
                borderRadius: "14px",
                border:       "1.5px solid #E5E7EB",
                background:   "#fff",
                color:        "#6B7280",
                fontSize:     "14px",
                fontWeight:   "700",
                fontFamily:   "'Barlow', sans-serif",
                cursor:       "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────
export default function UaTobDriverApp({ uid }) {

  // ── Remote data ───────────────────────────────────────
  const { driver } = useDriverAccount(uid);
  const { earnings, refetch } = useDriverEarnings(uid);
  const { rides, loading: ridesLoading } = useDriverRides();
  const { activeRides, loading }         = useActiveRides(uid);
  const { completedRides }              = useCompletedRides(uid);
  console.log("Completed rides:", completedRides);

  console.log(uid);

  console.log("Driver account:", driver);
  console.log("All rides:",    rides);
  console.log("Active rides:", activeRides);

  // ── Local state ───────────────────────────────────────
  const [mounted,        setMounted]        = useState(false);
  const [activeTab,      setActiveTab]      = useState("home");
  const [online,         setOnline]         = useState(false);
  const [activeTrip,     setActiveTrip]     = useState(null);
  const [requestTimer,   setRequestTimer]   = useState(15);
  const [notification,   setNotification]   = useState(null);
  const [showSurgeAlert, setShowSurgeAlert] = useState(false);
  const [tripBtnLabel,   setTripBtnLabel]   = useState("");

  // ── Location popup state ──────────────────────────────
  const [showLocationPopup, setShowLocationPopup] = useState(false);
  const [locationLoading,   setLocationLoading]   = useState(false);
  const [locationError,     setLocationError]      = useState("");

  // ── Refs ──────────────────────────────────────────────
  const skippedIds         = useRef(new Set());
  const timerRef           = useRef(null);
  const prevRequestId      = useRef(null);
  const locationPingRef    = useRef(null);
  const onlineInitialized  = useRef(false);   // ← prevents re-sync on every driver update

  // ── Sync online state from Firestore on first load ────
  //
  //  Runs once when the driver doc first becomes available.
  //  If the driver was online before refresh, the toggle snaps to true.
  //  The ref guard stops Firestore real-time updates from fighting the toggle.
  //
  useEffect(() => {
    if (!driver || onlineInitialized.current) return;
    onlineInitialized.current = true;
    setOnline(driver.status === "online");
  }, [driver]);

  // ── Derived: trip request ─────────────────────────────
  const tripRequest = online && !activeTrip && !ridesLoading
    ? (rides.find(r =>
        r.status === "searching_driver" &&
        !skippedIds.current.has(r.id)
      ) ?? null)
    : null;

  // ── Chime on new request ──────────────────────────────
  useEffect(() => {
    const newId = tripRequest?.id ?? null;
    if (newId && newId !== prevRequestId.current) playRequestChime();
    prevRequestId.current = newId;
  }, [tripRequest?.id]);

  // ── Mount animation ───────────────────────────────────
  useEffect(() => { setMounted(true); }, []);

  // ── Sync active trip from backend ─────────────────────
  useEffect(() => {
    const active = activeRides.find(r =>
      r.driverUid === uid &&
      ["driver_assigned", "arrived", "in_progress"].includes(r.status)
    );
    setActiveTrip(active || null);
  }, [activeRides, uid]);

  // ── Fetch trip button label from Cloud Function ───────
  useEffect(() => {
    async function fetchTripBtnLabel(status) {
      if (!status) return;
      try {
        const res  = await fetch("https://gettripbuttonlabel-ady2s2xhhq-uc.a.run.app", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ status }),
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

  // ── Timer: reset whenever a new tripRequest appears ───
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
          skippedIds.current.add(tripRequest.id);
          showNotif("Request expired", "Looking for next...");
          return 15;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [tripRequest?.id]);

  // ── Surge alert ───────────────────────────────────────
  useEffect(() => {
    if (!online) return;
    const t = setTimeout(() => setShowSurgeAlert(true), 8000);
    return () => clearTimeout(t);
  }, [online]);

  // ── 60-second location ping while online ─────────────
  useEffect(() => {
    clearInterval(locationPingRef.current);

    if (!online) return;

    locationPingRef.current = setInterval(async () => {
      try {
        const position = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout:            8000,
            maximumAge:         30000,
          })
        );

        const { latitude: lat, longitude: lng } = position.coords;

        await fetch(DRIVER_STATUS_URL, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ uid, status: "location_ping", lat, lng }),
        });

        console.log(`📍 Location ping sent — lat:${lat.toFixed(5)} lng:${lng.toFixed(5)}`);
      } catch (err) {
        console.warn("📍 Location ping failed:", err?.message ?? err);
      }
    }, 60_000);

    return () => clearInterval(locationPingRef.current);
  }, [online, uid]);

  // ── Helpers ───────────────────────────────────────────
  const showNotif = (title, msg) => {
    setNotification({ title, msg });
    setTimeout(() => setNotification(null), 3000);
  };

  // ── Call cloud function to update driver status ───────
  const callDriverStatusAPI = useCallback(async (status, lat = null, lng = null) => {
    const body = { uid, status };
    if (lat !== null && lng !== null) {
      body.lat = lat;
      body.lng = lng;
    }
    const res = await fetch(DRIVER_STATUS_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Status update failed (${res.status})`);
    }
    return res.json();
  }, [uid]);

  // ── Request location then go online ───────────────────
  const requestLocationAndGoOnline = useCallback(async () => {
    setLocationError("");
    setLocationLoading(true);

    try {
      const position = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout:            10000,
          maximumAge:         0,
        })
      );

      const { latitude: lat, longitude: lng } = position.coords;

      await callDriverStatusAPI("online", lat, lng);

      setOnline(true);
      setShowLocationPopup(false);
      setLocationError("");
      showNotif("Online", "Ready for rides");

    } catch (err) {
      if (err.code === 1) {
        setLocationError("Location access was denied. Allow location in your browser settings to go online.");
      } else if (err.code === 2) {
        setLocationError("Could not detect your location. Check your device's location settings.");
      } else if (err.code === 3) {
        setLocationError("Location request timed out. Please try again.");
      } else {
        setLocationError(err.message || "Could not get your location. Please try again.");
      }
    } finally {
      setLocationLoading(false);
    }
  }, [callDriverStatusAPI]);

  // ── ONLINE / OFFLINE toggle ───────────────────────────
  const handleToggleOnline = useCallback(async () => {
    if (online) {
      try {
        await callDriverStatusAPI("offline");
      } catch (err) {
        console.error("Failed to update status to offline:", err);
      }
      setOnline(false);
      setActiveTrip(null);
      skippedIds.current.clear();
      showNotif("Offline", "See you next time");

    } else {
      setLocationError("");
      setShowLocationPopup(true);
    }
  }, [online, callDriverStatusAPI]);

  // ── Cancel / dismiss the location popup ──────────────
  const handleLocationDeny = useCallback(() => {
    if (locationLoading) return;
    setShowLocationPopup(false);
    setLocationError("");
    setLocationLoading(false);
  }, [locationLoading]);

  // ── ACCEPT ────────────────────────────────────────────
  const handleAcceptTrip = async () => {
    if (!tripRequest) return;
    try {
      await fetch("https://acceptride-ady2s2xhhq-uc.a.run.app", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ rideId: tripRequest.id, driverUid: uid }),
      });
      clearInterval(timerRef.current);
      skippedIds.current.add(tripRequest.id);
      showNotif("Accepted", "Drive to pickup");
    } catch {
      showNotif("Error", "Accept failed");
    }
  };

  // ── DECLINE ───────────────────────────────────────────
  const handleDeclineTrip = async () => {
    if (!tripRequest) return;
    try {
      await fetch("https://declineride-ady2s2xhhq-uc.a.run.app", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ rideId: tripRequest.id, driverUid: uid }),
      });
    } catch {}
    clearInterval(timerRef.current);
    skippedIds.current.add(tripRequest.id);
  };

  // ── ADVANCE TRIP ──────────────────────────────────────
  const handleAdvanceTrip = async () => {
    if (!activeTrip) return;
    const actionMap = {
      driver_assigned: "arrive",
      arrived:         "start",
      in_progress:     "complete",
    };
    const action = actionMap[activeTrip.status];
    try {
      await fetch("https://updatetripstatus-ady2s2xhhq-uc.a.run.app", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ rideId: activeTrip.id, driverUid: uid, action }),
      });
      if (action === "complete") {
        const fare = activeTrip.fareTotal || 0;
        setEarnings(e => ({
          today: +(e.today + fare).toFixed(2),
          week:  +(e.week  + fare).toFixed(2),
          trips:   e.trips + 1,
        }));
        showNotif("Trip complete", `+$${fare}`);
      }
    } catch {
      showNotif("Error", "Update failed");
    }
  };

  // ── DERIVED STATE ─────────────────────────────────────
  const tripStage = activeTrip?.status;
  const tripStageColor = {
    driver_assigned: C.blue,
    arrived:         C.onlineGreen,
    in_progress:     C.green,
  }[tripStage] || C.green;

  // ── Render ────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight:  "100vh",
        background: C.bg,
        fontFamily: '"Barlow", system-ui, sans-serif',
        color:      C.text,
        position:   "relative",
      }}
    >
      <style>{CSS}</style>

      {/* ── Location permission popup ── */}
      {showLocationPopup && (
        <LocationPopup
          loading={locationLoading}
          error={locationError}
          onAllow={requestLocationAndGoOnline}
          onDeny={handleLocationDeny}
        />
      )}

      {/* ── Other overlays ── */}
      <Notification notification={notification} />

      <TripRequestModal
        tripRequest={tripRequest}
        requestTimer={requestTimer}
        onAccept={handleAcceptTrip}
        onDecline={handleDeclineTrip}
      />

      {/* ── Content ── */}
      <div style={{ maxWidth: 680, margin: "0 auto", paddingBottom: 90 }}>

        {/* Header */}
        <div
          style={{
            padding:        "20px 20px 0",
            display:        "flex",
            justifyContent: "space-between",
            alignItems:     "center",
            animation:      mounted ? "slideUp .5s ease-out forwards" : "none",
            opacity:        0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <UaTobIcon size={40} online={online} />
            <div>
              <div className="condensed lbl">Driver Console</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>
                {driver?.firstName ? driver.firstName : ""}
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
          />
        )}
        {activeTab === "earnings" && <EarningsTab earnings={earnings} online={online} />}
        {activeTab === "trips"    && <TripsTab    completedRides={completedRides} online={online} />}
        {activeTab === "profile"  && <ProfileTab  driver={driver} online={online} />}
      </div>

      {/* Bottom nav */}
      <BottomTabBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        online={online}
        activeTrip={activeTrip}
      />
    </div>
  );
}