// RiderMap.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Live dark Mapbox backdrop for the map-first Request screen.
//
//   • no pickup yet  → a radar sweeps 360° over the map center
//   • pickup set     → recenter on pickup, drop a pin (the "center point")
//   • + dropoff set  → draw the route polyline and fit both endpoints
//
// Self-contained: loads mapbox-gl from CDN once, decodes the encoded polyline
// from useRoute, and cleans up on unmount.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';

const MAPBOX_TOKEN = 'pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA';
const MAP_STYLE = 'mapbox://styles/mapbox/dark-v11';
const ORL = { lng: -81.3792, lat: 28.5383 };
const ROUTE_SRC = 'rm-route';

let mapboxPromise = null;
function loadMapbox() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.mapboxgl) return Promise.resolve(window.mapboxgl);
  if (mapboxPromise) return mapboxPromise;
  mapboxPromise = new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css';
    document.head.appendChild(link);
    const s = document.createElement('script');
    s.src = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js';
    s.async = true;
    s.onload = () => resolve(window.mapboxgl);
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return mapboxPromise;
}

// Decode a precision-5 encoded polyline → [[lng,lat], …]
function decodePolyline(str, precision = 5) {
  if (!str) return [];
  let index = 0, lat = 0, lng = 0;
  const coords = [], factor = Math.pow(10, precision);
  while (index < str.length) {
    let result = 1, shift = 0, b;
    do { b = str.charCodeAt(index++) - 63 - 1; result += b << shift; shift += 5; } while (b >= 0x1f);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    result = 1; shift = 0;
    do { b = str.charCodeAt(index++) - 63 - 1; result += b << shift; shift += 5; } while (b >= 0x1f);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    coords.push([lng / factor, lat / factor]);
  }
  return coords;
}

// A small glowing dot representing a moving driver.
function makeDot() {
  const el = document.createElement('div');
  el.style.cssText = 'width:11px;height:11px;border-radius:50%;background:#4ADE80;border:1.5px solid rgba(5,10,6,.9);box-shadow:0 0 8px rgba(74,222,128,.9),0 0 0 4px rgba(74,222,128,.16);opacity:0;will-change:transform,opacity';
  return el;
}

// Ambient (simulated) fleet — random driver dots that drift and fade in/out so
// the map always feels live. Tuning constants:
const AMBIENT_COUNT = 12;
const AMBIENT_SPREAD = 0.045;                 // ~3mi box around center
function spawnAmbient(origin) {
  return {
    lat: origin.lat + (Math.random() - 0.5) * AMBIENT_SPREAD,
    lng: origin.lng + (Math.random() - 0.5) * AMBIENT_SPREAD * 1.4,
    heading: Math.random() * Math.PI * 2,
    turn: (Math.random() - 0.5) * 0.5,
    speed: 0.00035 + Math.random() * 0.0006,  // deg / sec
    ttl: 8 + Math.random() * 9,
    age: 0,
  };
}

function makePin(color, glyph) {
  const el = document.createElement('div');
  el.style.cssText = `position:relative;width:0;height:0`;
  const dot = document.createElement('div');
  dot.style.cssText = `position:absolute;left:0;top:0;transform:translate(-50%,-50%);width:26px;height:26px;border-radius:50%;background:rgba(5,10,6,.92);border:2.5px solid ${color};box-shadow:0 0 14px ${color}cc;display:flex;align-items:center;justify-content:center;font-size:13px`;
  dot.textContent = glyph;
  el.appendChild(dot);
  return el;
}

export default function RiderMap({ center, drivers = [], pickup, dropoff, polyline }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const driverMarkersRef = useRef([]);
  const pickupMarkerRef = useRef(null);
  const dropoffMarkerRef = useRef(null);
  const ambientRef = useRef([]);   // [{ car, marker }]
  const rafRef = useRef(null);
  const centerRef = useRef(null);
  const [ready, setReady] = useState(false);

  const base = pickup || (center?.lat != null ? center : ORL);
  centerRef.current = base;

  // ── init once ──
  useEffect(() => {
    let cancelled = false;
    loadMapbox().then((mapboxgl) => {
      if (cancelled || !elRef.current || mapRef.current) return;
      mapboxgl.accessToken = MAPBOX_TOKEN;
      const map = new mapboxgl.Map({
        container: elRef.current,
        style: MAP_STYLE,
        center: [base.lng, base.lat],
        zoom: 12.6, pitch: 42, bearing: -17,
        interactive: false, attributionControl: false, antialias: true,
      });
      map.on('load', () => {
        if (cancelled) return;
        map.addSource(ROUTE_SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({
          id: `${ROUTE_SRC}-glow`, type: 'line', source: ROUTE_SRC,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#4ADE80', 'line-width': 9, 'line-opacity': 0.18, 'line-blur': 3 },
        });
        map.addLayer({
          id: `${ROUTE_SRC}-line`, type: 'line', source: ROUTE_SRC,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#4ADE80', 'line-width': 3.5, 'line-opacity': 0.95 },
        });
        mapRef.current = map;
        setReady(true);
      });
    }).catch(() => {});
    return () => {
      cancelled = true;
      driverMarkersRef.current.forEach((m) => { try { m.remove(); } catch {} });
      driverMarkersRef.current = [];
      [pickupMarkerRef, dropoffMarkerRef].forEach((r) => { if (r.current) { try { r.current.remove(); } catch {} r.current = null; } });
      if (mapRef.current) { try { mapRef.current.remove(); } catch {} mapRef.current = null; }
    };
  }, []); // eslint-disable-line

  // ── driver pins ──
  useEffect(() => {
    if (!ready || !mapRef.current || !window.mapboxgl) return;
    const map = mapRef.current;
    driverMarkersRef.current.forEach((m) => { try { m.remove(); } catch {} });
    driverMarkersRef.current = [];
    drivers
      .filter((d) => typeof d.lat === 'number' && typeof d.lng === 'number')
      .slice(0, 40)
      .forEach((d) => {
        const el = document.createElement('div');
        el.style.cssText = 'width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:17px;filter:drop-shadow(0 2px 5px rgba(0,0,0,.7))';
        el.textContent = '🚗';
        driverMarkersRef.current.push(new window.mapboxgl.Marker({ element: el }).setLngLat([d.lng, d.lat]).addTo(map));
      });
  }, [ready, drivers]);

  // ── ambient fleet — random dots drifting + fading in/out ──
  useEffect(() => {
    if (!ready || !mapRef.current || !window.mapboxgl) return;
    const map = mapRef.current;
    const origin = centerRef.current || ORL;

    ambientRef.current = Array.from({ length: AMBIENT_COUNT }, () => {
      const car = spawnAmbient(origin);
      car.age = Math.random() * car.ttl;                 // stagger so they don't blink together
      const marker = new window.mapboxgl.Marker({ element: makeDot() }).setLngLat([car.lng, car.lat]).addTo(map);
      return { car, marker };
    });

    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const o = centerRef.current || ORL;
      for (const a of ambientRef.current) {
        const c = a.car;
        c.age += dt;
        c.heading += c.turn * dt;
        if (Math.random() < 0.012) c.turn = (Math.random() - 0.5) * 0.6;
        c.lat += Math.cos(c.heading) * c.speed * dt;
        c.lng += Math.sin(c.heading) * c.speed * dt;

        // fade in over first 1.5s, hold, fade out over last 1.5s → "come in / out"
        let op = 0.85;
        if (c.age < 1.5) op = (c.age / 1.5) * 0.85;
        else if (c.age > c.ttl - 1.5) op = Math.max(0, (c.ttl - c.age) / 1.5) * 0.85;
        a.marker.getElement().style.opacity = op.toFixed(2);
        a.marker.setLngLat([c.lng, c.lat]);

        if (c.age >= c.ttl) Object.assign(c, spawnAmbient(o)); // respawn elsewhere
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ambientRef.current.forEach((a) => { try { a.marker.remove(); } catch {} });
      ambientRef.current = [];
    };
  }, [ready]);

  // ── pickup / dropoff pins ──
  useEffect(() => {
    if (!ready || !mapRef.current || !window.mapboxgl) return;
    const map = mapRef.current;
    // pickup
    if (pickup?.lat != null) {
      if (!pickupMarkerRef.current) pickupMarkerRef.current = new window.mapboxgl.Marker({ element: makePin('#22D3EE', '📍'), anchor: 'center' }).setLngLat([pickup.lng, pickup.lat]).addTo(map);
      else pickupMarkerRef.current.setLngLat([pickup.lng, pickup.lat]);
    } else if (pickupMarkerRef.current) { try { pickupMarkerRef.current.remove(); } catch {} pickupMarkerRef.current = null; }
    // dropoff
    if (dropoff?.lat != null) {
      if (!dropoffMarkerRef.current) dropoffMarkerRef.current = new window.mapboxgl.Marker({ element: makePin('#4ADE80', '🏁'), anchor: 'center' }).setLngLat([dropoff.lng, dropoff.lat]).addTo(map);
      else dropoffMarkerRef.current.setLngLat([dropoff.lng, dropoff.lat]);
    } else if (dropoffMarkerRef.current) { try { dropoffMarkerRef.current.remove(); } catch {} dropoffMarkerRef.current = null; }
  }, [ready, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng]);

  // ── route polyline + camera ──
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const h = elRef.current?.clientHeight || 600;
    const coords = decodePolyline(polyline);

    try {
      map.getSource(ROUTE_SRC)?.setData({
        type: 'FeatureCollection',
        features: coords.length >= 2 ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: coords } }] : [],
      });
    } catch {}

    try {
      if (pickup?.lat != null && dropoff?.lat != null) {
        const lngs = [pickup.lng, dropoff.lng], lats = [pickup.lat, dropoff.lat];
        map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]], {
          padding: { top: 70, bottom: Math.round(h * 0.55), left: 55, right: 55 }, duration: 1000, maxZoom: 15,
        });
      } else if (pickup?.lat != null) {
        map.easeTo({ center: [pickup.lng, pickup.lat], zoom: 14, padding: { bottom: Math.round(h * 0.5), top: 0, left: 0, right: 0 }, duration: 900 });
      } else {
        map.easeTo({ center: [base.lng, base.lat], zoom: 12.6, padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 900 });
      }
    } catch {}
  }, [ready, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, polyline]); // eslint-disable-line

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={elRef} style={{ position: 'absolute', inset: 0, opacity: ready ? 1 : 0, transition: 'opacity .8s ease' }} />

      {/* scrims so chrome + panel blend into the map */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(180deg, rgba(5,10,6,.55) 0%, transparent 18%, transparent 40%, rgba(5,10,6,.6) 78%, #050A06 100%)',
      }} />
    </div>
  );
}
