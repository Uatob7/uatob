// src/App/UaTob/useReviews.js
import { useEffect, useState } from 'react';
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';

export function useCompletedRides(uid = null) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  console.log(reviews);

  useEffect(() => {
    const db = getFirestore();

    let q;

    try {
      if (!uid) {
        // ALL completed rides
        q = query(
          collection(db, 'rides'),
          where('status', '==', 'completed'),
          orderBy('createdAt', 'desc')
        );
      } else {
        // Completed rides for specific user
        q = query(
          collection(db, 'rides'),
          where('status', '==', 'completed'),
          where('userId', '==', uid),
          orderBy('createdAt', 'desc')
        );
      }

      const unsub = onSnapshot(
        q,
        (snapshot) => {
          const data = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          setReviews(data);
          setLoading(false);
        },
        (err) => {
          console.error('useReviews error:', err);
          setError(err);
          setLoading(false);
        }
      );

      return () => unsub();
    } catch (err) {
      console.error(err);
      setError(err);
      setLoading(false);
    }
  }, [uid]);

  return { reviews, loading, error };
}