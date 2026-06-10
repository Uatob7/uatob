// src/App/Drivers/useNotificationCardPayment.js
import { useState, useCallback } from 'react';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import {
  getFirestore, collection, doc, setDoc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

const db = getFirestore(firebase_app);

const NOTIFICATION_AMOUNT_CENTS = 100; // $1.00
const EXPIRES_HOURS             = 24;

export function useNotificationCardPayment({ uid, message, driverName, firstName, lastName, onSuccess, onError }) {
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
      if (!uid)     throw new Error('Missing uid');
      if (!message) throw new Error('Missing message');

      // ── 1. Write Feed doc first to get feedId ────────────────────
      const feedRef  = doc(collection(db, 'Feed'));
      const feedId   = feedRef.id;
      const expiresAt = Timestamp.fromMillis(Date.now() + EXPIRES_HOURS * 3600 * 1000);

      await setDoc(feedRef, {
        uid,
        driverName:      driverName ?? null,
        firstName:       firstName  ?? null,
        lastName:        lastName   ?? null,
        message,
        status:          'pending',          // activated after payment succeeds
        paymentMethod:   'card',
        paymentIntentId: null,
        paymentStatus:   'pending',
        expiresAt,
        createdAt:       serverTimestamp(),
        updatedAt:       serverTimestamp(),
      });

      // ── 2. Create PaymentIntent via Stripe REST ───────────────────
      const body = new URLSearchParams({
        amount:                   String(NOTIFICATION_AMOUNT_CENTS),
        currency:                 'usd',
        'payment_method_types[]': 'card',
        'metadata[uid]':          uid,
        'metadata[feedId]':       feedId,
        'metadata[type]':         'driver_notification',
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

      // ── 4. Patch Feed doc — activate post ─────────────────────────
      await setDoc(feedRef, {
        paymentIntentId,
        paymentStatus: 'succeeded',
        status:        'active',
        updatedAt:     serverTimestamp(),
      }, { merge: true });

      setComplete(true);
      onSuccess?.({ method: 'card', feedId, paymentIntentId });

    } catch (err) {
      console.error('❌ NOTIFICATION CARD ERROR:', err);
      setError(err.message);
      onError?.(err.message);
    } finally {
      setLoading(false);
    }
  }, [uid, message, driverName, stripe, elements, onSuccess, onError]);

  return { loading, error, complete, focused, setComplete, setError, setFocused, handleSubmit };
}