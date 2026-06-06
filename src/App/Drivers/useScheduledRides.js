// hooks/useScheduledRides.js

import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  limit,
  getFirestore,
} from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

export function useScheduledRides() {
  const [scheduledRides, setScheduledRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ridesQuery = query(
      collection(db, "Rides"),
      where("isScheduled", "==", true),
      orderBy("scheduledAt", "asc"),
      limit(100)
    );

    const unsubscribe = onSnapshot(
      ridesQuery,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setScheduledRides(data);
        setLoading(false);
      },
      (err) => {
        console.error("[useScheduledRides]", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return {
    scheduledRides,
    loading,
    error,
  };
}