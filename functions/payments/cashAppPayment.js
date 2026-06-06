// functions/src/cashAppPayment.js

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin  = require("firebase-admin");
const Stripe = require("stripe");
const { recordPromoRedemption } = require("./validatePromoCode");

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();

exports.cashAppPayment = onCall(
  {
    region: "us-east1",                  // ← was us-central1
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
      // ── Fare ────────────────────────────────────────────────────────
      const fareTotal   = Number(bookingPayload.fareEstimate);
      const amountCents = Math.round(fareTotal * 100);

      if (amountCents < 50) {
        throw new HttpsError("invalid-argument", "Amount too low (minimum $0.50)");
      }

      const platformFee  = +(fareTotal * 0.25).toFixed(2);
      const driverPayout = +(fareTotal * 0.75).toFixed(2);

      // ── Schedule fields ─────────────────────────────────────────────
      const isScheduled = bookingPayload.isScheduled === true;
      const scheduledAt = isScheduled && bookingPayload.scheduledAt
        ? bookingPayload.scheduledAt
        : null;

      if (isScheduled) {
        if (!scheduledAt) {
          throw new HttpsError("invalid-argument", "scheduledAt is required for scheduled rides.");
        }
        const scheduledMs = new Date(scheduledAt).getTime();
        if (isNaN(scheduledMs)) {
          throw new HttpsError("invalid-argument", "scheduledAt is not a valid date.");
        }
        if (scheduledMs < Date.now() + 10 * 60 * 1000) {
          throw new HttpsError(
            "invalid-argument",
            "Scheduled pickup must be at least 10 minutes from now."
          );
        }
      }

      // ── Promo fields ────────────────────────────────────────────────
      const promoCode      = bookingPayload.promoCode ?? null;
      const discountAmount = bookingPayload.discountAmount
        ? Number(bookingPayload.discountAmount)
        : null;

      // ── Stripe Payment Intent ────────────────────────────────────────
      // Cash App Pay requires a PaymentIntent with payment_method_types: ["cashapp"].
      // The client confirms it with stripe.confirmCashappPayment + return_url.
      // The ride is saved BEFORE confirmation so rideId is available on return.
      const paymentIntent = await stripe.paymentIntents.create({
        amount:               amountCents,
        currency:             "usd",
        payment_method_types: ["cashapp"],
        description: `${isScheduled ? "Scheduled ride" : "Ride"}: ${bookingPayload.pickup ?? ""} → ${bookingPayload.dropoff ?? ""}`,
        metadata: {
          uid,
          rideType:          bookingPayload.rideType          ?? "standard",
          tripDistanceMiles: String(bookingPayload.tripDistanceMiles ?? ""),
          tripDurationMin:   String(bookingPayload.tripDurationMin   ?? ""),
          pickup:            bookingPayload.pickup             ?? "",
          dropoff:           bookingPayload.dropoff            ?? "",
          pickupCity:        bookingPayload.pickupCity         ?? "",
          dropoffCity:       bookingPayload.dropoffCity        ?? "",
          platformFee:       String(platformFee),
          driverPayout:      String(driverPayout),
          // schedule
          isScheduled:       String(isScheduled),
          scheduledAt:       scheduledAt ?? "",
          // promo
          promoCode:         promoCode         ?? "",
          discountAmount:    discountAmount != null ? String(discountAmount) : "",
          // driver info snapshot
          driverCount:       String(bookingPayload.driverInfo?.driverCount  ?? ""),
          driverEtaMin:      String(bookingPayload.driverInfo?.etaMin       ?? ""),
          driverEtaLabel:    bookingPayload.driverInfo?.etaLabel             ?? "",
          driverNearestMi:   String(bookingPayload.driverInfo?.nearestMiles ?? ""),
          driverStale:       String(bookingPayload.driverInfo?.stale        ?? ""),
        },
      });

      // ── Save ride ────────────────────────────────────────────────────
      // Status is "pending_payment" here — your Stripe webhook (payment_intent.succeeded)
      // should transition it to "scheduled" or "searching_driver" once Cash App confirms.
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

        // ── Schedule ───────────────────────────────────────────────
        isScheduled,
        scheduledAt: scheduledAt
          ? admin.firestore.Timestamp.fromDate(new Date(scheduledAt))
          : null,

        // ── Promo ──────────────────────────────────────────────────
        promoCode,
        discountAmount,

        paymentMethod:   "cashapp",
        paymentIntentId: paymentIntent.id,
        paymentStatus:   "pending",

        // ── Driver availability snapshot ───────────────────────────
        driverInfo: bookingPayload.driverInfo
          ? {
              driverCount:  bookingPayload.driverInfo.driverCount  ?? null,
              etaLabel:     bookingPayload.driverInfo.etaLabel      ?? null,
              etaMin:       bookingPayload.driverInfo.etaMin        ?? null,
              nearestMiles: bookingPayload.driverInfo.nearestMiles  ?? null,
              stale:        bookingPayload.driverInfo.stale         ?? null,
            }
          : null,

        // Cash App confirmation happens client-side via redirect.
        // Webhook transitions this to "scheduled" or "searching_driver"
        // once payment_intent.succeeded fires.
        status: "pending_payment",

        uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // ── Record promo redemption ──────────────────────────────────────
      // For Cash App we record optimistically here — the webhook should NOT
      // call recordPromoRedemption again on payment_intent.succeeded to avoid
      // double-counting. Flag it on the ride doc instead (promoRecorded: true).
      if (promoCode) {
        try {
          await recordPromoRedemption(promoCode, uid);
          await rideRef.update({ promoRecorded: true });
        } catch (promoErr) {
          console.warn("[cashAppPayment] recordPromoRedemption failed:", promoErr.message);
        }
      }

      console.log(
        `[cashAppPayment] Ride ${rideRef.id} created — uid: ${uid} | fare: $${fareTotal}` +
        (discountAmount ? ` | discount: -$${discountAmount} (${promoCode})` : "") +
        (isScheduled    ? ` | scheduled: ${scheduledAt}` : " | immediate")
      );

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
