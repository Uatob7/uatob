// src/App/UaTob/useCashAppPayment.js
import { useState, useCallback } from 'react';
import { useStripe } from '@stripe/react-stripe-js';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebase_app } from '@/firebase/config';

const functions           = getFunctions(firebase_app, 'us-east1');
const callCreateCashAppIntent = httpsCallable(functions, 'createCashAppIntent');

/**
 * Cash App Pay hook.
 *
 * Server (createCashAppIntent) does:
 *   - stripe.paymentIntents.create with payment_method_types: ["cashapp"]
 *   - Firestore ride write (status: "pending_payment")
 *   - Promo redemption recording
 *   - Returns { clientSecret, rideId }
 *
 * Hook does:
 *   - Calls the function
 *   - Confirms via stripe.confirmCashappPayment (redirects user to Cash App)
 *   - Calls onSuccess with rideId so the caller can navigate/display confirmation
 *
 * Note: payment_intent.succeeded webhook is responsible for transitioning
 * the ride from "pending_payment" → "scheduled" or "searching_driver".
 *
 * @param {string}   uid            Firebase UID
 * @param {object}   bookingPayload Final payload
 * @param {function} onSuccess      Called with { method: 'cashapp', rideId }
 * @param {function} onError        Called with error message string
 *
 * Returns:
 *   loading         bool
 *   handleCashApp() => Promise<void>
 */
export function useCashAppPayment({ uid, bookingPayload, onSuccess, onError }) {
  const stripe    = useStripe();
  const [loading, setLoading] = useState(false);

  const handleCashApp = useCallback(async () => {
    setLoading(true);
    try {
      // ── Step 1: server creates intent + writes ride ──────────────
      const { data } = await callCreateCashAppIntent({ uid, bookingPayload });

      if (!data?.clientSecret)
        throw new Error(data?.message || 'Failed to initiate Cash App payment.');

      // ── Step 2: client confirms — opens Cash App via redirect ────
      const { error } = await stripe.confirmCashappPayment(data.clientSecret, {
        payment_method: { cashapp: {} },
        return_url: `${window.location.origin}`,
      });

      if (error) throw new Error(error.message || 'Cash App payment failed.');

      // confirmCashappPayment resolves after the user returns from Cash App.
      // At this point the PaymentIntent is succeeded (webhook has fired or
      // will fire imminently). Surface the rideId for confirmation UI.
      onSuccess?.({ method: 'cashapp', rideId: data.rideId });

    } catch (err) {
      onError?.(err.message || 'Cash App payment failed.');
    } finally {
      setLoading(false);
    }
  }, [stripe, uid, bookingPayload, onSuccess, onError]);

  return { loading, handleCashApp };
}