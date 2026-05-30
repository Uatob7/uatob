const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.createAccount = onCall(
  { region: "us-east1", invoker: "public" },
  async (request) => {
    const { uid, email, name } = request.data || {};

    if (!uid || typeof uid !== "string")
      throw new HttpsError("invalid-argument", "Missing or invalid uid");

    console.log(`[createAccount] UID: ${uid}, Email: ${email}, Name: ${name}`);

    
    try {
      await db.collection("Accounts").doc(uid).set(
        {
          uid,
          email: email ?? null,
          name:  name  ?? null,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      console.log(`[createAccount] Account saved — UID: ${uid}`);
      return { success: true, uid };
    } catch (err) {
      console.error("[createAccount] Error:", err);
      throw new HttpsError("internal", err.message || "Internal server error");
    }
  }
);