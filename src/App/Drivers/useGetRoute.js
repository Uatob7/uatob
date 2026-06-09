// hooks/useGetRoute.js

import { useState, useCallback } from "react";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

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
    }) => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          "https://routes.googleapis.com/directions/v2:computeRoutes",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": API_KEY,
              "X-Goog-FieldMask":
                "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
            },
            body: JSON.stringify({
              origin: {
                location: {
                  latLng: {
                    latitude: driverLat,
                    longitude: driverLng,
                  },
                },
              },
              destination: {
                location: {
                  latLng: {
                    latitude: pickupLat,
                    longitude: pickupLng,
                  },
                },
              },
              travelMode: "DRIVE",
              routingPreference: "TRAFFIC_AWARE",
              computeAlternativeRoutes: false,
            }),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error?.message || "Routes API request failed"
          );
        }

        const route = data?.routes?.[0];

        if (!route) {
          throw new Error("No route found");
        }

        const distanceMeters = route.distanceMeters;
        const durationSeconds =
          parseInt(String(route.duration ?? "0").replace("s", ""), 10) || 0;

        const routeData = {
          success: true,

          distanceMeters,
          distanceMiles: distanceMeters / 1609.34,

          etaSeconds: durationSeconds,
          etaMin: Math.ceil(durationSeconds / 60),

          distanceText: `${(distanceMeters / 1609.34).toFixed(1)} mi`,
          etaText: `${Math.ceil(durationSeconds / 60)} mins`,

          polyline: route.polyline?.encodedPolyline ?? null,
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