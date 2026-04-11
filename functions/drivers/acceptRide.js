const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors")({ origin: true });
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();
const { FieldValue } = require("firebase-admin/firestore");

exports.acceptRide = onRequest(
  { region: "us-central1" },
  async (req, res) => {
    cors(req, res, async () => {
      if (req.method !== "POST") {
        return res.status(405).json({ success: false });
      }

      try {
        const { rideId, uid } = req.body;

        console.log(`[acceptRide] Attempting to accept ride ${rideId} for driver ${uid}`);

        if (!rideId || !uid) {
          return res.status(400).json({
            success: false,
            message: "Missing rideId or uid",
          });
        }

        const rideRef = db.collection("Rides").doc(rideId);

        await db.runTransaction(async (tx) => {
          const rideSnap = await tx.get(rideRef);

          if (!rideSnap.exists) {
            throw new Error("Ride not found");
          }

          const ride = rideSnap.data();

          if (ride.status !== "searching_driver") {
            throw new Error("Ride already claimed");
          }

          tx.update(rideRef, {
            status: "driver_assigned",
            driverUid: uid,
            acceptedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
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