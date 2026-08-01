// src/App/UaTob/useRequests.js
//
// Live snapshot of the rider's OWN in-flight requests on the Rides board:
//   'open'   → awaiting the rider's payment choice
//   'paying' → paid/marked, waiting for the settle cron to book the Ride
//
// These run as TWO separate `status == …` listeners (merged newest-first)
// rather than one `status in [...]` query on purpose: each equality query
// reuses the existing (uid ASC, status ASC, createdAt DESC) composite index,
// so no new Firestore index is required. Only the poster sees their own.

import { useState, useEffect, useMemo } from 'react';
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

const STATUSES = ['open', 'paying'];

function tsMillis(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts.seconds) return ts.seconds * 1000;
  return 0;
}

export function useRequests(uid) {
  // One bucket of docs per status, merged below.
  const [buckets, setBuckets] = useState({ open: [], paying: [] });
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!uid) { setBuckets({ open: [], paying: [] }); setLoading(false); return; }
    setLoading(true);
    setError(null);

    const unsubs = STATUSES.map((status) => {
      const q = query(
        collection(db, 'Requests'),
        where('uid', '==', uid),
        where('status', '==', status),
        orderBy('createdAt', 'desc'),
      );
      return onSnapshot(
        q,
        (snap) => {
          setBuckets((prev) => ({ ...prev, [status]: snap.docs.map((d) => ({ id: d.id, ...d.data() })) }));
          setLoading(false);
        },
        (err) => {
          console.error('[useRequests]', status, err);
          setError(
            err.code === 'failed-precondition'
              ? 'Missing Firestore index for Requests (uid + status + createdAt)'
              : err.message || 'Failed to load requests',
          );
          setLoading(false);
        },
      );
    });

    return () => unsubs.forEach((u) => u());
  }, [uid]);

  const requests = useMemo(
    () => [...buckets.open, ...buckets.paying].sort((a, b) => tsMillis(b.createdAt) - tsMillis(a.createdAt)),
    [buckets],
  );

  return { requests, loading, error };
}
