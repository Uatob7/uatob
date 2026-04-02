import { useState, useEffect, useRef } from "react";
import { Bell, Star } from "lucide-react";

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
import { useDriverRides } from '@/App/Drivers/useDriverRides';
import { useActiveRides } from "@/App/Drivers/useActiveRides";

// ── Trip request chime (Web Audio API — no audio file needed) ────────
function playRequestChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();

    const master = ctx.createGain();
    master.gain.value = 0.18;
    master.connect(ctx.destination);

    const playTone = ({ freq, type = "sine", start, duration, volume = 0.25 }) => {
      const osc = ctx.createOscillator();
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

    const now = ctx.currentTime + 0.02;

    // Dispatch-style 3-part repeating tone
    const pattern = [
      { t: 0.00, f1: 740,  f2: 1110, d: 0.18 },
      { t: 0.24, f1: 880,  f2: 1320, d: 0.18 },
      { t: 0.48, f1: 1047, f2: 1568, d: 0.26 },

      { t: 0.95, f1: 740,  f2: 1110, d: 0.18 },
      { t: 1.19, f1: 880,  f2: 1320, d: 0.18 },
      { t: 1.43, f1: 1047, f2: 1568, d: 0.30 },
    ];

    pattern.forEach(({ t, f1, f2, d }) => {
      playTone({
        freq: f1,
        type: "sine",
        start: now + t,
        duration: d,
        volume: 0.22,
      });

      playTone({
        freq: f2,
        type: "triangle",
        start: now + t,
        duration: d,
        volume: 0.12,
      });
    });

    // subtle "tap" click for urgency
    const noise = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / 1800);
    }

    noise.buffer = buffer;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.03;
    noise.connect(noiseGain);
    noiseGain.connect(master);

    noise.start(now + 0.01);
    noise.stop(now + 0.08);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 3000);
  } catch (err) {
    console.warn("Audio playback failed:", err);
  }
}

export default function UaTobDriverApp({ uid }) {
  // ── Remote data ───────────────────────────────────────
  const { rides, loading: ridesLoading } = useDriverRides();
  const { activeRides, loading } = useActiveRides(uid);

  console.log("All rides:", rides);
  console.log("Active rides:", activeRides);

  // ── Local state ───────────────────────────────────────
  const [mounted,        setMounted]        = useState(false);
  const [activeTab,      setActiveTab]      = useState("home");
  const [online,         setOnline]         = useState(false);
  const [activeTrip,     setActiveTrip]     = useState(null);
  const [requestTimer,   setRequestTimer]   = useState(15);
  const [notification,   setNotification]   = useState(null);
  const [showSurgeAlert, setShowSurgeAlert] = useState(false);
  const [earnings,       setEarnings]       = useState({ today: 0, week: 0, trips: 0 });
  const [tripBtnLabel,   setTripBtnLabel]   = useState("");

  // ── Refs ──────────────────────────────────────────────
  const skippedIds    = useRef(new Set());
  const timerRef      = useRef(null);
  const prevRequestId = useRef(null);

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
    if (newId && newId !== prevRequestId.current) {
      playRequestChime();
    }
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
        const res = await fetch("https://gettripbuttonlabel-ady2s2xhhq-uc.a.run.app", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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

  // ── Timer: reset whenever a new tripRequest appears ───
  useEffect(() => {
    if (!tripRequest) {
      clearInterval(timerRef.current);
      setRequestTimer(15);
      return;
    }

    setRequestTimer(15);

    timerRef.current = setInterval(() => {
      setRequestTimer((t) => {
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

  // ── Surge ─────────────────────────────────────────────
  useEffect(() => {
    if (!online) return;
    const t = setTimeout(() => setShowSurgeAlert(true), 8000);
    return () => clearTimeout(t);
  }, [online]);

  // ── Helpers ───────────────────────────────────────────
  const showNotif = (title, msg) => {
    setNotification({ title, msg });
    setTimeout(() => setNotification(null), 3000);
  };

  // ── ONLINE toggle ─────────────────────────────────────
  const handleToggleOnline = () => {
    const goingOnline = !online;
    setOnline(goingOnline);

    if (!goingOnline) {
      setActiveTrip(null);
      skippedIds.current.clear();
      showNotif("Offline", "See you next time");
    } else {
      showNotif("Online", "Ready for rides");
    }
  };

  // ── ACCEPT ────────────────────────────────────────────
  const handleAcceptTrip = async () => {
    if (!tripRequest) return;
    try {
      await fetch("https://acceptride-ady2s2xhhq-uc.a.run.app", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rideId:    tripRequest.id,
          driverUid: uid,
        }),
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rideId:    tripRequest.id,
          driverUid: uid,
        }),
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rideId:    activeTrip.id,
          driverUid: uid,
          action,
        }),
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
        minHeight: "100vh",
        background: C.bg,
        fontFamily: '"Barlow", system-ui, sans-serif',
        color: C.text,
        position: "relative",
      }}
    >
      <style>{CSS}</style>

      {/* Overlays */}
      <Notification notification={notification} />

      <TripRequestModal
        tripRequest={tripRequest}
        requestTimer={requestTimer}
        onAccept={handleAcceptTrip}
        onDecline={handleDeclineTrip}
      />

      {/* Content */}
      <div style={{ maxWidth: 680, margin: "0 auto", paddingBottom: 90 }}>

        {/* Header */}
        <div
          style={{
            padding: "20px 20px 0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            animation: mounted ? "slideUp .5s ease-out forwards" : "none",
            opacity: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <UaTobIcon size={40} online={online} />
            <div>
              <div className="condensed lbl">Driver Console</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>
                Marcus J.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              background: C.surface,
              borderRadius: 100,
              padding: "6px 12px",
            }}>
              <Star size={11} fill="#F59E0B" color="#F59E0B" />
              <span>4.93</span>
            </div>

            <button>
              <Bell size={15} />
            </button>
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

        {activeTab === "earnings" && (
          <EarningsTab earnings={earnings} online={online} />
        )}

        {activeTab === "trips" && (
          <TripsTab earnings={earnings} online={online} />
        )}

        {activeTab === "profile" && (
          <ProfileTab online={online} />
        )}
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