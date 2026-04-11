const { onRequest } = require("firebase-functions/v2/https");
const axios = require("axios");
const cors = require("cors")({ origin: true });

// 🔍 Extract city + zip + lat/lng
function extractLocationData(result) {
  let city = "";
  let zip = "";

  const components = result.address_components || [];

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
    lat: result.geometry?.location?.lat || null,
    lng: result.geometry?.location?.lng || null,
  };
}

// 🌍 Geocode (address → city, zip, lat, lng)
async function geocodeAddress(address, apiKey) {
  try {
    const res = await axios.get(
      "https://maps.googleapis.com/maps/api/geocode/json",
      {
        params: { address, key: apiKey },
        timeout: 8000,
      }
    );

    const data = res.data;

    if (data.status !== "OK" || !data.results?.length) {
      return { city: "", zip: "", lat: null, lng: null };
    }

    return extractLocationData(data.results[0]);
  } catch (err) {
    console.error("Geocode error:", err.message);
    return { city: "", zip: "", lat: null, lng: null };
  }
}

// 🚀 MAIN FUNCTION
exports.ATOB = onRequest(
  {
    region: "us-central1",
    secrets: ["GOOGLE_MAPS_KEY"],
    invoker: "public", // ✅ makes it publicly accessible
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

        const { origin, destination } = req.body || {};

        console.log("📍 ATOB request:", { origin, destination });

        if (!origin || !destination) {
          return res.status(400).json({
            error: "Missing origin or destination",
          });
        }

        const apiKey = process.env.GOOGLE_MAPS_KEY;

        if (!apiKey) {
          return res.status(500).json({
            error: "Google Maps API key not configured",
          });
        }

        // ── 🧭 Routes API Call (FIXED BODY) ─────────────────────
        const routeResponse = await axios.post(
          "https://routes.googleapis.com/directions/v2:computeRoutes",
          {
            origin: {
              address: origin, // ✅ FIXED
            },
            destination: {
              address: destination, // ✅ FIXED
            },
            travelMode: "DRIVE",
            routingPreference: "TRAFFIC_AWARE",
          },
          {
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": apiKey,
              "X-Goog-FieldMask":
                "routes.distanceMeters,routes.duration",
            },
            timeout: 10000,
          }
        );

        const routes = routeResponse.data?.routes;

        if (!routes?.length) {
          return res.status(400).json({
            error: "Route not found",
          });
        }

        const route = routes[0];

        const miles = route.distanceMeters / 1609.34;

        const seconds = Number(route.duration?.replace("s", "") || 0);
        const minutes = Math.ceil(seconds / 60);

        // ── 🔥 Geocode for city + zip ───────────────────
        const [pickupGeo, dropoffGeo] = await Promise.all([
          geocodeAddress(origin, apiKey),
          geocodeAddress(destination, apiKey),
        ]);

        // ── ✅ Final Response ───────────────────────────
        return res.status(200).json({
          distance_miles: Number(miles.toFixed(2)),
          duration_minutes: minutes,

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
          "❌ Routes API error:",
          error?.response?.data || error.message
        );

        return res.status(500).json({
          error: "Error calculating route",
          details: error?.response?.data || error.message,
        });
      }
    });
  }
);