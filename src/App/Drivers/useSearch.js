// src/App/Admin/useSearches.js

import { useEffect, useState } from "react";
import {
  getFirestore,
  collection,
  onSnapshot,
  orderBy,
  limit,
  query,
} from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

export function useSearch() {
  const [searches, setSearches] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    // Only the most recent activity feeds the ambient heatmap (which decays
    // over ~3h), so cap the stream instead of downloading the whole history.
    const q = query(
      collection(db, "Search"),
      orderBy("createdAt", "desc"),
      limit(200)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setSearches(list);
        setLoading(false);
      },
      (err) => {
        console.error("useSearches error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { searches, loading, error };
}