// src/App/UaTob/useClaimRequest.js
//
// Converts an open Request into a paying Ride. Runs as a Firestore transaction
// so the open→claimed flip and the Ride creation are atomic: if two riders tap
// "Pay" on the same request at once, exactly one wins and the other gets a
// clean `already_claimed` error to surface as a "just taken" toast.
//
// The Ride doc mirrors the canonical shape written by useCashPayment (uid, fare
// split, paymentMethod, status) so the existing driver-matching, tracking and
// settlement pipeline works unchanged.

import { useState, useCallback } from 'react';
import {
  getFirestore,
  doc,
  collection,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

const db = getFirestore(firebase_app);

// Platform take-rate — identical to useCashPayment so payouts reconcile.
const PLATFORM_RATE = 0.25;

export class ClaimError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;         // 'already_claimed' | 'not_found' | 'missing'
    this.name = 'ClaimError';
  }
}

export function useClaimRequest(uid) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  // request: the board request object (must include .id)
  // paymentMethod: 'cash' | 'card' | 'cashapp'
  const claimRequest = useCallback(
    async (request, paymentMethod = 'cash') => {
      if (!uid)          throw new ClaimError('missing', 'You must be signed in to book.');
      if (!request?.id)  throw new ClaimError('missing', 'Missing request.');

      setLoading(true);
      setError(null);

      const requestRef = doc(db, 'Requests', request.id);
      const rideRef    = doc(collection(db, 'Rides'));   // pre-allocate id

      try {
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(requestRef);
          if (!snap.exists()) {
            throw new ClaimError('not_found', 'This request no longer exists.');
          }
          const r = snap.data();
          if (r.status !== 'open') {
            throw new ClaimError('already_claimed', 'Another rider claimed this first.');
          }

          const fareTotal    = Number(r.fareEstimate || 0);
          const platformFee  = +(fareTotal * PLATFORM_RATE).toFixed(2);
          const driverPayout = +(fareTotal * (1 - PLATFORM_RATE)).toFixed(2);

          // Cash settles on arrival; card/cashapp are captured downstream by the
          // existing payment pipeline against this Ride id.
          const paymentStatus = paymentMethod === 'cash' ? 'succeeded' : 'pending';

          // ── Canonical Ride (mirrors useCashPayment) ──────────────────────
          tx.set(rideRef, {
            uid,                         // the acting rider (claimer) — drives useRides + tracking
            posterUid: r.uid,            // who originally posted the request
            paidBy:    uid,
            requestId: request.id,

            pickup:      r.pickup      ?? null,
            dropoff:     r.dropoff     ?? null,
            pickupCity:  r.pickupCity  ?? null,
            pickupZip:   r.pickupZip   ?? null,
            pickupLat:   r.pickupLat   ?? null,
            pickupLng:   r.pickupLng   ?? null,
            dropoffCity: r.dropoffCity ?? null,
            dropoffZip:  r.dropoffZip  ?? null,
            dropoffLat:  r.dropoffLat  ?? null,
            dropoffLng:  r.dropoffLng  ?? null,
            polyline:    r.polyline    ?? null,

            rideType:  r.rideType  ?? 'standard',
            rideLabel: r.rideLabel ?? null,

            fareTotal,
            platformFee,
            driverPayout,

            tripDistanceMiles: r.tripDistanceMiles ?? null,
            tripDurationMin:   r.tripDurationMin   ?? null,
            fareBreakdown:     r.fareBreakdown     ?? null,

            isScheduled:    false,
            scheduledAt:    null,
            promoCode:      null,
            discountAmount: null,
            match:          [],

            paymentMethod,
            paymentStatus,
            paymentIntentId: null,

            status:    'searching_driver',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          // ── Lock the request ─────────────────────────────────────────────
          tx.update(requestRef, {
            status:    'claimed',
            claimedBy: uid,
            rideId:    rideRef.id,
            paymentMethod,
            updatedAt: serverTimestamp(),
          });
        });

        return { rideId: rideRef.id };
      } catch (err) {
        const e = err instanceof ClaimError
          ? err
          : new ClaimError('unknown', err.message || 'Booking failed.');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [uid],
  );

  return { claimRequest, loading, error };
}
