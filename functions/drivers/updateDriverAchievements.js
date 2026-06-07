const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const db = getFirestore();

// ⚠️ Which field on a Ride identifies the DRIVER who completed it?
// Your ride doc shows `uid` (= rider, presumably) and NO `driverUid`.
// Set this to whatever you write when a driver completes a ride.
const RIDE_DRIVER_FIELD = "driverUid";

// "cash" | "cash app" | "cashapp" | "card" | "stripe" ... -> "cash" | "cashApp" | "card"
function normalizeMethod(raw) {
  const n = (raw ?? "").toString().toLowerCase().replace(/[\s_-]/g, "");
  if (!n) return null;
  if (n.includes("cashapp")) return "cashApp";  // must check before "cash"
  if (n.includes("cash"))    return "cash";
  if (n.includes("card") || n.includes("stripe") || n.includes("credit") || n.includes("debit"))
    return "card";
  return null;
}

exports.updateDriverAchievements = onDocumentUpdated(
  {
    document: "Rides/{rideId}",
    region: "us-east1", // matches your stack — see deploy note
  },
  async (event) => {
    const before = event.data.before.data();
    const after  = event.data.after.data();

    // Only fire on the transition INTO completed
    if (before.status === after.status) return;
    if (after.status !== "completed") return;

    const driverId = after[RIDE_DRIVER_FIELD];
    if (!driverId) return;

    const driverRef  = db.collection("Drivers").doc(driverId);
    const driverSnap = await driverRef.get();
    if (!driverSnap.exists) return;

    const driver       = driverSnap.data();
    const achievements = driver.achievements || {};

    // ── Recompute counts from the source of truth (all completed rides) ──
    const completedSnap = await db
      .collection("Rides")
      .where(RIDE_DRIVER_FIELD, "==", driverId)
      .where("status", "==", "completed")
      .get();

    // Safety: the ride that just completed MUST be in here. If it isn't,
    // RIDE_DRIVER_FIELD is wrong — bail instead of zeroing out their counts.
    if (completedSnap.empty) {
      console.warn(
        `[achievements] 0 completed rides for ${RIDE_DRIVER_FIELD}==${driverId}. ` +
        `Wrong driver field? Skipping write to avoid wiping counts.`
      );
      return;
    }

    let totalRides = 0, cashRides = 0, cashAppRides = 0, cardRides = 0;
    completedSnap.forEach((doc) => {
      totalRides++;
      const m = normalizeMethod(doc.data().paymentMethod);
      if (m === "cash")    cashRides++;
      else if (m === "cashApp") cashAppRides++;
      else if (m === "card")    cardRides++;
    });

    const updates = {
      totalRides,
      cashRides,
      cashAppRides,
      cardRides,
      achievementsSyncedAt: FieldValue.serverTimestamp(),
    };

    // Write-once boolean achievements
    const unlock = (key, cond) => {
      if (cond && !achievements[key]) updates[`achievements.${key}`] = true;
    };

    unlock("firstRide",           totalRides   >= 1);
    unlock("hundredRides",        totalRides   >= 100);
    unlock("hundredCashRides",    cashRides    >= 100);
    unlock("hundredCashAppRides", cashAppRides >= 100);
    unlock("hundredCardRides",    cardRides    >= 100);

    // Reviews (computed elsewhere — just read + gate the badges)
    const totalReviews = driver.totalReviews  || 0;
    const avgRating    = driver.averageRating || 0;
    unlock("firstReview",    totalReviews >= 1);
    unlock("fiveStarDriver", avgRating >= 4.8 && totalReviews >= 10);

    // Deposit — driver-level flag already on the doc (deposit: true)
    unlock("depositMade", driver.deposit === true);

    // Monthly earnings — kept as increment (your existing bucket)
    const ridePayout = Number(after.driverPayout || 0);
    const newMonthly = (driver.earnings?.month?.earnings || 0) + ridePayout;
    updates["earnings.month.earnings"] = FieldValue.increment(ridePayout);
    unlock("earningsMilestone10", newMonthly >= 10);

    await driverRef.update(updates);
  }
);