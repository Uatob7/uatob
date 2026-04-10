// src/App/Admin/usePendingApprovals.js

import { useEffect, useState } from "react";
import {
  getFirestore,
  collection,
  onSnapshot,
  query,
} from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

export function usePendingApprovals() {
  const [fleet, setFleet] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const approvalsQuery = query(collection(db, "Drivers"));

    const unsubscribe = onSnapshot(
      approvalsQuery,
      (snapshot) => {
        try {
          const fleetData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          // 🟡 Pending first, sorted by newest submittedAt
          const pending = fleetData
            .filter((item) => item.status === "pending")
            .sort((a, b) => {
              const aTime = a.submittedAt?.seconds || 0;
              const bTime = b.submittedAt?.seconds || 0;
              return bTime - aTime; // newest first
            });

          // 🟢 Everything else (optional: also sort newest first)
          const others = fleetData
            .filter((item) => item.status !== "pending")
            .sort((a, b) => {
              const aTime = a.submittedAt?.seconds || 0;
              const bTime = b.submittedAt?.seconds || 0;
              return bTime - aTime;
            });

          const sortedFleet = [...pending, ...others];

          setFleet(sortedFleet);
          setCount(snapshot.size);
          setLoading(false);
        } catch (err) {
          console.error("Snapshot processing error:", err);
          setError(err);
          setLoading(false);
        }
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