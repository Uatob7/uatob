// src/App/UaTob/useRideHistory.js
import { useState, useEffect } from 'react';
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  limit,
} from 'firebase/firestore';
import { firebase_app } from '@/firebase/config';

const db = getFirestore(firebase_app);

function formatDate(date) {
  if (!date) return '—';
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yest  = new Date(today); yest.setDate(yest.getDate() - 1);
  const d     = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const time  = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  if (d.getTime() === today.getTime()) return `Today, ${time}`;
  if (d.getTime() === yest.getTime())  return `Yesterday, ${time}`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + `, ${time}`;
}

function normalise(doc) {
  const d = doc.data();
  const createdAt = d.createdAt?.toDate?.() ?? null;
  return {
    id:            doc.id,
    from:          d.pickup            ?? '—',
    to:            d.dropoff           ?? '—',
    fare:          d.fareTotal         ?? 0,
    status:        d.status            ?? 'completed',
    date:          formatDate(createdAt),
    driver:        d.driverName        ?? '—',
    rating:        d.riderRating       ?? null,
    duration:      d.tripDurationMin   != null ? `${d.tripDurationMin} min` : '—',
    miles:         d.tripDistanceMiles ?? null,
    rideLabel:     d.rideLabel         ?? d.rideType ?? '—',
    paymentMethod: d.paymentMethod     ?? '—',
    createdAt,
    updatedAt: d.updatedAt?.toDate?.() ?? null,
  };
}

export function useRideHistory(uid, max = 20) {
  const [rides,   setRides]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!uid) { setRides([]); setLoading(false); return; }

    let isMounted = true;
    setLoading(true);
    setError(null);

    const q = query(
      collection(db, 'Rides'),
      where('uid', '==', uid),
      where('status', 'in', ['completed', 'cancelled']),
      orderBy('createdAt', 'desc'),
      limit(max)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        if (!isMounted) return;
        setRides(snap.docs.map(normalise));
        setLoading(false);
      },
      (err) => {
        if (!isMounted) return;
        console.error('[useRideHistory]', err);
        setError(
          err.code === 'failed-precondition'
            ? 'Index needed — check Firebase console for the link.'
            : err.message
        );
        setLoading(false);
      }
    );

    return () => { isMounted = false; unsub(); };
  }, [uid, max]);

  return { rides, loading, error };
}