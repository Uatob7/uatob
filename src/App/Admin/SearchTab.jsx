import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  MapPin, Navigation, Clock, Ruler, User, Search,
  ChevronRight, X, Route, Map as MapIcon,
  Maximize2, Minimize2, ArrowRight, CreditCard,
  Users, UserX, TrendingUp, Car, Banknote, Star,
  Mail, Shield, CheckCircle, Hash,
} from "lucide-react";
import { C } from "@/App/Admin/Tokens";
import { useSearches } from "@/App/Admin/useSearches";
import { useAccounts } from "@/App/Admin/useAccounts"; // ← NEW

// ─── CONFIG ────────────────────────────────────────────────────────────────
const MAPBOX_TOKEN = "pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA";
const RIDER_COLOR  = "#0D9488";
const GUEST_COLOR  = "#F59E0B";

const TIER_CONFIG = {
  economy:  { label: "Economy",  color: "#0D9488", icon: "🚗", gradient: "linear-gradient(135deg,#0D9488,#0891B2)" },
  standard: { label: "Standard", color: "#3B82F6", icon: "🚙", gradient: "linear-gradient(135deg,#3B82F6,#6366F1)" },
  premium:  { label: "Premium",  color: "#8B5CF6", icon: "🏎️",  gradient: "linear-gradient(135deg,#8B5CF6,#EC4899)" },
  xl:       { label: "XL",       color: "#F59E0B", icon: "🚐", gradient: "linear-gradient(135deg,#F59E0B,#EF4444)" },
};

// ─── MAPBOX SINGLETON LOADER ───────────────────────────────────────────────
let _mbReady = false, _mbQueue = [];
function loadMapbox(cb) {
  if (_mbReady && window.mapboxgl) { cb(); return; }
  _mbQueue.push(cb);
  if (document.getElementById("mb-css-search")) { if (_mbReady) cb(); return; }
  const link = document.createElement("link");
  link.id   = "mb-css-search"; link.rel = "stylesheet";
  link.href = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css";
  document.head.appendChild(link);
  const s = document.createElement("script");
  s.src    = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js";
  s.onload = () => { _mbReady = true; _mbQueue.forEach(f => f()); _mbQueue = []; };
  document.head.appendChild(s);
}

// ─── HELPERS ───────────────────────────────────────────────────────────────
function fmtTime(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}
function fmtDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("en-US", { month: "short", day: "numeric" });
}
function stripCity(addr) {
  if (!addr) return "—";
  return addr
    .replace(/, Orlando, FL, USA$/i, "")
    .replace(/, FL, USA$/i, "")
    .replace(/, USA$/i, "");
}
function isGuest(s) { return !s.uid || s.uid === "null" || s.uid === null; }
function hasBothCoords(s) {
  return (
    typeof s.pickupLat  === "number" && typeof s.pickupLng  === "number" &&
    typeof s.dropoffLat === "number" && typeof s.dropoffLng === "number"
  );
}

// ── Account helpers ────────────────────────────────────────────────────────
function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function hashColor(uid) {
  // Deterministic hue from UID for avatar bg
  let h = 0;
  for (let i = 0; i < (uid || "").length; i++) h = (h * 31 + uid.charCodeAt(i)) & 0xffffff;
  const hue = h % 360;
  return `hsl(${hue},55%,38%)`;
}

// ─── AVATAR ─────────────────────────────────────────────────────────────────
function Avatar({ account, size = 32, guest = false }) {
  if (guest) {
    return (
      <div style={{
        width: size, height: size, borderRadius: "50%",
        background: `${GUEST_COLOR}22`, border: `1.5px solid ${GUEST_COLOR}44`,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <UserX size={size * 0.42} color={GUEST_COLOR} />
      </div>
    );
  }
  if (!account) {
    return (
      <div style={{
        width: size, height: size, borderRadius: "50%",
        background: `${RIDER_COLOR}18`, border: `1.5px solid ${RIDER_COLOR}30`,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <User size={size * 0.42} color={RIDER_COLOR} strokeWidth={2} />
      </div>
    );
  }
  const bg = hashColor(account.uid);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: bg, border: `1.5px solid rgba(255,255,255,.15)`,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      fontSize: size * 0.35, fontWeight: 800, color: "#fff",
      fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: ".03em",
    }}>
      {getInitials(account.name)}
    </div>
  );
}

// ─── ROUTE MAP ─────────────────────────────────────────────────────────────
function SearchMapView({
  searches = [], selectedId, hoveredId,
  onSelect, height = 340, expandable = true,
}) {
  const containerRef   = useRef(null);
  const mapRef         = useRef(null);
  const initRef        = useRef(false);
  const [expanded,     setExpanded]     = useState(false);
  const [mbLoaded,     setMbLoaded]     = useState(false);
  const mapHeight = expanded ? 520 : height;

  const routeFeatures = useMemo(() =>
    searches.filter(hasBothCoords).map(s => ({
      type: "Feature",
      properties: {
        id:       s.id,
        guest:    isGuest(s),
        selected: s.id === selectedId,
        hovered:  s.id === hoveredId,
        color:    s.id === selectedId ? "#FFFFFF"
                : s.id === hoveredId  ? (isGuest(s) ? "#FCD34D" : "#34D399")
                : isGuest(s) ? GUEST_COLOR : RIDER_COLOR,
      },
      geometry: {
        type: "LineString",
        coordinates: [[s.pickupLng, s.pickupLat], [s.dropoffLng, s.dropoffLat]],
      },
    }))
  , [searches, selectedId, hoveredId]);

  const pickupFeatures = useMemo(() =>
    searches.filter(s => s.pickupLat && s.pickupLng).map(s => ({
      type: "Feature",
      properties: {
        id: s.id, guest: isGuest(s),
        selected: s.id === selectedId, hovered: s.id === hoveredId,
        color: s.id === selectedId ? "#FFFFFF"
             : s.id === hoveredId  ? (isGuest(s) ? "#FCD34D" : "#34D399")
             : isGuest(s) ? GUEST_COLOR : RIDER_COLOR,
      },
      geometry: { type: "Point", coordinates: [s.pickupLng, s.pickupLat] },
    }))
  , [searches, selectedId, hoveredId]);

  const dropoffFeatures = useMemo(() =>
    searches.filter(hasBothCoords).map(s => ({
      type: "Feature",
      properties: {
        id: s.id, guest: isGuest(s),
        selected: s.id === selectedId, hovered: s.id === hoveredId,
        color: s.id === selectedId ? "#FFFFFF"
             : s.id === hoveredId  ? (isGuest(s) ? "#FCD34D" : "#34D399")
             : isGuest(s) ? GUEST_COLOR : RIDER_COLOR,
      },
      geometry: { type: "Point", coordinates: [s.dropoffLng, s.dropoffLat] },
    }))
  , [searches, selectedId, hoveredId]);

  const fitAll = useCallback(() => {
    const m = mapRef.current;
    if (!m || searches.length === 0) return;
    const lats = searches.flatMap(s => [s.pickupLat, s.dropoffLat].filter(v => typeof v === "number"));
    const lngs = searches.flatMap(s => [s.pickupLng, s.dropoffLng].filter(v => typeof v === "number"));
    if (!lats.length) return;
    m.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: { top: 50, bottom: 60, left: 40, right: 50 }, maxZoom: 13, duration: 800 }
    );
  }, [searches]);

  useEffect(() => {
    if (!containerRef.current || initRef.current) return;
    loadMapbox(() => {
      if (!containerRef.current || initRef.current) return;
      initRef.current = true;
      window.mapboxgl.accessToken = MAPBOX_TOKEN;
      const map = new window.mapboxgl.Map({
        container: containerRef.current,
        style:     "mapbox://styles/mapbox/dark-v11",
        center:    [-81.3792, 28.5383],
        zoom:      11,
        attributionControl: false,
        fadeDuration: 0,
      });
      mapRef.current = map;
      map.addControl(new window.mapboxgl.NavigationControl({ showCompass: false }), "top-right");

      map.on("load", () => {
        map.addSource("routes",   { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addSource("pickups",  { type: "geojson", data: { type: "FeatureCollection", features: [] } });
        map.addSource("dropoffs", { type: "geojson", data: { type: "FeatureCollection", features: [] } });

        map.addLayer({ id: "route-glow", type: "line", source: "routes",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": ["get", "color"], "line-width": 12,
            "line-opacity": ["case", ["get", "selected"], 0.35, ["get", "hovered"], 0.25, 0.06], "line-blur": 5 } });
        map.addLayer({ id: "route-line", type: "line", source: "routes",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: { "line-color": ["get", "color"],
            "line-width": ["case", ["get", "selected"], 2.5, ["get", "hovered"], 2, 1.5],
            "line-opacity": ["case", ["get", "selected"], 1, ["get", "hovered"], 0.85, 0.3] } });
        map.addLayer({ id: "pickup-halo", type: "circle", source: "pickups",
          paint: { "circle-color": ["get", "color"],
            "circle-radius": ["case", ["get", "selected"], 16, ["get", "hovered"], 14, 9],
            "circle-opacity": 0.15, "circle-blur": 1 } });
        map.addLayer({ id: "pickup-dot", type: "circle", source: "pickups",
          paint: { "circle-color": ["get", "color"],
            "circle-radius": ["case", ["get", "selected"], 7, ["get", "hovered"], 6, 4],
            "circle-stroke-color": "#fff",
            "circle-stroke-width": ["case", ["get", "selected"], 2.5, 1.5],
            "circle-opacity": ["case", ["get", "selected"], 1, ["get", "hovered"], 0.95, 0.65] } });
        map.addLayer({ id: "dropoff-halo", type: "circle", source: "dropoffs",
          paint: { "circle-color": ["get", "color"],
            "circle-radius": ["case", ["get", "selected"], 14, ["get", "hovered"], 12, 8],
            "circle-opacity": 0.12, "circle-blur": 1 } });
        map.addLayer({ id: "dropoff-dot", type: "circle", source: "dropoffs",
          paint: { "circle-color": ["get", "color"],
            "circle-radius": ["case", ["get", "selected"], 6, ["get", "hovered"], 5, 3.5],
            "circle-stroke-color": "#fff",
            "circle-stroke-width": ["case", ["get", "selected"], 2.5, 1.5],
            "circle-opacity": ["case", ["get", "selected"], 1, ["get", "hovered"], 0.9, 0.55],
            "circle-pitch-alignment": "map" } });

        ["pickup-dot", "dropoff-dot"].forEach(layer => {
          map.on("click", layer, e => { const id = e.features?.[0]?.properties?.id; if (id) onSelect(id); });
          map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
          map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
        });
        setMbLoaded(true);
      });
    });
    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; initRef.current = false; setMbLoaded(false); }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mbLoaded || !mapRef.current) return;
    const m = mapRef.current;
    if (!m.isStyleLoaded()) return;
    m.getSource("routes")  ?.setData({ type: "FeatureCollection", features: routeFeatures  });
    m.getSource("pickups") ?.setData({ type: "FeatureCollection", features: pickupFeatures  });
    m.getSource("dropoffs")?.setData({ type: "FeatureCollection", features: dropoffFeatures });
  }, [mbLoaded, routeFeatures, pickupFeatures, dropoffFeatures]);

  useEffect(() => {
    if (mbLoaded && searches.length > 0) setTimeout(fitAll, 200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mbLoaded]);

  useEffect(() => {
    if (!selectedId || !mapRef.current || !mbLoaded) return;
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
  }, [selectedId, searches, mbLoaded]);

  useEffect(() => {
    const t = setTimeout(() => mapRef.current?.resize(), 300);
    return () => clearTimeout(t);
  }, [expanded]);

  const guestCount = searches.filter(isGuest).length;
  const riderCount = searches.length - guestCount;
  const routeCount = searches.filter(hasBothCoords).length;

  return (
    <div className="card" style={{ marginBottom: 14, overflow: "hidden" }}>
      <style>{`
        .mapboxgl-ctrl-bottom-left,.mapboxgl-ctrl-bottom-right{display:none!important}
        .mapboxgl-ctrl-top-right{margin:8px 8px 0 0!important}
        .mapboxgl-ctrl-group{background:rgba(15,23,42,.88)!important;border:1px solid rgba(255,255,255,.1)!important;backdrop-filter:blur(8px)}
        .mapboxgl-ctrl-group button{background:transparent!important}
        .mapboxgl-ctrl-group button:hover{background:rgba(255,255,255,.08)!important}
        .mapboxgl-ctrl-group button .mapboxgl-ctrl-icon{filter:invert(1)!important;opacity:.8}
      `}</style>

      <div style={{ padding: "11px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: "linear-gradient(135deg,#0F2027,#203A43,#2C5364)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Route size={13} color="#0D9488" strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.text, letterSpacing: "-0.1px" }}>Searches</div>
            <div style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 600, marginTop: 1 }}>
              {searches.length} searches · {routeCount} mapped routes
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <MapLegendPill color={RIDER_COLOR} label="Rider" count={riderCount} glow />
          <MapLegendPill color={GUEST_COLOR} label="Guest" count={guestCount} />
          {expandable && (
            <button onClick={() => setExpanded(e => !e)} style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${C.border}`, background: C.surfaceHigh, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
              {expanded ? <Minimize2 size={11} color={C.textMuted} /> : <Maximize2 size={11} color={C.textMuted} />}
            </button>
          )}
        </div>
      </div>

      <div style={{ position: "relative", height: mapHeight, background: "#0d1117", transition: "height .32s cubic-bezier(.32,.72,0,1)" }}>
        <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
        {searches.length === 0 && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(13,17,23,.95)", zIndex: 20 }}>
            <Search size={22} color="rgba(255,255,255,.2)" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,.5)" }}>No search data to map</div>
          </div>
        )}
        {searches.length > 0 && (
          <div style={{ position: "absolute", bottom: 12, left: 12, zIndex: 15, display: "flex", gap: 5 }}>
            <div style={mapChipStyle}><div style={{ width: 7, height: 7, borderRadius: "50%", background: RIDER_COLOR, boxShadow: `0 0 6px ${RIDER_COLOR}` }} /><span>Pickup</span></div>
            <div style={mapChipStyle}><div style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(255,255,255,.5)" }} /><span>Dropoff</span></div>
          </div>
        )}
        {searches.length > 0 && (
          <button onClick={fitAll} style={{ position: "absolute", bottom: 12, right: 12, zIndex: 15, ...mapChipStyle, cursor: "pointer", gap: 5 }}>
            <MapIcon size={9} style={{ flexShrink: 0 }} /> Fit All
          </button>
        )}
      </div>
    </div>
  );
}

const mapChipStyle = {
  display: "flex", alignItems: "center", gap: 5,
  background: "rgba(15,23,42,.88)", backdropFilter: "blur(10px)",
  border: "1px solid rgba(255,255,255,.1)", borderRadius: 99,
  padding: "4px 9px", fontSize: 9.5, fontWeight: 700,
  color: "rgba(255,255,255,.75)", letterSpacing: ".04em",
  textTransform: "uppercase", fontFamily: "'Barlow',sans-serif",
};

function MapLegendPill({ color, label, count, glow }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,.04)", border: `1px solid rgba(255,255,255,.08)`, borderRadius: 99, padding: "3px 9px" }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, boxShadow: glow ? `0 0 7px ${color}` : "none" }} />
      <span style={{ fontSize: 9.5, fontWeight: 700, color: "rgba(255,255,255,.65)", letterSpacing: ".04em" }}>{label}</span>
      <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", background: "rgba(255,255,255,.1)", padding: "1px 6px", borderRadius: 5, fontFamily: "monospace" }}>{count}</span>
    </div>
  );
}

// ─── STATS ROW ──────────────────────────────────────────────────────────────
function StatsRow({ searches, accountMap }) {
  const total        = searches.length;
  const guests       = searches.filter(isGuest).length;
  const riders       = total - guests;
  const uniqueRiders = new Set(searches.filter(s => !isGuest(s)).map(s => s.uid)).size;
  const avgMi        = total
    ? (searches.reduce((a, s) => a + (s.miles || 0), 0) / total).toFixed(1)
    : "—";
  const routed = searches.filter(hasBothCoords).length;

  const stats = [
    { label: "Searches",      value: total,        color: C.text,      icon: <Search size={12} /> },
    { label: "Riders",        value: riders,       color: RIDER_COLOR,  icon: <Users size={12} /> },
    { label: "Guests",        value: guests,       color: GUEST_COLOR,  icon: <UserX size={12} /> },
    { label: "Unique Accts",  value: uniqueRiders, color: "#8B5CF6",    icon: <Shield size={12} /> },
    { label: "Avg Miles",     value: avgMi,        color: C.text,      icon: <Ruler size={12} /> },
    { label: "On Map",        value: routed,       color: C.text,      icon: <Route size={12} /> },
  ];

  return (
    <div className="fade-up" style={{ display: "flex", gap: 8, marginBottom: 14, overflowX: "auto", paddingBottom: 2, animationDelay: "0ms", opacity: 0 }}>
      {stats.map(({ label, value, color, icon }) => (
        <div key={label} style={{ flex: "0 0 auto", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 3, minWidth: 72 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, color: C.textMuted }}>
            {icon}
            <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</span>
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color, fontFamily: "'Barlow Condensed',sans-serif", lineHeight: 1 }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

// ─── SEARCH CARD ─────────────────────────────────────────────────────────────
function SearchCard({ doc, index, selected, hovered, onHover, onLeave, onClick, account }) {
  const guest    = isGuest(doc);
  const acColor  = guest ? GUEST_COLOR : RIDER_COLOR;
  const isActive = selected || hovered;

  const displayName = guest
    ? "Guest"
    : account?.name ?? "Rider";
  const displaySub = guest
    ? "Not signed in"
    : account?.email ?? doc.uid?.slice(0, 14) + "…";

  return (
    <div
      className="card fade-up"
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      style={{
        animationDelay: `${80 + index * 35}ms`, opacity: 0,
        cursor: "pointer", overflow: "hidden",
        border: selected
          ? `1.5px solid ${acColor}60`
          : hovered
          ? `1.5px solid ${acColor}30`
          : `1px solid ${C.border}`,
        boxShadow: selected ? `0 0 0 3px ${acColor}18, 0 4px 20px rgba(0,0,0,.15)` : "none",
        transition: "border-color .15s, box-shadow .15s",
      }}
    >
      <div style={{ height: 2.5, background: isActive ? acColor : C.border, transition: "background .2s" }} />

      <div style={{ padding: "11px 13px", display: "flex", gap: 11, alignItems: "flex-start" }}>

        {/* Avatar */}
        <Avatar account={account} guest={guest} size={34} />

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Name + date row */}
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6, marginBottom: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {displayName}
            </div>
            <span style={{ fontSize: 10, color: C.textDim ?? C.textMuted, fontWeight: 500, flexShrink: 0 }}>
              {fmtDate(doc.createdAt)}
            </span>
          </div>

          {/* Email or UID sub-line */}
          <div style={{ fontSize: 10.5, color: C.textMuted, fontWeight: 500, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {displaySub}
          </div>

          {/* Route line */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, flexShrink: 0 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: acColor, border: "1.5px solid rgba(255,255,255,.2)", boxShadow: isActive ? `0 0 7px ${acColor}` : "none", transition: "box-shadow .2s" }} />
              <div style={{ width: 1.5, height: 16, background: `linear-gradient(to bottom, ${acColor}, ${acColor}22)` }} />
              <div style={{ width: 6, height: 6, borderRadius: 1.5, background: acColor, opacity: 0.6, border: "1.5px solid rgba(255,255,255,.15)", transform: "rotate(45deg)" }} />
            </div>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {stripCity(doc.pickup)}
              </div>
              <div style={{ fontSize: 10.5, fontWeight: 500, color: C.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {stripCity(doc.dropoff)}
              </div>
            </div>
          </div>

          {/* Meta chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {doc.miles != null && <MetaChip icon={<Ruler size={9} />} label={`${doc.miles.toFixed(1)} mi`} />}
            {doc.minutes != null && <MetaChip icon={<Clock size={9} />} label={`${doc.minutes} min`} />}
            <MetaChip
              icon={guest ? <UserX size={9} /> : <User size={9} />}
              label={guest ? "Guest" : "Rider"}
              color={acColor}
              dim={!isActive}
            />
            {account?.welcomeEmailSent && (
              <MetaChip icon={<CheckCircle size={9} />} label="Verified" color="#22C55E" />
            )}
          </div>
        </div>

        <ChevronRight size={13} color={isActive ? acColor : C.textDim ?? C.textMuted} style={{ flexShrink: 0, marginTop: 6, transition: "color .15s" }} />
      </div>
    </div>
  );
}

function MetaChip({ icon, label, color, dim }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      fontSize: 10.5, fontWeight: 700, fontFamily: "'Barlow',sans-serif",
      padding: "2px 7px", borderRadius: 99,
      background: color ? `${color}15` : "rgba(255,255,255,.05)",
      color: color ?? (dim ? C.textDim ?? "#6B7280" : C.textMuted ?? "#9CA3AF"),
      border: color ? `1px solid ${color}30` : "none",
    }}>
      {icon}{label}
    </span>
  );
}

// ─── FARE TIER GRID ─────────────────────────────────────────────────────────
function FareTierGrid({ rides }) {
  if (!rides) return null;
  const tiers     = ["economy", "standard", "premium", "xl"];
  const available = tiers.filter(k => rides[k]);
  if (!available.length) return null;
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Fare Options Shown</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
        {available.map(key => {
          const t    = rides[key];
          const conf = TIER_CONFIG[key] ?? { label: key, gradient: "linear-gradient(135deg,#334155,#1E293B)", color: "#94A3B8" };
          return (
            <div key={key} style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${C.border}` }}>
              <div style={{ height: 3, background: conf.gradient }} />
              <div style={{ padding: "9px 11px", background: C.surfaceHigh ?? C.surface }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: conf.color }}>{conf.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: C.text, fontFamily: "'Barlow Condensed',sans-serif" }}>${t.total}</span>
                </div>
                <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 500 }}>{t.eta}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                  <User size={9} color={C.textMuted} />
                  <span style={{ fontSize: 9.5, color: C.textMuted, fontWeight: 600 }}>Up to {t.capacity}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── ACCOUNT PANEL (inside detail sheet) ────────────────────────────────────
function AccountPanel({ account }) {
  if (!account) return null;
  const joinedAt = account.createdAt
    ? (account.createdAt.toDate ? account.createdAt.toDate() : new Date(account.createdAt))
        .toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—";

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Account</div>
      <div style={{ borderRadius: 14, border: `1px solid ${RIDER_COLOR}30`, overflow: "hidden", background: `${RIDER_COLOR}08` }}>
        {/* Account header */}
        <div style={{ padding: "13px 14px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${C.border}` }}>
          <Avatar account={account} size={42} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.text, letterSpacing: "-0.2px" }}>{account.name}</div>
            <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 500, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {account.email}
            </div>
          </div>
          {account.welcomeEmailSent && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#22C55E18", border: "1px solid #22C55E30", borderRadius: 99, padding: "3px 9px", flexShrink: 0 }}>
              <CheckCircle size={9} color="#22C55E" />
              <span style={{ fontSize: 9.5, fontWeight: 700, color: "#22C55E" }}>Verified</span>
            </div>
          )}
        </div>

        {/* Account details */}
        <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
          <AccountRow icon={<Mail size={12} color={C.textMuted} />} label="Email" value={account.email} />
          <AccountRow icon={<Hash size={12} color={C.textMuted} />} label="UID" value={account.uid} mono />
          <AccountRow icon={<Clock size={12} color={C.textMuted} />} label="Joined" value={joinedAt} />
          {account.adminNotified && (
            <AccountRow icon={<Shield size={12} color="#8B5CF6" />} label="Admin notified" value="Yes" valueColor="#8B5CF6" />
          )}
        </div>
      </div>
    </div>
  );
}

function AccountRow({ icon, label, value, mono, valueColor }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
      <div style={{ marginTop: 1, flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 1 }}>{label}</div>
        <div style={{
          fontSize: 11.5, fontWeight: 600, color: valueColor ?? C.text,
          fontFamily: mono ? "monospace" : "inherit",
          wordBreak: "break-all", opacity: mono ? 0.8 : 1,
        }}>{value || "—"}</div>
      </div>
    </div>
  );
}

// ─── DETAIL BOTTOM SHEET ────────────────────────────────────────────────────
function DetailSheet({ doc, account, onClose }) {
  if (!doc) return null;
  const guest   = isGuest(doc);
  const acColor = guest ? GUEST_COLOR : RIDER_COLOR;
  const mapsUrl = doc.pickupLat && doc.pickupLng
    ? `https://www.google.com/maps/search/?api=1&query=${doc.pickupLat},${doc.pickupLng}`
    : null;

  const infoRows = [
    { label: "Pickup",   value: doc.pickup,   icon: <Navigation size={14} color={RIDER_COLOR} /> },
    { label: "Dropoff",  value: doc.dropoff,  icon: <MapPin size={14} color={GUEST_COLOR} /> },
    { label: "Distance", value: doc.miles ? `${doc.miles.toFixed(2)} mi · ${(doc.miles * 1.609).toFixed(1)} km` : "—", icon: <Ruler size={14} color={C.textMuted} /> },
    { label: "Est. time",value: doc.minutes ? `${doc.minutes} min` : "—", icon: <Clock size={14} color={C.textMuted} /> },
    { label: "Searched", value: fmtTime(doc.createdAt), icon: <Clock size={14} color={C.textMuted} /> },
  ];

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,.45)", backdropFilter: "blur(4px)", animation: "dsIn .2s ease" }} />
      <div style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 401,
        background: C.surface ?? "#0F172A",
        borderRadius: "22px 22px 0 0",
        padding: "0 0 40px",
        maxWidth: 640, margin: "0 auto",
        animation: "sheetUp .28s cubic-bezier(.34,1.1,.64,1)",
        boxShadow: "0 -12px 50px rgba(0,0,0,.35)",
        maxHeight: "88vh", overflowY: "auto",
      }}>
        <style>{`
          @keyframes dsIn    { from { opacity:0 }               to { opacity:1 } }
          @keyframes sheetUp { from { transform:translateY(100%) } to { transform:translateY(0) } }
        `}</style>

        <div style={{ height: 3, background: `linear-gradient(to right, ${acColor}, ${acColor}44)`, borderRadius: "22px 22px 0 0" }} />
        <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 0" }}>
          <div style={{ width: 38, height: 4, borderRadius: 99, background: C.border ?? "#334155" }} />
        </div>

        <div style={{ padding: "14px 20px 0" }}>
          {/* Header row — avatar + name */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar account={account} guest={guest} size={44} />
              <div>
                <div style={{ fontSize: 19, fontWeight: 900, color: C.text ?? "#fff", letterSpacing: "-0.3px", fontFamily: "'Barlow Condensed',sans-serif" }}>
                  {guest ? "Guest Search" : (account?.name ?? "Search Detail")}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: acColor }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: acColor }}>
                    {guest ? "Guest" : "Rider"}
                  </span>
                  {!guest && account?.email && (
                    <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 500 }}>· {account.email}</span>
                  )}
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: "50%", border: `1px solid ${C.border ?? "#334155"}`, background: C.surfaceHigh ?? "#1E293B", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <X size={13} color={C.textMuted} />
            </button>
          </div>

          {/* Route pill */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 14px", background: `${acColor}10`, border: `1px solid ${acColor}25`, borderRadius: 14, marginBottom: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text ?? "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{stripCity(doc.pickup)}</div>
            </div>
            <ArrowRight size={12} color={acColor} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text ?? "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "right" }}>{stripCity(doc.dropoff)}</div>
            </div>
          </div>

          {/* Account panel (riders only) */}
          {!guest && <AccountPanel account={account} />}

          {/* Route info rows */}
          <div style={{ fontSize: 10.5, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Trip Info</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 18 }}>
            {infoRows.map(({ label, value, icon }) => (
              <div key={label} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 11px", borderRadius: 11, background: C.surfaceHigh ?? "#1E293B", border: `1px solid ${C.border ?? "#334155"}` }}>
                <div style={{ marginTop: 1, flexShrink: 0 }}>{icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: C.text ?? "#fff", wordBreak: "break-all" }}>{value || "—"}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Fare tiers */}
          <FareTierGrid rides={doc.rides} />

          {/* Map link */}
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              marginTop: 18, padding: "13px",
              borderRadius: 14, background: `linear-gradient(135deg, ${RIDER_COLOR}, #0891B2)`,
              color: "#fff", fontSize: 13, fontWeight: 800,
              fontFamily: "'Barlow',sans-serif", textDecoration: "none",
              boxShadow: `0 4px 16px ${RIDER_COLOR}40`,
            }}>
              <MapPin size={14} /> View pickup on Google Maps
            </a>
          )}
        </div>
      </div>
    </>
  );
}

// ─── MAIN EXPORT ────────────────────────────────────────────────────────────
export function SearchTab({ onToast }) {
  const { searches, loading }          = useSearches();
  const { accounts, loading: acLoad }  = useAccounts();   // ← pull accounts
  const [query,      setQuery]         = useState("");
  const [filter,     setFilter]        = useState("all");
  const [selectedId, setSelectedId]    = useState(null);
  const [hoveredId,  setHoveredId]     = useState(null);
  const listRef = useRef(null);

  // ── Build uid → account map ────────────────────────────────────────────
  const accountMap = useMemo(() => {
    const m = {};
    (accounts ?? []).forEach(a => { if (a.uid) m[a.uid] = a; });
    return m;
  }, [accounts]);

  // ── Filter + search ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...searches].sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() ?? 0;
      const tb = b.createdAt?.toMillis?.() ?? 0;
      return tb - ta;
    });
    if (filter === "riders") list = list.filter(s => !isGuest(s));
    if (filter === "guests") list = list.filter(isGuest);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(s => {
        const acc = accountMap[s.uid];
        return (
          (s.pickup  || "").toLowerCase().includes(q) ||
          (s.dropoff || "").toLowerCase().includes(q) ||
          (s.uid     || "").toLowerCase().includes(q) ||
          (acc?.name  || "").toLowerCase().includes(q) ||
          (acc?.email || "").toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [searches, query, filter, accountMap]);

  const selectedDoc = useMemo(() =>
    selectedId ? searches.find(s => s.id === selectedId) ?? null : null
  , [selectedId, searches]);

  const handleSelect    = useCallback((id) => setSelectedId(id), []);
  const handleCardClick = useCallback((doc) => setSelectedId(doc.id), []);

  const filterBtns = [
    { key: "all",    label: "All",    count: searches.length },
    { key: "riders", label: "Riders", count: searches.filter(s => !isGuest(s)).length },
    { key: "guests", label: "Guests", count: searches.filter(isGuest).length },
  ];

  return (
    <div style={{ padding: "0 16px 80px" }}>

      {/* Stats */}
      {!loading && searches.length > 0 && (
        <StatsRow searches={searches} accountMap={accountMap} />
      )}

      {/* Map */}
      {!loading && (
        <div className="fade-up" style={{ animationDelay: "30ms", opacity: 0 }}>
          <SearchMapView
            searches={filtered.length > 0 ? filtered : searches}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onSelect={handleSelect}
            height={320}
          />
        </div>
      )}

      {/* Controls */}
      <div className="fade-up" style={{ animationDelay: "50ms", opacity: 0 }}>
        <div style={{ position: "relative", marginBottom: 10 }}>
          <Search size={14} color={C.textDim ?? C.textMuted} style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search name, email, address, UID…"
            style={{
              width: "100%", padding: "10px 36px", borderRadius: 11,
              border: `1.5px solid ${query ? (C.green ?? RIDER_COLOR) : C.border}`,
              background: C.surface, color: C.text,
              fontFamily: "'Barlow',sans-serif", fontSize: 13, fontWeight: 500,
              outline: "none", boxSizing: "border-box", transition: "border-color .15s",
            }}
          />
          {query && (
            <button onClick={() => setQuery("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", display: "flex", padding: 3 }}>
              <X size={13} color={C.textMuted} />
            </button>
          )}
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 14, alignItems: "center" }}>
          {filterBtns.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                padding: "6px 14px", borderRadius: 99, fontFamily: "'Barlow',sans-serif", fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all .15s",
                border: filter === key ? `1.5px solid ${C.green ?? RIDER_COLOR}` : `1.5px solid ${C.border}`,
                background: filter === key ? (C.greenGlow ?? `${RIDER_COLOR}15`) : C.surface,
                color: filter === key ? (C.green ?? RIDER_COLOR) : C.textMuted,
              }}
            >
              {label}
              <span style={{ marginLeft: 5, background: C.border, borderRadius: 99, padding: "1px 6px", fontSize: 10 }}>{count}</span>
            </button>
          ))}
          <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: C.textMuted }}>
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* List */}
      {loading || acLoad ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: C.textMuted, fontSize: 13, fontFamily: "'Barlow',sans-serif" }}>
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 20px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14 }}>
          <Search size={24} color={C.border} style={{ display: "block", margin: "0 auto 10px" }} />
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>No searches found</div>
          <div style={{ fontSize: 11.5, color: C.textMuted, marginTop: 4 }}>Try adjusting your filters</div>
        </div>
      ) : (
        <div ref={listRef} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((doc, i) => (
            <SearchCard
              key={doc.id}
              doc={doc}
              index={i}
              account={accountMap[doc.uid] ?? null}
              selected={selectedId === doc.id}
              hovered={hoveredId === doc.id}
              onHover={() => setHoveredId(doc.id)}
              onLeave={() => setHoveredId(null)}
              onClick={() => handleCardClick(doc)}
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




Accounts
6hYd7foSEzZXjOtIg744htbKTYf2
(default)

Accounts

Admin

Drivers

Rides

Search
Accounts

6hYd7foSEzZXjOtIg744htbKTYf2

73qSiCsc6VgkLseMM7PZVOxLpuq2

7T5ejUmqxOgYeC94WEXlkRtlEHq2

CPbpg2dJAnOaFHhEd5fO3ky9VZz1

dQil2045FRUneyF59SPwDKQJsqA2

uGD9cgVAySduQZlhiYdLzqJb7QX2
6hYd7foSEzZXjOtIg744htbKTYf2
adminNotified
true
(boolean)


createdAt
May 6, 2026 at 3:27:03 PM UTC-4
(timestamp)


email
"infiniteseeing@gmail.com"
(string)


name
"Ricardo Garcia"
(string)


uid
"6hYd7foSEzZXjOtIg744htbKTYf2"
(string)


updatedAt
May 6, 2026 at 3:27:03 PM UTC-4
(timestamp)


welcomeEmailSent
true