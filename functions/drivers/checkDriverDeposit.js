// File: functions/checkDriverDeposit.js
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const stripeLib = require("stripe");

const db = admin.firestore();

exports.checkDriverDeposit = onSchedule(
  {
    schedule: "* * * * *",
    region: "us-east1",
    timeZone: "America/New_York",
    secrets: ["STRIPE_SECRET_KEY"],
  },
  async () => {
    console.log("=== checkDriverDeposit START ===");
    try {
      const stripeSecret = process.env.STRIPE_SECRET_KEY;
      if (!stripeSecret) {
        console.error("[checkDriverDeposit] Missing STRIPE_SECRET_KEY");
        return;
      }
      const stripe = stripeLib(stripeSecret);

      const snapshot = await db
        .collection("Drivers")
        .where("accountId", "!=", null)
        .get();

      if (snapshot.empty) {
        console.log("[checkDriverDeposit] No drivers with accountId found.");
        return;
      }

      console.log(`[checkDriverDeposit] Checking ${snapshot.size} driver(s).`);

      let batch = db.batch();
      let count = 0;

      for (const doc of snapshot.docs) {
        const { accountId } = doc.data();

        try {
          const capability = await stripe.accounts.retrieveCapability(
            accountId,
            "transfers"
          );

          const deposit = capability.status === "active";

          batch.update(doc.ref, {
            deposit,
            depositCheckedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          count++;

          if (count === 500) {
            await batch.commit();
            batch = db.batch();
            count = 0;
          }
        } catch (err) {
          console.error(
            `[checkDriverDeposit] ❌ Failed for accountId ${accountId}:`,
            err.message
          );
        }
      }

      if (count > 0) await batch.commit();

      console.log("=== checkDriverDeposit END ===");
    } catch (err) {
      console.error("[checkDriverDeposit] ❌ Fatal error:", err);
    }
  }
);