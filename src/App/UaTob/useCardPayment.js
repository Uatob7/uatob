// src/App/UaTob/useCardPayment.js
import { useState, useCallback } from 'react';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import {
  getFirestore, collection, doc,
  setDoc, updateDoc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebase_app } from '@/firebase/config';

const db               = getFirestore(firebase_app);
const functions        = getFunctions(firebase_app, 'us-east1');
const callCreateIntent = httpsCallable(functions, 'createPaymentIntent');
const callCheckIntent  = httpsCallable(functions, 'checkRideIntent');

/**
 * Card payment hook.
 *
 * Flow:
 *   1. Tokenize card → server creates PaymentIntent → stripe.confirmCardPayment
 *   2. On success → call checkRideIntent({ uid, paymentIntentId, ...rideData })
 *   3. Write Rides doc (status: 'pending_dispatch')
 *   4. After 60s → update status to 'searching_driver' (or leave as 'scheduled')
 */
export function useCardPayment({ uid, bookingPayload, onSuccess, onError }) {
  const stripe   = useStripe();
  const elements = useElements();

  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [complete, setComplete] = useState(false);
  const [focused,  setFocused]  = useState(false);

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault();
    setError('');
    if (!stripe || !elements) return;
    setLoading(true);

    try {
      // ── Validation ──────────────────────────────────────────────
      const fareTotal = Number(bookingPayload?.fareEstimate);
      if (!fareTotal) throw new Error('Missing fare estimate.');
      if (Math.round(fareTotal * 100) < 50) throw new Error('Amount too low (minimum $0.50).');

      const isScheduled = bookingPayload.isScheduled === true;
      const scheduledAt = isScheduled && bookingPayload.scheduledAt
        ? bookingPayload.scheduledAt
        : null;

      if (isScheduled) {
        if (!scheduledAt) throw new Error('scheduledAt is required for scheduled rides.');
        const ms = new Date(scheduledAt).getTime();
        if (isNaN(ms)) throw new Error('scheduledAt is not a valid date.');
        if (ms < Date.now() + 10 * 60 * 1000)
          throw new Error('Scheduled pickup must be at least 10 minutes from now.');
      }

      // ── Step 1: tokenize card ───────────────────────────────────
      const card = elements.getElement(CardElement);
      const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({ type: 'card', card });
      if (pmError) throw new Error(pmError.message);

      // ── Step 2: server creates PaymentIntent ────────────────────
      const { data: intentData } = await callCreateIntent({
        uid,
        amountCents:     Math.round(fareTotal * 100),
        paymentMethodId: paymentMethod.id,
        description:     `${isScheduled ? 'Scheduled ride' : 'Ride'}: ${bookingPayload.pickup ?? ''} → ${bookingPayload.dropoff ?? ''}`,
        metadata: {
          uid,
          rideType:          bookingPayload.rideType          ?? 'standard',
          tripDistanceMiles: String(bookingPayload.tripDistanceMiles ?? ''),
          tripDurationMin:   String(bookingPayload.tripDurationMin   ?? ''),
          pickup:            bookingPayload.pickup             ?? '',
          dropoff:           bookingPayload.dropoff            ?? '',
          pickupCity:        bookingPayload.pickupCity         ?? '',
          dropoffCity:       bookingPayload.dropoffCity        ?? '',
          platformFee:       String(+(fareTotal * 0.25).toFixed(2)),
          driverPayout:      String(+(fareTotal * 0.75).toFixed(2)),
          isScheduled:       String(isScheduled),
          scheduledAt:       scheduledAt ?? '',
          promoCode:         bookingPayload.promoCode          ?? '',
          discountAmount:    bookingPayload.discountAmount != null
                               ? String(bookingPayload.discountAmount) : '',
        },
      });

      if (!intentData?.clientSecret)
        throw new Error(intentData?.message || 'Failed to create payment intent.');

      // ── Step 3: confirm card payment (handles 3DS) ───────────────
      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
        intentData.clientSecret,
        { payment_method: paymentMethod.id },
      );
      if (confirmError) throw new Error(confirmError.message);
      if (paymentIntent.status !== 'succeeded') throw new Error('Payment did not succeed.');

      // ── Step 4: build ride object ────────────────────────────────
      const platformFee  = +(fareTotal * 0.25).toFixed(2);
      const driverPayout = +(fareTotal * 0.75).toFixed(2);

      const rideData = buildRideData({
        uid,
        bookingPayload,
        fareTotal,
        platformFee,
        driverPayout,
        isScheduled,
        scheduledAt,
        paymentMethod:   'card',
        paymentIntentId: paymentIntent.id,
      });

      // ── Step 5: call checkRideIntent ─────────────────────────────
      const { data: checkResult } = await callCheckIntent({
        uid,
        paymentIntentId: paymentIntent.id,
        rideData,
      });

      if (!checkResult?.approved)
        throw new Error(checkResult?.message || 'Ride intent check failed.');

      // ── Step 6: write Rides doc ──────────────────────────────────
      const rideRef = doc(collection(db, 'Rides'));

      await setDoc(rideRef, {
        ...rideData,
        status:    'pending_dispatch',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // ── Step 7: flip to searching_driver after 60s (not scheduled)
      if (!isScheduled) {
        setTimeout(async () => {
          try {
            await updateDoc(rideRef, {
              status:    'searching_driver',
              updatedAt: serverTimestamp(),
            });
          } catch { /* non-critical — backend can reconcile */ }
        }, 60_000);
      }

      onSuccess?.({ method: 'card', rideId: rideRef.id, paymentIntent: paymentIntent.id });

    } catch (err) {
      const m = err.message || 'Payment failed';
      setError(m);
      onError?.(m);
    } finally {
      setLoading(false);
    }
  }, [stripe, elements, uid, bookingPayload, onSuccess, onError]);

  return { loading, error, complete, focused, setComplete, setError, setFocused, handleSubmit };
}
