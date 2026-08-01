import { useCallback, useState } from 'react';

// Driver → pickup routing via Mapbox Directions (moved off Google Maps).
const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  'pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA';

export function useGetDriverToPickup() {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const call = useCallback(async ({ driverLat, driverLng, pickupLat, pickupLng }) => {
    setLoading(true); setError(null);
    try {
      const url =
        `https://api.mapbox.com/directions/v5/mapbox/driving/` +
        `${driverLng},${driverLat};${pickupLng},${pickupLat}` +
        `?access_token=${MAPBOX_TOKEN}&geometries=polyline&overview=full`;

      const res  = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Directions request failed');

      const route = json?.routes?.[0];
      if (!route) throw new Error('No route found');

      const distanceMeters  = route.distance;
      const durationSeconds = Math.round(route.duration || 0);

      return {
        success:       true,
        distanceMeters,
        distanceMiles: distanceMeters / 1609.34,
        etaSeconds:    durationSeconds,
        etaMin:        Math.ceil(durationSeconds / 60),
        distanceText:  `${(distanceMeters / 1609.34).toFixed(1)} mi`,
        etaText:       `${Math.ceil(durationSeconds / 60)} mins`,
        polyline:      route.geometry ?? null,
      };
    } catch (err) {
      setError(err?.message || 'getDriverToPickup failed');
      throw err;
    } finally { setLoading(false); }
  }, []);

  return { call, loading, error };
}
