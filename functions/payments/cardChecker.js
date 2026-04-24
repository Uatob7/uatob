// File: functions/cardChecker.js

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const Stripe = require("stripe");

// ── INIT ADMIN ─────────────────────────────────────
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// ── SECRET (PROPER V2 WAY) ─────────────────────────
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");

// ── MAIN FUNCTION ──────────────────────────────────
exports.cardChecker = onSchedule(
  {
    schedule: "every 1 minutes",
    region: "us-east1",
    secrets: [STRIPE_SECRET_KEY],
  },
  async (event) => {
    const stripeKey = STRIPE_SECRET_KEY.value();

    if (!stripeKey) {
      console.error("[cardChecker] Stripe key not configured");
      return;
    }

    const stripe = new Stripe(stripeKey);

    // ── FIND PENDING RIDES ─────────────────────────
    const snapshot = await db
      .collection("Rides")
      .where("paymentStatus", "==", "pending")
      .where("status", "==", "pending_payment")
      .get();

    if (snapshot.empty) {
      console.log("[cardChecker] No pending rides found.");
      return;
    }

    console.log(`[cardChecker] Checking ${snapshot.size} ride(s)...`);

    // ── PROCESS RIDES ──────────────────────────────
    const checks = snapshot.docs.map(async (doc) => {
      const rideId = doc.id;
      const data = doc.data();

      if (!data.paymentIntentId) {
        console.warn(`[cardChecker] Ride ${rideId} missing paymentIntentId`);
        return;
      }

      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(
          data.paymentIntentId
        );

        console.log(
          `[cardChecker] Ride ${rideId} status: ${paymentIntent.status}`
        );

        if (paymentIntent.status !== "succeeded") return;

        await doc.ref.update({
          paymentStatus: "succeeded",
          status: "searching_driver",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(
          `[cardChecker] ✅ Ride ${rideId} moved → searching_driver`
        );
      } catch (err) {
        console.error(`[cardChecker] ❌ Error on ride ${rideId}:`, err);
      }
    });

    await Promise.allSettled(checks);
  }
);