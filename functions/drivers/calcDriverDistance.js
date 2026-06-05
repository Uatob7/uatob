const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const axios = require("axios");

const GOOGLE_MAPS_KEY = defineSecret("GOOGLE_MAPS_KEY");

if (!getApps().length) initializeApp();
const db = getFirestore();

// ─────────────────────────────
// ROUTES API
// ─────────────────────────────
async function getRouteDistance(originLat, originLng, destLat, destLng, apiKey) {
  const res = await axios.post(
    "https://routes.googleapis.com/directions/v2:computeRoutes",
    {
      origin: {
        location: {
          latLng: { latitude: originLat, longitude: originLng },
        },
      },
      destination: {
        location: {
          latLng: { latitude: destLat, longitude: destLng },
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

  const distanceMeters = route.distanceMeters || 0;

  const durationRaw = String(route.duration || "0s");
  const durationSeconds = parseFloat(durationRaw.replace("s", "")) || 0;

  return {
    distanceMiles: +(distanceMeters / 1609.34).toFixed(2),
    durationMin: Math.ceil(durationSeconds / 60),
  };
}

// ─────────────────────────────
// SCHEDULED FUNCTION
// ─────────────────────────────
exports.calcDriverDistance = onSchedule(
  {
    schedule: "* * * * *",
    timeZone: "America/New_York",
    secrets: [GOOGLE_MAPS_KEY],
  },
  async () => {
    console.log("🔄 Running live ETA update...");

    const apiKey = GOOGLE_MAPS_KEY.value();

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

    await Promise.all(
      ridesSnap.docs.map(async (doc) => {
        const ride = doc.data();
        const rideId = doc.id;

        const driverUid = ride.driverUid;
        if (!driverUid) return;

        try {
          const driverSnap = await db.collection("Drivers").doc(driverUid).get();
          if (!driverSnap.exists) return;

          const driver = driverSnap.data();
          if (driver.lat == null || driver.lng == null) return;

          let destLat, destLng, distanceField, etaField;

          const headingToPickup =
            ["searching_driver", "driver_assigned", "driver_arriving"].includes(
              ride.status
            );

          const headingToDropoff =
            ["arrived", "in_progress"].includes(ride.status);

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
            return;
          }

          if (destLat == null || destLng == null) return;

          const { distanceMiles, durationMin } = await getRouteDistance(
            driver.lat,
            driver.lng,
            destLat,
            destLng,
            apiKey
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
      })
    );
  }
);