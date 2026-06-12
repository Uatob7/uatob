// App/UaTob/useDrivers.js

import { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  getFirestore,
} from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

const db = getFirestore(firebase_app);

export function useDrivers() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'Drivers'),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setDrivers(data);
        setLoading(false);
      },
      (error) => {
        console.error('useDrivers:', error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  return { drivers, loading };
}