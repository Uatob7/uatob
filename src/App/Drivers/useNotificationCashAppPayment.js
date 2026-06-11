// src/App/Drivers/useNotificationCashAppPayment.js
import { useState, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  getFirestore, collection, doc, setDoc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

const db      = getFirestore(firebase_app);
const stripeP = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

const NOTIFICATION_AMOUNT_CENTS = 100; // $1.00
const EXPIRES_HOURS             = 24;

export function useNotificationCashAppPayment({ uid, message, driverName, firstName, lastName, role = 'driver', onSuccess, onError }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const handleCashAppPay = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      if (!uid)     throw new Error('Missing uid');
      if (!message) throw new Error('Missing message');

      // ── 1. Write Feed doc first to get feedId ────────────────────
      const feedRef   = doc(collection(db, 'Feed'));
      const feedId    = feedRef.id;
      const expiresAt = Timestamp.fromMillis(Date.now() + EXPIRES_HOURS * 3600 * 1000);

      await setDoc(feedRef, {
        uid,
        role,
        driverName:      driverName ?? null,
        firstName:       firstName  ?? null,
        lastName:        lastName   ?? null,
        message,
        status:          'pending',          // webhook / return_url flow activates this
        paymentMethod:   'cashapp',
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
        'payment_method_types[]': 'cashapp',
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

      // ── 3. Patch Feed doc with real intent id ─────────────────────
      await setDoc(feedRef, { paymentIntentId, updatedAt: serverTimestamp() }, { merge: true });

      // ── 4. Confirm → redirects into Cash App ─────────────────────
      const stripe = await stripeP;

      const { error: stripeError } = await stripe.confirmCashappPayment(
        clientSecret,
        {
          payment_method: {},
          return_url: `${window.location.origin}`,
        }
      );

      if (stripeError) throw new Error(stripeError.message);

      // confirmCashappPayment redirects on success — won't reach here

    } catch (err) {
      console.error('❌ NOTIFICATION CASHAPP ERROR:', err);
      setError(err.message);
      onError?.(err.message);
    } finally {
      setLoading(false);
    }
  }, [uid, message, driverName, onSuccess, onError]);

  return { loading, error, setError, handleCashAppPay };
}