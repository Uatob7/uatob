const { onCall } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();

exports.saveAdminFcmToken = onCall({ region: "us-east1", allowUnauthorized: true }, async (request) => {
  const { token } = request.data;
  if (!token) throw new Error("Missing token");

  await db.collection("Admin").doc("push").set(
    {
      token: token,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { success: true };
});