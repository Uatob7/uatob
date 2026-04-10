// File: functions/cashAppPoller.js
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const Stripe = require("stripe");

const db = admin.firestore();

exports.cashAppPoller = onSchedule(
  {
    schedule: "* * * * *", // every minute
    region: "us-central1",
    timeZone: "America/New_York",
    secrets: ["STRIPE_SECRET_KEY"],
  },
  async () => {
    console.log("=== cashAppPoller START ===");

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      console.error("[cashAppPoller] Stripe key not configured");
      return;
    }

    const stripe = new Stripe(stripeKey);

    try {
      const snapshot = await db
        .collection("Rides")
        .where("paymentMethod",  "==", "cashapp")
        .where("paymentStatus",  "==", "pending")
        .where("status",         "==", "pending_payment")
        .get();

      if (snapshot.empty) {
        console.log("[cashAppPoller] No pending Cash App rides.");
        return;
      }

      console.log(`[cashAppPoller] Found ${snapshot.size} pending Cash App ride(s).`);

      for (const doc of snapshot.docs) {
        const data  = doc.data();
        const rideId = doc.id;

        if (!data.paymentIntentId) {
          console.warn(`[cashAppPoller] Ride ${rideId} missing paymentIntentId — skipping`);
          continue;
        }

        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(
            data.paymentIntentId
          );

          if (paymentIntent.status !== "succeeded") {
            console.log(`[cashAppPoller] Ride ${rideId} PI status: ${paymentIntent.status} — not ready`);
            continue;
          }

          await doc.ref.update({
            paymentStatus: "succeeded",
            status:        "searching_driver",
            updatedAt:     admin.firestore.FieldValue.serverTimestamp(),
          });

          console.log(`[cashAppPoller] ✅ Ride ${rideId} confirmed — status → searching_driver`);
        } catch (err) {
          console.error(`[cashAppPoller] ❌ Error on ride ${rideId}:`, err);
        }
      }

      console.log("=== cashAppPoller END ===");
    } catch (err) {
      console.error("[cashAppPoller] ❌ Fatal error:", err);
    }
  }
);