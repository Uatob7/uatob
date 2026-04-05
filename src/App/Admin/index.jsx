// src/App/UaTob/Admin/UaTobAdminDashboard.jsx
import { useState, useRef, useEffect, useMemo } from "react";
import { CSS } from '@/App/Admin/Tokens';
import { Toast } from '@/App/Admin/UI';
import { TopBar } from '@/App/Admin/Topbar';
import { Drawer } from '@/App/Admin/Drawer';
import { TabBar } from '@/App/Admin/TabBar';

import { HomeTab } from '@/App/Admin/HomeTab';
import { DriversTab } from '@/App/Admin/Driverstab';
 import { ApprovalsTab } from '@/App/Admin/Approvalstab';
import { AnalyticsTab } from '@/App/Admin/Analyticstab';

import { useTotalRides } from "@/App/Admin/useTotalRides";
import { useActiveDrivers } from "@/App/Admin/useActiveDrivers";
import { useRevenueToday } from "@/App/Admin/useRevenueToday";
import { usePendingApprovals } from "@/App/Admin/usePendingApprovals";
import { useLiveRides } from "@/App/Admin/useLiveRides";
import { useFleetDrivers } from "@/App/Admin/useFleetDrivers";
import { useApprovals } from "@/App/Admin/useApprovals";
import { useAnalyticsData } from "@/App/Admin/useAnalyticsData";


const TAB_TITLES = {
  home: "Dashboard",
  drivers: "Fleet",
  approvals: "Approvals",
  analytics: "Analytics",
};

export default function UaTobAdminDashboard() {
  const [activeTab, setActiveTab] = useState("home");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const toastRef = useRef(null);

  // 🔥 REAL DATA HOOK (you forgot to use it)
    const { totalRides } = useTotalRides();
    const { activeDrivers, } = useActiveDrivers();
    const { revenue, loading } = useRevenueToday();
    const { approvals } = useApprovals();
    const { liveRides,  } = useLiveRides();


    const { fleet } = usePendingApprovals();


   const { drivers,  totalDrivers } = useFleetDrivers();
  const { analytics,  } = useAnalyticsData();

  console.log("Analytics data:", analytics);






  const showToast = (msg) => {
    setToast(msg);

    if (toastRef.current) clearTimeout(toastRef.current);

    toastRef.current = setTimeout(() => {
      setToast(null);
    }, 2500);
  };

  // 🧼 Prevent memory leaks
  useEffect(() => {
    return () => {
      if (toastRef.current) clearTimeout(toastRef.current);
    };
  }, []);

  // 🔥 Centralized tab rendering (clean + scalable)
  const CurrentTab = useMemo(() => {
    switch (activeTab) {
      case "home":
        return <HomeTab onToast={showToast} liveRides={liveRides} activeDrivers={activeDrivers} revenue={revenue} approvals={approvals} />;
      case "drivers":
        return <DriversTab fleet={fleet} onToast={showToast} />;
      case "approvals":
        return <ApprovalsTab approvals={approvals} onToast={showToast} />;
      case "analytics":
        return <AnalyticsTab analytics={analytics}   />;
      default:
        return null;
    }
  }, [activeTab, totalRides]);

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

      {/* Toast */}
      <Toast msg={toast} />

      {/* Drawer */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Top Navigation */}
      <TopBar
        title={TAB_TITLES[activeTab]}
        onMenuOpen={() => setDrawerOpen(true)}
      />

      {/* Main Content */}
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

      {/* Bottom Tabs */}
      <TabBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
    </div>
  );
}