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

import { useEffect, useRef, useState, useCallback } from 'react';
import { MAPBOX_TOKEN, MAP_STYLE, ORL, loadMapbox, decodePolyline } from '@/App/UaTob/mapUtils';

const ROUTE_SRC = 'rm-route';

// A small glowing dot representing a moving driver.
function makeDot() {
  const el = document.createElement('div');
  el.style.cssText = 'width:11px;height:11px;border-radius:50%;background:#2FE08A;border:1.5px solid rgba(5,10,6,.9);box-shadow:0 0 8px rgba(74,222,128,.9),0 0 0 4px rgba(74,222,128,.16);opacity:0;will-change:transform,opacity';
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

export default function RiderMap({ center, drivers = [], pickup, dropoff, stops = [], polyline, bottomInset = 0 }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const driverMarkersRef = useRef([]);
  const pickupMarkerRef = useRef(null);
  const dropoffMarkerRef = useRef(null);
  const stopMarkersRef = useRef([]);
  const ambientRef = useRef([]);   // [{ car, marker }]
  const rafRef = useRef(null);
  const centerRef = useRef(null);
  const viewRef = useRef(null);    // current camera target
  const insetRef = useRef(0);      // px covered by the composer sheet at the bottom
  insetRef.current = bottomInset;
  const [ready, setReady] = useState(false);

  const base = pickup || (center?.lat != null ? center : ORL);
  centerRef.current = base;

  // Stable list + key for the (variable-length) stops so effects re-run only
  // when the actual stop coordinates change.
  const stopPts = (Array.isArray(stops) ? stops : []).filter((s) => s?.lat != null && s?.lng != null);
  const stopsKey = JSON.stringify(stopPts.map((s) => [s.lng, s.lat]));

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
          paint: { 'line-color': '#2FE08A', 'line-width': 9, 'line-opacity': 0.18, 'line-blur': 3 },
        });
        map.addLayer({
          id: `${ROUTE_SRC}-line`, type: 'line', source: ROUTE_SRC,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#2FE08A', 'line-width': 3.5, 'line-opacity': 0.95 },
        });
        mapRef.current = map;
        setReady(true);
      });
    }).catch(() => {});
    return () => {
      cancelled = true;
      driverMarkersRef.current.forEach((m) => { try { m.remove(); } catch {} });
      driverMarkersRef.current = [];
      stopMarkersRef.current.forEach((m) => { try { m.remove(); } catch {} });
      stopMarkersRef.current = [];
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
      if (!pickupMarkerRef.current) pickupMarkerRef.current = new window.mapboxgl.Marker({ element: makePin('#3FD0EE', '📍'), anchor: 'center' }).setLngLat([pickup.lng, pickup.lat]).addTo(map);
      else pickupMarkerRef.current.setLngLat([pickup.lng, pickup.lat]);
    } else if (pickupMarkerRef.current) { try { pickupMarkerRef.current.remove(); } catch {} pickupMarkerRef.current = null; }
    // dropoff
    if (dropoff?.lat != null) {
      if (!dropoffMarkerRef.current) dropoffMarkerRef.current = new window.mapboxgl.Marker({ element: makePin('#2FE08A', '🏁'), anchor: 'center' }).setLngLat([dropoff.lng, dropoff.lat]).addTo(map);
      else dropoffMarkerRef.current.setLngLat([dropoff.lng, dropoff.lat]);
    } else if (dropoffMarkerRef.current) { try { dropoffMarkerRef.current.remove(); } catch {} dropoffMarkerRef.current = null; }
    // intermediate stops — numbered pins
    stopMarkersRef.current.forEach((m) => { try { m.remove(); } catch {} });
    stopMarkersRef.current = [];
    stopPts.forEach((s, i) => {
      stopMarkersRef.current.push(
        new window.mapboxgl.Marker({ element: makePin('#FBBF24', String(i + 1)), anchor: 'center' }).setLngLat([s.lng, s.lat]).addTo(map)
      );
    });
  }, [ready, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, stopsKey]); // eslint-disable-line

  // Single source of truth for the camera. Reads viewRef (latest target) and
  // always resizes first so it centers correctly even mid-layout.
  const applyView = useCallback((animated) => {
    const map = mapRef.current;
    const v = viewRef.current;
    if (!map || !v) return;
    const h = elRef.current?.clientHeight || 600;
    const duration = animated ? 1000 : 0;
    try {
      // How much of the map the composer sheet actually covers at the bottom.
      // Measured (insetRef) beats guessing — the route then always frames in the
      // strip of map left visible above the sheet, fully zoomed out like the
      // driver app. +20 keeps it off the sheet's rounded lip.
      const inset = insetRef.current > 0 ? Math.min(insetRef.current + 20, h - 120) : Math.round(h * 0.5);
      if (v.type === 'bounds') {
        map.fitBounds([[v.minLng, v.minLat], [v.maxLng, v.maxLat]], {
          padding: { top: 60, bottom: inset, left: 46, right: 46 }, duration, maxZoom: 15,
        });
      } else if (v.type === 'pickup') {
        map.easeTo({ center: [v.lng, v.lat], zoom: 14, padding: { top: 0, bottom: inset, left: 0, right: 0 }, duration });
      } else {
        map.easeTo({ center: [v.lng, v.lat], zoom: 12.6, padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration });
      }
    } catch {}
  }, []);

  // ── route polyline + camera target ──
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const map = mapRef.current;
    const coords = decodePolyline(polyline);

    try {
      map.getSource(ROUTE_SRC)?.setData({
        type: 'FeatureCollection',
        features: coords.length >= 2 ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: coords } }] : [],
      });
    } catch {}

    if (pickup?.lat != null && dropoff?.lat != null) {
      // Fit the FULL route (every bend) AND every stop, not just the two
      // endpoints — so a multi-stop trip is always framed in one view.
      const pts = coords.length >= 2 ? coords.slice() : [];
      pts.push([pickup.lng, pickup.lat], [dropoff.lng, dropoff.lat]);
      stopPts.forEach((s) => pts.push([s.lng, s.lat]));
      const lngs = pts.map((p) => p[0]);
      const lats = pts.map((p) => p[1]);
      viewRef.current = { type: 'bounds', minLng: Math.min(...lngs), minLat: Math.min(...lats), maxLng: Math.max(...lngs), maxLat: Math.max(...lats) };
    } else if (pickup?.lat != null) {
      viewRef.current = { type: 'pickup', lng: pickup.lng, lat: pickup.lat };
    } else {
      viewRef.current = { type: 'base', lng: base.lng, lat: base.lat };
    }

    try { map.resize(); } catch {}
    applyView(true);
  }, [ready, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, stopsKey, polyline, center?.lat, center?.lng, applyView]); // eslint-disable-line

  // Re-frame when the composer sheet grows/shrinks (step changes) so the route
  // always fills the newly-available map area.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    try { mapRef.current.resize(); } catch {}
    applyView(true);
  }, [ready, bottomInset, applyView]);

  // ── keep the view centered across ANY container-size change ──
  useEffect(() => {
    if (!ready || !elRef.current || typeof ResizeObserver === 'undefined') return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (!mapRef.current) return;
        try { mapRef.current.resize(); } catch {}
        applyView(false);   // snap back to centered
      });
    });
    ro.observe(elRef.current);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [ready, applyView]);

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
