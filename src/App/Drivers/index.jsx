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
  const [tripRequest,    setTripRequest]    = useState(null);
  const [activeTrip,     setActiveTrip]     = useState(null);
  const [requestTimer,   setRequestTimer]   = useState(15);
  const [notification,   setNotification]   = useState(null);
  const [showSurgeAlert, setShowSurgeAlert] = useState(false);
  const [earnings,       setEarnings]       = useState({ today: 0, week: 0, trips: 0 });
  const [tripBtnLabel,   setTripBtnLabel]   = useState(""); // from Cloud Function

  // ── Refs ──────────────────────────────────────────────
  const skippedIds = useRef(new Set());
  const timerRef   = useRef(null);

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
      if (!status) return "";

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

  // ── Show new request ──────────────────────────────────
  useEffect(() => {
    if (!online || tripRequest || activeTrip) return;
    if (ridesLoading || rides.length === 0) return;

    const next = rides.find(r =>
      r.status === "searching_driver" &&
      !skippedIds.current.has(r.id)
    );

    if (!next) return;

    setTripRequest(normaliseRide(next));
    setRequestTimer(15);
  }, [online, rides, ridesLoading, tripRequest, activeTrip]);

  // ── Timer ─────────────────────────────────────────────
  useEffect(() => {
    if (!tripRequest) return;

    timerRef.current = setInterval(() => {
      setRequestTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          skippedIds.current.add(tripRequest.id);
          setTripRequest(null);
          showNotif("Request expired", "Looking for next...");
          return 15;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [tripRequest]);

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

  function normaliseRide(doc) {
    return {
      ...doc,
      fare: `$${doc.fareTotal?.toFixed(2) || "0.00"}`,
    };
  }

  // ── ONLINE toggle ─────────────────────────────────────
  const handleToggleOnline = () => {
    setOnline(!online);

    if (online) {
      setTripRequest(null);
      setActiveTrip(null);
      skippedIds.current.clear();
      showNotif("Offline", "See you next time");
    } else {
      showNotif("Online", "Ready for rides");
    }
  };

  // ── ACCEPT ────────────────────────────────────────────
  const handleAcceptTrip = async () => {
    try {
      await fetch("https://acceptride-ady2s2xhhq-uc.a.run.app", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rideId: tripRequest.id,
          driverUid: uid,
        }),
      });

      clearInterval(timerRef.current);
      setTripRequest(null);
      showNotif("Accepted", "Drive to pickup");
    } catch {
      showNotif("Error", "Accept failed");
    }
  };

  // ── DECLINE ───────────────────────────────────────────
  const handleDeclineTrip = async () => {
    try {
      await fetch("https://declineride-ady2s2xhhq-uc.a.run.app", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rideId: tripRequest.id,
          driverUid: uid,
        }),
      });
    } catch {}

    clearInterval(timerRef.current);
    setTripRequest(null);
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
              padding: "6px 12px"
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
            activeTrip={activeTrip}
            tripStage={tripStage}
            tripStageColor={tripStageColor}
            tripBtnLabel={tripBtnLabel} // from Cloud Function
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