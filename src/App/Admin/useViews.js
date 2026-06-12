import { useState, useEffect } from 'react';
import { collection, onSnapshot, orderBy, query, limit, getFirestore } from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

const db = getFirestore(firebase_app);

export function useViews() {
  const [views, setViews] = useState([]);

  useEffect(() => {
    const q = query(
      collection(db, 'Views'),
      orderBy('timestamp', 'desc'),
      limit(50),
    );
    const unsub = onSnapshot(q, snap => {
      setViews(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  return { views };
}
