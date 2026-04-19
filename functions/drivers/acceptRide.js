const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors")({ origin: true });

const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

exports.acceptRide = onRequest(
  { region: "us-central1" },
  (req, res) => {
    cors(req, res, async () => {
      if (req.method !== "POST") {
        return res.status(405).json({ success: false, message: "Method not allowed" });
      }

      try {
        const { rideId, uid } = req.body || {};

        console.log(`[acceptRide] ride=${rideId} driver=${uid}`);

        if (!rideId || !uid) {
          return res.status(400).json({
            success: false,
            message: "Missing rideId or uid",
          });
        }

        const rideRef = db.collection("Rides").doc(rideId);

        const result = await db.runTransaction(async (tx) => {
          const snap = await tx.get(rideRef);

          if (!snap.exists) {
            throw new Error("Ride not found");
          }

          const ride = snap.data();

          // 🚨 HARD LOCK: prevent double assignment
          if (ride.status !== "searching_driver") {
            throw new Error("Ride already claimed");
          }

          if (ride.driverUid) {
            throw new Error("Ride already assigned to a driver");
          }

          tx.update(rideRef, {
            status: "driver_assigned",
            driverUid: uid,
            acceptedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });

          return true;
        });

        return res.status(200).json({
          success: true,
          message: "Ride accepted",
        });
      } catch (err) {
        console.error("[acceptRide]", err);

        return res.status(409).json({
          success: false,
          message: err.message || "Failed to accept ride",
        });
      }
    });
  }
);