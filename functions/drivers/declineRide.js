const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors")({ origin: true });
const admin = require("firebase-admin");

const db = admin.firestore();

exports.declineRide = onRequest(
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

        // Optional: store declines for analytics
        await db.collection("RideDeclines").add({
          rideId,
          driverUid,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return res.status(200).json({
          success: true,
          message: "Ride declined",
        });

      } catch (err) {
        console.error("[declineRide]", err);
        return res.status(500).json({
          success: false,
          message: err.message,
        });
      }
    });
  }
);