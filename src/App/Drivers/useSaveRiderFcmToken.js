import { useCallback, useState } from "react";
import { getFirestore, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

export function useSaveFcmToken() {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const call = useCallback(async ({ driverId, token }) => {
    setLoading(true); setError(null);
    try {
      if (!driverId || !token) throw new Error("Missing driverId or token");
      await updateDoc(doc(db, "Drivers", driverId), {
        fcmToken:          token,
        fcmTokenUpdatedAt: serverTimestamp(),
      });
      return { updated: true };
    } catch (err) {
      setError(err?.message || "saveFcmToken failed");
      throw err;
    } finally { setLoading(false); }
  }, []);

  return { call, loading, error };
}
