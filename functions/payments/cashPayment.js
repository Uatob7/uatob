// functions/src/cashPayment.js

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { recordPromoRedemption } = require("./validatePromoCode");

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();

exports.cashPayment = onCall(
  {
    region: "us-east1",
  },
  async (request) => {
    const { uid, bookingPayload } = request.data;

    if (!uid) {
      throw new HttpsError("invalid-argument", "Missing uid");
    }

    if (!bookingPayload?.fareEstimate) {
      throw new HttpsError("invalid-argument", "Missing bookingPayload.fareEstimate");
    }

    try {
      // ── Fare ──────────────────────────────────────────────────────
      const fareTotal    = Number(bookingPayload.fareEstimate);
      const platformFee  = +(fareTotal * 0.25).toFixed(2);
      const driverPayout = +(fareTotal * 0.75).toFixed(2);

      // ── Schedule fields ───────────────────────────────────────────
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

      // ── Promo fields ──────────────────────────────────────────────
      const promoCode      = bookingPayload.promoCode ?? null;
      const discountAmount = bookingPayload.discountAmount
        ? Number(bookingPayload.discountAmount)
        : null;

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
        promoCode,
        discountAmount,

        paymentMethod:   "cash",
        paymentIntentId: null,
        paymentStatus:   "succeeded",   // driver confirms receipt at end of trip

        driverInfo: bookingPayload.driverInfo
          ? {
              driverCount:  bookingPayload.driverInfo.driverCount  ?? null,
              etaLabel:     bookingPayload.driverInfo.etaLabel      ?? null,
              etaMin:       bookingPayload.driverInfo.etaMin        ?? null,
              nearestMiles: bookingPayload.driverInfo.nearestMiles  ?? null,
              stale:        bookingPayload.driverInfo.stale         ?? null,
            }
          : null,

        // Cash rides have no payment gate so they search immediately —
        // unless scheduled, in which case they wait until dispatch time.
        status: isScheduled ? "scheduled" : "searching_driver",

        uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // ── Record promo redemption ────────────────────────────────────
      if (promoCode) {
        try {
          await recordPromoRedemption(promoCode, uid);
        } catch (promoErr) {
          console.warn("[cashPayment] recordPromoRedemption failed:", promoErr.message);
        }
      }

      console.log(
        `[cashPayment] Ride ${rideRef.id} created — uid: ${uid} | fare: $${fareTotal}` +
        (discountAmount ? ` | discount: -$${discountAmount} (${promoCode})` : "") +
        (isScheduled    ? ` | scheduled: ${scheduledAt}` : " | immediate") +
        ` | eta: ${bookingPayload.driverInfo?.etaLabel ?? "unknown"}`
      );

      return {
        success: true,
        rideId:  rideRef.id,
      };

    } catch (err) {
      console.error("[cashPayment]", err);
      throw new HttpsError("internal", err.message || "Internal server error");
    }
  }
);
