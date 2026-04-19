// File: functions/cardChecker.js
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const Stripe = require("stripe");

const db = admin.firestore();

exports.cardChecker = onSchedule(
  {
    schedule: "every 1 minutes",
    region:   "us-central1",
    secrets:  ["STRIPE_SECRET_KEY"],
  },
  async () => {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      console.error("[cardChecker] Stripe key not configured");
      return;
    }

    const stripe = new Stripe(stripeKey);

    // Pull all rides stuck in pending payment
    const snapshot = await db
      .collection("Rides")
      .where("paymentStatus", "==", "pending")
      .where("status", "==", "pending_payment")
      .get();

    if (snapshot.empty) {
      console.log("[cardChecker] No pending rides found.");
      return;
    }

    console.log(`[cardChecker] Checking ${snapshot.size} pending ride(s)...`);

    const checks = snapshot.docs.map(async (doc) => {
      const rideId = doc.id;
      const data   = doc.data();

      if (!data.paymentIntentId) {
        console.warn(`[cardChecker] Ride ${rideId} missing paymentIntentId — skipping`);
        return;
      }

      console.log(`[cardChecker] Ride ${rideId} | PI: ${data.paymentIntentId}`);

      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(
          data.paymentIntentId
        );

        if (paymentIntent.status !== "succeeded") {
          console.log(
            `[cardChecker] Ride ${rideId} PI status: ${paymentIntent.status} — no update`
          );
          return;
        }

        await doc.ref.update({
          paymentStatus: "succeeded",
          status:        "searching_driver",
          updatedAt:     admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`[cardChecker] ✅ Ride ${rideId} confirmed — status → searching_driver`);
      } catch (err) {
        console.error(`[cardChecker] ❌ Error on ride ${rideId}:`, err);
      }
    });

    await Promise.allSettled(checks);
  }
);