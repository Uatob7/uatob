import { Home, Car, Search, BarChart2, Shield, Settings, UserSearch, MessageSquare } from "lucide-react";
import { C } from '@/App/Admin/Tokens';

const NAV_LINKS = [
  { icon: Home,          label: "Dashboard",  tab: "home"       },
  { icon: Search,        label: "Search",     tab: "search"     },
  { icon: Car,           label: "Drivers",    tab: "drivers"    },
  { icon: UserSearch,    label: "Account",    tab: "riders"     },
  { icon: MessageSquare, label: "Chat",       tab: "chat"       },
  { icon: BarChart2,     label: "Analytics",  tab: "analytics"  },
  { icon: Shield,        label: "Compliance", tab: "compliance" },
  { icon: Settings,      label: "Settings",   tab: "settings"   },
];

export function DrawerNav({ activeTab, onNavigate, onClose }) {
  return (
    <div style={{ padding: "10px 10px", flex: 1 }}>
      {NAV_LINKS.map(({ icon: Icon, label, tab }) => {
        const isActive = activeTab === tab;
        return (
          <button
            key={label}
            onClick={() => {
              onNavigate(tab);
              onClose();
            }}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 12,
              padding: "12px 12px", borderRadius: 12, border: "none",
              background: isActive ? C.greenGlow : "transparent",
              color: isActive ? C.green : C.text,
              cursor: "pointer",
              fontFamily: "'Barlow', sans-serif", fontSize: 15, fontWeight: isActive ? 700 : 600,
              transition: "background .15s, color .15s",
              position: "relative",
            }}
            onMouseEnter={e => {
              if (!isActive) e.currentTarget.style.background = C.surfaceHigh;
            }}
            onMouseLeave={e => {
              if (!isActive) e.currentTarget.style.background = "transparent";
            }}
          >
            {/* Active indicator bar */}
            {isActive && (
              <div style={{
                position: "absolute", left: 0, top: "20%", bottom: "20%",
                width: 3, borderRadius: "0 3px 3px 0",
                background: C.green,
              }} />
            )}
            <Icon size={18} color={isActive ? C.green : C.textMuted} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
