import { useState } from "react";
import { ArrowLeft, Search, Users, UserCheck, UserX, Trash2, Eye, MoreVertical, Mail, Hash, Calendar, Shield, ChevronDown, X, AlertTriangle } from "lucide-react";

// ── Design tokens (mirrors your UaTob system) ──────────────────────────────
const C = {
  bg: "#0a0a0a",
  surface: "#111111",
  surfaceHover: "#161616",
  card: "#141414",
  border: "#1f1f1f",
  borderHover: "#2a2a2a",
  accent: "#22c55e",
  accentDim: "rgba(34,197,94,0.12)",
  accentGlow: "rgba(34,197,94,0.25)",
  text: "#f0f0f0",
  textMuted: "#6b7280",
  textDim: "#9ca3af",
  red: "#ef4444",
  redDim: "rgba(239,68,68,0.12)",
  yellow: "#f59e0b",
  yellowDim: "rgba(245,158,11,0.12)",
  blue: "#3b82f6",
  blueDim: "rgba(59,130,246,0.12)",
};

const font = "'Outfit', sans-serif";
const mono = "'JetBrains Mono', monospace";

// ── Helpers ────────────────────────────────────────────────────────────────
function formatDate(ts) {
  if (!ts) return "—";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getInitials(name) {
  if (!name) return "?";
  return name.trim().split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

function Avatar({ name, size = 40 }) {
  const colors = ["#22c55e","#3b82f6","#f59e0b","#ec4899","#8b5cf6","#06b6d4"];
  const idx = (name || "").charCodeAt(0) % colors.length;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `${colors[idx]}22`,
      border: `1.5px solid ${colors[idx]}44`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.35, fontWeight: 700, color: colors[idx],
      fontFamily: font, flexShrink: 0,
    }}>
      {getInitials(name)}
    </div>
  );
}

// ── Status Badge ───────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    active:    { label: "Active",    bg: C.accentDim, color: C.accent },
    suspended: { label: "Suspended", bg: C.yellowDim, color: C.yellow },
    banned:    { label: "Banned",    bg: C.redDim,    color: C.red    },
  };
  const s = map[status] || map.active;
  return (
    <span style={{
      padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
      fontFamily: font, background: s.bg, color: s.color, letterSpacing: "0.04em",
    }}>
      {s.label}
    </span>
  );
}

// ── Confirm Modal ──────────────────────────────────────────────────────────
function ConfirmModal({ action, rider, onConfirm, onCancel }) {
  const configs = {
    suspend: {
      icon: <AlertTriangle size={20} color={C.yellow} />,
      title: "Suspend Rider",
      desc: `${rider?.name || "This rider"} will lose access to the app until reinstated.`,
      confirm: "Suspend",
      color: C.yellow,
    },
    ban: {
      icon: <UserX size={20} color={C.red} />,
      title: "Ban Rider",
      desc: `${rider?.name || "This rider"} will be permanently banned and cannot create a new account.`,
      confirm: "Ban Permanently",
      color: C.red,
    },
    delete: {
      icon: <Trash2 size={20} color={C.red} />,
      title: "Delete Account",
      desc: `This will permanently delete ${rider?.name || "this rider"}'s account and all associated data. This cannot be undone.`,
      confirm: "Delete Account",
      color: C.red,
    },
    reinstate: {
      icon: <UserCheck size={20} color={C.accent} />,
      title: "Reinstate Rider",
      desc: `${rider?.name || "This rider"} will regain full access to the UaTob platform.`,
      confirm: "Reinstate",
      color: C.accent,
    },
  };
  const cfg = configs[action];
  if (!cfg) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000, backdropFilter: "blur(4px)", padding: 24,
    }}>
      <div style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
        padding: 28, maxWidth: 380, width: "100%",
        boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div style={{ background: `${cfg.color}18`, borderRadius: 10, padding: 8, display: "flex" }}>
            {cfg.icon}
          </div>
          <span style={{ fontFamily: font, fontWeight: 700, fontSize: 16, color: C.text }}>{cfg.title}</span>
        </div>
        <p style={{ fontFamily: font, fontSize: 13.5, color: C.textDim, lineHeight: 1.6, margin: "0 0 24px" }}>
          {cfg.desc}
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${C.border}`,
            background: "none", color: C.textMuted, fontFamily: font, fontWeight: 600,
            fontSize: 13.5, cursor: "pointer",
          }}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: "10px 0", borderRadius: 10, border: "none",
            background: cfg.color, color: "#000", fontFamily: font, fontWeight: 700,
            fontSize: 13.5, cursor: "pointer",
          }}>
            {cfg.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Rider Detail Drawer ────────────────────────────────────────────────────
function RiderDrawer({ rider, onClose, onAction }) {
  if (!rider) return null;
  const rows = [
    { icon: <Mail size={14} />,     label: "Email",   value: rider.email || "—" },
    { icon: <Hash size={14} />,     label: "UID",     value: rider.uid,   mono: true },
    { icon: <Calendar size={14} />, label: "Joined",  value: formatDate(rider.createdAt) },
    { icon: <Shield size={14} />,   label: "Email Verified", value: rider.welcomeEmailSent ? "Yes" : "No" },
  ];
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
      display: "flex", justifyContent: "flex-end",
      zIndex: 900, backdropFilter: "blur(3px)",
    }} onClick={onClose}>
      <div style={{
        width: 340, background: C.surface, height: "100%",
        borderLeft: `1px solid ${C.border}`, padding: 24,
        overflowY: "auto", display: "flex", flexDirection: "column", gap: 20,
        animation: "slideIn 0.22s ease",
      }} onClick={e => e.stopPropagation()}>
        <style>{`@keyframes slideIn { from { transform: translateX(100%); opacity: 0 } to { transform: translateX(0); opacity: 1 } }`}</style>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: font, fontWeight: 700, fontSize: 15, color: C.text }}>Rider Details</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, display: "flex" }}>
            <X size={18} />
          </button>
        </div>

        {/* Profile */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "16px 0", borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
          <Avatar name={rider.name} size={64} />
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: font, fontWeight: 700, fontSize: 17, color: C.text }}>{rider.name || "Unknown"}</div>
            <div style={{ marginTop: 6 }}><StatusBadge status={rider.status || "active"} /></div>
          </div>
        </div>

        {/* Info rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rows.map(r => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.textMuted, fontFamily: font, fontSize: 12.5, fontWeight: 600, minWidth: 100 }}>
                {r.icon} {r.label}
              </div>
              <div style={{ fontFamily: r.mono ? mono : font, fontSize: r.mono ? 10.5 : 12.5, color: C.textDim, textAlign: "right", wordBreak: "break-all" }}>
                {r.value}
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
          {(rider.status === "suspended" || rider.status === "banned") ? (
            <button onClick={() => onAction("reinstate", rider)} style={actionBtn(C.accent)}>
              <UserCheck size={14} /> Reinstate Rider
            </button>
          ) : (
            <button onClick={() => onAction("suspend", rider)} style={actionBtn(C.yellow)}>
              <AlertTriangle size={14} /> Suspend Rider
            </button>
          )}
          {rider.status !== "banned" && (
            <button onClick={() => onAction("ban", rider)} style={actionBtn(C.red)}>
              <UserX size={14} /> Ban Rider
            </button>
          )}
          <button onClick={() => onAction("delete", rider)} style={{ ...actionBtn(C.red), background: C.redDim, border: `1px solid ${C.red}33` }}>
            <Trash2 size={14} /> Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}

function actionBtn(color) {
  return {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    padding: "10px 0", borderRadius: 10, border: "none",
    background: color === C.accent ? C.accentDim : color === C.yellow ? C.yellowDim : C.redDim,
    color, fontFamily: font, fontWeight: 600, fontSize: 13.5, cursor: "pointer",
  };
}

// ── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, color = C.text }) {
  return (
    <div style={{
      flex: 1, background: C.card, border: `1px solid ${C.border}`,
      borderRadius: 12, padding: "14px 16px",
    }}>
      <div style={{ fontFamily: font, fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export function RidersTab({ useriders, onBack }) {
  const { riders: rawRiders = [], loading, error } = useriders || {};

  // Local state for status overrides (in real app, push to Firestore)
  const [localStatus, setLocalStatus] = useState({});
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all | active | suspended | banned
  const [selectedRider, setSelectedRider] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null); // { action, rider }
  const [filterOpen, setFilterOpen] = useState(false);

  const riders = rawRiders.map(r => ({ ...r, status: localStatus[r.uid] || r.status || "active" }));

  const counts = {
    all: riders.length,
    active: riders.filter(r => r.status === "active").length,
    suspended: riders.filter(r => r.status === "suspended").length,
    banned: riders.filter(r => r.status === "banned").length,
  };

  const filtered = riders.filter(r => {
    const matchFilter = filter === "all" || r.status === filter;
    const q = search.toLowerCase();
    const matchSearch = !q || (r.name || "").toLowerCase().includes(q) || (r.email || "").toLowerCase().includes(q) || (r.uid || "").toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  function handleAction(action, rider) {
    setConfirmAction({ action, rider });
    setSelectedRider(null);
  }

  function handleConfirm() {
    const { action, rider } = confirmAction;
    if (action === "suspend") setLocalStatus(p => ({ ...p, [rider.uid]: "suspended" }));
    else if (action === "ban") setLocalStatus(p => ({ ...p, [rider.uid]: "banned" }));
    else if (action === "reinstate") setLocalStatus(p => ({ ...p, [rider.uid]: "active" }));
    // "delete" would call a Firestore delete fn in production
    setConfirmAction(null);
  }

  const filterLabels = { all: "All Riders", active: "Active", suspended: "Suspended", banned: "Banned" };

  return (
    <>
      <div style={{ padding: "0 16px 32px", fontFamily: font }}>
        {/* Back */}
        {onBack && (
          <button onClick={onBack} style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "none", border: "none", cursor: "pointer",
            color: C.textMuted, fontSize: 13.5, fontWeight: 600, marginBottom: 20,
          }}>
            <ArrowLeft size={15} /> Back to Dashboard
          </button>
        )}

        {/* Page header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.text, letterSpacing: "-0.02em" }}>Rider Management</div>
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 3 }}>View, suspend, and manage all registered riders</div>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <StatCard label="Total" value={counts.all} color={C.text} />
          <StatCard label="Active" value={counts.active} color={C.accent} />
          <StatCard label="Suspended" value={counts.suspended} color={C.yellow} />
          <StatCard label="Banned" value={counts.banned} color={C.red} />
        </div>

        {/* Search + Filter row */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          {/* Search */}
          <div style={{
            flex: 1, display: "flex", alignItems: "center", gap: 10,
            background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "0 14px",
          }}>
            <Search size={14} color={C.textMuted} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, email, or UID…"
              style={{
                flex: 1, background: "none", border: "none", outline: "none",
                color: C.text, fontFamily: font, fontSize: 13.5, padding: "10px 0",
              }}
            />
            {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, display: "flex" }}><X size={13} /></button>}
          </div>

          {/* Filter dropdown */}
          <div style={{ position: "relative" }}>
            <button onClick={() => setFilterOpen(p => !p)} style={{
              display: "flex", alignItems: "center", gap: 6,
              background: C.card, border: `1px solid ${filter !== "all" ? C.accent + "66" : C.border}`,
              borderRadius: 10, padding: "0 14px", height: "100%",
              color: filter !== "all" ? C.accent : C.textDim, fontFamily: font, fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>
              {filterLabels[filter]} <ChevronDown size={13} />
            </button>
            {filterOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 100,
                background: C.card, border: `1px solid ${C.border}`, borderRadius: 10,
                overflow: "hidden", minWidth: 150,
                boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
              }}>
                {Object.entries(filterLabels).map(([key, label]) => (
                  <button key={key} onClick={() => { setFilter(key); setFilterOpen(false); }} style={{
                    display: "block", width: "100%", textAlign: "left",
                    padding: "10px 14px", background: filter === key ? C.accentDim : "none",
                    border: "none", color: filter === key ? C.accent : C.textDim,
                    fontFamily: font, fontSize: 13, fontWeight: filter === key ? 700 : 500, cursor: "pointer",
                  }}>
                    {label}
                    <span style={{ float: "right", fontFamily: mono, fontSize: 11, opacity: 0.7 }}>{counts[key]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* States */}
        {loading && (
          <div style={{ textAlign: "center", padding: 40, color: C.textMuted, fontSize: 13.5 }}>
            Loading riders…
          </div>
        )}
        {error && (
          <div style={{ background: C.redDim, border: `1px solid ${C.red}33`, borderRadius: 10, padding: "12px 16px", color: C.red, fontSize: 13, marginBottom: 12 }}>
            Error: {error.message}
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 48, color: C.textMuted, fontSize: 13.5 }}>
            <Users size={32} style={{ opacity: 0.3, marginBottom: 10 }} />
            <div>{search ? "No riders match your search" : "No riders found"}</div>
          </div>
        )}

        {/* Rider list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(rider => (
            <div key={rider.id || rider.uid} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 14px",
              border: `1px solid ${C.border}`, borderRadius: 12,
              background: C.card, cursor: "pointer",
              transition: "border-color 0.15s, background 0.15s",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderHover; e.currentTarget.style.background = C.surfaceHover; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.card; }}
              onClick={() => setSelectedRider(rider)}
            >
              <Avatar name={rider.name} size={38} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: C.text, fontFamily: font }}>{rider.name || "Unknown"}</span>
                  <StatusBadge status={rider.status} />
                </div>
                <div style={{ fontSize: 12, color: C.textMuted, fontFamily: font, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {rider.email || "—"}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                <div style={{ fontFamily: mono, fontSize: 10, color: C.textMuted }}>{formatDate(rider.createdAt)}</div>
                <div style={{ display: "flex", gap: 6 }}>
                  <ActionIconBtn icon={<Eye size={13} />} onClick={e => { e.stopPropagation(); setSelectedRider(rider); }} title="View" color={C.blue} bg={C.blueDim} />
                  {rider.status !== "suspended" && rider.status !== "banned"
                    ? <ActionIconBtn icon={<AlertTriangle size={13} />} onClick={e => { e.stopPropagation(); handleAction("suspend", rider); }} title="Suspend" color={C.yellow} bg={C.yellowDim} />
                    : <ActionIconBtn icon={<UserCheck size={13} />} onClick={e => { e.stopPropagation(); handleAction("reinstate", rider); }} title="Reinstate" color={C.accent} bg={C.accentDim} />
                  }
                  <ActionIconBtn icon={<Trash2 size={13} />} onClick={e => { e.stopPropagation(); handleAction("delete", rider); }} title="Delete" color={C.red} bg={C.redDim} />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Result count */}
        {filtered.length > 0 && (
          <div style={{ marginTop: 14, textAlign: "center", fontFamily: font, fontSize: 12, color: C.textMuted }}>
            Showing {filtered.length} of {riders.length} rider{riders.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {selectedRider && (
        <RiderDrawer
          rider={selectedRider}
          onClose={() => setSelectedRider(null)}
          onAction={handleAction}
        />
      )}

      {/* Confirm modal */}
      {confirmAction && (
        <ConfirmModal
          action={confirmAction.action}
          rider={confirmAction.rider}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </>
  );
}

// ── Inline icon button ─────────────────────────────────────────────────────
function ActionIconBtn({ icon, onClick, title, color, bg }) {
  return (
    <button onClick={onClick} title={title} style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      width: 28, height: 28, borderRadius: 8, border: "none",
      background: bg, color, cursor: "pointer",
    }}>
      {icon}
    </button>
  );
}
