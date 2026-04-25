const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// ── Approve driver ─────────────────────────────────────────────────────────
exports.approveDriver = onCall({ region: "us-east1" }, async (request) => {
  const { driverUid } = request.data ?? {};
  if (!driverUid) throw new HttpsError("invalid-argument", "Missing driverUid");

  const driverRef  = db.collection("Drivers").doc(driverUid);
  const driverSnap = await driverRef.get();
  if (!driverSnap.exists) throw new HttpsError("not-found", "Driver not found");

  await driverRef.update({
    status:     "approved",
    approvedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt:  admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`✅ Driver approved: ${driverUid}`);
  return { success: true, driverUid };
});

