// src/App/UaTob/useCashPayment.js
import { useState, useCallback } from 'react';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

const db = getFirestore(firebase_app);

export function useCashPayment({
  uid,
  bookingPayload,
  onSuccess,
  onError,
  onClose,
}) {
  const [loading, setLoading] = useState(false);

  const handleCash = useCallback(async () => {
    setLoading(true);

    try {
      console.log('[useCashPayment] START');

      if (!uid) throw new Error('Missing uid');
      if (!bookingPayload) throw new Error('Missing bookingPayload');

      const fareTotal = Number(bookingPayload.fareEstimate || 0);
      if (!fareTotal) throw new Error('Missing fareEstimate');

      // ── split (same across system)
      const platformFee = +(fareTotal * 0.25).toFixed(2);
      const driverPayout = +(fareTotal * 0.75).toFixed(2);

      // ── schedule
      const isScheduled = bookingPayload.isScheduled === true;
      const scheduledAt =
        isScheduled && bookingPayload.scheduledAt
          ? bookingPayload.scheduledAt
          : null;

      // ── canonical ride object (MATCHES card + cashapp)
      const rideData = {
        uid,

        pickup: bookingPayload.pickup ?? null,
        dropoff: bookingPayload.dropoff ?? null,

        pickupCity: bookingPayload.pickupCity ?? null,
        pickupZip: bookingPayload.pickupZip ?? null,
        pickupLat: bookingPayload.pickupLat ?? null,
        pickupLng: bookingPayload.pickupLng ?? null,

        dropoffCity: bookingPayload.dropoffCity ?? null,
        dropoffZip: bookingPayload.dropoffZip ?? null,
        dropoffLat: bookingPayload.dropoffLat ?? null,
        dropoffLng: bookingPayload.dropoffLng ?? null,

        polyline: bookingPayload.polyline ?? null,

        rideType: bookingPayload.rideType ?? 'standard',
        rideLabel: bookingPayload.rideLabel ?? null,

        fareTotal,
        platformFee,
        driverPayout,

        tripDistanceMiles: bookingPayload.tripDistanceMiles ?? null,
        tripDurationMin: bookingPayload.tripDurationMin ?? null,
        fareBreakdown: bookingPayload.breakdown ?? null,

        isScheduled,
        scheduledAt,

        promoCode: bookingPayload.promoCode ?? null,
        discountAmount: bookingPayload.discountAmount ?? null,

        match: bookingPayload.match ?? [],

        paymentMethod: 'cash',
        paymentStatus: 'succeeded',
        paymentIntentId: null,

        status: isScheduled ? 'scheduled' : 'searching_driver',

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // ── WRITE TO FIRESTORE ─────────────────────────────
      const rideRef = doc(collection(db, 'Rides'));

      await setDoc(rideRef, rideData);

      console.log('[useCashPayment] RIDE CREATED:', rideRef.id);

      onSuccess?.({
        method: 'cash',
        rideId: rideRef.id,
        rideData,
      });

      onClose?.();
    } catch (err) {
      console.error('[useCashPayment] ERROR:', err);
      onError?.(err.message || 'Cash booking failed.');
    } finally {
      setLoading(false);
      console.log('[useCashPayment] END');
    }
  }, [uid, bookingPayload, onSuccess, onError, onClose]);

  return { loading, handleCash };
}