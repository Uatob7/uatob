import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  MapPin, Navigation, Clock, Ruler, User, Search,
  ChevronRight, X, Route, Map as MapIcon,
  Maximize2, Minimize2, Car, Banknote,
  Users, UserX, Shield, CheckCircle, Hash, Mail,
  AlertTriangle, Zap, Radio, Timer,
} from "lucide-react";
import { useSearches } from "@/App/Admin/useSearches";
import { useAccounts } from "@/App/Admin/useAccounts";

// ─── CONFIG ────────────────────────────────────────────────────────────────
const MAPBOX_TOKEN = "pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA";

// ─── DESIGN TOKENS ─────────────────────────────────────────────────────────
const D = {
  bg:        "#F5F7FA",
  bgCard:    "#FFFFFF",
  bgMid:     "#F9FAFB",
  bgHover:   "#F0FDF9",

  border:    "rgba(0,0,0,.07)",
  borderMd:  "rgba(0,0,0,.11)",

  t1: "#0D1117",
  t2: "#1C2433",
  t3: "#5C6A7E",
  t4: "#8E9BAB",

  teal:      "#0C9488",
  tealLight: "#F0FDFA",
  tealMid:   "rgba(12,148,136,.12)",
  tealGlow:  "rgba(12,148,136,.20)",

  amber:     "#C96B00",
  amberLight:"#FFFBEB",
  amberMid:  "rgba(201,107,0,.11)",

  red:       "#C53030",
  redLight:  "#FFF5F5",
  green:     "#147A4A",
  greenLight:"#F0FDF4",
  blue:      "#1D4ED8",
};

const display = "'Outfit', system-ui, sans-serif";
const body    = "'IBM Plex Sans', system-ui, sans-serif";
const mono    = "'IBM Plex Mono', monospace";

const TIER = {
  economy:  { label: "Economy",  color: "#0C9488", grad: "linear-gradient(90deg,#0C9488,#0891B2)" },
  standard: { label: "Standard", color: "#1D4ED8", grad: "linear-gradient(90deg,#1D4ED8,#6D28D9)" },
  premium:  { label: "Premium",  color: "#7C3AED", grad: "linear-gradient(90deg,#7C3AED,#BE185D)" },
  xl:       { label: "XL",       color: "#C96B00", grad: "linear-gradient(90deg,#C96B00,#C53030)" },
};

// ─── MAPBOX SINGLETON ──────────────────────────────────────────────────────
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

// ─── HELPERS ───────────────────────────────────────────────────────────────
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
function isGuest(s)   { return !s.uid || s.uid === "null" || s.uid === null; }
function hasPickup(s) { return typeof s.pickupLat === "number" && typeof s.pickupLng === "number"; }
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

// ─── GLOBAL CSS ────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

  @keyframes fadeUp   { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
  @keyframes sheetUp  { from{transform:translateY(100%)} to{transform:translateY(0)} }
  @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:.45} }
  @keyframes shimmer  { from{background-position:200% 0} to{background-position:-200% 0} }
  @keyframes popIn    { 0%{transform:scale(.88);opacity:0} 70%{transform:scale(1.03)} 100%{transform:scale(1);opacity:1} }

  * { box-sizing: border-box; }
  ::-webkit-scrollbar { width: 3px; height: 3px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(0,0,0,.1); border-radius: 99px; }

  .st-root {
    padding: 0 0 80px;
    background: ${D.bg};
    min-height: 100vh;
    font-family: ${body};
  }

  /* ── STATS BAR ── */
  .st-stats {
    display: flex; gap: 8px; padding: 16px 16px 0;
    overflow-x: auto; scrollbar-width: none;
    animation: fadeUp .4s ease both;
  }
  .st-stats::-webkit-scrollbar { display: none; }
  .st-stat {
    flex: 0 0 auto; background: ${D.bgCard};
    border-radius: 16px; padding: 13px 16px;
    min-width: 80px; cursor: default;
    box-shadow: 0 1px 3px rgba(0,0,0,.06), 0 0 0 1px rgba(0,0,0,.04);
    transition: transform .15s, box-shadow .15s;
    animation: fadeUp .35s ease both;
  }
  .st-stat:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0,0,0,.09), 0 0 0 1px rgba(0,0,0,.05);
  }
  .st-stat-label {
    font-family: ${body}; font-size: 9.5px; font-weight: 700;
    text-transform: uppercase; letter-spacing: .09em;
    color: ${D.t4}; margin-bottom: 6px;
    display: flex; align-items: center; gap: 4px;
  }
  .st-stat-value {
    font-family: ${display}; font-size: 24px; font-weight: 800;
    letter-spacing: -.04em; line-height: 1;
  }

  /* ── MAP WRAPPER ── */
  .st-map-wrap {
    margin: 16px 16px 0;
    border-radius: 20px; overflow: hidden;
    box-shadow: 0 2px 16px rgba(0,0,0,.08), 0 0 0 1px rgba(0,0,0,.05);
    background: ${D.bgCard};
  }
  .st-map-header {
    padding: 12px 16px; display: flex; align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid ${D.border};
  }
  .st-map-title {
    font-family: ${display}; font-size: 13px; font-weight: 700;
    color: ${D.t1}; letter-spacing: -.01em;
  }
  .st-map-sub { font-family: ${body}; font-size: 11px; color: ${D.t4}; margin-top: 1px; }

  /* map controls override */
  .mbst .mapboxgl-ctrl-bottom-left,
  .mbst .mapboxgl-ctrl-bottom-right { display: none !important; }
  .mbst .mapboxgl-ctrl-top-right { margin: 10px 10px 0 0 !important; }
  .mbst .mapboxgl-ctrl-group {
    background: rgba(255,255,255,.96) !important;
    border: 1px solid rgba(0,0,0,.09) !important;
    backdrop-filter: blur(12px);
    box-shadow: 0 2px 10px rgba(0,0,0,.08) !important;
  }
  .mbst .mapboxgl-ctrl-group button { background: transparent !important; }

  /* ── SEARCH / FILTERS ── */
  .st-controls { padding: 14px 16px 0; animation: fadeUp .35s ease 60ms both; }
  .st-search-wrap {
    position: relative; margin-bottom: 10px;
  }
  .st-search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); pointer-events: none; }
  .st-search-input {
    width: 100%; padding: 12px 40px 12px 40px;
    border-radius: 14px; border: 1.5px solid ${D.borderMd};
    background: ${D.bgCard}; color: ${D.t1};
    font-family: ${body}; font-size: 13.5px; font-weight: 500;
    outline: none; transition: border-color .15s, box-shadow .15s;
    box-shadow: 0 1px 4px rgba(0,0,0,.05);
  }
  .st-search-input:focus {
    border-color: ${D.teal};
    box-shadow: 0 0 0 3px ${D.tealGlow}, 0 1px 4px rgba(0,0,0,.05);
  }
  .st-search-input::placeholder { color: ${D.t4}; }
  .st-search-clear {
    position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
    background: none; border: none; cursor: pointer; padding: 3px;
    color: ${D.t4}; display: flex; align-items: center; justify-content: center;
    border-radius: 6px; transition: background .12s;
  }
  .st-search-clear:hover { background: rgba(0,0,0,.06); color: ${D.t2}; }

  .st-filters { display: flex; gap: 6px; align-items: center; }
  .st-chip {
    padding: 6px 14px; border-radius: 99px; cursor: pointer;
    font-family: ${body}; font-size: 12px; font-weight: 600;
    transition: all .15s; border: 1.5px solid ${D.borderMd};
    background: ${D.bgCard}; color: ${D.t3};
    box-shadow: 0 1px 3px rgba(0,0,0,.04);
  }
  .st-chip.active {
    background: ${D.teal}; color: #fff;
    border-color: ${D.teal};
    box-shadow: 0 2px 10px ${D.tealGlow};
  }
  .st-chip-count {
    display: inline-block; margin-left: 5px;
    font-family: ${mono}; font-size: 10px; font-weight: 600;
    background: rgba(0,0,0,.07); padding: 1px 5px; border-radius: 5px;
  }
  .st-chip.active .st-chip-count { background: rgba(255,255,255,.22); }
  .st-result-count {
    margin-left: auto; font-family: ${body}; font-size: 12px;
    color: ${D.t4}; font-weight: 500; white-space: nowrap;
  }

  /* ── CARD LIST ── */
  .st-list { padding: 14px 16px 0; display: flex; flex-direction: column; gap: 8px; }

  /* ── SEARCH CARD ── */
  .st-card {
    background: ${D.bgCard}; border-radius: 18px;
    box-shadow: 0 1px 4px rgba(0,0,0,.06), 0 0 0 1px rgba(0,0,0,.04);
    cursor: pointer; overflow: hidden;
    transition: transform .15s, box-shadow .15s;
    animation: fadeUp .3s ease both;
  }
  .st-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0,0,0,.10), 0 0 0 1px rgba(0,0,0,.05);
  }
  .st-card:active { transform: scale(.99); }
  .st-card.selected {
    box-shadow: 0 0 0 2.5px ${D.teal}, 0 8px 28px rgba(12,148,136,.16);
    transform: translateY(-1px);
  }

  .st-card-accent { height: 3px; transition: opacity .2s; }

  .st-card-body { padding: 14px 14px 13px; display: flex; gap: 12px; }
  .st-card-main { flex: 1; min-width: 0; }

  .st-card-top {
    display: flex; align-items: center; justify-content: space-between;
    gap: 8px; margin-bottom: 2px;
  }
  .st-card-name {
    font-family: ${display}; font-weight: 700; font-size: 14.5px;
    color: ${D.t1}; letter-spacing: -.02em;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .st-card-time { font-family: ${body}; font-size: 10.5px; color: ${D.t4}; flex-shrink: 0; }
  .st-card-email {
    font-family: ${mono}; font-size: 11px; color: ${D.t3};
    margin-bottom: 9px;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }

  /* pickup pill */
  .st-pickup-pill {
    display: flex; align-items: center; gap: 9px;
    padding: 9px 12px; border-radius: 12px;
    background: ${D.bgMid}; border: 1.5px solid ${D.border};
    margin-bottom: 9px;
  }
  .st-pickup-dot {
    width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0;
    box-shadow: 0 0 0 3px var(--dot-ring);
    transition: box-shadow .2s;
  }
  .st-pickup-addr {
    font-family: ${body}; font-size: 12.5px; font-weight: 600; color: ${D.t1};
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;
  }

  /* chips row */
  .st-chips { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
  .st-tag {
    display: inline-flex; align-items: center; gap: 3px;
    padding: 3px 8px; border-radius: 99px;
    font-family: ${body}; font-size: 10.5px; font-weight: 600;
  }

  /* ── EMPTY / LOADING ── */
  .st-empty {
    margin: 0 16px; text-align: center; padding: 52px 20px;
    background: ${D.bgCard}; border-radius: 18px;
    box-shadow: 0 1px 4px rgba(0,0,0,.05), 0 0 0 1px rgba(0,0,0,.04);
    animation: fadeUp .3s ease both;
  }
  .st-empty-title { font-family: ${display}; font-size: 16px; font-weight: 800; color: ${D.t2}; margin-bottom: 5px; }
  .st-empty-sub { font-family: ${body}; font-size: 13px; color: ${D.t4}; }
  .st-loading {
    text-align: center; padding: 52px 0; color: ${D.t4};
    font-family: ${body}; font-size: 13px;
    background: repeating-linear-gradient(90deg, ${D.bgMid} 0%, ${D.bgCard} 40%, ${D.bgMid} 80%);
    background-size: 200% 100%;
    animation: shimmer 1.6s linear infinite;
    border-radius: 18px; margin: 0 16px;
  }

  /* ── SHEET ── */
  .st-backdrop {
    position: fixed; inset: 0; z-index: 400;
    background: rgba(13,17,23,.4); backdrop-filter: blur(6px);
    animation: fadeIn .2s ease;
  }
  .st-sheet {
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 401;
    background: ${D.bgCard}; border-radius: 26px 26px 0 0;
    max-width: 640px; margin: 0 auto;
    max-height: 92vh; overflow-y: auto;
    animation: sheetUp .3s cubic-bezier(.34,1.08,.64,1);
    box-shadow: 0 -16px 60px rgba(0,0,0,.18);
  }
  .st-sheet::-webkit-scrollbar { width: 0; }
  .st-sheet-handle-bar { display: flex; justify-content: center; padding: 12px 0 4px; }
  .st-sheet-handle { width: 38px; height: 4px; border-radius: 99px; background: ${D.borderMd}; }

  .st-section-title {
    font-family: ${body}; font-size: 9.5px; font-weight: 700;
    text-transform: uppercase; letter-spacing: .1em; color: ${D.t4};
    margin-bottom: 8px;
  }

  /* driver panel */
  .st-driver-panel {
    border-radius: 16px; overflow: hidden;
    box-shadow: 0 1px 6px rgba(0,0,0,.06), 0 0 0 1px rgba(0,0,0,.05);
    margin-bottom: 20px;
  }
  .st-metric-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; margin-top: 12px; }
  .st-metric {
    background: ${D.bgCard}; border-radius: 12px; padding: 10px 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,.05), 0 0 0 1px rgba(0,0,0,.04);
  }
  .st-metric-label { font-family: ${body}; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: ${D.t4}; margin-bottom: 6px; display: flex; align-items: center; gap: 4px; }
  .st-metric-value { font-family: ${display}; font-size: 21px; font-weight: 800; letter-spacing: -.04em; line-height: 1; }
  .st-metric-unit  { font-size: 11px; font-weight: 600; color: ${D.t3}; margin-left: 2px; }
  .st-metric-sub   { font-family: ${mono}; font-size: 9.5px; color: ${D.t3}; margin-top: 3px; }

  /* fare grid */
  .st-fare-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px; }
  .st-fare-card {
    border-radius: 14px; overflow: hidden;
    box-shadow: 0 1px 4px rgba(0,0,0,.06), 0 0 0 1px rgba(0,0,0,.05);
    background: ${D.bgCard};
  }

  /* detail rows */
  .st-detail-row {
    display: flex; gap: 11px; align-items: flex-start;
    padding: 11px 14px; border-radius: 13px;
    background: ${D.bgMid};
    box-shadow: 0 0 0 1px rgba(0,0,0,.05);
    margin-bottom: 7px;
  }
  .st-detail-label { font-family: ${body}; font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: ${D.t4}; margin-bottom: 3px; }
  .st-detail-value { font-family: ${body}; font-size: 13px; font-weight: 600; color: ${D.t1}; word-break: break-all; }
  .st-detail-value.mono { font-family: ${mono}; font-size: 11.5px; }

  /* account panel */
  .st-account-panel {
    border-radius: 16px; overflow: hidden;
    box-shadow: 0 1px 6px rgba(0,0,0,.06), 0 0 0 1px rgba(0,0,0,.05);
    margin-bottom: 20px;
  }
`;

// ─── AVATAR ────────────────────────────────────────────────────────────────
function Avatar({ account, size = 36, guest = false }) {
  const r = size * 0.28;
  if (guest) return (
    <div style={{ width: size, height: size, borderRadius: r, background: D.amberLight, border: `1.5px solid ${D.amber}35`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <UserX size={size * 0.42} color={D.amber} />
    </div>
  );
  if (!account) return (
    <div style={{ width: size, height: size, borderRadius: r, background: D.tealLight, border: `1.5px solid ${D.teal}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <User size={size * 0.42} color={D.teal} />
    </div>
  );
  const hue = hashHue(account.uid);
  return (
    <div style={{ width: size, height: size, borderRadius: r, background: `hsl(${hue},55%,93%)`, border: `1.5px solid hsl(${hue},45%,80%)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: size * 0.33, fontWeight: 800, color: `hsl(${hue},50%,28%)`, fontFamily: display, letterSpacing: "-.02em" }}>
      {initials(account.name)}
    </div>
  );
}

// ─── MAP ───────────────────────────────────────────────────────────────────
function SearchMapView({ searches = [], selectedId, hoveredId, onSelect, height = 280 }) {
  const ref        = useRef(null);
  const mapRef     = useRef(null);
  const initRef    = useRef(false);
  const [ready,    setReady]    = useState(false);
  const [expanded, setExpanded] = useState(false);
  const h = expanded ? 480 : height;

  const pickFeat = useMemo(() => searches.filter(hasPickup).map(s => ({
    type: "Feature",
    properties: {
      id: s.id,
      sel: s.id === selectedId,
      hov: s.id === hoveredId,
      guest: isGuest(s),
      color: s.id === selectedId ? D.t1
           : s.id === hoveredId  ? (isGuest(s) ? D.amber : D.teal)
           : isGuest(s) ? D.amber : D.teal,
    },
    geometry: { type: "Point", coordinates: [s.pickupLng, s.pickupLat] },
  })), [searches, selectedId, hoveredId]);

  const fitAll = useCallback(() => {
    const m = mapRef.current;
    if (!m || !searches.length) return;
    const pts = searches.filter(hasPickup);
    if (!pts.length) return;
    const lats = pts.map(s => s.pickupLat);
    const lngs = pts.map(s => s.pickupLng);
    m.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: { top: 55, bottom: 55, left: 55, right: 55 }, maxZoom: 13, duration: 700 }
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
        style: "mapbox://styles/mapbox/light-v11",
        center: [-81.3792, 28.5383], zoom: 10,
        attributionControl: false, fadeDuration: 0,
      });
      mapRef.current = map;
      map.addControl(new window.mapboxgl.NavigationControl({ showCompass: false }), "top-right");
      map.on("load", () => {
        map.addSource("pickups", { type: "geojson", data: { type: "FeatureCollection", features: [] } });

        // Outer glow ring
        map.addLayer({ id: "pk-ring", type: "circle", source: "pickups",
          paint: {
            "circle-color": ["get", "color"],
            "circle-radius": ["case", ["get", "sel"], 22, ["get", "hov"], 17, 11],
            "circle-opacity": ["case", ["get", "sel"], .14, ["get", "hov"], .12, .07],
            "circle-blur": 1,
          },
        });
        // Mid ring
        map.addLayer({ id: "pk-mid", type: "circle", source: "pickups",
          paint: {
            "circle-color": "#FFFFFF",
            "circle-radius": ["case", ["get", "sel"], 10, ["get", "hov"], 8.5, 6.5],
            "circle-opacity": 1,
          },
        });
        // Core dot
        map.addLayer({ id: "pk-dot", type: "circle", source: "pickups",
          paint: {
            "circle-color": ["get", "color"],
            "circle-radius": ["case", ["get", "sel"], 7, ["get", "hov"], 6, 4.5],
            "circle-stroke-color": "#FFFFFF",
            "circle-stroke-width": ["case", ["get", "sel"], 2, 1.5],
            "circle-opacity": ["case", ["get", "sel"], 1, ["get", "hov"], .95, .8],
          },
        });

        map.on("click", "pk-dot", e => { const id = e.features?.[0]?.properties?.id; if (id) onSelect(id); });
        map.on("mouseenter", "pk-dot", () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "pk-dot", () => { map.getCanvas().style.cursor = ""; });
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
    mapRef.current.getSource("pickups")?.setData({ type: "FeatureCollection", features: pickFeat });
  }, [ready, pickFeat]);

  useEffect(() => { if (ready && searches.length) setTimeout(fitAll, 200); }, [ready]); // eslint-disable-line

  useEffect(() => {
    if (!selectedId || !mapRef.current || !ready) return;
    const s = searches.find(x => x.id === selectedId);
    if (s && hasPickup(s)) {
      mapRef.current.flyTo({ center: [s.pickupLng, s.pickupLat], zoom: 14, duration: 700 });
    }
  }, [selectedId, searches, ready]);

  useEffect(() => { const t = setTimeout(() => mapRef.current?.resize(), 300); return () => clearTimeout(t); }, [expanded]);

  const guestCt = searches.filter(isGuest).length;
  const riderCt = searches.length - guestCt;

  return (
    <div className="st-map-wrap">
      <div className="st-map-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: D.tealLight, border: `1.5px solid ${D.teal}25`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <MapPin size={15} color={D.teal} />
          </div>
          <div>
            <div className="st-map-title">Pickup Locations</div>
            <div className="st-map-sub">{searches.filter(hasPickup).length} mapped · {searches.length} total</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Legend */}
          <div style={{ display: "flex", gap: 6 }}>
            {[{ color: D.teal, label: "Rider", count: riderCt }, { color: D.amber, label: "Guest", count: guestCt }].map(({ color, label, count }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 4, background: `${color}0F`, border: `1px solid ${color}28`, borderRadius: 99, padding: "3px 9px" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
                <span style={{ fontFamily: body, fontSize: 10, fontWeight: 700, color }}>{label} {count}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => setExpanded(e => !e)}
            style={{ width: 30, height: 30, borderRadius: 9, border: `1px solid ${D.borderMd}`, background: D.bgMid, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: D.t3, transition: "all .15s" }}
          >
            {expanded ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
          </button>
        </div>
      </div>

      <div className="mbst" style={{ position: "relative", height: h, background: "#EEF2F7", transition: "height .32s cubic-bezier(.32,.72,0,1)" }}>
        <div ref={ref} style={{ width: "100%", height: "100%" }} />
        {searches.length === 0 && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(245,247,250,.96)", zIndex: 20, gap: 8 }}>
            <MapIcon size={24} color={D.t4} />
            <span style={{ fontFamily: body, fontSize: 13, fontWeight: 600, color: D.t4 }}>No pickups to display</span>
          </div>
        )}
        {searches.length > 0 && (
          <button onClick={fitAll}
            style={{ position: "absolute", bottom: 12, right: 12, zIndex: 15, background: "rgba(255,255,255,.94)", backdropFilter: "blur(10px)", border: `1.5px solid ${D.borderMd}`, borderRadius: 99, padding: "5px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, boxShadow: "0 2px 10px rgba(0,0,0,.08)", fontFamily: body, fontSize: 10, fontWeight: 700, color: D.t3 }}>
            <MapIcon size={10} color={D.t4} /> Fit All
          </button>
        )}
      </div>
    </div>
  );
}

// ─── STATS BAR ─────────────────────────────────────────────────────────────
function StatsBar({ searches, accountMap }) {
  const total    = searches.length;
  const guests   = searches.filter(isGuest).length;
  const riders   = total - guests;
  const unique   = new Set(searches.filter(s => !isGuest(s)).map(s => s.uid)).size;
  const avgMi    = total ? (searches.reduce((a, s) => a + (s.miles || 0), 0) / total).toFixed(1) : "—";
  const matched  = searches.filter(s => s.driverInfo?.driverCount > 0).length;
  const matchPct = total ? Math.round((matched / total) * 100) : 0;

  const stats = [
    { v: total,          l: "Searches",   c: D.t1,    delay: 0   },
    { v: riders,         l: "Riders",     c: D.teal,  delay: 40  },
    { v: guests,         l: "Guests",     c: D.amber, delay: 80  },
    { v: unique,         l: "Accounts",   c: D.blue,  delay: 120 },
    { v: avgMi,          l: "Avg mi",     c: D.t1,    delay: 160 },
    { v: matchPct + "%", l: "Matched",    c: matchPct > 70 ? D.green : matchPct > 40 ? D.amber : D.red, delay: 200 },
  ];

  return (
    <div className="st-stats">
      {stats.map(({ v, l, c, delay }) => (
        <div key={l} className="st-stat" style={{ animationDelay: `${delay}ms` }}>
          <div className="st-stat-label">{l}</div>
          <div className="st-stat-value" style={{ color: c }}>{v}</div>
        </div>
      ))}
    </div>
  );
}

// ─── TAG ───────────────────────────────────────────────────────────────────
function Tag({ children, color, bg, border }) {
  return (
    <span className="st-tag" style={{ color: color ?? D.t3, background: bg ?? D.bgMid, border: `1.5px solid ${border ?? D.border}` }}>
      {children}
    </span>
  );
}

// ─── SEARCH CARD ───────────────────────────────────────────────────────────
function SearchCard({ doc, index, selected, hovered, onHover, onLeave, onClick, account }) {
  const guest = isGuest(doc);
  const ac    = guest ? D.amber : D.teal;
  const isAct = selected || hovered;
  const hasDriver = doc.driverInfo?.driverCount > 0;

  return (
    <div
      className={`st-card${selected ? " selected" : ""}`}
      style={{ animationDelay: `${index * 25}ms` }}
      onClick={onClick} onMouseEnter={onHover} onMouseLeave={onLeave}
    >
      {/* Top accent bar */}
      <div className="st-card-accent" style={{ background: isAct ? `linear-gradient(90deg,${ac},${ac}55)` : "transparent", borderBottom: isAct ? "none" : `1px solid ${D.border}` }} />

      <div className="st-card-body">
        <Avatar account={account} guest={guest} size={40} />

        <div className="st-card-main">
          <div className="st-card-top">
            <span className="st-card-name">
              {guest ? "Guest" : (account?.name ?? "Rider")}
            </span>
            <span className="st-card-time">{fmtRelative(doc.createdAt)}</span>
          </div>

          <div className="st-card-email">
            {guest ? "Not signed in" : (account?.email ?? doc.uid?.slice(0, 20) + "…")}
          </div>

          {/* Pickup pill */}
          <div
            className="st-pickup-pill"
            style={{ borderColor: isAct ? `${ac}30` : D.border, background: isAct ? `${ac}06` : D.bgMid }}
          >
            <div
              className="st-pickup-dot"
              style={{ background: ac, "--dot-ring": isAct ? `${ac}25` : "transparent" }}
            />
            <span className="st-pickup-addr">{strip(doc.pickup)}</span>
          </div>

          {/* Tags */}
          <div className="st-chips">
            {doc.miles   != null && (
              <Tag color={D.t3} bg={D.bgMid}>
                <Ruler size={9} />{doc.miles.toFixed(1)} mi
              </Tag>
            )}
            {doc.minutes != null && (
              <Tag color={D.t3} bg={D.bgMid}>
                <Clock size={9} />{doc.minutes} min
              </Tag>
            )}
            {doc.driverInfo != null && (
              <Tag color={hasDriver ? D.green : D.red} bg={hasDriver ? D.greenLight : D.redLight} border={hasDriver ? `${D.green}25` : `${D.red}25`}>
                <Car size={9} />{hasDriver ? `${doc.driverInfo.driverCount} driver${doc.driverInfo.driverCount > 1 ? "s" : ""}` : "No driver"}
              </Tag>
            )}
            <Tag color={ac} bg={guest ? D.amberLight : D.tealLight} border={`${ac}25`}>
              {guest ? <UserX size={9} /> : <User size={9} />}
              {guest ? "Guest" : "Rider"}
            </Tag>
            {doc.rides?.economy && (
              <Tag color={D.teal} bg={D.tealLight} border={`${D.teal}25`}>
                <Banknote size={9} />${doc.rides.economy.total}
              </Tag>
            )}
          </div>
        </div>

        <ChevronRight size={13} color={isAct ? ac : D.t4} style={{ flexShrink: 0, marginTop: 6, transition: "color .15s" }} />
      </div>
    </div>
  );
}

// ─── DRIVER PANEL ──────────────────────────────────────────────────────────
function DriverPanel({ driverInfo }) {
  if (!driverInfo) return null;
  const { driverCount, nearestMiles, etaLabel, etaMin, stale } = driverInfo;
  const has     = driverCount > 0;
  const urgency = etaMin <= 15 ? D.green : etaMin <= 45 ? D.amber : D.red;

  return (
    <div style={{ marginBottom: 20 }}>
      <div className="st-section-title">Driver Intelligence</div>
      <div className="st-driver-panel" style={{ border: `1.5px solid ${has ? D.teal + "28" : D.red + "20"}` }}>
        <div style={{ height: 3, background: has ? `linear-gradient(90deg,${D.teal},${D.blue})` : `linear-gradient(90deg,${D.red},${D.amber})` }} />
        <div style={{ padding: "14px 16px", background: has ? D.tealLight : D.redLight }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: has ? 12 : 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: has ? D.tealMid : `${D.red}12`, border: `1px solid ${has ? D.teal + "28" : D.red + "22"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Car size={18} color={has ? D.teal : D.red} />
              </div>
              <div>
                <div style={{ fontFamily: display, fontSize: 15, fontWeight: 700, color: D.t1 }}>
                  {has ? `${driverCount} Driver${driverCount > 1 ? "s" : ""} Available` : "No Drivers Nearby"}
                </div>
                <div style={{ fontFamily: body, fontSize: 11.5, color: D.t3, marginTop: 2 }}>
                  {has ? "Ready to accept this route" : "No drivers matched at time of search"}
                </div>
              </div>
            </div>
            {stale && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 99, background: D.amberMid, border: `1px solid ${D.amber}30` }}>
                <AlertTriangle size={10} color={D.amber} />
                <span style={{ fontFamily: body, fontSize: 10, fontWeight: 700, color: D.amber }}>STALE</span>
              </div>
            )}
          </div>

          {has && (
            <div className="st-metric-grid">
              {[
                { icon: <Radio size={11} color={D.teal} />, label: "Drivers",  value: driverCount,             color: D.teal,   unit: "" },
                { icon: <Ruler size={11} color={urgency} />, label: "Nearest", value: nearestMiles?.toFixed(1), color: urgency,  unit: "mi" },
                { icon: <Timer size={11} color={urgency} />, label: "ETA",     value: etaMin,                  color: urgency,  unit: "min", sub: etaLabel },
              ].map(({ icon, label, value, color, unit, sub }) => (
                <div key={label} className="st-metric">
                  <div className="st-metric-label">{icon}{label}</div>
                  <div className="st-metric-value" style={{ color }}>
                    {value}<span className="st-metric-unit">{unit}</span>
                  </div>
                  {sub && <div className="st-metric-sub">{sub}</div>}
                </div>
              ))}
            </div>
          )}

          {has && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontFamily: body, fontSize: 10, fontWeight: 700, color: D.t4, textTransform: "uppercase", letterSpacing: ".06em" }}>Pickup ETA</span>
                <span style={{ fontFamily: mono, fontSize: 11, color: urgency, fontWeight: 600 }}>{etaLabel}</span>
              </div>
              <div style={{ height: 5, borderRadius: 99, background: D.borderMd, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 99, background: urgency, width: `${Math.max(5, Math.min(100, 100 - (etaMin / 120) * 100))}%`, transition: "width .6s ease", boxShadow: `0 0 6px ${urgency}40` }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ fontFamily: body, fontSize: 9.5, color: D.t4 }}>Fast</span>
                <span style={{ fontFamily: body, fontSize: 9.5, color: D.t4 }}>2hr+</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── FARE GRID ─────────────────────────────────────────────────────────────
function FareGrid({ rides }) {
  if (!rides) return null;
  const keys = ["economy", "standard", "premium", "xl"].filter(k => rides[k]);
  if (!keys.length) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="st-section-title">Fare Options Shown</div>
      <div className="st-fare-grid">
        {keys.map(k => {
          const t   = rides[k];
          const cfg = TIER[k] ?? { label: k, color: D.t3, grad: "linear-gradient(90deg,#CBD5E1,#94A3B8)" };
          return (
            <div key={k} className="st-fare-card">
              <div style={{ height: 3, background: cfg.grad }} />
              <div style={{ padding: "11px 13px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <span style={{ fontFamily: display, fontSize: 12, fontWeight: 800, color: cfg.color }}>{cfg.label}</span>
                  <span style={{ fontFamily: display, fontSize: 19, fontWeight: 800, color: D.t1, letterSpacing: "-.04em" }}>${t.total}</span>
                </div>
                <div style={{ fontFamily: body, fontSize: 10.5, color: D.t4, marginBottom: 4 }}>{t.eta}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Users size={9} color={D.t4} />
                  <span style={{ fontFamily: body, fontSize: 10, color: D.t4, fontWeight: 600 }}>Up to {t.capacity}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── DETAIL SHEET ──────────────────────────────────────────────────────────
function DetailSheet({ doc, account, onClose }) {
  if (!doc) return null;
  const guest = isGuest(doc);
  const ac    = guest ? D.amber : D.teal;
  const mapsUrl = doc.pickupLat && doc.pickupLng
    ? `https://www.google.com/maps/search/?api=1&query=${doc.pickupLat},${doc.pickupLng}` : null;

  return (
    <>
      <div className="st-backdrop" onClick={onClose} />
      <div className="st-sheet">
        {/* Handle */}
        <div className="st-sheet-handle-bar"><div className="st-sheet-handle" /></div>

        {/* Top accent */}
        <div style={{ height: 3, background: `linear-gradient(90deg,${ac},${ac}44)`, margin: "0 20px", borderRadius: 99 }} />

        <div style={{ padding: "16px 20px 48px" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
              <Avatar account={account} guest={guest} size={52} />
              <div>
                <div style={{ fontFamily: display, fontSize: 21, fontWeight: 800, color: D.t1, letterSpacing: "-.04em" }}>
                  {guest ? "Guest Search" : (account?.name ?? "Search Detail")}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: ac, boxShadow: `0 0 0 3px ${ac}28` }} />
                  <span style={{ fontFamily: body, fontSize: 12, fontWeight: 700, color: ac }}>{guest ? "Guest" : "Rider"}</span>
                  {!guest && account?.email && (
                    <span style={{ fontFamily: mono, fontSize: 11, color: D.t3 }}>{account.email}</span>
                  )}
                </div>
              </div>
            </div>
            <button onClick={onClose}
              style={{ width: 34, height: 34, borderRadius: "50%", border: `1.5px solid ${D.border}`, background: D.bgMid, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: D.t3, flexShrink: 0, transition: "all .15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#FEF2F2"; e.currentTarget.style.borderColor = `${D.red}30`; e.currentTarget.style.color = D.red; }}
              onMouseLeave={e => { e.currentTarget.style.background = D.bgMid; e.currentTarget.style.borderColor = D.border; e.currentTarget.style.color = D.t3; }}
            >
              <X size={14} />
            </button>
          </div>

          {/* Pickup hero */}
          <div style={{ padding: "14px 16px", background: `${ac}09`, border: `2px solid ${ac}28`, borderRadius: 16, marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: `${ac}15`, border: `1.5px solid ${ac}28`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Navigation size={16} color={ac} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: body, fontSize: 9.5, fontWeight: 700, color: D.t4, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 3 }}>Pickup Location</div>
              <div style={{ fontFamily: body, fontSize: 14, fontWeight: 700, color: D.t1, lineHeight: 1.35 }}>{doc.pickup || "—"}</div>
            </div>
          </div>

          {/* Driver intel */}
          <DriverPanel driverInfo={doc.driverInfo} />

          {/* Account */}
          {!guest && account && (
            <div style={{ marginBottom: 20 }}>
              <div className="st-section-title">Rider Account</div>
              <div className="st-account-panel" style={{ border: `1.5px solid ${D.teal}20` }}>
                <div style={{ height: 2, background: `linear-gradient(90deg,${D.teal},${D.blue})` }} />
                <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${D.border}`, background: D.tealLight }}>
                  <Avatar account={account} size={46} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: display, fontSize: 16, fontWeight: 700, color: D.t1 }}>{account.name}</div>
                    <div style={{ fontFamily: mono, fontSize: 11.5, color: D.t3, marginTop: 3 }}>{account.email}</div>
                  </div>
                  {account.welcomeEmailSent && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, background: D.greenLight, border: `1.5px solid ${D.green}28`, borderRadius: 99, padding: "3px 10px" }}>
                      <CheckCircle size={9} color={D.green} />
                      <span style={{ fontFamily: body, fontSize: 10, fontWeight: 700, color: D.green }}>Verified</span>
                    </div>
                  )}
                </div>
                <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 9, background: D.bgCard }}>
                  {[
                    { icon: <Mail  size={12} color={D.t4} />, label: "Email",  value: account.email,             isMono: true  },
                    { icon: <Hash  size={12} color={D.t4} />, label: "UID",    value: account.uid,               isMono: true  },
                    { icon: <Clock size={12} color={D.t4} />, label: "Joined", value: fmtTime(account.createdAt) },
                  ].map(({ icon, label, value, isMono }) => (
                    <div key={label} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
                      <div style={{ marginTop: 1, flexShrink: 0 }}>{icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: body, fontSize: 9.5, fontWeight: 700, color: D.t4, textTransform: "uppercase", letterSpacing: ".07em", marginBottom: 2 }}>{label}</div>
                        <div className={`st-detail-value${isMono ? " mono" : ""}`}>{value || "—"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Trip details */}
          <div style={{ marginBottom: 20 }}>
            <div className="st-section-title">Trip Details</div>
            {[
              { label: "Full Address",  value: doc.pickup,                                         icon: <Navigation size={13} color={D.teal} /> },
              { label: "Distance",      value: doc.miles   ? `${doc.miles.toFixed(2)} mi` : null,  icon: <Ruler      size={13} color={D.t4}   /> },
              { label: "Est. Duration", value: doc.minutes ? `${doc.minutes} min`         : null,  icon: <Clock      size={13} color={D.t4}   /> },
              { label: "Searched At",   value: fmtTime(doc.createdAt),                             icon: <Timer      size={13} color={D.t4}   /> },
            ].filter(r => r.value).map(({ label, value, icon }) => (
              <div key={label} className="st-detail-row">
                <div style={{ marginTop: 1, flexShrink: 0 }}>{icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="st-detail-label">{label}</div>
                  <div className="st-detail-value">{value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Fares */}
          <FareGrid rides={doc.rides} />

          {/* CTA */}
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 15, borderRadius: 16, background: D.teal, color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: display, textDecoration: "none", boxShadow: `0 6px 22px ${D.tealGlow}`, letterSpacing: "-.01em" }}>
              <MapPin size={15} /> Open in Google Maps
            </a>
          )}
        </div>
      </div>
    </>
  );
}

// ─── MAIN EXPORT ───────────────────────────────────────────────────────────
export function SearchTab({ onToast }) {
  const { searches, loading }         = useSearches();
  const { accounts, loading: acLoad } = useAccounts();
  const [queryStr,   setQueryStr]     = useState("");
  const [filter,     setFilter]       = useState("all");
  const [selectedId, setSelectedId]   = useState(null);
  const [hoveredId,  setHoveredId]    = useState(null);

  const accountMap = useMemo(() => {
    const m = {};
    (accounts ?? []).forEach(a => { if (a.uid) m[a.uid] = a; });
    return m;
  }, [accounts]);

  const filtered = useMemo(() => {
    let list = [...searches].sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0));
    if (filter === "riders") list = list.filter(s => !isGuest(s));
    if (filter === "guests") list = list.filter(isGuest);
    if (queryStr.trim()) {
      const q = queryStr.toLowerCase();
      list = list.filter(s => {
        const acc = accountMap[s.uid];
        return (s.pickup  || "").toLowerCase().includes(q)
            || (s.uid     || "").toLowerCase().includes(q)
            || (acc?.name  || "").toLowerCase().includes(q)
            || (acc?.email || "").toLowerCase().includes(q);
      });
    }
    return list;
  }, [searches, queryStr, filter, accountMap]);

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
    <div className="st-root">
      <style>{GLOBAL_CSS}</style>

      {/* Stats */}
      {!loading && searches.length > 0 && <StatsBar searches={searches} accountMap={accountMap} />}

      {/* Map */}
      {!loading && (
        <SearchMapView
          searches={filtered.length > 0 ? filtered : searches}
          selectedId={selectedId}
          hoveredId={hoveredId}
          onSelect={setSelectedId}
          height={280}
        />
      )}

      {/* Search + filters */}
      <div className="st-controls">
        <div className="st-search-wrap">
          <Search size={14} color={D.t4} className="st-search-icon" />
          <input
            className="st-search-input"
            value={queryStr}
            onChange={e => setQueryStr(e.target.value)}
            placeholder="Search name, email, address, UID…"
          />
          {queryStr && (
            <button className="st-search-clear" onClick={() => setQueryStr("")}>
              <X size={13} />
            </button>
          )}
        </div>

        <div className="st-filters">
          {FILTERS.map(({ k, l, c }) => (
            <button key={k} className={`st-chip${filter === k ? " active" : ""}`} onClick={() => setFilter(k)}>
              {l}<span className="st-chip-count">{c}</span>
            </button>
          ))}
          <span className="st-result-count">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* List */}
      {loading || acLoad ? (
        <div className="st-loading" style={{ margin: "14px 16px", padding: "52px 20px" }}>Loading searches…</div>
      ) : filtered.length === 0 ? (
        <div className="st-empty" style={{ marginTop: 14 }}>
          <Search size={26} color={D.t4} style={{ display: "block", margin: "0 auto 12px" }} />
          <div className="st-empty-title">No searches found</div>
          <div className="st-empty-sub">Try adjusting your filters or search term</div>
        </div>
      ) : (
        <div className="st-list">
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

      {/* Detail sheet */}
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
