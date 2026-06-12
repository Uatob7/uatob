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

export function useDriverCounts() {
  const [online, setOnline] = useState(0);
  const [offline, setOffline] = useState(0);

  useEffect(() => {
    const unsubOnline = onSnapshot(
      query(collection(db, 'Drivers'), where('status', '==', 'online')),
      snap => setOnline(snap.size)
    );

    const unsubOffline = onSnapshot(
      query(collection(db, 'Drivers'), where('status', '==', 'offline')),
      snap => setOffline(snap.size)
    );

    return () => {
      unsubOnline();
      unsubOffline();
    };
  }, []);

  return {
    online,
    offline,
    total: online + offline,
  };
}