// src/App/UaTob/useGeocode.js
//
// Debounced forward-geocode of a SINGLE address → { lat, lng }. Used to center
// the map on the pickup the moment it's entered, before a destination exists
// (useRoute only resolves coordinates once both endpoints are set).

import { useState, useEffect, useRef } from 'react';

const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  'pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA';

export function useGeocode(address, debounceMs = 500) {
  const [point, setPoint] = useState(null);   // { lat, lng } | null
  const abortRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const a = address?.trim();
    clearTimeout(timerRef.current);
    abortRef.current?.abort();

    if (!a || a.length < 3) { setPoint(null); return; }

    timerRef.current = setTimeout(async () => {
      abortRef.current = new AbortController();
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(a)}.json` +
          `?access_token=${MAPBOX_TOKEN}&country=us&limit=1`,
          { signal: abortRef.current.signal },
        );
        const data = await res.json();
        const c = data?.features?.[0]?.center;
        if (Array.isArray(c)) setPoint({ lng: c[0], lat: c[1] });
      } catch { /* aborted or offline — leave last point */ }
    }, debounceMs);

    return () => { clearTimeout(timerRef.current); abortRef.current?.abort(); };
  }, [address, debounceMs]);

  return point;
}
