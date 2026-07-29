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
  const [ready, setReady] = useState(false);

  const base = pickup || (center?.lat != null ? center : ORL);

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

  const showRadar = !pickup?.lat;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <style>{`
        @keyframes rmSweep { to { transform: translate(-50%,-50%) rotate(360deg) } }
        @keyframes rmPing  { 0%{transform:translate(-50%,-50%) scale(.4);opacity:.7} 100%{transform:translate(-50%,-50%) scale(2.6);opacity:0} }
      `}</style>

      <div ref={elRef} style={{ position: 'absolute', inset: 0, opacity: ready ? 1 : 0, transition: 'opacity .8s ease' }} />

      {/* Radar sweep — shown until a pickup is chosen */}
      {showRadar && ready && (
        <div style={{ position: 'absolute', left: '50%', top: '34%', width: 300, height: 300, pointerEvents: 'none' }}>
          {/* rings */}
          {[300, 210, 120].map((d, i) => (
            <div key={i} style={{ position: 'absolute', left: '50%', top: '50%', width: d, height: d, transform: 'translate(-50%,-50%)', borderRadius: '50%', border: '1px solid rgba(74,222,128,.14)' }} />
          ))}
          {/* ping */}
          <div style={{ position: 'absolute', left: '50%', top: '50%', width: 60, height: 60, borderRadius: '50%', border: '1.5px solid rgba(74,222,128,.5)', animation: 'rmPing 2.4s ease-out infinite' }} />
          {/* sweep wedge */}
          <div style={{
            position: 'absolute', left: '50%', top: '50%', width: 300, height: 300, borderRadius: '50%',
            transform: 'translate(-50%,-50%)', transformOrigin: '50% 50%',
            background: 'conic-gradient(from 0deg, rgba(74,222,128,.42), rgba(74,222,128,.06) 55deg, transparent 90deg)',
            WebkitMaskImage: 'radial-gradient(circle, #000 0%, #000 49%, transparent 50%)',
            maskImage: 'radial-gradient(circle, #000 0%, #000 49%, transparent 50%)',
            animation: 'rmSweep 3s linear infinite',
          }} />
          {/* center dot */}
          <div style={{ position: 'absolute', left: '50%', top: '50%', width: 12, height: 12, borderRadius: '50%', transform: 'translate(-50%,-50%)', background: '#4ADE80', boxShadow: '0 0 12px #4ADE80, 0 0 0 4px rgba(74,222,128,.2)' }} />
          {/* caption */}
          <div style={{ position: 'absolute', left: '50%', top: 'calc(50% + 88px)', transform: 'translateX(-50%)', whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 700, letterSpacing: '.14em', color: 'rgba(74,222,128,.7)', textTransform: 'uppercase' }}>
            Set your pickup
          </div>
        </div>
      )}

      {/* scrims so chrome + panel blend into the map */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(180deg, rgba(5,10,6,.55) 0%, transparent 18%, transparent 40%, rgba(5,10,6,.6) 78%, #050A06 100%)',
      }} />
    </div>
  );
}
