// src/App/UaTob/RiderDashboard.jsx
import { useState, useEffect, useRef } from "react";
import {
  MapPin, Clock, Star, ChevronRight, LogOut,
  CreditCard, Bell, Shield, HelpCircle,
  CheckCircle, XCircle, Navigation, Repeat,
  User, ArrowUpRight, Zap, ChevronLeft, Loader
} from "lucide-react";
import { useRideHistory } from '@/App/UaTob/useRidehistory.js';

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

// ── CSS ───────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');

  * { box-sizing:border-box; margin:0; padding:0; -webkit-tap-highlight-color:transparent; }
  body { background:${T.bg}; color:${T.text}; font-family:'Outfit',system-ui,sans-serif; }
  ::-webkit-scrollbar { width:0; height:0; }

  @keyframes slideUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
  @keyframes popIn    { 0%{opacity:0;transform:scale(.92)} 100%{opacity:1;transform:scale(1)} }
  @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:.4} }
  @keyframes spin     { to{transform:rotate(360deg)} }

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

  .spinner {
    width:18px; height:18px;
    border:2px solid ${T.border};
    border-top-color:${T.green};
    border-radius:50%;
    animation:spin .7s linear infinite;
  }
`;

// ── Helpers ───────────────────────────────────────────────────────────

/** Derive initials from any name string */
function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Format a Firestore Timestamp (or JS Date) as "Month YYYY" */
function formatJoined(ts) {
  if (!ts) return "—";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

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
    completed:   { label: "Completed",   bg: T.greenLight, color: T.green },
    cancelled:   { label: "Cancelled",   bg: T.redLight,   color: T.red   },
    in_progress: { label: "In Progress", bg: T.blueLight,  color: T.blue  },
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

function EmptyState({ icon: Icon, title, sub, action, actionLabel }) {
  return (
    <div style={{ textAlign: "center", padding: "48px 24px" }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16,
        background: T.surfaceHigh, border: `1px solid ${T.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 14px",
      }}>
        <Icon size={22} color={T.textMuted} />
      </div>
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: T.textMuted, marginBottom: action ? 20 : 0 }}>{sub}</div>
      {action && (
        <button className="primary-btn" style={{ maxWidth: 200, margin: "0 auto" }} onClick={action}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ── ACTIVE RIDE BANNER ────────────────────────────────────────────────
function ActiveRideBanner({ ride, onPress }) {
  const statusLabel = {
    searching_driver: "Finding your driver…",
    driver_assigned:  "Driver assigned",
    driver_arriving:  "Driver on the way",
    arrived:          "Driver has arrived",
    in_progress:      "Trip in progress",
    pending_payment:  "Processing payment…",
  }[ride.status] ?? ride.status;

  return (
    <div
      onClick={onPress}
      style={{
        margin: "0 18px 16px",
        padding: "14px 16px",
        background: "linear-gradient(135deg,#16A34A,#15803D)",
        borderRadius: 16,
        cursor: "pointer",
        boxShadow: "0 4px 16px rgba(22,163,74,.3)",
        animation: "slideUp .4s ease-out",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%", background: "#fff",
            animation: "pulse 1.4s infinite",
          }} />
          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.75)", fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase" }}>
              Active Ride
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{statusLabel}</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="mono" style={{ fontSize: 17, fontWeight: 700, color: "#fff" }}>
            ${ride.fareTotal?.toFixed(2) ?? "—"}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.7)" }}>{ride.rideLabel}</div>
        </div>
      </div>
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,.2)", fontSize: 12, color: "rgba(255,255,255,.85)", display: "flex", alignItems: "center", gap: 6 }}>
        <Navigation size={11} />
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {ride.dropoff ?? "—"}
        </span>
      </div>
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

      <div className="card" style={{ padding: "20px", marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase", marginBottom: 4 }}>
              {ride.date}
            </div>
            <RideStatusPill status={ride.status} />
            {ride.rideLabel && ride.rideLabel !== "—" && (
              <span className="pill" style={{ background: T.surfaceHigh, color: T.textMuted, marginLeft: 6 }}>
                {ride.rideLabel}
              </span>
            )}
          </div>
          <div className="mono" style={{ fontSize: 24, fontWeight: 600, color: T.green }}>
            ${ride.fare.toFixed(2)}
          </div>
        </div>

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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
        {[
          { label: "Duration", value: ride.duration },
          { label: "Distance", value: ride.miles ? `${ride.miles} mi` : "—" },
          { label: "Payment",  value: ride.paymentMethod ?? "—" },
        ].map(({ label, value }) => (
          <div key={label} className="stat-chip">
            <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
            <div className="mono" style={{ fontSize: 13, fontWeight: 600, color: T.text, textTransform: "capitalize" }}>{value}</div>
          </div>
        ))}
      </div>

      {ride.driver !== "—" && (
        <div className="card" style={{ padding: "16px 18px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Avatar initials={getInitials(ride.driver)} size={40} />
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
function TripsTab({ uid, onBookRide }) {
  const [selected, setSelected] = useState(null);
  const { rides, loading, error } = useRideHistory(uid);

  if (selected) return <RideDetail ride={selected} onBack={() => setSelected(null)} />;

  return (
    <div style={{ padding: "0 18px 32px" }}>
      <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: ".6px", textTransform: "uppercase", marginBottom: 12 }}>
        Recent Trips
      </div>

      {loading && (
        <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
          <div className="spinner" />
        </div>
      )}

      {error && (
        <div style={{ background: T.redLight, border: `1px solid rgba(220,38,38,.2)`, borderRadius: 14, padding: "14px 16px", fontSize: 13, color: T.red, fontWeight: 600 }}>
          {error}
        </div>
      )}

      {!loading && !error && rides.length === 0 && (
        <EmptyState
          icon={Clock}
          title="No trips yet"
          sub="Your completed rides will appear here."
          action={onBookRide}
          actionLabel="Book Your First Ride"
        />
      )}

      {!loading && rides.length > 0 && (
        <div className="card">
          {rides.map((ride, i) => (
            <div
              key={ride.id}
              className="row-item"
              onClick={() => setSelected(ride)}
              style={{ borderBottom: i < rides.length - 1 ? `1px solid ${T.border}` : "none" }}
            >
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

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {ride.from} → {ride.to}
                </div>
                <div style={{ fontSize: 11, color: T.textMuted }}>{ride.date}</div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: ride.status === "cancelled" ? T.textMuted : T.text }}>
                  ${ride.fare.toFixed(2)}
                </span>
                <ChevronRight size={13} color={T.textDim} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── PAYMENT TAB ───────────────────────────────────────────────────────
function PaymentTab({ onToast }) {
  return (
    <div style={{ padding: "0 18px 32px" }}>
      <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: ".6px", textTransform: "uppercase", marginBottom: 12 }}>
        Saved Cards
      </div>
      <div className="card" style={{ marginBottom: 20 }}>
        <EmptyState icon={CreditCard} title="No cards saved" sub="Add a card to pay for rides faster." />
      </div>
      <button className="primary-btn" onClick={() => onToast("Card management coming soon")}>
        <CreditCard size={15} /> Add Payment Method
      </button>
    </div>
  );
}

// ── SETTINGS TAB ─────────────────────────────────────────────────────
function SettingsTab({ account, onToast, onSignOut }) {
  const name     = account?.name  ?? "Rider";
  const email    = account?.email ?? "—";
  const initials = getInitials(name);
  const joined   = formatJoined(account?.createdAt);

  const sections = [
    {
      title: "Account",
      rows: [
        { icon: User,    label: "Edit Profile",       sub: "Name, phone, email"      },
        { icon: Bell,    label: "Notifications",      sub: "Ride alerts, promotions"  },
        { icon: Shield,  label: "Privacy & Security", sub: "Password, data"           },
      ],
    },
    {
      title: "Support",
      rows: [
        { icon: HelpCircle, label: "Help Center",  sub: "FAQs and support" },
        { icon: Star,       label: "Rate the App", sub: "Leave a review"   },
      ],
    },
  ];

  return (
    <div style={{ padding: "0 18px 32px" }}>
      <div className="card" style={{ padding: "18px", marginBottom: 18, display: "flex", alignItems: "center", gap: 14 }}>
        <Avatar initials={initials} size={52} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 2 }}>{name}</div>
          <div style={{ fontSize: 12, color: T.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</div>
          <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>Member since {joined}</div>
        </div>
      </div>

      {sections.map(({ title, rows }) => (
        <div key={title} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: ".6px", textTransform: "uppercase", marginBottom: 10 }}>
            {title}
          </div>
          <div className="card">
            {rows.map(({ icon: Icon, label, sub }, i) => (
              <div
                key={label}
                className="row-item"
                onClick={() => onToast(`${label} coming soon`)}
                style={{ borderBottom: i < rows.length - 1 ? `1px solid ${T.border}` : "none" }}
              >
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

      <button className="ghost-btn" onClick={onSignOut} style={{ color: T.red, borderColor: "rgba(220,38,38,.2)" }}>
        <LogOut size={15} /> Sign Out
      </button>
    </div>
  );
}

// ── OVERVIEW TAB ─────────────────────────────────────────────────────
function OverviewTab({ account, uid, onTab }) {
  const { rides, loading } = useRideHistory(uid, 3);

  const name      = account?.name  ?? "Rider";
  const initials  = getInitials(name);
  const firstName = name.split(" ")[0];
  const joined    = formatJoined(account?.createdAt);

  const completedRides = rides.filter(r => r.status === "completed");
  const totalSpent     = completedRides.reduce((s, r) => s + r.fare, 0);
  const lastRide       = completedRides[0] ?? null;

  return (
    <div style={{ padding: "0 18px 32px" }}>

      {/* Hero card */}
      <div className="hero-card" style={{ padding: "24px", marginBottom: 20, position: "relative" }}>
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 6,
          background: T.greenGradient,
          borderRadius: "24px 24px 0 0",
        }} />
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 22, position: "relative", zIndex: 1 }}>
          <div style={{ position: "relative" }}>
            <Avatar initials={initials} size={60} />
            <div style={{
              position: "absolute", bottom: 0, right: 0,
              width: 18, height: 18, borderRadius: "50%",
              background: T.green, border: `3px solid ${T.surface}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              animation: "pulse 2s infinite",
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-0.5px", marginBottom: 4, color: T.text }}>
              Welcome back, {firstName}!
            </div>
            <div style={{ fontSize: 13, color: T.textMuted, fontWeight: 500 }}>Rider since {joined}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, position: "relative", zIndex: 1 }}>
          {[
            { label: "Total Rides", value: completedRides.length, mono: false, icon: Navigation },
            { label: "Total Spent", value: `$${totalSpent.toFixed(0)}`, mono: true, icon: CreditCard },
            { label: "Status", value: "Active Rider", mono: false, color: T.green, icon: CheckCircle },
          ].map(({ label, value, mono, color, icon: Icon }) => (
            <div key={label} className="stat-chip" style={{ position: "relative", overflow: "hidden" }}>
              <div style={{
                position: "absolute", top: 0, right: 0, width: 40, height: 40,
                background: `${color || T.green}08`, borderRadius: "50%",
                transform: "translate(10px, -10px)"
              }} />
              <Icon size={16} color={color || T.green} style={{ marginBottom: 6, position: "relative", zIndex: 1 }} />
              <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
              <div className={mono ? "mono" : undefined} style={{ fontSize: 18, fontWeight: 800, color: color || T.text, letterSpacing: mono ? "-0.5px" : "-0.3px" }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 700, letterSpacing: ".8px", textTransform: "uppercase", marginBottom: 12 }}>
        Quick Actions
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        {[
          { icon: Navigation, label: "Book a Ride", color: T.green, bg: T.greenLight, action: () => onTab("book") },
          { icon: Clock, label: "My Trips", color: T.blue, bg: T.blueLight, action: () => onTab("trips") },
          { icon: CreditCard, label: "Payment", color: T.amber, bg: T.amberLight, action: () => onTab("payment") },
        ].map(({ icon: Icon, label, color, bg, action }) => (
          <button key={label} className="action-btn" onClick={action} style={{ minHeight: 80 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 14, background: bg,
              border: `2px solid ${color}20`, display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 2px 8px ${color}15`
            }}>
              <Icon size={20} color={color} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: T.text, textAlign: "center", lineHeight: 1.3 }}>{label}</span>
          </button>
        ))}
      </div>

      {/* Last ride */}
      {lastRide && (
        <>
          <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 700, letterSpacing: ".8px", textTransform: "uppercase", marginBottom: 12 }}>
            Last Trip
          </div>
          <div className="card" style={{ padding: "20px", marginBottom: 24, cursor: "pointer", position: "relative", overflow: "hidden" }} onClick={() => onTab("trips")}>
            <div style={{
              position: "absolute", top: 0, right: 0, width: 60, height: 60,
              background: T.greenLight, borderRadius: "50%",
              transform: "translate(20px, -20px)", opacity: 0.6
            }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, position: "relative", zIndex: 1 }}>
              <div style={{ flex: 1, minWidth: 0, marginRight: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lastRide.from}</div>
                <div style={{ fontSize: 12, color: T.textMuted, display: "flex", alignItems: "center", gap: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <ArrowUpRight size={12} color={T.green} />
                  {lastRide.to}
                </div>
              </div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: T.green, flexShrink: 0 }}>${lastRide.fare.toFixed(2)}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", zIndex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12, color: T.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
                  <Clock size={12} />
                  {lastRide.duration}
                </span>
                {lastRide.driver !== "—" && (
                  <span style={{ fontSize: 12, color: T.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
                    <User size={12} />
                    {lastRide.driver}
                  </span>
                )}
              </div>
              <RideStatusPill status={lastRide.status} />
            </div>
          </div>
        </>
      )}

      {/* Recent trips preview */}
      {!loading && rides.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 700, letterSpacing: ".8px", textTransform: "uppercase" }}>
              Recent Trips
            </div>
            <button onClick={() => onTab("trips")} style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 700, color: T.green,
              display: "flex", alignItems: "center", gap: 4,
              padding: "4px 8px", borderRadius: 8,
              transition: "all .2s ease"
            }} onMouseEnter={e => e.target.style.background = T.greenLight} onMouseLeave={e => e.target.style.background = "none"}>
              See all <ChevronRight size={14} />
            </button>
          </div>
          <div className="card" style={{ overflow: "hidden" }}>
            {rides.map((ride, i) => (
              <div
                key={ride.id}
                className="row-item"
                onClick={() => onTab("trips")}
                style={{ borderBottom: i < rides.length - 1 ? `1px solid ${T.borderLight}` : "none" }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                  background: ride.status === "completed" ? T.greenLight : T.redLight,
                  border: `2px solid ${ride.status === "completed" ? T.greenBorder : "rgba(220,38,38,.2)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: `0 2px 6px ${ride.status === "completed" ? T.green : T.red}20`
                }}>
                  {ride.status === "completed"
                    ? <CheckCircle size={18} color={T.green} />
                    : <XCircle size={18} color={T.red} />
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {ride.from} → {ride.to}
                  </div>
                  <div style={{ fontSize: 12, color: T.textMuted }}>{ride.date}</div>
                </div>
                <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: ride.status === "cancelled" ? T.textMuted : T.text, flexShrink: 0 }}>
                  ${ride.fare.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && rides.length === 0 && (
        <div style={{ textAlign: "center", padding: "24px 0", color: T.textMuted, fontSize: 13 }}>
          No trips yet — book your first ride!
        </div>
      )}
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────
export default function RiderDashboard({ uid, account, active, onBookRide, onSignOut }) {
  const [tab,     setTab]     = useState("home");
  const [mounted, setMounted] = useState(false);
  const [toast,   setToast]   = useState(null);
  const toastRef = useRef(null);

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

  // Active ride — first element of the active array (from useActiveRides)
  const activeRide = active?.[0] ?? null;

  const tabs = [
    { id: "home",    label: "Home",    icon: Zap        },
    { id: "trips",   label: "Trips",   icon: Clock      },
    { id: "payment", label: "Payment", icon: CreditCard },
    { id: "account", label: "Account", icon: User       },
  ];

  const headerTitle = {
    home:    `Hey, ${firstName} 👋`,
    trips:   "Your Trips",
    payment: "Payment",
    account: "Account",
  }[tab];

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

      {/* Sticky header */}
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
              {headerTitle}
            </div>
          </div>
        </div>
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

      {/* Content */}
      <div style={{ maxWidth: 640, margin: "0 auto", paddingTop: 18, paddingBottom: 90 }}>

        {/* Active ride banner — shown on all tabs */}
        {activeRide && (
          <ActiveRideBanner ride={activeRide} onPress={() => onBookRide?.()} />
        )}

        <div key={tab} style={{ animation: "slideUp .35s ease-out forwards", opacity: 0 }}>
          {tab === "home"    && <OverviewTab account={account} uid={uid} onTab={handleTab} />}
          {tab === "trips"   && <TripsTab uid={uid} onBookRide={onBookRide} />}
          {tab === "payment" && <PaymentTab onToast={showToast} />}
          {tab === "account" && <SettingsTab account={account} onToast={showToast} onSignOut={onSignOut} />}
        </div>
      </div>

      {/* Bottom tab bar */}
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