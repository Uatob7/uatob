const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");
const { getFirestore } = require("firebase-admin/firestore");

if (!getApps().length) initializeApp();

exports.sendPushNotification = onCall({ region: "us-east1" }, async (request) => {
  const { driverId, title, body } = request.data;

  if (!driverId || !title) {
    throw new HttpsError("invalid-argument", "driverId and title are required");
  }

  const db    = getFirestore();
  const doc   = await db.collection("drivers").doc(driverId).get();
  const token = doc.data()?.fcmToken;

  if (!token) {
    throw new HttpsError("not-found", "No FCM token found for this driver");
  }

  await getMessaging().send({
    token,
    notification: { title, body: body ?? "" },
    android: { priority: "high" },
    apns:    { payload: { aps: { sound: "default" } } },
  });

  return { success: true };
});