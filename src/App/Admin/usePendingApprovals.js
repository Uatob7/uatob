// src/App/Admin/usePendingApprovals.js

import { useEffect, useState } from "react";
import { getFirestore, collection, query, onSnapshot } from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

export function usePendingApprovals() {
  const [fleet, setFleet] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  console.log(fleet);

  useEffect(() => {
    const approvalsQuery = query(
      collection(db, "Drivers"),
    );

    const unsubscribe = onSnapshot(
      approvalsQuery,
      (snapshot) => {
        const fleetData = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => {
            if (a.status === "pending" && b.status !== "pending") return -1;
            if (a.status !== "pending" && b.status === "pending") return 1;
            return 0;
          });

        setFleet(fleetData);
        setCount(snapshot.size);
        setLoading(false);
      },
      (err) => {
        console.error("usePendingApprovals error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { fleet, count, loading, error };
}