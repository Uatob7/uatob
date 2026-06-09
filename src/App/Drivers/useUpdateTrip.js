import { useCallback, useState } from "react";
import {
  getFirestore,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);


const TRANSITIONS = {
  arrive: {
    from: "driver_assigned", to: "arrived",     field: "arrivedAt",
    targetLat: "pickupLat",  targetLng: "pickupLng",  targetName: "pickup",
  },
  start: {
    from: "arrived",         to: "in_progress", field: "startedAt",
    targetLat: "pickupLat",  targetLng: "pickupLng",  targetName: "pickup",
  },
  complete: {
    from: "in_progress",     to: "completed",   field: "completedAt",
    targetLat: "dropoffLat", targetLng: "dropoffLng", targetName: "dropoff",
  },
};


export function useUpdateTrip() {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const call = useCallback(async ({ rideId, driverUid, action }) => {
    setLoading(true); setError(null);
    try {
      if (!rideId || !driverUid || !action) throw new Error("Missing rideId, driverUid, or action");

      const transition = TRANSITIONS[action];
      if (!transition) throw new Error(`Invalid action: ${action}`);

      // ── Step 1: read ride ─────────────────────────────
      const rideRef = doc(db, "Rides", rideId);
      const snap    = await getDoc(rideRef);
      if (!snap.exists()) throw new Error("Ride not found");

      const ride = snap.data();

      if (ride.driverUid !== driverUid)    throw new Error("Unauthorized driver");
      if (ride.status !== transition.from) throw new Error(`Expected status '${transition.from}', got '${ride.status}'`);

      // ── Step 2: transactional state transition ────────
      await runTransaction(db, async (tx) => {
        const fresh = await tx.get(rideRef);
        if (!fresh.exists()) throw new Error("Ride not found");
        if (fresh.data().status !== transition.from) throw new Error("Ride status changed, please refresh");

        tx.update(rideRef, {
          status:                      transition.to,
          [transition.field]:          serverTimestamp(),
updatedAt:                   serverTimestamp(),
        });
      });

      return { success: true, action, status: transition.to };
    } catch (err) {
      setError(err?.message || "updateTripStatus failed");
      throw err;
    } finally { setLoading(false); }
  }, []);

  return { call, loading, error };
}
