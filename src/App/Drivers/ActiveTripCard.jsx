
import { useEffect, useRef, useState } from "react";
import {
  MapPin, ChevronRight, Loader2, MessageCircle,
  Send, Check, X, AlertTriangle, UserX,
  Navigation, Phone, Map,
} from "lucide-react";
import {
  getFirestore, collection, onSnapshot, addDoc, serverTimestamp,
  query, orderBy, updateDoc, doc,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { firebase_app } from "@/firebase/config";

const functions        = getFunctions(firebase_app, "us-east1");
const callReassignRide = httpsCallable(functions, "reassignRide");

// ─── Stage config ─────────────────────────────────────────────────────────────
const STAGES = {
  driver_assigned: { label: "En Route to Pickup", color: "#38BDF8", dot: true  },
  arrived:         { label: "Awaiting Rider",      color: "#A78BFA", dot: false },
  in_progress:     { label: "Trip in Progress",    color: "#34D399", dot: true  },
};

// ── Mapbox token ───────────────────────────────────────────────────────────────
const MAPBOX_TOKEN = "pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA";

// ── Shared idempotent Mapbox loader ───────────────────────────────────────────
function loadMapboxGL(cb) {
  if (window.mapboxgl) { cb(); return; }
  window.__mbq = window.__mbq ?? [];
  window.__mbq.push(cb);
  if (document.getElementById("mapbox-gl-js")) return;
  const link = Object.assign(document.createElement("link"), {
    rel: "stylesheet",
    href: "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css",
  });
  document.head.appendChild(link);
  const script = Object.assign(document.createElement("script"), {
    id:  "mapbox-gl-js",
    src: "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js",
    onload: () => { window.__mbq.forEach(fn => fn()); window.__mbq = []; },
  });
  document.head.appendChild(script);
}

// ── Polyline decoder (Google encoded format) ──────────────────────────────────
function decodePolyline(encoded) {
  if (!encoded) return [];
  const pts = [];
  let i = 0, lat = 0, lng = 0;
  while (i < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    pts.push([lng / 1e5, lat / 1e5]);
  }
  return pts;
}

// ── Find closest segment on geo polyline ─────────────────────────────────────
function closestSegmentOnPolyline(pts, lng, lat) {
  if (pts.length < 2) return { idx: 0, t: 0 };
  let best = { idx: 0, t: 0 }, bestDist = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dLng = b[0] - a[0];
    const dLat = b[1] - a[1];
    const lenSq = dLng * dLng + dLat * dLat;
    if (lenSq === 0) continue;
    let t = ((lng - a[0]) * dLng + (lat - a[1]) * dLat) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const px = a[0] + t * dLng;
    const py = a[1] + t * dLat;
    const d = Math.hypot(px - lng, py - lat);
    if (d < bestDist) { bestDist = d; best = { idx: i, t }; }
  }
  return best;
}

function trimPolylineFromCar(pts, driverLng, driverLat) {
  if (pts.length < 2 || !driverLng || !driverLat) return pts;
  const { idx, t } = closestSegmentOnPolyline(pts, driverLng, driverLat);
  const a = pts[idx];
  const b = pts[idx + 1];
  const interp = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
  return [interp, ...pts.slice(idx + 1)];
}

function geoDistMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── DriverMapBox CSS ──────────────────────────────────────────────────────────
const DMB_CSS = `
  @keyframes dmb-ring {
    0%   { transform: scale(1);   opacity: .55; }
    100% { transform: scale(2.6); opacity: 0;   }
  }
  @keyframes dmb-pickup-ring {
    0%   { transform: scale(1);   opacity: .5; }
    100% { transform: scale(2.4); opacity: 0;  }
  }
  @keyframes dmb-fadein { from { opacity: 0 } to { opacity: 1 } }

  /* ── Car marker ── */
  .dmb-car-wrap {
    position: relative;
    filter: drop-shadow(0 3px 8px rgba(0,0,0,.7));
  }

  /* ── Pickup pulse ring ── */
  .dmb-pickup-ring {
    position: absolute;
    inset: -10px;
    border-radius: 50%;
    background: rgba(34,197,94,.22);
    animation: dmb-pickup-ring 2s ease-out infinite;
    pointer-events: none;
  }
  .dmb-pickup-ring-2 {
    position: absolute;
    inset: -18px;
    border-radius: 50%;
    background: rgba(34,197,94,.10);
    animation: dmb-pickup-ring 2s ease-out .5s infinite;
    pointer-events: none;
  }

  .dmb-map .mapboxgl-ctrl-logo          { display: none !important; }
  .dmb-map .mapboxgl-ctrl-attrib-button { display: none !important; }
  .dmb-map .mapboxgl-ctrl-attrib {
    font-size: 8px !important; opacity: .18 !important;
    background: transparent !important; padding: 0 4px !important;
  }
  .dmb-map .mapboxgl-ctrl-attrib a { color: rgba(255,255,255,.3) !important; }
  .dmb-map .mapboxgl-ctrl-bottom-right { bottom: 6px !important; right: 6px !important; }
`;

let _dmbCssInjected = false;
function injectDmbCss() {
  if (_dmbCssInjected) return;
  _dmbCssInjected = true;
  const tag = document.createElement("style");
  tag.textContent = DMB_CSS;
  document.head.appendChild(tag);
}

// ── Marker DOM factories ──────────────────────────────────────────────────────

/**
 * Custom SVG top-down car icon.
 * accent — the stage color used to tint the car roof panel.
 */
function makeDriverEl(accent = "#38BDF8") {
  const wrap = document.createElement("div");
  wrap.className = "dmb-car-wrap";
  wrap.style.cssText = "width:36px;height:52px;position:relative;";
  wrap.innerHTML = `
    <svg width="36" height="52" viewBox="0 0 36 52" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Shadow ellipse -->
      <ellipse cx="18" cy="50" rx="9" ry="2" fill="rgba(0,0,0,0.45)"/>

      <!-- Car body — rounded rect with nose tapers -->
      <path d="
        M18 1
        Q28 1 30 4
        L32 46
        Q28 50 18 50
        Q8 50 4 46
        L6 4
        Q8 1 18 1
        Z
      " fill="#1E293B" stroke="rgba(255,255,255,.12)" stroke-width=".6"/>

      <!-- Front windshield — trapezoid, light blue -->
      <path d="M10 6 L26 6 L28 19 L8 19 Z" fill="#7DD3FC" opacity=".9"/>

      <!-- Middle panel — roof, accent tinted -->
      <rect x="9" y="21" width="18" height="13" rx="2" fill="${accent}" opacity=".65"/>

      <!-- Rear window — lighter blue -->
      <rect x="10" y="36" width="16" height="8" rx="1.5" fill="#7DD3FC" opacity=".5"/>

      <!-- Left side mirror -->
      <rect x="1" y="13" width="5" height="3" rx="1" fill="#0F172A" opacity=".85"/>

      <!-- Right side mirror -->
      <rect x="30" y="13" width="5" height="3" rx="1" fill="#0F172A" opacity=".85"/>

      <!-- Headlights -->
      <circle cx="9"  cy="5.5" r="1.5" fill="#FCD34D"/>
      <circle cx="27" cy="5.5" r="1.5" fill="#FCD34D"/>

      <!-- Taillights -->
      <rect x="8"  y="46" width="6"  height="2.5" rx="1" fill="#EF4444" opacity=".9"/>
      <rect x="22" y="46" width="6"  height="2.5" rx="1" fill="#EF4444" opacity=".9"/>
    </svg>
  `;
  return wrap;
}

/**
 * Pickup pin:
 * outer white circle r=13, green stroke 2.5
 * inner green circle r=6.5
 * white dot center r=2.5
 * shadow ellipse below
 * pulse rings when headingToPickup=true
 */
function makePickupEl(withPulse = false) {
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:relative;width:30px;height:36px;";

  if (withPulse) {
    const r1 = document.createElement("div");
    r1.className = "dmb-pickup-ring";
    r1.style.cssText = "top:2px;left:2px;width:26px;height:26px;";
    const r2 = document.createElement("div");
    r2.className = "dmb-pickup-ring-2";
    r2.style.cssText = "top:2px;left:2px;width:26px;height:26px;";
    wrap.appendChild(r2);
    wrap.appendChild(r1);
  }

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "30");
  svg.setAttribute("height", "36");
  svg.setAttribute("viewBox", "0 0 30 36");
  svg.setAttribute("fill", "none");
  svg.style.cssText = "position:absolute;top:0;left:0;filter:drop-shadow(0 3px 7px rgba(0,0,0,.5));";
  svg.innerHTML = `
    <!-- Shadow ellipse -->
    <ellipse cx="15" cy="34" rx="7" ry="2" fill="rgba(0,0,0,0.3)"/>
    <!-- Outer white circle, green stroke -->
    <circle cx="15" cy="15" r="13" fill="white" stroke="#22C55E" stroke-width="2.5"/>
    <!-- Inner green circle -->
    <circle cx="15" cy="15" r="6.5" fill="#22C55E"/>
    <!-- White dot center -->
    <circle cx="15" cy="15" r="2.5" fill="white"/>
  `;
  wrap.appendChild(svg);
  return wrap;
}

/**
 * Dropoff pin:
 * teardrop cubic bezier, shadow ellipse, white circle r=6, dark dot r=2.5
 * pin tip points down, body ~28px tall
 */
function makeDropoffEl() {
  const el = document.createElement("div");
  el.style.cssText = "filter:drop-shadow(0 4px 8px rgba(0,0,0,.65));line-height:0;";
  el.innerHTML = `
    <svg width="26" height="36" viewBox="0 0 26 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Shadow ellipse -->
      <ellipse cx="13" cy="34.5" rx="6" ry="1.5" fill="rgba(0,0,0,0.28)"/>
      <!-- Teardrop body (cubic bezier, tip at y=33) -->
      <path d="
        M13 33
        C9 27 2 22 2 13
        A11 11 0 0 1 24 13
        C24 22 17 27 13 33
        Z
      " fill="#F1F5F9" stroke="rgba(0,0,0,.10)" stroke-width=".5"/>
      <!-- White circle inside pin -->
      <circle cx="13" cy="13" r="6" fill="white"/>
      <!-- Dark dot inside white circle -->
      <circle cx="13" cy="13" r="2.5" fill="#0F172A"/>
    </svg>
  `;
  return el;
}

// ── Mapbox source/layer helpers ───────────────────────────────────────────────
const ROUTE_SOURCE    = "dmb-route";
const ROUTE_LAYER_BG  = "dmb-route-bg";
const ROUTE_LAYER_FG  = "dmb-route-fg";
const ROUTE_LAYER_DASH = "dmb-route-dash";

function addRouteLayer(map, coords, accent) {
  const geojson = { type: "Feature", geometry: { type: "LineString", coordinates: coords } };
  if (map.getSource(ROUTE_SOURCE)) { map.getSource(ROUTE_SOURCE).setData(geojson); return; }
  map.addSource(ROUTE_SOURCE, { type: "geojson", data: geojson });
  map.addLayer({ id: ROUTE_LAYER_BG, type: "line", source: ROUTE_SOURCE,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#ffffff", "line-width": 8, "line-opacity": 0.3 },
  });
  map.addLayer({ id: ROUTE_LAYER_FG, type: "line", source: ROUTE_SOURCE,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": accent, "line-width": 4, "line-opacity": 0.95 },
  });
  map.addLayer({ id: ROUTE_LAYER_DASH, type: "line", source: ROUTE_SOURCE,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#ffffff", "line-width": 1.5, "line-opacity": 0.45, "line-dasharray": [0, 4] },
  });
}

function updateRouteData(map, coords) {
  if (!map.getSource(ROUTE_SOURCE)) return;
  map.getSource(ROUTE_SOURCE).setData({ type: "Feature", geometry: { type: "LineString", coordinates: coords } });
}

function updateRouteColor(map, accent) {
  if (!map.getLayer(ROUTE_LAYER_FG)) return;
  map.setPaintProperty(ROUTE_LAYER_FG, "line-color", accent);
}

// ── DriverMapBox ──────────────────────────────────────────────────────────────
function DriverMapBox({ activeTrip, tripStage, accent }) {
  const containerRef   = useRef(null);
  const mapRef         = useRef(null);
  const markersRef     = useRef({});
  const initializedRef = useRef(false);
  const mapLoadedRef   = useRef(false);
  const latestRef      = useRef({});

  const driverLat   = activeTrip?.driverLat;
  const driverLng   = activeTrip?.driverLng;
  const pickupLat   = activeTrip?.pickupLat;
  const pickupLng   = activeTrip?.pickupLng;
  const dropoffLat  = activeTrip?.dropoffLat;
  const dropoffLng  = activeTrip?.dropoffLng;
  const polylineRaw = activeTrip?.polyline ?? null;

  const isInProgress     = tripStage === "in_progress";
  const isArrived        = tripStage === "arrived";
  const headingToPickup  = tripStage === "driver_assigned";

  latestRef.current = {
    driverLat, driverLng, pickupLat, pickupLng, dropoffLat, dropoffLng,
    polylineRaw, isInProgress, headingToPickup, accent,
  };

  function buildRouteCoords() {
    const { polylineRaw, driverLng, driverLat, isInProgress } = latestRef.current;
    const full = decodePolyline(polylineRaw);
    if (!full.length) return [];
    if (!isInProgress) return full;
    return trimPolylineFromCar(full, driverLng, driverLat);
  }

  function fitVisible(map, dur = 900) {
    const { driverLat, driverLng, pickupLat, pickupLng, dropoffLat, dropoffLng, isInProgress } = latestRef.current;
    const pts = [];
    if (driverLat && driverLng) pts.push([driverLng, driverLat]);
    if (!isInProgress && pickupLat && pickupLng) pts.push([pickupLng, pickupLat]);
    if (dropoffLat && dropoffLng) pts.push([dropoffLng, dropoffLat]);
    if (!pts.length) return;
    if (pts.length === 1) { map.easeTo({ center: pts[0], zoom: 15, duration: dur }); return; }
    const bounds = pts.reduce(
      (b, p) => b.extend(p),
      new window.mapboxgl.LngLatBounds(pts[0], pts[0]),
    );
    map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: dur });
  }

  // ── Map init (once) ──────────────────────────────────────────────────────
  useEffect(() => {
    injectDmbCss();
    if (!containerRef.current || initializedRef.current) return;

    loadMapboxGL(() => {
      if (!containerRef.current || initializedRef.current) return;
      initializedRef.current = true;

      const { driverLat, driverLng, pickupLat, pickupLng } = latestRef.current;
      const initCenter = driverLat && driverLng
        ? [driverLng, driverLat]
        : pickupLat && pickupLng
        ? [pickupLng, pickupLat]
        : [-81.3792, 28.5383];

      window.mapboxgl.accessToken = MAPBOX_TOKEN;
      const map = new window.mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: initCenter,
        zoom: 14,
        attributionControl: false,
        interactive: false,
        pitchWithRotate: false,
        fadeDuration: 150,
      });
      map.addControl(new window.mapboxgl.AttributionControl({ compact: true }), "bottom-right");
      mapRef.current = map;

      map.on("load", () => {
        mapLoadedRef.current = true;
        const { driverLat, driverLng, pickupLat, pickupLng, dropoffLat, dropoffLng, accent, headingToPickup } = latestRef.current;

        const routeCoords = buildRouteCoords();
        if (routeCoords.length >= 2) addRouteLayer(map, routeCoords, accent);

        // Driver car marker
        if (driverLat && driverLng) {
          markersRef.current.driver = new window.mapboxgl.Marker({
            element: makeDriverEl(accent), anchor: "center",
          }).setLngLat([driverLng, driverLat]).addTo(map);
        }

        // Pickup pin with pulse when heading to pickup
        if (pickupLat && pickupLng) {
          markersRef.current.pickup = new window.mapboxgl.Marker({
            element: makePickupEl(headingToPickup), anchor: "center",
          }).setLngLat([pickupLng, pickupLat]).addTo(map);
        }

        // Dropoff teardrop
        if (dropoffLat && dropoffLng) {
          markersRef.current.dropoff = new window.mapboxgl.Marker({
            element: makeDropoffEl(), anchor: "bottom",
          }).setLngLat([dropoffLng, dropoffLat]).addTo(map);
        }

        fitVisible(map, 0);
      });
    });

    return () => {
      Object.values(markersRef.current).forEach(m => m?.remove());
      markersRef.current = {};
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      initializedRef.current = false;
      mapLoadedRef.current   = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Driver location updates ──────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoadedRef.current || !mapRef.current || !driverLat || !driverLng) return;
    const map = mapRef.current;
    const { headingToPickup, accent } = latestRef.current;

    const snapToPickup  = pickupLat  && pickupLng  && geoDistMeters(driverLat, driverLng, pickupLat, pickupLng) <= 30;
    const snapToDropoff = dropoffLat && dropoffLng && geoDistMeters(driverLat, driverLng, dropoffLat, dropoffLng) <= 30;
    const displayLng = snapToPickup ? pickupLng : snapToDropoff ? dropoffLng : driverLng;
    const displayLat = snapToPickup ? pickupLat : snapToDropoff ? dropoffLat : driverLat;

    if (markersRef.current.driver) {
      markersRef.current.driver.setLngLat([displayLng, displayLat]);
    } else {
      markersRef.current.driver = new window.mapboxgl.Marker({
        element: makeDriverEl(accent), anchor: "center",
      }).setLngLat([displayLng, displayLat]).addTo(map);
    }

    const routeCoords = buildRouteCoords();
    if (routeCoords.length >= 2) {
      map.getSource(ROUTE_SOURCE) ? updateRouteData(map, routeCoords) : addRouteLayer(map, routeCoords, accent);
    }
    fitVisible(map, 1200);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverLat, driverLng]);

  // ── Polyline change ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoadedRef.current || !mapRef.current) return;
    const map = mapRef.current;
    const routeCoords = buildRouteCoords();
    if (routeCoords.length >= 2) {
      map.getSource(ROUTE_SOURCE) ? updateRouteData(map, routeCoords) : addRouteLayer(map, routeCoords, latestRef.current.accent);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polylineRaw]);

  // ── Accent color ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoadedRef.current || !mapRef.current) return;
    updateRouteColor(mapRef.current, accent);
    // Rebuild driver marker with new accent color
    if (markersRef.current.driver && mapRef.current) {
      const lngLat = markersRef.current.driver.getLngLat();
      markersRef.current.driver.remove();
      markersRef.current.driver = new window.mapboxgl.Marker({
        element: makeDriverEl(accent), anchor: "center",
      }).setLngLat(lngLat).addTo(mapRef.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accent]);

  // ── Stage change: dim pickup, update pulse, re-trim, re-fit ─────────────
  useEffect(() => {
    if (!mapLoadedRef.current || !mapRef.current) return;
    const map = mapRef.current;
    const { pickupLat, pickupLng, headingToPickup } = latestRef.current;

    // Rebuild pickup marker to toggle pulse rings
    if (markersRef.current.pickup && pickupLat && pickupLng) {
      markersRef.current.pickup.remove();
      const newEl = makePickupEl(headingToPickup);
      newEl.style.opacity = isInProgress ? "0.25" : "1";
      markersRef.current.pickup = new window.mapboxgl.Marker({
        element: newEl, anchor: "center",
      }).setLngLat([pickupLng, pickupLat]).addTo(map);
    }

    const routeCoords = buildRouteCoords();
    if (routeCoords.length >= 2) {
      map.getSource(ROUTE_SOURCE) ? updateRouteData(map, routeCoords) : addRouteLayer(map, routeCoords, latestRef.current.accent);
    }
    fitVisible(map, 800);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripStage]);

  const etaMin = isInProgress ? activeTrip?.dropoffEtaMin : activeTrip?.driverEtaMin;
  const etaLabel = isArrived ? "Arrived" : etaMin != null ? `~${etaMin} min` : null;

  return (
    <div style={{ position: "relative", height: 200, background: "#0B0D12" }}>
      <div ref={containerRef} className="dmb-map"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />

      {/* Bottom fade */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 56,
        background: "linear-gradient(to bottom, transparent, #0C0E14)",
        pointerEvents: "none", zIndex: 2,
      }} />

      {/* Top accent bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: `linear-gradient(90deg, transparent 0%, ${accent} 35%, ${accent}88 65%, transparent 100%)`,
        zIndex: 3, opacity: .9,
      }} />

      {/* LIVE pill */}
      <div style={{
        position: "absolute", top: 12, left: 12, zIndex: 4,
        display: "flex", alignItems: "center", gap: 6,
        background: "rgba(11,13,18,.78)", backdropFilter: "blur(10px)",
        border: "1px solid rgba(255,255,255,.09)",
        borderRadius: 100, padding: "5px 12px",
        fontFamily: "'Outfit', sans-serif",
        fontSize: 10.5, fontWeight: 800, letterSpacing: ".1em",
        color: "rgba(255,255,255,.7)", pointerEvents: "none",
      }}>
        <span style={{
          width: 7, height: 7, borderRadius: "50%",
          background: "#22C55E", flexShrink: 0, boxShadow: "0 0 7px #22C55E",
          display: "inline-block",
        }} />
        LIVE
      </div>

      {/* ETA pill */}
      {etaLabel && (
        <div style={{
          position: "absolute", top: 12, right: 12, zIndex: 4,
          background: "rgba(11,13,18,.78)", backdropFilter: "blur(10px)",
          border: `1px solid ${accent}35`,
          borderRadius: 100, padding: "5px 12px",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11, fontWeight: 500, letterSpacing: "-.01em",
          color: accent, pointerEvents: "none",
        }}>
          {etaLabel}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ActiveTripCard({
  activeTrip, tripStage, tripStageColor, tripBtnLabel,
  onAdvance, advancePending, onUnreadChange,
}) {
  const [showMessages, setShowMessages] = useState(false);
  const [unreadCount,  setUnreadCount]  = useState(0);
  const [showReassign, setShowReassign] = useState(false);
  const [reassigning,  setReassigning]  = useState(false);
  const [reassignError, setReassignError] = useState("");

  // Stable callback — won't collapse showMessages on re-renders
  const handleUnreadChange = useCallback((count) => {
    setUnreadCount(count);
    onUnreadChange?.(count);
  }, [onUnreadChange]);

  // Toggle message panel without collapsing it when unread count changes
  const handleToggleMessages = useCallback(() => {
    setShowMessages(prev => !prev);
  }, []);

  if (!activeTrip) return null;

  const rideId      = activeTrip.id ?? activeTrip.rideId;
  const stageData   = STAGES[tripStage] ?? STAGES.driver_assigned;
  const accent      = tripStageColor ?? stageData.color;
  const isProgress  = tripStage === "in_progress";
  const canReassign = tripStage === "driver_assigned";

  const openInMaps = (addr) => addr &&
    window.open(`https://maps.google.com/?q=${encodeURIComponent(addr)}`, "_blank");

  // Navigate to current destination (pickup if enroute, dropoff if in_progress)
  const openNavigation = () => {
    const dest = isProgress ? activeTrip.dropoff : activeTrip.pickup;
    const lat  = isProgress ? activeTrip.dropoffLat : activeTrip.pickupLat;
    const lng  = isProgress ? activeTrip.dropoffLng : activeTrip.pickupLng;
    if (lat && lng) {
      window.open(`https://maps.google.com/?daddr=${lat},${lng}&dirflg=d`, "_blank");
    } else if (dest) {
      window.open(`https://maps.google.com/?daddr=${encodeURIComponent(dest)}&dirflg=d`, "_blank");
    }
  };

  // Phone call — rider phone not in ride doc but attempt from contact field
  const callRider = () => {
    const phone = activeTrip.riderPhone ?? activeTrip.phone;
    if (phone) window.open(`tel:${phone}`);
  };

  const handleReassign = async () => {
    if (reassigning) return;
    setReassigning(true); setReassignError("");
    try {
      const auth = getAuth();
      const { data } = await callReassignRide({ rideId, driverUid: auth.currentUser?.uid });
      if (data?.error) throw new Error(data.error);
      setShowReassign(false);
    } catch (err) {
      setReassignError(err.message || "Failed to reassign ride");
    } finally { setReassigning(false); }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=IBM+Plex+Mono:wght@400;500&family=Outfit:wght@400;500;600&display=swap');

        :root { --atc-accent: ${accent}; }

        @keyframes atc-pulse  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(.5)} }
        @keyframes atc-in     { from{opacity:0;transform:translateY(10px) scale(.98)} to{opacity:1;transform:none} }
        @keyframes atc-spin   { to{transform:rotate(360deg)} }
        @keyframes atc-modal  { from{opacity:0;transform:scale(.9) translateY(16px)} to{opacity:1;transform:none} }
        @keyframes atc-msg-in { from{opacity:0;max-height:0} to{opacity:1;max-height:520px} }
        @keyframes atc-badge-pop {
          0%   { transform: scale(0);   opacity:0; }
          60%  { transform: scale(1.3); opacity:1; }
          100% { transform: scale(1);   opacity:1; }
        }

        .atc-shell * { box-sizing: border-box; }

        .atc-shell {
          font-family: 'Outfit', sans-serif;
          border-radius: 22px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,.07);
          box-shadow: 0 2px 4px rgba(0,0,0,.4), 0 20px 60px rgba(0,0,0,.6);
          animation: atc-in .38s cubic-bezier(.22,1,.36,1) both;
        }

        .atc-wrap { background: #0C0E14; position: relative; }

        .atc-glow-bar {
          height: 3px;
          background: linear-gradient(90deg, transparent 0%, ${accent} 40%, ${accent}aa 70%, transparent 100%);
          opacity: .6; transition: background .4s;
        }

        .atc-stage-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 13px 18px 10px;
          border-bottom: 1px solid rgba(255,255,255,.05);
        }
        .atc-stage-left { display: flex; align-items: center; gap: 9px; }
        .atc-stage-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: ${accent}; box-shadow: 0 0 8px ${accent};
          flex-shrink: 0;
          animation: ${stageData.dot ? "atc-pulse 1.6s ease-in-out infinite" : "none"};
        }
        .atc-stage-label {
          font-family: 'Syne', sans-serif;
          font-size: 11.5px; font-weight: 700;
          letter-spacing: .12em; text-transform: uppercase;
          color: ${accent};
        }
        .atc-fare-chip {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 13px; font-weight: 500;
          color: #fff; letter-spacing: -.01em;
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 8px; padding: 4px 10px;
        }

        .atc-route { padding: 18px 18px 14px; display: flex; flex-direction: column; gap: 0; }
        .atc-route-line { display: flex; align-items: stretch; gap: 14px; }
        .atc-rail {
          display: flex; flex-direction: column; align-items: center;
          flex-shrink: 0; padding: 4px 0;
        }
        .atc-node {
          width: 11px; height: 11px; border-radius: 50%;
          border: 2px solid; background: #0C0E14;
          flex-shrink: 0; z-index: 1;
          transition: border-color .3s, box-shadow .3s;
        }
        .atc-node.pickup  { border-color: #38BDF8; box-shadow: 0 0 8px #38BDF840; }
        .atc-node.dropoff { border-color: #34D399; box-shadow: 0 0 8px #34D39940; }
        .atc-connector {
          width: 1.5px; flex: 1; min-height: 28px;
          background: linear-gradient(to bottom, #38BDF830, #34D39930);
          margin: 4px 0; border-radius: 2px;
        }
        .atc-stop-content { flex: 1; padding-bottom: 18px; }
        .atc-stop-content:last-child { padding-bottom: 0; }
        .atc-stop-tag {
          font-size: 9.5px; font-weight: 700; letter-spacing: .1em;
          text-transform: uppercase; color: rgba(255,255,255,.3); margin-bottom: 3px;
        }
        .atc-stop-row { display: flex; align-items: center; gap: 8px; }
        .atc-stop-addr {
          font-size: 13.5px; font-weight: 500; color: rgba(255,255,255,.88);
          line-height: 1.35; flex: 1;
          opacity: ${isProgress ? ".38" : "1"};
          transition: opacity .3s;
        }
        .atc-stop-addr.dropoff-addr { opacity: ${!isProgress ? ".38" : "1"}; }
        .atc-map-pill {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 4px 9px; border-radius: 99px;
          font-size: 10px; font-weight: 700;
          cursor: pointer; border: none;
          transition: all .15s; flex-shrink: 0;
          font-family: 'Outfit', sans-serif;
        }
        .atc-map-pill.blue {
          background: rgba(56,189,248,.12); color: #38BDF8;
          border: 1px solid rgba(56,189,248,.25);
        }
        .atc-map-pill.green {
          background: rgba(52,211,153,.12); color: #34D399;
          border: 1px solid rgba(52,211,153,.25);
        }
        .atc-map-pill:hover  { filter: brightness(1.2); transform: scale(1.04); }
        .atc-map-pill:active { transform: scale(.97); }

        .atc-stats-bar {
          display: grid; grid-template-columns: repeat(3,1fr);
          margin: 0 14px;
          background: rgba(255,255,255,.03);
          border: 1px solid rgba(255,255,255,.06);
          border-radius: 14px; overflow: hidden;
        }
        .atc-stat-cell { padding: 12px 14px; display: flex; flex-direction: column; gap: 3px; }
        .atc-stat-cell + .atc-stat-cell { border-left: 1px solid rgba(255,255,255,.06); }
        .atc-stat-val {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 15px; font-weight: 500;
          color: #fff; letter-spacing: -.02em;
        }
        .atc-stat-key {
          font-size: 9.5px; font-weight: 600; letter-spacing: .09em;
          text-transform: uppercase; color: rgba(255,255,255,.3);
        }

        /* ── 3 Action buttons ── */
        .atc-actions {
          display: flex; gap: 8px;
          margin: 14px 14px 0;
        }
        .atc-action-btn {
          flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 5px; padding: 10px 6px;
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.08);
          border-radius: 14px; cursor: pointer;
          transition: all .15s;
          font-family: 'Outfit', sans-serif;
          font-size: 10px; font-weight: 600;
          color: rgba(255,255,255,.45);
          letter-spacing: .03em;
        }
        .atc-action-btn:hover {
          background: rgba(255,255,255,.08);
          border-color: ${accent}40;
          color: ${accent};
        }
        .atc-action-btn:hover svg { color: ${accent}; }
        .atc-action-btn:active { transform: scale(.96); }
        .atc-action-btn svg { color: rgba(255,255,255,.4); transition: color .15s; }

        .atc-divider { height: 1px; background: rgba(255,255,255,.05); margin: 14px 0; }

        .atc-msg-toggle-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 16px 12px;
        }
        .atc-msg-toggle {
          display: flex; align-items: center; gap: 8px;
          background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.09);
          border-radius: 99px; padding: 7px 14px;
          font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 600;
          color: rgba(255,255,255,.55); cursor: pointer;
          transition: all .18s; position: relative;
        }
        .atc-msg-toggle.has-msg { border-color: ${accent}50; color: ${accent}; background: ${accent}12; }
        .atc-msg-toggle:hover   { border-color: rgba(255,255,255,.2); color: rgba(255,255,255,.8); }
        .atc-msg-toggle.has-msg:hover { border-color: ${accent}80; }

        /* Badge pop animation */
        .atc-badge {
          position: absolute; top: -5px; right: -5px;
          background: #EF4444; color: #fff;
          font-size: 9px; font-weight: 800; min-width: 16px; height: 16px;
          border-radius: 99px; padding: 0 4px;
          display: flex; align-items: center; justify-content: center;
          border: 2px solid #0C0E14;
          animation: atc-badge-pop .3s cubic-bezier(.34,1.56,.64,1) both;
        }

        .atc-msg-close {
          background: none; border: none; cursor: pointer;
          color: rgba(255,255,255,.25); padding: 4px;
          transition: color .15s; display: flex;
          font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 600;
          align-items: center; gap: 4px;
        }
        .atc-msg-close:hover { color: rgba(255,255,255,.5); }

        .atc-msg-panel {
          margin: 0 14px 12px;
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 16px; overflow: hidden;
          animation: atc-msg-in .22s ease-out both;
        }
        .atc-msg-header {
          padding: 10px 14px;
          border-bottom: 1px solid rgba(255,255,255,.06);
          background: rgba(255,255,255,.03);
          font-size: 11px; font-weight: 700; letter-spacing: .06em;
          text-transform: uppercase; color: rgba(255,255,255,.35);
        }
        .atc-msg-list {
          min-height: 100px; max-height: 200px; overflow-y: auto;
          padding: 10px 12px; display: flex; flex-direction: column; gap: 7px;
          background: #0C0E14;
          overscroll-behavior: contain;
          scroll-behavior: smooth;
          touch-action: pan-y;
        }
        /* Prevent scroll bleed into card on iOS */
        .atc-msg-list::-webkit-scrollbar { width: 2px; }
        .atc-msg-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 2px; }

        .atc-msg-empty {
          text-align: center; color: rgba(255,255,255,.2);
          font-size: 12px; margin-top: 16px;
        }
        .atc-quick-row {
          display: flex; gap: 5px; padding: 8px 12px;
          flex-wrap: wrap; background: rgba(255,255,255,.02);
          border-top: 1px solid rgba(255,255,255,.04);
        }
        .atc-quick {
          background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.09);
          border-radius: 99px; padding: 4px 10px;
          font-size: 10.5px; font-weight: 600; color: rgba(255,255,255,.45);
          cursor: pointer; font-family: 'Outfit', sans-serif; transition: all .13s;
          white-space: nowrap;
        }
        .atc-quick:hover { background: rgba(255,255,255,.1); color: rgba(255,255,255,.8); }
        .atc-input-row {
          display: flex; gap: 8px; padding: 8px 10px 10px;
          border-top: 1px solid rgba(255,255,255,.05); align-items: flex-end;
          background: #0C0E14;
        }
        .atc-textarea {
          flex: 1; resize: none; background: rgba(255,255,255,.05);
          border: 1px solid rgba(255,255,255,.09); border-radius: 10px;
          padding: 9px 12px; font-size: 13px; color: rgba(255,255,255,.85);
          font-family: 'Outfit', sans-serif; outline: none; line-height: 1.4;
          max-height: 70px; overflow-y: auto;
          transition: border-color .18s;
        }
        .atc-textarea:focus { border-color: ${accent}70; }
        .atc-textarea::placeholder { color: rgba(255,255,255,.2); }
        .atc-send {
          width: 38px; height: 38px; border-radius: 10px; border: none;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; flex-shrink: 0; transition: all .15s;
        }

        .atc-cta-area { padding: 0 14px 14px; display: flex; flex-direction: column; gap: 8px; }
        .atc-cta-btn {
          display: flex; align-items: center; justify-content: space-between;
          width: 100%; padding: 15px 20px;
          border: none; border-radius: 14px;
          font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700;
          color: #fff; cursor: pointer; letter-spacing: .04em;
          position: relative; overflow: hidden;
          transition: filter .13s, transform .1s, box-shadow .2s;
        }
        .atc-cta-btn::before {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(135deg, ${accent}, ${accent}bb);
          transition: opacity .2s;
        }
        .atc-cta-btn:hover  { filter: brightness(1.1); transform: translateY(-1px); box-shadow: 0 8px 24px ${accent}50; }
        .atc-cta-btn:active { filter: brightness(.92); transform: translateY(0); }
        .atc-cta-btn[disabled] { opacity: .5; cursor: not-allowed; transform: none !important; box-shadow: none !important; }
        .atc-cta-inner {
          position: relative; z-index: 1;
          display: flex; align-items: center; justify-content: space-between; width: 100%;
        }
        .atc-cta-arrow {
          width: 28px; height: 28px; border-radius: 50%;
          background: rgba(255,255,255,.18);
          display: flex; align-items: center; justify-content: center;
        }
        .atc-reassign-btn {
          display: flex; align-items: center; justify-content: center; gap: 7px;
          width: 100%; padding: 10px 14px;
          background: transparent; border: 1px solid rgba(239,68,68,.25);
          border-radius: 12px; cursor: pointer;
          color: rgba(239,68,68,.6); font-family: 'Outfit', sans-serif;
          font-size: 12px; font-weight: 600;
          transition: all .15s;
        }
        .atc-reassign-btn:hover { background: rgba(239,68,68,.07); border-color: rgba(239,68,68,.5); color: #EF4444; }

        .atc-overlay {
          position: fixed; inset: 0; z-index: 1200;
          background: rgba(0,0,0,.7); backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center; padding: 20px;
          animation: atc-in .15s ease-out both;
        }
        .atc-modal {
          background: #131620; border-radius: 22px; max-width: 320px; width: 100%;
          padding: 26px 24px 20px;
          border: 1px solid rgba(239,68,68,.2);
          box-shadow: 0 30px 80px rgba(0,0,0,.6), 0 0 0 1px rgba(239,68,68,.08);
          animation: atc-modal .25s cubic-bezier(.34,1.56,.64,1) both;
          font-family: 'Outfit', sans-serif;
        }
        .atc-modal-icon {
          width: 52px; height: 52px; border-radius: 50%; margin: 0 auto 14px;
          background: rgba(239,68,68,.1); border: 1.5px solid rgba(239,68,68,.3);
          display: flex; align-items: center; justify-content: center;
        }
        .atc-modal-title { font-family: 'Syne', sans-serif; font-size: 17px; font-weight: 800; color: #fff; text-align: center; margin-bottom: 7px; }
        .atc-modal-body  { font-size: 13px; color: rgba(255,255,255,.45); text-align: center; line-height: 1.6; margin-bottom: 20px; }
        .atc-modal-err   {
          background: rgba(239,68,68,.1); border: 1px solid rgba(239,68,68,.2);
          border-radius: 9px; padding: 8px 12px;
          font-size: 11.5px; color: #FCA5A5; font-weight: 600; margin-bottom: 12px; text-align: center;
        }
        .atc-modal-btns { display: flex; gap: 8px; }
        .atc-modal-btn  {
          flex: 1; padding: 12px; border-radius: 12px;
          font-size: 13px; font-weight: 700; font-family: 'Outfit', sans-serif;
          cursor: pointer; transition: all .12s;
          display: flex; align-items: center; justify-content: center; gap: 6px;
        }
        .atc-modal-btn.cancel { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); color: rgba(255,255,255,.5); }
        .atc-modal-btn.cancel:hover { background: rgba(255,255,255,.1); color: rgba(255,255,255,.8); }
        .atc-modal-btn.danger { background: linear-gradient(135deg,#EF4444,#DC2626); border: none; color: #fff; box-shadow: 0 4px 16px rgba(220,38,38,.35); }
        .atc-modal-btn.danger:hover { filter: brightness(1.1); }
        .atc-modal-btn:disabled { opacity: .6; cursor: not-allowed; }
      `}</style>

      {/* Reassign modal */}
      {showReassign && (
        <div
          className="atc-overlay"
          onClick={(e) => { if (e.target === e.currentTarget && !reassigning) setShowReassign(false); }}
        >
          <div className="atc-modal">
            <div className="atc-modal-icon"><AlertTriangle size={24} color="#EF4444" /></div>
            <div className="atc-modal-title">Reassign this ride?</div>
            <div className="atc-modal-body">
              The rider will be matched with another driver. Frequent reassignments can affect your acceptance rate.
            </div>
            {reassignError && <div className="atc-modal-err">⚠ {reassignError}</div>}
            <div className="atc-modal-btns">
              <button className="atc-modal-btn cancel" onClick={() => setShowReassign(false)} disabled={reassigning}>
                Keep ride
              </button>
              <button className="atc-modal-btn danger" onClick={handleReassign} disabled={reassigning}>
                {reassigning
                  ? <><Loader2 size={13} style={{ animation: "atc-spin 1s linear infinite" }} /> Reassigning…</>
                  : <><UserX size={13} /> Reassign</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="atc-shell">
        <DriverMapBox activeTrip={activeTrip} tripStage={tripStage} accent={accent} />

        <div className="atc-wrap">
          <div className="atc-glow-bar" />

          {/* Stage + payout */}
          <div className="atc-stage-row">
            <div className="atc-stage-left">
              <div className="atc-stage-dot" />
              <span className="atc-stage-label">{stageData.label}</span>
            </div>
            <div className="atc-fare-chip">${activeTrip.driverPayout?.toFixed(2) ?? "--"}</div>
          </div>

          {/* Route */}
          <div className="atc-route">
            <div className="atc-route-line">
              <div className="atc-rail">
                <div className="atc-node pickup" />
                <div className="atc-connector" />
              </div>
              <div className="atc-stop-content">
                <div className="atc-stop-tag">Pickup</div>
                <div className="atc-stop-row">
                  <div className="atc-stop-addr">{activeTrip.pickup}</div>
                  {!isProgress && (
                    <button className="atc-map-pill blue" onClick={() => openInMaps(activeTrip.pickup)}>
                      <MapPin size={10} strokeWidth={2.5} /> Maps
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="atc-route-line">
              <div className="atc-rail" style={{ paddingTop: 0 }}>
                <div className="atc-node dropoff" />
              </div>
              <div className="atc-stop-content" style={{ paddingBottom: 0 }}>
                <div className="atc-stop-tag">Dropoff</div>
                <div className="atc-stop-row">
                  <div className="atc-stop-addr dropoff-addr">{activeTrip.dropoff}</div>
                  {isProgress && (
                    <button className="atc-map-pill green" onClick={() => openInMaps(activeTrip.dropoff)}>
                      <MapPin size={10} strokeWidth={2.5} /> Maps
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="atc-stats-bar">
            {[
              { val: `${activeTrip.tripDistanceMiles?.toFixed(1) ?? "--"} mi`, key: "Distance"  },
              { val: `${activeTrip.tripDurationMin ?? "--"} min`,               key: "Est. Time" },
              { val: `$${activeTrip.fareBreakdown?.fareTotal?.toFixed(2) ?? activeTrip.fareTotal?.toFixed(2) ?? "--"}`, key: "Rider Fare" },
            ].map((s, i) => (
              <div key={i} className="atc-stat-cell">
                <span className="atc-stat-val">{s.val}</span>
                <span className="atc-stat-key">{s.key}</span>
              </div>
            ))}
          </div>

          {/* ── 3 Action Buttons ── */}
          <div className="atc-actions">
            <button className="atc-action-btn" onClick={() => openInMaps(isProgress ? activeTrip.dropoff : activeTrip.pickup)}>
              <Map size={16} strokeWidth={1.8} />
              Maps
            </button>
            <button className="atc-action-btn" onClick={callRider}>
              <Phone size={16} strokeWidth={1.8} />
              Call
            </button>
            <button className="atc-action-btn" onClick={openNavigation}>
              <Navigation size={16} strokeWidth={1.8} />
              Navigate
            </button>
          </div>

          <div className="atc-divider" />

          {/* Message toggle */}
          <div className="atc-msg-toggle-row">
            <button
              className={`atc-msg-toggle${unreadCount > 0 ? " has-msg" : ""}`}
              onClick={handleToggleMessages}
            >
              {unreadCount > 0 && (
                <span key={unreadCount} className="atc-badge">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
              <MessageCircle size={13} />
              {showMessages ? "Hide chat" : "Message rider"}
            </button>
            {showMessages && (
              <button className="atc-msg-close" onClick={() => setShowMessages(false)}>
                <X size={12} /> Close
              </button>
            )}
          </div>

          {/* Message panel — keyed to rideId only, not showMessages, so state never resets */}
          {showMessages && rideId && (
            <DriverMessagePanel
              key={rideId}
              rideId={rideId}
              accent={accent}
              onUnreadChange={handleUnreadChange}
            />
          )}

          {/* CTA */}
          <div className="atc-cta-area">
            <button className="atc-cta-btn" onClick={onAdvance} disabled={advancePending}>
              <div className="atc-cta-inner">
                {advancePending
                  ? <><Loader2 size={15} style={{ animation: "atc-spin 1s linear infinite" }} /><span style={{ marginLeft: 8 }}>Processing…</span></>
                  : <><span>{tripBtnLabel}</span><div className="atc-cta-arrow"><ChevronRight size={14} strokeWidth={2.8} /></div></>
                }
              </div>
            </button>

            {canReassign && (
              <button className="atc-reassign-btn" onClick={() => setShowReassign(true)}>
                <UserX size={12} /> Can't make it? Reassign ride
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Driver message panel ─────────────────────────────────────────────────────
function DriverMessagePanel({ rideId, accent, onUnreadChange }) {
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState("");
  const [sending,  setSending]  = useState(false);
  const [sent,     setSent]     = useState(false);
  const listRef       = useRef(null);
  const bottomRef     = useRef(null);
  const isAtBottomRef = useRef(true);
  const justSentRef   = useRef(false);
  // Track showMessages internally so it never collapses on send
  const db        = getFirestore();
  const auth      = getAuth();
  const driverUid = auth.currentUser?.uid ?? null;

  const QUICK = ["On my way 🚗", "I've arrived!", "Calling you now", "1 min away"];

  function handleScroll() {
    const el = listRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }

  useEffect(() => {
    if (!rideId) return;
    const ref   = query(collection(db, "Rides", rideId, "Messages"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(ref, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(msgs);
      onUnreadChange?.(msgs.filter(m => m.senderRole === "rider" && !m.readByDriver).length);
    });
    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideId]);

  // Mark rider messages as read
  useEffect(() => {
    if (!rideId) return;
    messages.forEach(msg => {
      if (msg.senderRole === "rider" && !msg.readByDriver)
        updateDoc(doc(db, "Rides", rideId, "Messages", msg.id), { readByDriver: true }).catch(() => {});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, rideId]);

  // Auto-scroll: only when at bottom or we just sent
  useEffect(() => {
    if (!bottomRef.current) return;
    if (isAtBottomRef.current || justSentRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
      justSentRef.current = false;
    }
  }, [messages]);

  async function sendMessage(text) {
    const trimmed = (text ?? input).trim();
    if (!trimmed || !rideId || !driverUid || sending) return;

    setSending(true);
    justSentRef.current = true;
    // Capture and clear input immediately — don't touch showMessages
    const msgText = trimmed;
    setInput("");

    try {
      await addDoc(collection(db, "Rides", rideId, "Messages"), {
        text: msgText, senderUid: driverUid, senderRole: "driver",
        createdAt: serverTimestamp(), readByDriver: true, readByRider: false,
      });
      setSent(true);
      setTimeout(() => setSent(false), 2000);
    } catch (err) {
      console.error(err);
      justSentRef.current = false;
      // Restore input on failure
      setInput(msgText);
    } finally {
      setSending(false);
    }
  }

  function fmt(ts) {
    if (!ts?.seconds) return "";
    return new Date(ts.seconds * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  const lastDriverIdx = messages.reduce((a, m, i) => m.senderRole === "driver" ? i : a, -1);

  return (
    <div className="atc-msg-panel">
      <div className="atc-msg-header">Chat with rider</div>

      <div
        className="atc-msg-list"
        ref={listRef}
        onScroll={handleScroll}
        // Prevent touch scroll from bubbling to the card
        onTouchStart={e => e.stopPropagation()}
      >
        {messages.length === 0 && <div className="atc-msg-empty">No messages yet. Say hi!</div>}
        {messages.map((msg, idx) => {
          const isDriver = msg.senderRole === "driver";
          const isLast   = isDriver && idx === lastDriverIdx;
          const seen     = isLast && msg.readByRider === true;
          return (
            <div key={msg.id} style={{ display: "flex", justifyContent: isDriver ? "flex-end" : "flex-start" }}>
              <div style={{
                maxWidth: "78%", padding: "8px 12px",
                borderRadius: isDriver ? "13px 13px 3px 13px" : "13px 13px 13px 3px",
                background: isDriver
                  ? `linear-gradient(135deg, ${accent}, ${accent}cc)`
                  : "rgba(255,255,255,.07)",
                border: isDriver ? "none" : "1px solid rgba(255,255,255,.08)",
                boxShadow: isDriver ? `0 2px 12px ${accent}30` : "none",
              }}>
                {!isDriver && (
                  <div style={{ fontSize: 9, fontWeight: 700, color: accent, letterSpacing: ".5px", textTransform: "uppercase", marginBottom: 3 }}>
                    Rider
                  </div>
                )}
                <div style={{ fontSize: 13, color: isDriver ? "#fff" : "rgba(255,255,255,.82)", lineHeight: 1.4 }}>
                  {msg.text}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: isDriver ? "flex-end" : "flex-start", gap: 4, marginTop: 3 }}>
                  <span style={{ fontSize: 9.5, color: isDriver ? "rgba(255,255,255,.45)" : "rgba(255,255,255,.25)" }}>{fmt(msg.createdAt)}</span>
                  {isLast && (
                    <span style={{ position: "relative", width: 18, height: 11, display: "inline-flex", alignItems: "center", flexShrink: 0 }}>
                      <svg width="11" height="8" viewBox="0 0 11 8" fill="none" style={{ position: "absolute", left: seen ? 0 : 3, transition: "left .2s" }}>
                        <path d="M1 4L3.5 6.5L9.5 1" stroke={seen ? "#fff" : "rgba(255,255,255,.4)"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <svg width="11" height="8" viewBox="0 0 11 8" fill="none" style={{ position: "absolute", right: 0, opacity: seen ? 1 : 0, transition: "opacity .25s" }}>
                        <path d="M1 4L3.5 6.5L9.5 1" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} style={{ height: 1 }} />
      </div>

      <div className="atc-quick-row">
        {QUICK.map(q => (
          <button key={q} className="atc-quick" onClick={() => sendMessage(q)}>{q}</button>
        ))}
      </div>

      <div className="atc-input-row">
        <textarea
          className="atc-textarea"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          placeholder="Type a message…"
          rows={1}
        />
        <button
          className="atc-send"
          onClick={() => sendMessage()}
          disabled={!input.trim() || sending}
          style={{
            background: input.trim() && !sending ? `linear-gradient(135deg, ${accent}, ${accent}bb)` : "rgba(255,255,255,.06)",
            cursor: !input.trim() || sending ? "not-allowed" : "pointer",
            boxShadow: input.trim() ? `0 2px 12px ${accent}35` : "none",
          }}
        >
          {sent
            ? <Check size={14} color="#fff" strokeWidth={3} />
            : <Send size={13} color={input.trim() && !sending ? "#fff" : "rgba(255,255,255,.25)"} />
          }
        </button>
      </div>
    </div>
  );
}
