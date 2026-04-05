// src/App/Admin/useAnalyticsData.js

import { useEffect, useState } from "react";
import { getFirestore, collection, onSnapshot } from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

export function useAnalyticsData() {
  const [analytics, setAnalytics] = useState({
    totalRides: 0,
    completedRides: 0,
    totalRevenue: 0,
    totalDriverPayout: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ridesRef = collection(db, "Rides");

    const unsubscribe = onSnapshot(
      ridesRef,
      (snapshot) => {
        let completed = 0;
        let revenue = 0;
        let driverPayout = 0;

        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          revenue += data.fareTotal || 0;
          driverPayout += data.driverPayout || 0;
          if (data.status === "completed") completed += 1;
        });

        setAnalytics({
          totalRides: snapshot.size,
          completedRides: completed,
          totalRevenue: revenue,
          totalDriverPayout: driverPayout,
        });

        setLoading(false);
      },
      (err) => {
        console.error("useAnalyticsData error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { analytics, loading, error };
}