import { useState, useRef, useCallback, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebase_app } from '@/firebase/config';

const functions   = getFunctions(firebase_app, 'us-east1');
const callPrice   = httpsCallable(functions, 'Price');

/**
 * useQuotes
 *
 * Fetches fare quotes from the Price Cloud Function whenever tripData changes.
 * Skips the call if tripData is null.
 *
 * Returns:
 *   quotesData  — { rides: { standard, premium, xl }, driverInfo } | null
 *   loading     — true while fetching
 *   error       — string if fetch failed
 *   reset       — clears all state
 */
export function useQuotes(tripData) {
  const [quotesData, setQuotesData] = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  const requestSeqRef  = useRef(0);
  const lastTripKeyRef = useRef('');

  const reset = useCallback(() => {
    setQuotesData(null); setLoading(false); setError('');
    lastTripKeyRef.current = '';
  }, []);

  useEffect(() => {
    if (!tripData) { reset(); return; }

    // Use pickup+dropoff as a cache key — skip if already fetched for same trip
    const key = `${tripData.pickup}||${tripData.dropoff}`;
    if (lastTripKeyRef.current === key && quotesData) return;

    const seq = ++requestSeqRef.current;

    async function load() {
      setLoading(true); setError(''); setQuotesData(null);
      try {
        const { data } = await callPrice(tripData);
        if (requestSeqRef.current !== seq) return;

        if (!data.ok) throw new Error(data.error || 'Pricing error');

        // Normalise totals to 2dp strings
        if (data.rides) {
          Object.values(data.rides).forEach(r => {
            r.total = Number(r.total).toFixed(2);
          });
        }

        lastTripKeyRef.current = key;
        setQuotesData(data);
      } catch (err) {
        if (requestSeqRef.current !== seq) return;
        setError(err.message || 'Failed to calculate prices');
        setQuotesData(null);
        lastTripKeyRef.current = '';
      } finally {
        if (requestSeqRef.current === seq) setLoading(false);
      }
    }

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripData]);

  return { quotesData, loading, error, reset };
}
