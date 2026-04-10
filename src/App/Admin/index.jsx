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

import { useTotalAccounts } from "@/App/Admin/useTotalAccounts";
import { useDriverPresence }    from "@/App/Admin/useDriverPresence";
import { useActiveRides }       from "@/App/Admin/useActiveRides";
import { useSearchingRides }    from "@/App/Admin/useSearchingRides";
import { useTotalRides }      from "@/App/Admin/useTotalRides";
import { useActiveDrivers }   from "@/App/Admin/useActiveDrivers";
import { useRevenueToday }    from "@/App/Admin/useRevenueToday";
import { usePendingApprovals } from "@/App/Admin/usePendingApprovals";
import { useLiveRides }       from "@/App/Admin/useLiveRides";
import { useFleetDrivers }    from "@/App/Admin/useFleetDrivers";
import { useApprovals }       from "@/App/Admin/useApprovals";
import { useRideAnalytics } from "@/App/Admin/useRideAnalytics";




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

  console.log(toast);


  const toastRef = useRef(null);
  
  // ── Data hooks ────────────────────────────────────────────────────────────
  const { totalAccounts } = useTotalAccounts();
  const { uatobdrivers } = useDriverPresence();
  const {
    activeRides,
    count,
    isEmpty,
  
  } = useActiveRides();

  const {
  searchingRides,
  
} = useSearchingRides();

console.log("searchingRides", searchingRides);

 console.log("activeRides", activeRides);


  const { totalRides }              = useTotalRides();
  const { activeDrivers }           = useActiveDrivers();
  const { revenue }                 = useRevenueToday();
  const { liveRides }               = useLiveRides();

  const {
    totalRides: analyticsTotal,
    avgTripDuration = 0,
    avgFare = 0,
    acceptanceRate = 0,
    cancellationRate = 0,
    topDrivers = [],
    loading: analyticsLoading,
    error,
  } = useRideAnalytics();

  console.log("Analytics:", {
    avgTripDuration,
    avgFare,
    acceptanceRate,
    cancellationRate,
    topDrivers,
  });

  // Approvals tab — all pending driver applications
  const { approvals }               = usePendingApprovals();

  // Fleet tab — fully onboarded / active drivers
  const { drivers }                 = useFleetDrivers();

  // Home tab summary counts (e.g. badge on stat card)
  const { approvals: allApprovals } = useApprovals();
  console.log("Total Accounts:", totalAccounts);
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
            totalAccounts={totalAccounts}
            uatobdrivers={uatobdrivers}
            activeRides={activeRides}
            searchingRides={searchingRides}
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
            allApprovals={allApprovals}
            onToast={showToast}
          />
        );
      case "analytics":
        return (
          <AnalyticsTab
            totalRides={analyticsTotal}
            avgTripDuration={avgTripDuration}
            avgFare={avgFare}
            acceptanceRate={acceptanceRate}
            cancellationRate={cancellationRate}
            topDrivers={topDrivers}
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
    avgTripDuration,
    avgFare,
    acceptanceRate,
    cancellationRate,
    topDrivers,
    analyticsTotal,
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
