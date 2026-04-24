const { onCall } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

const db = admin.firestore();

exports.saveAdminFcmToken = onCall({ region: "us-east1" }, async (request) => {
  const { token } = request.data;
  if (!token) throw new Error("Missing token");

  await db.collection("AdminTokens").doc("push").set(
    { tokens: admin.firestore.FieldValue.arrayUnion(token), updatedAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );

  return { success: true };
});