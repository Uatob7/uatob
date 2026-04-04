import { useState, useRef } from "react";
import {
  Car, DollarSign, Bell, Search,
  ChevronRight, TrendingUp, TrendingDown,
  Shield, Clock, CheckCircle, XCircle,
  Ban, RefreshCw, Filter, ArrowUpRight, Activity,
  Zap, Menu, X, LogOut, Settings, BarChart2, Home
} from "lucide-react";

// ── Brand (inlined from src/App/Brand.jsx) ────────────────────────────
function UaTobIcon({ size = 46 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="ribg" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF"/><stop offset="100%" stopColor="#F3F4F6"/>
        </linearGradient>
        <linearGradient id="riroad" x1="0" y1="0" x2="64" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#111827"/><stop offset="100%" stopColor="#16A34A"/>
        </linearGradient>
        <linearGradient id="ricar" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#16A34A"/><stop offset="100%" stopColor="#15803D"/>
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#ribg)"/>
      <rect x="0.5" y="0.5" width="63" height="63" rx="15.5" stroke="#E5E7EB" strokeWidth="1"/>
      <path d="M 10 42 Q 32 24 54 42" stroke="url(#riroad)" strokeWidth="2.5" strokeDasharray="5 4" strokeLinecap="round" fill="none" opacity="0.6"/>
      <circle cx="10" cy="42" r="6" fill="#111827" opacity="0.12"/>
      <circle cx="10" cy="42" r="3.5" fill="#111827"/>
      <text x="10" y="45.5" textAnchor="middle" fontFamily="system-ui" fontWeight="800" fontSize="4.5" fill="#fff">A</text>
      <circle cx="54" cy="42" r="6" fill="#16A34A" opacity="0.18"/>
      <circle cx="54" cy="42" r="3.5" fill="#16A34A"/>
      <text x="54" y="45.5" textAnchor="middle" fontFamily="system-ui" fontWeight="800" fontSize="4.5" fill="#fff">B</text>
      <g transform="translate(26,26)">
        <ellipse cx="6" cy="12" rx="8" ry="2" fill="#111827" opacity="0.1"/>
        <rect x="1" y="5" width="10" height="6" rx="1.5" fill="url(#ricar)"/>
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

function UaTobWordmark({ iconSize = 40 }) {
  const fontSize  = iconSize * 0.62;
  const arrowSize = fontSize * 0.72;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: iconSize * 0.25 + "px" }}>
      <UaTobIcon size={iconSize} />
      <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
        <span style={{
          fontFamily: '"Outfit","Barlow",system-ui,sans-serif',
          fontWeight: 300, fontSize: fontSize + "px",
          color: "#111827", letterSpacing: "-0.5px", lineHeight: 1,
        }}>Ua</span>
        <svg width={arrowSize} height={arrowSize} viewBox="0 0 24 24" fill="none" style={{ margin: "0 2px", flexShrink: 0 }}>
          <path d="M5 12h14M13 6l6 6-6 6" stroke="#16A34A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span style={{
          fontFamily: '"Outfit","Barlow",system-ui,sans-serif',
          fontWeight: 800, fontSize: fontSize + "px",
          background: "linear-gradient(135deg,#16A34A,#22C55E)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          backgroundClip: "text", letterSpacing: "-0.5px", lineHeight: 1,
        }}>Tob</span>
      </div>
    </div>
  );
}

// ── Design tokens — light ─────────────────────────────────────────────
const C = {
  bg:          "#F2F5F2",
  surface:     "#FFFFFF",
  surfaceHigh: "#EEF1EE",
  border:      "#DDE5DD",
  borderLight: "#C8D4C8",
  text:        "#111827",
  textMuted:   "#6B7280",
  textDim:     "#9CA3AF",
  green:       "#16A34A",
  greenDark:   "#15803D",
  greenGlow:   "rgba(22,163,74,0.10)",
  blue:        "#2563EB",
  blueGlow:    "rgba(37,99,235,0.10)",
  amber:       "#B45309",
  amberGlow:   "rgba(180,83,9,0.10)",
  red:         "#DC2626",
  redGlow:     "rgba(220,38,38,0.10)",
  purple:      "#7C3AED",
  purpleGlow:  "rgba(124,58,237,0.10)",
};

// ── Mock data ─────────────────────────────────────────────────────────
const MOCK_RIDES = [
  { id:"r001", rider:"Marcus W.",  driver:"Jerome T.", from:"Downtown",  to:"Airport",        fare:38.50, status:"in_progress",     time:"2m ago"  },
  { id:"r002", rider:"Priya M.",   driver:"Leon A.",   from:"Westside",  to:"Midtown",        fare:14.20, status:"searching_driver", time:"1m ago"  },
  { id:"r003", rider:"Carlos D.",  driver:"Kira N.",   from:"North Park",to:"Harbor",         fare:22.80, status:"completed",        time:"8m ago"  },
  { id:"r004", rider:"Anya S.",    driver:"—",         from:"Oak Hills", to:"University",     fare:11.00, status:"searching_driver", time:"30s ago" },
  { id:"r005", rider:"Derek F.",   driver:"Tomás R.",  from:"Eastgate",  to:"Convention Ctr", fare:19.60, status:"arrived",          time:"4m ago"  },
  { id:"r006", rider:"Naomi K.",   driver:"Sam H.",    from:"Southside", to:"Stadium",        fare:9.40,  status:"completed",        time:"15m ago" },
];

const MOCK_DRIVERS = [
  { id:"d001", name:"Jerome T.",  rating:4.97, rides:312, status:"online",  earnings:148.20, joined:"Jan 2024" },
  { id:"d002", name:"Leon A.",    rating:4.89, rides:204, status:"online",  earnings:94.80,  joined:"Mar 2024" },
  { id:"d003", name:"Kira N.",    rating:4.95, rides:187, status:"offline", earnings:0,      joined:"Feb 2024" },
  { id:"d004", name:"Tomás R.",   rating:4.82, rides:98,  status:"online",  earnings:76.40,  joined:"May 2024" },
  { id:"d005", name:"Sam H.",     rating:4.91, rides:441, status:"offline", earnings:0,      joined:"Nov 2023" },
  { id:"d006", name:"Aaliyah J.", rating:3.60, rides:23,  status:"pending", earnings:0,      joined:"Jun 2024" },
];

const MOCK_PENDING = [
  { id:"p001", name:"Aaliyah J.", type:"New driver",       time:"2h ago",  avatar:"AJ" },
  { id:"p002", name:"Marcus Obi", type:"Vehicle update",   time:"4h ago",  avatar:"MO" },
  { id:"p003", name:"Rosa C.",    type:"New driver",        time:"1d ago",  avatar:"RC" },
  { id:"p004", name:"Tyler W.",   type:"Document upload",  time:"1d ago",  avatar:"TW" },
  { id:"p005", name:"Farai N.",   type:"New driver",        time:"2d ago",  avatar:"FN" },
  { id:"p006", name:"Juno Park",  type:"Background check", time:"3d ago",  avatar:"JP" },
];

// ── Status config ─────────────────────────────────────────────────────
const statusConfig = {
  in_progress:      { label:"In Progress", color:C.blue,    glow:C.blueGlow,   icon:Activity    },
  searching_driver: { label:"Searching",   color:C.amber,   glow:C.amberGlow,  icon:Clock       },
  arrived:          { label:"Arrived",     color:C.purple,  glow:C.purpleGlow, icon:Zap         },
  completed:        { label:"Completed",   color:C.green,   glow:C.greenGlow,  icon:CheckCircle },
  cancelled:        { label:"Cancelled",   color:C.red,     glow:C.redGlow,    icon:XCircle     },
  online:           { label:"Online",      color:C.green,   glow:C.greenGlow,  icon:CheckCircle },
  offline:          { label:"Offline",     color:C.textDim, glow:"transparent",icon:XCircle     },
  pending:          { label:"Pending",     color:C.amber,   glow:C.amberGlow,  icon:Clock       },
};

function initials(name) { return name.split(" ").map(w => w[0]).join("").slice(0, 2); }

// ── CSS ───────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;700;800;900&family=Barlow:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

  * { box-sizing:border-box; margin:0; padding:0; -webkit-tap-highlight-color:transparent; }
  body { background:${C.bg}; color:${C.text}; font-family:'Barlow',sans-serif; }
  ::-webkit-scrollbar { width:0; height:0; }

  @keyframes fadeUp      { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes pulse       { 0%,100%{opacity:1} 50%{opacity:.35} }
  @keyframes spinAnim    { to{transform:rotate(360deg)} }
  @keyframes slideInLeft { from{transform:translateX(-100%)} to{transform:translateX(0)} }
  @keyframes overlayIn   { from{opacity:0} to{opacity:1} }

  .fade-up   { animation:fadeUp .38s ease-out forwards; }
  .condensed { font-family:'Barlow Condensed',sans-serif; }
  .mono      { font-family:'JetBrains Mono',monospace; }

  .card {
    background:${C.surface};
    border:1px solid ${C.border};
    border-radius:16px;
    overflow:hidden;
    transition:border-color .15s, box-shadow .15s;
  }

  .pill {
    display:inline-flex; align-items:center; gap:5px;
    padding:3px 10px; border-radius:100px;
    font-size:11px; font-weight:700;
    letter-spacing:.4px; text-transform:uppercase;
  }

  .btn-primary {
    background:linear-gradient(135deg,#22C55E,#16A34A 55%,#15803D);
    color:#fff; border:none; border-radius:12px; padding:13px 20px;
    font-family:'Barlow',sans-serif; font-weight:800; font-size:14px;
    cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;
    box-shadow:0 4px 14px rgba(22,163,74,.25); transition:opacity .15s;
  }
  .btn-primary:active { opacity:.85; }

  .btn-ghost {
    background:${C.surface}; color:${C.text};
    border:1px solid ${C.border}; border-radius:12px; padding:10px 16px;
    font-family:'Barlow',sans-serif; font-weight:700; font-size:13px;
    cursor:pointer; display:flex; align-items:center; gap:6px;
    transition:background .15s;
  }
  .btn-ghost:active { background:${C.surfaceHigh}; }

  .btn-danger {
    background:rgba(220,38,38,.07); color:${C.red};
    border:1px solid rgba(220,38,38,.2); border-radius:12px; padding:11px 16px;
    font-family:'Barlow',sans-serif; font-weight:700; font-size:13px;
    cursor:pointer; display:flex; align-items:center; gap:6px;
    transition:background .15s;
  }
  .btn-danger:active { background:rgba(220,38,38,.14); }

  .btn-success {
    background:rgba(22,163,74,.08); color:${C.green};
    border:1px solid rgba(22,163,74,.22); border-radius:12px; padding:11px 16px;
    font-family:'Barlow',sans-serif; font-weight:700; font-size:13px;
    cursor:pointer; display:flex; align-items:center; gap:6px;
    transition:background .15s;
  }
  .btn-success:active { background:rgba(22,163,74,.16); }

  .tab-bar {
    position:fixed; bottom:0; left:0; right:0;
    background:rgba(255,255,255,.96);
    backdrop-filter:blur(14px);
    border-top:1px solid ${C.border};
    display:flex; z-index:100;
    padding-bottom:env(safe-area-inset-bottom);
    box-shadow:0 -2px 16px rgba(0,0,0,.06);
  }
  .tab-btn {
    flex:1; display:flex; flex-direction:column; align-items:center; gap:4px;
    padding:10px 0 8px; border:none; background:transparent; cursor:pointer;
    color:${C.textDim};
    font-family:'Barlow',sans-serif; font-size:10px; font-weight:700;
    letter-spacing:.5px; text-transform:uppercase; transition:color .15s;
  }
  .tab-btn.active { color:${C.green}; }

  .search-bar {
    display:flex; align-items:center; gap:10px;
    background:${C.surface}; border:1px solid ${C.border}; border-radius:12px;
    padding:10px 14px; box-shadow:0 1px 4px rgba(0,0,0,.04);
  }
  .search-bar input {
    flex:1; background:transparent; border:none; outline:none;
    color:${C.text}; font-family:'Barlow',sans-serif; font-size:14px; font-weight:500;
  }
  .search-bar input::placeholder { color:${C.textDim}; }

  .section-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
  .section-title {
    font-family:'Barlow Condensed',sans-serif;
    font-size:12px; font-weight:800; letter-spacing:1.2px;
    text-transform:uppercase; color:${C.textMuted};
  }

  .drawer-overlay { position:fixed; inset:0; background:rgba(0,0,0,.22); z-index:200; animation:overlayIn .2s ease; }
  .drawer {
    position:fixed; top:0; left:0; bottom:0; width:284px;
    background:${C.surface}; border-right:1px solid ${C.border};
    box-shadow:6px 0 28px rgba(0,0,0,.09);
    z-index:201;
    animation:slideInLeft .25s cubic-bezier(.34,1.1,.64,1);
    display:flex; flex-direction:column; overflow-y:auto;
  }

  .live-dot  { width:7px; height:7px; border-radius:50%; background:${C.green}; animation:pulse 1.8s infinite; }
  .amber-dot { width:7px; height:7px; border-radius:50%; background:${C.amber};  animation:pulse 1.8s infinite; }
`;

// ── Status Pill ───────────────────────────────────────────────────────
function StatusPill({ status }) {
  const cfg = statusConfig[status] || statusConfig.cancelled;
  const Icon = cfg.icon;
  return (
    <span className="pill" style={{ background: cfg.glow, color: cfg.color }}>
      <Icon size={9} />{cfg.label}
    </span>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────
const PALETTE = ["#16A34A","#2563EB","#7C3AED","#B45309","#DC2626","#0891B2"];
function Avatar({ name, size = 36, colorIdx = 0 }) {
  const bg = PALETTE[colorIdx % PALETTE.length];
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

// ── Stat Card ─────────────────────────────────────────────────────────
function StatCard({ label, value, delta, icon: Icon, color, delay = 0 }) {
  const up        = delta >= 0;
  const isRevenue = label.includes("Revenue");
  const formatted = isRevenue
    ? (value >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${value}`)
    : value.toLocaleString();
  return (
    <div className="card fade-up" style={{ padding: "16px", animationDelay: `${delay}ms`, opacity: 0, boxShadow: "0 1px 6px rgba(0,0,0,.05)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}15`, border: `1.5px solid ${color}28`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={17} color={color} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 700, color: up ? C.green : C.red }}>
          {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {up ? "+" : ""}{delta}{isRevenue ? "%" : ""}
        </div>
      </div>
      <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: C.text, letterSpacing: "-0.5px" }}>
        {formatted}
        {isRevenue && <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 3, fontFamily: "'Barlow',sans-serif", fontWeight: 500 }}>today</span>}
      </div>
      <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, marginTop: 3, letterSpacing: ".4px", textTransform: "uppercase" }}>
        {label}
      </div>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────
function Toast({ msg }) {
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

// ── Drawer ────────────────────────────────────────────────────────────
function Drawer({ open, onClose }) {
  if (!open) return null;
  const links = [
    { icon: Home,     label: "Dashboard"  },
    { icon: Car,      label: "Fleet"      },
    { icon: Search,   label: "Riders"     },
    { icon: BarChart2,label: "Analytics"  },
    { icon: Shield,   label: "Compliance" },
    { icon: Settings, label: "Settings"   },
  ];
  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer">
        <div style={{ padding: "20px 20px 18px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, display: "flex" }}>
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
            <button key={label} onClick={onClose} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 12,
              padding: "12px 12px", borderRadius: 12, border: "none",
              background: "transparent", color: C.text, cursor: "pointer",
              fontFamily: "'Barlow',sans-serif", fontSize: 15, fontWeight: 600,
              transition: "background .15s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = C.surfaceHigh}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <Icon size={18} color={C.textMuted} />{label}
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

// ── HOME TAB ──────────────────────────────────────────────────────────
function HomeTab({ onToast }) {
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); onToast("Data refreshed"); }, 1100);
  };
  const activeCount = MOCK_RIDES.filter(r => ["in_progress","arrived"].includes(r.status)).length;
  const searchCount = MOCK_RIDES.filter(r => r.status === "searching_driver").length;

  return (
    <div style={{ padding: "0 16px 16px" }}>
      {/* Live bar */}
      <div className="card fade-up" style={{ padding: "12px 16px", marginBottom: 16, animationDelay: "40ms", opacity: 0, boxShadow: "0 1px 6px rgba(0,0,0,.05)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div className="live-dot" />
              <span style={{ fontSize: 12, fontWeight: 700 }}>{activeCount} active rides</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div className="amber-dot" />
              <span style={{ fontSize: 12, fontWeight: 700 }}>{searchCount} searching</span>
            </div>
          </div>
          <button onClick={handleRefresh} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, display: "flex" }}>
            <RefreshCw size={15} style={{ animation: refreshing ? "spinAnim 1s linear infinite" : "none" }} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        <StatCard label="Total Rides"    value={1284} delta={12.4} icon={Activity}   color={C.blue}  delay={80}  />
        <StatCard label="Active Drivers" value={47}   delta={3}    icon={Car}        color={C.green} delay={130} />
        <StatCard label="Revenue Today"  value={9820} delta={8.1}  icon={DollarSign} color={C.amber} delay={180} />
        <StatCard label="Approvals"      value={6}    delta={-2}   icon={Shield}     color={C.red}   delay={230} />
      </div>

      {/* Live rides */}
      <div className="section-header">
        <div className="section-title">Live Rides</div>
        <button className="btn-ghost" style={{ padding: "6px 12px", fontSize: 11 }}>
          <Filter size={11} /> Filter
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {MOCK_RIDES.slice(0, 5).map((ride, i) => (
          <div key={ride.id} className="card fade-up" style={{ padding: "14px 16px", animationDelay: `${280 + i * 55}ms`, opacity: 0, boxShadow: "0 1px 5px rgba(0,0,0,.04)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Avatar name={ride.rider} size={34} colorIdx={1} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{ride.rider}</div>
                  <div style={{ fontSize: 11, color: C.textMuted }}>{ride.driver}</div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
                <StatusPill status={ride.status} />
                <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: C.green }}>${ride.fare.toFixed(2)}</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: C.surfaceHigh, borderRadius: 8, padding: "7px 10px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: C.textDim, fontWeight: 700, letterSpacing: ".5px", marginBottom: 2 }}>FROM → TO</div>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{ride.from} → {ride.to}</div>
              </div>
              <div style={{ fontSize: 10, color: C.textDim }}>{ride.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── DRIVERS TAB ───────────────────────────────────────────────────────
function DriversTab({ onToast }) {
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState("all");
  const [selected, setSelected] = useState(null);

  const filters  = ["all","online","offline","pending"];
  const filtered = MOCK_DRIVERS.filter(d => {
    const ms = d.name.toLowerCase().includes(search.toLowerCase());
    const mf = filter === "all" || d.status === filter;
    return ms && mf;
  });

  if (selected) {
    const d   = selected;
    const idx = MOCK_DRIVERS.indexOf(d);
    return (
      <div style={{ padding: "0 16px 16px" }}>
        <button onClick={() => setSelected(null)} className="btn-ghost" style={{ marginBottom: 16, padding: "8px 14px" }}>
          ← Back to drivers
        </button>
        <div className="card" style={{ padding: "20px", marginBottom: 14, boxShadow: "0 2px 12px rgba(0,0,0,.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
            <Avatar name={d.name} size={52} colorIdx={idx} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 5 }}>{d.name}</div>
              <StatusPill status={d.status} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { label: "Rating",   value: `★ ${d.rating}` },
              { label: "Rides",    value: d.rides },
              { label: "Earnings", value: d.earnings > 0 ? `$${d.earnings}` : "—" },
              { label: "Joined",   value: d.joined },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: C.surfaceHigh, borderRadius: 10, padding: "10px 12px", border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, letterSpacing: ".5px", marginBottom: 3 }}>{label.toUpperCase()}</div>
                <div className="mono" style={{ fontSize: 15, fontWeight: 600 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {d.status === "pending" && (
            <>
              <button className="btn-success" onClick={() => { onToast(`✅ ${d.name} approved`); setSelected(null); }}>
                <CheckCircle size={15} /> Approve Driver
              </button>
              <button className="btn-danger" onClick={() => { onToast(`❌ ${d.name} rejected`); setSelected(null); }}>
                <XCircle size={15} /> Reject Application
              </button>
            </>
          )}
          <button className="btn-ghost" onClick={() => onToast("Message sent")}>
            <Bell size={14} /> Send Notification
          </button>
          {d.status !== "pending" && (
            <button className="btn-danger" onClick={() => { onToast(`🚫 ${d.name} suspended`); setSelected(null); }}>
              <Ban size={14} /> Suspend Driver
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div className="search-bar fade-up" style={{ marginBottom: 12, animationDelay: "40ms", opacity: 0 }}>
        <Search size={15} color={C.textDim} />
        <input placeholder="Search drivers…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="fade-up" style={{ display: "flex", gap: 8, marginBottom: 16, animationDelay: "80ms", opacity: 0, overflowX: "auto", paddingBottom: 2 }}>
        {filters.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "6px 14px", borderRadius: 100,
            border: `1.5px solid ${filter === f ? C.green : C.border}`,
            background: filter === f ? C.greenGlow : C.surface,
            color: filter === f ? C.green : C.textMuted,
            fontFamily: "'Barlow',sans-serif", fontSize: 12, fontWeight: 700,
            cursor: "pointer", whiteSpace: "nowrap", transition: "all .15s",
          }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map((driver, i) => (
          <div key={driver.id} className="card fade-up" style={{ animationDelay: `${130 + i * 45}ms`, opacity: 0, boxShadow: "0 1px 5px rgba(0,0,0,.04)", cursor: "pointer" }}
            onClick={() => setSelected(driver)}>
            <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ position: "relative" }}>
                <Avatar name={driver.name} size={40} colorIdx={i} />
                <div style={{
                  position: "absolute", bottom: 0, right: 0,
                  width: 11, height: 11, borderRadius: "50%",
                  background: statusConfig[driver.status]?.color || C.textDim,
                  border: `2px solid ${C.surface}`,
                }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3 }}>{driver.name}</div>
                <div style={{ display: "flex", gap: 10 }}>
                  <span style={{ fontSize: 11, color: C.textMuted }}>★ {driver.rating}</span>
                  <span style={{ fontSize: 11, color: C.textMuted }}>{driver.rides} rides</span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
                <StatusPill status={driver.status} />
                {driver.earnings > 0 && (
                  <span className="mono" style={{ fontSize: 11, color: C.green }}>${driver.earnings}</span>
                )}
              </div>
              <ChevronRight size={14} color={C.textDim} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── APPROVALS TAB ─────────────────────────────────────────────────────
function ApprovalsTab({ onToast }) {
  const [items, setItems] = useState(MOCK_PENDING);
  const approve = id => { const it = items.find(i => i.id === id); setItems(p => p.filter(i => i.id !== id)); onToast(`✅ ${it?.name} approved`); };
  const reject  = id => { const it = items.find(i => i.id === id); setItems(p => p.filter(i => i.id !== id)); onToast(`❌ ${it?.name} rejected`); };

  return (
    <div style={{ padding: "0 16px 16px" }}>
      <div className="card fade-up" style={{ padding: "14px 16px", marginBottom: 16, animationDelay: "40ms", opacity: 0, boxShadow: "0 1px 6px rgba(0,0,0,.05)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: C.amberGlow, border: `1.5px solid ${C.amber}28`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Clock size={17} color={C.amber} />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>
              {items.length} <span style={{ fontSize: 13, color: C.textMuted, fontWeight: 500 }}>pending</span>
            </div>
            <div style={{ fontSize: 11, color: C.textMuted }}>Review required</div>
          </div>
        </div>
      </div>

      {items.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 24px" }}>
          <CheckCircle size={40} color={C.green} style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>All caught up!</div>
          <div style={{ fontSize: 13, color: C.textMuted }}>No pending approvals</div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((item, i) => (
          <div key={item.id} className="card fade-up" style={{ padding: "16px", animationDelay: `${90 + i * 55}ms`, opacity: 0, boxShadow: "0 1px 5px rgba(0,0,0,.04)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <Avatar name={item.avatar} size={40} colorIdx={i} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{item.name}</div>
                <div style={{ fontSize: 12, color: C.textMuted }}>{item.type} · {item.time}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-success" style={{ flex: 1 }} onClick={() => approve(item.id)}>
                <CheckCircle size={14} /> Approve
              </button>
              <button className="btn-danger" style={{ flex: 1 }} onClick={() => reject(item.id)}>
                <XCircle size={14} /> Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ANALYTICS TAB ─────────────────────────────────────────────────────
function AnalyticsTab() {
  const days     = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const rideData = [82, 104, 93, 118, 137, 156, 142];
  const maxVal   = Math.max(...rideData);

  const metrics = [
    { label: "Avg Trip Duration", value: "18m 42s", icon: Clock,        color: C.blue  },
    { label: "Acceptance Rate",   value: "87.4%",   icon: CheckCircle,  color: C.green },
    { label: "Cancellation Rate", value: "4.2%",    icon: XCircle,      color: C.red   },
    { label: "Avg Fare",          value: "$16.80",  icon: DollarSign,   color: C.amber },
  ];

  return (
    <div style={{ padding: "0 16px 16px" }}>
      {/* Bar chart */}
      <div className="card fade-up" style={{ padding: "18px", marginBottom: 16, animationDelay: "40ms", opacity: 0, boxShadow: "0 1px 8px rgba(0,0,0,.05)" }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Rides This Week</div>
          <div style={{ fontSize: 11, color: C.textMuted }}>Total: 832 rides</div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 100 }}>
          {rideData.map((val, i) => (
            <div key={days[i]} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <div style={{
                width: "100%", borderRadius: "4px 4px 0 0",
                height: `${(val / maxVal) * 80}px`,
                background: i === 5
                  ? "linear-gradient(180deg,#22C55E,#15803D)"
                  : `${C.green}20`,
                border: `1px solid ${C.green}${i === 5 ? "bb" : "30"}`,
                transition: "height .6s cubic-bezier(.34,1.2,.64,1)",
              }} />
              <div style={{ fontSize: 9, color: C.textDim, fontWeight: 700 }}>{days[i]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Metrics */}
      <div className="section-header">
        <div className="section-title">Key Metrics</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {metrics.map(({ label, value, icon: Icon, color }, i) => (
          <div key={label} className="card fade-up" style={{ padding: "14px", animationDelay: `${90 + i * 55}ms`, opacity: 0, boxShadow: "0 1px 5px rgba(0,0,0,.04)" }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: `${color}14`, border: `1.5px solid ${color}28`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
              <Icon size={15} color={color} />
            </div>
            <div className="mono" style={{ fontSize: 17, fontWeight: 600, marginBottom: 3 }}>{value}</div>
            <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 700, letterSpacing: ".3px" }}>{label.toUpperCase()}</div>
          </div>
        ))}
      </div>

      {/* Top drivers */}
      <div className="section-header" style={{ marginTop: 20 }}>
        <div className="section-title">Top Drivers</div>
      </div>
      <div className="card" style={{ overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,.04)" }}>
        {MOCK_DRIVERS.filter(d => d.status !== "pending").sort((a, b) => b.rides - a.rides).slice(0, 4).map((d, i) => (
          <div key={d.id} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 16px",
            borderBottom: i < 3 ? `1px solid ${C.border}` : "none",
          }}>
            <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: C.textDim, width: 16 }}>#{i + 1}</div>
            <Avatar name={d.name} size={32} colorIdx={i} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{d.name}</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{d.rides} rides · ★ {d.rating}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: C.green, fontWeight: 700 }}>
              <ArrowUpRight size={11} /> Top
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────
export default function UaTobAdminDashboard() {
  const [activeTab,  setActiveTab]  = useState("home");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toast,      setToast]      = useState(null);
  const toastRef = useRef(null);

  const showToast = msg => {
    setToast(msg);
    clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 2500);
  };

  const tabs = [
    { id: "home",      label: "Overview",  icon: Home      },
    { id: "drivers",   label: "Drivers",   icon: Car       },
    { id: "approvals", label: "Approvals", icon: Shield    },
    { id: "analytics", label: "Analytics", icon: BarChart2 },
  ];

  const tabTitles = { home: "Dashboard", drivers: "Fleet", approvals: "Approvals", analytics: "Analytics" };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Barlow',sans-serif" }}>
      <style>{CSS}</style>
      <Toast msg={toast} />
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Top bar */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(255,255,255,.94)",
        backdropFilter: "blur(14px)",
        borderBottom: `1px solid ${C.border}`,
        padding: "13px 16px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 1px 8px rgba(0,0,0,.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setDrawerOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", color: C.text, display: "flex" }}>
            <Menu size={20} />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <UaTobIcon size={32} />
            <div>
              <div className="condensed" style={{ fontSize: 9, fontWeight: 800, color: C.textMuted, letterSpacing: "1.2px", lineHeight: 1 }}>ADMIN</div>
              <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1, marginTop: 1 }}>{tabTitles[activeTab]}</div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: C.greenGlow, border: `1.5px solid ${C.green}28`, borderRadius: 100, padding: "5px 12px" }}>
            <div className="live-dot" style={{ width: 6, height: 6 }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: C.green }}>LIVE</span>
          </div>
          <div style={{ position: "relative" }}>
            <button style={{
              width: 36, height: 36, borderRadius: 10,
              background: C.surface, border: `1px solid ${C.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,.05)",
            }}>
              <Bell size={15} color={C.textMuted} />
            </button>
            <div style={{
              position: "absolute", top: 6, right: 6,
              width: 7, height: 7, borderRadius: "50%",
              background: C.red, border: `2px solid ${C.surface}`,
            }} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ paddingBottom: 80, paddingTop: 16, maxWidth: 640, margin: "0 auto" }}>
        {activeTab === "home"      && <HomeTab      onToast={showToast} />}
        {activeTab === "drivers"   && <DriversTab   onToast={showToast} />}
        {activeTab === "approvals" && <ApprovalsTab onToast={showToast} />}
        {activeTab === "analytics" && <AnalyticsTab />}
      </div>

      {/* Tab bar */}
      <div className="tab-bar">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} className={`tab-btn ${activeTab === id ? "active" : ""}`} onClick={() => setActiveTab(id)}>
            <div style={{ position: "relative" }}>
              <Icon size={20} />
              {id === "approvals" && MOCK_PENDING.length > 0 && (
                <div style={{
                  position: "absolute", top: -3, right: -5,
                  width: 14, height: 14, borderRadius: "50%",
                  background: C.red, border: `2px solid ${C.surface}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 8, fontWeight: 800, color: "#fff",
                }}>
                  {MOCK_PENDING.length}
                </div>
              )}
            </div>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
