// File: functions/scheduledRideChecker.js

const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

exports.scheduledRideChecker = onSchedule(
  {
    schedule: "every 2 minutes",
    region: "us-central1",
    timeZone: "America/New_York",
  },
  async () => {
    const now = admin.firestore.Timestamp.now();

    const snapshot = await db
      .collection("Rides")
      .where("status", "==", "scheduled")
      .where("isScheduled", "==", true)
      .where("paymentStatus", "==", "succeeded")
      .where("scheduledAt", "<=", now)
      .get();

    if (snapshot.empty) {
      console.log("[scheduledRideChecker] No rides ready.");
      return;
    }

    console.log(
      `[scheduledRideChecker] Found ${snapshot.size} scheduled ride(s)`
    );

    const updates = snapshot.docs.map(async (doc) => {
      const rideId = doc.id;
      const ride = doc.data();

      try {
        await doc.ref.update({
          status: "searching_driver",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(
          `[scheduledRideChecker] ✅ ${rideId} moved → searching_driver`
        );
      } catch (err) {
        console.error(
          `[scheduledRideChecker] ❌ ${rideId} failed`,
          err
        );
      }
    });

    await Promise.allSettled(updates);
  }
);