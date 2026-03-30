import { Home, TrendingUp, Package, Users } from 'lucide-react';
import { C } from '@/App/Drivers/constants.js';

const TABS = [
  { id: "home",     icon: Home,       label: "Home"     },
  { id: "earnings", icon: TrendingUp,  label: "Earnings" },
  { id: "trips",    icon: Package,    label: "Trips"    },
  { id: "profile",  icon: Users,      label: "Profile"  },
];

/**
 * Fixed bottom navigation bar.
 *
 * Props:
 *   activeTab    — current tab id string
 *   setActiveTab — setter
 *   online       — drives active-indicator color (green vs ink)
 *   activeTrip   — used to show the pulsing green dot on Home
 */
export default function BottomTabBar({ activeTab, setActiveTab, online, activeTrip }) {
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      background: "rgba(255,255,255,.97)",
      backdropFilter: "blur(24px)",
      borderTop: `1px solid ${C.border}`,
      display: "flex", zIndex: 500,
      boxShadow: "0 -4px 20px rgba(0,0,0,.06)",
      paddingBottom: "env(safe-area-inset-bottom)",
    }}>
      {TABS.map(tab => {
        const isActive = activeTab === tab.id;
        const activeColor = online ? C.onlineGreen : C.offlineInk;

        return (
          <button
            key={tab.id}
            className={`tab-btn ${isActive ? "act" : ""}`}
            onClick={() => setActiveTab(tab.id)}
            style={{ position: "relative", color: isActive ? activeColor : C.textDim }}
          >
            {/* Active indicator bar */}
            {isActive && (
              <div style={{
                position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
                width: 28, height: 3,
                background: online
                  ? "linear-gradient(90deg,#22C55E,#16A34A)"
                  : "linear-gradient(90deg,#374151,#111827)",
                borderRadius: "0 0 3px 3px",
                boxShadow: online
                  ? "0 0 10px rgba(22,163,74,.4)"
                  : "0 0 8px rgba(17,24,39,.3)",
              }}/>
            )}

            <tab.icon size={20} color={isActive ? activeColor : C.textDim}/>
            {tab.label}

            {/* Live pulse dot on Home when online & not on a trip */}
            {tab.id === "home" && online && !activeTrip && (
              <div style={{
                position: "absolute", top: 9, marginLeft: 20,
                width: 6, height: 6,
                background: C.onlineGreen,
                borderRadius: "50%",
                animation: "pulse 2s ease-in-out infinite",
              }}/>
            )}
          </button>
        );
      })}
    </div>
  );
}