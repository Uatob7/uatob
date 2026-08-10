// TrackMap.jsx
// Live driver-tracking map for the active-ride screen (Uber-style).
// Matches the driver map's route treatment: the route is split into a bright
// REMAINING leg (glow + casing + flowing marching-dash) and a faint TRAVELED
// leg, split at the driver's projected position so the line "consumes" behind
// the car as it moves. Glowing driver puck + pickup/dropoff pins, framed on the
// two relevant points for the phase.

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { MAPBOX_TOKEN, MAP_STYLE, ORL, loadMapbox, decodePolyline } from '@/App/UaTob/mapUtils';

const SRC_REMAIN = 'tm-remain';
const SRC_TRAVEL = 'tm-travel';
const GREEN = '#2FE08A';
const CYAN  = '#3FD0EE';

const DASH_FRAMES = [
  [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5],
  [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0], [0, 0.5, 3, 3.5],
  [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5],
  [0, 3, 3, 1], [0, 3.5, 3, 0.5],
];
const DASH_MS = 60;

// Project point p onto the polyline; return the segment index + the projected
// point so we can split the route exactly at the car.
function projectOnRoute(coords, p) {
  let best = { d2: Infinity, idx: 0, point: coords[0] };
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i], b = coords[i + 1];
    const abx = b[0] - a[0], aby = b[1] - a[1];
    const len2 = abx * abx + aby * aby || 1e-12;
    let t = ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / len2;
    t = Math.max(0, Math.min(1, t));
    const proj = [a[0] + abx * t, a[1] + aby * t];
    const dx = p[0] - proj[0], dy = p[1] - proj[1];
    const d2 = dx * dx + dy * dy;
    if (d2 < best.d2) best = { d2, idx: i, point: proj };
  }
  return best;
}

function makePin(color, glyph) {
  const el = document.createElement('div');
  el.style.cssText = 'position:relative;width:0;height:0';
  const dot = document.createElement('div');
  dot.style.cssText = `position:absolute;left:0;top:0;transform:translate(-50%,-50%);width:28px;height:28px;border-radius:50%;background:rgba(5,10,6,.94);border:2.5px solid ${color};box-shadow:0 0 16px ${color}cc;display:flex;align-items:center;justify-content:center;font-size:14px`;
  dot.textContent = glyph;
  el.appendChild(dot);
  return el;
}

function makeStopPin(n) {
  const color = '#FBBF24';
  const el = document.createElement('div');
  el.style.cssText = 'position:relative;width:0;height:0';
  const dot = document.createElement('div');
  dot.style.cssText = `position:absolute;left:0;top:0;transform:translate(-50%,-50%);width:24px;height:24px;border-radius:50%;background:rgba(5,10,6,.94);border:2.5px solid ${color};box-shadow:0 0 14px ${color}bb;display:flex;align-items:center;justify-content:center;font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:800;color:${color}`;
  dot.textContent = String(n);
  el.appendChild(dot);
  return el;
}

// Radar shown at the pickup while we hunt for a driver — expanding rings + a
// rotating sweep so "broadcasting to drivers nearby" reads on the map itself.
function makeRadar() {
  const el = document.createElement('div');
  el.style.cssText = 'position:relative;width:0;height:0;pointer-events:none';
  const sweep = document.createElement('div');
  sweep.style.cssText = 'position:absolute;left:0;top:0;width:150px;height:150px;transform:translate(-50%,-50%);border-radius:50%;background:conic-gradient(from 0deg, rgba(63,208,238,.30), rgba(63,208,238,0) 60%);-webkit-mask:radial-gradient(circle, transparent 7px, #000 8px);mask:radial-gradient(circle, transparent 7px, #000 8px);animation:tmSweep 2.6s linear infinite';
  el.appendChild(sweep);
  for (let i = 0; i < 3; i++) {
    const ring = document.createElement('div');
    ring.style.cssText = `position:absolute;left:0;top:0;width:64px;height:64px;border-radius:50%;border:1.5px solid rgba(63,208,238,.55);transform:translate(-50%,-50%) scale(.3);opacity:0;animation:tmRadar 3s ease-out ${i}s infinite`;
    el.appendChild(ring);
  }
  return el;
}

function makeCar(heading) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;width:0;height:0';
  const glow = document.createElement('div');
  glow.style.cssText = 'position:absolute;left:0;top:0;width:54px;height:54px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,rgba(47,224,138,.45),transparent 68%)';
  const pulse = document.createElement('div');
  pulse.style.cssText = 'position:absolute;left:0;top:0;width:42px;height:42px;border-radius:50%;border:2px solid rgba(47,224,138,.5);transform:translate(-50%,-50%) scale(.5);opacity:0;animation:tmPulse 1.8s ease-out infinite';
  const car = document.createElement('div');
  car.style.cssText = 'position:absolute;left:0;top:0;transform:translate(-50%,-50%);width:36px;height:36px;border-radius:50%;background:linear-gradient(145deg,#4ADE80,#16A34A);border:3px solid #fff;box-shadow:0 4px 18px rgba(34,197,94,.75),0 2px 6px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center';
  car.innerHTML = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 5 21l7-4 7 4z"/></svg>';
  const inner = car.firstChild;
  wrap.appendChild(glow); wrap.appendChild(pulse); wrap.appendChild(car);
  wrap._setHeading = (h) => { if (h != null && inner) inner.style.transform = `rotate(${h}deg)`; };
  if (heading != null) wrap._setHeading(heading);
  return wrap;
}

// phase: 'search' (no driver yet) | 'toPickup' | 'trip'
export default function TrackMap({ pickup, dropoff, driver, polyline, phase, stops = [] }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const pickupRef = useRef(null);
  const dropoffRef = useRef(null);
  const carRef = useRef(null);
  const stopRefsRef = useRef([]);   // numbered pins for intermediate stops
  const radarRef = useRef(null);    // pulsing radar shown at pickup while searching
  const viewRef = useRef(null);
  const dashRafRef = useRef(0);
  const dashStepRef = useRef(0);

  const stopPts = (Array.isArray(stops) ? stops : []).filter((s) => s?.lat != null && s?.lng != null);
  const stopsKey = JSON.stringify(stopPts.map((s) => [s.lng, s.lat]));
  const lastDashRef = useRef(0);
  const [ready, setReady] = useState(false);

  const start = pickup?.lat != null ? pickup : (dropoff?.lat != null ? dropoff : ORL);

  const routeCoords = useMemo(() => {
    const dec = decodePolyline(polyline);
    return dec.length >= 2 ? dec.map((p) => [p[1], p[0]]) : [];
  }, [polyline]);

  useEffect(() => {
    let cancelled = false;
    loadMapbox().then((mapboxgl) => {
      if (cancelled || !elRef.current || mapRef.current) return;
      mapboxgl.accessToken = MAPBOX_TOKEN;
      const map = new mapboxgl.Map({
        container: elRef.current, style: MAP_STYLE,
        center: [start.lng, start.lat], zoom: 13.5, pitch: 55, bearing: -14,
        interactive: false, attributionControl: false, antialias: true,
      });
      map.on('load', () => {
        if (cancelled) return;
        map.addSource(SRC_TRAVEL, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addSource(SRC_REMAIN, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        // traveled (behind the car) — faint
        map.addLayer({ id: `${SRC_TRAVEL}-line`, type: 'line', source: SRC_TRAVEL, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': 'rgba(255,255,255,.85)', 'line-width': 5, 'line-opacity': 0.14 } });
        // remaining — glow + casing + main + flowing dash
        map.addLayer({ id: `${SRC_REMAIN}-glow`, type: 'line', source: SRC_REMAIN, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': GREEN, 'line-width': 18, 'line-opacity': 0.14, 'line-blur': 8 } });
        map.addLayer({ id: `${SRC_REMAIN}-case`, type: 'line', source: SRC_REMAIN, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#04140b', 'line-width': 8.5, 'line-opacity': 0.9 } });
        map.addLayer({ id: `${SRC_REMAIN}-line`, type: 'line', source: SRC_REMAIN, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': GREEN, 'line-width': 4.5, 'line-opacity': 0.95 } });
        map.addLayer({ id: `${SRC_REMAIN}-dash`, type: 'line', source: SRC_REMAIN, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#EAFFF2', 'line-width': 2, 'line-opacity': 0.55, 'line-dasharray': [0, 4, 3] } });
        mapRef.current = map;
        setReady(true);

        const loop = (now) => {
          dashRafRef.current = requestAnimationFrame(loop);
          if (!mapRef.current || !mapRef.current.getLayer(`${SRC_REMAIN}-dash`)) return;
          if (now - lastDashRef.current < DASH_MS) return;
          lastDashRef.current = now;
          dashStepRef.current = (dashStepRef.current + 1) % DASH_FRAMES.length;
          try { mapRef.current.setPaintProperty(`${SRC_REMAIN}-dash`, 'line-dasharray', DASH_FRAMES[dashStepRef.current]); } catch {}
        };
        dashRafRef.current = requestAnimationFrame(loop);
      });
    }).catch(() => {});
    return () => {
      cancelled = true;
      cancelAnimationFrame(dashRafRef.current);
      stopRefsRef.current.forEach((m) => { try { m.remove(); } catch {} });
      stopRefsRef.current = [];
      [pickupRef, dropoffRef, carRef, radarRef].forEach((r) => { if (r.current) { try { r.current.remove(); } catch {} r.current = null; } });
      if (mapRef.current) { try { mapRef.current.remove(); } catch {} mapRef.current = null; }
    };
  }, []); // eslint-disable-line

  // route split (traveled vs remaining) + endpoint pins
  useEffect(() => {
    if (!ready || !mapRef.current || !window.mapboxgl) return;
    const map = mapRef.current;

    let traveled = [], remaining = routeCoords;
    if (routeCoords.length >= 2 && driver?.lat != null) {
      const proj = projectOnRoute(routeCoords, [driver.lng, driver.lat]);
      traveled  = routeCoords.slice(0, proj.idx + 1).concat([proj.point]);
      remaining = [proj.point].concat(routeCoords.slice(proj.idx + 1));
    }
    const feat = (coords) => (coords.length >= 2
      ? { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } }
      : { type: 'FeatureCollection', features: [] });
    try {
      map.getSource(SRC_TRAVEL)?.setData(feat(traveled));
      map.getSource(SRC_REMAIN)?.setData(feat(remaining));
    } catch {}

    if (pickup?.lat != null) {
      if (!pickupRef.current) pickupRef.current = new window.mapboxgl.Marker({ element: makePin(CYAN, '📍'), anchor: 'center' }).setLngLat([pickup.lng, pickup.lat]).addTo(map);
      else pickupRef.current.setLngLat([pickup.lng, pickup.lat]);
    }
    if (dropoff?.lat != null) {
      if (!dropoffRef.current) dropoffRef.current = new window.mapboxgl.Marker({ element: makePin(GREEN, '🏁'), anchor: 'center' }).setLngLat([dropoff.lng, dropoff.lat]).addTo(map);
      else dropoffRef.current.setLngLat([dropoff.lng, dropoff.lat]);
    }
    // numbered stop pins
    stopRefsRef.current.forEach((m) => { try { m.remove(); } catch {} });
    stopRefsRef.current = [];
    stopPts.forEach((s, i) => {
      stopRefsRef.current.push(new window.mapboxgl.Marker({ element: makeStopPin(i + 1), anchor: 'center' }).setLngLat([s.lng, s.lat]).addTo(map));
    });
  }, [ready, routeCoords, driver?.lat, driver?.lng, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, stopsKey]); // eslint-disable-line

  // radar at the pickup while searching
  useEffect(() => {
    if (!ready || !mapRef.current || !window.mapboxgl) return;
    const map = mapRef.current;
    if (phase === 'search' && pickup?.lat != null) {
      if (!radarRef.current) radarRef.current = new window.mapboxgl.Marker({ element: makeRadar(), anchor: 'center' }).setLngLat([pickup.lng, pickup.lat]).addTo(map);
      else radarRef.current.setLngLat([pickup.lng, pickup.lat]);
    } else if (radarRef.current) { try { radarRef.current.remove(); } catch {} radarRef.current = null; }
  }, [ready, phase, pickup?.lat, pickup?.lng]);

  // live driver car
  useEffect(() => {
    if (!ready || !mapRef.current || !window.mapboxgl) return;
    const map = mapRef.current;
    if (driver?.lat != null) {
      if (!carRef.current) {
        const el = makeCar(driver.heading);
        carRef.current = new window.mapboxgl.Marker({ element: el, anchor: 'center' }).setLngLat([driver.lng, driver.lat]).addTo(map);
        carRef.current._el = el;
      } else {
        carRef.current.setLngLat([driver.lng, driver.lat]);
        carRef.current._el?._setHeading?.(driver.heading);
      }
    } else if (carRef.current) { try { carRef.current.remove(); } catch {} carRef.current = null; }
  }, [ready, driver?.lat, driver?.lng, driver?.heading]);

  // camera — frame the two RELEVANT points for the phase (known-good endpoints)
  const applyView = useCallback((animated) => {
    const map = mapRef.current; const pts = viewRef.current;
    if (!map || !pts || pts.length < 1) return;
    const h = elRef.current?.clientHeight || 600;
    const duration = animated ? 900 : 0;
    try {
      if (pts.length === 1) {
        map.easeTo({ center: pts[0], zoom: 15, padding: { top: 60, bottom: Math.round(h * 0.5), left: 40, right: 40 }, duration });
      } else {
        const lngs = pts.map((p) => p[0]); const lats = pts.map((p) => p[1]);
        map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], {
          padding: { top: 90, bottom: Math.round(h * 0.5), left: 55, right: 55 }, duration, maxZoom: 15.5,
        });
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const d  = driver?.lat  != null ? [driver.lng, driver.lat]   : null;
    const pk = pickup?.lat  != null ? [pickup.lng, pickup.lat]   : null;
    const dp = dropoff?.lat != null ? [dropoff.lng, dropoff.lat] : null;

    const sp = stopPts.map((s) => [s.lng, s.lat]);

    let pts;
    if (phase === 'trip')            pts = [d, ...sp, dp].filter(Boolean);   // remaining trip incl. stops
    else if (phase === 'toPickup')   pts = [d, pk].filter(Boolean);          // just driver → pickup
    else                             pts = [pk, ...sp, dp].filter(Boolean);  // search: whole trip
    if (!pts.length) pts = [pk || dp].filter(Boolean);

    viewRef.current = pts;
    try { mapRef.current.resize(); } catch {}
    applyView(true);
  }, [ready, phase, driver?.lat, driver?.lng, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, stopsKey, applyView]); // eslint-disable-line

  useEffect(() => {
    if (!ready || !elRef.current || typeof ResizeObserver === 'undefined') return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { if (mapRef.current) { try { mapRef.current.resize(); } catch {} applyView(false); } });
    });
    ro.observe(elRef.current);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [ready, applyView]);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <style>{`@keyframes tmPulse{0%{transform:translate(-50%,-50%) scale(.5);opacity:.8}100%{transform:translate(-50%,-50%) scale(2.6);opacity:0}} @keyframes tmRadar{0%{transform:translate(-50%,-50%) scale(.3);opacity:.7}100%{transform:translate(-50%,-50%) scale(3.6);opacity:0}} @keyframes tmSweep{to{transform:translate(-50%,-50%) rotate(360deg)}} .mapboxgl-ctrl-logo,.mapboxgl-ctrl-bottom-left,.mapboxgl-ctrl-bottom-right,.mapboxgl-ctrl-attrib{display:none!important}`}</style>
      <div ref={elRef} style={{ position: 'absolute', inset: 0, opacity: ready ? 1 : 0, transition: 'opacity .8s ease' }} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(5,10,6,.55) 0%, transparent 20%, transparent 42%, rgba(5,10,6,.62) 80%, #050A06 100%)' }} />
    </div>
  );
}
