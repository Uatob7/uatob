// src/App/Admin/useActiveRides.js

import { useEffect, useState } from "react";
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

export function useActiveRides() {
  const [activeRides, setActiveRides] = useState([]);
  const [count, setCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const q = query(
      collection(db, "Rides"),
      where("status", "==", "driver_assigned")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rides = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setActiveRides(rides);
        setCount(rides.length);
        setLoading(false);
      },
      (err) => {
        console.error("useActiveRides error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return {
    activeRides,
    count,
    loading,
    error,
    isEmpty: count === 0, // 👈 this is your "0 active rides" check
  };
}