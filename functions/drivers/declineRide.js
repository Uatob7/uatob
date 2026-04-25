const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();

exports.declineRide = onCall(
  { region: "us-east1" },
  async (request) => {
    try {
      const { rideId, uid } = request.data || {};

      if (!rideId || !uid) {
        throw new HttpsError("invalid-argument", "Missing rideId or uid");
      }

      await db.collection("Rides").doc(rideId).update({
        declinedBy: FieldValue.arrayUnion(uid),
        updatedAt: FieldValue.serverTimestamp(),
      });

      return { success: true, message: "Ride declined" };
    } catch (err) {
      console.error("[declineRide]", err);
      if (err instanceof HttpsError) throw err;
      throw new HttpsError("internal", err.message || "Failed to decline ride");
    }
  }
);