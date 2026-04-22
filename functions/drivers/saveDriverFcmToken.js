const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore }       = require("firebase-admin/firestore");

exports.saveDriverFcmToken = onCall(
  { region: "us-east1" },
  async (request) => {
    const { driverId, token } = request.data;

    if (!driverId || typeof driverId !== "string" || !driverId.trim())
      throw new HttpsError("invalid-argument", "Missing or invalid driverId.");

    if (!token || typeof token !== "string" || !token.trim())
      throw new HttpsError("invalid-argument", "Missing or invalid FCM token.");

    const db      = getFirestore();
    const driverRef = db.collection("Drivers").doc(driverId);
    const snap    = await driverRef.get();

    if (!snap.exists)
      throw new HttpsError("not-found", `Driver ${driverId} not found.`);

    await driverRef.update({
      fcmToken:          token.trim(),
      fcmTokenUpdatedAt: new Date(),
    });

    console.log(`[saveDriverFcmToken] Token saved for driver ${driverId}`);
    return { success: true };
  }
);