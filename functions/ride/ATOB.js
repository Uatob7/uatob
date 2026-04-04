const { onRequest } = require("firebase-functions/v2/https");
const axios = require("axios");
const cors = require("cors")({ origin: true });

// 🔍 Extract city + zip + lat/lng
function extractLocationData(result) {
  let city = "";
  let zip = "";

  const components = result.address_components;

  components.forEach((c) => {
    if (c.types.includes("locality")) {
      city = c.long_name;
    }

    if (!city && c.types.includes("administrative_area_level_2")) {
      city = c.long_name;
    }

    if (c.types.includes("postal_code")) {
      zip = c.long_name;
    }
  });

  return {
    city,
    zip,
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
  };
}

// 🌍 Geocode (address → city, zip, lat, lng)
async function geocodeAddress(address, apiKey) {
  const res = await axios.get(
    "https://maps.googleapis.com/maps/api/geocode/json",
    {
      params: {
        address,
        key: apiKey,
      },
    }
  );

  const data = res.data;

  if (data.status !== "OK" || !data.results?.length) {
    return { city: "", zip: "", lat: null, lng: null };
  }

  return extractLocationData(data.results[0]);
}

exports.ATOB = onRequest(
  {
    region: "us-central1",
    secrets: ["GOOGLE_MAPS_KEY"],
  },
  async (req, res) => {
    return cors(req, res, async () => {
      try {
        // ── Preflight ─────────────────────────────
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
          return res.status(500).json({
            error: "Google Maps API key not configured",
          });
        }

        // ── Distance Matrix ───────────────────────
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

        if (!element || element.status !== "OK") {
          return res.status(400).json({
            error: "Route not found",
            details: element?.status,
          });
        }

        const miles = element.distance.value / 1609.34;

        // ── 🔥 Get FULL geo data for both ──────────
        const [pickupGeo, dropoffGeo] = await Promise.all([
          geocodeAddress(origin, apiKey),
          geocodeAddress(destination, apiKey),
        ]);

        // ── Final response ────────────────────────
        return res.status(200).json({
          distance_miles: Number(miles.toFixed(2)),
          duration_text: element.duration.text,

          pickupCity: pickupGeo.city,
          pickupZip: pickupGeo.zip,
          pickupLat: pickupGeo.lat,
          pickupLng: pickupGeo.lng,

          dropoffCity: dropoffGeo.city,
          dropoffZip: dropoffGeo.zip,
          dropoffLat: dropoffGeo.lat,
          dropoffLng: dropoffGeo.lng,
        });

      } catch (error) {
        console.error(
          "❌ Error calculating travel details:",
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