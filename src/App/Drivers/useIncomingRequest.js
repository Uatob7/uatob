import { useEffect, useState } from "react";
import { getFirestore, collection, query, where, onSnapshot } from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

export function useIncomingRequest() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);

    const q = query(
      collection(db, "Rides"),
      where("status", "==", "searching_driver")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setRequests(
          snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
        );
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { requests, loading, error };
}