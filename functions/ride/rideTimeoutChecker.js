// File: functions/rideTimeoutChecker.js
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();

exports.rideTimeoutChecker = onSchedule(
  {
    schedule: "every 1 minutes",
    region: "us-central1",
  },
  async () => {
    const now = Date.now();

    const snapshot = await db
      .collection("Rides")
      .where("status", "==", "searching_driver")
      .get();

    if (snapshot.empty) {
      console.log("[rideTimeoutChecker] No active rides.");
      return;
    }

    console.log(`[rideTimeoutChecker] Checking ${snapshot.size} ride(s)`);

    const updates = snapshot.docs.map(async (doc) => {
      const ride = doc.data();
      const rideId = doc.id;

      try {
        // ─────────────────────────────────────────────
        // 1. Determine when ride actually started tracking
        // ─────────────────────────────────────────────

        let startTimeMs;

        if (ride.isScheduled && ride.scheduledAt) {
          // 🟢 scheduled ride → timeout starts from scheduledAt
          startTimeMs = ride.scheduledAt.toMillis();
        } else if (ride.createdAt) {
          // 🟡 immediate ride → timeout from creation
          startTimeMs = ride.createdAt.toMillis();
        } else {
          return;
        }

        const etaMin = ride.driverInfo?.etaMin ?? 10;
        const timeoutMs = etaMin * 60 * 1000;

        const expiresAtMs = startTimeMs + timeoutMs;

        // store once
        if (!ride.expiresAt) {
          await doc.ref.update({
            expiresAt: new Date(expiresAtMs),
            timeoutMinutes: etaMin,
          });

          console.log(`🧠 Set timeout for ${rideId}`);
        }

        // not expired yet
        if (now < expiresAtMs) return;

        // already timed out
        if (ride.status === "timeout") return;

        // timeout ride
        await doc.ref.update({
          status: "timeout",
          timedOutAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`⏱ Ride ${rideId} → TIMEOUT`);

      } catch (err) {
        console.error(`❌ Error processing ride ${rideId}:`, err);
      }
    });

    await Promise.allSettled(updates);
  }
);