import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Bell, Loader2, AlertCircle } from "lucide-react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { firebase_app } from "@/firebase/config";

import { CSS } from '@/App/Admin/Tokens';
import { Toast } from '@/App/Admin/UI';
import { TopBar } from '@/App/Admin/Topbar';
import { Drawer } from '@/App/Admin/Drawer';
import { TabBar } from '@/App/Admin/TabBar';
import { useViews } from "@/App/Admin/useViews";
import { HomeTab }       from '@/App/Admin/HomeTab';
import { DriversTab }    from '@/App/Admin/Driverstab';
import { ApprovalsTab }  from '@/App/Admin/Approvalstab';
import { AnalyticsTab }  from '@/App/Admin/Analyticstab';
import { RidersTab }     from '@/App/Admin/RidersTab';
import { ComplianceTab } from '@/App/Admin/ComplianceTab';
import { SettingsTab }   from '@/App/Admin/SettingsTab';

import { useTotalAccounts }   from "@/App/Admin/useTotalAccounts";
import { useDriverPresence }  from "@/App/Admin/useDriverPresence";
import { useActiveRides }     from "@/App/Admin/useActiveRides";
import { useSearchingRides }  from "@/App/Admin/useSearchingRides";
import { useTotalRides }      from "@/App/Admin/useTotalRides";
import { useActiveDrivers }   from "@/App/Admin/useActiveDrivers";
import { useRevenueToday }    from "@/App/Admin/useRevenueToday";
import { usePendingApprovals } from "@/App/Admin/usePendingApprovals";
import { useLiveRides }       from "@/App/Admin/useLiveRides";
import { useFleetDrivers }    from "@/App/Admin/useFleetDrivers";
import { useApprovals }       from "@/App/Admin/useApprovals";
import { useRideAnalytics }   from "@/App/Admin/useRideAnalytics";
import { useRiders }          from "@/App/Admin/useRiders";

// ── Callables ──────────────────────────────────────────────────────────────
const functions          = getFunctions(firebase_app, "us-east1");
const callSaveAdminToken = httpsCallable(functions, "saveAdminFcmToken");

// ── VAPID key ──────────────────────────────────────────────────────────────
const VAPID_KEY = "BJ_sRHZonSGCKk2mB2i9ofTRS8ouFVMV-I15FX4sqdUXHyVb1lo6H-N4GMPrlcIIshRlykQicaxkxxFxcYcI4JQ";

// ── FCM registration ───────────────────────────────────────────────────────
async function registerAdminFcmToken() {
  if (!("Notification" in window)) throw new Error("Push not supported in this browser");
  const permission = await window.Notification.requestPermission();
  if (permission !== "granted") throw new Error("Permission denied");
  const messaging = getMessaging(firebase_app);
  const token = await getToken(messaging, { vapidKey: VAPID_KEY });
  if (!token) throw new Error("FCM returned empty token — check firebase-messaging-sw.js");
  await callSaveAdminToken({ token });
  console.log("[UaTob Admin] FCM token registered");
}

// ── Notification popup styles ──────────────────────────────────────────────
const POPUP_STYLES = `
  @keyframes adminFadeIn  { from { opacity:0 } to { opacity:1 } }
  @keyframes adminSlideUp { from { opacity:0; transform:translateY(18px) } to { opacity:1; transform:translateY(0) } }
  @keyframes adminSpin    { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
  .admin-enable-btn:active { transform: scale(0.97); }
`;

function AdminNotificationPopup({ onEnable, onSkip, loading, error }) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onSkip(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 1050,
        background: "rgba(0,0,0,.45)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px", animation: "adminFadeIn .2s ease",
      }}
    >
      <style>{POPUP_STYLES}</style>
      <div style={{
        background: "#fff", borderRadius: "24px", padding: "28px 24px 24px",
        width: "100%", maxWidth: "360px",
        boxShadow: "0 24px 60px rgba(0,0,0,.18)",
        animation: "adminSlideUp .28s cubic-bezier(.34,1.56,.64,1)",
      }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
          <div style={{
            width: "68px", height: "68px", borderRadius: "50%",
            background: error ? "rgba(220,38,38,.08)" : "rgba(37,99,235,.09)",
            border: `2px solid ${error ? "rgba(220,38,38,.25)" : "rgba(37,99,235,.25)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: error ? "0 0 0 8px rgba(220,38,38,.05)" : "0 0 0 8px rgba(37,99,235,.05)",
          }}>
            {loading
              ? <Loader2 size={28} color="#2563EB" style={{ animation: "adminSpin 1s linear infinite" }} />
              : error
                ? <AlertCircle size={28} color="#DC2626" />
                : <Bell size={28} color="#2563EB" />
            }
          </div>
        </div>

        <div style={{ textAlign: "center", marginBottom: "8px" }}>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: "22px", fontWeight: "900", color: "#111827",
            letterSpacing: "-0.3px", marginBottom: "6px",
          }}>
            {error ? "Registration failed" : "Enable admin alerts"}
          </div>
          <div style={{ fontSize: "13.5px", color: "#6B7280", fontWeight: "500", lineHeight: "1.6" }}>
            {error
              ? error
              : "Get instant push notifications for new ride requests, driver approvals, and platform alerts."
            }
          </div>
        </div>

        {!loading && !error && (
          <div style={{ margin: "16px 0 22px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              { icon: "🚗", text: "New ride requests" },
              { icon: "✅", text: "Driver approval alerts" },
              { icon: "⚠️", text: "Platform warnings" },
            ].map(({ icon, text }) => (
              <div key={text} style={{
                display: "flex", alignItems: "center", gap: "10px",
                background: "rgba(37,99,235,.04)", borderRadius: "10px",
                padding: "9px 12px", border: "1px solid rgba(37,99,235,.10)",
              }}>
                <span style={{ fontSize: "16px", lineHeight: 1 }}>{icon}</span>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#374151", fontFamily: "'Barlow', sans-serif" }}>{text}</span>
              </div>
            ))}
          </div>
        )}

        {!loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: error ? "20px" : 0 }}>
            <button
              className="admin-enable-btn"
              onClick={onEnable}
              style={{
                width: "100%", padding: "15px", borderRadius: "14px",
                border: "none",
                background: error
                  ? "linear-gradient(135deg,#DC2626,#991B1B)"
                  : "linear-gradient(135deg,#3B82F6,#2563EB 55%,#1D4ED8)",
                color: "#fff", fontSize: "15px", fontWeight: "800",
                fontFamily: "'Barlow', sans-serif", cursor: "pointer",
                boxShadow: error ? "0 4px 14px rgba(220,38,38,.35)" : "0 4px 14px rgba(37,99,235,.35)",
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: "8px", transition: "transform .1s",
              }}
            >
              <Bell size={16} />
              {error ? "Try again" : "Enable notifications"}
            </button>
            <button
              onClick={onSkip}
              style={{
                width: "100%", padding: "14px", borderRadius: "14px",
                border: "1.5px solid #E5E7EB", background: "#fff",
                color: "#6B7280", fontSize: "14px", fontWeight: "700",
                fontFamily: "'Barlow', sans-serif", cursor: "pointer",
              }}
            >
              Not now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab titles ─────────────────────────────────────────────────────────────
const TAB_TITLES = {
  home:       "Dashboard",
  drivers:    "Fleet",
  approvals:  "Approvals",
  analytics:  "Analytics",
  riders:     "Riders",
  compliance: "Compliance",
  settings:   "Settings",
};

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────
export default function UaTobAdminDashboard() {
  const [activeTab,      setActiveTab]      = useState("home");
  const [drawerOpen,     setDrawerOpen]     = useState(false);
  const [toast,          setToast]          = useState(null);
  const [showNotifPopup, setShowNotifPopup] = useState(false);
  const [notifLoading,   setNotifLoading]   = useState(false);
  const [notifError,     setNotifError]     = useState("");
  const { views } = useViews();

  console.log("Admin views:", views);

  const useriders = useRiders();
  const toastRef  = useRef(null);

  // ── Data hooks ─────────────────────────────────────────────────────────
  const { totalAccounts }  = useTotalAccounts();
  const { uatobdrivers }   = useDriverPresence();
  console.log("Driver presence data:", uatobdrivers);
  const { activeRides }    = useActiveRides();
  const { searchingRides } = useSearchingRides();
  const { totalRides }     = useTotalRides();
  const { activeDrivers }  = useActiveDrivers();
  const { revenue }        = useRevenueToday();
  const { liveRides }      = useLiveRides();
  const { approvals }      = usePendingApprovals();
  const { fleet }          = useFleetDrivers();
  const { approvals: allApprovals } = useApprovals();

  const {
    totalRides:      analyticsTotal,
    ridesPerDay      = [0, 0, 0, 0, 0, 0, 0],
    avgTripDuration  = 0,
    avgFare          = 0,
    acceptanceRate   = 0,
    cancellationRate = 0,
    topDrivers       = [],
  } = useRideAnalytics();

  // ── Notification popup on mount ────────────────────────────────────────
  useEffect(() => {
    if ("Notification" in window && window.Notification.permission === "default") {
      setShowNotifPopup(true);
    } else if ("Notification" in window && window.Notification.permission === "granted") {
      registerAdminFcmToken().catch(err =>
        console.warn("[UaTob Admin] Silent token refresh failed:", err.message)
      );
    }
  }, []);

  // ── Foreground push handler ────────────────────────────────────────────
  useEffect(() => {
    let unsub = () => {};
    try {
      const messaging = getMessaging(firebase_app);
      unsub = onMessage(messaging, (payload) => {
        const title = payload.notification?.title ?? "Admin Alert";
        const body  = payload.notification?.body  ?? "";
        showToast(`${title} — ${body}`);
      });
    } catch (err) {
      console.warn("[UaTob Admin] onMessage setup failed:", err.message);
    }
    return unsub;
  }, []);

  // ── Notification handlers ──────────────────────────────────────────────
  const handleEnableNotifications = useCallback(async () => {
    setNotifLoading(true);
    setNotifError("");
    try {
      await registerAdminFcmToken();
      setShowNotifPopup(false);
    } catch (err) {
      setNotifError(err.message || "Registration failed. Please try again.");
    } finally {
      setNotifLoading(false);
    }
  }, []);

  const handleSkipNotifications = useCallback(() => {
    setShowNotifPopup(false);
    setNotifError("");
  }, []);

  // ── Toast ──────────────────────────────────────────────────────────────
  const showToast = (msg) => {
    setToast(msg);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    return () => { if (toastRef.current) clearTimeout(toastRef.current); };
  }, []);

  // ── Tabs ───────────────────────────────────────────────────────────────
  const CurrentTab = useMemo(() => {
    switch (activeTab) {
      case "home":
        return (
          <HomeTab
            totalAccounts={totalAccounts}
            allApprovals={allApprovals}
            uatobdrivers={uatobdrivers}
            activeRides={activeRides}
            searchingRides={searchingRides}
            liveRides={liveRides}
            totalRides={totalRides}
            activeDrivers={activeDrivers}
            revenue={revenue}
            approvals={approvals}
            onToast={showToast}
          />
        );
      case "drivers":
        return <DriversTab fleet={fleet} onToast={showToast} />;
      case "approvals":
        return <ApprovalsTab allApprovals={allApprovals} onToast={showToast} />;
      case "analytics":
        return (
          <AnalyticsTab
            uatobdrivers={uatobdrivers}
            views={views}
            totalRides={analyticsTotal}
            ridesPerDay={ridesPerDay}
            avgTripDuration={avgTripDuration}
            avgFare={avgFare}
            acceptanceRate={acceptanceRate}
            cancellationRate={cancellationRate}
            topDrivers={topDrivers}
          />
        );
      case "riders":
        return <RidersTab useriders={useriders} onBack={() => setActiveTab("home")} />;
      case "compliance":
        return <ComplianceTab onBack={() => setActiveTab("home")} />;
      case "settings":
        return <SettingsTab onBack={() => setActiveTab("home")} />;
      default:
        return null;
    }
  }, [
    activeTab, liveRides, totalRides, activeDrivers, revenue,
    allApprovals, approvals, fleet, avgTripDuration, avgFare,
    acceptanceRate, cancellationRate, topDrivers, analyticsTotal,
    ridesPerDay,
  ]);

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#F2F5F2", color: "#111827", fontFamily: "'Barlow', sans-serif" }}>
      <style>{CSS}</style>

      <Toast msg={toast} />

      {showNotifPopup && (
        <AdminNotificationPopup
          loading={notifLoading}
          error={notifError}
          onEnable={handleEnableNotifications}
          onSkip={handleSkipNotifications}
        />
      )}

      <Drawer useriders={useriders} open={drawerOpen} onClose={() => setDrawerOpen(false)} onNavigate={setActiveTab} />

      <TopBar title={TAB_TITLES[activeTab]} onMenuOpen={() => setDrawerOpen(true)} views={views} />

      <div style={{ paddingBottom: 80, paddingTop: 16, maxWidth: 640, margin: "0 auto" }}>
        {CurrentTab}
      </div>

      {["home", "drivers", "approvals", "analytics"].includes(activeTab) && (
        <TabBar activeTab={activeTab} setActiveTab={setActiveTab} />
      )}
    </div>
  );
}