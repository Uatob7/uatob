// src/App/UaTob/useUserRides.js
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
import { firebase_app } from '@/firebase/config'; // ✅ match your working pattern

const db = getFirestore(firebase_app);

export function useUserRides(uid) {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true); // ✅ start true
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!uid) {
      setRides([]);
      setLoading(false);
      setError(null);
      return;
    }

    let unsub = () => {};
    let isMounted = true;

    setLoading(true);
    setError(null);

    try {
      const q = query(
        collection(db, 'Rides'),
        where('uid', '==', uid),
        where('status', 'in', [
          'pending_payment',
          'searching_driver',
          'driver_assigned',
          'timeout',
        ]),
        orderBy('createdAt', 'desc'),
        limit(20) // ✅ prevents large reads
      );

      unsub = onSnapshot(
        q,
        (snap) => {
          if (!isMounted) return;

          const docs = snap.docs.map((doc) => {
            const data = doc.data();

            return {
              id: doc.id,
              ...data,
              createdAt: data.createdAt?.toDate?.() ?? null,
              updatedAt: data.updatedAt?.toDate?.() ?? null,
            };
          });

          setRides(docs);
          setLoading(false);
        },
        (err) => {
          console.error('[useUserRides]', err);

          if (!isMounted) return;

          if (err.code === 'failed-precondition') {
            setError('Database index required. Check Firebase console.');
          } else {
            setError(err.message || 'Failed to load rides');
          }

          setRides([]); // ✅ clear stale data
          setLoading(false);
        }
      );
    } catch (err) {
      console.error('[useUserRides setup]', err);

      if (isMounted) {
        setError(err.message);
        setLoading(false);
      }
    }

    return () => {
      isMounted = false;
      unsub();
    };
  }, [uid]);

  return { rides, loading, error };
}