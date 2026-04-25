const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.reassignRide = onCall({ region: "us-east1" }, async (request) => {
  const { rideId, driverUid } = request.data ?? {};
  if (!rideId || !driverUid) {
    throw new HttpsError("invalid-argument", "Missing rideId or driverUid");
  }

  const rideRef  = db.collection("Rides").doc(rideId);
  const rideSnap = await rideRef.get();
  if (!rideSnap.exists) throw new HttpsError("not-found", "Ride not found");

  const ride = rideSnap.data();
  if (ride.driverUid !== driverUid) {
    throw new HttpsError("permission-denied", "You are not assigned to this ride");
  }
  if (ride.status !== "driver_assigned") {
    throw new HttpsError("failed-precondition", "Ride can only be reassigned before pickup");
  }

  const now   = admin.firestore.Timestamp.now();
  const batch = db.batch();

  // ── Decline log entry stored on the ride doc itself ─────────────
  const declineEntry = {
    driverUid,
    reason:    "reassigned",
    createdAt: now,
  };

  // 1. Clear assignment, put back into search pool, append decline log
  batch.update(rideRef, {
    status:                "searching_driver",
    driverUid:             admin.firestore.FieldValue.delete(),
    driverLat:             admin.firestore.FieldValue.delete(),
    driverLng:             admin.firestore.FieldValue.delete(),
    driverDistanceMiles:   admin.firestore.FieldValue.delete(),
    driverEtaMin:          admin.firestore.FieldValue.delete(),
    acceptedAt:            admin.firestore.FieldValue.delete(),
    reassignedAt:          now,
    reassignedFrom:        driverUid,
    declinedDrivers:       admin.firestore.FieldValue.arrayUnion(driverUid),
    candidateDriverUids:   admin.firestore.FieldValue.arrayRemove(driverUid),
    declineLog:            admin.firestore.FieldValue.arrayUnion(declineEntry),
    expiresAt:             admin.firestore.Timestamp.fromMillis(Date.now() + 15 * 60 * 1000),
    updatedAt:             now,
  });

  // 2. Free up the driver's trip flag
  batch.update(db.collection("Drivers").doc(driverUid), {
    trip:      false,
    updatedAt: now,
  });

  await batch.commit();

  console.log(`🔄 [reassignRide] ride=${rideId} driver=${driverUid} returned to pool`);

  return { success: true, rideId };
});