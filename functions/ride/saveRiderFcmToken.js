const { onCall } = require("firebase-functions/v2/callable");
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

const db = admin.firestore();

// ── Save rider FCM token → Accounts/{uid} ──────────────────────────────────
exports.saveRiderFcmToken = onCall({ region: "us-east1" }, async (request) => {
  const { uid, token } = request.data;
  if (!uid)   throw new Error("Missing uid");
  if (!token) throw new Error("Missing token");

  await db.collection("Accounts").doc(uid).set(
    {
      fcmToken:   token,
      updatedAt:  admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return { success: true };
});

// ── Rider location ping → Rides/{rideId} ──────────────────────────────────
exports.riderLocation = onCall({ region: "us-east1" }, async (request) => {
  const { rideId, lat, lng } = request.data;
  if (!rideId)        throw new Error("Missing rideId");
  if (lat == null)    throw new Error("Missing lat");
  if (lng == null)    throw new Error("Missing lng");

  await db.collection("Rides").doc(rideId).update({
    riderLat:  lat,
    riderLng:  lng,
    riderPingAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
});