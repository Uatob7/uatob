import { useState, useRef, useCallback } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebase_app } from '@/firebase/config';

const functions        = getFunctions(firebase_app, 'us-east1');
const callAutocomplete = httpsCallable(functions, 'Autocomplete');

/**
 * useAutocomplete
 *
 * Provides debounced place predictions for a text input.
 *
 * Usage:
 *   const { predictions, loading, error, fetch, clear } = useAutocomplete();
 *   ...
 *   <input onChange={e => fetch(e.target.value)} />
 */
export function useAutocomplete(debounceMs = 250) {
  const [predictions, setPredictions] = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const debounceRef   = useRef(null);
  const requestSeqRef = useRef(0);

  const fetch = useCallback((input) => {
    clearTimeout(debounceRef.current);
    const val = input?.trim() ?? '';

    if (val.length < 2) {
      setPredictions([]); setError(''); setLoading(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const seq = ++requestSeqRef.current;
      setLoading(true); setError('');
      try {
        const { data } = await callAutocomplete({ input: val });
        if (requestSeqRef.current !== seq) return;
        setPredictions(data.predictions ?? []);
      } catch (err) {
        if (requestSeqRef.current !== seq) return;
        setError(err.message || 'Autocomplete failed');
        setPredictions([]);
      } finally {
        if (requestSeqRef.current === seq) setLoading(false);
      }
    }, debounceMs);
  }, [debounceMs]);

  const clear = useCallback(() => {
    clearTimeout(debounceRef.current);
    setPredictions([]); setError(''); setLoading(false);
  }, []);

  return { predictions, loading, error, fetch, clear };
}
