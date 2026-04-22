const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ─────────────────────────────────────────────────────────
exports.acceptRide = onCall(
  { region: "us-east1" },
  async (request) => {
    try {
      const { rideId, uid } = request.data || {};

      console.log(`[acceptRide] ride=${rideId} driver=${uid}`);

      if (!rideId || !uid) {
        throw new HttpsError(
          "invalid-argument",
          "Missing rideId or uid"
        );
      }

      const rideRef = db.collection("Rides").doc(rideId);

      await db.runTransaction(async (tx) => {
        const snap = await tx.get(rideRef);

        if (!snap.exists) {
          throw new HttpsError("not-found", "Ride not found");
        }

        const ride = snap.data();

        // 🚨 HARD LOCK: prevent double assignment
        if (ride.status !== "searching_driver") {
          throw new HttpsError(
            "failed-precondition",
            "Ride already claimed"
          );
        }

        if (ride.driverUid) {
          throw new HttpsError(
            "failed-precondition",
            "Ride already assigned to a driver"
          );
        }

        tx.update(rideRef, {
          status: "driver_assigned",
          driverUid: uid,
          acceptedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });

      return {
        success: true,
        message: "Ride accepted",
      };
    } catch (err) {
      console.error("[acceptRide]", err);

      if (err instanceof HttpsError) throw err;

      throw new HttpsError(
        "internal",
        err.message || "Failed to accept ride"
      );
    }
  }
);