const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const axios = require("axios");
const cors = require("cors")({ origin: true });

const GOOGLE_MAPS_KEY = defineSecret("GOOGLE_MAPS_KEY");

exports.Geo = onRequest(
  {
    region: "us-central1",
    secrets: [GOOGLE_MAPS_KEY],
    invoker: "public",
  },
  (req, res) => {
    cors(req, res, async () => {
      try {
        // ✅ Preflight
        if (req.method === "OPTIONS") {
          return res.status(204).send("");
        }

        if (req.method !== "POST") {
          return res.status(405).json({ error: "Method Not Allowed" });
        }

        const { lat, lng } = req.body || {};

        const numLat = Number(lat);
        const numLng = Number(lng);

        // ✅ validation
        if (!Number.isFinite(numLat) || !Number.isFinite(numLng)) {
          return res.status(400).json({
            error: "lat and lng must be valid numbers",
          });
        }

        if (
          numLat < -90 ||
          numLat > 90 ||
          numLng < -180 ||
          numLng > 180
        ) {
          return res.status(400).json({
            error: "lat/lng out of range",
          });
        }

        const apiKey = GOOGLE_MAPS_KEY.value();

        // ⚠️ FIX: result_type is NOT valid for reverse geocoding requests like this
        const response = await axios.get(
          "https://maps.googleapis.com/maps/api/geocode/json",
          {
            params: {
              latlng: `${numLat},${numLng}`,
              key: apiKey,
            },
            timeout: 8000,
          }
        );

        const data = response.data;

        if (data.status === "ZERO_RESULTS") {
          return res
            .status(404)
            .json({ error: "No address found for these coordinates." });
        }

        if (data.status !== "OK") {
          console.error(
            "Geocoding API error:",
            data.status,
            data.error_message
          );

          return res.status(502).json({
            error:
              data.error_message || `Geocoding failed: ${data.status}`,
          });
        }

        const address = data.results?.[0]?.formatted_address;

        if (!address) {
          return res
            .status(404)
            .json({ error: "No formatted address returned" });
        }

        return res.status(200).json({
          address,
          lat: numLat,
          lng: numLng,
        });
      } catch (err) {
        console.error(
          "reversegeo error:",
          err?.response?.data || err.message
        );

        return res.status(500).json({
          error:
            err?.response?.data?.error?.message ||
            err.message ||
            "Reverse geocode failed",
        });
      }
    });
  }
);