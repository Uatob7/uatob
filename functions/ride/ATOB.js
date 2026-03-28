const { onRequest } = require("firebase-functions/v2/https");
const axios = require("axios");
const cors = require("cors")({ origin: true });

exports.ATOB = onRequest(
  {
    region: "us-central1",
    secrets: ["GOOGLE_MAPS_KEY"],
  },
  async (req, res) => {
    return cors(req, res, async () => {
      try {
        // Handle browser preflight
        if (req.method === "OPTIONS") {
          return res.status(204).send("");
        }

        if (req.method !== "POST") {
          return res.status(405).json({ error: "Method Not Allowed" });
        }

        const { origin, destination } = req.body;

        if (!origin || !destination) {
          return res.status(400).json({ error: "Missing origin or destination" });
        }

        const apiKey = process.env.GOOGLE_MAPS_KEY;
        if (!apiKey) {
          return res.status(500).json({ error: "Google Maps API key not configured" });
        }

        const googleMapsResponse = await axios.get(
          "https://maps.googleapis.com/maps/api/distancematrix/json",
          {
            params: {
              origins: origin,
              destinations: destination,
              key: apiKey,
              units: "imperial",
              mode: "driving",
            },
          }
        );

        const data = googleMapsResponse.data;

        if (data.status !== "OK") {
          return res.status(500).json({
            error: "Google Maps API error",
            details: data.status,
          });
        }

        const element = data?.rows?.[0]?.elements?.[0];

        if (!element) {
          return res.status(500).json({
            error: "Invalid Google Maps response structure",
          });
        }

        if (element.status !== "OK") {
          return res.status(400).json({
            error: "Route not found",
            details: element.status,
          });
        }

        const miles = element.distance.value / 1609.34;

        return res.status(200).json({
          distance_miles: Number(miles.toFixed(2)),
          duration_text: element.duration.text,
        });
      } catch (error) {
        console.error(
          "Error calculating travel details:",
          error?.response?.data || error.message
        );

        return res.status(500).json({
          error: "Error calculating travel details.",
          details: error?.response?.data || error.message,
        });
      }
    });
  }
);