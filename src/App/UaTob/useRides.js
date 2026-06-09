// src/App/UaTob/useRides.js

import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  getFirestore,
} from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

const db = getFirestore(firebase_app);

const ACTIVE_STATUSES = [
  'searching_driver',
  'driver_assigned',
  'driver_arriving',
  'arrived',
  'in_progress',
  'completed',
  'cancelled',
  'timeout',
];

export function useRides() {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    setLoading(true);
    setError(null);

    try {
      const q = query(
        collection(db, 'Rides'),
        where('status', 'in', ACTIVE_STATUSES)
      );

      const unsub = onSnapshot(
        q,
        (snap) => {
          if (!isMounted) return;

          const ridesData = snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          setRides(ridesData);
          setLoading(false);
        },
        (err) => {
          console.error('[useRides]', err);

          setError(
            err.code === 'failed-precondition'
              ? 'Missing Firestore index for status'
              : err.message || 'Failed to load rides'
          );

          setRides([]);
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
      setRides([]);
      setLoading(false);
    }
  }, []);

  return { rides, loading, error };
}