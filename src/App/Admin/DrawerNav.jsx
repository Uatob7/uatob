import { Home, Car, Search, BarChart2, Shield, Settings, UserSearch } from "lucide-react";
import { C } from '@/App/Admin/Tokens';

const NAV_LINKS = [
  { icon: Home,       label: "Dashboard",  tab: "home" },
  { icon: Search,     label: "Search",     tab: "search" },
  { icon: Car,        label: "Drivers",    tab: "drivers" },
  { icon: UserSearch, label: "Account",    tab: "riders" },
  { icon: BarChart2,  label: "Analytics",  tab: "analytics" },
  { icon: Shield,     label: "Compliance", tab: "compliance" },
  { icon: Settings,   label: "Settings",   tab: "settings" },
];

export function DrawerNav({ onNavigate, onClose }) {
  return (
    <div style={{ padding: "10px 10px", flex: 1 }}>
      {NAV_LINKS.map(({ icon: Icon, label, tab }) => (
        <button
          key={label}
          onClick={() => {
            onNavigate(tab);
            onClose();
          }}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: 12,
            padding: "12px 12px", borderRadius: 12, border: "none",
            background: "transparent", color: C.text, cursor: "pointer",
            fontFamily: "'Barlow',sans-serif", fontSize: 15, fontWeight: 600,
            transition: "background .15s",
          }}
          onMouseEnter={e => e.currentTarget.style.background = C.surfaceHigh}
          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
        >
          <Icon size={18} color={C.textMuted} />
          {label}
        </button>
      ))}
    </div>
  );
}