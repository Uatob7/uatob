// src/App/UaTob/useAutocomplete.js
import { useState, useRef, useCallback } from 'react';

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export function useAutocomplete(debounceMs = 250) {
  const [predictions, setPredictions] = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  const debounceRef   = useRef(null);
  const requestSeqRef = useRef(0);
  const controllerRef = useRef(null);

  const fetch = useCallback((input) => {
    clearTimeout(debounceRef.current);
    const val = input?.trim() ?? '';

    if (val.length < 2) {
      setPredictions([]); setError(''); setLoading(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const seq = ++requestSeqRef.current;
      controllerRef.current?.abort();
      controllerRef.current = new AbortController();

      setLoading(true); setError('');

      try {
        const res = await window.fetch(
          'https://places.googleapis.com/v1/places:autocomplete',
          {
            method: 'POST',
            signal: controllerRef.current.signal,
            headers: {
              'Content-Type':     'application/json',
              'X-Goog-Api-Key':   API_KEY,
              'X-Goog-FieldMask': 'suggestions.placePrediction.text,suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat',
            },
            body: JSON.stringify({
              input: val,
              includedRegionCodes: ['us'],
            }),
          }
        );

        if (!res.ok) throw new Error(`Places API ${res.status}`);
        if (requestSeqRef.current !== seq) return;

        const data        = await res.json();
        const suggestions = data?.suggestions ?? [];

        setPredictions(
          suggestions.map((s) => ({
            description: s?.placePrediction?.text?.text || '',
            place_id:    s?.placePrediction?.placeId    || '',
            structured_formatting: {
              main_text:      s?.placePrediction?.structuredFormat?.mainText?.text      || '',
              secondary_text: s?.placePrediction?.structuredFormat?.secondaryText?.text || '',
            },
          }))
        );
      } catch (err) {
        if (err.name === 'AbortError')            return;
        if (requestSeqRef.current !== seq)        return;
        setError(err.message || 'Autocomplete failed');
        setPredictions([]);
      } finally {
        if (requestSeqRef.current === seq) setLoading(false);
      }
    }, debounceMs);
  }, [debounceMs]);

  const clear = useCallback(() => {
    clearTimeout(debounceRef.current);
    controllerRef.current?.abort();
    setPredictions([]); setError(''); setLoading(false);
  }, []);

  return { predictions, loading, error, fetch, clear };
}