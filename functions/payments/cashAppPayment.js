const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors")({ origin: true });
const admin = require("firebase-admin");
const Stripe = require("stripe");



const db = admin.firestore();

exports.cashAppPayment = onRequest(
  {
    region: "us-central1",
    secrets: ["STRIPE_SECRET_KEY"],
    invoker: "public", // ✅ PUBLIC ACCESS
  },
  async (req, res) => {
    return cors(req, res, async () => {
      if (req.method === "OPTIONS") return res.status(204).send("");

      if (req.method !== "POST") {
        return res.status(405).json({
          success: false,
          message: "Method Not Allowed",
        });
      }

      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) {
        return res.status(500).json({
          success: false,
          message: "Stripe key not configured",
        });
      }

      const stripe = new Stripe(stripeKey);

      try {
        const { uid, bookingPayload } = req.body;

        // ── VALIDATION ─────────────────────────
        if (!uid) {
          return res.status(400).json({
            success: false,
            message: "Missing uid",
          });
        }

        if (!bookingPayload?.fareEstimate) {
          return res.status(400).json({
            success: false,
            message: "Missing bookingPayload.fareEstimate",
          });
        }

        const fareTotal = Number(bookingPayload.fareEstimate);
        const amountCents = Math.round(fareTotal * 100);

        if (amountCents < 50) {
          return res.status(400).json({
            success: false,
            message: "Amount too low (minimum $0.50)",
          });
        }

        // ── PLATFORM SPLIT ─────────────────────
        const platformFee = +(fareTotal * 0.25).toFixed(2);
        const driverPayout = +(fareTotal * 0.75).toFixed(2);

        // ── STRIPE PAYMENT INTENT ──────────────
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountCents,
          currency: "usd",
          payment_method_types: ["cashapp"],
          description: `Ride: ${bookingPayload.pickup ?? ""} → ${bookingPayload.dropoff ?? ""}`,
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

        // ── SAVE RIDE ──────────────────────────
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

          paymentMethod: "cashapp",
          paymentIntentId: paymentIntent.id,
          paymentStatus: "pending",

          status: "pending_payment",
          uid,

          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(
          `[cashAppPayment] Ride ${rideRef.id} created — uid: ${uid} | fare: $${fareTotal}`
        );

        return res.status(200).json({
          success: true,
          clientSecret: paymentIntent.client_secret,
          rideId: rideRef.id,
        });
      } catch (err) {
        console.error("[cashAppPayment] Error:", err);
        return res.status(500).json({
          success: false,
          message: err.message || "Internal server error",
        });
      }
    });
  }
);