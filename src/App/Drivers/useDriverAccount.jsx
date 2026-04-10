import { useEffect, useState } from "react";
import { getFirestore, doc, onSnapshot } from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

export function useDriverAccount(uid) {
  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setDriver(null);
      setLoading(false);
      return;
    }

    const ref = doc(db, "Drivers", uid);

    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setDriver({ id: snap.id, ...snap.data() });
        } else {
          setDriver(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error listening to driver:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [uid]);

  return { driver, loading };
}