// src/App/Drivers/useDriverRides.js

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
import { firebase_app } from '@/firebase/config'; // ✅ use this

const db = getFirestore(firebase_app); // ✅ same as your old code

export function useDriverRides() {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  console.log(rides)

  useEffect(() => {
    let unsubscribe = () => {};
    let isMounted = true;

    try {
      const q = query(
        collection(db, 'Rides'),
        where('paymentStatus', '==', 'succeeded'),
        where('status', '==', 'searching_driver'),
        orderBy('createdAt', 'desc'),
        limit(25)
      );

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!isMounted) return;

          const docs = snapshot.docs.map((doc) => {
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
          setError(null);
        },
        (err) => {
          console.error('[useDriverRides]', err);

          if (!isMounted) return;

          setError(err.message || 'Failed to load rides');
          setRides([]);
          setLoading(false);
        }
      );
    } catch (err) {
      console.error('[useDriverRides setup]', err);
      setError(err.message);
      setLoading(false);
    }

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return { rides, loading, error };
}