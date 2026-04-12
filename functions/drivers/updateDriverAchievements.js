const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const db = getFirestore();

exports.updateDriverAchievements = onDocumentUpdated(
  {
    document: "Rides/{rideId}",
    region: "us-central1",
  },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();

    const driverId = after.driverUid;
    if (!driverId) return;

    // 🚨 ONLY when ride completes
    if (before.status === after.status) return;
    if (after.status !== "completed") return;

    const driverRef = db.collection("Drivers").doc(driverId);

    const driverSnap = await driverRef.get();
    if (!driverSnap.exists) return;

    const driver = driverSnap.data();
    const achievements = driver.achievements || {};

    const ridePayout = Number(after.driverPayout || 0);

    const updates = {};

    // ─────────────────────────────
    // 🚗 TOTAL RIDES (SAFE INCREMENT)
    // ─────────────────────────────
    const newTotalRides = (driver.totalRides || 0) + 1;

    updates.totalRides = FieldValue.increment(1);

    if (newTotalRides === 1 && !achievements.firstRide) {
      updates["achievements.firstRide"] = true;
    }

    if (newTotalRides === 100 && !achievements.hundredRides) {
      updates["achievements.hundredRides"] = true;
    }

    // ─────────────────────────────
    // 💰 EARNINGS (SAFE INCREMENT)
    // ─────────────────────────────
    const newMonthlyEarnings =
      (driver.earnings?.month?.earnings || 0) + ridePayout;

    updates["earnings.month.earnings"] = FieldValue.increment(ridePayout);

    if (newMonthlyEarnings >= 10 && !achievements.earningsMilestone10) {
      updates["achievements.earningsMilestone10"] = true;
    }

    // ─────────────────────────────
    // ⭐ REVIEWS (DO NOT CALCULATE HERE)
    // ─────────────────────────────
    const totalReviews = driver.totalReviews || 0;
    const avgRating = driver.averageRating || 0;

    if (totalReviews >= 1 && !achievements.firstReview) {
      updates["achievements.firstReview"] = true;
    }

    if (
      avgRating >= 4.8 &&
      totalReviews >= 10 &&
      !achievements.fiveStarDriver
    ) {
      updates["achievements.fiveStarDriver"] = true;
    }

    // ─────────────────────────────
    // 🔥 APPLY UPDATE (ONLY IF NEEDED)
    // ─────────────────────────────
    if (Object.keys(updates).length === 0) return;

    await driverRef.update(updates);
  }
);