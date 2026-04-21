import { useState, useMemo, useEffect, useRef } from "react";
import {
  Activity, DollarSign, Car, Shield,
  RefreshCw, Filter, Search, X, ChevronDown, TrendingUp,
  MapPin, Clock, Mail, Users, ArrowUpRight, Zap,
  Navigation, CircleDot, CheckCircle2, XCircle, AlertCircle,
  Radio, Gauge, Layers,
} from "lucide-react";

/* ─── Design Tokens ─────────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&family=Bebas+Neue&display=swap');

:root {
  --bg:          #080C10;
  --bg2:         #0D1318;
  --bg3:         #111820;
  --bg4:         #161E28;
  --surface:     #1A2332;
  --surface2:    #1F2A3A;
  --border:      rgba(255,255,255,.06);
  --border2:     rgba(255,255,255,.10);
  --border3:     rgba(255,255,255,.16);

  --ink:         #F0F4F8;
  --ink2:        #B8C4D0;
  --ink3:        #6E8094;
  --ink4:        #3E5068;

  --green:       #00E87A;
  --green2:      #00C466;
  --green-dim:   rgba(0,232,122,.12);
  --green-glow:  rgba(0,232,122,.25);

  --blue:        #3D9BFF;
  --blue-dim:    rgba(61,155,255,.12);

  --amber:       #F59E0B;
  --amber-dim:   rgba(245,158,11,.12);

  --red:         #FF4D4D;
  --red-dim:     rgba(255,77,77,.12);

  --violet:      #A78BFA;
  --violet-dim:  rgba(167,139,250,.12);

  --radius:      16px;
  --radius-sm:   10px;
  --radius-xs:   7px;
  --font:        'DM Sans', sans-serif;
  --mono:        'Space Mono', monospace;
  --display:     'Bebas Neue', sans-serif;
}

.ht * { box-sizing: border-box; margin: 0; padding: 0; }
.ht {
  font-family: var(--font);
  background: var(--bg);
  color: var(--ink);
  min-height: 100vh;
}

/* ── Animations ───────────────────────────────── */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes pulse-ring {
  0%   { transform: scale(.85); opacity: .7; }
  70%  { transform: scale(1.5); opacity: 0; }
  100% { transform: scale(.85); opacity: 0; }
}
@keyframes scanline {
  0%   { transform: translateY(-100%); }
  100% { transform: translateY(400%); }
}
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}

.fade-up { animation: fadeUp .5s cubic-bezier(.22,1,.36,1) both; }
.spin     { animation: spin 1.1s linear infinite; }

/* ── Panel / Card ─────────────────────────────── */
.panel {
  background: var(--bg3);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  position: relative;
}
.panel::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: var(--radius);
  background: linear-gradient(135deg, rgba(255,255,255,.025) 0%, transparent 60%);
  pointer-events: none;
  z-index: 0;
}
.panel > * { position: relative; z-index: 1; }

.panel-hover {
  transition: border-color .2s, transform .2s, box-shadow .2s;
}
.panel-hover:hover {
  border-color: var(--border2);
  transform: translateY(-1px);
  box-shadow: 0 12px 40px rgba(0,0,0,.4), 0 0 0 1px rgba(0,232,122,.04);
}

/* ── Stat pill ─────────────────────────────────── */
.stat-pill {
  background: var(--bg3);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 18px 16px 15px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: relative;
  overflow: hidden;
  transition: border-color .2s, box-shadow .2s;
}
.stat-pill::after {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.06), transparent);
}
.stat-pill:hover {
  border-color: var(--border2);
  box-shadow: 0 4px 24px rgba(0,0,0,.3);
}

/* ── Pill / chip ─────────────────────────────── */
.chip {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 10px; font-weight: 600; letter-spacing: .3px;
  padding: 3px 9px; border-radius: 5px;
  font-family: var(--font);
}
.filter-pill {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 14px; border-radius: 100px;
  border: 1px solid var(--border2);
  background: var(--bg4); font-family: var(--font);
  font-size: 12px; font-weight: 600; color: var(--ink3);
  cursor: pointer; white-space: nowrap;
  transition: all .15s;
}
.filter-pill.active { border-color: var(--green); background: var(--green-dim); color: var(--green); }
.filter-pill:not(.active):hover { border-color: var(--border3); color: var(--ink2); }

/* ── Status dot ───────────────────────────────── */
.live-dot {
  width: 7px; height: 7px; border-radius: 50%;
  flex-shrink: 0; position: relative;
}
.live-dot::after {
  content: '';
  position: absolute;
  inset: -4px; border-radius: 50%;
  border: 1.5px solid currentColor;
  animation: pulse-ring 2s ease-out infinite;
  opacity: 0;
}

/* ── Status badge ─────────────────────────────── */
.status-badge {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 10px; font-weight: 700; padding: 3px 10px;
  border-radius: 100px; letter-spacing: .4px;
  white-space: nowrap; text-transform: uppercase;
}

/* ── Search input ─────────────────────────────── */
.search-wrap {
  display: flex; align-items: center; gap: 9px;
  background: var(--bg4); border: 1px solid var(--border2);
  border-radius: var(--radius-sm); padding: 0 14px; height: 42px;
  transition: border-color .2s, box-shadow .2s;
}
.search-wrap:focus-within {
  border-color: var(--green);
  box-shadow: 0 0 0 3px var(--green-dim);
}
.search-wrap input {
  flex: 1; border: none; outline: none; background: transparent;
  font-family: var(--font); font-size: 13px; color: var(--ink);
}
.search-wrap input::placeholder { color: var(--ink4); }

/* ── Select ─────────────────────────────────── */
.sel-wrap { position: relative; flex: 1; min-width: 120px; }
.sel-wrap select {
  width: 100%; padding: 8px 28px 8px 11px;
  border-radius: 8px; border: 1px solid var(--border2);
  font-size: 11px; font-weight: 600; color: var(--ink3);
  background: var(--bg4); appearance: none; outline: none;
  cursor: pointer; font-family: var(--font);
  transition: border-color .2s;
}
.sel-wrap select:focus { border-color: var(--green); }

/* ── Action btn ──────────────────────────────── */
.action-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 8px 14px; border-radius: var(--radius-sm);
  border: 1px solid var(--border2);
  background: var(--bg4); font-family: var(--font);
  font-size: 12px; font-weight: 600; color: var(--ink3);
  cursor: pointer; transition: all .15s;
}
.action-btn:hover { border-color: var(--border3); color: var(--ink2); background: var(--surface); }
.action-btn.active { border-color: var(--green); background: var(--green-dim); color: var(--green); }

/* ── Route line ─────────────────────────────── */
.route-box {
  background: var(--bg4);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 12px 14px;
  position: relative;
}

/* ── Monospace data ───────────────────────────── */
.mono { font-family: var(--mono); }

/* ── Bar chart ─────────────────────────────────── */
.chart-bar {
  border-radius: 4px 4px 2px 2px;
  transition: all .5s cubic-bezier(.22,1,.36,1);
}

/* ── Scrollbar ───────────────────────────────── */
.ht ::-webkit-scrollbar { width: 4px; }
.ht ::-webkit-scrollbar-track { background: transparent; }
.ht ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 2px; }
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
  searching_driver: { label: "SEARCHING",   accent: "#F59E0B", bg: "rgba(245,158,11,.12)",  border: "rgba(245,158,11,.2)"  },
  driver_assigned:  { label: "ASSIGNED",    accent: "#3D9BFF", bg: "rgba(61,155,255,.12)",  border: "rgba(61,155,255,.2)"  },
  arrived:          { label: "ARRIVED",     accent: "#00E87A", bg: "rgba(0,232,122,.12)",   border: "rgba(0,232,122,.2)"   },
  in_progress:      { label: "IN PROGRESS", accent: "#00E87A", bg: "rgba(0,232,122,.12)",   border: "rgba(0,232,122,.2)"   },
  completed:        { label: "COMPLETED",   accent: "#6E8094", bg: "rgba(110,128,148,.10)", border: "rgba(110,128,148,.18)" },
  cancelled:        { label: "CANCELLED",   accent: "#FF4D4D", bg: "rgba(255,77,77,.12)",   border: "rgba(255,77,77,.2)"   },
};
const PAY_STATUS = {
  succeeded: { bg: "rgba(0,232,122,.12)",  color: "#00E87A", label: "PAID"    },
  pending:   { bg: "rgba(245,158,11,.12)", color: "#F59E0B", label: "PENDING" },
  failed:    { bg: "rgba(255,77,77,.12)",  color: "#FF4D4D", label: "FAILED"  },
};
const PAYOUT = {
  processing: { bg: "rgba(61,155,255,.12)",  color: "#3D9BFF", label: "PROCESSING" },
  pending:    { bg: "rgba(245,158,11,.12)",  color: "#F59E0B", label: "PENDING"    },
  paid:       { bg: "rgba(0,232,122,.12)",   color: "#00E87A", label: "PAID OUT"   },
  failed:     { bg: "rgba(255,77,77,.12)",   color: "#FF4D4D", label: "FAILED"     },
};
const DAYS = ["SUN","MON","TUE","WED","THU","FRI","SAT"];

/* ─── Progress Bar Engine ────────────────────────────────────────── */
function ProgressBar({ pct = 0, color = "#00E87A", label, height = 2 }) {
  return (
    <div style={{ height, background: "rgba(255,255,255,.06)", position: "relative", overflow: "visible" }}>
      <div style={{
        position: "absolute", top: 0, left: 0, bottom: 0,
        width: `${Math.min(Math.max(pct, 0), 100)}%`,
        background: color,
        borderRadius: "0 2px 2px 0",
        boxShadow: `0 0 8px ${color}66`,
        transition: "background .3s",
      }} />
      {label && (
        <div style={{
          position: "absolute", top: "50%",
          left: `${Math.min(Math.max(pct, 4), 86)}%`,
          transform: "translate(-50%, 6px)",
          background: color, color: "#000",
          fontSize: 8, fontWeight: 700,
          padding: "2px 6px", borderRadius: 3,
          whiteSpace: "nowrap", fontFamily: "var(--mono)",
          letterSpacing: ".5px", pointerEvents: "none",
          zIndex: 10, boxShadow: `0 2px 8px ${color}66`,
        }}>{label}</div>
      )}
    </div>
  );
}

function SearchTimerBar({ expiresAt, emailDispatchAt, createdAt }) {
  const [pct, setPct]     = useState(100);
  const [left, setLeft]   = useState(null);
  const raf               = useRef(null);
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
  const c = left === null ? "#6E8094" : left > 300 ? "#F59E0B" : left > 60 ? "#EA580C" : "#FF4D4D";
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
  const c = isLate ? "#FF4D4D" : pct > 80 ? "#EA580C" : "#3D9BFF";
  return <ProgressBar pct={pct} color={c} label={isLate ? `+${fmtMMSS(elapsed - total)}` : etaMin != null ? `~${etaMin}m ETA` : `${fmtMMSS(elapsed)}`} />;
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
  const c = pct > 90 ? "#FF4D4D" : pct > 70 ? "#F59E0B" : "#00E87A";
  return <ProgressBar pct={pct} color={c} label={total > 0 ? (elapsed > total ? `+${fmtMMSS(elapsed - total)}` : `${fmtMMSS(rem)} left`) : `${fmtMMSS(elapsed)}`} />;
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

  const [hov, setHov] = useState(null);
  const h = hov !== null ? buckets[hov] : null;

  return (
    <div className="panel fade-up" style={{ marginBottom: 10, animationDelay: "60ms" }}>
      {/* Header */}
      <div style={{ padding: "18px 20px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--green)", animation: "pulse-ring 2s ease-out infinite", boxShadow: "0 0 0 3px var(--green-dim)" }} />
            <span style={{ fontFamily: "var(--display)", fontSize: 20, letterSpacing: "1px", color: "var(--ink)" }}>THIS WEEK</span>
          </div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink4)", letterSpacing: ".5px" }}>
            {totalRides} COMPLETED RIDES
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "var(--display)", fontSize: 36, color: "var(--green)", letterSpacing: "1px", lineHeight: 1 }}>
            ${totalFare.toFixed(2)}
          </div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink4)", letterSpacing: ".5px", marginTop: 2 }}>TOTAL FARE</div>
        </div>
      </div>

      {/* Chart */}
      <div style={{ padding: "20px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 90 }}>
          {buckets.map((b, i) => {
            const pct = b.isFuture ? 0 : Math.max((b.fare / maxFare) * 100, b.rides > 0 ? 8 : 0);
            const isH = hov === i;
            return (
              <div key={b.label} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}
                style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "default", paddingBottom: 0 }}>
                {!b.isFuture && b.rides > 0 && (
                  <div style={{ fontFamily: "var(--mono)", fontSize: 8, color: b.isToday ? "var(--green)" : "var(--ink4)", letterSpacing: ".3px" }}>
                    ${b.fare.toFixed(0)}
                  </div>
                )}
                {b.isFuture || b.rides === 0 ? <div style={{ flex: 1 }} /> : null}
                <div className="chart-bar" style={{
                  width: "100%",
                  height: b.isFuture ? 3 : `${Math.max(pct, 6)}%`,
                  minHeight: 3,
                  background: b.isFuture
                    ? "var(--bg4)"
                    : b.isToday
                    ? isH ? "linear-gradient(0deg,#00C466,#00E87A,#7FFFD4)" : "linear-gradient(0deg,#00A855,#00E87A)"
                    : isH ? "linear-gradient(0deg,#3E5068,#6E8094)" : "linear-gradient(0deg,#1A2332,#2A3A50)",
                  boxShadow: b.isToday && !b.isFuture ? "0 0 16px rgba(0,232,122,.35)" : "none",
                  border: isH && !b.isFuture ? `1px solid ${b.isToday ? "rgba(0,232,122,.4)" : "var(--border3)"}` : "1px solid transparent",
                }} />
                <div style={{ fontFamily: "var(--mono)", fontSize: 8, letterSpacing: ".8px", color: b.isToday ? "var(--green)" : "var(--ink4)", fontWeight: b.isToday ? 700 : 400 }}>
                  {b.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hover detail */}
      {h && !h.isFuture && (
        <div style={{ margin: "10px 20px 0", padding: "10px 14px", background: "var(--bg4)", border: "1px solid var(--border2)", borderRadius: 10, display: "flex", gap: 20, flexWrap: "wrap" }}>
          {[
            { label: h.label,      val: `${h.rides} ride${h.rides !== 1 ? "s" : ""}`, color: "var(--ink)"  },
            { label: "FARE",       val: `$${h.fare.toFixed(2)}`,                        color: "var(--ink)"  },
            { label: "PLATFORM",   val: `$${h.platform.toFixed(2)}`,                   color: "var(--blue)" },
            { label: "DRIVER",     val: `$${h.payout.toFixed(2)}`,                     color: "var(--green)" },
          ].map(it => (
            <div key={it.label}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 8, color: "var(--ink4)", letterSpacing: ".6px", marginBottom: 3 }}>{it.label}</div>
              <div style={{ fontFamily: "var(--display)", fontSize: 18, color: it.color, letterSpacing: ".5px" }}>{it.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", borderTop: "1px solid var(--border)", marginTop: 16 }}>
        {[
          { label: "TOTAL FARE",    val: `$${totalFare.toFixed(2)}`,     color: "var(--ink)"   },
          { label: "PLATFORM FEE",  val: `$${totalPlatform.toFixed(2)}`, color: "var(--blue)"  },
          { label: "DRIVER PAYOUT", val: `$${totalPayout.toFixed(2)}`,   color: "var(--green)" },
        ].map((it, i) => (
          <div key={it.label} style={{ flex: 1, textAlign: "center", padding: "14px 8px", borderRight: i < 2 ? "1px solid var(--border)" : "none" }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: 8, color: "var(--ink4)", letterSpacing: ".7px", marginBottom: 5 }}>{it.label}</div>
            <div style={{ fontFamily: "var(--display)", fontSize: 20, color: it.color, letterSpacing: ".5px" }}>{it.val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Filter Panel ───────────────────────────────────────────────── */
function FilterPanel({ filters, onChange, onClear, count }) {
  return (
    <div style={{ background: "var(--bg4)", border: "1px solid var(--border2)", borderRadius: 14, padding: "14px", marginBottom: 10, display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="search-wrap">
        <Search size={13} color="var(--ink4)" />
        <input value={filters.search} onChange={e => onChange("search", e.target.value)} placeholder="Search address, city, zip…" />
        {filters.search && (
          <button onClick={() => onChange("search", "")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink4)", display: "flex", padding: 0 }}>
            <X size={13} />
          </button>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[
          { key: "status", opts: [["","All statuses"],["searching_driver","Searching"],["driver_assigned","Assigned"],["arrived","Arrived"],["in_progress","In Progress"],["completed","Completed"],["cancelled","Cancelled"]] },
          { key: "paymentMethod", opts: [["","All payments"],["card","Card"],["cashapp","Cash App"]] },
          { key: "paymentStatus", opts: [["","Pay status"],["succeeded","Paid"],["pending","Pending"],["failed","Failed"]] },
          { key: "payoutStatus",  opts: [["","Payout status"],["processing","Processing"],["pending","Pending"],["paid","Paid"],["failed","Failed"]] },
        ].map(({ key, opts }) => (
          <div className="sel-wrap" key={key}>
            <select value={filters[key]} onChange={e => onChange(key, e.target.value)}>
              {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <ChevronDown size={10} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: "var(--ink4)", pointerEvents: "none" }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink4)", letterSpacing: ".4px" }}>{count} RIDE{count !== 1 ? "S" : ""} FOUND</span>
        <button onClick={onClear} style={{ fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, color: "var(--red)", background: "none", border: "none", cursor: "pointer", letterSpacing: ".4px" }}>CLEAR ALL</button>
      </div>
    </div>
  );
}

/* ─── Driver Search Banner ───────────────────────────────────────── */
function SearchBanner({ driverInfo, candidates = [], emailed = {} }) {
  if (!driverInfo && candidates.length === 0) return null;
  return (
    <div style={{ marginBottom: 12, padding: "10px 13px", background: "rgba(245,158,11,.06)", border: "1px solid rgba(245,158,11,.2)", borderRadius: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#F59E0B", flexShrink: 0, boxShadow: "0 0 8px rgba(245,158,11,.6)" }} />
        <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "#F59E0B", letterSpacing: ".5px" }}>SEARCHING</span>
        <span className="chip" style={{ background: "rgba(245,158,11,.12)", color: "#F59E0B" }}>
          <Users size={8} /> {candidates.length} candidate{candidates.length !== 1 ? "s" : ""}
        </span>
        <span className="chip" style={{ background: Object.keys(emailed).length > 0 ? "rgba(0,232,122,.12)" : "rgba(110,128,148,.10)", color: Object.keys(emailed).length > 0 ? "#00E87A" : "var(--ink4)" }}>
          <Mail size={8} /> {Object.keys(emailed).length} emailed
        </span>
        {driverInfo?.nearestMiles != null && (
          <span className="chip" style={{ background: "rgba(245,158,11,.08)", color: "var(--ink3)" }}>
            <Navigation size={8} /> {driverInfo.nearestMiles.toFixed(1)} mi nearest
          </span>
        )}
        {driverInfo?.etaLabel && (
          <span className="chip" style={{ background: "rgba(245,158,11,.08)", color: "var(--ink3)" }}>
            <Clock size={8} /> {driverInfo.etaLabel}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Ride Card ──────────────────────────────────────────────────── */
function RideCard({ ride, index }) {
  const riderLabel  = ride.riderName  ?? `Rider ···${ride.uid?.slice(-4) ?? "?"}`;
  const driverLabel = ride.driverName ?? (ride.driverUid ? `Driver ···${ride.driverUid.slice(-4)}` : null);

  const s  = STATUS[ride.status]          ?? { label: ride.status ?? "UNKNOWN", accent: "#6E8094", bg: "rgba(110,128,148,.10)", border: "rgba(110,128,148,.2)" };
  const pm = PAY_STATUS[ride.paymentStatus] ?? { bg: "rgba(110,128,148,.10)", color: "var(--ink4)", label: ride.paymentStatus ?? "—" };
  const po = PAYOUT[ride.payoutStatus]    ?? { bg: "rgba(110,128,148,.10)", color: "var(--ink4)", label: ride.payoutStatus ?? "—" };

  function StatusBar() {
    switch (ride.status) {
      case "searching_driver": return <SearchTimerBar expiresAt={ride.expiresAt} emailDispatchAt={ride.emailDispatchAt} createdAt={ride.createdAt} />;
      case "driver_assigned":  return <AssignedBar acceptedAt={ride.acceptedAt} etaMin={ride.driverInfo?.etaMin} />;
      case "arrived":          return <ProgressBar pct={100} color="#00E87A" label="ARRIVED" />;
      case "in_progress":      return <TripBar startedAt={ride.startedAt} tripDurationMin={ride.tripDurationMin} />;
      case "completed":        return <div style={{ height: 2, background: "rgba(110,128,148,.15)" }} />;
      case "cancelled":        return <div style={{ height: 2, background: "linear-gradient(90deg,#FF4D4D,#FF4D4D44)" }} />;
      default:                 return <div style={{ height: 2, background: "var(--border)" }} />;
    }
  }

  return (
    <div className="panel panel-hover fade-up" style={{ animationDelay: `${200 + index * 50}ms`, padding: 0 }}>
      <StatusBar />
      <div style={{ padding: "14px 16px 14px" }}>

        {/* ── Top row ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 13, gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            {/* Avatar */}
            <div style={{
              width: 40, height: 40, borderRadius: 11, flexShrink: 0,
              background: "var(--green-dim)", border: "1px solid var(--green-glow)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--display)", fontSize: 16, color: "var(--green)", letterSpacing: ".5px",
            }}>
              {initials(riderLabel)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{riderLabel}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                {driverLabel
                  ? <><Car size={10} color="var(--ink4)" /><span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink4)", letterSpacing: ".3px" }}>{driverLabel}</span></>
                  : <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink4)", letterSpacing: ".3px" }}>NO DRIVER YET</span>
                }
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              fontSize: 9, fontWeight: 700, letterSpacing: ".5px",
              padding: "3px 9px", borderRadius: 100,
              background: s.bg, color: s.accent,
              border: `1px solid ${s.border}`,
              fontFamily: "var(--mono)",
            }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.accent, boxShadow: `0 0 6px ${s.accent}` }} />
              {s.label}
            </div>
            <div style={{ fontFamily: "var(--display)", fontSize: 26, color: "var(--ink)", letterSpacing: ".5px", lineHeight: 1 }}>
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
        <div className="route-box" style={{ marginBottom: 11 }}>
          {/* Vertical connector line */}
          <div style={{ position: "absolute", left: 21, top: 22, bottom: 22, width: 1, background: "linear-gradient(180deg,#00E87A,#FF4D4D)", opacity: .4 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { dot: "#00E87A", lbl: "PICKUP",  addr: shortAddr(ride.pickup),  city: ride.pickupCity,  zip: ride.pickupZip  },
              { dot: "#FF4D4D", lbl: "DROPOFF", addr: shortAddr(ride.dropoff), city: ride.dropoffCity, zip: ride.dropoffZip },
            ].map(({ dot, lbl, addr, city, zip }) => (
              <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0, border: "2px solid var(--bg4)", zIndex: 1, boxShadow: `0 0 8px ${dot}66` }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 8, color: "var(--ink4)", letterSpacing: ".7px", marginBottom: 2 }}>{lbl}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {addr}
                    {city && <span style={{ color: "var(--ink4)", fontWeight: 400 }}> · {city}{zip ? ` ${zip}` : ""}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Meta chips ── */}
        <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
          {[
            ride.rideLabel ?? ride.rideType,
            ride.tripDistanceMiles != null ? `${ride.tripDistanceMiles} MI` : null,
            ride.tripDurationMin != null ? `~${ride.tripDurationMin} MIN` : null,
            `${timeAgo(ride.createdAt)} AGO`,
          ].filter(Boolean).map(l => (
            <span key={l} className="chip mono" style={{ background: "var(--bg4)", color: "var(--ink3)", border: "1px solid var(--border)", fontSize: 9, letterSpacing: ".5px" }}>{l}</span>
          ))}
        </div>

        {/* ── Footer ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 11, borderTop: "1px solid var(--border)", flexWrap: "wrap", gap: 6 }}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <span className="chip" style={{
              background: ride.paymentMethod === "cashapp" ? "rgba(0,232,122,.10)" : "rgba(61,155,255,.10)",
              color: ride.paymentMethod === "cashapp" ? "#00E87A" : "#3D9BFF",
            }}>
              {ride.paymentMethod === "cashapp" ? "CASH APP" : (ride.paymentMethod ?? "CARD").toUpperCase()}
            </span>
            <span className="chip" style={{ background: pm.bg, color: pm.color }}>{pm.label}</span>
            <span className="chip" style={{ background: po.bg, color: po.color }}>{po.label}</span>
          </div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink4)", letterSpacing: ".3px" }}>
            <span style={{ color: "var(--green)", fontWeight: 700 }}>${ride.driverPayout?.toFixed(2) ?? "—"}</span>
            <span style={{ color: "var(--ink4)" }}> DRV · </span>
            <span style={{ color: "var(--blue)", fontWeight: 700 }}>${ride.platformFee?.toFixed(2) ?? "—"}</span>
            <span style={{ color: "var(--ink4)" }}> FEE</span>
          </div>
        </div>

        {/* ID */}
        <div style={{ marginTop: 9, fontFamily: "var(--mono)", fontSize: 8, color: "var(--ink4)", letterSpacing: ".5px", opacity: .6 }}>
          {ride.id}
        </div>
      </div>
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

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); onToast?.("Data refreshed"); }, 1100);
  };
  const onChange    = (k, v) => setFilters(p => ({ ...p, [k]: v }));
  const onClear     = () => setFilters(DEFAULT_FILTERS);
  const activeCount = Object.values(filters).filter(Boolean).length;

  const filtered = useMemo(() => liveRides.filter(ride => {
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
  }), [liveRides, filters]);

  const statRows = [
    { label: "TOTAL RIDES",    val: totalRides ?? liveRides.length, accent: "#3D9BFF",  Icon: Activity,  delay: 0   },
    { label: "ACTIVE DRIVERS", val: activeDrivers.length,           accent: "#00E87A",  Icon: Car,       delay: 50  },
    { label: "REVENUE TODAY",  val: revenue != null ? `$${revenue.toFixed(2)}` : "—", accent: "#F59E0B", Icon: DollarSign, delay: 100 },
    { label: "PENDING APPROV", val: allApprovals.length,            accent: "#FF4D4D",  Icon: Shield,    delay: 150 },
  ];

  return (
    <>
      <style>{CSS}</style>
      <div className="ht" style={{ padding: "0 14px 32px" }}>

        {/* ── Command bar ── */}
        <div className="panel fade-up" style={{ padding: "13px 16px", marginBottom: 10, animationDelay: "0ms" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ display: "flex", gap: 0, overflowX: "auto" }}>
              {[
                { val: totalAccounts,          sub: "ACCOUNTS", dot: "#00E87A" },
                { val: uatobdrivers.length,    sub: "DRIVERS",  dot: "#3D9BFF" },
                { val: activeRides.length,     sub: "ACTIVE",   dot: "#00E87A" },
                { val: searchingRides.length,  sub: "SRCHING",  dot: "#F59E0B" },
              ].map(({ val, sub, dot }, i) => (
                <div key={sub} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "5px 14px",
                  borderRight: i < 3 ? "1px solid var(--border)" : "none",
                  flexShrink: 0,
                }}>
                  <div className="live-dot" style={{ background: dot, color: dot }} />
                  <span style={{ fontFamily: "var(--display)", fontSize: 18, color: "var(--ink)", letterSpacing: ".5px" }}>{val}</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink4)", letterSpacing: ".5px" }}>{sub}</span>
                </div>
              ))}
            </div>
            <button onClick={handleRefresh} style={{
              width: 34, height: 34, borderRadius: 9,
              border: "1px solid var(--border2)", background: "var(--bg4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "var(--ink3)", flexShrink: 0,
              transition: "all .15s",
            }}>
              <RefreshCw size={13} className={refreshing ? "spin" : ""} />
            </button>
          </div>
        </div>

        {/* ── Stat pills ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
          {statRows.map(({ label, val, accent, Icon, delay }) => (
            <div key={label} className="stat-pill fade-up" style={{ animationDelay: `${delay}ms` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: `${accent}15`, border: `1px solid ${accent}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={13} color={accent} />
                </div>
                <ArrowUpRight size={11} color="var(--ink4)" />
              </div>
              <div style={{ fontFamily: "var(--display)", fontSize: 28, color: "var(--ink)", letterSpacing: ".5px", lineHeight: 1 }}>{val}</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink4)", letterSpacing: ".6px" }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── Weekly chart ── */}
        <WeekChart allRides={allRides.length > 0 ? allRides : liveRides} />

        {/* ── Rides header ── */}
        <div className="fade-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, animationDelay: "180ms" }}>
          <div>
            <div style={{ fontFamily: "var(--display)", fontSize: 22, color: "var(--ink)", letterSpacing: "1px" }}>LIVE RIDES</div>
            {liveRides.length > 0 && (
              <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink4)", letterSpacing: ".4px", marginTop: 2 }}>
                {filtered.length} / {liveRides.length} SHOWN
              </div>
            )}
          </div>
          <button onClick={() => setShowFilters(p => !p)} className={`action-btn ${showFilters || activeCount > 0 ? "active" : ""}`}>
            <Filter size={11} />
            FILTER
            {activeCount > 0 && (
              <span style={{ width: 17, height: 17, borderRadius: "50%", background: "var(--green)", color: "#000", fontSize: 9, fontWeight: 800, fontFamily: "var(--mono)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {activeCount}
              </span>
            )}
          </button>
        </div>

        {showFilters && <FilterPanel filters={filters} onChange={onChange} onClear={onClear} count={filtered.length} />}

        {/* ── Ride list ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "48px 0", color: "var(--ink4)" }}>
              <div style={{ fontFamily: "var(--display)", fontSize: 40, letterSpacing: "3px", marginBottom: 8, opacity: .3 }}>NO RIDES</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".5px" }}>
                {activeCount > 0 ? "NO RIDES MATCH YOUR FILTERS" : "WAITING FOR RIDES…"}
              </div>
            </div>
          )}
          {filtered.map((ride, i) => <RideCard key={ride.id} ride={ride} index={i} />)}
        </div>
      </div>
    </>
  );
}
