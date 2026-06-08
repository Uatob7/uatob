// src/App/UaTob/useGeo.js
import { useState, useCallback } from 'react';

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_SECRET_KEY;

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

      // Step 2 — reverse geocode via Google Geocoding API directly
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${API_KEY}`
      );

      if (!res.ok) throw new Error(`Geocoding API ${res.status}`);

      const data = await res.json();

      if (data.status === 'ZERO_RESULTS') throw new Error('No address found for your location.');
      if (data.status !== 'OK')           throw new Error(data.error_message || `Geocoding failed: ${data.status}`);

      const address = data.results?.[0]?.formatted_address;
      if (!address) throw new Error('Could not find your address.');

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