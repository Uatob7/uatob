import { Home, Car, Shield, BarChart2 } from "lucide-react";
import { C } from '@/App/Admin/Tokens';

const tabs = [
  { id: "home",      label: "Overview",  icon: Home },
  { id: "drivers",   label: "Fleet",     icon: Car },
  { id: "approvals", label: "Approvals", icon: Shield },
  { id: "analytics", label: "Analytics", icon: BarChart2 },
];

export function TabBar({ activeTab, setActiveTab, pendingCount = 0 }) {
  return (
    <div style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 60,
      borderTop: `1px solid ${C.border}`,
      background: C.surface,
      padding: "8px 0",
      boxShadow: "0 -8px 24px rgba(0,0,0,.08)",
    }}>
      <div style={{
        maxWidth: 640,
        margin: "0 auto",
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        gap: 8,
        padding: "0 12px",
      }}>
        {tabs.map(tab => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                border: "none",
                borderRadius: 14,
                background: active ? C.surfaceHigh : "transparent",
                color: active ? C.text : C.textMuted,
                padding: "10px 8px",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 700,
                minHeight: 58,
              }}
            >
              <tab.icon size={18} color={active ? C.text : C.textMuted} />
              <span style={{ position: "relative" }}>
                {tab.label}
                {tab.id === "approvals" && pendingCount > 0 && (
                  <span style={{
                    position: "absolute",
                    top: -8,
                    right: -18,
                    background: C.red,
                    color: "#fff",
                    borderRadius: 999,
                    fontSize: 9,
                    fontWeight: 800,
                    padding: "2px 6px",
                    lineHeight: 1,
                  }}>
                    {pendingCount}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
