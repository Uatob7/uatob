import { useEffect, useState } from "react";
import { getFirestore, doc, onSnapshot } from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

export function useRideAnalytics() {
  const [data, setData] = useState({
    totalRides:       0,
    totalCompleted:   0,
    ridesPerDay:      [0, 0, 0, 0, 0, 0, 0],
    avgFare:          0,
    avgTripDuration:  0,
    acceptanceRate:   0,
    cancellationRate: 0,
    topDrivers:       [],
  });

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "Admin", "analytics"),
      (snap) => {
        if (snap.exists()) setData(snap.data());
      },
      (err) => console.warn("[useRideAnalytics]", err.message)
    );
    return unsub;
  }, []);

  return data;
}