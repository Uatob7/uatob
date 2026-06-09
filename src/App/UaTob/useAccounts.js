// App/UaTob/useAccounts.js

import { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  getFirestore,
} from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

const db = getFirestore(firebase_app);

export function useAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'Accounts'),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setAccounts(data);
        setLoading(false);
      },
      (error) => {
        console.error('useAccounts:', error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  return { accounts, loading };
}