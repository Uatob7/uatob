import { useState, useCallback } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebase_app } from '@/firebase/config';

const functions = getFunctions(firebase_app, 'us-east1');
const callGeo   = httpsCallable(functions, 'Geo');

/**
 * useGeo
 *
 * Two-step hook:
 *   1. resolve()  — asks the browser for GPS coords, then reverse-geocodes via Geo function
 *   2. Returns the address string on success
 *
 * States:
 *   loading  — true while GPS or reverse-geocode is in flight
 *   error    — human-readable string on any failure
 *   clear()  — resets error state
 *
 * Usage:
 *   const { resolve, loading, error, clear } = useGeo();
 *   const address = await resolve();   // returns string or throws
 */
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

      // Step 2 — reverse geocode via Cloud Function
      const { data } = await callGeo({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });

      if (!data.address) throw new Error('Could not find your address.');
      return data.address;

    } catch (err) {
      let msg;
      if (err.code === 1)      msg = 'Location access was denied. Please allow it in browser settings.';
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
