const functions = require("firebase-functions");
const cors = require("cors")({ origin: true });
const admin = require("firebase-admin");


const db = admin.firestore();

exports.cardPayment = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {

    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    try {
      const { fareData } = req.body;

      if (!fareData?.total) {
        return res.status(400).json({ success: false, message: "Missing fareData.total" });
      }

      const rideRef = db.collection("Rides").doc();

      await rideRef.set({
        pickup:            fareData.pickup            ?? null,
        dropoff:           fareData.dropoff           ?? null,
        rideType:          fareData.rideType          ?? "standard",
        fareTotal:         Number(fareData.total),
        fareMiles:         fareData.miles             ?? fareData.tripDistanceMiles ?? null,
        fareDurationMin:   fareData.durationMin       ?? fareData.tripDurationMin   ?? null,
        fareBreakdown:     fareData.breakdown         ?? null,
        surgeMultiplier:   fareData.surgeMultiplier   ?? 1,
        tripDistanceMiles: fareData.tripDistanceMiles ?? null,
        tripDurationMin:   fareData.tripDurationMin   ?? null,
        paymentMethod:     "card",
        status:            "searching_driver",
        createdAt:         admin.firestore.FieldValue.serverTimestamp(),
        updatedAt:         admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`[cardPayment] Ride ${rideRef.id} created.`);

      return res.status(200).json({ success: true, rideId: rideRef.id });

    } catch (err) {
      console.error("[cardPayment] Error:", err);
      return res.status(500).json({ success: false, message: err.message || "Internal server error" });
    }
  });
});