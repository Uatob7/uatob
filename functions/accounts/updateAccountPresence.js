// functions/callable/updateAccountPresence.js

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

exports.updateAccountPresence = onCall(
  {
    region: "us-central1",
  },
  async (request) => {
    const { uid } = request.data || {};

    if (!uid || typeof uid !== "string") {
      throw new HttpsError("invalid-argument", "uid is required");
    }

    console.log("updateAccountPresence uid:", uid);

    try {
      // Check Drivers collection first
      const driverRef  = db.collection("Drivers").doc(uid);
      const driverSnap = await driverRef.get();

      if (driverSnap.exists) {
        await driverRef.set(
          { presenceUpdatedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
        return { ok: true, collection: "Drivers", uid };
      }

      // Check Accounts collection
      const accountRef  = db.collection("Accounts").doc(uid);
      const accountSnap = await accountRef.get();

      if (accountSnap.exists) {
        await accountRef.set(
          { presenceUpdatedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
        return { ok: true, collection: "Accounts", uid };
      }

      console.warn("updateAccountPresence: no doc found for uid:", uid);
      throw new HttpsError("not-found", `No document found for uid ${uid}`);
    } catch (error) {
      console.error("updateAccountPresence error:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Internal server error");
    }
  }
);