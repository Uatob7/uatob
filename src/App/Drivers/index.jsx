// src/App/Drivers.jsx
import React, { useEffect, useState } from 'react';
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
} from 'firebase/firestore';

const db = getFirestore();

export default function UaTobDriverApp() {

  // ── Driver core state ─────────────────────────────────
  const [online, setOnline] = useState(false);
  const [activeTab, setActiveTab] = useState("home");
  const [mounted, setMounted] = useState(false);

  // ── Trip request flow ─────────────────────────────────
  const [tripRequest, setTripRequest] = useState(null);
  const [requestTimer, setRequestTimer] = useState(15);
  const [reqIndex, setReqIndex] = useState(0);

  // ── Active trip state ─────────────────────────────────
  const [activeTrip, setActiveTrip] = useState(null);
  const [tripStage, setTripStage] = useState("idle");

  // ── Earnings ──────────────────────────────────────────
  const [earnings, setEarnings] = useState({
    today: 142.8,
    week: 929.0,
    trips: 8,
  });

  // ── UI state ──────────────────────────────────────────
  const [showSurgeAlert, setShowSurgeAlert] = useState(false);
  const [notification, setNotification] = useState(null);

  const timerRef = useRef(null);
  const reqRef = useRef(null);

  // ── Mount animation ───────────────────────────────────
  useEffect(() => {
    setMounted(true);
  }, []);

  // ── Auto dispatch requests ────────────────────────────
  useEffect(() => {
    if (!online || tripRequest || activeTrip) return;

    const delay = Math.random() * 4000 + 3000;

    reqRef.current = setTimeout(() => {
      setTripRequest(TRIP_REQUESTS[reqIndex % TRIP_REQUESTS.length]);
      setRequestTimer(15);
    }, delay);

    return () => {
      if (reqRef.current) clearTimeout(reqRef.current);
    };
  }, [online, tripRequest, activeTrip, reqIndex]);

  // ── Countdown timer ───────────────────────────────────
  useEffect(() => {
    if (!tripRequest) return;

    timerRef.current = setInterval(() => {
      setRequestTimer((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          setTripRequest(null);
          setReqIndex((i) => i + 1);
          showNotif("Request expired", "Looking for next request...");
          return 15;
        }
        return t - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [tripRequest]);

  // ── Surge alert ───────────────────────────────────────
  useEffect(() => {
    if (!online) return;

    const t = setTimeout(() => setShowSurgeAlert(true), 8000);
    return () => clearTimeout(t);
  }, [online]);

  // ── Notification helper ───────────────────────────────
  const showNotif = (title, msg) => {
    setNotification({ title, msg });
    setTimeout(() => setNotification(null), 3500);
  };

  // ── Toggle online/offline ─────────────────────────────
  const handleToggleOnline = () => {
    if (online) {
      setOnline(false);

      setTripRequest(null);
      setActiveTrip(null);
      setTripStage("idle");

      if (timerRef.current) clearInterval(timerRef.current);
      if (reqRef.current) clearTimeout(reqRef.current);

      showNotif("Offline", "See you next time.");
    } else {
      setOnline(true);
      showNotif("Online", "Ready to receive requests.");
    }
  };

  // ── Accept trip ───────────────────────────────────────
  const handleAcceptTrip = () => {
    if (!tripRequest) return;

    clearInterval(timerRef.current);

    const acceptedTrip = tripRequest;

    setActiveTrip(acceptedTrip);
    setTripRequest(null);
    setTripStage("enroute");

    showNotif("Trip accepted", `En route to ${acceptedTrip.rider}`);
    setActiveTab("home");
  };

  // ── Decline trip ──────────────────────────────────────
  const handleDeclineTrip = () => {
    clearInterval(timerRef.current);

    setTripRequest(null);
    setReqIndex((i) => i + 1);

    showNotif("Declined", "Scanning for next request...");
  };

  // ── Advance trip lifecycle ────────────────────────────
  const handleAdvanceTrip = () => {
    if (tripStage === "enroute") {
      setTripStage("arrived");
    } 
    else if (tripStage === "arrived") {
      setTripStage("in_progress");
    } 
    else if (tripStage === "in_progress") {

      const trip = activeTrip;

      setTripStage("completed");

      const fareNum = parseFloat(trip.fare.replace("$", ""));

      setEarnings((e) => ({
        today: +(e.today + fareNum).toFixed(2),
        week: +(e.week + fareNum).toFixed(2),
        trips: e.trips + 1,
      }));

      setTimeout(() => {
        setTripStage("idle");
        setActiveTrip(null);
        setReqIndex((i) => i + 1);
        showNotif("Trip complete", `+${trip.fare} earned`);
      }, 3000);
    }
  };

  // ── Derived UI values ─────────────────────────────────
  const tripBtnLabel = {
    enroute: "Arrived at Pickup",
    arrived: "Start Trip",
    in_progress: "Complete Trip",
  }[tripStage];

  const tripStageColor = {
    enroute: C.blue,
    arrived: C.onlineGreen,
    in_progress: C.green,
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
      <SurgeBanner
        show={showSurgeAlert}
        online={online}
        onClose={() => setShowSurgeAlert(false)}
      />
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