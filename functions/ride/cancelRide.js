const { onRequest } = require("firebase-functions/v2/https");
const admin  = require("firebase-admin");
const Stripe = require("stripe");

const db = admin.firestore();

exports.cancelRide = onRequest(
  {
    region:  "us-central1",
    secrets: ["STRIPE_SECRET_KEY"],
    cors:    true,
  },
  async (req, res) => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { rideId, uid } = req.body;

    if (!rideId || !uid) {
      return res.status(400).json({ error: "rideId and uid are required." });
    }

    try {
      const rideRef  = db.collection("Rides").doc(rideId);
      const rideSnap = await rideRef.get();

      if (!rideSnap.exists) {
        return res.status(404).json({ error: "Ride not found." });
      }

      const ride = rideSnap.data();

      if (ride.uid !== uid) {
        return res.status(403).json({ error: "Not your ride." });
      }

      if (["cancelled", "completed"].includes(ride.status)) {
        return res.status(200).json({ success: true, message: "Ride already resolved." });
      }

      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeKey) {
        return res.status(500).json({ error: "Stripe not configured." });
      }

      const stripe = new Stripe(stripeKey);

      let refundId     = null;
      let refundStatus = "skipped";

      if (ride.paymentIntentId && ride.paymentStatus === "succeeded") {
        try {
          const refund = await stripe.refunds.create({
            payment_intent: ride.paymentIntentId,
            reason:         "requested_by_customer",
          });
          refundId     = refund.id;
          refundStatus = refund.status;
          console.log(`[cancelRide] ✅ Refund ${refundId} | status: ${refundStatus} | ride: ${rideId}`);
        } catch (err) {
          if (err?.raw?.code === "charge_already_refunded") {
            console.warn(`[cancelRide] Already refunded: ${rideId}`);
            refundStatus = "already_refunded";
          } else {
            console.error(`[cancelRide] Stripe error on ride ${rideId}:`, err);
            return res.status(500).json({ error: "Refund failed. Contact support." });
          }
        }
      }

      await rideRef.update({
        status:        "cancelled",
        paymentStatus: refundStatus === "skipped" ? ride.paymentStatus : "refunded",
        refundId:      refundId ?? null,
        cancelReason:  "rider_timeout_cancel",
        cancelledAt:   admin.firestore.FieldValue.serverTimestamp(),
        updatedAt:     admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`[cancelRide] ✅ Ride ${rideId} cancelled.`);
      return res.status(200).json({ success: true, refundStatus });

    } catch (err) {
      console.error(`[cancelRide] ❌ Unexpected error:`, err);
      return res.status(500).json({ error: "Internal server error." });
    }
  }
);