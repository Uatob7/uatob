// src/App/Admin/useFleetDrivers.js

import { useEffect, useState } from "react";
import { getFirestore, collection, onSnapshot } from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

export function useFleetDrivers() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const driversRef = collection(db, "Drivers");

    const unsubscribe = onSnapshot(
      driversRef,
      (snapshot) => {
        const allDrivers = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setDrivers(allDrivers);
        setLoading(false);
      },
      (err) => {
        console.error("useFleetDrivers error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe(); // cleanup on unmount
  }, []);

  return { drivers, loading, error, totalDrivers: drivers.length };
}