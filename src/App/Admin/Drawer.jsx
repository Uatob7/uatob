// src/App/UaTob/Admin/components/Drawer.jsx
import { Home, Car, Search, BarChart2, Shield, Settings, LogOut, X } from "lucide-react";
import { C } from '@/App/Admin/Tokens';
import { UaTobWordmark } from '@/App/Admin/Brand';

export function Drawer({ open, onClose }) {
  if (!open) return null;

  const links = [
    { icon: Home,      label: "Dashboard"  },
    { icon: Car,       label: "Fleet"      },
    { icon: Search,    label: "Riders"     },
    { icon: BarChart2, label: "Analytics"  },
    { icon: Shield,    label: "Compliance" },
    { icon: Settings,  label: "Settings"   },
  ];

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer">
        <div style={{ padding: "20px 20px 18px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, display: "flex" }}
            >
              <X size={20} />
            </button>
          </div>
          <UaTobWordmark iconSize={38} />
          <div style={{ marginTop: 6, fontSize: 10, color: C.textMuted, fontWeight: 700, letterSpacing: "1.3px" }}>
            ADMIN CONSOLE
          </div>
        </div>

        <div style={{ padding: "10px 10px", flex: 1 }}>
          {links.map(({ icon: Icon, label }) => (
            <button
              key={label}
              onClick={onClose}
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

        <div style={{ padding: "12px 10px", borderTop: `1px solid ${C.border}` }}>
          <button style={{
            width: "100%", display: "flex", alignItems: "center", gap: 12,
            padding: "12px 12px", borderRadius: 12, border: "none",
            background: "transparent", color: C.red, cursor: "pointer",
            fontFamily: "'Barlow',sans-serif", fontSize: 15, fontWeight: 600,
          }}>
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </div>
    </>
  );
}