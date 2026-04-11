const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const axios = require("axios");

const GOOGLE_MAPS_KEY = defineSecret("GOOGLE_MAPS_KEY");

if (!getApps().length) initializeApp();
const db = getFirestore();

// ─────────────────────────────────────────────
// ROUTES API (Google Maps new API)
// ─────────────────────────────────────────────
async function getRouteDistance(originLat, originLng, destLat, destLng, apiKey) {
  const res = await axios.post(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      origin: {
        location: {
          latLng: {
            latitude: originLat,
            longitude: originLng,
          },
        },
      },
      destination: {
        location: {
          latLng: {
            latitude: destLat,
            longitude: destLng,
          },
        },
      },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      computeAlternativeRoutes: false,
      languageCode: "en-US",
      units: "IMPERIAL",
    },
    {
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration",
      },
    }
  );

  const route = res.data?.routes?.[0];
  if (!route) throw new Error("No route returned");

  const distanceMeters = route.distanceMeters;
  const durationSeconds = parseInt(route.duration.replace("s", ""), 10);

  return {
    distanceMiles: +(distanceMeters / 1609.34).toFixed(2),
    durationMin: Math.ceil(durationSeconds / 60),
  };
}

// ─────────────────────────────────────────────
// LIVE ETA ENGINE (RUNS EVERY MINUTE)
// ─────────────────────────────────────────────
exports.calcDriverDistance = onSchedule(
  {
    schedule: "* * * * *",
    timeZone: "America/New_York",
    secrets: [GOOGLE_MAPS_KEY],
  },
  async () => {
    console.log("🔄 Running live ETA update...");

    const ridesSnap = await db
      .collection("Rides")
      .where("status", "in", [
        "searching_driver",
        "driver_assigned",
        "driver_arriving",
        "arrived",
        "in_progress",
      ])
      .get();

    if (ridesSnap.empty) return;

    for (const doc of ridesSnap.docs) {
      const ride = doc.data();

      const rideId = doc.id;
      const driverUid = ride.driverUid;

      if (!driverUid) continue;

      const driverSnap = await db.collection("Drivers").doc(driverUid).get();
      if (!driverSnap.exists) continue;

      const driver = driverSnap.data();
      if (driver.lat == null || driver.lng == null) continue;

      try {
        let destLat, destLng, distanceField, etaField;

        const headingToPickup =
          ride.status === "searching_driver" ||
          ride.status === "driver_assigned" ||
          ride.status === "driver_arriving";

        const headingToDropoff =
          ride.status === "arrived" ||
          ride.status === "in_progress";

        if (headingToPickup) {
          destLat = ride.pickupLat;
          destLng = ride.pickupLng;
          distanceField = "driverDistanceMiles";
          etaField = "driverEtaMin";
        } else if (headingToDropoff) {
          destLat = ride.dropoffLat;
          destLng = ride.dropoffLng;
          distanceField = "dropoffDistanceMiles";
          etaField = "dropoffEtaMin";
        } else {
          continue;
        }

        if (destLat == null || destLng == null) continue;

        const { distanceMiles, durationMin } =
          await getRouteDistance(
            driver.lat,
            driver.lng,
            destLat,
            destLng,
            GOOGLE_MAPS_KEY.value()
          );

        await doc.ref.update({
          [distanceField]: distanceMiles,
          [etaField]: durationMin,
          driverLat: driver.lat,
          driverLng: driver.lng,
          updatedAt: FieldValue.serverTimestamp(),
        });

        console.log(`✅ Updated ride ${rideId}`);
      } catch (err) {
        console.error(`❌ Ride update failed ${rideId}:`, err.message);
      }
    }
  }
);