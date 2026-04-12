const { onRequest } = require("firebase-functions/v2/https");
const axios = require("axios");
const cors = require("cors")({ origin: true });

// 🔥 Firebase Admin
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

if (!getApps().length) initializeApp();
const db = getFirestore();

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

// 🌍 Geocode
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
    invoker: "public",
  },
  (req, res) => {
    cors(req, res, async () => {
      try {
        if (req.method === "OPTIONS") {
          return res.status(204).send("");
        }

        if (req.method !== "POST") {
          return res.status(405).json({ error: "Method Not Allowed" });
        }

        const { origin, destination } = req.body || {};

        if (!origin || !destination) {
          return res.status(400).json({
            error: "Missing origin or destination",
          });
        }

        const apiKey = process.env.GOOGLE_MAPS_KEY;

        // 🧭 Routes API (WITH POLYLINE)
        const routeResponse = await axios.post(
          "https://routes.googleapis.com/directions/v2:computeRoutes",
          {
            origin: { address: origin },
            destination: { address: destination },
            travelMode: "DRIVE",
            routingPreference: "TRAFFIC_AWARE",
          },
          {
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": apiKey,
              "X-Goog-FieldMask":
                "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
            },
            timeout: 10000,
          }
        );

        const routes = routeResponse.data?.routes;

        if (!routes?.length) {
          return res.status(400).json({ error: "Route not found" });
        }

        const route = routes[0];

        const miles = route.distanceMeters / 1609.34;
        const seconds = Number(route.duration?.replace("s", "") || 0);
        const minutes = Math.ceil(seconds / 60);

        // 🌍 Geocode
        const [pickupGeo, dropoffGeo] = await Promise.all([
          geocodeAddress(origin, apiKey),
          geocodeAddress(destination, apiKey),
        ]);

        // 🧾 CLEAN STRUCTURE
        const searchData = {
          origin,
          destination,

          distance_miles: Number(miles.toFixed(2)),
          duration_minutes: minutes,

          route: {
            distanceMeters: route.distanceMeters,
            duration_seconds: seconds,
            polyline: route.polyline?.encodedPolyline || null,
          },

          pickupCity: pickupGeo.city,
          pickupZip: pickupGeo.zip,
          pickupLat: pickupGeo.lat,
          pickupLng: pickupGeo.lng,

          dropoffCity: dropoffGeo.city,
          dropoffZip: dropoffGeo.zip,
          dropoffLat: dropoffGeo.lat,
          dropoffLng: dropoffGeo.lng,

          createdAt: FieldValue.serverTimestamp(),
        };


        // 📦 Return
        return res.status(200).json(searchData);

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