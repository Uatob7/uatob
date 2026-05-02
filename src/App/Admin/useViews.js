// src/App/Admin/useViews.js
import { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";

import { firebase_app } from "@/firebase/config";
import { getFirestore } from "firebase/firestore";

const db = getFirestore(firebase_app);

export function useViews() {
  const [views, setViews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const q = query(
      collection(db, "Admin", "views", "events"),
      orderBy("createdAt", "desc"),
      limit(pageSize)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setViews(data);
        setLoading(false);
      },
      (err) => {
        console.error("useViews error:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [pageSize]);

  return { views, loading, error };
}