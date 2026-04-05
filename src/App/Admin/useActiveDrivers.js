// src/App/Admin/useActiveDrivers.js

import { useEffect, useState } from "react";
import { getFirestore, collection, query, where, onSnapshot } from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

export function useActiveDrivers() {
  const [activeDrivers, setActiveDrivers] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // 🔥 Adjust this based on your driver schema
    const driversQuery = query(
      collection(db, "Drivers"),
    );

    const unsubscribe = onSnapshot(
      driversQuery,
      (snapshot) => {
        const drivers = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setActiveDrivers(drivers);
        setCount(snapshot.size);
        setLoading(false);
      },
      (err) => {
        console.error("useActiveDrivers error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { activeDrivers, count, loading, error };
}