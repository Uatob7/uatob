const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getMessaging } = require("firebase-admin/messaging");

if (!getApps().length) initializeApp();

exports.sendPushNotification = onCall({ region: "us-east1" }, async (request) => {
  const { token, title, body } = request.data;

  if (!token || !title) {
    throw new HttpsError("invalid-argument", "token and title are required");
  }

  await getMessaging().send({
    token,
    notification: { title, body: body ?? "" },
    android: { priority: "high" },
    apns:    { payload: { aps: { sound: "default" } } },
  });

  return { success: true };
});