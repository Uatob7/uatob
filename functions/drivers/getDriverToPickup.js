const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const axios = require("axios");
const cors = require("cors")({ origin: true });

const GOOGLE_MAPS_KEY = defineSecret("GOOGLE_MAPS_KEY");

exports.getDriverToPickup = onRequest(
  {
    region: "us-central1",
    secrets: [GOOGLE_MAPS_KEY],
  },
  async (req, res) => {
    return cors(req, res, async () => {
      try {
        if (req.method === "OPTIONS") return res.status(204).send("");
        if (req.method !== "POST") {
          return res.status(405).json({ error: "Method Not Allowed" });
        }

        const { driverLat, driverLng, pickupLat, pickupLng } = req.body ?? {};

        if (driverLat == null || driverLng == null || pickupLat == null || pickupLng == null) {
          return res.status(400).json({ error: "driverLat, driverLng, pickupLat, pickupLng are required" });
        }

        const response = await axios.get(
          "https://maps.googleapis.com/maps/api/distancematrix/json",
          {
            params: {
              origins:      `${driverLat},${driverLng}`,
              destinations: `${pickupLat},${pickupLng}`,
              units:        "imperial",
              mode:         "driving",
              key:          GOOGLE_MAPS_KEY.value(),
            },
          }
        );

        const data = response.data;

        if (data.status !== "OK") {
          return res.status(502).json({ error: `Distance Matrix failed: ${data.status}` });
        }

        const element = data.rows[0]?.elements[0];

        if (!element || element.status !== "OK") {
          return res.status(404).json({ error: "Could not calculate route to pickup" });
        }

        return res.json({
          distanceText: element.distance.text,          // "2.3 mi"
          distanceMiles: element.distance.value / 1609.34, // raw miles
          etaText: element.duration.text,               // "7 mins"
          etaMin: Math.ceil(element.duration.value / 60), // raw minutes
        });

      } catch (err) {
        const status = err?.response?.status ?? 500;
        const message = err?.response?.data?.error?.message ?? err.message ?? "Distance Matrix failed";
        console.error("getDriverToPickup error:", err?.response?.data || err.message);
        return res.status(status).json({ error: message });
      }
    });
  }
);