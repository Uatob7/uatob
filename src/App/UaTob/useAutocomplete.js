// src/App/UaTob/useAutocomplete.js
import { useState, useRef, useCallback } from 'react';

const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  'pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA';

const GEOCODE_TYPES = 'address,place,locality,neighborhood,poi,postcode';

// Split a Mapbox `place_name` into main + secondary text for the dropdown.
function splitPlaceName(feature) {
  const parts = (feature.place_name || '').split(',').map((s) => s.trim());
  const main  = feature.text || parts[0] || '';
  const rest  = parts[0] === main ? parts.slice(1) : parts.filter((p) => p !== main);
  return { main, secondary: rest.join(', ') };
}

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
        const url =
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(val)}.json` +
          `?access_token=${MAPBOX_TOKEN}` +
          `&autocomplete=true&country=us&limit=6&types=${GEOCODE_TYPES}`;

        const res = await window.fetch(url, { signal: controllerRef.current.signal });

        if (!res.ok) throw new Error(`Mapbox Geocoding ${res.status}`);
        if (requestSeqRef.current !== seq) return;

        const data     = await res.json();
        const features = data?.features ?? [];

        setPredictions(
          features.map((f) => {
            const { main, secondary } = splitPlaceName(f);
            return {
              description: f.place_name || main,
              place_id:    f.id || f.place_name || main,
              center:      Array.isArray(f.center) ? f.center : null, // [lng, lat]
              structured_formatting: {
                main_text:      main,
                secondary_text: secondary,
              },
            };
          })
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
