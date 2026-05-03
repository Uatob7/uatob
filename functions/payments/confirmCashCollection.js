const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

const db = admin.firestore();

exports.confirmCashCollection = onCall(
  { region: "us-east1" },
  async (request) => {
    const { rideId, driverUid } = request.data;

    if (!rideId)    throw new HttpsError("invalid-argument", "Missing rideId");
    if (!driverUid) throw new HttpsError("invalid-argument", "Missing driverUid");

    const rideRef  = db.collection("Rides").doc(rideId);
    const rideSnap = await rideRef.get();

    if (!rideSnap.exists) {
      throw new HttpsError("not-found", "Ride not found");
    }

    const ride = rideSnap.data();

    if (ride.driverUid !== driverUid) {
      throw new HttpsError("permission-denied", "Not your ride");
    }

    if (ride.paymentMethod !== "cash") {
      throw new HttpsError("failed-precondition", "Ride is not a cash ride");
    }

    if (ride.payoutStatus === "paid") {
      return { success: true, alreadyConfirmed: true };
    }

    await rideRef.update({
      payoutStatus:     "paid",
      paymentStatus:    "succeeded",
      cashCollectedAt:  admin.firestore.FieldValue.serverTimestamp(),
      updatedAt:        admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`[confirmCashCollection] Ride ${rideId} — cash confirmed by driver ${driverUid}`);

    return { success: true, alreadyConfirmed: false };
  }
);