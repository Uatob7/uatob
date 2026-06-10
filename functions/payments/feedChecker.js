// File: functions/feedChecker.js

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const Stripe = require("stripe");

// ── INIT ADMIN ─────────────────────────────────────
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

// ── SECRET ─────────────────────────────────────────
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");

// ── MAIN FUNCTION ──────────────────────────────────
exports.feedChecker = onSchedule(
  {
    schedule: "every 1 minutes",
    region: "us-east1",
    secrets: [STRIPE_SECRET_KEY],
  },
  async (event) => {
    const stripeKey = STRIPE_SECRET_KEY.value();

    if (!stripeKey) {
      console.error("[feedChecker] Stripe key not configured");
      return;
    }

    const stripe = new Stripe(stripeKey);

    // ── FIND PENDING FEED POSTS ────────────────────
    const snapshot = await db
      .collection("Feed")
      .where("paymentStatus", "==", "pending")
      .where("status",        "==", "pending")
      .where("paymentMethod", "==", "cashapp")
      .get();

    if (snapshot.empty) {
      console.log("[feedChecker] No pending Feed posts found.");
      return;
    }

    console.log(`[feedChecker] Checking ${snapshot.size} post(s)...`);

    const now = admin.firestore.Timestamp.now();

    const checks = snapshot.docs.map(async (doc) => {
      const feedId = doc.id;
      const data   = doc.data();

      if (!data.paymentIntentId) {
        console.warn(`[feedChecker] Feed ${feedId} missing paymentIntentId — skipping`);
        return;
      }

      // ── Skip already-expired posts ───────────────
      if (data.expiresAt && data.expiresAt.toMillis() < now.toMillis()) {
        console.warn(`[feedChecker] Feed ${feedId} expired — marking failed`);
        await doc.ref.update({
          paymentStatus: "failed",
          status:        "expired",
          updatedAt:     admin.firestore.FieldValue.serverTimestamp(),
        });
        return;
      }

      try {
        const intent = await stripe.paymentIntents.retrieve(data.paymentIntentId);

        console.log(`[feedChecker] Feed ${feedId} intent status: ${intent.status}`);

        if (intent.status === "succeeded") {
          await doc.ref.update({
            paymentStatus: "succeeded",
            status:        "active",
            updatedAt:     admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log(`[feedChecker] ✅ Feed ${feedId} activated`);
          return;
        }

        if (intent.status === "canceled" || intent.status === "requires_payment_method") {
          await doc.ref.update({
            paymentStatus: "failed",
            status:        "failed",
            updatedAt:     admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log(`[feedChecker] ❌ Feed ${feedId} marked failed (${intent.status})`);
        }

      } catch (err) {
        console.error(`[feedChecker] ❌ Error on Feed ${feedId}:`, err);
      }
    });

    await Promise.allSettled(checks);
  }
);