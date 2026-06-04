const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

if (!getApps().length) initializeApp();
const db = getFirestore();

exports.updateAccountPresence = onCall(
  {
    region: "us-east1",
  },
  async (request) => {
    try {
      const { uid } = request.data ?? {};

      if (!uid?.trim()) {
        throw new HttpsError("invalid-argument", "uid is required");
      }

      const driverUid = uid.trim();

      // ── Check Drivers first ────────────────────────────
      const driverRef = db.collection("Drivers").doc(driverUid);
      const driverSnap = await driverRef.get();

      if (driverSnap.exists()) {
        await driverRef.set(
          { presenceUpdatedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
        return { ok: true, collection: "Drivers", uid: driverUid };
      }

      // ── Fall back to Accounts ──────────────────────────
      const accountRef = db.collection("Accounts").doc(driverUid);
      const accountSnap = await accountRef.get();

      if (accountSnap.exists()) {
        await accountRef.set(
          { presenceUpdatedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
        return { ok: true, collection: "Accounts", uid: driverUid };
      }

      // ── Not found in either ────────────────────────────
      throw new HttpsError("not-found", "No Driver or Account found for this uid");
    } catch (err) {
      console.error("❌ updateAccountPresence error:", err);
      if (err instanceof HttpsError) throw err;
      throw new HttpsError("internal", err.message || "Internal error");
    }
  }
);