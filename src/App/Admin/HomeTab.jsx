import { useState, useMemo, useEffect, useRef } from "react";
import {
  Activity, DollarSign, Car, Shield,
  RefreshCw, Filter, Search, X, ChevronDown, TrendingUp,
  MapPin, Clock, Mail, Users, ArrowUpRight, Zap,
} from "lucide-react";
import { C } from '@/App/Admin/Tokens';
import { StatCard, Avatar } from '@/App/Admin/UI';

/* ─── Google Fonts + Global Styles ─────────────────────────────── */
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800;900&family=Syne:wght@700;800&display=swap');

:root {
  --ink: #0F1117;
  --ink2: #374151;
  --muted: #6B7280;
  --dim: #9CA3AF;
  --border: #E5E7EB;
  --border2: #F3F4F6;
  --surf: #FFFFFF;
  --surf2: #F9FAFB;
  --surf3: #F3F4F6;
  --green: #16A34A;
  --green-bg: #DCFCE7;
  --green-mid: #4ADE80;
  --amber: #D97706;
  --amber-bg: #FEF3C7;
  --blue: #2563EB;
  --blue-bg: #EFF6FF;
  --red: #DC2626;
  --red-bg: #FEF2F2;
  --radius-card: 20px;
  --radius-sm: 10px;
  --shadow-card: 0 1px 3px rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.05);
  --shadow-hover: 0 2px 8px rgba(0,0,0,.08), 0 8px 32px rgba(0,0,0,.08);
  --font: 'Figtree', sans-serif;
  --font-display: 'Syne', sans-serif;
}

.ht-root * { box-sizing: border-box; margin: 0; padding: 0; }
.ht-root { font-family: var(--font); color: var(--ink); }

/* Fade-up animation */
@keyframes htFadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
.ht-fade { animation: htFadeUp .45s cubic-bezier(.22,1,.36,1) both; }

/* Spin */
@keyframes htSpin { to { transform: rotate(360deg); } }
.ht-spin { animation: htSpin 1s linear infinite; }

/* Pulse dot */
@keyframes htPulse {
  0%,100% { box-shadow: 0 0 0 0 currentColor; }
  50%      { box-shadow: 0 0 0 5px transparent; }
}

/* Card base */
.ht-card {
  background: var(--surf);
  border: 1.5px solid var(--border2);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  overflow: hidden;
  transition: box-shadow .2s, border-color .2s, transform .2s;
}
.ht-card:hover { box-shadow: var(--shadow-hover); }

/* Ride card hover lift */
.ht-ride-card { cursor: default; }
.ht-ride-card:hover { transform: translateY(-2px); border-color: var(--border); }

/* Stat pill */
.ht-stat-pill {
  background: var(--surf2);
  border: 1.5px solid var(--border2);
  border-radius: 14px;
  padding: 14px 16px;
  display: flex; flex-direction: column; gap: 6px;
  transition: border-color .2s, box-shadow .2s;
}
.ht-stat-pill:hover { border-color: var(--border); box-shadow: 0 2px 12px rgba(0,0,0,.06); }

/* Filter pill */
.ht-pill {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 13px; border-radius: 100px;
  border: 1.5px solid var(--border);
  background: var(--surf); font-family: var(--font);
  font-size: 12px; font-weight: 700; color: var(--muted);
  cursor: pointer; white-space: nowrap;
  transition: all .15s;
}
.ht-pill.active { border-color: var(--green); background: var(--green-bg); color: var(--green); }
.ht-pill:not(.active):hover { border-color: #D1D5DB; color: var(--ink2); }

/* Tag chip */
.ht-tag {
  display: inline-flex; align-items: center;
  font-size: 10px; font-weight: 700;
  padding: 3px 9px; border-radius: 6px;
  letter-spacing: .2px;
}

/* Search input */
.ht-search-wrap {
  display: flex; align-items: center; gap: 9px;
  background: var(--surf); border: 1.5px solid var(--border);
  border-radius: 12px; padding: 0 14px; height: 42px;
  transition: border-color .2s, box-shadow .2s;
}
.ht-search-wrap:focus-within {
  border-color: var(--green);
  box-shadow: 0 0 0 3px rgba(22,163,74,.08);
}
.ht-search-wrap input {
  flex: 1; border: none; outline: none; background: transparent;
  font-family: var(--font); font-size: 13px; color: var(--ink);
}
.ht-search-wrap input::placeholder { color: var(--dim); }

/* Select */
.ht-select-wrap { position: relative; flex: 1; min-width: 120px; }
.ht-select-wrap select {
  width: 100%; padding: 8px 28px 8px 11px;
  border-radius: 10px; border: 1.5px solid var(--border);
  font-size: 11px; font-weight: 600; color: var(--muted);
  background: var(--surf2); appearance: none; outline: none;
  cursor: pointer; font-family: var(--font);
  transition: border-color .2s;
}
.ht-select-wrap select:focus { border-color: var(--green); }

/* Route line */
.ht-route-line {
  background: var(--surf2); border: 1.5px solid var(--border2);
  border-radius: 14px; padding: 12px 14px;
  position: relative;
}

/* Status badge */
.ht-status {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 10px; font-weight: 700; padding: 4px 10px;
  border-radius: 100px; letter-spacing: .3px;
  white-space: nowrap;
}

/* Bar chart bar */
.ht-bar {
  border-radius: 6px 6px 3px 3px;
  transition: height .5s cubic-bezier(.22,1,.36,1), background .15s;
}

/* Action btn */
.ht-btn {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 14px; border-radius: 10px; border: 1.5px solid var(--border);
  background: var(--surf); font-family: var(--font);
  font-size: 12px; font-weight: 700; color: var(--muted);
  cursor: pointer; transition: all .15s;
}
.ht-btn:hover { border-color: #D1D5DB; color: var(--ink2); background: var(--surf2); }
.ht-btn.active { border-color: var(--green); background: var(--green-bg); color: var(--green); }
`;

/* ─── Helpers ───────────────────────────────────────────────────── */
function timeAgo(ts) {
  if (!ts) return "—";
  const seconds = ts?.seconds ?? Math.floor(ts / 1000);
  const diff = Math.floor(Date.now() / 1000) - seconds;
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}
function shortAddress(addr = "") { return addr.split(",")[0] || addr; }
function tsToMs(ts) {
  if (!ts) return 0;
  if (ts?.seconds) return ts.seconds * 1000;
  if (typeof ts === "number") return ts;
  return 0;
}
function fmtMMSS(totalSecs) {
  const abs = Math.abs(Math.round(totalSecs));
  return `${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}`;
}

/* ─── Status maps ───────────────────────────────────────────────── */
const STATUS_META = {
  searching_driver: { label: "Searching",     dot: "#D97706", bg: "#FEF3C7", color: "#92400E",  bar: ["#D97706","#F59E0B"] },
  driver_assigned:  { label: "Assigned",      dot: "#2563EB", bg: "#EFF6FF", color: "#1E40AF",  bar: ["#2563EB","#60A5FA"] },
  arrived:          { label: "Arrived",       dot: "#16A34A", bg: "#DCFCE7", color: "#14532D",  bar: ["#16A34A","#4ADE80"] },
  in_progress:      { label: "In Progress",   dot: "#16A34A", bg: "#DCFCE7", color: "#14532D",  bar: ["#16A34A","#4ADE80"] },
  completed:        { label: "Completed",     dot: "#6B7280", bg: "#F3F4F6", color: "#374151",  bar: ["#9CA3AF","#D1D5DB"] },
  cancelled:        { label: "Cancelled",     dot: "#DC2626", bg: "#FEF2F2", color: "#991B1B",  bar: ["#DC2626","#F87171"] },
};
const PAYMENT_META = {
  succeeded: { bg: "#DCFCE7", color: "#14532D", label: "Paid" },
  pending:   { bg: "#FEF3C7", color: "#92400E", label: "Pending" },
  failed:    { bg: "#FEF2F2", color: "#991B1B", label: "Failed" },
};
const PAYOUT_META = {
  processing: { bg: "#EFF6FF", color: "#1E40AF", label: "Processing" },
  pending:    { bg: "#FEF3C7", color: "#92400E", label: "Payout Pending" },
  paid:       { bg: "#DCFCE7", color: "#14532D", label: "Paid Out" },
  failed:     { bg: "#FEF2F2", color: "#991B1B", label: "Payout Failed" },
};
const DAY_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

/* ─── Live Timer Bars ───────────────────────────────────────────── */
function SearchTimerBar({ expiresAt, emailDispatchAt, createdAt }) {
  const [pct, setPct]           = useState(100);
  const [secsLeft, setSecsLeft] = useState(null);
  const rafRef                  = useRef(null);

  useEffect(() => {
    const expiresMs = tsToMs(expiresAt);
    if (!expiresMs) return;
    const startMs = tsToMs(emailDispatchAt) || tsToMs(createdAt) || (expiresMs - 25 * 60 * 1000);
    const totalMs = expiresMs - startMs;
    const tick = () => {
      const now       = Date.now();
      const remaining = Math.max((expiresMs - now) / 1000, 0);
      const elapsed   = Math.max((now - startMs) / 1000, 0);
      const percent   = Math.max(((totalMs / 1000 - elapsed) / (totalMs / 1000)) * 100, 0);
      setPct(percent); setSecsLeft(Math.ceil(remaining));
      if (remaining > 0) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [expiresAt, emailDispatchAt, createdAt]);

  if (secsLeft === null) return <BarTrack />;
  const color = pct > 50 ? "#D97706" : pct > 20 ? "#EA580C" : "#DC2626";
  return (
    <BarTrack color={color} pct={pct}
      label={secsLeft > 0 ? fmtMMSS(secsLeft) : "EXPIRED"}
      labelColor={color} />
  );
}

function DriverAssignedBar({ acceptedAt, etaMin }) {
  const [elapsed, setElapsed] = useState(0);
  const rafRef = useRef(null);
  useEffect(() => {
    const ms = tsToMs(acceptedAt);
    if (!ms) return;
    const tick = () => { setElapsed(Math.floor((Date.now() - ms) / 1000)); rafRef.current = requestAnimationFrame(tick); };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [acceptedAt]);
  const total = (etaMin ?? 0) * 60;
  const pct   = total > 0 ? Math.min((elapsed / total) * 100, 100) : 0;
  const isLate= total > 0 && elapsed > total;
  const color = isLate ? "#DC2626" : pct > 80 ? "#EA580C" : "#2563EB";
  const label = isLate ? `+${fmtMMSS(elapsed - total)} late` : etaMin != null ? `~${etaMin} min ETA` : `${fmtMMSS(elapsed)}`;
  return <BarTrack color={color} pct={pct} label={label} labelColor={color} />;
}

function ArrivedBar() {
  return <BarTrack color="#16A34A" pct={100} label="DRIVER ARRIVED" labelColor="#16A34A" />;
}

function InProgressBar({ startedAt, tripDurationMin }) {
  const [elapsed, setElapsed] = useState(0);
  const rafRef = useRef(null);
  useEffect(() => {
    const ms = tsToMs(startedAt);
    if (!ms) return;
    const tick = () => { setElapsed(Math.floor((Date.now() - ms) / 1000)); rafRef.current = requestAnimationFrame(tick); };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [startedAt]);
  const total     = (tripDurationMin ?? 0) * 60;
  const pct       = total > 0 ? Math.min((elapsed / total) * 100, 100) : 0;
  const isOver    = total > 0 && elapsed > total;
  const remaining = Math.max(total - elapsed, 0);
  const color     = isOver ? "#DC2626" : pct > 80 ? "#D97706" : "#16A34A";
  const label     = isOver ? `+${fmtMMSS(elapsed - total)} over` : `${fmtMMSS(remaining)} left`;
  return <BarTrack color={color} pct={pct} label={label} labelColor={color} />;
}

function BarTrack({ color = "#E5E7EB", pct = 0, label, labelColor }) {
  return (
    <div style={{ height: 3, background: "#F3F4F6", position: "relative", overflow: "visible" }}>
      <div style={{
        position: "absolute", top: 0, left: 0, bottom: 0,
        width: `${pct}%`, borderRadius: "0 2px 2px 0",
        background: color, transition: "background .4s",
      }} />
      {label && (
        <div style={{
          position: "absolute", top: "50%", left: `${Math.min(Math.max(pct, 4), 88)}%`,
          transform: "translate(-50%, 7px)",
          background: labelColor ?? color, color: "#fff",
          fontSize: 8, fontWeight: 800, padding: "1px 6px",
          borderRadius: 4, whiteSpace: "nowrap",
          fontFamily: "monospace", letterSpacing: ".5px",
          boxShadow: "0 1px 4px rgba(0,0,0,.18)", zIndex: 2,
          pointerEvents: "none",
        }}>{label}</div>
      )}
    </div>
  );
}

/* ─── Driver Info Banner ────────────────────────────────────────── */
function DriverInfoBanner({ driverInfo, candidateDriverUids = [], emailSentToDrivers = {} }) {
  if (!driverInfo) return null;
  const { etaLabel, nearestMiles, stale } = driverInfo;
  const candidateCount = candidateDriverUids.length;
  const emailedCount   = Object.keys(emailSentToDrivers).length;
  return (
    <div style={{
      margin: "0 0 12px", padding: "10px 14px",
      background: stale ? "#FFFBEB" : "#FEFCE8",
      border: `1.5px solid ${stale ? "#FDE68A" : "#FEF08A"}`,
      borderRadius: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: (nearestMiles != null || etaLabel) ? 8 : 0 }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#D97706", flexShrink: 0,
          boxShadow: "0 0 0 3px #FDE68A" }} />
        {stale && <span style={{ fontSize: 9, fontWeight: 800, padding: "1px 6px", background: "#D97706", color: "#fff", borderRadius: 4 }}>STALE</span>}
        <span className="ht-tag" style={{ background: "#FEF3C7", color: "#92400E" }}>
          <Users size={9} style={{ marginRight: 4 }} />{candidateCount} candidate{candidateCount !== 1 ? "s" : ""}
        </span>
        <span className="ht-tag" style={{ background: emailedCount > 0 ? "#DCFCE7" : "#F3F4F6", color: emailedCount > 0 ? "#14532D" : "#9CA3AF" }}>
          <Mail size={9} style={{ marginRight: 4 }} />{emailedCount} emailed
        </span>
      </div>
      {(nearestMiles != null || etaLabel) && (
        <div style={{ display: "flex", gap: 14, paddingTop: 7, borderTop: "1px solid #FDE68A66" }}>
          {nearestMiles != null && (
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <MapPin size={11} color="#D97706" />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#92400E", fontFamily: "monospace" }}>{nearestMiles.toFixed(1)} mi nearest</span>
            </div>
          )}
          {etaLabel && (
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Clock size={11} color="#D97706" />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#92400E" }}>{etaLabel}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Weekly Summary ────────────────────────────────────────────── */
function WeeklySummary({ allRides = [] }) {
  const now     = new Date();
  const dayOfWk = now.getDay();
  const sunday  = new Date(now);
  sunday.setHours(0, 0, 0, 0);
  sunday.setDate(now.getDate() - dayOfWk);

  const buckets = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return {
      label: DAY_LABELS[d.getDay()], dateStr: d.toDateString(),
      isToday: d.toDateString() === now.toDateString(),
      isFuture: d > now,
      rides: 0, fareTotal: 0, platformFee: 0, driverPayout: 0,
    };
  });

  allRides.filter(r => r.status === "completed").forEach(r => {
    const ms = tsToMs(r.completedAt ?? r.updatedAt ?? r.createdAt);
    if (!ms) return;
    const d = new Date(ms); d.setHours(0, 0, 0, 0);
    const idx = buckets.findIndex(b => b.dateStr === d.toDateString());
    if (idx === -1) return;
    buckets[idx].rides        += 1;
    buckets[idx].fareTotal    += Number(r.fareTotal    ?? 0);
    buckets[idx].platformFee  += Number(r.platformFee  ?? 0);
    buckets[idx].driverPayout += Number(r.driverPayout ?? 0);
  });

  const totalRides        = buckets.reduce((s, b) => s + b.rides,        0);
  const totalFare         = buckets.reduce((s, b) => s + b.fareTotal,    0);
  const totalPlatformFee  = buckets.reduce((s, b) => s + b.platformFee,  0);
  const totalDriverPayout = buckets.reduce((s, b) => s + b.driverPayout, 0);
  const maxFare           = Math.max(...buckets.map(b => b.fareTotal), 1);

  const [hoveredIdx, setHoveredIdx] = useState(null);
  const hovered = hoveredIdx !== null ? buckets[hoveredIdx] : null;

  return (
    <div className="ht-card ht-fade" style={{ marginBottom: 14, animationDelay: "60ms" }}>
      {/* Header */}
      <div style={{ padding: "16px 20px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--green-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TrendingUp size={13} color="var(--green)" />
            </div>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 800, color: "var(--ink)" }}>This Week</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--dim)", fontWeight: 600, paddingLeft: 35 }}>
            {totalRides} completed ride{totalRides !== 1 ? "s" : ""}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 800, color: "var(--ink)", letterSpacing: "-1px", lineHeight: 1 }}>
            ${totalFare.toFixed(2)}
          </div>
          <div style={{ fontSize: 10, color: "var(--dim)", fontWeight: 600, marginTop: 2 }}>total fare</div>
        </div>
      </div>

      {/* Chart */}
      <div style={{ padding: "0 20px 14px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 80 }}>
          {buckets.map((b, i) => {
            const pct   = b.isFuture ? 0 : Math.max((b.fareTotal / maxFare) * 100, b.rides > 0 ? 10 : 0);
            const isHov = hoveredIdx === i;
            return (
              <div key={b.label}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: "default" }}
              >
                {!b.isFuture && b.rides > 0
                  ? <div style={{ fontSize: 9, fontWeight: 700, color: b.isToday ? "var(--green)" : "var(--dim)" }}>${b.fareTotal.toFixed(0)}</div>
                  : <div style={{ flex: 1 }} />
                }
                <div className="ht-bar" style={{
                  width: "100%",
                  height: b.isFuture ? 5 : `${Math.max(pct, 8)}%`,
                  background: b.isFuture ? "var(--border2)"
                    : b.isToday ? (isHov ? "linear-gradient(180deg,#22C55E,#16A34A)" : "linear-gradient(180deg,#16A34A,#15803D)")
                    : isHov ? "linear-gradient(180deg,#6B7280,#374151)"
                    : "linear-gradient(180deg,#D1D5DB,#E5E7EB)",
                  opacity: b.isFuture ? 0.35 : 1,
                  boxShadow: b.isToday && !b.isFuture ? "0 0 12px rgba(22,163,74,.3)" : "none",
                  border: `1.5px solid ${b.isToday && !b.isFuture ? "rgba(22,163,74,.2)" : "transparent"}`,
                  minHeight: 5,
                }} />
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".5px", color: b.isToday ? "var(--green)" : "var(--dim)" }}>
                  {b.label.toUpperCase()}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hover detail */}
      {hovered && !hovered.isFuture && (
        <div style={{ margin: "0 20px 14px", padding: "11px 14px", background: "var(--surf2)", border: "1.5px solid var(--border2)", borderRadius: 12, display: "flex", gap: 18, flexWrap: "wrap" }}>
          {[
            { label: hovered.label,  val: `${hovered.rides} ride${hovered.rides !== 1 ? "s" : ""}`, color: "var(--ink)" },
            { label: "Fare",         val: `$${hovered.fareTotal.toFixed(2)}`,                        color: "var(--ink)" },
            { label: "Platform",     val: `$${hovered.platformFee.toFixed(2)}`,                      color: "var(--blue)" },
            { label: "Driver",       val: `$${hovered.driverPayout.toFixed(2)}`,                     color: "var(--green)" },
          ].map(item => (
            <div key={item.label}>
              <div style={{ fontSize: 9, color: "var(--dim)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 2 }}>{item.label}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: item.color }}>{item.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Footer totals */}
      <div style={{ display: "flex", borderTop: "1.5px solid var(--border2)" }}>
        {[
          { label: "Total Fare",     val: `$${totalFare.toFixed(2)}`,         color: "var(--ink)" },
          { label: "Platform Fee",   val: `$${totalPlatformFee.toFixed(2)}`,  color: "var(--blue)" },
          { label: "Driver Payout",  val: `$${totalDriverPayout.toFixed(2)}`, color: "var(--green)" },
        ].map((item, i) => (
          <div key={item.label} style={{
            flex: 1, textAlign: "center", padding: "12px 8px",
            borderRight: i < 2 ? "1.5px solid var(--border2)" : "none",
          }}>
            <div style={{ fontSize: 9, color: "var(--dim)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".6px", marginBottom: 3 }}>{item.label}</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 800, color: item.color }}>{item.val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Filter Panel ──────────────────────────────────────────────── */
function FilterPanel({ filters, onChange, onClear, resultCount }) {
  return (
    <div style={{ background: "var(--surf2)", border: "1.5px solid var(--border2)", borderRadius: 16, padding: "14px 16px", marginBottom: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <div className="ht-search-wrap">
        <Search size={13} color="var(--dim)" />
        <input
          value={filters.search}
          onChange={e => onChange("search", e.target.value)}
          placeholder="Search address, city, zip…"
        />
        {filters.search && (
          <button onClick={() => onChange("search", "")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--dim)", display: "flex", padding: 0 }}>
            <X size={13} />
          </button>
        )}
      </div>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
        <FilterSelect value={filters.status}        onChange={v => onChange("status", v)}
          options={[{ value: "", label: "All statuses" }, { value: "searching_driver", label: "Searching" }, { value: "driver_assigned", label: "Assigned" }, { value: "arrived", label: "Arrived" }, { value: "in_progress", label: "In Progress" }, { value: "completed", label: "Completed" }, { value: "cancelled", label: "Cancelled" }]} />
        <FilterSelect value={filters.paymentMethod} onChange={v => onChange("paymentMethod", v)}
          options={[{ value: "", label: "All payments" }, { value: "card", label: "Card" }, { value: "cashapp", label: "Cash App" }]} />
        <FilterSelect value={filters.paymentStatus} onChange={v => onChange("paymentStatus", v)}
          options={[{ value: "", label: "Payment status" }, { value: "succeeded", label: "Succeeded" }, { value: "pending", label: "Pending" }, { value: "failed", label: "Failed" }]} />
        <FilterSelect value={filters.payoutStatus}  onChange={v => onChange("payoutStatus", v)}
          options={[{ value: "", label: "Payout status" }, { value: "processing", label: "Processing" }, { value: "pending", label: "Pending" }, { value: "paid", label: "Paid" }, { value: "failed", label: "Failed" }]} />
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "var(--dim)", fontWeight: 600 }}>{resultCount} ride{resultCount !== 1 ? "s" : ""} found</span>
        <button onClick={onClear} style={{ fontSize: 11, fontWeight: 700, color: "var(--red)", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "var(--font)" }}>Clear all</button>
      </div>
    </div>
  );
}

function FilterSelect({ value, onChange, options }) {
  return (
    <div className="ht-select-wrap">
      <select value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={11} style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", color: "var(--dim)", pointerEvents: "none" }} />
    </div>
  );
}

/* ─── HomeTab ───────────────────────────────────────────────────── */
const DEFAULT_FILTERS = { search: "", status: "", paymentMethod: "", paymentStatus: "", payoutStatus: "" };

export function HomeTab({
  liveRides = [], allRides = [], allApprovals = [], totalAccounts = 0,
  uatobdrivers = [], activeRides = [], searchingRides = [],
  totalRides = 0, activeDrivers = [], revenue = 0, approvals = [], onToast,
}) {
  const [refreshing,  setRefreshing]  = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters,     setFilters]     = useState(DEFAULT_FILTERS);

  const handleRefresh      = () => { setRefreshing(true); setTimeout(() => { setRefreshing(false); onToast?.("Data refreshed"); }, 1100); };
  const handleFilterChange = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));
  const handleClearFilters = () => setFilters(DEFAULT_FILTERS);
  const activeFilterCount  = Object.values(filters).filter(Boolean).length;

  const filteredRides = useMemo(() => {
    return liveRides.filter(ride => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const s = [ride.pickup, ride.dropoff, ride.pickupCity, ride.dropoffCity, ride.pickupZip, ride.dropoffZip]
          .map(v => (v ?? "").toLowerCase()).join(" ");
        if (!s.includes(q)) return false;
      }
      if (filters.status        && ride.status        !== filters.status)        return false;
      if (filters.paymentMethod && ride.paymentMethod !== filters.paymentMethod) return false;
      if (filters.paymentStatus && ride.paymentStatus !== filters.paymentStatus) return false;
      if (filters.payoutStatus  && ride.payoutStatus  !== filters.payoutStatus)  return false;
      return true;
    });
  }, [liveRides, filters]);

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div className="ht-root" style={{ padding: "0 16px 24px" }}>

        {/* ── Live status bar ── */}
        <div className="ht-card ht-fade" style={{ padding: "12px 16px", marginBottom: 12, animationDelay: "0ms" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              {[
                { dot: "#16A34A", label: `${totalAccounts}`, sub: "accounts" },
                { dot: "#D97706", label: `${uatobdrivers.length}`, sub: "drivers" },
                { dot: "#16A34A", label: `${activeRides.length}`, sub: "active" },
                { dot: "#D97706", label: `${searchingRides.length}`, sub: "searching" },
              ].map(({ dot, label, sub }, i) => (
                <div key={sub} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "5px 12px", borderRadius: 8,
                  borderRight: i < 3 ? "1.5px solid var(--border2)" : "none",
                  paddingRight: i < 3 ? 12 : 0,
                }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0 }} />
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 800, color: "var(--ink)" }}>{label}</span>
                  <span style={{ fontSize: 11, color: "var(--dim)", fontWeight: 600 }}>{sub}</span>
                </div>
              ))}
            </div>
            <button onClick={handleRefresh} style={{ width: 32, height: 32, borderRadius: 8, border: "1.5px solid var(--border)", background: "var(--surf2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--muted)", transition: "all .15s" }}>
              <RefreshCw size={13} className={refreshing ? "ht-spin" : ""} />
            </button>
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 12 }}>
          {[
            { label: "Total Rides",       val: totalRides ?? liveRides.length, icon: Activity,   accent: "#2563EB", accentBg: "#EFF6FF",  delay: 40  },
            { label: "Active Drivers",    val: activeDrivers.length,           icon: Car,        accent: "#16A34A", accentBg: "#DCFCE7",  delay: 80  },
            { label: "Revenue Today",     val: revenue != null ? `$${revenue.toFixed(2)}` : "—", icon: DollarSign, accent: "#D97706", accentBg: "#FEF3C7", delay: 120 },
            { label: "Pending Approvals", val: allApprovals.length,            icon: Shield,     accent: "#DC2626", accentBg: "#FEF2F2",  delay: 160 },
          ].map(({ label, val, icon: Icon, accent, accentBg, delay }) => (
            <div key={label} className="ht-stat-pill ht-fade" style={{ animationDelay: `${delay}ms` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: accentBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={13} color={accent} />
                </div>
                <ArrowUpRight size={12} color="var(--dim)" />
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.5px", lineHeight: 1 }}>{val}</div>
              <div style={{ fontSize: 11, color: "var(--dim)", fontWeight: 600 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── Weekly Chart ── */}
        <WeeklySummary allRides={allRides.length > 0 ? allRides : liveRides} />

        {/* ── Live Rides header ── */}
        <div className="ht-fade" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, animationDelay: "200ms" }}>
          <div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 800, color: "var(--ink)" }}>
              Live Rides
            </div>
            {liveRides.length > 0 && (
              <div style={{ fontSize: 11, color: "var(--dim)", fontWeight: 600, marginTop: 1 }}>
                {filteredRides.length} of {liveRides.length} shown
              </div>
            )}
          </div>
          <button
            onClick={() => setShowFilters(p => !p)}
            className={`ht-btn ${showFilters || activeFilterCount > 0 ? "active" : ""}`}
          >
            <Filter size={11} />
            Filter
            {activeFilterCount > 0 && (
              <span style={{ width: 17, height: 17, borderRadius: "50%", background: "var(--green)", color: "#fff", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <FilterPanel filters={filters} onChange={handleFilterChange} onClear={handleClearFilters} resultCount={filteredRides.length} />
        )}

        {/* ── Ride list ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filteredRides.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--dim)", fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>🚗</div>
              {activeFilterCount > 0 ? "No rides match your filters" : "No rides yet"}
            </div>
          )}
          {filteredRides.map((ride, i) => (
            <RideCard key={ride.id} ride={ride} delay={240 + i * 45} />
          ))}
        </div>
      </div>
    </>
  );
}

/* ─── RideCard ──────────────────────────────────────────────────── */
function RideCard({ ride, delay }) {
  const riderLabel  = ride.riderName  ?? `Rider …${ride.uid?.slice(-4) ?? "?"}`;
  const driverLabel = ride.driverName ?? (ride.driverUid ? `Driver …${ride.driverUid.slice(-4)}` : "No driver yet");

  const s  = STATUS_META[ride.status]         ?? { label: ride.status,         dot: "#9CA3AF", bg: "#F3F4F6", color: "#6B7280" };
  const pm = PAYMENT_META[ride.paymentStatus] ?? { bg: "#F3F4F6", color: "#6B7280", label: ride.paymentStatus ?? "—" };
  const po = PAYOUT_META[ride.payoutStatus]   ?? { bg: "#F3F4F6", color: "#6B7280", label: ride.payoutStatus  ?? "—" };

  function TopBar() {
    switch (ride.status) {
      case "searching_driver": return <SearchTimerBar expiresAt={ride.expiresAt} emailDispatchAt={ride.emailDispatchAt} createdAt={ride.createdAt} />;
      case "driver_assigned":  return <DriverAssignedBar acceptedAt={ride.acceptedAt} etaMin={ride.driverInfo?.etaMin} />;
      case "arrived":          return <ArrivedBar />;
      case "in_progress":      return <InProgressBar startedAt={ride.startedAt} tripDurationMin={ride.tripDurationMin} />;
      case "completed":        return <div style={{ height: 3, background: "var(--border2)" }} />;
      case "cancelled":        return <div style={{ height: 3, background: "linear-gradient(90deg,#DC2626,#F87171)" }} />;
      default:                 return <div style={{ height: 3, background: "var(--border2)" }} />;
    }
  }

  return (
    <div className="ht-card ht-ride-card ht-fade" style={{ padding: 0, animationDelay: `${delay}ms` }}>
      <TopBar />

      <div style={{ padding: "14px 16px 12px" }}>

        {/* Header row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12, gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            {/* Avatar */}
            <div style={{
              width: 38, height: 38, borderRadius: 11,
              background: "var(--green-bg)", color: "var(--green)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 800,
              flexShrink: 0,
            }}>
              {riderLabel.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>{riderLabel}</div>
              <div style={{ fontSize: 11, color: "var(--dim)", display: "flex", alignItems: "center", gap: 4 }}>
                <Car size={10} color="var(--dim)" />
                {driverLabel}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
            <span className="ht-status" style={{ background: s.bg, color: s.color }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
              {s.label}
            </span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.5px", lineHeight: 1 }}>
              ${ride.fareTotal?.toFixed(2) ?? "—"}
            </span>
          </div>
        </div>

        {/* Driver banner for searching rides */}
        {ride.status === "searching_driver" && (
          <DriverInfoBanner
            driverInfo={ride.driverInfo}
            candidateDriverUids={ride.candidateDriverUids ?? []}
            emailSentToDrivers={ride.emailSentToDrivers ?? {}}
          />
        )}

        {/* Route */}
        <div className="ht-route-line" style={{ marginBottom: 11 }}>
          <div style={{ position: "absolute", left: 23, top: 20, bottom: 20, width: 1.5, background: "linear-gradient(180deg,#16A34A,#DC2626)", borderRadius: 2 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {[
              { dot: "#16A34A", label: "PICKUP",  addr: shortAddress(ride.pickup),  city: ride.pickupCity,  zip: ride.pickupZip  },
              { dot: "#DC2626", label: "DROPOFF", addr: shortAddress(ride.dropoff), city: ride.dropoffCity, zip: ride.dropoffZip },
            ].map(({ dot, label, addr, city, zip }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 9, height: 9, borderRadius: "50%", background: dot, flexShrink: 0, border: "2px solid var(--surf)", zIndex: 1, boxShadow: `0 0 0 2px ${dot}33` }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 9, color: "var(--dim)", fontWeight: 800, textTransform: "uppercase", letterSpacing: ".7px", marginBottom: 1 }}>{label}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {addr}
                    {city && <span style={{ color: "var(--dim)", fontWeight: 400 }}> · {city}{zip ? ` ${zip}` : ""}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trip meta chips */}
        <div style={{ display: "flex", gap: 5, marginBottom: 11, flexWrap: "wrap" }}>
          {[
            ride.rideLabel ?? ride.rideType,
            `${ride.tripDistanceMiles ?? 0} mi`,
            `~${ride.tripDurationMin ?? 0} min`,
            timeAgo(ride.createdAt),
          ].filter(Boolean).map(label => (
            <span key={label} className="ht-tag" style={{ background: "var(--surf3)", color: "var(--muted)" }}>{label}</span>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTop: "1.5px solid var(--border2)", flexWrap: "wrap", gap: 6 }}>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            <span className="ht-tag" style={{
              background: ride.paymentMethod === "cashapp" ? "#DCFCE7" : "#EFF6FF",
              color:       ride.paymentMethod === "cashapp" ? "#14532D"  : "#1E40AF",
            }}>
              {ride.paymentMethod === "cashapp" ? "Cash App" : ride.paymentMethod ?? "Card"}
            </span>
            <span className="ht-tag" style={{ background: pm.bg, color: pm.color }}>{pm.label}</span>
            <span className="ht-tag" style={{ background: po.bg, color: po.color }}>{po.label}</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--dim)", fontWeight: 500 }}>
            <span style={{ color: "var(--green)", fontWeight: 700 }}>${ride.driverPayout?.toFixed(2) ?? "—"}</span>
            {" driver · "}
            <span style={{ color: "var(--blue)", fontWeight: 700 }}>${ride.platformFee?.toFixed(2) ?? "—"}</span>
            {" fee"}
          </div>
        </div>

        {/* Ride ID */}
        <div style={{ marginTop: 8, fontSize: 9, color: "#D1D5DB", fontFamily: "monospace", letterSpacing: ".4px" }}>{ride.id}</div>
      </div>
    </div>
  );
}