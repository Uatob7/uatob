// hooks/useGetRoute.js
//
// Driver → pickup routing via Mapbox Directions (we moved off Google Maps).
// Returns the same shape as before so callers (TripRequestModal, etc.) are
// unchanged. Mapbox `geometries=polyline` returns a precision-5 encoded
// polyline — identical format to Google's encodedPolyline — so existing
// decodePolyline consumers keep working.

import { useState, useCallback } from "react";

const MAPBOX_TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
  "pk.eyJ1IjoidWF0b2IiLCJhIjoiY21vZnZ5endwMHRoazJ4b2NienNudjcxYiJ9.2Glj-y3ICejbdQwjw6eWeA";

export function useGetRoute() {
  const [route, setRoute] = useState(null);
  const [distance, setDistance] = useState(null);
  const [duration, setDuration] = useState(null);
  const [polyline, setPolyline] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const clear = useCallback(() => {
    setError("");
  }, []);

  const getRoute = useCallback(
    async ({
      driverLat,
      driverLng,
      pickupLat,
      pickupLng,
      waypoints = [],   // optional ordered [{lat,lng}] to route through before the target
    }) => {
      setLoading(true);
      setError("");

      try {
        // driver → (each waypoint, in order) → target
        const chain = [
          `${driverLng},${driverLat}`,
          ...(Array.isArray(waypoints) ? waypoints : [])
            .filter((w) => typeof w?.lat === "number" && typeof w?.lng === "number")
            .map((w) => `${w.lng},${w.lat}`),
          `${pickupLng},${pickupLat}`,
        ].join(";");

        const url =
          `https://api.mapbox.com/directions/v5/mapbox/driving/` +
          `${chain}` +
          `?access_token=${MAPBOX_TOKEN}&geometries=polyline&overview=full`;

        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.message || "Directions request failed");
        }

        const route = data?.routes?.[0];

        if (!route) {
          throw new Error("No route found");
        }

        const distanceMeters  = route.distance;          // meters
        const durationSeconds = Math.round(route.duration || 0);  // seconds

        const routeData = {
          success: true,

          distanceMeters,
          distanceMiles: distanceMeters / 1609.34,

          etaSeconds: durationSeconds,
          etaMin: Math.ceil(durationSeconds / 60),

          distanceText: `${(distanceMeters / 1609.34).toFixed(1)} mi`,
          etaText: `${Math.ceil(durationSeconds / 60)} mins`,

          polyline: route.geometry ?? null,
        };

        setRoute(routeData);
        setDistance(routeData.distanceText);
        setDuration(routeData.etaText);
        setPolyline(routeData.polyline);

        return routeData;
      } catch (err) {
        console.error("[useGetRoute]", err);

        const msg =
          err?.message || "Failed to calculate route";

        setError(msg);
        throw new Error(msg);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    route,
    distance,
    duration,
    polyline,
    loading,
    error,
    clear,
    getRoute,
  };
}