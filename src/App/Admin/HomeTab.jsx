import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Activity, DollarSign, Car, Shield, RefreshCw, Filter,
  Search, X, ChevronDown, BarChart3, Sparkles, ArrowUpRight,
  Clock, Mail, Users, Phone, MessageSquare, Send, MapPin,
  CheckCircle2, AlertCircle, Zap, Navigation,
} from "lucide-react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { firebase_app } from "@/firebase/config";

/* ─── Firebase ───────────────────────────────────────────────────── */
const functions = getFunctions(firebase_app, "us-east1");

/* ─── Design Tokens ─────────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Sora:wght@400;500;600;700;800&display=swap');

:root {
  --bg:            #F0F1F3;
  --bg-card:       #FFFFFF;
  --bg-soft:       #F5F6F8;
  --border:        rgba(0,0,0,.07);
  --border-mid:    rgba(0,0,0,.11);
  --border-strong: rgba(0,0,0,.18);
  --ink:           #0A0A0F;
  --ink-2:         #1C1C26;
  --ink-3:         #4A4A5E;
  --ink-4:         #6E6E82;
  --ink-5:         #9898AA;
  --green:         #00C16A;
  --green-dim:     rgba(0,193,106,.12);
  --blue:          #2F6FED;
  --blue-dim:      rgba(47,111,237,.10);
  --amber:         #F59500;
  --amber-dim:     rgba(245,149,0,.12);
  --red:           #E8383A;
  --red-dim:       rgba(232,56,58,.10);
  --font:          'Sora', system-ui, sans-serif;
  --mono:          'DM Mono', monospace;
  --radius-card:   18px;
  --radius-sm:     10px;
}

.ht * { box-sizing:border-box; margin:0; padding:0; }
.ht {
  font-family:var(--font);
  background:var(--bg);
  color:var(--ink);
  min-height:100vh;
  -webkit-font-smoothing:antialiased;
}

@keyframes fadeUp    { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
@keyframes spin      { to{transform:rotate(360deg)} }
@keyframes pulseRing { 0%{transform:scale(.8);opacity:.8} 70%{transform:scale(1.8);opacity:0} 100%{transform:scale(.8);opacity:0} }
@keyframes slideUp   { from{opacity:0;transform:translateY(28px) scale(.96)} to{opacity:1;transform:translateY(0) scale(1)} }
@keyframes backdropIn{ from{opacity:0} to{opacity:1} }
@keyframes blink     { 0%,100%{opacity:1} 50%{opacity:.35} }

.fade-up { animation:fadeUp .4s cubic-bezier(.22,1,.36,1) both; }
.spin    { animation:spin 1s linear infinite; }
.blink   { animation:blink 1.8s ease-in-out infinite; }

/* ── Cards ── */
.card {
  background:var(--bg-card);
  border:1px solid var(--border);
  border-radius:var(--radius-card);
}
.card-hover { transition:box-shadow .2s, border-color .2s, transform .2s; }
.card-hover:hover {
  border-color:var(--border-mid);
  box-shadow:0 8px 32px rgba(0,0,0,.08);
  transform:translateY(-1px);
}

/* ── Pills ── */
.pill {
  display:inline-flex; align-items:center; gap:4px;
  font-size:10px; font-weight:700; letter-spacing:.04em;
  padding:3px 8px; border-radius:6px; white-space:nowrap;
  text-transform:uppercase;
}

/* ── Live dot ── */
.live-dot {
  width:6px; height:6px; border-radius:50%; flex-shrink:0; position:relative;
}
.live-dot::after {
  content:''; position:absolute; inset:-4px; border-radius:50%;
  border:1.5px solid currentColor;
  animation:pulseRing 2.2s ease-out infinite; opacity:0;
}

/* ── Search ── */
.search-wrap {
  display:flex; align-items:center; gap:9px;
  background:var(--bg-soft); border:1px solid var(--border-mid);
  border-radius:var(--radius-sm); padding:0 14px; height:40px; transition:all .18s;
}
.search-wrap:focus-within {
  border-color:var(--ink); background:var(--bg-card);
  box-shadow:0 0 0 3px rgba(10,10,15,.05);
}
.search-wrap input {
  flex:1; border:none; outline:none; background:transparent;
  font-family:var(--font); font-size:13px; color:var(--ink); font-weight:500;
}
.search-wrap input::placeholder { color:var(--ink-5); font-weight:400; }

/* ── Selects ── */
.sel-wrap { position:relative; flex:1; min-width:110px; }
.sel-wrap select {
  width:100%; padding:8px 28px 8px 12px; border-radius:8px;
  border:1px solid var(--border-mid); font-size:11px; font-weight:700;
  color:var(--ink-2); background:var(--bg-card); appearance:none;
  outline:none; cursor:pointer; font-family:var(--font); transition:border-color .18s;
  letter-spacing:.02em;
}
.sel-wrap select:focus { border-color:var(--ink); box-shadow:0 0 0 3px rgba(10,10,15,.05); }

/* ── Action btn ── */
.action-btn {
  display:inline-flex; align-items:center; gap:6px;
  padding:7px 13px; border-radius:9px; border:1px solid var(--border-mid);
  background:var(--bg-card); font-family:var(--font); font-size:11px;
  font-weight:700; color:var(--ink-2); cursor:pointer; transition:all .15s;
  letter-spacing:.02em;
}
.action-btn:hover { border-color:var(--border-strong); background:var(--bg-soft); }
.action-btn.active { background:var(--ink); color:#fff; border-color:var(--ink); }

/* ── Quick-action buttons ── */
.qa-btn {
  display:inline-flex; align-items:center; justify-content:center; gap:7px;
  flex:1; height:38px; border-radius:10px; font-family:var(--font);
  font-size:11.5px; font-weight:700; cursor:pointer; transition:all .15s;
  border:none; letter-spacing:.02em;
}
.qa-btn:hover { filter:brightness(.94); transform:translateY(-1px); }
.qa-btn:active { transform:scale(.97); }

/* ── Message sheet ── */
.msg-backdrop {
  position:fixed; inset:0; z-index:900;
  background:rgba(0,0,0,.5); backdrop-filter:blur(8px);
  display:flex; align-items:flex-end; justify-content:center;
  padding:0 0 env(safe-area-inset-bottom);
  animation:backdropIn .18s ease both;
}
.msg-sheet {
  width:100%; max-width:480px; background:#fff;
  border-radius:24px 24px 0 0; border-top:1px solid var(--border);
  overflow:hidden; animation:slideUp .3s cubic-bezier(.22,1,.36,1) both;
}
.msg-chip {
  display:flex; align-items:center; padding:10px 14px;
  border-radius:10px; font-size:12.5px; font-weight:600;
  background:var(--bg-soft); border:1px solid var(--border-mid);
  cursor:pointer; transition:all .14s; color:var(--ink-2);
  text-align:left; font-family:var(--font);
}
.msg-chip:hover { background:var(--ink); color:#fff; border-color:var(--ink); }

/* ── Chart bars ── */
.chart-bar { border-radius:6px 6px 2px 2px; transition:all .4s cubic-bezier(.22,1,.36,1); }

/* ── Mapbox overrides ── */
.rc-map .mapboxgl-ctrl-logo,
.rc-map .mapboxgl-ctrl-attrib { display:none !important; }

/* ── Scrollbar ── */
.ht ::-webkit-scrollbar { width:4px; }
.ht ::-webkit-scrollbar-thumb { background:var(--border-mid); border-radius:2px; }

/* ── Status timeline ── */
.timeline-dot {
  width:8px; height:8px; border-radius:50%; flex-shrink:0; border:2px solid transparent;
}
`;

/* ─── Helpers ────────────────────────────────────────────────────── */
function timeAgo(ts) {
  if (!ts) return "—";
  const sec = ts?.seconds ?? Math.floor((typeof ts === "number" ? ts : 0) / 1000);
  const d = Math.floor(Date.now() / 1000) - sec;
  if (d < 60)   return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400)return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}
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
function shortAddr(addr = "") { return addr.split(",")[0].trim() || addr; }

/* ─── Polyline decoder ───────────────────────────────────────────── */
function decodePolyline(encoded) {
  if (!encoded) return [];
  const pts = []; let i = 0, lat = 0, lng = 0;
  while (i < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    pts.push([lat / 1e5, lng / 1e5]);
  }
  return pts;
}

/* ─── Mapbox loader ──────────────────────────────────────────────── */
const MB_TOKEN = "pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA";
let _mbLoaded = false, _mbCbs = [];
function loadMapbox(cb) {
  if (_mbLoaded && window.mapboxgl) { cb(); return; }
  _mbCbs.push(cb);
  if (document.getElementById("mapbox-css")) { if (_mbLoaded) cb(); return; }
  const link = document.createElement("link");
  link.id = "mapbox-css"; link.rel = "stylesheet";
  link.href = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css";
  document.head.appendChild(link);
  const sc = document.createElement("script");
  sc.src = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js";
  sc.onload = () => { _mbLoaded = true; _mbCbs.forEach(f => f()); _mbCbs = []; };
  document.head.appendChild(sc);
}

/* ─── Status config ──────────────────────────────────────────────── */
const STATUS = {
  searching_driver: { label: "Searching",    accent: "#F59500", bg: "#FFF8E6", border: "#FFE099", dot: "#F59500" },
  driver_assigned:  { label: "Assigned",     accent: "#2F6FED", bg: "#EDF2FF", border: "#BAD0FF", dot: "#2F6FED" },
  driver_arriving:  { label: "Arriving",     accent: "#2F6FED", bg: "#EDF2FF", border: "#BAD0FF", dot: "#2F6FED" },
  arrived:          { label: "Arrived",      accent: "#00C16A", bg: "#E6FFF3", border: "#99EDCA", dot: "#00C16A" },
  in_progress:      { label: "In Progress",  accent: "#00C16A", bg: "#E6FFF3", border: "#99EDCA", dot: "#00C16A" },
  completed:        { label: "Completed",    accent: "#6E6E82", bg: "#F5F5F8", border: "#D4D4E0", dot: "#6E6E82" },
  cancelled:        { label: "Cancelled",    accent: "#E8383A", bg: "#FEECEC", border: "#F9BCBC", dot: "#E8383A" },
};
const PAY_STATUS = {
  succeeded: { bg: "#E6FFF3", color: "#00A659", label: "Paid"    },
  pending:   { bg: "#FFF8E6", color: "#CC7A00", label: "Pending" },
  failed:    { bg: "#FEECEC", color: "#C42D2F", label: "Failed"  },
};
const PAYOUT = {
  processing: { bg: "#EDF2FF", color: "#2F6FED", label: "Processing" },
  pending:    { bg: "#FFF8E6", color: "#CC7A00", label: "Pending"     },
  paid:       { bg: "#E6FFF3", color: "#00A659", label: "Paid Out"    },
  failed:     { bg: "#FEECEC", color: "#C42D2F", label: "Failed"      },
};
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* ─── Progress bars ──────────────────────────────────────────────── */
function ProgressBar({ pct = 0, color = "#00C16A", label, height = 3 }) {
  return (
    <div style={{ height, background: "rgba(0,0,0,.05)", position: "relative", overflow: "visible", borderRadius: "0 0 18px 18px" }}>
      <div style={{
        position: "absolute", top: 0, left: 0, bottom: 0,
        width: `${Math.min(Math.max(pct, 0), 100)}%`,
        background: color,
        boxShadow: `0 0 10px ${color}66`,
        transition: "width .35s ease",
      }} />
      {label && (
        <div style={{
          position: "absolute", top: -1, left: `${Math.min(Math.max(pct, 6), 88)}%`,
          transform: "translate(-50%,-100%)",
          background: color, color: "#fff",
          fontSize: 9, fontWeight: 700, padding: "3px 7px",
          borderRadius: 5, whiteSpace: "nowrap",
          fontFamily: "var(--mono)", zIndex: 10,
          boxShadow: `0 2px 8px ${color}55`,
        }}>{label}</div>
      )}
    </div>
  );
}

function SearchTimerBar({ expiresAt, emailDispatchAt, createdAt }) {
  const [pct, setPct] = useState(100);
  const [left, setLeft] = useState(null);
  const raf = useRef(null);
  useEffect(() => {
    const exMs = tsToMs(expiresAt); if (!exMs) return;
    const startMs = tsToMs(emailDispatchAt) || tsToMs(createdAt) || (exMs - 25 * 60 * 1000);
    const totalMs = exMs - startMs;
    const tick = () => {
      const now = Date.now(); const rem = Math.max((exMs - now) / 1000, 0);
      setPct(Math.max(((exMs - now) / totalMs) * 100, 0)); setLeft(Math.ceil(rem));
      if (rem > 0) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [expiresAt, emailDispatchAt, createdAt]);
  const c = left === null ? "#9898AA" : left > 300 ? "#F59500" : left > 60 ? "#EA580C" : "#E8383A";
  return <ProgressBar pct={pct} color={c} label={left != null ? (left > 0 ? fmtMMSS(left) : "EXPIRED") : "…"} />;
}

function AssignedBar({ acceptedAt, etaMin }) {
  const [elapsed, setElapsed] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const ms = tsToMs(acceptedAt); if (!ms) return;
    const tick = () => { setElapsed(Math.floor((Date.now() - ms) / 1000)); raf.current = requestAnimationFrame(tick); };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [acceptedAt]);
  const total = (etaMin ?? 0) * 60;
  const pct = total > 0 ? Math.min((elapsed / total) * 100, 100) : 0;
  const isLate = total > 0 && elapsed > total;
  const c = isLate ? "#E8383A" : pct > 80 ? "#EA580C" : "#2F6FED";
  return <ProgressBar pct={pct} color={c} label={isLate ? `+${fmtMMSS(elapsed - total)}` : etaMin != null ? `${etaMin}m ETA` : fmtMMSS(elapsed)} />;
}

function TripBar({ startedAt, tripDurationMin }) {
  const [elapsed, setElapsed] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const ms = tsToMs(startedAt); if (!ms) return;
    const tick = () => { setElapsed(Math.floor((Date.now() - ms) / 1000)); raf.current = requestAnimationFrame(tick); };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [startedAt]);
  const total = (tripDurationMin ?? 0) * 60;
  const pct = total > 0 ? Math.min((elapsed / total) * 100, 100) : 0;
  const rem = Math.max(total - elapsed, 0);
  const c = pct > 90 ? "#E8383A" : pct > 70 ? "#F59500" : "#00C16A";
  return <ProgressBar pct={pct} color={c} label={total > 0 ? (elapsed > total ? `+${fmtMMSS(elapsed - total)}` : `${fmtMMSS(rem)} left`) : fmtMMSS(elapsed)} />;
}

function StatusBar({ ride }) {
  const s = ride.status;
  if (s === "searching_driver") return <SearchTimerBar expiresAt={ride.expiresAt} emailDispatchAt={ride.emailDispatchAt} createdAt={ride.createdAt} />;
  if (s === "driver_assigned" || s === "driver_arriving") return <AssignedBar acceptedAt={ride.acceptedAt} etaMin={ride.driverEtaMin} />;
  if (s === "arrived")     return <ProgressBar pct={100} color="#00C16A" label="ARRIVED" />;
  if (s === "in_progress") return <TripBar startedAt={ride.startedAt} tripDurationMin={ride.tripDurationMin} />;
  if (s === "completed")   return <div style={{ height: 3, background: "linear-gradient(90deg,#00C16A,#99EDCA)" }} />;
  if (s === "cancelled")   return <div style={{ height: 3, background: "linear-gradient(90deg,#E8383A,#F9BCBC)" }} />;
  return <div style={{ height: 3, background: "var(--bg-soft)" }} />;
}

/* ─── Ride timeline (completed rides) ───────────────────────────── */
function RideTimeline({ ride }) {
  const steps = [
    { key: "createdAt",   label: "Created",        color: "#9898AA" },
    { key: "acceptedAt",  label: "Driver Accepted", color: "#2F6FED" },
    { key: "arrivedAt",   label: "Driver Arrived",  color: "#00C16A" },
    { key: "startedAt",   label: "Trip Started",    color: "#00C16A" },
    { key: "completedAt", label: "Completed",        color: "#00C16A" },
  ].filter(s => ride[s.key]);

  if (steps.length < 2) return null;

  return (
    <div style={{ padding: "10px 16px 0", display: "flex", alignItems: "center", gap: 0 }}>
      {steps.map((s, i) => {
        const ts = tsToMs(ride[s.key]);
        const label = ts ? new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";
        return (
          <div key={s.key} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <div className="timeline-dot" style={{ background: s.color, borderColor: `${s.color}44`, boxShadow: `0 0 6px ${s.color}66` }} />
              <span style={{ fontSize: 8, color: "var(--ink-5)", fontWeight: 700, fontFamily: "var(--mono)", whiteSpace: "nowrap" }}>{label}</span>
              <span style={{ fontSize: 7.5, color: "var(--ink-5)", fontWeight: 600, whiteSpace: "nowrap", letterSpacing: ".03em", textTransform: "uppercase" }}>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg,${s.color}66,${steps[i + 1].color}66)`, margin: "0 4px", marginBottom: 24 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Message Modal ──────────────────────────────────────────────── */
const CANNED = [
  "Please head to the pickup location.",
  "Rider is waiting — confirm your ETA.",
  "Any issues with this ride?",
  "Complete the trip as requested.",
  "Call support if you need assistance.",
];

function MessageModal({ ride, driverName, onClose }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const ta = useRef(null);
  useEffect(() => { ta.current?.focus(); }, []);

  const send = useCallback(async (msg) => {
    const body = msg ?? text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await httpsCallable(functions, "adminSendDriverMessage")({ rideId: ride.id, message: body });
      setSent(true);
      setTimeout(onClose, 900);
    } catch (e) { console.error(e); }
    finally { setSending(false); }
  }, [text, sending, ride?.id, onClose]);

  const shortId = ride.id?.slice(-6).toUpperCase();
  const dname = driverName ?? (ride.driverUid ? `Driver ···${ride.driverUid.slice(-4)}` : "Driver");

  return (
    <div className="msg-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="msg-sheet">
        {/* drag handle */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 14, paddingBottom: 4 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: "var(--border-strong)" }} />
        </div>

        {/* header */}
        <div style={{ padding: "8px 20px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#2F6FED,#1A4BCC)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 14px rgba(47,111,237,.35)" }}>
              <MessageSquare size={16} color="#fff" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)", letterSpacing: "-.02em" }}>Message Driver</div>
              <div style={{ fontSize: 11, color: "var(--ink-5)", fontWeight: 500, marginTop: 1 }}>{dname} · Ride #{shortId}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid var(--border-mid)", background: "var(--bg-soft)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--ink-4)" }}>
            <X size={14} />
          </button>
        </div>

        {/* quick sends */}
        <div style={{ padding: "14px 20px 0" }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--ink-5)", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 8 }}>Quick sends</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {CANNED.map((c, i) => (
              <button key={i} className="msg-chip" onClick={() => send(c)} disabled={sending || sent}
                style={{ opacity: sending || sent ? 0.5 : 1 }}>
                <Zap size={11} style={{ marginRight: 4, opacity: .6, flexShrink: 0 }} />
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* custom */}
        <div style={{ padding: "14px 20px 28px" }}>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--ink-5)", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 8 }}>Custom message</div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea ref={ta} value={text} onChange={e => setText(e.target.value)}
              placeholder="Type a message to the driver…" rows={2}
              style={{ flex: 1, resize: "none", border: "1px solid var(--border-mid)", borderRadius: 12, padding: "10px 13px", fontFamily: "var(--font)", fontSize: 13, color: "var(--ink)", background: "var(--bg-soft)", outline: "none", transition: "border-color .18s, box-shadow .18s" }}
              onFocus={e => { e.target.style.borderColor = "var(--ink)"; e.target.style.boxShadow = "0 0 0 3px rgba(10,10,15,.05)"; }}
              onBlur={e => { e.target.style.borderColor = "var(--border-mid)"; e.target.style.boxShadow = "none"; }}
            />
            <button onClick={() => send()} disabled={!text.trim() || sending || sent}
              style={{
                width: 44, height: 44, borderRadius: 12, border: "none",
                background: sent ? "#00C16A" : text.trim() ? "var(--ink)" : "var(--bg-soft)",
                color: text.trim() || sent ? "#fff" : "var(--ink-5)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: text.trim() && !sending && !sent ? "pointer" : "not-allowed",
                transition: "all .18s", flexShrink: 0,
                boxShadow: text.trim() && !sent ? "0 4px 14px rgba(10,10,15,.2)" : "none",
              }}>
              {sent ? <CheckCircle2 size={18} /> : <Send size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Card Map ───────────────────────────────────────────────────── */
function CardMap({ ride, status }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const initializedRef = useRef(false);

  const isActive    = ["driver_assigned", "driver_arriving", "arrived", "in_progress"].includes(status);
  const isCompleted = status === "completed";
  const isCancelled = status === "cancelled";
  const isSearching = status === "searching_driver";

  // Decode polyline → [lng,lat] for Mapbox
  const routeCoords = useMemo(() => {
    if (!ride.polyline) return [];
    return decodePolyline(ride.polyline).map(p => [p[1], p[0]]);
  }, [ride.polyline]);

  const bounds = useMemo(() => {
    const pts = [...routeCoords];
    if (ride.pickupLat  && ride.pickupLng)  pts.push([ride.pickupLng,  ride.pickupLat]);
    if (ride.dropoffLat && ride.dropoffLng) pts.push([ride.dropoffLng, ride.dropoffLat]);
    if (ride.driverLat  && ride.driverLng)  pts.push([ride.driverLng,  ride.driverLat]);
    if (ride.riderLat   && ride.riderLng)   pts.push([ride.riderLng,   ride.riderLat]);
    if (!pts.length) return null;
    return {
      minLng: Math.min(...pts.map(p => p[0])),
      maxLng: Math.max(...pts.map(p => p[0])),
      minLat: Math.min(...pts.map(p => p[1])),
      maxLat: Math.max(...pts.map(p => p[1])),
    };
  }, [routeCoords, ride.pickupLat, ride.pickupLng, ride.dropoffLat, ride.dropoffLng, ride.driverLat, ride.driverLng, ride.riderLat, ride.riderLng]);

  const center = useMemo(() =>
    bounds ? [(bounds.minLng + bounds.maxLng) / 2, (bounds.minLat + bounds.maxLat) / 2] : [-81.4696, 28.573],
    [bounds]);

  // Init map
  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return;
    loadMapbox(() => {
      if (!containerRef.current || initializedRef.current) return;
      initializedRef.current = true;
      window.mapboxgl.accessToken = MB_TOKEN;
      const mapStyle = (isCompleted || isCancelled || isSearching)
        ? "mapbox://styles/mapbox/light-v11"
        : "mapbox://styles/mapbox/dark-v11";
      mapRef.current = new window.mapboxgl.Map({
        container: containerRef.current,
        style: mapStyle,
        center, zoom: 13,
        attributionControl: false,
        interactive: false,
        fadeDuration: 0,
      });
    });
    return () => {
      markersRef.current.forEach(m => m.remove()); markersRef.current = [];
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; initializedRef.current = false; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draw route + markers whenever coords change
  useEffect(() => {
    if (!mapRef.current) return;
    const attach = () => {
      if (!mapRef.current?.isStyleLoaded()) { setTimeout(attach, 80); return; }

      /* ── Route polyline ── */
      if (routeCoords.length > 1) {
        const geo = { type: "Feature", geometry: { type: "LineString", coordinates: routeCoords } };
        const routeColor = isCancelled ? "#E8383A" : isCompleted ? "#9898AA" : "#00C16A";
        if (mapRef.current.getSource("route")) {
          mapRef.current.getSource("route").setData(geo);
        } else {
          mapRef.current.addSource("route", { type: "geojson", data: geo });
          // Halo
          mapRef.current.addLayer({
            id: "route-halo", type: "line", source: "route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": "#ffffff", "line-width": 10, "line-opacity": isCompleted ? 0.2 : 0.14, "line-blur": 6 },
          });
          // Main
          mapRef.current.addLayer({
            id: "route-main", type: "line", source: "route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": routeColor, "line-width": 3.5, "line-opacity": isCancelled ? 0.55 : 1 },
          });
          // Animated dash (active only)
          if (!isCancelled && !isCompleted) {
            mapRef.current.addLayer({
              id: "route-dash", type: "line", source: "route",
              layout: { "line-cap": "round", "line-join": "round" },
              paint: { "line-color": "#fff", "line-width": 1.5, "line-opacity": 0.28, "line-dasharray": [0, 6] },
            });
          }
        }
      }

      /* ── Clear markers ── */
      markersRef.current.forEach(m => m.remove()); markersRef.current = [];

      const addMarker = (lngLat, html, anchor = "center") => {
        const el = document.createElement("div");
        el.innerHTML = html;
        markersRef.current.push(
          new window.mapboxgl.Marker({ element: el.firstElementChild, anchor })
            .setLngLat(lngLat)
            .addTo(mapRef.current)
        );
      };

      /* ── Pickup pin (green filled circle) ── */
      if (ride.pickupLat && ride.pickupLng) {
        addMarker([ride.pickupLng, ride.pickupLat], `
          <div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;">
            ${isActive ? `<div style="position:absolute;inset:-7px;border-radius:50%;border:2px solid rgba(0,193,106,.5);animation:pulseRing 2.2s ease-out infinite;"></div>` : ""}
            <div style="width:14px;height:14px;border-radius:50%;background:#00C16A;border:3px solid #fff;box-shadow:0 2px 14px rgba(0,193,106,.75);z-index:1;"></div>
          </div>`);
      }

      /* ── Dropoff pin (teardrop) ── */
      if (ride.dropoffLat && ride.dropoffLng) {
        const pc = isCancelled ? "#E8383A" : isCompleted ? "#6E6E82" : "#0A0A0F";
        addMarker([ride.dropoffLng, ride.dropoffLat], `
          <div style="filter:drop-shadow(0 4px 10px rgba(0,0,0,.45));">
            <svg width="26" height="34" viewBox="0 0 26 34" fill="none">
              <path d="M13 0C6 0 0 6 0 13c0 9.8 13 21 13 21s13-11.2 13-21C26 6 20 0 13 0z" fill="${pc}"/>
              <circle cx="13" cy="13" r="5.5" fill="#fff"/>
              ${!isCompleted && !isCancelled ? `<circle cx="13" cy="13" r="2.5" fill="${pc}"/>` : ""}
            </svg>
          </div>`, "bottom");
      }

      /* ── Driver dot (blue pulsing) ── active/assigned only ── */
      if (ride.driverLat && ride.driverLng && !isCompleted && !isCancelled) {
        addMarker([ride.driverLng, ride.driverLat], `
          <div style="position:relative;width:22px;height:22px;display:flex;align-items:center;justify-content:center;">
            <div style="position:absolute;inset:-7px;border-radius:50%;border:2px solid rgba(47,111,237,.5);animation:pulseRing 1.9s ease-out infinite;"></div>
            <div style="width:15px;height:15px;border-radius:50%;background:#2F6FED;border:3px solid #fff;box-shadow:0 2px 12px rgba(47,111,237,.8);z-index:1;"></div>
          </div>`);
      }

      /* ── Rider dot (amber) — only when meaningfully separate from driver ── */
      if (ride.riderLat && ride.riderLng && isActive) {
        const driverNearby = ride.driverLat &&
          Math.hypot(ride.riderLat - ride.driverLat, ride.riderLng - ride.driverLng) < 0.0005;
        if (!driverNearby) {
          addMarker([ride.riderLng, ride.riderLat], `
            <div style="position:relative;width:18px;height:18px;display:flex;align-items:center;justify-content:center;">
              <div style="width:12px;height:12px;border-radius:50%;background:#F59500;border:3px solid #fff;box-shadow:0 2px 9px rgba(245,149,0,.7);z-index:1;"></div>
            </div>`);
        }
      }

      /* ── Fit to bounds ── */
      if (bounds) {
        mapRef.current.fitBounds(
          [[bounds.minLng, bounds.minLat], [bounds.maxLng, bounds.maxLat]],
          { padding: { top: 44, bottom: 44, left: 28, right: 28 }, maxZoom: 16, duration: 0 }
        );
      }
    };
    if (mapRef.current.loaded()) attach();
    else mapRef.current.once("load", attach);
  }, [
    routeCoords, bounds,
    ride.pickupLat, ride.pickupLng, ride.dropoffLat, ride.dropoffLng,
    ride.driverLat, ride.driverLng, ride.riderLat, ride.riderLng,
    isActive, isCompleted, isCancelled,
  ]);

  return <div ref={containerRef} className="rc-map" style={{ width: "100%", height: "100%" }} />;
}

/* ─── Map Legend ─────────────────────────────────────────────────── */
function MapLegend({ ride, status }) {
  const isActive    = ["driver_assigned", "driver_arriving", "arrived", "in_progress"].includes(status);
  const isCompleted = status === "completed";
  const isCancelled = status === "cancelled";
  const hasDriver   = !!(ride.driverLat && ride.driverLng && !isCompleted && !isCancelled);
  const hasRider    = !!(ride.riderLat && ride.riderLng && isActive);
  const driverNearby = hasDriver && hasRider && Math.hypot(ride.riderLat - ride.driverLat, ride.riderLng - ride.driverLng) < 0.0005;

  const items = [
    { color: "#00C16A", label: "Pickup" },
    { color: isCancelled ? "#E8383A" : isCompleted ? "#6E6E82" : "#0A0A0F", label: "Dropoff" },
    ...(hasDriver ? [{ color: "#2F6FED", label: "Driver" }] : []),
    ...(hasRider && !driverNearby ? [{ color: "#F59500", label: "Rider" }] : []),
  ];

  return (
    <div style={{ position: "absolute", bottom: 8, left: 8, zIndex: 20, display: "flex", gap: 5, flexWrap: "wrap" }}>
      {items.map(it => (
        <div key={it.label} style={{
          display: "flex", alignItems: "center", gap: 4,
          background: "rgba(10,10,15,.72)", backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,.1)", borderRadius: 20, padding: "3px 8px",
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: it.color, flexShrink: 0, boxShadow: `0 0 6px ${it.color}` }} />
          <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,.82)", letterSpacing: ".05em", textTransform: "uppercase" }}>{it.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Ride Card ──────────────────────────────────────────────────── */
function RideCard({ ride, index }) {
  const riderLabel  = ride.riderName  ?? (ride.uid       ? `Rider ···${ride.uid.slice(-4)}`       : "Rider");
  const driverLabel = ride.driverName ?? (ride.driverUid ? `Driver ···${ride.driverUid.slice(-4)}` : null);
  const status      = ride.status ?? "unknown";

  const s  = STATUS[status]                ?? { label: status,              accent: "#6E6E82", bg: "#F5F5F8", border: "#D4D4E0", dot: "#6E6E82" };
  const pm = PAY_STATUS[ride.paymentStatus] ?? { bg: "#F5F5F8", color: "#6E6E82", label: ride.paymentStatus ?? "—" };
  const po = PAYOUT[ride.payoutStatus]      ?? { bg: "#F5F5F8", color: "#6E6E82", label: ride.payoutStatus  ?? "—" };

  const isActive    = ["driver_assigned", "driver_arriving", "arrived", "in_progress"].includes(status);
  const isCompleted = status === "completed";
  const isCancelled = status === "cancelled";
  const isSearching = status === "searching_driver";
  const hasDriver   = !!(ride.driverUid && !isSearching);

  const [showMsg, setShowMsg] = useState(false);

  const etaChip = useMemo(() => {
    if (status === "driver_assigned" || status === "driver_arriving") return ride.driverEtaMin != null ? `${ride.driverEtaMin}m to pickup` : null;
    if (status === "in_progress")  return ride.dropoffEtaMin != null ? `${ride.dropoffEtaMin}m to dropoff` : null;
    if (status === "arrived")      return ride.dropoffEtaMin != null ? `${ride.dropoffEtaMin}m to dropoff` : null;
    return null;
  }, [status, ride.driverEtaMin, ride.dropoffEtaMin]);

  // Trip duration for completed
  const tripDuration = useMemo(() => {
    if (!isCompleted) return null;
    const start = tsToMs(ride.startedAt), end = tsToMs(ride.completedAt);
    if (!start || !end) return null;
    const mins = Math.round((end - start) / 60000);
    return `${mins}m`;
  }, [isCompleted, ride.startedAt, ride.completedAt]);

  const accentGrad = isCancelled
    ? "linear-gradient(90deg,#E8383A,#FF7A7B)"
    : isCompleted
    ? "linear-gradient(90deg,#00C16A,#99EDCA)"
    : isSearching
    ? "linear-gradient(90deg,#F59500,#FFCC6E)"
    : isActive
    ? "linear-gradient(90deg,#2F6FED,#7BA7FF)"
    : "linear-gradient(90deg,#D4D4E0,#E4E4F0)";

  return (
    <>
      <div className="card card-hover fade-up" style={{ animationDelay: `${160 + index * 40}ms`, padding: 0, overflow: "hidden" }}>

        {/* Accent stripe */}
        <div style={{ height: 3, background: accentGrad }} />

        {/* ── Header ── */}
        <div style={{ padding: "14px 16px 12px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
            {/* Avatar */}
            <div style={{
              width: 42, height: 42, borderRadius: 13, flexShrink: 0,
              background: isCancelled
                ? "linear-gradient(135deg,#E8383A,#A01E1F)"
                : isCompleted
                ? "linear-gradient(135deg,#4A4A5E,#1C1C26)"
                : "linear-gradient(135deg,#0A0A0F,#1C1C26)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13.5, fontWeight: 800, color: "#fff",
              boxShadow: "0 3px 10px rgba(0,0,0,.15)",
            }}>
              {initials(riderLabel)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "-.02em", marginBottom: 4 }}>
                {riderLabel}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                {driverLabel
                  ? <><Car size={9} color="var(--ink-5)" strokeWidth={2.5} /><span style={{ fontSize: 11, color: "var(--ink-4)", fontWeight: 600 }}>{driverLabel}</span></>
                  : <span style={{ fontSize: 11, color: "#F59500", fontWeight: 700, fontStyle: "italic" }}>Awaiting driver</span>
                }
              </div>
            </div>
          </div>

          {/* Status + fare */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 7, flexShrink: 0 }}>
            <div className="pill" style={{ background: s.bg, color: s.accent, border: `1px solid ${s.border}` }}>
              <span className={isActive ? "blink" : ""} style={{ width: 5, height: 5, borderRadius: "50%", background: s.dot, boxShadow: `0 0 5px ${s.dot}`, display: "inline-block" }} />
              {s.label}
            </div>
            <div style={{ fontSize: 24, color: isCancelled ? "var(--ink-5)" : "var(--ink)", fontWeight: 800, letterSpacing: "-.05em", lineHeight: 1, fontFamily: "var(--mono)", textDecoration: isCancelled ? "line-through" : "none" }}>
              {ride.fareTotal != null ? `$${ride.fareTotal.toFixed(2)}` : "—"}
            </div>
          </div>
        </div>

        {/* ── Map ── */}
        <div style={{ position: "relative", height: 170, margin: "0 16px", borderRadius: 14, overflow: "hidden", border: "1px solid var(--border)", background: "#0d1117" }}>
          <CardMap ride={ride} status={status} />

          {/* Pickup chip — top left */}
          <div style={{ position: "absolute", top: 8, left: 8, zIndex: 20, display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,.94)", backdropFilter: "blur(10px)", border: "1px solid rgba(0,0,0,.07)", borderRadius: 9, padding: "4px 9px", maxWidth: "54%" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00C16A", flexShrink: 0, boxShadow: "0 0 8px rgba(0,193,106,.9)" }} />
            <span style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{shortAddr(ride.pickup) || "Pickup"}</span>
          </div>

          {/* Dropoff chip — top right */}
          <div style={{ position: "absolute", top: 8, right: 8, zIndex: 20, display: "flex", alignItems: "center", gap: 5, background: "rgba(10,10,15,.85)", backdropFilter: "blur(10px)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 9, padding: "4px 9px", maxWidth: "54%" }}>
            <MapPin size={9} color={isCancelled ? "#E8383A" : isCompleted ? "#9898AA" : "rgba(255,255,255,.7)"} />
            <span style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,.9)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{shortAddr(ride.dropoff) || "Dropoff"}</span>
          </div>

          {/* Live badge */}
          {isActive && (
            <div style={{ position: "absolute", bottom: 8, right: 8, zIndex: 20, display: "flex", alignItems: "center", gap: 5, background: "rgba(10,10,15,.82)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 20, padding: "4px 10px" }}>
              <div className="live-dot blink" style={{ background: "#00C16A", color: "#00C16A", width: 5, height: 5 }} />
              <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,.85)", letterSpacing: ".08em", textTransform: "uppercase" }}>Live</span>
            </div>
          )}

          {/* Driver distance badge (active) */}
          {isActive && ride.driverDistanceMiles != null && ride.driverEtaMin != null && (
            <div style={{ position: "absolute", bottom: 8, left: 8, zIndex: 20, display: "flex", alignItems: "center", gap: 5, background: "rgba(47,111,237,.88)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 20, padding: "4px 10px" }}>
              <Navigation size={8} color="#fff" />
              <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", letterSpacing: ".05em" }}>{ride.driverEtaMin}m · {ride.driverDistanceMiles}mi</span>
            </div>
          )}

          {/* Cancelled overlay */}
          {isCancelled && <div style={{ position: "absolute", inset: 0, background: "rgba(232,56,58,.08)", zIndex: 10, pointerEvents: "none" }} />}

          {/* Pin legend */}
          <MapLegend ride={ride} status={status} />
        </div>

        {/* ── Ride timeline (completed) ── */}
        {isCompleted && <RideTimeline ride={ride} />}

        {/* ── Quick Actions ── */}
        {hasDriver && (
          <div style={{ padding: "11px 16px 0", display: "flex", gap: 8 }}>
            {/* Message Driver */}
            <button
              className="qa-btn"
              onClick={() => setShowMsg(true)}
              style={{ background: "#EDF2FF", color: "#2F6FED", border: "1px solid #BAD0FF", boxShadow: "0 2px 8px rgba(47,111,237,.12)" }}
            >
              <MessageSquare size={13} strokeWidth={2.5} />
              Message Driver
            </button>

            {/* Call Driver */}
            <button
              className="qa-btn"
              onClick={() => {
                if (ride.driverPhone) {
                  window.open(`tel:${ride.driverPhone}`);
                } else {
                  alert("Driver phone number not available.");
                }
              }}
              style={{ background: "#E6FFF3", color: "#00A659", border: "1px solid #99EDCA", boxShadow: "0 2px 8px rgba(0,193,106,.12)" }}
            >
              <Phone size={13} strokeWidth={2.5} />
              Call Driver
            </button>
          </div>
        )}

        {/* ── Footer meta ── */}
        <div style={{ padding: "11px 16px 14px", display: "flex", flexDirection: "column", gap: 9 }}>
          {/* Pills row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {ride.rideLabel && (
                <span className="pill" style={{ background: "var(--bg-soft)", color: "var(--ink-3)", border: "1px solid var(--border)", textTransform: "capitalize" }}>{ride.rideLabel}</span>
              )}
              {ride.tripDistanceMiles != null && (
                <span className="pill" style={{ background: "var(--bg-soft)", color: "var(--ink-3)", border: "1px solid var(--border)" }}>{ride.tripDistanceMiles} mi</span>
              )}
              {ride.tripDurationMin != null && (
                <span className="pill" style={{ background: "var(--bg-soft)", color: "var(--ink-3)", border: "1px solid var(--border)" }}>~{ride.tripDurationMin}m</span>
              )}
              {tripDuration && (
                <span className="pill" style={{ background: "var(--bg-soft)", color: "var(--ink-3)", border: "1px solid var(--border)" }}>⏱ {tripDuration}</span>
              )}
              {etaChip && (
                <span className="pill" style={{ background: "var(--green-dim)", color: "var(--green)", border: "1px solid rgba(0,193,106,.2)" }}>
                  <Clock size={8} /> {etaChip}
                </span>
              )}
              {isSearching && (
                <>
                  <span className="pill" style={{ background: "#FFF8E6", color: "#CC7A00", border: "1px solid #FFE099" }}>
                    <Users size={8} /> {(ride.candidateDriverUids ?? []).length}
                  </span>
                  <span className="pill" style={{ background: Object.keys(ride.emailSentToDrivers ?? {}).length > 0 ? "#E6FFF3" : "var(--bg-soft)", color: Object.keys(ride.emailSentToDrivers ?? {}).length > 0 ? "#00A659" : "var(--ink-4)", border: "1px solid var(--border)" }}>
                    <Mail size={8} /> {Object.keys(ride.emailSentToDrivers ?? {}).length}
                  </span>
                  <span className="pill" style={{ background: Object.keys(ride.pushSentToDrivers ?? {}).length > 0 ? "#EDF2FF" : "var(--bg-soft)", color: Object.keys(ride.pushSentToDrivers ?? {}).length > 0 ? "#2F6FED" : "var(--ink-4)", border: "1px solid var(--border)" }}>
                    <Zap size={8} /> {Object.keys(ride.pushSentToDrivers ?? {}).length}
                  </span>
                </>
              )}
            </div>
            <span style={{ fontSize: 10.5, color: "var(--ink-5)", fontWeight: 600, fontFamily: "var(--mono)", whiteSpace: "nowrap" }}>{timeAgo(ride.createdAt)}</span>
          </div>

          {/* Payment row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 9, borderTop: "1px solid var(--border)", flexWrap: "wrap", gap: 6 }}>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              <span className="pill" style={{ background: ride.paymentMethod === "cashapp" ? "#E6FFF3" : "#EDF2FF", color: ride.paymentMethod === "cashapp" ? "#00A659" : "#2F6FED", border: "none" }}>
                {ride.paymentMethod === "cashapp" ? "Cash App" : ride.paymentMethod === "card" ? "Card" : (ride.paymentMethod ?? "—")}
              </span>
              <span className="pill" style={{ background: pm.bg, color: pm.color }}>{pm.label}</span>
              <span className="pill" style={{ background: po.bg, color: po.color }}>{po.label}</span>
            </div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-4)", fontWeight: 500, display: "flex", gap: 6 }}>
              <span><span style={{ color: "#00A659", fontWeight: 700 }}>${ride.driverPayout?.toFixed(2) ?? "—"}</span> drv</span>
              <span style={{ color: "var(--border-strong)" }}>·</span>
              <span><span style={{ color: "#2F6FED", fontWeight: 700 }}>${ride.platformFee?.toFixed(2) ?? "—"}</span> fee</span>
            </div>
          </div>
        </div>

        <StatusBar ride={ride} />
      </div>

      {showMsg && <MessageModal ride={ride} driverName={ride.driverName} onClose={() => setShowMsg(false)} />}
    </>
  );
}

/* ─── Weekly Chart ───────────────────────────────────────────────── */
function WeekChart({ rides = [] }) {
  const now = new Date();
  const sunday = new Date(now);
  sunday.setHours(0, 0, 0, 0);
  sunday.setDate(now.getDate() - now.getDay());

  const buckets = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday); d.setDate(sunday.getDate() + i);
    return { label: DAYS[d.getDay()], dateStr: d.toDateString(), isToday: d.toDateString() === now.toDateString(), isFuture: d > now, rides: 0, fare: 0, platform: 0, payout: 0 };
  });

  rides.filter(r => r.status === "completed").forEach(r => {
    const ms = tsToMs(r.completedAt ?? r.updatedAt ?? r.createdAt); if (!ms) return;
    const d = new Date(ms); d.setHours(0, 0, 0, 0);
    const idx = buckets.findIndex(b => b.dateStr === d.toDateString()); if (idx === -1) return;
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
    <div className="card fade-up" style={{ marginBottom: 12, animationDelay: "60ms", overflow: "hidden" }}>
      <div style={{ padding: "18px 20px 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <BarChart3 size={13} color="var(--ink-4)" />
            <span style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)", letterSpacing: "-.02em" }}>This Week</span>
            <span className="pill" style={{ background: "var(--bg-soft)", color: "var(--ink-3)", border: "1px solid var(--border)" }}>{totalRides} rides</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-5)", fontWeight: 500 }}>Sun – Sat · completed rides</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--ink)", letterSpacing: "-.05em", lineHeight: 1, fontFamily: "var(--mono)" }}>${totalFare.toFixed(2)}</div>
          <div style={{ fontSize: 9.5, color: "var(--ink-5)", fontWeight: 700, marginTop: 3, letterSpacing: ".06em", textTransform: "uppercase" }}>Total Fare</div>
        </div>
      </div>

      <div style={{ padding: "18px 20px 4px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 92 }}>
          {buckets.map((b, i) => {
            const pct = b.isFuture ? 0 : Math.max((b.fare / maxFare) * 100, b.rides > 0 ? 8 : 0);
            const isH = hov === i;
            return (
              <div key={b.label} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}
                style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "default" }}>
                {!b.isFuture && b.rides > 0
                  ? <div style={{ fontSize: 9, fontFamily: "var(--mono)", color: b.isToday ? "var(--green)" : "var(--ink-5)", fontWeight: 600 }}>${b.fare.toFixed(0)}</div>
                  : <div style={{ flex: 1 }} />
                }
                <div className="chart-bar" style={{
                  width: "100%",
                  height: b.isFuture ? 4 : `${Math.max(pct, 6)}%`,
                  minHeight: 4,
                  background: b.isFuture
                    ? "var(--bg-soft)"
                    : b.isToday
                    ? "linear-gradient(180deg,#00C16A,#007A42)"
                    : isH ? "var(--ink-2)" : "var(--ink-5)",
                  boxShadow: b.isToday && !b.isFuture ? "0 4px 14px rgba(0,193,106,.35)" : "none",
                  opacity: !b.isToday && !isH && !b.isFuture ? 0.4 : 1,
                }} />
                <div style={{ fontSize: 9.5, color: b.isToday ? "var(--green)" : "var(--ink-5)", fontWeight: b.isToday ? 700 : 500 }}>{b.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {h && !h.isFuture && (
        <div style={{ margin: "0 20px 14px", padding: "11px 14px", background: "var(--bg-soft)", border: "1px solid var(--border)", borderRadius: 12, display: "flex", gap: 20, flexWrap: "wrap" }}>
          {[
            { label: h.label, val: `${h.rides} ride${h.rides !== 1 ? "s" : ""}`, color: "var(--ink)" },
            { label: "Fare",     val: `$${h.fare.toFixed(2)}`,     color: "var(--ink)"   },
            { label: "Platform", val: `$${h.platform.toFixed(2)}`, color: "var(--blue)"  },
            { label: "Driver",   val: `$${h.payout.toFixed(2)}`,   color: "var(--green)" },
          ].map(it => (
            <div key={it.label}>
              <div style={{ fontSize: 9, color: "var(--ink-5)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 3 }}>{it.label}</div>
              <div style={{ fontSize: 15, color: it.color, fontWeight: 800, fontFamily: "var(--mono)", letterSpacing: "-.02em" }}>{it.val}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", borderTop: "1px solid var(--border)" }}>
        {[
          { label: "Total Fare",    val: `$${totalFare.toFixed(2)}`,     color: "var(--ink)"   },
          { label: "Platform Fee",  val: `$${totalPlatform.toFixed(2)}`, color: "var(--blue)"  },
          { label: "Driver Payout", val: `$${totalPayout.toFixed(2)}`,   color: "var(--green)" },
        ].map((it, i) => (
          <div key={it.label} style={{ flex: 1, textAlign: "center", padding: "14px 8px", borderRight: i < 2 ? "1px solid var(--border)" : "none" }}>
            <div style={{ fontSize: 9, color: "var(--ink-5)", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 5 }}>{it.label}</div>
            <div style={{ fontSize: 17, color: it.color, fontWeight: 800, letterSpacing: "-.03em", fontFamily: "var(--mono)" }}>{it.val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Filter Panel ───────────────────────────────────────────────── */
function FilterPanel({ filters, onChange, onClear, count }) {
  return (
    <div className="fade-up" style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: 14, marginBottom: 12, display: "flex", flexDirection: "column", gap: 10 }}>
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
          { key: "status",         opts: [["", "All statuses"], ["searching_driver", "Searching"], ["driver_assigned", "Assigned"], ["arrived", "Arrived"], ["in_progress", "In Progress"], ["completed", "Completed"], ["cancelled", "Cancelled"]] },
          { key: "paymentMethod",  opts: [["", "All payments"], ["card", "Card"], ["cashapp", "Cash App"]] },
          { key: "paymentStatus",  opts: [["", "Pay status"],   ["succeeded", "Paid"], ["pending", "Pending"], ["failed", "Failed"]] },
          { key: "payoutStatus",   opts: [["", "Payout"],       ["processing", "Processing"], ["pending", "Pending"], ["paid", "Paid"], ["failed", "Failed"]] },
        ].map(({ key, opts }) => (
          <div className="sel-wrap" key={key}>
            <select value={filters[key]} onChange={e => onChange(key, e.target.value)}>
              {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <ChevronDown size={11} style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", color: "var(--ink-5)", pointerEvents: "none" }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "var(--ink-5)", fontWeight: 500 }}>{count} ride{count !== 1 ? "s" : ""} matching</span>
        <button onClick={onClear} style={{ fontSize: 11, fontWeight: 700, color: "var(--red)", background: "none", border: "none", cursor: "pointer" }}>Clear all</button>
      </div>
    </div>
  );
}

/* ─── HomeTab ────────────────────────────────────────────────────── */
const DEFAULT_FILTERS = { search: "", status: "", paymentMethod: "", paymentStatus: "", payoutStatus: "" };

export function HomeTab({
  liveRides = [],
  allRides = [],
  allApprovals = [],
  totalAccounts = 0,
  uatobdrivers = [],
  activeRides = [],
  searchingRides = [],
  totalRides = 0,
  activeDrivers = [],
  revenue = 0,
  onToast,
}) {
  const [refreshing,  setRefreshing ] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters,     setFilters    ] = useState(DEFAULT_FILTERS);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => { setRefreshing(false); onToast?.("Data refreshed"); }, 1100);
  };
  const onChange = (k, v) => setFilters(p => ({ ...p, [k]: v }));
  const onClear  = () => setFilters(DEFAULT_FILTERS);
  const activeCount = Object.values(filters).filter(Boolean).length;

  const filtered = useMemo(() => liveRides.filter(ride => {
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
  }), [liveRides, filters]);

  /* KPI strip data */
  const kpis = [
    { val: totalAccounts,         sub: "Accounts",  dot: "#00C16A" },
    { val: uatobdrivers.length,   sub: "Drivers",   dot: "#2F6FED" },
    { val: activeRides.length,    sub: "Active",    dot: "#00C16A" },
    { val: searchingRides.length, sub: "Searching", dot: "#F59500" },
  ];

  /* Stat cards */
  const statRows = [
    { label: "Total Rides",    val: totalRides ?? liveRides.length,              accent: "#2F6FED", Icon: Activity,   delay: 0   },
    { label: "Active Drivers", val: activeDrivers.length,                        accent: "#00C16A", Icon: Car,        delay: 50  },
    { label: "Revenue Today",  val: revenue != null ? `$${revenue.toFixed(2)}` : "—", accent: "#F59500", Icon: DollarSign, delay: 100 },
    { label: "Pending Apps",   val: allApprovals.length,                         accent: "#E8383A", Icon: Shield,     delay: 150 },
  ];

  return (
    <>
      <style>{CSS}</style>
      <div className="ht" style={{ padding: "0 14px 48px" }}>

        {/* ── KPI strip ── */}
        <div className="card fade-up" style={{ padding: "11px 14px", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ display: "flex", gap: 0, overflowX: "auto", flex: 1 }}>
              {kpis.map(({ val, sub, dot }, i) => (
                <div key={sub} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 14px", borderRight: i < 3 ? "1px solid var(--border)" : "none", flexShrink: 0 }}>
                  <div className="live-dot" style={{ background: dot, color: dot }} />
                  <span style={{ fontSize: 18, fontWeight: 800, color: "var(--ink)", letterSpacing: "-.03em", fontFamily: "var(--mono)" }}>{val}</span>
                  <span style={{ fontSize: 11, color: "var(--ink-5)", fontWeight: 500 }}>{sub}</span>
                </div>
              ))}
            </div>
            <button onClick={handleRefresh} style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid var(--border-mid)", background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--ink-4)", flexShrink: 0, transition: "all .15s" }}>
              <RefreshCw size={13} className={refreshing ? "spin" : ""} />
            </button>
          </div>
        </div>

        {/* ── Stat cards (2-col grid) ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
          {statRows.map(({ label, val, accent, Icon, delay }) => (
            <div key={label} className="card card-hover fade-up" style={{ padding: 15, animationDelay: `${delay}ms`, overflow: "hidden", position: "relative" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2.5, background: accent, opacity: .9, borderRadius: "18px 18px 0 0" }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 11 }}>
                <div style={{ width: 33, height: 33, borderRadius: 10, background: `${accent}14`, border: `1px solid ${accent}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={14} color={accent} strokeWidth={2.3} />
                </div>
                <ArrowUpRight size={11} color="var(--ink-5)" />
              </div>
              <div style={{ fontSize: 25, color: "var(--ink)", fontWeight: 800, letterSpacing: "-.05em", lineHeight: 1, fontFamily: "var(--mono)", marginBottom: 5 }}>{val}</div>
              <div style={{ fontSize: 11, color: "var(--ink-5)", fontWeight: 600, letterSpacing: ".01em" }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── Weekly chart ── */}
        <WeekChart rides={allRides.length > 0 ? allRides : liveRides} />

        {/* ── Rides header ── */}
        <div className="fade-up" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, animationDelay: "180ms" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)", letterSpacing: "-.03em" }}>Live Rides</span>
            <div className="live-dot blink" style={{ background: "#00C16A", color: "#00C16A", width: 7, height: 7 }} />
            {liveRides.length > 0 && (
              <span style={{ fontSize: 11, color: "var(--ink-5)", fontWeight: 600, fontFamily: "var(--mono)" }}>{filtered.length}/{liveRides.length}</span>
            )}
          </div>
          <button onClick={() => setShowFilters(p => !p)} className={`action-btn ${showFilters || activeCount > 0 ? "active" : ""}`}>
            <Filter size={11} />
            Filter
            {activeCount > 0 && (
              <span style={{ width: 17, height: 17, borderRadius: "50%", background: "rgba(255,255,255,.25)", fontSize: 9.5, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {activeCount}
              </span>
            )}
          </button>
        </div>

        {showFilters && <FilterPanel filters={filters} onChange={onChange} onClear={onClear} count={filtered.length} />}

        {/* ── Ride list ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.length === 0 && (
            <div className="card" style={{ textAlign: "center", padding: "52px 24px" }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: "var(--bg-soft)", margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Sparkles size={22} color="var(--ink-5)" />
              </div>
              <div style={{ fontSize: 14.5, color: "var(--ink)", fontWeight: 800, marginBottom: 5, letterSpacing: "-.02em" }}>No rides found</div>
              <div style={{ fontSize: 12, color: "var(--ink-5)", fontWeight: 500 }}>{activeCount > 0 ? "Try clearing some filters" : "Waiting for new rides…"}</div>
            </div>
          )}
          {filtered.map((ride, i) => <RideCard key={ride.id} ride={ride} index={i} />)}
        </div>
      </div>
    </>
  );
}
