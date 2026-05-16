const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();

exports.saveRiderFcmToken = onCall(
  { region: "us-east1", allowUnauthorized: true },
  async (request) => {
    const { uid, token } = request.data || {};

    if (!uid || typeof uid !== "string") {
      throw new HttpsError("invalid-argument", "Missing or invalid uid");
    }

    if (!token || typeof token !== "string") {
      throw new HttpsError("invalid-argument", "Missing or invalid token");
    }

    await db.collection("Accounts").doc(uid).set(
      {
        token,
        tokenUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return { success: true };
  }
);