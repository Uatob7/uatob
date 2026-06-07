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
        // 1. Determine correct start time
        // ─────────────────────────────────────────────

        let startTimeMs = null;

        if (ride.isScheduled && ride.scheduledAt) {
          // 🟢 Scheduled ride → timeout starts at scheduledAt
          startTimeMs = ride.scheduledAt.toMillis();
        } else if (ride.createdAt) {
          // 🟡 Immediate ride → timeout starts at createdAt
          startTimeMs = ride.createdAt.toMillis();
        } else {
          console.warn(`[rideTimeoutChecker] Missing start time: ${rideId}`);
          return;
        }

        // ─────────────────────────────────────────────
        // 2. Timeout calculation
        // ─────────────────────────────────────────────

        const etaMin = ride.driverInfo?.etaMin ?? 10;
        const timeoutMs = etaMin * 60 * 1000;

        const expiresAtMs = startTimeMs + timeoutMs;

        // ─────────────────────────────────────────────
        // 3. Store expiresAt once OR fix incorrect ones
        // ─────────────────────────────────────────────

        const shouldSetExpires =
          !ride.expiresAt ||
          ride.isScheduled; // 🔥 always correct scheduled rides

        if (shouldSetExpires) {
          await doc.ref.update({
            expiresAt: admin.firestore.Timestamp.fromMillis(expiresAtMs),
            timeoutMinutes: etaMin,
          });

          console.log(
            `[rideTimeoutChecker] 🧠 Set expiresAt for ${rideId}`
          );
        }

        // ─────────────────────────────────────────────
        // 4. Timeout check
        // ─────────────────────────────────────────────

        if (now < expiresAtMs) return;

        if (ride.status === "timeout") return;

        // ─────────────────────────────────────────────
        // 5. Timeout ride
        // ─────────────────────────────────────────────

        await doc.ref.update({
          status: "timeout",
          timedOutAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`⏱ Ride ${rideId} → TIMEOUT`);

      } catch (err) {
        console.error(
          `[rideTimeoutChecker] ❌ Error processing ${rideId}:`,
          err
        );
      }
    });

    await Promise.allSettled(updates);
  }
);