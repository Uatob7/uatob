import { useState, useCallback } from 'react';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import {
  getFirestore, collection, doc, setDoc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

const db = getFirestore(firebase_app);

export function useNotificationCardPayment({ uid, message, driverName, onSuccess, onError }) {
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
      if (!uid) throw new Error('Driver UID missing.');

      // 1. Create PaymentIntent via Stripe REST
      const body = new URLSearchParams({
        amount:                   '100',
        currency:                 'usd',
        'payment_method_types[]': 'card',
        'metadata[uid]':          uid,
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

      // 2. Confirm card payment
      const cardElement = elements.getElement(CardElement);
      const { error: stripeErr, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        { payment_method: { card: cardElement } }
      );

      if (stripeErr) throw new Error(stripeErr.message);
      if (paymentIntent.status !== 'succeeded')
        throw new Error(`Unexpected status: ${paymentIntent.status}`);

      // 3. Write Feed doc
      const feedRef = doc(collection(db, 'Feed'));
      await setDoc(feedRef, {
        uid,
        driverName:     driverName ?? null,
        message:        message.trim(),
        status:         'active',
        expiresAt:      Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)),
        paymentIntentId,
        paymentStatus:  'succeeded',
        paymentMethod:  'card',
        createdAt:      serverTimestamp(),
      });

      onSuccess?.();
    } catch (err) {
      setError(err.message || 'Payment failed. Try again.');
      onError?.(err.message || 'Payment failed. Try again.');
    } finally {
      setLoading(false);
    }
  }, [uid, message, driverName, stripe, elements, onSuccess, onError]);

  return { loading, error, complete, focused, setComplete, setError, setFocused, handleSubmit };
}
