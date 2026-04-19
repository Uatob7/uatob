const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const axios = require("axios");

const GOOGLE_MAPS_KEY = defineSecret("GOOGLE_MAPS_KEY");

exports.Geo = onCall(
  { region: "us-east1", secrets: [GOOGLE_MAPS_KEY], invoker: "public" },
  async (request) => {
    const numLat = Number(request.data?.lat);
    const numLng = Number(request.data?.lng);

    if (!Number.isFinite(numLat) || !Number.isFinite(numLng))
      throw new HttpsError("invalid-argument", "lat and lng must be valid numbers");
    if (numLat < -90 || numLat > 90 || numLng < -180 || numLng > 180)
      throw new HttpsError("invalid-argument", "lat/lng out of range");

    try {
      const response = await axios.get(
        "https://maps.googleapis.com/maps/api/geocode/json",
        { params: { latlng: `${numLat},${numLng}`, key: GOOGLE_MAPS_KEY.value() }, timeout: 8000 }
      );
      const data = response.data;

      if (data.status === "ZERO_RESULTS")
        throw new HttpsError("not-found", "No address found for these coordinates.");
      if (data.status !== "OK")
        throw new HttpsError("internal", data.error_message || `Geocoding failed: ${data.status}`);

      const address = data.results?.[0]?.formatted_address;
      if (!address)
        throw new HttpsError("not-found", "No formatted address returned");

      return { address, lat: numLat, lng: numLng };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      console.error("reversegeo error:", err?.response?.data || err.message);
      throw new HttpsError("internal", err?.response?.data?.error?.message || err.message || "Reverse geocode failed");
    }
  }
);