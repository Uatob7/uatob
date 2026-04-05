import { useState, useEffect } from "react";
import {
  MapPin, Clock, Star, ChevronRight, LogOut,
  CreditCard, Bell, Shield, HelpCircle,
  CheckCircle, XCircle, Navigation, Repeat,
  User, ArrowUpRight, Zap, ChevronLeft
} from "lucide-react";

// ── Brand (inlined) ───────────────────────────────────────────────────
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
  bg:           "#F2F5F2",
  surface:      "#FFFFFF",
  surfaceHigh:  "#EEF1EE",
  border:       "#DDE5DD",
  text:         "#111827",
  textMuted:    "#6B7280",
  textDim:      "#9CA3AF",
  green:        "#16A34A",
  greenLight:   "rgba(22,163,74,0.09)",
  greenBorder:  "rgba(22,163,74,0.22)",
  red:          "#DC2626",
  redLight:     "rgba(220,38,38,0.08)",
  amber:        "#B45309",
  amberLight:   "rgba(180,83,9,0.09)",
  blue:         "#2563EB",
  blueLight:    "rgba(37,99,235,0.09)",
};

// ── Mock rider data ───────────────────────────────────────────────────
const MOCK_RIDER = {
  name:       "Marcus Webb",
  email:      "marcus@example.com",
  phone:      "+1 (407) 555-0192",
  joined:     "March 2024",
  totalRides: 34,
  totalSpent: 412.80,
  rating:     4.96,
  initials:   "MW",
};

const MOCK_RIDES = [
  { id:"r001", from:"Downtown Orlando",     to:"Orlando Intl Airport",    fare:38.50, status:"completed", date:"Today, 9:14 AM",     driver:"Jerome T.", rating:5, duration:"22 min", miles:14.2 },
  { id:"r002", from:"Westside Commons",     to:"Millenia Mall",           fare:14.20, status:"completed", date:"Yesterday, 6:40 PM", driver:"Leon A.",   rating:5, duration:"11 min", miles:4.8  },
  { id:"r003", from:"UCF Campus",           to:"Lake Nona Medical City",  fare:22.80, status:"completed", date:"Dec 28, 3:05 PM",    driver:"Kira N.",   rating:4, duration:"18 min", miles:9.1  },
  { id:"r004", from:"Orange Ave & Central", to:"Thornton Park",           fare:9.40,  status:"cancelled", date:"Dec 26, 8:22 PM",    driver:"—",         rating:null, duration:"—",  miles:null },
  { id:"r005", from:"Winter Park Village",  to:"Downtown Orlando",        fare:16.60, status:"completed", date:"Dec 24, 1:30 PM",    driver:"Tomás R.",  rating:5, duration:"14 min", miles:6.3  },
  { id:"r006", from:"SeaWorld Orlando",     to:"I-Drive Resort Area",     fare:8.90,  status:"completed", date:"Dec 22, 5:55 PM",    driver:"Sam H.",    rating:5, duration:"8 min",  miles:2.9  },
  { id:"r007", from:"Amway Center",         to:"Baldwin Park",            fare:19.40, status:"completed", date:"Dec 20, 11:10 PM",   driver:"Jerome T.", rating:5, duration:"16 min", miles:7.4  },
];

const MOCK_PAYMENT = [
  { id:"pm1", type:"Visa",       last4:"4242", expiry:"08/27", primary:true  },
  { id:"pm2", type:"Mastercard", last4:"8103", expiry:"02/26", primary:false },
];

// ── CSS ───────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');

  * { box-sizing:border-box; margin:0; padding:0; -webkit-tap-highlight-color:transparent; }
  body { background:${T.bg}; color:${T.text}; font-family:'Outfit',system-ui,sans-serif; }
  ::-webkit-scrollbar { width:0; height:0; }

  @keyframes slideUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
  @keyframes shimmer  { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
  @keyframes popIn    { 0%{opacity:0;transform:scale(.92)} 100%{opacity:1;transform:scale(1)} }
  @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:.4} }

  .slide-up { animation: slideUp .42s ease-out forwards; }
  .mono     { font-family:'JetBrains Mono',monospace; }

  .card {
    background:${T.surface};
    border:1px solid ${T.border};
    border-radius:18px;
    overflow:hidden;
    box-shadow:0 1px 6px rgba(0,0,0,.05);
  }

  .row-item {
    display:flex; align-items:center; gap:14px;
    padding:14px 18px;
    border-bottom:1px solid ${T.border};
    cursor:pointer;
    transition:background .15s;
    background:${T.surface};
  }
  .row-item:last-child { border-bottom:none; }
  .row-item:active { background:${T.surfaceHigh}; }

  .pill {
    display:inline-flex; align-items:center; gap:5px;
    padding:3px 10px; border-radius:100px;
    font-size:11px; font-weight:700; letter-spacing:.3px;
    text-transform:uppercase;
  }

  .tab-btn {
    flex:1; padding:9px 0; border:none; background:transparent;
    font-family:'Outfit',system-ui,sans-serif;
    font-size:12px; font-weight:700; letter-spacing:.4px;
    text-transform:uppercase; cursor:pointer;
    color:${T.textDim}; transition:color .15s;
    border-bottom:2px solid transparent;
  }
  .tab-btn.active {
    color:${T.green};
    border-bottom:2px solid ${T.green};
  }

  .stat-chip {
    flex:1; background:${T.surface};
    border:1px solid ${T.border};
    border-radius:14px; padding:14px 12px;
    text-align:center;
    box-shadow:0 1px 4px rgba(0,0,0,.04);
  }

  .action-btn {
    display:flex; flex-direction:column; align-items:center; gap:7px;
    padding:14px 10px; border-radius:16px;
    border:1px solid ${T.border};
    background:${T.surface};
    cursor:pointer; flex:1;
    box-shadow:0 1px 4px rgba(0,0,0,.04);
    transition:background .15s;
    font-family:'Outfit',system-ui,sans-serif;
  }
  .action-btn:active { background:${T.surfaceHigh}; }

  .back-btn {
    display:inline-flex; align-items:center; gap:6px;
    background:${T.surface}; border:1px solid ${T.border};
    border-radius:12px; padding:8px 14px;
    font-family:'Outfit',system-ui,sans-serif;
    font-size:13px; font-weight:700; color:${T.text};
    cursor:pointer; margin-bottom:18px;
    box-shadow:0 1px 4px rgba(0,0,0,.04);
    transition:background .15s;
  }
  .back-btn:active { background:${T.surfaceHigh}; }

  .primary-btn {
    width:100%; padding:14px;
    background:linear-gradient(135deg,#22C55E,#16A34A 55%,#15803D);
    color:#fff; border:none; border-radius:14px;
    font-family:'Outfit',system-ui,sans-serif;
    font-size:15px; font-weight:800;
    cursor:pointer;
    box-shadow:0 4px 16px rgba(22,163,74,.25);
    display:flex; align-items:center; justify-content:center; gap:8px;
    transition:opacity .15s;
  }
  .primary-btn:active { opacity:.85; }

  .ghost-btn {
    width:100%; padding:13px;
    background:${T.surface}; color:${T.text};
    border:1px solid ${T.border}; border-radius:14px;
    font-family:'Outfit',system-ui,sans-serif;
    font-size:14px; font-weight:700;
    cursor:pointer;
    display:flex; align-items:center; justify-content:center; gap:8px;
    transition:background .15s;
  }
  .ghost-btn:active { background:${T.surfaceHigh}; }
`;

// ── Helpers ───────────────────────────────────────────────────────────
function Avatar({ initials, size = 48, color = T.green }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `linear-gradient(135deg,${color},${color}bb)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.32, fontWeight: 800, color: "#fff",
      letterSpacing: "0.5px", flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

function RideStatusPill({ status }) {
  const map = {
    completed: { label: "Completed", bg: T.greenLight,  color: T.green },
    cancelled: { label: "Cancelled", bg: T.redLight,    color: T.red   },
    in_progress:{ label: "In Progress", bg: T.blueLight, color: T.blue },
  };
  const cfg = map[status] || map.completed;
  return (
    <span className="pill" style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

function StarRow({ rating, size = 11 }) {
  if (!rating) return <span style={{ fontSize: 11, color: T.textDim }}>—</span>;
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1,2,3,4,5].map(n => (
        <span key={n} style={{ fontSize: size, color: n <= rating ? "#F59E0B" : T.border }}>★</span>
      ))}
    </div>
  );
}

// ── RIDE DETAIL VIEW ──────────────────────────────────────────────────
function RideDetail({ ride, onBack }) {
  return (
    <div style={{ padding: "0 18px 32px", animation: "popIn .3s cubic-bezier(.34,1.2,.64,1)" }}>
      <button className="back-btn" onClick={onBack}>
        <ChevronLeft size={15} /> Back to trips
      </button>

      {/* Route card */}
      <div className="card" style={{ padding: "20px", marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase", marginBottom: 4 }}>
              {ride.date}
            </div>
            <RideStatusPill status={ride.status} />
          </div>
          <div className="mono" style={{ fontSize: 24, fontWeight: 600, color: T.green }}>
            ${ride.fare.toFixed(2)}
          </div>
        </div>

        {/* Route */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: T.text, flexShrink: 0 }} />
            <div style={{ fontSize: 14, fontWeight: 700 }}>{ride.from}</div>
          </div>
          <div style={{ width: 1, height: 22, background: T.border, marginLeft: 4, marginTop: 3, marginBottom: 3 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: T.green, flexShrink: 0 }} />
            <div style={{ fontSize: 14, fontWeight: 700 }}>{ride.to}</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
        {[
          { label: "Duration", value: ride.duration },
          { label: "Distance", value: ride.miles ? `${ride.miles} mi` : "—" },
          { label: "Fare",     value: `$${ride.fare.toFixed(2)}` },
        ].map(({ label, value }) => (
          <div key={label} className="stat-chip">
            <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
            <div className="mono" style={{ fontSize: 15, fontWeight: 600, color: T.text }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Driver */}
      {ride.driver !== "—" && (
        <div className="card" style={{ padding: "16px 18px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Avatar initials={ride.driver.split(" ").map(w=>w[0]).join("")} size={40} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>Driver · {ride.driver}</div>
              <StarRow rating={ride.rating} />
            </div>
            {ride.status === "completed" && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: T.green }}>
                <CheckCircle size={13} /> Verified
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {ride.status === "completed" && (
          <button className="primary-btn">
            <Repeat size={15} /> Book Again
          </button>
        )}
        <button className="ghost-btn">
          <HelpCircle size={14} /> Get Help with This Trip
        </button>
      </div>
    </div>
  );
}

// ── TRIPS TAB ─────────────────────────────────────────────────────────
function TripsTab() {
  const [selected, setSelected] = useState(null);

  if (selected) return <RideDetail ride={selected} onBack={() => setSelected(null)} />;

  return (
    <div style={{ padding: "0 18px 32px" }}>
      <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: ".6px", textTransform: "uppercase", marginBottom: 12 }}>
        Recent Trips
      </div>
      <div className="card">
        {MOCK_RIDES.map((ride, i) => (
          <div key={ride.id} className="row-item" onClick={() => setSelected(ride)}
            style={{ borderBottom: i < MOCK_RIDES.length - 1 ? `1px solid ${T.border}` : "none" }}>
            {/* Icon */}
            <div style={{
              width: 38, height: 38, borderRadius: 11, flexShrink: 0,
              background: ride.status === "completed" ? T.greenLight : T.redLight,
              border: `1.5px solid ${ride.status === "completed" ? T.greenBorder : "rgba(220,38,38,.18)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {ride.status === "completed"
                ? <Navigation size={15} color={T.green} />
                : <XCircle size={15} color={T.red} />
              }
            </div>

            {/* Route */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {ride.from} → {ride.to}
              </div>
              <div style={{ fontSize: 11, color: T.textMuted }}>{ride.date}</div>
            </div>

            {/* Fare + chevron */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
              <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: ride.status === "cancelled" ? T.textMuted : T.text }}>
                ${ride.fare.toFixed(2)}
              </span>
              <ChevronRight size={13} color={T.textDim} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── PAYMENT TAB ───────────────────────────────────────────────────────
function PaymentTab({ onToast }) {
  const cardBrandColors = { Visa: "#1A1F71", Mastercard: "#EB001B" };

  return (
    <div style={{ padding: "0 18px 32px" }}>
      {/* Saved cards */}
      <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: ".6px", textTransform: "uppercase", marginBottom: 12 }}>
        Saved Cards
      </div>
      <div className="card" style={{ marginBottom: 20 }}>
        {MOCK_PAYMENT.map((card, i) => (
          <div key={card.id} className="row-item"
            style={{ borderBottom: i < MOCK_PAYMENT.length - 1 ? `1px solid ${T.border}` : "none" }}>
            <div style={{
              width: 40, height: 28, borderRadius: 7, flexShrink: 0,
              background: `${cardBrandColors[card.type] || "#374151"}18`,
              border: `1.5px solid ${cardBrandColors[card.type] || "#374151"}22`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <CreditCard size={16} color={cardBrandColors[card.type] || T.text} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{card.type} ···· {card.last4}</div>
              <div style={{ fontSize: 11, color: T.textMuted }}>Expires {card.expiry}</div>
            </div>
            {card.primary && (
              <span className="pill" style={{ background: T.greenLight, color: T.green }}>
                Primary
              </span>
            )}
          </div>
        ))}
      </div>

      <button className="primary-btn" onClick={() => onToast("Card management coming soon")}>
        <CreditCard size={15} /> Add Payment Method
      </button>

      {/* Spend summary */}
      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: ".6px", textTransform: "uppercase", marginBottom: 12 }}>
          Spending Summary
        </div>
        <div className="card" style={{ padding: "18px" }}>
          {[
            { label: "This Month",  value: "$112.40" },
            { label: "Last Month",  value: "$98.70"  },
            { label: "All Time",    value: `$${MOCK_RIDER.totalSpent.toFixed(2)}` },
          ].map(({ label, value }, i, arr) => (
            <div key={label} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              paddingBottom: i < arr.length - 1 ? "12px" : 0,
              marginBottom:  i < arr.length - 1 ? "12px" : 0,
              borderBottom:  i < arr.length - 1 ? `1px solid ${T.border}` : "none",
            }}>
              <span style={{ fontSize: 13, color: T.textMuted, fontWeight: 500 }}>{label}</span>
              <span className="mono" style={{ fontSize: 15, fontWeight: 600 }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── SETTINGS TAB ─────────────────────────────────────────────────────
function SettingsTab({ onToast, onSignOut }) {
  const sections = [
    {
      title: "Account",
      rows: [
        { icon: User,    label: "Edit Profile",        sub: "Name, phone, email"     },
        { icon: Bell,    label: "Notifications",       sub: "Ride alerts, promotions" },
        { icon: Shield,  label: "Privacy & Security",  sub: "Password, data"          },
      ],
    },
    {
      title: "Support",
      rows: [
        { icon: HelpCircle, label: "Help Center",      sub: "FAQs and support"       },
        { icon: Star,       label: "Rate the App",     sub: "Leave a review"         },
      ],
    },
  ];

  return (
    <div style={{ padding: "0 18px 32px" }}>
      {/* Profile row */}
      <div className="card" style={{ padding: "18px", marginBottom: 18, display: "flex", alignItems: "center", gap: 14 }}>
        <Avatar initials={MOCK_RIDER.initials} size={52} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 2 }}>{MOCK_RIDER.name}</div>
          <div style={{ fontSize: 12, color: T.textMuted }}>{MOCK_RIDER.email}</div>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 4,
          background: T.amberLight, borderRadius: 100, padding: "4px 10px",
        }}>
          <span style={{ fontSize: 12, color: "#F59E0B" }}>★</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: T.amber }}>{MOCK_RIDER.rating}</span>
        </div>
      </div>

      {sections.map(({ title, rows }) => (
        <div key={title} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: ".6px", textTransform: "uppercase", marginBottom: 10 }}>
            {title}
          </div>
          <div className="card">
            {rows.map(({ icon: Icon, label, sub }, i) => (
              <div key={label} className="row-item" onClick={() => onToast(`${label} coming soon`)}
                style={{ borderBottom: i < rows.length - 1 ? `1px solid ${T.border}` : "none" }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: T.surfaceHigh, border: `1px solid ${T.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={16} color={T.textMuted} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{label}</div>
                  <div style={{ fontSize: 11, color: T.textMuted }}>{sub}</div>
                </div>
                <ChevronRight size={14} color={T.textDim} />
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Sign out */}
      <button className="ghost-btn" onClick={onSignOut} style={{ color: T.red, borderColor: "rgba(220,38,38,.2)" }}>
        <LogOut size={15} /> Sign Out
      </button>
    </div>
  );
}

// ── OVERVIEW TAB ─────────────────────────────────────────────────────
function OverviewTab({ onTab }) {
  const lastRide = MOCK_RIDES.find(r => r.status === "completed");

  return (
    <div style={{ padding: "0 18px 32px" }}>

      {/* Hero profile card */}
      <div className="card" style={{ padding: "22px", marginBottom: 16, position: "relative", overflow: "visible" }}>
        {/* Green accent bar */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 4,
          background: "linear-gradient(90deg,#22C55E,#16A34A)",
          borderRadius: "18px 18px 0 0",
        }} />
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <div style={{ position: "relative" }}>
            <Avatar initials={MOCK_RIDER.initials} size={56} />
            <div style={{
              position: "absolute", bottom: 0, right: 0,
              width: 16, height: 16, borderRadius: "50%",
              background: T.green, border: `2.5px solid ${T.surface}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff", animation: "pulse 1.8s infinite" }} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: "-0.3px", marginBottom: 3 }}>
              {MOCK_RIDER.name}
            </div>
            <div style={{ fontSize: 12, color: T.textMuted }}>Rider since {MOCK_RIDER.joined}</div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 10 }}>
          {[
            { label: "Rides",   value: MOCK_RIDER.totalRides, mono: false },
            { label: "Spent",   value: `$${MOCK_RIDER.totalSpent.toFixed(0)}`, mono: true },
            { label: "Rating",  value: `★ ${MOCK_RIDER.rating}`, mono: false, color: "#F59E0B" },
          ].map(({ label, value, mono, color }) => (
            <div key={label} className="stat-chip">
              <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
              <div className={mono ? "mono" : undefined} style={{ fontSize: 17, fontWeight: 800, color: color || T.text, letterSpacing: mono ? "-0.3px" : "-0.2px" }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: ".6px", textTransform: "uppercase", marginBottom: 10 }}>
        Quick Actions
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
        {[
          { icon: Navigation, label: "Book a Ride",   color: T.green,  bg: T.greenLight,  action: () => onTab("book")    },
          { icon: Clock,      label: "My Trips",      color: T.blue,   bg: T.blueLight,   action: () => onTab("trips")   },
          { icon: CreditCard, label: "Payment",       color: T.amber,  bg: T.amberLight,  action: () => onTab("payment") },
        ].map(({ icon: Icon, label, color, bg, action }) => (
          <button key={label} className="action-btn" onClick={action}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: bg, border: `1.5px solid ${color}28`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon size={17} color={color} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.text, textAlign: "center", lineHeight: 1.3 }}>{label}</span>
          </button>
        ))}
      </div>

      {/* Last ride */}
      {lastRide && (
        <>
          <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: ".6px", textTransform: "uppercase", marginBottom: 10 }}>
            Last Trip
          </div>
          <div className="card" style={{ padding: "16px 18px", marginBottom: 22 }} onClick={() => onTab("trips")}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{lastRide.from}</div>
                <div style={{ fontSize: 11, color: T.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
                  <ArrowUpRight size={10} color={T.green} />
                  {lastRide.to}
                </div>
              </div>
              <div className="mono" style={{ fontSize: 18, fontWeight: 600, color: T.green }}>${lastRide.fare.toFixed(2)}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 14 }}>
                <span style={{ fontSize: 11, color: T.textMuted }}><Clock size={10} style={{ verticalAlign: "middle" }} /> {lastRide.duration}</span>
                <span style={{ fontSize: 11, color: T.textMuted }}>· {lastRide.driver}</span>
              </div>
              <StarRow rating={lastRide.rating} />
            </div>
          </div>
        </>
      )}

      {/* Recent trips preview */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: ".6px", textTransform: "uppercase" }}>
          Recent Trips
        </div>
        <button onClick={() => onTab("trips")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: T.green, display: "flex", alignItems: "center", gap: 3 }}>
          See all <ChevronRight size={13} />
        </button>
      </div>
      <div className="card">
        {MOCK_RIDES.slice(0, 3).map((ride, i) => (
          <div key={ride.id} className="row-item"
            onClick={() => onTab("trips")}
            style={{ borderBottom: i < 2 ? `1px solid ${T.border}` : "none" }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: ride.status === "completed" ? T.greenLight : T.redLight,
              border: `1.5px solid ${ride.status === "completed" ? T.greenBorder : "rgba(220,38,38,.18)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {ride.status === "completed"
                ? <CheckCircle size={14} color={T.green} />
                : <XCircle size={14} color={T.red} />
              }
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {ride.from} → {ride.to}
              </div>
              <div style={{ fontSize: 11, color: T.textMuted }}>{ride.date}</div>
            </div>
            <span className="mono" style={{ fontSize: 12, fontWeight: 600, flexShrink: 0 }}>${ride.fare.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────
export default function RiderDashboard({ uid, onBookRide, onSignOut }) {
  const [tab,     setTab]     = useState("home");
  const [mounted, setMounted] = useState(false);
  const [toast,   setToast]   = useState(null);
  const toastRef = React.useRef(null);

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

  const tabs = [
    { id: "home",    label: "Home",    icon: Zap       },
    { id: "trips",   label: "Trips",   icon: Clock     },
    { id: "payment", label: "Payment", icon: CreditCard},
    { id: "account", label: "Account", icon: User      },
  ];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Outfit',system-ui,sans-serif", color: T.text, position: "relative" }}>
      <style>{CSS}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
          background: T.text, color: "#fff", borderRadius: 12, padding: "11px 20px",
          fontSize: 13, fontWeight: 600, zIndex: 999,
          whiteSpace: "nowrap", boxShadow: "0 8px 24px rgba(0,0,0,.18)",
          animation: "slideUp .3s ease",
        }}>
          {toast}
        </div>
      )}

      {/* ── Sticky header ── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(255,255,255,.94)",
        backdropFilter: "blur(14px)",
        borderBottom: `1px solid ${T.border}`,
        padding: "13px 18px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        boxShadow: "0 1px 8px rgba(0,0,0,.05)",
        animation: mounted ? "slideUp .4s ease-out forwards" : "none",
        opacity: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <UaTobIcon size={30} />
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, color: T.textMuted, letterSpacing: "1.3px", textTransform: "uppercase", lineHeight: 1 }}>My Account</div>
            <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: "-0.3px", lineHeight: 1, marginTop: 1 }}>
              {tab === "home" ? `Hey, ${MOCK_RIDER.name.split(" ")[0]} 👋` :
               tab === "trips" ? "Your Trips" :
               tab === "payment" ? "Payment" : "Account"}
            </div>
          </div>
        </div>
        {/* Book ride CTA */}
        <button
          onClick={() => onBookRide?.()}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "linear-gradient(135deg,#22C55E,#16A34A)",
            color: "#fff", border: "none", borderRadius: 12,
            padding: "8px 14px",
            fontSize: 12, fontWeight: 800,
            cursor: "pointer",
            boxShadow: "0 3px 10px rgba(22,163,74,.25)",
          }}
        >
          <Navigation size={12} /> Book
        </button>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 640, margin: "0 auto", paddingTop: 18, paddingBottom: 90 }}>
        <div
          key={tab}
          style={{ animation: "slideUp .35s ease-out forwards", opacity: 0 }}
        >
          {tab === "home"    && <OverviewTab onTab={handleTab} />}
          {tab === "trips"   && <TripsTab />}
          {tab === "payment" && <PaymentTab onToast={showToast} />}
          {tab === "account" && <SettingsTab onToast={showToast} onSignOut={onSignOut} />}
        </div>
      </div>

      {/* ── Bottom tab bar ── */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        background: "rgba(255,255,255,.96)",
        backdropFilter: "blur(14px)",
        borderTop: `1px solid ${T.border}`,
        display: "flex",
        paddingBottom: "env(safe-area-inset-bottom)",
        boxShadow: "0 -2px 16px rgba(0,0,0,.06)",
        zIndex: 100,
      }}>
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`tab-btn ${tab === id ? "active" : ""}`}
            onClick={() => setTab(id)}
          >
            <Icon size={19} style={{ marginBottom: 2 }} />
            <br />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
