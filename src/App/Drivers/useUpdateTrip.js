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

const PROXIMITY = {
  arrive:   300,
  start:    500,
  complete: 300,
};

const MAX_LOCATION_AGE_MS = 2 * 60 * 1000;

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

async function getDistanceMeters(originLat, originLng, destLat, destLng) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  if (!key) throw new Error("Maps key not configured");

  const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method:  "POST",
    headers: {
      "Content-Type":     "application/json",
      "X-Goog-Api-Key":   key,
      "X-Goog-FieldMask": "routes.distanceMeters",
    },
    body: JSON.stringify({
      origin:                   { location: { latLng: { latitude: originLat, longitude: originLng } } },
      destination:              { location: { latLng: { latitude: destLat,   longitude: destLng   } } },
      travelMode:               "DRIVE",
      routingPreference:        "TRAFFIC_UNAWARE",
      computeAlternativeRoutes: false,
    }),
    signal: AbortSignal.timeout(8000),
  });

  const data = await res.json();
  const route = data?.routes?.[0];
  if (!route) throw new Error("Could not compute route");
  return route.distanceMeters ?? 0;
}

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

      // ── Step 2: fresh location check ──────────────────
      const { driverLat, driverLng, driverLocationAt } = ride;

      if (typeof driverLat !== "number" || typeof driverLng !== "number")
        throw new Error("Driver location not available");

      const locationAgeMs = Date.now() - (driverLocationAt?.toMillis?.() ?? 0);
      if (locationAgeMs > MAX_LOCATION_AGE_MS)
        throw new Error("Driver location is stale. Make sure your GPS is on and the app is open.");

      // ── Step 3: proximity check ───────────────────────
      const targetLat = ride[transition.targetLat];
      const targetLng = ride[transition.targetLng];

      if (typeof targetLat !== "number" || typeof targetLng !== "number")
        throw new Error(`${transition.targetName} coordinates missing on ride`);

      let distanceMeters;
      try {
        distanceMeters = await getDistanceMeters(driverLat, driverLng, targetLat, targetLng);
      } catch (err) {
        throw new Error("Could not verify location. Try again.");
      }

      if (distanceMeters > PROXIMITY[action])
        throw new Error(`You're too far from the ${transition.targetName} (${Math.round(distanceMeters)}m away). Get closer and try again.`);

      // ── Step 4: transactional state transition ────────
      await runTransaction(db, async (tx) => {
        const fresh = await tx.get(rideRef);
        if (!fresh.exists()) throw new Error("Ride not found");
        if (fresh.data().status !== transition.from) throw new Error("Ride status changed, please refresh");

        tx.update(rideRef, {
          status:                      transition.to,
          [transition.field]:          serverTimestamp(),
          [`${action}DistanceMeters`]: Math.round(distanceMeters),
          updatedAt:                   serverTimestamp(),
        });
      });

      return { success: true, action, status: transition.to, distanceMeters: Math.round(distanceMeters) };
    } catch (err) {
      setError(err?.message || "updateTripStatus failed");
      throw err;
    } finally { setLoading(false); }
  }, []);

  return { call, loading, error };
}
