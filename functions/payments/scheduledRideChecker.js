// File: functions/scheduledRideChecker.js

const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();


exports.scheduledRideChecker = onSchedule(
  {
    schedule: "every 1 minutes",
    region: "us-central1",
  },
  async () => {
    const now = Date.now();

    const snapshot = await db
      .collection("Rides")
      .where("status", "==", "scheduled")
      .where("isScheduled", "==", true)
      .where("paymentStatus", "==", "succeeded")
      .get();

    if (snapshot.empty) {
      console.log("[scheduledRideChecker] No scheduled rides found.");
      return;
    }

    console.log(`[scheduledRideChecker] Total candidates: ${snapshot.size}`);

    const updates = [];

    snapshot.docs.forEach((doc) => {
      const ride = doc.data();

      const scheduledTime = ride.scheduledAt?.toDate?.()?.getTime?.();

      if (!scheduledTime) {
        console.warn(`[scheduledRideChecker] Missing scheduledAt: ${doc.id}`);
        return;
      }

      // 🔥 THE IMPORTANT CHECK
      if (scheduledTime <= now) {
        updates.push(
          doc.ref.update({
            status: "searching_driver",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }).then(() => {
            console.log(
              `[scheduledRideChecker] ✅ ${doc.id} moved → searching_driver`
            );
          })
        );
      }
    });

    await Promise.allSettled(updates);
  }
);