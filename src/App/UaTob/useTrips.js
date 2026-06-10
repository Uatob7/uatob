// src/App/UaTob/useTrips.js

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

export function useTrips(uid) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);



  useEffect(() => {
    if (!uid) {
      setTrips([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(db, 'Rides'),
      where('uid', '==', uid)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setTrips(data);
        setLoading(false);
      },
      (err) => {
        console.error('[useTrips]', err);

        setError(
          err.code === 'failed-precondition'
            ? 'Missing Firestore index'
            : err.message || 'Failed to load trips'
        );

        setTrips([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [uid]);

  return {
    trips,
    loading,
    error,
  };
}