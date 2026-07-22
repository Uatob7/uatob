// src/App/UaTob/useRoute.js
import { useState, useEffect, useRef } from 'react';

const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  'pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA';

const DEBOUNCE_MS = 600;

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// Forward geocode an address via Mapbox → { city, zip, lat, lng }
async function geocodeAddress(address, signal) {
  const res = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json` +
    `?access_token=${MAPBOX_TOKEN}&country=us&limit=1`,
    { signal }
  );
  const data    = await res.json();
  const feature = data.features?.[0];
  if (!feature) return { city: '', zip: '', lat: null, lng: null };

  let city = '', zip = '';
  for (const c of feature.context || []) {
    const id = c.id || '';
    if (!city && (id.startsWith('place.') || id.startsWith('locality.'))) city = c.text;
    if (!zip  && id.startsWith('postcode.'))                              zip  = c.text;
  }
  // A postcode/place result itself may carry the value in `text`.
  if (!zip  && (feature.id || '').startsWith('postcode.')) zip  = feature.text;
  if (!city && (feature.id || '').startsWith('place.'))    city = feature.text;

  const [lng, lat] = Array.isArray(feature.center) ? feature.center : [null, null];
  return { city, zip, lat, lng };
}

async function computeRoute(origin, destination, signal) {
  // Mapbox Directions needs coordinates, so geocode both endpoints first.
  const [pickupGeo, dropoffGeo] = await Promise.all([
    geocodeAddress(origin, signal),
    geocodeAddress(destination, signal),
  ]);

  if (pickupGeo.lat == null || dropoffGeo.lat == null) {
    throw new Error('Could not locate one of the addresses.');
  }

  // `geometries=polyline` returns a precision-5 encoded polyline, which is
  // compatible with the existing Google-style decoder used on the maps.
  const routeRes = await fetch(
    `https://api.mapbox.com/directions/v5/mapbox/driving` +
    `/${pickupGeo.lng},${pickupGeo.lat};${dropoffGeo.lng},${dropoffGeo.lat}` +
    `?geometries=polyline&overview=full&access_token=${MAPBOX_TOKEN}`,
    { signal }
  );

  if (!routeRes.ok) {
    const err = await routeRes.json().catch(() => ({}));
    throw new Error(err?.message || `Directions API ${routeRes.status}`);
  }

  const data   = await routeRes.json();
  const route  = data?.routes?.[0];
  if (!route) throw new Error('Route not found');

  const miles       = Number((route.distance / 1609.34).toFixed(2));
  const durationMin  = Math.ceil((route.duration ?? 0) / 60);

  return {
    pickup:       origin,
    dropoff:      destination,
    miles,
    durationMin,
    durationText: formatDuration(durationMin),
    polyline:     typeof route.geometry === 'string' ? route.geometry : null,
    pickupCity:   pickupGeo.city,
    pickupZip:    pickupGeo.zip,
    pickupLat:    pickupGeo.lat,
    pickupLng:    pickupGeo.lng,
    dropoffCity:  dropoffGeo.city,
    dropoffZip:   dropoffGeo.zip,
    dropoffLat:   dropoffGeo.lat,
    dropoffLng:   dropoffGeo.lng,
  };
}

export function useRoute(pickup, dropoff) {
  const [tripData, setTripData] = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  const abortRef  = useRef(null);
  const timerRef  = useRef(null);
  const resetFlag = useRef(false);

  function reset() {
    resetFlag.current = true;
    clearTimeout(timerRef.current);
    abortRef.current?.abort();
    setTripData(null);
    setLoading(false);
    setError(null);
  }

  useEffect(() => {
    const p = pickup?.trim();
    const d = dropoff?.trim();

    // Clear results if either field is empty
    if (!p || !d) {
      clearTimeout(timerRef.current);
      abortRef.current?.abort();
      setTripData(null);
      setLoading(false);
      setError(null);
      return;
    }

    resetFlag.current = false;
    clearTimeout(timerRef.current);
    abortRef.current?.abort();

    timerRef.current = setTimeout(async () => {
      if (resetFlag.current) return;

      abortRef.current = new AbortController();
      setLoading(true);
      setError(null);
      setTripData(null);

      try {
        const result = await computeRoute(p, d, abortRef.current.signal);
        if (!resetFlag.current) {
          setTripData(result);
          setError(null);
        }
      } catch (err) {
        if (err.name === 'AbortError') return;
        if (!resetFlag.current) {
          setError(err.message || 'Route calculation failed');
          setTripData(null);
        }
      } finally {
        if (!resetFlag.current) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, [pickup, dropoff]);

  return { tripData, loading, error, reset };
}