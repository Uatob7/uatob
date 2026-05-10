import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  MapPin, Navigation, Clock, Ruler, User, Search,
  ChevronRight, X, Route, Map as MapIcon,
  Maximize2, Minimize2, ArrowRight, Car, Banknote,
  Users, UserX, Shield, CheckCircle, Hash, Mail,
  AlertTriangle, Zap, Radio, Timer,
} from "lucide-react";
import { useSearches } from "@/App/Admin/useSearches";
import { useAccounts } from "@/App/Admin/useAccounts";

// ─── CONFIG ────────────────────────────────────────────────────────────────
const MAPBOX_TOKEN = "pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA";
const TEAL  = "#0D9488";
const AMBER = "#D97706";

// ─── LIGHT DESIGN TOKENS ──────────────────────────────────────────────────
const D = {
  // Backgrounds
  bg:       "#FFFFFF",       // page bg — white
  bgCard:   "#FFFFFF",       // cards
  bgMid:    "#F8FAFC",       // inner panels
  bgHover:  "#F0FDF9",       // teal-tinted hover

  // Borders
  border:   "rgba(15,23,42,.05)",
  borderMd: "rgba(15,23,42,.1)",
  borderLg: "rgba(15,23,42,.18)",

  // Text
  t1: "#0F172A",   // headings
  t2: "#1E293B",   // body
  t3: "#64748B",   // muted
  t4: "#94A3B8",   // dim

  // Brand
  teal:      TEAL,
  tealDim:   "rgba(13,148,136,.08)",
  tealMid:   "rgba(13,148,136,.15)",
  tealGlow:  "rgba(13,148,136,.22)",
  amber:     AMBER,
  amberDim:  "rgba(217,119,6,.08)",
  amberMid:  "rgba(217,119,6,.14)",

  // Status
  red:      "#DC2626",
  redDim:   "rgba(220,38,38,.07)",
  green:    "#16A34A",
  greenDim: "rgba(22,163,74,.08)",
  blue:     "#2563EB",
  blueDim:  "rgba(37,99,235,.08)",
};

const display = "'Syne', system-ui, sans-serif";
const sans    = "'DM Sans', system-ui, sans-serif";
const mono    = "'JetBrains Mono', monospace";

const TIER = {
  economy:  { label: "Economy",  color: "#0D9488", bg: "rgba(13,148,136,.07)", grad: "linear-gradient(135deg,#0D9488,#0891B2)" },
  standard: { label: "Standard", color: "#2563EB", bg: "rgba(37,99,235,.07)",  grad: "linear-gradient(135deg,#2563EB,#7C3AED)" },
  premium:  { label: "Premium",  color: "#7C3AED", bg: "rgba(124,58,237,.07)", grad: "linear-gradient(135deg,#7C3AED,#DB2777)" },
  xl:       { label: "XL",       color: "#D97706", bg: "rgba(217,119,6,.07)",  grad: "linear-gradient(135deg,#D97706,#DC2626)" },
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
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
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
    <div style={{ width: size, height: size, borderRadius: size * 0.28, background: D.amberDim, border: `1.5px solid ${D.amber}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <UserX size={size * 0.42} color={D.amber} />
    </div>
  );
  if (!account) return (
    <div style={{ width: size, height: size, borderRadius: size * 0.28, background: D.tealDim, border: `1.5px solid ${D.teal}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <User size={size * 0.42} color={D.teal} />
    </div>
  );
  const hue = hashHue(account.uid);
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.28, background: `hsl(${hue},60%,92%)`, border: `1.5px solid hsl(${hue},50%,78%)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: size * 0.34, fontWeight: 800, color: `hsl(${hue},55%,30%)`, fontFamily: display, letterSpacing: "-.02em" }}>
      {initials(account.name)}
    </div>
  );
}

// ─── DRIVER INFO PANEL ────────────────────────────────────────────────────
function DriverPanel({ driverInfo }) {
  if (!driverInfo) return null;
  const { driverCount, nearestMiles, etaLabel, etaMin, stale } = driverInfo;
  const hasDriver    = driverCount > 0;
  const urgency      = etaMin <= 15 ? "fast" : etaMin <= 45 ? "medium" : "slow";
  const urgencyColor = urgency === "fast" ? D.green : urgency === "medium" ? D.amber : D.red;

  return (
    <div style={{ marginBottom: 18 }}>
      <SectionLabel>Driver Intelligence</SectionLabel>
      <div style={{ borderRadius: 16, border: `1px solid ${hasDriver ? D.teal + "30" : D.red + "25"}`, overflow: "hidden", background: hasDriver ? D.tealDim : D.redDim, marginTop: 8, boxShadow: "0 1px 3px rgba(15,23,42,.04)" }}>
        <div style={{ height: 3, background: hasDriver ? `linear-gradient(90deg,${D.teal},${D.blue})` : `linear-gradient(90deg,${D.red},${D.amber})` }} />
        <div style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: hasDriver ? D.tealMid : D.redDim, border: `1px solid ${hasDriver ? D.teal + "30" : D.red + "30"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Car size={18} color={hasDriver ? D.teal : D.red} />
              </div>
              <div>
                <div style={{ fontFamily: display, fontSize: 15, fontWeight: 800, color: D.t1, letterSpacing: "-.02em" }}>
                  {hasDriver ? `${driverCount} Driver${driverCount > 1 ? "s" : ""} Available` : "No Drivers Nearby"}
                </div>
                <div style={{ fontFamily: sans, fontSize: 11.5, color: D.t3, marginTop: 2 }}>
                  {hasDriver ? "Ready to accept this route" : "No drivers matched at time of search"}
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
              <DriverMetric icon={<Radio size={12} color={D.teal} />} label="Drivers"  value={driverCount}            color={D.teal}        unit="" />
              <DriverMetric icon={<Ruler size={12} color={urgencyColor} />} label="Nearest" value={nearestMiles?.toFixed(1)} color={urgencyColor}  unit="mi" />
              <DriverMetric icon={<Timer size={12} color={urgencyColor} />} label="ETA"     value={etaMin}                 color={urgencyColor}  unit="min" sub={etaLabel} />
            </div>
          )}
          {hasDriver && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                <span style={{ fontFamily: sans, fontSize: 10, fontWeight: 700, color: D.t4, letterSpacing: ".06em", textTransform: "uppercase" }}>Pickup ETA</span>
                <span style={{ fontFamily: mono, fontSize: 11, color: urgencyColor, fontWeight: 600 }}>{etaLabel}</span>
              </div>
              <div style={{ height: 5, borderRadius: 99, background: D.borderMd, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 99, background: `linear-gradient(90deg,${urgencyColor},${urgencyColor}88)`, width: `${Math.max(5, Math.min(100, 100 - (etaMin / 120) * 100))}%`, transition: "width .6s cubic-bezier(.22,1,.36,1)", boxShadow: `0 0 6px ${urgencyColor}40` }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
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
    <div style={{ background: D.bgCard, border: `1px solid ${D.border}`, borderRadius: 12, padding: "10px 12px", boxShadow: "0 1px 4px rgba(15,23,42,.05)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
        {icon}
        <span style={{ fontFamily: sans, fontSize: 9.5, fontWeight: 700, color: D.t4, textTransform: "uppercase", letterSpacing: ".07em" }}>{label}</span>
      </div>
      <div style={{ fontFamily: display, fontSize: 20, fontWeight: 800, color, letterSpacing: "-.03em", lineHeight: 1 }}>
        {value}<span style={{ fontSize: 11, fontWeight: 600, color: D.t3, marginLeft: 2 }}>{unit}</span>
      </div>
      {sub && <div style={{ fontFamily: mono, fontSize: 9.5, color: D.t3, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ─── FARE GRID ─────────────────────────────────────────────────────────────
function FareGrid({ rides }) {
  if (!rides) return null;
  const keys = ["economy", "standard", "premium", "xl"].filter(k => rides[k]);
  if (!keys.length) return null;
  return (
    <div style={{ marginBottom: 18 }}>
      <SectionLabel>Fare Options Shown</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
        {keys.map(k => {
          const t   = rides[k];
          const cfg = TIER[k] ?? { label: k, color: D.t3, bg: D.bgMid, grad: "linear-gradient(135deg,#CBD5E1,#94A3B8)" };
          return (
            <div key={k} style={{ borderRadius: 14, overflow: "hidden", border: `1px solid ${D.border}`, background: D.bgCard, boxShadow: "0 1px 3px rgba(15,23,42,.05)" }}>
              <div style={{ height: 3, background: cfg.grad }} />
              <div style={{ padding: "11px 13px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontFamily: display, fontSize: 12, fontWeight: 800, color: cfg.color, letterSpacing: "-.01em" }}>{cfg.label}</span>
                  <span style={{ fontFamily: display, fontSize: 18, fontWeight: 800, color: D.t1, letterSpacing: "-.03em" }}>${t.total}</span>
                </div>
                <div style={{ fontFamily: sans, fontSize: 10.5, color: D.t3, marginBottom: 5 }}>{t.eta}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Users size={9} color={D.t4} />
                  <span style={{ fontFamily: sans, fontSize: 10, color: D.t4, fontWeight: 600 }}>Up to {t.capacity} riders</span>
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
function SearchMapView({ searches = [], selectedId, hoveredId, onSelect, height = 300 }) {
  const ref         = useRef(null);
  const mapRef      = useRef(null);
  const initRef     = useRef(false);
  const [ready,     setReady]    = useState(false);
  const [expanded,  setExpanded] = useState(false);
  const h = expanded ? 500 : height;

  // Use a light map style
  const mapStyle = "mapbox://styles/mapbox/light-v11";

  const routeFeats = useMemo(() => searches.filter(hasBothCoords).map(s => ({
    type: "Feature",
    properties: {
      id: s.id, guest: isGuest(s), sel: s.id === selectedId, hov: s.id === hoveredId,
      color: s.id === selectedId ? "#0F172A"
           : s.id === hoveredId  ? (isGuest(s) ? D.amber : D.teal)
           : isGuest(s) ? AMBER : TEAL,
    },
    geometry: { type: "LineString", coordinates: [[s.pickupLng, s.pickupLat], [s.dropoffLng, s.dropoffLat]] },
  })), [searches, selectedId, hoveredId]);

  const pickFeat = useMemo(() => searches.filter(s => s.pickupLat && s.pickupLng).map(s => ({
    type: "Feature",
    properties: {
      id: s.id, sel: s.id === selectedId, hov: s.id === hoveredId,
      color: s.id === selectedId ? "#0F172A"
           : s.id === hoveredId  ? (isGuest(s) ? D.amber : D.teal)
           : isGuest(s) ? AMBER : TEAL,
    },
    geometry: { type: "Point", coordinates: [s.pickupLng, s.pickupLat] },
  })), [searches, selectedId, hoveredId]);

  const dropFeat = useMemo(() => searches.filter(hasBothCoords).map(s => ({
    type: "Feature",
    properties: {
      id: s.id, sel: s.id === selectedId, hov: s.id === hoveredId,
      color: s.id === selectedId ? "#0F172A"
           : s.id === hoveredId  ? (isGuest(s) ? D.amber : D.teal)
           : isGuest(s) ? AMBER : TEAL,
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
      { padding: { top: 55, bottom: 55, left: 45, right: 45 }, maxZoom: 13, duration: 800 }
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
        // ── Route layers ──
        map.addLayer({ id: "rl-glow", type: "line", source: "routes",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": ["get", "color"], "line-width": 12, "line-opacity": ["case", ["get", "sel"], .22, ["get", "hov"], .16, .05], "line-blur": 5 },
        });
        map.addLayer({ id: "rl-line", type: "line", source: "routes",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": ["get", "color"], "line-width": ["case", ["get", "sel"], 3, ["get", "hov"], 2.5, 2], "line-opacity": ["case", ["get", "sel"], 1, ["get", "hov"], .9, .45] },
        });
        // ── Pickup layers ──
        map.addLayer({ id: "pk-halo", type: "circle", source: "pickups",
          paint: { "circle-color": ["get", "color"], "circle-radius": ["case", ["get", "sel"], 18, ["get", "hov"], 14, 9], "circle-opacity": .12, "circle-blur": 1 },
        });
        map.addLayer({ id: "pk-dot", type: "circle", source: "pickups",
          paint: { "circle-color": ["get", "color"], "circle-radius": ["case", ["get", "sel"], 7, ["get", "hov"], 6, 4.5], "circle-stroke-color": "#fff", "circle-stroke-width": ["case", ["get", "sel"], 2.5, 1.5], "circle-opacity": ["case", ["get", "sel"], 1, ["get", "hov"], .95, .75] },
        });
        // ── Dropoff layers ──
        map.addLayer({ id: "dr-halo", type: "circle", source: "dropoffs",
          paint: { "circle-color": ["get", "color"], "circle-radius": ["case", ["get", "sel"], 14, ["get", "hov"], 12, 8], "circle-opacity": .1, "circle-blur": 1 },
        });
        map.addLayer({ id: "dr-dot", type: "circle", source: "dropoffs",
          paint: { "circle-color": ["get", "color"], "circle-radius": ["case", ["get", "sel"], 6, ["get", "hov"], 5, 3.5], "circle-stroke-color": "#fff", "circle-stroke-width": ["case", ["get", "sel"], 2.5, 1.5], "circle-opacity": ["case", ["get", "sel"], 1, ["get", "hov"], .9, .65] },
        });
        // ── Interaction ──
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
        { padding: { top: 70, bottom: 70, left: 60, right: 60 }, maxZoom: 15, duration: 850 }
      );
    } else if (s.pickupLat && s.pickupLng) {
      mapRef.current.flyTo({ center: [s.pickupLng, s.pickupLat], zoom: 14, duration: 700 });
    }
  }, [selectedId, searches, ready]);

  useEffect(() => { const t = setTimeout(() => mapRef.current?.resize(), 300); return () => clearTimeout(t); }, [expanded]);

  const guestCt = searches.filter(isGuest).length;
  const riderCt = searches.length - guestCt;

  return (
    <div style={{ borderRadius: 18, overflow: "hidden", border: `1px solid ${D.border}`, marginBottom: 14, background: D.bgCard, boxShadow: "0 1px 3px rgba(15,23,42,.06), 0 4px 16px rgba(15,23,42,.08)" }}>
      <style>{`
        .mbst .mapboxgl-ctrl-bottom-left,.mbst .mapboxgl-ctrl-bottom-right{display:none!important}
        .mbst .mapboxgl-ctrl-top-right{margin:10px 10px 0 0!important}
        .mbst .mapboxgl-ctrl-group{background:rgba(255,255,255,.95)!important;border:1px solid rgba(15,23,42,.12)!important;backdrop-filter:blur(12px);box-shadow:0 2px 8px rgba(15,23,42,.08)!important}
        .mbst .mapboxgl-ctrl-group button{background:transparent!important;color:#334155!important}
        .mbst .mapboxgl-ctrl-group button:hover{background:rgba(15,23,42,.05)!important}
        .mbst .mapboxgl-ctrl-group button .mapboxgl-ctrl-icon{filter:none!important;opacity:.7}
      `}</style>

      {/* Header */}
      <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${D.border}`, background: D.bgCard }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: D.tealDim, border: `1.5px solid ${D.teal}25`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Route size={14} color={D.teal} />
          </div>
          <div>
            <div style={{ fontFamily: display, fontSize: 13, fontWeight: 800, color: D.t1, letterSpacing: "-.02em" }}>Search Routes</div>
            <div style={{ fontFamily: sans, fontSize: 10.5, color: D.t3, marginTop: 1 }}>{searches.length} searches · {searches.filter(hasBothCoords).length} mapped</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <LegendPill color={D.teal}  label="Rider" count={riderCt} glow />
          <LegendPill color={D.amber} label="Guest" count={guestCt} />
          <button
            onClick={() => setExpanded(e => !e)}
            style={{ width: 30, height: 30, borderRadius: 9, border: `1.5px solid ${D.border}`, background: D.bgMid, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: D.t3, transition: "all .15s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = D.borderMd; e.currentTarget.style.color = D.t1; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = D.border;   e.currentTarget.style.color = D.t3; }}
          >
            {expanded ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
          </button>
        </div>
      </div>

      {/* Map canvas */}
      <div className="mbst" style={{ position: "relative", height: h, background: "#EFF3F8", transition: "height .32s cubic-bezier(.32,.72,0,1)" }}>
        <div ref={ref} style={{ width: "100%", height: "100%" }} />
        {searches.length === 0 && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(241,245,249,.97)", zIndex: 20 }}>
            <MapIcon size={24} color={D.t4} style={{ marginBottom: 8 }} />
            <div style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: D.t4 }}>No routes to display</div>
          </div>
        )}
        {searches.length > 0 && (
          <>
            <div style={{ position: "absolute", bottom: 12, left: 12, zIndex: 15, display: "flex", gap: 6 }}>
              <MapChipLight><Dot color={D.teal} glow /> Pickup</MapChipLight>
              <MapChipLight><Dot color={D.t3} /> Dropoff</MapChipLight>
            </div>
            <button onClick={fitAll} style={{ position: "absolute", bottom: 12, right: 12, zIndex: 15, background: "rgba(255,255,255,.92)", backdropFilter: "blur(10px)", border: `1.5px solid ${D.border}`, borderRadius: 99, padding: "5px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, boxShadow: "0 2px 8px rgba(15,23,42,.08)" }}>
              <MapIcon size={10} color={D.t3} />
              <span style={{ fontFamily: sans, fontSize: 10, fontWeight: 700, color: D.t3 }}>Fit All</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function LegendPill({ color, label, count, glow }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, background: `${color}0D`, border: `1.5px solid ${color}25`, borderRadius: 99, padding: "3px 9px" }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, boxShadow: glow ? `0 0 6px ${color}80` : "none" }} />
      <span style={{ fontFamily: sans, fontSize: 10, fontWeight: 700, color, letterSpacing: ".04em" }}>{label}</span>
      <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color, background: `${color}18`, padding: "1px 6px", borderRadius: 5 }}>{count}</span>
    </div>
  );
}
function MapChipLight({ children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,.92)", backdropFilter: "blur(10px)", border: `1.5px solid ${D.border}`, borderRadius: 99, padding: "4px 10px", fontFamily: sans, fontSize: 10, fontWeight: 700, color: D.t3, letterSpacing: ".04em", boxShadow: "0 1px 4px rgba(15,23,42,.06)" }}>
      {children}
    </div>
  );
}
function Dot({ color, glow }) {
  return <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, boxShadow: glow ? `0 0 5px ${color}80` : "none", flexShrink: 0 }} />;
}

// ─── STATS BAR ─────────────────────────────────────────────────────────────
function StatsBar({ searches, accountMap }) {
  const total     = searches.length;
  const guests    = searches.filter(isGuest).length;
  const riders    = total - guests;
  const unique    = new Set(searches.filter(s => !isGuest(s)).map(s => s.uid)).size;
  const avgMi     = total ? (searches.reduce((a, s) => a + (s.miles || 0), 0) / total).toFixed(1) : "—";
  const matched   = searches.filter(s => s.driverInfo?.driverCount > 0).length;
  const matchRate = total ? Math.round((matched / total) * 100) : 0;

  const stats = [
    { v: total,          l: "Searches",   c: D.t1,   icon: <Search   size={11} /> },
    { v: riders,         l: "Riders",     c: D.teal,  icon: <User     size={11} /> },
    { v: guests,         l: "Guests",     c: D.amber, icon: <UserX    size={11} /> },
    { v: unique,         l: "Accounts",   c: D.blue,  icon: <Shield   size={11} /> },
    { v: avgMi,          l: "Avg Miles",  c: D.t1,   icon: <Ruler    size={11} /> },
    { v: matchRate + "%",l: "Match Rate", c: matchRate > 70 ? D.green : matchRate > 40 ? D.amber : D.red, icon: <Zap size={11} /> },
  ];

  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 14, overflowX: "auto", paddingBottom: 2, animation: "fadeUp .4s ease both" }}>
      {stats.map(({ v, l, c, icon }) => (
        <div key={l}
          style={{ flex: "0 0 auto", background: D.bgCard, border: `1px solid ${D.border}`, borderRadius: 14, padding: "11px 15px", minWidth: 76, transition: "border-color .15s, transform .15s, box-shadow .15s", boxShadow: "0 1px 2px rgba(15,23,42,.04)" }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = D.teal + "35"; e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(15,23,42,.1)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = D.border; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 1px 4px rgba(15,23,42,.05)"; }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 4, color: D.t4, marginBottom: 7 }}>
            {icon}
            <span style={{ fontFamily: sans, fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em", color: D.t4 }}>{l}</span>
          </div>
          <div style={{ fontFamily: display, fontSize: 22, fontWeight: 800, color: c, letterSpacing: "-.04em", lineHeight: 1 }}>{v}</div>
        </div>
      ))}
    </div>
  );
}

// ─── SEARCH CARD ──────────────────────────────────────────────────────────
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
        border:       selected ? `1.5px solid ${ac}50` : hovered ? `1.5px solid ${ac}35` : `1px solid ${D.border}`,
        borderRadius: 16, overflow: "hidden", cursor: "pointer",
        boxShadow:    selected ? `0 0 0 3px ${ac}12, 0 8px 24px rgba(15,23,42,.12)` : hovered ? `0 2px 8px rgba(15,23,42,.08)` : "0 1px 3px rgba(15,23,42,.05)",
        transition:   "border-color .15s, background .15s, box-shadow .15s, transform .12s",
        animation:    `fadeUp .3s ease ${index * 30}ms both`,
        transform:    hovered && !selected ? "translateY(-1px)" : "none",
      }}
    >
      {/* Top accent */}
      <div style={{ height: 2.5, background: isAct ? `linear-gradient(90deg,${ac},${ac}50)` : D.border, transition: "background .2s" }} />

      <div style={{ padding: "13px 14px" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <Avatar account={account} guest={guest} size={38} />

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Name + time */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 2 }}>
              <span style={{ fontFamily: display, fontWeight: 800, fontSize: 14, color: D.t1, letterSpacing: "-.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {guest ? "Guest Search" : (account?.name ?? "Rider")}
              </span>
              <span style={{ fontFamily: sans, fontSize: 10.5, color: D.t4, fontWeight: 500, flexShrink: 0 }}>{fmtRelative(doc.createdAt)}</span>
            </div>

            {/* Sub */}
            <div style={{ fontFamily: mono, fontSize: 11, color: D.t3, marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {guest ? "Not signed in" : (account?.email ?? doc.uid?.slice(0, 18) + "…")}
            </div>

            {/* Route pill */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 11px", background: D.bgMid, borderRadius: 11, border: `1.5px solid ${D.border}`, marginBottom: 9 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, flexShrink: 0 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: ac, boxShadow: isAct ? `0 0 6px ${ac}80` : "none", transition: "box-shadow .2s" }} />
                <div style={{ width: 1.5, height: 14, background: `linear-gradient(to bottom,${ac},${ac}20)` }} />
                <div style={{ width: 6, height: 6, borderRadius: 1.5, background: ac, opacity: .45, transform: "rotate(45deg)" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ fontFamily: sans, fontSize: 12, fontWeight: 700, color: D.t1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{strip(doc.pickup)}</div>
                <div style={{ fontFamily: sans, fontSize: 11, fontWeight: 500, color: D.t3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{strip(doc.dropoff)}</div>
              </div>
            </div>

            {/* Chips */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
              {doc.miles   != null && <Chip icon={<Ruler size={9}/>} label={`${doc.miles.toFixed(1)} mi`} />}
              {doc.minutes != null && <Chip icon={<Clock size={9}/>} label={`${doc.minutes} min`} />}
              {doc.driverInfo ? (
                <Chip icon={<Car size={9}/>} label={hasDriver ? `${doc.driverInfo.driverCount} driver${doc.driverInfo.driverCount > 1 ? "s" : ""}` : "No driver"} color={hasDriver ? D.green : D.red} />
              ) : null}
              <Chip icon={guest ? <UserX size={9}/> : <User size={9}/>} label={guest ? "Guest" : "Rider"} color={ac} />
              {doc.rides?.economy && <Chip icon={<Banknote size={9}/>} label={`$${doc.rides.economy.total}`} color={D.teal} />}
            </div>
          </div>

          <ChevronRight size={13} color={isAct ? ac : D.t4} style={{ flexShrink: 0, marginTop: 4, transition: "color .15s" }} />
        </div>
      </div>
    </div>
  );
}

function Chip({ icon, label, color }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "3px 8px", borderRadius: 99, background: color ? `${color}10` : D.bgMid, border: color ? `1.5px solid ${color}30` : `1px solid ${D.border}`, fontFamily: sans, fontSize: 10.5, fontWeight: 700, color: color ?? D.t3 }}>
      {icon}{label}
    </span>
  );
}

// ─── SECTION LABEL ─────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div style={{ fontFamily: sans, fontSize: 10, fontWeight: 700, color: D.t4, letterSpacing: ".1em", textTransform: "uppercase" }}>
      {children}
    </div>
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
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(15,23,42,.35)", backdropFilter: "blur(5px)", animation: "fadeIn .2s ease" }} />
      {/* Sheet */}
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 401,
        background: D.bgCard, borderRadius: "24px 24px 0 0",
        maxWidth: 640, margin: "0 auto",
        maxHeight: "90vh", overflowY: "auto",
        animation: "sheetUp .3s cubic-bezier(.34,1.1,.64,1)",
        boxShadow: "0 -2px 8px rgba(15,23,42,.06), 0 -12px 48px rgba(15,23,42,.14)",
        border: `1px solid ${D.border}`, borderBottom: "none",
      }}>
        <style>{`
          @keyframes fadeIn  { from{opacity:0}                  to{opacity:1} }
          @keyframes sheetUp { from{transform:translateY(100%)} to{transform:translateY(0)} }
          @keyframes fadeUp  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        `}</style>

        {/* Top bar */}
        <div style={{ height: 3, background: `linear-gradient(90deg,${ac},${ac}44)`, borderRadius: "24px 24px 0 0" }} />
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
          <div style={{ width: 40, height: 4, borderRadius: 99, background: D.borderMd }} />
        </div>

        <div style={{ padding: "16px 20px 40px" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
              <Avatar account={account} guest={guest} size={50} />
              <div>
                <div style={{ fontFamily: display, fontSize: 20, fontWeight: 800, color: D.t1, letterSpacing: "-.03em" }}>
                  {guest ? "Guest Search" : (account?.name ?? "Search Detail")}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 4 }}>
                  <Dot color={ac} glow />
                  <span style={{ fontFamily: sans, fontSize: 12, fontWeight: 700, color: ac }}>{guest ? "Guest" : "Rider"}</span>
                  {!guest && account?.email && (
                    <span style={{ fontFamily: mono, fontSize: 11, color: D.t3 }}>{account.email}</span>
                  )}
                </div>
              </div>
            </div>
            <button onClick={onClose}
              style={{ width: 34, height: 34, borderRadius: "50%", border: `1.5px solid ${D.border}`, background: D.bgMid, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: D.t3, flexShrink: 0, transition: "all .15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#FEE2E2"; e.currentTarget.style.borderColor = "#FECACA"; e.currentTarget.style.color = D.red; }}
              onMouseLeave={e => { e.currentTarget.style.background = D.bgMid;  e.currentTarget.style.borderColor = D.border; e.currentTarget.style.color = D.t3; }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Route pill */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", background: `${ac}08`, border: `1.5px solid ${ac}25`, borderRadius: 16, marginBottom: 20 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: sans, fontSize: 10, fontWeight: 700, color: D.t4, textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 3 }}>From</div>
              <div style={{ fontFamily: sans, fontSize: 13, fontWeight: 700, color: D.t1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{strip(doc.pickup)}</div>
            </div>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: `${ac}12`, border: `1.5px solid ${ac}25`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <ArrowRight size={14} color={ac} />
            </div>
            <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
              <div style={{ fontFamily: sans, fontSize: 10, fontWeight: 700, color: D.t4, textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 3 }}>To</div>
              <div style={{ fontFamily: sans, fontSize: 13, fontWeight: 700, color: D.t1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{strip(doc.dropoff)}</div>
            </div>
          </div>

          {/* Driver intel */}
          <DriverPanel driverInfo={doc.driverInfo} />

          {/* Rider account */}
          {!guest && account && (
            <div style={{ marginBottom: 18 }}>
              <SectionLabel>Rider Account</SectionLabel>
              <div style={{ background: D.bgMid, border: `1.5px solid ${D.teal}20`, borderRadius: 16, overflow: "hidden", marginTop: 8, boxShadow: "0 1px 6px rgba(15,23,42,.04)" }}>
                <div style={{ height: 2, background: `linear-gradient(90deg,${D.teal},${D.blue})` }} />
                <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${D.border}` }}>
                  <Avatar account={account} size={46} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: display, fontSize: 16, fontWeight: 800, color: D.t1, letterSpacing: "-.02em" }}>{account.name}</div>
                    <div style={{ fontFamily: mono, fontSize: 11.5, color: D.t3, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{account.email}</div>
                  </div>
                  {account.welcomeEmailSent && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, background: D.greenDim, border: `1.5px solid ${D.green}25`, borderRadius: 99, padding: "3px 10px", flexShrink: 0 }}>
                      <CheckCircle size={9} color={D.green} />
                      <span style={{ fontFamily: sans, fontSize: 10, fontWeight: 700, color: D.green }}>Verified</span>
                    </div>
                  )}
                </div>
                <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { icon: <Mail  size={12} color={D.t4} />, label: "Email",  value: account.email, mono: true  },
                    { icon: <Hash  size={12} color={D.t4} />, label: "UID",    value: account.uid,   mono: true  },
                    { icon: <Clock size={12} color={D.t4} />, label: "Joined", value: fmtTime(account.createdAt) },
                  ].map(({ icon, label, value, mono: m }) => (
                    <div key={label} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                      <div style={{ marginTop: 1, flexShrink: 0 }}>{icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: sans, fontSize: 9.5, fontWeight: 700, color: D.t4, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 2 }}>{label}</div>
                        <div style={{ fontFamily: m ? mono : sans, fontSize: 12, fontWeight: 600, color: D.t2, wordBreak: "break-all" }}>{value || "—"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Trip details */}
          <div style={{ marginBottom: 18 }}>
            <SectionLabel>Trip Details</SectionLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              {[
                { label: "Full Pickup",   value: doc.pickup,                                              icon: <Navigation size={13} color={D.teal} /> },
                { label: "Full Dropoff",  value: doc.dropoff,                                             icon: <MapPin     size={13} color={D.amber} /> },
                { label: "Distance",      value: doc.miles   ? `${doc.miles.toFixed(2)} mi`   : null,    icon: <Ruler      size={13} color={D.t4}   /> },
                { label: "Est. Duration", value: doc.minutes ? `${doc.minutes} min`            : null,    icon: <Clock      size={13} color={D.t4}   /> },
                { label: "Searched At",   value: fmtTime(doc.createdAt),                                  icon: <Timer      size={13} color={D.t4}   /> },
              ].map(({ label, value, icon }) => value && (
                <div key={label} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 13px", borderRadius: 12, background: D.bgMid, border: `1.5px solid ${D.border}`, boxShadow: "0 1px 3px rgba(15,23,42,.04)" }}>
                  <div style={{ marginTop: 1, flexShrink: 0 }}>{icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: sans, fontSize: 9.5, fontWeight: 700, color: D.t4, textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 2 }}>{label}</div>
                    <div style={{ fontFamily: sans, fontSize: 13, fontWeight: 600, color: D.t1, wordBreak: "break-all" }}>{value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Fare tiers */}
          <FareGrid rides={doc.rides} />

          {/* Map CTA */}
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px", borderRadius: 16, background: `linear-gradient(135deg,${D.teal},#0891B2)`, color: "#fff", fontSize: 13.5, fontWeight: 800, fontFamily: display, textDecoration: "none", boxShadow: `0 6px 20px ${D.teal}35`, letterSpacing: "-.01em", marginTop: 4 }}>
              <MapPin size={15} /> View Pickup on Google Maps
            </a>
          )}
        </div>
      </div>
    </>
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
    { k: "all",    l: "All",    c: searches.length },
    { k: "riders", l: "Riders", c: searches.filter(s => !isGuest(s)).length },
    { k: "guests", l: "Guests", c: searches.filter(isGuest).length },
  ];

  return (
    <div style={{ padding: "0 14px 80px", background: D.bg, minHeight: "100vh", fontFamily: sans }}>
      <style>{`
        @keyframes fadeUp  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(15,23,42,.12); border-radius: 99px; }
      `}</style>

      {/* Stats */}
      {!loading && searches.length > 0 && <StatsBar searches={searches} accountMap={accountMap} />}

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

      {/* Search + filters */}
      <div style={{ marginBottom: 14, animation: "fadeUp .4s ease 40ms both" }}>
        <div style={{ position: "relative", marginBottom: 10 }}>
          <Search size={14} color={D.t4} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search name, email, address, UID…"
            style={{
              width: "100%", padding: "11px 38px",
              borderRadius: 13, border: `1.5px solid ${query ? D.teal + "55" : D.borderMd}`,
              background: D.bgCard, color: D.t1,
              fontFamily: sans, fontSize: 13.5, fontWeight: 500,
              outline: "none", transition: "border-color .15s, box-shadow .15s",
              boxShadow: query ? `0 0 0 3px ${D.teal}12` : "0 1px 2px rgba(15,23,42,.04)",
            }}
          />
          {query && (
            <button onClick={() => setQuery("")} style={{ position: "absolute", right: 11, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", display: "flex", padding: 3, color: D.t4 }}>
              <X size={13} />
            </button>
          )}
        </div>

        <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
          {FILTERS.map(({ k, l, c }) => (
            <button key={k} onClick={() => setFilter(k)} style={{
              padding: "6px 14px", borderRadius: 99,
              fontFamily: sans, fontSize: 12.5, fontWeight: 700, cursor: "pointer", transition: "all .15s",
              border:      filter === k ? `1.5px solid ${D.teal}60`  : `1.5px solid ${D.borderMd}`,
              background:  filter === k ? D.tealDim                  : D.bgCard,
              color:       filter === k ? D.teal                     : D.t3,
              boxShadow:   "0 1px 3px rgba(15,23,42,.05)",
            }}>
              {l}
              <span style={{ marginLeft: 6, fontFamily: mono, fontSize: 10.5, background: filter === k ? D.tealMid : "rgba(15,23,42,.06)", padding: "1px 6px", borderRadius: 5, color: filter === k ? D.teal : D.t4 }}>{c}</span>
            </button>
          ))}
          <span style={{ marginLeft: "auto", fontFamily: sans, fontSize: 12, color: D.t4, fontWeight: 500 }}>{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* List */}
      {loading || acLoad ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: D.t4, fontFamily: sans, fontSize: 13 }}>Loading searches…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "56px 20px", background: D.bgMid, border: `1px solid ${D.border}`, borderRadius: 18, boxShadow: "0 1px 3px rgba(15,23,42,.04)" }}>
          <Search size={26} color={D.t4} style={{ display: "block", margin: "0 auto 12px" }} />
          <div style={{ fontFamily: display, fontSize: 15, fontWeight: 800, color: D.t2, marginBottom: 4 }}>No searches found</div>
          <div style={{ fontFamily: sans, fontSize: 12.5, color: D.t4 }}>Try adjusting your filters</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
