// src/App/UaTob/useAutocomplete.js
import { useState, useRef, useCallback } from 'react';

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_SECRET_KEY;

export function useAutocomplete(debounceMs = 250) {
  const [predictions, setPredictions] = useState([]);
  const timerRef    = useRef(null);
  const controllerRef = useRef(null);

  const fetch = useCallback((input) => {
    clearTimeout(timerRef.current);

    if (!input || input.trim().length < 3) {
      setPredictions([]);
      return;
    }

    timerRef.current = setTimeout(async () => {
      // Cancel any in-flight request
      controllerRef.current?.abort();
      controllerRef.current = new AbortController();

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
              input: input.trim(),
              includedRegionCodes: ['us'],
            }),
          }
        );

        if (!res.ok) throw new Error(`Places API ${res.status}`);

        const data = await res.json();
        const suggestions = data?.suggestions ?? [];

        const mapped = suggestions.map((s) => ({
          description: s?.placePrediction?.text?.text || '',
          place_id:    s?.placePrediction?.placeId    || '',
          structured_formatting: {
            main_text:      s?.placePrediction?.structuredFormat?.mainText?.text      || '',
            secondary_text: s?.placePrediction?.structuredFormat?.secondaryText?.text || '',
          },
        }));

        setPredictions(mapped);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Autocomplete error:', err);
          setPredictions([]);
        }
      }
    }, debounceMs);
  }, [debounceMs]);

  const clear = useCallback(() => {
    clearTimeout(timerRef.current);
    controllerRef.current?.abort();
    setPredictions([]);
  }, []);

  return { predictions, fetch, clear };
}