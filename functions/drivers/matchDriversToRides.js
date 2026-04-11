const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp, getApps } = require("firebase-admin/app");
const {
  getFirestore,
  FieldValue,
} = require("firebase-admin/firestore");

if (!getApps().length) initializeApp();
const db = getFirestore();

// ── Haversine ─────────────────────────────
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

// ── Scheduler ─────────────────────────────
exports.matchDriversToRides = onSchedule(
  {
    schedule: "* * * * *",
    region: "us-central1",
  },
  async () => {
    try {
      // 1. Get online drivers only
      const driversSnap = await db
        .collection("Drivers")
        .where("status", "==", "online")
        .get();

      const drivers = driversSnap.docs
        .map((doc) => ({
          uid: doc.data().uid || doc.id,
          lat: doc.data().lat,
          lng: doc.data().lng,
        }))
        .filter(
          (d) =>
            typeof d.lat === "number" &&
            typeof d.lng === "number"
        );

      if (drivers.length === 0) {
        console.log("⚠️ No online drivers");
        return;
      }

      // 2. Get pending rides
      const ridesSnap = await db
        .collection("Rides")
        .where("status", "==", "searching_driver")
        .get();

      if (ridesSnap.empty) {
        console.log("ℹ️ No rides waiting");
        return;
      }

      const batch = db.batch();

      // 3. Process each ride
      for (const rideDoc of ridesSnap.docs) {
        const ride = rideDoc.data();

        const { pickupLat, pickupLng } = ride;

        if (
          typeof pickupLat !== "number" ||
          typeof pickupLng !== "number"
        ) continue;

        // 4. Calculate distances
        const ranked = drivers
          .map((d) => ({
            uid: d.uid,
            distance: haversineDistance(
              d.lat,
              d.lng,
              pickupLat,
              pickupLng
            ),
          }))
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 5);

        const firstDriver = ranked[0]?.uid || null;

        // 5. Update ride (REAL dispatch state)
        batch.update(rideDoc.ref, {
          candidateDrivers: ranked,
          candidateDriverUids: ranked.map((d) => d.uid),
          currentDriverUid: firstDriver,
          currentDriverIndex: 0,
          matchedAt: FieldValue.serverTimestamp(),
        });
      }

      await batch.commit();

      console.log("✅ Batch dispatch completed");
    } catch (err) {
      console.error("❌ Matching error:", err);
    }
  }
);