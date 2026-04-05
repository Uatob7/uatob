// src/App/Admin/useApprovals.js

import { useEffect, useState } from "react";
import { getFirestore, collection, query, where, onSnapshot } from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

export function useApprovals() {
  const [approvals, setApprovals] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // 🔹 Adjust collection: could be "Drivers" or "Accounts"
    const approvalsQuery = query(
      collection(db, "Drivers"), // replace with "Accounts" if needed
    );

    const unsubscribe = onSnapshot(
      approvalsQuery,
      (snapshot) => {
        const pending = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setApprovals(pending);
        setCount(snapshot.size);
        setLoading(false);
      },
      (err) => {
        console.error("useApprovals error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { approvals, count, loading, error };
}