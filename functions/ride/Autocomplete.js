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
  (req, res) => {
    cors(req, res, async () => {
      try {
        // ✅ Handle preflight
        if (req.method === "OPTIONS") {
          return res.status(204).send("");
        }

        if (req.method !== "POST") {
          return res.status(405).json({ error: "Method Not Allowed" });
        }

        const trimmed = String(req.body?.input ?? "").trim();

        if (trimmed.length < 3) {
          return res
            .status(400)
            .json({ error: "Input must be at least 3 characters" });
        }

        const apiKey = GOOGLE_MAPS_KEY.value();

        const response = await axios.post(
          "https://places.googleapis.com/v1/places:autocomplete",
          {
            input: trimmed,
            regionCode: "us",
          },
          {
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": apiKey,
              "X-Goog-FieldMask":
                "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text",
            },
          }
        );

        const suggestions = response.data?.suggestions ?? [];

        return res.json({
          predictions: suggestions.map((s) => ({
            description: s?.placePrediction?.text?.text ?? "",
            place_id: s?.placePrediction?.placeId ?? "",
          })),
          status: "OK",
        });
      } catch (err) {
        console.error("Autocomplete error:", err?.response?.data || err.message);

        return res.status(500).json({
          error:
            err?.response?.data?.error?.message ??
            err.message ??
            "Autocomplete failed",
        });
      }
    });
  }
);