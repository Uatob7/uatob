exports.cancelRide = onCall(
  {
    region:  "us-east1",
    secrets: ["STRIPE_SECRET_KEY"],
  },
  async (request) => {
    const { rideId, uid } = request.data;

    if (!rideId || !uid) {
      throw new HttpsError("invalid-argument", "rideId and uid are required.");
    }

    const rideRef  = db.collection("Rides").doc(rideId);
    const rideSnap = await rideRef.get();

    if (!rideSnap.exists) {
      throw new HttpsError("not-found", "Ride not found.");
    }

    const ride = rideSnap.data();

    if (ride.uid !== uid) {
      throw new HttpsError("permission-denied", "Not your ride.");
    }

    if (["cancelled", "completed"].includes(ride.status)) {
      return { success: true, message: "Ride already resolved." };
    }

    // ── Cash rides: skip Stripe entirely ──────────────────────────────────
    if (ride.paymentMethod === "cash") {
      await rideRef.update({
        status:       "cancelled",
        cancelReason: "rider_timeout_cancel",
        cancelledAt:  admin.firestore.FieldValue.serverTimestamp(),
        updatedAt:    admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`[cancelRide] ✅ Cash ride ${rideId} cancelled (no refund needed).`);
      return { success: true, refundStatus: "skipped" };
    }
    // ──────────────────────────────────────────────────────────────────────

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      throw new HttpsError("internal", "Stripe not configured.");
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
          throw new HttpsError("internal", "Refund failed. Contact support.");
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
    return { success: true, refundStatus };
  }
);