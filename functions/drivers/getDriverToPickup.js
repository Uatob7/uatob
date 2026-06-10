const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const axios = require("axios");

const GOOGLE_MAPS_KEY = defineSecret("GOOGLE_MAPS_KEY");

exports.getDriverToPickup = onCall(
  {
    region: "us-central1",
    secrets: [GOOGLE_MAPS_KEY],
  },
  async (request) => {
    try {
      const { driverLat, driverLng, pickupLat, pickupLng } = request.data ?? {};

      if (
        driverLat == null ||
        driverLng == null ||
        pickupLat == null ||
        pickupLng == null
      ) {
        throw new HttpsError(
          "invalid-argument",
          "driverLat, driverLng, pickupLat, pickupLng are required"
        );
      }

      const response = await axios.post(
        "https://routes.googleapis.com/directions/v2:computeRoutes",
        {
          origin: {
            location: {
              latLng: { latitude: driverLat, longitude: driverLng },
            },
          },
          destination: {
            location: {
              latLng: { latitude: pickupLat, longitude: pickupLng },
            },
          },
          travelMode:               "DRIVE",
          routingPreference:        "TRAFFIC_AWARE",
          computeAlternativeRoutes: false,
        },
        {
          headers: {
            "Content-Type":      "application/json",
            "X-Goog-Api-Key":    GOOGLE_MAPS_KEY.value(),
            "X-Goog-FieldMask":  "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
          },
          timeout: 8000,
        }
      );

      const route = response.data?.routes?.[0];

      if (!route) {
        throw new HttpsError("not-found", "No route found");
      }

      const distanceMeters  = route.distanceMeters;
      const durationSeconds = parseInt(String(route.duration ?? "0").replace("s", ""), 10) || 0;
      const polyline        = route.polyline?.encodedPolyline ?? null;

      return {
        success:       true,

        distanceMeters,
        distanceMiles: distanceMeters / 1609.34,

        etaSeconds:    durationSeconds,
        etaMin:        Math.ceil(durationSeconds / 60),

        distanceText:  `${(distanceMeters / 1609.34).toFixed(1)} mi`,
        etaText:       `${Math.ceil(durationSeconds / 60)} mins`,

        polyline,
      };
    } catch (err) {
      console.error("[getDriverToPickup] Routes API error:", err?.response?.data || err.message);

      if (err instanceof HttpsError) throw err;

      throw new HttpsError(
        "internal",
        err?.response?.data?.error?.message || err.message || "Routes API failed"
      );
    }
  }
);