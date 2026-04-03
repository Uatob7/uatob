import { useEffect, useState } from "react";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

export function useDriverSignUp(uid) {
  const [driverSignUp, setDriverSignUp] = useState(null);
  const [loading, setLoading] = useState(true);

  console.log("Fetching driver sign-up for UID:", uid);
  

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    const fetchDriver = async () => {
      try {
        const ref = doc(db, "Drivers", uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          setDriverSignUp({
            id: snap.id,
            ...snap.data(),
          });
        } else {
          setDriverSignUp(null);
        }
      } catch (err) {
        console.error("Error fetching driver:", err);
        setDriverSignUp(null);
      } finally {
        setLoading(false);
      }
    };

    fetchDriver();
  }, [uid]);

  return { driverSignUp, loading };
}