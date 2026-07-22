// src/App/UaTob/useGeo.js
import { useState, useCallback } from 'react';

const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  'pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA';

export function useGeo() {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const clear = useCallback(() => setError(''), []);

  const resolve = useCallback(async () => {
    setLoading(true); setError('');

    try {
      // Step 1 — browser GPS
      const position = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, {
          enableHighAccuracy: true,
          timeout:            10_000,
          maximumAge:         0,
        })
      );

      const { latitude: lat, longitude: lng } = position.coords;

      // Step 2 — reverse geocode via Mapbox Geocoding API
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json` +
        `?access_token=${MAPBOX_TOKEN}&types=address&limit=1`
      );

      if (!res.ok) throw new Error(`Geocoding API ${res.status}`);

      const data    = await res.json();
      const address = data.features?.[0]?.place_name;
      if (!address) throw new Error('No address found for your location.');

      return address;

    } catch (err) {
      let msg;
      if      (err.code === 1) msg = 'Location access was denied. Please allow it in browser settings.';
      else if (err.code === 2) msg = 'Could not detect your location. Try again or enter manually.';
      else if (err.code === 3) msg = 'Location request timed out. Please try again.';
      else                     msg = err.message || 'Could not get your location.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  return { resolve, loading, error, clear };
}