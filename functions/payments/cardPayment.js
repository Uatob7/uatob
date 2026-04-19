const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors")({ origin: true });
const admin = require("firebase-admin");
const Stripe = require("stripe");

// ✅ SAFE INIT
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

exports.cardPayment = onRequest(
  {
    region: "us-central1",
    secrets: ["STRIPE_SECRET_KEY"],
    invoker: "public", // ✅ MAKE PUBLIC
  },
  async (req, res) => {
    return cors(req, res, async () => {
      try {
        if (req.method === "OPTIONS") {
          return res.status(204).send("");
        }

        if (req.method !== "POST") {
          return res.status(405).json({ success: false });
        }

        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

        const { uid, paymentMethodId, bookingPayload } = req.body;

        if (!uid || !paymentMethodId) {
          return res.status(400).json({
            success: false,
            message: "Missing fields",
          });
        }

        const fareTotal = Number(bookingPayload.fareEstimate);
        const amountCents = Math.round(fareTotal * 100);

        const platformFee = +(fareTotal * 0.25).toFixed(2);
        const driverPayout = +(fareTotal * 0.75).toFixed(2);

        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountCents,
          currency: "usd",
          payment_method: paymentMethodId,
          confirm: true,
          automatic_payment_methods: {
            enabled: true,
            allow_redirects: "never",
          },
          metadata: {
            uid,
            rideType: bookingPayload.rideType ?? "standard",
            tripDistanceMiles: String(bookingPayload.tripDistanceMiles ?? ""),
            tripDurationMin: String(bookingPayload.tripDurationMin ?? ""),
            pickup: bookingPayload.pickup ?? "",
            dropoff: bookingPayload.dropoff ?? "",
            pickupCity: bookingPayload.pickupCity ?? "",
            dropoffCity: bookingPayload.dropoffCity ?? "",
            platformFee: String(platformFee),
            driverPayout: String(driverPayout),
          },
        });

        if (paymentIntent.status !== "succeeded") {
          return res.status(402).json({ success: false });
        }

        // ─────────────────────────────
        // SAVE RIDE
        // ─────────────────────────────
        const rideRef = db.collection("Rides").doc();

        await rideRef.set({
          pickup: bookingPayload.pickup ?? null,
          dropoff: bookingPayload.dropoff ?? null,

          pickupCity: bookingPayload.pickupCity ?? null,
          pickupZip: bookingPayload.pickupZip ?? null,
          pickupLat: bookingPayload.pickupLat ?? null,
          pickupLng: bookingPayload.pickupLng ?? null,

          dropoffCity: bookingPayload.dropoffCity ?? null,
          dropoffZip: bookingPayload.dropoffZip ?? null,
          dropoffLat: bookingPayload.dropoffLat ?? null,
          dropoffLng: bookingPayload.dropoffLng ?? null,

          polyline: bookingPayload.polyline ?? null,

          rideType: bookingPayload.rideType ?? "standard",
          rideLabel: bookingPayload.rideLabel ?? null,

          fareTotal,
          platformFee,
          driverPayout,
          payoutStatus: "pending",

          tripDistanceMiles: bookingPayload.tripDistanceMiles ?? null,
          tripDurationMin: bookingPayload.tripDurationMin ?? null,
          fareBreakdown: bookingPayload.breakdown ?? null,

          paymentMethod: "card",
          paymentIntentId: paymentIntent.id,
          paymentStatus: "pending",

          status: "pending_payment",
          uid,

          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(
          `[cardPayment] Ride ${rideRef.id} created — uid: ${uid} | fare: $${fareTotal}`
        );

        return res.json({
          success: true,
          rideId: rideRef.id,
        });
      } catch (err) {
        console.error(err);
        return res.status(500).json({
          success: false,
          message: err.message,
        });
      }
    });
  }
);