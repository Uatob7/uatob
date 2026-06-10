import { useState, useMemo, useEffect, useRef } from "react";
import {
  ArrowLeft, Search, X, Eye, UserCheck, Trash2,
  AlertTriangle, Mail, Hash, Calendar, Shield, ChevronDown,
  Lock, Flag, FileText, Download, RotateCcw,
  CheckCircle, Clock, Ban, Users, Activity, Sparkles,
  MoreHorizontal, ChevronRight, MapPin, Inbox, BellRing,
  TrendingUp, Car, Star, Phone, Filter, SlidersHorizontal,
  ArrowUpRight, Zap, ChevronUp, RefreshCw, UserX, Circle,
  BarChart3, Route, DollarSign, Navigation, Info,
} from "lucide-react";

// ─── Design Tokens ─────────────────────────────────────────────────────────────
const C = {
  // Base
  canvas:      "#F6F5F2",
  surface:     "#FFFFFF",
  surfaceAlt:  "#FAFAF8",
  surfaceUp:   "#FFFFFF",

  // Borders
  line:        "rgba(0,0,0,.07)",
  lineMid:     "rgba(0,0,0,.11)",
  lineStrong:  "rgba(0,0,0,.18)",

  // Ink scale
  ink:         "#0D0D0D",
  ink2:        "#1C1C1E",
  ink3:        "#3C3C3F",
  ink4:        "#6E6E73",
  ink5:        "#AEAEB2",
  ink6:        "#D1D1D6",

  // Brand — deep navy + warm accents
  navy:        "#0A1628",
  navyMid:     "#112240",
  navyLight:   "#1B3A6B",
  navyTint:    "#EBF0FA",
  navyGlow:    "rgba(10,22,40,.08)",

  // Semantic
  emerald:     "#059669",
  emeraldSoft: "#D1FAE5",
  emeraldBg:   "#ECFDF5",

  sapphire:    "#2563EB",
  sapphireSoft:"#DBEAFE",
  sapphireBg:  "#EFF6FF",

  amber:       "#B45309",
  amberSoft:   "#FDE68A",
  amberBg:     "#FFFBEB",

  rose:        "#DC2626",
  roseSoft:    "#FEE2E2",
  roseBg:      "#FEF2F2",

  plum:        "#7C3AED",
  plumSoft:    "#EDE9FE",
  plumBg:      "#F5F3FF",

  // Shadows
  shadowXs:    "0 1px 2px rgba(0,0,0,.04)",
  shadowSm:    "0 1px 3px rgba(0,0,0,.05), 0 4px 12px rgba(0,0,0,.04)",
  shadowMd:    "0 2px 6px rgba(0,0,0,.06), 0 8px 24px rgba(0,0,0,.06)",
  shadowLg:    "0 8px 32px rgba(0,0,0,.10), 0 2px 8px rgba(0,0,0,.06)",
  shadowXl:    "0 20px 60px rgba(0,0,0,.14), 0 4px 16px rgba(0,0,0,.08)",
};

const T = {
  display:  "'Playfair Display', Georgia, serif",
  sans:     "'DM Sans', system-ui, sans-serif",
  mono:     "'IBM Plex Mono', 'Courier New', monospace",
  label:    "'DM Sans', system-ui, sans-serif",
};

// ─── Utilities ─────────────────────────────────────────────────────────────────
function fmtDate(ts) {
  if (!ts) return "—";
  const d = ts?.toDate?.() ?? (ts?.seconds ? new Date(ts.seconds * 1000) : new Date(ts));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtRelative(ts) {
  if (!ts) return "—";
  const d = ts?.toDate?.() ?? (ts?.seconds ? new Date(ts.seconds * 1000) : new Date(ts));
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800)return `${Math.floor(diff / 86400)}d ago`;
  return fmtDate(ts);
}

function initials(name) {
  return (name || "?").trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

const PALETTE = [
  ["#E0F2FE","#0369A1"], ["#D1FAE5","#065F46"], ["#FEF3C7","#92400E"],
  ["#EDE9FE","#5B21B6"], ["#FCE7F3","#9D174D"], ["#DBEAFE","#1E40AF"],
  ["#F0FDF4","#14532D"], ["#FFF7ED","#9A3412"],
];
function avatarColor(name) {
  return PALETTE[(name || "?").charCodeAt(0) % PALETTE.length];
}

function riderTotalFare(uid, rides) {
  return rides
    .filter(r => r.uid === uid)
    .reduce((s, r) => s + parseFloat(r.fareBreakdown?.fareTotal || 0), 0);
}

// ─── CSS Injection ─────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400&family=Playfair+Display:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

  * { box-sizing: border-box; }

  @keyframes slideUp {
    from { opacity:0; transform:translateY(14px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes slideInRight {
    from { opacity:0; transform:translateX(100%); }
    to   { opacity:1; transform:translateX(0); }
  }
  @keyframes slideInUp {
    from { opacity:0; transform:translateY(100%); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes fadeIn {
    from { opacity:0; }
    to   { opacity:1; }
  }
  @keyframes scaleIn {
    from { opacity:0; transform:scale(.96) translateY(4px); }
    to   { opacity:1; transform:scale(1)   translateY(0); }
  }
  @keyframes pulse {
    0%,100% { opacity:1; transform:scale(1); }
    50%      { opacity:.6; transform:scale(.92); }
  }
  @keyframes shimmer {
    from { background-position: -400px 0; }
    to   { background-position:  400px 0; }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes rowIn {
    from { opacity:0; transform:translateX(-8px); }
    to   { opacity:1; transform:translateX(0); }
  }
  @keyframes countUp {
    from { opacity:0; transform:translateY(6px); }
    to   { opacity:1; transform:translateY(0); }
  }

  .rider-row {
    transition: border-color .18s, box-shadow .18s, background .18s;
  }
  .rider-row:hover {
    border-color: ${C.lineMid} !important;
    box-shadow: ${C.shadowMd} !important;
    background: ${C.surface} !important;
  }
  .action-btn {
    transition: all .16s;
  }
  .action-btn:hover {
    background: ${C.canvas} !important;
    border-color: ${C.lineStrong} !important;
  }
  .menu-item {
    transition: background .13s;
  }
  .menu-item:hover {
    background: ${C.surfaceAlt} !important;
  }
  .stat-card {
    transition: border-color .18s, box-shadow .18s, transform .2s;
  }
  .stat-card:hover {
    border-color: ${C.lineMid} !important;
    box-shadow: ${C.shadowMd} !important;
    transform: translateY(-1px);
  }
  .filter-chip {
    transition: all .15s;
  }
  .filter-chip:hover {
    border-color: ${C.navy} !important;
  }
  .close-btn {
    transition: all .15s;
  }
  .close-btn:hover {
    background: ${C.canvas} !important;
  }
  .drawer-action-btn {
    transition: all .15s;
  }
  .drawer-action-btn:hover {
    background: ${C.canvas} !important;
    border-color: ${C.lineStrong} !important;
  }
  .confirm-btn-cancel:hover {
    background: ${C.canvas} !important;
  }
  .scrollbar-thin::-webkit-scrollbar { width: 4px; }
  .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
  .scrollbar-thin::-webkit-scrollbar-thumb { background: ${C.ink6}; border-radius: 99px; }
  .ride-row {
    transition: all .18s;
  }
  .ride-row:hover {
    border-color: ${C.lineMid} !important;
    background: ${C.surface} !important;
    box-shadow: ${C.shadowSm} !important;
  }
  .search-wrap:focus-within {
    border-color: ${C.navy} !important;
    box-shadow: 0 0 0 3px ${C.navyGlow} !important;
  }
`;

// ─── Avatar ─────────────────────────────────────────────────────────────────────
function Avatar({ name, size = 44, photo }) {
  const [bg, fg] = avatarColor(name);
  if (photo) {
    return (
      <div style={{
        width: size, height: size,
        borderRadius: size > 50 ? 16 : 12,
        overflow: "hidden", flexShrink: 0,
        border: `1.5px solid ${fg}22`,
        background: bg,
      }}>
        <img src={photo} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={e => { e.currentTarget.style.display = "none"; }}/>
      </div>
    );
  }
  return (
    <div style={{
      width: size, height: size,
      borderRadius: size > 50 ? 16 : 12,
      background: bg,
      color: fg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: T.sans, fontWeight: 800,
      fontSize: size * 0.32,
      flexShrink: 0, userSelect: "none",
      letterSpacing: "-.02em",
      border: `1.5px solid ${fg}22`,
    }}>
      {initials(name)}
    </div>
  );
}

// ─── Status Badge ───────────────────────────────────────────────────────────────
function StatusBadge({ status, size = "md" }) {
  const map = {
    active:    { label: "Active",    bg: C.emeraldBg, border: C.emeraldSoft, color: C.emerald },
    suspended: { label: "Suspended", bg: C.amberBg,   border: C.amberSoft,   color: C.amber },
    banned:    { label: "Banned",    bg: C.roseBg,    border: C.roseSoft,    color: C.rose },
  };
  const s = map[status] || map.active;
  const pad = size === "sm" ? "2px 7px" : "3px 9px";
  const fs  = size === "sm" ? 10 : 11;

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: pad,
      borderRadius: 6,
      background: s.bg,
      border: `1px solid ${s.border}`,
      color: s.color,
      fontFamily: T.sans,
      fontSize: fs,
      fontWeight: 700,
      letterSpacing: ".02em",
    }}>
      <span style={{
        width: 4.5, height: 4.5, borderRadius: "50%",
        background: s.color,
        animation: status === "active" ? "pulse 2.4s ease-in-out infinite" : "none",
        display: "inline-block",
      }} />
      {s.label}
    </span>
  );
}

// ─── Skeleton Loader ────────────────────────────────────────────────────────────
function Skeleton({ w = "100%", h = 14, r = 6 }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: `linear-gradient(90deg, ${C.canvas} 25%, ${C.ink6}55 50%, ${C.canvas} 75%)`,
      backgroundSize: "400px 100%",
      animation: "shimmer 1.4s linear infinite",
    }} />
  );
}

// ─── Divider ────────────────────────────────────────────────────────────────────
function Divider({ my = 0 }) {
  return <div style={{ height: 1, background: C.line, margin: `${my}px 0` }} />;
}

// ─── Stat Card ──────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color, sub, trend, delay = 0 }) {
  return (
    <div
      className="stat-card"
      style={{
        background: C.surface,
        border: `1px solid ${C.line}`,
        borderRadius: 16,
        padding: "18px 16px",
        position: "relative",
        overflow: "hidden",
        animation: `slideUp .4s cubic-bezier(.22,1,.36,1) ${delay}ms both`,
        cursor: "default",
      }}
    >
      {/* Top accent stripe */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, ${color}, ${color}88)`,
        borderRadius: "16px 16px 0 0",
      }} />

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: color + "14",
          border: `1px solid ${color}22`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color,
        }}>
          {icon}
        </div>
        {trend != null && (
          <div style={{
            display: "flex", alignItems: "center", gap: 3,
            padding: "3px 7px", borderRadius: 20,
            background: trend >= 0 ? C.emeraldBg : C.roseBg,
            color: trend >= 0 ? C.emerald : C.rose,
            fontFamily: T.mono, fontSize: 10, fontWeight: 600,
          }}>
            {trend >= 0 ? <ArrowUpRight size={10} /> : <ChevronDown size={10} />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>

      <div style={{
        fontFamily: T.display, fontSize: 28, fontWeight: 700,
        color: C.ink, letterSpacing: "-.02em", lineHeight: 1,
        marginBottom: 5,
        animation: `countUp .5s ease ${delay + 100}ms both`,
      }}>
        {value}
      </div>
      <div style={{ fontFamily: T.sans, fontSize: 11.5, color: C.ink4, fontWeight: 500, letterSpacing: ".01em" }}>
        {label}
      </div>
      {sub && (
        <div style={{ fontFamily: T.sans, fontSize: 10.5, color: C.ink5, marginTop: 3 }}>{sub}</div>
      )}
    </div>
  );
}

// ─── Pill Filter ─────────────────────────────────────────────────────────────────
function FilterPill({ label, count, active, onClick, color }) {
  return (
    <button
      className="filter-chip"
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "6px 13px",
        borderRadius: 99,
        border: `1.5px solid ${active ? C.navy : C.line}`,
        background: active ? C.navy : C.surface,
        color: active ? "#fff" : C.ink3,
        fontFamily: T.sans,
        fontSize: 12.5,
        fontWeight: active ? 700 : 500,
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "all .15s",
      }}
    >
      {label}
      <span style={{
        minWidth: 18, height: 18,
        borderRadius: 9,
        background: active ? "rgba(255,255,255,.2)" : C.canvas,
        color: active ? "#fff" : C.ink4,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: T.mono,
        fontSize: 10,
        fontWeight: 700,
      }}>
        {count}
      </span>
    </button>
  );
}

// ─── Inline Tag ─────────────────────────────────────────────────────────────────
function Tag({ icon, label, color = C.ink4, bg = C.canvas }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 7px", borderRadius: 5,
      background: bg, color,
      fontFamily: T.sans, fontSize: 10.5, fontWeight: 600,
    }}>
      {icon && <span style={{ display: "flex" }}>{icon}</span>}
      {label}
    </span>
  );
}

// ─── Section Header ─────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div style={{
      fontFamily: T.sans, fontSize: 10, fontWeight: 800,
      color: C.ink5, letterSpacing: ".1em",
      textTransform: "uppercase",
      marginBottom: 8,
    }}>
      {children}
    </div>
  );
}

// ─── Info Row ────────────────────────────────────────────────────────────────────
function InfoRow({ icon, label, value, mono = false, valueColor, last = false }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10,
      padding: "11px 14px",
      borderBottom: last ? "none" : `1px solid ${C.line}`,
    }}>
      <div style={{ color: C.ink5, marginTop: 1, flexShrink: 0, width: 14, display: "flex", justifyContent: "center" }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: T.sans, fontSize: 10, fontWeight: 700,
          color: C.ink5, textTransform: "uppercase", letterSpacing: ".07em",
          marginBottom: 3,
        }}>
          {label}
        </div>
        <div style={{
          fontFamily: mono ? T.mono : T.sans,
          fontSize: mono ? 10.5 : 12.5,
          color: valueColor || C.ink2,
          fontWeight: 500,
          wordBreak: "break-all",
          lineHeight: 1.4,
        }}>
          {value || "—"}
        </div>
      </div>
    </div>
  );
}

// ─── Actions Catalogue ───────────────────────────────────────────────────────────
const ACTIONS = [
  {
    id: "view",      label: "View Profile",        icon: <Eye size={15} />,
    color: C.sapphire, bg: C.sapphireBg, group: "info",
    desc: "Full rider details & notes",
  },
  {
    id: "history",   label: "Ride History",        icon: <Route size={15} />,
    color: C.sapphire, bg: C.sapphireBg, group: "info",
    desc: "All trips, fares & routes",
  },
  {
    id: "email",     label: "Send Email",          icon: <Mail size={15} />,
    color: C.plum, bg: C.plumBg, group: "comms",
    desc: "Compose message to rider",
  },
  {
    id: "note",      label: "Add Admin Note",      icon: <FileText size={15} />,
    color: C.plum, bg: C.plumBg, group: "comms",
    desc: "Internal note — not visible to rider",
  },
  {
    id: "reset",     label: "Send Password Reset", icon: <Lock size={15} />,
    color: C.amber, bg: C.amberBg, group: "account",
    desc: "Email a reset link",
  },
  {
    id: "verify",    label: "Mark as Verified",    icon: <CheckCircle size={15} />,
    color: C.emerald, bg: C.emeraldBg, group: "account",
    desc: "Manually verify email address",
  },
  {
    id: "export",    label: "Export Data",         icon: <Download size={15} />,
    color: C.amber, bg: C.amberBg, group: "account",
    desc: "GDPR export (JSON)",
  },
  {
    id: "flag",      label: "Flag for Review",     icon: <Flag size={15} />,
    color: C.amber, bg: C.amberBg, group: "mod",
    desc: "Escalate to senior admin",
  },
  {
    id: "suspend",   label: "Suspend Account",     icon: <AlertTriangle size={15} />,
    color: C.amber, bg: C.amberBg, group: "mod",
    desc: "Temporary access removal",
  },
  {
    id: "reinstate", label: "Reinstate Access",    icon: <UserCheck size={15} />,
    color: C.emerald, bg: C.emeraldBg, group: "mod",
    desc: "Restore full platform access",
  },
  {
    id: "ban",       label: "Ban Permanently",     icon: <Ban size={15} />,
    color: C.rose, bg: C.roseBg, group: "mod",
    desc: "Permanent platform block",
  },
  {
    id: "delete",    label: "Delete Account",      icon: <Trash2 size={15} />,
    color: C.rose, bg: C.roseBg, group: "mod",
    desc: "Erase all data — irreversible",
  },
];

const ACTION_GROUPS = [
  { key: "info",    label: "Information"   },
  { key: "comms",   label: "Communication" },
  { key: "account", label: "Account"       },
  { key: "mod",     label: "Moderation"    },
];

// ─── Bottom Sheet Actions Menu ───────────────────────────────────────────────────
function ActionsMenu({ rider, onClose, onAction }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 800,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        background: "rgba(0,0,0,.42)",
        backdropFilter: "blur(8px)",
        animation: "fadeIn .2s ease",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: C.surface,
          borderRadius: "24px 24px 0 0",
          width: "100%", maxWidth: 540,
          maxHeight: "92vh",
          overflow: "hidden",
          display: "flex", flexDirection: "column",
          boxShadow: "0 -20px 60px rgba(0,0,0,.16)",
          animation: "slideInUp .26s cubic-bezier(.22,1,.36,1)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag pill */}
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: C.line }} />
        </div>

        {/* Rider header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 14,
          padding: "16px 22px 18px",
          borderBottom: `1px solid ${C.line}`,
          background: "linear-gradient(135deg, #F8F8F6 0%, #FFFFFF 100%)",
        }}>
          <Avatar name={rider.name} size={50} photo={rider.photoURL || null} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: T.sans, fontWeight: 800, fontSize: 16,
              color: C.ink, letterSpacing: "-.02em", marginBottom: 4,
            }}>
              {rider.name || "—"}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <StatusBadge status={rider.status} size="sm" />
              <span style={{ fontFamily: T.sans, fontSize: 12, color: C.ink4, fontWeight: 500 }}>
                {rider.email}
              </span>
            </div>
          </div>
          <button
            className="close-btn"
            onClick={onClose}
            style={{
              width: 34, height: 34,
              borderRadius: 10,
              background: C.canvas,
              border: `1px solid ${C.line}`,
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: C.ink4,
              flexShrink: 0,
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Actions list */}
        <div
          className="scrollbar-thin"
          style={{ overflowY: "auto", padding: "6px 14px 34px" }}
        >
          {ACTION_GROUPS.map(grp => {
            const items = ACTIONS.filter(a => {
              if (a.group !== grp.key) return false;
              if (a.id === "reinstate") return rider.status === "suspended" || rider.status === "banned";
              if (a.id === "suspend")   return rider.status === "active";
              if (a.id === "ban")       return rider.status !== "banned";
              return true;
            });
            if (!items.length) return null;
            return (
              <div key={grp.key} style={{ marginBottom: 4 }}>
                <div style={{
                  fontFamily: T.sans, fontSize: 10, fontWeight: 800,
                  color: C.ink5, textTransform: "uppercase", letterSpacing: ".1em",
                  padding: "16px 8px 8px",
                }}>
                  {grp.label}
                </div>
                <div style={{
                  background: C.canvas,
                  border: `1px solid ${C.line}`,
                  borderRadius: 14,
                  overflow: "hidden",
                }}>
                  {items.map((a, idx, arr) => (
                    <button
                      key={a.id}
                      className="menu-item"
                      onClick={() => { onClose(); onAction(a.id, rider); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 13,
                        width: "100%", padding: "12px 14px",
                        borderBottom: idx < arr.length - 1 ? `1px solid ${C.line}` : "none",
                        border: "none", background: "transparent",
                        cursor: "pointer", textAlign: "left",
                      }}
                    >
                      <div style={{
                        width: 40, height: 40, borderRadius: 12,
                        background: a.bg,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: a.color, flexShrink: 0,
                        border: `1px solid ${a.color}18`,
                      }}>
                        {a.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontFamily: T.sans, fontWeight: 700, fontSize: 14,
                          color: (a.id === "delete" || a.id === "ban") ? C.rose : C.ink,
                          marginBottom: 2,
                        }}>
                          {a.label}
                        </div>
                        <div style={{ fontFamily: T.sans, fontSize: 12, color: C.ink4 }}>
                          {a.desc}
                        </div>
                      </div>
                      <ChevronRight size={14} color={C.ink6} />
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Confirm Modal ───────────────────────────────────────────────────────────────
function ConfirmModal({ action, rider, note, setNote, onConfirm, onCancel }) {
  const cfg = {
    suspend:   { icon: <AlertTriangle size={20} />, title: "Suspend Rider",    body: `${rider?.name} will lose app access until you reinstate them.`,   btn: "Suspend",         bc: C.amber, danger: false },
    ban:       { icon: <Ban size={20} />,           title: "Ban Permanently",  body: `${rider?.name} will be permanently blocked from UaTob.`,          btn: "Ban Permanently", bc: C.rose,  danger: true },
    delete:    { icon: <Trash2 size={20} />,        title: "Delete Account",   body: `All data for ${rider?.name} will be permanently erased.`,         btn: "Delete Account",  bc: C.rose,  danger: true },
    reinstate: { icon: <UserCheck size={20} />,     title: "Reinstate Access", body: `${rider?.name} will regain full platform access.`,                btn: "Reinstate",       bc: C.emerald, danger: false },
    flag:      { icon: <Flag size={20} />,          title: "Flag for Review",  body: "Add an optional note for the reviewing admin.",                   btn: "Flag Rider",      bc: C.amber, danger: false, note: true },
    note:      { icon: <FileText size={20} />,      title: "Admin Note",       body: "Internal only — not visible to the rider.",                       btn: "Save Note",       bc: C.navy,  danger: false, note: true },
  }[action];

  if (!cfg) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,.48)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 900, backdropFilter: "blur(8px)",
        padding: 20,
        animation: "fadeIn .16s ease",
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: C.surface, borderRadius: 22,
          padding: 28, maxWidth: 400, width: "100%",
          boxShadow: C.shadowXl,
          animation: "scaleIn .22s cubic-bezier(.22,1,.36,1)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Icon + Title */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 13,
            background: cfg.bc + "14",
            border: `1.5px solid ${cfg.bc}28`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: cfg.bc,
          }}>
            {cfg.icon}
          </div>
          <div>
            <div style={{ fontFamily: T.sans, fontWeight: 800, fontSize: 17, color: C.ink, letterSpacing: "-.02em" }}>
              {cfg.title}
            </div>
            {rider && (
              <div style={{ fontFamily: T.sans, fontSize: 12, color: C.ink4, marginTop: 2, fontWeight: 500 }}>
                {rider.name}
              </div>
            )}
          </div>
        </div>

        <Divider my={4} />

        <p style={{ fontFamily: T.sans, fontSize: 13.5, color: C.ink3, lineHeight: 1.65, margin: "14px 0 18px", fontWeight: 400 }}>
          {cfg.body}
        </p>

        {cfg.note && (
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Write a note…"
            rows={3}
            style={{
              width: "100%",
              background: C.canvas,
              border: `1px solid ${C.lineMid}`,
              borderRadius: 12,
              padding: "11px 13px",
              fontFamily: T.sans, fontSize: 13, color: C.ink,
              resize: "none", outline: "none",
              marginBottom: 18,
              transition: "border-color .15s",
            }}
          />
        )}

        {cfg.danger && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 13px",
            background: C.roseBg,
            border: `1px solid ${C.roseSoft}`,
            borderRadius: 10,
            marginBottom: 18,
          }}>
            <AlertTriangle size={13} color={C.rose} />
            <span style={{ fontFamily: T.sans, fontSize: 12, color: C.rose, fontWeight: 600 }}>
              This action cannot be undone.
            </span>
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="confirm-btn-cancel"
            onClick={onCancel}
            style={{
              flex: 1, padding: "12px 0", borderRadius: 12,
              border: `1px solid ${C.lineMid}`,
              background: C.surface, color: C.ink2,
              fontFamily: T.sans, fontWeight: 700, fontSize: 13.5,
              cursor: "pointer", transition: "background .15s",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: "12px 0", borderRadius: 12,
              border: "none",
              background: cfg.bc, color: "#fff",
              fontFamily: T.sans, fontWeight: 800, fontSize: 13.5,
              cursor: "pointer",
              boxShadow: `0 2px 12px ${cfg.bc}44`,
            }}
          >
            {cfg.btn}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Rider Detail Drawer ─────────────────────────────────────────────────────────
function RiderDrawer({ rider, rides = [], onClose, onAction }) {
  if (!rider) return null;

  const riderRides = useMemo(() => {
    const uid = rider.uid || rider.id;
    return rides.filter(r => r.uid === uid);
  }, [rider, rides]);

  const totalFare = riderRides.reduce((s, r) => s + parseFloat(r.fareBreakdown?.fareTotal || 0), 0);
  const totalDist = riderRides.reduce((s, r) => s + parseFloat(r.tripDistanceMiles || 0), 0);
  const completedRides = riderRides.filter(r => r.status === "completed").length;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 700,
        display: "flex", justifyContent: "flex-end",
        background: "rgba(0,0,0,.36)",
        backdropFilter: "blur(6px)",
        animation: "fadeIn .2s ease",
      }}
      onClick={onClose}
    >
      <div
        className="scrollbar-thin"
        style={{
          width: 360, background: C.surface, height: "100%",
          borderLeft: `1px solid ${C.line}`,
          display: "flex", flexDirection: "column",
          overflow: "hidden",
          boxShadow: "-12px 0 40px rgba(0,0,0,.10)",
          animation: "slideInRight .26s cubic-bezier(.22,1,.36,1)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Hero Header */}
        <div style={{
          background: `linear-gradient(160deg, ${C.navy} 0%, ${C.navyLight} 100%)`,
          padding: "22px 22px 24px",
          position: "relative", overflow: "hidden",
          flexShrink: 0,
        }}>
          {/* Decorative circles */}
          <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,.04)" }} />
          <div style={{ position: "absolute", bottom: -20, left: -20, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,.03)" }} />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18, position: "relative" }}>
            <div style={{
              fontFamily: T.sans, fontSize: 10, fontWeight: 800,
              color: "rgba(255,255,255,.4)", letterSpacing: ".1em", textTransform: "uppercase",
            }}>
              {rider.isDriver ? "Driver Account" : "Rider Profile"}
            </div>
            <button
              className="close-btn"
              onClick={onClose}
              style={{
                background: "rgba(255,255,255,.1)",
                border: "1px solid rgba(255,255,255,.15)",
                borderRadius: 8, padding: 7,
                cursor: "pointer",
                color: "rgba(255,255,255,.7)",
                display: "flex",
              }}
            >
              <X size={14} />
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, position: "relative" }}>
            <Avatar name={rider.name} size={58} photo={rider.photoURL || null} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 20, color: "#fff", letterSpacing: "-.02em", lineHeight: 1.2, marginBottom: 8 }}>
                {rider.name || "—"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {rider.isDriver
                  ? <Tag icon={<Car size={9} />} label="Driver" color="#60A5FA" bg="rgba(96,165,250,.18)" />
                  : <StatusBadge status={rider.status} />
                }
                {rider.isOrphaned && !rider.isDriver && (
                  <Tag icon={<AlertTriangle size={9} />} label="No Account Doc" color="#FCA5A5" bg="rgba(239,68,68,.18)" />
                )}
                {rider.adminNote && <Tag icon={<Flag size={9} />} label="Flagged" color={C.amber} bg={C.amberBg} />}
              </div>
            </div>
          </div>

          {/* Mini stats row */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
            gap: 8, marginTop: 18,
            position: "relative",
          }}>
            {[
              { val: riderRides.length, label: "Rides" },
              { val: `$${totalFare.toFixed(0)}`, label: "Total Spent" },
              { val: `${totalDist.toFixed(0)} mi`, label: "Distance" },
            ].map(s => (
              <div key={s.label} style={{
                background: "rgba(255,255,255,.07)",
                border: "1px solid rgba(255,255,255,.10)",
                borderRadius: 10, padding: "9px 10px",
                textAlign: "center",
              }}>
                <div style={{ fontFamily: T.mono, fontWeight: 700, fontSize: 14, color: "#fff", letterSpacing: "-.01em" }}>
                  {s.val}
                </div>
                <div style={{ fontFamily: T.sans, fontSize: 9.5, color: "rgba(255,255,255,.45)", marginTop: 2, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em" }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Account Details */}
        <div className="scrollbar-thin" style={{ flex: 1, overflowY: "auto", padding: "20px 18px" }}>
          <SectionLabel>Account Details</SectionLabel>
          <div style={{
            background: C.canvas,
            border: `1px solid ${C.line}`,
            borderRadius: 14,
            overflow: "hidden",
            marginBottom: 18,
          }}>
            <InfoRow icon={<Mail size={13} />}     label="Email"       value={rider.email} />
            <InfoRow icon={<Hash size={13} />}      label="User ID"     value={rider.uid}   mono />
            <InfoRow icon={<Calendar size={13} />}  label="Joined"      value={fmtDate(rider.createdAt)} />
            <InfoRow icon={<Clock size={13} />}     label="Last Active" value={fmtRelative(rider.updatedAt)} />
            <InfoRow icon={<Shield size={13} />}    label="Email Verified" value={rider.welcomeEmailSent ? "Verified" : "Not verified"} valueColor={rider.welcomeEmailSent ? C.emerald : C.amber} />
            <InfoRow icon={<BellRing size={13} />}  label="Admin Notified" value={rider.adminNotified ? "Yes" : "No"} valueColor={rider.adminNotified ? C.emerald : C.ink4} last />
          </div>

          {/* Admin note */}
          {rider.adminNote && (
            <>
              <SectionLabel>Admin Note</SectionLabel>
              <div style={{
                background: C.amberBg,
                border: `1px solid ${C.amberSoft}`,
                borderRadius: 12,
                padding: "13px 15px",
                marginBottom: 18,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <Flag size={11} color={C.amber} />
                  <span style={{ fontFamily: T.sans, fontSize: 10, fontWeight: 800, color: C.amber, letterSpacing: ".06em", textTransform: "uppercase" }}>Flagged for Review</span>
                </div>
                <p style={{ fontFamily: T.sans, fontSize: 13, color: C.ink2, lineHeight: 1.6, margin: 0 }}>
                  {rider.adminNote}
                </p>
              </div>
            </>
          )}

          {/* Recent rides preview */}
          {riderRides.length > 0 && (
            <>
              <SectionLabel>Recent Rides</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
                {riderRides.slice(0, 3).map((ride, i) => (
                  <div key={ride.id || i} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px",
                    background: C.canvas,
                    border: `1px solid ${C.line}`,
                    borderRadius: 10,
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                      background: ride.status === "completed" ? C.emerald : ride.status === "cancelled" ? C.rose : C.amber,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {ride.pickupCity || "—"} → {ride.dropoffCity || "—"}
                      </div>
                      <div style={{ fontFamily: T.mono, fontSize: 10.5, color: C.ink4, marginTop: 1 }}>
                        {fmtDate(ride.createdAt)}
                      </div>
                    </div>
                    <div style={{ fontFamily: T.mono, fontSize: 12, fontWeight: 700, color: C.emerald, flexShrink: 0 }}>
                      ${parseFloat(ride.fareBreakdown?.fareTotal || 0).toFixed(2)}
                    </div>
                  </div>
                ))}
                {riderRides.length > 3 && (
                  <button
                    onClick={() => onAction("history", rider)}
                    style={{
                      background: "none", border: `1px dashed ${C.lineMid}`,
                      borderRadius: 10, padding: "9px 12px",
                      cursor: "pointer", color: C.sapphire,
                      fontFamily: T.sans, fontSize: 12.5, fontWeight: 600,
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                    }}
                  >
                    <Route size={13} /> View all {riderRides.length} rides
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 18px",
          borderTop: `1px solid ${C.line}`,
          background: C.surfaceAlt,
          display: "flex", gap: 8,
          flexShrink: 0,
        }}>
          <button
            className="drawer-action-btn"
            onClick={() => onAction("note", rider)}
            style={{
              flex: 1, padding: "11px 0", borderRadius: 12,
              border: `1px solid ${C.lineMid}`,
              background: C.surface, color: C.ink3,
              fontFamily: T.sans, fontWeight: 700, fontSize: 12.5,
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <FileText size={13} /> Note
          </button>
          <button
            onClick={() => { onClose(); onAction("open-menu", rider); }}
            style={{
              flex: 2, padding: "11px 0", borderRadius: 12,
              border: "none",
              background: C.navy, color: "#fff",
              fontFamily: T.sans, fontWeight: 800, fontSize: 12.5,
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              boxShadow: `0 2px 12px ${C.navy}44`,
            }}
          >
            <MoreHorizontal size={13} /> All Actions
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Ride History Modal ──────────────────────────────────────────────────────────
function RideHistoryModal({ rider, rides, onClose }) {
  const totalFare = rides.reduce((s, r) => s + parseFloat(r.fareBreakdown?.fareTotal || 0), 0);
  const totalDist = rides.reduce((s, r) => s + parseFloat(r.tripDistanceMiles || 0), 0);
  const completed = rides.filter(r => r.status === "completed").length;

  const statusMap = {
    completed:   { bg: C.emeraldBg, color: C.emerald,  label: "Completed"   },
    cancelled:   { bg: C.roseBg,    color: C.rose,     label: "Cancelled"   },
    in_progress: { bg: C.sapphireBg,color: C.sapphire, label: "In Progress" },
    pending:     { bg: C.amberBg,   color: C.amber,    label: "Pending"     },
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 900,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,.50)",
        backdropFilter: "blur(8px)",
        padding: "20px 16px",
        animation: "fadeIn .18s ease",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: C.surface,
          borderRadius: 24,
          maxWidth: 600, width: "100%",
          maxHeight: "90vh",
          display: "flex", flexDirection: "column",
          boxShadow: C.shadowXl,
          overflow: "hidden",
          animation: "scaleIn .24s cubic-bezier(.22,1,.36,1)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          background: `linear-gradient(160deg, ${C.navy} 0%, ${C.navyLight} 100%)`,
          padding: "22px 24px",
          position: "relative", overflow: "hidden",
          flexShrink: 0,
        }}>
          <div style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,.04)" }} />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, position: "relative" }}>
            <div>
              <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 22, color: "#fff", letterSpacing: "-.02em", marginBottom: 4 }}>
                Ride History
              </div>
              <div style={{ fontFamily: T.sans, fontSize: 13, color: "rgba(255,255,255,.55)", fontWeight: 500 }}>
                {rider.name} · {rides.length} ride{rides.length !== 1 ? "s" : ""}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: "rgba(255,255,255,.1)",
                border: "1px solid rgba(255,255,255,.15)",
                borderRadius: 10, padding: 8,
                cursor: "pointer", color: "rgba(255,255,255,.7)", display: "flex",
              }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Summary chips */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", position: "relative" }}>
            {[
              { icon: <CheckCircle size={11} />, label: `${completed} completed` },
              { icon: <DollarSign size={11} />,  label: `$${totalFare.toFixed(2)} total` },
              { icon: <Route size={11} />,        label: `${totalDist.toFixed(1)} mi` },
            ].map(chip => (
              <div key={chip.label} style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 10px",
                background: "rgba(255,255,255,.1)",
                border: "1px solid rgba(255,255,255,.15)",
                borderRadius: 99,
                fontFamily: T.sans, fontSize: 11.5,
                color: "rgba(255,255,255,.8)", fontWeight: 600,
              }}>
                {chip.icon} {chip.label}
              </div>
            ))}
          </div>
        </div>

        {/* Empty state */}
        {rides.length === 0 && (
          <div style={{ padding: "64px 32px", textAlign: "center", flex: 1 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 18,
              background: C.canvas,
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px",
            }}>
              <Inbox size={28} color={C.ink5} />
            </div>
            <div style={{ fontFamily: T.sans, fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 6 }}>No rides yet</div>
            <div style={{ fontFamily: T.sans, fontSize: 13, color: C.ink4 }}>{rider.name} hasn't completed any rides.</div>
          </div>
        )}

        {/* Rides list */}
        {rides.length > 0 && (
          <div
            className="scrollbar-thin"
            style={{ overflowY: "auto", padding: "16px 20px 20px", flex: 1 }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {rides.map((ride, i) => {
                const si = statusMap[ride.status] || { bg: C.canvas, color: C.ink4, label: ride.status };
                const fare = parseFloat(ride.fareBreakdown?.fareTotal || 0);
                const dist = parseFloat(ride.tripDistanceMiles || 0);
                const dur  = ride.tripDurationMin ? `${ride.tripDurationMin} min` : "—";

                return (
                  <div
                    key={ride.id || i}
                    className="ride-row"
                    style={{
                      background: C.canvas,
                      border: `1px solid ${C.line}`,
                      borderRadius: 16,
                      padding: "16px",
                      animation: `slideUp .3s ease ${i * 0.045}s both`,
                    }}
                  >
                    {/* Top row: route + fare */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Pickup */}
                        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.emerald, flexShrink: 0 }} />
                          <span style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {ride.pickupCity || "Origin"}
                          </span>
                        </div>
                        {/* Line connector */}
                        <div style={{ marginLeft: 3.5, width: 1, height: 10, background: C.ink6, marginBottom: 4, marginLeft: 3.5 }} />
                        {/* Dropoff */}
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: C.navy, flexShrink: 0 }} />
                          <span style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {ride.dropoffCity || "Destination"}
                          </span>
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontFamily: T.mono, fontSize: 17, fontWeight: 700, color: C.ink, letterSpacing: "-.02em" }}>
                          ${fare.toFixed(2)}
                        </div>
                        {ride.driverPayout && (
                          <div style={{ fontFamily: T.mono, fontSize: 10.5, color: C.amber, fontWeight: 600, marginTop: 2 }}>
                            Driver ${parseFloat(ride.driverPayout).toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom row: meta */}
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8,
                      flexWrap: "wrap",
                      paddingTop: 10,
                      borderTop: `1px solid ${C.line}`,
                    }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "3px 9px", borderRadius: 6,
                        background: si.bg, color: si.color,
                        fontFamily: T.sans, fontSize: 10.5, fontWeight: 700,
                        textTransform: "capitalize",
                      }}>
                        <span style={{ width: 4, height: 4, borderRadius: "50%", background: si.color }} />
                        {si.label}
                      </span>
                      <span style={{ fontFamily: T.mono, fontSize: 10.5, color: C.ink4, fontWeight: 500 }}>
                        {fmtDate(ride.createdAt)}
                      </span>
                      <span style={{ fontFamily: T.mono, fontSize: 10.5, color: C.ink4 }}>·</span>
                      <span style={{ fontFamily: T.mono, fontSize: 10.5, color: C.ink4 }}>
                        {dist.toFixed(1)} mi
                      </span>
                      <span style={{ fontFamily: T.mono, fontSize: 10.5, color: C.ink4 }}>·</span>
                      <span style={{ fontFamily: T.mono, fontSize: 10.5, color: C.ink4 }}>
                        {dur}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Summary footer */}
        {rides.length > 0 && (
          <div style={{
            padding: "14px 20px",
            borderTop: `1px solid ${C.line}`,
            background: C.canvas,
            display: "flex", justifyContent: "space-between", alignItems: "center",
            flexShrink: 0,
          }}>
            <div style={{ fontFamily: T.sans, fontSize: 11, color: C.ink4, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em" }}>
              Totals
            </div>
            <div style={{ display: "flex", gap: 24 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: T.sans, fontSize: 10.5, color: C.ink4, fontWeight: 600 }}>Distance</div>
                <div style={{ fontFamily: T.mono, fontSize: 14, fontWeight: 700, color: C.ink }}>{totalDist.toFixed(1)} mi</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: T.sans, fontSize: 10.5, color: C.ink4, fontWeight: 600 }}>Spent</div>
                <div style={{ fontFamily: T.mono, fontSize: 14, fontWeight: 700, color: C.emerald }}>${totalFare.toFixed(2)}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Rider Row Card ──────────────────────────────────────────────────────────────
function RiderCard({ rider, rides, index, onOpen, onMenu }) {
  const rideCount = rides.filter(r => r.uid === (rider.uid || rider.id)).length;
  const total     = riderTotalFare(rider.uid || rider.id, rides);

  return (
    <div
      className="rider-row"
      style={{
        background: C.surfaceAlt,
        border: `1px solid ${C.line}`,
        borderRadius: 16,
        padding: "15px 16px",
        display: "flex", alignItems: "center", gap: 14,
        cursor: "pointer",
        animation: `rowIn .28s ease ${index * 0.04}s both`,
      }}
      onClick={() => onOpen(rider)}
    >
      <Avatar name={rider.name} size={46} photo={rider.photoURL || null} />

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Name row */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
          <span style={{ fontFamily: T.sans, fontWeight: 800, fontSize: 14.5, color: C.ink, letterSpacing: "-.02em" }}>
            {rider.name || "—"}
          </span>
          {rider.isDriver ? (
            <Tag icon={<Car size={9} />} label="Driver" color={C.sapphire} bg={C.sapphireBg} />
          ) : (
            <StatusBadge status={rider.status} size="sm" />
          )}
          {rider.isOrphaned && !rider.isDriver && (
            <Tag icon={<AlertTriangle size={9} />} label="No Account" color={C.rose} bg={C.roseBg} />
          )}
          {rider.adminNote && (
            <span title="Has admin note">
              <Flag size={11} color={C.amber} />
            </span>
          )}
        </div>

        {/* Email */}
        <div style={{
          fontFamily: T.sans, fontSize: 12, color: C.ink4, fontWeight: 500,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          marginBottom: 7,
        }}>
          {rider.email || "—"}
        </div>

        {/* Meta chips */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: T.sans, fontSize: 10.5, color: C.ink5, fontWeight: 500 }}>
            <Calendar size={9} /> {fmtRelative(rider.createdAt)}
          </span>
          {rideCount > 0 && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: T.sans, fontSize: 10.5, color: C.sapphire, fontWeight: 700 }}>
              <Route size={9} /> {rideCount} ride{rideCount !== 1 ? "s" : ""}
            </span>
          )}
          {total > 0 && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontFamily: T.mono, fontSize: 10.5, color: C.emerald, fontWeight: 700 }}>
              ${total.toFixed(2)}
            </span>
          )}
          {rider.welcomeEmailSent && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontFamily: T.sans, fontSize: 10.5, color: C.emerald, fontWeight: 600 }}>
              <CheckCircle size={9} /> Verified
            </span>
          )}
        </div>
      </div>

      {/* Right side */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
        <button
          className="action-btn"
          onClick={e => { e.stopPropagation(); onMenu(rider); }}
          style={{
            width: 34, height: 34,
            background: C.canvas,
            border: `1px solid ${C.line}`,
            borderRadius: 10,
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: C.ink4,
          }}
        >
          <MoreHorizontal size={15} />
        </button>
        <ChevronRight size={13} color={C.ink6} />
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────────
function EmptyState({ searching }) {
  return (
    <div style={{
      textAlign: "center", padding: "64px 24px",
      background: C.surface,
      border: `1px solid ${C.line}`,
      borderRadius: 18,
      animation: "slideUp .3s ease",
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: 20,
        background: C.canvas,
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 16px",
        border: `1px solid ${C.line}`,
      }}>
        {searching ? <Search size={26} color={C.ink5} /> : <Users size={26} color={C.ink5} />}
      </div>
      <div style={{ fontFamily: T.sans, fontSize: 16, fontWeight: 800, color: C.ink, marginBottom: 6, letterSpacing: "-.02em" }}>
        {searching ? "No matches found" : "No riders yet"}
      </div>
      <div style={{ fontFamily: T.sans, fontSize: 13.5, color: C.ink4 }}>
        {searching ? "Try adjusting your search or filter" : "Riders will appear here after they sign up"}
      </div>
    </div>
  );
}

// ─── Loading State ───────────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {[...Array(5)].map((_, i) => (
        <div key={i} style={{
          background: C.surface,
          border: `1px solid ${C.line}`,
          borderRadius: 16, padding: "15px 16px",
          display: "flex", alignItems: "center", gap: 14,
          opacity: 1 - i * 0.15,
        }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: C.canvas }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <Skeleton w="40%" h={14} />
            <Skeleton w="60%" h={11} />
            <Skeleton w="30%" h={10} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────────
export function RidersTab({ useriders, rideUids, rides = [], drivers = [], onBack }) {
  const rawRiders = useriders?.riders || [];

  const [local,       setLocal]       = useState({});
  const [search,      setSearch]      = useState("");
  const [filter,      setFilter]      = useState("all");
  const [sortBy,      setSortBy]      = useState("recent");
  const [drawer,      setDrawer]      = useState(null);
  const [menu,        setMenu]        = useState(null);
  const [confirm,     setConfirm]     = useState(null);
  const [rideHistory, setRideHistory] = useState(null);
  const [noteText,    setNote]        = useState("");
  const [showSort,    setShowSort]    = useState(false);
  const sortRef = useRef(null);

  // Close sort dropdown on outside click
  useEffect(() => {
    function handle(e) { if (sortRef.current && !sortRef.current.contains(e.target)) setShowSort(false); }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Orphaned UIDs — cross-reference against Drivers to label correctly
  const orphanedUids = useMemo(() => {
    const riderIds   = new Set(rawRiders.map(r => r.id).filter(Boolean));
    const riderUids  = new Set(rawRiders.map(r => r.uid).filter(Boolean));
    const driverMap  = new Map(drivers.map(d => [d.id, d]));
    const uniqueRideUids = new Set(rides.map(r => r.uid).filter(Boolean));
    const out = [];
    uniqueRideUids.forEach(uid => {
      if (riderIds.has(uid) || riderUids.has(uid)) return;
      const driverDoc = driverMap.get(uid);
      const dName = driverDoc
        ? [driverDoc.firstName, driverDoc.lastName].filter(Boolean).join(" ") || driverDoc.name || driverDoc.displayName || "Driver"
        : null;
      out.push({
        id: uid, uid,
        name:      driverDoc ? dName : "Unknown",
        email:     driverDoc?.email ?? "—",
        status:    "active",
        isOrphaned: true,
        isDriver:  !!driverDoc,
        rideCount: rides.filter(r => r.uid === uid).length,
        createdAt: rides.find(r => r.uid === uid)?.createdAt || null,
      });
    });
    return out;
  }, [rawRiders, rides, drivers]);

  const allRiders = useMemo(() => [...rawRiders, ...orphanedUids], [rawRiders, orphanedUids]);

  const riders = useMemo(() => allRiders.map(r => ({
    ...r,
    ...(local[r.id] || {}),
    status: local[r.id]?.status || r.status || "active",
  })), [allRiders, local]);

  const counts = useMemo(() => {
    const c = { all: 0, active: 0, suspended: 0, banned: 0, driver: 0, unknown: 0 };
    riders.forEach(r => {
      if (local[r.id]?.deleted) return;
      c.all++;
      if (r.isDriver) { c.driver++; return; }
      if (r.isOrphaned) { c.unknown++; return; }
      if (c[r.status] !== undefined) c[r.status]++;
    });
    return c;
  }, [riders, local]);

  const filtered = useMemo(() => {
    let list = riders
      .filter(r => !local[r.id]?.deleted)
      .filter(r => {
        if (filter === "all")     return true;
        if (filter === "driver")  return r.isDriver;
        if (filter === "unknown") return r.isOrphaned && !r.isDriver;
        return r.status === filter && !r.isDriver;
      })
      .filter(r => {
        const q = search.toLowerCase();
        return !q || [r.name, r.email, r.id, r.uid].some(v => (v || "").toLowerCase().includes(q));
      });

    if (sortBy === "name")   list = [...list].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    if (sortBy === "rides")  list = [...list].sort((a, b) => rides.filter(r => r.uid === b.uid).length - rides.filter(r => r.uid === a.uid).length);
    if (sortBy === "spent")  list = [...list].sort((a, b) => riderTotalFare(b.uid, rides) - riderTotalFare(a.uid, rides));
    if (sortBy === "recent") list = [...list].sort((a, b) => {
      const ta = a.createdAt?.seconds || 0;
      const tb = b.createdAt?.seconds || 0;
      return tb - ta;
    });

    return list;
  }, [riders, local, filter, search, sortBy, rides]);

  const riderRides = useMemo(() => {
    if (!rideHistory) return [];
    const uid = rideHistory.uid || rideHistory.id;
    return rides.filter(r => r.uid === uid);
  }, [rideHistory, rides]);

  const totalRevenue = useMemo(() => rides.reduce((s, r) => s + parseFloat(r.fareBreakdown?.fareTotal || 0), 0), [rides]);

  function handleAction(action, rider) {
    if (action === "open-menu") { setDrawer(null); setMenu(rider); return; }
    if (action === "view")      { setMenu(null); setDrawer(rider); return; }
    if (action === "history")   { setMenu(null); setDrawer(null); setRideHistory(rider); return; }
    if (action === "email")     { alert(`Email composer for ${rider.email}`); return; }
    if (action === "reset")     { handlePasswordReset(rider); return; }
    if (action === "verify")    { setLocal(p => ({ ...p, [rider.id]: { ...p[rider.id], welcomeEmailSent: true } })); return; }
    if (action === "export")    { alert(`Exporting data for ${rider.name}…`); return; }
    setNote(rider.adminNote || "");
    setConfirm({ action, rider });
    setMenu(null); setDrawer(null);
  }

  async function handlePasswordReset(rider) {
    try {
      // resetPassword(rider.email)
      alert(`Password reset sent to ${rider.email}`);
    } catch (e) {
      alert(`Error: ${e.message}`);
    }
  }

  function handleConfirm() {
    const { action, rider } = confirm;
    const patch = {};
    if (action === "suspend")   patch.status = "suspended";
    if (action === "ban")       patch.status = "banned";
    if (action === "reinstate") patch.status = "active";
    if (action === "flag")      patch.adminNote = noteText || "Flagged for review";
    if (action === "note")      patch.adminNote = noteText;
    if (action === "delete")    patch.deleted = true;
    setLocal(p => ({ ...p, [rider.id]: { ...p[rider.id], ...patch } }));
    setConfirm(null);
  }

  const SORT_OPTIONS = [
    { key: "recent", label: "Newest First"  },
    { key: "name",   label: "Name A–Z"      },
    { key: "rides",  label: "Most Rides"    },
    { key: "spent",  label: "Highest Spent" },
  ];

  return (
    <>
      <style>{GLOBAL_CSS}</style>

      <div style={{
        background: C.canvas,
        minHeight: "100vh",
        fontFamily: T.sans,
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
      }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "24px 18px 60px" }}>

          {/* Back button */}
          {onBack && (
            <button
              onClick={onBack}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                background: "none", border: "none", cursor: "pointer",
                color: C.ink4, fontSize: 13, fontWeight: 600,
                marginBottom: 20, padding: 0, fontFamily: T.sans,
                transition: "color .15s",
              }}
              onMouseEnter={e => e.currentTarget.style.color = C.ink}
              onMouseLeave={e => e.currentTarget.style.color = C.ink4}
            >
              <ArrowLeft size={14} /> Back to Dashboard
            </button>
          )}

          {/* Page Header */}
          <div style={{
            display: "flex", alignItems: "flex-end",
            justifyContent: "space-between", gap: 16,
            marginBottom: 24,
            flexWrap: "wrap",
            animation: "slideUp .35s ease",
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 11,
                  background: C.navy,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Users size={18} color="#fff" />
                </div>
                <h1 style={{
                  fontFamily: T.display, fontWeight: 700, fontSize: 30,
                  color: C.ink, margin: 0, letterSpacing: "-.04em",
                  lineHeight: 1,
                }}>
                  Riders
                </h1>
              </div>
              <p style={{ fontFamily: T.sans, fontSize: 13.5, color: C.ink4, margin: 0, fontWeight: 400 }}>
                Manage accounts, moderation & ride history
              </p>
            </div>

            {/* Live badge */}
            {counts.all > 0 && (
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "6px 13px",
                background: C.emeraldBg,
                border: `1px solid ${C.emeraldSoft}`,
                borderRadius: 99,
              }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.emerald, animation: "pulse 2s ease-in-out infinite", display: "inline-block" }} />
                <span style={{ fontFamily: T.sans, fontSize: 11.5, fontWeight: 800, color: C.emerald, letterSpacing: ".04em" }}>
                  {counts.active} ACTIVE
                </span>
              </div>
            )}
          </div>

          {/* Stats Grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginBottom: 20,
          }}>
            <StatCard icon={<Users size={15} />}         label="Total Riders"    value={counts.all}                         color={C.navy}      delay={0}   trend={null} />
            <StatCard icon={<Route size={15} />}          label="Total Rides"     value={rides.length}                       color={C.sapphire}  delay={60}  trend={null} />
            <StatCard icon={<DollarSign size={15} />}     label="Total Revenue"   value={`$${totalRevenue.toFixed(0)}`}      color={C.emerald}   delay={120} trend={null} />
            <StatCard icon={<Ban size={15} />}            label="Restricted"      value={counts.suspended + counts.banned}   color={C.rose}      delay={180} sub={`${counts.suspended} susp · ${counts.banned} banned`} />
          </div>

          {/* Search + Sort row */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <div
              className="search-wrap"
              style={{
                flex: 1,
                display: "flex", alignItems: "center", gap: 9,
                background: C.surface,
                border: `1.5px solid ${C.line}`,
                borderRadius: 12,
                padding: "0 14px", height: 44,
                transition: "all .18s",
              }}
            >
              <Search size={14} color={C.ink5} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, email, or UID…"
                style={{
                  flex: 1, background: "none", border: "none", outline: "none",
                  color: C.ink, fontFamily: T.sans, fontSize: 13.5, fontWeight: 500,
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  style={{ background: "none", border: "none", cursor: "pointer", color: C.ink5, display: "flex", padding: 0 }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Sort dropdown */}
            <div style={{ position: "relative" }} ref={sortRef}>
              <button
                onClick={() => setShowSort(p => !p)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  height: 44, padding: "0 14px",
                  background: C.surface,
                  border: `1.5px solid ${showSort ? C.navy : C.line}`,
                  borderRadius: 12,
                  color: C.ink3,
                  fontFamily: T.sans, fontSize: 12.5, fontWeight: 600,
                  cursor: "pointer", whiteSpace: "nowrap",
                  transition: "border-color .15s",
                }}
              >
                <SlidersHorizontal size={13} />
                Sort
                <ChevronDown size={11} style={{ transform: showSort ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
              </button>

              {showSort && (
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", right: 0,
                  background: C.surface,
                  border: `1px solid ${C.line}`,
                  borderRadius: 14,
                  overflow: "hidden",
                  zIndex: 300,
                  boxShadow: C.shadowMd,
                  minWidth: 160,
                  animation: "scaleIn .16s ease",
                }}>
                  {SORT_OPTIONS.map(opt => (
                    <button
                      key={opt.key}
                      className="menu-item"
                      onClick={() => { setSortBy(opt.key); setShowSort(false); }}
                      style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        width: "100%", padding: "10px 14px",
                        background: sortBy === opt.key ? C.navyTint : "transparent",
                        border: "none",
                        color: sortBy === opt.key ? C.navy : C.ink2,
                        fontFamily: T.sans, fontSize: 13, fontWeight: sortBy === opt.key ? 700 : 500,
                        cursor: "pointer",
                      }}
                    >
                      {opt.label}
                      {sortBy === opt.key && <CheckCircle size={12} color={C.navy} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Filter pills */}
          <div style={{ display: "flex", gap: 7, marginBottom: 20, flexWrap: "wrap" }}>
            {[
              { key: "all",       label: "All",          count: counts.all       },
              { key: "active",    label: "Active",       count: counts.active    },
              { key: "suspended", label: "Suspended",    count: counts.suspended },
              { key: "banned",    label: "Banned",       count: counts.banned    },
              { key: "driver",    label: "Drivers",      count: counts.driver    },
              { key: "unknown",   label: "Unknown",      count: counts.unknown   },
            ].map(f => (
              <FilterPill
                key={f.key}
                label={f.label}
                count={f.count}
                active={filter === f.key}
                onClick={() => setFilter(f.key)}
              />
            ))}
          </div>

          {/* Error banner */}
          {useriders?.error && (
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              background: C.roseBg,
              border: `1px solid ${C.roseSoft}`,
              borderRadius: 12, padding: "12px 16px",
              marginBottom: 14,
              color: C.rose,
              fontFamily: T.sans, fontSize: 13, fontWeight: 600,
            }}>
              <AlertTriangle size={15} /> {useriders.error.message ?? "Failed to load riders"}
            </div>
          )}

          {/* Content */}
          {useriders?.loading ? (
            <LoadingSkeleton />
          ) : filtered.length === 0 ? (
            <EmptyState searching={!!search || filter !== "all"} />
          ) : (
            <>
              {/* List header */}
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: 10,
              }}>
                <div style={{ fontFamily: T.sans, fontSize: 11.5, color: C.ink4, fontWeight: 600 }}>
                  {filtered.length} of {counts.all} rider{counts.all !== 1 ? "s" : ""}
                </div>
                <div style={{ fontFamily: T.sans, fontSize: 11.5, color: C.ink5 }}>
                  Sorted by {SORT_OPTIONS.find(o => o.key === sortBy)?.label.toLowerCase()}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {filtered.map((rider, i) => (
                  <RiderCard
                    key={rider.uid || rider.id}
                    rider={rider}
                    rides={rides}
                    index={i}
                    onOpen={r => setDrawer(r)}
                    onMenu={r => setMenu(r)}
                  />
                ))}
              </div>

              {/* Bottom hint */}
              <div style={{
                textAlign: "center",
                padding: "28px 0 0",
                fontFamily: T.sans, fontSize: 11.5, color: C.ink5,
              }}>
                Tap a rider to view details · ··· to take action
              </div>
            </>
          )}
        </div>
      </div>

      {/* Overlays */}
      {drawer && (
        <RiderDrawer
          rider={drawer}
          rides={rides}
          onClose={() => setDrawer(null)}
          onAction={handleAction}
        />
      )}
      {menu && (
        <ActionsMenu
          rider={menu}
          onClose={() => setMenu(null)}
          onAction={handleAction}
        />
      )}
      {confirm && (
        <ConfirmModal
          action={confirm.action}
          rider={confirm.rider}
          note={noteText}
          setNote={setNote}
          onConfirm={handleConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
      {rideHistory && (
        <RideHistoryModal
          rider={rideHistory}
          rides={riderRides}
          onClose={() => setRideHistory(null)}
        />
      )}
    </>
  );
}

export default RidersTab;
