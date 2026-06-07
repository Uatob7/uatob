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
import { useCallback, useState } from "react";

const NAV_LINKS = [
  { icon: Home,          label: "Dashboard",  tab: "home" },
  { icon: MessageSquare, label: "Support",    tab: "chat" },
  { icon: Search,        label: "Search",     tab: "search" },
  { icon: Car,           label: "Drivers",    tab: "drivers" },
  { icon: UserSearch,    label: "Accounts",   tab: "riders" },
  { icon: BarChart2,     label: "Analytics",  tab: "analytics" },
  { icon: Shield,        label: "Compliance", tab: "compliance" },
  { icon: Settings,      label: "Settings",   tab: "settings" },
];

export function DrawerNav({ activeTab, onNavigate, onClose, supportUnread = 0 }) {
  const [hoverTab, setHoverTab] = useState(null);

  const handleClick = useCallback(
    (tab) => {
      onNavigate(tab);
      onClose?.();
    },
    [onNavigate, onClose]
  );

  return (
    <nav
      style={{
        padding: "8px 10px",
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: 2,
        fontFamily: "'Barlow', sans-serif",
      }}
    >
      {NAV_LINKS.map(({ icon: Icon, label, tab }) => {
        const isActive   = activeTab === tab;
        const isHover    = hoverTab === tab && !isActive;
        const badgeCount = tab === "chat" ? supportUnread : 0;

        return (
          <button
            key={tab}
            onClick={() => handleClick(tab)}
            onMouseEnter={() => setHoverTab(tab)}
            onMouseLeave={() => setHoverTab(null)}
            aria-current={isActive ? "page" : undefined}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "9px 10px",
              borderRadius: 12,
              border: "1px solid",
              borderColor: isActive
                ? "rgba(34,197,94,.18)"
                : isHover
                ? "rgba(255,255,255,.06)"
                : "transparent",
              background: isActive
                ? C.greenGlow
                : isHover
                ? C.surfaceHigh
                : "transparent",
              color: isActive ? C.green : C.text,
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 14.5,
              fontWeight: isActive ? 700 : 600,
              letterSpacing: ".01em",
              transition: "background .15s ease, color .15s ease, border-color .15s ease",
              position: "relative",
              textAlign: "left",
            }}
          >
            {/* Active rail */}
            {isActive && (
              <div
                style={{
                  position: "absolute",
                  left: -10,
                  top: "22%",
                  bottom: "22%",
                  width: 3,
                  borderRadius: "0 3px 3px 0",
                  background: C.green,
                  boxShadow: `0 0 8px ${C.green}`,
                }}
              />
            )}

            {/* Icon container */}
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: isActive
                  ? "rgba(34,197,94,.12)"
                  : isHover
                  ? "rgba(255,255,255,.04)"
                  : "rgba(255,255,255,.025)",
                border: `1px solid ${
                  isActive ? "rgba(34,197,94,.2)" : "rgba(255,255,255,.05)"
                }`,
                flexShrink: 0,
                transition: "background .15s ease, border-color .15s ease",
              }}
            >
              <Icon
                size={16}
                strokeWidth={2.25}
                color={isActive ? C.green : isHover ? C.text : C.textMuted}
              />
            </div>

            <span style={{ flex: 1 }}>{label}</span>

            {badgeCount > 0 && (
              <span
                style={{
                  minWidth: 20,
                  height: 20,
                  borderRadius: 10,
                  background: C.redGlow,
                  border: "1px solid rgba(220,38,38,.25)",
                  color: C.red,
                  fontSize: 11,
                  fontWeight: 800,
                  lineHeight: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 6px",
                  flexShrink: 0,
                  letterSpacing: ".02em",
                  boxShadow: "0 0 0 2px rgba(220,38,38,.06)",
                }}
              >
                {badgeCount > 99 ? "99+" : badgeCount}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}