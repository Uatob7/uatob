// src/App/UaTob/useRides.js

import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  limit,
  getFirestore,
} from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

const db = getFirestore(firebase_app);

// optional filter if you only want active lifecycle rides
const ACTIVE_STATUSES = [
  'searching_driver',
  'driver_assigned',
  'driver_arriving',
  'arrived',
  'in_progress',
  'completed',
  'timeout',
];

export function useRides() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    setLoading(true);
    setError(null);

    try {
      const q = query(
        collection(db, 'Rides'),
        where('status', 'in', ACTIVE_STATUSES),
        orderBy('createdAt', 'desc'),
        limit(50)
      );

      const unsub = onSnapshot(
        q,
        (snap) => {
          if (!isMounted) return;

          const tripsData = snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          setTrips(tripsData);
          setLoading(false);
        },
        (err) => {
          console.error('[useRides]', err);

          setError(
            err.code === 'failed-precondition'
              ? 'Missing Firestore index for status + createdAt'
              : err.message || 'Failed to load rides'
          );

          setTrips([]);
          setLoading(false);
        }
      );

      return () => {
        isMounted = false;
        unsub();
      };
    } catch (err) {
      console.error('[useRides setup]', err);
      setError(err.message || 'Failed to initialize rides');
      setTrips([]);
      setLoading(false);
    }
  }, []);

  return { trips, loading, error };
}