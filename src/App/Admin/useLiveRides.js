// src/App/Admin/useLiveRides.js

import { useEffect, useState } from "react";
import { getFirestore, collection, query, where, onSnapshot } from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

export function useLiveRides() {
  const [liveRides, setLiveRides] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // 🔹 Query rides that are currently in progress
    const liveRidesQuery = query(
      collection(db, "Rides"),

    );

    const unsubscribe = onSnapshot(
      liveRidesQuery,
      (snapshot) => {
        const rides = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setLiveRides(rides);
        setCount(snapshot.size);
        setLoading(false);
      },
      (err) => {
        console.error("useLiveRides error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { liveRides, count, loading, error };
}