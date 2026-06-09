import { useEffect, useCallback, useRef } from "react";
import { getFirestore, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { firebase_app } from "@/firebase/config";

/**
 * Direct Firestore presence hook (no Cloud Function)
 */
export function useAccountPresence(uid, options = {}) {
  const {
    heartbeat = false,
    interval = 30000, // 30s default heartbeat
  } = options;

  const db = getFirestore(firebase_app);
  const intervalRef = useRef(null);

  const updatePresence = useCallback(async () => {
    if (!uid) return;

    try {
      // Try Drivers first
      const driverRef = doc(db, "Drivers", uid);

      await updateDoc(driverRef, {
        presenceUpdatedAt: serverTimestamp(),
      });

      return;
    } catch (err) {
      // If driver doc fails, try Accounts
      try {
        const accountRef = doc(db, "Accounts", uid);

        await updateDoc(accountRef, {
          presenceUpdatedAt: serverTimestamp(),
        });
      } catch (err2) {
        console.warn(
          "[useAccountPresence] failed to update presence:",
          err2?.message
        );
      }
    }
  }, [uid, db]);

  // 🔥 run once when uid changes
  useEffect(() => {
    if (!uid) return;
    updatePresence();
  }, [uid, updatePresence]);

  // 🔁 optional heartbeat (keeps user "active")
  useEffect(() => {
    if (!uid || !heartbeat) return;

    intervalRef.current = setInterval(() => {
      updatePresence();
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [uid, heartbeat, interval, updatePresence]);

  return updatePresence;
}