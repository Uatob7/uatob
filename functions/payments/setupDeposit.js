const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors")({ origin: true });
const admin = require("firebase-admin");
const Stripe = require("stripe");

const db = admin.firestore();


exports.setupDeposit = onRequest(
  {
    region: "us-central1",
    secrets: ["STRIPE_SECRET_KEY"],
  },
  async (req, res) => {
    return cors(req, res, async () => {
      if (req.method === "OPTIONS") return res.status(204).send("");
      if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method Not Allowed" });

      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) return res.status(500).json({ success: false, message: "Stripe key not configured" });

      const stripe = new Stripe(stripeKey);

      const { email, uid } = req.body;

      console.log(`[setupDeposit] Received request with email: ${email}, uid: ${uid}`);

      if (!email || !uid) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      try {
        // ── Create Stripe Express Account ──────────────────────
        const account = await stripe.accounts.create({
          country: "US",
          type: "express",
          capabilities: {
            card_payments: { requested: true },
            transfers:     { requested: true },
          },
          business_type: "individual",
          email,
        });

        const accountId = account.id;

        // ── Write accountId to Drivers collection ──────────────
        await db.collection("Drivers").doc(uid).set({ accountId }, { merge: true });

        // ── Create onboarding link ─────────────────────────────
        const accountLink = await stripe.accountLinks.create({
          account:     accountId,
          refresh_url: "https://uatob.com/driver",
          return_url:  "https://uatob.com/driver",
          type:        "account_onboarding",
        });

        console.log(`[setupDeposit] ✅ Stripe account created for uid: ${uid} | accountId: ${accountId}`);

        return res.status(200).json({
          success:     true,
          accountLink: accountLink.url,
        });

      } catch (error) {
        console.error("[setupDeposit] ❌ Stripe account creation failed:", error);
        return res.status(500).json({ error: "Internal Server Error" });
      }
    });
  }
);