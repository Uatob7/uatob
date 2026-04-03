// src/App/Drivers/useCompletedRides.js

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

export function useCompletedRides(uid) {
  const [completedRides, setCompletedRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!uid) {
      setCompletedRides([]);
      setLoading(false);
      return;
    }

    let unsubscribe = () => {};

    try {
      const q = query(
        collection(db, "Rides"),
        where("driverUid", "==", uid),
        where("status", "==", "completed"),
        where("paymentStatus", "==", "succeeded"), // ✅ only paid rides
        orderBy("updatedAt", "desc") // latest first
      );

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const rides = snapshot.docs.map((doc) => {
            const data = doc.data();

            return {
              id: doc.id,
              ...data,
              createdAt: data.createdAt?.toDate?.() ?? null,
              updatedAt: data.updatedAt?.toDate?.() ?? null,
            };
          });

          setCompletedRides(rides);
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.error("[useCompletedRides]", err);
          setError(err.message);
          setCompletedRides([]);
          setLoading(false);
        }
      );
    } catch (err) {
      console.error("[useCompletedRides setup]", err);
      setError(err.message);
      setLoading(false);
    }

    return () => unsubscribe();
  }, [uid]);

  return { completedRides, loading, error };
}