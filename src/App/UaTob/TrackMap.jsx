// TrackMap.jsx
// Live driver-tracking map for the active-ride screen (Uber-style).
// Draws the active route with a glow + casing + flowing marching-dash overlay,
// a glowing driver puck, pickup/dropoff pins, and frames the FULL decoded route
// (not just the endpoints) above the status card.

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { MAPBOX_TOKEN, MAP_STYLE, ORL, loadMapbox, decodePolyline } from '@/App/UaTob/mapUtils';

const SRC = 'tm-route';
const GREEN  = '#2FE08A';
const CYAN   = '#3FD0EE';

// flowing marching-dash frames (gives the route a "live navigation" feel)
const DASH_FRAMES = [
  [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5],
  [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0], [0, 0.5, 3, 3.5],
  [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5],
  [0, 3, 3, 1], [0, 3.5, 3, 0.5],
];
const DASH_MS = 60;

function makePin(color, glyph) {
  const el = document.createElement('div');
  el.style.cssText = 'position:relative;width:0;height:0';
  const dot = document.createElement('div');
  dot.style.cssText = `position:absolute;left:0;top:0;transform:translate(-50%,-50%);width:28px;height:28px;border-radius:50%;background:rgba(5,10,6,.94);border:2.5px solid ${color};box-shadow:0 0 16px ${color}cc;display:flex;align-items:center;justify-content:center;font-size:14px`;
  dot.textContent = glyph;
  el.appendChild(dot);
  return el;
}

// Glowing driver puck with a pulsing ring + a heading-aware car.
function makeCar(heading) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;width:0;height:0';
  const glow = document.createElement('div');
  glow.style.cssText = 'position:absolute;left:0;top:0;width:52px;height:52px;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,rgba(47,224,138,.45),transparent 68%)';
  const pulse = document.createElement('div');
  pulse.style.cssText = 'position:absolute;left:0;top:0;width:40px;height:40px;border-radius:50%;border:2px solid rgba(47,224,138,.5);transform:translate(-50%,-50%) scale(.5);opacity:0;animation:tmPulse 1.8s ease-out infinite';
  const car = document.createElement('div');
  car.style.cssText = 'position:absolute;left:0;top:0;transform:translate(-50%,-50%);width:34px;height:34px;border-radius:50%;background:linear-gradient(145deg,#4ADE80,#16A34A);border:3px solid #fff;box-shadow:0 4px 16px rgba(34,197,94,.75),0 2px 6px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center';
  car.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 5 21l7-4 7 4z"/></svg>';
  const inner = car.firstChild;
  wrap.appendChild(glow); wrap.appendChild(pulse); wrap.appendChild(car);
  wrap._setHeading = (h) => { if (h != null && inner) inner.style.transform = `rotate(${h}deg)`; };
  if (heading != null) wrap._setHeading(heading);
  return wrap;
}

// phase: 'search' (no driver yet) | 'toPickup' | 'trip'
export default function TrackMap({ pickup, dropoff, driver, polyline, phase }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const pickupRef = useRef(null);
  const dropoffRef = useRef(null);
  const carRef = useRef(null);
  const viewRef = useRef(null);
  const dashRafRef = useRef(0);
  const dashStepRef = useRef(0);
  const lastDashRef = useRef(0);
  const [ready, setReady] = useState(false);

  const start = pickup?.lat != null ? pickup : (dropoff?.lat != null ? dropoff : ORL);

  // Decode once; used for both the line and the camera framing. [lng,lat] pairs.
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
        center: [start.lng, start.lat], zoom: 13, pitch: 46, bearing: -14,
        interactive: false, attributionControl: false, antialias: true,
      });
      map.on('load', () => {
        if (cancelled) return;
        map.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        // wide soft glow under everything
        map.addLayer({ id: `${SRC}-glow`, type: 'line', source: SRC, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': GREEN, 'line-width': 18, 'line-opacity': 0.14, 'line-blur': 8 } });
        // dark casing so the route reads on any basemap
        map.addLayer({ id: `${SRC}-case`, type: 'line', source: SRC, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#04140b', 'line-width': 8.5, 'line-opacity': 0.9 } });
        // main line
        map.addLayer({ id: `${SRC}-line`, type: 'line', source: SRC, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': GREEN, 'line-width': 4.5, 'line-opacity': 0.95 } });
        // flowing dash overlay
        map.addLayer({ id: `${SRC}-dash`, type: 'line', source: SRC, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#EAFFF2', 'line-width': 2, 'line-opacity': 0.55, 'line-dasharray': [0, 4, 3] } });
        mapRef.current = map;
        setReady(true);

        // dash flow loop
        const loop = (now) => {
          dashRafRef.current = requestAnimationFrame(loop);
          if (!mapRef.current || !mapRef.current.getLayer(`${SRC}-dash`)) return;
          if (now - lastDashRef.current < DASH_MS) return;
          lastDashRef.current = now;
          dashStepRef.current = (dashStepRef.current + 1) % DASH_FRAMES.length;
          try { mapRef.current.setPaintProperty(`${SRC}-dash`, 'line-dasharray', DASH_FRAMES[dashStepRef.current]); } catch {}
        };
        dashRafRef.current = requestAnimationFrame(loop);
      });
    }).catch(() => {});
    return () => {
      cancelled = true;
      cancelAnimationFrame(dashRafRef.current);
      [pickupRef, dropoffRef, carRef].forEach((r) => { if (r.current) { try { r.current.remove(); } catch {} r.current = null; } });
      if (mapRef.current) { try { mapRef.current.remove(); } catch {} mapRef.current = null; }
    };
  }, []); // eslint-disable-line

  // route line + endpoint pins
  useEffect(() => {
    if (!ready || !mapRef.current || !window.mapboxgl) return;
    const map = mapRef.current;
    try {
      map.getSource(SRC)?.setData(
        routeCoords.length >= 2
          ? { type: 'Feature', geometry: { type: 'LineString', coordinates: routeCoords } }
          : { type: 'FeatureCollection', features: [] }
      );
    } catch {}
    if (pickup?.lat != null) {
      if (!pickupRef.current) pickupRef.current = new window.mapboxgl.Marker({ element: makePin(CYAN, '📍'), anchor: 'center' }).setLngLat([pickup.lng, pickup.lat]).addTo(map);
      else pickupRef.current.setLngLat([pickup.lng, pickup.lat]);
    }
    if (dropoff?.lat != null) {
      if (!dropoffRef.current) dropoffRef.current = new window.mapboxgl.Marker({ element: makePin(GREEN, '🏁'), anchor: 'center' }).setLngLat([dropoff.lng, dropoff.lat]).addTo(map);
      else dropoffRef.current.setLngLat([dropoff.lng, dropoff.lat]);
    }
  }, [ready, routeCoords, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng]);

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

  // camera — frame the FULL route when we have one, else the relevant endpoints
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

    let pts;
    if (routeCoords.length >= 2) {
      // Frame the whole route + the live driver so the full path is always visible.
      pts = routeCoords.slice();
      if (d) pts.push(d);
    } else if (phase === 'trip')      pts = [d, dp].filter(Boolean);
    else if (phase === 'toPickup')    pts = [d, pk].filter(Boolean);
    else                              pts = [pk, dp].filter(Boolean);
    if (!pts.length) pts = [pk || dp].filter(Boolean);

    viewRef.current = pts;
    try { mapRef.current.resize(); } catch {}
    applyView(true);
  }, [ready, phase, routeCoords, driver?.lat, driver?.lng, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, applyView]);

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
      <style>{`@keyframes tmPulse{0%{transform:translate(-50%,-50%) scale(.5);opacity:.8}100%{transform:translate(-50%,-50%) scale(2.6);opacity:0}}`}</style>
      <div ref={elRef} style={{ position: 'absolute', inset: 0, opacity: ready ? 1 : 0, transition: 'opacity .8s ease' }} />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(5,10,6,.55) 0%, transparent 20%, transparent 42%, rgba(5,10,6,.62) 80%, #050A06 100%)' }} />
    </div>
  );
}
