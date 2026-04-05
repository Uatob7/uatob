// src/App/UaTob/RiderDashboard.jsx
import { useState, useEffect, useRef } from "react";
import {
  MapPin, Clock, Star, ChevronRight, LogOut,
  CreditCard, Bell, Shield, HelpCircle,
  CheckCircle, XCircle, Navigation, Repeat,
  User, ArrowUpRight, Zap, ChevronLeft, Loader, Home
} from "lucide-react";
import { useRideHistory } from '@/App/UaTob/useRideHistory';

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
  bg:           "#FAFBFC",
  surface:      "#FFFFFF",
  surfaceHigh:  "#F8FAFC",
  border:       "#E2E8F0",
  borderLight:  "#F1F5F9",
  text:         "#0F172A",
  textMuted:    "#64748B",
  textDim:      "#94A3B8",
  green:        "#10B981",
  greenLight:   "rgba(16,185,129,0.08)",
  greenBorder:  "rgba(16,185,129,0.2)",
  greenGradient: "linear-gradient(135deg,#10B981,#059669)",
  red:          "#EF4444",
  redLight:     "rgba(239,68,68,0.08)",
  amber:        "#F59E0B",
  amberLight:   "rgba(245,158,11,0.08)",
  blue:         "#3B82F6",
  blueLight:    "rgba(59,130,246,0.08)",
};

// ── CSS ───────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap');

  * { box-sizing:border-box; margin:0; padding:0; -webkit-tap-highlight-color:transparent; }
  body { background:#FAFBFC; color:#0F172A; font-family:'Inter',system-ui,sans-serif; }
  ::-webkit-scrollbar { width:0; height:0; }

  @keyframes slideUp  { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
  @keyframes popIn    { 0%{opacity:0;transform:scale(.95) translateY(10px)} 100%{opacity:1;transform:scale(1) translateY(0)} }
  @keyframes pulse    { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.7;transform:scale(1.05)} }
  @keyframes spin     { to{transform:rotate(360deg)} }
  @keyframes fabPop   { 0%{transform:translateY(-50%) scale(.85)} 60%{transform:translateY(-50%) scale(1.08)} 100%{transform:translateY(-50%) scale(1)} }
  @keyframes tabIn    { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }

  .slide-up { animation: slideUp .5s cubic-bezier(.25,.46,.45,.94) forwards; }
  .mono     { font-family:'JetBrains Mono',monospace; }

  .card {
    background:#FFFFFF;
    border:1px solid #E2E8F0;
    border-radius:20px;
    overflow:hidden;
    box-shadow:0 1px 3px rgba(0,0,0,.05), 0 1px 2px rgba(0,0,0,.06);
    transition: box-shadow .3s ease;
  }
  .card:hover { box-shadow:0 4px 12px rgba(0,0,0,.08); }

  .hero-card {
    background: linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%);
    border:1px solid #E2E8F0;
    border-radius:24px;
    overflow:hidden;
    box-shadow:0 8px 32px rgba(0,0,0,.08);
    position:relative;
  }

  .row-item {
    display:flex; align-items:center; gap:16px;
    padding:16px 20px;
    border-bottom:1px solid #F1F5F9;
    cursor:pointer; background:#FFFFFF;
    transition: background .15s ease;
  }
  .row-item:last-child { border-bottom:none; }
  .row-item:hover { background:#F8FAFC; }
  .row-item:active { background:#F1F5F9; }

  .pill {
    display:inline-flex; align-items:center; gap:6px;
    padding:4px 12px; border-radius:12px;
    font-size:11px; font-weight:600; letter-spacing:.3px;
    text-transform:uppercase;
  }

  /* ── NEW TAB BAR ── */
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
      0 8px 32px rgba(0,0,0,.12),
      0 2px 8px rgba(0,0,0,.06),
      inset 0 1px 0 rgba(255,255,255,.9);
    pointer-events:all;
    position:relative;
  }

  .tab-btn {
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    gap:3px; padding:8px 16px; min-width:64px;
    border:none; background:transparent; cursor:pointer;
    border-radius:26px;
    font-family:'Inter',system-ui,sans-serif;
    font-size:10px; font-weight:600; letter-spacing:.3px; text-transform:uppercase;
    color:#94A3B8;
    transition: color .25s ease, background .25s ease;
    position:relative;
  }
  .tab-btn .tab-icon {
    display:flex; align-items:center; justify-content:center;
    width:32px; height:22px;
    transition: transform .25s cubic-bezier(.34,1.56,.64,1);
  }
  .tab-btn:hover { color:#64748B; }
  .tab-btn:hover .tab-icon { transform:translateY(-1px); }

  .tab-btn.active {
    background: linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(5,150,105,0.06) 100%);
    color:#059669;
  }
  .tab-btn.active .tab-icon {
    transform:translateY(-2px) scale(1.1);
  }
  .tab-btn.active .tab-label {
    opacity:1; transform:translateY(0);
  }
  .tab-label {
    opacity:0; transform:translateY(2px);
    transition: opacity .2s ease, transform .2s ease;
    line-height:1;
  }
  .tab-btn.active .tab-label { opacity:1; transform:translateY(0); }

  /* FAB */
  .tab-fab {
    position:relative;
    width:52px; height:52px; border-radius:50%;
    background:linear-gradient(145deg, #22C55E 0%, #16A34A 50%, #15803D 100%);
    border:3px solid #fff;
    box-shadow:
      0 6px 20px rgba(16,185,129,.45),
      0 2px 6px rgba(0,0,0,.12),
      inset 0 1px 0 rgba(255,255,255,.25);
    display:flex; align-items:center; justify-content:center;
    cursor:pointer;
    transform:translateY(-8px);
    transition: transform .2s cubic-bezier(.34,1.56,.64,1), box-shadow .2s ease;
    flex-shrink:0;
    margin:0 4px;
  }
  .tab-fab:hover {
    transform:translateY(-11px);
    box-shadow:
      0 10px 28px rgba(16,185,129,.55),
      0 4px 8px rgba(0,0,0,.14),
      inset 0 1px 0 rgba(255,255,255,.3);
  }
  .tab-fab:active {
    transform:translateY(-6px);
    box-shadow:
      0 4px 14px rgba(16,185,129,.4),
      0 2px 4px rgba(0,0,0,.1);
  }

  .stat-chip {
    flex:1; background:#FFFFFF;
    border:1px solid #E2E8F0;
    border-radius:16px; padding:16px 14px;
    text-align:center;
    box-shadow:0 1px 3px rgba(0,0,0,.05);
    transition: transform .2s ease, box-shadow .2s ease;
    position:relative; overflow:hidden;
  }
  .stat-chip:hover { transform:translateY(-2px); box-shadow:0 4px 12px rgba(0,0,0,.08); }

  .action-btn {
    display:flex; flex-direction:column; align-items:center; gap:8px;
    padding:16px 12px; border-radius:18px;
    border:1px solid #E2E8F0;
    background:#FFFFFF;
    cursor:pointer; flex:1;
    box-shadow:0 1px 3px rgba(0,0,0,.05);
    transition: transform .2s ease, box-shadow .2s ease;
    font-family:'Inter',system-ui,sans-serif;
  }
  .action-btn:hover { transform:translateY(-3px); box-shadow:0 8px 24px rgba(0,0,0,.1); }
  .action-btn:active { transform:translateY(-1px); }

  .back-btn {
    display:inline-flex; align-items:center; gap:8px;
    background:#FFFFFF; border:1px solid #E2E8F0;
    border-radius:14px; padding:10px 16px;
    font-family:'Inter',system-ui,sans-serif;
    font-size:14px; font-weight:600; color:#0F172A;
    cursor:pointer; margin-bottom:20px;
    box-shadow:0 1px 3px rgba(0,0,0,.05);
    transition: background .15s ease, transform .15s ease;
  }
  .back-btn:hover { background:#F8FAFC; transform:translateX(-2px); }
  .back-btn:active { background:#F1F5F9; }

  .primary-btn {
    width:100%; padding:16px;
    background:linear-gradient(135deg, #22C55E 0%, #16A34A 60%, #15803D 100%);
    color:#fff; border:none; border-radius:16px;
    font-family:'Inter',system-ui,sans-serif;
    font-size:15px; font-weight:700;
    cursor:pointer;
    box-shadow:0 4px 16px rgba(16,185,129,.3);
    display:flex; align-items:center; justify-content:center; gap:10px;
    transition: transform .2s ease, box-shadow .2s ease;
  }
  .primary-btn:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(16,185,129,.4); }
  .primary-btn:active { transform:translateY(0); }

  .ghost-btn {
    width:100%; padding:14px;
    background:#FFFFFF; color:#0F172A;
    border:1px solid #E2E8F0; border-radius:16px;
    font-family:'Inter',system-ui,sans-serif;
    font-size:14px; font-weight:600;
    cursor:pointer;
    display:flex; align-items:center; justify-content:center; gap:10px;
    transition: background .15s ease, box-shadow .15s ease;
  }
  .ghost-btn:hover { background:#F8FAFC; box-shadow:0 2px 8px rgba(0,0,0,.06); }
  .ghost-btn:active { background:#F1F5F9; }

  .spinner {
    width:20px; height:20px;
    border:2px solid #E2E8F0;
    border-top-color:#10B981;
    border-radius:50%;
    animation:spin .8s linear infinite;
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
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff", animation: "pulse 1.4s infinite" }} />
          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.75)", fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase" }}>Active Ride</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{statusLabel}</div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="mono" style={{ fontSize: 17, fontWeight: 700, color: "#fff" }}>${ride.fareTotal?.toFixed(2) ?? "—"}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.7)" }}>{ride.rideLabel}</div>
        </div>
      </div>
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,.2)", fontSize: 12, color: "rgba(255,255,255,.85)", display: "flex", alignItems: "center", gap: 6 }}>
        <Navigation size={11} />
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ride.dropoff ?? "—"}</span>
      </div>
    </div>
  );
}

// ── RIDE DETAIL VIEW ──────────────────────────────────────────────────
function RideDetail({ ride, onBack }) {
  const fareTotal = ride.fareTotal ?? ride.fare ?? 0;
  const tripDistance = ride.tripDistanceMiles ?? (ride.miles ? parseFloat(ride.miles) : null);
  const tripDuration = ride.tripDurationMin ?? parseInt(ride.duration);

  return (
    <div style={{ padding: "0 18px 32px", animation: "popIn .3s cubic-bezier(.34,1.2,.64,1)" }}>
      <button className="back-btn" onClick={onBack}><ChevronLeft size={15} /> Back to trips</button>

      <div className="card" style={{ padding: "24px", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase", marginBottom: 8 }}>{ride.date}</div>
            <RideStatusPill status={ride.status} />
            {ride.rideLabel && ride.rideLabel !== "—" && (
              <span className="pill" style={{ background: T.surfaceHigh, color: T.textMuted, marginLeft: 8 }}>{ride.rideLabel}</span>
            )}
          </div>
          <div className="mono" style={{ fontSize: 32, fontWeight: 800, color: ride.status === "completed" ? T.green : T.red }}>${fareTotal.toFixed(2)}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: T.text, flexShrink: 0 }} />
            <div style={{ fontSize: 15, fontWeight: 700 }}>{ride.pickup || ride.from}</div>
          </div>
          <div style={{ width: 2, height: 28, background: T.border, marginLeft: 5, marginTop: 4, marginBottom: 4 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: T.green, flexShrink: 0 }} />
            <div style={{ fontSize: 15, fontWeight: 700 }}>{ride.dropoff || ride.to}</div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Distance", value: tripDistance ? `${tripDistance.toFixed(1)} mi` : "—" },
          { label: "Duration", value: tripDuration ? `${tripDuration}m` : "—" },
          { label: "Surge", value: ride.surgeMultiplier > 1 ? `${ride.surgeMultiplier}x` : "None" },
        ].map(({ label, value }) => (
          <div key={label} className="stat-chip">
            <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
            <div className="mono" style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{value}</div>
          </div>
        ))}
      </div>

      {ride.driver !== "—" && (
        <div className="card" style={{ padding: "16px 18px", marginBottom: 20 }}>
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
        {ride.status === "completed" && <button className="primary-btn"><Repeat size={15} /> Book Again</button>}
        <button className="ghost-btn"><HelpCircle size={14} /> Get Help with This Trip</button>
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
      <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: ".6px", textTransform: "uppercase", marginBottom: 12 }}>Recent Trips</div>
      {loading && <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}><div className="spinner" /></div>}
      {error && <div style={{ background: T.redLight, border: `1px solid rgba(220,38,38,.2)`, borderRadius: 14, padding: "14px 16px", fontSize: 13, color: T.red, fontWeight: 600 }}>{error}</div>}
      {!loading && !error && rides.length === 0 && (
        <EmptyState icon={Clock} title="No trips yet" sub="Your completed rides will appear here." action={onBookRide} actionLabel="Book Your First Ride" />
      )}
      {!loading && rides.length > 0 && (
        <div className="card">
          {rides.map((ride, i) => (
            <div key={ride.id} className="row-item" onClick={() => setSelected(ride)} style={{ borderBottom: i < rides.length - 1 ? `1px solid ${T.border}` : "none" }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: ride.status === "completed" ? T.greenLight : T.redLight, border: `1.5px solid ${ride.status === "completed" ? T.greenBorder : "rgba(220,38,38,.18)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {ride.status === "completed" ? <Navigation size={15} color={T.green} /> : <XCircle size={15} color={T.red} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ride.from} → {ride.to}</div>
                <div style={{ fontSize: 11, color: T.textMuted }}>{ride.date}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: ride.status === "cancelled" ? T.textMuted : T.text }}>${ride.fare.toFixed(2)}</span>
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
      <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: ".6px", textTransform: "uppercase", marginBottom: 12 }}>Saved Cards</div>
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
    { title: "Account", rows: [
      { icon: User,    label: "Edit Profile",       sub: "Name, phone, email"     },
      { icon: Bell,    label: "Notifications",      sub: "Ride alerts, promotions" },
      { icon: Shield,  label: "Privacy & Security", sub: "Password, data"          },
    ]},
    { title: "Support", rows: [
      { icon: HelpCircle, label: "Help Center",  sub: "FAQs and support" },
      { icon: Star,       label: "Rate the App", sub: "Leave a review"   },
    ]},
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
          <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 700, letterSpacing: ".6px", textTransform: "uppercase", marginBottom: 10 }}>{title}</div>
          <div className="card">
            {rows.map(({ icon: Icon, label, sub }, i) => (
              <div key={label} className="row-item" onClick={() => onToast(`${label} coming soon`)} style={{ borderBottom: i < rows.length - 1 ? `1px solid ${T.border}` : "none" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: T.surfaceHigh, border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
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
  const totalSpent     = completedRides.reduce((s, r) => s + (r.fareTotal ?? r.fare ?? 0), 0);
  const lastRide       = completedRides[0] ?? null;

  return (
    <div style={{ padding: "0 18px 32px" }}>
      {/* Hero card */}
      <div className="hero-card" style={{ padding: "24px", marginBottom: 20 }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 5, background: T.greenGradient, borderRadius: "24px 24px 0 0" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 22 }}>
          <div style={{ position: "relative" }}>
            <Avatar initials={initials} size={60} />
            <div style={{ position: "absolute", bottom: 0, right: 0, width: 18, height: 18, borderRadius: "50%", background: T.green, border: `3px solid ${T.surface}`, display: "flex", alignItems: "center", justifyContent: "center", animation: "pulse 2s infinite" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: "-0.5px", marginBottom: 4 }}>Welcome back, {firstName}!</div>
            <div style={{ fontSize: 13, color: T.textMuted }}>Rider since {joined}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {[
            { label: "Total Rides", value: completedRides.length, icon: Navigation },
            { label: "Total Spent", value: `$${totalSpent.toFixed(0)}`, mono: true, icon: CreditCard },
            { label: "Status", value: "Active", color: T.green, icon: CheckCircle },
          ].map(({ label, value, mono, color, icon: Icon }) => (
            <div key={label} className="stat-chip">
              <Icon size={15} color={color || T.green} style={{ marginBottom: 5 }} />
              <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, letterSpacing: ".5px", textTransform: "uppercase", marginBottom: 5 }}>{label}</div>
              <div className={mono ? "mono" : undefined} style={{ fontSize: 17, fontWeight: 800, color: color || T.text }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 700, letterSpacing: ".8px", textTransform: "uppercase", marginBottom: 12 }}>Quick Actions</div>
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        {[
          { icon: Navigation, label: "Book a Ride", color: T.green, bg: T.greenLight, action: () => onTab("book") },
          { icon: Clock,      label: "My Trips",    color: T.blue,  bg: T.blueLight,  action: () => onTab("trips") },
          { icon: CreditCard, label: "Payment",     color: T.amber, bg: T.amberLight, action: () => onTab("payment") },
        ].map(({ icon: Icon, label, color, bg, action }) => (
          <button key={label} className="action-btn" onClick={action} style={{ minHeight: 80 }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: bg, border: `2px solid ${color}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon size={20} color={color} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.text, textAlign: "center", lineHeight: 1.3 }}>{label}</span>
          </button>
        ))}
      </div>

      {/* Last ride */}
      {lastRide && (
        <>
          <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 700, letterSpacing: ".8px", textTransform: "uppercase", marginBottom: 12 }}>Last Trip</div>
          <div className="card" style={{ padding: "20px", marginBottom: 24, cursor: "pointer" }} onClick={() => onTab("trips")}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div style={{ flex: 1, minWidth: 0, marginRight: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lastRide.from}</div>
                <div style={{ fontSize: 12, color: T.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
                  <ArrowUpRight size={12} color={T.green} />{lastRide.to}
                </div>
              </div>
              <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: T.green }}>${lastRide.fare.toFixed(2)}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12, color: T.textMuted, display: "flex", alignItems: "center", gap: 4 }}><Clock size={12} />{lastRide.duration}</span>
                {lastRide.driver !== "—" && <span style={{ fontSize: 12, color: T.textMuted, display: "flex", alignItems: "center", gap: 4 }}><User size={12} />{lastRide.driver}</span>}
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
            <div style={{ fontSize: 12, color: T.textMuted, fontWeight: 700, letterSpacing: ".8px", textTransform: "uppercase" }}>Recent Trips</div>
            <button onClick={() => onTab("trips")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, color: T.green, display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", borderRadius: 8 }}>
              See all <ChevronRight size={14} />
            </button>
          </div>
          <div className="card">
            {rides.map((ride, i) => (
              <div key={ride.id} className="row-item" onClick={() => onTab("trips")} style={{ borderBottom: i < rides.length - 1 ? `1px solid ${T.borderLight}` : "none" }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: ride.status === "completed" ? T.greenLight : T.redLight, border: `2px solid ${ride.status === "completed" ? T.greenBorder : "rgba(220,38,38,.2)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {ride.status === "completed" ? <CheckCircle size={18} color={T.green} /> : <XCircle size={18} color={T.red} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ride.from} → {ride.to}</div>
                  <div style={{ fontSize: 12, color: T.textMuted }}>{ride.date}</div>
                </div>
                <div className="mono" style={{ fontSize: 15, fontWeight: 700, color: ride.status === "cancelled" ? T.textMuted : T.text }}>${ride.fare.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </>
      )}
      {!loading && rides.length === 0 && (
        <div style={{ textAlign: "center", padding: "24px 0", color: T.textMuted, fontSize: 13 }}>No trips yet — book your first ride!</div>
      )}
    </div>
  );
}

// ── FLOATING TAB BAR ─────────────────────────────────────────────────
function TabBar({ tab, setTab, onBookRide }) {
  const LEFT  = [
    { id: "home",    label: "Home",    icon: Home       },
    { id: "trips",   label: "Trips",   icon: Clock      },
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
        <Icon size={19} strokeWidth={tab === id ? 2.5 : 1.8} />
      </div>
      <span className="tab-label">{label}</span>
    </button>
  );

  return (
    <div className="tab-bar-outer">
      <div className="tab-bar-pill">
        {LEFT.map(t => <TabBtn key={t.id} {...t} />)}

        {/* Center FAB */}
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

  const headerTitle = {
    home:    `Hey, ${firstName} 👋`,
    trips:   "Your Trips",
    payment: "Payment",
    account: "Account",
  }[tab];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter',system-ui,sans-serif", color: T.text }}>
      <style>{CSS}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: T.text, color: "#fff", borderRadius: 12, padding: "11px 20px", fontSize: 13, fontWeight: 600, zIndex: 999, whiteSpace: "nowrap", boxShadow: "0 8px 24px rgba(0,0,0,.18)", animation: "slideUp .3s ease" }}>
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
            <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: "-0.3px", lineHeight: 1, marginTop: 1 }}>{headerTitle}</div>
          </div>
        </div>
        <button
          onClick={() => onBookRide?.()}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg,#22C55E,#16A34A)", color: "#fff", border: "none", borderRadius: 12, padding: "8px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer", boxShadow: "0 3px 10px rgba(22,163,74,.25)" }}
        >
          <Navigation size={12} /> Book
        </button>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 640, margin: "0 auto", paddingTop: 18, paddingBottom: 110 }}>
        {activeRide && <ActiveRideBanner ride={activeRide} onPress={() => onBookRide?.()} />}

        <div key={tab} style={{ animation: "slideUp .35s ease-out forwards", opacity: 0 }}>
          {tab === "home"    && <OverviewTab account={account} uid={uid} onTab={handleTab} />}
          {tab === "trips"   && <TripsTab uid={uid} onBookRide={onBookRide} />}
          {tab === "payment" && <PaymentTab onToast={showToast} />}
          {tab === "account" && <SettingsTab account={account} onToast={showToast} onSignOut={onSignOut} />}
        </div>
      </div>

      {/* Floating pill tab bar */}
      <TabBar tab={tab} setTab={setTab} onBookRide={onBookRide} />
    </div>
  );
}