// src/App/UaTob/rideUtils.js
import { Timestamp } from 'firebase/firestore';

/**
 * Builds a clean, consistent Rides doc object from booking payload + payment data.
 * Used by all three payment hooks so the shape is always identical.
 *
 * @param {object} opts
 * @param {string}  opts.uid
 * @param {object}  opts.bookingPayload
 * @param {number}  opts.fareTotal
 * @param {number}  opts.platformFee
 * @param {number}  opts.driverPayout
 * @param {boolean} opts.isScheduled
 * @param {string|null} opts.scheduledAt     ISO string or null
 * @param {string}  opts.paymentMethod       'card' | 'cashapp' | 'cash'
 * @param {string|null} opts.paymentIntentId  null for cash
 *
 * @returns {object} Firestore-ready ride document (no createdAt/updatedAt/status —
 *                   those are set by the hook at write time)
 */
export function buildRideData({
  uid,
  bookingPayload,
  fareTotal,
  platformFee,
  driverPayout,
  isScheduled,
  scheduledAt,
  paymentMethod,
  paymentIntentId,
}) {
  const promoCode      = bookingPayload.promoCode      ?? null;
  const discountAmount = bookingPayload.discountAmount
    ? Number(bookingPayload.discountAmount)
    : null;

  return {
    uid,

    // ── Addresses ───────────────────────────────────────────────
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

    polyline: bookingPayload.polyline ?? null,

    // ── Ride ────────────────────────────────────────────────────
    rideType:  bookingPayload.rideType  ?? 'standard',
    rideLabel: bookingPayload.rideLabel ?? null,

    tripDistanceMiles: bookingPayload.tripDistanceMiles ?? null,
    tripDurationMin:   bookingPayload.tripDurationMin   ?? null,
    fareBreakdown:     bookingPayload.breakdown         ?? null,

    // ── Fare ────────────────────────────────────────────────────
    fareTotal,
    platformFee,
    driverPayout,
    payoutStatus: 'pending',

    promoCode,
    discountAmount,

    // ── Schedule ─────────────────────────────────────────────────
    isScheduled,
    scheduledAt: scheduledAt
      ? Timestamp.fromDate(new Date(scheduledAt))
      : null,

    // ── Payment ──────────────────────────────────────────────────
    paymentMethod,
    paymentIntentId,
    paymentStatus: paymentMethod === 'cash' ? 'succeeded' : 'pending',

    // ── Driver snapshot ──────────────────────────────────────────
    driverInfo: bookingPayload.driverInfo
      ? {
          driverCount:  bookingPayload.driverInfo.driverCount  ?? null,
          etaLabel:     bookingPayload.driverInfo.etaLabel      ?? null,
          etaMin:       bookingPayload.driverInfo.etaMin        ?? null,
          nearestMiles: bookingPayload.driverInfo.nearestMiles  ?? null,
          stale:        bookingPayload.driverInfo.stale         ?? null,
        }
      : null,
  };
}
