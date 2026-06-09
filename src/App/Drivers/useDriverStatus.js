import { useCallback, useState } from "react";
import {
  getFirestore,
  doc,
  collection,
  query,
  where,
  limit,
  getDocs,
  setDoc,
  serverTimestamp,
  deleteField,
} from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

const db = getFirestore(firebase_app);

const ACTIVE_RIDE_STATUSES = [
  "driver_assigned",
  "driver_arriving",
  "arrived",
  "in_progress",
];

async function geocode(lat, lng) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  if (!key) return { city: null, zip: null };
  try {
    const res  = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`
    );
    const data = await res.json();
    if (data.status !== "OK" || !data.results?.length) return { city: null, zip: null };
    let city = "", zip = "";
    for (const c of data.results[0].address_components ?? []) {
      if (!city && c.types?.includes("locality"))                        city = c.long_name;
      if (!city && c.types?.includes("administrative_area_level_2"))    city = c.long_name;
      if (c.types?.includes("postal_code"))                             zip  = c.long_name;
    }
    return { city: city || null, zip: zip || null };
  } catch {
    return { city: null, zip: null };
  }
}

async function pingActiveRide(driverUid, lat, lng) {
  try {
    const snap = await getDocs(
      query(
        collection(db, "Rides"),
        where("driverUid", "==", driverUid),
        where("status", "in", ACTIVE_RIDE_STATUSES),
        limit(1)
      )
    );
    if (snap.empty) return null;
    const rideRef = snap.docs[0].ref;
    await setDoc(rideRef, {
      driverLat:        lat,
      driverLng:        lng,
      driverLocationAt: serverTimestamp(),
      updatedAt:        serverTimestamp(),
    }, { merge: true });
    return snap.docs[0].id;
  } catch {
    return null;
  }
}

export function useDriverStatus() {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  const call = useCallback(async ({ uid, status, lat, lng }) => {
    setLoading(true); setError(null);
    try {
      if (!uid?.trim()) throw new Error("uid is required");
      const driverUid = uid.trim();

      if (!["online", "offline", "location_ping"].includes(status))
        throw new Error("invalid status");

      const needsLocation = status === "online" || status === "location_ping";
      let numLat = null, numLng = null;
      if (needsLocation) {
        numLat = Number(lat); numLng = Number(lng);
        if (!Number.isFinite(numLat) || !Number.isFinite(numLng)) throw new Error("lat/lng must be numbers");
        if (numLat < -90 || numLat > 90 || numLng < -180 || numLng > 180) throw new Error("lat/lng out of range");
      }

      let city = null, zip = null;
      if (status === "online") ({ city, zip } = await geocode(numLat, numLng));

      let update;
      if (status === "location_ping") {
        update = {
          lat:               numLat,
          lng:               numLng,
          lastLocationAt:    serverTimestamp(),
          lastSeenAt:        serverTimestamp(),
          presenceUpdatedAt: serverTimestamp(),
          updatedAt:         serverTimestamp(),
        };
      } else if (status === "online") {
        update = {
          status:            "online",
          lat:               numLat,
          lng:               numLng,
          city,
          zip,
          lastLocationAt:    serverTimestamp(),
          lastSeenAt:        serverTimestamp(),
          presenceUpdatedAt: serverTimestamp(),
          updatedAt:         serverTimestamp(),
        };
      } else {
        update = {
          status:            "offline",
          lat:               deleteField(),
          lng:               deleteField(),
          city:              deleteField(),
          zip:               deleteField(),
          lastLocationAt:    deleteField(),
          lastSeenAt:        serverTimestamp(),
          presenceUpdatedAt: serverTimestamp(),
          updatedAt:         serverTimestamp(),
        };
      }

      await setDoc(doc(db, "Drivers", driverUid), update, { merge: true });

      let updatedRideId = null;
      if (numLat != null && status !== "offline") {
        updatedRideId = await pingActiveRide(driverUid, numLat, numLng);
      }

      return { ok: true, status, city, zip, rideUpdated: !!updatedRideId, rideId: updatedRideId };
    } catch (err) {
      setError(err?.message || "DriverStatus failed");
      throw err;
    } finally { setLoading(false); }
  }, []);

  return { call, loading, error };
}
