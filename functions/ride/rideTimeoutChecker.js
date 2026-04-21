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

      if (!ride.createdAt) return;

      try {
        const createdAtMs = ride.createdAt.toMillis();

        // 🔥 Pull driver info safely
        const etaMin =
          ride.driverInfo?.etaMin ??
          ride.etaMin ??
          10;

        const driverCount =
          ride.driverInfo?.driverCount ??
          ride.driverCount ??
          0;

        const nearestMiles =
          ride.driverInfo?.nearestMiles ??
          ride.nearestMiles ??
          0;

        // 🔥 Compute timeout ONLY ONCE
        let timeoutMinutes = ride.timeoutMinutes;

        if (!timeoutMinutes) {
          timeoutMinutes = getSmartTimeoutMinutes({
            etaMin,
            driverCount,
            nearestMiles,
          });
        }

        // 🔥 Compute expiresAt
        let expiresAtMs =
          ride.expiresAt?.toMillis?.() ??
          createdAtMs + timeoutMinutes * 60 * 1000;

        // 🔥 Persist if missing (VERY IMPORTANT)
        if (!ride.expiresAt || !ride.timeoutMinutes) {
          await doc.ref.update({
            timeoutMinutes,
            expiresAt: new Date(expiresAtMs),
          });

          console.log(
            `🧠 Initialized timeout for ${rideId} → ${timeoutMinutes} min`
          );
        }

        // ⛔ Not expired yet
        if (now < expiresAtMs) return;

        // ⛔ Already processed
        if (ride.status === "timeout") return;

        // 🔥 Timeout the ride
        await doc.ref.update({
          status: "timeout",
          stale: true,
          timedOutAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(
          `⏱ Ride ${rideId} → TIMEOUT (${timeoutMinutes} min)`
        );

      } catch (err) {
        console.error(`❌ Error processing ride ${rideId}:`, err);
      }
    });

    await Promise.allSettled(updates);
  }
);


// 🧠 SMART TIMEOUT LOGIC
function getSmartTimeoutMinutes({ etaMin = 10, driverCount = 0, nearestMiles = 0 }) {
  let t = etaMin;

  // 🚗 Supply / demand
  if (driverCount <= 1) t += 5;
  if (driverCount >= 3) t -= 2;

  // 📍 Distance penalty
  if (nearestMiles > 5) t += 3;

  // ⏳ Long wait penalty
  if (t > 20) t += 3;

  // 🔒 Clamp (important)
  return Math.max(5, Math.min(t, 25));
}