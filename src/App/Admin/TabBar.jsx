import { Home, Car, Shield, BarChart2 } from "lucide-react";
import { C } from '@/App/Admin/Tokens';

const tabs = [
  { id: "home",      label: "Overview",  icon: Home },
  { id: "drivers",   label: "Drivers",   icon: Car },
  { id: "approvals", label: "Approvals", icon: Shield },
  { id: "analytics", label: "Analytics", icon: BarChart2 },
];

const STYLE = `
  @keyframes tabPop {
    0%   { transform: scale(1) }
    40%  { transform: scale(1.18) }
    100% { transform: scale(1) }
  }
  @keyframes badgePop {
    0%   { transform: scale(0) }
    70%  { transform: scale(1.25) }
    100% { transform: scale(1) }
  }
  @keyframes pillSlide {
    from { opacity: 0; transform: scaleX(0.6); }
    to   { opacity: 1; transform: scaleX(1); }
  }
  .tab-btn {
    -webkit-tap-highlight-color: transparent;
    transition: color 0.2s ease;
  }
  .tab-btn:active .tab-icon-wrap {
    transform: scale(0.9);
  }
  .tab-icon-wrap {
    transition: transform 0.15s cubic-bezier(.34,1.56,.64,1);
  }
  .tab-btn.active .tab-icon-wrap {
    animation: tabPop 0.32s cubic-bezier(.34,1.56,.64,1) forwards;
  }
`;

export function TabBar({ activeTab, setActiveTab, pendingCount = 0 }) {
  return (
    <div style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 60,
    }}>
      <style>{STYLE}</style>

      {/* Frosted backdrop */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: `${C.surface}ee`,
        backdropFilter: "blur(20px) saturate(1.8)",
        WebkitBackdropFilter: "blur(20px) saturate(1.8)",
        borderTop: `1px solid ${C.border}`,
        boxShadow: "0 -1px 0 rgba(255,255,255,.04), 0 -12px 32px rgba(0,0,0,.18)",
      }} />

      <div style={{
        position: "relative",
        maxWidth: 640,
        margin: "0 auto",
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        padding: "10px 8px calc(10px + env(safe-area-inset-bottom, 0px)) 8px",
        gap: 4,
      }}>
        {tabs.map(tab => {
          const active = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              className={`tab-btn${active ? " active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                border: "none",
                background: "transparent",
                color: active ? C.text : C.textMuted,
                padding: "8px 6px",
                cursor: "pointer",
                minHeight: 54,
                position: "relative",
                outline: "none",
              }}
            >
              {/* Active indicator pill */}
              {active && (
                <div style={{
                  position: "absolute",
                  top: 0,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 28,
                  height: 3,
                  borderRadius: "0 0 3px 3px",
                  background: C.green,
                  boxShadow: `0 0 10px ${C.green}99`,
                  animation: "pillSlide .25s cubic-bezier(.34,1.56,.64,1)",
                }} />
              )}

              {/* Icon container */}
              <div
                className="tab-icon-wrap"
                style={{
                  position: "relative",
                  width: 40,
                  height: 34,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 10,
                  background: active
                    ? `linear-gradient(135deg, ${C.green}22, ${C.green}0a)`
                    : "transparent",
                  border: active
                    ? `1px solid ${C.green}33`
                    : "1px solid transparent",
                  transition: "background 0.2s ease, border-color 0.2s ease",
                }}
              >
                <Icon
                  size={17}
                  strokeWidth={active ? 2.4 : 1.8}
                  color={active ? C.green : C.textMuted}
                />

                {/* Badge */}
                {tab.id === "approvals" && pendingCount > 0 && (
                  <div style={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    background: C.red ?? "#EF4444",
                    color: "#fff",
                    borderRadius: 999,
                    fontSize: 8.5,
                    fontWeight: 900,
                    minWidth: 16,
                    height: 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 4px",
                    lineHeight: 1,
                    border: `1.5px solid ${C.surface}`,
                    boxShadow: "0 2px 6px rgba(239,68,68,.5)",
                    animation: "badgePop .3s cubic-bezier(.34,1.56,.64,1)",
                    fontFamily: "monospace",
                  }}>
                    {pendingCount > 99 ? "99+" : pendingCount}
                  </div>
                )}
              </div>

              {/* Label */}
              <span style={{
                fontSize: 10,
                fontWeight: active ? 800 : 600,
                letterSpacing: active ? ".02em" : ".01em",
                color: active ? C.text : C.textMuted,
                transition: "color 0.2s ease, font-weight 0.2s ease",
                fontFamily: "'Barlow Condensed', sans-serif",
                textTransform: "uppercase",
                lineHeight: 1,
              }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}