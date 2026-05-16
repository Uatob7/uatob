const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const Stripe = require("stripe");

const db = admin.firestore();

exports.cashAppPayment = onCall(
  {
    region: "us-central1",
    secrets: ["STRIPE_SECRET_KEY"],
  },
  async (request) => {
    const { uid, bookingPayload } = request.data;

    if (!uid) {
      throw new HttpsError("invalid-argument", "Missing uid");
    }

    if (!bookingPayload?.fareEstimate) {
      throw new HttpsError("invalid-argument", "Missing bookingPayload.fareEstimate");
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      throw new HttpsError("internal", "Stripe key not configured");
    }

    const stripe = new Stripe(stripeKey);

    try {
      const fareTotal   = Number(bookingPayload.fareEstimate);
      const amountCents = Math.round(fareTotal * 100);

      if (amountCents < 50) {
        throw new HttpsError("invalid-argument", "Amount too low (minimum $0.50)");
      }

      const platformFee  = +(fareTotal * 0.25).toFixed(2);
      const driverPayout = +(fareTotal * 0.75).toFixed(2);

      // ── Stripe Payment Intent ──────────────────────────────────────
      const paymentIntent = await stripe.paymentIntents.create({
        amount:               amountCents,
        currency:             "usd",
        payment_method_types: ["cashapp"],
        description:          `Ride: ${bookingPayload.pickup ?? ""} → ${bookingPayload.dropoff ?? ""}`,
        metadata: {
          uid,
          rideType:          bookingPayload.rideType          ?? "standard",
          tripDistanceMiles: String(bookingPayload.tripDistanceMiles ?? ""),
          tripDurationMin:   String(bookingPayload.tripDurationMin   ?? ""),
          pickup:            bookingPayload.pickup            ?? "",
          dropoff:           bookingPayload.dropoff           ?? "",
          pickupCity:        bookingPayload.pickupCity        ?? "",
          dropoffCity:       bookingPayload.dropoffCity       ?? "",
          platformFee:       String(platformFee),
          driverPayout:      String(driverPayout),
          // driver info snapshot
          driverCount:       String(bookingPayload.driverInfo?.driverCount  ?? ""),
          driverEtaMin:      String(bookingPayload.driverInfo?.etaMin       ?? ""),
          driverEtaLabel:    bookingPayload.driverInfo?.etaLabel            ?? "",
          driverNearestMi:   String(bookingPayload.driverInfo?.nearestMiles ?? ""),
          driverStale:       String(bookingPayload.driverInfo?.stale        ?? ""),
        },
      });

      // ── Save ride ──────────────────────────────────────────────────
      const rideRef = db.collection("Rides").doc();

      await rideRef.set({
        pickup:  bookingPayload.pickup  ?? null,
        dropoff: bookingPayload.dropoff ?? null,

        pickupCity: bookingPayload.pickupCity ?? null,
        pickupZip:  bookingPayload.pickupZip  ?? null,
        pickupLat:  bookingPayload.pickupLat  ?? null,
        pickupLng:  bookingPayload.pickupLng  ?? null,

        dropoffCity: bookingPayload.dropoffCity ?? null,
        dropoffZip:  bookingPayload.dropoffZip  ?? null,
        dropoffLat:  bookingPayload.dropoffLat  ?? null,
        dropoffLng:  bookingPayload.dropoffLng  ?? null,

        polyline:  bookingPayload.polyline ?? null,

        rideType:  bookingPayload.rideType  ?? "standard",
        rideLabel: bookingPayload.rideLabel ?? null,

        fareTotal,
        platformFee,
        driverPayout,
        payoutStatus: "pending",

        tripDistanceMiles: bookingPayload.tripDistanceMiles ?? null,
        tripDurationMin:   bookingPayload.tripDurationMin   ?? null,
        fareBreakdown:     bookingPayload.breakdown         ?? null,

        paymentMethod:   "cashapp",
        paymentIntentId: paymentIntent.id,
        paymentStatus:   "pending",

        // ── Driver availability at time of booking ─────────────────
        driverInfo: bookingPayload.driverInfo
          ? {
              driverCount:  bookingPayload.driverInfo.driverCount  ?? null,
              etaLabel:     bookingPayload.driverInfo.etaLabel      ?? null,
              etaMin:       bookingPayload.driverInfo.etaMin        ?? null,
              nearestMiles: bookingPayload.driverInfo.nearestMiles  ?? null,
              stale:        bookingPayload.driverInfo.stale         ?? null,
            }
          : null,

        status: "pending_payment",
        uid,

        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`[cashAppPayment] Ride ${rideRef.id} created — uid: ${uid} | fare: $${fareTotal} | driverEta: ${bookingPayload.driverInfo?.etaLabel ?? "unknown"}`);

      return {
        success:      true,
        clientSecret: paymentIntent.client_secret,
        rideId:       rideRef.id,
      };

    } catch (err) {
      console.error("[cashAppPayment]", err);
      throw new HttpsError("internal", err.message || "Internal server error");
    }
  }
);