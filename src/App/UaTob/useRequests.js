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

    // The rider's OWN requests that are still in-flight on the board:
    //   'open'   → awaiting the rider's payment choice
    //   'paying' → paid/marked, waiting for the settle cron to book the Ride
    // Both need to stay visible so the Rides tab can show a "booking…" state
    // instead of going blank between paying and the Ride appearing. Only the
    // poster sees their own. Requires a composite index on
    // (uid ASC, status ASC, createdAt DESC) — Firestore surfaces a one-click
    // create link the first time this runs.
    const q = query(
      collection(db, 'Requests'),
      where('uid', '==', uid),
      where('status', 'in', ['open', 'paying']),
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
