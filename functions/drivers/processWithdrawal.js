const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors")({ origin: true });
const admin = require("firebase-admin");
const Stripe = require("stripe");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.processWithdrawal = onRequest(
  {
    region: "us-central1",
    secrets: ["STRIPE_SECRET_KEY"],
  },
  (req, res) => {
    cors(req, res, async () => {
      try {
        if (req.method !== "POST") {
          return res.status(405).json({ success: false, error: "Method not allowed" });
        }

        const { uid } = req.body || {};
        if (!uid) {
          return res.status(400).json({ success: false, error: "Missing uid" });
        }

        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

        // ── Fetch driver doc ──────────────────────────────────────
        const driverRef  = db.collection("Drivers").doc(uid);
        const driverSnap = await driverRef.get();

        if (!driverSnap.exists) {
          return res.status(404).json({ success: false, error: "Driver not found" });
        }

        const driver     = driverSnap.data();
        const withdrawal = driver.withdrawal;
        const accountId  = driver.accountId;

        if (!withdrawal) {
          return res.status(400).json({ success: false, error: "No withdrawal record on driver" });
        }
        if (withdrawal.status === "paid") {
          return res.status(400).json({ success: false, error: "Withdrawal already paid" });
        }
        if (!accountId) {
          return res.status(400).json({ success: false, error: "Driver has no Stripe account" });
        }

        const rideIds = withdrawal.rideIds ?? [];
        if (rideIds.length === 0) {
          return res.status(400).json({ success: false, error: "No ride IDs on withdrawal" });
        }

        const totalPayout = withdrawal.totalPayout;
        if (!totalPayout || totalPayout <= 0) {
          return res.status(400).json({ success: false, error: "Invalid payout amount" });
        }

        // ── Stripe transfer: platform → driver ───────────────────
        // amount must be in cents
        const transfer = await stripe.transfers.create({
          amount:      Math.round(totalPayout * 100),
          currency:    "usd",
          destination: accountId,
          description: `UaTob payout — ${rideIds.length} ride(s)`,
          metadata: {
            uid,
            rideIds: rideIds.join(","),
          },
        });

        console.log(`[processWithdrawal] Stripe transfer created — transferId: ${transfer.id} | amount: $${totalPayout} | destination: ${accountId}`);

        // ── Batch: mark rides paid + update driver withdrawal ─────
        const now   = admin.firestore.Timestamp.now();
        const batch = db.batch();

        for (const rideId of rideIds) {
          batch.update(db.collection("Rides").doc(rideId), {
            payoutStatus: "paid",
            updatedAt:    now,
          });
        }

        batch.update(driverRef, {
          "withdrawal.status":     "paid",
          "withdrawal.paidAt":     now,
          "withdrawal.updatedAt":  now,
          "withdrawal.transferId": transfer.id,
          updatedAt:               now,
        });

        await batch.commit();

        console.log(`✅ [processWithdrawal] uid: ${uid} | $${totalPayout} | ${rideIds.length} ride(s) marked paid`);

        return res.status(200).json({
          success:     true,
          uid,
          totalPayout,
          rideCount:   rideIds.length,
          transferId:  transfer.id,
          paidAt:      now.toDate().toISOString(),
        });

      } catch (err) {
        console.error("❌ [processWithdrawal]", err);
        return res.status(500).json({ success: false, error: err.message || "Internal server error" });
      }
    });
  }
);