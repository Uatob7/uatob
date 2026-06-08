// src/App/UaTob/useRoute.js
import { useState, useEffect, useRef } from 'react';

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_SECRET_KEY;

const DEBOUNCE_MS = 600;

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

async function geocodeAddress(address) {
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}`
  );
  const data = await res.json();
  if (data.status !== 'OK' || !data.results?.length)
    return { city: '', zip: '', lat: null, lng: null };

  const components = data.results[0].address_components || [];
  let city = '', zip = '';
  for (const c of components) {
    if (!city && c.types.includes('locality'))                    city = c.long_name;
    if (!city && c.types.includes('administrative_area_level_2')) city = c.long_name;
    if (!zip  && c.types.includes('postal_code'))                 zip  = c.long_name;
  }
  return {
    city, zip,
    lat: data.results[0].geometry?.location?.lat ?? null,
    lng: data.results[0].geometry?.location?.lng ?? null,
  };
}

async function computeRoute(origin, destination, signal) {
  const [routeRes, [pickupGeo, dropoffGeo]] = await Promise.all([
    fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      signal,
      headers: {
        'Content-Type':     'application/json',
        'X-Goog-Api-Key':   API_KEY,
        'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify({
        origin:            { address: origin },
        destination:       { address: destination },
        travelMode:        'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
      }),
    }),
    Promise.all([
      geocodeAddress(origin),
      geocodeAddress(destination),
    ]),
  ]);

  if (!routeRes.ok) {
    const err = await routeRes.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Routes API ${routeRes.status}`);
  }

  const data   = await routeRes.json();
  const routes = data?.routes;
  if (!routes?.length) throw new Error('Route not found');

  const route          = routes[0];
  const distanceMeters = route.distanceMeters ?? 0;
  const miles          = Number((distanceMeters / 1609.34).toFixed(2));
  const seconds        = parseInt(route.duration?.replace('s', '') || '0', 10);
  const durationMin    = Math.ceil(seconds / 60);

  return {
    pickup:       origin,
    dropoff:      destination,
    miles,
    durationMin,
    durationText: formatDuration(durationMin),
    polyline:     route.polyline?.encodedPolyline ?? null,
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