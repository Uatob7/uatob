const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

const db = admin.firestore();

// ─────────────────────────────────────────────────────────
exports.updateTripStatus = onCall(
  { region: "us-east1" },
  async (request) => {
    try {
      const { rideId, driverUid, action } = request.data || {};

      if (!rideId || !driverUid || !action) {
        throw new HttpsError(
          "invalid-argument",
          "Missing rideId, driverUid, or action"
        );
      }

      const rideRef = db.collection("Rides").doc(rideId);

      await db.runTransaction(async (tx) => {
        const snap = await tx.get(rideRef);

        if (!snap.exists) {
          throw new HttpsError("not-found", "Ride not found");
        }

        const ride = snap.data();

        // 🔐 Ensure correct driver
        if (ride.driverUid !== driverUid) {
          throw new HttpsError("permission-denied", "Unauthorized driver");
        }

        let newStatus = ride.status;

        // ── STATE MACHINE ───────────────────────────────
        if (action === "arrive") {
          if (ride.status !== "driver_assigned") {
            throw new HttpsError(
              "failed-precondition",
              "Invalid transition to arrived"
            );
          }
          newStatus = "arrived";
        } else if (action === "start") {
          if (ride.status !== "arrived") {
            throw new HttpsError(
              "failed-precondition",
              "Invalid transition to in_progress"
            );
          }
          newStatus = "in_progress";
        } else if (action === "complete") {
          if (ride.status !== "in_progress") {
            throw new HttpsError(
              "failed-precondition",
              "Invalid transition to completed"
            );
          }
          newStatus = "completed";
        } else {
          throw new HttpsError("invalid-argument", "Invalid action");
        }

        const update = {
          status: newStatus,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (action === "arrive") {
          update.arrivedAt = admin.firestore.FieldValue.serverTimestamp();
        }

        if (action === "start") {
          update.startedAt = admin.firestore.FieldValue.serverTimestamp();
        }

        if (action === "complete") {
          update.completedAt = admin.firestore.FieldValue.serverTimestamp();
        }

        tx.update(rideRef, update);
      });

      return {
        success: true,
        message: `Trip updated: ${action}`,
      };
    } catch (err) {
      console.error("[updateTripStatus]", err);

      if (err instanceof HttpsError) throw err;

      throw new HttpsError(
        "internal",
        err.message || "Failed to update trip"
      );
    }
  }
);