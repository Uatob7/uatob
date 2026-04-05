// src/App/Admin/useTotalRides.js

import { useEffect, useState } from "react";
import { getFirestore, collection, onSnapshot } from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

export function useTotalRides() {
  const [totalRides, setTotalRides] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ridesRef = collection(db, "Rides");

    const unsubscribe = onSnapshot(
      ridesRef,
      (snapshot) => {
        setTotalRides(snapshot.size);
        setLoading(false);
      },
      (err) => {
        console.error("useTotalRides error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { totalRides, loading, error };
}