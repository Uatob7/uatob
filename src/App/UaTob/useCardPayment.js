// src/App/UaTob/useCardPayment.js
import { useState, useCallback } from 'react';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import {
  getFirestore, collection, doc, setDoc, serverTimestamp,
} from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

const db = getFirestore(firebase_app);

export function useCardPayment({ uid, bookingPayload, onSuccess, onError }) {
  const stripe   = useStripe();
  const elements = useElements();

  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [complete, setComplete] = useState(false);
  const [focused,  setFocused]  = useState(false);

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault();

    if (!stripe || !elements) { setError('Stripe not ready'); return; }

    setLoading(true);
    setError('');

    try {
      if (!uid)            throw new Error('Missing uid');
      if (!bookingPayload) throw new Error('Missing bookingPayload');

      const fareTotal = Number(bookingPayload.fareEstimate);
      if (!fareTotal)      throw new Error('Missing fare estimate');

      const isScheduled = bookingPayload.isScheduled === true;
      const scheduledAt = isScheduled ? bookingPayload.scheduledAt : null;

      if (isScheduled) {
        if (!scheduledAt) throw new Error('scheduledAt required');
        const ms = new Date(scheduledAt).getTime();
        if (isNaN(ms))    throw new Error('Invalid scheduledAt');
        if (ms < Date.now() + 10 * 60 * 1000)
          throw new Error('Must be at least 10 minutes in future');
      }

      const platformFee  = +(fareTotal * 0.25).toFixed(2);
      const driverPayout = +(fareTotal * 0.75).toFixed(2);

      // ── 1. Write ride doc first to lock in rideId ────────────────
      const rideRef = doc(collection(db, 'Rides'));
      const rideId  = rideRef.id;

      await setDoc(rideRef, {
        uid,
        pickup:            bookingPayload.pickup            ?? null,
        dropoff:           bookingPayload.dropoff           ?? null,
        pickupCity:        bookingPayload.pickupCity        ?? null,
        dropoffCity:       bookingPayload.dropoffCity       ?? null,
        pickupLat:         bookingPayload.pickupLat         ?? null,
        pickupLng:         bookingPayload.pickupLng         ?? null,
        dropoffLat:        bookingPayload.dropoffLat        ?? null,
        dropoffLng:        bookingPayload.dropoffLng        ?? null,
        rideType:          bookingPayload.rideType          ?? 'standard',
        fareTotal,
        platformFee,
        driverPayout,
        tripDistanceMiles: bookingPayload.tripDistanceMiles ?? null,
        tripDurationMin:   bookingPayload.tripDurationMin   ?? null,
        isScheduled,
        scheduledAt:       scheduledAt                      ?? null,
        promoCode:         bookingPayload.promoCode         ?? null,
        discountAmount:    bookingPayload.discountAmount     ?? null,
        paymentMethod:     'card',
        paymentIntentId:   null,
        paymentStatus:     'pending',
        status:            'pending_dispatch',
        driverInfo:        bookingPayload.driverInfo        ?? null,
        createdAt:         serverTimestamp(),
        updatedAt:         serverTimestamp(),
      });

      // ── 2. Create PaymentIntent via Stripe REST ───────────────────
      const body = new URLSearchParams({
        amount:                   String(Math.round(fareTotal * 100)),
        currency:                 'usd',
        'payment_method_types[]': 'card',
        'metadata[uid]':          uid,
        'metadata[rideId]':       rideId,
      });

      const intentRes = await fetch('https://api.stripe.com/v1/payment_intents', {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });

      const intent = await intentRes.json();
      if (intent.error) throw new Error(intent.error.message);

      const { id: paymentIntentId, client_secret: clientSecret } = intent;

      // ── 3. Confirm card with Stripe.js ────────────────────────────
      const cardElement = elements.getElement(CardElement);

      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        { payment_method: { card: cardElement } }
      );

      if (stripeError) throw new Error(stripeError.message);
      if (paymentIntent.status !== 'succeeded')
        throw new Error(`Unexpected status: ${paymentIntent.status}`);

      // ── 4. Patch ride doc — confirmed ─────────────────────────────
      await setDoc(rideRef, {
        paymentIntentId,
        paymentStatus: 'succeeded',
        updatedAt:     serverTimestamp(),
      }, { merge: true });

      setComplete(true);

      onSuccess?.({
        method: 'card',
        rideId,
        paymentIntent: paymentIntentId,
      });

    } catch (err) {
      console.error('❌ CARD ERROR:', err);
      setError(err.message);
      onError?.(err.message);
    } finally {
      setLoading(false);
    }
  }, [uid, bookingPayload, stripe, elements, onSuccess, onError]);

  return { loading, error, complete, focused, setComplete, setError, setFocused, handleSubmit };
}