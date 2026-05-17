const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();

exports.saveDriverFcmToken = onCall(
  {
    region: "us-east1",
    invoker: "public",
  },
  async (request) => {
    const { driverId, token } = request.data || {};

    if (!driverId) {
      throw new HttpsError("invalid-argument", "Missing driverId");
    }

    if (!token) {
      throw new HttpsError("invalid-argument", "Missing token");
    }

    const driverRef = db.collection("Drivers").doc(driverId);
    const snap = await driverRef.get();

    if (!snap.exists) {
      throw new HttpsError("not-found", `Driver ${driverId} not found`);
    }

    const existingToken = snap.data()?.fcmToken;

    if (existingToken === token) {
      return { success: true, updated: false };
    }

    await driverRef.update({
      fcmToken: token,
      fcmTokenUpdatedAt:
        admin.firestore.FieldValue.serverTimestamp(),
      fcmTokenClearReason:
        admin.firestore.FieldValue.delete(),
      fcmTokenClearedAt:
        admin.firestore.FieldValue.delete(),
    });

    return { success: true, updated: true };
  }
);