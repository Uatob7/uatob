const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

if (!getApps().length) initializeApp();
const db = getFirestore();

exports.setDriverTripActive = onSchedule(
  {
    schedule: "* * * * *",
    region: "us-central1",
  },
  async () => {
    try {
      // 1. RESET ALL DRIVERS FIRST
      const driversSnap = await db.collection("Drivers").get();

      let batch = db.batch();
      let count = 0;

      driversSnap.forEach((doc) => {
        batch.update(doc.ref, {
          trip: false,
        });
        count++;
      });

      await batch.commit();

      // 2. FIND ACTIVE RIDES (arrived + in_progress)
      const ridesSnap = await db
        .collection("Rides")
        .where("status", "in", ["arrived", "in_progress"])
        .get();

      if (ridesSnap.empty) {
        console.log("No active rides found");
        return;
      }

      batch = db.batch();
      count = 0;

      ridesSnap.forEach((rideDoc) => {
        const ride = rideDoc.data();
        if (!ride.driverUid) return;

        const driverRef = db.collection("Drivers").doc(ride.driverUid);

        batch.update(driverRef, {
          trip: true,
          tripStartedAt: FieldValue.serverTimestamp(),
        });

        count++;
      });

      if (count > 0) {
        await batch.commit();
      }

      console.log("✅ Driver trip status fully synced");
    } catch (err) {
      console.error("❌ setDriverTripActive error:", err);
    }
  }
);