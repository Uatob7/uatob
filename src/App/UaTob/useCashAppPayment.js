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

/**
 * DEBUG VERSION (but now writes to Firestore)
 * - No Stripe
 * - No redirects
 * - Creates real Rides docs in Firestore
 */
export function useCashAppPayment({
  uid,
  bookingPayload,
  onSuccess,
  onError,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCashApp = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      console.log('🟢 [CashApp] START');

      if (!uid) throw new Error('Missing uid');
      if (!bookingPayload) throw new Error('Missing bookingPayload');

      const fareTotal = Number(bookingPayload?.fareEstimate || 0);
      if (!fareTotal) throw new Error('Missing fare estimate');

      const isScheduled = bookingPayload?.isScheduled === true;
      const scheduledAt = isScheduled ? bookingPayload?.scheduledAt : null;

      const platformFee = +(fareTotal * 0.25).toFixed(2);
      const driverPayout = +(fareTotal * 0.75).toFixed(2);

      const mockIntentId = `pi_mock_${Date.now()}`;

      // ── FULL CONSISTENT RIDE DATA ─────────────────────────────
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

        paymentMethod: 'cashapp_debug',
        paymentStatus: 'succeeded',
        paymentIntentId: mockIntentId,


        status: isScheduled ? 'scheduled' : 'searching_driver',

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      console.log('🚗 Writing Firestore Rides doc...', rideData);

      // ── WRITE TO FIRESTORE ─────────────────────────────────────
      const rideRef = doc(collection(db, 'Rides'));

      await setDoc(rideRef, rideData);

      console.log('✅ RIDE CREATED:', rideRef.id);

      onSuccess?.({
        method: 'cashapp_debug',
        rideId: rideRef.id,
        paymentIntent: mockIntentId,
        rideData,
      });

    } catch (err) {
      console.error('❌ CashApp ERROR:', err);
      setError(err.message);
      onError?.(err.message);
    } finally {
      setLoading(false);
      console.log('🔵 [CashApp] END');
    }
  }, [uid, bookingPayload, onSuccess, onError]);

  return {
    loading,
    error,
    setError,
    handleCashApp,
  };
}