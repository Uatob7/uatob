import { useCallback, useState } from "react";
import {
  getFirestore,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

export function useAcceptRide() {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const call = useCallback(async ({ rideId, uid }) => {
    setLoading(true); setError(null);
    try {
      if (!rideId || !uid) throw new Error("Missing rideId or uid");

      await runTransaction(db, async (tx) => {
        const rideRef = doc(db, "Rides", rideId);
        const snap    = await tx.get(rideRef);

        if (!snap.exists()) throw new Error("Ride not found");

        const ride = snap.data();

        if (ride.status !== "searching_driver") throw new Error("Ride already claimed");
        if (ride.driverUid)                     throw new Error("Ride already assigned to a driver");

        tx.update(rideRef, {
          status:     "driver_assigned",
          driverUid:  uid,
          acceptedAt: serverTimestamp(),
          updatedAt:  serverTimestamp(),
        });
      });

      return { success: true, message: "Ride accepted" };
    } catch (err) {
      setError(err?.message || "acceptRide failed");
      throw err;
    } finally { setLoading(false); }
  }, []);

  return { call, loading, error };
}
