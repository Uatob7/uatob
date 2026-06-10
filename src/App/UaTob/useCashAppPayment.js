// src/App/UaTob/useCashAppPayment.js
import { useState, useEffect, useCallback } from 'react';
import { useStripe } from '@stripe/react-stripe-js';
import {
  getFirestore, collection, doc,
  setDoc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebase_app } from '@/firebase/config';
import { buildRideData } from './rideUtils';

const db               = getFirestore(firebase_app);
const functions        = getFunctions(firebase_app, 'us-east1');
const callCreateIntent = httpsCallable(functions, 'createPaymentIntent');
const callCheckIntent  = httpsCallable(functions, 'checkRideIntent');

const STORAGE_KEY = 'cashapp_pending_booking';

/**
 * Cash App Pay hook.
 *
 * Flow:
 *   1. handleCashApp → server creates PaymentIntent → stripe.confirmCashappPayment (redirect)
 *   2. Cash App redirects back with ?payment_intent=... in URL
 *   3. useEffect detects redirect, restores saved booking from sessionStorage
 *   4. Calls checkRideIntent({ uid, paymentIntentId, rideData })
 *   5. Writes Rides doc (status: 'pending_dispatch')
 *   6. After 60s → updates status to 'searching_driver' (unless scheduled)
 */
export function useCashAppPayment({ uid, bookingPayload, onSuccess, onError }) {
  const stripe = useStripe();

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  // ── On mount: handle Cash App redirect return ──────────────────
  useEffect(() => {
    if (!stripe) return;

    const params          = new URLSearchParams(window.location.search);
    const paymentIntentId = params.get('payment_intent');
    const clientSecret    = params.get('payment_intent_client_secret');
    const redirectStatus  = params.get('redirect_status');

    if (!paymentIntentId || !clientSecret) return;

    // Strip Stripe params from URL immediately.
    window.history.replaceState({}, '', window.location.pathname);

    if (redirectStatus !== 'succeeded') {
      const m = redirectStatus === 'canceled'
        ? 'Cash App payment was canceled.'
        : 'Cash App payment did not complete.';
      setError(m);
      onError?.(m);
      return;
    }

    // Restore saved booking.
    let saved = null;
    try { saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null'); } catch {}
    sessionStorage.removeItem(STORAGE_KEY);

    if (!saved) {
      onSuccess?.({ method: 'cashapp', rideId: null, paymentIntent: paymentIntentId });
      return;
    }

    setLoading(true);
    (async () => {
      try {
        const { savedUid, fareTotal, isScheduled, scheduledAt,
                platformFee, driverPayout, savedPayload } = saved;

        const rideData = buildRideData({
          uid:            savedUid,
          bookingPayload: savedPayload,
          fareTotal,
          platformFee,
          driverPayout,
          isScheduled,
          scheduledAt,
          paymentMethod:   'cashapp',
          paymentIntentId,
        });

        // ── checkRideIntent ────────────────────────────────────────
        const { data: checkResult } = await callCheckIntent({
          uid:            savedUid,
          paymentIntentId,
          rideData,
        });

        if (!checkResult?.approved)
          throw new Error(checkResult?.message || 'Ride intent check failed.');

        // ── Write Rides doc ────────────────────────────────────────
        const rideRef = doc(collection(db, 'Rides'));

        await setDoc(rideRef, {
          ...rideData,
          status:    'pending_dispatch',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // ── Flip to searching_driver after 60s ─────────────────────
        if (!isScheduled) {
          setTimeout(async () => {
            try {
              await updateDoc(rideRef, {
                status:    'searching_driver',
                updatedAt: serverTimestamp(),
              });
            } catch { /* non-critical */ }
          }, 60_000);
        }

        onSuccess?.({ method: 'cashapp', rideId: rideRef.id, paymentIntent: paymentIntentId });

      } catch (err) {
        const m = err.message || 'Failed to save ride after Cash App payment';
        setError(m);
        onError?.(m);
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line
  }, [stripe]);

  // ── Initiate Cash App Pay ──────────────────────────────────────
  const handleCashApp = useCallback(async () => {
    setError('');
    if (!stripe) return;
    setLoading(true);

    try {
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

      const { data: intentData } = await callCreateIntent({
        uid,
        amountCents:        Math.round(fareTotal * 100),
        paymentMethodTypes: ['cashapp'],
        description:        `${isScheduled ? 'Scheduled ride' : 'Ride'}: ${bookingPayload.pickup ?? ''} → ${bookingPayload.dropoff ?? ''}`,
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

      const platformFee  = +(fareTotal * 0.25).toFixed(2);
      const driverPayout = +(fareTotal * 0.75).toFixed(2);

      // Persist everything needed to rebuild rideData after redirect.
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        savedUid:     uid,
        fareTotal,
        isScheduled,
        scheduledAt,
        platformFee,
        driverPayout,
        savedPayload: bookingPayload,   // full payload survives redirect
      }));

      const { error: confirmError } = await stripe.confirmCashappPayment(
        intentData.clientSecret,
        { return_url: window.location.href },
      );
      if (confirmError) throw new Error(confirmError.message);

    } catch (err) {
      sessionStorage.removeItem(STORAGE_KEY);
      const m = err.message || 'Payment failed';
      setError(m);
      onError?.(m);
    } finally {
      setLoading(false);
    }
  }, [stripe, uid, bookingPayload, onSuccess, onError]);

  return { loading, error, setError, handleCashApp };
}
