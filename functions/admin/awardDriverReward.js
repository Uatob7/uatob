const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// ── Award reward to driver ─────────────────────────────────────────────────
exports.awardDriverReward = onCall(
  { region: "us-east1" },
  async (request) => {
    // ── Auth check ─────────────────────────────────────
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Must be signed in");
    }

    const { driverUid, amount, note } = request.data ?? {};

    // ── Validate inputs ────────────────────────────────
    if (!driverUid || typeof driverUid !== "string") {
      throw new HttpsError("invalid-argument", "Missing or invalid driverUid");
    }
    if (typeof amount !== "number" || amount <= 0 || amount > 500) {
      throw new HttpsError(
        "invalid-argument",
        "Amount must be a number between $0.01 and $500"
      );
    }
    if (note !== null && note !== undefined && typeof note !== "string") {
      throw new HttpsError("invalid-argument", "Note must be a string");
    }

    const driverRef = db.collection("Drivers").doc(driverUid);
    const driverSnap = await driverRef.get();

    if (!driverSnap.exists) {
      throw new HttpsError("not-found", "Driver not found");
    }

    const driver = driverSnap.data();
    const currentBalance = driver.rewardsBalance ?? 0;
    const rewards = Array.isArray(driver.rewards) ? driver.rewards : [];

    // ── Create reward object ───────────────────────────
    const rewardId = db.collection("_").doc().id; // Generate unique ID
    const newReward = {
      id: rewardId,
      awardedAt: admin.firestore.FieldValue.serverTimestamp(),
      description: note?.trim() || "Admin reward",
      amount: amount,
    };

    // ── Update driver document ─────────────────────────
    await driverRef.update({
      rewards: [...rewards, newReward],
      rewardsBalance: currentBalance + amount,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(
      `✨ Reward awarded: $${amount} to driver ${driverUid} (note: "${newReward.description}")`
    );

    return {
      success: true,
      driverUid,
      rewardId,
      amount,
      newBalance: currentBalance + amount,
    };
  }
);
