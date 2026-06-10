import { Home, Car, Shield, BarChart2, MessageCircle } from "lucide-react";

const MONO = "'JetBrains Mono','SFMono-Regular',monospace";
const COND = "'Barlow Condensed','Barlow',sans-serif";
const GREEN      = "#4ADE80";
const GREEN_BG   = "rgba(74,222,128,.11)";
const GREEN_BDR  = "rgba(74,222,128,.24)";
const GREEN_GLOW = "rgba(74,222,128,.22)";
const INACTIVE   = "rgba(255,255,255,.28)";

const TABS = [
  { id: "home",      label: "Overview",  icon: Home          },
  { id: "drivers",   label: "Drivers",   icon: Car           },
  { id: "approvals", label: "Approvals", icon: Shield        },
  { id: "analytics", label: "Analytics", icon: BarChart2     },
  { id: "chat",      label: "Chat",      icon: MessageCircle },
];

const CSS = `
  @keyframes tbPillIn  { from{opacity:0;transform:translateX(-50%) scaleX(.4)} to{opacity:1;transform:translateX(-50%) scaleX(1)} }
  @keyframes tbIconPop { 0%{transform:scale(1)} 40%{transform:scale(1.22)} 100%{transform:scale(1)} }
  @keyframes tbBadgePop{ 0%{transform:scale(0)} 70%{transform:scale(1.3)} 100%{transform:scale(1)} }
  .adm-tab { -webkit-tap-highlight-color:transparent; transition:transform .1s; }
  .adm-tab:active { transform:scale(.88); }
  .adm-tab.active .adm-tab-icon { animation:tbIconPop .28s cubic-bezier(.34,1.56,.64,1); }
`;

export function TabBar({ activeTab, setActiveTab, pendingCount = 0, chatUnread = 0 }) {
  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 60 }}>
      <style>{CSS}</style>

      {/* frosted dark backdrop */}
      <div style={{
        position: "absolute", inset: 0,
        background: "rgba(5,10,6,.97)",
        backdropFilter: "blur(28px) saturate(1.4)",
        WebkitBackdropFilter: "blur(28px) saturate(1.4)",
        borderTop: "1px solid rgba(74,222,128,.13)",
        boxShadow: "0 -1px 0 rgba(74,222,128,.04), 0 -12px 48px rgba(0,0,0,.7)",
      }} />

      <div style={{
        position: "relative", maxWidth: 640, margin: "0 auto",
        display: "grid",
        gridTemplateColumns: `repeat(${TABS.length}, minmax(0,1fr))`,
        padding: `8px 4px calc(8px + env(safe-area-inset-bottom,0px)) 4px`,
        gap: 2,
      }}>
        {TABS.map(tab => {
          const active = activeTab === tab.id;
          const Icon   = tab.icon;
          const badge  =
            tab.id === "approvals" ? pendingCount :
            tab.id === "chat"      ? chatUnread   : 0;

          return (
            <button
              key={tab.id}
              className={`adm-tab${active ? " active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                gap: 4, border: "none", background: "transparent",
                padding: "6px 2px", cursor: "pointer",
                minHeight: 54, position: "relative", outline: "none",
              }}
            >
              {/* Top indicator pill */}
              {active && (
                <div style={{
                  position: "absolute", top: 0, left: "50%",
                  transform: "translateX(-50%)",
                  width: 26, height: 2.5, borderRadius: "0 0 4px 4px",
                  background: GREEN,
                  boxShadow: `0 0 10px ${GREEN}bb`,
                  animation: "tbPillIn .22s ease",
                }} />
              )}

              {/* Icon container */}
              <div
                className="adm-tab-icon"
                style={{
                  position: "relative",
                  width: 40, height: 32,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: 10,
                  background: active ? GREEN_BG : "transparent",
                  border: active ? `1px solid ${GREEN_BDR}` : "1px solid transparent",
                  boxShadow: active ? `0 0 14px ${GREEN_GLOW}` : "none",
                  transition: "all .2s ease",
                }}
              >
                <Icon
                  size={16}
                  strokeWidth={active ? 2.5 : 1.7}
                  color={active ? GREEN : INACTIVE}
                />

                {badge > 0 && (
                  <div style={{
                    position: "absolute", top: -5, right: -5,
                    background: "#EF4444", color: "#fff",
                    borderRadius: 999, fontSize: 8, fontWeight: 900,
                    minWidth: 16, height: 16,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    padding: "0 3px", lineHeight: 1,
                    border: "1.5px solid #050A06",
                    boxShadow: "0 2px 8px rgba(239,68,68,.55)",
                    fontFamily: MONO,
                    animation: "tbBadgePop .3s cubic-bezier(.34,1.56,.64,1)",
                  }}>
                    {badge > 99 ? "99+" : badge}
                  </div>
                )}
              </div>

              {/* Label */}
              <span style={{
                fontFamily: COND,
                fontSize: 9, fontWeight: active ? 900 : 700,
                letterSpacing: ".12em", textTransform: "uppercase", lineHeight: 1,
                color: active ? GREEN : INACTIVE,
                transition: "color .2s",
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
