// useCompletedRides.js
import { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';

export function useCompletedRides(uid) {
  const [completedRides, setCompletedRides] = useState([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(null);

  useEffect(() => {
    if (!uid) {
      setCompletedRides([]);
      setLoading(false);
      return;
    }

    const db = getFirestore();

    const q = query(
      collection(db, 'Rides'),
      where('uid',    '==', uid),
      where('status', '==', 'completed'),
      orderBy('completedAt', 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rides = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCompletedRides(rides);
        setLoading(false);
      },
      (err) => {
        console.error('[useCompletedRides]', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [uid]);

  return { completedRides, loading, error };
}