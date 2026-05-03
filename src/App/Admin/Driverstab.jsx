import { useState, useEffect, useRef, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  Search, X, MapPin, Navigation, Car,
  Wifi, WifiOff, ChevronRight, Loader2,
} from "lucide-react";
import { C, STATUS_CONFIG } from "@/App/Admin/Tokens";
import { Avatar, StatusPill } from "@/App/Admin/UI";

// ─── ⚠️ Replace with your Mapbox public token ──────────────────────────────
const MAPBOX_TOKEN =
  "pk.eyJ1IjoiWU9VUl9VU0VSTkFNRSIsImEiOiJZT1VSX0tFWSJ9.REPLACE_ME";

mapboxgl.accessToken = MAPBOX_TOKEN;

// ─── Geocoding (city / zip → lat,lng) ──────────────────────────────────────
async function geocode(query) {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    query
  )}.json?country=us&types=place,postcode&limit=1&access_token=${MAPBOX_TOKEN}`;
  const res  = await fetch(url);
  const data = await res.json();
  const feat = data.features?.[0];
  if (!feat) return null;
  const [lng, lat] = feat.center;
  return { lat, lng, place: feat.place_name };
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function fullName(d) {
  return `${d.firstName?.trim() ?? ""} ${d.lastName?.trim() ?? ""}`.trim() || "Unknown";
}

function formatMinutesAgo(min) {
  if (min == null) return "—";
  if (min < 1)    return "just now";
  if (min < 60)   return `${min}m ago`;
  if (min < 1440) return `${Math.floor(min / 60)}h ago`;
  return `${Math.floor(min / 1440)}d ago`;
}

// ─── Marker SVG ─────────────────────────────────────────────────────────────
function markerSvg(color, ring) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="34" height="42" viewBox="0 0 34 42">
      <filter id="shadow" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.35)"/>
      </filter>
      <circle cx="17" cy="16" r="14" fill="${ring}" opacity="0.25"/>
      <circle cx="17" cy="16" r="10" fill="${color}" filter="url(#shadow)"/>
      <circle cx="17" cy="16" r="5"  fill="white" opacity="0.9"/>
      <polygon points="11,24 23,24 17,38" fill="${color}" filter="url(#shadow)"/>
    </svg>`;
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function DriversMapTab({ fleet = [], onSelectDriver }) {
  const mapContainer = useRef(null);
  const map          = useRef(null);
  const markers      = useRef({});          // uid → mapboxgl.Marker
  const popupRef     = useRef(null);

  const [mapReady,    setMapReady]    = useState(false);
  const [search,      setSearch]      = useState("");
  const [searching,   setSearching]   = useState(false);
  const [searchError, setSearchError] = useState("");
  const [geocodeHint, setGeocodeHint] = useState("");
  const [hovered,     setHovered]     = useState(null); // driver uid
  const [filter,      setFilter]      = useState("all"); // all | online | offline

  // Drivers with location, filtered by status
  const mappable = fleet.filter(
    d =>
      d.lat != null &&
      d.lng != null &&
      (d.status === "online" || d.status === "offline")
  );

  const visible = filter === "all"
    ? mappable
    : mappable.filter(d => d.status === filter);

  const onlineCt  = mappable.filter(d => d.status === "online").length;
  const offlineCt = mappable.filter(d => d.status === "offline").length;

  // ── Init map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style:     "mapbox://styles/mapbox/dark-v11",
      center:    [-81.3792, 28.5383], // Orlando
      zoom:      11,
      attributionControl: false,
    });

    map.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
    map.current.on("load", () => setMapReady(true));

    return () => {
      Object.values(markers.current).forEach(m => m.remove());
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // ── Sync markers ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady) return;

    const visibleIds = new Set(visible.map(d => d.uid ?? d.id));

    // Remove stale markers
    Object.keys(markers.current).forEach(uid => {
      if (!visibleIds.has(uid)) {
        markers.current[uid].remove();
        delete markers.current[uid];
      }
    });

    // Add / update markers
    visible.forEach((driver, i) => {
      const uid    = driver.uid ?? driver.id;
      const color  = driver.status === "online" ? "#22C55E" : "#94A3B8";
      const ring   = driver.status === "online" ? "#22C55E" : "#94A3B8";
      const isHov  = hovered === uid;

      const el = document.createElement("div");
      el.innerHTML = markerSvg(color, ring);
      el.style.cursor  = "pointer";
      el.style.width   = "34px";
      el.style.transform = isHov ? "scale(1.25)" : "scale(1)";
      el.style.transition = "transform .15s";
      el.style.zIndex  = isHov ? "999" : String(i);

      el.addEventListener("mouseenter", () => setHovered(uid));
      el.addEventListener("mouseleave", () => setHovered(null));
      el.addEventListener("click", () => {
        popupRef.current?.remove();

        const name = fullName(driver);
        const popup = new mapboxgl.Popup({ offset: 28, closeButton: false, maxWidth: "220px" })
          .setLngLat([driver.lng, driver.lat])
          .setHTML(`
            <div style="font-family:'Barlow',sans-serif;padding:4px 2px">
              <div style="font-weight:800;font-size:14px;margin-bottom:2px">${name}</div>
              <div style="font-size:11px;color:#94A3B8;margin-bottom:6px">${driver.email ?? ""}</div>
              <div style="display:flex;gap:8px;align-items:center">
                <span style="
                  font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;
                  background:${driver.status === "online" ? "#22C55E20" : "#94A3B820"};
                  color:${driver.status === "online" ? "#22C55E" : "#94A3B8"};
                  border:1px solid ${driver.status === "online" ? "#22C55E40" : "#94A3B840"};
                  text-transform:uppercase
                ">${driver.status}</span>
                <span style="font-size:10px;color:#64748B">${formatMinutesAgo(driver.minutesSinceLastSeen)}</span>
              </div>
              ${driver.vehicle?.make ? `
                <div style="margin-top:8px;font-size:11px;color:#CBD5E1">
                  🚗 ${driver.vehicle.year ?? ""} ${driver.vehicle.make} ${driver.vehicle.model ?? ""}
                </div>` : ""}
            </div>
          `)
          .addTo(map.current);

        popupRef.current = popup;
      });

      if (markers.current[uid]) {
        // Update position and element
        markers.current[uid].remove();
      }

      markers.current[uid] = new mapboxgl.Marker({ element: el })
        .setLngLat([driver.lng, driver.lat])
        .addTo(map.current);
    });
  }, [mapReady, visible, hovered]);

  // ── Geocode search ────────────────────────────────────────────────────────
  const handleSearch = useCallback(async () => {
    if (!search.trim()) return;
    setSearching(true);
    setSearchError("");
    setGeocodeHint("");
    try {
      const result = await geocode(search.trim());
      if (!result) {
        setSearchError("Location not found. Try a city name or ZIP code.");
        return;
      }
      setGeocodeHint(result.place);
      map.current?.flyTo({ center: [result.lng, result.lat], zoom: 12, speed: 1.4, curve: 1.2 });
    } catch {
      setSearchError("Search failed. Check your Mapbox token.");
    } finally {
      setSearching(false);
    }
  }, [search]);

  const clearSearch = () => {
    setSearch("");
    setGeocodeHint("");
    setSearchError("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 160px)", minHeight: 520, padding: "0 16px 16px" }}>

      {/* ── Search bar ── */}
      <div style={{ marginBottom: 10 }}>
        <div style={{
          display: "flex", gap: 8, alignItems: "center",
          background: C.surface, border: `1.5px solid ${C.border}`,
          borderRadius: 12, padding: "9px 14px",
          boxShadow: "0 2px 8px rgba(0,0,0,.08)",
        }}>
          <Search size={14} color={C.textDim} style={{ flexShrink: 0 }} />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setSearchError(""); setGeocodeHint(""); }}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder="Search by city or ZIP code…"
            style={{
              flex: 1, border: "none", outline: "none", background: "transparent",
              fontSize: 13, color: C.text, fontFamily: "'Barlow',sans-serif",
            }}
          />
          {search && (
            <button onClick={clearSearch} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
              <X size={13} color={C.textMuted} />
            </button>
          )}
          <button
            onClick={handleSearch}
            disabled={searching || !search.trim()}
            style={{
              background: C.green, border: "none", borderRadius: 8,
              padding: "5px 12px", cursor: searching || !search.trim() ? "not-allowed" : "pointer",
              opacity: !search.trim() ? .5 : 1, display: "flex", alignItems: "center", gap: 5,
              color: "#fff", fontSize: 12, fontWeight: 700, fontFamily: "'Barlow',sans-serif",
              transition: "opacity .15s",
            }}
          >
            {searching
              ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
              : <Navigation size={12} />}
            Go
          </button>
        </div>

        {/* Geocode result hint */}
        {geocodeHint && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, paddingLeft: 4 }}>
            <MapPin size={11} color={C.green} />
            <span style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>{geocodeHint}</span>
          </div>
        )}
        {searchError && (
          <div style={{ fontSize: 11, color: "#EF4444", marginTop: 5, paddingLeft: 4 }}>{searchError}</div>
        )}
      </div>

      {/* ── Filter pills + legend ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        {[
          { key: "all",     label: "All",     count: mappable.length, color: C.green  },
          { key: "online",  label: "Online",  count: onlineCt,        color: "#22C55E" },
          { key: "offline", label: "Offline", count: offlineCt,       color: "#94A3B8" },
        ].map(({ key, label, count, color }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{
              padding: "5px 13px", borderRadius: 100,
              border: `1.5px solid ${filter === key ? color : C.border}`,
              background: filter === key ? `${color}18` : C.surface,
              color: filter === key ? color : C.textMuted,
              fontFamily: "'Barlow',sans-serif", fontSize: 12, fontWeight: 700,
              cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
              transition: "all .15s",
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
            {label}
            <span style={{
              background: filter === key ? `${color}30` : C.border,
              color: filter === key ? color : C.textMuted,
              borderRadius: 100, padding: "0px 6px", fontSize: 10,
            }}>{count}</span>
          </button>
        ))}

        <span style={{ marginLeft: "auto", fontSize: 11, color: C.textMuted }}>
          {visible.length} driver{visible.length !== 1 ? "s" : ""} shown
        </span>
      </div>

      {/* ── Map ── */}
      <div style={{ flex: 1, borderRadius: 18, overflow: "hidden", border: `1px solid ${C.border}`, position: "relative", minHeight: 360 }}>
        <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />

        {/* Loading overlay */}
        {!mapReady && (
          <div style={{
            position: "absolute", inset: 0, background: C.surface,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12,
          }}>
            <Loader2 size={28} color={C.green} style={{ animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: 13, color: C.textMuted }}>Loading map…</span>
          </div>
        )}

        {/* No drivers notice */}
        {mapReady && visible.length === 0 && (
          <div style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
            background: "rgba(15,23,42,.88)", borderRadius: 14, padding: "16px 22px",
            display: "flex", alignItems: "center", gap: 10, backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,.08)",
          }}>
            <Car size={18} color={C.textMuted} />
            <span style={{ fontSize: 13, color: C.textMuted }}>No drivers with location data</span>
          </div>
        )}

        {/* Live indicator */}
        {mapReady && onlineCt > 0 && (
          <div style={{
            position: "absolute", top: 12, left: 12,
            background: "rgba(15,23,42,.82)", backdropFilter: "blur(6px)",
            border: "1px solid rgba(34,197,94,.3)", borderRadius: 10,
            padding: "6px 11px", display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22C55E", boxShadow: "0 0 0 3px rgba(34,197,94,.25)", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#22C55E" }}>{onlineCt} ONLINE</span>
          </div>
        )}
      </div>

      {/* ── Driver list (below map) ── */}
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: ".06em", paddingLeft: 2 }}>
          DRIVER LOCATIONS
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflowY: "auto" }}>
          {visible.length === 0 && (
            <div style={{ fontSize: 13, color: C.textMuted, padding: "12px 0", textAlign: "center" }}>No drivers to display</div>
          )}
          {visible.map((driver, i) => {
            const uid      = driver.uid ?? driver.id;
            const isHov    = hovered === uid;
            const color    = driver.status === "online" ? "#22C55E" : "#94A3B8";
            return (
              <div
                key={uid}
                onMouseEnter={() => {
                  setHovered(uid);
                  map.current?.easeTo({ center: [driver.lng, driver.lat], duration: 400 });
                }}
                onMouseLeave={() => setHovered(null)}
                onClick={() => {
                  map.current?.flyTo({ center: [driver.lng, driver.lat], zoom: 14, speed: 1.2 });
                  setHovered(uid);
                }}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 12px", borderRadius: 12, cursor: "pointer",
                  background: isHov ? C.surfaceHigh : C.surface,
                  border: `1.5px solid ${isHov ? color + "50" : C.border}`,
                  transition: "all .15s",
                }}
              >
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <Avatar name={fullName(driver)} size={34} colorIdx={i} />
                  <div style={{ position: "absolute", bottom: -1, right: -1, width: 9, height: 9, borderRadius: "50%", background: color, border: `2px solid ${C.surface}` }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 1 }}>{fullName(driver)}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
                    <MapPin size={9} color={C.textDim} />
                    {driver.lat?.toFixed(4)}, {driver.lng?.toFixed(4)}
                    <span style={{ color: C.border }}>·</span>
                    {formatMinutesAgo(driver.minutesSinceLastSeen)}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
                    background: `${color}18`, color, border: `1px solid ${color}35`,
                    textTransform: "uppercase",
                  }}>{driver.status}</span>
                  <ChevronRight size={13} color={C.textDim} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes spin  { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }
        @keyframes pulse {
          0%,100% { box-shadow: 0 0 0 3px rgba(34,197,94,.25) }
          50%      { box-shadow: 0 0 0 6px rgba(34,197,94,.0)  }
        }
        .mapboxgl-popup-content {
          background: #1E293B !important;
          border: 1px solid rgba(255,255,255,.1) !important;
          border-radius: 14px !important;
          padding: 14px 16px !important;
          box-shadow: 0 8px 32px rgba(0,0,0,.4) !important;
          color: #F1F5F9 !important;
          font-family: 'Barlow', sans-serif !important;
        }
        .mapboxgl-popup-tip { border-top-color: #1E293B !important; }
      `}</style>
    </div>
  );
}
