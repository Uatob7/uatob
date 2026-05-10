import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  MapPin, Navigation, Clock, Ruler, User, Search,
  ChevronRight, X, Route, Map as MapIcon, TrendingUp,
  Maximize2, Minimize2, ArrowRight, Car, Banknote,
  Users, UserX, Shield, CheckCircle, Hash, Mail,
  AlertTriangle, Zap, Radio, Timer, Sparkles, Crown,
  Activity, ArrowDown, Filter,
} from "lucide-react";
import { useSearches } from "@/App/Admin/useSearches";
import { useAccounts } from "@/App/Admin/useAccounts";

// ─── CONFIG ────────────────────────────────────────────────────────────────
const MAPBOX_TOKEN = "pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA";

// ─── DESIGN SYSTEM (refined) ──────────────────────────────────────────────
const D = {
  // Surfaces
  bg:       "transparent",
  bgCard:   "#FFFFFF",
  bgMid:    "#F8FAFC",
  bgSoft:   "#FAFAF9",        // warmer, paper-like
  bgHero:   "#0A1628",        // editorial dark hero
  bgHover:  "#F0FDFA",

  // Borders
  border:   "rgba(15,23,42,.06)",
  borderMd: "rgba(15,23,42,.1)",
  borderLg: "rgba(15,23,42,.18)",

  // Text
  t0: "#020617",   // ink (titles)
  t1: "#0F172A",   // body strong
  t2: "#1E293B",
  t3: "#64748B",   // muted
  t4: "#94A3B8",   // dim
  t5: "#CBD5E1",   // ghost

  // Brand
  teal:      "#0D9488",
  tealDeep:  "#0F766E",
  tealDim:   "rgba(13,148,136,.07)",
  tealMid:   "rgba(13,148,136,.14)",
  amber:     "#D97706",
  amberDeep: "#B45309",
  amberDim:  "rgba(217,119,6,.07)",
  amberMid:  "rgba(217,119,6,.14)",

  // Status
  red:      "#DC2626",
  redDim:   "rgba(220,38,38,.07)",
  green:    "#16A34A",
  greenDim: "rgba(22,163,74,.08)",
  blue:     "#2563EB",
  blueDim:  "rgba(37,99,235,.08)",
  purple:   "#7C3AED",
};

const display = "'Syne', system-ui, sans-serif";
const sans    = "'DM Sans', system-ui, sans-serif";
const mono    = "'JetBrains Mono', monospace";

const TIER = {
  economy:  { label: "Economy",  color: "#0D9488", bg: "rgba(13,148,136,.06)",  grad: "linear-gradient(135deg,#0D9488,#0891B2)" },
  standard: { label: "Standard", color: "#2563EB", bg: "rgba(37,99,235,.06)",   grad: "linear-gradient(135deg,#2563EB,#7C3AED)" },
  premium:  { label: "Premium",  color: "#7C3AED", bg: "rgba(124,58,237,.06)",  grad: "linear-gradient(135deg,#7C3AED,#DB2777)" },
  xl:       { label: "XL",       color: "#D97706", bg: "rgba(217,119,6,.06)",   grad: "linear-gradient(135deg,#D97706,#DC2626)" },
};

// ─── MAPBOX SINGLETON ─────────────────────────────────────────────────────
let _mbReady = false, _mbQ = [];
function loadMapbox(cb) {
  if (_mbReady && window.mapboxgl) { cb(); return; }
  _mbQ.push(cb);
  if (document.getElementById("mb-css-st")) { if (_mbReady) cb(); return; }
  const lnk = document.createElement("link");
  lnk.id = "mb-css-st"; lnk.rel = "stylesheet";
  lnk.href = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css";
  document.head.appendChild(lnk);
  const s = document.createElement("script");
  s.src = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js";
  s.onload = () => { _mbReady = true; _mbQ.forEach(f => f()); _mbQ = []; };
  document.head.appendChild(s);
}

// ─── HELPERS ──────────────────────────────────────────────────────────────
function fmtTime(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}
function fmtRelative(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60)    return "just now";
  if (diff < 3600)  return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function strip(addr) {
  if (!addr) return "—";
  return addr.replace(/, (Orlando|Tampa|FL|USA),?.*$/i, "").trim();
}
function isGuest(s)       { return !s.uid || s.uid === "null" || s.uid === null; }
function hasBothCoords(s) {
  return typeof s.pickupLat  === "number" && typeof s.pickupLng  === "number"
      && typeof s.dropoffLat === "number" && typeof s.dropoffLng === "number";
}
function hashHue(uid) {
  let h = 0;
  for (let i = 0; i < (uid || "").length; i++) h = (h * 31 + uid.charCodeAt(i)) & 0xffffff;
  return h % 360;
}
function initials(n) {
  if (!n) return "?";
  const p = n.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : n.slice(0, 2).toUpperCase();
}

// ─── AVATAR ───────────────────────────────────────────────────────────────
function Avatar({ account, size = 36, guest = false }) {
  if (guest) return (
    <div style={{ width: size, height: size, borderRadius: size * 0.32, background: D.amberDim, border: `1.5px solid ${D.amber}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <UserX size={size * 0.42} color={D.amber} />
    </div>
  );
  if (!account) return (
    <div style={{ width: size, height: size, borderRadius: size * 0.32, background: D.tealDim, border: `1.5px solid ${D.teal}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <User size={size * 0.42} color={D.teal} />
    </div>
  );
  const hue = hashHue(account.uid);
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.32,
      background: `linear-gradient(135deg, hsl(${hue},65%,93%), hsl(${hue},58%,86%))`,
      border: `1.5px solid hsl(${hue},45%,75%)`,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      fontSize: size * 0.34, fontWeight: 800, color: `hsl(${hue},55%,28%)`,
      fontFamily: display, letterSpacing: "-.02em",
      boxShadow: `0 1px 3px hsl(${hue},45%,80%, .4)`,
    }}>
      {initials(account.name)}
    </div>
  );
}

// ─── SECTION LABEL ────────────────────────────────────────────────────────
function SectionLabel({ children, accent }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <div style={{ width: 3, height: 12, borderRadius: 99, background: accent ?? D.t1 }} />
      <div style={{ fontFamily: sans, fontSize: 10.5, fontWeight: 800, color: D.t2, letterSpacing: ".12em", textTransform: "uppercase" }}>
        {children}
      </div>
    </div>
  );
}

// ─── EDITORIAL HERO ────────────────────────────────────────────────────────
function HeroHeader({ searches, accounts }) {
  const total     = searches.length;
  const guests    = searches.filter(isGuest).length;
  const riders    = total - guests;
  const matched   = searches.filter(s => s.driverInfo?.driverCount > 0).length;
  const matchRate = total ? Math.round((matched / total) * 100) : 0;
  const last      = searches[0];

  return (
    <div style={{
      position: "relative", marginBottom: 18, borderRadius: 22, overflow: "hidden",
      background: `linear-gradient(135deg, ${D.bgHero} 0%, #0F172A 60%, #134E4A 100%)`,
      boxShadow: "0 12px 40px rgba(10,22,40,.18)",
      animation: "fadeUp .5s ease both",
    }}>
      {/* Decorative grid */}
      <div style={{
        position: "absolute", inset: 0, opacity: .12,
        backgroundImage: `linear-gradient(rgba(255,255,255,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.4) 1px, transparent 1px)`,
        backgroundSize: "40px 40px",
        maskImage: "radial-gradient(ellipse at top right, black 10%, transparent 70%)",
        WebkitMaskImage: "radial-gradient(ellipse at top right, black 10%, transparent 70%)",
      }} />
      {/* Glow blobs */}
      <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(13,148,136,.4), transparent 70%)", filter: "blur(20px)" }} />
      <div style={{ position: "absolute", bottom: -40, left: -40, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, rgba(217,119,6,.25), transparent 70%)", filter: "blur(16px)" }} />

      <div style={{ position: "relative", padding: "22px 22px 20px" }}>
        {/* Top line */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 99, background: "rgba(13,148,136,.18)", border: "1px solid rgba(13,148,136,.4)" }}>
            <div className="liveDot" style={{ width: 6, height: 6, borderRadius: "50%", background: "#5EEAD4", boxShadow: "0 0 8px #5EEAD4" }} />
            <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color: "#5EEAD4", letterSpacing: ".08em" }}>LIVE FEED</span>
          </div>
          {last && (
            <span style={{ fontFamily: sans, fontSize: 11, color: "rgba(255,255,255,.5)" }}>
              Last activity {fmtRelative(last.createdAt)}
            </span>
          )}
        </div>

        {/* Title */}
        <div style={{
          fontFamily: display, fontSize: 28, fontWeight: 800,
          color: "#fff", letterSpacing: "-.04em", lineHeight: 1.05, marginBottom: 4,
        }}>
          Search Stream
        </div>
        <div style={{ fontFamily: sans, fontSize: 13, color: "rgba(255,255,255,.6)", fontWeight: 500, marginBottom: 18 }}>
          What riders are looking for, in real time
        </div>

        {/* Hero stats grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr", gap: 10 }}>
          {/* Total — featured */}
          <div style={{
            background: "rgba(255,255,255,.06)", backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,.1)", borderRadius: 14, padding: "12px 14px",
          }}>
            <div style={{ fontFamily: sans, fontSize: 9.5, color: "rgba(255,255,255,.55)", fontWeight: 700, letterSpacing: ".09em", textTransform: "uppercase", marginBottom: 6 }}>
              Total Searches
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontFamily: display, fontSize: 32, fontWeight: 800, color: "#fff", letterSpacing: "-.05em", lineHeight: 1 }}>{total}</span>
              <div style={{ display: "flex", gap: 6, marginLeft: 4, alignItems: "center" }}>
                <span style={{ fontFamily: mono, fontSize: 10, color: "#5EEAD4", fontWeight: 700 }}>{riders}R</span>
                <span style={{ fontFamily: mono, fontSize: 10, color: "#FBBF24", fontWeight: 700 }}>{guests}G</span>
              </div>
            </div>
          </div>

          {/* Match rate */}
          <div style={{
            background: "rgba(255,255,255,.06)", backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,.1)", borderRadius: 14, padding: "12px 14px",
          }}>
            <div style={{ fontFamily: sans, fontSize: 9.5, color: "rgba(255,255,255,.55)", fontWeight: 700, letterSpacing: ".09em", textTransform: "uppercase", marginBottom: 6 }}>
              Match Rate
            </div>
            <div style={{ display: "flex", alignItems: "baseline" }}>
              <span style={{ fontFamily: display, fontSize: 22, fontWeight: 800, color: matchRate > 70 ? "#5EEAD4" : matchRate > 40 ? "#FBBF24" : "#FCA5A5", letterSpacing: "-.04em", lineHeight: 1 }}>
                {matchRate}
              </span>
              <span style={{ fontFamily: display, fontSize: 14, color: "rgba(255,255,255,.4)", fontWeight: 700, marginLeft: 1 }}>%</span>
            </div>
          </div>

          {/* Accounts */}
          <div style={{
            background: "rgba(255,255,255,.06)", backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,.1)", borderRadius: 14, padding: "12px 14px",
          }}>
            <div style={{ fontFamily: sans, fontSize: 9.5, color: "rgba(255,255,255,.55)", fontWeight: 700, letterSpacing: ".09em", textTransform: "uppercase", marginBottom: 6 }}>
              Accounts
            </div>
            <div style={{ fontFamily: display, fontSize: 22, fontWeight: 800, color: "#fff", letterSpacing: "-.04em", lineHeight: 1 }}>
              {accounts.length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── DRIVER PANEL ─────────────────────────────────────────────────────────
function DriverPanel({ driverInfo }) {
  if (!driverInfo) return null;
  const { driverCount, nearestMiles, etaLabel, etaMin, stale } = driverInfo;
  const hasDriver    = driverCount > 0;
  const urgency      = etaMin <= 15 ? "fast" : etaMin <= 45 ? "medium" : "slow";
  const urgencyColor = urgency === "fast" ? D.green : urgency === "medium" ? D.amber : D.red;

  return (
    <div style={{ marginBottom: 20 }}>
      <SectionLabel accent={hasDriver ? D.teal : D.red}>Driver Intelligence</SectionLabel>
      <div style={{
        borderRadius: 18, border: `1px solid ${hasDriver ? D.teal + "25" : D.red + "20"}`,
        overflow: "hidden", background: D.bgCard,
        boxShadow: "0 1px 3px rgba(15,23,42,.04), 0 4px 14px rgba(15,23,42,.06)",
      }}>
        <div style={{ height: 3, background: hasDriver ? `linear-gradient(90deg,${D.teal},${D.blue})` : `linear-gradient(90deg,${D.red},${D.amber})` }} />
        <div style={{ padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 13,
                background: hasDriver ? D.tealMid : D.redDim,
                border: `1px solid ${hasDriver ? D.teal + "30" : D.red + "30"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Car size={19} color={hasDriver ? D.teal : D.red} />
              </div>
              <div>
                <div style={{ fontFamily: display, fontSize: 16, fontWeight: 800, color: D.t0, letterSpacing: "-.025em" }}>
                  {hasDriver ? `${driverCount} Driver${driverCount > 1 ? "s" : ""} Available` : "No Drivers Nearby"}
                </div>
                <div style={{ fontFamily: sans, fontSize: 11.5, color: D.t3, marginTop: 2 }}>
                  {hasDriver ? "Ready to accept this route" : "No drivers matched"}
                </div>
              </div>
            </div>
            {stale && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 99, background: D.amberDim, border: `1px solid ${D.amber}30` }}>
                <AlertTriangle size={10} color={D.amber} />
                <span style={{ fontFamily: sans, fontSize: 10, fontWeight: 700, color: D.amber, letterSpacing: ".04em" }}>STALE</span>
              </div>
            )}
          </div>
          {hasDriver && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <DriverMetric icon={<Radio size={12} color={D.teal} />}        label="Drivers"  value={driverCount}              color={D.teal}       unit="" />
              <DriverMetric icon={<Ruler size={12} color={urgencyColor} />}  label="Nearest"  value={nearestMiles?.toFixed(1)} color={urgencyColor} unit="mi" />
              <DriverMetric icon={<Timer size={12} color={urgencyColor} />}  label="ETA"      value={etaMin}                   color={urgencyColor} unit="min" sub={etaLabel} />
            </div>
          )}
          {hasDriver && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontFamily: sans, fontSize: 10, fontWeight: 700, color: D.t4, letterSpacing: ".07em", textTransform: "uppercase" }}>Pickup ETA</span>
                <span style={{ fontFamily: mono, fontSize: 11, color: urgencyColor, fontWeight: 700 }}>{etaLabel}</span>
              </div>
              <div style={{ height: 6, borderRadius: 99, background: D.bgMid, overflow: "hidden", border: `1px solid ${D.border}` }}>
                <div style={{
                  height: "100%", borderRadius: 99,
                  background: `linear-gradient(90deg,${urgencyColor},${urgencyColor}88)`,
                  width: `${Math.max(5, Math.min(100, 100 - (etaMin / 120) * 100))}%`,
                  transition: "width .6s cubic-bezier(.22,1,.36,1)",
                  boxShadow: `0 0 6px ${urgencyColor}40`,
                }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
                <span style={{ fontFamily: sans, fontSize: 9.5, color: D.t4 }}>Fast</span>
                <span style={{ fontFamily: sans, fontSize: 9.5, color: D.t4 }}>2hr+</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DriverMetric({ icon, label, value, color, unit, sub }) {
  return (
    <div style={{ background: D.bgSoft, border: `1px solid ${D.border}`, borderRadius: 12, padding: "11px 13px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 7 }}>
        {icon}
        <span style={{ fontFamily: sans, fontSize: 9.5, fontWeight: 700, color: D.t4, textTransform: "uppercase", letterSpacing: ".08em" }}>{label}</span>
      </div>
      <div style={{ fontFamily: display, fontSize: 22, fontWeight: 800, color, letterSpacing: "-.035em", lineHeight: 1 }}>
        {value}<span style={{ fontSize: 11, fontWeight: 600, color: D.t3, marginLeft: 2 }}>{unit}</span>
      </div>
      {sub && <div style={{ fontFamily: mono, fontSize: 9.5, color: D.t3, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ─── FARE GRID (with cheapest indicator) ──────────────────────────────────
function FareGrid({ rides }) {
  if (!rides) return null;
  const keys = ["economy", "standard", "premium", "xl"].filter(k => rides[k]);
  if (!keys.length) return null;

  // Identify cheapest
  const cheapest = keys.reduce((min, k) => {
    const t = parseFloat(rides[k]?.total ?? 0);
    return min == null || t < parseFloat(rides[min]?.total ?? Infinity) ? k : min;
  }, null);

  return (
    <div style={{ marginBottom: 20 }}>
      <SectionLabel accent={D.teal}>Fare Options Shown</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {keys.map(k => {
          const t   = rides[k];
          const cfg = TIER[k] ?? { label: k, color: D.t3, bg: D.bgMid, grad: "linear-gradient(135deg,#CBD5E1,#94A3B8)" };
          const isCheapest = k === cheapest;
          return (
            <div key={k} style={{
              borderRadius: 16, overflow: "hidden",
              border: `1px solid ${isCheapest ? cfg.color + "50" : D.border}`,
              background: D.bgCard,
              boxShadow: isCheapest ? `0 0 0 2px ${cfg.color}15, 0 4px 14px rgba(15,23,42,.06)` : "0 1px 3px rgba(15,23,42,.05)",
              position: "relative",
            }}>
              {isCheapest && (
                <div style={{
                  position: "absolute", top: 8, right: 8, zIndex: 2,
                  display: "flex", alignItems: "center", gap: 3,
                  padding: "2px 7px", borderRadius: 99,
                  background: cfg.grad,
                  fontFamily: sans, fontSize: 9, fontWeight: 800,
                  color: "#fff", letterSpacing: ".05em",
                  boxShadow: `0 2px 6px ${cfg.color}40`,
                }}>
                  <Sparkles size={8} /> BEST
                </div>
              )}
              <div style={{ height: 3, background: cfg.grad }} />
              <div style={{ padding: "13px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                  <span style={{ fontFamily: display, fontSize: 12, fontWeight: 800, color: cfg.color, letterSpacing: "-.01em" }}>
                    {cfg.label}
                  </span>
                </div>
                <div style={{ fontFamily: display, fontSize: 24, fontWeight: 800, color: D.t0, letterSpacing: "-.04em", lineHeight: 1, marginBottom: 4 }}>
                  ${t.total}
                </div>
                <div style={{ fontFamily: sans, fontSize: 10.5, color: D.t3, marginBottom: 7 }}>{t.eta}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, paddingTop: 7, borderTop: `1px solid ${D.border}` }}>
                  <Users size={9} color={D.t4} />
                  <span style={{ fontFamily: sans, fontSize: 10, color: D.t4, fontWeight: 600 }}>Up to {t.capacity}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── MAP ──────────────────────────────────────────────────────────────────
function SearchMapView({ searches = [], selectedId, hoveredId, onSelect, height = 320 }) {
  const ref         = useRef(null);
  const mapRef      = useRef(null);
  const initRef     = useRef(false);
  const [ready,     setReady]    = useState(false);
  const [expanded,  setExpanded] = useState(false);
  const h = expanded ? 540 : height;

  const mapStyle = "mapbox://styles/mapbox/light-v11";

  const routeFeats = useMemo(() => searches.filter(hasBothCoords).map(s => ({
    type: "Feature",
    properties: {
      id: s.id, guest: isGuest(s), sel: s.id === selectedId, hov: s.id === hoveredId,
      color: s.id === selectedId ? D.t0
           : s.id === hoveredId  ? (isGuest(s) ? D.amber : D.teal)
           : isGuest(s) ? D.amber : D.teal,
    },
    geometry: { type: "LineString", coordinates: [[s.pickupLng, s.pickupLat], [s.dropoffLng, s.dropoffLat]] },
  })), [searches, selectedId, hoveredId]);

  const pickFeat = useMemo(() => searches.filter(s => s.pickupLat && s.pickupLng).map(s => ({
    type: "Feature",
    properties: {
      id: s.id, sel: s.id === selectedId, hov: s.id === hoveredId,
      color: s.id === selectedId ? D.t0
           : s.id === hoveredId  ? (isGuest(s) ? D.amber : D.teal)
           : isGuest(s) ? D.amber : D.teal,
    },
    geometry: { type: "Point", coordinates: [s.pickupLng, s.pickupLat] },
  })), [searches, selectedId, hoveredId]);

  const dropFeat = useMemo(() => searches.filter(hasBothCoords).map(s => ({
    type: "Feature",
    properties: {
      id: s.id, sel: s.id === selectedId, hov: s.id === hoveredId,
      color: s.id === selectedId ? D.t0
           : s.id === hoveredId  ? (isGuest(s) ? D.amber : D.teal)
           : isGuest(s) ? D.amber : D.teal,
    },
    geometry: { type: "Point", coordinates: [s.dropoffLng, s.dropoffLat] },
  })), [searches, selectedId, hoveredId]);

  const fitAll = useCallback(() => {
    const m = mapRef.current;
    if (!m || !searches.length) return;
    const lats = searches.flatMap(s => [s.pickupLat, s.dropoffLat].filter(v => typeof v === "number"));
    const lngs = searches.flatMap(s => [s.pickupLng, s.dropoffLng].filter(v => typeof v === "number"));
    if (!lats.length) return;
    m.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: { top: 60, bottom: 60, left: 50, right: 50 }, maxZoom: 13, duration: 800 }
    );
  }, [searches]);

  useEffect(() => {
    if (!ref.current || initRef.current) return;
    loadMapbox(() => {
      if (!ref.current || initRef.current) return;
      initRef.current = true;
      window.mapboxgl.accessToken = MAPBOX_TOKEN;
      const map = new window.mapboxgl.Map({
        container: ref.current,
        style: mapStyle,
        center: [-81.3792, 28.5383], zoom: 10,
        attributionControl: false, fadeDuration: 0,
      });
      mapRef.current = map;
      map.addControl(new window.mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      map.on("load", () => {
        ["routes", "pickups", "dropoffs"].forEach(id =>
          map.addSource(id, { type: "geojson", data: { type: "FeatureCollection", features: [] } })
        );
        map.addLayer({ id: "rl-glow", type: "line", source: "routes",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": ["get", "color"], "line-width": 14, "line-opacity": ["case", ["get", "sel"], .25, ["get", "hov"], .18, .06], "line-blur": 6 },
        });
        map.addLayer({ id: "rl-line", type: "line", source: "routes",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": ["get", "color"], "line-width": ["case", ["get", "sel"], 3.5, ["get", "hov"], 2.8, 2], "line-opacity": ["case", ["get", "sel"], 1, ["get", "hov"], .9, .5] },
        });
        map.addLayer({ id: "pk-halo", type: "circle", source: "pickups",
          paint: { "circle-color": ["get", "color"], "circle-radius": ["case", ["get", "sel"], 20, ["get", "hov"], 15, 10], "circle-opacity": .14, "circle-blur": 1 },
        });
        map.addLayer({ id: "pk-dot", type: "circle", source: "pickups",
          paint: { "circle-color": ["get", "color"], "circle-radius": ["case", ["get", "sel"], 8, ["get", "hov"], 6.5, 5], "circle-stroke-color": "#fff", "circle-stroke-width": ["case", ["get", "sel"], 3, 1.8], "circle-opacity": ["case", ["get", "sel"], 1, ["get", "hov"], .95, .8] },
        });
        map.addLayer({ id: "dr-halo", type: "circle", source: "dropoffs",
          paint: { "circle-color": ["get", "color"], "circle-radius": ["case", ["get", "sel"], 16, ["get", "hov"], 13, 9], "circle-opacity": .12, "circle-blur": 1 },
        });
        map.addLayer({ id: "dr-dot", type: "circle", source: "dropoffs",
          paint: { "circle-color": ["get", "color"], "circle-radius": ["case", ["get", "sel"], 7, ["get", "hov"], 5.5, 4], "circle-stroke-color": "#fff", "circle-stroke-width": ["case", ["get", "sel"], 3, 1.8], "circle-opacity": ["case", ["get", "sel"], 1, ["get", "hov"], .9, .7] },
        });
        ["pk-dot", "dr-dot"].forEach(l => {
          map.on("click", l, e => { const id = e.features?.[0]?.properties?.id; if (id) onSelect(id); });
          map.on("mouseenter", l, () => { map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", l, () => { map.getCanvas().style.cursor = ""; });
        });
        setReady(true);
      });
    });
    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; initRef.current = false; setReady(false); }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current?.isStyleLoaded()) return;
    mapRef.current.getSource("routes")  ?.setData({ type: "FeatureCollection", features: routeFeats });
    mapRef.current.getSource("pickups") ?.setData({ type: "FeatureCollection", features: pickFeat  });
    mapRef.current.getSource("dropoffs")?.setData({ type: "FeatureCollection", features: dropFeat  });
  }, [ready, routeFeats, pickFeat, dropFeat]);

  useEffect(() => { if (ready && searches.length) setTimeout(fitAll, 200); }, [ready]); // eslint-disable-line

  useEffect(() => {
    if (!selectedId || !mapRef.current || !ready) return;
    const s = searches.find(x => x.id === selectedId);
    if (!s) return;
    if (hasBothCoords(s)) {
      mapRef.current.fitBounds(
        [[Math.min(s.pickupLng, s.dropoffLng), Math.min(s.pickupLat, s.dropoffLat)],
         [Math.max(s.pickupLng, s.dropoffLng), Math.max(s.pickupLat, s.dropoffLat)]],
        { padding: { top: 80, bottom: 80, left: 70, right: 70 }, maxZoom: 15, duration: 850 }
      );
    } else if (s.pickupLat && s.pickupLng) {
      mapRef.current.flyTo({ center: [s.pickupLng, s.pickupLat], zoom: 14, duration: 700 });
    }
  }, [selectedId, searches, ready]);

  useEffect(() => { const t = setTimeout(() => mapRef.current?.resize(), 320); return () => clearTimeout(t); }, [expanded]);

  const guestCt = searches.filter(isGuest).length;
  const riderCt = searches.length - guestCt;
  const mappedCt = searches.filter(hasBothCoords).length;

  return (
    <div style={{
      borderRadius: 20, overflow: "hidden",
      border: `1px solid ${D.border}`, marginBottom: 16,
      background: D.bgCard,
      boxShadow: "0 1px 3px rgba(15,23,42,.04), 0 8px 28px rgba(15,23,42,.08)",
      animation: "fadeUp .45s ease both",
    }}>
      <style>{`
        .mbst .mapboxgl-ctrl-bottom-left,.mbst .mapboxgl-ctrl-bottom-right{display:none!important}
        .mbst .mapboxgl-ctrl-top-right{margin:12px 12px 0 0!important}
        .mbst .mapboxgl-ctrl-group{background:rgba(255,255,255,.95)!important;border:1px solid rgba(15,23,42,.1)!important;backdrop-filter:blur(12px);box-shadow:0 2px 8px rgba(15,23,42,.08)!important;border-radius:10px!important;overflow:hidden}
        .mbst .mapboxgl-ctrl-group button{background:transparent!important;color:#334155!important}
        .mbst .mapboxgl-ctrl-group button:hover{background:rgba(15,23,42,.04)!important}
      `}</style>

      {/* Header */}
      <div style={{
        padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: `1px solid ${D.border}`, background: D.bgCard,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 11,
            background: `linear-gradient(135deg, ${D.tealDim}, ${D.tealMid})`,
            border: `1.5px solid ${D.teal}25`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Route size={15} color={D.teal} />
          </div>
          <div>
            <div style={{ fontFamily: display, fontSize: 14, fontWeight: 800, color: D.t0, letterSpacing: "-.025em" }}>
              Routes
            </div>
            <div style={{ fontFamily: sans, fontSize: 11, color: D.t3, marginTop: 1 }}>
              {searches.length} searches · {mappedCt} mapped
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <LegendPill color={D.teal}  label="Rider" count={riderCt} glow />
          <LegendPill color={D.amber} label="Guest" count={guestCt} />
          <button
            onClick={() => setExpanded(e => !e)}
            style={{
              width: 32, height: 32, borderRadius: 10,
              border: `1.5px solid ${D.border}`, background: D.bgMid,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: D.t3, transition: "all .15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = D.borderMd; e.currentTarget.style.color = D.t1; e.currentTarget.style.background = D.bgCard; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = D.border; e.currentTarget.style.color = D.t3; e.currentTarget.style.background = D.bgMid; }}
          >
            {expanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </div>
      </div>

      {/* Map canvas */}
      <div className="mbst" style={{ position: "relative", height: h, background: "#EFF3F8", transition: "height .35s cubic-bezier(.32,.72,0,1)" }}>
        <div ref={ref} style={{ width: "100%", height: "100%" }} />
        {searches.length === 0 && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(241,245,249,.97)", zIndex: 20 }}>
            <MapIcon size={26} color={D.t4} style={{ marginBottom: 10 }} />
            <div style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: D.t4 }}>No routes to display</div>
          </div>
        )}
        {searches.length > 0 && (
          <>
            <div style={{ position: "absolute", bottom: 14, left: 14, zIndex: 15, display: "flex", gap: 6 }}>
              <MapChipLight><Dot color={D.teal} glow /> Pickup</MapChipLight>
              <MapChipLight><Dot color={D.t3} /> Dropoff</MapChipLight>
            </div>
            <button onClick={fitAll} style={{
              position: "absolute", bottom: 14, right: 14, zIndex: 15,
              background: "rgba(255,255,255,.94)", backdropFilter: "blur(10px)",
              border: `1.5px solid ${D.border}`, borderRadius: 99, padding: "5px 13px",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
              boxShadow: "0 2px 8px rgba(15,23,42,.08)",
            }}>
              <MapIcon size={11} color={D.t3} />
              <span style={{ fontFamily: sans, fontSize: 10.5, fontWeight: 700, color: D.t3 }}>Fit All</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function LegendPill({ color, label, count, glow }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      background: `${color}0E`, border: `1.5px solid ${color}28`,
      borderRadius: 99, padding: "4px 10px",
    }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, boxShadow: glow ? `0 0 6px ${color}80` : "none" }} />
      <span style={{ fontFamily: sans, fontSize: 10.5, fontWeight: 700, color, letterSpacing: ".04em" }}>{label}</span>
      <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color, background: `${color}1A`, padding: "1px 6px", borderRadius: 5 }}>{count}</span>
    </div>
  );
}
function MapChipLight({ children }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 5,
      background: "rgba(255,255,255,.94)", backdropFilter: "blur(10px)",
      border: `1.5px solid ${D.border}`, borderRadius: 99, padding: "5px 11px",
      fontFamily: sans, fontSize: 10.5, fontWeight: 700, color: D.t3, letterSpacing: ".04em",
      boxShadow: "0 1px 4px rgba(15,23,42,.06)",
    }}>
      {children}
    </div>
  );
}
function Dot({ color, glow }) {
  return <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, boxShadow: glow ? `0 0 5px ${color}80` : "none", flexShrink: 0 }} />;
}

// ─── SEARCH CARD (magazine style) ─────────────────────────────────────────
function SearchCard({ doc, index, selected, hovered, onHover, onLeave, onClick, account }) {
  const guest  = isGuest(doc);
  const ac     = guest ? D.amber : D.teal;
  const isAct  = selected || hovered;
  const hasDriver = doc.driverInfo?.driverCount > 0;

  return (
    <div
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      style={{
        background:   selected ? D.bgHover : D.bgCard,
        border:       selected ? `1.5px solid ${ac}55` : `1px solid ${D.border}`,
        borderRadius: 18, overflow: "hidden", cursor: "pointer",
        boxShadow:    selected ? `0 0 0 3px ${ac}15, 0 12px 28px rgba(15,23,42,.12)` : hovered ? `0 4px 14px rgba(15,23,42,.1)` : "0 1px 3px rgba(15,23,42,.05)",
        transition:   "all .18s cubic-bezier(.4,0,.2,1)",
        animation:    `fadeUp .35s ease ${index * 35}ms both`,
        transform:    hovered && !selected ? "translateY(-2px)" : "none",
      }}
    >
      {/* Top accent stripe */}
      <div style={{ height: 3, background: isAct ? `linear-gradient(90deg,${ac},${ac}55)` : "transparent", transition: "background .2s" }} />

      <div style={{ padding: "14px 16px" }}>
        {/* Header row: avatar + name + time */}
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12 }}>
          <Avatar account={account} guest={guest} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
              <span style={{
                fontFamily: display, fontWeight: 800, fontSize: 15, color: D.t0,
                letterSpacing: "-.022em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {guest ? "Guest Search" : (account?.name ?? "Rider")}
              </span>
              {!guest && account && (
                <div style={{ width: 4, height: 4, borderRadius: "50%", background: D.teal, flexShrink: 0 }} />
              )}
            </div>
            <div style={{
              fontFamily: mono, fontSize: 11, color: D.t3,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {guest ? "Not signed in" : (account?.email ?? doc.uid?.slice(0, 18) + "…")}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
            <span style={{
              fontFamily: mono, fontSize: 10, color: D.t4, fontWeight: 700,
              padding: "2px 7px", borderRadius: 6, background: D.bgMid, border: `1px solid ${D.border}`,
            }}>
              {fmtRelative(doc.createdAt)}
            </span>
            <ChevronRight size={14} color={isAct ? ac : D.t4} style={{ transition: "color .15s" }} />
          </div>
        </div>

        {/* Route — bigger, more editorial */}
        <div style={{
          padding: "12px 14px", background: D.bgSoft,
          borderRadius: 14, border: `1.5px solid ${isAct ? ac + "30" : D.border}`,
          marginBottom: 10, transition: "border-color .15s",
        }}>
          <div style={{ display: "flex", gap: 11, alignItems: "stretch" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0, paddingTop: 3 }}>
              <div style={{
                width: 9, height: 9, borderRadius: "50%", background: ac,
                boxShadow: isAct ? `0 0 8px ${ac}80` : "none", transition: "box-shadow .2s",
              }} />
              <div style={{ width: 1.5, flex: 1, background: `linear-gradient(to bottom, ${ac}, ${ac}30)`, marginTop: 2, marginBottom: 2 }} />
              <div style={{ width: 7, height: 7, borderRadius: 1.5, background: ac, opacity: .55, transform: "rotate(45deg)" }} />
            </div>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 6 }}>
              <div>
                <div style={{ fontFamily: sans, fontSize: 9.5, fontWeight: 700, color: D.t4, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 2 }}>
                  Pickup
                </div>
                <div style={{
                  fontFamily: sans, fontSize: 13.5, fontWeight: 700, color: D.t0,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  letterSpacing: "-.01em",
                }}>
                  {strip(doc.pickup)}
                </div>
              </div>
              <div>
                <div style={{ fontFamily: sans, fontSize: 9.5, fontWeight: 700, color: D.t4, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 2 }}>
                  Dropoff
                </div>
                <div style={{
                  fontFamily: sans, fontSize: 13.5, fontWeight: 700, color: D.t1,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  letterSpacing: "-.01em",
                }}>
                  {strip(doc.dropoff)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {doc.miles   != null && <Chip icon={<Ruler size={9}/>} label={`${doc.miles.toFixed(1)} mi`} />}
          {doc.minutes != null && <Chip icon={<Clock size={9}/>} label={`${doc.minutes}m`} />}
          {doc.driverInfo && <Chip
            icon={<Car size={9}/>}
            label={hasDriver ? `${doc.driverInfo.driverCount} driver${doc.driverInfo.driverCount > 1 ? "s" : ""}` : "No driver"}
            color={hasDriver ? D.green : D.red}
          />}
          <Chip icon={guest ? <UserX size={9}/> : <User size={9}/>} label={guest ? "Guest" : "Rider"} color={ac} />
          {doc.rides?.economy && (
            <Chip icon={<Banknote size={9}/>} label={`from $${doc.rides.economy.total}`} color={D.teal} bold />
          )}
        </div>
      </div>
    </div>
  );
}

function Chip({ icon, label, color, bold }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 9px", borderRadius: 99,
      background: color ? `${color}10` : D.bgMid,
      border: color ? `1.5px solid ${color}30` : `1px solid ${D.border}`,
      fontFamily: sans, fontSize: 11, fontWeight: bold ? 800 : 700,
      color: color ?? D.t3,
    }}>
      {icon}{label}
    </span>
  );
}

// ─── DETAIL SHEET ─────────────────────────────────────────────────────────
function DetailSheet({ doc, account, onClose }) {
  if (!doc) return null;
  const guest = isGuest(doc);
  const ac    = guest ? D.amber : D.teal;
  const mapsUrl = doc.pickupLat && doc.pickupLng
    ? `https://www.google.com/maps/search/?api=1&query=${doc.pickupLat},${doc.pickupLng}` : null;

  return (
    <>
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, zIndex: 400,
        background: "rgba(15,23,42,.4)", backdropFilter: "blur(6px)",
        animation: "fadeIn .22s ease",
      }} />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 401,
        background: D.bgCard, borderRadius: "26px 26px 0 0",
        maxWidth: 660, margin: "0 auto",
        maxHeight: "92vh", overflowY: "auto",
        animation: "sheetUp .32s cubic-bezier(.34,1.1,.64,1)",
        boxShadow: "0 -2px 8px rgba(15,23,42,.06), 0 -16px 56px rgba(15,23,42,.16)",
        border: `1px solid ${D.border}`, borderBottom: "none",
      }}>
        <style>{`
          @keyframes fadeIn  { from{opacity:0}                  to{opacity:1} }
          @keyframes sheetUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
          @keyframes fadeUp  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        `}</style>

        {/* Hero band */}
        <div style={{
          height: 3, background: `linear-gradient(90deg,${ac},${ac}44)`,
          borderRadius: "26px 26px 0 0",
        }} />
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
          <div style={{ width: 44, height: 4, borderRadius: 99, background: D.borderMd }} />
        </div>

        <div style={{ padding: "16px 22px 44px" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <Avatar account={account} guest={guest} size={56} />
              <div>
                <div style={{ fontFamily: display, fontSize: 22, fontWeight: 800, color: D.t0, letterSpacing: "-.035em", lineHeight: 1.1 }}>
                  {guest ? "Guest Search" : (account?.name ?? "Search Detail")}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
                  <Dot color={ac} glow />
                  <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 700, color: ac }}>{guest ? "Guest" : "Rider"}</span>
                  {!guest && account?.email && (
                    <span style={{ fontFamily: mono, fontSize: 11, color: D.t3 }}>· {account.email}</span>
                  )}
                </div>
              </div>
            </div>
            <button onClick={onClose}
              style={{ width: 36, height: 36, borderRadius: "50%", border: `1.5px solid ${D.border}`, background: D.bgMid, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: D.t3, flexShrink: 0, transition: "all .15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#FEE2E2"; e.currentTarget.style.borderColor = "#FECACA"; e.currentTarget.style.color = D.red; }}
              onMouseLeave={e => { e.currentTarget.style.background = D.bgMid;  e.currentTarget.style.borderColor = D.border; e.currentTarget.style.color = D.t3; }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Route summary card */}
          <div style={{
            display: "flex", alignItems: "center", gap: 12, padding: "16px 18px",
            background: `linear-gradient(135deg, ${ac}08, ${ac}03)`,
            border: `1.5px solid ${ac}25`, borderRadius: 18, marginBottom: 22,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: sans, fontSize: 10, fontWeight: 700, color: D.t4, textTransform: "uppercase", letterSpacing: ".09em", marginBottom: 4 }}>
                From
              </div>
              <div style={{
                fontFamily: display, fontSize: 14, fontWeight: 800, color: D.t0,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "-.015em",
              }}>
                {strip(doc.pickup)}
              </div>
            </div>
            <div style={{
              width: 36, height: 36, borderRadius: 11, background: `${ac}15`,
              border: `1.5px solid ${ac}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <ArrowRight size={15} color={ac} />
            </div>
            <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
              <div style={{ fontFamily: sans, fontSize: 10, fontWeight: 700, color: D.t4, textTransform: "uppercase", letterSpacing: ".09em", marginBottom: 4 }}>
                To
              </div>
              <div style={{
                fontFamily: display, fontSize: 14, fontWeight: 800, color: D.t0,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "-.015em",
              }}>
                {strip(doc.dropoff)}
              </div>
            </div>
          </div>

          <DriverPanel driverInfo={doc.driverInfo} />

          {!guest && account && (
            <div style={{ marginBottom: 20 }}>
              <SectionLabel accent={D.teal}>Rider Account</SectionLabel>
              <div style={{
                background: D.bgCard, border: `1px solid ${D.border}`,
                borderRadius: 18, overflow: "hidden",
                boxShadow: "0 1px 6px rgba(15,23,42,.04)",
              }}>
                <div style={{ height: 2, background: `linear-gradient(90deg,${D.teal},${D.blue})` }} />
                <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 13, borderBottom: `1px solid ${D.border}` }}>
                  <Avatar account={account} size={50} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: display, fontSize: 17, fontWeight: 800, color: D.t0, letterSpacing: "-.025em" }}>{account.name}</div>
                    <div style={{ fontFamily: mono, fontSize: 11.5, color: D.t3, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{account.email}</div>
                  </div>
                  {account.welcomeEmailSent && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, background: D.greenDim, border: `1.5px solid ${D.green}25`, borderRadius: 99, padding: "4px 11px", flexShrink: 0 }}>
                      <CheckCircle size={10} color={D.green} />
                      <span style={{ fontFamily: sans, fontSize: 10, fontWeight: 700, color: D.green }}>Verified</span>
                    </div>
                  )}
                </div>
                <div style={{ padding: "12px 18px", display: "flex", flexDirection: "column", gap: 9 }}>
                  {[
                    { icon: <Mail  size={12} color={D.t4} />, label: "Email",  value: account.email, mono: true  },
                    { icon: <Hash  size={12} color={D.t4} />, label: "UID",    value: account.uid,   mono: true  },
                    { icon: <Clock size={12} color={D.t4} />, label: "Joined", value: fmtTime(account.createdAt) },
                  ].map(({ icon, label, value, mono: m }) => (
                    <div key={label} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <div style={{ marginTop: 1, flexShrink: 0 }}>{icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: sans, fontSize: 9.5, fontWeight: 700, color: D.t4, textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 2 }}>{label}</div>
                        <div style={{ fontFamily: m ? mono : sans, fontSize: 12.5, fontWeight: 600, color: D.t1, wordBreak: "break-all" }}>{value || "—"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <SectionLabel accent={D.amber}>Trip Details</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {[
                { label: "Full Pickup",   value: doc.pickup,                                              icon: <Navigation size={13} color={D.teal} /> },
                { label: "Full Dropoff",  value: doc.dropoff,                                             icon: <MapPin     size={13} color={D.amber} /> },
                { label: "Distance",      value: doc.miles   ? `${doc.miles.toFixed(2)} mi`   : null,    icon: <Ruler      size={13} color={D.t4}   /> },
                { label: "Est. Duration", value: doc.minutes ? `${doc.minutes} min`            : null,    icon: <Clock      size={13} color={D.t4}   /> },
                { label: "Searched At",   value: fmtTime(doc.createdAt),                                  icon: <Timer      size={13} color={D.t4}   /> },
              ].map(({ label, value, icon }) => value && (
                <div key={label} style={{
                  display: "flex", gap: 11, alignItems: "flex-start",
                  padding: "11px 14px", borderRadius: 13, background: D.bgSoft,
                  border: `1px solid ${D.border}`,
                }}>
                  <div style={{ marginTop: 2, flexShrink: 0 }}>{icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: sans, fontSize: 9.5, fontWeight: 700, color: D.t4, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 3 }}>{label}</div>
                    <div style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: D.t0, wordBreak: "break-all" }}>{value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <FareGrid rides={doc.rides} />

          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "15px", borderRadius: 16,
              background: `linear-gradient(135deg,${D.teal},${D.tealDeep})`, color: "#fff",
              fontSize: 14, fontWeight: 800, fontFamily: display, textDecoration: "none",
              boxShadow: `0 6px 22px ${D.teal}38`, letterSpacing: "-.01em", marginTop: 6,
            }}>
              <MapPin size={15} /> View Pickup on Google Maps
            </a>
          )}
        </div>
      </div>
    </>
  );
}

// ─── SKELETON LOADER ───────────────────────────────────────────────────────
function SearchCardSkeleton({ delay = 0 }) {
  return (
    <div style={{
      background: D.bgCard, border: `1px solid ${D.border}`, borderRadius: 18,
      padding: "14px 16px", animation: `fadeUp .35s ease ${delay}ms both`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12 }}>
        <div className="shimmer" style={{ width: 40, height: 40, borderRadius: 13 }} />
        <div style={{ flex: 1 }}>
          <div className="shimmer" style={{ width: "60%", height: 14, borderRadius: 4, marginBottom: 6 }} />
          <div className="shimmer" style={{ width: "40%", height: 11, borderRadius: 4 }} />
        </div>
      </div>
      <div className="shimmer" style={{ width: "100%", height: 60, borderRadius: 14, marginBottom: 10 }} />
      <div style={{ display: "flex", gap: 6 }}>
        <div className="shimmer" style={{ width: 60, height: 22, borderRadius: 99 }} />
        <div className="shimmer" style={{ width: 50, height: 22, borderRadius: 99 }} />
        <div className="shimmer" style={{ width: 70, height: 22, borderRadius: 99 }} />
      </div>
    </div>
  );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────
export function SearchTab({ onToast }) {
  const { searches, loading }        = useSearches();
  const { accounts, loading: acLoad } = useAccounts();
  const [query,      setQuery]       = useState("");
  const [filter,     setFilter]      = useState("all");
  const [selectedId, setSelectedId]  = useState(null);
  const [hoveredId,  setHoveredId]   = useState(null);

  const accountMap = useMemo(() => {
    const m = {};
    (accounts ?? []).forEach(a => { if (a.uid) m[a.uid] = a; });
    return m;
  }, [accounts]);

  const filtered = useMemo(() => {
    let list = [...searches].sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    if (filter === "riders") list = list.filter(s => !isGuest(s));
    if (filter === "guests") list = list.filter(isGuest);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(s => {
        const acc = accountMap[s.uid];
        return (s.pickup  || "").toLowerCase().includes(q)
            || (s.dropoff || "").toLowerCase().includes(q)
            || (s.uid     || "").toLowerCase().includes(q)
            || (acc?.name  || "").toLowerCase().includes(q)
            || (acc?.email || "").toLowerCase().includes(q);
      });
    }
    return list;
  }, [searches, query, filter, accountMap]);

  const selectedDoc = useMemo(
    () => selectedId ? searches.find(s => s.id === selectedId) ?? null : null,
    [selectedId, searches]
  );

  const FILTERS = [
    { k: "all",    l: "All",    c: searches.length, icon: <Activity size={11} /> },
    { k: "riders", l: "Riders", c: searches.filter(s => !isGuest(s)).length, icon: <User size={11} /> },
    { k: "guests", l: "Guests", c: searches.filter(isGuest).length, icon: <UserX size={11} /> },
  ];

  return (
    <div style={{
      padding: "0 14px 80px", background: D.bg, minHeight: "100vh", fontFamily: sans,
    }}>
      <style>{`
        @keyframes fadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes shimmerMove { 0% {background-position:-200% 0} 100% {background-position:200% 0} }
        .shimmer {
          background: linear-gradient(90deg, ${D.bgMid} 0%, #F1F5F9 50%, ${D.bgMid} 100%);
          background-size: 200% 100%;
          animation: shimmerMove 1.5s ease-in-out infinite;
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(15,23,42,.12); border-radius: 99px; }
      `}</style>

      {/* Hero header */}
      {!loading && searches.length > 0 && <HeroHeader searches={searches} accounts={accounts ?? []} />}

      {/* Map */}
      {!loading && (
        <SearchMapView
          searches={filtered.length > 0 ? filtered : searches}
          selectedId={selectedId}
          hoveredId={hoveredId}
          onSelect={setSelectedId}
          height={300}
        />
      )}

      {/* Search + filters bar */}
      <div style={{
        marginBottom: 18, animation: "fadeUp .4s ease 60ms both",
        background: D.bgCard, borderRadius: 18, padding: 14,
        border: `1px solid ${D.border}`,
        boxShadow: "0 1px 3px rgba(15,23,42,.04)",
      }}>
        <div style={{ position: "relative", marginBottom: 12 }}>
          <Search size={15} color={D.t4} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search name, email, address, UID…"
            style={{
              width: "100%", padding: "12px 40px",
              borderRadius: 13, border: `1.5px solid ${query ? D.teal + "55" : D.borderMd}`,
              background: D.bgCard, color: D.t1,
              fontFamily: sans, fontSize: 14, fontWeight: 500,
              outline: "none", transition: "border-color .15s, box-shadow .15s",
              boxShadow: query ? `0 0 0 3px ${D.teal}15` : "none",
            }}
          />
          {query && (
            <button onClick={() => setQuery("")} style={{
              position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
              background: D.bgMid, border: "none", cursor: "pointer", display: "flex",
              padding: 5, borderRadius: 7, color: D.t3,
            }}>
              <X size={12} />
            </button>
          )}
        </div>

        <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
          {FILTERS.map(({ k, l, c, icon }) => (
            <button key={k} onClick={() => setFilter(k)} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 14px", borderRadius: 99,
              fontFamily: sans, fontSize: 12.5, fontWeight: 700, cursor: "pointer", transition: "all .15s",
              border:      filter === k ? `1.5px solid ${D.teal}65`  : `1.5px solid ${D.borderMd}`,
              background:  filter === k ? D.tealDim                  : "transparent",
              color:       filter === k ? D.teal                     : D.t3,
            }}>
              {icon}
              {l}
              <span style={{
                fontFamily: mono, fontSize: 10.5, padding: "1px 7px", borderRadius: 5,
                background: filter === k ? D.tealMid : "rgba(15,23,42,.06)",
                color: filter === k ? D.teal : D.t4,
                fontWeight: 700,
              }}>{c}</span>
            </button>
          ))}
          <span style={{ marginLeft: "auto", fontFamily: sans, fontSize: 12, color: D.t4, fontWeight: 600 }}>
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Section header for results */}
      {!loading && filtered.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 12, animation: "fadeUp .4s ease 80ms both",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 3, height: 14, borderRadius: 99, background: D.t1 }} />
            <span style={{ fontFamily: display, fontSize: 16, fontWeight: 800, color: D.t0, letterSpacing: "-.02em" }}>
              {filter === "all" ? "All Searches" : filter === "riders" ? "Rider Searches" : "Guest Searches"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, color: D.t4 }}>
            <ArrowDown size={11} />
            <span style={{ fontFamily: sans, fontSize: 11, fontWeight: 600 }}>Newest first</span>
          </div>
        </div>
      )}

      {/* List */}
      {loading || acLoad ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[0, 1, 2].map(i => <SearchCardSkeleton key={i} delay={i * 80} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "64px 24px",
          background: D.bgCard, border: `1px solid ${D.border}`, borderRadius: 20,
          boxShadow: "0 1px 3px rgba(15,23,42,.04)",
        }}>
          <div style={{
            width: 56, height: 56, margin: "0 auto 16px",
            borderRadius: 16, background: D.bgMid,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Search size={22} color={D.t4} />
          </div>
          <div style={{ fontFamily: display, fontSize: 17, fontWeight: 800, color: D.t1, marginBottom: 5, letterSpacing: "-.02em" }}>
            No searches found
          </div>
          <div style={{ fontFamily: sans, fontSize: 13, color: D.t4, fontWeight: 500 }}>
            {query ? "Try a different search term" : "Try adjusting your filters"}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((doc, i) => (
            <SearchCard
              key={doc.id} doc={doc} index={i}
              account={accountMap[doc.uid] ?? null}
              selected={selectedId === doc.id}
              hovered={hoveredId  === doc.id}
              onHover={() => setHoveredId(doc.id)}
              onLeave={() => setHoveredId(null)}
              onClick={() => setSelectedId(doc.id)}
            />
          ))}
        </div>
      )}

      {selectedDoc && (
        <DetailSheet
          doc={selectedDoc}
          account={accountMap[selectedDoc.uid] ?? null}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

export default SearchTab;