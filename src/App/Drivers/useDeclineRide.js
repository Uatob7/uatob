import { useCallback, useState } from "react";
import {
  getFirestore,
  doc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
} from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

export function useDeclineRide() {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const call = useCallback(async ({ rideId, uid }) => {
    setLoading(true); setError(null);
    try {
      if (!rideId || !uid) throw new Error("Missing rideId or uid");

      await updateDoc(doc(db, "Rides", rideId), {
        declinedBy: arrayUnion(uid),
        updatedAt:  serverTimestamp(),
      });

      return { success: true, message: "Ride declined" };
    } catch (err) {
      setError(err?.message || "declineRide failed");
      throw err;
    } finally { setLoading(false); }
  }, []);

  return { call, loading, error };
}
