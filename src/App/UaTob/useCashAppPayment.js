// src/App/UaTob/useCashAppPayment.js
import { useState, useEffect, useCallback } from 'react';
import { useStripe } from '@stripe/react-stripe-js';
import { getFirestore, collection, doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { firebase_app } from '@/firebase/config';

const db               = getFirestore(firebase_app);
const functions        = getFunctions(firebase_app, 'us-east1');
const callCreateIntent = httpsCallable(functions, 'createPaymentIntent');

// Booking payload is persisted across the Cash App redirect.
const STORAGE_KEY = 'cashapp_pending_booking';

/**
 * Cash App Pay hook — mirrors useCardPayment.
 *
 * Flow:
 *   1. handleSubmit  → server creates PaymentIntent (cashapp)
 *   2. confirmCashAppPayment → redirects user to Cash App
 *   3. Cash App redirects back with ?payment_intent=... in the URL
 *   4. useEffect on mount detects paymentIntentId, writes ride to Firestore
 *
 * @param {string}   uid            Firebase UID
 * @param {object}   bookingPayload Final payload
 * @param {function} onSuccess      Called with { method: 'cashapp', rideId, paymentIntent }
 * @param {function} onError        Called with error message string
 *
 * Returns:
 *   loading        bool
 *   error          string
 *   setError       (string) => void
 *   handleSubmit   (e?: Event) => Promise<void>
 */
export function useCashAppPayment({ uid, bookingPayload, onSuccess, onError }) {
  const stripe = useStripe();

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  // ── On mount: check if we just returned from a Cash App redirect ───────────
  useEffect(() => {
    if (!stripe) return;

    const params          = new URLSearchParams(window.location.search);
    const paymentIntentId = params.get('payment_intent');
    const clientSecret    = params.get('payment_intent_client_secret');
    const redirectStatus  = params.get('redirect_status');

    if (!paymentIntentId || !clientSecret) return;

    // Strip the Stripe params from the URL immediately.
    window.history.replaceState({}, '', window.location.pathname);

    if (redirectStatus !== 'succeeded') {
      const m = redirectStatus === 'canceled'
        ? 'Cash App payment was canceled.'
        : 'Cash App payment did not complete.';
      setError(m);
      onError?.(m);
      return;
    }

    // Restore the booking payload saved before the redirect.
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
        const {
          savedUid, fareTotal, isScheduled, scheduledAt,
          platformFee, driverPayout, promoCode, discountAmount,
          pickup, dropoff, pickupCity, pickupZip, pickupLat, pickupLng,
          dropoffCity, dropoffZip, dropoffLat, dropoffLng,
          polyline, rideType, rideLabel,
          tripDistanceMiles, tripDurationMin, breakdown,
          driverInfo,
        } = saved;

        const rideRef = doc(collection(db, 'Rides'));

        await setDoc(rideRef, {
          pickup,
          dropoff,

          pickupCity,
          pickupZip,
          pickupLat,
          pickupLng,

          dropoffCity,
          dropoffZip,
          dropoffLat,
          dropoffLng,

          polyline,

          rideType:  rideType  ?? 'standard',
          rideLabel: rideLabel ?? null,

          fareTotal,
          platformFee,
          driverPayout,
          payoutStatus: 'pending',

          tripDistanceMiles: tripDistanceMiles ?? null,
          tripDurationMin:   tripDurationMin   ?? null,
          fareBreakdown:     breakdown         ?? null,

          isScheduled,
          scheduledAt: scheduledAt
            ? Timestamp.fromDate(new Date(scheduledAt))
            : null,

          promoCode:      promoCode      ?? null,
          discountAmount: discountAmount ?? null,

          paymentMethod:   'cashapp',
          paymentIntentId,
          paymentStatus:   'pending',   // webhook flips this to 'succeeded'

          driverInfo: driverInfo
            ? {
                driverCount:  driverInfo.driverCount  ?? null,
                etaLabel:     driverInfo.etaLabel      ?? null,
                etaMin:       driverInfo.etaMin        ?? null,
                nearestMiles: driverInfo.nearestMiles  ?? null,
                stale:        driverInfo.stale         ?? null,
              }
            : null,

          status: isScheduled ? 'scheduled' : 'searching_driver',

          uid: savedUid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

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

  // ── Initiate Cash App Pay ──────────────────────────────────────────────────
  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault();
    setError('');
    if (!stripe) return;
    setLoading(true);

    try {
      // ── Validation (mirrors card hook) ──────────────────────────
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

      // ── Step 1: server creates PaymentIntent ────────────────────
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

      // ── Step 2: persist booking so it survives the redirect ─────
      const platformFee  = +(fareTotal * 0.25).toFixed(2);
      const driverPayout = +(fareTotal * 0.75).toFixed(2);

      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        savedUid:          uid,
        fareTotal,
        isScheduled,
        scheduledAt,
        platformFee,
        driverPayout,
        promoCode:         bookingPayload.promoCode         ?? null,
        discountAmount:    bookingPayload.discountAmount != null
                             ? Number(bookingPayload.discountAmount) : null,
        pickup:            bookingPayload.pickup            ?? null,
        dropoff:           bookingPayload.dropoff           ?? null,
        pickupCity:        bookingPayload.pickupCity        ?? null,
        pickupZip:         bookingPayload.pickupZip         ?? null,
        pickupLat:         bookingPayload.pickupLat         ?? null,
        pickupLng:         bookingPayload.pickupLng         ?? null,
        dropoffCity:       bookingPayload.dropoffCity       ?? null,
        dropoffZip:        bookingPayload.dropoffZip        ?? null,
        dropoffLat:        bookingPayload.dropoffLat        ?? null,
        dropoffLng:        bookingPayload.dropoffLng        ?? null,
        polyline:          bookingPayload.polyline          ?? null,
        rideType:          bookingPayload.rideType          ?? 'standard',
        rideLabel:         bookingPayload.rideLabel         ?? null,
        tripDistanceMiles: bookingPayload.tripDistanceMiles ?? null,
        tripDurationMin:   bookingPayload.tripDurationMin   ?? null,
        breakdown:         bookingPayload.breakdown         ?? null,
        driverInfo:        bookingPayload.driverInfo        ?? null,
      }));

      // ── Step 3: confirm → redirects user to Cash App ────────────
      const { error: confirmError } = await stripe.confirmCashappPayment(
        intentData.clientSecret,
        { return_url: window.location.href }
      );
      // Only reached if the redirect did NOT happen (i.e. an error).
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

  return { loading, error, setError, handleSubmit };
}
