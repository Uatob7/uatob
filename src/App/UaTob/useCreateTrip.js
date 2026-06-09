// src/App/UaTob/useCreateTrip.js

import { useState, useCallback } from "react";
import {
  collection,
  addDoc,
  serverTimestamp,
  getFirestore,
} from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

export function useCreateTrip(uid) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tripId, setTripId] = useState(null);

  const createTrip = useCallback(
    async (tripData = {}) => {
      if (!uid) {
        setError("Missing uid");
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const ref = await addDoc(collection(db, "Rides"), {
          userId: uid,

          status: "searching_driver",

          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),

          ...tripData,
        });

        setTripId(ref.id);
        setLoading(false);

        return ref.id;
      } catch (err) {
        console.error("[useCreateTrip]", err);
        setError(err.message || "Failed to create trip");
        setLoading(false);
        return null;
      }
    },
    [uid]
  );

  return {
    createTrip,
    tripId,
    loading,
    error,
  };
}