// src/App/Drivers/useActiveRides.js
import { useState, useEffect } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getFirestore,
} from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

export function useActiveRides(uid) {
  const [activeRides, setActiveRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!uid) return;

    let unsubscribe = () => {};
    let isMounted = true;

    try {
      const statuses = ["driver_assigned", "arrived", "in_progress"];

      const q = query(
        collection(db, "Rides"),
        where("driverUid", "==", uid),
        where("status", "in", statuses),
        orderBy("createdAt", "desc")
      );

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!isMounted) return;

          const docs = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              createdAt: data.createdAt?.toDate?.() ?? null,
              updatedAt: data.updatedAt?.toDate?.() ?? null,
            };
          });

          setActiveRides(docs);
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.error("[useActiveRides]", err);
          if (!isMounted) return;

          setError(err.message || "Failed to load active rides");
          setActiveRides([]);
          setLoading(false);
        }
      );
    } catch (err) {
      console.error("[useActiveRides setup]", err);
      if (isMounted) {
        setError(err.message);
        setLoading(false);
      }
    }

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [uid]);

  return { activeRides, loading, error };
}