const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * deleteDriverAccount
 *
 * Callable function that allows a driver to delete their own account.
 * Only the driver (verified by auth context) can delete their own account.
 *
 * This includes:
 *   1. Delete the driver document from the Drivers collection
 *   2. Remove driver references from any active/completed rides
 *   3. Delete any reviews associated with the driver
 *   4. Delete the Firebase Auth user record
 *   5. Log the deletion for audit purposes
 *
 * Returns:
 *   { success: true, driverUid, driverName, deletedCounts: { rides, reviews } }
 */
exports.deleteDriverAccount = onCall({ region: "us-east1" }, async (request) => {
  try {
    // ── Authorization: Only allow users to delete their own account ────────
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError("unauthenticated", "You must be logged in");
    }

    const driverUid = request.auth.uid;

    // ── Validate driver exists ─────────────────────────────────────────────
    const driverRef  = db.collection("Drivers").doc(driverUid);
    const driverSnap = await driverRef.get();

    if (!driverSnap.exists) {
      throw new HttpsError("not-found", "Driver account not found");
    }

    const driverData = driverSnap.data();
    const driverName =
      `${driverData.firstName || ""} ${driverData.lastName || ""}`.trim() || driverUid;

    // ── Find and clean up rides with this driver ───────────────────────────
    let ridesDeleted = 0;
    const ridesSnapshot = await db
      .collection("Rides")
      .where("driverUid", "==", driverUid)
      .get();

    if (!ridesSnapshot.empty) {
      const batch = db.batch();
      ridesSnapshot.docs.forEach((rideDoc) => {
        batch.update(rideDoc.ref, {
          driverUid:        null,
          driverName:       null,
          status:           rideDoc.data().status === "in_progress"
                              ? "cancelled"
                              : rideDoc.data().status,
          updatedAt:        admin.firestore.FieldValue.serverTimestamp(),
          reason_cancelled: "Driver account deleted",
        });
        ridesDeleted++;
      });
      await batch.commit();
      console.log(`✅ Updated ${ridesDeleted} rides for deleted driver: ${driverUid}`);
    }

    // ── Find and delete reviews for this driver ────────────────────────────
    let reviewsDeleted = 0;
    const reviewsSnapshot = await db
      .collection("Reviews")
      .where("driverUid", "==", driverUid)
      .get();

    if (!reviewsSnapshot.empty) {
      const batch = db.batch();
      reviewsSnapshot.docs.forEach((reviewDoc) => {
        batch.delete(reviewDoc.ref);
        reviewsDeleted++;
      });
      await batch.commit();
      console.log(`✅ Deleted ${reviewsDeleted} reviews for driver: ${driverUid}`);
    }

    // ── Delete the Firestore driver document ──────────────────────────────
    await driverRef.delete();
    console.log(`✅ Driver Firestore doc deleted: ${driverUid} (${driverName})`);

    // ── Delete the Firebase Auth user record ──────────────────────────────
    await admin.auth().deleteUser(driverUid);
    console.log(`✅ Firebase Auth user deleted: ${driverUid}`);

    // ── Audit log ─────────────────────────────────────────────────────────
    await db.collection("Admin").doc("deletionLog").collection("drivers").add({
      driverUid,
      driverName,
      email:         driverData.email         || null,
      phone:         driverData.phone         || driverData.contact?.phone || null,
      deletedAt:     admin.firestore.FieldValue.serverTimestamp(),
      deletedCounts: { rides: ridesDeleted, reviews: reviewsDeleted },
    });

    return {
      success: true,
      driverUid,
      driverName,
      deletedCounts: {
        rides:   ridesDeleted,
        reviews: reviewsDeleted,
      },
    };
  } catch (err) {
    console.error("❌ deleteDriverAccount error:", err);
    if (err instanceof HttpsError) throw err;
    throw new HttpsError("internal", err.message || "Failed to delete account");
  }
});