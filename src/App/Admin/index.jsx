// src/App/UaTob/Admin/UaTobAdminDashboard.jsx
import { useState, useRef, useEffect, useMemo } from "react";
import { CSS } from '@/App/Admin/Tokens';
import { Toast } from '@/App/Admin/UI';
import { TopBar } from '@/App/Admin/Topbar';
import { Drawer } from '@/App/Admin/Drawer';
import { TabBar } from '@/App/Admin/TabBar';

import { HomeTab }      from '@/App/Admin/HomeTab';
import { DriversTab }   from '@/App/Admin/Driverstab';
import { ApprovalsTab } from '@/App/Admin/Approvalstab';
import { AnalyticsTab } from '@/App/Admin/Analyticstab';

import { useTotalRides }      from "@/App/Admin/useTotalRides";
import { useActiveDrivers }   from "@/App/Admin/useActiveDrivers";
import { useRevenueToday }    from "@/App/Admin/useRevenueToday";
import { usePendingApprovals } from "@/App/Admin/usePendingApprovals";
import { useLiveRides }       from "@/App/Admin/useLiveRides";
import { useFleetDrivers }    from "@/App/Admin/useFleetDrivers";
import { useApprovals }       from "@/App/Admin/useApprovals";
import { useAnalyticsData }   from "@/App/Admin/useAnalyticsData";

const TAB_TITLES = {
  home:      "Dashboard",
  drivers:   "Fleet",
  approvals: "Approvals",
  analytics: "Analytics",
};

export default function UaTobAdminDashboard() {
  const [activeTab,   setActiveTab]   = useState("home");
  const [drawerOpen,  setDrawerOpen]  = useState(false);
  const [toast,       setToast]       = useState(null);
  const toastRef = useRef(null);

  // ── Data hooks ────────────────────────────────────────────────────────────
  const { totalRides }              = useTotalRides();
  const { activeDrivers }           = useActiveDrivers();
  const { revenue }                 = useRevenueToday();
  const { liveRides }               = useLiveRides();

  // Approvals tab — all pending driver applications
  const { approvals }               = usePendingApprovals();

  // Fleet tab — fully onboarded / active drivers
  const { drivers }                 = useFleetDrivers();

  // Home tab summary counts (e.g. badge on stat card)
  const { approvals: allApprovals } = useApprovals();

  const { analytics }               = useAnalyticsData();
  // ─────────────────────────────────────────────────────────────────────────

  const showToast = (msg) => {
    setToast(msg);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 2500);
  };

  // Prevent memory leaks on unmount
  useEffect(() => {
    return () => {
      if (toastRef.current) clearTimeout(toastRef.current);
    };
  }, []);

  // All data vars that any tab consumes must live in this dep array,
  // otherwise Firestore updates won't trigger a re-render.
  const CurrentTab = useMemo(() => {
    switch (activeTab) {
      case "home":
        return (
          <HomeTab
            liveRides={liveRides}
            totalRides={totalRides}
            activeDrivers={activeDrivers}
            revenue={revenue}
            approvals={allApprovals}
            onToast={showToast}
          />
        );
      case "drivers":
        return (
          <DriversTab
            fleet={drivers}
            onToast={showToast}
          />
        );
      case "approvals":
        return (
          <ApprovalsTab
            approvals={approvals}
            onToast={showToast}
          />
        );
      case "analytics":
        return (
          <AnalyticsTab
            analytics={analytics}
          />
        );
      default:
        return null;
    }
  }, [
    activeTab,
    liveRides,
    totalRides,
    activeDrivers,
    revenue,
    allApprovals,
    approvals,
    drivers,
    analytics,
  ]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F2F5F2",
        color: "#111827",
        fontFamily: "'Barlow', sans-serif",
      }}
    >
      <style>{CSS}</style>

      <Toast msg={toast} />

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <TopBar
        title={TAB_TITLES[activeTab]}
        onMenuOpen={() => setDrawerOpen(true)}
      />

      <div
        style={{
          paddingBottom: 80,
          paddingTop: 16,
          maxWidth: 640,
          margin: "0 auto",
        }}
      >
        {CurrentTab}
      </div>

      <TabBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
    </div>
  );
}
