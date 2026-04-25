const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const Stripe = require("stripe");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.processWithdrawal = onCall(
  { region: "us-east1", secrets: ["STRIPE_SECRET_KEY"] },
  async (request) => {
    try {
      const { uid } = request.data || {};
      if (!uid) throw new HttpsError("invalid-argument", "Missing uid");

      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

      // ── Fetch driver doc ──────────────────────────────────────
      const driverRef  = db.collection("Drivers").doc(uid);
      const driverSnap = await driverRef.get();
      if (!driverSnap.exists) throw new HttpsError("not-found", "Driver not found");

      const driver    = driverSnap.data();
      const withdrawal = driver.withdrawal;
      const accountId  = driver.accountId;

      if (!withdrawal)            throw new HttpsError("failed-precondition", "No withdrawal record on driver");
      if (withdrawal.status === "paid")       throw new HttpsError("failed-precondition", "Withdrawal already paid");
      if (withdrawal.status === "processing") throw new HttpsError("failed-precondition", "Withdrawal already processing");
      if (!accountId)             throw new HttpsError("failed-precondition", "Driver has no Stripe account");

      const rideIds     = withdrawal.rideIds ?? [];
      const totalPayout = withdrawal.totalPayout;

      if (rideIds.length === 0)         throw new HttpsError("failed-precondition", "No ride IDs on withdrawal");
      if (!totalPayout || totalPayout <= 0) throw new HttpsError("failed-precondition", "Invalid payout amount");

      // ── Lock withdrawal before Stripe call ───────────────────
      await driverRef.update({
        "withdrawal.status":    "processing",
        "withdrawal.updatedAt": admin.firestore.Timestamp.now(),
      });

      // ── Stripe transfer ───────────────────────────────────────
      const transfer = await stripe.transfers.create({
        amount:      Math.round(totalPayout * 100),
        currency:    "usd",
        destination: accountId,
        description: `UaTob payout — ${rideIds.length} ride(s)`,
        metadata:    { uid, rideIds: rideIds.join(",") },
      });

      console.log(`[processWithdrawal] transferId=${transfer.id} amount=$${totalPayout}`);

      // ── Firestore batch update ────────────────────────────────
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
        updatedAt: now,
      });

      await batch.commit();

      return {
        success:     true,
        uid,
        totalPayout,
        rideCount:   rideIds.length,
        transferId:  transfer.id,
        paidAt:      now.toDate().toISOString(),
      };

    } catch (err) {
      console.error("[processWithdrawal]", err);
      if (err instanceof HttpsError) throw err;
      throw new HttpsError("internal", err.message || "Internal error");
    }
  }
);