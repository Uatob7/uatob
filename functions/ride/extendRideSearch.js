const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

const db = admin.firestore();

exports.extendRideSearch = onRequest(
  {
    region: "us-central1",
    cors:   true,
  },
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { rideId, uid } = req.body;

    if (!rideId || !uid) {
      return res.status(400).json({ error: "rideId and uid are required." });
    }

    try {
      const rideRef  = db.collection("Rides").doc(rideId);
      const rideSnap = await rideRef.get();

      if (!rideSnap.exists) {
        return res.status(404).json({ error: "Ride not found." });
      }

      const ride = rideSnap.data();

      if (ride.uid !== uid) {
        return res.status(403).json({ error: "Not your ride." });
      }

      if (["cancelled", "completed", "driver_assigned"].includes(ride.status)) {
        return res.status(200).json({ success: true, message: "Ride already resolved." });
      }

      await rideRef.update({
        status:         "searching_driver",
        createdAt:      new Date(),
        timedOutAt:     null,
        searchExtended: admin.firestore.FieldValue.increment(1),
        updatedAt:      admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`[extendRideSearch] ✅ Ride ${rideId} extended by 7 minutes.`);
      return res.status(200).json({ success: true });

    } catch (err) {
      console.error(`[extendRideSearch] ❌ Unexpected error:`, err);
      return res.status(500).json({ error: "Internal server error." });
    }
  }
);