import { useState, useEffect } from 'react';
import { getFirestore, collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';

/**
 * useDriverReviews(uid)
 *
 * Real-time listener on the Reviews collection filtered by driverUid.
 * Each doc shape (set by the rider ReviewModal):
 *   { rideId, uid (rider), driverUid, rating, comment, pickup, dropoff,
 *     fareTotal, rideLabel, tripDistanceMiles, createdAt }
 */
export function useDriverReviews(uid) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }

    const db  = getFirestore();
    const q   = query(
      collection(db, 'Reviews'),
      where('driverUid', '==', uid),
      orderBy('createdAt', 'desc'),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setReviews(docs);
        setLoading(false);
      },
      (err) => {
        console.error('[useDriverReviews]', err);
        setLoading(false);
      },
    );

    return unsub;
  }, [uid]);

  return { reviews, loading };
}