// src/App/UaTob/useCreateRequest.js
//
// Posts a ride Request to the open board. This does NOT charge anyone and does
// NOT create a Ride — it just advertises the trip so any driver can see it and
// any rider can claim & pay for it from the Rides tab (see useClaimRequest).

import { useState, useCallback } from 'react';
import {
  collection,
  addDoc,
  serverTimestamp,
  Timestamp,
  getFirestore,
} from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

const db = getFirestore(firebase_app);

// How long a request stays live on the board before it's considered stale.
const REQUEST_TTL_MS = 30 * 60 * 1000; // 30 min

export function useCreateRequest(uid) {
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [requestId, setRequestId] = useState(null);

  const createRequest = useCallback(
    async (payload = {}) => {
      if (!uid) { setError('Missing uid'); return null; }

      setLoading(true);
      setError(null);

      try {
        const expiresAt = Timestamp.fromMillis(Date.now() + REQUEST_TTL_MS);

        const ref = await addDoc(collection(db, 'Requests'), {
          uid,                                  // poster / rider
          posterName:   payload.posterName   ?? null,
          posterRating: payload.posterRating ?? null,
          posterPhoto:  payload.posterPhoto  ?? null,

          pickup:      payload.pickup      ?? null,
          dropoff:     payload.dropoff     ?? null,
          pickupCity:  payload.pickupCity  ?? null,
          pickupZip:   payload.pickupZip   ?? null,
          pickupLat:   payload.pickupLat   ?? null,
          pickupLng:   payload.pickupLng   ?? null,
          dropoffCity: payload.dropoffCity ?? null,
          dropoffZip:  payload.dropoffZip  ?? null,
          dropoffLat:  payload.dropoffLat  ?? null,
          dropoffLng:  payload.dropoffLng  ?? null,
          stops:       Array.isArray(payload.stops) ? payload.stops : [],
          polyline:    payload.polyline    ?? null,

          rideType:  payload.rideType  ?? 'standard',
          rideLabel: payload.rideLabel ?? null,

          fareEstimate:      payload.fareEstimate      ?? null,
          tripDistanceMiles: payload.tripDistanceMiles ?? null,
          tripDurationMin:   payload.tripDurationMin   ?? null,
          fareBreakdown:     payload.fareBreakdown     ?? null,
          surge:             payload.surge             ?? 1,

          // Scheduling — "leave now" or a future pickup the rider picked.
          isScheduled: payload.isScheduled === true,
          scheduledAt: payload.scheduledAt
            ? Timestamp.fromDate(new Date(payload.scheduledAt))
            : null,

          status:    'open',
          claimedBy: null,
          rideId:    null,

          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          expiresAt,
        });

        setRequestId(ref.id);
        return ref.id;
      } catch (err) {
        console.error('[useCreateRequest]', err);
        setError(err.message || 'Failed to post request');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [uid],
  );

  return { createRequest, requestId, loading, error };
}
