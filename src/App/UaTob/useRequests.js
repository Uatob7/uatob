// src/App/UaTob/useRequests.js
//
// Live snapshot of the OPEN request board — the shared marketplace of ride
// requests any signed-in rider can claim & pay for (Rides tab). Newest first.

import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getFirestore,
} from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

const db = getFirestore(firebase_app);

export function useRequests(uid) {
  const [requests, setRequests] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    if (!uid) { setRequests([]); setLoading(false); return; }
    let isMounted = true;
    setLoading(true);

    // The rider's OWN open requests, awaiting payment, newest first. Only the
    // person who posted a request sees it on their board. Requires a composite
    // index on (uid ASC, status ASC, createdAt DESC) — Firestore surfaces a
    // one-click create link the first time this runs.
    const q = query(
      collection(db, 'Requests'),
      where('uid', '==', uid),
      where('status', '==', 'open'),
      orderBy('createdAt', 'desc'),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        if (!isMounted) return;
        setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('[useRequests]', err);
        setError(
          err.code === 'failed-precondition'
            ? 'Missing Firestore index for Requests (uid + status + createdAt)'
            : err.message || 'Failed to load requests',
        );
        setRequests([]);
        setLoading(false);
      },
    );

    return () => { isMounted = false; unsub(); };
  }, [uid]);

  return { requests, loading, error };
}
