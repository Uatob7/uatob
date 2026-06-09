import { useCallback, useState } from "react";
import {
  getFirestore,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  deleteField,
} from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

export function useSaveFcmToken() {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const call = useCallback(async ({ driverId, token }) => {
    setLoading(true); setError(null);
    try {
      if (!driverId) throw new Error("Missing driverId");
      if (!token)    throw new Error("Missing token");

      const driverRef = doc(db, "Drivers", driverId);
      const snap      = await getDoc(driverRef);

      if (!snap.exists()) throw new Error(`Driver ${driverId} not found`);

      if (snap.data()?.fcmToken === token) return { success: true, updated: false };

      await updateDoc(driverRef, {
        fcmToken:            token,
        fcmTokenUpdatedAt:   serverTimestamp(),
        fcmTokenClearReason: deleteField(),
        fcmTokenClearedAt:   deleteField(),
      });

      return { success: true, updated: true };
    } catch (err) {
      setError(err?.message || "saveDriverFcmToken failed");
      throw err;
    } finally { setLoading(false); }
  }, []);

  return { call, loading, error };
}
