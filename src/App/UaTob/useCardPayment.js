// src/App/UaTob/useCardPayment.js

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
 * DEBUG CARD PAYMENT FLOW (NOW PERSISTS TO FIRESTORE)
 * - No Stripe
 * - Mock payment
 * - Writes to Rides collection
 */
export function useCardPayment({ uid, bookingPayload, onSuccess, onError }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);
  const [focused, setFocused] = useState(false);

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault();

    setLoading(true);
    setError('');

    try {
      console.log('💳 [CARD DEBUG + FIRESTORE] Start');

      if (!uid) throw new Error('Missing uid');
      if (!bookingPayload) throw new Error('Missing bookingPayload');

      const fareTotal = Number(bookingPayload?.fareEstimate);
      if (!fareTotal) throw new Error('Missing fare estimate');

      // ── schedule validation (same as real system) ────────────────
      const isScheduled = bookingPayload?.isScheduled === true;
      const scheduledAt = isScheduled ? bookingPayload?.scheduledAt : null;

      if (isScheduled) {
        if (!scheduledAt) throw new Error('scheduledAt required');
        const ms = new Date(scheduledAt).getTime();
        if (isNaN(ms)) throw new Error('Invalid scheduledAt');
        if (ms < Date.now() + 10 * 60 * 1000) {
          throw new Error('Must be at least 10 minutes in future');
        }
      }

      // ── fee breakdown ───────────────────────────────────────────
      const platformFee = +(fareTotal * 0.25).toFixed(2);
      const driverPayout = +(fareTotal * 0.75).toFixed(2);

      // ── mock payment objects ────────────────────────────────────
      const mockPaymentIntent = {
        id: `pi_mock_${Date.now()}`,
        status: 'succeeded',
      };

      console.log('🧾 Mock PaymentIntent:', mockPaymentIntent);

      // ── build canonical ride object (REAL FORMAT) ───────────────
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

        paymentMethod: 'card_debug',
        paymentIntentId: mockPaymentIntent.id,
        paymentStatus: 'succeeded',


        status: 'pending_dispatch',

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      console.log('🚗 Writing ride to Firestore...');

      // ── FIRESTORE WRITE ─────────────────────────────────────────
      const rideRef = doc(collection(db, 'Rides'));

      await setDoc(rideRef, rideData);

      console.log('✅ Ride saved:', rideRef.id);


      setComplete(true);

      onSuccess?.({
        method: 'card_debug',
        rideId: rideRef.id,
        paymentIntent: mockPaymentIntent.id,
        rideData,
      });

    } catch (err) {
      console.error('❌ CARD DEBUG ERROR:', err);
      setError(err.message);
      onError?.(err.message);
    } finally {
      setLoading(false);
    }
  }, [uid, bookingPayload, onSuccess, onError]);

  return {
    loading,
    error,
    complete,
    focused,
    setComplete,
    setError,
    setFocused,
    handleSubmit,
  };
}