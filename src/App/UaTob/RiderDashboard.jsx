// src/App/UaTob/RiderDashboard.jsx
import { useState, useEffect, useRef, useMemo } from "react";
import {
  MapPin, Clock, Star, ChevronRight, LogOut,
  CreditCard, Bell, Shield, HelpCircle,
  CheckCircle, XCircle, Navigation, Repeat,
  User, Loader, Home, ArrowRight,
  Gift, Calendar, MessageCircle, Receipt,
  FileText, ShieldCheck, Copy, Share2,
  ChevronLeft, Edit3, Lock, MapPinned, Sparkles,
  Plus, Activity,
} from "lucide-react";
import { useRideHistory } from '@/App/UaTob/useRideHistorys';

// ── Brand mark ────────────────────────────────────────────────────────
function UaTobIcon({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="rdbg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF"/><stop offset="100%" stopColor="#F3F4F6"/>
        </linearGradient>
        <linearGradient id="rdroad" x1="0" y1="0" x2="64" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#111827"/><stop offset="100%" stopColor="#16A34A"/>
        </linearGradient>
        <linearGradient id="rdcar" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#16A34A"/><stop offset="100%" stopColor="#15803D"/>
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#rdbg)"/>
      <rect x="0.5" y="0.5" width="63" height="63" rx="15.5" stroke="#E5E7EB" strokeWidth="1"/>
      <path d="M 10 42 Q 32 24 54 42" stroke="url(#rdroad)" strokeWidth="2.5" strokeDasharray="5 4" strokeLinecap="round" fill="none" opacity="0.6"/>
      <circle cx="10" cy="42" r="6" fill="#111827" opacity="0.12"/>
      <circle cx="10" cy="42" r="3.5" fill="#111827"/>
      <text x="10" y="45.5" textAnchor="middle" fontFamily="system-ui" fontWeight="800" fontSize="4.5" fill="#fff">A</text>
      <circle cx="54" cy="42" r="6" fill="#16A34A" opacity="0.18"/>
      <circle cx="54" cy="42" r="3.5" fill="#16A34A"/>
      <text x="54" y="45.5" textAnchor="middle" fontFamily="system-ui" fontWeight="800" fontSize="4.5" fill="#fff">B</text>
      <g transform="translate(26,26)">
        <ellipse cx="6" cy="12" rx="8" ry="2" fill="#111827" opacity="0.1"/>
        <rect x="1" y="5" width="10" height="6" rx="1.5" fill="url(#rdcar)"/>
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

// ── Editorial palette — matches the apology email ────────────────────
const T = {
  bg:           "#FAFAF9",   // warm gray (email background)
  surface:      "#FFFFFF",
  surfaceAlt:   "#F8FAFC",
  border:       "#E5E7EB",
  borderLight:  "#F3F4F6",
  borderDeep:   "#D1D5DB",
  text:         "#0F172A",
  textMid:      "#374151",
  textMuted:    "#6B7280",
  textDim:      "#9CA3AF",
  green:        "#16A34A",
  greenDeep:    "#15803D",
  greenLight:   "#F0FDF4",
  greenBorder:  "#BBF7D0",
  red:          "#DC2626",
  redLight:     "#FEF2F2",
  amber:        "#D97706",
  amberLight:   "#FFFBEB",
  amberBorder:  "#FDE68A",
};

// ── CSS ───────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap');

  * { box-sizing:border-box; margin:0; padding:0; -webkit-tap-highlight-color:transparent; }
  body { background:${T.bg}; color:${T.text}; font-family:'Inter',system-ui,sans-serif; }
  ::-webkit-scrollbar { width:0; height:0; }

  @keyframes spin       { to { transform:rotate(360deg) } }
  @keyframes fadeUp     { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes pulse      { 0%,100%{box-shadow:0 0 0 0 rgba(22,163,74,.4)} 70%{box-shadow:0 0 0 9px rgba(22,163,74,0)} }
  @keyframes dotBlink   { 0%,100%{opacity:.4} 50%{opacity:1} }

  .fade-up { animation: fadeUp .4s cubic-bezier(.25,.46,.45,.94) both; }
  .mono { font-family:'JetBrains Mono',monospace; font-variant-numeric:tabular-nums; }
  .spin { animation: spin 1s linear infinite; }

  /* ── Base card ── */
  .card {
    background:${T.surface};
    border:1px solid ${T.border};
    border-radius:18px;
    overflow:hidden;
  }

  /* ── Eyebrow label (matches email "RIDE UPDATE" style) ── */
  .eyebrow {
    font-family:'JetBrains Mono',monospace;
    font-size:10.5px;
    font-weight:700;
    color:${T.textMuted};
    letter-spacing:2px;
    text-transform:uppercase;
  }
  .eyebrow.green { color:${T.green}; }
  .eyebrow.amber { color:${T.amber}; }

  /* ── Section header ── */
  .section-h {
    display:flex; align-items:center; justify-content:space-between;
    padding: 0 4px 12px;
  }
  .section-h-link {
    background:none; border:none; cursor:pointer;
    font-family:'Inter',sans-serif;
    font-size:12px; font-weight:700; color:${T.green};
    display:flex; align-items:center; gap:3px;
    padding:5px 8px; border-radius:8px;
    transition: background .12s;
  }
  .section-h-link:hover { background:${T.greenLight}; }

  /* ── Primary CTA ── */
  .btn-primary {
    width:100%; padding:16px 18px;
    background:linear-gradient(135deg,#22C55E 0%,#16A34A 60%,#15803D 100%);
    color:#fff;
    border:none; border-radius:14px;
    font-family:'Inter',sans-serif;
    font-size:15px; font-weight:800;
    letter-spacing:-0.1px;
    cursor:pointer;
    box-shadow:0 6px 22px rgba(22,163,74,.32), inset 0 1px 0 rgba(255,255,255,.18);
    display:flex; align-items:center; justify-content:center; gap:9px;
    transition: all .15s ease;
  }
  .btn-primary:hover  { transform:translateY(-1px); box-shadow:0 10px 28px rgba(22,163,74,.4); }
  .btn-primary:active { transform:translateY(0); }

  .btn-ghost {
    width:100%; padding:13px 16px;
    background:${T.surface};
    color:${T.text};
    border:1px solid ${T.border};
    border-radius:14px;
    font-family:'Inter',sans-serif;
    font-size:13.5px; font-weight:700;
    cursor:pointer;
    display:flex; align-items:center; justify-content:center; gap:8px;
    transition: all .15s ease;
  }
  .btn-ghost:hover { background:${T.surfaceAlt}; border-color:${T.borderDeep}; }

  .back-btn {
    display:inline-flex; align-items:center; gap:7px;
    background:${T.surface};
    border:1px solid ${T.border};
    border-radius:99px;
    padding:8px 14px 8px 11px;
    font-family:'Inter',sans-serif;
    font-size:12.5px; font-weight:700; color:${T.text};
    cursor:pointer;
    margin-bottom:16px;
    transition: all .15s ease;
  }
  .back-btn:hover { background:${T.surfaceAlt}; transform:translateX(-2px); }

  /* ── Row inside a card ── */
  .row {
    display:flex; align-items:center; gap:14px;
    padding:14px 18px;
    background:${T.surface};
    cursor:pointer;
    transition: background .12s;
    border-bottom:1px solid ${T.borderLight};
  }
  .row:last-child { border-bottom:none; }
  .row:hover { background:${T.surfaceAlt}; }
  .row:active { background:${T.borderLight}; }

  /* ── Pill ── */
  .pill {
    display:inline-flex; align-items:center; gap:5px;
    padding:3px 10px;
    border-radius:99px;
    font-size:10px; font-weight:700;
    letter-spacing:.06em; text-transform:uppercase;
    font-family:'JetBrains Mono',monospace;
  }

  /* ── Bottom tab bar ── */
  .tabbar {
    position:fixed; bottom:0; left:0; right:0;
    display:flex; justify-content:center;
    padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
    z-index:100;
    pointer-events:none;
  }
  .tabbar-pill {
    display:flex; align-items:center;
    background:rgba(255,255,255,.96);
    backdrop-filter:blur(20px);
    -webkit-backdrop-filter:blur(20px);
    border:1px solid ${T.border};
    border-radius:32px;
    padding:6px;
    gap:2px;
    box-shadow:0 8px 28px rgba(15,23,42,.10), 0 2px 6px rgba(15,23,42,.05);
    pointer-events:all;
  }
  .tab-btn {
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    gap:3px;
    padding:9px 14px; min-width:62px;
    border:none; background:transparent;
    cursor:pointer;
    border-radius:24px;
    font-family:'Inter',sans-serif;
    font-size:9.5px; font-weight:700;
    letter-spacing:.05em; text-transform:uppercase;
    color:${T.textDim};
    transition: color .2s, background .2s;
  }
  .tab-btn .ti {
    width:24px; height:22px;
    display:flex; align-items:center; justify-content:center;
    transition: transform .25s cubic-bezier(.34,1.56,.64,1);
  }
  .tab-btn:hover { color:${T.textMid}; }
  .tab-btn:hover .ti { transform: translateY(-1px); }
  .tab-btn.active {
    background:linear-gradient(135deg, ${T.greenLight} 0%, rgba(22,163,74,.06) 100%);
    color:${T.greenDeep};
  }
  .tab-btn.active .ti { transform: translateY(-1px) scale(1.08); }
  .tab-fab {
    width:52px; height:52px;
    border-radius:50%;
    background:linear-gradient(145deg, #22C55E 0%, #16A34A 50%, #15803D 100%);
    border:3px solid #fff;
    box-shadow:0 8px 22px rgba(22,163,74,.5), inset 0 1px 0 rgba(255,255,255,.25);
    display:flex; align-items:center; justify-content:center;
    cursor:pointer;
    transform:translateY(-9px);
    transition: transform .2s cubic-bezier(.34,1.56,.64,1);
    flex-shrink:0;
    margin: 0 4px;
  }
  .tab-fab:hover  { transform:translateY(-12px); }
  .tab-fab:active { transform:translateY(-6px); }

  /* ── Spinner ── */
  .spinner {
    width:22px; height:22px;
    border:2.5px solid ${T.border};
    border-top-color:${T.green};
    border-radius:50%;
    animation:spin .8s linear infinite;
  }

  /* ── Decorative route stripe (matches email) ── */
  .route-stripe {
    background:${T.surfaceAlt};
    border:1px solid ${T.border};
    border-radius:12px;
    padding:14px 16px;
  }

  /* ── Active ride banner ── */
  .active-banner {
    background:linear-gradient(135deg, #052e16 0%, #14532d 55%, #166534 100%);
    border-radius:18px;
    padding:18px;
    position:relative;
    overflow:hidden;
    cursor:pointer;
    box-shadow: 0 8px 28px rgba(22,163,74,.25);
  }
  .active-banner::after {
    content:'';
    position:absolute; top:-40px; right:-40px;
    width:160px; height:160px;
    border-radius:50%;
    background: radial-gradient(circle, rgba(74,222,128,.16) 0%, transparent 70%);
    pointer-events:none;
  }
  .live-dot {
    width:6px; height:6px; border-radius:50%;
    background:#4ADE80;
    animation:dotBlink 1.6s ease-in-out infinite;
  }

  /* ── Tab fade ── */
  .tab-fade { animation: fadeUp .35s ease-out both; }
`;

// ── Helpers ───────────────────────────────────────────────────────────
const getInitials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0][0].toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const formatJoined = (ts) => {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

const shortAddr = (addr = "") => addr.split(",")[0].trim() || addr;

// Use account uid as a stable referral code seed (last 5 chars uppercase)
const refCodeFor = (uid) => uid ? `RIDE${String(uid).slice(-5).toUpperCase()}` : "RIDE";

// ── Avatar ────────────────────────────────────────────────────────────
function Avatar({ initials, size = 48 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "linear-gradient(135deg,#22C55E,#15803D)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.34, fontWeight: 800, color: "#fff",
      letterSpacing: 0.5, flexShrink: 0,
      boxShadow: `0 ${size * 0.1}px ${size * 0.25}px rgba(22,163,74,.28)`,
      border: "2.5px solid #fff",
    }}>
      {initials}
    </div>
  );
}

// ── Status pill ───────────────────────────────────────────────────────
function StatusPill({ status }) {
  const map = {
    completed:        { label: "Completed",   bg: T.greenLight, color: T.greenDeep },
    cancelled:        { label: "Cancelled",   bg: T.redLight,   color: T.red       },
    timeout:          { label: "Timed out",   bg: T.amberLight, color: T.amber     },
    in_progress:      { label: "In Progress", bg: T.greenLight, color: T.greenDeep },
    searching_driver: { label: "Searching",   bg: T.amberLight, color: T.amber     },
    driver_assigned:  { label: "Assigned",    bg: T.greenLight, color: T.greenDeep },
    driver_arriving:  { label: "Arriving",    bg: T.greenLight, color: T.greenDeep },
    arrived:          { label: "Arrived",     bg: T.greenLight, color: T.greenDeep },
  };
  const c = map[status] || map.completed;
  return <span className="pill" style={{ background: c.bg, color: c.color }}>{c.label}</span>;
}

// ── Mini route visualization ──────────────────────────────────────────
function RouteMini({ pickup, dropoff }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        paddingTop: 4, paddingBottom: 4,
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: T.green,
        }}/>
        <div style={{
          width: 2, flex: 1,
          background: `repeating-linear-gradient(to bottom, ${T.borderDeep} 0, ${T.borderDeep} 3px, transparent 3px, transparent 6px)`,
          marginTop: 4, marginBottom: 4,
        }}/>
        <div style={{
          width: 8, height: 8, borderRadius: 2,
          background: T.text, transform: "rotate(45deg)",
        }}/>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0 }}>
        <div>
          <div className="eyebrow" style={{ fontSize: 9.5, marginBottom: 2 }}>From</div>
          <div style={{
            fontFamily: "Georgia, serif",
            fontSize: 13.5, fontWeight: 600, color: T.text,
            lineHeight: 1.4,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {shortAddr(pickup)}
          </div>
        </div>
        <div>
          <div className="eyebrow" style={{ fontSize: 9.5, marginBottom: 2 }}>To</div>
          <div style={{
            fontFamily: "Georgia, serif",
            fontSize: 13.5, fontWeight: 600, color: T.text,
            lineHeight: 1.4,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {shortAddr(dropoff)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// HERO BLOCK — light editorial, leads with action
// ─────────────────────────────────────────────────────────────────────
function HomeHero({ firstName, completedCount, onBookRide }) {
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div className="card fade-up" style={{ padding: "26px 22px 22px", marginBottom: 14, position: "relative", overflow: "hidden" }}>
      {/* Faint background decoration */}
      <div style={{
        position: "absolute", top: -60, right: -60,
        width: 200, height: 200, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(22,163,74,.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }}/>

      <div style={{ position: "relative" }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>{greeting}</div>
        <h1 style={{
          fontFamily: "Georgia, serif",
          fontSize: 30, fontWeight: 700,
          color: T.text, letterSpacing: -0.6, lineHeight: 1.15,
          marginBottom: 6,
        }}>
          {firstName}.
        </h1>
        <p style={{
          fontFamily: "Georgia, serif",
          fontSize: 15, color: T.textMuted,
          lineHeight: 1.5,
          marginBottom: 22,
        }}>
          {completedCount === 0
            ? "Ready when you are. Book a ride and we'll handle the rest."
            : completedCount === 1
              ? "Welcome back. Where to today?"
              : `You've taken ${completedCount} trips with us. Where to today?`}
        </p>

        <button className="btn-primary" onClick={onBookRide}>
          <Navigation size={16} strokeWidth={2.5}/>
          Book a ride
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// REFERRAL BLOCK — your distribution engine
// ─────────────────────────────────────────────────────────────────────
function ReferralCard({ uid, onToast }) {
  const code = refCodeFor(uid);

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      onToast?.("Code copied to clipboard");
    } catch {
      onToast?.(`Your code: ${code}`);
    }
  };

  const share = async () => {
    const url = "https://uatob.com";
    const text = `Use my code ${code} on UaTob — $10 off your first Orlando ride. No app to download, book from your browser: ${url}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "UaTob", text, url });
      } catch { /* user cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        onToast?.("Share link copied");
      } catch {
        onToast?.("Share via text or social");
      }
    }
  };

  return (
    <div className="card fade-up" style={{
      padding: 0, marginBottom: 14, overflow: "hidden",
      background: `linear-gradient(135deg, ${T.greenLight} 0%, #DCFCE7 100%)`,
      borderColor: T.greenBorder,
    }}>
      <div style={{ padding: "20px 22px 18px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, marginBottom: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="eyebrow green" style={{ marginBottom: 6 }}>
              <Gift size={11} style={{ display: "inline", marginRight: 5, verticalAlign: -1 }}/>
              Share UaTob, earn $10
            </div>
            <h3 style={{
              fontFamily: "Georgia, serif",
              fontSize: 22, fontWeight: 700, color: T.greenDeep,
              letterSpacing: -0.4, lineHeight: 1.2,
            }}>
              Friends ride for less.<br/>You ride for less, too.
            </h3>
          </div>
        </div>

        <p style={{
          fontFamily: "Georgia, serif",
          fontSize: 13.5, color: T.greenDeep,
          lineHeight: 1.55, marginBottom: 14,
        }}>
          When a friend uses your code, they get <strong>$10 off</strong> their first ride. You get <strong>$10 credit</strong> after they ride.
        </p>

        {/* Code display */}
        <div style={{
          background: "#FFFFFF",
          border: `1.5px dashed ${T.greenBorder}`,
          borderRadius: 12,
          padding: "12px 16px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12, marginBottom: 12,
        }}>
          <div style={{ minWidth: 0 }}>
            <div className="eyebrow" style={{ fontSize: 9, marginBottom: 2 }}>Your code</div>
            <div className="mono" style={{
              fontSize: 18, fontWeight: 700, color: T.text,
              letterSpacing: 1,
            }}>{code}</div>
          </div>
          <button
            onClick={copyCode}
            style={{
              background: T.surface,
              border: `1px solid ${T.greenBorder}`,
              color: T.greenDeep,
              padding: "9px 11px", borderRadius: 9,
              fontSize: 11.5, fontWeight: 700,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
              fontFamily: "inherit",
              transition: "background .15s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = T.greenLight}
            onMouseLeave={e => e.currentTarget.style.background = T.surface}
          >
            <Copy size={12}/> Copy
          </button>
        </div>

        <button
          onClick={share}
          style={{
            width: "100%",
            padding: "12px 16px",
            background: T.greenDeep,
            color: "#fff", border: "none",
            borderRadius: 12,
            fontSize: 13, fontWeight: 800,
            fontFamily: "inherit",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            letterSpacing: -0.1,
            transition: "background .15s",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "#14532D"}
          onMouseLeave={e => e.currentTarget.style.background = T.greenDeep}
        >
          <Share2 size={13}/>
          Share your code
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ACTIVE RIDE BANNER — full attention when ride is in flight
// ─────────────────────────────────────────────────────────────────────
function ActiveRideBanner({ ride, onPress }) {
  const statusMap = {
    searching_driver: { label: "Finding your driver",  sub: "Matching with the closest driver", icon: <Loader size={14} className="spin"/> },
    driver_assigned:  { label: "Driver assigned",      sub: "Your driver is on the way",         icon: <CheckCircle size={14}/> },
    driver_arriving:  { label: "Driver on the way",    sub: ride.driverEtaMin != null ? `${ride.driverEtaMin} min away` : "Heading to pickup", icon: <Navigation size={14}/> },
    arrived:          { label: "Driver has arrived",   sub: "Meet your driver at the pickup",    icon: <MapPin size={14}/> },
    in_progress:      { label: "Trip in progress",     sub: ride.dropoffEtaMin != null ? `${ride.dropoffEtaMin} min to arrival` : "Heading to your destination", icon: <ArrowRight size={14}/> },
  };
  const s = statusMap[ride.status] ?? { label: ride.status, sub: "", icon: <Activity size={14}/> };
  const driverInitials = ride.driverName ? getInitials(ride.driverName) : null;

  return (
    <div className="active-banner fade-up" onClick={onPress}>
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            background: "rgba(255,255,255,.12)",
            border: "1px solid rgba(255,255,255,.18)",
            borderRadius: 99, padding: "4px 11px",
          }}>
            <span className="live-dot"/>
            <span className="mono" style={{ fontSize: 10, fontWeight: 700, color: "#fff", letterSpacing: 1.2 }}>
              ACTIVE TRIP
            </span>
          </div>
          {ride.fareTotal != null && (
            <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: "#fff", letterSpacing: -0.3 }}>
              ${ride.fareTotal.toFixed(2)}
            </div>
          )}
        </div>

        {/* Status */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "rgba(255,255,255,.14)",
            border: "1px solid rgba(255,255,255,.22)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#4ADE80", flexShrink: 0,
          }}>{s.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: "Georgia, serif",
              fontSize: 16, fontWeight: 700, color: "#fff",
              letterSpacing: -0.2, marginBottom: 2,
            }}>{s.label}</div>
            <div style={{ fontSize: 11.5, color: "rgba(187,247,208,.85)", fontWeight: 500 }}>
              {s.sub}
            </div>
          </div>
          <ChevronRight size={18} color="rgba(255,255,255,.65)"/>
        </div>

        {/* Route */}
        <div style={{
          background: "rgba(255,255,255,.08)",
          border: "1px solid rgba(255,255,255,.12)",
          borderRadius: 11,
          padding: "12px 14px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ADE80" }}/>
            <div style={{
              fontSize: 12.5, fontWeight: 600, color: "#fff",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1,
            }}>{shortAddr(ride.pickup)}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 7, height: 7, borderRadius: 2, background: "#fff", transform: "rotate(45deg)" }}/>
            <div style={{
              fontSize: 12.5, fontWeight: 600, color: "#fff",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1,
            }}>{shortAddr(ride.dropoff)}</div>
          </div>
        </div>

        {/* Driver */}
        {driverInitials && ride.status !== "searching_driver" && (
          <div style={{
            marginTop: 12, paddingTop: 12,
            borderTop: "1px solid rgba(255,255,255,.15)",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: "50%",
              background: "#fff", color: T.greenDeep,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 800,
            }}>{driverInitials}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#fff" }}>
                {ride.driverName ?? "Your Driver"}
              </div>
              {ride.vehicle && (
                <div style={{ fontSize: 10.5, color: "rgba(187,247,208,.75)", fontWeight: 600 }}>
                  {ride.vehicle.color} {ride.vehicle.make} · {ride.vehicle.plate ?? ride.rideLabel}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// RECENT TRIP CARD — appears only when there's a real trip
// ─────────────────────────────────────────────────────────────────────
function RecentTripCard({ ride, onView, onRebook }) {
  return (
    <div className="card fade-up" style={{ overflow: "hidden", marginBottom: 14 }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 18px 0",
      }}>
        <div className="eyebrow">Last trip</div>
        <StatusPill status={ride.status}/>
      </div>

      <div style={{ padding: "10px 18px 14px" }} onClick={onView} style={{ cursor: "pointer", padding: "10px 18px 14px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 600 }}>
            {ride.date}
          </div>
          <div className="mono" style={{
            fontSize: 22, fontWeight: 700,
            color: ride.status === "cancelled" ? T.textMuted : T.greenDeep,
            textDecoration: ride.status === "cancelled" ? "line-through" : "none",
            letterSpacing: -0.4, lineHeight: 1,
          }}>
            ${ride.fare.toFixed(2)}
          </div>
        </div>

        <div className="route-stripe">
          <RouteMini pickup={ride.from} dropoff={ride.to}/>
        </div>
      </div>

      {ride.status === "completed" && (
        <div style={{
          padding: "10px 14px 14px",
          borderTop: `1px solid ${T.borderLight}`,
          background: T.surfaceAlt,
          display: "flex", gap: 8,
        }}>
          <button
            onClick={onView}
            className="btn-ghost"
            style={{ padding: "10px 12px", fontSize: 12.5 }}
          >
            <Receipt size={13}/> View receipt
          </button>
          <button
            onClick={() => onRebook?.(ride)}
            style={{
              flex: 1, padding: "10px 12px",
              background: T.green, color: "#fff",
              border: "none", borderRadius: 14,
              fontFamily: "inherit",
              fontSize: 12.5, fontWeight: 800,
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              transition: "background .15s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = T.greenDeep}
            onMouseLeave={e => e.currentTarget.style.background = T.green}
          >
            <Repeat size={13}/> Book again
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// QUICK ACTIONS — compact, no fake stats
// ─────────────────────────────────────────────────────────────────────
function QuickActions({ onTab, onToast }) {
  const actions = [
    { icon: Clock,      label: "Trips",   onClick: () => onTab("trips")   },
    { icon: CreditCard, label: "Payment", onClick: () => onTab("payment") },
    { icon: User,       label: "Account", onClick: () => onTab("account") },
    { icon: HelpCircle, label: "Help",    onClick: () => onToast?.("Help center coming soon") },
  ];

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
      gap: 8, marginBottom: 14,
    }}>
      {actions.map(({ icon: Icon, label, onClick }) => (
        <button
          key={label}
          onClick={onClick}
          style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 14,
            padding: "14px 8px",
            cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 7,
            fontFamily: "inherit",
            transition: "all .15s ease",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = T.surfaceAlt;
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = T.surface;
            e.currentTarget.style.transform = "";
          }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: T.greenLight,
            border: `1px solid ${T.greenBorder}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Icon size={15} color={T.greenDeep} strokeWidth={2.2}/>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 700, color: T.text,
            letterSpacing: -0.05,
          }}>{label}</span>
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────
function EmptyState({ icon: Icon, title, sub, action, actionLabel }) {
  return (
    <div style={{ textAlign: "center", padding: "44px 22px" }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16,
        background: T.greenLight, border: `1.5px solid ${T.greenBorder}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 14px",
      }}>
        <Icon size={24} color={T.greenDeep}/>
      </div>
      <div style={{
        fontFamily: "Georgia, serif",
        fontSize: 18, fontWeight: 700, color: T.text,
        marginBottom: 6, letterSpacing: -0.3,
      }}>{title}</div>
      <div style={{
        fontFamily: "Georgia, serif",
        fontSize: 13.5, color: T.textMuted,
        marginBottom: action ? 18 : 0,
        lineHeight: 1.55, maxWidth: 320, margin: action ? "0 auto 18px" : "0 auto",
      }}>{sub}</div>
      {action && (
        <button className="btn-primary" onClick={action} style={{ maxWidth: 240, margin: "0 auto" }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// RIDE DETAIL VIEW — clean receipt
// ─────────────────────────────────────────────────────────────────────
function RideDetail({ ride, onBack, onRebook }) {
  const fareTotal    = ride.fareTotal ?? ride.fare ?? 0;
  const tripDistance = ride.tripDistanceMiles ?? (ride.miles ? parseFloat(ride.miles) : null);
  const tripDuration = ride.tripDurationMin ?? parseInt(ride.duration);
  const platformFee  = fareTotal * 0.25;
  const tripFare     = fareTotal - platformFee;

  return (
    <div style={{ padding: "0 18px 32px" }} className="fade-up">
      <button className="back-btn" onClick={onBack}>
        <ChevronLeft size={14}/> Back to trips
      </button>

      {/* Receipt hero */}
      <div className="card" style={{ marginBottom: 14, overflow: "hidden" }}>
        <div style={{
          height: 3,
          background: ride.status === "completed"
            ? `linear-gradient(90deg, #22C55E, #15803D)`
            : `linear-gradient(90deg, #EF4444, #B91C1C)`,
        }}/>

        <div style={{ padding: "22px 22px 18px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Trip receipt</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <StatusPill status={ride.status}/>
                {ride.rideLabel && ride.rideLabel !== "—" && (
                  <span className="pill" style={{ background: T.surfaceAlt, color: T.textMid, border: `1px solid ${T.border}` }}>
                    {ride.rideLabel}
                  </span>
                )}
              </div>
            </div>
            <div className="mono" style={{
              fontSize: 30, fontWeight: 700,
              color: ride.status === "completed" ? T.text : T.textMuted,
              textDecoration: ride.status === "cancelled" ? "line-through" : "none",
              letterSpacing: -0.5, lineHeight: 1,
            }}>${fareTotal.toFixed(2)}</div>
          </div>

          <div style={{ fontSize: 12.5, color: T.textMuted, fontWeight: 500, marginBottom: 16 }}>
            <Calendar size={11} style={{ display: "inline", marginRight: 5, verticalAlign: -1 }}/>
            {ride.date}
          </div>

          <div className="route-stripe">
            <RouteMini pickup={ride.pickup ?? ride.from} dropoff={ride.dropoff ?? ride.to}/>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", borderTop: `1px solid ${T.border}` }}>
          {[
            { label: "Distance", value: tripDistance ? `${tripDistance.toFixed(1)} mi` : "—" },
            { label: "Duration", value: tripDuration ? `${tripDuration} min` : "—" },
            { label: "Driver",   value: ride.driver && ride.driver !== "—" ? ride.driver.split(" ")[0] : "—" },
          ].map((it, i) => (
            <div key={it.label} style={{
              flex: 1, padding: "13px 8px",
              borderRight: i < 2 ? `1px solid ${T.border}` : "none",
              textAlign: "center",
            }}>
              <div className="eyebrow" style={{ fontSize: 9.5, marginBottom: 4 }}>{it.label}</div>
              <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
                {it.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fare breakdown */}
      {ride.status === "completed" && (
        <div className="card" style={{ padding: "16px 20px", marginBottom: 14 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            <Receipt size={11} style={{ display: "inline", marginRight: 5, verticalAlign: -1 }}/>
            Fare breakdown
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13, color: T.text, fontWeight: 500 }}>
            <span style={{ fontFamily: "Georgia, serif" }}>Trip fare</span>
            <span className="mono" style={{ fontWeight: 700 }}>${tripFare.toFixed(2)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontSize: 13, color: T.textMid, fontWeight: 500, borderBottom: `1px solid ${T.borderLight}` }}>
            <span style={{ fontFamily: "Georgia, serif" }}>Service fee</span>
            <span className="mono" style={{ fontWeight: 700 }}>${platformFee.toFixed(2)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 11, marginTop: 4, fontSize: 14, fontWeight: 800, color: T.text }}>
            <span>Total</span>
            <span className="mono">${fareTotal.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {ride.status === "completed" && (
          <button className="btn-primary" onClick={() => onRebook?.(ride)}>
            <Repeat size={15}/> Book this route again
          </button>
        )}
        <button className="btn-ghost">
          <HelpCircle size={14}/> Get help with this trip
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// TRIPS TAB
// ─────────────────────────────────────────────────────────────────────
function TripsTab({ uid, onBookRide }) {
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");
  const { rides, loading, error } = useRideHistory(uid);

  if (selected) return (
    <RideDetail
      ride={selected}
      onBack={() => setSelected(null)}
      onRebook={() => onBookRide?.()}
    />
  );

  const completed = rides.filter(r => r.status === "completed");
  const cancelled = rides.filter(r => r.status === "cancelled" || r.status === "timeout");
  const filtered  = filter === "completed" ? completed
                  : filter === "cancelled" ? cancelled
                  : rides;
  const totalSpent = completed.reduce((s, r) => s + (r.fareTotal ?? r.fare ?? 0), 0);

  const Tab = ({ id, label }) => (
    <button
      onClick={() => setFilter(id)}
      style={{
        flex: 1, padding: "8px 0",
        background: filter === id ? T.text : "transparent",
        color: filter === id ? "#fff" : T.textMuted,
        border: "none",
        borderRadius: 99,
        fontFamily: "inherit",
        fontSize: 12, fontWeight: 800,
        cursor: "pointer",
        transition: "all .15s",
      }}
    >{label}</button>
  );

  return (
    <div style={{ padding: "0 18px 32px" }} className="tab-fade">
      {/* Summary */}
      {completed.length > 0 && (
        <div className="card" style={{ padding: "16px 20px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 4 }}>Lifetime</div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: -0.4, lineHeight: 1 }}>
                ${totalSpent.toFixed(2)}
              </div>
              <div style={{ fontSize: 11.5, color: T.textMuted, fontWeight: 600, marginTop: 4 }}>
                across {completed.length} trip{completed.length !== 1 ? "s" : ""}
              </div>
            </div>
            <div style={{
              width: 44, height: 44, borderRadius: 13,
              background: T.greenLight,
              border: `1.5px solid ${T.greenBorder}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Receipt size={18} color={T.greenDeep}/>
            </div>
          </div>
        </div>
      )}

      {rides.length > 0 && (
        <div style={{
          display: "flex", gap: 4,
          background: T.surfaceAlt,
          padding: 4, borderRadius: 99,
          border: `1px solid ${T.border}`,
          marginBottom: 14,
        }}>
          <Tab id="all" label={`All (${rides.length})`}/>
          <Tab id="completed" label={`Completed (${completed.length})`}/>
          <Tab id="cancelled" label={`Other (${cancelled.length})`}/>
        </div>
      )}

      {loading && (
        <div className="card" style={{ padding: "30px 0", display: "flex", justifyContent: "center" }}>
          <div className="spinner"/>
        </div>
      )}

      {error && (
        <div style={{
          background: T.redLight,
          border: `1px solid rgba(239,68,68,.18)`,
          borderRadius: 14, padding: "14px 16px",
          fontSize: 13, color: T.red, fontWeight: 600,
        }}>{error}</div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="card">
          <EmptyState
            icon={Clock}
            title={rides.length === 0 ? "No trips yet" : `No ${filter} trips`}
            sub={rides.length === 0 ? "Your completed rides will appear here. Book your first ride to get started." : "Try a different filter or book a new ride."}
            action={rides.length === 0 ? onBookRide : null}
            actionLabel="Book your first ride"
          />
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="card">
          {filtered.map(ride => {
            const cancelled = ride.status === "cancelled" || ride.status === "timeout";
            return (
              <div key={ride.id} className="row" onClick={() => setSelected(ride)}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                  background: cancelled ? T.redLight : T.greenLight,
                  border: `1.5px solid ${cancelled ? "rgba(220,38,38,.18)" : T.greenBorder}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {cancelled
                    ? <XCircle size={16} color={T.red} strokeWidth={2.2}/>
                    : <Navigation size={15} color={T.greenDeep} strokeWidth={2.2}/>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: "Georgia, serif",
                    fontSize: 14, fontWeight: 600, color: T.text,
                    marginBottom: 3,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>{ride.from} → {ride.to}</div>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6,
                    fontSize: 11, color: T.textMuted, fontWeight: 600,
                  }}>
                    <span>{ride.date}</span>
                    {ride.rideLabel && ride.rideLabel !== "—" && (
                      <>
                        <span style={{ width: 3, height: 3, borderRadius: "50%", background: T.border }}/>
                        <span style={{ textTransform: "capitalize" }}>{ride.rideLabel}</span>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <span className="mono" style={{
                    fontSize: 14, fontWeight: 700,
                    color: cancelled ? T.textMuted : T.text,
                    textDecoration: cancelled ? "line-through" : "none",
                    letterSpacing: -0.2,
                  }}>${ride.fare.toFixed(2)}</span>
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

// ─────────────────────────────────────────────────────────────────────
// PAYMENT TAB
// ─────────────────────────────────────────────────────────────────────
function PaymentTab({ onToast, rides = [] }) {
  const completed  = rides.filter(r => r.status === "completed");
  const totalSpent = completed.reduce((s, r) => s + (r.fareTotal ?? r.fare ?? 0), 0);

  return (
    <div style={{ padding: "0 18px 32px" }} className="tab-fade">
      <div className="card" style={{ padding: "22px 22px 20px", marginBottom: 14 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Payment methods</div>
        <h2 style={{
          fontFamily: "Georgia, serif",
          fontSize: 22, fontWeight: 700, color: T.text,
          letterSpacing: -0.4, marginBottom: 6,
        }}>Card, Cash App, or cash.</h2>
        <p style={{
          fontFamily: "Georgia, serif",
          fontSize: 14, color: T.textMuted,
          lineHeight: 1.55,
        }}>
          UaTob lets you pay how you want — at booking or directly to your driver. No saved card required.
        </p>
      </div>

      {/* Spending if data */}
      {completed.length > 0 && (
        <div className="card" style={{ padding: "16px 20px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 4 }}>Spent on UaTob</div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: -0.4, lineHeight: 1 }}>
                ${totalSpent.toFixed(2)}
              </div>
              <div style={{ fontSize: 11.5, color: T.textMuted, fontWeight: 600, marginTop: 4 }}>
                across {completed.length} trip{completed.length !== 1 ? "s" : ""}
              </div>
            </div>
            <div style={{
              width: 44, height: 44, borderRadius: 13,
              background: T.greenLight,
              border: `1.5px solid ${T.greenBorder}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Receipt size={18} color={T.greenDeep}/>
            </div>
          </div>
        </div>
      )}

      <div className="section-h">
        <div className="eyebrow">Saved methods</div>
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <EmptyState
          icon={CreditCard}
          title="No saved methods"
          sub="Add a card or Cash App for one-tap booking. We accept cash on every ride too."
        />
      </div>

      <button className="btn-primary" onClick={() => onToast?.("Saved card feature coming soon")}>
        <Plus size={15}/> Add payment method
      </button>

      <div style={{
        marginTop: 14,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        fontSize: 11, color: T.textMuted, fontWeight: 600,
      }}>
        <ShieldCheck size={12}/>
        Powered by Stripe — payments are encrypted end-to-end
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ACCOUNT TAB
// ─────────────────────────────────────────────────────────────────────
function AccountTab({ account, uid, onToast, onSignOut, rides = [] }) {
  const name       = account?.name  ?? "Rider";
  const email      = account?.email ?? "—";
  const initials   = getInitials(name);
  const joined     = formatJoined(account?.createdAt);
  const completed  = rides.filter(r => r.status === "completed").length;

  const sections = [
    {
      title: "Account",
      rows: [
        { icon: Edit3,     label: "Edit profile",       sub: "Name, phone, email"     },
        { icon: Lock,      label: "Privacy & security", sub: "Password, 2FA"          },
        { icon: Bell,      label: "Notifications",      sub: "Ride alerts, promos"    },
        { icon: MapPinned, label: "Saved places",       sub: "Home, work, favorites"  },
      ]
    },
    {
      title: "Support",
      rows: [
        { icon: HelpCircle,    label: "Help center",    sub: "FAQs and guides"      },
        { icon: MessageCircle, label: "Contact us",     sub: "support@uatob.com"    },
        { icon: Star,          label: "Rate UaTob",     sub: "Share your feedback"  },
      ]
    },
    {
      title: "Legal",
      rows: [
        { icon: FileText, label: "Terms of service", sub: "View terms"          },
        { icon: Shield,   label: "Privacy policy",   sub: "How we handle data"  },
      ]
    },
  ];

  return (
    <div style={{ padding: "0 18px 32px" }} className="tab-fade">
      {/* Profile */}
      <div className="card" style={{ padding: "22px 22px 18px", marginBottom: 18, position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: -50, right: -50,
          width: 150, height: 150, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(22,163,74,.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }}/>
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <Avatar initials={initials} size={56}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontFamily: "Georgia, serif",
                fontSize: 19, fontWeight: 700, color: T.text,
                letterSpacing: -0.3, marginBottom: 3,
              }}>{name}</div>
              <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 500, marginBottom: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {email}
              </div>
              <div style={{ fontSize: 11, color: T.textDim, fontWeight: 500 }}>
                Member since {joined}
              </div>
            </div>
          </div>

          <div style={{
            display: "flex", gap: 0,
            paddingTop: 14, borderTop: `1px solid ${T.borderLight}`,
          }}>
            {[
              { label: "Trips",  value: completed },
              { label: "Status", value: "Active" },
            ].map((it, i) => (
              <div key={it.label} style={{
                flex: 1, textAlign: "center",
                borderRight: i === 0 ? `1px solid ${T.borderLight}` : "none",
              }}>
                <div className="eyebrow" style={{ fontSize: 9.5, marginBottom: 4 }}>{it.label}</div>
                <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: T.text }}>
                  {it.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {sections.map(({ title, rows }) => (
        <div key={title} style={{ marginBottom: 14 }}>
          <div className="section-h">
            <div className="eyebrow">{title}</div>
          </div>
          <div className="card">
            {rows.map(({ icon: Icon, label, sub }) => (
              <div key={label} className="row" onClick={() => onToast?.(`${label} coming soon`)}>
                <div style={{
                  width: 36, height: 36, borderRadius: 11, flexShrink: 0,
                  background: T.greenLight,
                  border: `1px solid ${T.greenBorder}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={15} color={T.greenDeep} strokeWidth={2.2}/>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: "Georgia, serif",
                    fontSize: 14, fontWeight: 600, color: T.text,
                    marginBottom: 2,
                  }}>{label}</div>
                  <div style={{ fontSize: 11.5, color: T.textMuted, fontWeight: 500 }}>
                    {sub}
                  </div>
                </div>
                <ChevronRight size={14} color={T.textDim}/>
              </div>
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={onSignOut}
        style={{
          width: "100%", padding: "13px 16px",
          background: T.surface,
          color: T.red,
          border: "1px solid rgba(220,38,38,.18)",
          borderRadius: 14,
          fontFamily: "inherit",
          fontSize: 13, fontWeight: 700,
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          transition: "all .15s",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = T.redLight; }}
        onMouseLeave={e => { e.currentTarget.style.background = T.surface; }}
      >
        <LogOut size={14} strokeWidth={2.2}/>
        Sign out
      </button>

      <div style={{
        textAlign: "center", marginTop: 16,
        fontFamily: "JetBrains Mono, monospace",
        fontSize: 10.5, color: T.textDim, fontWeight: 500,
        letterSpacing: .5,
      }}>
        UATOB &middot; ORLANDO, FL &middot; V1.1.0
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// HOME TAB
// ─────────────────────────────────────────────────────────────────────
function HomeTab({ account, uid, onTab, onBookRide, onToast }) {
  const { rides } = useRideHistory(uid, 1);
  const name      = account?.name ?? "Rider";
  const firstName = name.split(" ")[0];
  const completedRides = rides.filter(r => r.status === "completed");
  const recentRide     = rides[0] ?? null;

  return (
    <div style={{ padding: "0 18px 32px" }} className="tab-fade">
      <HomeHero
        firstName={firstName}
        completedCount={completedRides.length}
        onBookRide={onBookRide}
      />

      <QuickActions onTab={onTab} onToast={onToast}/>

      <ReferralCard uid={uid} onToast={onToast}/>

      {recentRide && (
        <>
          <div className="section-h">
            <div className="eyebrow">Most recent</div>
            <button className="section-h-link" onClick={() => onTab("trips")}>
              See all <ChevronRight size={11}/>
            </button>
          </div>
          <RecentTripCard
            ride={recentRide}
            onView={() => onTab("trips")}
            onRebook={() => onBookRide?.()}
          />
        </>
      )}

      {!recentRide && (
        <div className="card">
          <EmptyState
            icon={Sparkles}
            title="Your trips will appear here"
            sub="Book a ride and we'll show your history, receipts, and a quick-rebook button."
          />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// TAB BAR
// ─────────────────────────────────────────────────────────────────────
function TabBar({ tab, setTab, onBookRide }) {
  const LEFT  = [
    { id: "home",  label: "Home",  icon: Home  },
    { id: "trips", label: "Trips", icon: Clock },
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
      <div className="ti"><Icon size={19} strokeWidth={tab === id ? 2.5 : 1.9}/></div>
      <span>{label}</span>
    </button>
  );

  return (
    <div className="tabbar">
      <div className="tabbar-pill">
        {LEFT.map(t => <TabBtn key={t.id} {...t}/>)}
        <button className="tab-fab" onClick={() => onBookRide?.()} aria-label="Book a ride">
          <Navigation size={19} color="#fff" strokeWidth={2.5}/>
        </button>
        {RIGHT.map(t => <TabBtn key={t.id} {...t}/>)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────
export default function RiderDashboard({ uid, account, active, onBookRide, onSignOut }) {
  const [tab, setTab]     = useState("home");
  const [toast, setToast] = useState(null);
  const toastRef = useRef(null);

  const { rides: allRides } = useRideHistory(uid);

  const showToast = msg => {
    setToast(msg);
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 2400);
  };

  const name       = account?.name ?? "Rider";
  const firstName  = name.split(" ")[0];
  const activeRide = active?.[0] ?? null;

  const titles = {
    home:    `Hi, ${firstName}`,
    trips:   "Your trips",
    payment: "Payment",
    account: "Account",
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text }}>
      <style>{CSS}</style>

      {toast && (
        <div style={{
          position: "fixed", top: 18, left: "50%", transform: "translateX(-50%)",
          background: T.text, color: "#fff",
          borderRadius: 12, padding: "11px 18px",
          fontSize: 13, fontWeight: 600, zIndex: 999,
          whiteSpace: "nowrap",
          boxShadow: "0 10px 28px rgba(15,23,42,.25)",
          animation: "fadeUp .25s ease-out",
        }}>{toast}</div>
      )}

      {/* Header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: `rgba(250, 250, 249, .92)`,
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: `1px solid ${T.border}`,
        padding: "14px 18px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <UaTobIcon size={32}/>
          <div>
            <div className="eyebrow" style={{ fontSize: 9, lineHeight: 1 }}>UATOB</div>
            <div style={{
              fontFamily: "Georgia, serif",
              fontSize: 16, fontWeight: 700, color: T.text,
              letterSpacing: -0.3, lineHeight: 1, marginTop: 3,
            }}>{titles[tab]}</div>
          </div>
        </div>
        <button
          onClick={() => onBookRide?.()}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "linear-gradient(135deg, #22C55E, #15803D)",
            color: "#fff",
            border: "none", borderRadius: 99,
            padding: "8px 14px",
            fontSize: 12, fontWeight: 800,
            cursor: "pointer",
            fontFamily: "inherit",
            letterSpacing: -0.1,
            boxShadow: "0 4px 14px rgba(22,163,74,.32)",
            transition: "all .15s",
          }}
          onMouseEnter={e => e.currentTarget.style.transform = "translateY(-1px)"}
          onMouseLeave={e => e.currentTarget.style.transform = ""}
        >
          <Navigation size={12} strokeWidth={2.5}/> Book
        </button>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 640, margin: "0 auto", paddingTop: 16, paddingBottom: 110 }}>
        {activeRide && (
          <div style={{ padding: "0 18px", marginBottom: 14 }}>
            <ActiveRideBanner ride={activeRide} onPress={() => onBookRide?.()}/>
          </div>
        )}

        <div key={tab}>
          {tab === "home"    && <HomeTab account={account} uid={uid} onTab={setTab} onBookRide={onBookRide} onToast={showToast}/>}
          {tab === "trips"   && <TripsTab uid={uid} onBookRide={onBookRide}/>}
          {tab === "payment" && <PaymentTab onToast={showToast} rides={allRides}/>}
          {tab === "account" && <AccountTab account={account} uid={uid} onToast={showToast} onSignOut={onSignOut} rides={allRides}/>}
        </div>
      </div>

      <TabBar tab={tab} setTab={setTab} onBookRide={onBookRide}/>
    </div>
  );
}
