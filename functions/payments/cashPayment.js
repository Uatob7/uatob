const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

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
      const fareTotal    = Number(bookingPayload.fareEstimate);
      const platformFee  = +(fareTotal * 0.25).toFixed(2);
      const driverPayout = +(fareTotal * 0.75).toFixed(2);

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

        status:    "searching_driver",   // no payment gate — search starts immediately
        uid,

        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(
        `[cashPayment] Ride ${rideRef.id} created — uid: ${uid} | fare: $${fareTotal} | eta: ${bookingPayload.driverInfo?.etaLabel ?? "unknown"}`
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