const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();

exports.saveRiderFcmToken = onCall(
  {
    region: "us-east1",
  },
  async (request) => {
    // ✅ Auth check FIRST (before destructuring)
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "User must be authenticated");
    }

    const authUid = request.auth.uid;
    const { uid, token } = request.data || {};

    // ✅ Enforce UID match
    if (uid !== authUid) {
      throw new HttpsError("permission-denied", "UID mismatch");
    }

    // ✅ Validate inputs
    if (!uid || typeof uid !== "string") {
      throw new HttpsError("invalid-argument", "Invalid uid");
    }

    if (!token || typeof token !== "string") {
      throw new HttpsError("invalid-argument", "Invalid token");
    }

    try {
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
      throw new HttpsError("internal", error.message || "Unknown error");
    }
  }
);