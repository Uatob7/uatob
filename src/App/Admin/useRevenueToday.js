// src/App/Admin/useRevenueToday.js

import { useEffect, useState } from "react";
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  Timestamp
} from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

export function useRevenueToday() {
  const [revenue, setRevenue] = useState(0);
  const [rideCount, setRideCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // 🔥 Get today's start (midnight)
    const now = new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    const startTimestamp = Timestamp.fromDate(startOfDay);

    // 🔥 Query today's completed + paid rides
    const ridesQuery = query(
      collection(db, "Rides"),
      where("status", "==", "completed"),
      where("paymentStatus", "==", "succeeded"),
      where("createdAt", ">=", startTimestamp)
    );

    const unsubscribe = onSnapshot(
      ridesQuery,
      (snapshot) => {
        let total = 0;

        snapshot.forEach((doc) => {
          const data = doc.data();

          // ✅ Use platformFee (YOUR revenue)
          total += data.platformFee || 0;
        });

        setRevenue(total);
        setRideCount(snapshot.size);
        setLoading(false);
      },
      (err) => {
        console.error("useRevenueToday error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return {
    revenue,
    rideCount,
    loading,
    error
  };
}