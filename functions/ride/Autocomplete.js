const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const axios = require("axios");

const GOOGLE_MAPS_KEY = defineSecret("GOOGLE_MAPS_KEY");

exports.Autocomplete = onCall(
    {
    region: "us-east1",
    secrets: [GOOGLE_MAPS_KEY],
  },
  async (request) => {
    const trimmed = request.data?.input?.trim();

    if (!trimmed || trimmed.length < 3)
      throw new HttpsError("invalid-argument", "Input must be at least 3 characters");

    try {
      const response = await axios.post(
        "https://places.googleapis.com/v1/places:autocomplete",
        { input: trimmed, includedRegionCodes: ["us"] },
        {
          headers: {
            "Content-Type":     "application/json",
            "X-Goog-Api-Key":   GOOGLE_MAPS_KEY.value(),
            "X-Goog-FieldMask": "suggestions.placePrediction.text,suggestions.placePrediction.placeId",
          },
        }
      );

      const suggestions = response.data?.suggestions ?? [];
      const predictions = suggestions.map((s) => ({
        description: s?.placePrediction?.text?.text || "",
        place_id:    s?.placePrediction?.placeId    || "",
      }));

      return { predictions, status: "OK" };
    } catch (err) {
      console.error("Autocomplete error:", err?.response?.data || err.message);
      throw new HttpsError("internal", err?.response?.data?.error?.message || err.message || "Autocomplete failed");
    }
  }
);