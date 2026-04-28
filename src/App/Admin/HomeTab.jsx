import { useState, useMemo, useEffect, useRef } from "react";
import {
  Activity, DollarSign, Car, Shield,
  RefreshCw, Filter, Search, X, ChevronDown, TrendingUp, TrendingDown,
  MapPin, Clock, Mail, Users, ArrowUpRight, Zap,
  Navigation, CircleDot, CheckCircle2, XCircle, AlertCircle,
  Radio, Gauge, Layers, Sparkles, BarChart3, AlertTriangle,
  Flame, Bell, Eye, ChevronRight, ArrowDown,
} from "lucide-react";

/* ─── Design Tokens ─────────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700;800;900&display=swap');

:root {
  --bg:          #FAFAFA;
  --bg-card:     #FFFFFF;
  --bg-soft:     #F4F4F5;
  --bg-subtle:   #F9FAFB;

  --border:      rgba(0,0,0,.06);
  --border-mid:  rgba(0,0,0,.10);
  --border-strong: rgba(0,0,0,.16);

  --ink:         #09090B;
  --ink-2:       #27272A;
  --ink-3:       #52525B;
  --ink-4:       #71717A;
  --ink-5:       #A1A1AA;

  --green:       #16A34A;
  --green-soft:  #DCFCE7;
  --green-bg:    rgba(22,163,74,.08);

  --blue:        #2563EB;
  --blue-soft:   #DBEAFE;
  --blue-bg:     rgba(37,99,235,.08);

  --amber:       #D97706;
  --amber-soft:  #FEF3C7;
  --amber-bg:    rgba(217,119,6,.08);

  --red:         #DC2626;
  --red-soft:    #FEE2E2;
  --red-bg:      rgba(220,38,38,.08);

  --violet:      #7C3AED;
  --violet-bg:   rgba(124,58,237,.08);

  --r:           14px;
  --r-sm:        10px;
  --r-xs:        7px;
  --font:        'Inter', system-ui, sans-serif;
  --mono:        'JetBrains Mono', monospace;
}

.ht * { box-sizing: border-box; margin: 0; padding: 0; }
.ht {
  font-family: var(--font);
  background: var(--bg);
  color: var(--ink);
  min-height: 100vh;
  font-feature-settings: 'cv11', 'ss01', 'ss03';
  -webkit-font-smoothing: antialiased;
}

/* ── Animations ───────────────────────────────── */
@keyframes htFadeUp     { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }
@keyframes htSpin       { to { transform: rotate(360deg) } }
@keyframes htPulseDot   { 0%,100% { opacity:1; transform:scale(1) } 50% { opacity:.4; transform:scale(.6) } }
@keyframes htPulseRing  { 0%   { transform:scale(.85); opacity:.6 } 70% { transform:scale(1.5); opacity:0 } 100% { transform:scale(.85); opacity:0 } }
@keyframes htShimmer    { 0% { background-position:-200% 0 } 100% { background-position:200% 0 } }
@keyframes htHeartbeat  { 0%,100% { box-shadow: 0 0 0 0 rgba(22,163,74,.4); } 50% { box-shadow: 0 0 0 6px rgba(22,163,74,0); } }
@keyframes htUrgentGlow { 0%,100% { box-shadow: 0 0 0 0 rgba(220,38,38,.4); } 50% { box-shadow: 0 0 0 8px rgba(220,38,38,0); } }
@keyframes htScanLine   { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }

.fade-up { animation: htFadeUp .4s cubic-bezier(.22,1,.36,1) both; }
.spin    { animation: htSpin 1.1s linear infinite; }

/* ── Card ─────────────────────────────────────── */
.card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--r);
  position: relative;
}
.card-hover { transition: border-color .18s, transform .18s, box-shadow .18s; }
.card-hover:hover {
  border-color: var(--border-mid);
  box-shadow: 0 1px 3px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.06);
}

/* ── Status dot ───────────────────────────────── */
.live-dot {
  width: 6px; height: 6px; border-radius: 50%;
  flex-shrink: 0; position: relative;
}
.live-dot::after {
  content: '';
  position: absolute; inset: -3px; border-radius: 50%;
  border: 1.5px solid currentColor;
  animation: htPulseRing 2s ease-out infinite;
  opacity: 0;
}

/* ── Status pill ──────────────────────────────── */
.pill {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 10.5px; font-weight: 600; letter-spacing: .02em;
  padding: 3px 9px; border-radius: 6px;
}
.pill-mono { font-family: var(--mono); font-weight: 500; font-size: 10px; letter-spacing: .04em; }

/* ── Search input ─────────────────────────────── */
.search-wrap {
  display: flex; align-items: center; gap: 9px;
  background: var(--bg-soft); border: 1px solid var(--border-mid);
  border-radius: var(--r-sm); padding: 0 14px; height: 40px;
  transition: all .18s;
}
.search-wrap:focus-within {
  border-color: var(--ink); background: var(--bg-card);
  box-shadow: 0 0 0 3px rgba(0,0,0,.05);
}
.search-wrap input {
  flex: 1; border: none; outline: none; background: transparent;
  font-family: var(--font); font-size: 13px; color: var(--ink); font-weight: 500;
}
.search-wrap input::placeholder { color: var(--ink-5); font-weight: 400; }

/* ── Select ─────────────────────────────────── */
.sel-wrap { position: relative; flex: 1; min-width: 110px; }
.sel-wrap select {
  width: 100%; padding: 8px 28px 8px 12px;
  border-radius: 8px; border: 1px solid var(--border-mid);
  font-size: 11.5px; font-weight: 600; color: var(--ink-2);
  background: var(--bg-card); appearance: none; outline: none;
  cursor: pointer; font-family: var(--font);
  transition: border-color .18s;
}
.sel-wrap select:hover { border-color: var(--border-strong); }
.sel-wrap select:focus { border-color: var(--ink); box-shadow: 0 0 0 3px rgba(0,0,0,.05); }

/* ── Action btn ──────────────────────────────── */
.action-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 12px; border-radius: 9px;
  border: 1px solid var(--border-mid);
  background: var(--bg-card); font-family: var(--font);
  font-size: 11.5px; font-weight: 600; color: var(--ink-2);
  cursor: pointer; transition: all .15s;
}
.action-btn:hover { border-color: var(--border-strong); background: var(--bg-soft); }
.action-btn.active { background: var(--ink); color: #fff; border-color: var(--ink); }

/* ── Tab btn ──────────────────────────────── */
.tab-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 14px; border-radius: 100px;
  border: none;
  background: transparent;
  font-family: var(--font);
  font-size: 12px; font-weight: 700; color: var(--ink-3);
  cursor: pointer; transition: all .15s;
  white-space: nowrap;
}
.tab-btn:hover { color: var(--ink); background: var(--bg-soft); }
.tab-btn.active {
  background: var(--ink); color: #fff;
  box-shadow: 0 4px 12px rgba(0,0,0,.18);
}

/* ── Chart bar ─────────────────────────────────── */
.chart-bar {
  border-radius: 6px 6px 3px 3px;
  transition: all .4s cubic-bezier(.22,1,.36,1);
}

/* ── Scrollbar ───────────────────────────────── */
.ht ::-webkit-scrollbar { width: 4px; height: 4px; }
.ht ::-webkit-scrollbar-track { background: transparent; }
.ht ::-webkit-scrollbar-thumb { background: var(--border-mid); border-radius: 2px; }
`;

/* ─── Helpers ────────────────────────────────────────────────────── */
function timeAgo(ts) {
  if (!ts) return "—";
  const seconds = ts?.seconds ?? Math.floor(ts / 1000);
  const diff    = Math.floor(Date.now() / 1000) - seconds;
  if (diff < 60)   return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}
function shortAddr(addr = "") { return addr.split(",")[0] || addr; }
function tsToMs(ts) {
  if (!ts) return 0;
  if (ts?.seconds) return ts.seconds * 1000;
  if (typeof ts === "number") return ts;
  return 0;
}
function fmtMMSS(s) {
  const a = Math.abs(Math.round(s));
  return `${Math.floor(a / 60)}:${String(a % 60).padStart(2, "0")}`;
}
function initials(name = "") {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";
}

/* ─── Status Configs ─────────────────────────────────────────────── */
const STATUS = {
  searching_driver: { label: "Searching",   accent: "#D97706", bg: "#FFFBEB", border: "#FDE68A", priority: 1 },
  driver_assigned:  { label: "Assigned",    accent: "#2563EB", bg: "#EFF6FF", border: "#BFDBFE", priority: 2 },
  arrived:          { label: "Arrived",     accent: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0", priority: 3 },
  in_progress:      { label: "In Progress", accent: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0", priority: 4 },
  completed:        { label: "Completed",   accent: "#52525B", bg: "#F4F4F5", border: "#E4E4E7", priority: 5 },
  cancelled:        { label: "Cancelled",   accent: "#DC2626", bg: "#FEF2F2", border: "#FECACA", priority: 6 },
};
const PAY_STATUS = {
  succeeded: { bg: "#F0FDF4", color: "#16A34A", label: "Paid"    },
  pending:   { bg: "#FFFBEB", color: "#D97706", label: "Pending" },
  failed:    { bg: "#FEF2F2", color: "#DC2626", label: "Failed"  },
};
const PAYOUT = {
  processing: { bg: "#EFF6FF", color: "#2563EB", label: "Processing" },
  pending:    { bg: "#FFFBEB", color: "#D97706", label: "Pending"    },
  paid:       { bg: "#F0FDF4", color: "#16A34A", label: "Paid Out"   },
  failed:     { bg: "#FEF2F2", color: "#DC2626", label: "Failed"     },
};
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

/* ─── Urgency calculator ─────────────────────────────────────────── */
function getRideUrgency(ride) {
  const now = Date.now();

  if (ride.status === "searching_driver") {
    const created = tsToMs(ride.createdAt);
    const ageSec = (now - created) / 1000;
    const expires = tsToMs(ride.expiresAt);
    const remaining = expires ? (expires - now) / 1000 : Infinity;
    if (remaining < 60 || ageSec > 1500) return { level: "critical", reason: "Expiring soon" };
    if (remaining < 300 || ageSec > 600) return { level: "high",     reason: "Searching long" };
    return { level: "medium", reason: "Searching" };
  }

  if (ride.status === "driver_assigned" && ride.acceptedAt) {
    const accepted = tsToMs(ride.acceptedAt);
    const elapsed = (now - accepted) / 1000;
    const eta = (ride.driverInfo?.etaMin ?? 0) * 60;
    if (eta > 0 && elapsed > eta * 1.5) return { level: "high",   reason: "Driver overdue" };
    if (eta > 0 && elapsed > eta)        return { level: "medium", reason: "ETA elapsed" };
  }

  if (ride.status === "in_progress" && ride.startedAt) {
    const started = tsToMs(ride.startedAt);
    const elapsed = (now - started) / 1000;
    const total = (ride.tripDurationMin ?? 0) * 60;
    if (total > 0 && elapsed > total * 1.5) return { level: "high", reason: "Trip overdue" };
  }

  if (ride.paymentStatus === "failed") return { level: "critical", reason: "Payment failed" };
  if (ride.payoutStatus === "failed")  return { level: "high",     reason: "Payout failed" };

  return { level: "normal" };
}

const URGENCY = {
  critical: { color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", Icon: AlertTriangle, label: "Critical" },
  high:     { color: "#EA580C", bg: "#FFF7ED", border: "#FED7AA", Icon: Flame,         label: "Needs attention" },
  medium:   { color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", Icon: Bell,          label: "Watching" },
  normal:   { color: "#52525B", bg: "#FAFAFA", border: "#E4E4E7", Icon: null,          label: "Normal" },
};

/* ─── Progress Bar Engine ────────────────────────────────────────── */
function ProgressBar({ pct = 0, color = "#16A34A", label, height = 3 }) {
  return (
    <div style={{ height, background: "rgba(0,0,0,.05)", position: "relative", overflow: "visible", borderRadius: "0 0 14px 14px" }}>
      <div style={{
        position: "absolute", top: 0, left: 0, bottom: 0,
        width: `${Math.min(Math.max(pct, 0), 100)}%`,
        background: color,
        borderRadius: "0 2px 2px 0",
        boxShadow: `0 0 8px ${color}55`,
        transition: "width .3s ease, background .3s",
      }} />
      {label && (
        <div style={{
          position: "absolute", top: -1,
          left: `${Math.min(Math.max(pct, 6), 88)}%`,
          transform: "translate(-50%, -100%)",
          background: color, color: "#fff",
          fontSize: 9, fontWeight: 700,
          padding: "3px 7px", borderRadius: 5,
          whiteSpace: "nowrap", fontFamily: "var(--mono)",
          letterSpacing: ".02em", pointerEvents: "none",
          zIndex: 10, boxShadow: `0 2px 8px ${color}55`,
        }}>{label}</div>
      )}
    </div>
  );
}

function SearchTimerBar({ expiresAt, emailDispatchAt, createdAt }) {
  const [pct, setPct]   = useState(100);
  const [left, setLeft] = useState(null);
  const raf             = useRef(null);
  useEffect(() => {
    const exMs   = tsToMs(expiresAt); if (!exMs) return;
    const startMs = tsToMs(emailDispatchAt) || tsToMs(createdAt) || (exMs - 25 * 60 * 1000);
    const totalMs = exMs - startMs;
    const tick = () => {
      const now = Date.now();
      const rem = Math.max((exMs - now) / 1000, 0);
      setPct(Math.max(((exMs - now) / totalMs) * 100, 0));
      setLeft(Math.ceil(rem));
      if (rem > 0) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [expiresAt, emailDispatchAt, createdAt]);
  const c = left === null ? "#A1A1AA" : left > 300 ? "#D97706" : left > 60 ? "#EA580C" : "#DC2626";
  return <ProgressBar pct={pct} color={c} label={left != null ? (left > 0 ? fmtMMSS(left) : "EXPIRED") : "…"} />;
}

function AssignedBar({ acceptedAt, etaMin }) {
  const [elapsed, setElapsed] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const ms = tsToMs(acceptedAt); if (!ms) return;
    const tick = () => { setElapsed(Math.floor((Date.now() - ms) / 1000)); raf.current = requestAnimationFrame(tick); };
    raf.current = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf.current);
  }, [acceptedAt]);
  const total = (etaMin ?? 0) * 60;
  const pct   = total > 0 ? Math.min((elapsed / total) * 100, 100) : 0;
  const isLate = total > 0 && elapsed > total;
  const c = isLate ? "#DC2626" : pct > 80 ? "#EA580C" : "#2563EB";
  return <ProgressBar pct={pct} color={c} label={isLate ? `+${fmtMMSS(elapsed - total)}` : etaMin != null ? `${etaMin}m ETA` : `${fmtMMSS(elapsed)}`} />;
}

function TripBar({ startedAt, tripDurationMin }) {
  const [elapsed, setElapsed] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const ms = tsToMs(startedAt); if (!ms) return;
    const tick = () => { setElapsed(Math.floor((Date.now() - ms) / 1000)); raf.current = requestAnimationFrame(tick); };
    raf.current = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf.current);
  }, [startedAt]);
  const total = (tripDurationMin ?? 0) * 60;
  const pct   = total > 0 ? Math.min((elapsed / total) * 100, 100) : 0;
  const rem   = Math.max(total - elapsed, 0);
  const c = pct > 90 ? "#DC2626" : pct > 70 ? "#D97706" : "#16A34A";
  return <ProgressBar pct={pct} color={c} label={total > 0 ? (elapsed > total ? `+${fmtMMSS(elapsed - total)}` : `${fmtMMSS(rem)} left`) : `${fmtMMSS(elapsed)}`} />;
}

/* ─── Heartbeat (top-right of ops bar) ───────────────────────────── */
function Heartbeat({ online }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6,
    }}>
      <div style={{
        width: 8, height: 8, borderRadius: "50%",
        background: online ? "#16A34A" : "#A1A1AA",
        animation: online ? "htHeartbeat 1.8s ease-in-out infinite" : "none",
        boxShadow: online ? "0 0 6px rgba(22,163,74,.6)" : "none",
      }}/>
      <span style={{
        fontSize: 9.5, fontWeight: 800, color: online ? "#16A34A" : "#A1A1AA",
        letterSpacing: ".1em", textTransform: "uppercase",
      }}>
        {online ? "Live" : "Idle"}
      </span>
    </div>
  );
}

/* ─── Mini sparkline ─────────────────────────────────────────────── */
function Sparkline({ values = [], color = "#16A34A", width = 56, height = 18 }) {
  const max = Math.max(...values, 1);
  const points = values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * width;
    const y = height - (v / max) * height;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={`spk-${color.replace("#", "")}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      {values.length > 0 && (
        <>
          <polyline
            points={`0,${height} ${points} ${width},${height}`}
            fill={`url(#spk-${color.replace("#", "")})`}
          />
          <polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {values.length > 0 && (
            <circle
              cx={width}
              cy={height - (values[values.length - 1] / max) * height}
              r="2.5"
              fill={color}
            />
          )}
        </>
      )}
    </svg>
  );
}

/* ─── Weekly Summary ─────────────────────────────────────────────── */
function WeekChart({ allRides = [] }) {
  const now    = new Date();
  const sunday = new Date(now);
  sunday.setHours(0,0,0,0);
  sunday.setDate(now.getDate() - now.getDay());

  const buckets = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday); d.setDate(sunday.getDate() + i);
    return { label: DAYS[d.getDay()], dateStr: d.toDateString(),
      isToday: d.toDateString() === now.toDateString(),
      isFuture: d > now, rides: 0, fare: 0, platform: 0, payout: 0 };
  });

  allRides.filter(r => r.status === "completed").forEach(r => {
    const ms = tsToMs(r.completedAt ?? r.updatedAt ?? r.createdAt);
    if (!ms) return;
    const d = new Date(ms); d.setHours(0,0,0,0);
    const idx = buckets.findIndex(b => b.dateStr === d.toDateString());
    if (idx === -1) return;
    buckets[idx].rides++;
    buckets[idx].fare     += Number(r.fareTotal    ?? 0);
    buckets[idx].platform += Number(r.platformFee  ?? 0);
    buckets[idx].payout   += Number(r.driverPayout ?? 0);
  });

  const totalFare     = buckets.reduce((s, b) => s + b.fare, 0);
  const totalRides    = buckets.reduce((s, b) => s + b.rides, 0);
  const totalPlatform = buckets.reduce((s, b) => s + b.platform, 0);
  const totalPayout   = buckets.reduce((s, b) => s + b.payout, 0);
  const maxFare       = Math.max(...buckets.map(b => b.fare), 1);

  // Calculate week-over-week comparison
  const todayIdx = buckets.findIndex(b => b.isToday);
  const completedDays = buckets.slice(0, todayIdx + 1).filter(b => !b.isFuture);
  const avgPerDay = completedDays.length > 0 ? totalFare / completedDays.length : 0;

  const [hov, setHov] = useState(null);
  const h = hov !== null ? buckets[hov] : null;

  return (
    <div className="card fade-up" style={{ marginBottom: 12, animationDelay: "60ms", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "20px 22px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <BarChart3 size={14} color="var(--ink-3)" />
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", letterSpacing: "-.01em" }}>This Week</span>
            <span className="pill" style={{ background: "var(--bg-soft)", color: "var(--ink-3)" }}>
              {totalRides} rides
            </span>
          </div>
          <div style={{ fontSize: 11.5, color: "var(--ink-4)", fontWeight: 500 }}>
            Sunday – Saturday performance
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--ink)", letterSpacing: "-.03em", lineHeight: 1, fontFeatureSettings: "'tnum'" }}>
            ${totalFare.toFixed(2)}
          </div>
          <div style={{ fontSize: 10.5, color: "var(--ink-4)", fontWeight: 500, marginTop: 4, letterSpacing: ".02em", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6 }}>
            <span>TOTAL FARE</span>
            {avgPerDay > 0 && (
              <>
                <span style={{ color: "var(--border-strong)" }}>·</span>
                <span style={{ color: "var(--ink-3)", fontWeight: 600 }}>${avgPerDay.toFixed(0)}/day avg</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div style={{ padding: "22px 22px 6px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 92 }}>
          {buckets.map((b, i) => {
            const pct = b.isFuture ? 0 : Math.max((b.fare / maxFare) * 100, b.rides > 0 ? 8 : 0);
            const isH = hov === i;
            return (
              <div key={b.label} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}
                style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, cursor: "default" }}>
                {!b.isFuture && b.rides > 0 && (
                  <div className="pill-mono" style={{ fontSize: 9, color: b.isToday ? "var(--green)" : "var(--ink-4)", fontWeight: 600 }}>
                    ${b.fare.toFixed(0)}
                  </div>
                )}
                {(b.isFuture || b.rides === 0) && <div style={{ flex: 1 }} />}
                <div className="chart-bar" style={{
                  width: "100%",
                  height: b.isFuture ? 4 : `${Math.max(pct, 6)}%`,
                  minHeight: 4,
                  background: b.isFuture
                    ? "var(--bg-soft)"
                    : b.isToday
                    ? isH ? "linear-gradient(180deg,#22C55E,#16A34A 70%,#15803D)" : "linear-gradient(180deg,#22C55E,#16A34A)"
                    : isH ? "var(--ink-2)" : "var(--ink-5)",
                  boxShadow: b.isToday && !b.isFuture ? "0 4px 14px rgba(22,163,74,.25)" : "none",
                  opacity: !b.isToday && !isH && !b.isFuture ? .5 : 1,
                }} />
                <div style={{
                  fontSize: 10, letterSpacing: ".02em",
                  color: b.isToday ? "var(--green)" : "var(--ink-4)",
                  fontWeight: b.isToday ? 700 : 500,
                }}>
                  {b.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hover detail */}
      {h && !h.isFuture && (
        <div style={{ margin: "0 22px 18px", padding: "12px 14px", background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 10, display: "flex", gap: 24, flexWrap: "wrap" }}>
          {[
            { label: h.label,     val: `${h.rides} ride${h.rides !== 1 ? "s" : ""}`, color: "var(--ink)"  },
            { label: "Fare",      val: `$${h.fare.toFixed(2)}`,                       color: "var(--ink)"  },
            { label: "Platform",  val: `$${h.platform.toFixed(2)}`,                  color: "var(--blue)" },
            { label: "Driver",    val: `$${h.payout.toFixed(2)}`,                    color: "var(--green)" },
          ].map(it => (
            <div key={it.label}>
              <div style={{ fontSize: 9.5, color: "var(--ink-4)", letterSpacing: ".02em", marginBottom: 3, fontWeight: 600, textTransform: "uppercase" }}>{it.label}</div>
              <div style={{ fontSize: 16, color: it.color, fontWeight: 700, fontFeatureSettings: "'tnum'", letterSpacing: "-.02em" }}>{it.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", borderTop: "1px solid var(--border)" }}>
        {[
          { label: "Total Fare",    val: `$${totalFare.toFixed(2)}`,     color: "var(--ink)"   },
          { label: "Platform Fee",  val: `$${totalPlatform.toFixed(2)}`, color: "var(--blue)"  },
          { label: "Driver Payout", val: `$${totalPayout.toFixed(2)}`,   color: "var(--green)" },
        ].map((it, i) => (
          <div key={it.label} style={{ flex: 1, textAlign: "center", padding: "16px 8px", borderRight: i < 2 ? "1px solid var(--border)" : "none" }}>
            <div style={{ fontSize: 9.5, color: "var(--ink-4)", letterSpacing: ".02em", marginBottom: 5, fontWeight: 600, textTransform: "uppercase" }}>{it.label}</div>
            <div style={{ fontSize: 18, color: it.color, fontWeight: 800, letterSpacing: "-.02em", fontFeatureSettings: "'tnum'" }}>{it.val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Filter Panel ───────────────────────────────────────────────── */
function FilterPanel({ filters, onChange, onClear, count }) {
  return (
    <div className="fade-up" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: 14, marginBottom: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="search-wrap">
        <Search size={13} color="var(--ink-5)" />
        <input value={filters.search} onChange={e => onChange("search", e.target.value)} placeholder="Search address, city, zip…" />
        {filters.search && (
          <button onClick={() => onChange("search", "")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-4)", display: "flex", padding: 0 }}>
            <X size={13} />
          </button>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[
          { key: "status",         opts: [["","All statuses"],["searching_driver","Searching"],["driver_assigned","Assigned"],["arrived","Arrived"],["in_progress","In Progress"],["completed","Completed"],["cancelled","Cancelled"]] },
          { key: "paymentMethod",  opts: [["","All payments"],["card","Card"],["cashapp","Cash App"]] },
          { key: "paymentStatus",  opts: [["","Pay status"],["succeeded","Paid"],["pending","Pending"],["failed","Failed"]] },
          { key: "payoutStatus",   opts: [["","Payout status"],["processing","Processing"],["pending","Pending"],["paid","Paid"],["failed","Failed"]] },
        ].map(({ key, opts }) => (
          <div className="sel-wrap" key={key}>
            <select value={filters[key]} onChange={e => onChange(key, e.target.value)}>
              {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <ChevronDown size={11} style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", color: "var(--ink-4)", pointerEvents: "none" }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4 }}>
        <span style={{ fontSize: 11, color: "var(--ink-4)", fontWeight: 500 }}>{count} ride{count !== 1 ? "s" : ""} matching</span>
        <button onClick={onClear} style={{ fontSize: 11, fontWeight: 600, color: "var(--red)", background: "none", border: "none", cursor: "pointer" }}>Clear all</button>
      </div>
    </div>
  );
}

/* ─── Driver Search Banner ───────────────────────────────────────── */
function SearchBanner({ driverInfo, candidates = [], emailed = {} }) {
  if (!driverInfo && candidates.length === 0) return null;
  return (
    <div style={{ marginBottom: 12, padding: "9px 12px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 9 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div className="live-dot" style={{ background: "#D97706", color: "#D97706" }} />
          <span style={{ fontSize: 10.5, fontWeight: 700, color: "#92400E", letterSpacing: ".02em" }}>SEARCHING</span>
        </div>
        <span className="pill" style={{ background: "#FEF3C7", color: "#92400E" }}>
          <Users size={9} /> {candidates.length} candidate{candidates.length !== 1 ? "s" : ""}
        </span>
        <span className="pill" style={{ background: Object.keys(emailed).length > 0 ? "#DCFCE7" : "var(--bg-soft)", color: Object.keys(emailed).length > 0 ? "#166534" : "var(--ink-4)" }}>
          <Mail size={9} /> {Object.keys(emailed).length} emailed
        </span>
        {driverInfo?.nearestMiles != null && (
          <span className="pill" style={{ background: "var(--bg-soft)", color: "var(--ink-3)" }}>
            <Navigation size={9} /> {driverInfo.nearestMiles.toFixed(1)} mi
          </span>
        )}
        {driverInfo?.etaLabel && (
          <span className="pill" style={{ background: "var(--bg-soft)", color: "var(--ink-3)" }}>
            <Clock size={9} /> {driverInfo.etaLabel}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Ride Card ──────────────────────────────────────────────────── */
function RideCard({ ride, index, urgency }) {
  const riderLabel  = ride.riderName  ?? `Rider ···${ride.uid?.slice(-4) ?? "?"}`;
  const driverLabel = ride.driverName ?? (ride.driverUid ? `Driver ···${ride.driverUid.slice(-4)}` : null);

  const s  = STATUS[ride.status]            ?? { label: ride.status ?? "Unknown", accent: "#71717A", bg: "#F4F4F5", border: "#E4E4E7" };
  const pm = PAY_STATUS[ride.paymentStatus] ?? { bg: "#F4F4F5", color: "#71717A", label: ride.paymentStatus ?? "—" };
  const po = PAYOUT[ride.payoutStatus]      ?? { bg: "#F4F4F5", color: "#71717A", label: ride.payoutStatus ?? "—" };

  const u = URGENCY[urgency.level] ?? URGENCY.normal;
  const isUrgent = urgency.level === "critical" || urgency.level === "high";

  function StatusBar() {
    switch (ride.status) {
      case "searching_driver": return <SearchTimerBar expiresAt={ride.expiresAt} emailDispatchAt={ride.emailDispatchAt} createdAt={ride.createdAt} />;
      case "driver_assigned":  return <AssignedBar acceptedAt={ride.acceptedAt} etaMin={ride.driverInfo?.etaMin} />;
      case "arrived":          return <ProgressBar pct={100} color="#16A34A" label="ARRIVED" />;
      case "in_progress":      return <TripBar startedAt={ride.startedAt} tripDurationMin={ride.tripDurationMin} />;
      case "completed":        return <div style={{ height: 3, background: "var(--bg-soft)" }} />;
      case "cancelled":        return <div style={{ height: 3, background: "linear-gradient(90deg,#DC2626,#FECACA)" }} />;
      default:                 return <div style={{ height: 3, background: "var(--border)" }} />;
    }
  }

  return (
    <div className="card card-hover fade-up" style={{
      animationDelay: `${200 + index * 50}ms`,
      padding: 0,
      overflow: "hidden",
      borderColor: isUrgent ? u.border : "var(--border)",
      boxShadow: urgency.level === "critical"
        ? "0 0 0 2px rgba(220,38,38,.12), 0 4px 16px rgba(220,38,38,.08)"
        : urgency.level === "high"
          ? "0 4px 14px rgba(234,88,12,.10)"
          : undefined,
      animation: urgency.level === "critical"
        ? "htUrgentGlow 2s ease-in-out infinite, htFadeUp .4s cubic-bezier(.22,1,.36,1) both"
        : undefined,
    }}>

      {/* ── Urgency banner ── */}
      {isUrgent && urgency.reason && (
        <div style={{
          display: "flex", alignItems: "center", gap: 7,
          padding: "6px 14px",
          background: u.bg,
          borderBottom: `1px solid ${u.border}`,
          fontSize: 10.5, fontWeight: 800, color: u.color,
          letterSpacing: ".04em", textTransform: "uppercase",
          position: "relative", overflow: "hidden",
        }}>
          {urgency.level === "critical" && (
            <div style={{
              position: "absolute", inset: 0,
              background: `linear-gradient(90deg, transparent, ${u.color}15, transparent)`,
              animation: "htScanLine 2.5s linear infinite",
              pointerEvents: "none",
            }}/>
          )}
          {u.Icon && <u.Icon size={11} strokeWidth={2.6}/>}
          <span style={{ position: "relative" }}>{urgency.reason}</span>
        </div>
      )}

      <div style={{ padding: "14px 16px 14px" }}>

        {/* ── Top row ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 13, gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0, flex: 1 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 11, flexShrink: 0,
              background: "linear-gradient(135deg, var(--ink-2), var(--ink))",
              border: "1px solid rgba(0,0,0,.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: ".02em",
              boxShadow: "0 2px 8px rgba(0,0,0,.08)",
            }}>
              {initials(riderLabel)}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "-.01em" }}>{riderLabel}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                {driverLabel
                  ? <><Car size={10} color="var(--ink-4)" /><span style={{ fontSize: 11, color: "var(--ink-4)", fontWeight: 500 }}>{driverLabel}</span></>
                  : <span style={{ fontSize: 11, color: "#D97706", fontWeight: 600, fontStyle: "italic" }}>No driver yet</span>
                }
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
            <div className="pill" style={{ background: s.bg, color: s.accent, border: `1px solid ${s.border}` }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.accent, boxShadow: `0 0 5px ${s.accent}88` }} />
              {s.label}
            </div>
            <div style={{ fontSize: 22, color: "var(--ink)", fontWeight: 800, lineHeight: 1, letterSpacing: "-.03em", fontFeatureSettings: "'tnum'" }}>
              {ride.fareTotal != null ? `$${ride.fareTotal.toFixed(2)}` : "—"}
            </div>
          </div>
        </div>

        {/* ── Search banner ── */}
        {ride.status === "searching_driver" && (
          <SearchBanner
            driverInfo={ride.driverInfo}
            candidates={ride.candidateDriverUids ?? []}
            emailed={ride.emailSentToDrivers ?? {}}
          />
        )}

        {/* ── Route ── */}
        <div style={{
          background: "var(--bg-subtle)",
          border: "1px solid var(--border)",
          borderRadius: 11, padding: "12px 14px",
          marginBottom: 11, position: "relative",
        }}>
          <div style={{ position: "absolute", left: 22, top: 22, bottom: 22, width: 1.5, background: "linear-gradient(180deg,#16A34A 0%,#16A34A 50%,#DC2626 100%)", opacity: .25 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            {[
              { dot: "#16A34A", lbl: "Pickup",  addr: shortAddr(ride.pickup),  city: ride.pickupCity,  zip: ride.pickupZip  },
              { dot: "#DC2626", lbl: "Dropoff", addr: shortAddr(ride.dropoff), city: ride.dropoffCity, zip: ride.dropoffZip },
            ].map(({ dot, lbl, addr, city, zip }) => (
              <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <div style={{
                  width: 9, height: 9, borderRadius: "50%", background: dot,
                  flexShrink: 0, border: "2px solid var(--bg-card)", zIndex: 1,
                  boxShadow: `0 0 0 1.5px ${dot}, 0 0 8px ${dot}55`,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 9.5, color: "var(--ink-4)", letterSpacing: ".04em", marginBottom: 2, fontWeight: 600, textTransform: "uppercase" }}>{lbl}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {addr}
                    {city && <span style={{ color: "var(--ink-4)", fontWeight: 400 }}> · {city}{zip ? ` ${zip}` : ""}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Meta chips ── */}
        <div style={{ display: "flex", gap: 5, marginBottom: 12, flexWrap: "wrap" }}>
          {[
            ride.rideLabel ?? ride.rideType,
            ride.tripDistanceMiles != null ? `${ride.tripDistanceMiles} mi` : null,
            ride.tripDurationMin != null ? `~${ride.tripDurationMin} min` : null,
            `${timeAgo(ride.createdAt)} ago`,
          ].filter(Boolean).map((l, i) => (
            <span key={i} className="pill" style={{ background: "var(--bg-soft)", color: "var(--ink-3)", border: "1px solid var(--border)", textTransform: "capitalize", fontSize: 10.5 }}>{l}</span>
          ))}
        </div>

        {/* ── Footer ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid var(--border)", flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            <span className="pill" style={{
              background: ride.paymentMethod === "cashapp" ? "#F0FDF4" : "#EFF6FF",
              color:      ride.paymentMethod === "cashapp" ? "#16A34A" : "#2563EB",
            }}>
              {ride.paymentMethod === "cashapp" ? "Cash App" : (ride.paymentMethod === "card" ? "Card" : (ride.paymentMethod ?? "—"))}
            </span>
            <span className="pill" style={{ background: pm.bg, color: pm.color }}>{pm.label}</span>
            <span className="pill" style={{ background: po.bg, color: po.color }}>{po.label}</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-4)", fontWeight: 500, fontFeatureSettings: "'tnum'" }}>
            <span style={{ color: "var(--green)", fontWeight: 700 }}>${ride.driverPayout?.toFixed(2) ?? "—"}</span>
            <span> drv · </span>
            <span style={{ color: "var(--blue)", fontWeight: 700 }}>${ride.platformFee?.toFixed(2) ?? "—"}</span>
            <span> fee</span>
          </div>
        </div>
      </div>

      <StatusBar />
    </div>
  );
}

/* ─── HomeTab ────────────────────────────────────────────────────── */
const DEFAULT_FILTERS = { search: "", status: "", paymentMethod: "", paymentStatus: "", payoutStatus: "" };

export function HomeTab({
  liveRides = [], allRides = [], allApprovals = [], totalAccounts = 0,
  uatobdrivers = [], activeRides = [], searchingRides = [],
  totalRides = 0, activeDrivers = [], revenue = 0, onToast,
}) {
  const [refreshing,  setRefreshing]  = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters,     setFilters]     = useState(DEFAULT_FILTERS);
  const [activeView,  setActiveView]  = useState("attention"); // attention | all | active | completed

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); onToast?.("Data refreshed"); }, 1100);
  };
  const onChange    = (k, v) => setFilters(p => ({ ...p, [k]: v }));
  const onClear     = () => setFilters(DEFAULT_FILTERS);
  const activeCount = Object.values(filters).filter(Boolean).length;

  // Compute urgency for all live rides
  const ridesWithUrgency = useMemo(() =>
    liveRides.map(r => ({ ride: r, urgency: getRideUrgency(r) })),
    [liveRides]
  );

  const urgentCount = useMemo(() =>
    ridesWithUrgency.filter(r => r.urgency.level === "critical" || r.urgency.level === "high").length,
    [ridesWithUrgency]
  );

  const filtered = useMemo(() => {
    let result = ridesWithUrgency;

    // View tab filter
    if (activeView === "attention") {
      result = result.filter(r => r.urgency.level === "critical" || r.urgency.level === "high" || r.urgency.level === "medium");
    } else if (activeView === "active") {
      result = result.filter(r => ["searching_driver", "driver_assigned", "arrived", "in_progress"].includes(r.ride.status));
    } else if (activeView === "completed") {
      result = result.filter(r => r.ride.status === "completed");
    }

    // Search & explicit filters
    return result.filter(({ ride }) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const s = [ride.pickup, ride.dropoff, ride.pickupCity, ride.dropoffCity, ride.pickupZip, ride.dropoffZip].map(v => (v ?? "").toLowerCase()).join(" ");
        if (!s.includes(q)) return false;
      }
      if (filters.status        && ride.status        !== filters.status)        return false;
      if (filters.paymentMethod && ride.paymentMethod !== filters.paymentMethod) return false;
      if (filters.paymentStatus && ride.paymentStatus !== filters.paymentStatus) return false;
      if (filters.payoutStatus  && ride.payoutStatus  !== filters.payoutStatus)  return false;
      return true;
    }).sort((a, b) => {
      // Sort by urgency first, then by status priority
      const urgencyOrder = { critical: 0, high: 1, medium: 2, normal: 3 };
      const ua = urgencyOrder[a.urgency.level] ?? 3;
      const ub = urgencyOrder[b.urgency.level] ?? 3;
      if (ua !== ub) return ua - ub;
      const sa = STATUS[a.ride.status]?.priority ?? 99;
      const sb = STATUS[b.ride.status]?.priority ?? 99;
      if (sa !== sb) return sa - sb;
      return tsToMs(b.ride.createdAt) - tsToMs(a.ride.createdAt);
    });
  }, [ridesWithUrgency, filters, activeView]);

  // Compute revenue trend (last 7 days)
  const revenueTrend = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (6 - i));
      return { dateStr: d.toDateString(), total: 0 };
    });
    allRides.filter(r => r.status === "completed").forEach(r => {
      const ms = tsToMs(r.completedAt ?? r.updatedAt ?? r.createdAt);
      if (!ms) return;
      const d = new Date(ms); d.setHours(0,0,0,0);
      const idx = days.findIndex(b => b.dateStr === d.toDateString());
      if (idx >= 0) days[idx].total += Number(r.fareTotal ?? 0);
    });
    return days.map(d => d.total);
  }, [allRides]);

  // Stat cards data
  const statRows = [
    {
      label: "Total Rides", val: totalRides ?? liveRides.length,
      accent: "#2563EB", Icon: Activity, delay: 0,
      sub: `${activeRides.length} active`,
    },
    {
      label: "Active Drivers", val: activeDrivers.length,
      accent: "#16A34A", Icon: Car, delay: 50,
      sub: `${uatobdrivers.length} total`,
    },
    {
      label: "Revenue Today", val: revenue != null ? `$${revenue.toFixed(2)}` : "—",
      accent: "#D97706", Icon: DollarSign, delay: 100,
      sparkline: revenueTrend,
    },
    {
      label: "Pending Apps", val: allApprovals.length,
      accent: "#DC2626", Icon: Shield, delay: 150,
      sub: allApprovals.length > 0 ? "Needs review" : "All clear",
    },
  ];

  return (
    <>
      <style>{CSS}</style>
      <div className="ht" style={{ padding: "0 14px 32px" }}>

        {/* ── Ops command bar (replaces top KPI strip) ── */}
        <div className="card fade-up" style={{
          padding: "14px 18px", marginBottom: 12,
          background: "linear-gradient(135deg, #FFFFFF, #FAFAFA)",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: 0, right: 0, bottom: 0, width: 200,
            background: "radial-gradient(circle at right, rgba(22,163,74,0.05), transparent 70%)",
            pointerEvents: "none",
          }}/>

          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, flex: 1, minWidth: 0 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <Heartbeat online/>
                  <span style={{
                    fontSize: 16, fontWeight: 800, color: "var(--ink)",
                    letterSpacing: "-.02em",
                  }}>
                    Operations
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-4)", fontWeight: 500 }}>
                  {urgentCount > 0
                    ? <><span style={{ color: "var(--red)", fontWeight: 700 }}>{urgentCount} need attention</span> · {liveRides.length} live</>
                    : <>{liveRides.length} rides live · all systems normal</>
                  }
                </div>
              </div>

              <div style={{ display: "flex", gap: 0, overflowX: "auto", flexShrink: 0 }}>
                {[
                  { val: totalAccounts,         sub: "Accounts",  dot: "#52525B" },
                  { val: uatobdrivers.length,   sub: "Drivers",   dot: "#2563EB" },
                  { val: activeRides.length,    sub: "Active",    dot: "#16A34A" },
                  { val: searchingRides.length, sub: "Searching", dot: "#D97706" },
                ].map(({ val, sub, dot }, i) => (
                  <div key={sub} style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "0 13px",
                    borderLeft: i > 0 ? "1px solid var(--border)" : "none",
                    flexShrink: 0,
                  }}>
                    <div style={{
                      width: 5, height: 5, borderRadius: "50%", background: dot,
                      boxShadow: `0 0 4px ${dot}`,
                    }} />
                    <span style={{
                      fontSize: 16, fontWeight: 800, color: "var(--ink)",
                      letterSpacing: "-.02em", fontFeatureSettings: "'tnum'",
                    }}>{val}</span>
                    <span style={{ fontSize: 10.5, color: "var(--ink-4)", fontWeight: 600, letterSpacing: ".02em", textTransform: "uppercase" }}>{sub}</span>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={handleRefresh} style={{
              width: 34, height: 34, borderRadius: 9,
              border: "1px solid var(--border-mid)", background: "var(--bg-card)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "var(--ink-3)", flexShrink: 0,
              transition: "all .15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-soft)"; e.currentTarget.style.borderColor = "var(--border-strong)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-card)"; e.currentTarget.style.borderColor = "var(--border-mid)"; }}
            >
              <RefreshCw size={13} className={refreshing ? "spin" : ""} />
            </button>
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
          {statRows.map(({ label, val, accent, Icon, delay, sub, sparkline }) => (
            <div key={label} className="card card-hover fade-up" style={{ padding: "16px", animationDelay: `${delay}ms`, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: accent, opacity: .8 }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: `${accent}12`, border: `1px solid ${accent}25`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={14} color={accent} strokeWidth={2.2} />
                </div>
                {sparkline && <Sparkline values={sparkline} color={accent}/>}
              </div>
              <div style={{ fontSize: 24, color: "var(--ink)", fontWeight: 800, letterSpacing: "-.03em", lineHeight: 1, fontFeatureSettings: "'tnum'", marginBottom: 5 }}>{val}</div>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                fontSize: 11, color: "var(--ink-4)", fontWeight: 500,
              }}>
                <span>{label}</span>
                {sub && (
                  <span style={{ fontWeight: 600, color: "var(--ink-3)" }}>{sub}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── Weekly chart ── */}
        <WeekChart allRides={allRides.length > 0 ? allRides : liveRides} />

        {/* ── View tabs ── */}
        <div className="fade-up" style={{ animationDelay: "180ms", marginBottom: 12 }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 12, flexWrap: "wrap", gap: 10,
          }}>
            <div style={{
              display: "flex", gap: 4,
              background: "var(--bg-soft)",
              border: "1px solid var(--border)",
              borderRadius: 100, padding: 4,
              overflow: "auto",
            }}>
              {[
                { id: "attention", label: "Needs Attention", icon: AlertCircle, count: urgentCount },
                { id: "active",    label: "Active",          icon: Activity,    count: ridesWithUrgency.filter(r => ["searching_driver","driver_assigned","arrived","in_progress"].includes(r.ride.status)).length },
                { id: "all",       label: "All",             icon: Layers,      count: liveRides.length },
                { id: "completed", label: "Completed",       icon: CheckCircle2, count: ridesWithUrgency.filter(r => r.ride.status === "completed").length },
              ].map(t => {
                const Icon = t.icon;
                const isActive = activeView === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveView(t.id)}
                    className={`tab-btn ${isActive ? "active" : ""}`}
                  >
                    <Icon size={11} strokeWidth={2.4}/>
                    {t.label}
                    {t.count > 0 && (
                      <span style={{
                        background: isActive ? "rgba(255,255,255,0.25)" : t.id === "attention" ? "var(--red)" : "var(--bg-card)",
                        color: isActive ? "#fff" : t.id === "attention" ? "#fff" : "var(--ink-3)",
                        borderRadius: 100, padding: "1px 6px",
                        fontSize: 9.5, fontWeight: 800,
                        fontVariantNumeric: "tabular-nums",
                        marginLeft: 2,
                      }}>
                        {t.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <button onClick={() => setShowFilters(p => !p)} className={`action-btn ${showFilters || activeCount > 0 ? "active" : ""}`}>
              <Filter size={11} />
              Filter
              {activeCount > 0 && (
                <span style={{ width: 17, height: 17, borderRadius: "50%", background: showFilters || activeCount > 0 ? "#fff" : "var(--ink)", color: showFilters || activeCount > 0 ? "var(--ink)" : "#fff", fontSize: 9.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {activeCount}
                </span>
              )}
            </button>
          </div>

          {showFilters && <FilterPanel filters={filters} onChange={onChange} onClear={onClear} count={filtered.length} />}
        </div>

        {/* ── Ride list ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "48px 20px" }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: activeView === "attention" ? "linear-gradient(135deg, #DCFCE7, #F0FDF4)" : "var(--bg-soft)",
                margin: "0 auto 14px",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: activeView === "attention" ? "1px solid rgba(22,163,74,.25)" : "none",
              }}>
                {activeView === "attention"
                  ? <CheckCircle2 size={22} color="var(--green)" strokeWidth={2}/>
                  : <Sparkles size={22} color="var(--ink-5)"/>
                }
              </div>
              <div style={{ fontSize: 14, color: "var(--ink)", fontWeight: 700, marginBottom: 4 }}>
                {activeView === "attention"
                  ? "All clear"
                  : "No rides found"}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-4)", fontWeight: 500 }}>
                {activeView === "attention"
                  ? "No rides need your attention right now."
                  : activeCount > 0
                    ? "Try clearing some filters"
                    : "Waiting for new rides…"}
              </div>
            </div>
          ) : (
            filtered.map(({ ride, urgency }, i) => (
              <RideCard key={ride.id} ride={ride} urgency={urgency} index={i} />
            ))
          )}
        </div>
      </div>
    </>
  );
}
