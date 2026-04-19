// File: functions/findDriversScheduled.js

const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const db = getFirestore();

/* ── Haversine Distance ───────────────────────────── */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 3958.8; // miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ── Scheduled Function ───────────────────────────── */
exports.findDrivers = onSchedule(
  {
    schedule: "every 1 minutes",
    region: "us-central1",
  },
  async () => {
    console.log("[findDriversScheduled] running...");

    // Get all rides waiting for drivers
    const ridesSnap = await db
      .collection("Rides")
      .where("status", "==", "searching_driver")
      .limit(20)
      .get();

    if (ridesSnap.empty) {
      console.log("[findDriversScheduled] no rides found");
      return;
    }

    console.log(`[findDriversScheduled] processing ${ridesSnap.size} ride(s)`);

    // Get online drivers ONCE (performance optimization)
    const driversSnap = await db
      .collection("Drivers")
      .where("status", "==", "online")
      .get();

    if (driversSnap.empty) {
      console.log("[findDriversScheduled] no drivers online");
      return;
    }

    const drivers = driversSnap.docs
      .map((doc) => ({ uid: doc.id, ...doc.data() }))
      .filter((d) => typeof d.lat === "number" && typeof d.lng === "number");

    // Process each ride
    const tasks = ridesSnap.docs.map(async (rideDoc) => {
      const ride = rideDoc.data();
      const rideRef = rideDoc.ref;

      const { pickupLat, pickupLng } = ride;

      if (!pickupLat || !pickupLng) {
        console.warn(`[findDriversScheduled] missing coords for ${rideDoc.id}`);
        return;
      }

      // Sort drivers by distance
      const sorted = drivers
        .map((d) => ({
          uid: d.uid,
          distance: haversineDistance(
            d.lat,
            d.lng,
            pickupLat,
            pickupLng
          ),
        }))
        .sort((a, b) => a.distance - b.distance);

      const topDrivers = sorted.slice(0, 10);

      await rideRef.update({
        candidateDrivers: topDrivers,
        candidateDriverUids: topDrivers.map((d) => d.uid),
        currentDriverIndex: 0,
        requestSentAt: FieldValue.serverTimestamp(),
      });

      console.log(`✅ Ride ${rideDoc.id} matched with ${topDrivers.length} drivers`);
    });

    await Promise.allSettled(tasks);
  }
);