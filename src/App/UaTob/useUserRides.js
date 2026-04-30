// src/App/UaTob/useUserRides.js
import { useState, useEffect, useRef } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  limit,
  getFirestore,
} from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

const db = getFirestore(firebase_app);

const ACTIVE_STATUSES = [
  'pending_payment',
  'searching_driver',
  'driver_assigned',
];

export function useUserRides(uid) {
  const [rides, setRides]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);
  const unsubRef = useRef(null);

  useEffect(() => {
    // tear down any previous listener
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }

    if (!uid) {
      setRides([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(db, 'Rides'),
      where('uid', '==', uid),
      where('status', 'in', ACTIVE_STATUSES),
      limit(10)
    );

    unsubRef.current = onSnapshot(
      q,
      (snap) => {
        setRides(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('[useUserRides]', err);
        setError(
          err.code === 'failed-precondition'
            ? 'Missing Firestore index — check Firebase console.'
            : err.message || 'Failed to load rides'
        );
        setRides([]);
        setLoading(false);
      }
    );

    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, [uid]);

  return { rides, loading, error };
}