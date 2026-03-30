const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const axios = require("axios");
const cors = require("cors")({ origin: true });

const GOOGLE_MAPS_KEY = defineSecret("GOOGLE_MAPS_KEY");

exports.Autocomplete = onRequest(
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

        const trimmed = req.body?.input?.trim();
        if (!trimmed || trimmed.length < 3) {
          return res.status(400).json({ error: "Input must be at least 3 characters" });
        }

        const response = await axios.post(
          "https://places.googleapis.com/v1/places:autocomplete",
          {
            input: trimmed,
            includedRegionCodes: ["us"],
          },
          {
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": GOOGLE_MAPS_KEY.value(),
              "X-Goog-FieldMask":
                "suggestions.placePrediction.text,suggestions.placePrediction.placeId",
            },
          }
        );

        const suggestions = response.data.suggestions ?? [];
        const predictions = suggestions.map((s) => ({
          description: s.placePrediction.text.text,
          place_id: s.placePrediction.placeId,
        }));

        return res.json({ predictions, status: "OK" });
      } catch (err) {
        const status = err?.response?.status ?? 500;
        const message =
          err?.response?.data?.error?.message ?? err.message ?? "Autocomplete failed";

        console.error("Autocomplete error:", err?.response?.data || err.message);

        return res.status(status).json({ error: message });
      }
    });
  }
);