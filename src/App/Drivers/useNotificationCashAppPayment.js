import { useState, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  getFirestore, collection, doc, setDoc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

const db      = getFirestore(firebase_app);
const stripeP = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

export function useNotificationCashAppPayment({ uid, message, driverName, onSuccess, onError }) {
  const [loading, setLoading] = useState(false);

  const handleCashAppPay = useCallback(async () => {
    setLoading(true);
    try {
      if (!uid) throw new Error('Driver UID missing.');

      // 1. Create PaymentIntent via Stripe REST
      const body = new URLSearchParams({
        amount:                        '100',
        currency:                      'usd',
        'payment_method_types[]':      'cashapp',
        'metadata[uid]':               uid,
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

      // 2. Write Feed doc as pending (webhook will activate on payment_intent.succeeded)
      const feedRef = doc(collection(db, 'Feed'));
      await setDoc(feedRef, {
        uid,
        driverName:     driverName ?? null,
        message:        message.trim(),
        status:         'pending',
        expiresAt:      Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)),
        paymentIntentId,
        paymentStatus:  'pending',
        paymentMethod:  'cashapp',
        createdAt:      serverTimestamp(),
      });

      // 3. Confirm → redirects into Cash App
      const stripe = await stripeP;
      const { error: stripeErr } = await stripe.confirmCashappPayment(
        clientSecret,
        {
          payment_method: { cashapp: {} },
          return_url: `${window.location.origin}`,
        }
      );

      // confirmCashappPayment redirects on success — won't reach here
      if (stripeErr) throw new Error(stripeErr.message);

      onSuccess?.();
    } catch (err) {
      onError?.(err.message || 'Cash App payment failed. Try again.');
    } finally {
      setLoading(false);
    }
  }, [uid, message, driverName, onSuccess, onError]);

  return { loading, handleCashAppPay };
}
