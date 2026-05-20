import { useState, useMemo } from "react";
import {
  ArrowLeft, Search, X, Eye, UserCheck, Trash2,
  AlertTriangle, Mail, Hash, Calendar, Shield,
  Lock, Flag, FileText, Download,
  CheckCircle, Clock, Ban, ChevronRight, Inbox, BellRing,
  Phone, MapPin, TrendingUp, MoreHorizontal,
} from "lucide-react";

// ─── UaTob Editorial Tokens ───────────────────────────────────────────────
const C = {
  // Paper / surfaces
  paper:       "#FAFAF7",       // warm off-white, not stark
  paperAlt:    "#F4F2EC",
  surface:     "#FFFFFF",
  ink:         "#0A0A0A",
  ink2:        "#1F1F1F",
  ink3:        "#4A4A4A",
  ink4:        "#7A7A75",
  ink5:        "#B5B3AD",
  rule:        "#1A1A1A",       // for editorial hairlines
  ruleSoft:    "rgba(10,10,10,.08)",
  ruleMid:     "rgba(10,10,10,.16)",

  // UaTob brand teal
  brand:       "#0D9488",
  brandDeep:   "#0F766E",
  brandSoft:   "rgba(13,148,136,.08)",
  brandPaper:  "#F0FDFA",

  // Semantic
  active:      "#15803D",
  activeSoft:  "#DCFCE7",
  warn:        "#B45309",
  warnSoft:    "#FEF3C7",
  danger:      "#991B1B",
  dangerSoft:  "#FEE2E2",
  flag:        "#C2410C",
  flagSoft:    "#FFEDD5",
};
const serif = "'Fraunces', 'Georgia', serif";
const sans  = "'Inter', system-ui, sans-serif";
const mono  = "'JetBrains Mono', monospace";

// ─── Helpers ──────────────────────────────────────────────────────────────
function fmtDate(ts) {
  if (!ts) return "—";
  const d = ts?.toDate?.() ?? (ts?.seconds ? new Date(ts.seconds * 1000) : new Date(ts));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtRelative(ts) {
  if (!ts) return "—";
  const d = ts?.toDate?.() ?? (ts?.seconds ? new Date(ts.seconds * 1000) : new Date(ts));
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return fmtDate(ts);
}
function fmtMoney(n) {
  if (n == null) return "—";
  return `$${Number(n).toFixed(2)}`;
}
function initials(name) {
  return (name || "?").trim().split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

// ─── Tier classification — drives sort order and visual treatment ─────────
function getTier(rider) {
  if (rider.adminNote) return "flagged";
  if (rider.status === "banned") return "banned";
  if (rider.status === "suspended") return "suspended";
  if ((rider.totalRides ?? 0) >= 5) return "vip";
  if ((rider.totalRides ?? 0) >= 1) return "active";
  return "dormant";
}
const TIER_ORDER = ["flagged", "banned", "suspended", "vip", "active", "dormant"];

// ─── Editorial Avatar — uses serif initial ────────────────────────────────
function Avatar({ name, size = 40, tier }) {
  const tierColors = {
    flagged:   { bg: C.flagSoft,    fg: C.flag },
    banned:    { bg: C.dangerSoft,  fg: C.danger },
    suspended: { bg: C.warnSoft,    fg: C.warn },
    vip:       { bg: C.brandPaper,  fg: C.brandDeep },
    active:    { bg: C.activeSoft,  fg: C.active },
    dormant:   { bg: C.paperAlt,    fg: C.ink4 },
  };
  const { bg, fg } = tierColors[tier] || tierColors.dormant;
  return (
    <div style={{
      width: size, height: size, borderRadius: size / 2,
      background: bg, color: fg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: serif, fontWeight: 600, fontSize: size * 0.38,
      flexShrink: 0, userSelect: "none",
      letterSpacing: "-.02em",
    }}>
      {initials(name)}
    </div>
  );
}

// ─── Tier badge — editorial, just text ────────────────────────────────────
function TierBadge({ tier, rideCount }) {
  const m = {
    flagged:   { l: "Flagged",   c: C.flag,     w: 700 },
    banned:    { l: "Banned",    c: C.danger,   w: 700 },
    suspended: { l: "Suspended", c: C.warn,     w: 700 },
    vip:       { l: "VIP",       c: C.brandDeep,w: 700 },
    active:    { l: "Active",    c: C.active,   w: 600 },
    dormant:   { l: "Dormant",   c: C.ink4,     w: 500 },
  };
  const s = m[tier] || m.dormant;
  return (
    <span style={{
      fontFamily: mono, fontSize: 9.5, fontWeight: s.w,
      color: s.c, letterSpacing: ".12em", textTransform: "uppercase",
    }}>
      {s.l}{tier === "vip" || tier === "active" ? ` · ${rideCount}` : ""}
    </span>
  );
}

// ─── Actions catalogue ────────────────────────────────────────────────────
const ACTIONS = [
  { id: "view",      label: "View Profile",   icon: <Eye size={14} />,         group: "info",    color: C.ink },
  { id: "history",   label: "Ride History",   icon: <Clock size={14} />,       group: "info",    color: C.ink },
  { id: "email",     label: "Send Email",     icon: <Mail size={14} />,        group: "comms",   color: C.brandDeep },
  { id: "note",      label: "Admin Note",     icon: <FileText size={14} />,    group: "comms",   color: C.brandDeep },
  { id: "reset",     label: "Password Reset", icon: <Lock size={14} />,        group: "account", color: C.warn },
  { id: "verify",    label: "Mark Verified",  icon: <CheckCircle size={14} />, group: "account", color: C.active },
  { id: "export",    label: "Export Data",    icon: <Download size={14} />,    group: "account", color: C.warn },
  { id: "flag",      label: "Flag for Review",icon: <Flag size={14} />,        group: "mod",     color: C.flag },
  { id: "suspend",   label: "Suspend",        icon: <AlertTriangle size={14} />,group: "mod",    color: C.warn },
  { id: "reinstate", label: "Reinstate",      icon: <UserCheck size={14} />,   group: "mod",     color: C.active },
  { id: "ban",       label: "Ban Permanently",icon: <Ban size={14} />,         group: "mod",     color: C.danger },
  { id: "delete",    label: "Delete Account", icon: <Trash2 size={14} />,      group: "mod",     color: C.danger },
];

// ─── Bottom-sheet action menu ─────────────────────────────────────────────
function ActionsMenu({ rider, onClose, onAction }) {
  const tier = getTier(rider);
  const items = ACTIONS.filter(a => {
    if (a.id === "reinstate") return rider.status === "suspended" || rider.status === "banned";
    if (a.id === "suspend")   return rider.status === "active";
    if (a.id === "ban")       return rider.status !== "banned";
    return true;
  });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 800, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(10,10,10,.5)", backdropFilter: "blur(8px)" }} onClick={onClose}>
      <div
        style={{
          background: C.surface, borderRadius: "24px 24px 0 0",
          width: "100%", maxWidth: 480, maxHeight: "85vh",
          overflow: "hidden", display: "flex", flexDirection: "column",
          boxShadow: "0 -24px 60px rgba(0,0,0,.24)",
          animation: "sUp .3s cubic-bezier(.22,1,.36,1)",
          borderTop: `1px solid ${C.ruleSoft}`,
        }}
        onClick={e => e.stopPropagation()}
      >
        <style>{`@keyframes sUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>

        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "14px 0 4px" }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: C.ruleMid }} />
        </div>

        {/* Header */}
        <div style={{ padding: "18px 24px 22px", borderBottom: `1px solid ${C.ruleSoft}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Avatar name={rider.name} size={48} tier={tier} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: serif, fontWeight: 600, fontSize: 19, color: C.ink, letterSpacing: "-.015em", lineHeight: 1.2 }}>
                {rider.name || "—"}
              </div>
              <div style={{ fontFamily: sans, fontSize: 12.5, color: C.ink4, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>
                {rider.email}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 14, fontFamily: mono, fontSize: 10.5, color: C.ink4 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <TrendingUp size={11} /> {rider.totalRides ?? 0} rides
            </span>
            <span style={{ width: 1, background: C.ruleSoft }} />
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <Calendar size={11} /> Joined {fmtDate(rider.createdAt)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ overflowY: "auto", padding: "8px 12px 28px" }}>
          {items.map(a => (
            <button
              key={a.id}
              onClick={() => { onClose(); onAction(a.id, rider); }}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                width: "100%", padding: "12px 14px", borderRadius: 12,
                border: "none", background: "transparent", cursor: "pointer",
                textAlign: "left", transition: "background .15s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = C.paperAlt}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <div style={{ color: a.color, flexShrink: 0, display: "flex" }}>
                {a.icon}
              </div>
              <span style={{
                flex: 1,
                fontFamily: sans, fontWeight: 500, fontSize: 14,
                color: (a.id === "delete" || a.id === "ban") ? C.danger : C.ink,
              }}>
                {a.label}
              </span>
              <ChevronRight size={14} color={C.ink5} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Confirm modal — editorial style ──────────────────────────────────────
function ConfirmModal({ action, rider, note, setNote, onConfirm, onCancel }) {
  const cfg = {
    suspend:   { title: "Suspend rider",      body: `${rider?.name} will lose app access until reinstated.`,             btn: "Suspend",        bc: C.warn },
    ban:       { title: "Ban permanently",    body: `${rider?.name} will be permanently blocked from UaTob.`,            btn: "Ban",            bc: C.danger },
    delete:    { title: "Delete account",     body: `All data for ${rider?.name} will be erased. This cannot be undone.`,btn: "Delete",         bc: C.danger },
    reinstate: { title: "Reinstate access",   body: `${rider?.name} will regain full access to the platform.`,           btn: "Reinstate",      bc: C.active },
    flag:      { title: "Flag for review",    body: "Add an optional note for the reviewing admin.",                     btn: "Flag",           bc: C.flag,  note: true },
    note:      { title: "Admin note",         body: "Internal only — not visible to the rider.",                         btn: "Save",           bc: C.brandDeep, note: true },
  }[action];
  if (!cfg) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,10,10,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 900, backdropFilter: "blur(8px)", padding: 20 }}>
      <div style={{
        background: C.surface, borderRadius: 20, padding: "28px 28px 24px",
        maxWidth: 420, width: "100%",
        boxShadow: "0 24px 60px rgba(0,0,0,.28)",
        animation: "mIn .25s cubic-bezier(.22,1,.36,1)",
      }}>
        <style>{`@keyframes mIn{from{opacity:0;transform:scale(.96) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>

        <div style={{ fontFamily: serif, fontWeight: 600, fontSize: 22, color: C.ink, letterSpacing: "-.02em", marginBottom: 8, lineHeight: 1.2 }}>
          {cfg.title}
        </div>
        <p style={{ fontFamily: sans, fontSize: 13.5, color: C.ink3, lineHeight: 1.6, margin: "0 0 20px" }}>
          {cfg.body}
        </p>
        {cfg.note && (
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Write a note…"
            rows={3}
            style={{
              width: "100%", boxSizing: "border-box",
              background: C.paperAlt, border: `1px solid ${C.ruleSoft}`,
              borderRadius: 12, padding: "12px 14px",
              fontFamily: sans, fontSize: 13.5, color: C.ink,
              resize: "none", outline: "none", marginBottom: 20,
              lineHeight: 1.5,
            }}
          />
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: "12px 0", borderRadius: 12,
            border: `1px solid ${C.ruleMid}`, background: C.surface,
            color: C.ink2, fontFamily: sans, fontWeight: 600, fontSize: 13.5,
            cursor: "pointer",
          }}>Cancel</button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: "12px 0", borderRadius: 12,
            border: "none", background: cfg.bc, color: "#fff",
            fontFamily: sans, fontWeight: 700, fontSize: 13.5,
            cursor: "pointer",
          }}>{cfg.btn}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Side drawer — editorial reading view ─────────────────────────────────
function Drawer({ rider, onClose, onAction }) {
  if (!rider) return null;
  const tier = getTier(rider);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 700, display: "flex", justifyContent: "flex-end", background: "rgba(10,10,10,.45)", backdropFilter: "blur(6px)" }} onClick={onClose}>
      <div
        style={{
          width: 380, background: C.surface, height: "100%",
          display: "flex", flexDirection: "column", overflow: "hidden",
          boxShadow: "-12px 0 40px rgba(0,0,0,.18)",
          animation: "dIn .28s cubic-bezier(.22,1,.36,1)",
        }}
        onClick={e => e.stopPropagation()}
      >
        <style>{`@keyframes dIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>

        {/* Top bar */}
        <div style={{ padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${C.ruleSoft}` }}>
          <span style={{ fontFamily: mono, fontSize: 10.5, fontWeight: 700, color: C.ink4, letterSpacing: ".12em" }}>
            RIDER · {rider.uid?.slice(0, 8)}
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.ink4, padding: 4, display: "flex" }}>
            <X size={18} />
          </button>
        </div>

        {/* Hero */}
        <div style={{ padding: "32px 24px 28px", borderBottom: `1px solid ${C.ruleSoft}` }}>
          <Avatar name={rider.name} size={72} tier={tier} />
          <div style={{ fontFamily: serif, fontWeight: 600, fontSize: 28, color: C.ink, letterSpacing: "-.025em", lineHeight: 1.1, marginTop: 18 }}>
            {rider.name || "—"}
          </div>
          <div style={{ marginTop: 8 }}>
            <TierBadge tier={tier} rideCount={rider.totalRides ?? 0} />
          </div>

          {/* Inline stats */}
          <div style={{ display: "flex", gap: 0, marginTop: 22, paddingTop: 18, borderTop: `1px solid ${C.ruleSoft}` }}>
            <div style={{ flex: 1, borderRight: `1px solid ${C.ruleSoft}` }}>
              <div style={{ fontFamily: serif, fontSize: 24, fontWeight: 600, color: C.ink, letterSpacing: "-.02em", lineHeight: 1 }}>
                {rider.totalRides ?? 0}
              </div>
              <div style={{ fontFamily: mono, fontSize: 9.5, color: C.ink4, marginTop: 4, letterSpacing: ".1em", textTransform: "uppercase" }}>
                Rides
              </div>
            </div>
            <div style={{ flex: 1, paddingLeft: 18 }}>
              <div style={{ fontFamily: serif, fontSize: 24, fontWeight: 600, color: C.ink, letterSpacing: "-.02em", lineHeight: 1 }}>
                {fmtMoney(rider.lifetimeSpend)}
              </div>
              <div style={{ fontFamily: mono, fontSize: 9.5, color: C.ink4, marginTop: 4, letterSpacing: ".1em", textTransform: "uppercase" }}>
                Lifetime
              </div>
            </div>
          </div>
        </div>

        {/* Details */}
        <div style={{ padding: "20px 24px", flex: 1, overflowY: "auto" }}>

          {rider.adminNote && (
            <div style={{
              background: C.flagSoft, borderLeft: `3px solid ${C.flag}`,
              padding: "14px 16px", marginBottom: 24,
              borderRadius: "0 8px 8px 0",
            }}>
              <div style={{ fontFamily: mono, fontSize: 9.5, fontWeight: 700, color: C.flag, letterSpacing: ".12em", marginBottom: 6 }}>
                ADMIN NOTE
              </div>
              <div style={{ fontFamily: serif, fontSize: 14, color: C.ink2, lineHeight: 1.5, fontStyle: "italic" }}>
                "{rider.adminNote}"
              </div>
            </div>
          )}

          {[
            { label: "Email",         val: rider.email,                         icon: <Mail size={12} /> },
            { label: "Phone",         val: rider.phone || "—",                  icon: <Phone size={12} /> },
            { label: "User ID",       val: rider.uid,                           icon: <Hash size={12} />, mono: true },
            { label: "Joined",        val: fmtDate(rider.createdAt),            icon: <Calendar size={12} /> },
            { label: "Last seen",     val: fmtRelative(rider.updatedAt),        icon: <Clock size={12} /> },
            { label: "Last ride",     val: rider.lastRideAt ? fmtRelative(rider.lastRideAt) : "—", icon: <MapPin size={12} /> },
            { label: "Welcomed",      val: rider.welcomeEmailSent ? "Yes" : "No", icon: <Shield size={12} />, color: rider.welcomeEmailSent ? C.active : C.ink4 },
          ].map((r, i, arr) => (
            <div key={r.label} style={{
              display: "flex", alignItems: "baseline", gap: 16,
              padding: "11px 0",
              borderBottom: i < arr.length - 1 ? `1px solid ${C.ruleSoft}` : "none",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.ink4, width: 90, flexShrink: 0 }}>
                {r.icon}
                <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase" }}>
                  {r.label}
                </span>
              </div>
              <div style={{
                flex: 1,
                fontFamily: r.mono ? mono : sans,
                fontSize: r.mono ? 11 : 13,
                fontWeight: 500,
                color: r.color || C.ink2,
                wordBreak: "break-all",
              }}>
                {r.val || "—"}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 16px", borderTop: `1px solid ${C.ruleSoft}`,
          display: "flex", gap: 8, background: C.paper,
        }}>
          <button onClick={() => onAction("email", rider)} style={{
            flex: 1, padding: "12px 0", borderRadius: 10,
            border: `1px solid ${C.ruleMid}`, background: C.surface,
            color: C.ink2, fontFamily: sans, fontWeight: 600, fontSize: 13,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          }}>
            <Mail size={13} /> Email
          </button>
          <button onClick={() => { onClose(); onAction("open-menu", rider); }} style={{
            flex: 1, padding: "12px 0", borderRadius: 10,
            border: "none", background: C.ink, color: "#fff",
            fontFamily: sans, fontWeight: 700, fontSize: 13,
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          }}>
            More <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────
export function RidersTab({ useriders, onBack }) {
  const rawRiders = (useriders?.riders) || [];
  const [local, setLocal]     = useState({});
  const [search, setSearch]   = useState("");
  const [filter, setFilter]   = useState("all");
  const [drawer, setDrawer]   = useState(null);
  const [menu, setMenu]       = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [noteText, setNote]   = useState("");

  const riders = useMemo(() => rawRiders.map(r => ({
    ...r,
    ...(local[r.uid] || {}),
    status: local[r.uid]?.status || r.status || "active",
  })), [rawRiders, local]);

  const counts = useMemo(() => {
    const c = { all: 0, active: 0, suspended: 0, banned: 0, flagged: 0, vip: 0, dormant: 0 };
    riders.forEach(r => {
      if (local[r.uid]?.deleted) return;
      c.all++;
      if (c[r.status] !== undefined) c[r.status]++;
      const tier = getTier(r);
      if (c[tier] !== undefined) c[tier]++;
    });
    return c;
  }, [riders, local]);

  const filtered = useMemo(() => {
    const visible = riders
      .filter(r => !local[r.uid]?.deleted)
      .filter(r => {
        if (filter === "flagged" && getTier(r) !== "flagged") return false;
        if (filter === "vip" && getTier(r) !== "vip") return false;
        if (filter === "dormant" && getTier(r) !== "dormant") return false;
        if (filter === "suspended" && r.status !== "suspended") return false;
        if (filter === "banned" && r.status !== "banned") return false;
        const q = search.toLowerCase();
        return !q || [r.name, r.email, r.uid, r.phone].some(v => (v || "").toLowerCase().includes(q));
      });
    // Sort by tier priority, then by lifetime spend descending
    return visible.sort((a, b) => {
      const ta = TIER_ORDER.indexOf(getTier(a));
      const tb = TIER_ORDER.indexOf(getTier(b));
      if (ta !== tb) return ta - tb;
      return (b.lifetimeSpend ?? 0) - (a.lifetimeSpend ?? 0);
    });
  }, [riders, local, filter, search]);

  function handleAction(action, rider) {
    if (action === "open-menu") { setDrawer(null); setMenu(rider); return; }
    if (action === "view")      { setMenu(null); setDrawer(rider); return; }
    if (action === "history")   { alert(`Ride history for ${rider.name}`); return; }
    if (action === "email")     { alert(`Email composer for ${rider.email}`); return; }
    if (action === "reset")     { alert(`Password reset sent to ${rider.email}`); return; }
    if (action === "verify")    { setLocal(p => ({ ...p, [rider.uid]: { ...p[rider.uid], welcomeEmailSent: true } })); return; }
    if (action === "export")    { alert(`Exporting data for ${rider.name}…`); return; }
    setNote(rider.adminNote || "");
    setConfirm({ action, rider });
    setMenu(null); setDrawer(null);
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
    setLocal(p => ({ ...p, [rider.uid]: { ...p[rider.uid], ...patch } }));
    setConfirm(null);
  }

  // Filter chips
  const FILTERS = [
    { k: "all",       l: "All",       n: counts.all },
    { k: "flagged",   l: "Flagged",   n: counts.flagged },
    { k: "vip",       l: "VIP",       n: counts.vip },
    { k: "suspended", l: "Suspended", n: counts.suspended },
    { k: "banned",    l: "Banned",    n: counts.banned },
    { k: "dormant",   l: "Dormant",   n: counts.dormant },
  ].filter(f => f.k === "all" || f.n > 0);

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes fUp { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pulseDot { 0%,100% { opacity:1 } 50% { opacity:.35 } }
        ::selection { background: ${C.brandSoft}; color: ${C.brandDeep}; }
      `}</style>

      <div style={{
        background: C.paper, minHeight: "100vh",
        fontFamily: sans,
        WebkitFontSmoothing: "antialiased",
        fontFeatureSettings: "'ss01','cv11'",
      }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px 20px 60px" }}>

          {/* Top nav row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
            {onBack ? (
              <button onClick={onBack} style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "none", border: "none", cursor: "pointer",
                color: C.ink3, fontSize: 13, fontWeight: 600, padding: 0,
                fontFamily: sans,
              }}>
                <ArrowLeft size={14} /> Back
              </button>
            ) : <div />}
            {counts.all > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: mono, fontSize: 10, color: C.brand, fontWeight: 700, letterSpacing: ".12em" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.brand, animation: "pulseDot 2s ease-in-out infinite" }} />
                LIVE
              </div>
            )}
          </div>

          {/* Editorial masthead */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", borderBottom: `2px solid ${C.rule}`, paddingBottom: 14 }}>
              <h1 style={{
                fontFamily: serif, fontWeight: 600,
                fontSize: 56, letterSpacing: "-.04em",
                color: C.ink, margin: 0, lineHeight: 1,
              }}>
                Riders
              </h1>
              <div style={{ fontFamily: mono, fontSize: 11, color: C.ink4, fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase" }}>
                {fmtDate(new Date())}
              </div>
            </div>

            {/* Subhead — single hero stat with inline secondaries */}
            <div style={{
              display: "flex", alignItems: "baseline", gap: 24,
              marginTop: 20, flexWrap: "wrap",
            }}>
              <div>
                <div style={{
                  fontFamily: serif, fontSize: 72, fontWeight: 600,
                  color: C.ink, letterSpacing: "-.04em", lineHeight: .9,
                  fontFeatureSettings: "'tnum'",
                }}>
                  {counts.all}
                </div>
                <div style={{ fontFamily: mono, fontSize: 10.5, color: C.ink4, marginTop: 6, letterSpacing: ".14em", fontWeight: 600 }}>
                  TOTAL RIDERS
                </div>
              </div>

              <div style={{ display: "flex", gap: 20, paddingLeft: 24, borderLeft: `1px solid ${C.ruleSoft}`, alignSelf: "stretch", alignItems: "center" }}>
                {[
                  { l: "ACTIVE",    n: counts.active,    c: C.active },
                  { l: "VIP",       n: counts.vip,       c: C.brandDeep },
                  { l: "FLAGGED",   n: counts.flagged,   c: C.flag },
                  { l: "SUSPENDED", n: counts.suspended, c: C.warn },
                  { l: "BANNED",    n: counts.banned,    c: C.danger },
                ].map((s) => (
                  <div key={s.l}>
                    <div style={{ fontFamily: serif, fontSize: 22, fontWeight: 600, color: s.c, letterSpacing: "-.02em", lineHeight: 1 }}>
                      {s.n}
                    </div>
                    <div style={{ fontFamily: mono, fontSize: 9, color: C.ink4, marginTop: 5, letterSpacing: ".12em", fontWeight: 600 }}>
                      {s.l}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Search — full width, editorial input */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: C.surface, border: `1px solid ${C.ruleSoft}`,
            borderRadius: 12, padding: "0 16px", height: 46,
            marginBottom: 16,
            transition: "border-color .18s",
          }}>
            <Search size={15} color={C.ink4} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email, phone, or ID…"
              style={{ flex: 1, background: "none", border: "none", outline: "none", color: C.ink, fontFamily: sans, fontSize: 13.5, fontWeight: 500 }}
            />
            {search && (
              <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: C.ink4, display: "flex", padding: 0 }}>
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filter chips — single tap */}
          <div style={{ display: "flex", gap: 6, marginBottom: 24, overflowX: "auto", paddingBottom: 4 }}>
            {FILTERS.map(f => (
              <button
                key={f.k}
                onClick={() => setFilter(f.k)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  background: filter === f.k ? C.ink : C.surface,
                  color: filter === f.k ? "#fff" : C.ink3,
                  border: `1px solid ${filter === f.k ? C.ink : C.ruleSoft}`,
                  borderRadius: 99, padding: "7px 14px",
                  fontFamily: sans, fontSize: 12.5, fontWeight: 600,
                  cursor: "pointer", whiteSpace: "nowrap",
                  transition: "all .15s",
                }}
              >
                {f.l}
                <span style={{ fontFamily: mono, fontSize: 11, opacity: filter === f.k ? .7 : .5, fontWeight: 500 }}>
                  {f.n}
                </span>
              </button>
            ))}
          </div>

          {/* Section header */}
          {filtered.length > 0 && (
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "baseline",
              borderBottom: `1px solid ${C.ruleSoft}`, paddingBottom: 10, marginBottom: 6,
            }}>
              <span style={{ fontFamily: mono, fontSize: 10.5, fontWeight: 700, color: C.ink4, letterSpacing: ".12em" }}>
                NAME
              </span>
              <span style={{ fontFamily: mono, fontSize: 10.5, fontWeight: 700, color: C.ink4, letterSpacing: ".12em" }}>
                RIDES · LIFETIME
              </span>
            </div>
          )}

          {/* Empty state */}
          {!useriders?.loading && filtered.length === 0 && (
            <div style={{
              textAlign: "center", padding: "80px 20px",
              border: `1px dashed ${C.ruleMid}`, borderRadius: 16,
              background: C.paper,
            }}>
              <Inbox size={32} color={C.ink5} style={{ marginBottom: 12 }} />
              <div style={{ fontFamily: serif, fontWeight: 600, fontSize: 18, color: C.ink2, marginBottom: 4, letterSpacing: "-.02em" }}>
                {search ? "Nothing matches" : "No riders yet"}
              </div>
              <div style={{ fontFamily: sans, fontSize: 13, color: C.ink4 }}>
                {search ? `Try a different search term` : "Riders will appear here once they sign up"}
              </div>
            </div>
          )}

          {/* Error */}
          {useriders?.error && (
            <div style={{ background: C.dangerSoft, borderLeft: `3px solid ${C.danger}`, borderRadius: "0 8px 8px 0", padding: "12px 16px", color: C.danger, fontSize: 13, marginBottom: 12, display: "flex", gap: 8, alignItems: "center", fontFamily: sans }}>
              <AlertTriangle size={14} /> {useriders.error.message ?? "Failed to load riders"}
            </div>
          )}

          {/* Rider list — editorial rows */}
          <div>
            {filtered.map((rider, i) => {
              const tier = getTier(rider);
              const isFlagged = tier === "flagged";
              const isVip = tier === "vip";
              return (
                <div
                  key={rider.uid}
                  onClick={() => setDrawer(rider)}
                  style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "14px 8px",
                    borderBottom: `1px solid ${C.ruleSoft}`,
                    cursor: "pointer",
                    animation: `fUp .25s ease ${i * 0.025}s both`,
                    transition: "background .12s",
                    position: "relative",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = C.paperAlt}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  {/* VIP/flag stripe */}
                  {(isFlagged || isVip) && (
                    <div style={{
                      position: "absolute", left: 0, top: "20%", bottom: "20%",
                      width: 2, borderRadius: 99,
                      background: isFlagged ? C.flag : C.brand,
                    }} />
                  )}

                  <Avatar name={rider.name} size={44} tier={tier} />

                  {/* Center — name + meta */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
                      <span style={{
                        fontFamily: serif, fontWeight: 600, fontSize: 16,
                        color: C.ink, letterSpacing: "-.015em",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        maxWidth: 220,
                      }}>
                        {rider.name || "—"}
                      </span>
                      <TierBadge tier={tier} rideCount={rider.totalRides ?? 0} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: C.ink4, fontFamily: sans, fontWeight: 500 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
                        {rider.email}
                      </span>
                      <span style={{ color: C.ink5 }}>·</span>
                      <span style={{ fontFamily: mono, fontSize: 11 }}>
                        {fmtRelative(rider.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Right — ride count + lifetime */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{
                      fontFamily: serif, fontSize: 18, fontWeight: 600,
                      color: (rider.totalRides ?? 0) > 0 ? C.ink : C.ink5,
                      letterSpacing: "-.01em", lineHeight: 1,
                    }}>
                      {rider.totalRides ?? 0}
                    </div>
                    <div style={{
                      fontFamily: mono, fontSize: 10.5,
                      color: (rider.lifetimeSpend ?? 0) > 0 ? C.brandDeep : C.ink5,
                      marginTop: 4, fontWeight: 600,
                    }}>
                      {fmtMoney(rider.lifetimeSpend)}
                    </div>
                  </div>

                  <button
                    onClick={e => { e.stopPropagation(); setMenu(rider); }}
                    style={{
                      background: "transparent", border: "none",
                      padding: 8, cursor: "pointer", color: C.ink4,
                      display: "flex", flexShrink: 0,
                      borderRadius: 8, transition: "background .12s, color .12s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = C.surface; e.currentTarget.style.color = C.ink; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = C.ink4; }}
                  >
                    <MoreHorizontal size={16} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Footer count */}
          {filtered.length > 0 && (
            <div style={{ textAlign: "center", fontFamily: mono, fontSize: 10.5, color: C.ink4, marginTop: 28, fontWeight: 600, letterSpacing: ".08em" }}>
              SHOWING {filtered.length} OF {counts.all}
              {search && ` · "${search}"`}
              {filter !== "all" && ` · ${filter.toUpperCase()}`}
            </div>
          )}
        </div>
      </div>

      {drawer  && <Drawer       rider={drawer}          onClose={() => setDrawer(null)} onAction={handleAction} />}
      {menu    && <ActionsMenu  rider={menu}            onClose={() => setMenu(null)}   onAction={handleAction} />}
      {confirm && <ConfirmModal action={confirm.action} rider={confirm.rider} note={noteText} setNote={setNote} onConfirm={handleConfirm} onCancel={() => setConfirm(null)} />}
    </>
  );
}

export default RidersTab;
