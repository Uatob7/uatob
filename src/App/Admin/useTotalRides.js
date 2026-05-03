// src/App/Admin/useTotalRides.js

import { useEffect, useState } from "react";
import { getFirestore, collection, onSnapshot } from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

export function useTotalRides() {
  const [rides, setRides] = useState([]);        // store full objects
  const [totalRides, setTotalRides] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ridesRef = collection(db, "Rides");

    const unsubscribe = onSnapshot(
      ridesRef,
      (snapshot) => {
        const ridesData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),   // full object
        }));

        setRides(ridesData);
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

  return { rides, totalRides, loading, error };
}