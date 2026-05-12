// src/App/UaTob/RiderDashboard.jsx
import { useState, useEffect, useRef, useMemo } from "react";
import {
  MapPin, Clock, Star, ChevronRight, LogOut,
  CreditCard, Bell, Shield, HelpCircle,
  CheckCircle, XCircle, Navigation, Repeat,
  User, ArrowUpRight, Zap, ChevronLeft, Loader, Home,
  TrendingUp, Sparkles, Award, Target, Heart, Gift,
  Calendar, DollarSign, MapPinned, Phone, MessageCircle,
  Receipt, BarChart3, Crown, Flame, Activity,
  Settings as SettingsIcon, Mail, Lock, FileText,
  Banknote, Coffee, Briefcase, Plane, ArrowRight,
  Edit3, ChevronDown, Send, ShieldCheck,
} from "lucide-react";
import { useRideHistory } from '@/App/UaTob/useRideHistorys';

// ── Brand ─────────────────────────────────────────────────────────────
function UaTobIcon({ size = 46 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="ribg2" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF"/><stop offset="100%" stopColor="#F3F4F6"/>
        </linearGradient>
        <linearGradient id="riroad2" x1="0" y1="0" x2="64" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#111827"/><stop offset="100%" stopColor="#16A34A"/>
        </linearGradient>
        <linearGradient id="ricar2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#16A34A"/><stop offset="100%" stopColor="#15803D"/>
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#ribg2)"/>
      <rect x="0.5" y="0.5" width="63" height="63" rx="15.5" stroke="#E5E7EB" strokeWidth="1"/>
      <path d="M 10 42 Q 32 24 54 42" stroke="url(#riroad2)" strokeWidth="2.5" strokeDasharray="5 4" strokeLinecap="round" fill="none" opacity="0.6"/>
      <circle cx="10" cy="42" r="6" fill="#111827" opacity="0.12"/>
      <circle cx="10" cy="42" r="3.5" fill="#111827"/>
      <text x="10" y="45.5" textAnchor="middle" fontFamily="system-ui" fontWeight="800" fontSize="4.5" fill="#fff">A</text>
      <circle cx="54" cy="42" r="6" fill="#16A34A" opacity="0.18"/>
      <circle cx="54" cy="42" r="3.5" fill="#16A34A"/>
      <text x="54" y="45.5" textAnchor="middle" fontFamily="system-ui" fontWeight="800" fontSize="4.5" fill="#fff">B</text>
      <g transform="translate(26,26)">
        <ellipse cx="6" cy="12" rx="8" ry="2" fill="#111827" opacity="0.1"/>
        <rect x="1" y="5" width="10" height="6" rx="1.5" fill="url(#ricar2)"/>
        <path d="M3 5 L3.8 2 L8.2 2 L9 5Z" fill="#15803D"/>
        <rect x="3.5" y="2.5" width="2.3" height="2" rx="0.5" fill="#fff" fillOpacity="0.85"/>
        <rect x="6.2" y="2.5" width="2.3" height="2" rx="0.5" fill="#fff" fillOpacity="0.85"/>
        <circle cx="3" cy="11" r="1.8" fill="#111827"/><circle cx="3" cy="11" r="0.9" fill="#16A34A"/>
        <circle cx="9" cy="11" r="1.8" fill="#111827"/><circle cx="9" cy="11" r="0.9" fill="#22C55E"/>
        <rect x="10.5" y="6.5" width="1.5" height="1" rx="0.5" fill="#FCD34D"/>
      </g>
    </svg>
  );
}

// ── Design tokens ─────────────────────────────────────────────────────
const T = {
  bg:           "#F8FAFC",
  surface:      "#FFFFFF",
  surfaceHigh:  "#F8FAFC",
  surfaceDeep:  "#0F172A",
  border:       "#E2E8F0",
  borderLight:  "#F1F5F9",
  borderDeep:   "#CBD5E1",
  text:         "#0F172A",
  textMid:      "#475569",
  textMuted:    "#64748B",
  textDim:      "#94A3B8",
  green:        "#16A34A",
  greenDeep:    "#15803D",
  greenLight:   "rgba(22,163,74,0.08)",
  greenBorder:  "rgba(22,163,74,0.22)",
  greenGradient:"linear-gradient(135deg,#22C55E,#16A34A 55%,#15803D)",
  red:          "#EF4444",
  redLight:     "rgba(239,68,68,0.08)",
  amber:        "#F59E0B",
  amberLight:   "rgba(245,158,11,0.08)",
  blue:         "#3B82F6",
  blueLight:    "rgba(59,130,246,0.08)",
  purple:       "#8B5CF6",
  purpleLight:  "rgba(139,92,246,0.08)",
  gold:         "#D4AF37",
  goldLight:    "rgba(212,175,55,0.10)",
};

// ── CSS ───────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

  * { box-sizing:border-box; margin:0; padding:0; -webkit-tap-highlight-color:transparent; }
  body { background:#F8FAFC; color:#0F172A; font-family:'Inter',system-ui,sans-serif; }
  ::-webkit-scrollbar { width:0; height:0; }

  @keyframes slideUp     { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn      { from{opacity:0} to{opacity:1} }
  @keyframes popIn       { 0%{opacity:0;transform:scale(.95) translateY(10px)} 100%{opacity:1;transform:scale(1) translateY(0)} }
  @keyframes pulse       { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.7;transform:scale(1.05)} }
  @keyframes spin        { to{transform:rotate(360deg)} }
  @keyframes glowDot     { 0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,.7)} 50%{box-shadow:0 0 0 8px rgba(34,197,94,0)} }
  @keyframes shimmer     { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
  @keyframes confettiPop { 0%{opacity:0;transform:scale(.5) rotate(-10deg)} 60%{transform:scale(1.15) rotate(4deg)} 100%{opacity:1;transform:scale(1) rotate(0)} }
  @keyframes routePulse  { 0%,100%{stroke-dashoffset:0} 50%{stroke-dashoffset:-20} }

  .slide-up { animation: slideUp .5s cubic-bezier(.25,.46,.45,.94) forwards; }
  .mono     { font-family:'JetBrains Mono',monospace; }

  .card {
    background:#FFFFFF;
    border:1px solid #E2E8F0;
    border-radius:20px;
    overflow:hidden;
    box-shadow:0 1px 3px rgba(0,0,0,.04), 0 1px 2px rgba(0,0,0,.05);
    transition: all .25s ease;
  }
  .card-hover:hover {
    box-shadow:0 8px 28px rgba(0,0,0,.08);
    transform:translateY(-2px);
    border-color:#CBD5E1;
  }

  .row-item {
    display:flex; align-items:center; gap:14px;
    padding:14px 18px;
    border-bottom:1px solid #F1F5F9;
    cursor:pointer; background:#FFFFFF;
    transition: background .15s ease;
  }
  .row-item:last-child { border-bottom:none; }
  .row-item:hover { background:#F8FAFC; }
  .row-item:active { background:#F1F5F9; }

  .pill {
    display:inline-flex; align-items:center; gap:5px;
    padding:3px 10px; border-radius:99px;
    font-size:10.5px; font-weight:700; letter-spacing:.04em;
    text-transform:uppercase; white-space:nowrap;
  }

  /* ── TAB BAR ── */
  .tab-bar-outer {
    position:fixed; bottom:0; left:0; right:0;
    display:flex; justify-content:center;
    padding: 12px 20px calc(12px + env(safe-area-inset-bottom));
    z-index:100;
    pointer-events:none;
  }

  .tab-bar-pill {
    display:flex; align-items:center;
    background:rgba(255,255,255,0.97);
    backdrop-filter:blur(20px);
    -webkit-backdrop-filter:blur(20px);
    border:1px solid rgba(226,232,240,0.8);
    border-radius:32px;
    padding:6px;
    gap:2px;
    box-shadow:
      0 8px 32px rgba(15,23,42,.10),
      0 2px 8px rgba(15,23,42,.06),
      inset 0 1px 0 rgba(255,255,255,.9);
    pointer-events:all;
  }

  .tab-btn {
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    gap:3px; padding:8px 16px; min-width:64px;
    border:none; background:transparent; cursor:pointer;
    border-radius:26px;
    font-family:'Inter',system-ui,sans-serif;
    font-size:9.5px; font-weight:700; letter-spacing:.04em; text-transform:uppercase;
    color:#94A3B8;
    transition: color .25s ease, background .25s ease;
    position:relative;
  }
  .tab-btn .tab-icon {
    display:flex; align-items:center; justify-content:center;
    width:28px; height:22px;
    transition: transform .25s cubic-bezier(.34,1.56,.64,1);
  }
  .tab-btn:hover { color:#475569; }
  .tab-btn:hover .tab-icon { transform:translateY(-1px); }

  .tab-btn.active {
    background: linear-gradient(135deg, rgba(22,163,74,0.10) 0%, rgba(21,128,61,0.06) 100%);
    color:#15803D;
  }
  .tab-btn.active .tab-icon { transform:translateY(-2px) scale(1.1); }

  .tab-fab {
    position:relative;
    width:54px; height:54px; border-radius:50%;
    background:linear-gradient(145deg, #22C55E 0%, #16A34A 50%, #15803D 100%);
    border:3px solid #fff;
    box-shadow:
      0 8px 24px rgba(22,163,74,.45),
      0 2px 6px rgba(0,0,0,.12),
      inset 0 1px 0 rgba(255,255,255,.25);
    display:flex; align-items:center; justify-content:center;
    cursor:pointer;
    transform:translateY(-10px);
    transition: transform .2s cubic-bezier(.34,1.56,.64,1), box-shadow .2s ease;
    flex-shrink:0;
    margin:0 4px;
  }
  .tab-fab:hover {
    transform:translateY(-13px);
    box-shadow:
      0 12px 32px rgba(22,163,74,.55),
      0 4px 8px rgba(0,0,0,.14),
      inset 0 1px 0 rgba(255,255,255,.3);
  }
  .tab-fab:active { transform:translateY(-7px); }

  .stat-chip {
    flex:1; background:#FFFFFF;
    border:1px solid #E2E8F0;
    border-radius:14px; padding:12px 10px;
    text-align:left;
    box-shadow:0 1px 3px rgba(0,0,0,.04);
    transition: all .2s ease;
    position:relative; overflow:hidden;
  }
  .stat-chip:hover {
    transform:translateY(-2px);
    box-shadow:0 6px 18px rgba(0,0,0,.08);
    border-color:#CBD5E1;
  }

  .action-btn {
    display:flex; flex-direction:column; align-items:center; gap:7px;
    padding:14px 8px; border-radius:16px;
    border:1px solid #E2E8F0;
    background:#FFFFFF;
    cursor:pointer; flex:1;
    box-shadow:0 1px 3px rgba(0,0,0,.04);
    transition: all .2s ease;
    font-family:'Inter',system-ui,sans-serif;
    min-height: 78px;
    justify-content: center;
  }
  .action-btn:hover {
    transform:translateY(-2px);
    box-shadow:0 6px 18px rgba(0,0,0,.08);
    border-color:#CBD5E1;
  }
  .action-btn:active { transform:translateY(0); }

  .back-btn {
    display:inline-flex; align-items:center; gap:8px;
    background:#FFFFFF; border:1px solid #E2E8F0;
    border-radius:12px; padding:9px 14px;
    font-family:'Inter',system-ui,sans-serif;
    font-size:13px; font-weight:600; color:#0F172A;
    cursor:pointer; margin-bottom:18px;
    box-shadow:0 1px 3px rgba(0,0,0,.04);
    transition: all .15s ease;
  }
  .back-btn:hover { background:#F8FAFC; transform:translateX(-2px); }

  .primary-btn {
    width:100%; padding:14px 18px;
    background:linear-gradient(135deg, #22C55E 0%, #16A34A 60%, #15803D 100%);
    color:#fff; border:none; border-radius:14px;
    font-family:'Inter',system-ui,sans-serif;
    font-size:14.5px; font-weight:800; letter-spacing:-0.1px;
    cursor:pointer;
    box-shadow:0 6px 20px rgba(22,163,74,.32);
    display:flex; align-items:center; justify-content:center; gap:9px;
    transition: all .2s ease;
  }
  .primary-btn:hover { transform:translateY(-1px); box-shadow:0 10px 28px rgba(22,163,74,.4); }
  .primary-btn:active { transform:translateY(0); }

  .ghost-btn {
    width:100%; padding:13px 16px;
    background:#FFFFFF; color:#0F172A;
    border:1px solid #E2E8F0; border-radius:14px;
    font-family:'Inter',system-ui,sans-serif;
    font-size:13.5px; font-weight:700;
    cursor:pointer;
    display:flex; align-items:center; justify-content:center; gap:9px;
    transition: all .15s ease;
  }
  .ghost-btn:hover { background:#F8FAFC; border-color:#CBD5E1; }

  .spinner {
    width:20px; height:20px;
    border:2px solid #E2E8F0;
    border-top-color:#16A34A;
    border-radius:50%;
    animation:spin .8s linear infinite;
  }

  /* Section heading */
  .section-h {
    display:flex; align-items:center; justify-content:space-between;
    margin-bottom:10px; padding:0 2px;
  }
  .section-h-title {
    font-size:11px; color:#64748B;
    font-weight:800; letter-spacing:.08em;
    text-transform:uppercase;
    display:flex; align-items:center; gap:6px;
  }
  .section-h-link {
    background:none; border:none; cursor:pointer;
    font-size:12px; font-weight:700;
    color:#16A34A;
    display:flex; align-items:center; gap:3px;
    padding:4px 8px; border-radius:8px;
    transition: background .12s;
  }
  .section-h-link:hover { background:rgba(22,163,74,.06); }

  /* Hero card */
  .hero-card {
    background:linear-gradient(135deg,#0F172A 0%,#1E293B 50%,#0F172A 100%);
    border-radius:24px;
    overflow:hidden;
    position:relative;
    box-shadow:0 12px 40px rgba(15,23,42,.20), 0 2px 6px rgba(15,23,42,.08);
  }
  .hero-card::before {
    content:''; position:absolute; inset:0;
    background-image:
      linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
    background-size:32px 32px;
    pointer-events:none;
  }
  .hero-card::after {
    content:''; position:absolute;
    top:-80px; right:-80px;
    width:240px; height:240px; border-radius:50%;
    background:radial-gradient(circle, rgba(34,197,94,0.18) 0%, transparent 70%);
    pointer-events:none;
    animation:pulse 4s ease-in-out infinite;
  }

  .hero-stat-chip {
    flex:1;
    background:rgba(255,255,255,0.06);
    border:1px solid rgba(255,255,255,0.10);
    border-radius:12px;
    padding:12px;
    backdrop-filter:blur(12px);
  }

  /* Active ride card */
  .active-card {
    background:linear-gradient(135deg,#16A34A,#15803D);
    border-radius:20px;
    overflow:hidden;
    position:relative;
    box-shadow:0 8px 28px rgba(22,163,74,.32);
  }
  .active-card::before {
    content:''; position:absolute; inset:0;
    background-image:repeating-linear-gradient(
      45deg, transparent, transparent 60px,
      rgba(255,255,255,.04) 60px, rgba(255,255,255,.04) 61px
    );
    pointer-events:none;
  }

  /* Trip row */
  .trip-row {
    display:flex; align-items:flex-start; gap:13px;
    padding:14px 16px;
    cursor:pointer;
    transition: background .15s ease;
    border-bottom:1px solid #F1F5F9;
  }
  .trip-row:last-child { border-bottom:none; }
  .trip-row:hover { background:#F8FAFC; }

  /* Achievement card */
  .ach-card {
    flex-shrink:0; width:128px;
    padding:14px 12px;
    border-radius:14px;
    border:1.5px solid #F1F5F9;
    background:#FFFFFF;
    text-align:center;
    transition: transform .2s ease, box-shadow .2s ease;
  }
  .ach-card.unlocked {
    border-color:rgba(212,175,55,.3);
    background:linear-gradient(135deg,#FFFBEB,#FEF3C7);
  }
  .ach-card.unlocked:hover {
    transform:translateY(-3px);
    box-shadow:0 6px 18px rgba(212,175,55,.25);
  }

  /* Sparkline animation */
  .spark-bar {
    transition: all .4s cubic-bezier(.34,1.56,.64,1);
    transform-origin:bottom;
  }

  /* Glow dot */
  .glow-dot {
    width:8px; height:8px; border-radius:50%;
    background:#22C55E;
    animation:glowDot 2s infinite;
  }

  /* Shimmer for loading */
  .shimmer {
    background:linear-gradient(90deg,#F1F5F9 0%,#E2E8F0 50%,#F1F5F9 100%);
    background-size:200% 100%;
    animation:shimmer 1.4s linear infinite;
    border-radius:8px;
  }
`;

// ── Helpers ───────────────────────────────────────────────────────────
function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatJoined(ts) {
  if (!ts) return "—";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function shortAddr(addr = "") {
  return addr.split(",")[0].trim() || addr;
}

function tsToDate(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (ts.seconds) return new Date(ts.seconds * 1000);
  return new Date(ts);
}

// ── Avatar ────────────────────────────────────────────────────────────
function Avatar({ initials, size = 48, gradient = "linear-gradient(135deg,#22C55E,#15803D)" }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: gradient,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.34, fontWeight: 800, color: "#fff",
      letterSpacing: "0.5px", flexShrink: 0,
      boxShadow: `0 ${size * 0.1}px ${size * 0.3}px rgba(22,163,74,.3)`,
      border: "2.5px solid rgba(255,255,255,.85)",
    }}>
      {initials}
    </div>
  );
}

function StatusPill({ status, size = "sm" }) {
  const map = {
    completed:        { label: "Completed",   bg: T.greenLight, color: T.green },
    cancelled:        { label: "Cancelled",   bg: T.redLight,   color: T.red   },
    in_progress:      { label: "In Progress", bg: T.blueLight,  color: T.blue  },
    searching_driver: { label: "Searching",   bg: T.amberLight, color: T.amber },
    driver_assigned:  { label: "Assigned",    bg: T.blueLight,  color: T.blue  },
    driver_arriving:  { label: "Arriving",    bg: T.blueLight,  color: T.blue  },
    arrived:          { label: "Arrived",     bg: T.greenLight, color: T.green },
  };
  const cfg = map[status] || map.completed;
  return (
    <span className="pill" style={{
      background: cfg.bg, color: cfg.color,
      fontSize: size === "sm" ? 10 : 11,
      padding: size === "sm" ? "3px 9px" : "4px 11px",
    }}>
      {cfg.label}
    </span>
  );
}

function StarRow({ rating, size = 11 }) {
  if (!rating) return <span style={{ fontSize: 11, color: T.textDim }}>—</span>;
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1,2,3,4,5].map(n => (
        <span key={n} style={{ fontSize: size, color: n <= rating ? T.amber : T.border }}>★</span>
      ))}
    </div>
  );
}

// ── Mini route visualization ──────────────────────────────────────────
function RouteVisualization({ pickup, dropoff, dotted = false, height = 38 }) {
  return (
    <div style={{ display: "flex", alignItems: "stretch", gap: 12, position: "relative" }}>
      {/* Vertical line w/ dots */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 0, paddingTop: 4, paddingBottom: 4,
      }}>
        <div style={{
          width: 10, height: 10, borderRadius: "50%",
          background: T.green,
          border: "2px solid #fff",
          boxShadow: "0 0 0 1px rgba(22,163,74,.3)",
          flexShrink: 0,
        }}/>
        <div style={{
          width: 1.5, flex: 1,
          background: dotted
            ? `repeating-linear-gradient(to bottom, ${T.borderDeep} 0, ${T.borderDeep} 3px, transparent 3px, transparent 6px)`
            : T.borderDeep,
          minHeight: height,
        }}/>
        <div style={{
          width: 10, height: 10, borderRadius: 2,
          background: T.text,
          border: "2px solid #fff",
          boxShadow: "0 0 0 1px rgba(15,23,42,.25)",
          flexShrink: 0,
        }}/>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0, paddingTop: 2, paddingBottom: 2 }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: T.text,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          lineHeight: 1.3,
        }}>
          {shortAddr(pickup)}
        </div>
        <div style={{
          fontSize: 13, fontWeight: 700, color: T.text,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          lineHeight: 1.3,
        }}>
          {shortAddr(dropoff)}
        </div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────
function EmptyState({ icon: Icon, title, sub, action, actionLabel, accent = T.green }) {
  return (
    <div style={{ textAlign: "center", padding: "44px 24px" }}>
      <div style={{
        width: 60, height: 60, borderRadius: 18,
        background: `${accent}10`, border: `1.5px solid ${accent}25`,
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 14px",
      }}>
        <Icon size={26} color={accent} />
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 6, letterSpacing: "-0.2px" }}>
        {title}
      </div>
      <div style={{ fontSize: 13, color: T.textMuted, marginBottom: action ? 18 : 0, fontWeight: 500, lineHeight: 1.5 }}>
        {sub}
      </div>
      {action && (
        <button className="primary-btn" style={{ maxWidth: 220, margin: "0 auto" }} onClick={action}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ── ACTIVE RIDE BANNER (Premium) ──────────────────────────────────────
function ActiveRideBanner({ ride, onPress }) {
  const statusMap = {
    searching_driver: { label: "Finding your driver",     icon: <Loader size={13} className="spin"/>,    sub: "We're matching you with the closest driver" },
    driver_assigned:  { label: "Driver assigned",         icon: <CheckCircle size={13}/>,                 sub: "Get ready — your driver is on the way" },
    driver_arriving:  { label: "Driver on the way",       icon: <Navigation size={13}/>,                  sub: ride.driverEtaMin != null ? `${ride.driverEtaMin} min away` : "Heading to pickup" },
    arrived:          { label: "Driver has arrived",      icon: <MapPin size={13}/>,                       sub: "Meet your driver at the pickup point" },
    in_progress:      { label: "Trip in progress",         icon: <ArrowRight size={13}/>,                  sub: ride.dropoffEtaMin != null ? `${ride.dropoffEtaMin} min to arrival` : "Heading to your destination" },
  };
  const s = statusMap[ride.status] ?? { label: ride.status, icon: <Activity size={13}/>, sub: "" };

  const driverInitials = ride.driverName ? getInitials(ride.driverName) : null;

  return (
    <div className="active-card" onClick={onPress} style={{ margin: "0 18px 20px", cursor: "pointer" }}>
      <div style={{ position: "relative", padding: "16px 18px" }}>
        {/* Top row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            background: "rgba(255,255,255,0.18)",
            border: "1px solid rgba(255,255,255,0.25)",
            borderRadius: 99, padding: "4px 11px",
          }}>
            <div className="glow-dot" style={{ background: "#fff" }}/>
            <span style={{
              fontSize: 9.5, fontWeight: 800, color: "#fff",
              letterSpacing: ".08em", textTransform: "uppercase",
            }}>
              Active Trip
            </span>
          </div>
          <div className="mono" style={{
            fontSize: 18, fontWeight: 800, color: "#fff",
            letterSpacing: "-0.5px",
          }}>
            ${ride.fareTotal?.toFixed(2) ?? "—"}
          </div>
        </div>

        {/* Status row */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 11,
            background: "rgba(255,255,255,0.18)",
            border: "1.5px solid rgba(255,255,255,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", flexShrink: 0,
          }}>
            {s.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", letterSpacing: "-0.2px", marginBottom: 2 }}>
              {s.label}
            </div>
            <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.78)", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {s.sub}
            </div>
          </div>
          <ChevronRight size={18} color="rgba(255,255,255,.6)"/>
        </div>

        {/* Route */}
        <div style={{
          background: "rgba(255,255,255,0.10)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 12, padding: "12px 14px",
          backdropFilter: "blur(10px)",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff", border: "1.5px solid rgba(255,255,255,.5)" }}/>
              <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.92)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
                {shortAddr(ride.pickup)}
              </div>
            </div>
            <div style={{ width: 1.5, height: 14, background: "rgba(255,255,255,.4)", margin: "2px 0 2px 4px" }}/>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: "#fff" }}/>
              <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.92)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
                {shortAddr(ride.dropoff)}
              </div>
            </div>
          </div>
        </div>

        {/* Driver info if assigned */}
        {driverInitials && ride.status !== "searching_driver" && (
          <div style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: "1px solid rgba(255,255,255,.18)",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "rgba(255,255,255,0.95)",
              color: T.green,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 800,
              flexShrink: 0,
            }}>
              {driverInitials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
                {ride.driverName ?? "Your Driver"}
              </div>
              <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.7)", fontWeight: 600 }}>
                {ride.vehicle?.color ?? ""} {ride.vehicle?.make ?? ""} · {ride.vehicle?.plate ?? ride.rideLabel}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── SPENDING SPARKLINE ────────────────────────────────────────────────
function SpendingSparkline({ rides }) {
  // Last 6 months, group by month
  const buckets = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return {
        key:   `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleDateString("en-US", { month: "short" }),
        total: 0,
        count: 0,
      };
    });

    rides.filter(r => r.status === "completed").forEach(r => {
      const ts = tsToDate(r.completedAt ?? r.createdAt ?? r.date);
      if (!ts) return;
      const k = `${ts.getFullYear()}-${ts.getMonth()}`;
      const bucket = months.find(b => b.key === k);
      if (bucket) {
        bucket.total += Number(r.fareTotal ?? r.fare ?? 0);
        bucket.count++;
      }
    });
    return months;
  }, [rides]);

  const max = Math.max(...buckets.map(b => b.total), 1);
  const totalSpent = buckets.reduce((s, b) => s + b.total, 0);
  const totalRides = buckets.reduce((s, b) => s + b.count, 0);

  if (totalRides === 0) return null;

  return (
    <div className="card" style={{ padding: "18px 18px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <div style={{
            fontSize: 10.5, fontWeight: 800, color: T.textMuted,
            letterSpacing: ".08em", textTransform: "uppercase",
            marginBottom: 4,
          }}>
            Last 6 Months
          </div>
          <div className="mono" style={{
            fontSize: 26, fontWeight: 800, color: T.text,
            letterSpacing: "-0.5px", lineHeight: 1,
          }}>
            ${totalSpent.toFixed(2)}
          </div>
          <div style={{ fontSize: 11.5, color: T.textMuted, fontWeight: 600, marginTop: 4 }}>
            {totalRides} ride{totalRides !== 1 ? "s" : ""}
          </div>
        </div>
        <div style={{
          background: T.greenLight,
          border: `1px solid ${T.greenBorder}`,
          padding: "6px 10px", borderRadius: 99,
          display: "flex", alignItems: "center", gap: 4,
        }}>
          <TrendingUp size={11} color={T.green} strokeWidth={2.4}/>
          <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: T.green }}>
            ${(totalSpent / Math.max(totalRides, 1)).toFixed(2)} avg
          </span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 70 }}>
        {buckets.map((b, i) => {
          const pct = b.total > 0 ? Math.max((b.total / max) * 100, 8) : 0;
          const isLast = i === buckets.length - 1;
          return (
            <div key={b.key} style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
            }}>
              <div className="spark-bar" style={{
                width: "100%",
                height: pct > 0 ? `${pct}%` : 4,
                background: isLast
                  ? "linear-gradient(180deg,#22C55E,#15803D)"
                  : pct > 0 ? "#CBD5E1" : "#E2E8F0",
                borderRadius: "5px 5px 2px 2px",
                boxShadow: isLast ? "0 4px 12px rgba(22,163,74,.35)" : "none",
                minHeight: 4,
              }}/>
              <div style={{
                fontSize: 9.5, fontWeight: 700,
                color: isLast ? T.green : T.textDim,
                letterSpacing: ".05em", textTransform: "uppercase",
              }}>
                {b.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ACHIEVEMENTS STRIP ────────────────────────────────────────────────
function AchievementsStrip({ rideCount, totalSpent }) {
  const achievements = [
    {
      id: "first_ride", icon: <Sparkles size={20}/>, title: "First Ride",
      sub: "Complete your first trip",
      unlocked: rideCount >= 1,
      color: "#F59E0B",
    },
    {
      id: "five_rides", icon: <Award size={20}/>, title: "Regular",
      sub: "5 trips taken",
      unlocked: rideCount >= 5,
      progress: Math.min(rideCount / 5, 1),
      color: "#3B82F6",
    },
    {
      id: "twenty_rides", icon: <Crown size={20}/>, title: "Loyalist",
      sub: "20 trips taken",
      unlocked: rideCount >= 20,
      progress: Math.min(rideCount / 20, 1),
      color: T.gold,
    },
    {
      id: "century", icon: <Flame size={20}/>, title: "$100 Spent",
      sub: "Lifetime spend",
      unlocked: totalSpent >= 100,
      progress: Math.min(totalSpent / 100, 1),
      color: "#EF4444",
    },
  ];

  return (
    <div style={{
      display: "flex", gap: 10, overflowX: "auto", padding: "2px 18px",
      scrollSnapType: "x mandatory",
    }}>
      {achievements.map(a => (
        <div key={a.id}
          className={`ach-card ${a.unlocked ? "unlocked" : ""}`}
          style={{ scrollSnapAlign: "start" }}
        >
          <div style={{
            width: 42, height: 42, borderRadius: 12,
            background: a.unlocked ? `${a.color}25` : "#F8FAFC",
            border: `1.5px solid ${a.unlocked ? `${a.color}50` : T.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 8px",
            color: a.unlocked ? a.color : T.textDim,
            ...(a.unlocked ? { animation: "confettiPop .4s cubic-bezier(.34,1.56,.64,1)" } : {}),
          }}>
            {a.icon}
          </div>
          <div style={{
            fontSize: 12, fontWeight: 800,
            color: a.unlocked ? T.text : T.textMuted,
            letterSpacing: "-0.1px", marginBottom: 2,
          }}>
            {a.title}
          </div>
          <div style={{
            fontSize: 10, color: T.textMuted, fontWeight: 500,
            marginBottom: !a.unlocked && a.progress != null ? 6 : 0,
          }}>
            {a.sub}
          </div>
          {!a.unlocked && a.progress != null && (
            <div style={{ height: 3, background: T.borderLight, borderRadius: 99, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${a.progress * 100}%`,
                background: a.color,
                borderRadius: 99,
                transition: "width .5s ease",
              }}/>
            </div>
          )}
          {a.unlocked && (
            <div style={{
              fontSize: 9.5, fontWeight: 800,
              color: a.color, letterSpacing: ".06em",
              textTransform: "uppercase",
              display: "inline-flex", alignItems: "center", gap: 3,
              marginTop: 2,
            }}>
              <CheckCircle size={9} strokeWidth={2.6}/> Unlocked
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── FAVORITES (Frequent Routes) ───────────────────────────────────────
function FavoritesSection({ rides, onRebook }) {
  const favorites = useMemo(() => {
    const grouped = {};
    rides.filter(r => r.status === "completed").forEach(r => {
      const from = shortAddr(r.from ?? r.pickup ?? "");
      const to   = shortAddr(r.to   ?? r.dropoff ?? "");
      if (!from || !to) return;
      const key = `${from}|${to}`;
      if (!grouped[key]) {
        grouped[key] = { from, to, count: 0, lastFare: 0, lastDate: null };
      }
      grouped[key].count++;
      grouped[key].lastFare = r.fareTotal ?? r.fare ?? grouped[key].lastFare;
    });
    return Object.values(grouped).filter(g => g.count >= 2).sort((a, b) => b.count - a.count).slice(0, 3);
  }, [rides]);

  if (favorites.length === 0) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <div className="section-h">
        <div className="section-h-title">
          <Heart size={11} fill="currentColor"/>
          Frequent Routes
        </div>
      </div>
      <div className="card">
        {favorites.map((f, i) => (
          <div key={i} className="trip-row" onClick={() => onRebook?.(f)}>
            <div style={{
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              background: "linear-gradient(135deg,#FEF3C7,#FFFBEB)",
              border: "1px solid rgba(212,175,55,.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Repeat size={16} color="#D97706" strokeWidth={2.3}/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {f.from} → {f.to}
              </div>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                fontSize: 11, color: T.textMuted, fontWeight: 600,
              }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <Repeat size={10}/> {f.count} times
                </span>
                <span style={{ width: 3, height: 3, borderRadius: "50%", background: T.border }}/>
                <span className="mono" style={{ color: T.green, fontWeight: 700 }}>
                  ${f.lastFare.toFixed(2)}
                </span>
              </div>
            </div>
            <ChevronRight size={15} color={T.textDim}/>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── RIDE DETAIL VIEW ──────────────────────────────────────────────────
function RideDetail({ ride, onBack, onRebook }) {
  const fareTotal    = ride.fareTotal ?? ride.fare ?? 0;
  const tripDistance = ride.tripDistanceMiles ?? (ride.miles ? parseFloat(ride.miles) : null);
  const tripDuration = ride.tripDurationMin ?? parseInt(ride.duration);

  const driverPayout = fareTotal * 0.75;
  const platformFee  = fareTotal * 0.25;

  return (
    <div style={{ padding: "0 18px 32px", animation: "popIn .3s cubic-bezier(.34,1.2,.64,1)" }}>
      <button className="back-btn" onClick={onBack}>
        <ChevronLeft size={15}/> Back to trips
      </button>

      {/* Receipt-style hero */}
      <div className="card" style={{ padding: 0, marginBottom: 16, overflow: "hidden" }}>
        {/* Status accent stripe */}
        <div style={{
          height: 4,
          background: ride.status === "completed"
            ? "linear-gradient(90deg,#22C55E,#15803D)"
            : "linear-gradient(90deg,#EF4444,#B91C1C)",
        }}/>

        <div style={{ padding: "20px 22px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 10.5, color: T.textMuted, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>
                Trip Receipt
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <StatusPill status={ride.status} size="md"/>
                {ride.rideLabel && ride.rideLabel !== "—" && (
                  <span className="pill" style={{
                    background: T.surfaceHigh, color: T.textMid,
                    border: `1px solid ${T.border}`,
                  }}>
                    {ride.rideLabel}
                  </span>
                )}
              </div>
            </div>
            <div className="mono" style={{
              fontSize: 30, fontWeight: 800,
              color: ride.status === "completed" ? T.text : T.textMuted,
              letterSpacing: "-0.5px", lineHeight: 1,
              textDecoration: ride.status === "cancelled" ? "line-through" : "none",
            }}>
              ${fareTotal.toFixed(2)}
            </div>
          </div>

          <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 500, marginBottom: 16 }}>
            <Calendar size={11} style={{ display: "inline", marginRight: 5, verticalAlign: "-1px" }}/>
            {ride.date}
          </div>

          {/* Route */}
          <div style={{
            background: T.surfaceHigh,
            border: `1px solid ${T.border}`,
            borderRadius: 12, padding: "14px 16px",
          }}>
            <RouteVisualization
              pickup={ride.pickup ?? ride.from}
              dropoff={ride.dropoff ?? ride.to}
              height={28}
            />
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", borderTop: `1px solid ${T.border}` }}>
          {[
            { label: "Distance", value: tripDistance ? `${tripDistance.toFixed(1)}mi` : "—" },
            { label: "Duration", value: tripDuration ? `${tripDuration}m` : "—" },
            { label: "Driver",   value: ride.driver !== "—" ? ride.driver?.split(" ")[0] : "—" },
          ].map((it, i) => (
            <div key={it.label} style={{
              flex: 1, padding: "12px",
              borderRight: i < 2 ? `1px solid ${T.border}` : "none",
              textAlign: "center",
            }}>
              <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 4 }}>
                {it.label}
              </div>
              <div className="mono" style={{ fontSize: 14, fontWeight: 800, color: T.text }}>
                {it.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fare breakdown */}
      {ride.status === "completed" && (
        <div className="card" style={{ padding: "16px 18px", marginBottom: 16 }}>
          <div className="section-h-title" style={{ marginBottom: 10 }}>
            <Receipt size={11}/>
            Fare Breakdown
          </div>
          {[
            { label: "Trip fare",    value: `$${(fareTotal - platformFee).toFixed(2)}`, color: T.text },
            { label: "Service fee",  value: `$${platformFee.toFixed(2)}`,                color: T.textMid },
          ].map((row, i) => (
            <div key={i} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "8px 0",
              borderBottom: i < 1 ? `1px solid ${T.borderLight}` : "none",
              fontSize: 13, fontWeight: 600, color: row.color,
            }}>
              <span>{row.label}</span>
              <span className="mono" style={{ fontWeight: 700 }}>{row.value}</span>
            </div>
          ))}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            paddingTop: 10, marginTop: 4, borderTop: `2px solid ${T.text}`,
            fontSize: 14, fontWeight: 800, color: T.text,
          }}>
            <span>Total</span>
            <span className="mono">${fareTotal.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Driver card */}
      {ride.driver !== "—" && ride.driver && (
        <div className="card" style={{ padding: "16px 18px", marginBottom: 16 }}>
          <div className="section-h-title" style={{ marginBottom: 12 }}>
            <User size={11}/>
            Your Driver
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Avatar initials={getInitials(ride.driver)} size={44}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: T.text, marginBottom: 3 }}>
                {ride.driver}
              </div>
              <StarRow rating={ride.rating ?? 5} size={12}/>
            </div>
            {ride.status === "completed" && (
              <div style={{
                background: T.greenLight, border: `1px solid ${T.greenBorder}`,
                borderRadius: 99, padding: "5px 10px",
                fontSize: 10, fontWeight: 800, color: T.green,
                letterSpacing: ".06em", textTransform: "uppercase",
                display: "flex", alignItems: "center", gap: 4,
              }}>
                <ShieldCheck size={10}/> Verified
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {ride.status === "completed" && (
          <button className="primary-btn" onClick={() => onRebook?.(ride)}>
            <Repeat size={15}/> Book This Route Again
          </button>
        )}
        <button className="ghost-btn">
          <HelpCircle size={14}/> Get Help With This Trip
        </button>
        {ride.status === "completed" && (
          <button className="ghost-btn">
            <FileText size={14}/> Download Receipt
          </button>
        )}
      </div>
    </div>
  );
}

// ── TRIPS TAB ─────────────────────────────────────────────────────────
function TripsTab({ uid, onBookRide }) {
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");
  const { rides, loading, error } = useRideHistory(uid);

  if (selected) return <RideDetail ride={selected} onBack={() => setSelected(null)} onRebook={() => onBookRide?.()}/>;

  const filtered = filter === "all" ? rides : rides.filter(r => r.status === filter);

  const totalSpent = rides.filter(r => r.status === "completed").reduce((s, r) => s + (r.fareTotal ?? r.fare ?? 0), 0);

  const FilterBtn = ({ id, label }) => (
    <button
      onClick={() => setFilter(id)}
      style={{
        flex: 1, padding: "8px 0",
        background: filter === id ? T.text : "transparent",
        color: filter === id ? "#fff" : T.textMuted,
        border: filter === id ? "none" : `1px solid ${T.border}`,
        borderRadius: 99,
        fontSize: 12, fontWeight: 800, letterSpacing: "-0.1px",
        cursor: "pointer", fontFamily: "inherit",
        transition: "all .15s ease",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ padding: "0 18px 32px" }}>
      {/* Summary card */}
      {rides.length > 0 && (
        <div className="card" style={{ padding: "16px 18px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: T.textMuted, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 4 }}>
                Lifetime
              </div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: T.text, letterSpacing: "-0.4px", lineHeight: 1 }}>
                ${totalSpent.toFixed(2)}
              </div>
              <div style={{ fontSize: 11.5, color: T.textMuted, fontWeight: 600, marginTop: 4 }}>
                across {rides.filter(r => r.status === "completed").length} trips
              </div>
            </div>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: "linear-gradient(135deg,#F0FDF4,#DCFCE7)",
              border: `1.5px solid ${T.greenBorder}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Receipt size={20} color={T.green}/>
            </div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      {rides.length > 0 && (
        <div style={{
          display: "flex", gap: 6,
          background: T.surfaceHigh, padding: 4, borderRadius: 99,
          border: `1px solid ${T.border}`,
          marginBottom: 14,
        }}>
          <FilterBtn id="all" label={`All (${rides.length})`}/>
          <FilterBtn id="completed" label={`Completed (${rides.filter(r => r.status === "completed").length})`}/>
          <FilterBtn id="cancelled" label={`Cancelled (${rides.filter(r => r.status === "cancelled").length})`}/>
        </div>
      )}

      {loading && (
        <div className="card" style={{ padding: "30px 0", display: "flex", justifyContent: "center" }}>
          <div className="spinner"/>
        </div>
      )}

      {error && (
        <div style={{
          background: T.redLight, border: `1px solid rgba(239,68,68,.2)`,
          borderRadius: 14, padding: "14px 16px",
          fontSize: 13, color: T.red, fontWeight: 600,
        }}>
          {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="card">
          <EmptyState
            icon={Clock}
            title={rides.length === 0 ? "No trips yet" : `No ${filter} trips`}
            sub={rides.length === 0 ? "Your completed rides will appear here." : "Try a different filter"}
            action={rides.length === 0 ? onBookRide : null}
            actionLabel="Book Your First Ride"
          />
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="card">
          {filtered.map((ride, i) => {
            const isCancelled = ride.status === "cancelled";
            return (
              <div key={ride.id} className="trip-row" onClick={() => setSelected(ride)}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                  background: isCancelled ? T.redLight : T.greenLight,
                  border: `1.5px solid ${isCancelled ? "rgba(239,68,68,.22)" : T.greenBorder}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {isCancelled
                    ? <XCircle size={17} color={T.red} strokeWidth={2.2}/>
                    : <Navigation size={16} color={T.green} strokeWidth={2.2}/>}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13.5, fontWeight: 700, color: T.text,
                    marginBottom: 4, whiteSpace: "nowrap",
                    overflow: "hidden", textOverflow: "ellipsis",
                    letterSpacing: "-0.1px",
                  }}>
                    {ride.from} → {ride.to}
                  </div>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 7,
                    fontSize: 11, color: T.textMuted, fontWeight: 600,
                  }}>
                    <span>{ride.date}</span>
                    {ride.rideLabel && ride.rideLabel !== "—" && (
                      <>
                        <span style={{ width: 3, height: 3, borderRadius: "50%", background: T.border }}/>
                        <span style={{ textTransform: "capitalize" }}>{ride.rideLabel}</span>
                      </>
                    )}
                    {ride.duration && (
                      <>
                        <span style={{ width: 3, height: 3, borderRadius: "50%", background: T.border }}/>
                        <span>{ride.duration}</span>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
                  <span className="mono" style={{
                    fontSize: 14, fontWeight: 800,
                    color: isCancelled ? T.textMuted : T.text,
                    textDecoration: isCancelled ? "line-through" : "none",
                    letterSpacing: "-0.2px",
                  }}>
                    ${ride.fare.toFixed(2)}
                  </span>
                  <ChevronRight size={13} color={T.textDim}/>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── PAYMENT TAB ───────────────────────────────────────────────────────
function PaymentTab({ onToast, rides = [] }) {
  const totalSpent = rides.filter(r => r.status === "completed").reduce((s, r) => s + (r.fareTotal ?? r.fare ?? 0), 0);
  const totalRides = rides.filter(r => r.status === "completed").length;

  return (
    <div style={{ padding: "0 18px 32px" }}>
      {/* Spending summary */}
      <div className="hero-card" style={{ padding: "22px 22px 20px", marginBottom: 18 }}>
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 10.5, fontWeight: 800, color: "rgba(255,255,255,.5)", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>
            Lifetime Spending
          </div>
          <div className="mono" style={{ fontSize: 36, fontWeight: 800, color: "#fff", letterSpacing: "-0.8px", lineHeight: 1, marginBottom: 14 }}>
            ${totalSpent.toFixed(2)}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div className="hero-stat-chip">
              <div style={{ fontSize: 9.5, fontWeight: 800, color: "rgba(255,255,255,.5)", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 3 }}>
                Trips
              </div>
              <div className="mono" style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>
                {totalRides}
              </div>
            </div>
            <div className="hero-stat-chip">
              <div style={{ fontSize: 9.5, fontWeight: 800, color: "rgba(255,255,255,.5)", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 3 }}>
                Avg Fare
              </div>
              <div className="mono" style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>
                ${totalRides > 0 ? (totalSpent / totalRides).toFixed(2) : "0.00"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="section-h">
        <div className="section-h-title">
          <CreditCard size={11}/>
          Saved Payment Methods
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <EmptyState
          icon={CreditCard}
          title="No cards saved"
          sub="Add a card to pay for rides faster — your details are encrypted and secure."
          accent={T.blue}
        />
      </div>

      <button className="primary-btn" onClick={() => onToast("Card management coming soon")}>
        <CreditCard size={15}/> Add Payment Method
      </button>

      {/* Trust signals */}
      <div style={{
        marginTop: 14,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        fontSize: 11, color: T.textMuted, fontWeight: 600,
      }}>
        <ShieldCheck size={12}/>
        Powered by Stripe · 256-bit encryption
      </div>
    </div>
  );
}

// ── SETTINGS TAB ──────────────────────────────────────────────────────
function SettingsTab({ account, uid, onToast, onSignOut, rides = [] }) {
  const name      = account?.name  ?? "Rider";
  const email     = account?.email ?? "—";
  const phone     = account?.phone ?? null;
  const initials  = getInitials(name);
  const joined    = formatJoined(account?.createdAt);

  const completedCount = rides.filter(r => r.status === "completed").length;

  const sections = [
    {
      title: "Account",
      rows: [
        { icon: Edit3,    label: "Edit profile",       sub: "Name, phone, email",    color: T.green },
        { icon: Lock,     label: "Privacy & security", sub: "Password, 2FA",          color: T.blue },
        { icon: Bell,     label: "Notifications",      sub: "Ride alerts, promos",   color: T.amber },
        { icon: MapPinned,label: "Saved places",        sub: "Home, work, favorites", color: T.purple },
      ]
    },
    {
      title: "Support",
      rows: [
        { icon: HelpCircle, label: "Help center",  sub: "FAQs and guides",  color: T.blue },
        { icon: MessageCircle, label: "Contact support", sub: "Reply within 1 hr", color: T.green },
        { icon: Star,       label: "Rate the app", sub: "Share your feedback", color: T.amber },
      ]
    },
    {
      title: "Legal",
      rows: [
        { icon: FileText, label: "Terms of service",  sub: "View terms",   color: T.textMuted },
        { icon: Shield,   label: "Privacy policy",    sub: "How we handle data", color: T.textMuted },
      ]
    },
  ];

  return (
    <div style={{ padding: "0 18px 32px" }}>
      {/* Profile card */}
      <div className="card" style={{ padding: "20px 20px 18px", marginBottom: 18, position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: -40, right: -40,
          width: 140, height: 140, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(22,163,74,0.10) 0%, transparent 70%)",
          pointerEvents: "none",
        }}/>

        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <Avatar initials={initials} size={56}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: T.text, marginBottom: 3, letterSpacing: "-0.3px" }}>
                {name}
              </div>
              <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 600, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {email}
              </div>
              <div style={{ fontSize: 11, color: T.textDim, fontWeight: 500 }}>
                Member since {joined}
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div style={{
            display: "flex", gap: 8,
            paddingTop: 14, borderTop: `1px solid ${T.borderLight}`,
          }}>
            {[
              { label: "Trips",   value: completedCount },
              { label: "Status",  value: "Active",         color: T.green },
              { label: "Rating",  value: "5.0",            mono: true },
            ].map(it => (
              <div key={it.label} style={{ flex: 1, textAlign: "center" }}>
                <div style={{ fontSize: 9.5, fontWeight: 800, color: T.textMuted, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 3 }}>
                  {it.label}
                </div>
                <div className={it.mono ? "mono" : ""} style={{
                  fontSize: 15, fontWeight: 800,
                  color: it.color || T.text, letterSpacing: "-0.2px",
                }}>
                  {it.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {sections.map(({ title, rows }) => (
        <div key={title} style={{ marginBottom: 16 }}>
          <div className="section-h">
            <div className="section-h-title">{title}</div>
          </div>
          <div className="card">
            {rows.map(({ icon: Icon, label, sub, color }, i) => (
              <div key={label} className="row-item" onClick={() => onToast?.(`${label} coming soon`)} style={{ borderBottom: i < rows.length - 1 ? `1px solid ${T.borderLight}` : "none" }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 11, flexShrink: 0,
                  background: `${color}15`,
                  border: `1px solid ${color}25`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={15} color={color} strokeWidth={2.2}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text, letterSpacing: "-0.1px", marginBottom: 2 }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 500 }}>
                    {sub}
                  </div>
                </div>
                <ChevronRight size={14} color={T.textDim}/>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Sign out */}
      <button
        onClick={onSignOut}
        style={{
          width: "100%", padding: "13px 16px",
          background: T.surface,
          color: T.red,
          border: "1px solid rgba(239,68,68,.22)",
          borderRadius: 14,
          fontFamily: "inherit",
          fontSize: 13.5, fontWeight: 700,
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
          transition: "all .15s ease",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = "rgba(239,68,68,.04)";
          e.currentTarget.style.borderColor = "rgba(239,68,68,.4)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = T.surface;
          e.currentTarget.style.borderColor = "rgba(239,68,68,.22)";
        }}
      >
        <LogOut size={15} strokeWidth={2.2}/>
        Sign Out
      </button>

      <div style={{ textAlign: "center", marginTop: 18, fontSize: 11, color: T.textDim, fontWeight: 500, letterSpacing: ".05em" }}>
        UaTob · Orlando, FL · v1.1.0
      </div>
    </div>
  );
}

// ── OVERVIEW TAB ─────────────────────────────────────────────────────
function OverviewTab({ account, uid, onTab, onBookRide }) {
  const { rides, loading } = useRideHistory(uid, 20);

  const name      = account?.name  ?? "Rider";
  const initials  = getInitials(name);
  const firstName = name.split(" ")[0];
  const joined    = formatJoined(account?.createdAt);

  const completedRides = rides.filter(r => r.status === "completed");
  const totalSpent     = completedRides.reduce((s, r) => s + (r.fareTotal ?? r.fare ?? 0), 0);
  const totalCount     = completedRides.length;

  // Most-frequent destination
  const lastRide = completedRides[0] ?? null;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <>
      {/* ─── Hero card ─── */}
      <div style={{ padding: "0 18px", marginBottom: 18 }}>
        <div className="hero-card" style={{ padding: "24px 22px 22px" }}>
          <div style={{ position: "relative", zIndex: 1 }}>
            {/* Greeting row */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
              <Avatar initials={initials} size={56} gradient="linear-gradient(135deg,#22C55E,#16A34A)"/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.55)",
                  letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 3,
                }}>
                  {greeting}
                </div>
                <div style={{
                  fontSize: 22, fontWeight: 800, color: "#fff",
                  letterSpacing: "-0.5px", lineHeight: 1.1,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {firstName}
                </div>
              </div>
            </div>

            {/* Hero stats */}
            <div style={{ display: "flex", gap: 8 }}>
              <div className="hero-stat-chip">
                <div style={{ fontSize: 9.5, fontWeight: 800, color: "rgba(255,255,255,.5)", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 4 }}>
                  Trips
                </div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: "-0.3px" }}>
                  {totalCount}
                </div>
              </div>
              <div className="hero-stat-chip">
                <div style={{ fontSize: 9.5, fontWeight: 800, color: "rgba(255,255,255,.5)", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 4 }}>
                  Spent
                </div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: "-0.3px" }}>
                  ${totalSpent.toFixed(0)}
                </div>
              </div>
              <div className="hero-stat-chip">
                <div style={{ fontSize: 9.5, fontWeight: 800, color: "rgba(255,255,255,.5)", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 4 }}>
                  Saved
                </div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: "#22C55E", letterSpacing: "-0.3px" }}>
                  ${(totalSpent * 0.15).toFixed(0)}
                </div>
              </div>
            </div>

            {/* Primary CTA */}
            <button
              onClick={onBookRide}
              style={{
                width: "100%",
                marginTop: 16, padding: "14px 18px",
                background: "linear-gradient(135deg,#22C55E,#16A34A)",
                border: "none", borderRadius: 14,
                color: "#fff",
                fontFamily: "'Inter',system-ui,sans-serif",
                fontSize: 14.5, fontWeight: 800,
                letterSpacing: "-0.1px",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: "0 6px 22px rgba(22,163,74,.4)",
                transition: "all .15s ease",
              }}
              onMouseDown={e => e.currentTarget.style.transform = "scale(.98)"}
              onMouseUp={e => e.currentTarget.style.transform = ""}
            >
              <Navigation size={16} strokeWidth={2.4}/>
              Book a Ride
            </button>
          </div>
        </div>
      </div>

      {/* ─── Quick actions ─── */}
      <div style={{ padding: "0 18px", marginBottom: 22 }}>
        <div style={{ display: "flex", gap: 10 }}>
          {[
            { icon: Clock,      label: "Trips",   color: T.blue,   bg: T.blueLight,  action: () => onTab("trips") },
            { icon: CreditCard, label: "Pay",     color: T.amber,  bg: T.amberLight, action: () => onTab("payment") },
            { icon: User,       label: "Account", color: T.purple, bg: T.purpleLight, action: () => onTab("account") },
            { icon: Gift,       label: "Refer",   color: T.green,  bg: T.greenLight,  action: null, badge: "New" },
          ].map(({ icon: Icon, label, color, bg, action, badge }) => (
            <button key={label} className="action-btn" onClick={action} style={{ position: "relative" }}>
              {badge && (
                <div style={{
                  position: "absolute", top: 6, right: 6,
                  fontSize: 8, fontWeight: 800, color: "#fff",
                  background: T.red,
                  padding: "1px 5px", borderRadius: 99,
                  letterSpacing: ".04em",
                }}>
                  {badge}
                </div>
              )}
              <div style={{
                width: 38, height: 38, borderRadius: 12,
                background: bg, border: `1.5px solid ${color}25`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon size={17} color={color} strokeWidth={2.2}/>
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: T.text, letterSpacing: "-0.1px" }}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Achievements ─── */}
      {totalCount > 0 && (
        <div style={{ marginBottom: 22 }}>
          <div className="section-h" style={{ padding: "0 18px" }}>
            <div className="section-h-title">
              <Award size={11}/>
              Achievements
            </div>
          </div>
          <AchievementsStrip rideCount={totalCount} totalSpent={totalSpent}/>
        </div>
      )}

      {/* ─── Spending sparkline ─── */}
      {totalCount >= 2 && (
        <div style={{ padding: "0 18px", marginBottom: 22 }}>
          <SpendingSparkline rides={completedRides}/>
        </div>
      )}

      {/* ─── Favorites / frequent routes ─── */}
      <div style={{ padding: "0 18px" }}>
        <FavoritesSection rides={rides} onRebook={onBookRide}/>
      </div>

      {/* ─── Last ride ─── */}
      {lastRide && (
        <div style={{ padding: "0 18px", marginBottom: 22 }}>
          <div className="section-h">
            <div className="section-h-title">
              <Clock size={11}/>
              Recent Trip
            </div>
            <button className="section-h-link" onClick={() => onTab("trips")}>
              See all <ChevronRight size={12}/>
            </button>
          </div>
          <div className="card card-hover" style={{ padding: "16px 18px", cursor: "pointer" }} onClick={() => onTab("trips")}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <StatusPill status={lastRide.status}/>
                <div style={{ fontSize: 11.5, color: T.textMuted, fontWeight: 600, marginTop: 6 }}>
                  {lastRide.date}
                </div>
              </div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: T.green, letterSpacing: "-0.4px" }}>
                ${lastRide.fare.toFixed(2)}
              </div>
            </div>
            <RouteVisualization
              pickup={lastRide.from}
              dropoff={lastRide.to}
              dotted={true}
              height={26}
            />
            <div style={{
              marginTop: 12, paddingTop: 12,
              borderTop: `1px solid ${T.borderLight}`,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {lastRide.duration && (
                  <span style={{ fontSize: 11.5, color: T.textMuted, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                    <Clock size={11}/>{lastRide.duration}
                  </span>
                )}
                {lastRide.driver !== "—" && (
                  <span style={{ fontSize: 11.5, color: T.textMuted, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                    <User size={11}/>{lastRide.driver}
                  </span>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onBookRide?.(); }}
                style={{
                  background: T.greenLight,
                  border: `1px solid ${T.greenBorder}`,
                  color: T.green,
                  fontSize: 11, fontWeight: 800, letterSpacing: ".02em",
                  padding: "5px 11px", borderRadius: 99,
                  cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 4,
                  fontFamily: "inherit",
                }}
              >
                <Repeat size={11}/> Rebook
              </button>
            </div>
          </div>
        </div>
      )}

      {totalCount === 0 && !loading && (
        <div style={{ padding: "0 18px" }}>
          <div className="card">
            <EmptyState
              icon={Sparkles}
              title="Ready for your first ride?"
              sub="Book a UaTob ride and explore Orlando with fair, distance-based pricing."
              action={onBookRide}
              actionLabel="Book Your First Ride"
            />
          </div>
        </div>
      )}
    </>
  );
}

// ── FLOATING TAB BAR ─────────────────────────────────────────────────
function TabBar({ tab, setTab, onBookRide }) {
  const LEFT  = [
    { id: "home",    label: "Home",    icon: Home  },
    { id: "trips",   label: "Trips",   icon: Clock },
  ];
  const RIGHT = [
    { id: "payment", label: "Pay",     icon: CreditCard },
    { id: "account", label: "Account", icon: User       },
  ];

  const TabBtn = ({ id, label, icon: Icon }) => (
    <button
      className={`tab-btn ${tab === id ? "active" : ""}`}
      onClick={() => setTab(id)}
    >
      <div className="tab-icon">
        <Icon size={19} strokeWidth={tab === id ? 2.5 : 1.9} />
      </div>
      <span className="tab-label">{label}</span>
    </button>
  );

  return (
    <div className="tab-bar-outer">
      <div className="tab-bar-pill">
        {LEFT.map(t => <TabBtn key={t.id} {...t} />)}

        <button
          className="tab-fab"
          onClick={() => onBookRide?.()}
          aria-label="Book a ride"
        >
          <Navigation size={20} color="#fff" strokeWidth={2.5} />
        </button>

        {RIGHT.map(t => <TabBtn key={t.id} {...t} />)}
      </div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────
export default function RiderDashboard({ uid, account, active, onBookRide, onSignOut }) {
  const [tab,     setTab]     = useState("home");
  const [mounted, setMounted] = useState(false);
  const [toast,   setToast]   = useState(null);
  const toastRef = useRef(null);

  // Fetch all rides for cross-tab sharing
  const { rides: allRides } = useRideHistory(uid);

  useEffect(() => setMounted(true), []);

  const showToast = msg => {
    setToast(msg);
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 2500);
  };

  const handleTab = t => {
    if (t === "book") { onBookRide?.(); return; }
    setTab(t);
  };

  const name      = account?.name ?? "Rider";
  const firstName = name.split(" ")[0];
  const activeRide = active?.[0] ?? null;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter',system-ui,sans-serif", color: T.text }}>
      <style>{CSS}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
          background: T.text, color: "#fff",
          borderRadius: 12, padding: "11px 18px",
          fontSize: 13, fontWeight: 600, zIndex: 999,
          whiteSpace: "nowrap",
          boxShadow: "0 8px 24px rgba(15,23,42,.25)",
          animation: "slideUp .3s ease",
          letterSpacing: "-0.1px",
        }}>
          {toast}
        </div>
      )}

      {/* Sticky header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(248,250,252,.94)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: `1px solid ${T.border}`,
        padding: "14px 18px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        animation: mounted ? "slideUp .4s ease-out forwards" : "none",
        opacity: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <UaTobIcon size={32} />
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, color: T.textMuted, letterSpacing: ".12em", textTransform: "uppercase", lineHeight: 1 }}>
              UaTob
            </div>
            <div style={{ fontSize: 15, fontWeight: 900, color: T.text, letterSpacing: "-0.3px", lineHeight: 1, marginTop: 2 }}>
              {tab === "home" ? `Hey, ${firstName}` :
               tab === "trips" ? "Your Trips" :
               tab === "payment" ? "Payment" :
               "Account"}
            </div>
          </div>
        </div>

        <button
          onClick={() => onBookRide?.()}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: T.greenGradient,
            color: "#fff",
            border: "none", borderRadius: 99,
            padding: "8px 14px",
            fontSize: 12, fontWeight: 800,
            cursor: "pointer",
            boxShadow: "0 4px 14px rgba(22,163,74,.32)",
            fontFamily: "inherit",
            letterSpacing: "-0.1px",
            transition: "all .15s ease",
          }}
          onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
          onMouseLeave={e => e.currentTarget.style.transform = ""}
        >
          <Navigation size={12} strokeWidth={2.5}/>
          Book
        </button>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 640, margin: "0 auto", paddingTop: 18, paddingBottom: 110 }}>
        {activeRide && <ActiveRideBanner ride={activeRide} onPress={() => onBookRide?.()} />}

        <div key={tab} style={{ animation: "slideUp .35s ease-out forwards", opacity: 0 }}>
          {tab === "home"    && <OverviewTab account={account} uid={uid} onTab={handleTab} onBookRide={onBookRide}/>}
          {tab === "trips"   && <TripsTab uid={uid} onBookRide={onBookRide}/>}
          {tab === "payment" && <PaymentTab onToast={showToast} rides={allRides}/>}
          {tab === "account" && <SettingsTab account={account} uid={uid} onToast={showToast} onSignOut={onSignOut} rides={allRides}/>}
        </div>
      </div>

      <TabBar tab={tab} setTab={setTab} onBookRide={onBookRide} />
    </div>
  );
}
