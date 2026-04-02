const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors")({ origin: true });
const admin = require("firebase-admin");

const db = admin.firestore();

exports.acceptRide = onRequest(
  { region: "us-central1" },
  async (req, res) => {
    return cors(req, res, async () => {
      if (req.method !== "POST") {
        return res.status(405).json({ success: false });
      }

      try {
        const { rideId, driverUid } = req.body;

        if (!rideId || !driverUid) {
          return res.status(400).json({
            success: false,
            message: "Missing rideId or driverUid",
          });
        }

        const rideRef = db.collection("Rides").doc(rideId);

        // 🔒 TRANSACTION = prevents double-accept
        await db.runTransaction(async (tx) => {
          const rideSnap = await tx.get(rideRef);

          if (!rideSnap.exists) {
            throw new Error("Ride not found");
          }

          const ride = rideSnap.data();

          // ❌ Already taken
          if (ride.status !== "searching_driver") {
            throw new Error("Ride already claimed");
          }

          // ✅ Assign driver
          tx.update(rideRef, {
            status: "driver_assigned",
            driverUid: driverUid,
            acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        });

        return res.status(200).json({
          success: true,
          message: "Ride accepted",
        });

      } catch (err) {
        console.error("[acceptRide]", err);
        return res.status(500).json({
          success: false,
          message: err.message,
        });
      }
    });
  }
);