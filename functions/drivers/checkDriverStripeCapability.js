const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const stripeLib = require("stripe");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.checkDriverStripeCapability = onSchedule(
  {
    schedule: "every 7 minutes",
    region: "us-central1",
    timeZone: "America/New_York",
    secrets: ["STRIPE_SECRET_KEY"],
  },
  async () => {
    try {
      const stripeSecret = process.env.STRIPE_SECRET_KEY;
      if (!stripeSecret) {
        console.error("Missing STRIPE_SECRET_KEY");
        return;
      }

      const stripe = stripeLib(stripeSecret);
      const snapshot = await db.collection("Drivers").get();

      let batch = db.batch();
      let count = 0;

      for (const doc of snapshot.docs) {
        const data = doc.data();
        const accountId = data.accountId;
        if (!accountId) continue;

        try {
          const capability = await stripe.accounts.retrieveCapability(
            accountId,
            "transfers"
          );

          const transferCapability =
            capability.status === "active" ? "enabled" : "disabled";

          batch.update(doc.ref, {
            transferCapability,
            transferCapabilityCheckedAt:
              admin.firestore.FieldValue.serverTimestamp(),
          });

          count++;

          if (count === 500) {
            await batch.commit();
            batch = db.batch();
            count = 0;
          }
        } catch (err) {
          console.error(
            `[checkDriverStripeCapability] Stripe check failed for ${accountId}:`,
            err.message
          );
        }
      }

      if (count > 0) {
        await batch.commit();
      }

      console.log("✅ Driver Stripe capability sync complete");
    } catch (err) {
      console.error("❌ checkDriverStripeCapability failed:", err);
    }
  }
);