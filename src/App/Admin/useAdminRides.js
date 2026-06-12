import { useState, useEffect } from 'react';
import { collection, onSnapshot, orderBy, query, limit, getFirestore } from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

const db = getFirestore(firebase_app);

export function useAdminRides() {
  const [rides, setRides] = useState([]);

  useEffect(() => {
    const q = query(
      collection(db, 'Rides'),
      orderBy('createdAt', 'desc'),
      limit(100),
    );
    const unsub = onSnapshot(q, snap => {
      setRides(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  return { rides };
}
