import { useCallback, useState } from 'react';

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export function useGetDriverToPickup() {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const call = useCallback(async ({ driverLat, driverLng, pickupLat, pickupLng }) => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
        method: 'POST',
        headers: {
          'Content-Type':     'application/json',
          'X-Goog-Api-Key':   API_KEY,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
        },
        body: JSON.stringify({
          origin:      { location: { latLng: { latitude: driverLat, longitude: driverLng } } },
          destination: { location: { latLng: { latitude: pickupLat,  longitude: pickupLng  } } },
          travelMode:               'DRIVE',
          routingPreference:        'TRAFFIC_AWARE',
          computeAlternativeRoutes: false,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Routes API request failed');

      const route = json?.routes?.[0];
      if (!route) throw new Error('No route found');

      const distanceMeters  = route.distanceMeters;
      const durationSeconds = parseInt(String(route.duration ?? '0').replace('s', ''), 10) || 0;

      return {
        success:       true,
        distanceMeters,
        distanceMiles: distanceMeters / 1609.34,
        etaSeconds:    durationSeconds,
        etaMin:        Math.ceil(durationSeconds / 60),
        distanceText:  `${(distanceMeters / 1609.34).toFixed(1)} mi`,
        etaText:       `${Math.ceil(durationSeconds / 60)} mins`,
        polyline:      route.polyline?.encodedPolyline ?? null,
      };
    } catch (err) {
      setError(err?.message || 'getDriverToPickup failed');
      throw err;
    } finally { setLoading(false); }
  }, []);

  return { call, loading, error };
}
