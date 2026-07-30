// mapUtils.js — shared Mapbox helpers for the rider map surfaces.

export const MAPBOX_TOKEN = 'pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA';
export const MAP_STYLE = 'mapbox://styles/mapbox/dark-v11';
export const ORL = { lng: -81.3792, lat: 28.5383 };

let mapboxPromise = null;
export function loadMapbox() {
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
export function decodePolyline(str, precision = 5) {
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
