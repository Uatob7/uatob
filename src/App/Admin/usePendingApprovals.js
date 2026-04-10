// src/App/Admin/usePendingApprovals.js

import { useEffect, useState } from "react";
import { getFirestore, collection, query, where, onSnapshot } from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

export function usePendingApprovals() {
  const [fleet, setFleet] = useState([]);       // renamed from pendingApprovals
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const approvalsQuery = query(
      collection(db, "Drivers"), // or "Accounts"
    );

    const unsubscribe = onSnapshot(
      approvalsQuery,
      (snapshot) => {
        const fleetData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

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