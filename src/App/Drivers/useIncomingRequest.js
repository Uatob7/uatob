import { useEffect, useState } from "react";
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
} from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

// ── Haversine distance in miles ───────────────────────────────────────
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R    = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Find closest online driver to a pickup point ─────────────────────
async function findClosestDriverUid(pickupLat, pickupLng) {
  const driversSnap = await getDocs(
    query(
      collection(db, "Drivers"),
      where("status", "==", "online"),
      where("trip",   "==", true)
    )
  );

  let closestUid  = null;
  let closestDist = Infinity;

  driversSnap.forEach((doc) => {
    const { uid, lat, lng } = doc.data();
    if (lat == null || lng == null || !uid) return;

    const dist = haversineDistance(lat, lng, pickupLat, pickupLng);
    if (dist < closestDist) {
      closestDist = dist;
      closestUid  = uid;
    }
  });

  return closestUid;
}

// ── Hook ──────────────────────────────────────────────────────────────
export function useIncomingRequest(uid) {
  const [requests, setRequests] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const q = query(
      collection(db, "Rides"),
      where("status", "==", "searching_driver")
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        try {
          const rides = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          // For each ride, check if this driver is the closest
          const filtered = [];

          await Promise.all(
            rides.map(async (ride) => {
              const { pickupLat, pickupLng } = ride;
              if (pickupLat == null || pickupLng == null) return;

              const closestUid = await findClosestDriverUid(pickupLat, pickupLng);

              if (closestUid === uid) {
                filtered.push(ride);
              }
            })
          );

          setRequests(filtered);
        } catch (err) {
          console.error("useIncomingRequest filter error:", err);
          setError(err);
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        console.error("useIncomingRequest snapshot error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [uid]);

  return { requests, loading, error };
}