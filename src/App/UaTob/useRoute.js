import { useState, useRef, useCallback, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebase_app } from '@/firebase/config';

const functions = getFunctions(firebase_app, 'us-east1');
const callATOB  = httpsCallable(functions, 'ATOB');

function round2(val) {
  const n = Number(val);
  return Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
}

function parseDurationMin(data) {
  if (data.duration_minutes) return data.duration_minutes;
  if (data.route?.duration_seconds) return Math.ceil(data.route.duration_seconds / 60);
  if (data.duration_text) {
    const h = (data.duration_text.match(/(\d+)\s*hour/) || [])[1] || 0;
    const m = (data.duration_text.match(/(\d+)\s*min/)  || [])[1] || 0;
    return Number(h) * 60 + Number(m);
  }
  return 0;
}

/**
 * useRoute
 *
 * Fetches route data (distance, duration, polyline, city/zip/lat/lng)
 * whenever pickup or dropoff changes. Debounced by 700 ms.
 *
 * Returns:
 *   tripData  — null until a successful fetch
 *   loading   — true while fetching
 *   error     — string if fetch failed
 *   reset     — clears all state
 */
export function useRoute(pickup, dropoff) {
  const [tripData, setTripData] = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const requestSeqRef   = useRef(0);
  const lastFetchedRef  = useRef('');

  const reset = useCallback(() => {
    setTripData(null); setLoading(false); setError('');
    lastFetchedRef.current = '';
  }, []);

  useEffect(() => {
    const p = pickup?.trim()  ?? '';
    const d = dropoff?.trim() ?? '';

    if (!p || !d) {
      reset(); return;
    }

    const key = `${p}||${d}`;
    // Skip if we already have fresh data for this exact pair
    if (lastFetchedRef.current === key && tripData) return;

    const seq = ++requestSeqRef.current;

    const timer = setTimeout(async () => {
      setLoading(true); setError(''); setTripData(null);
      try {
        const { data } = await callATOB({ origin: p, destination: d });
        if (requestSeqRef.current !== seq) return;

        const durationMin = Math.max(1, Number(parseDurationMin(data) || 0));
        lastFetchedRef.current = key;

        setTripData({
          pickup:      p,
          dropoff:     d,
          miles:       round2(data.distance_miles ?? 0),
          durationMin,
          durationText: data.duration_text || `${durationMin} min`,
          pickupCity:  data.pickup?.city  ?? '',
          pickupZip:   data.pickup?.zip   ?? '',
          pickupLat:   data.pickup?.lat   ?? null,
          pickupLng:   data.pickup?.lng   ?? null,
          dropoffCity: data.dropoff?.city ?? '',
          dropoffZip:  data.dropoff?.zip  ?? '',
          dropoffLat:  data.dropoff?.lat  ?? null,
          dropoffLng:  data.dropoff?.lng  ?? null,
          polyline:    data.route?.polyline ?? null,
        });
      } catch (err) {
        if (requestSeqRef.current !== seq) return;
        setError(err.message || 'Failed to calculate route');
        setTripData(null);
        lastFetchedRef.current = '';
      } finally {
        if (requestSeqRef.current === seq) setLoading(false);
      }
    }, 700);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup, dropoff]);

  return { tripData, loading, error, reset };
}
