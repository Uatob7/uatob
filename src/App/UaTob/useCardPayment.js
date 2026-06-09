// src/App/UaTob/useCardPayment.js
import { useState, useCallback } from 'react';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { getFirestore, collection, doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebase_app } from '@/firebase/config';

const db              = getFirestore(firebase_app);
const functions       = getFunctions(firebase_app, 'us-east1');
// Slim server stub — ONLY creates the PaymentIntent and returns clientSecret.
// The secret key never touches the client.
const callCreateIntent = httpsCallable(functions, 'createPaymentIntent');

/**
 * Card payment hook.
 *
 * Server does ONE thing: stripe.paymentIntents.create → returns clientSecret.
 * Everything else (card tokenization, 3DS, Firestore write) runs client-side.
 *
 * @param {string}   uid            Firebase UID
 * @param {object}   bookingPayload Final payload
 * @param {function} onSuccess      Called with { method: 'card', rideId, paymentIntent }
 * @param {function} onError        Called with error message string
 *
 * Returns:
 *   loading        bool
 *   error          string
 *   complete       bool   — mirrors CardElement's complete state
 *   focused        bool   — mirrors CardElement's focus state
 *   setComplete    (bool)   => void
 *   setError       (string) => void
 *   setFocused     (bool)   => void
 *   handleSubmit   (e: Event) => Promise<void>
 */
export function useCardPayment({ uid, bookingPayload, onSuccess, onError }) {
  const stripe   = useStripe();
  const elements = useElements();

  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [complete, setComplete] = useState(false);
  const [focused,  setFocused]  = useState(false);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError('');
    if (!stripe || !elements) return;
    setLoading(true);

    try {
      // ── Validation (mirrors server guards) ──────────────────────
      const fareTotal = Number(bookingPayload?.fareEstimate);
      if (!fareTotal) throw new Error('Missing fare estimate.');
      if (Math.round(fareTotal * 100) < 50) throw new Error('Amount too low (minimum $0.50).');

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

      // ── Step 1: tokenize card ───────────────────────────────────
      const card = elements.getElement(CardElement);
      const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card,
      });
      if (pmError) throw new Error(pmError.message);

      // ── Step 2: server creates PaymentIntent, returns clientSecret
      // The function only needs amount + metadata; no business logic.
      const { data: intentData } = await callCreateIntent({
        uid,
        amountCents:    Math.round(fareTotal * 100),
        paymentMethodId: paymentMethod.id,
        description:    `${isScheduled ? 'Scheduled ride' : 'Ride'}: ${bookingPayload.pickup ?? ''} → ${bookingPayload.dropoff ?? ''}`,
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
          promoCode:         bookingPayload.promoCode      ?? '',
          discountAmount:    bookingPayload.discountAmount != null
                               ? String(bookingPayload.discountAmount) : '',
          driverCount:       String(bookingPayload.driverInfo?.driverCount  ?? ''),
          driverEtaMin:      String(bookingPayload.driverInfo?.etaMin       ?? ''),
          driverEtaLabel:    bookingPayload.driverInfo?.etaLabel             ?? '',
          driverNearestMi:   String(bookingPayload.driverInfo?.nearestMiles ?? ''),
          driverStale:       String(bookingPayload.driverInfo?.stale        ?? ''),
        },
      });

      if (!intentData?.clientSecret) throw new Error(intentData?.message || 'Failed to create payment intent.');

      // ── Step 3: confirm (handles 3DS automatically) ─────────────
      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
        intentData.clientSecret,
        { payment_method: paymentMethod.id }
      );
      if (confirmError) throw new Error(confirmError.message);
      if (paymentIntent.status !== 'succeeded') throw new Error('Payment did not succeed.');

      // ── Step 4: write ride to Firestore ─────────────────────────
      const fareTotal2    = fareTotal; // alias for clarity below
      const platformFee   = +(fareTotal2 * 0.25).toFixed(2);
      const driverPayout  = +(fareTotal2 * 0.75).toFixed(2);
      const promoCode     = bookingPayload.promoCode      ?? null;
      const discountAmount = bookingPayload.discountAmount
        ? Number(bookingPayload.discountAmount)
        : null;

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

        fareTotal: fareTotal2,
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

        paymentMethod:   'card',
        paymentIntentId: paymentIntent.id,
        paymentStatus:   'pending',   // webhook flips this to 'succeeded'

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

      onSuccess?.({ method: 'card', rideId: rideRef.id, paymentIntent: paymentIntent.id });

    } catch (err) {
      const m = err.message || 'Payment failed';
      setError(m);
      onError?.(m);
    } finally {
      setLoading(false);
    }
  }, [stripe, elements, uid, bookingPayload, onSuccess, onError]);

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