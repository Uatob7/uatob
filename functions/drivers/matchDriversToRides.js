const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

if (!getApps().length) initializeApp();
const db = getFirestore();

// ── Haversine distance ─────────────────────────────
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Match drivers to rides ─────────────────────────
exports.matchDriversToRides = onSchedule(
  {
    schedule: "* * * * *", // every minute
    region: "us-central1",
  },
  async () => {
    try {
      // 1. Get all active drivers
      const driversSnap = await db
        .collection("Drivers")
        .where("status", "==", "online")
        .get();

      const drivers = driversSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // 2. Get rides looking for drivers
      const ridesSnap = await db
        .collection("Rides")
        .where("status", "==", "searching_driver")
        .get();

      const batch = db.batch();

      for (const rideDoc of ridesSnap.docs) {
        const ride = rideDoc.data();

        const { pickupLat, pickupLng } = ride;
        if (!pickupLat || !pickupLng) continue;

        // 3. Compute distances
        const driversWithDistance = drivers
          .filter((d) => d.lat && d.lng)
          .map((driver) => ({
            uid: driver.uid,
            distance: haversineDistance(
              driver.lat,
              driver.lng,
              pickupLat,
              pickupLng
            ),
          }));

        // 4. Sort by closest
        driversWithDistance.sort((a, b) => a.distance - b.distance);

        // 5. Take top 5 drivers
        const closestDrivers = driversWithDistance.slice(0, 5);

        // 6. Save into ride
        batch.update(rideDoc.ref, {
          candidateDrivers: closestDrivers, // ✅ array of drivers
          matchedAt: FieldValue.serverTimestamp(),
        });
      }

      await batch.commit();

      console.log("✅ Drivers matched to rides");
    } catch (err) {
      console.error("❌ Matching error:", err);
    }
  }
);