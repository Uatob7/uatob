// src/App/UaTob/useUserRides.js
import { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';

export function useUserRides(uid) {
  const [rides,   setRides]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!uid) {
      setRides([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const db  = getFirestore();
    const col = collection(db, 'Rides');
    const q   = query(
      col,
      where('uid', '==', uid),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setRides(docs);
        setLoading(false);
      },
      (err) => {
        console.error('[useUserRides]', err);
        setError(err.message || 'Failed to load rides');
        setLoading(false);
      }
    );

    return () => unsub();
  }, [uid]);

  return { rides, loading, error };
}