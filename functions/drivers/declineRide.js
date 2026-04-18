const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors")({ origin: true });

const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();

exports.declineRide = onRequest(
  { region: "us-central1" },
  (req, res) => {
    cors(req, res, async () => {
      if (req.method !== "POST") {
        return res.status(405).json({ success: false });
      }

      try {
        const { rideId, uid } = req.body;

        if (!rideId || !uid) {
          return res.status(400).json({
            success: false,
            message: "Missing rideId or uid",
          });
        }

        await db.collection("RideDeclines").add({
          rideId,
          uid,
          createdAt: FieldValue.serverTimestamp(),
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