// src/App/UaTob/useAllDrivers.js
import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, getFirestore } from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

const db = getFirestore(firebase_app);

export function useAllDrivers() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "Drivers"),
      orderBy("submittedAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      setDrivers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return { drivers, loading };
}