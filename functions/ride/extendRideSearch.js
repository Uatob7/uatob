const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

const db = admin.firestore();

exports.extendRideSearch = onCall(
  {
    region: "us-east1",
  },
  async (request) => {
    const { rideId, uid } = request.data;

    if (!rideId || !uid) {
      throw new HttpsError("invalid-argument", "rideId and uid are required.");
    }

    const rideRef  = db.collection("Rides").doc(rideId);
    const rideSnap = await rideRef.get();

    if (!rideSnap.exists) {
      throw new HttpsError("not-found", "Ride not found.");
    }

    const ride = rideSnap.data();

    if (ride.uid !== uid) {
      throw new HttpsError("permission-denied", "Not your ride.");
    }

    if (["cancelled", "completed", "driver_assigned"].includes(ride.status)) {
      return { success: true, message: "Ride already resolved." };
    }

    const now           = new Date();
    const newExpiresAt  = new Date(now.getTime() + 7 * 60 * 1000);

    await rideRef.update({
      status:         "searching_driver",
      createdAt:      now,
      timedOutAt:     null,
      searchExtended: admin.firestore.FieldValue.increment(1),
      updatedAt:      admin.firestore.FieldValue.serverTimestamp(),
      expiresAt:      newExpiresAt,
    });

    console.log(`[extendRideSearch] ✅ Ride ${rideId} extended — expiresAt: ${newExpiresAt.toISOString()}`);
    return { success: true };
  }
);
