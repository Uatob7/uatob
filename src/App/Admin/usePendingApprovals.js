// src/App/Admin/usePendingApprovals.js

import { useEffect, useState } from "react";
import { getFirestore, collection, query, where, onSnapshot } from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

export function usePendingApprovals() {
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // 🔹 Adjust the collection for your approvals (Drivers / Accounts)
    const approvalsQuery = query(
      collection(db, "Drivers"), // or "Accounts"
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(
      approvalsQuery,
      (snapshot) => {
        const approvals = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setPendingApprovals(approvals);
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

  return {
    pendingApprovals,
    count,
    loading,
    error
  };
}