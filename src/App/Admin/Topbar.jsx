// src/App/UaTob/Admin/components/TopBar.jsx
import { Menu, Bell, Eye } from "lucide-react";
import { C } from '@/App/Admin/Tokens';
import { UaTobIcon } from '@/App/Admin/Brand';

export function TopBar({ title, onMenuOpen, views, supportUnread = 0, onBellClick }) {
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(255,255,255,.94)",
        backdropFilter: "blur(14px)",
        borderBottom: `1px solid ${C.border}`,
        padding: "13px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        boxShadow: "0 1px 8px rgba(0,0,0,.06)",
      }}
    >
      {/* Left — menu + logo + title */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={onMenuOpen}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: C.text,
            display: "flex",
          }}
        >
          <Menu size={20} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <UaTobIcon size={32} />
          <div>
            <div
              className="condensed"
              style={{
                fontSize: 9,
                fontWeight: 800,
                color: C.textMuted,
                letterSpacing: "1.2px",
                lineHeight: 1,
              }}
            >
              ADMIN
            </div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 800,
                lineHeight: 1,
                marginTop: 1,
              }}
            >
              {title}
            </div>
          </div>
        </div>
      </div>

      {/* Right — views pill + bell */}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: C.greenGlow,
            border: `1.5px solid ${C.green}28`,
            borderRadius: 100,
            padding: "5px 12px",
          }}
        >
          <Eye size={13} color={C.green} />
          <span style={{ fontSize: 11, fontWeight: 800, color: C.green }}>
            {(views?.length ?? 0).toLocaleString()}
          </span>
        </div>

        <div style={{ position: "relative" }}>
          <button
            onClick={onBellClick}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: supportUnread > 0 ? C.redGlow : C.surface,
              border: `1px solid ${supportUnread > 0 ? "rgba(220,38,38,.25)" : C.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 1px 4px rgba(0,0,0,.05)",
            }}
          >
            <Bell size={15} color={supportUnread > 0 ? C.red : C.textMuted} />
          </button>

          {supportUnread > 0 && (
            <div style={{
              position: "absolute",
              top: -5,
              right: -5,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              background: C.red,
              border: `2px solid ${C.surface}`,
              color: "#fff",
              fontSize: 9,
              fontWeight: 800,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 3px",
              lineHeight: 1,
              fontFamily: "'Barlow', sans-serif",
            }}>
              {supportUnread > 99 ? "99+" : supportUnread}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}