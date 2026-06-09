// src/App/UaTob/useCashPayment.js
import { useState, useCallback } from 'react';
import { getFirestore, collection, doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

const db = getFirestore(firebase_app);

/**
 * Writes a cash ride directly to Firestore — no Cloud Function.
 * Mirrors the logic in cashPayment.js: fare split, schedule validation,
 * promo fields, and status assignment.
 *
 * @param {string}   uid            Firebase UID
 * @param {object}   bookingPayload Final payload (with scheduledAt, promoCode, driverInfo, etc.)
 * @param {function} onSuccess      Called with { method: 'cash', rideId }
 * @param {function} onError        Called with error message string
 * @param {function} onClose        Called after a successful booking to dismiss the modal
 *
 * Returns:
 *   loading       bool
 *   handleCash()  => Promise<void>
 */
export function useCashPayment({ uid, bookingPayload, onSuccess, onError, onClose }) {
  const [loading, setLoading] = useState(false);

  const handleCash = useCallback(async () => {
    if (!uid)                          throw new Error('Missing uid');
    if (!bookingPayload?.fareEstimate) throw new Error('Missing fareEstimate');

    setLoading(true);
    try {
      // ── Fare split ──────────────────────────────────────────────
      const fareTotal    = Number(bookingPayload.fareEstimate);
      const platformFee  = +((fareTotal * 0.25).toFixed(2));
      const driverPayout = +((fareTotal * 0.75).toFixed(2));

      // ── Schedule validation ─────────────────────────────────────
      const isScheduled = bookingPayload.isScheduled === true;
      const scheduledAt = isScheduled && bookingPayload.scheduledAt
        ? bookingPayload.scheduledAt
        : null;

      if (isScheduled) {
        if (!scheduledAt) throw new Error('scheduledAt is required for scheduled rides.');
        const scheduledMs = new Date(scheduledAt).getTime();
        if (isNaN(scheduledMs)) throw new Error('scheduledAt is not a valid date.');
        if (scheduledMs < Date.now() + 10 * 60 * 1000)
          throw new Error('Scheduled pickup must be at least 10 minutes from now.');
      }

      // ── Promo ───────────────────────────────────────────────────
      const promoCode      = bookingPayload.promoCode      ?? null;
      const discountAmount = bookingPayload.discountAmount
        ? Number(bookingPayload.discountAmount)
        : null;

      // ── Firestore write ─────────────────────────────────────────
      const rideRef = doc(collection(db, 'Rides'));

      await setDoc(rideRef, {
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

        rideType:  bookingPayload.rideType  ?? 'standard',
        rideLabel: bookingPayload.rideLabel ?? null,

        fareTotal,
        platformFee,
        driverPayout,
        payoutStatus: 'pending',

        tripDistanceMiles: bookingPayload.tripDistanceMiles ?? null,
        tripDurationMin:   bookingPayload.tripDurationMin   ?? null,
        fareBreakdown:     bookingPayload.breakdown         ?? null,

        isScheduled,
        scheduledAt: scheduledAt
          ? Timestamp.fromDate(new Date(scheduledAt))
          : null,

        promoCode,
        discountAmount,

        paymentMethod:   'cash',
        paymentIntentId: null,
        paymentStatus:   'succeeded',

        driverInfo: bookingPayload.driverInfo
          ? {
              driverCount:  bookingPayload.driverInfo.driverCount  ?? null,
              etaLabel:     bookingPayload.driverInfo.etaLabel      ?? null,
              etaMin:       bookingPayload.driverInfo.etaMin        ?? null,
              nearestMiles: bookingPayload.driverInfo.nearestMiles  ?? null,
              stale:        bookingPayload.driverInfo.stale         ?? null,
            }
          : null,

        status: isScheduled ? 'scheduled' : 'searching_driver',

        uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      onSuccess?.({ method: 'cash', rideId: rideRef.id });
      onClose?.();
    } catch (err) {
      onError?.(err.message || 'Cash booking failed.');
    } finally {
      setLoading(false);
    }
  }, [uid, bookingPayload, onSuccess, onError, onClose]);

  return { loading, handleCash };
}