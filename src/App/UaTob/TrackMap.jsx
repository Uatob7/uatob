// TrackMap.jsx
// Live driver-tracking map for the active-ride screen (new UaTob design).
// Shows the trip route, pickup/dropoff pins and the driver's live car, and
// keeps the relevant leg framed + centered above the status card.

import { useEffect, useRef, useState, useCallback } from 'react';
import { MAPBOX_TOKEN, MAP_STYLE, ORL, loadMapbox, decodePolyline } from '@/App/UaTob/mapUtils';

const SRC = 'tm-route';

function makePin(color, glyph) {
  const el = document.createElement('div');
  el.style.cssText = 'position:relative;width:0;height:0';
  const dot = document.createElement('div');
  dot.style.cssText = `position:absolute;left:0;top:0;transform:translate(-50%,-50%);width:26px;height:26px;border-radius:50%;background:rgba(5,10,6,.92);border:2.5px solid ${color};box-shadow:0 0 14px ${color}cc;display:flex;align-items:center;justify-content:center;font-size:13px`;
  dot.textContent = glyph;
  el.appendChild(dot);
  return el;
}

function makeCar(heading) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;width:0;height:0';
  const pulse = document.createElement('div');
  pulse.style.cssText = 'position:absolute;left:0;top:0;width:34px;height:34px;border-radius:50%;border:2px solid rgba(34,197,94,.5);transform:translate(-50%,-50%) scale(.5);opacity:0;animation:tmPulse 1.8s ease-out infinite';
  const car = document.createElement('div');
  car.style.cssText = 'position:absolute;left:0;top:0;transform:translate(-50%,-50%);width:26px;height:26px;border-radius:50%;background:rgba(5,10,6,.92);border:2.5px solid #22C55E;box-shadow:0 0 14px rgba(34,197,94,.9);display:flex;align-items:center;justify-content:center;font-size:14px';
  car.textContent = '🚗';
  wrap.appendChild(pulse);
  wrap.appendChild(car);
  wrap._setHeading = (h) => { if (h != null) car.style.transform = `translate(-50%,-50%) rotate(${h}deg)`; };
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
  const [ready, setReady] = useState(false);

  const start = pickup?.lat != null ? pickup : (dropoff?.lat != null ? dropoff : ORL);

  useEffect(() => {
    let cancelled = false;
    loadMapbox().then((mapboxgl) => {
      if (cancelled || !elRef.current || mapRef.current) return;
      mapboxgl.accessToken = MAPBOX_TOKEN;
      const map = new mapboxgl.Map({
        container: elRef.current, style: MAP_STYLE,
        center: [start.lng, start.lat], zoom: 13, pitch: 45, bearing: -15,
        interactive: false, attributionControl: false, antialias: true,
      });
      map.on('load', () => {
        if (cancelled) return;
        map.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({ id: `${SRC}-glow`, type: 'line', source: SRC, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#4ADE80', 'line-width': 9, 'line-opacity': 0.16, 'line-blur': 3 } });
        map.addLayer({ id: `${SRC}-line`, type: 'line', source: SRC, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#4ADE80', 'line-width': 3.5, 'line-opacity': 0.9 } });
        mapRef.current = map;
        setReady(true);
      });
    }).catch(() => {});
    return () => {
      cancelled = true;
      [pickupRef, dropoffRef, carRef].forEach((r) => { if (r.current) { try { r.current.remove(); } catch {} r.current = null; } });
      if (mapRef.current) { try { mapRef.current.remove(); } catch {} mapRef.current = null; }
    };
  }, []); // eslint-disable-line

  // route line + endpoint pins
  useEffect(() => {
    if (!ready || !mapRef.current || !window.mapboxgl) return;
    const map = mapRef.current;
    const coords = decodePolyline(polyline);
    try {
      map.getSource(SRC)?.setData({ type: 'FeatureCollection', features: coords.length >= 2 ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: coords } }] : [] });
    } catch {}
    if (pickup?.lat != null) {
      if (!pickupRef.current) pickupRef.current = new window.mapboxgl.Marker({ element: makePin('#22D3EE', '📍'), anchor: 'center' }).setLngLat([pickup.lng, pickup.lat]).addTo(map);
      else pickupRef.current.setLngLat([pickup.lng, pickup.lat]);
    }
    if (dropoff?.lat != null) {
      if (!dropoffRef.current) dropoffRef.current = new window.mapboxgl.Marker({ element: makePin('#4ADE80', '🏁'), anchor: 'center' }).setLngLat([dropoff.lng, dropoff.lat]).addTo(map);
      else dropoffRef.current.setLngLat([dropoff.lng, dropoff.lat]);
    }
  }, [ready, polyline, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng]);

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

  // camera
  const applyView = useCallback((animated) => {
    const map = mapRef.current; const v = viewRef.current;
    if (!map || !v || v.length < 1) return;
    const h = elRef.current?.clientHeight || 600;
    const duration = animated ? 1000 : 0;
    try {
      if (v.length === 1) {
        map.easeTo({ center: v[0], zoom: 15, padding: { top: 0, bottom: Math.round(h * 0.5), left: 0, right: 0 }, duration });
      } else {
        const lngs = v.map((p) => p[0]); const lats = v.map((p) => p[1]);
        map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], {
          padding: { top: 80, bottom: Math.round(h * 0.5), left: 60, right: 60 }, duration, maxZoom: 15.5,
        });
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const d = driver?.lat != null ? [driver.lng, driver.lat] : null;
    const pk = pickup?.lat != null ? [pickup.lng, pickup.lat] : null;
    const dp = dropoff?.lat != null ? [dropoff.lng, dropoff.lat] : null;
    let pts = [];
    if (phase === 'trip') pts = [d, dp].filter(Boolean);
    else if (phase === 'toPickup') pts = [d, pk].filter(Boolean);
    else pts = [pk, dp].filter(Boolean);
    if (!pts.length) pts = [pk || dp].filter(Boolean);
    viewRef.current = pts;
    try { mapRef.current.resize(); } catch {}
    applyView(true);
  }, [ready, phase, driver?.lat, driver?.lng, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, applyView]);

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
