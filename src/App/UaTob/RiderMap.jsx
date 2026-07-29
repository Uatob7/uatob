// RiderMap.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Live dark Mapbox backdrop for the map-first Request screen. Centers on the
// rider, drops nearby drivers as car pins, and fades into the composer panel.
// Self-contained: loads mapbox-gl from CDN once (matches UaTobApp) and is safe
// to mount/unmount as the rider switches tabs.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';

const MAPBOX_TOKEN = 'pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA';
const MAP_STYLE = 'mapbox://styles/mapbox/dark-v11';
const ORL = { lng: -81.3792, lat: 28.5383 };

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

export default function RiderMap({ center, drivers = [] }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [ready, setReady] = useState(false);

  const lat = center?.lat ?? ORL.lat;
  const lng = center?.lng ?? ORL.lng;

  // ── init once ──
  useEffect(() => {
    let cancelled = false;
    loadMapbox().then((mapboxgl) => {
      if (cancelled || !elRef.current || mapRef.current) return;
      mapboxgl.accessToken = MAPBOX_TOKEN;
      const map = new mapboxgl.Map({
        container: elRef.current,
        style: MAP_STYLE,
        center: [lng, lat],
        zoom: 12.6,
        pitch: 42,
        bearing: -17,
        interactive: false,
        attributionControl: false,
        antialias: true,
      });
      map.on('load', () => { if (!cancelled) { mapRef.current = map; setReady(true); } });
    }).catch(() => {});
    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => { try { m.remove(); } catch {} });
      markersRef.current = [];
      if (mapRef.current) { try { mapRef.current.remove(); } catch {} mapRef.current = null; }
    };
  }, []); // eslint-disable-line

  // ── recenter ──
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    try { mapRef.current.easeTo({ center: [lng, lat], duration: 900 }); } catch {}
  }, [lat, lng, ready]);

  // ── markers (rider + nearby drivers) ──
  useEffect(() => {
    if (!ready || !mapRef.current || !window.mapboxgl) return;
    const map = mapRef.current;
    markersRef.current.forEach((m) => { try { m.remove(); } catch {} });
    markersRef.current = [];

    // rider
    const you = document.createElement('div');
    you.style.cssText = 'width:15px;height:15px;border-radius:50%;background:#4ADE80;border:3px solid #04150a;box-shadow:0 0 0 5px rgba(74,222,128,.22),0 0 14px rgba(74,222,128,.8)';
    markersRef.current.push(new window.mapboxgl.Marker({ element: you }).setLngLat([lng, lat]).addTo(map));

    // drivers
    drivers
      .filter((d) => typeof d.lat === 'number' && typeof d.lng === 'number')
      .slice(0, 40)
      .forEach((d) => {
        const el = document.createElement('div');
        el.style.cssText = 'width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:17px;filter:drop-shadow(0 2px 5px rgba(0,0,0,.7))';
        el.textContent = '🚗';
        markersRef.current.push(new window.mapboxgl.Marker({ element: el }).setLngLat([d.lng, d.lat]).addTo(map));
      });
  }, [ready, drivers, lat, lng]);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={elRef} style={{ position: 'absolute', inset: 0, opacity: ready ? 1 : 0, transition: 'opacity .8s ease' }} />
      {/* top + bottom scrims so chrome/panel blend into the map */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(180deg, rgba(5,10,6,.55) 0%, transparent 18%, transparent 40%, rgba(5,10,6,.6) 78%, #050A06 100%)',
      }} />
    </div>
  );
}
