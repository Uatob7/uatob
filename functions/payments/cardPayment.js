const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors")({ origin: true });
const admin = require("firebase-admin");
const Stripe = require("stripe");

const db = admin.firestore();

exports.cardPayment = onRequest(
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

      try {
        const { uid, paymentMethodId, bookingPayload } = req.body;

        // ── Validate ───────────────────────────────────────────
        if (!uid) {
          return res.status(400).json({ success: false, message: "Missing uid" });
        }
        if (!paymentMethodId) {
          return res.status(400).json({ success: false, message: "Missing paymentMethodId" });
        }
        if (!bookingPayload?.fareEstimate) {
          return res.status(400).json({ success: false, message: "Missing bookingPayload.fareEstimate" });
        }

        const fareTotal   = Number(bookingPayload.fareEstimate);
        const amountCents = Math.round(fareTotal * 100);

        if (amountCents < 50) {
          return res.status(400).json({ success: false, message: "Amount too low (minimum $0.50)" });
        }

        // ── Platform split (25% platform / 75% driver) ─────────
        const platformFee  = +(fareTotal * 0.25).toFixed(2);
        const driverPayout = +(fareTotal * 0.75).toFixed(2);

        // ── Create & confirm PaymentIntent ─────────────────────
        const paymentIntent = await stripe.paymentIntents.create({
          amount:         amountCents,
          currency:       "usd",
          payment_method: paymentMethodId,
          confirm:        true,
          automatic_payment_methods: {
            enabled:         true,
            allow_redirects: "never",
          },
          description: `Ride: ${bookingPayload.pickup ?? ""} → ${bookingPayload.dropoff ?? ""}`,
          metadata: {
            uid:               uid,
            rideType:          bookingPayload.rideType            ?? "standard",
            tripDistanceMiles: String(bookingPayload.tripDistanceMiles ?? ""),
            tripDurationMin:   String(bookingPayload.tripDurationMin   ?? ""),
            pickup:            bookingPayload.pickup               ?? "",
            dropoff:           bookingPayload.dropoff              ?? "",
            pickupCity:        bookingPayload.pickupCity           ?? "",
            dropoffCity:       bookingPayload.dropoffCity          ?? "",
            platformFee:       String(platformFee),
            driverPayout:      String(driverPayout),
          },
        });

        // ── 3D Secure required ─────────────────────────────────
        if (paymentIntent.status === "requires_action") {
          return res.status(202).json({
            success:        false,
            requiresAction: true,
            clientSecret:   paymentIntent.client_secret,
            message:        "3D Secure authentication required.",
          });
        }

        if (paymentIntent.status !== "succeeded") {
          return res.status(402).json({
            success: false,
            message: `Payment not completed. Status: ${paymentIntent.status}`,
          });
        }

        // ── Save ride to Firestore only after success ──────────
        const rideRef = db.collection("Rides").doc();

        await rideRef.set({
          // ── Addresses ─────────────────────────────────────────
          pickup:            bookingPayload.pickup             ?? null,
          dropoff:           bookingPayload.dropoff            ?? null,

          // ── Geo fields ────────────────────────────────────────
          pickupCity:        bookingPayload.pickupCity         ?? null,
          pickupZip:         bookingPayload.pickupZip          ?? null,
          pickupLat:         bookingPayload.pickupLat          ?? null,
          pickupLng:         bookingPayload.pickupLng          ?? null,
          dropoffCity:       bookingPayload.dropoffCity        ?? null,
          dropoffZip:        bookingPayload.dropoffZip         ?? null,
          dropoffLat:        bookingPayload.dropoffLat         ?? null,
          dropoffLng:        bookingPayload.dropoffLng         ?? null,

          // ── Ride info ─────────────────────────────────────────
          rideType:          bookingPayload.rideType           ?? "standard",
          rideLabel:         bookingPayload.rideLabel          ?? null,

          // ── Fare ──────────────────────────────────────────────
          fareTotal,
          platformFee,
          driverPayout,
          payoutStatus:      "pending",
          tripDistanceMiles: bookingPayload.tripDistanceMiles  ?? null,
          tripDurationMin:   bookingPayload.tripDurationMin    ?? null,
          fareBreakdown:     bookingPayload.breakdown          ?? null,
          surgeMultiplier:   bookingPayload.surgeMultiplier    ?? 1,

          // ── Payment ───────────────────────────────────────────
          paymentMethod:     "card",
          paymentIntentId:   paymentIntent.id,
          paymentStatus:     "succeeded",

          // ── Status & meta ─────────────────────────────────────
          status:            "searching_driver",
          uid:               uid,
          createdAt:         admin.firestore.FieldValue.serverTimestamp(),
          updatedAt:         admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`[cardPayment] Ride ${rideRef.id} created — uid: ${uid} | fareTotal: $${fareTotal} | platformFee: $${platformFee} | driverPayout: $${driverPayout} | PaymentIntent: ${paymentIntent.id}`);

        return res.status(200).json({
          success:       true,
          rideId:        rideRef.id,
          paymentIntent: paymentIntent.id,
          fareTotal,
          platformFee,
          driverPayout,
        });

      } catch (err) {
        if (err.type === "StripeCardError") {
          return res.status(402).json({ success: false, message: err.message });
        }
        console.error("[cardPayment] Error:", err);
        return res.status(500).json({ success: false, message: err.message || "Internal server error" });
      }
    });
  }
);