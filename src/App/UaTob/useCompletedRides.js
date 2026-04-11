// src/App/UaTob/useReviews.js
import { useEffect, useState } from "react";
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";

export function useCompletedRides(uid = null) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const db = getFirestore();

    setLoading(true);
    setError(null);
    setReviews([]);

    let q;

    try {
      const baseQuery = [
        collection(db, "rides"),
        where("status", "==", "completed"),
        orderBy("createdAt", "desc"),
      ];

      if (uid) {
        q = query(...baseQuery, where("userId", "==", uid));
      } else {
        q = query(...baseQuery);
      }

      const unsub = onSnapshot(
        q,
        (snapshot) => {
          const data = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          setReviews(data);
          setLoading(false);
        },
        (err) => {
          console.error("useCompletedRides error:", err);
          setError(err);
          setLoading(false);
        }
      );

      return () => unsub();
    } catch (err) {
      console.error("Query build error:", err);
      setError(err);
      setLoading(false);
    }
  }, [uid]);

  return { reviews, loading, error };
}