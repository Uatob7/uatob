import { Menu, Bell, Eye, Zap } from "lucide-react";
import { UaTobIcon } from '@/App/Admin/Brand';

const COND = "'Barlow Condensed','Barlow',sans-serif";
const MONO = "'JetBrains Mono','SFMono-Regular',monospace";
const GREEN = "#4ADE80";

const CSS = `
  @keyframes topPulse { 0%,100%{opacity:1} 50%{opacity:.4} }
  .tb-menu-btn { transition:background .15s, border-color .15s; }
  .tb-menu-btn:hover { background:rgba(255,255,255,.09) !important; }
  .tb-bell-btn { transition:background .15s, border-color .15s; }
  .tb-bell-btn:hover { background:rgba(255,255,255,.09) !important; }
`;

export function TopBar({ title, onMenuOpen, views, supportUnread = 0, onBellClick }) {
  const viewCount = views?.length ?? 0;

  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 50,
      background: "#050A06",
      borderBottom: "1px solid rgba(74,222,128,.14)",
      padding: "0 16px",
      paddingTop: "max(14px, env(safe-area-inset-top))",
      paddingBottom: "14px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 12,
      boxShadow: "0 4px 32px rgba(0,0,0,.6), 0 1px 0 rgba(74,222,128,.06)",
    }}>
      <style>{CSS}</style>

      {/* Left — menu + logo + title */}
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <button
          className="tb-menu-btn"
          onClick={onMenuOpen}
          style={{
            width: 38, height: 38, borderRadius: 11,
            background: "rgba(255,255,255,.06)",
            border: "1px solid rgba(255,255,255,.08)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "rgba(255,255,255,.6)",
            flexShrink: 0,
          }}
        >
          <Menu size={18} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <UaTobIcon size={32} />
          <div>
            <div style={{
              fontFamily: COND, fontSize: 8, fontWeight: 900,
              color: "rgba(74,222,128,.65)", letterSpacing: "2px",
              lineHeight: 1, textTransform: "uppercase",
            }}>
              ADMIN PANEL
            </div>
            <div style={{
              fontFamily: COND, fontSize: 18, fontWeight: 900,
              color: "#fff", lineHeight: 1.1, marginTop: 2,
              letterSpacing: ".02em",
            }}>
              {title}
            </div>
          </div>
        </div>
      </div>

      {/* Right — live views + bell */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>

        {/* Live views pill */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "rgba(74,222,128,.07)",
          border: "1px solid rgba(74,222,128,.20)",
          borderRadius: 100, padding: "5px 12px",
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: "50%",
            background: GREEN,
            boxShadow: `0 0 7px ${GREEN}`,
            flexShrink: 0,
            animation: "topPulse 2s ease-in-out infinite",
          }} />
          <Eye size={11} color={GREEN} />
          <span style={{
            fontFamily: MONO, fontSize: 11, fontWeight: 700, color: GREEN,
          }}>
            {viewCount.toLocaleString()}
          </span>
        </div>

        {/* Bell button */}
        <div style={{ position: "relative" }}>
          <button
            className="tb-bell-btn"
            onClick={onBellClick}
            style={{
              width: 38, height: 38, borderRadius: 11,
              background: supportUnread > 0
                ? "rgba(248,113,113,.1)"
                : "rgba(255,255,255,.06)",
              border: `1px solid ${supportUnread > 0
                ? "rgba(248,113,113,.28)"
                : "rgba(255,255,255,.08)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Bell
              size={16}
              color={supportUnread > 0 ? "#F87171" : "rgba(255,255,255,.45)"}
            />
          </button>
          {supportUnread > 0 && (
            <div style={{
              position: "absolute", top: -5, right: -5,
              minWidth: 17, height: 17, borderRadius: 9,
              background: "#EF4444",
              border: "2px solid #050A06",
              color: "#fff", fontSize: 8.5, fontWeight: 900,
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "0 3.5px", lineHeight: 1,
              fontFamily: MONO,
              boxShadow: "0 2px 8px rgba(239,68,68,.5)",
            }}>
              {supportUnread > 99 ? "99+" : supportUnread}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
