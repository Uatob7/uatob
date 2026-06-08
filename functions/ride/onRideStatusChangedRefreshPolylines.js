const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
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

exports.onRideStatusChangedRefreshPolylines = onDocumentUpdated(
  {
    document:       "Rides/{rideId}",
    region:         "us-east1",
    secrets:        [GOOGLE_MAPS_KEY],
    timeoutSeconds: 60,
  },
  async (event) => {
    const before = event.data.before.data();
    const after  = event.data.after.data();

    const prevStatus = before?.status;
    const newStatus  = after?.status;

    if (!after || prevStatus === newStatus) return null;

    const REFRESH_ON = [
      "searching_driver",
      "driver_assigned",
      "driver_arriving",
      "arrived",
      "in_progress",
    ];
    if (!REFRESH_ON.includes(newStatus)) return null;

    const apiKey = GOOGLE_MAPS_KEY.value();
    const update = {};

    const {
      driverLat, driverLng,
      pickupLat, pickupLng,
      dropoffLat, dropoffLng,
    } = after;

    const hasDriver  = driverLat != null && driverLng != null;
    const hasPickup  = pickupLat != null && pickupLng != null;
    const hasDropoff = dropoffLat != null && dropoffLng != null;

    // driver → pickup  (only while driver is en route to pickup)
    if (
      (newStatus === "driver_assigned" || newStatus === "driver_arriving") &&
      hasDriver && hasPickup
    ) {
      try {
        const r = await computeRoute(driverLat, driverLng, pickupLat, pickupLng, apiKey);
        if (r) {
          update.driverEtaPolyline   = r.polyline;
          update.driverDistanceMiles = r.distanceMiles;
          update.driverEtaMin        = r.etaMin;
        }
      } catch (err) {
        console.error(`[onRideStatusChangedRefreshPolylines] driver→pickup failed:`, err.message);
      }
    }

    // pickup → dropoff  (pre-compute or refresh for all relevant statuses)
    if (hasPickup && hasDropoff) {
      try {
        const r = await computeRoute(pickupLat, pickupLng, dropoffLat, dropoffLng, apiKey);
        if (r) {
          update.polyline          = r.polyline;
          update.tripDistanceMiles = r.distanceMiles;
          update.tripDurationMin   = r.etaMin;
        }
      } catch (err) {
        console.error(`[onRideStatusChangedRefreshPolylines] pickup→dropoff failed:`, err.message);
      }
    }

    if (!Object.keys(update).length) return null;

    await event.data.after.ref.update({
      ...update,
      polylineUpdatedAt: FieldValue.serverTimestamp(),
    });

    console.log(
      `[onRideStatusChangedRefreshPolylines] ${event.params.rideId} ` +
      `(${prevStatus} → ${newStatus}): ${Object.keys(update).join(", ")}`
    );

    return null;
  }
);
