// src/App/UaTob/Admin/components/UI.jsx
import {
  Activity, Clock, CheckCircle, XCircle, Zap,
  TrendingUp, TrendingDown,
} from "lucide-react";
import { C, STATUS_CONFIG, AVATAR_PALETTE } from '@/App/Admin/Tokens';

// ── Helpers ───────────────────────────────────────────────────────────
export function initials(name) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2);
}

// ── Avatar ────────────────────────────────────────────────────────────
export function Avatar({ name, size = 36, colorIdx = 0 }) {
  const bg = AVATAR_PALETTE[colorIdx % AVATAR_PALETTE.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `linear-gradient(135deg,${bg},${bg}bb)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.33, fontWeight: 800, color: "#fff",
      fontFamily: "'Barlow Condensed',sans-serif",
      letterSpacing: "0.5px", flexShrink: 0,
    }}>
      {initials(name)}
    </div>
  );
}

// ── Status Pill ───────────────────────────────────────────────────────
const ICON_MAP = { Activity, Clock, CheckCircle, XCircle, Zap };

export function StatusPill({ status }) {
  const cfg  = STATUS_CONFIG[status] || STATUS_CONFIG.cancelled;
  const Icon = ICON_MAP[cfg.icon] || XCircle;
  return (
    <span className="pill" style={{ background: cfg.glow, color: cfg.color }}>
      <Icon size={9} />{cfg.label}
    </span>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────
export function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div style={{
      position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
      background: C.text, borderRadius: 12, padding: "11px 20px",
      color: "#fff", fontSize: 13, fontWeight: 600, zIndex: 999,
      whiteSpace: "nowrap", boxShadow: "0 8px 24px rgba(0,0,0,.16)",
      animation: "fadeUp .3s ease",
    }}>
      {msg}
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────
export function StatCard({ label, value, delta, icon: Icon, color, delay = 0 }) {
  const up        = delta >= 0;
  const isRevenue = label.includes("Revenue");
  const formatted = isRevenue
    ? (value >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${value}`)
    : value.toLocaleString();

  return (
    <div className="card fade-up" style={{
      padding: "16px", animationDelay: `${delay}ms`, opacity: 0,
      boxShadow: "0 1px 6px rgba(0,0,0,.05)",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${color}15`, border: `1.5px solid ${color}28`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={17} color={color} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, color: up ? C.green : C.red }}>
          {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {up ? "+" : ""}{delta}{isRevenue ? "%" : ""}
        </div>
      </div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: C.text, letterSpacing: "-0.5px" }}>
        {formatted}
        {isRevenue && (
          <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 3, fontFamily: "'Barlow',sans-serif", fontWeight: 500 }}>
            today
          </span>
        )}
      </div>
      <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, marginTop: 3, letterSpacing: ".4px", textTransform: "uppercase" }}>
        {label}
      </div>
    </div>
  );
}

// ── Section Header ────────────────────────────────────────────────────
export function SectionHeader({ title, action }) {
  return (
    <div className="section-header">
      <div className="section-title">{title}</div>
      {action}
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, sub, color }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 24px" }}>
      <Icon size={40} color={color || C.green} style={{ marginBottom: 12 }} />
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: C.textMuted }}>{sub}</div>
    </div>
  );
}