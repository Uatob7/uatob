// src/App/Drivers/useActiveRides.js
import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  getFirestore,
} from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

const ACTIVE_STATUSES = ["driver_assigned", "arrived", "in_progress"];

export function useActiveRides(uid) {
  const [activeRides, setActiveRides] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    // No orderBy — avoids the composite index requirement entirely.
    // We sort client-side instead.
    const q = query(
      collection(db, "Rides"),
      where("driverUid", "==", uid),
      where("status", "in", ACTIVE_STATUSES)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              createdAt: data.createdAt?.toDate?.() ?? null,
              updatedAt: data.updatedAt?.toDate?.() ?? null,
            };
          })
          // sort newest first client-side
          .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

        setActiveRides(docs);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error("[useActiveRides]", err);
        setError(err.message ?? "Failed to load active rides");
        setActiveRides([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [uid]);

  return { activeRides, loading, error };
}