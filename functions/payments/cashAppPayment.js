const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors")({ origin: true });
const admin = require("firebase-admin");
const Stripe = require("stripe");

const db = admin.firestore();

exports.cashAppPayment = onRequest(
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
        const { bookingPayload } = req.body;

        // ── Validate ───────────────────────────────────────────
        if (!bookingPayload?.fareEstimate) {
          return res.status(400).json({ success: false, message: "Missing bookingPayload.fareEstimate" });
        }

        const amountCents = Math.round(Number(bookingPayload.fareEstimate) * 100);
        if (amountCents < 50) {
          return res.status(400).json({ success: false, message: "Amount too low (minimum $0.50)" });
        }

        // ── Create PaymentIntent ───────────────────────────────
        const paymentIntent = await stripe.paymentIntents.create({
          amount:               amountCents,
          currency:             "usd",
          payment_method_types: ["cashapp"],
          description:          `Ride: ${bookingPayload.pickup ?? ""} → ${bookingPayload.dropoff ?? ""}`,
          metadata: {
            rideType:          bookingPayload.rideType            ?? "standard",
            tripDistanceMiles: String(bookingPayload.tripDistanceMiles ?? ""),
            tripDurationMin:   String(bookingPayload.tripDurationMin   ?? ""),
            pickup:            bookingPayload.pickup               ?? "",
            dropoff:           bookingPayload.dropoff              ?? "",
          },
        });

        // ── Save ride as pending to Firestore ──────────────────
        const rideRef = db.collection("Rides").doc();

        await rideRef.set({
          pickup:            bookingPayload.pickup             ?? null,
          dropoff:           bookingPayload.dropoff            ?? null,
          rideType:          bookingPayload.rideType           ?? "standard",
          rideLabel:         bookingPayload.rideLabel          ?? null,
          fareTotal:         Number(bookingPayload.fareEstimate),
          tripDistanceMiles: bookingPayload.tripDistanceMiles  ?? null,
          tripDurationMin:   bookingPayload.tripDurationMin    ?? null,
          fareBreakdown:     bookingPayload.breakdown          ?? null,
          surgeMultiplier:   bookingPayload.surgeMultiplier    ?? 1,
          paymentMethod:     "cashapp",
          paymentIntentId:   paymentIntent.id,
          paymentStatus:     "pending",
          status:            "pending_payment",  // flipped to searching_driver by webhook
          createdAt:         admin.firestore.FieldValue.serverTimestamp(),
          updatedAt:         admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`[cashAppPayment] Ride ${rideRef.id} pending. PaymentIntent: ${paymentIntent.id}`);

        // ── Return clientSecret to frontend ───────────────────
        return res.status(200).json({
          success:      true,
          clientSecret: paymentIntent.client_secret,
          rideId:       rideRef.id,
        });

      } catch (err) {
        console.error("[cashAppPayment] Error:", err);
        return res.status(500).json({ success: false, message: err.message || "Internal server error" });
      }
    });
  }
);