const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const Stripe = require("stripe");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.setupDeposit = onCall(
  {
    region: "us-central1",
    secrets: ["STRIPE_SECRET_KEY"],
  },
  async (request) => {
    try {
      const { email, uid } = request.data || {};

      console.log(`[setupDeposit] email=${email} uid=${uid}`);

      if (!email || !uid) {
        throw new HttpsError("invalid-argument", "Missing required fields");
      }

      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) {
        throw new HttpsError("failed-precondition", "Stripe key not configured");
      }

      const stripe = new Stripe(stripeKey);

      // ── Create Stripe Express Account ─────────────────────
      const account = await stripe.accounts.create({
        country: "US",
        type: "express",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",
        email,
      });

      const accountId = account.id;

      console.log(`[setupDeposit] Stripe account created: ${accountId}`);

      // ── Save to Firestore ────────────────────────────────
      await db.collection("Drivers").doc(uid).set(
        { accountId },
        { merge: true }
      );

      console.log(`[setupDeposit] Firestore updated uid=${uid}`);

      // ── Create onboarding link ───────────────────────────
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: "https://uatob.com/driver",
        return_url: "https://uatob.com/driver",
        type: "account_onboarding",
      });

      console.log(`[setupDeposit] onboarding link created`);

      return {
        success: true,
        accountLink: accountLink.url,
        accountId,
      };

    } catch (error) {
      console.error("[setupDeposit]", error);

      throw new HttpsError(
        "internal",
        error.message || "Internal Server Error"
      );
    }
  }
);