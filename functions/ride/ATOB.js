const { onCall, HttpsError } = require("firebase-functions/v2/https");
const axios = require("axios");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

if (!getApps().length) initializeApp();
const db = getFirestore();

const GOOGLE_MAPS_KEY = defineSecret("GOOGLE_MAPS_KEY");

function extractLocationData(result) {
  let city = "", zip = "";
  const components = result.address_components || [];
  for (const c of components) {
    if (!city && c.types.includes("locality"))                      city = c.long_name;
    if (!city && c.types.includes("administrative_area_level_2"))   city = c.long_name;
    if (!zip  && c.types.includes("postal_code"))                   zip  = c.long_name;
  }
  return { city, zip, lat: result.geometry?.location?.lat ?? null, lng: result.geometry?.location?.lng ?? null };
}

async function geocodeAddress(address, apiKey) {
  try {
    const res = await axios.get("https://maps.googleapis.com/maps/api/geocode/json", {
      params: { address, key: apiKey }, timeout: 8000,
    });
    const data = res.data;
    if (data.status !== "OK" || !data.results?.length) return { city: "", zip: "", lat: null, lng: null };
    return extractLocationData(data.results[0]);
  } catch (err) {
    console.error("Geocode error:", err.message);
    return { city: "", zip: "", lat: null, lng: null };
  }
}

exports.ATOB = onCall(
  {
    region: "us-east1",
    secrets: [GOOGLE_MAPS_KEY],
  },
  async (request) => {
    const origin      = String(request.data?.origin      ?? "").trim();
    const destination = String(request.data?.destination ?? "").trim();

    if (!origin || !destination)
      throw new HttpsError("invalid-argument", "Missing origin or destination");

    const apiKey = GOOGLE_MAPS_KEY.value();

    try {
      const [routeResponse, [pickupGeo, dropoffGeo]] = await Promise.all([
        axios.post(
          "https://routes.googleapis.com/directions/v2:computeRoutes",
          {
            origin:            { address: origin },
            destination:       { address: destination },
            travelMode:        "DRIVE",
            routingPreference: "TRAFFIC_AWARE",
          },
          {
            headers: {
              "Content-Type":    "application/json",
              "X-Goog-Api-Key":  apiKey,
              "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
            },
            timeout: 10000,
          }
        ),
        Promise.all([
          geocodeAddress(origin, apiKey),
          geocodeAddress(destination, apiKey),
        ]),
      ]);

      const routes = routeResponse.data?.routes;
      if (!routes?.length) throw new HttpsError("not-found", "Route not found");

      const route          = routes[0];
      const distanceMeters = route.distanceMeters ?? 0;
      const miles          = distanceMeters / 1609.34;
      const seconds        = parseInt(route.duration?.replace("s", "") || "0", 10);
      const minutes        = Math.ceil(seconds / 60);

      return {
        origin, destination,
        distance_miles:   Number(miles.toFixed(2)),
        duration_minutes: minutes,
        route: {
          distanceMeters,
          duration_seconds: seconds,
          polyline: route.polyline?.encodedPolyline ?? null,
        },
        pickup:  pickupGeo,
        dropoff: dropoffGeo,
        status:  "OK",
      };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      console.error("Routes API error:", err?.response?.data || err.message);
      throw new HttpsError("internal", err?.response?.data?.error?.message || err.message || "Route calculation failed");
    }
  }
);