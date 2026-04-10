// src/App/Admin/useFleetDrivers.js

import { useEffect, useState } from "react";
import {
  getFirestore,
  collection,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

export function useFleetDrivers() {
  const [fleet, setFleet] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      const driversRef = collection(db, "Drivers");
      const q = query(driversRef, orderBy("createdAt", "desc"));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const drivers = snapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => {
              if (a.status === "pending" && b.status !== "pending") return -1;
              if (a.status !== "pending" && b.status === "pending") return 1;
              return 0;
            });

          setFleet(drivers);
          setLoading(false);
        },
        (err) => {
          console.error("useFleetDrivers error:", err);
          setError(err);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error("useFleetDrivers setup error:", err);
      setError(err);
      setLoading(false);
    }
  }, []);

  return {
    fleet,
  };
}