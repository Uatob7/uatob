const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const axios = require("axios");

if (!getApps().length) initializeApp();
const db = getFirestore();

const GOOGLE_MAPS_KEY = defineSecret("GOOGLE_MAPS_KEY");

async function computeRoute(originLat, originLng, destLat, destLng, apiKey) {
  const res = await axios.post(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      origin:      { location: { latLng: { latitude: originLat, longitude: originLng } } },
      destination: { location: { latLng: { latitude: destLat,   longitude: destLng   } } },
      travelMode:               "DRIVE",
      routingPreference:        "TRAFFIC_AWARE",
      computeAlternativeRoutes: false,
    },
    {
      headers: {
        "Content-Type":     "application/json",
        "X-Goog-Api-Key":   apiKey,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
      },
      timeout: 8000,
    }
  );
  const route = res.data?.routes?.[0];
  if (!route) return null;
  const distMeters = route.distanceMeters ?? 0;
  const durSec     = parseInt(String(route.duration ?? "0s").replace("s", ""), 10) || 0;
  return {
    polyline:      route.polyline?.encodedPolyline ?? null,
    distanceMiles: parseFloat((distMeters / 1609.34).toFixed(2)),
    etaMin:        Math.ceil(durSec / 60),
  };
}

exports.refreshRidePolylines = onSchedule(
  {
    schedule:       "every 2 minutes",
   region: "us-central1",
    secrets:        [GOOGLE_MAPS_KEY],
    timeoutSeconds: 540,
    memory:         "512MiB",
  },
  async () => {
    const apiKey = GOOGLE_MAPS_KEY.value();

    const [snapAssigned, snapArriving] = await Promise.all([
      db.collection("Rides").where("status", "==", "driver_assigned").get(),
      db.collection("Rides").where("status", "==", "driver_arriving").get(),
    ]);

    const docs = [...snapAssigned.docs, ...snapArriving.docs];
    if (!docs.length) return;

    console.log(`[refreshRidePolylines] Processing ${docs.length} ride(s).`);

    await Promise.allSettled(
      docs.map(async (docSnap) => {
        const ride   = docSnap.data();
        const update = {};
        const {
          driverLat, driverLng,
          pickupLat, pickupLng,
          dropoffLat, dropoffLng,
        } = ride;

        // 1. Driver current location → pickup  →  driverEtaPolyline
        if (driverLat != null && driverLng != null && pickupLat != null && pickupLng != null) {
          try {
            const r = await computeRoute(driverLat, driverLng, pickupLat, pickupLng, apiKey);
            if (r) {
              update.driverEtaPolyline   = r.polyline;
              update.driverDistanceMiles = r.distanceMiles;
              update.driverEtaMin        = r.etaMin;
            }
          } catch (err) {
            console.error(`[refreshRidePolylines] driver→pickup failed (${docSnap.id}):`, err.message);
          }
        }

        // 2. Pickup → dropoff  →  polyline (trip route for in_progress phase)
        if (pickupLat != null && pickupLng != null && dropoffLat != null && dropoffLng != null) {
          try {
            const r = await computeRoute(pickupLat, pickupLng, dropoffLat, dropoffLng, apiKey);
            if (r) {
              update.polyline          = r.polyline;
              update.tripDistanceMiles = r.distanceMiles;
              update.tripDurationMin   = r.etaMin;
            }
          } catch (err) {
            console.error(`[refreshRidePolylines] pickup→dropoff failed (${docSnap.id}):`, err.message);
          }
        }

        if (!Object.keys(update).length) return;

        await docSnap.ref.update({
          ...update,
          polylineUpdatedAt: FieldValue.serverTimestamp(),
        });
        console.log(`[refreshRidePolylines] ${docSnap.id} → ${Object.keys(update).join(", ")}`);
      })
    );
  }
);
