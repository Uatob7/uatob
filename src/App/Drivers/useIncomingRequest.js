import { useEffect, useState } from "react";
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

export function useIncomingRequest(uid) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const q = query(
      collection(db, "Rides"),
      where("status", "==", "searching_driver")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const rides = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          // 🔥 Filter using candidateDrivers
          const filtered = rides.filter((ride) => {
            if (!ride.candidateDrivers) return false;

            return ride.candidateDrivers.some(
              (driver) => driver.uid === uid
            );
          });

          setRequests(filtered);
          setLoading(false);
        } catch (err) {
          console.error("useIncomingRequest error:", err);
          setError(err);
          setLoading(false);
        }
      },
      (err) => {
        console.error("snapshot error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [uid]);

  return { requests, loading, error };
}