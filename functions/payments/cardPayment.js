// functions/src/cardPayment.js

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin  = require("firebase-admin");
const Stripe = require("stripe");
const { recordPromoRedemption } = require("./validatePromoCode");

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();

exports.cardPayment = onCall(
  {
    region: "us-east1",
    secrets: ["STRIPE_SECRET_KEY"],
  },
  async (request) => {
    const { uid, paymentMethodId, bookingPayload } = request.data;

    if (!uid || !paymentMethodId) {
      throw new HttpsError("invalid-argument", "Missing uid or paymentMethodId");
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
      // ── Fare ──────────────────────────────────────────────────────
      const fareTotal   = Number(bookingPayload.fareEstimate);
      const amountCents = Math.round(fareTotal * 100);

      if (amountCents < 50) {
        throw new HttpsError("invalid-argument", "Amount too low (minimum $0.50)");
      }

      const platformFee  = +(fareTotal * 0.25).toFixed(2);
      const driverPayout = +(fareTotal * 0.75).toFixed(2);

      // ── Schedule fields ───────────────────────────────────────────
      const isScheduled  = bookingPayload.isScheduled === true;
      const scheduledAt  = isScheduled && bookingPayload.scheduledAt
        ? bookingPayload.scheduledAt   // ISO string from the client
        : null;

      // Validate scheduledAt is in the future (at least 10 min from now)
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

      // ── Promo fields ──────────────────────────────────────────────
      const promoCode      = bookingPayload.promoCode     ?? null;  // e.g. "ORLANDO20"
      const discountAmount = bookingPayload.discountAmount // e.g. "2.50"
        ? Number(bookingPayload.discountAmount)
        : null;

      // ── Stripe Payment Intent ─────────────────────────────────────
      const paymentIntent = await stripe.paymentIntents.create({
        amount:         amountCents,
        currency:       "usd",
        payment_method: paymentMethodId,
        confirm:        true,
        automatic_payment_methods: {
          enabled:         true,
          allow_redirects: "never",
        },
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
          // scheduled
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

      // ── Handle 3D Secure ──────────────────────────────────────────
      if (paymentIntent.status === "requires_action") {
        return {
          success:        false,
          requiresAction: true,
          clientSecret:   paymentIntent.client_secret,
          rideId:         null,
        };
      }

      if (paymentIntent.status !== "succeeded") {
        throw new HttpsError("internal", "Payment did not succeed");
      }

      // ── Save ride ─────────────────────────────────────────────────
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
        promoCode:      promoCode,
        discountAmount: discountAmount,

        paymentMethod:   "card",
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

        // Scheduled rides wait in a holding status until dispatch time.
        // Immediate rides go straight to "searching_driver".
        status: isScheduled ? "scheduled" : "searching_driver",

        uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // ── Record promo redemption (after successful write) ──────────
      if (promoCode) {
        try {
          await recordPromoRedemption(promoCode, uid);
        } catch (promoErr) {
          // Non-fatal — ride is already booked, don't fail the response
          console.warn("[cardPayment] recordPromoRedemption failed:", promoErr.message);
        }
      }

      console.log(
        `[cardPayment] Ride ${rideRef.id} created — uid: ${uid} | fare: $${fareTotal}` +
        (discountAmount ? ` | discount: -$${discountAmount} (${promoCode})` : "") +
        (isScheduled    ? ` | scheduled: ${scheduledAt}` : " | immediate") +
        ` | driverEta: ${bookingPayload.driverInfo?.etaLabel ?? "unknown"}`
      );

      return {
        success:       true,
        rideId:        rideRef.id,
        paymentIntent: paymentIntent.id,
      };

    } catch (err) {
      console.error("[cardPayment]", err);
      throw new HttpsError("internal", err.message || "Internal server error");
    }
  }
);
