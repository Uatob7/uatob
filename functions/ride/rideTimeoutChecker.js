// File: functions/rideTimeoutChecker.js
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

exports.rideTimeoutChecker = onSchedule(
  {
    schedule: "every 1 minutes",
    region: "us-central1",
  },
  async () => {
    const now = admin.firestore.Timestamp.now();

    // 7 minutes ago
    const cutoff = new Date(now.toDate().getTime() - 7 * 60 * 1000);

    console.log(`[rideTimeoutChecker] Checking rides before ${cutoff.toISOString()}`);

    const snapshot = await db
      .collection("Rides")
      .where("status", "==", "searching_driver")
      .where("createdAt", "<=", cutoff)
      .get();

    if (snapshot.empty) {
      console.log("[rideTimeoutChecker] No expired rides.");
      return;
    }

    console.log(`[rideTimeoutChecker] Found ${snapshot.size} expired ride(s)`);

    const updates = snapshot.docs.map(async (doc) => {
      const rideId = doc.id;

      try {
        await doc.ref.update({
          status: "timeout",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`⏱ Ride ${rideId} → timeout`);
      } catch (err) {
        console.error(`❌ Error updating ride ${rideId}:`, err);
      }
    });

    await Promise.allSettled(updates);
  }
);