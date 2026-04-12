const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const axios = require("axios");
const cors = require("cors")({ origin: true });

const GOOGLE_MAPS_KEY = defineSecret("GOOGLE_MAPS_KEY");

exports.getDriverToPickup = onRequest(
  {
    region: "us-central1",
    invoker: "public",
    secrets: [GOOGLE_MAPS_KEY],
  },
  async (req, res) => {
    cors(req, res, async () => {
      try {
        if (req.method === "OPTIONS") return res.status(204).send("");
        if (req.method !== "POST") {
          return res.status(405).json({ error: "Method Not Allowed" });
        }

        const { driverLat, driverLng, pickupLat, pickupLng } = req.body ?? {};

        if (
          driverLat == null ||
          driverLng == null ||
          pickupLat == null ||
          pickupLng == null
        ) {
          return res.status(400).json({
            error: "driverLat, driverLng, pickupLat, pickupLng are required",
          });
        }

        const response = await axios.post(
          "https://routes.googleapis.com/directions/v2:computeRoutes",
          {
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
          },
          {
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": GOOGLE_MAPS_KEY.value(),
              "X-Goog-FieldMask":
                "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
            },
            timeout: 8000,
          }
        );

        const route = response.data?.routes?.[0];

        if (!route) {
          return res.status(404).json({ error: "No route found" });
        }

        const distanceMeters  = route.distanceMeters;
        const durationSeconds = parseInt(route.duration?.replace("s", "")) || 0;
        const polyline        = route.polyline?.encodedPolyline ?? null;

        return res.status(200).json({
          distanceMeters,
          distanceMiles: distanceMeters / 1609.34,

          etaSeconds: durationSeconds,
          etaMin:     Math.ceil(durationSeconds / 60),

          distanceText: `${(distanceMeters / 1609.34).toFixed(1)} mi`,
          etaText:      `${Math.ceil(durationSeconds / 60)} mins`,

          polyline,
        });
      } catch (err) {
        console.error("Routes API error:", err?.response?.data || err.message);

        return res.status(500).json({
          error:
            err?.response?.data?.error?.message ||
            err.message ||
            "Routes API failed",
        });
      }
    });
  }
);