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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "Rides"),
      where("status", "==", "searching_driver"),
      where("candidateDriverUids", "array-contains", uid),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rides = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setRequests(rides);
        setLoading(false);
      },
      (err) => {
        console.error("snapshot error:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [uid]);

  return {
    requests,
    loading,
    error,
  };
}