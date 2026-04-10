// File: functions/cashAppChecker.js
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const Stripe = require("stripe");

const db = admin.firestore();

exports.cashAppChecker = onDocumentCreated(
  {
    document: "Rides/{rideId}",
    region: "us-central1",
    secrets: ["STRIPE_SECRET_KEY"],
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const data = snap.data();
    const rideId = event.params.rideId;

    // ── Only handle Cash App rides awaiting payment ────────────
    if (
      data.paymentMethod  !== "cashapp"         ||
      data.paymentStatus  !== "pending"          ||
      data.status         !== "pending_payment"  ||
      !data.paymentIntentId
    ) {
      return;
    }

    console.log(`[cashAppChecker] Checking ride ${rideId} | PI: ${data.paymentIntentId}`);

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      console.error("[cashAppChecker] Stripe key not configured");
      return;
    }

    const stripe = new Stripe(stripeKey);

    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(
        data.paymentIntentId
      );

      if (paymentIntent.status !== "succeeded") {
        console.log(
          `[cashAppChecker] Ride ${rideId} PI status: ${paymentIntent.status} — no update`
        );
        return;
      }

      await snap.ref.update({
        paymentStatus: "succeeded",
        status:        "searching_driver",
        updatedAt:     admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`[cashAppChecker] ✅ Ride ${rideId} confirmed — status → searching_driver`);
    } catch (err) {
      console.error(`[cashAppChecker] ❌ Error on ride ${rideId}:`, err);
    }
  }
);