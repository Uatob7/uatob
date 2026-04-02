const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors")({ origin: true });
const admin = require("firebase-admin");

const db = admin.firestore();

// ─────────────────────────────────────────────────────────
exports.updateTripStatus = onRequest(
  { region: "us-central1" },
  async (req, res) => {
    return cors(req, res, async () => {
      if (req.method !== "POST") {
        return res.status(405).json({ success: false });
      }

      try {
        const { rideId, driverUid, action } = req.body;

        if (!rideId || !driverUid || !action) {
          return res.status(400).json({
            success: false,
            message: "Missing rideId, driverUid, or action",
          });
        }

        const rideRef = db.collection("Rides").doc(rideId);

        await db.runTransaction(async (tx) => {
          const snap = await tx.get(rideRef);

          if (!snap.exists) throw new Error("Ride not found");

          const ride = snap.data();

          // 🔐 Ensure correct driver
          if (ride.driverUid !== driverUid) {
            throw new Error("Unauthorized driver");
          }

          let newStatus = ride.status;

          // ── STATE MACHINE ───────────────────────────────
          if (action === "arrive") {
            if (ride.status !== "driver_assigned") {
              throw new Error("Invalid transition to arrived");
            }
            newStatus = "arrived";
          }

          else if (action === "start") {
            if (ride.status !== "arrived") {
              throw new Error("Invalid transition to in_progress");
            }
            newStatus = "in_progress";
          }

          else if (action === "complete") {
            if (ride.status !== "in_progress") {
              throw new Error("Invalid transition to completed");
            }
            newStatus = "completed";
          }

          else {
            throw new Error("Invalid action");
          }

          tx.update(rideRef, {
            status: newStatus,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),

            ...(action === "arrive" && {
              arrivedAt: admin.firestore.FieldValue.serverTimestamp(),
            }),

            ...(action === "start" && {
              startedAt: admin.firestore.FieldValue.serverTimestamp(),
            }),

            ...(action === "complete" && {
              completedAt: admin.firestore.FieldValue.serverTimestamp(),
            }),
          });
        });

        return res.status(200).json({
          success: true,
          message: `Trip updated: ${action}`,
        });

      } catch (err) {
        console.error("[updateTripStatus]", err);
        return res.status(500).json({
          success: false,
          message: err.message,
        });
      }
    });
  }
);