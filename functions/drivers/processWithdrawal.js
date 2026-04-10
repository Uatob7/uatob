const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors")({ origin: true });
const admin = require("firebase-admin");

const db = admin.firestore();

/**
 * POST /processWithdrawal
 *
 * Body: { uid: "A2CHlcpkqqasNuSg0uvgQ3RNAkf2" }
 *
 * 1. Fetches Drivers/{uid} and reads withdrawal map
 * 2. Validates withdrawal exists and status is "pending"
 * 3. Fetches all rideIds from withdrawal.rideIds
 * 4. Sets each ride payoutStatus → "paid"
 * 5. Sets driver withdrawal.status → "paid"
 */
exports.processWithdrawal = onRequest((req, res) => {
  cors(req, res, async () => {
    try {
      if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
      }

      const { uid } = req.body || {};

      if (!uid) {
        return res.status(400).json({ success: false, error: "Missing uid" });
      }

      // ── Fetch driver doc ────────────────────────────────────────
      const driverRef  = db.collection("Drivers").doc(uid);
      const driverSnap = await driverRef.get();

      if (!driverSnap.exists) {
        return res.status(404).json({ success: false, error: "Driver not found" });
      }

      const driver     = driverSnap.data();
      const withdrawal = driver.withdrawal;

      if (!withdrawal) {
        return res.status(400).json({ success: false, error: "No withdrawal record on driver" });
      }

      if (withdrawal.status === "paid") {
        return res.status(400).json({ success: false, error: "Withdrawal already paid" });
      }

      const rideIds = withdrawal.rideIds ?? [];

      if (rideIds.length === 0) {
        return res.status(400).json({ success: false, error: "No ride IDs on withdrawal" });
      }

      // ── Batch: mark all rides as paid + update driver withdrawal ─
      const now   = admin.firestore.Timestamp.now();
      const batch = db.batch();

      for (const rideId of rideIds) {
        batch.update(db.collection("Rides").doc(rideId), {
          payoutStatus: "paid",
          updatedAt:    now,
        });
      }

      batch.update(driverRef, {
        "withdrawal.status":    "paid",
        "withdrawal.paidAt":    now,
        "withdrawal.updatedAt": now,
        updatedAt:              now,
      });

      await batch.commit();

      console.log(`✅ [processWithdrawal] uid: ${uid} | $${withdrawal.totalPayout} | ${rideIds.length} ride(s) marked paid`);

      return res.status(200).json({
        success:     true,
        uid,
        totalPayout: withdrawal.totalPayout,
        rideCount:   rideIds.length,
        paidAt:      now.toDate().toISOString(),
      });

    } catch (err) {
      console.error("❌ [processWithdrawal]", err);
      return res.status(500).json({ success: false, error: err.message || "Internal server error" });
    }
  });
});