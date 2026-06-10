// src/App/UaTob/useCashAppPayment.js

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

export function useCashAppPayment({ uid, bookingPayload, onSuccess, onError }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCashApp = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      console.log('🟢 [CashApp] START');

      if (!uid) throw new Error('Missing uid');
      if (!bookingPayload) throw new Error('Missing bookingPayload');

      const fareTotal = Number(bookingPayload?.fareEstimate);
      if (!fareTotal) throw new Error('Missing fareEstimate');

      const isScheduled = bookingPayload?.isScheduled === true;
      const scheduledAt = isScheduled ? bookingPayload?.scheduledAt : null;

      const platformFee = +(fareTotal * 0.25).toFixed(2);
      const driverPayout = +(fareTotal * 0.75).toFixed(2);

      const mockIntentId = `pi_mock_${Date.now()}`;

      // ── BUILD RIDE (same schema as card/cash) ───────────────────
      const rideData = {
        uid,

        pickup: bookingPayload?.pickup ?? null,
        dropoff: bookingPayload?.dropoff ?? null,

        pickupCity: bookingPayload?.pickupCity ?? null,
        dropoffCity: bookingPayload?.dropoffCity ?? null,

        pickupLat: bookingPayload?.pickupLat ?? null,
        pickupLng: bookingPayload?.pickupLng ?? null,
        dropoffLat: bookingPayload?.dropoffLat ?? null,
        dropoffLng: bookingPayload?.dropoffLng ?? null,

        rideType: bookingPayload?.rideType ?? 'standard',

        fareTotal,
        platformFee,
        driverPayout,

        tripDistanceMiles: bookingPayload?.tripDistanceMiles ?? null,
        tripDurationMin: bookingPayload?.tripDurationMin ?? null,

        isScheduled,
        scheduledAt: scheduledAt ?? null,

        promoCode: bookingPayload?.promoCode ?? null,
        discountAmount: bookingPayload?.discountAmount ?? null,

        paymentMethod: 'cashapp_debug',
        paymentIntentId: mockIntentId,
        paymentStatus: 'succeeded',

        status: 'pending_dispatch',

        driverInfo: bookingPayload?.driverInfo ?? null,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      console.log('🚗 Writing CashApp ride to Firestore...');

      // ── FIRESTORE WRITE (THIS WAS MISSING) ───────────────────────
      const rideRef = doc(collection(db, 'Rides'));
      await setDoc(rideRef, rideData);

      console.log('✅ CashApp Ride Created:', rideRef.id);

      // ── delayed driver search ───────────────────────────────────
      if (!isScheduled) {
        setTimeout(async () => {
          try {
            await setDoc(
              rideRef,
              {
                status: 'searching_driver',
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );
          } catch (e) {
            console.log('⚠️ status update failed (non-critical)');
          }
        }, 60000);
      }

      onSuccess?.({
        method: 'cashapp',
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
    }
  }, [uid, bookingPayload, onSuccess, onError]);

  return { loading, error, setError, handleCashApp };
}