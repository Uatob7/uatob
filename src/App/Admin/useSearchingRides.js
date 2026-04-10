// src/App/Admin/useSearchingRides.js

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

export function useSearchingRides() {
  const [searchingRides, setSearchingRides] = useState([]);
  const [count, setCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const q = query(
      collection(db, "Rides"),
      where("status", "==", "searching_driver")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rides = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setSearchingRides(rides);
        setCount(rides.length);
        setLoading(false);
      },
      (err) => {
        console.error("useSearchingRides error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return {
    searchingRides,
    count,
    loading,
    error,
    isEmpty: count === 0, // 👈 handles "0 searching"
  };
}