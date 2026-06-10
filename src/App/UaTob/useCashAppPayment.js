// src/App/UaTob/useCashAppPayment.js
import { useState, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  getFirestore, collection, doc, setDoc, serverTimestamp,
} from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

const db      = getFirestore(firebase_app);
const stripeP = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

export function useCashAppPayment({ uid, bookingPayload, onSuccess, onError }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleCashApp = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      if (!uid)            throw new Error('Missing uid');
      if (!bookingPayload) throw new Error('Missing bookingPayload');

      const fareTotal = Number(bookingPayload.fareEstimate);
      if (!fareTotal)      throw new Error('Missing fareEstimate');

      const platformFee  = +(fareTotal * 0.25).toFixed(2);
      const driverPayout = +(fareTotal * 0.75).toFixed(2);
      const isScheduled  = bookingPayload.isScheduled === true;
      const scheduledAt  = isScheduled ? bookingPayload.scheduledAt : null;

      // ── 1. Write ride doc first to get rideId ────────────────────
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
        paymentMethod:     'cashapp',
        paymentIntentId:   null,
        paymentStatus:     'pending',
        status:            'pending_dispatch',
        driverInfo:        bookingPayload.driverInfo        ?? null,
        createdAt:         serverTimestamp(),
        updatedAt:         serverTimestamp(),
      });

      // ── 2. Create PaymentIntent directly via Stripe REST ──────────
      const body = new URLSearchParams({
        amount:                        String(Math.round(fareTotal * 100)),
        currency:                      'usd',
        'payment_method_types[]':      'cashapp',
        'metadata[uid]':               uid,
        'metadata[rideId]':            rideId,
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

      // ── 3. Patch ride doc with real intent id ─────────────────────
      await setDoc(rideRef, { paymentIntentId, updatedAt: serverTimestamp() }, { merge: true });

      // ── 4. Confirm → redirects into Cash App ─────────────────────
      const stripe = await stripeP;

      const { error: stripeError } = await stripe.confirmCashappPayment(
        clientSecret,
        {
          payment_method:  {},
          return_url: `${window.location.origin}/ride-confirmed?rideId=${rideId}`,
        }
      );

      if (stripeError) throw new Error(stripeError.message);

      // confirmCashappPayment redirects on success — won't reach here

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