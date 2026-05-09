import {
  Home,
  Car,
  Search,
  BarChart2,
  Shield,
  Settings,
  UserSearch,
  MessageSquare,
} from "lucide-react";
import { C } from "@/App/Admin/Tokens";
import { useCallback } from "react";

const NAV_LINKS = [
  { icon: Home, label: "Dashboard", tab: "home" },
  { icon: Search, label: "Search", tab: "search" },
  { icon: Car, label: "Drivers", tab: "drivers" },
  { icon: UserSearch, label: "Accounts", tab: "riders" }, // fixed label
  { icon: MessageSquare, label: "Chat", tab: "chat" },
  { icon: BarChart2, label: "Analytics", tab: "analytics" },
  { icon: Shield, label: "Compliance", tab: "compliance" },
  { icon: Settings, label: "Settings", tab: "settings" },
];

export function DrawerNav({ activeTab, onNavigate, onClose }) {
  const handleClick = useCallback(
    (tab) => {
      onNavigate(tab);
      onClose?.(); // safer (won’t crash if undefined)
    },
    [onNavigate, onClose]
  );

  return (
    <nav style={{ padding: "10px", flex: 1 }}>
      {NAV_LINKS.map(({ icon: Icon, label, tab }) => {
        const isActive = activeTab === tab;

        return (
          <button
            key={tab} // better than label (labels can change)
            onClick={() => handleClick(tab)}
            aria-current={isActive ? "page" : undefined}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px",
              borderRadius: 12,
              border: "none",
              background: isActive ? C.greenGlow : "transparent",
              color: isActive ? C.green : C.text,
              cursor: "pointer",
              fontFamily: "'Barlow', sans-serif",
              fontSize: 15,
              fontWeight: isActive ? 700 : 600,
              transition: "all .15s ease",
              position: "relative",
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.background = C.surfaceHigh;
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.background = "transparent";
            }}
          >
            {isActive && (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: "20%",
                  bottom: "20%",
                  width: 3,
                  borderRadius: "0 3px 3px 0",
                  background: C.green,
                }}
              />
            )}

            <Icon size={18} color={isActive ? C.green : C.textMuted} />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}