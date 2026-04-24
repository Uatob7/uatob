const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.saveRiderFcmToken = onCall(
  { region: "us-east1" },
  async (request) => {
    try {
      const { uid, token } = request.data;

      // Validate auth
      if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be authenticated");
      }

      // Ensure user can only update their own token
      if (request.auth.uid !== uid) {
        throw new HttpsError("permission-denied", "UID mismatch");
      }

      // Validate inputs
      if (!uid || typeof uid !== "string") {
        throw new HttpsError("invalid-argument", "Invalid uid");
      }

      if (!token || typeof token !== "string") {
        throw new HttpsError("invalid-argument", "Invalid token");
      }

      await db.collection("Accounts").doc(uid).set(
        {
          fcmToken: token,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return { success: true };

    } catch (error) {
      console.error("saveRiderFcmToken error:", error);

      if (error instanceof HttpsError) throw error;

      throw new HttpsError("internal", error.message);
    }
  }
);