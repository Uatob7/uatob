import { useState, useMemo } from "react";
import {
  ArrowLeft, Search, X, Eye, UserCheck, Trash2,
  AlertTriangle, Mail, Hash, Calendar, Shield, ChevronDown,
  Lock, Flag, FileText, Download, RotateCcw,
  CheckCircle, Clock, Ban, Users, Activity, Sparkles,
  MoreHorizontal, ChevronRight, MapPin, Inbox, BellRing,
} from "lucide-react";
import resetPassword from "@/firebase/auth/passwordReset";

// ─── Tokens ───────────────────────────────────────────────────────────────────
const C = {
  bg:          "#FAFAFA",
  bgSubtle:    "#F4F4F5",
  surface:     "#FFFFFF",
  border:      "rgba(0,0,0,.06)",
  borderMid:   "rgba(0,0,0,.10)",
  borderStrong:"rgba(0,0,0,.16)",

  ink:         "#09090B",
  ink2:        "#27272A",
  ink3:        "#52525B",
  ink4:        "#71717A",
  ink5:        "#A1A1AA",

  green:       "#16A34A",
  greenSoft:   "#DCFCE7",
  greenBg:     "#F0FDF4",

  blue:        "#2563EB",
  blueSoft:    "#DBEAFE",
  blueBg:      "#EFF6FF",

  amber:       "#D97706",
  amberSoft:   "#FEF3C7",
  amberBg:     "#FFFBEB",

  red:         "#DC2626",
  redSoft:     "#FEE2E2",
  redBg:       "#FEF2F2",

  violet:      "#7C3AED",
  violetSoft:  "#EDE9FE",
  violetBg:    "#F5F3FF",

  shadow:      "0 1px 2px rgba(0,0,0,.04), 0 4px 12px rgba(0,0,0,.04)",
  shadowMd:    "0 1px 3px rgba(0,0,0,.06), 0 8px 24px rgba(0,0,0,.06)",
  shadowLg:    "0 12px 40px rgba(0,0,0,.12), 0 2px 8px rgba(0,0,0,.06)",
};
const font = "'Inter', system-ui, sans-serif";
const mono = "'JetBrains Mono', monospace";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(ts) {
  if (!ts) return "—";
  const date = ts?.toDate?.() ?? (ts?.seconds ? new Date(ts.seconds * 1000) : new Date(ts));
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtRelative(ts) {
  if (!ts) return "—";
  const date = ts?.toDate?.() ?? (ts?.seconds ? new Date(ts.seconds * 1000) : new Date(ts));
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800)return `${Math.floor(diff / 86400)}d ago`;
  return fmtDate(ts);
}
function initials(name) {
  return (name || "?").trim().split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
}

const ACOLORS = [
  ["#DCFCE7", "#15803D"],
  ["#DBEAFE", "#1D4ED8"],
  ["#FEF3C7", "#92400E"],
  ["#EDE9FE", "#6D28D9"],
  ["#FCE7F3", "#BE185D"],
  ["#CFFAFE", "#0E7490"],
];
function acolor(name) {
  return ACOLORS[(name || "?").charCodeAt(0) % ACOLORS.length];
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ name, size = 42 }) {
  const [bg, fg] = acolor(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: 12,
      background: bg, color: fg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: font, fontWeight: 700, fontSize: size * 0.34,
      flexShrink: 0, userSelect: "none",
      letterSpacing: "-.02em",
    }}>
      {initials(name)}
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function Badge({ status }) {
  const m = {
    active:    { l: "Active",    bg: C.greenBg,  c: C.green,  border: C.greenSoft  },
    suspended: { l: "Suspended", bg: C.amberBg,  c: C.amber,  border: C.amberSoft  },
    banned:    { l: "Banned",    bg: C.redBg,    c: C.red,    border: C.redSoft    },
  };
  const s = m[status] || m.active;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 8px", borderRadius: 6,
      background: s.bg, color: s.c,
      border: `1px solid ${s.border}`,
      fontFamily: font, fontSize: 10.5, fontWeight: 600,
      letterSpacing: ".01em",
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.c, boxShadow: `0 0 5px ${s.c}88` }} />
      {s.l}
    </span>
  );
}

// ─── Actions catalogue ────────────────────────────────────────────────────────
const ACTIONS = [
  { id: "view",      label: "View Profile",        icon: <Eye size={15} />,           color: C.blue,   bg: C.blueBg,    group: "info",    desc: "Full rider details" },
  { id: "history",   label: "Ride History",        icon: <Clock size={15} />,         color: C.blue,   bg: C.blueBg,    group: "info",    desc: "All past trips and fares" },
  { id: "email",     label: "Send Email",          icon: <Mail size={15} />,          color: C.violet, bg: C.violetBg,  group: "comms",   desc: "Compose direct email" },
  { id: "note",      label: "Add Admin Note",      icon: <FileText size={15} />,      color: C.violet, bg: C.violetBg,  group: "comms",   desc: "Private internal note" },
  { id: "reset",     label: "Send Password Reset", icon: <Lock size={15} />,          color: C.amber,  bg: C.amberBg,   group: "account", desc: "Email password reset link" },
  { id: "verify",    label: "Mark as Verified",    icon: <CheckCircle size={15} />,   color: C.green,  bg: C.greenBg,   group: "account", desc: "Manually verify email" },
  { id: "export",    label: "Export Data",         icon: <Download size={15} />,      color: C.amber,  bg: C.amberBg,   group: "account", desc: "GDPR data export (JSON)" },
  { id: "flag",      label: "Flag for Review",     icon: <Flag size={15} />,          color: C.amber,  bg: C.amberBg,   group: "mod",     desc: "Escalate to senior admin" },
  { id: "suspend",   label: "Suspend Account",     icon: <AlertTriangle size={15} />, color: C.amber,  bg: C.amberBg,   group: "mod",     desc: "Temporary access removal" },
  { id: "reinstate", label: "Reinstate Access",    icon: <UserCheck size={15} />,     color: C.green,  bg: C.greenBg,   group: "mod",     desc: "Restore full access" },
  { id: "ban",       label: "Ban Permanently",     icon: <Ban size={15} />,           color: C.red,    bg: C.redBg,     group: "mod",     desc: "Permanent platform block" },
  { id: "delete",    label: "Delete Account",      icon: <Trash2 size={15} />,        color: C.red,    bg: C.redBg,     group: "mod",     desc: "Erase all data — irreversible" },
];
const GROUPS = [
  { k: "info",    l: "Information"   },
  { k: "comms",   l: "Communication" },
  { k: "account", l: "Account"       },
  { k: "mod",     l: "Moderation"    },
];

// ─── Bottom-sheet action menu ─────────────────────────────────────────────────
function ActionsMenu({ rider, onClose, onAction }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 800, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(9,9,11,.5)", backdropFilter: "blur(6px)" }} onClick={onClose}>
      <div
        style={{
          background: C.surface, borderRadius: "20px 20px 0 0",
          width: "100%", maxWidth: 520, maxHeight: "88vh",
          overflow: "hidden", display: "flex", flexDirection: "column",
          boxShadow: "0 -16px 48px rgba(0,0,0,.18)",
          animation: "sUp .24s cubic-bezier(.22,1,.36,1)",
        }}
        onClick={e => e.stopPropagation()}
      >
        <style>{`@keyframes sUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>

        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
          <div style={{ width: 36, height: 4, borderRadius: 99, background: C.borderMid }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px 18px", borderBottom: `1px solid ${C.border}` }}>
          <Avatar name={rider.name} size={44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: font, fontWeight: 700, fontSize: 15, color: C.ink, letterSpacing: "-.01em" }}>{rider.name || "—"}</div>
            <div style={{ fontFamily: font, fontSize: 12.5, color: C.ink4, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rider.email}</div>
          </div>
          <Badge status={rider.status} />
        </div>

        <div style={{ overflowY: "auto", padding: "8px 14px 28px" }}>
          {GROUPS.map(grp => {
            const items = ACTIONS.filter(a => {
              if (a.group !== grp.k) return false;
              if (a.id === "reinstate") return rider.status === "suspended" || rider.status === "banned";
              if (a.id === "suspend")   return rider.status === "active";
              if (a.id === "ban")       return rider.status !== "banned";
              return true;
            });
            if (!items.length) return null;
            return (
              <div key={grp.k}>
                <div style={{ fontFamily: font, fontSize: 10.5, fontWeight: 700, color: C.ink4, textTransform: "uppercase", letterSpacing: ".06em", padding: "14px 8px 8px" }}>{grp.l}</div>
                {items.map(a => (
                  <button
                    key={a.id}
                    onClick={() => { onClose(); onAction(a.id, rider); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      width: "100%", padding: "10px 8px", borderRadius: 10,
                      border: "none", background: "none", cursor: "pointer",
                      textAlign: "left", transition: "background .15s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = a.bg}
                    onMouseLeave={e => e.currentTarget.style.background = "none"}
                  >
                    <div style={{ width: 38, height: 38, borderRadius: 11, background: a.bg, display: "flex", alignItems: "center", justifyContent: "center", color: a.color, flexShrink: 0 }}>{a.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: font, fontWeight: 600, fontSize: 13.5, color: (a.id === "delete" || a.id === "ban") ? C.red : C.ink }}>{a.label}</div>
                      <div style={{ fontFamily: font, fontSize: 11.5, color: C.ink4, marginTop: 1 }}>{a.desc}</div>
                    </div>
                    <ChevronRight size={14} color={C.ink5} />
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Confirm / input modal ────────────────────────────────────────────────────
function ConfirmModal({ action, rider, note, setNote, onConfirm, onCancel }) {
  const cfg = {
    suspend:   { icon: <AlertTriangle size={20} />, title: "Suspend Rider",    body: `${rider?.name} will lose app access until reinstated.`,        btn: "Suspend",         bc: C.amber, bt: "#fff" },
    ban:       { icon: <Ban size={20} />,           title: "Ban Permanently",  body: `${rider?.name} will be permanently blocked from UaTob.`,       btn: "Ban Permanently", bc: C.red,   bt: "#fff" },
    delete:    { icon: <Trash2 size={20} />,        title: "Delete Account",   body: `All data for ${rider?.name} will be erased. Cannot be undone.`,btn: "Delete Account",  bc: C.red,   bt: "#fff" },
    reinstate: { icon: <UserCheck size={20} />,     title: "Reinstate Access", body: `${rider?.name} will regain full access to the platform.`,      btn: "Reinstate",       bc: C.green, bt: "#fff" },
    flag:      { icon: <Flag size={20} />,          title: "Flag for Review",  body: "Add an optional note for the reviewing admin.",                btn: "Flag Rider",      bc: C.amber, bt: "#fff", note: true },
    note:      { icon: <FileText size={20} />,      title: "Admin Note",       body: "Internal only — not visible to the rider.",                    btn: "Save Note",       bc: C.green, bt: "#fff", note: true },
  }[action];
  if (!cfg) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(9,9,11,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 900, backdropFilter: "blur(6px)", padding: 20, animation: "fIn .15s ease" }}>
      <style>{`@keyframes fIn{from{opacity:0}to{opacity:1}}@keyframes mIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}`}</style>
      <div style={{ background: C.surface, borderRadius: 18, padding: 24, maxWidth: 380, width: "100%", boxShadow: C.shadowLg, animation: "mIn .22s cubic-bezier(.22,1,.36,1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ background: cfg.bc + "18", border: `1px solid ${cfg.bc}30`, borderRadius: 11, width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", color: cfg.bc }}>{cfg.icon}</div>
          <span style={{ fontFamily: font, fontWeight: 700, fontSize: 16, color: C.ink, letterSpacing: "-.01em" }}>{cfg.title}</span>
        </div>
        <p style={{ fontFamily: font, fontSize: 13, color: C.ink3, lineHeight: 1.6, margin: "0 0 16px" }}>{cfg.body}</p>
        {cfg.note && (
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Write a note…"
            rows={3}
            style={{ width: "100%", boxSizing: "border-box", background: C.bgSubtle, border: `1px solid ${C.borderMid}`, borderRadius: 10, padding: "10px 12px", fontFamily: font, fontSize: 13, color: C.ink, resize: "none", outline: "none", marginBottom: 16 }}
          />
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: `1px solid ${C.borderMid}`, background: C.surface, color: C.ink2, fontFamily: font, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: cfg.bc, color: cfg.bt, fontFamily: font, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{cfg.btn}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Side drawer ──────────────────────────────────────────────────────────────
function Drawer({ rider, rides = [], onClose, onAction }) {
  if (!rider) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 700, display: "flex", justifyContent: "flex-end", background: "rgba(9,9,11,.4)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div
        style={{
          width: 340, background: C.surface, height: "100%",
          borderLeft: `1px solid ${C.border}`,
          display: "flex", flexDirection: "column", overflow: "hidden",
          boxShadow: "-8px 0 32px rgba(0,0,0,.1)",
          animation: "dIn .24s cubic-bezier(.22,1,.36,1)",
        }}
        onClick={e => e.stopPropagation()}
      >
        <style>{`@keyframes dIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>

        {/* Hero */}
        <div style={{
          background: "linear-gradient(135deg,#0F172A,#1E293B)",
          padding: "20px 20px 22px", color: "#fff",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,.04)" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, position: "relative" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.5)", letterSpacing: ".06em", textTransform: "uppercase" }}>Rider Profile</div>
            <button onClick={onClose} style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 8, padding: 6, cursor: "pointer", color: "rgba(255,255,255,.7)", display: "flex" }}>
              <X size={15} />
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative" }}>
            <Avatar name={rider.name} size={54} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: font, fontWeight: 700, fontSize: 17, letterSpacing: "-.02em", marginBottom: 4 }}>{rider.name || "—"}</div>
              <Badge status={rider.status} />
            </div>
          </div>
        </div>

        {/* Details */}
        <div style={{ padding: "18px", flex: 1, overflowY: "auto" }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: C.ink4, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 10 }}>Account Details</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0, background: C.bgSubtle, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
            {[
              { icon: <Mail size={13} />,     label: "Email",       val: rider.email },
              { icon: <Hash size={13} />,     label: "User ID",     val: rider.uid, mono: true },
              { icon: <Calendar size={13} />, label: "Joined",      val: fmtDate(rider.createdAt) },
              { icon: <Clock size={13} />,    label: "Last Update", val: fmtRelative(rider.updatedAt) },
              { icon: <Users size={13} />,    label: "Total Rides",  val: rides.filter(r => r.uid === rider.uid || r.uid === rider.id).length, color: C.blue },
              { icon: <Shield size={13} />,   label: "Welcome Email Sent", val: rider.welcomeEmailSent ? "Yes" : "No", color: rider.welcomeEmailSent ? C.green : C.amber },
              { icon: <BellRing size={13} />, label: "Admin Notified", val: rider.adminNotified ? "Yes" : "No", color: rider.adminNotified ? C.green : C.ink4 },
            ].map((r, i, arr) => (
              <div key={r.label} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 13px", borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none" }}>
                <div style={{ color: C.ink4, marginTop: 1, flexShrink: 0 }}>{r.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: font, fontSize: 10.5, fontWeight: 600, color: C.ink4, letterSpacing: ".02em", textTransform: "uppercase" }}>{r.label}</div>
                  <div style={{ fontFamily: r.mono ? mono : font, fontSize: r.mono ? 10.5 : 12.5, color: r.color || C.ink, marginTop: 2, wordBreak: "break-all", fontWeight: 500 }}>{r.val || "—"}</div>
                </div>
              </div>
            ))}
          </div>

          {rider.adminNote && (
            <>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: C.ink4, letterSpacing: ".06em", textTransform: "uppercase", margin: "18px 0 10px" }}>Admin Note</div>
              <div style={{ background: C.amberBg, border: `1px solid ${C.amberSoft}`, borderRadius: 10, padding: "11px 13px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                  <Flag size={11} color={C.amber} />
                  <div style={{ fontFamily: font, fontSize: 10, fontWeight: 700, color: C.amber, letterSpacing: ".04em", textTransform: "uppercase" }}>Flagged</div>
                </div>
                <div style={{ fontFamily: font, fontSize: 12.5, color: C.ink2, lineHeight: 1.5 }}>{rider.adminNote}</div>
              </div>
            </>
          )}
        </div>

        {/* Footer actions */}
        <div style={{ padding: 14, borderTop: `1px solid ${C.border}`, display: "flex", gap: 8, background: C.bgSubtle }}>
          <button onClick={() => onAction("note", rider)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${C.borderMid}`, background: C.surface, color: C.ink2, fontFamily: font, fontWeight: 600, fontSize: 12.5, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <FileText size={13} /> Note
          </button>
          <button onClick={() => { onClose(); onAction("open-menu", rider); }} style={{ flex: 2, padding: "10px 0", borderRadius: 10, border: "none", background: C.ink, color: "#fff", fontFamily: font, fontWeight: 700, fontSize: 12.5, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <MoreHorizontal size={13} /> All Actions
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color, sub, delay = 0 }) {
  return (
    <div
      style={{
        background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`,
        padding: "16px", position: "relative", overflow: "hidden",
        animation: `fUp .35s cubic-bezier(.22,1,.36,1) ${delay}ms both`,
        transition: "border-color .15s, box-shadow .15s",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderMid; e.currentTarget.style.boxShadow = C.shadowMd; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = "none"; }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: color, opacity: .85 }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: color + "12", border: `1px solid ${color}25`, display: "flex", alignItems: "center", justifyContent: "center", color }}>
          {icon}
        </div>
      </div>
      <div style={{ fontFamily: font, fontSize: 24, fontWeight: 800, color: C.ink, letterSpacing: "-.03em", lineHeight: 1, fontFeatureSettings: "'tnum'", marginBottom: 5 }}>{value}</div>
      <div style={{ fontFamily: font, fontSize: 11, color: C.ink4, fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontFamily: font, fontSize: 10.5, color: C.ink5, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ─── Ride History Modal ───────────────────────────────────────────────────────
function RideHistoryModal({ rider, rides, onClose }) {
  if (!rides || rides.length === 0) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(9,9,11,.55)", backdropFilter: "blur(6px)", padding: 20 }} onClick={onClose}>
        <div style={{ background: C.surface, borderRadius: 18, padding: 24, maxWidth: 420, width: "100%", boxShadow: C.shadowLg }} onClick={e => e.stopPropagation()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontFamily: font, fontWeight: 700, fontSize: 16, color: C.ink, margin: 0 }}>Ride History</h3>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.ink4, display: "flex", padding: 0 }}>
              <X size={18} />
            </button>
          </div>
          <div style={{ textAlign: "center", padding: "32px 20px" }}>
            <Inbox size={40} color={C.ink5} style={{ margin: "0 auto 16px" }} />
            <p style={{ fontFamily: font, fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 6 }}>No rides yet</p>
            <p style={{ fontFamily: font, fontSize: 13, color: C.ink4 }}>{rider.name} hasn't completed any rides</p>
          </div>
        </div>
      </div>
    );
  }

  const getStatusColor = (status) => {
    const statusMap = {
      'completed': { bg: C.greenBg, color: C.green, label: 'Completed' },
      'cancelled': { bg: C.redBg, color: C.red, label: 'Cancelled' },
      'in_progress': { bg: C.blueBg, color: C.blue, label: 'In Progress' },
      'pending': { bg: C.amberBg, color: C.amber, label: 'Pending' },
    };
    return statusMap[status] || { bg: C.bgSubtle, color: C.ink4, label: status };
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(9,9,11,.55)", backdropFilter: "blur(6px)", padding: 20 }} onClick={onClose}>
      <div style={{ background: C.surface, borderRadius: 18, maxWidth: 560, width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: C.shadowLg, overflow: "hidden, animation: 'mIn .22s cubic-bezier(.22,1,.36,1)'" }} onClick={e => e.stopPropagation()}>
        <style>{`@keyframes mIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}@keyframes fUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
        
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: `1px solid ${C.border}`, background: "linear-gradient(135deg,#0F172A,#1E293B)" }}>
          <div style={{ color: "#fff" }}>
            <h3 style={{ fontFamily: font, fontWeight: 800, fontSize: 18, color: "#fff", margin: 0, letterSpacing: "-.02em" }}>Ride History</h3>
            <p style={{ fontFamily: font, fontSize: 12, color: "rgba(255,255,255,.6)", margin: "4px 0 0", fontWeight: 500 }}>
              {rider.name} — <strong style={{ color: "#fff" }}>{rides.length}</strong> ride{rides.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 8, padding: 6, cursor: "pointer", color: "rgba(255,255,255,.7)", display: "flex" }}>
            <X size={18} />
          </button>
        </div>

        {/* Rides list */}
        <div style={{ overflowY: "auto", padding: "16px" }}>
          {rides.map((ride, i) => {
            const statusInfo = getStatusColor(ride.status);
            const distance = parseFloat(ride.tripDistanceMiles || 0).toFixed(1);
            const fare = ride.fareBreakdown?.fareTotal ? parseFloat(ride.fareBreakdown.fareTotal).toFixed(2) : '—';
            const duration = ride.tripDurationMin ? `${ride.tripDurationMin} min` : '—';
            
            return (
              <div 
                key={ride.id || i} 
                style={{
                  background: C.bgSubtle, 
                  border: `1px solid ${C.border}`, 
                  borderRadius: 14,
                  padding: "16px", 
                  marginBottom: 12,
                  display: "flex", 
                  gap: 14,
                  animation: `fUp .3s ease ${i * 0.05}s both`,
                  transition: "all .2s ease"
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderMid; e.currentTarget.style.background = C.surface; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.bgSubtle; }}
              >
                {/* Status Icon */}
                <div style={{ 
                  width: 44, 
                  height: 44, 
                  borderRadius: 12, 
                  background: statusInfo.bg, 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  color: statusInfo.color,
                  flexShrink: 0
                }}>
                  <MapPin size={20} />
                </div>

                {/* Ride Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Route */}
                  <div style={{ fontFamily: font, fontWeight: 700, fontSize: 14, color: C.ink, marginBottom: 8, letterSpacing: "-.01em" }}>
                    {ride.pickupCity} → {ride.dropoffCity}
                  </div>

                  {/* Meta Info */}
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <Calendar size={12} color={C.ink4} />
                      <span style={{ fontFamily: mono, fontSize: 11, color: C.ink4, fontWeight: 500 }}>
                        {fmtDate(ride.createdAt)}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <MapPin size={12} color={C.ink4} />
                      <span style={{ fontFamily: mono, fontSize: 11, color: C.ink4, fontWeight: 500 }}>
                        {distance} mi
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <Clock size={12} color={C.ink4} />
                      <span style={{ fontFamily: mono, fontSize: 11, color: C.ink4, fontWeight: 500 }}>
                        {duration}
                      </span>
                    </div>
                  </div>

                  {/* Status + Fare */}
                  <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ 
                      display: "inline-flex", 
                      alignItems: "center", 
                      gap: 5,
                      padding: "4px 10px", 
                      borderRadius: 6,
                      background: statusInfo.bg, 
                      color: statusInfo.color,
                      fontFamily: font,
                      fontSize: 10.5,
                      fontWeight: 700,
                      textTransform: "capitalize",
                      letterSpacing: ".02em"
                    }}>
                      <span style={{ width: 4, height: 4, borderRadius: "50%", background: statusInfo.color }} />
                      {statusInfo.label}
                    </span>
                    
                    <span style={{
                      fontFamily: mono,
                      fontSize: 13,
                      fontWeight: 700,
                      color: C.green
                    }}>
                      ${fare}
                    </span>
                  </div>
                </div>

                {/* Payout (if available) */}
                {ride.driverPayout && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                    <div style={{ fontFamily: mono, fontSize: 10.5, color: C.ink4, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" }}>Driver</div>
                    <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: C.amber }}>
                      ${parseFloat(ride.driverPayout).toFixed(2)}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary Footer */}
        {rides.length > 0 && (
          <div style={{ padding: "14px 16px", borderTop: `1px solid ${C.border}`, background: C.bgSubtle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontFamily: font, fontSize: 11, color: C.ink4, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" }}>
              Summary
            </div>
            <div style={{ display: "flex", gap: 20 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: mono, fontSize: 11, color: C.ink4, fontWeight: 500 }}>Total Distance</div>
                <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: C.ink, marginTop: 2 }}>
                  {rides.reduce((sum, r) => sum + parseFloat(r.tripDistanceMiles || 0), 0).toFixed(1)} mi
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: mono, fontSize: 11, color: C.ink4, fontWeight: 500 }}>Total Fare</div>
                <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: C.green, marginTop: 2 }}>
                  ${rides.reduce((sum, r) => sum + parseFloat(r.fareBreakdown?.fareTotal || 0), 0).toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function RidersTab({ useriders, rideUids, rides = [], onBack }) {
  const rawRiders = (useriders?.riders) || [];
  const [local, setLocal]       = useState({});
  const [search, setSearch]     = useState("");
  const [filter, setFilter]     = useState("all");
  const [fOpen, setFOpen]       = useState(false);
  const [drawer, setDrawer]     = useState(null);
  const [menu, setMenu]         = useState(null);
  const [confirm, setConfirm]   = useState(null);
  const [rideHistory, setRideHistory] = useState(null);
  const [noteText, setNote]     = useState("");

  // Find orphaned UIDs (rides with UIDs that don't have a corresponding rider)
  const orphanedUids = useMemo(() => {
    const riderIds = new Set(rawRiders.map(r => r.id).filter(Boolean));
    const riderUids = new Set(rawRiders.map(r => r.uid).filter(Boolean));
    const uniqueRideUids = new Set(rides.map(r => r.uid).filter(Boolean));
    
    const orphaned = [];
    uniqueRideUids.forEach(uid => {
      if (!riderIds.has(uid) && !riderUids.has(uid)) {
        const rideCount = rides.filter(r => r.uid === uid).length;
        orphaned.push({
          id: uid,
          uid: uid,
          name: "Unknown Account",
          email: "—",
          status: "active",
          isOrphaned: true,
          rideCount: rideCount,
          createdAt: rides.find(r => r.uid === uid)?.createdAt || null,
        });
      }
    });
    return orphaned;
  }, [rawRiders, rides]);

  // Combine real riders with orphaned UIDs
  const allRidersData = useMemo(() => [...rawRiders, ...orphanedUids], [rawRiders, orphanedUids]);

  const riders = useMemo(() => allRidersData.map(r => ({
    ...r,
    ...(local[r.id] || {}),
    status: local[r.id]?.status || r.status || "active",
  })), [allRidersData, local]);

  const counts = useMemo(() => {
    const c = { all: 0, active: 0, suspended: 0, banned: 0 };
    riders.forEach(r => {
      if (local[r.id]?.deleted) return;
      c.all++;
      if (c[r.status] !== undefined) c[r.status]++;
    });
    return c;
  }, [riders, local]);

  const totalRides = useMemo(() => rides.length, [rides]);

  const filtered = useMemo(() => riders
    .filter(r => !local[r.id]?.deleted)
    .filter(r => {
      if (filter !== "all" && r.status !== filter) return false;
      const q = search.toLowerCase();
      return !q || [r.name, r.email, r.id].some(v => (v || "").toLowerCase().includes(q));
    }), [riders, local, filter, search]);

  // Get rides for the currently viewed rider
  const riderRides = useMemo(() => {
    if (!rideHistory || !rides.length) return [];
    const riderId = rideHistory.uid || rideHistory.id;
    if (!riderId) return [];
    return rides.filter(r => r.uid === riderId);
  }, [rideHistory, rides]);

  function handleAction(action, rider) {
    if (action === "open-menu") { setDrawer(null); setMenu(rider); return; }
    if (action === "view")      { setMenu(null); setDrawer(rider); return; }
    if (action === "history")   { 
      setMenu(null); 
      setDrawer(null);
      setRideHistory(rider); 
      return; 
    }
    if (action === "email")     { alert(`Email composer for ${rider.email}`); return; }
    if (action === "reset")     { 
      handlePasswordReset(rider);
      return;
    }
    if (action === "verify")    { setLocal(p => ({ ...p, [rider.uid]: { ...p[rider.uid], welcomeEmailSent: true } })); return; }
    if (action === "export")    { alert(`Exporting data for ${rider.name}…`); return; }
    setNote(rider.adminNote || "");
    setConfirm({ action, rider });
    setMenu(null); setDrawer(null);
  }

  async function handlePasswordReset(rider) {
    const result = await resetPassword(rider.email);
    if (result.success) {
      alert(`Password reset link sent to ${rider.email}`);
    } else {
      alert(`Error: ${result.error.message}`);
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
    setLocal(p => ({ ...p, [rider.uid]: { ...p[rider.uid], ...patch } }));
    setConfirm(null);
  }

  const fLabels = { all: "All", active: "Active", suspended: "Suspended", banned: "Banned" };

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes fUp { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pulseDot { 0%,100% { opacity:1 } 50% { opacity:.4 } }
      `}</style>

      <div style={{ background: C.bg, minHeight: "100vh", fontFamily: font, fontFeatureSettings: "'cv11'", WebkitFontSmoothing: "antialiased" }}>
        <div style={{ maxWidth: 600, margin: "0 auto", padding: "20px 16px 48px" }}>

          {onBack && (
            <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: C.ink4, fontSize: 13, fontWeight: 600, marginBottom: 18, padding: 0 }}>
              <ArrowLeft size={14} /> Back
            </button>
          )}

          {/* Header */}
          <div style={{ marginBottom: 22, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, color: C.ink, letterSpacing: "-.03em" }}>Riders</div>
              <div style={{ fontSize: 13, color: C.ink4, marginTop: 3 }}>Manage rider accounts and access</div>
            </div>
            {counts.all > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 11px", background: C.greenBg, border: `1px solid ${C.greenSoft}`, borderRadius: 100 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, animation: "pulseDot 2s ease-in-out infinite" }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: C.green, letterSpacing: ".02em" }}>LIVE</span>
              </div>
            )}
          </div>

          {/* Stats grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 18 }}>
            <StatCard icon={<Users size={14} />}         label="Total Accounts" value={counts.all}       color={C.blue}   delay={0} />
            <StatCard icon={<Activity size={14} />}      label="Total Rides"    value={totalRides}       color={C.green}  delay={50} />
            <StatCard icon={<AlertTriangle size={14} />} label="Suspended"      value={counts.suspended} color={C.amber}  delay={100} />
            <StatCard icon={<Ban size={14} />}           label="Banned"         value={counts.banned}    color={C.red}    delay={150} />
          </div>

          {/* Search + filter */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <div style={{
              flex: 1, display: "flex", alignItems: "center", gap: 9,
              background: C.surface, border: `1px solid ${C.borderMid}`, borderRadius: 12,
              padding: "0 14px", height: 42, transition: "all .18s",
            }}
              onFocus={e => { e.currentTarget.style.borderColor = C.ink; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,0,0,.05)"; }}
            >
              <Search size={14} color={C.ink5} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, email, or UID…"
                style={{ flex: 1, background: "none", border: "none", outline: "none", color: C.ink, fontFamily: font, fontSize: 13, fontWeight: 500 }}
              />
              {search && (
                <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: C.ink4, display: "flex", padding: 0 }}>
                  <X size={13} />
                </button>
              )}
            </div>
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setFOpen(p => !p)}
                style={{
                  display: "flex", alignItems: "center", gap: 6, height: 42,
                  background: filter !== "all" ? C.ink : C.surface,
                  border: `1px solid ${filter !== "all" ? C.ink : C.borderMid}`,
                  borderRadius: 12, padding: "0 14px",
                  color: filter !== "all" ? "#fff" : C.ink2,
                  fontFamily: font, fontSize: 12.5, fontWeight: 600,
                  cursor: "pointer", whiteSpace: "nowrap",
                }}
              >
                {fLabels[filter]} <ChevronDown size={13} />
              </button>
              {fOpen && (
                <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", zIndex: 200, boxShadow: C.shadowMd, minWidth: 170 }}>
                  {Object.entries(fLabels).map(([k, l]) => (
                    <button
                      key={k}
                      onClick={() => { setFilter(k); setFOpen(false); }}
                      style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        width: "100%", padding: "10px 14px",
                        background: filter === k ? C.bgSubtle : "none",
                        border: "none", color: filter === k ? C.ink : C.ink2,
                        fontFamily: font, fontSize: 13, fontWeight: filter === k ? 700 : 500,
                        cursor: "pointer", transition: "background .12s",
                      }}
                      onMouseEnter={e => { if (filter !== k) e.currentTarget.style.background = C.bgSubtle; }}
                      onMouseLeave={e => { if (filter !== k) e.currentTarget.style.background = "none"; }}
                    >
                      {l}
                      <span style={{ fontFamily: mono, fontSize: 11, color: C.ink4 }}>{counts[k]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Error / empty */}
          {useriders?.error && (
            <div style={{ background: C.redBg, border: `1px solid ${C.redSoft}`, borderRadius: 12, padding: "12px 16px", color: C.red, fontSize: 13, marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}>
              <AlertTriangle size={14} /> {useriders.error.message ?? "Failed to load riders"}
            </div>
          )}

          {!useriders?.loading && filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "56px 20px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: C.bgSubtle, margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Inbox size={22} color={C.ink5} />
              </div>
              <div style={{ fontFamily: font, fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 4 }}>
                {search ? "No matches" : "No riders yet"}
              </div>
              <div style={{ fontFamily: font, fontSize: 12, color: C.ink4 }}>
                {search ? "Try a different search term" : "Riders will appear here once they sign up"}
              </div>
            </div>
          )}

          {/* Rider list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map((rider, i) => (
              <div
                key={rider.uid}
                style={{
                  background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
                  padding: "14px 14px", display: "flex", alignItems: "center", gap: 13,
                  cursor: "pointer", animation: `fUp .25s ease ${i * 0.04}s both`,
                  transition: "border-color .15s, box-shadow .15s, transform .15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderMid; e.currentTarget.style.boxShadow = C.shadowMd; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = C.border;    e.currentTarget.style.boxShadow = "none"; }}
                onClick={() => setDrawer(rider)}
              >
                <Avatar name={rider.name} size={44} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: font, fontWeight: 700, fontSize: 14, color: C.ink, letterSpacing: "-.01em" }}>{rider.name || "—"}</span>
                    <Badge status={rider.status} />
                    {rider.isOrphaned && <Flag size={11} color={C.red} title="Orphaned UID: No matching rider account" />}
                    {(local[rider.id]?.adminNote || rider.adminNote) && <Flag size={11} color={C.amber} />}
                  </div>
                  <div style={{ fontSize: 12, color: C.ink4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4, fontWeight: 500 }}>{rider.email}</div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, color: C.ink5, fontWeight: 500 }}>
                      <Calendar size={10} /> {fmtRelative(rider.createdAt)}
                    </span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5, color: C.blue, fontWeight: 600 }}>
                      <Activity size={10} /> {rides.filter(r => r.uid === rider.uid || r.uid === rider.id).length} rides
                    </span>
                    {rider.welcomeEmailSent && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5, color: C.green, fontWeight: 600 }}>
                        <CheckCircle size={10} /> Welcomed
                      </span>
                    )}
                    {rider.adminNotified && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10.5, color: C.blue, fontWeight: 600 }}>
                        <BellRing size={10} /> Notified
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); setMenu(rider); }}
                  style={{
                    background: C.bgSubtle, border: `1px solid ${C.border}`, borderRadius: 10,
                    padding: 8, cursor: "pointer", color: C.ink4, display: "flex", flexShrink: 0,
                    transition: "all .15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderStrong; e.currentTarget.style.color = C.ink; e.currentTarget.style.background = C.surface; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.border;       e.currentTarget.style.color = C.ink4; e.currentTarget.style.background = C.bgSubtle; }}
                >
                  <MoreHorizontal size={15} />
                </button>
              </div>
            ))}
          </div>

          {filtered.length > 0 && (
            <div style={{ textAlign: "center", fontFamily: font, fontSize: 11.5, color: C.ink4, marginTop: 18, fontWeight: 500 }}>
              Showing {filtered.length} of {counts.all} rider{counts.all !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      </div>

      {drawer  && <Drawer       rider={drawer} rides={rides} onClose={() => setDrawer(null)} onAction={handleAction} />}
      {menu    && <ActionsMenu  rider={menu}            onClose={() => setMenu(null)}   onAction={handleAction} />}
      {confirm && <ConfirmModal action={confirm.action} rider={confirm.rider} note={noteText} setNote={setNote} onConfirm={handleConfirm} onCancel={() => setConfirm(null)} />}
      {rideHistory && <RideHistoryModal rider={rideHistory} rides={riderRides} onClose={() => setRideHistory(null)} />}
    </>
  );
}

export default RidersTab;