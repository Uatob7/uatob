// src/App/UaTob/useActiveRides.js
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

// 🔹 Only active ride statuses
const ACTIVE_STATUSES = [
  'searching_driver',
  'driver_assigned',
  'driver_arriving',
  'arrived',
  'in_progress',
  'completed',
  'timeout',
];

export function useActiveRides(uid) {
  const [active, setActive] = useState([]); // active ride list
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);



  useEffect(() => {
    if (!uid) {
      setActive([]);
      setLoading(false);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    try {
      const q = query(
        collection(db, 'Rides'),
        where('uid', '==', uid),
        where('status', 'in', ACTIVE_STATUSES),
        limit(1) // only need the most recent
      );

      const unsub = onSnapshot(
        q,
        (snap) => {
          if (!isMounted) return;

          const doc = snap.docs[0];
          const ride = doc
            ? {
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.() ?? null,
                updatedAt: doc.data().updatedAt?.toDate?.() ?? null,
              }
            : null;

          setActive(ride ? [ride] : []);
          setLoading(false);
        },
        (err) => {
          if (!isMounted) return;

          console.error('[useActiveRides]', err);
          setError(
            err.code === 'failed-precondition'
              ? 'Missing Firestore index. Create it in Firebase console.'
              : err.message || 'Failed to load active ride'
          );
          setActive([]);
          setLoading(false);
        }
      );

      return () => {
        isMounted = false;
        unsub();
      };
    } catch (err) {
      console.error('[useActiveRides setup]', err);
      if (isMounted) {
        setError(err.message || 'Failed to initialize active ride');
        setActive(null);
        setLoading(false);
      }
    }
  }, [uid]);

  return { active, loading, error };
}