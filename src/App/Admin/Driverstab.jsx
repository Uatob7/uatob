// ─────────────────────────────────────────────────────────────────────────────
// PATCH FILE — replace the existing DriversTab export and add DriverMapView
// below the existing helpers at the top of your DriversTab file.
// ─────────────────────────────────────────────────────────────────────────────

// 1) ADD this import at the top of the file (with your other imports):
//    import { MapPin as MapPinIcon, Navigation } from "lucide-react";
//    (MapPin is already imported as MapPin — alias it, or just use the existing one)

// ─────────────────────────────────────────────────────────────────────────────
// MAPBOX LOADER  (copy/paste once near the top of the file, outside components)
// ─────────────────────────────────────────────────────────────────────────────
const MAPBOX_TOKEN =
  "pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA";

let _dmLoaded = false;
let _dmCbs    = [];
function loadMapboxDM(cb) {
  if (_dmLoaded && window.mapboxgl) { cb(); return; }
  _dmCbs.push(cb);
  if (document.getElementById("dm-mapbox-css")) return;
  const link  = document.createElement("link");
  link.id     = "dm-mapbox-css";
  link.rel    = "stylesheet";
  link.href   = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css";
  document.head.appendChild(link);
  const script    = document.createElement("script");
  script.src      = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js";
  script.onload   = () => { _dmLoaded = true; _dmCbs.forEach(f => f()); _dmCbs = []; };
  document.head.appendChild(script);
}

// Status → pin color
const PIN_COLOR = {
  online:      "#22C55E",
  offline:     "#94A3B8",
  pending:     "#F59E0B",
  in_progress: "#3B82F6",
  suspended:   "#EF4444",
};

// ─────────────────────────────────────────────────────────────────────────────
// DriverMapView
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useRef, useMemo } from "react";

function DriverMapView({ drivers = [], onSelectDriver }) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const markersRef   = useRef([]);
  const initRef      = useRef(false);

  // Only drivers that have a valid lat/lng
  const mappable = useMemo(
    () => drivers.filter(d => d.lat && d.lng),
    [drivers]
  );

  // Init map once
  useEffect(() => {
    if (!containerRef.current || initRef.current) return;

    loadMapboxDM(() => {
      if (!containerRef.current || initRef.current) return;
      initRef.current = true;

      window.mapboxgl.accessToken = MAPBOX_TOKEN;
      mapRef.current = new window.mapboxgl.Map({
        container:          containerRef.current,
        style:              "mapbox://styles/mapbox/dark-v11",
        center:             [-81.3792, 28.5383], // Orlando
        zoom:               11,
        attributionControl: false,
        interactive:        true,
      });
      mapRef.current.addControl(
        new window.mapboxgl.AttributionControl({ compact: true }),
        "bottom-right"
      );
      mapRef.current.addControl(
        new window.mapboxgl.NavigationControl({ showCompass: false }),
        "top-right"
      );
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current  = null;
        initRef.current = false;
      }
    };
  }, []);

  // Re-render markers whenever the driver list changes
  useEffect(() => {
    if (!mapRef.current) return;

    const render = () => {
      // Clear old markers
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      if (!mappable.length) return;

      mappable.forEach(driver => {
        const color  = PIN_COLOR[driver.status] || "#94A3B8";
        const name   = fullName(driver);

        // Custom HTML element for the marker
        const el            = document.createElement("div");
        el.style.cssText    = `
          position: relative;
          width: 32px; height: 32px;
          cursor: pointer;
        `;
        el.innerHTML = `
          <svg width="32" height="38" viewBox="0 0 32 38" fill="none" xmlns="http://www.w3.org/2000/svg">
            <filter id="dm-shadow-${driver.id}">
              <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="${color}" flood-opacity="0.45"/>
            </filter>
            <path d="M16 2C9.373 2 4 7.373 4 14c0 8.5 12 22 12 22S28 22.5 28 14C28 7.373 22.627 2 16 2Z"
                  fill="${color}" filter="url(#dm-shadow-${driver.id})"/>
            <circle cx="16" cy="14" r="6" fill="white" opacity="0.9"/>
          </svg>
          <div style="
            position: absolute;
            top: -26px; left: 50%;
            transform: translateX(-50%);
            background: rgba(15,23,42,0.92);
            color: #fff;
            font-size: 10px;
            font-weight: 700;
            font-family: 'Barlow Condensed', sans-serif;
            white-space: nowrap;
            padding: 3px 7px;
            border-radius: 6px;
            border: 1px solid ${color}55;
            pointer-events: none;
            opacity: 0;
            transition: opacity .15s;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
          " class="dm-label">${name}</div>
        `;

        // Show label on hover
        el.addEventListener("mouseenter", () => {
          el.querySelector(".dm-label").style.opacity = "1";
        });
        el.addEventListener("mouseleave", () => {
          el.querySelector(".dm-label").style.opacity = "0";
        });

        el.addEventListener("click", e => {
          e.stopPropagation();
          onSelectDriver?.(driver);
        });

        const marker = new window.mapboxgl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([driver.lng, driver.lat])
          .addTo(mapRef.current);

        markersRef.current.push(marker);
      });

      // Fit bounds to all visible drivers
      if (mappable.length === 1) {
        mapRef.current.flyTo({ center: [mappable[0].lng, mappable[0].lat], zoom: 13, duration: 800 });
      } else if (mappable.length > 1) {
        const bounds = new window.mapboxgl.LngLatBounds();
        mappable.forEach(d => bounds.extend([d.lng, d.lat]));
        mapRef.current.fitBounds(bounds, { padding: 52, maxZoom: 14, duration: 800 });
      }
    };

    if (mapRef.current.loaded()) render();
    else mapRef.current.once("load", render);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mappable]);

  return (
    <div style={{
      borderRadius: 16,
      overflow: "hidden",
      border: "1px solid rgba(255,255,255,0.07)",
      boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
      position: "relative",
    }}>
      <div ref={containerRef} style={{ width: "100%", height: 260 }} />

      {/* Legend */}
      <div style={{
        position: "absolute", bottom: 10, left: 10, zIndex: 10,
        display: "flex", gap: 6, flexWrap: "wrap",
        background: "rgba(15,23,42,0.88)",
        backdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 10, padding: "6px 10px",
      }}>
        {Object.entries(PIN_COLOR).map(([status, color]) => {
          const count = drivers.filter(d => d.status === status && d.lat && d.lng).length;
          if (count === 0) return null;
          return (
            <div key={status} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: color, boxShadow: `0 0 4px ${color}` }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.7)", textTransform: "capitalize" }}>
                {status === "in_progress" ? "On trip" : status} <span style={{ color: "rgba(255,255,255,.4)" }}>({count})</span>
              </span>
            </div>
          );
        })}
      </div>

      {/* No-location notice */}
      {drivers.length > 0 && mappable.length === 0 && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 5,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 8, background: "rgba(15,23,42,0.7)", pointerEvents: "none",
        }}>
          <MapPin size={20} color="#94A3B8" />
          <span style={{ fontSize: 12, color: "#94A3B8", fontWeight: 600 }}>No location data for these drivers</span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATED DriversTab  — replace your existing export with this
// ─────────────────────────────────────────────────────────────────────────────
export function DriversTab({ fleet = [], onToast }) {
  const [search,   setSearch]   = useState("");
  const [cityZip,  setCityZip]  = useState("");       // ← new
  const [filter,   setFilter]   = useState("all");
  const [selected, setSelected] = useState(null);

  const filters      = ["all", "online", "offline", "pending", "in_progress"];
  const showMap      = ["all", "online", "offline", "pending"].includes(filter);

  // Drivers shown on the map respect the status filter but NOT the name/cityzip search
  // so the map always gives a full spatial picture of the selected tier.
  const mapDrivers = useMemo(() => {
    if (!showMap) return [];
    return fleet.filter(d => filter === "all" || d.status === filter);
  }, [fleet, filter, showMap]);

  // List applies all three filters
  const filtered = fleet.filter(d => {
    const name       = fullName(d).toLowerCase();
    const matchName  = name.includes(search.toLowerCase()) ||
                       d.email?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || d.status === filter;
    const matchCityZip = (() => {
      if (!cityZip.trim()) return true;
      const q     = cityZip.toLowerCase().trim();
      const city  = (d.contact?.city  ?? "").toLowerCase();
      const zip   = (d.contact?.zip   ?? "").toLowerCase();
      const state = (d.contact?.state ?? "").toLowerCase();
      return city.includes(q) || zip.includes(q) || state.includes(q);
    })();
    return matchName && matchFilter && matchCityZip;
  });

  if (selected) {
    return (
      <DriverDetail
        driverId={selected.id}
        driverIdx={fleet.indexOf(selected)}
        onBack={() => setSelected(null)}
        onToast={onToast}
      />
    );
  }

  return (
    <div style={{ padding: "0 16px 16px" }}>

      {/* ── Name search ── */}
      <div className="search-bar fade-up" style={{ marginBottom: 10, animationDelay: "40ms", opacity: 0 }}>
        <Search size={15} color={C.textDim} />
        <input
          placeholder="Search by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* ── City / Zip search ── */}
      <div
        className="fade-up"
        style={{
          display: "flex", alignItems: "center", gap: 8,
          background: C.surface, border: `1.5px solid ${cityZip ? C.green : C.border}`,
          borderRadius: 10, padding: "9px 12px",
          marginBottom: 12, animationDelay: "70ms", opacity: 0,
          transition: "border-color .2s",
        }}
      >
        <MapPin size={14} color={cityZip ? C.green : C.textDim} style={{ flexShrink: 0 }} />
        <input
          placeholder="Filter by city, state, or zip…"
          value={cityZip}
          onChange={e => setCityZip(e.target.value)}
          style={{
            flex: 1, border: "none", outline: "none",
            background: "transparent", color: C.text,
            fontSize: 13, fontFamily: "'Barlow', sans-serif",
          }}
        />
        {cityZip && (
          <button
            onClick={() => setCityZip("")}
            style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: 0 }}
          >
            <X size={13} color={C.textMuted} />
          </button>
        )}
      </div>

      {/* ── Filter pills ── */}
      <div className="fade-up" style={{ display: "flex", gap: 8, marginBottom: 14, animationDelay: "100ms", opacity: 0, overflowX: "auto", paddingBottom: 2 }}>
        {filters.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "6px 14px", borderRadius: 100,
              border: `1.5px solid ${filter === f ? C.green : C.border}`,
              background: filter === f ? C.greenGlow : C.surface,
              color: filter === f ? C.green : C.textMuted,
              fontFamily: "'Barlow',sans-serif", fontSize: 12, fontWeight: 700,
              cursor: "pointer", whiteSpace: "nowrap", transition: "all .15s",
            }}
          >
            {f === "in_progress" ? "In Progress" : f.charAt(0).toUpperCase() + f.slice(1)}
            <span style={{ marginLeft: 5, background: C.border, borderRadius: 100, padding: "1px 6px", fontSize: 10 }}>
              {f === "all" ? fleet.length : fleet.filter(d => d.status === f).length}
            </span>
          </button>
        ))}
      </div>

      {/* ── Driver map ── */}
      {showMap && (
        <div
          className="fade-up"
          style={{ marginBottom: 16, animationDelay: "130ms", opacity: 0 }}
        >
          {/* Header row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.textMuted, letterSpacing: ".06em" }}>
              DRIVER MAP
            </span>
            <span style={{ fontSize: 11, color: C.textMuted }}>
              {mapDrivers.filter(d => d.lat && d.lng).length} / {mapDrivers.length} pinned
            </span>
          </div>

          <DriverMapView
            drivers={mapDrivers}
            onSelectDriver={driver => setSelected(driver)}
          />
        </div>
      )}

      {/* ── Driver list ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "32px 0", color: C.textMuted, fontSize: 13 }}>
            No drivers found
          </div>
        )}
        {filtered.map((driver, i) => {
          const { done, total } = docsComplete(driver.documents);
          const allDocs = done === total;
          return (
            <div
              key={driver.id}
              className="card fade-up"
              style={{ animationDelay: `${160 + i * 40}ms`, opacity: 0, cursor: "pointer", overflow: "hidden" }}
              onClick={() => setSelected(driver)}
            >
              <div style={{ height: 3, background: STATUS_CONFIG[driver.status]?.color || C.border }} />
              <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ position: "relative" }}>
                  <Avatar name={fullName(driver)} size={42} colorIdx={i} />
                  <div style={{ position: "absolute", bottom: 0, right: 0, width: 11, height: 11, borderRadius: "50%", background: STATUS_CONFIG[driver.status]?.color || C.textDim, border: `2px solid ${C.surface}` }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{fullName(driver)}</div>
                  <div style={{ fontSize: 11, color: C.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {driver.email}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 5, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: allDocs ? C.green : "#D97706", background: allDocs ? C.greenGlow : "#FFFBEB", border: `1px solid ${allDocs ? C.green + "40" : "#D9770640"}`, borderRadius: 6, padding: "2px 7px" }}>
                      {done}/{total} docs
                    </span>
                    {/* City/zip tag */}
                    {driver.contact?.city && (
                      <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: C.textMuted, fontWeight: 600 }}>
                        <MapPin size={9} color={C.textDim} />
                        {driver.contact.city}{driver.contact.zip ? `, ${driver.contact.zip}` : ""}
                      </span>
                    )}
                    {driver.averageRating && (
                      <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: "#F59E0B", fontWeight: 700 }}>
                        <Star size={9} fill="#F59E0B" /> {Number(driver.averageRating).toFixed(1)}
                      </span>
                    )}
                    {driver.totalRides != null && (
                      <span style={{ fontSize: 10, color: C.textMuted }}>{driver.totalRides} rides</span>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
                  <StatusPill status={driver.status} />
                  <span style={{ fontSize: 10, color: C.textMuted }}>
                    {(driver.status === "online" || driver.status === "offline") && driver.minutesSinceLastSeen != null
                      ? formatMinutesAgo(driver.minutesSinceLastSeen)
                      : timeAgo(driver.createdAt)}
                  </span>
                </div>
                <ChevronRight size={14} color={C.textDim} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
