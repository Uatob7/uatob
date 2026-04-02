import { useEffect, useState } from "react";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

export function useDriverAccount(uid) {
  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    async function fetchDriver() {
      try {
        const ref = doc(db, "Drivers", uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          setDriver({ id: snap.id, ...snap.data() });
        } else {
          setDriver(null);
        }
      } catch (err) {
        console.error("Error fetching driver:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchDriver();
  }, [uid]);

  return { driver, loading };
}