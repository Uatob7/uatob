// src/App/Admin/useRideAnalytics.js

import { useEffect, useState } from "react";
import {
  getFirestore,
  collection,
  onSnapshot,
  query,
} from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

export function useRideAnalytics() {
  const [totalRides, setTotalRides] = useState(0);

  const [avgTripDuration, setAvgTripDuration] = useState(0);
  const [avgFare, setAvgFare] = useState(0);

  const [acceptanceRate, setAcceptanceRate] = useState(0);
  const [cancellationRate, setCancellationRate] = useState(0);

  const [topDrivers, setTopDrivers] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ridesQuery = query(collection(db, "Rides"));
    const driversQuery = query(collection(db, "Drivers"));

    const unsubRides = onSnapshot(
      ridesQuery,
      (snapshot) => {
        const rides = snapshot.docs.map((d) => d.data());

        const total = rides.length;

        // ---- AVG TRIP DURATION
        const durations = rides
          .map((r) => r.tripDurationMin || 0)
          .filter(Boolean);

        const avgDuration =
          durations.reduce((a, b) => a + b, 0) / (durations.length || 1);

        // ---- AVG FARE
        const fares = rides.map((r) => r.fareTotal || 0);

        const avg =
          fares.reduce((a, b) => a + b, 0) / (fares.length || 1);

        // ---- ACCEPTANCE RATE
        const accepted = rides.filter(r => r.status !== "searching_driver").length;
        const acceptance = (accepted / (total || 1)) * 100;

        // ---- CANCELLATION RATE
        const cancelled = rides.filter(r => r.status === "cancelled").length;
        const cancelRate = (cancelled / (total || 1)) * 100;

        setTotalRides(total);
        setAvgTripDuration(avgDuration.toFixed(1));
        setAvgFare(avg.toFixed(2));
        setAcceptanceRate(acceptance.toFixed(1));
        setCancellationRate(cancelRate.toFixed(1));

        setLoading(false);
      },
      (err) => {
        console.error("Ride analytics error:", err);
        setError(err);
        setLoading(false);
      }
    );

    const unsubDrivers = onSnapshot(
      driversQuery,
      (snapshot) => {
        const drivers = snapshot.docs.map((d) => d.data());

        // Sort by rides completed
        const sorted = drivers
          .filter(d => d.ridesCount)
          .sort((a, b) => (b.ridesCount || 0) - (a.ridesCount || 0))
          .slice(0, 4)
          .map((d, i) => ({
            rank: i + 1,
            initials: (d.firstName?.[0] || "") + (d.lastName?.[0] || ""),
            name: `${d.firstName || ""} ${d.lastName || ""}`,
            rides: d.ridesCount || 0,
            rating: d.rating || 0,
          }));

        setTopDrivers(sorted);
      }
    );

    return () => {
      unsubRides();
      unsubDrivers();
    };
  }, []);

  return {
    totalRides,
    avgTripDuration,
    avgFare,
    acceptanceRate,
    cancellationRate,
    topDrivers,
    loading,
    error,
  };
}